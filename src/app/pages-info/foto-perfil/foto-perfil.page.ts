import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ToastController, LoadingController, AlertController, IonFooter } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon, IonCard, IonCardContent, 
  IonModal 
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  cameraOutline, personCircleOutline, trashOutline, 
  syncOutline, swapHorizontalOutline, checkmarkCircle, 
  closeCircle, warning, informationCircle
} from 'ionicons/icons';

import { ImageCropperComponent, ImageCroppedEvent, ImageTransform } from 'ngx-image-cropper';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, deleteField, setDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-foto-perfil',
  templateUrl: './foto-perfil.page.html',
  styleUrls: ['./foto-perfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, 
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonButton, IonIcon, IonCard, IonCardContent, 
    IonModal,
    ImageCropperComponent, IonFooter
  ]
})
export class FotoPerfilPage implements OnInit {
  fotoPerfilSavedBase64: string = '';
  fotoPendienteBase64: string = '';
  @ViewChild('fotoInput', { static: false }) fotoInput!: ElementRef;
  
  imageChangedEvent: any = '';
  mostrandoRecortador: boolean = false;
  fotoTemporalRecortada: string = '';
  transform: ImageTransform = {};

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'camera-outline': cameraOutline, 'person-circle-outline': personCircleOutline,
      'trash-outline': trashOutline, 'sync-outline': syncOutline,
      'swap-horizontal-outline': swapHorizontalOutline, 'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle, 'warning': warning, 'information-circle': informationCircle
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.fotoPerfilSavedBase64 = data['fotoPerfil'] || '';
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  abrirSelectorFoto() {
    this.fotoInput.nativeElement.click();
  }

  async alSeleccionarFoto(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.match(/image\/(jpeg|jpg|png|webp|heic|heif)/i)) {
        this.mostrarMensaje('Formato no soportado', 'warning');
        return;
      }
      
      const loading = await this.loadingCtrl.create({
        message: 'Preparando imagen...',
        spinner: 'crescent',
        duration: 4000, 
        id: 'loader-foto'
      });
      await loading.present();

      this.transform = {}; 
      this.imageChangedEvent = null; 
      
      setTimeout(() => {
        this.imageChangedEvent = event;
        this.mostrandoRecortador = true;
        this.cdr.detectChanges(); 
      }, 150);
    }
  }

  girarImagen() {
    this.transform = { ...this.transform, rotate: ((this.transform.rotate ?? 0) + 90) % 360 };
  }

  voltearHorizontal() {
    this.transform = { ...this.transform, flipH: !this.transform.flipH };
  }

  imageCropped(event: ImageCroppedEvent) {
    if (event.blob) {
      const reader = new FileReader();
      reader.readAsDataURL(event.blob);
      reader.onloadend = () => {
        this.fotoTemporalRecortada = reader.result as string;
      };
    } else if (event.base64) {
      this.fotoTemporalRecortada = event.base64;
    }
  }

  imageLoaded() {
    setTimeout(() => { this.loadingCtrl.dismiss(undefined, undefined, 'loader-foto').catch(() => {}); }, 300);
  }

  loadImageFailed() {
    this.loadingCtrl.dismiss(undefined, undefined, 'loader-foto').catch(() => {});
    this.mostrarMensaje('Error al cargar la imagen.', 'danger');
    this.cancelarRecorte();
  }

  confirmarRecorte() {
    if (!this.fotoTemporalRecortada || this.fotoTemporalRecortada.startsWith('blob:')) {
      this.mostrarMensaje('Procesando imagen, subukang muli.', 'warning');
      return;
    }
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
    message: 'Tu foto de perfil se borrará permanentemente.',
    cssClass: 'alerta-expertimente',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Quitar',
        role: 'destructive',
        handler: async () => {
          const user = this.auth.currentUser;
          if (user) {
            const docRef = doc(this.firestore, `postulantes/${user.uid}`);
            await updateDoc(docRef, { fotoPerfil: deleteField() });
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

async guardarDatos() {
    if (!this.fotoPendienteBase64) return;
    
    const user = this.auth.currentUser;
    if (!user) return;
    
    const loading = await this.loadingCtrl.create({
      message: 'Guardando foto...',
      spinner: 'crescent',
      cssClass: 'loading-expertimente'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await setDoc(docRef, {
        fotoPerfil: this.fotoPendienteBase64,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });
      
      this.fotoPendienteBase64 = '';
      await loading.dismiss();
      this.mostrarMensaje('¡Tu foto se ha guardado con éxito!', 'success');
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