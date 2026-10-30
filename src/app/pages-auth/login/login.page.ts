import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { 
  IonContent, 
  IonInput, 
  IonButton, 
  IonIcon,
  IonItem,
  IonSpinner,
  AlertController,
  ToastController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  mailOutline, 
  lockClosedOutline, 
  eyeOutline, 
  eyeOffOutline, 
  warningOutline,
  alertCircleOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth'; 
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; 
import { GoogleAuthService } from '../../services/google-auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    IonContent, 
    IonInput, 
    IonButton,
    IonIcon,
    IonItem,
    IonSpinner
  ]
})
export class LoginPage {
  showPassword = false;

  private auth = inject(Auth);
  private router = inject(Router);
  private firestore = inject(Firestore); 
  private alertCtrl = inject(AlertController); 
  private toastCtrl = inject(ToastController); 
  private cdr = inject(ChangeDetectorRef);
  private googleAuth = inject(GoogleAuthService);

  credenciales = {
    correo: '',
    password: ''
  };

  cargando: boolean = false;
  cargandoGoogle: boolean = false;

  constructor() {
    addIcons({
      'mail-outline': mailOutline,
      'lock-closed-outline': lockClosedOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      'warning-outline': warningOutline,
      'alert-circle-outline': alertCircleOutline,
      'checkmark-circle-outline': checkmarkCircleOutline
    });
  }

  ionViewWillEnter() {
    this.resetearFormulario();
  }

  resetearFormulario() {
    this.cargando = false;
    this.cargandoGoogle = false;
    this.credenciales = { correo: '', password: '' };
    this.showPassword = false;
    this.cdr.detectChanges();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  /**
   * Muestra el Toast accesible usando la clase 'toast-expertimente' definida en global.scss
   */
  async mostrarError(mensaje: string, color: 'danger' | 'warning' | 'success' = 'danger') {
    const icono = color === 'success' 
      ? 'checkmark-circle-outline' 
      : color === 'warning' 
        ? 'warning-outline' 
        : 'alert-circle-outline';

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      position: 'bottom',
      color: color,
      icon: icono,
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }

  async iniciarSesion() {
    if (this.cargandoGoogle) {
      return;
    }

    if (!this.credenciales.correo || !this.credenciales.password) {
      await this.mostrarError('Por favor, ingresa tu correo y contraseña.', 'warning');
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth, 
        this.credenciales.correo, 
        this.credenciales.password
      );
      
      const user = userCredential.user;
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const docSnap = await getDoc(docRef);

      // Validación: Si no tiene ficha en Firestore, no puede entrar al Home
      if (!docSnap.exists()) {
        await this.googleAuth.cerrarSesion();
        this.cargando = false;
        this.cdr.detectChanges();
        await this.mostrarAlertaCuentaNoRegistrada();
        return;
      }

      const userData = docSnap.data();

      if (userData['estadoCuenta'] === 'inactiva') {
        await this.mostrarAlertaCuentaInactiva(user.uid, 'correo');
        return; 
      }
      
      this.ejecutarNavegacion();

    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      
      this.cargando = false;
      this.cdr.detectChanges();

      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        await this.mostrarError('Correo o contraseña incorrectos.');
      } else if (error.code === 'auth/invalid-email') {
        await this.mostrarError('El formato del correo no es válido.');
      } else {
        await this.mostrarError('Ocurrió un error al intentar entrar. Inténtalo de nuevo.');
      }
    } 
  }

  async iniciarConGoogle() {
    if (this.cargando || this.cargandoGoogle) {
      return;
    }

    this.cargandoGoogle = true;
    this.cdr.detectChanges();

    try {
      // Pasamos soloLogin = true para que NO deje abierta una cuenta que no está registrada
      const { user, estado } = await this.googleAuth.iniciarConGoogle(true);

      if (estado === 'nuevo') {
        this.cargandoGoogle = false;
        this.cdr.detectChanges();
        await this.mostrarAlertaCuentaNoRegistrada();
        return;
      }

      if (estado === 'inactiva') {
        await this.mostrarAlertaCuentaInactiva(user.uid, 'google');
        return;
      }

      // Solo llega aquí si estado === 'activa' (tiene documento en postulantes)
      this.ejecutarNavegacion();

    } catch (error: any) {
      console.error('Error al iniciar sesión con Google:', error);

      this.cargandoGoogle = false;
      this.cdr.detectChanges();

      await this.mostrarError(this.googleAuth.mensajeDeError(error));
    }
  }

  /** Alerta cuando intenta iniciar sesión con una cuenta de Google que aún no se ha registrado */
  private async mostrarAlertaCuentaNoRegistrada() {
    const alert = await this.alertCtrl.create({
      header: 'Cuenta no registrada',
      message: 'Esta cuenta de Google aún no está registrada en ExpertiMente. Primero debes crear tu cuenta en la sección de Registro.',
      cssClass: 'alerta-expertimente',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Entendido',
          role: 'cancel'
        },
        {
          text: 'Ir a Registrarme',
          handler: () => {
            this.router.navigate(['/register']);
          }
        }
      ]
    });

    await alert.present();
  }

  /** Alerta para reactivar una cuenta desactivada (la usan el ingreso con correo y el ingreso con Google) */
  private async mostrarAlertaCuentaInactiva(uid: string, metodo: 'correo' | 'google') {
    this.cargando = false;
    this.cargandoGoogle = false;
    this.cdr.detectChanges();

    const docRef = doc(this.firestore, `postulantes/${uid}`);

    const alert = await this.alertCtrl.create({
      header: 'Cuenta Inactiva',
      message: 'Habías desactivado tu cuenta anteriormente. ¿Deseas reactivarla para volver a usar ExpertiMente?',
      backdropDismiss: false, 
      cssClass: 'alerta-expertimente',
      buttons: [
        {
          text: 'No, cancelar',
          role: 'cancel',
          handler: async () => {
            await this.googleAuth.cerrarSesion(); 
            await this.mostrarError('Inicio de sesión cancelado.', 'warning');
          }
        },
        {
          text: 'Sí, reactivar',
          handler: async () => {
            if (metodo === 'google') {
              this.cargandoGoogle = true;
            } else {
              this.cargando = true;
            }
            this.cdr.detectChanges(); 

            try {
              await updateDoc(docRef, { estadoCuenta: 'activa' });
              await this.mostrarError('¡Tu cuenta ha sido reactivada con éxito!', 'success');
              this.ejecutarNavegacion();
            } catch (error) {
              console.error('Error al reactivar la cuenta:', error);
              await this.googleAuth.cerrarSesion();

              this.cargando = false;
              this.cargandoGoogle = false;
              this.cdr.detectChanges();

              await this.mostrarError('No pudimos reactivar tu cuenta. Inténtalo de nuevo.');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }

  private ejecutarNavegacion() {
    this.resetearFormulario();
    
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, 50);
  }
}