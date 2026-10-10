import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { 
  IonContent, 
  IonInput, 
  IonButton, 
  IonIcon,
  IonItem,
  IonSpinner,
  IonHeader,
  IonToolbar,
  IonButtons,
  ToastController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  mailOutline, 
  arrowBackOutline, 
  keyOutline,
  checkmarkCircleOutline,
  warningOutline
} from 'ionicons/icons';

// Importaciones de Firebase Auth
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule,
    IonContent, 
    IonInput, 
    IonButton, 
    IonIcon,
    IonItem,
    IonSpinner,
    IonHeader,
    IonToolbar,
    IonButtons
  ]
})
export class ForgotPasswordPage {
  correo: string = '';
  cargando: boolean = false;

  private auth = inject(Auth);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({
      'mail-outline': mailOutline,
      'arrow-back-outline': arrowBackOutline,
      'key-outline': keyOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'warning-outline': warningOutline
    });
  }

  async mostrarNotificacion(mensaje: string, tipo: 'success' | 'danger', icono: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 4000,
      position: 'top',
      color: tipo,
      icon: icono,
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  async recuperarPassword() {
    if (!this.correo) {
      await this.mostrarNotificacion('Por favor, ingresa tu correo electrónico.', 'danger', 'warning-outline');
      return;
    }

    this.cargando = true;

    try {
      await sendPasswordResetEmail(this.auth, this.correo);
      
      this.cargando = false;
      await this.mostrarNotificacion(
        'Enlace enviado. Revisa tu bandeja de entrada o la carpeta de spam.', 
        'success', 
        'checkmark-circle-outline'
      );
      
      this.router.navigate(['/login']);

    } catch (error: any) {
      console.error('Error al recuperar contraseña:', error);
      this.cargando = false;

      if (error.code === 'auth/invalid-email') {
        await this.mostrarNotificacion('El formato del correo no es válido.', 'danger', 'warning-outline');
      } else {
        await this.mostrarNotificacion('Ocurrió un error. Verifica que el correo esté registrado.', 'danger', 'warning-outline');
      }
    }
  }
}