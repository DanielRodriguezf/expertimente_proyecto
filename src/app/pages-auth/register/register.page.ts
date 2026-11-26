import { Component, inject, ChangeDetectorRef, ElementRef } from '@angular/core';
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
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  personAddOutline, 
  eyeOutline, 
  eyeOffOutline,
  arrowBackOutline,
  checkmarkCircleOutline,
  checkmarkCircle,
  warning,
  closeCircle,
  informationCircle,
  globeOutline,
  businessOutline,
  navigateOutline,
  alertCircleOutline
} from 'ionicons/icons';

import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { GoogleAuthService, PerfilGoogle } from '../../services/google-auth';
import {
  EDAD_MAXIMA,
  EDAD_MINIMA,
  REQUISITOS_PASSWORD,
  fechaIsoHaceAnios,
  formatearRutEnVivo,
  normalizarCorreo,
  normalizarEspacios,
  normalizarRut,
  normalizarTelefono,
  validarConfirmacionPassword,
  validarCorreo,
  validarFechaNacimiento,
  validarNombrePersona,
  validarPasswordNueva,
  validarRut,
  validarTelefonoMovil
} from '../../utils/validadores';

const CAMPOS_DE_GOOGLE = ['nombre', 'apellidoPaterno', 'apellidoMaterno'] as const;

/* =======================================================
   VALIDACIÓN: campos del formulario y qué campos tiene cada paso
======================================================= */
type CampoTexto =
  | 'rut'
  | 'nombre'
  | 'apellidoPaterno'
  | 'apellidoMaterno'
  | 'fechaNacimiento'
  | 'correo'
  | 'telefono'
  | 'password'
  | 'passwordConfirm';
type CampoSeleccion = 'ciudad' | 'comuna';
type CampoFormulario = CampoTexto | CampoSeleccion;

const CAMPOS_POR_PASO: Record<number, CampoFormulario[]> = {
  1: ['rut', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'fechaNacimiento'],
  2: ['ciudad', 'comuna'],
  3: ['correo', 'telefono'],
  4: ['password', 'passwordConfirm']
};

function crearErroresVacios(): Record<CampoFormulario, string> {
  return {
    rut: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '', fechaNacimiento: '',
    ciudad: '', comuna: '', correo: '', telefono: '', password: '', passwordConfirm: ''
  };
}

function crearTocadosVacios(): Record<CampoFormulario, boolean> {
  return {
    rut: false, nombre: false, apellidoPaterno: false, apellidoMaterno: false, fechaNacimiento: false,
    ciudad: false, comuna: false, correo: false, telefono: false, password: false, passwordConfirm: false
  };
}

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
  private toastCtrl = inject(ToastController);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;

  readonly paisesDisponibles: string[] = ['Chile'];
  readonly regionesDisponibles: string[] = Object.keys(REGIONES_COMUNAS_CHILE);
  comunasDisponibles: string[] = [];

  readonly opcionesAlertaPais = {
    header: 'Selecciona tu país',
    cssClass: 'alerta-expertimente'
  };
  readonly opcionesAlertaRegion = {
    header: 'Selecciona tu región',
    cssClass: 'alerta-expertimente'
  };
  readonly opcionesAlertaComuna = {
    header: 'Selecciona tu comuna',
    cssClass: 'alerta-expertimente'
  };

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

  // Validación por campo: el error solo se muestra cuando el campo fue "tocado"
  errores: Record<CampoFormulario, string> = crearErroresVacios();
  tocados: Record<CampoFormulario, boolean> = crearTocadosVacios();

  // Límites del selector de fecha (el calendario no deja elegir menores de EDAD_MINIMA ni años absurdos)
  readonly fechaNacimientoMax: string = fechaIsoHaceAnios(EDAD_MINIMA);
  readonly fechaNacimientoMin: string = fechaIsoHaceAnios(EDAD_MAXIMA);

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
      'checkmark-circle-outline': checkmarkCircleOutline,
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle,
      'information-circle': informationCircle,
      'globe-outline': globeOutline,
      'business-outline': businessOutline,
      'navigate-outline': navigateOutline,
      'alert-circle-outline': alertCircleOutline
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

  async alCambiarRegion(event: any) {
    const regionElegida = event?.detail?.value || this.usuario.ciudad;
    this.usuario.ciudad = regionElegida;
    this.usuario.comuna = '';
    this.tocados.comuna = false;
    this.errores.comuna = '';
    this.tocados.ciudad = true;
    this.validarCampo('ciudad');
    this.comunasDisponibles = REGIONES_COMUNAS_CHILE[regionElegida]
      ? [...REGIONES_COMUNAS_CHILE[regionElegida]].sort((a, b) => a.localeCompare(b))
      : [];
    this.cdr.detectChanges();

    if (regionElegida) {
      await this.mostrarToast(`Región ${regionElegida} seleccionada. Ahora elige tu comuna.`, 'success');
    }
  }

  async alCambiarComuna(event: any) {
    const comunaElegida = event?.detail?.value || this.usuario.comuna;
    this.tocados.comuna = true;
    this.validarCampo('comuna');
    if (comunaElegida) {
      await this.mostrarToast(`Comuna ${comunaElegida} seleccionada.`, 'success');
    }
  }

  async verificarRegionAntesDeComuna(event: Event) {
    if (!this.usuario.ciudad) {
      event.preventDefault();
      event.stopPropagation();
      await this.mostrarToast('Primero selecciona tu región para ver las comunas disponibles.', 'warning');
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  togglePasswordConfirm() {
    this.showPasswordConfirm = !this.showPasswordConfirm;
  }

  /* =======================================================
     VALIDACIÓN DE CAMPOS
     - El error aparece al salir de un campo con contenido, o al presionar "Continuar" / "Crear Cuenta".
     - Una vez visible, se actualiza mientras el usuario corrige.
  ======================================================= */
  errorDe(campo: CampoFormulario): string {
    return this.tocados[campo] ? this.errores[campo] : '';
  }

  alCambiarCampo(campo: CampoTexto, valor: string | number | null | undefined) {
    const texto = String(valor ?? '');
    this.usuario[campo] = campo === 'rut' ? formatearRutEnVivo(texto) : texto;

    // La fecha se elige desde un calendario (no se escribe letra por letra): se valida apenas cambia.
    if (campo === 'fechaNacimiento') {
      this.tocados[campo] = true;
    }

    if (this.tocados[campo]) {
      this.validarCampo(campo);
    }

    // Si cambia la contraseña, la confirmación puede dejar de coincidir
    if (campo === 'password' && this.tocados.passwordConfirm) {
      this.validarCampo('passwordConfirm');
    }
  }

  alSalirDeCampo(campo: CampoTexto) {
    // Campo vacío que nunca se tocó: se avisa recién al presionar "Continuar"
    if (!this.usuario[campo] && !this.tocados[campo]) {
      return;
    }

    this.normalizarCampo(campo);
    this.tocados[campo] = true;
    this.validarCampo(campo);
  }

  private validarCampo(campo: CampoFormulario) {
    this.errores[campo] = this.calcularError(campo);
  }

  private calcularError(campo: CampoFormulario): string {
    const u = this.usuario;

    switch (campo) {
      case 'rut':
        return validarRut(u.rut);
      case 'nombre':
        return validarNombrePersona(u.nombre, 'nombre');
      case 'apellidoPaterno':
        return validarNombrePersona(u.apellidoPaterno, 'apellido paterno');
      case 'apellidoMaterno':
        // Opcional: hay personas con un solo apellido. Cambia a `true` para hacerlo obligatorio.
        return validarNombrePersona(u.apellidoMaterno, 'apellido materno', false);
      case 'fechaNacimiento':
        return validarFechaNacimiento(u.fechaNacimiento);
      case 'ciudad':
        return u.ciudad ? '' : 'Selecciona tu región.';
      case 'comuna':
        return u.comuna ? '' : (u.ciudad ? 'Selecciona tu comuna.' : 'Primero selecciona tu región.');
      case 'correo':
        return validarCorreo(u.correo);
      case 'telefono':
        return validarTelefonoMovil(u.telefono);
      case 'password':
        return validarPasswordNueva(u.password);
      case 'passwordConfirm':
        return validarConfirmacionPassword(u.password, u.passwordConfirm);
    }
  }

  /** Deja el valor limpio y en el formato que se guarda (RUT 12345678-5, celular +56912345678, correo en minúsculas...). */
  private normalizarCampo(campo: CampoTexto) {
    switch (campo) {
      case 'rut':
        this.usuario.rut = normalizarRut(this.usuario.rut);
        break;
      case 'correo':
        this.usuario.correo = normalizarCorreo(this.usuario.correo);
        break;
      case 'telefono':
        this.usuario.telefono = normalizarTelefono(this.usuario.telefono);
        break;
      case 'nombre':
      case 'apellidoPaterno':
      case 'apellidoMaterno':
        this.usuario[campo] = normalizarEspacios(this.usuario[campo]);
        break;
      default:
        // La fecha y las contraseñas se dejan tal cual las escribió el usuario
        break;
    }
  }

  private camposDelPaso(paso: number): CampoFormulario[] {
    const campos = CAMPOS_POR_PASO[paso] ?? [];

    // Con Google el correo viene de la cuenta y no se edita: no se valida
    return paso === 3 && this.esRegistroGoogle
      ? campos.filter(campo => campo !== 'correo')
      : campos;
  }

  private marcarYValidarPaso(paso: number): boolean {
    let valido = true;

    for (const campo of this.camposDelPaso(paso)) {
      if (campo !== 'ciudad' && campo !== 'comuna') {
        this.normalizarCampo(campo);
      }
      this.tocados[campo] = true;
      this.validarCampo(campo);

      if (this.errores[campo]) {
        valido = false;
      }
    }

    return valido;
  }

  private validarPaso(paso: number): boolean {
    const valido = this.marcarYValidarPaso(paso);
    this.cdr.detectChanges();

    if (!valido) {
      this.enfocarPrimerError();
    }
    return valido;
  }

  /** Revisa todos los pasos antes de crear la cuenta; si hay un error, lleva al usuario a ese paso. */
  private async validarTodoElFormulario(): Promise<boolean> {
    const pasos = this.esRegistroGoogle ? [1, 2, 3] : [1, 2, 3, 4];
    const pasoConError = pasos.find(paso => !this.marcarYValidarPaso(paso));

    if (pasoConError === undefined) {
      return true;
    }

    const cambioDePaso = pasoConError !== this.pasoActual;
    this.pasoActual = pasoConError;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.enfocarPrimerError();

    if (cambioDePaso) {
      await this.mostrarToast(`Revisa los datos del paso ${pasoConError}.`, 'warning');
    }
    return false;
  }

  /** Para errores que solo conoce Firebase (correo ya registrado, contraseña débil...). */
  private marcarErrorServidor(campo: CampoFormulario, paso: number, mensaje: string) {
    this.errorMessage = '';
    this.errores[campo] = mensaje;
    this.tocados[campo] = true;
    this.pasoActual = paso;
    this.enfocarPrimerError();
  }

  private limpiarValidacion() {
    this.errores = crearErroresVacios();
    this.tocados = crearTocadosVacios();
  }

  private enfocarPrimerError() {
    setTimeout(() => {
      const campo = this.host.nativeElement.querySelector('.campo-invalido') as HTMLElement | null;
      campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  siguientePaso() {
    if (!this.validarPaso(this.pasoActual)) {
      return;
    }

    if (this.pasoActual < this.totalPasos) {
      this.errorMessage = '';
      this.pasoActual++;
      this.cdr.detectChanges();
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
    this.limpiarValidacion();
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
    this.limpiarValidacion();
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
    if (this.cargando) {
      return;
    }

    if (!(await this.validarTodoElFormulario())) {
      return;
    }

    if (this.esRegistroGoogle) {
      await this.completarRegistroGoogle();
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
        bienvenidaRegistroMostrada: true,
        fechaRegistro: new Date()
      });

      // Activa la pantalla completa de bienvenida antes de cambiar la ruta
      window.dispatchEvent(
        new CustomEvent('registro-exitoso', {
          detail: { nombre: this.usuario.nombre, uid }
        })
      );

      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al registrar:', error);
      if (error.code === 'auth/email-already-in-use') {
        this.marcarErrorServidor('correo', 3, 'Este correo ya está registrado. Inicia sesión.');
      } else if (error.code === 'auth/invalid-email') {
        this.marcarErrorServidor('correo', 3, 'Escribe un correo válido.');
      } else if (error.code === 'auth/weak-password') {
        this.marcarErrorServidor('password', 4, REQUISITOS_PASSWORD);
      } else if (error.code === 'auth/network-request-failed') {
        this.errorMessage = 'Sin conexión. Revisa tu internet.';
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

      this.registroCompletado = true;

      // Activa la pantalla completa de bienvenida antes de cambiar la ruta
      window.dispatchEvent(
        new CustomEvent('registro-exitoso', {
          detail: { nombre: this.usuario.nombre, uid: user.uid }
        })
      );

      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al registrar con Google:', error);
      this.errorMessage = 'Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    await this.toastCtrl.dismiss().catch(() => {});

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2400,
      position: 'bottom',
      color,
      icon: iconos[color] || 'information-circle',
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }
}