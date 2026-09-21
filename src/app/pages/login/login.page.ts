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
      await signInWithEmailAndPassword(this.auth, email, password);
      this.ngZone.run(() => {
        this.router.navigate(['/home']);
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
      color: 'danger'
    });
    await toast.present();
  }
}