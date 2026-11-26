import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonProgressBar,
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  lockClosedOutline,
  checkmarkCircle,
  closeCircle,
  warning,
  informationCircle,
  personOutline,
  callOutline,
  navigateOutline,
  fingerPrintOutline,
  globeOutline,
  businessOutline,
  shieldCheckmarkOutline,
  alertCircleOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import {
  normalizarEspacios,
  normalizarTelefono,
  validarNombrePersona,
  validarTelefonoMovil
} from '../../utils/validadores';

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

/* =======================================================
   VALIDACIÓN: campos del formulario y qué campos tiene cada paso
======================================================= */
type CampoTexto = 'nombre' | 'apellidoPaterno' | 'apellidoMaterno' | 'telefono';
type CampoFormulario = CampoTexto | 'ciudad' | 'comuna';

const CAMPOS_POR_PASO: Record<number, CampoFormulario[]> = {
  1: ['nombre', 'apellidoPaterno', 'apellidoMaterno'],
  2: ['telefono'],
  3: ['ciudad', 'comuna']
};

function crearErroresVacios(): Record<CampoFormulario, string> {
  return { nombre: '', apellidoPaterno: '', apellidoMaterno: '', telefono: '', ciudad: '', comuna: '' };
}

function crearTocadosVacios(): Record<CampoFormulario, boolean> {
  return { nombre: false, apellidoPaterno: false, apellidoMaterno: false, telefono: false, ciudad: false, comuna: false };
}

@Component({
  selector: 'app-perfil-editar',
  templateUrl: './perfil-editar.page.html',
  styleUrls: ['./perfil-editar.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonProgressBar,
    IonSpinner
  ]
})
export class PerfilEditarPage implements OnInit, OnDestroy {
  pasoActual: number = 1;
  totalPasos: number = 3;
  cargando: boolean = true;
  guardando: boolean = false;
  usuarioUID: string = '';

  readonly paisesDisponibles: string[] = ['Chile'];
  readonly regionesDisponibles: string[] = Object.keys(REGIONES_COMUNAS_CHILE);
  comunasDisponibles: string[] = [];

  // Opciones visuales de los selectores usando la alerta global de global.scss
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
    correo: '',
    telefono: '',
    pais: 'Chile',
    ciudad: '',
    comuna: ''
  };

  // Validación por campo: el error solo se muestra cuando el campo fue "tocado"
  errores: Record<CampoFormulario, string> = crearErroresVacios();
  tocados: Record<CampoFormulario, boolean> = crearTocadosVacios();

  private unsubAuth: AuthUnsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private toastCtrl = inject(ToastController);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'lock-closed-outline': lockClosedOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'warning': warning,
      'information-circle': informationCircle,
      'person-outline': personOutline,
      'call-outline': callOutline,
      'navigate-outline': navigateOutline,
      'finger-print-outline': fingerPrintOutline,
      'globe-outline': globeOutline,
      'business-outline': businessOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'alert-circle-outline': alertCircleOutline
    });
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioUID = user.uid;

        try {
          const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            this.ngZone.run(() => {
              this.usuario = {
                rut: data['rut'] || '',
                nombre: data['nombre'] || '',
                apellidoPaterno: data['apellidoPaterno'] || '',
                apellidoMaterno: data['apellidoMaterno'] || '',
                correo: data['correo'] || '',
                telefono: data['telefono'] || '',
                pais: data['pais'] || 'Chile',
                ciudad: data['ciudad'] || '',
                comuna: data['comuna'] || ''
              };

              this.sincronizarUbicacionInicial(this.usuario.ciudad, this.usuario.comuna);
              this.limpiarValidacion();
            });
          }
        } catch (error) {
          console.error('Error al cargar datos del perfil:', error);
          await this.mostrarMensaje('No se pudieron cargar tus datos.', 'danger');
        }
      }

      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy() {
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  ionViewWillEnter() {
    this.pasoActual = 1;
    this.guardando = false;
    this.limpiarValidacion();
    if (!this.usuario.pais) {
      this.usuario.pais = 'Chile';
    }
    this.cdr.detectChanges();
  }

  private sincronizarUbicacionInicial(regionGuardada: string, comunaGuardada: string) {
    const normalizar = (texto: string) =>
      (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    let regionResuelta = '';
    let comunaResuelta = '';

    const regionDirecta = this.regionesDisponibles.find(
      r => normalizar(r) === normalizar(regionGuardada)
    );

    if (regionDirecta) {
      regionResuelta = regionDirecta;
      const comunas = REGIONES_COMUNAS_CHILE[regionResuelta] || [];
      comunaResuelta = comunas.find(c => normalizar(c) === normalizar(comunaGuardada)) || '';
    } else if (comunaGuardada) {
      for (const region of this.regionesDisponibles) {
        const comunas = REGIONES_COMUNAS_CHILE[region];
        const coincidencia = comunas.find(c => normalizar(c) === normalizar(comunaGuardada));
        if (coincidencia) {
          regionResuelta = region;
          comunaResuelta = coincidencia;
          break;
        }
      }
    }

    this.usuario.ciudad = regionResuelta;
    this.comunasDisponibles = regionResuelta
      ? [...REGIONES_COMUNAS_CHILE[regionResuelta]].sort((a, b) => a.localeCompare(b))
      : [];
    this.usuario.comuna = comunaResuelta;
  }

  /**
   * Al elegir una Región, actualiza las comunas y muestra un toast guiando al usuario
   */
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
      await this.mostrarMensaje(`Región ${regionElegida} seleccionada. Ahora elige tu comuna.`, 'success');
    }
  }

  /**
   * Al elegir una Comuna, confirma con un toast
   */
  async alCambiarComuna(event: any) {
    const comunaElegida = event?.detail?.value || this.usuario.comuna;
    this.tocados.comuna = true;
    this.validarCampo('comuna');
    if (comunaElegida) {
      await this.mostrarMensaje(`Comuna ${comunaElegida} seleccionada.`, 'success');
    }
  }

  /**
   * Si el usuario toca Comuna antes de haber seleccionado una Región, le avisa con un toast
   */
  async verificarRegionAntesDeComuna(event: Event) {
    if (!this.usuario.ciudad) {
      event.preventDefault();
      event.stopPropagation();
      await this.mostrarMensaje('Primero selecciona tu región para ver las comunas disponibles.', 'warning');
    }
  }

  irAPaso(paso: number) {
    if (paso >= 1 && paso <= this.totalPasos) {
      this.pasoActual = paso;
      this.cdr.detectChanges();
    }
  }

  /* =======================================================
     VALIDACIÓN DE CAMPOS
     - El error aparece al salir de un campo con contenido, o al presionar "Continuar" / "Guardar".
     - Una vez visible, se actualiza mientras el usuario corrige.
  ======================================================= */
  errorDe(campo: CampoFormulario): string {
    return this.tocados[campo] ? this.errores[campo] : '';
  }

  alCambiarCampo(campo: CampoTexto, valor: string | number | null | undefined) {
    this.usuario[campo] = String(valor ?? '');

    if (this.tocados[campo]) {
      this.validarCampo(campo);
    }
  }

  alSalirDeCampo(campo: CampoTexto) {
    // Campo vacío que nunca se tocó: se avisa recién al presionar el botón
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
      case 'nombre':
        return validarNombrePersona(u.nombre, 'nombre');
      case 'apellidoPaterno':
        return validarNombrePersona(u.apellidoPaterno, 'apellido paterno');
      case 'apellidoMaterno':
        // Opcional: hay personas con un solo apellido. Cambia a `true` para hacerlo obligatorio.
        return validarNombrePersona(u.apellidoMaterno, 'apellido materno', false);
      case 'telefono':
        return validarTelefonoMovil(u.telefono);
      case 'ciudad':
        return u.ciudad ? '' : 'Selecciona tu región.';
      case 'comuna':
        return u.comuna ? '' : (u.ciudad ? 'Selecciona tu comuna.' : 'Primero selecciona tu región.');
    }
  }

  /** Deja el valor limpio y en el formato que se guarda (celular +56912345678, sin espacios dobles...). */
  private normalizarCampo(campo: CampoTexto) {
    if (campo === 'telefono') {
      this.usuario.telefono = normalizarTelefono(this.usuario.telefono);
    } else {
      this.usuario[campo] = normalizarEspacios(this.usuario[campo]);
    }
  }

  private marcarYValidarPaso(paso: number): boolean {
    let valido = true;

    for (const campo of CAMPOS_POR_PASO[paso] ?? []) {
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

  /** Revisa todos los pasos antes de guardar; si hay un error, lleva al usuario a ese paso. */
  private async validarTodoElFormulario(): Promise<boolean> {
    const pasoConError = [1, 2, 3].find(paso => !this.marcarYValidarPaso(paso));

    if (pasoConError === undefined) {
      return true;
    }

    const cambioDePaso = pasoConError !== this.pasoActual;
    this.pasoActual = pasoConError;
    this.cdr.detectChanges();
    this.enfocarPrimerError();

    if (cambioDePaso) {
      await this.mostrarMensaje(`Revisa los datos del paso ${pasoConError}.`, 'warning');
    }
    return false;
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
      this.pasoActual++;
      this.cdr.detectChanges();
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
      this.cdr.detectChanges();
    }
  }

  async guardarCambios() {
    if (!this.usuarioUID) return;

    if (!(await this.validarTodoElFormulario())) {
      return;
    }

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);

      await updateDoc(docRef, {
        rut: this.usuario.rut,
        nombre: this.usuario.nombre.trim(),
        apellidoPaterno: this.usuario.apellidoPaterno.trim(),
        apellidoMaterno: this.usuario.apellidoMaterno.trim(),
        correo: this.usuario.correo,
        telefono: this.usuario.telefono.trim(),
        pais: (this.usuario.pais || 'Chile').trim(),
        ciudad: this.usuario.ciudad.trim(),
        comuna: this.usuario.comuna.trim(),
        fechaActualizacionPerfil: new Date()
      });

      this.ngZone.run(() => {
        this.guardando = false;
        this.pasoActual = 1;
        this.cdr.detectChanges();
      });

      await this.mostrarMensaje('¡Tus datos fueron actualizados con éxito!', 'success');
      this.router.navigate(['/perfil']);

    } catch (error) {
      console.error('Error al actualizar el perfil:', error);
      await this.mostrarMensaje('Hubo un error al guardar los cambios.', 'danger');
      this.ngZone.run(() => {
        this.guardando = false;
        this.cdr.detectChanges();
      });
    }
  }

  private async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    // Cierra cualquier toast previo para evitar que se acumulen al cambiar rápido de región/comuna
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