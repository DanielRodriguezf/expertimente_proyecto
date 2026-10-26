import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import { 
  ToastController, LoadingController,
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon,
  IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
  IonChip, IonLabel, IonCheckbox, IonModal, IonList
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, checkmarkCircle, warning, closeCircle, 
  informationCircle, schoolOutline, briefcaseOutline, timeOutline, starOutline,
  addOutline, closeOutline, trashOutline, businessOutline, addCircleOutline,
  briefcase, chevronDownOutline, sparklesOutline, searchOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-usuario-info',
  templateUrl: './usuario-info.page.html',
  styleUrls: ['./usuario-info.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonButton, IonIcon,
    IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
    IonChip, IonLabel, IonCheckbox, IonModal, IonList
  ]
})
export class UsuarioInfoPage implements OnInit {
  pasoActual: number = 1;
  totalPasos: number = 6; 
  cargando: boolean = true;
  modalEstudiosAbierto: boolean = false; 

  cvForm: FormGroup;
  
  experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };

  readonly TODAS_BLANDAS = ['Responsabilidad', 'Comunicación', 'Trabajo en equipo', 'Puntualidad', 'Empatía', 'Proactividad', 'Resolución de problemas'];
  readonly TODAS_TECNICAS = ['Uso de computador', 'Atención al cliente', 'Herramientas de oficina (Excel, Word)', 'Manejo de caja', 'Ventas', 'Control de Bodega', 'Atención telefónica'];

  sugerenciasBlandas: string[] = [...this.TODAS_BLANDAS];
  sugerenciasTecnicas: string[] = [...this.TODAS_TECNICAS];

  // Áreas extraídas exclusivamente desde la colección 'cargos' en Firestore
  listaAreasDisponibles: string[] = [];
  areasFiltradas: string[] = [];
  terminoBusquedaArea: string = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline, 'checkmark-circle': checkmarkCircle,
      'warning': warning, 'close-circle': closeCircle, 'information-circle': informationCircle,
      'school-outline': schoolOutline, 'briefcase-outline': briefcaseOutline,
      'time-outline': timeOutline, 'star-outline': starOutline, 'add-outline': addOutline,
      'close-outline': closeOutline, 'trash-outline': trashOutline, 'business-outline': businessOutline,
      'add-circle-outline': addCircleOutline, 'briefcase': briefcase, 'chevron-down-outline': chevronDownOutline,
      'sparkles-outline': sparklesOutline, 'search-outline': searchOutline
    });

    this.cvForm = this.fb.group({
      nivelEducativo: ['', Validators.required],
      establecimiento: ['', Validators.required],
      carrera: [''], 
      areasExperiencia: [[]], 
      sinExperiencia: [false], 
      disponibilidad: ['', Validators.required],
      habilidadesBlandas: ['', Validators.required],
      habilidadesTecnicas: ['', Validators.required],
      areasInteres: [[], Validators.required]
    });
  }

  ionViewWillEnter() { this.pasoActual = 1; }

  async ngOnInit() {
    await this.cargarAreasDesdeCargos();

    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(this.firestore, `postulantes/${user.uid}`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const cv = data['cvManual'] || {};
            const areasGuardadas: string[] = Array.isArray(cv.areasInteres)
              ? cv.areasInteres
              : (Array.isArray(data['areasInteres']) ? data['areasInteres'] : []);

            areasGuardadas.forEach(area => this.asegurarAreaEnLista(area));

            this.cvForm.patchValue({
              nivelEducativo: cv.nivelEducativo || '',
              establecimiento: cv.establecimiento || '',
              carrera: cv.carrera || '',
              areasExperiencia: Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [],
              sinExperiencia: !!cv.sinExperiencia,
              disponibilidad: cv.disponibilidad || '',
              habilidadesBlandas: cv.habilidadesBlandas || '',
              habilidadesTecnicas: cv.habilidadesTecnicas || '',
              areasInteres: areasGuardadas
            });
            this.actualizarSugerenciasBlandas();
            this.actualizarSugerenciasTecnicas();
          }
        } catch (error) {
          console.error('Error al cargar datos del postulante:', error);
        } finally {
          this.cargando = false;
          this.cdr.detectChanges();
        }
      } else {
        this.cargando = false;
      }
    });
  }

  /**
   * Extrae las áreas directamente desde la colección 'cargos' en Firestore
   * Soporta campos 'areas', 'areaLaboral' o 'area' (tanto en formato array como string separado por comas)
   */
  async cargarAreasDesdeCargos() {
    try {
      const cargosRef = collection(this.firestore, 'cargos');
      const snap = await getDocs(cargosRef);

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const origenAreas = data['areas'] ?? data['areaLaboral'] ?? data['area'];

        if (Array.isArray(origenAreas)) {
          origenAreas.forEach((item: any) => {
            if (typeof item === 'string') {
              item.split(',').map(p => p.trim()).filter(Boolean).forEach(p => this.asegurarAreaEnLista(p));
            }
          });
        } else if (typeof origenAreas === 'string' && origenAreas.trim()) {
          origenAreas
            .split(',')
            .map(p => p.trim())
            .filter(Boolean)
            .forEach(parte => this.asegurarAreaEnLista(parte));
        }
      });
    } catch (error) {
      console.error('Error al extraer áreas desde la colección cargos:', error);
    }
  }

  private asegurarAreaEnLista(nuevaArea: string) {
    const limpia = nuevaArea.trim();
    if (!limpia) return;
    const existe = this.listaAreasDisponibles.some(
      a => this.normalizarTexto(a) === this.normalizarTexto(limpia)
    );
    if (!existe) {
      this.listaAreasDisponibles.push(limpia);
    }
  }

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // --- BUSCADOR DE ÁREAS (NO MUESTRA TODAS INMEDIATAMENTE) ---
  filtrarAreas() {
    const termino = this.normalizarTexto(this.terminoBusquedaArea);
    if (!termino) {
      this.areasFiltradas = [];
      return;
    }

    this.areasFiltradas = this.listaAreasDisponibles.filter(area =>
      this.normalizarTexto(area).includes(termino)
    );
  }

  limpiarBusquedaArea() {
    this.terminoBusquedaArea = '';
    this.areasFiltradas = [];
    this.cdr.detectChanges();
  }

  // --- MÉTODOS DEL MODAL PERSONALIZADO ---
  abrirModalEstudios() {
    this.modalEstudiosAbierto = true;
  }

  seleccionarNivel(nivel: string) {
    this.cvForm.get('nivelEducativo')?.setValue(nivel);
    this.modalEstudiosAbierto = false; 
  }

  get areasExperiencia(): any[] { return this.cvForm.get('areasExperiencia')?.value || []; }
  get sinExperiencia(): boolean { return this.cvForm.get('sinExperiencia')?.value; }
  get areasInteres(): string[] { return this.cvForm.get('areasInteres')?.value || []; }

  // --- MÉTODOS PARA SELECCIÓN DE ÁREAS DE INTERÉS (PASO 6) ---
  esAreaSeleccionada(area: string): boolean {
    return this.areasInteres.some(a => this.normalizarTexto(a) === this.normalizarTexto(area));
  }

  toggleAreaInteres(area: string) {
    const actuales = [...this.areasInteres];
    const index = actuales.findIndex(a => this.normalizarTexto(a) === this.normalizarTexto(area));

    if (index >= 0) {
      actuales.splice(index, 1);
    } else {
      actuales.push(area);
    }

    this.cvForm.get('areasInteres')?.setValue(actuales);
    this.cvForm.get('areasInteres')?.markAsDirty();
    this.cdr.detectChanges();
  }

  limpiarExperienciaSiAplica() {
    if (this.sinExperiencia) {
      this.cvForm.get('areasExperiencia')?.setValue([]);
      this.experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
    }
  }

  agregarExperiencia() {
    const { cargo, lugar, tiempo, descripcion } = this.experienciaActual;
    if (cargo.trim() && lugar.trim() && tiempo.trim()) {
      const nuevaExp = {
        cargo: cargo.trim(),
        lugar: lugar.trim(),
        tiempo: tiempo.trim(),
        descripcion: (descripcion || '').trim()
      };
      const areasActuales = [...this.areasExperiencia];
      this.cvForm.get('areasExperiencia')?.setValue([...areasActuales, nuevaExp]);
      this.cvForm.get('areasExperiencia')?.markAsDirty();
      this.experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
      this.cdr.detectChanges();
    } else {
      this.mostrarMensaje('Por favor completa el cargo, lugar y tiempo.', 'warning');
    }
  }

  eliminarArea(index: number) {
    const areasActuales = [...this.areasExperiencia];
    areasActuales.splice(index, 1);
    this.cvForm.get('areasExperiencia')?.setValue(areasActuales);
    this.cdr.detectChanges();
  }

  actualizarSugerenciasBlandas() {
    const textoActual = (this.cvForm.get('habilidadesBlandas')?.value || '').toLowerCase();
    this.sugerenciasBlandas = this.TODAS_BLANDAS.filter(hab => !textoActual.includes(hab.toLowerCase()));
  }

  actualizarSugerenciasTecnicas() {
    const textoActual = (this.cvForm.get('habilidadesTecnicas')?.value || '').toLowerCase();
    this.sugerenciasTecnicas = this.TODAS_TECNICAS.filter(hab => !textoActual.includes(hab.toLowerCase()));
  }

  agregarHabilidadBlanda(habilidad: string) {
    const actual = this.cvForm.get('habilidadesBlandas')?.value?.trim() || '';
    this.cvForm.get('habilidadesBlandas')?.setValue(actual ? actual + ', ' + habilidad : habilidad);
    this.actualizarSugerenciasBlandas();
  }

  agregarHabilidadTecnica(habilidad: string) {
    const actual = this.cvForm.get('habilidadesTecnicas')?.value?.trim() || '';
    this.cvForm.get('habilidadesTecnicas')?.setValue(actual ? actual + ', ' + habilidad : habilidad);
    this.actualizarSugerenciasTecnicas();
  }

  siguientePaso() {
    if (this.pasoActual === 1) {
      if (this.cvForm.get('nivelEducativo')?.invalid) { this.mostrarMensaje('Selecciona tu nivel de estudios.', 'warning'); return; }
      if (this.cvForm.get('establecimiento')?.invalid) { this.mostrarMensaje('Ingresa dónde estudiaste.', 'warning'); return; }
      const nivel = this.cvForm.get('nivelEducativo')?.value;
      if (['Técnico Superior', 'Universidad', 'Otro'].includes(nivel) && !this.cvForm.get('carrera')?.value) {
        this.mostrarMensaje('Ingresa tu carrera o especialidad.', 'warning'); return;
      }
    }

    if (this.pasoActual === 2) {
      if (!this.sinExperiencia && this.experienciaActual.cargo.trim() && this.experienciaActual.lugar.trim() && this.experienciaActual.tiempo.trim()) {
        this.agregarExperiencia();
      }
      if (!this.sinExperiencia && this.areasExperiencia.length === 0) {
        this.mostrarMensaje('Agrega al menos una experiencia laboral o marca la casilla de "Sin experiencia".', 'warning'); return;
      }
    }
    
    if (this.pasoActual === 3 && this.cvForm.get('disponibilidad')?.invalid) {
      this.mostrarMensaje('Selecciona tu disponibilidad laboral.', 'warning'); return;
    }
    if (this.pasoActual === 4 && this.cvForm.get('habilidadesBlandas')?.invalid) {
      this.mostrarMensaje('Ingresa tus fortalezas personales.', 'warning'); return;
    }
    if (this.pasoActual === 5 && this.cvForm.get('habilidadesTecnicas')?.invalid) {
      this.mostrarMensaje('Ingresa tus habilidades técnicas.', 'warning'); return;
    }
    if (this.pasoActual === 6 && this.areasInteres.length === 0) {
      this.mostrarMensaje('Busca y selecciona al menos un área laboral de tu interés.', 'warning'); return;
    }
    
    if (this.pasoActual < this.totalPasos) { 
      this.pasoActual++; 
    } else { 
      this.guardarDatos(); 
    }
  }

  pasoAnterior() { 
    if (this.pasoActual > 1) { 
      this.pasoActual--; 
    } 
  }

  async guardarDatos() {
    const user = this.auth.currentUser;
    if (!user) { 
      this.mostrarMensaje('Debes iniciar sesión para continuar.', 'warning'); 
      return; 
    }

    const loading = await this.loadingCtrl.create({ message: 'Guardando información...', spinner: 'crescent' });
    await loading.present();

    try {
      const formValues = this.cvForm.getRawValue();
      const areasSeleccionadas = Array.isArray(formValues.areasInteres) ? formValues.areasInteres : [];

      const cvManualLimpio = {
        nivelEducativo: formValues.nivelEducativo || '',
        establecimiento: formValues.establecimiento || '',
        carrera: formValues.carrera || '',
        sinExperiencia: !!formValues.sinExperiencia,
        areasExperiencia: Array.isArray(formValues.areasExperiencia) ? formValues.areasExperiencia : [],
        disponibilidad: formValues.disponibilidad || '',
        habilidadesBlandas: formValues.habilidadesBlandas || '',
        habilidadesTecnicas: formValues.habilidadesTecnicas || '',
        areasInteres: areasSeleccionadas
      };

      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await setDoc(docRef, {
        cvManual: cvManualLimpio,
        areasInteres: areasSeleccionadas,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();
      this.mostrarMensaje('¡Información y áreas de interés guardadas con éxito!', 'success');
      this.router.navigate(['/home']); 
    } catch (error) {
      console.error('Error al guardar en Firestore:', error);
      await loading.dismiss();
      this.mostrarMensaje('Hubo un error al guardar los datos.', 'danger');
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = color === 'success' ? 'checkmark-circle' : (color === 'danger' ? 'close-circle' : 'warning');
    const toast = await this.toastCtrl.create({ 
      message: mensaje, 
      duration: 2500, 
      color: color, 
      cssClass: 'toast-expertimente', 
      position: 'middle', 
      icon: icono 
    });
    await toast.present();
  }
}