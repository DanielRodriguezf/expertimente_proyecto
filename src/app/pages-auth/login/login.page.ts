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
  warningOutline
} from 'ionicons/icons';

import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth'; 
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; 

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

  credenciales = {
    correo: '',
    password: ''
  };

  cargando: boolean = false;

  constructor() {
    addIcons({
      'mail-outline': mailOutline,
      'lock-closed-outline': lockClosedOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      'warning-outline': warningOutline
    });
  }

  ionViewWillEnter() {
    this.resetearFormulario();
  }

  resetearFormulario() {
    this.cargando = false;
    this.credenciales = { correo: '', password: '' };
    this.showPassword = false;
    this.cdr.detectChanges();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async mostrarError(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      position: 'top',
      color: 'danger',
      icon: 'warning-outline',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  async iniciarSesion() {
    if (!this.credenciales.correo || !this.credenciales.password) {
      await this.mostrarError('Por favor, ingresa tu correo y contraseña.');
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

      if (docSnap.exists()) {
        const userData = docSnap.data();

        if (userData['estadoCuenta'] === 'inactiva') {
          this.cargando = false; 
          this.cdr.detectChanges();

          const alert = await this.alertCtrl.create({
            header: 'Cuenta Inactiva',
            message: 'Habías desactivado tu cuenta anteriormente. ¿Deseas reactivarla para volver a usar ExpertiMente?',
            backdropDismiss: false, 
            buttons: [
              {
                text: 'No, cancelar',
                role: 'cancel',
                handler: async () => {
                  await signOut(this.auth); 
                  await this.mostrarError('Inicio de sesión cancelado.');
                }
              },
              {
                text: 'Sí, reactivar',
                handler: async () => {
                  this.cargando = true;
                  this.cdr.detectChanges(); 
                  await updateDoc(docRef, { estadoCuenta: 'activa' });
                  
                  this.ejecutarNavegacion();
                }
              }
            ]
          });
          
          await alert.present();
          return; 
        }
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

  private ejecutarNavegacion() {
    this.resetearFormulario();
    
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, 50);
  }
}