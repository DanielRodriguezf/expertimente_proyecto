import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Controladores inyectables importados desde @ionic/angular
import { ToastController, LoadingController, AlertController } from '@ionic/angular';

// Componentes UI importados desde @ionic/angular/standalone
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonInput, IonButton, IonIcon, IonFooter,
  IonLabel, IonTextarea, IonCard, IonCardContent, IonItem, IonProgressBar,
  IonRadioGroup, IonRadio, IonModal 
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, documentTextOutline, briefcaseOutline, 
  schoolOutline, checkmarkCircleOutline, arrowBackOutline,
  trashOutline, eyeOutline, checkmarkCircle, timeOutline, starOutline,
  cameraOutline, personCircleOutline, cropOutline, closeOutline,
  syncOutline, swapHorizontalOutline
} from 'ionicons/icons';

import { ImageCropperComponent, ImageCroppedEvent, ImageTransform } from 'ngx-image-cropper';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-perfil-cv',
  templateUrl: './perfil-cv.page.html',
  styleUrls: ['./perfil-cv.page.scss'],
  standalone: true,
  imports: [
    RouterModule, FormsModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, IonInput, 
    IonButton, IonIcon, IonFooter, IonLabel, IonTextarea, 
    IonCard, IonCardContent, IonItem, IonProgressBar,
    IonRadioGroup, IonRadio, IonModal,
    ImageCropperComponent
  ]
})
export class PerfilCvPage implements OnInit {
  pasoActual: number = 1;
  totalPasos: number = 6;

  fotoPerfilSavedBase64: string = '';
  fotoPendienteBase64: string = '';
  @ViewChild('fotoInput', { static: false }) fotoInput!: ElementRef;
  
  imageChangedEvent: any = '';
  mostrandoRecortador: boolean = false;
  fotoTemporalRecortada: string = '';
  transform: ImageTransform = {};

  tieneCVSubido: boolean = false;
  nombreCVSaved: string = '';
  cvSavedBase64: string = '';
  archivoSeleccionadoNombre: string = '';
  archivoBase64: string = ''; 
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  datosManuales = {
    nivelEducativo: '',
    areaExperiencia: '',
    anosExperiencia: null as number | null,
    habilidades: ''
  };

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'cloud-upload-outline': cloudUploadOutline,
      'document-text-outline': documentTextOutline,
      'briefcase-outline': briefcaseOutline,
      'school-outline': schoolOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'arrow-back-outline': arrowBackOutline,
      'trash-outline': trashOutline,
      'eye-outline': eyeOutline,
      'checkmark-circle': checkmarkCircle,
      'time-outline': timeOutline,
      'star-outline': starOutline,
      'camera-outline': cameraOutline,
      'person-circle-outline': personCircleOutline,
      'crop-outline': cropOutline,
      'close-outline': closeOutline,
      'sync-outline': syncOutline,
      'swap-horizontal-outline': swapHorizontalOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data['fotoPerfil']) this.fotoPerfilSavedBase64 = data['fotoPerfil'];
            if (data['cvBase64']) {
              this.tieneCVSubido = true;
              this.nombreCVSaved = data['cvNombre'] || 'Mi_Curriculum.pdf';
              this.cvSavedBase64 = data['cvBase64'];
            }
            if (data['cvManual']) this.datosManuales = data['cvManual'];
          }
        });
      }
    });
  }

  ionViewWillEnter() {
    this.pasoActual = 1;
    this.cancelarRecorte();
    this.quitarArchivoPendiente();
  }

  siguientePaso() {
    if (this.pasoActual === 1 && !this.datosManuales.nivelEducativo) {
      this.mostrarMensaje('Por favor, selecciona tu nivel de estudios.', 'warning');
      return;
    }
    if (this.pasoActual === 2 && !this.datosManuales.areaExperiencia) {
      this.mostrarMensaje('Por favor, cuéntanos en qué has trabajado.', 'warning');
      return;
    }
    if (this.pasoActual === 3 && (this.datosManuales.anosExperiencia === null || this.datosManuales.anosExperiencia === undefined)) {
      this.mostrarMensaje('Ingresa tus años de experiencia.', 'warning');
      return;
    }
    if (this.pasoActual === 4 && !this.datosManuales.habilidades) {
      this.mostrarMensaje('Por favor, escribe algunas de tus habilidades.', 'warning');
      return;
    }
    if (this.pasoActual < this.totalPasos) this.pasoActual++;
  }

  pasoAnterior() {
    if (this.pasoActual > 1) this.pasoActual--;
  }

  abrirSelectorFoto() {
    this.fotoInput.nativeElement.click();
  }

  async alSeleccionarFoto(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.mostrarMensaje('Selecciona un archivo de imagen válido.', 'warning');
        return;
      }
      
      // Corrección del error TS7006 usando async/await puro
      const loading = await this.loadingCtrl.create({
        message: 'Preparando imagen...',
        spinner: 'crescent',
        duration: 3000, 
        id: 'loader-foto'
      });
      await loading.present();

      this.transform = {}; 
      this.imageChangedEvent = event;
      this.mostrandoRecortador = true;
      this.cdr.detectChanges(); 
    }
  }

  girarImagen() {
    this.transform = {
      ...this.transform,
      rotate: ((this.transform.rotate ?? 0) + 90) % 360
    };
  }

  voltearHorizontal() {
    this.transform = {
      ...this.transform,
      flipH: !this.transform.flipH
    };
  }

  imageCropped(event: ImageCroppedEvent) {
    if (event.blob) {
      const reader = new FileReader();
      reader.readAsDataURL(event.blob);
      reader.onloadend = () => {
        this.fotoTemporalRecortada = reader.result as string;
      };
    } else if ((event as any).base64) {
      this.fotoTemporalRecortada = (event as any).base64;
    }
  }

  imageLoaded() {
    setTimeout(() => {
      // Usamos undefined en lugar de null para cumplir estrictamente con los tipos de TypeScript
      this.loadingCtrl.dismiss(undefined, undefined, 'loader-foto').catch(() => {});
    }, 300);
  }

  loadImageFailed() {
    this.loadingCtrl.dismiss(undefined, undefined, 'loader-foto').catch(() => {});
    this.mostrarMensaje('Error al cargar la imagen.', 'danger');
    this.cancelarRecorte();
  }

  confirmarRecorte() {
    this.fotoPendienteBase64 = this.fotoTemporalRecortada;
    this.mostrandoRecortador = false;
    this.imageChangedEvent = '';
    this.transform = {}; 
    if (this.fotoInput) this.fotoInput.nativeElement.value = ''; 
  }

  cancelarRecorte() {
    this.mostrandoRecortador = false;
    this.imageChangedEvent = '';
    this.fotoTemporalRecortada = '';
    this.transform = {}; 
    if (this.fotoInput) this.fotoInput.nativeElement.value = ''; 
  }

  async eliminarFotoGuardada() {
    const alert = await this.alertCtrl.create({
      header: '¿Quitar Foto?',
      message: 'Tu foto de perfil se borrará.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, quitar',
          role: 'destructive',
          handler: async () => {
            const user = this.auth.currentUser;
            if (user) {
              const docRef = doc(this.firestore, `postulantes/${user.uid}`);
              await updateDoc(docRef, { fotoPerfil: '' });
              this.fotoPerfilSavedBase64 = '';
              this.fotoPendienteBase64 = '';
              this.cdr.detectChanges();
              this.mostrarMensaje('Foto eliminada correctamente.', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  abrirSelectorArchivo() {
    this.fileInput.nativeElement.click();
  }

  async alSeleccionarArchivo(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.mostrarMensaje('Selecciona un archivo PDF válido.', 'warning');
        return;
      }
      if (file.size > 600 * 1024) { 
        this.mostrarMensaje('El PDF debe pesar menos de 600KB.', 'warning');
        return;
      }
      const loading = await this.loadingCtrl.create({
        message: 'Preparando documento...',
        spinner: 'crescent'
      });
      await loading.present();

      const reader = new FileReader();
      reader.onload = async () => {
        this.archivoBase64 = reader.result as string; 
        this.archivoSeleccionadoNombre = file.name;
        await loading.dismiss();
        this.cdr.detectChanges(); 
        this.mostrarMensaje('Documento cargado. Presiona "Terminar y Guardar" para finalizar.', 'success');
      };
      reader.readAsDataURL(file);
    }
  }

  quitarArchivoPendiente() {
    this.archivoBase64 = '';
    this.archivoSeleccionadoNombre = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.cdr.detectChanges(); 
  }

  async eliminarCVGuardado() {
    const alert = await this.alertCtrl.create({
      header: '¿Eliminar Currículum PDF?',
      message: 'Tu archivo PDF se borrará, pero tus respuestas se mantendrán.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, eliminar',
          role: 'destructive',
          handler: async () => {
            const user = this.auth.currentUser;
            if (user) {
              const docRef = doc(this.firestore, `postulantes/${user.uid}`);
              await updateDoc(docRef, { cvBase64: '', cvNombre: '' });
              this.tieneCVSubido = false;
              this.cvSavedBase64 = '';
              this.nombreCVSaved = '';
              this.archivoBase64 = '';
              this.archivoSeleccionadoNombre = '';
              this.cdr.detectChanges();
              this.mostrarMensaje('Archivo PDF eliminado correctamente.', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  verCVSaved() {
    if (!this.cvSavedBase64) return;
    try {
      const base64Parts = this.cvSavedBase64.split(',');
      const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      enlace.download = this.nombreCVSaved || 'Mi_Curriculum.pdf';
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 250);
    } catch (error) {
      this.mostrarMensaje('No se pudo abrir el archivo PDF.', 'danger');
    }
  }

  async guardarDatos() {
    const user = this.auth.currentUser;
    if (!user) return;
    const loading = await this.loadingCtrl.create({
      message: 'Guardando perfil profesional...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const payload: any = {
        cvManual: this.datosManuales,
        fechaActualizacionPerfil: new Date()
      };
      if (this.archivoBase64) {
        payload.cvBase64 = this.archivoBase64;
        payload.cvNombre = this.archivoSeleccionadoNombre;
      }
      if (this.fotoPendienteBase64) {
        payload.fotoPerfil = this.fotoPendienteBase64;
      }
      await updateDoc(docRef, payload);
      this.quitarArchivoPendiente(); 
      await loading.dismiss();
      this.mostrarMensaje('¡Tu perfil profesional está listo!', 'success');
      this.router.navigate(['/home']); 
    } catch (error) {
      await loading.dismiss();
      this.mostrarMensaje('Hubo un error al guardar.', 'danger');
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = 'information-circle';
    if (color === 'success') icono = 'checkmark-circle';
    if (color === 'warning') icono = 'warning';
    if (color === 'danger') icono = 'close-circle';

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color: color,
      cssClass: 'toast-expertimente',
      position: 'middle',
      icon: icono
    });
    await toast.present();
  }
}