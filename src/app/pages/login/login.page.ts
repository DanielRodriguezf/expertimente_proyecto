import { Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  IonContent, 
  IonInput, 
  IonButton, 
  IonSpinner, 
  ToastController 
} from '@ionic/angular';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner
  ]
})
export class LoginPage implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private ngZone = inject(NgZone);
  private firestore = inject(Firestore);

  loginForm!: FormGroup;
  isSubmitting = false;

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { email, password } = this.loginForm.value;

    try {
      // Autenticación en Firebase Auth
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // 1. Primero buscamos si es un RECLUTADOR (para verificar su estado)
      const reclutadorRef = doc(this.firestore, `reclutadores/${user.uid}`);
      const reclutadorSnap = await getDoc(reclutadorRef);

      if (reclutadorSnap.exists()) {
        const dataReclutador = reclutadorSnap.data();
        const estado = dataReclutador['estado'] || 'pendiente';

        // Si está rechazado, lo bloqueamos inmediatamente
        if (estado === 'rechazado') {
          await this.mostrarToast('Tu solicitud de cuenta ha sido rechazada por el administrador.');
          await this.auth.signOut(); // Cerramos la sesión
          this.isSubmitting = false;
          return; // Abortamos la redirección
        }
        
        // Si es pendiente o aprobado, lo dejamos entrar a /home 
        // (La compañera manejará los botones allá)
        this.ngZone.run(() => {
          this.router.navigate(['/home']);
        });
        return;
      }

      // 2. Si NO es reclutador, buscamos en la colección USUARIOS (Admin, Postulantes, etc.)
      const userDocRef = doc(this.firestore, `usuarios/${user.uid}`);
      const userDocSnap = await getDoc(userDocRef);

      this.ngZone.run(() => {
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          
          if (userData['rol'] === 'admin') {
            this.router.navigate(['/dashboard']);
          } else {
            this.router.navigate(['/home']);
          }
        } else {
          // Fallback por si el usuario no tiene rol en ninguna colección
          this.router.navigate(['/home']);
        }
      });
      
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      let mensaje = 'Credenciales incorrectas o usuario no encontrado.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        mensaje = 'Correo o contraseña incorrectos.';
      }
      this.mostrarToast(mensaje);
    } finally {
      this.isSubmitting = false;
    }
  }

  irARegistro() {
    this.ngZone.run(() => {
      this.router.navigate(['/registro']).catch(() => {
        this.router.navigate(['/register']).catch(() => {
          this.router.navigate(['/auth/register']).catch(() => {
            console.error('No se encontró ninguna ruta asignada para el registro.');
          });
        });
      });
    });
  }

  private async mostrarToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'bottom',
      color: 'danger' // Ojo: lo dejé en danger para que parezca alerta, puedes cambiar a 'warning'
    });
    await toast.present();
  }
}