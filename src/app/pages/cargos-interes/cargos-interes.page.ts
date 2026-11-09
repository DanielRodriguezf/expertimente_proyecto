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
  refreshOutline, chevronForwardOutline, warning, closeCircle, informationCircle
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { IaCvService, DatosInsuficientesError } from '../../services/ia-cv';

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
  private iaCv = inject(IaCvService);

  constructor() {
    addIcons({
      'briefcase-outline': briefcaseOutline,
      'checkmark-circle': checkmarkCircle,
      'sparkles-outline': sparklesOutline,
      'refresh-outline': refreshOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'warning': warning,
      'close-circle': closeCircle,
      'information-circle': informationCircle
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
    this.router.navigate(['/areas-interes'], { queryParams: { volver: this.router.url.split('?')[0] } });
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

        const areasRaiz = Array.isArray(data['areasInteres']) ? data['areasInteres'].filter(Boolean) : [];
        const areasManual = Array.isArray(data['cvManual']?.['areasInteres']) ? data['cvManual']['areasInteres'].filter(Boolean) : [];
        this.areasUsuario = areasRaiz.length ? areasRaiz : areasManual;
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
    await this.cargarPerfilYResultados();

    const cargosParaEscanear = this.cargosDeMisAreas;
    if (!this.tieneCvDisponible) {
      this.mostrarMensaje('Primero sube tu CV o completa tus datos en "Mi Experiencia".', 'warning');
      return;
    }
    if (!cargosParaEscanear.length) {
      this.mostrarMensaje('No hay cargos disponibles en tus áreas seleccionadas.', 'warning');
      return;
    }

    this.escaneandoGlobal = true;
    this.cdr.detectChanges();

    try {
      const nombreCompleto = [
        this.perfilPostulante?.nombre || '',
        this.perfilPostulante?.apellidoPaterno || '',
        this.perfilPostulante?.apellidoMaterno || ''
      ].filter(Boolean).join(' ').trim() || 'Postulante';

      const { evaluaciones } = await this.iaCv.evaluarCargos(
        this.perfilPostulante,
        cargosParaEscanear,
        this.areasUsuario
      );

      let nuevosConIa = 0;
      let nuevosLocales = 0;

      for (const cargo of cargosParaEscanear) {
        const evaluacion = evaluaciones[cargo.id];
        if (!evaluacion) continue;

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
          metodoEvaluacion: evaluacion.metodo === 'gemini' ? 'gemini_ai_cv' : 'local_reglas_cv',
          fechaEvaluacion: new Date(),
          fechaActualizacion: new Date().toISOString()
        };

        await Promise.all([
          setDoc(doc(this.firestore, `postulaciones-terna/${docId}`), payloadResultado, { merge: true }),
          setDoc(doc(this.firestore, `resultados/${docId}`), payloadResultado, { merge: true })
        ]);

        this.resultadosMap[cargo.id] = payloadResultado;
        if (evaluacion.metodo === 'gemini') nuevosConIa++; else nuevosLocales++;
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

      console.info('[Cargos] Escaneo terminado →', { nuevosConIa, nuevosLocales });

      this.mostrarMensaje('¡Listo! Tu currículum fue analizado y tus resultados están actualizados.', 'success');
    } catch (error) {
      console.error('Error al escanear cargos:', error);
      if (error instanceof DatosInsuficientesError) {
        this.mostrarMensaje(
          'No pudimos analizar tu currículum. Completa tus datos en "Mi Experiencia" para continuar.',
          'warning',
          5000
        );
      } else {
        this.mostrarMensaje('No se pudo analizar tu currículum. Intenta nuevamente.', 'danger');
      }
    } finally {
      this.escaneandoGlobal = false;
      this.cdr.detectChanges();
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

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success', duracion: number = 2500) {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: duracion,
      position: 'bottom',
      color,
      icon: iconos[color] || 'information-circle',
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }
}