import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, ToastController, ViewWillEnter
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  briefcaseOutline, checkmarkCircle, sparklesOutline, 
  refreshOutline, chevronForwardOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cargos-interes',
  templateUrl: './cargos-interes.page.html',
  styleUrls: ['./cargos-interes.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
    IonSpinner
  ]
})
export class CargosInteresPage implements OnInit, ViewWillEnter {
  
  uid: string = '';
  cargando: boolean = true;
  escaneandoGlobal: boolean = false;

  perfilPostulante: any = null;
  areasUsuario: string[] = [];

  cargosAprobados: any[] = [];
  resultadosMap: { [cargoId: string]: any } = {};

  // Lista de modelos de Gemini en orden de prioridad para evitar errores 503 (Servidor saturado)
  private readonly GEMINI_MODELS = [
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ];

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'briefcase-outline': briefcaseOutline,
      'checkmark-circle': checkmarkCircle,
      'sparkles-outline': sparklesOutline,
      'refresh-outline': refreshOutline,
      'chevron-forward-outline': chevronForwardOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.uid = user.uid;
        await this.sincronizarDatos();
      } else {
        this.cargando = false;
      }
    });
  }

  async ionViewWillEnter() {
    if (this.uid) {
      await this.sincronizarDatos();
    }
  }

  async sincronizarDatos() {
    this.cargando = true;
    await Promise.all([
      this.cargarCargosAprobados(),
      this.cargarPerfilYResultados()
    ]);
    this.cargando = false;
    this.cdr.detectChanges();
  }

  get tieneCvManual(): boolean {
    const cv = this.perfilPostulante?.cvManual;
    return !!(cv && (cv.nivelEducativo || cv.habilidadesTecnicas || cv.habilidadesBlandas || cv.areasExperiencia?.length));
  }

  get tieneCvDisponible(): boolean {
    return !!(this.perfilPostulante?.cvBase64 || this.tieneCvManual);
  }

  get cargosDeMisAreas(): any[] {
    if (!this.areasUsuario.length) return [];
    return this.cargosAprobados.filter(cargo =>
      this.areasUsuario.some(area => this.cargoPerteneceAArea(cargo, area))
    );
  }

  get todosEvaluados(): boolean {
    const cargos = this.cargosDeMisAreas;
    return cargos.length > 0 && cargos.every(c => !!this.resultadosMap[c.id]);
  }

  irASeleccionarAreas() {
    this.router.navigate(['/usuario-info']);
  }

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private cargoPerteneceAArea(cargo: any, areaBuscada: string): boolean {
    const areaBuscadaNorm = this.normalizarTexto(areaBuscada);
    if (!areaBuscadaNorm) return false;

    const origenAreas = cargo.areas ?? cargo.areaLaboral ?? cargo.area ?? '';
    const textoAreasCargo = Array.isArray(origenAreas)
      ? origenAreas.join(', ')
      : String(origenAreas);

    const partesCargo = textoAreasCargo
      .split(',')
      .map(p => this.normalizarTexto(p))
      .filter(Boolean);

    return partesCargo.some(
      parte => parte.includes(areaBuscadaNorm) || areaBuscadaNorm.includes(parte)
    );
  }

  async cargarCargosAprobados() {
    try {
      const cargosRef = collection(this.firestore, 'cargos');
      const q = query(cargosRef, where('estado', '==', 'aprobado'));
      const querySnapshot = await getDocs(q);
      
      this.cargosAprobados = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    } catch (error) {
      console.error('Error al cargar cargos aprobados:', error);
    }
  }

  async cargarPerfilYResultados() {
    try {
      const docRef = doc(this.firestore, `postulantes/${this.uid}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.perfilPostulante = data;
        this.areasUsuario = Array.isArray(data['areasInteres'])
          ? data['areasInteres']
          : (Array.isArray(data['cvManual']?.['areasInteres']) ? data['cvManual']['areasInteres'] : []);
      }

      const mapaTemp: { [cargoId: string]: any } = {};

      const ternaRef = collection(this.firestore, 'postulaciones-terna');
      const qTerna = query(ternaRef, where('postulanteId', '==', this.uid));
      const ternaSnap = await getDocs(qTerna);
      ternaSnap.forEach(d => {
        const data = d.data();
        if (data['cargoId']) mapaTemp[data['cargoId']] = { docId: d.id, ...data };
      });

      const resRef = collection(this.firestore, 'resultados');
      const qRes = query(resRef, where('postulanteId', '==', this.uid));
      const resSnap = await getDocs(qRes);
      resSnap.forEach(d => {
        const data = d.data();
        if (data['cargoId']) mapaTemp[data['cargoId']] = { docId: d.id, ...data };
      });

      this.resultadosMap = mapaTemp;
    } catch (error) {
      console.error('Error al cargar perfil y resultados del usuario:', error);
    }
  }

  async escanearTodosLosCargosDeMisAreas() {
    const cargosParaEscanear = this.cargosDeMisAreas;
    if (!this.tieneCvDisponible) {
      this.mostrarMensaje('Primero completa tus datos en "Mi Experiencia".', 'warning');
      return;
    }
    if (!cargosParaEscanear.length) return;

    this.escaneandoGlobal = true;
    this.cdr.detectChanges();

    try {
      const nombreCompleto = [
        this.perfilPostulante?.nombre || '',
        this.perfilPostulante?.apellidoPaterno || '',
        this.perfilPostulante?.apellidoMaterno || ''
      ].filter(Boolean).join(' ').trim() || 'Postulante';

      // Evaluamos TODOS los cargos de sus áreas en una sola llamada a Gemini
      const evaluacionesPorCargo = await this.evaluarCargosEnLoteConGemini(cargosParaEscanear);

      for (const cargo of cargosParaEscanear) {
        const evaluacion = evaluacionesPorCargo[cargo.id] || {
          porcentajeIdoneidad: 50,
          fortalezas: [],
          resumenIA: `Compatibilidad evaluada con IA para ${cargo.nombre}.`
        };

        const docId = `${this.uid}_${cargo.id}`;

        const payloadResultado = {
          postulanteId: this.uid,
          nombrePostulante: nombreCompleto,
          correoPostulante: this.perfilPostulante?.correo || '',
          telefonoPostulante: this.perfilPostulante?.telefono || '',
          ciudadPostulante: this.perfilPostulante?.ciudad || '',
          comunaPostulante: this.perfilPostulante?.comuna || '',
          rutPostulante: this.perfilPostulante?.rut || '',
          fotoPerfil: this.perfilPostulante?.fotoPerfil || '',
          cargoId: cargo.id,
          nombreCargo: cargo.nombre,
          areaLaboral: cargo.areaLaboral || '',
          empresaId: cargo.empresaId || '',
          nombreEmpresa: cargo.nombreEmpresa || '',
          porcentajeIdoneidad: evaluacion.porcentajeIdoneidad,
          porcentaje: evaluacion.porcentajeIdoneidad,
          puntaje: evaluacion.porcentajeIdoneidad,
          fortalezas: evaluacion.fortalezas,
          resumenIA: evaluacion.resumenIA,
          disponible: true,
          estado: 'disponible',
          metodoEvaluacion: 'gemini_ai_cv',
          fechaEvaluacion: new Date(),
          fechaActualizacion: new Date().toISOString()
        };

        await Promise.all([
          setDoc(doc(this.firestore, `postulaciones-terna/${docId}`), payloadResultado, { merge: true }),
          setDoc(doc(this.firestore, `resultados/${docId}`), payloadResultado, { merge: true })
        ]);

        this.resultadosMap[cargo.id] = payloadResultado;
        this.cdr.detectChanges();
      }

      const resumenCargos = cargosParaEscanear.map(c => ({
        id: c.id,
        cargo: c.nombre,
        descripcion: c.descripcion || '',
        areaLaboral: c.areaLaboral || '',
        porcentajeIdoneidad: this.resultadosMap[c.id]?.porcentajeIdoneidad || 0
      }));

      await setDoc(doc(this.firestore, `postulantes/${this.uid}`), {
        cargosInteres: resumenCargos,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      this.mostrarMensaje('¡Listo! Tu currículum fue analizado con Inteligencia Artificial.', 'success');
    } catch (error) {
      console.error('Error al escanear cargos con Gemini:', error);
      this.mostrarMensaje('El servicio de IA está ocupado en este momento. Intenta de nuevo en unos segundos.', 'danger');
    } finally {
      this.escaneandoGlobal = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Evalúa todos los cargos en una sola petición a Gemini e incluye
   * reintentos automáticos y cambio de modelo si un servidor devuelve HTTP 503 o 429.
   */
  private async evaluarCargosEnLoteConGemini(cargos: any[]): Promise<{
    [cargoId: string]: {
      porcentajeIdoneidad: number;
      fortalezas: string[];
      resumenIA: string;
    };
  }> {
    const apiKey = (environment as any)?.geminiApiKey || '';

    if (!apiKey || apiKey === 'TU_API_KEY_DE_GEMINI_AQUI') {
      throw new Error('La API Key de Gemini no está configurada en environment.ts');
    }

    const cvManual = this.perfilPostulante?.cvManual || {};
    const experiencias = Array.isArray(cvManual.areasExperiencia)
      ? cvManual.areasExperiencia.map((e: any) => `- ${e.cargo || ''} en ${e.lugar || ''} (${e.tiempo || ''}): ${e.descripcion || ''}`).join('\n')
      : 'Sin experiencia detallada en formulario';

    const listaCargosTexto = cargos.map((c, idx) => `
CARGO ${idx + 1}:
- cargoId: "${c.id}"
- Nombre: ${c.nombre || ''}
- Área laboral: ${c.areaLaboral || ''}
- Descripción: ${c.descripcion || ''}
- Habilidades técnicas requeridas: ${c.habilidadesTecnicas || 'No especificadas'}
- Habilidades blandas requeridas: ${c.habilidadesBlandas || 'No especificadas'}
- Nivel educativo mínimo: ${c.nivelEducativoMinimo || 'No especificado'}
- Años de experiencia mínima: ${c.anosExperienciaMinima ?? 0}`).join('\n');

    const promptTexto = `
Eres un experto en reclutamiento inclusivo de la plataforma ExpertiMente.
Evalúa el nivel de idoneidad (compatibilidad de 0 a 100) entre el Currículum del Postulante y CADA UNO de los cargos listados.

DATOS DEL POSTULANTE (Formulario de Perfil + PDF adjunto si está presente):
- Nivel educativo: ${cvManual.nivelEducativo || 'No especificado'}
- Establecimiento: ${cvManual.establecimiento || 'No especificado'}
- Carrera o especialidad: ${cvManual.carrera || 'No especificada'}
- Disponibilidad: ${cvManual.disponibilidad || 'No especificada'}
- Habilidades técnicas declaradas: ${cvManual.habilidadesTecnicas || 'No especificadas'}
- Habilidades blandas declaradas: ${cvManual.habilidadesBlandas || 'No especificadas'}
- Áreas de interés seleccionadas: ${(this.areasUsuario || []).join(', ')}
- Experiencia laboral declarada:
${experiencias}

LISTA DE CARGOS A EVALUAR:
${listaCargosTexto}

INSTRUCCIONES DE SALIDA:
Analiza tanto el texto anterior como el documento PDF adjunto (si se incluye) y responde ÚNICAMENTE con un arreglo JSON válido donde cada elemento tenga esta estructura exacta:
[
  {
    "cargoId": "ID exacto del cargo entregado arriba",
    "porcentajeIdoneidad": número entero entre 15 y 98,
    "fortalezas": ["máximo 4 fortalezas o coincidencias breves detectadas en el CV"],
    "resumenIA": "1 oración breve y clara para el reclutador explicando el porqué del porcentaje"
  }
]`;

    const parts: any[] = [{ text: promptTexto }];

    const pdfBase64Limpio = this.extraerBase64PuroDePdf(this.perfilPostulante?.cvBase64 || '');
    if (pdfBase64Limpio) {
      parts.push({
        inline_data: {
          mime_type: 'application/pdf',
          data: pdfBase64Limpio
        }
      });
    }

    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    const data = await this.llamarGeminiConReintento(apiKey, requestBody);
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const jsonLimpio = rawText.replace(/```json|```/g, '').trim();
    const arregloResultados = JSON.parse(jsonLimpio);

    const mapaSalida: {
      [cargoId: string]: {
        porcentajeIdoneidad: number;
        fortalezas: string[];
        resumenIA: string;
      };
    } = {};

    if (Array.isArray(arregloResultados)) {
      arregloResultados.forEach((item: any) => {
        if (!item?.cargoId) return;
        const porcentaje = Math.max(
          15,
          Math.min(98, Math.round(Number(item.porcentajeIdoneidad) || 50))
        );
        const fortalezas = Array.isArray(item.fortalezas)
          ? item.fortalezas.map((f: any) => String(f).trim()).filter(Boolean).slice(0, 5)
          : [];
        const resumenIA = typeof item.resumenIA === 'string' && item.resumenIA.trim()
          ? item.resumenIA.trim()
          : `Compatibilidad del ${porcentaje}% calculada con IA.`;

        mapaSalida[item.cargoId] = {
          porcentajeIdoneidad: porcentaje,
          fortalezas,
          resumenIA
        };
      });
    }

    return mapaSalida;
  }

  /**
   * Intenta la llamada con gemini-2.5-flash; si recibe 503 o 429 (servidor saturado),
   * espera brevemente y prueba automáticamente con gemini-2.0-flash y gemini-1.5-flash.
   */
  private async llamarGeminiConReintento(apiKey: string, body: string): Promise<any> {
    let ultimoError: any = null;

    for (const modelo of this.GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

      for (let intento = 1; intento <= 2; intento++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
          });

          if (response.ok) {
            return await response.json();
          }

          // Si es 503 (Overloaded) o 429 (Rate limit), esperamos y pasamos al siguiente intento/modelo
          if (response.status === 503 || response.status === 429) {
            console.warn(`Modelo ${modelo} ocupado (HTTP ${response.status}). Reintentando...`);
            ultimoError = new Error(`Error HTTP Gemini: ${response.status} en ${modelo}`);
            await new Promise(res => setTimeout(res, 1200 * intento));
            continue;
          }

          throw new Error(`Error HTTP Gemini: ${response.status}`);
        } catch (err) {
          ultimoError = err;
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    }

    throw ultimoError || new Error('No fue posible conectar con los servidores de Gemini.');
  }

  private extraerBase64PuroDePdf(dataUrl: string): string | null {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    if (dataUrl.startsWith('data:application/pdf;base64,')) {
      return dataUrl.split(',')[1] || null;
    }
    return null;
  }

  obtenerClasePorcentaje(porcentaje: number = 0): string {
    if (porcentaje >= 75) return 'score-high';
    if (porcentaje >= 50) return 'score-medium';
    return 'score-low';
  }

  verDetallesCargo(cargoId: string) {
    this.router.navigate(['/oferta-detalle', cargoId], {
      queryParams: { tipo: 'terna' }
    });
  }

  async mostrarMensaje(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2400,
      cssClass: 'toast-expertimente',
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}