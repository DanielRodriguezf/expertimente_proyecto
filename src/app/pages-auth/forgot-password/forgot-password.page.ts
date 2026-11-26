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
  closeCircle,
  alertCircleOutline
} from 'ionicons/icons';

import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { normalizarCorreo, validarCorreo } from '../../utils/validadores';

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
  errorCorreo: string = '';
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
      'close-circle': closeCircle,
      'alert-circle-outline': alertCircleOutline
    });
  }

  /* =======================================================
     VALIDACIÓN DEL CORREO
     - El error aparece al salir del campo (si ya escribió algo) o al presionar el botón.
     - Una vez visible, se actualiza mientras el usuario corrige.
  ======================================================= */
  alCambiarCorreo(valor: string | number | null | undefined) {
    this.correo = String(valor ?? '');
    if (this.errorCorreo) {
      this.errorCorreo = validarCorreo(this.correo);
    }
  }

  alSalirDeCorreo() {
    if (!this.correo.trim()) {
      return;
    }
    this.correo = normalizarCorreo(this.correo);
    this.errorCorreo = validarCorreo(this.correo);
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
    if (this.cargando) {
      return;
    }

    const correoLimpio = normalizarCorreo(this.correo);
    this.correo = correoLimpio;
    this.errorCorreo = validarCorreo(correoLimpio);

    if (this.errorCorreo) {
      this.cdr.detectChanges();
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
        this.errorCorreo = '';
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
        this.ngZone.run(() => {
          this.errorCorreo = 'Escribe un correo válido.';
          this.cdr.detectChanges();
        });
      } else if (error.code === 'auth/user-not-found') {
        await this.mostrarNotificacion('No encontramos una cuenta con ese correo.', 'warning');
      } else if (error.code === 'auth/too-many-requests') {
        await this.mostrarNotificacion('Demasiados intentos. Espera unos minutos.', 'warning');
      } else if (error.code === 'auth/network-request-failed') {
        await this.mostrarNotificacion('Sin conexión. Revisa tu internet.', 'warning');
      } else {
        await this.mostrarNotificacion('Ocurrió un error. Inténtalo de nuevo.', 'danger');
      }
    }
  }
}