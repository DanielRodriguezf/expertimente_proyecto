import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import { 
  ToastController, LoadingController,
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon,
  IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
  IonFooter, IonChip, IonLabel, IonCheckbox, IonModal, IonList
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, checkmarkCircle, warning, closeCircle, 
  informationCircle, schoolOutline, briefcaseOutline, timeOutline, starOutline,
  addOutline, closeOutline, trashOutline, businessOutline, addCircleOutline,
  briefcase, chevronDownOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';

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
    IonFooter, IonChip, IonLabel, IonCheckbox, IonModal, IonList
  ]
})
export class UsuarioInfoPage implements OnInit {
  pasoActual: number = 1;
  totalPasos: number = 5; 
  cargando: boolean = true;
  modalEstudiosAbierto: boolean = false; 

  cvForm: FormGroup;
  
  experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };

  readonly TODAS_BLANDAS = ['Responsabilidad', 'Comunicación', 'Trabajo en equipo', 'Puntualidad', 'Empatía', 'Proactividad', 'Resolución de problemas'];
  readonly TODAS_TECNICAS = ['Uso de computador', 'Atención al cliente', 'Herramientas de oficina (Excel, Word)', 'Manejo de caja', 'Ventas', 'Control de Bodega', 'Atención telefónica'];

  sugerenciasBlandas: string[] = [...this.TODAS_BLANDAS];
  sugerenciasTecnicas: string[] = [...this.TODAS_TECNICAS];

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
      disponibilidad: ['', Validators.required],
      habilidadesBlandas: ['', Validators.required],
      habilidadesTecnicas: ['', Validators.required]
    });
  }

  ionViewWillEnter() { this.pasoActual = 1; }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(this.firestore, `postulantes/${user.uid}`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data['cvManual']) {
              const cv = data['cvManual'];
              this.cvForm.patchValue({
                nivelEducativo: cv.nivelEducativo || '',
                establecimiento: cv.establecimiento || '',
                carrera: cv.carrera || '',
                areasExperiencia: Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [],
                sinExperiencia: !!cv.sinExperiencia,
                disponibilidad: cv.disponibilidad || '',
                habilidadesBlandas: cv.habilidadesBlandas || '',
                habilidadesTecnicas: cv.habilidadesTecnicas || ''
              });
              this.actualizarSugerenciasBlandas();
              this.actualizarSugerenciasTecnicas();
            }
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
      // Si el usuario escribió una experiencia en los inputs pero olvidó darle a "Agregar Experiencia", la agregamos automáticamente
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

      // Construimos el payload limpio sin tocar cargosInteres
      const cvManualLimpio = {
        nivelEducativo: formValues.nivelEducativo || '',
        establecimiento: formValues.establecimiento || '',
        carrera: formValues.carrera || '',
        sinExperiencia: !!formValues.sinExperiencia,
        areasExperiencia: Array.isArray(formValues.areasExperiencia) ? formValues.areasExperiencia : [],
        disponibilidad: formValues.disponibilidad || '',
        habilidadesBlandas: formValues.habilidadesBlandas || '',
        habilidadesTecnicas: formValues.habilidadesTecnicas || ''
      };

      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await setDoc(docRef, {
        cvManual: cvManualLimpio,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();
      this.mostrarMensaje('¡Información guardada con éxito!', 'success');
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