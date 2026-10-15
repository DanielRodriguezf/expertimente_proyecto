import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import { ToastController, LoadingController } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon,
  IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
  IonFooter, IonChip, IonLabel, IonCheckbox, IonModal, IonList,
  IonSelect, IonSelectOption
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, checkmarkCircle, warning, closeCircle, 
  informationCircle, schoolOutline, briefcaseOutline, timeOutline, starOutline,
  addOutline, closeOutline, trashOutline, businessOutline, addCircleOutline,
  briefcase, chevronDownOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, setDoc, onSnapshot, collection, query, where, getDocs } from '@angular/fire/firestore';

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
    IonFooter, IonChip, IonLabel, IonCheckbox, IonModal, IonList,
    IonSelect, IonSelectOption // <-- Componentes añadidos
  ]
})
export class UsuarioInfoPage implements OnInit {
  pasoActual: number = 1;
  totalPasos: number = 6; 
  cargando: boolean = true;
  modalEstudiosAbierto: boolean = false; 

  cvForm: FormGroup;
  
  experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
  cargoInteresActual = { cargo: '', descripcion: '' };

  readonly TODAS_BLANDAS = ['Responsabilidad', 'Comunicación', 'Trabajo en equipo', 'Puntualidad', 'Empatía', 'Proactividad', 'Resolución de problemas'];
  readonly TODAS_TECNICAS = ['Uso de computador', 'Atención al cliente', 'Herramientas de oficina (Excel, Word)', 'Manejo de caja', 'Ventas', 'Control de Bodega', 'Atención telefónica'];

  sugerenciasBlandas: string[] = [...this.TODAS_BLANDAS];
  sugerenciasTecnicas: string[] = [...this.TODAS_TECNICAS];

  // Variables para la carga desde Firebase
  cargosDisponibles: any[] = [];
  cargandoCargos: boolean = true;

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
      'add-circle-outline': addCircleOutline, 'briefcase': briefcase, 'chevron-down-outline': chevronDownOutline
    });

    this.cvForm = this.fb.group({
      nivelEducativo: ['', Validators.required],
      establecimiento: ['', Validators.required],
      carrera: [''], 
      areasExperiencia: [[]], 
      sinExperiencia: [false], 
      cargosInteres: [[]], 
      disponibilidad: ['', Validators.required],
      habilidadesBlandas: ['', Validators.required],
      habilidadesTecnicas: ['', Validators.required]
    });
  }

  ionViewWillEnter() { this.pasoActual = 1; }

  ngOnInit() {
    this.cargarCargosAprobados(); // <-- Iniciamos la carga de cargos

    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data['cvManual']) {
              this.cvForm.patchValue(data['cvManual']);
              this.actualizarSugerenciasBlandas();
              this.actualizarSugerenciasTecnicas();
            }
          }
          this.cargando = false;
          this.cdr.detectChanges();
        });
      } else {
        this.cargando = false;
      }
    });
  }

  // --- NUEVO: Cargar cargos desde la colección 'cargos' en Firebase ---
  async cargarCargosAprobados() {
    try {
      const cargosRef = collection(this.firestore, 'cargos');
      const q = query(cargosRef, where('estado', '==', 'aprobado'));
      const querySnapshot = await getDocs(q);
      
      this.cargosDisponibles = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error al cargar cargos de interés:', error);
      this.mostrarMensaje('Error al cargar la lista de cargos', 'danger');
    } finally {
      this.cargandoCargos = false;
      this.cdr.detectChanges();
    }
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
  get cargosInteres(): any[] { return this.cvForm.get('cargosInteres')?.value || []; }
  get sinExperiencia(): boolean { return this.cvForm.get('sinExperiencia')?.value; }

  limpiarExperienciaSiAplica() {
    if (this.sinExperiencia) {
      this.cvForm.get('areasExperiencia')?.setValue([]);
      this.experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
    }
  }

  agregarExperiencia() {
    const { cargo, lugar, tiempo, descripcion } = this.experienciaActual;
    if (cargo.trim() && lugar.trim() && tiempo.trim()) {
      const areasActuales = this.areasExperiencia;
      this.cvForm.get('areasExperiencia')?.setValue([...areasActuales, { ...this.experienciaActual }]);
      this.experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
    } else {
      this.mostrarMensaje('Por favor completa el cargo, lugar y tiempo.', 'warning');
    }
  }

  eliminarArea(index: number) {
    const areasActuales = [...this.areasExperiencia];
    areasActuales.splice(index, 1);
    this.cvForm.get('areasExperiencia')?.setValue(areasActuales);
  }

  agregarCargoInteres() {
    const { cargo, descripcion } = this.cargoInteresActual;
    if (cargo && cargo.trim()) {
      const cargosActuales = this.cargosInteres;
      this.cvForm.get('cargosInteres')?.setValue([...cargosActuales, { ...this.cargoInteresActual }]);
      this.cargoInteresActual = { cargo: '', descripcion: '' };
    } else {
      this.mostrarMensaje('Por favor selecciona un cargo disponible.', 'warning');
    }
  }

  eliminarCargoInteres(index: number) {
    const cargosActuales = [...this.cargosInteres];
    cargosActuales.splice(index, 1);
    this.cvForm.get('cargosInteres')?.setValue(cargosActuales);
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

  // --- NUEVO: Autocompletar descripción al seleccionar cargo ---
  alSeleccionarCargo(event: any) {
    const cargoSeleccionado = event.detail.value;
    const cargoEncontrado = this.cargosDisponibles.find(c => c.nombre === cargoSeleccionado);
    
    if (cargoEncontrado) {
      this.cargoInteresActual.descripcion = cargoEncontrado.descripcion || '';
    } else {
      this.cargoInteresActual.descripcion = '';
    }
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
    if (this.pasoActual === 2 && !this.sinExperiencia && this.areasExperiencia.length === 0) {
      this.mostrarMensaje('Agrega al menos una experiencia laboral o marca la casilla de "Sin experiencia".', 'warning'); return;
    }
    
    if (this.pasoActual === 4 && this.cvForm.get('disponibilidad')?.invalid) {
      this.mostrarMensaje('Selecciona tu disponibilidad laboral.', 'warning'); return;
    }
    if (this.pasoActual === 5 && this.cvForm.get('habilidadesBlandas')?.invalid) {
      this.mostrarMensaje('Ingresa tus fortalezas personales.', 'warning'); return;
    }
    if (this.pasoActual === 6 && this.cvForm.get('habilidadesTecnicas')?.invalid) {
      this.mostrarMensaje('Ingresa tus habilidades técnicas.', 'warning'); return;
    }
    
    if (this.pasoActual < this.totalPasos) { this.pasoActual++; } 
    else { this.guardarDatos(); }
  }

  pasoAnterior() { if (this.pasoActual > 1) { this.pasoActual--; } }

  async guardarDatos() {
    const user = this.auth.currentUser;
    if (!user) { this.mostrarMensaje('Debes iniciar sesión para continuar.', 'warning'); return; }

    const loading = await this.loadingCtrl.create({ message: 'Guardando información...', spinner: 'crescent' });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await setDoc(docRef, {
        cvManual: this.cvForm.value,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();
      this.mostrarMensaje('¡Información guardada con éxito!', 'success');
      this.router.navigate(['/home']); 
    } catch (error) {
      await loading.dismiss();
      this.mostrarMensaje('Hubo un error al guardar los datos.', 'danger');
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = color === 'success' ? 'checkmark-circle' : (color === 'danger' ? 'close-circle' : 'warning');
    const toast = await this.toastCtrl.create({ message: mensaje, duration: 2500, color: color, cssClass: 'toast-expertimente', position: 'middle', icon: icono });
    await toast.present();
  }
}