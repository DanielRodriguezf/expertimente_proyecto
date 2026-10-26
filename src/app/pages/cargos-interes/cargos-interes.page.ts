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

      for (const cargo of cargosParaEscanear) {
        const evaluacion = await this.calcularIdoneidadConIA(cargo);
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
          metodoEvaluacion: 'escaneo_cv_ia',
          fechaEvaluacion: new Date(),
          fechaActualizacion: new Date().toISOString()
        };

        await Promise.all([
          setDoc(doc(this.firestore, `postulaciones-terna/${docId}`), payloadResultado, { merge: true }),
          setDoc(doc(this.firestore, `resultados/${docId}`), payloadResultado, { merge: true })
        ]);

        this.resultadosMap[cargo.id] = payloadResultado;
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

      this.mostrarMensaje('¡Listo! Tu currículum fue analizado con éxito.', 'success');
    } catch (error) {
      console.error('Error al escanear cargos:', error);
      this.mostrarMensaje('Hubo un error al analizar tu currículum.', 'danger');
    } finally {
      this.escaneandoGlobal = false;
      this.cdr.detectChanges();
    }
  }

  private async calcularIdoneidadConIA(cargo: any): Promise<{
    porcentajeIdoneidad: number;
    fortalezas: string[];
    resumenIA: string;
  }> {
    await new Promise(res => setTimeout(res, 400));

    const cvManual = this.perfilPostulante?.cvManual || {};
    const textoPdfExtraido = this.extraerTextoLegibleDesdeBase64(this.perfilPostulante?.cvBase64 || '');

    const experienciasTexto = Array.isArray(cvManual.areasExperiencia)
      ? cvManual.areasExperiencia.map((e: any) => `${e.cargo || ''} ${e.lugar || ''} ${e.tiempo || ''} ${e.descripcion || ''}`).join(' ')
      : '';

    const corpusCandidato = this.normalizarTexto([
      cvManual.carrera || '',
      cvManual.nivelEducativo || '',
      cvManual.establecimiento || '',
      cvManual.habilidadesTecnicas || '',
      cvManual.habilidadesBlandas || '',
      (this.areasUsuario || []).join(' '),
      experienciasTexto,
      textoPdfExtraido
    ].join(' '));

    const fortalezasDetectadas: string[] = [];

    const reqTecnicas = this.dividirListaRequisitos(cargo.habilidadesTecnicas || '');
    let puntosTecnicos = 0;
    if (reqTecnicas.length > 0) {
      let aciertosTec = 0;
      reqTecnicas.forEach(hab => {
        if (this.coincideTermino(corpusCandidato, hab)) {
          aciertosTec++;
          if (fortalezasDetectadas.length < 5) fortalezasDetectadas.push(hab);
        }
      });
      puntosTecnicos = Math.min(40, Math.round((aciertosTec / reqTecnicas.length) * 40) + (aciertosTec > 0 ? 10 : 4));
    } else {
      puntosTecnicos = cvManual.habilidadesTecnicas ? 30 : 20;
    }

    const reqBlandas = this.dividirListaRequisitos(cargo.habilidadesBlandas || '');
    let puntosBlandos = 0;
    if (reqBlandas.length > 0) {
      let aciertosBlandos = 0;
      reqBlandas.forEach(hab => {
        if (this.coincideTermino(corpusCandidato, hab)) {
          aciertosBlandos++;
          if (fortalezasDetectadas.length < 6) fortalezasDetectadas.push(hab);
        }
      });
      puntosBlandos = Math.min(20, Math.round((aciertosBlandos / reqBlandas.length) * 20) + (aciertosTecOrBlandos(aciertosBlandos)));
    } else {
      puntosBlandos = cvManual.habilidadesBlandas ? 16 : 10;
    }

    function aciertosTecOrBlandos(aciertos: number): number {
      return aciertos > 0 ? 5 : 3;
    }

    let puntosAreaYRol = 20;
    if (cargo.areaLaboral && fortalezasDetectadas.length < 6) {
      fortalezasDetectadas.push(`Área afín: ${cargo.areaLaboral.split(',')[0].trim()}`);
    }
    if (this.coincideTermino(corpusCandidato, cargo.nombre || '')) {
      puntosAreaYRol = 25;
      fortalezasDetectadas.unshift(`Experiencia afín a ${cargo.nombre}`);
    }

    let puntosEduExp = 5;
    const tieneExp = !cvManual.sinExperiencia && Array.isArray(cvManual.areasExperiencia) && cvManual.areasExperiencia.length > 0;
    if (tieneExp) puntosEduExp += 5;
    if (cvManual.nivelEducativo) puntosEduExp += 5;

    const puntajeTotal = Math.max(30, Math.min(98, puntosTecnicos + puntosBlandos + puntosAreaYRol + puntosEduExp));

    const resumenIA = puntajeTotal >= 75
      ? `Alta compatibilidad con ${cargo.nombre}.`
      : puntajeTotal >= 50
      ? `Compatibilidad media para ${cargo.nombre}.`
      : `Compatibilidad inicial para ${cargo.nombre}.`;

    return {
      porcentajeIdoneidad: puntajeTotal,
      fortalezas: Array.from(new Set(fortalezasDetectadas)).slice(0, 5),
      resumenIA
    };
  }

  private dividirListaRequisitos(texto: string): string[] {
    return (texto || '')
      .split(/[,;.]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  private coincideTermino(corpusNormalizado: string, termino: string): boolean {
    const limpio = this.normalizarTexto(termino);
    if (!limpio) return false;
    if (corpusNormalizado.includes(limpio)) return true;

    const palabrasClave = limpio.split(/\s+/).filter(p => p.length > 3);
    if (!palabrasClave.length) return false;
    return palabrasClave.some(palabra => corpusNormalizado.includes(palabra));
  }

  private extraerTextoLegibleDesdeBase64(dataUrl: string): string {
    try {
      if (!dataUrl || !dataUrl.includes(',')) return '';
      const base64 = dataUrl.split(',')[1];
      const binario = atob(base64);
      const fragmentos = binario.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s,.;:-]{4,}/g);
      return fragmentos ? fragmentos.join(' ') : '';
    } catch {
      return '';
    }
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