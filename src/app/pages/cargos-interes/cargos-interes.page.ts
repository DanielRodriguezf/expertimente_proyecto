import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonIcon, IonButton,
  IonSpinner, ToastController, ViewWillEnter
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  briefcaseOutline, checkmarkCircle, sparklesOutline, 
  refreshOutline, chevronForwardOutline, warning, closeCircle, 
  informationCircle, checkboxOutline, ribbonOutline, createOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { 
  Firestore, doc, getDoc, setDoc, updateDoc, deleteField,
  collection, query, where, getDocs 
} from '@angular/fire/firestore';
import { IaCvService, DatosInsuficientesError, EvaluacionCargo } from '../../services/ia-cv';

@Component({
  selector: 'app-cargos-interes',
  templateUrl: './cargos-interes.page.html',
  styleUrls: ['./cargos-interes.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonCard, IonIcon, IonButton,
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
      'information-circle': informationCircle,
      'checkbox-outline': checkboxOutline,
      'ribbon-outline': ribbonOutline,
      'create-outline': createOutline
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
    return !!(cv && (cv.nivelEducativo || cv.formacionesAcademicas?.length || cv.habilidadesTecnicas || cv.habilidadesBlandas || cv.areasExperiencia?.length));
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

        // Si el documento del postulante tenía el campo antiguo 'cargosInteres', lo limpiamos
        if ('cargosInteres' in data) {
          await updateDoc(docRef, { cargosInteres: deleteField() });
        }
      }

      const mapaTemp: { [cargoId: string]: any } = {};

      // Solo consultamos la colección postulaciones-terna
      const ternaRef = collection(this.firestore, 'postulaciones-terna');
      const qTerna = query(ternaRef, where('postulanteId', '==', this.uid));
      const ternaSnap = await getDocs(qTerna);
      ternaSnap.forEach(d => {
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

    // Si todos los cargos ya tienen resultado, el usuario está pidiendo "Actualizar":
    // se vuelven a evaluar todos con la IA y se sobrescriben los resultados guardados.
    // Si faltan cargos por procesar, la IA solo evalúa los nuevos o los que cambiaron
    // (el perfil o el cargo) y el resto se reutiliza, que es lo más rápido.
    const actualizandoProcesados = this.todosEvaluados;

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
        this.areasUsuario,
        { ignorarCache: actualizandoProcesados }
      );

      // Se guardan todos los resultados a la vez (antes se guardaban uno por uno)
      const guardados = await Promise.allSettled(
        cargosParaEscanear
          .filter(cargo => !!evaluaciones[cargo.id])
          .map(cargo => this.guardarResultado(cargo, evaluaciones[cargo.id], nombreCompleto))
      );

      const fallidos = guardados.filter(g => g.status === 'rejected');
      if (fallidos.length) {
        console.error('Error al guardar algunos resultados:', fallidos);
        this.mostrarMensaje('No se pudieron guardar todos tus resultados. Intenta nuevamente.', 'warning', 4000);
      } else {
        this.mostrarMensaje(
          actualizandoProcesados
            ? '¡Listo! Actualizamos tu compatibilidad con tu información más reciente.'
            : '¡Listo! Tu currículum fue analizado y tus resultados están actualizados.',
          'success'
        );
      }
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

  /** Guarda (o actualiza, si ya existía) el resultado de un cargo ÚNICAMENTE en postulaciones-terna. */
  private async guardarResultado(cargo: any, evaluacion: EvaluacionCargo, nombreCompleto: string): Promise<void> {
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

    await setDoc(doc(this.firestore, `postulaciones-terna/${docId}`), payloadResultado, { merge: true });

    this.resultadosMap[cargo.id] = payloadResultado;
    this.cdr.detectChanges();
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