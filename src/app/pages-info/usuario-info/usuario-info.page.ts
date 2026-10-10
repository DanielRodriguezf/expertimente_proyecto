import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

// Controladores inyectables
import { ToastController, LoadingController } from '@ionic/angular';

// Componentes UI Standalone
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton,IonButton, IonIcon,
  IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
  IonFooter, IonChip, IonLabel
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, checkmarkCircle, warning, closeCircle, 
  informationCircle, schoolOutline, briefcaseOutline, timeOutline, starOutline,
  addOutline, closeOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, setDoc, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-usuario-info',
  templateUrl: './usuario-info.page.html',
  styleUrls: ['./usuario-info.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonButton, IonIcon,
    IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
    IonFooter, IonChip, IonLabel
  ]
})
export class UsuarioInfoPage implements OnInit {
  pasoActual: number = 1;
  totalPasos: number = 5; 
  cargando: boolean = true;

  datosManuales = {
    nivelEducativo: '',
    areasExperiencia: [] as string[],
    anosExperiencia: null as number | null,
    habilidadesBlandas: '',
    habilidadesTecnicas: ''
  };

  nuevaArea: string = '';

  // Listas maestras inmutables
  readonly TODAS_BLANDAS = ['Responsabilidad', 'Comunicación', 'Trabajo en equipo', 'Puntualidad', 'Empatía', 'Proactividad', 'Resolución de problemas'];
  readonly TODAS_TECNICAS = ['Uso de computador', 'Atención al cliente', 'Herramientas de oficina (Excel, Word)', 'Manejo de caja', 'Ventas', 'Control de Bodega', 'Atención telefónica'];

  // Arreglos dinámicos que se muestran en la vista
  sugerenciasBlandas: string[] = [...this.TODAS_BLANDAS];
  sugerenciasTecnicas: string[] = [...this.TODAS_TECNICAS];

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle,
      'information-circle': informationCircle,
      'school-outline': schoolOutline,
      'briefcase-outline': briefcaseOutline,
      'time-outline': timeOutline,
      'star-outline': starOutline,
      'add-outline': addOutline,
      'close-outline': closeOutline
    });
  }

  // Se ejecuta cada vez que el usuario entra a esta vista, asegurando que inicie en el paso 1
  ionViewWillEnter() {
    this.pasoActual = 1;
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data['cvManual']) {
              this.datosManuales = { ...this.datosManuales, ...data['cvManual'] };
              
              if (data['cvManual'].areaExperiencia && this.datosManuales.areasExperiencia.length === 0) {
                this.datosManuales.areasExperiencia = [data['cvManual'].areaExperiencia];
              }
              if (data['cvManual'].habilidades && !this.datosManuales.habilidadesBlandas) {
                this.datosManuales.habilidadesBlandas = data['cvManual'].habilidades;
              }

              // Actualizar los chips en caso de que ya tengan datos guardados
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

  agregarArea() {
    const area = this.nuevaArea.trim();
    if (area && !this.datosManuales.areasExperiencia.includes(area)) {
      this.datosManuales.areasExperiencia.push(area);
      this.nuevaArea = '';
    }
  }

  eliminarArea(index: number) {
    this.datosManuales.areasExperiencia.splice(index, 1);
  }

  // Métodos que evalúan qué sugerencias mostrar basados en el texto actual
  actualizarSugerenciasBlandas() {
    const textoActual = (this.datosManuales.habilidadesBlandas || '').toLowerCase();
    this.sugerenciasBlandas = this.TODAS_BLANDAS.filter(hab => !textoActual.includes(hab.toLowerCase()));
  }

  actualizarSugerenciasTecnicas() {
    const textoActual = (this.datosManuales.habilidadesTecnicas || '').toLowerCase();
    this.sugerenciasTecnicas = this.TODAS_TECNICAS.filter(hab => !textoActual.includes(hab.toLowerCase()));
  }

  // Métodos para agregar el chip al texto
  agregarHabilidadBlanda(habilidad: string) {
    const actual = this.datosManuales.habilidadesBlandas?.trim() || '';
    if (actual) {
      if (!actual.toLowerCase().includes(habilidad.toLowerCase())) {
        this.datosManuales.habilidadesBlandas = actual + ', ' + habilidad;
      }
    } else {
      this.datosManuales.habilidadesBlandas = habilidad;
    }
    
    // Al modificar el texto programáticamente, forzamos la actualización de los chips
    this.actualizarSugerenciasBlandas();
  }

  agregarHabilidadTecnica(habilidad: string) {
    const actual = this.datosManuales.habilidadesTecnicas?.trim() || '';
    if (actual) {
      if (!actual.toLowerCase().includes(habilidad.toLowerCase())) {
        this.datosManuales.habilidadesTecnicas = actual + ', ' + habilidad;
      }
    } else {
      this.datosManuales.habilidadesTecnicas = habilidad;
    }

    this.actualizarSugerenciasTecnicas();
  }

  siguientePaso() {
    if (this.pasoActual === 1 && !this.datosManuales.nivelEducativo) {
      this.mostrarMensaje('Por favor, selecciona tu nivel de estudios.', 'warning');
      return;
    }
    if (this.pasoActual === 2 && this.datosManuales.areasExperiencia.length === 0) {
      this.mostrarMensaje('Por favor, agrega al menos un área o cargo en el que has trabajado.', 'warning');
      return;
    }
    if (this.pasoActual === 3 && (this.datosManuales.anosExperiencia === null || this.datosManuales.anosExperiencia === undefined)) {
      this.mostrarMensaje('Ingresa tus años de experiencia.', 'warning');
      return;
    }
    if (this.pasoActual === 4 && !this.datosManuales.habilidadesBlandas) {
      this.mostrarMensaje('Por favor, escribe algunas de tus habilidades blandas o selecciona de las sugeridas.', 'warning');
      return;
    }
    if (this.pasoActual === 5 && !this.datosManuales.habilidadesTecnicas) {
      this.mostrarMensaje('Por favor, escribe algunas de tus habilidades técnicas o selecciona de las sugeridas.', 'warning');
      return;
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
      this.mostrarMensaje('Debes iniciar sesión para guardar.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Guardando información profesional...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await setDoc(docRef, {
        cvManual: this.datosManuales,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();
      this.mostrarMensaje('¡Información profesional guardada con éxito!', 'success');
      this.router.navigate(['/home']);
      
    } catch (error) {
      await loading.dismiss();
      this.mostrarMensaje('Hubo un error al guardar los datos.', 'danger');
      console.error(error);
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = 'information-circle';
    if (color === 'success') icono = 'checkmark-circle';
    if (color === 'warning') icono = 'warning';
    if (color === 'danger') icono = 'close-circle';

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