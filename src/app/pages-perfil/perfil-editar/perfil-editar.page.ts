import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
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
  shieldCheckmarkOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

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

  private unsubAuth: AuthUnsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private toastCtrl = inject(ToastController);

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
      'shield-checkmark-outline': shieldCheckmarkOutline
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

  async siguientePaso() {
    if (this.pasoActual === 1) {
      if (!this.usuario.nombre.trim() || !this.usuario.apellidoPaterno.trim()) {
        await this.mostrarMensaje('Completa al menos tu nombre y apellido paterno.', 'warning');
        return;
      }
    }

    if (this.pasoActual === 2) {
      if (!this.usuario.telefono.trim()) {
        await this.mostrarMensaje('Por favor, ingresa tu teléfono de contacto.', 'warning');
        return;
      }
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

    if (!this.usuario.ciudad) {
      await this.mostrarMensaje('Por favor, selecciona tu región.', 'warning');
      return;
    }

    if (!this.usuario.comuna) {
      await this.mostrarMensaje('Por favor, selecciona tu comuna.', 'warning');
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