import { Component, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  lockOpenOutline,
  sendOutline,
  shieldCheckmarkOutline,
  checkmarkCircle,
  warning,
  closeCircle
} from 'ionicons/icons';

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
    IonSpinner,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton
  ]
})
export class ForgotPasswordPage {
  correo: string = '';
  cargando: boolean = false;

  private auth = inject(Auth);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  constructor() {
    addIcons({
      'mail-outline': mailOutline,
      'lock-open-outline': lockOpenOutline,
      'send-outline': sendOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle
    });
  }

  async mostrarNotificacion(mensaje: string, color: 'success' | 'warning' | 'danger' = 'danger') {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color,
      icon: iconos[color],
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }

  async recuperarPassword() {
    const correoLimpio = (this.correo || '').trim();
    if (!correoLimpio) {
      await this.mostrarNotificacion('Por favor, ingresa tu correo electrónico.', 'warning');
      return;
    }

    this.ngZone.run(() => {
      this.cargando = true;
      this.cdr.detectChanges();
    });

    try {
      await sendPasswordResetEmail(this.auth, correoLimpio);

      this.ngZone.run(() => {
        this.cargando = false;
        this.correo = '';
        this.cdr.detectChanges();
      });

      await this.mostrarNotificacion(
        'Enlace enviado. Revisa tu bandeja de entrada o la carpeta de spam.',
        'success'
      );

      this.router.navigate(['/login']);

    } catch (error: any) {
      console.error('Error al recuperar contraseña:', error);
      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      });

      if (error.code === 'auth/invalid-email') {
        await this.mostrarNotificacion('El formato del correo no es válido.', 'warning');
      } else {
        await this.mostrarNotificacion('Ocurrió un error. Verifica que el correo esté registrado.', 'danger');
      }
    }
  }
}