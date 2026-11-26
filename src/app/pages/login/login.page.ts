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
import { Firestore } from '@angular/fire/firestore';
import { panelAutorizado } from '../../guards/acceso-portal';

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
    const credencial = await signInWithEmailAndPassword(
      this.auth,
      email,
      password
    );

    const destino = await panelAutorizado(
      this.firestore,
      credencial.user.uid
    );

    if (!destino) {
      await this.auth.signOut();
      await this.mostrarToast(
        'Tu cuenta no tiene acceso habilitado a este portal.'
      );
      return;
    }

    await this.ngZone.run(() =>
      this.router.navigateByUrl(destino, { replaceUrl: true })
    );
  } catch (error: any) {
    console.error('Error al iniciar sesión:', error);

    const credencialesInvalidas = [
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-credential',
    ].includes(error?.code);

    await this.mostrarToast(
      credencialesInvalidas
        ? 'Correo o contraseña incorrectos.'
        : 'No se pudo verificar el acceso. Revisa tu conexión y vuelve a intentar.'
    );
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