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

// Las 16 Regiones de Chile y sus 346 Comunas oficiales
const REGIONES_COMUNAS_CHILE: Record<string, string[]> = {
  'Arica y Parinacota': [
    'Arica', 'Camarones', 'General Lagos', 'Putre'
  ],
  'Tarapacá': [
    'Alto Hospicio', 'Camiña', 'Colchane', 'Huara', 'Iquique', 'Pica', 'Pozo Almonte'
  ],
  'Antofagasta': [
    'Antofagasta', 'Calama', 'María Elena', 'Mejillones', 'Ollagüe',
    'San Pedro de Atacama', 'Sierra Gorda', 'Taltal', 'Tocopilla'
  ],
  'Atacama': [
    'Alto del Carmen', 'Caldera', 'Chañaral', 'Copiapó', 'Diego de Almagro',
    'Freirina', 'Huasco', 'Tierra Amarilla', 'Vallenar'
  ],
  'Coquimbo': [
    'Andacollo', 'Canela', 'Combarbalá', 'Coquimbo', 'Illapel', 'La Higuera',
    'La Serena', 'Los Vilos', 'Monte Patria', 'Ovalle', 'Paihuano', 'Punitaqui',
    'Río Hurtado', 'Salamanca', 'Vicuña'
  ],
  'Valparaíso': [
    'Algarrobo', 'Cabildo', 'Calle Larga', 'Cartagena', 'Casablanca', 'Catemu',
    'Concón', 'El Quisco', 'El Tabo', 'Hijuelas', 'Isla de Pascua', 'Juan Fernández',
    'La Calera', 'La Cruz', 'La Ligua', 'Limache', 'Llay-Llay', 'Los Andes',
    'Nogales', 'Olmué', 'Panquehue', 'Papudo', 'Petorca', 'Puchuncaví', 'Putaendo',
    'Quillota', 'Quilpué', 'Quintero', 'Rinconada', 'San Antonio', 'San Esteban',
    'San Felipe', 'Santa María', 'Santo Domingo', 'Valparaíso', 'Villa Alemana',
    'Viña del Mar', 'Zapallar'
  ],
  'Metropolitana de Santiago': [
    'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina',
    'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba',
    'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida', 'La Granja',
    'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo',
    'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa',
    'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén',
    'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal',
    'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo',
    'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'
  ],
  'O’Higgins': [
    'Chépica', 'Chimbarongo', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue',
    'Graneros', 'La Estrella', 'Las Cabras', 'Litueche', 'Lolol', 'Machalí',
    'Malloa', 'Marchihue', 'Mostazal', 'Nancagua', 'Navidad', 'Olivar',
    'Palmilla', 'Paredones', 'Peralillo', 'Peumo', 'Pichidegua', 'Pichilemu',
    'Placilla', 'Pumanque', 'Quinta de Tilcoco', 'Rancagua', 'Rengo', 'Requínoa',
    'San Fernando', 'San Vicente', 'Santa Cruz'
  ],
  'Maule': [
    'Cauquenes', 'Chanco', 'Colbún', 'Constitución', 'Curepto', 'Curicó',
    'Empedrado', 'Hualañé', 'Licantén', 'Linares', 'Longaví', 'Maule',
    'Molina', 'Parral', 'Pelarco', 'Pelluhue', 'Pencahue', 'Rauco',
    'Retiro', 'Río Claro', 'Romeral', 'Sagrada Familia', 'San Clemente',
    'San Javier', 'San Rafael', 'Talca', 'Teno', 'Vichuquén', 'Villa Alegre', 'Yerbas Buenas'
  ],
  'Ñuble': [
    'Bulnes', 'Chillán', 'Chillán Viejo', 'Cobquecura', 'Coelemu', 'Coihueco',
    'El Carmen', 'Ninhue', 'Ñiquén', 'Pemuco', 'Pinto', 'Portezuelo',
    'Quillón', 'Quirihue', 'Ránquil', 'San Carlos', 'San Fabián', 'San Ignacio',
    'San Nicolás', 'Treguaco', 'Yungay'
  ],
  'Biobío': [
    'Alto Biobío', 'Antuco', 'Arauco', 'Cabrero', 'Cañete', 'Chiguayante',
    'Concepción', 'Contulmo', 'Coronel', 'Curanilahue', 'Florida', 'Hualpén',
    'Hualqui', 'Laja', 'Lebu', 'Los Álamos', 'Los Ángeles', 'Lota',
    'Mulchén', 'Nacimiento', 'Negrete', 'Penco', 'Quilaco', 'Quilleco',
    'San Pedro de la Paz', 'San Rosendo', 'Santa Bárbara', 'Santa Juana',
    'Talcahuano', 'Tirúa', 'Tomé', 'Tucapel', 'Yumbel'
  ],
  'La Araucanía': [
    'Angol', 'Carahue', 'Cholchol', 'Collipulli', 'Cunco', 'Curacautín',
    'Curarrehue', 'Ercilla', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro',
    'Loncoche', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Melipeuco', 'Nueva Imperial',
    'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Purén', 'Renaico',
    'Saavedra', 'Temuco', 'Teodoro Schmidt', 'Toltén', 'Traiguén', 'Victoria',
    'Vilcún', 'Villarrica'
  ],
  'Los Ríos': [
    'Corral', 'Futrono', 'La Unión', 'Lago Ranco', 'Lanco', 'Los Lagos',
    'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'Río Bueno', 'Valdivia'
  ],
  'Los Lagos': [
    'Ancud', 'Calbuco', 'Castro', 'Chaitén', 'Chonchi', 'Cochamó',
    'Curaco de Vélez', 'Dalcahue', 'Fresia', 'Frutillar', 'Futaleufú',
    'Hualaihué', 'Llanquihue', 'Los Muermos', 'Maullín', 'Osorno', 'Palena',
    'Puerto Montt', 'Puerto Octay', 'Puerto Varas', 'Puqueldón', 'Purranque',
    'Puyehue', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Río Negro',
    'San Juan de la Costa', 'San Pablo'
  ],
  'Aysén': [
    'Aysén', 'Chile Chico', 'Cisnes', 'Cochrane', 'Coyhaique',
    'Guaitecas', 'Lago Verde', 'O’Higgins', 'Río Ibáñez', 'Tortel'
  ],
  'Magallanes y de la Antártica Chilena': [
    'Antártica', 'Cabo de Hornos', 'Laguna Blanca', 'Natales', 'Porvenir',
    'Primavera', 'Punta Arenas', 'Río Verde', 'San Gregorio', 'Timaukel', 'Torres del Paine'
  ]
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

  // Listados para los 3 selectores: País -> Región -> Comuna
  readonly paisesDisponibles: string[] = ['Chile'];
  readonly regionesDisponibles: string[] = Object.keys(REGIONES_COMUNAS_CHILE);
  comunasDisponibles: string[] = [];

  // Objeto con "Chile" seleccionado por defecto
  usuario = {
    rut: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    pais: 'Chile',
    ciudad: '', // Almacena la Región seleccionada mantendo compatibilidad con el resto de la app
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
   * Al elegir una Región, carga sus comunas ordenadas alfabéticamente y reinicia la comuna seleccionada
   */
  alCambiarRegion(event: any) {
    const regionElegida = event?.detail?.value || this.usuario.ciudad;
    this.usuario.ciudad = regionElegida;
    this.usuario.comuna = '';
    this.comunasDisponibles = REGIONES_COMUNAS_CHILE[regionElegida]
      ? [...REGIONES_COMUNAS_CHILE[regionElegida]].sort((a, b) => a.localeCompare(b))
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