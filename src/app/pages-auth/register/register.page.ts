import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // <-- Necesario para [(ngModel)]
import { 
  IonContent, 
  IonInput, 
  IonButton, 
  IonIcon,
  IonProgressBar,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonSpinner
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  personAddOutline, 
  eyeOutline, 
  eyeOffOutline,
  arrowBackOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

// Importaciones de Firebase
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
// Ajusta la ruta si tu carpeta de servicios está en otro lugar
import { GoogleAuthService, PerfilGoogle } from '../../services/google-auth';

// Campos del formulario que se pre-llenan con los datos de la cuenta de Google
const CAMPOS_DE_GOOGLE = ['nombre', 'apellidoPaterno', 'apellidoMaterno'] as const;

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, // <-- Importado aquí
    IonContent, 
    IonInput, 
    IonButton, 
    IonIcon,
    IonProgressBar,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonSpinner
  ]
})
export class RegisterPage {
  pasoActual: number = 1;
  totalPasos: number = 4;
  
  showPassword = false;
  showPasswordConfirm = false;

  // Inyectamos los servicios de Firebase y el Router
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private googleAuth = inject(GoogleAuthService);

  // Objeto para capturar todos los datos del formulario
  usuario = {
    rut: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    pais: '',
    ciudad: '',
    comuna: '',
    correo: '',
    telefono: '',
    password: '',
    passwordConfirm: ''
  };

  errorMessage: string = '';
  cargando: boolean = false;

  // --- Registro con Google ---
  // En este modo la persona ya tiene sesión de Google: no se pide correo ni contraseña (son 3 pasos en vez de 4)
  esRegistroGoogle: boolean = false;
  cargandoGoogle: boolean = false;
  private registroCompletado: boolean = false;
  private salidaEnCurso: Promise<boolean> | null = null;
  // Lo último que se pre-llenó desde Google, para no pisar lo que la persona ya escribió a mano
  private prellenadoGoogle = { nombre: '', apellidoPaterno: '', apellidoMaterno: '' };

  constructor() {
    addIcons({
      'person-add-outline': personAddOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      'arrow-back-outline': arrowBackOutline,
      'checkmark-circle-outline': checkmarkCircleOutline
    });
  }

  async ionViewWillEnter() {
    this.registroCompletado = false;

    try {
      // Si llegó desde "Iniciar sesión" con Google siendo nueva, su sesión ya está abierta y falta completar los datos
      const pendiente = await this.googleAuth.obtenerSesionGooglePendiente();
      if (pendiente) {
        this.activarModoGoogle(pendiente.perfil);
      }
    } catch (error) {
      console.error('No se pudo revisar la sesión de Google pendiente:', error);
    }
  }

  ionViewWillLeave() {
    // Red de seguridad: si la persona salió sin terminar y el guard de la ruta no alcanzó a limpiar, se limpia aquí
    if (this.esRegistroGoogle && !this.registroCompletado) {
      this.googleAuth.abandonarRegistroGoogle().catch((error: unknown) => {
        console.error('Error al abandonar el registro con Google:', error);
      });
      this.desactivarModoGoogle();
    }
  }

  /**
   * La llama el guard `salirDelRegistroGuard` ANTES de que cambie la ruta (botón atrás de la barra, botón atrás del celular, etc.).
   * Así la sesión de Google ya está cerrada cuando se evalúan las reglas de la pantalla siguiente
   * (por ejemplo, las que mandan al Home a quien tiene sesión).
   */
  prepararSalida(): Promise<boolean> {
    if (!this.esRegistroGoogle || this.registroCompletado) {
      return Promise.resolve(true);
    }

    // Si se aprieta atrás varias veces seguidas, todas esperan la misma limpieza
    if (this.salidaEnCurso) {
      return this.salidaEnCurso;
    }

    const salida: Promise<boolean> = this.googleAuth.abandonarRegistroGoogle()
      .then(() => {
        this.desactivarModoGoogle();
        return true;
      })
      .finally(() => {
        this.salidaEnCurso = null;
      });

    this.salidaEnCurso = salida;
    return salida;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  togglePasswordConfirm() {
    this.showPasswordConfirm = !this.showPasswordConfirm;
  }

  siguientePaso() {
    if (this.pasoActual < this.totalPasos) {
      this.errorMessage = '';
      this.pasoActual++;
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.errorMessage = '';
      this.pasoActual--;
    }
  }

  async registrarConGoogle() {
    if (this.cargandoGoogle || this.cargando) {
      return;
    }

    this.cargandoGoogle = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const { estado, perfil } = await this.googleAuth.iniciarConGoogle();

      if (estado === 'nuevo') {
        this.activarModoGoogle(perfil);
        return;
      }

      if (estado === 'inactiva') {
        // La cuenta existe pero está desactivada: se reactiva desde "Iniciar sesión"
        await this.googleAuth.cerrarSesion();
        this.errorMessage = 'Esta cuenta de Google ya está registrada, pero está desactivada. Ingresa desde "Iniciar sesión" para reactivarla.';
        return;
      }

      // Ya tenía una cuenta activa: se entra directo
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al registrar con Google:', error);
      this.errorMessage = this.googleAuth.mensajeDeError(error);
    } finally {
      this.cargandoGoogle = false;
      this.cdr.detectChanges();
    }
  }

  async cancelarModoGoogle() {
    try {
      await this.googleAuth.abandonarRegistroGoogle();
    } catch (error) {
      console.error('Error al abandonar el registro con Google:', error);
    }
    this.desactivarModoGoogle();
  }

  private activarModoGoogle(perfil: PerfilGoogle) {
    this.esRegistroGoogle = true;
    this.totalPasos = 3;
    this.pasoActual = 1;
    this.errorMessage = '';
    this.usuario.correo = perfil.correo;

    // Se pre-llenan nombre y apellidos (sin pisar lo que la persona ya escribió a mano)
    for (const campo of CAMPOS_DE_GOOGLE) {
      const valorGoogle = perfil[campo];

      if (valorGoogle && (!this.usuario[campo] || this.usuario[campo] === this.prellenadoGoogle[campo])) {
        this.usuario[campo] = valorGoogle;
      }
      this.prellenadoGoogle[campo] = valorGoogle;
    }

    this.cdr.detectChanges();
  }

  private desactivarModoGoogle() {
    this.esRegistroGoogle = false;
    this.totalPasos = 4;
    this.pasoActual = 1;
    this.usuario.correo = '';

    // Se quita lo que vino de Google, salvo lo que la persona ya modificó
    for (const campo of CAMPOS_DE_GOOGLE) {
      if (this.prellenadoGoogle[campo] && this.usuario[campo] === this.prellenadoGoogle[campo]) {
        this.usuario[campo] = '';
      }
      this.prellenadoGoogle[campo] = '';
    }

    this.cdr.detectChanges();
  }

  async registrarUsuario() {
    // Si la persona entró con Google, ya tiene sesión: solo falta guardar sus datos
    if (this.esRegistroGoogle) {
      await this.completarRegistroGoogle();
      return;
    }

    // 1. Validar que las contraseñas coincidan
    if (this.usuario.password !== this.usuario.passwordConfirm) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      // 2. Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        this.auth, 
        this.usuario.correo, 
        this.usuario.password
      );
      const uid = userCredential.user.uid;

      // 3. Guardar el resto de los datos en Firestore (Colección "postulantes")
      const userDocRef = doc(this.firestore, `postulantes/${uid}`);
      await setDoc(userDocRef, {
        uid: uid,
        rut: this.usuario.rut,
        nombre: this.usuario.nombre,
        apellidoPaterno: this.usuario.apellidoPaterno,
        apellidoMaterno: this.usuario.apellidoMaterno,
        fechaNacimiento: this.usuario.fechaNacimiento,
        pais: this.usuario.pais,
        ciudad: this.usuario.ciudad,
        comuna: this.usuario.comuna,
        correo: this.usuario.correo,
        telefono: this.usuario.telefono,
        estadoCuenta: 'activa',
        fechaRegistro: new Date() // Fecha actual
        
      });

      console.log('Usuario registrado con éxito');
      
      // 4. Redirigir al Home
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al registrar:', error);
      // Mensajes de error amigables
      if (error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'Este correo ya está registrado. Vuelve a "Iniciar sesión" y entra con tu contraseña o con Google.';
      } else if (error.code === 'auth/weak-password') {
        this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      } else {
        this.errorMessage = 'Ocurrió un error al registrar. Inténtalo de nuevo.';
      }
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private async completarRegistroGoogle() {
    const user = this.auth.currentUser;

    if (!user) {
      this.desactivarModoGoogle();
      this.errorMessage = 'Se cerró tu sesión de Google. Conecta tu cuenta otra vez.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      await this.googleAuth.crearPostulante(user, this.usuario);
      console.log('Usuario registrado con Google con éxito');

      this.registroCompletado = true;
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al registrar con Google:', error);
      this.errorMessage = 'Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}