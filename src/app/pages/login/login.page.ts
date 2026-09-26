import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { 
  IonContent, 
  IonInput, 
  IonButton, 
  IonIcon,
  AlertController // <-- 1. Importamos AlertController para el mensaje
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, 
  eyeOutline, 
  eyeOffOutline 
} from 'ionicons/icons';

// Importaciones de Firebase Auth
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth'; // <-- Importamos signOut
// Importaciones de Firestore
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; // <-- 2. Herramientas de BD

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
    IonIcon
  ]
})
export class LoginPage {
  showPassword = false;

  // Inyectamos servicios
  private auth = inject(Auth);
  private router = inject(Router);
  private firestore = inject(Firestore); // <-- Inyectamos Firestore
  private alertCtrl = inject(AlertController); // <-- Inyectamos Alertas

  credenciales = {
    correo: '',
    password: ''
  };

  errorMessage: string = '';
  cargando: boolean = false;

  constructor() {
    addIcons({
      'person-circle-outline': personCircleOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async iniciarSesion() {
    if (!this.credenciales.correo || !this.credenciales.password) {
      this.errorMessage = 'Por favor, ingresa tu correo y contraseña.';
      return;
    }

    this.cargando = true;
    this.errorMessage = '';

    try {
      // 1. Intentamos iniciar sesión con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        this.auth, 
        this.credenciales.correo, 
        this.credenciales.password
      );
      
      const user = userCredential.user;

      // 2. Buscamos el documento del usuario en Firestore
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();

        // 3. Verificamos si su cuenta fue desactivada
        if (userData['estadoCuenta'] === 'inactiva') {
          // Ocultamos el spinner para que pueda interactuar con la alerta
          this.cargando = false; 

          const alert = await this.alertCtrl.create({
            header: 'Cuenta Inactiva',
            message: 'Habías desactivado tu cuenta anteriormente. ¿Deseas reactivarla para volver a usar ExpertiMente?',
            backdropDismiss: false, // Obligamos a que elija una opción
            buttons: [
              {
                text: 'No, cancelar',
                role: 'cancel',
                handler: async () => {
                  await signOut(this.auth); // Cerramos su sesión de nuevo
                  this.errorMessage = 'Inicio de sesión cancelado.';
                }
              },
              {
                text: 'Sí, reactivar',
                handler: async () => {
                  this.cargando = true; // Volvemos a mostrar el loading
                  
                  // Cambiamos su estado en la base de datos
                  await updateDoc(docRef, { estadoCuenta: 'activa' });
                  
                  console.log('¡Cuenta reactivada exitosamente!');
                  this.credenciales = { correo: '', password: '' };
                  this.router.navigate(['/home']);
                  this.cargando = false;
                }
              }
            ]
          });
          
          await alert.present();
          return; // Detenemos la función aquí (el flujo sigue dentro de los botones de la alerta)
        }
      }
      
      // 4. Si la cuenta está 'activa' o no tiene el campo, entra normalmente
      console.log('Sesión iniciada correctamente');
      this.credenciales = { correo: '', password: '' };
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        this.errorMessage = 'Correo o contraseña incorrectos.';
      } else if (error.code === 'auth/invalid-email') {
        this.errorMessage = 'El formato del correo no es válido.';
      } else {
        this.errorMessage = 'Ocurrió un error al intentar entrar. Inténtalo de nuevo.';
      }
    } finally {
      // Nos aseguramos de quitar el cargando si es que no se mostró la alerta
      if (this.cargando) {
        this.cargando = false;
      }
    }
  }
}