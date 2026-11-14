import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonInput, 
  IonSelect,
  IonSelectOption,
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
import { Firestore, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import { GoogleAuthService, PerfilGoogle } from '../../services/google-auth';

const CAMPOS_DE_GOOGLE = ['nombre', 'apellidoPaterno', 'apellidoMaterno'] as const;

// Mapa de Ciudades de Chile y sus respectivas Comunas
const UBICACIONES_CHILE: Record<string, string[]> = {
  'Arica': ['Arica', 'Camarones', 'Putre', 'General Lagos'],
  'Iquique': ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña', 'Colchane', 'Huara', 'Pica'],
  'Antofagasta': ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal'],
  'Calama': ['Calama', 'Ollagüe', 'San Pedro de Atacama', 'Tocopilla', 'María Elena'],
  'Copiapó': ['Copiapó', 'Caldera', 'Tierra Amarilla', 'Chañaral', 'Diego de Almagro', 'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'],
  'La Serena': ['La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paihuano', 'Vicuña', 'Ovalle', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado', 'Illapel', 'Canela', 'Los Vilos', 'Salamanca'],
  'Valparaíso': ['Valparaíso', 'Viña del Mar', 'Concón', 'Quilpué', 'Villa Alemana', 'Casablanca', 'Quintero', 'Puchuncaví', 'San Antonio', 'Cartagena', 'El Quisco', 'El Tabo', 'Algarrobo', 'Santo Domingo', 'Quillota', 'La Calera', 'Limache', 'Olmué', 'San Felipe', 'Los Andes'],
  'Santiago': [
    'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'El Bosque', 'Estación Central',
    'Huechuraba', 'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana',
    'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado',
    'Macul', 'Maipú', 'Melipilla', 'Ñuñoa', 'Padre Hurtado', 'Paine',
    'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia', 'Pudahuel',
    'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo',
    'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Ramón', 'Santiago', 'Talagante', 'Vitacura', 'Buin'
  ],
  'Rancagua': ['Rancagua', 'Machalí', 'Graneros', 'Codegua', 'Doñihue', 'Mostazal', 'Olivar', 'Rengo', 'Requínoa', 'San Vicente', 'San Fernando', 'Santa Cruz', 'Chimbarongo', 'Pichilemu'],
  'Talca': ['Talca', 'Maule', 'San Clemente', 'Pelarco', 'Pencahue', 'Constitución', 'Curicó', 'Molina', 'Romeral', 'Teno', 'Linares', 'San Javier', 'Parral', 'Cauquenes'],
  'Chillán': ['Chillán', 'Chillán Viejo', 'Bulnes', 'Coihueco', 'El Carmen', 'Pemuco', 'Pinto', 'Quillón', 'San Carlos', 'San Ignacio', 'Yungay'],
  'Concepción': ['Concepción', 'Talcahuano', 'Hualpén', 'San Pedro de la Paz', 'Chiguayante', 'Penco', 'Tomé', 'Coronel', 'Lota', 'Hualqui', 'Santa Juana', 'Arauco', 'Curanilahue', 'Cañete'],
  'Los Ángeles': ['Los Ángeles', 'Cabrero', 'Laja', 'Mulchén', 'Nacimiento', 'Negrete', 'Santa Bárbara', 'Tucapel', 'Yumbel'],
  'Temuco': ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Lautaro', 'Nueva Imperial', 'Carahue', 'Pitrufquén', 'Victoria', 'Angol', 'Collipulli'],
  'Valdivia': ['Valdivia', 'Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'La Unión', 'Río Bueno', 'Futrono', 'Lago Ranco'],
  'Osorno': ['Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo'],
  'Puerto Montt': ['Puerto Montt', 'Puerto Varas', 'Calbuco', 'Frutillar', 'Llanquihue', 'Los Muermos', 'Maullín', 'Castro', 'Ancud', 'Quellón', 'Dalcahue'],
  'Coyhaique': ['Coyhaique', 'Aysén', 'Cisnes', 'Chile Chico', 'Cochrane'],
  'Punta Arenas': ['Punta Arenas', 'Puerto Natales', 'Porvenir', 'Cabo de Hornos', 'Torres del Paine']
};

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    IonContent, 
    IonInput, 
    IonSelect,
    IonSelectOption,
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

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private googleAuth = inject(GoogleAuthService);

  // Listados para los selectores de ubicación
  readonly paisesDisponibles: string[] = ['Chile'];
  readonly ciudadesDisponibles: string[] = Object.keys(UBICACIONES_CHILE);
  comunasDisponibles: string[] = [];

  // Objeto con "Chile" seleccionado por defecto
  usuario = {
    rut: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    pais: 'Chile',
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
  esRegistroGoogle: boolean = false;
  cargandoGoogle: boolean = false;
  private registroCompletado: boolean = false;
  private salidaEnCurso: Promise<boolean> | null = null;
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
    if (!this.usuario.pais) {
      this.usuario.pais = 'Chile';
    }

    try {
      const pendiente = await this.googleAuth.obtenerSesionGooglePendiente();
      if (pendiente) {
        this.activarModoGoogle(pendiente.perfil);
      }
    } catch (error) {
      console.error('No se pudo revisar la sesión de Google pendiente:', error);
    }
  }

  ionViewWillLeave() {
    if (this.esRegistroGoogle && !this.registroCompletado) {
      this.googleAuth.abandonarRegistroGoogle().catch((error: unknown) => {
        console.error('Error al abandonar el registro con Google:', error);
      });
      this.desactivarModoGoogle();
    }
  }

  prepararSalida(): Promise<boolean> {
    if (!this.esRegistroGoogle || this.registroCompletado) {
      return Promise.resolve(true);
    }

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

  /**
   * Se ejecuta al elegir una ciudad: carga sus comunas correspondientes y limpia la comuna previa
   */
  alCambiarCiudad(event: any) {
    const ciudadElegida = event?.detail?.value || this.usuario.ciudad;
    this.usuario.ciudad = ciudadElegida;
    this.usuario.comuna = '';
    this.comunasDisponibles = UBICACIONES_CHILE[ciudadElegida]
      ? [...UBICACIONES_CHILE[ciudadElegida]].sort((a, b) => a.localeCompare(b))
      : [];
    this.cdr.detectChanges();
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
        await this.googleAuth.cerrarSesion();
        this.errorMessage = 'Esta cuenta de Google ya está registrada, pero está desactivada. Ingresa desde "Iniciar sesión" para reactivarla.';
        return;
      }

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

    for (const campo of CAMPOS_DE_GOOGLE) {
      if (this.prellenadoGoogle[campo] && this.usuario[campo] === this.prellenadoGoogle[campo]) {
        this.usuario[campo] = '';
      }
      this.prellenadoGoogle[campo] = '';
    }

    this.cdr.detectChanges();
  }

  async registrarUsuario() {
    if (this.esRegistroGoogle) {
      await this.completarRegistroGoogle();
      return;
    }

    if (this.usuario.password !== this.usuario.passwordConfirm) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth, 
        this.usuario.correo, 
        this.usuario.password
      );
      const uid = userCredential.user.uid;

      const userDocRef = doc(this.firestore, `postulantes/${uid}`);
      await setDoc(userDocRef, {
        uid: uid,
        rut: this.usuario.rut,
        nombre: this.usuario.nombre,
        apellidoPaterno: this.usuario.apellidoPaterno,
        apellidoMaterno: this.usuario.apellidoMaterno,
        fechaNacimiento: this.usuario.fechaNacimiento,
        pais: this.usuario.pais || 'Chile',
        ciudad: this.usuario.ciudad,
        comuna: this.usuario.comuna,
        correo: this.usuario.correo,
        telefono: this.usuario.telefono,
        estadoCuenta: 'activa',
        ocultarAyudaInicial: false,
        fechaRegistro: new Date()
      });

      console.log('Usuario registrado con éxito');
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al registrar:', error);
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

  private async activarAyudaPrimeraVez(uid: string) {
    try {
      await updateDoc(doc(this.firestore, `postulantes/${uid}`), { ocultarAyudaInicial: false });
    } catch (error) {
      console.warn('No se pudo activar el aviso de ayuda de primera vez:', error);
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
      await this.activarAyudaPrimeraVez(user.uid);
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