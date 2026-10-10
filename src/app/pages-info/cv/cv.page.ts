import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon, IonFooter,
  IonLabel, IonCard, IonCardContent, IonItem
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, documentTextOutline, 
  trashOutline, eyeOutline, checkmarkCircle, 
  closeCircle, informationCircle, warning
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, onSnapshot, deleteField } from '@angular/fire/firestore';

@Component({
  selector: 'app-cv',
  templateUrl: './cv.page.html',
  styleUrls: ['./cv.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, 
    IonButton, IonIcon, IonFooter, IonLabel, 
    IonCard, IonCardContent, IonItem
  ]
})
export class CvPage implements OnInit {
  tieneCVSubido: boolean = false;
  nombreCVSaved: string = '';
  cvSavedBase64: string = '';
  archivoSeleccionadoNombre: string = '';
  archivoBase64: string = ''; 
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

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
      'trash-outline': trashOutline,
      'eye-outline': eyeOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'information-circle': informationCircle,
      'warning': warning
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data['cvBase64']) {
              this.tieneCVSubido = true;
              this.nombreCVSaved = data['cvNombre'] || 'Mi_Curriculum.pdf';
              this.cvSavedBase64 = data['cvBase64'];
            } else {
              this.tieneCVSubido = false;
              this.nombreCVSaved = '';
              this.cvSavedBase64 = '';
            }
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  ionViewWillEnter() {
    this.quitarArchivoPendiente();
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
        this.mostrarMensaje('¡Documento cargado con exito!', 'success');
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
      header: '¿Eliminar Currículum?',
      message: 'Tu archivo se borrará de tu perfil.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, eliminar',
          role: 'destructive',
          handler: async () => {
            const user = this.auth.currentUser;
            if (user) {
              const docRef = doc(this.firestore, `postulantes/${user.uid}`);
              await updateDoc(docRef, { cvBase64: deleteField(), cvNombre: deleteField() });
              this.quitarArchivoPendiente();
              this.mostrarMensaje('¡Archivo eliminado correctamente!', 'success');
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
    if (!this.archivoBase64) {
      this.mostrarMensaje('No hay ningún archivo nuevo para guardar', 'warning');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) return;
    
    const loading = await this.loadingCtrl.create({
      message: 'Guardando currículum...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const payload: any = {
        cvBase64: this.archivoBase64,
        cvNombre: this.archivoSeleccionadoNombre,
        fechaActualizacionPerfil: new Date()
      };
      
      await updateDoc(docRef, payload);
      this.quitarArchivoPendiente(); 
      await loading.dismiss();
      this.mostrarMensaje('¡Tu currículum se ha guardado con éxito!', 'success');
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