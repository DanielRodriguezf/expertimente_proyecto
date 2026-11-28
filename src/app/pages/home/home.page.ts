import { nivelMayorVisible, experienciaVisible } from '../../data/niveles-educativos';
import { PerfilesEnVivo } from './perfiles-en-vivo';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';

import { CommonModule, Location } from '@angular/common';

import { Title } from '@angular/platform-browser';

import {
  ActivatedRoute,
  Router,
  ParamMap,
  convertToParamMap
} from '@angular/router';

import { Subscription } from 'rxjs';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonButtons,
  AlertController,
  ToastController
} from '@ionic/angular';

import { addIcons } from 'ionicons';

import {
  briefcaseOutline,
  addOutline,
  logOutOutline,
  createOutline,
  trashOutline,
  powerOutline,
  locationOutline,
  mailOutline,
  callOutline,
  peopleOutline,
  closeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  personOutline,
  documentTextOutline,
  schoolOutline,
  timeOutline,
  starOutline,
  lockClosedOutline,
  expandOutline,
  contractOutline,
  chatbubblesOutline,
  arrowBackOutline
} from 'ionicons/icons';

import {
  Auth,
  signOut,
  onAuthStateChanged,
  User,
  Unsubscribe
} from '@angular/fire/auth';

import {
  Firestore,
  runTransaction,
  serverTimestamp,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  updateDoc,
  getDocs,
  getDocsFromServer,
  addDoc
} from '@angular/fire/firestore';

import {
  PerfilChatReclutadorComponent
} from './perfil-chat-reclutador.component';


import {
  ReclutadorHerramientasComponent
} from './reclutador-herramientas.component';


import {
  generarCatalogoCargos
} from '../cargos-catalogo/cargos-catalogo';

interface InfoCargo {
  nombre: string;
  areaLaboral: string;
}

export interface OfertaTrabajo {
  id: string;
  titulo: string;
  descripcion: string;
  modalidad: string;
  cargoId?: string;
  cargoNombre?: string;
  formularioId?: string;
  areaLaboral?: string;
  direccion?: string;
  habilidades?: string;
  contactoEmail: string;
  contactoTelefono?: string;
  estado: 'Activa' | 'Inactiva' | 'Borrador';
  fechaPublicacion?: any;
  fechaActualizacion?: any;
  reclutadorId?: string;
  maximoCuestionario?: number;
}

export interface RespuestaCuestionario {
  preguntaId: string;
  preguntaTexto: string;
  tipo: 'texto' | 'seleccion';
  respuesta: string;
  puntajeObtenido?: number;
}

export interface PostulanteCompleto {
  postulacionId: string;
  postulanteId: string;
  fechaPostulacion?: any;
  estado: 'Pendiente' | 'Aceptado' | 'Rechazado';
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  fotoPerfil?: string;
  puntajeInoeidad?: number;
  porcentajeIdoneidad?: number;
  areaLaboral?: string;
  cargoId?: string;
  cargoNombre?: string;
  ofertaTitulo?: string;
  respuestas?: RespuestaCuestionario[];

  cvManual?: {
    nivelEducativo?: string;
    areaExperiencia?: string;
    anosExperiencia?: number | string;
    habilidades?: string;
  };

  cvBase64?: string;
}

export interface PostulanteBusqueda {
  escaneoCV?: number;
  criterios?: string;
  estadoCV?: string;
  resultadoTernaId?: string;
  experienciaResumen?: string;
  postulanteId: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  fotoPerfil?: string;
  cargos: string[];
  areasLaborales: string[];
  /** Porcentaje guardado en la evaluación (postulaciones-terna). */
  porcentajeEvaluacion?: number;
  /** Porcentaje que se muestra y con el que se ordena la lista. */
  porcentajeIdoneidad?: number;
  /** Cargos (normalizados) en los que ya fue aceptado. */
  cargosAceptados: string[];
  /** true si tiene al menos una evaluación registrada. */
  tieneEvaluacion?: boolean;
  aceptado?: boolean;

  cvManual?: {
    nivelEducativo?: string;
    areaExperiencia?: string;
    anosExperiencia?: number | string;
    habilidades?: string;
  };

  cvBase64?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonButtons,
    PerfilChatReclutadorComponent,
    ReclutadorHerramientasComponent,
  ]
})
export class HomePage implements OnInit, OnDestroy {

  private titleService = inject(Title);

  // Estado único del widget de chat flotante. Antes había dos variables
  // distintas (una en el HTML y otra en el TS), por lo que
  // abrirChatConPostulante() nunca abría el widget.
  estadoChat: 'cerrado' | 'pequeno' | 'grande' = 'cerrado';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private toastController = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  private navegacion?: Subscription;
  private cancelarAvisos?: () => void;
  private cancelarCargos?: Unsubscribe;
  private authUnsubscribe?: Unsubscribe;
  private snapshotUnsubscribe?: Unsubscribe;

  private parametrosActuales: ParamMap = convertToParamMap({});

  // NAVEGACIÓN
  vista = 'inicio';
  paginaActiva = true;
  avisosSinLeer = 0;
  readonly nivelEducativoVisible = nivelMayorVisible;
  readonly experienciaVisible = experienciaVisible;
  private alertas = inject(AlertController);

  // PERFIL
  nombreReclutador = '';
  nombreEmpresa = '';
  estadoReclutador: 'aprobado' | 'pendiente' = 'pendiente';
  isLoading = true;

  // OFERTAS
  ofertas: OfertaTrabajo[] = [];
  filtroOfertas: 'publicadas' | 'borradores' = 'publicadas';

  // POSTULANTES DE OFERTA
  isModalPostulantesOpen = false;
  cargandoPostulantes = false;
  ofertaSeleccionada: OfertaTrabajo | null = null;
  postulantesList: PostulanteCompleto[] = [];
  modalPostulantesFullscreen = false;
  mostrarRankingCompleto = false;

  // BÚSQUEDA
  isModalBusquedaPostulantesOpen = false;
  cargandoBusquedaPostulantes = false;
  postulantesBusqueda: PostulanteBusqueda[] = [];
  postulantesBusquedaFiltrados: PostulanteBusqueda[] = [];
  aceptandoPostulanteId = '';

  cargosCatalogoBusqueda: string[] = [];
  cargandoCargosBusqueda = false;
  errorCargosBusqueda = '';

  filtroCargo = '';
  filtroArea = '';

  busquedaRealizada = false;
  cargoBuscado = '';
  errorBusquedaPostulantes = '';

  private solicitudBusquedaActual = 0;

  // Búsqueda en vivo (postulaciones-terna + postulantes)
  private cancelarBusquedaEnVivo: Array<() => void> = [];
  private ternaDocs: Array<{ id: string; data: Record<string, any> }> = [];
  private perfilesDocs = new Map<string, Record<string, any>>();
  private seleccionesBusqueda?: Set<string>;
  private ternaLista = false;
  private perfilesLista = false;

  // Catálogo de cargos (Firestore + catálogo local como respaldo del área)
  private readonly catalogoEstatico = generarCatalogoCargos();
  private catalogoCargosPorId = new Map<string, InfoCargo>();
  private catalogoCargosPorNombre = new Map<string, InfoCargo>();

  // RESPUESTAS
  isModalRespuestasOpen = false;
  postulanteRespuestasSeleccionado: PostulanteCompleto | null = null;

  private empresasMockMap: Record<string, string> = {
    emp_001: 'Tech Corp Chile',
    emp_002: 'Innovación Global S.A.',
    emp_003: 'Desarrollos Rápidos'
  };

  constructor() {
    addIcons({
      'briefcase-outline': briefcaseOutline,
      'add-outline': addOutline,
      'log-out-outline': logOutOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      'power-outline': powerOutline,
      'location-outline': locationOutline,
      'mail-outline': mailOutline,
      'call-outline': callOutline,
      'people-outline': peopleOutline,
      'close-outline': closeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'person-outline': personOutline,
      'document-text-outline': documentTextOutline,
      'school-outline': schoolOutline,
      'time-outline': timeOutline,
      'star-outline': starOutline,
      'lock-closed-outline': lockClosedOutline,
      'expand-outline': expandOutline,
      'contract-outline': contractOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'arrow-back-outline': arrowBackOutline
    });
  }

  // GETTERS

  get usuarioId(): string {
    return this.auth.currentUser?.uid || '';
  }

  get candidatoPagina(): string {
    return this.parametrosActuales.get('postulante') || '';
  }

  get primerNombre(): string {
    if (
      !this.nombreReclutador ||
      this.nombreReclutador.toLowerCase() === 'reclutador'
    ) {
      const email = this.auth.currentUser?.email;

      if (email) {
        const handle = email.split('@')[0];
        return handle.charAt(0).toUpperCase() + handle.slice(1);
      }

      return 'Usuario';
    }

    return this.nombreReclutador.trim().split(' ')[0];
  }

  get totalOfertasActivas(): number {
    return this.ofertas.filter(
      oferta => oferta.estado === 'Activa'
    ).length;
  }

  get ofertasPublicadas(): OfertaTrabajo[] {
    return this.ofertas.filter(
      oferta => oferta.estado !== 'Borrador'
    );
  }

  get ofertasBorradores(): OfertaTrabajo[] {
    return this.ofertas
      .filter(oferta => oferta.estado === 'Borrador')
      .sort(
        (a, b) =>
          this.milisegundosDe(b.fechaActualizacion) -
          this.milisegundosDe(a.fechaActualizacion)
      );
  }

  get ofertasVisibles(): OfertaTrabajo[] {
    return this.filtroOfertas === 'borradores'
      ? this.ofertasBorradores
      : this.ofertasPublicadas;
  }

  get puedePublicarOfertas(): boolean {
    return this.estadoReclutador === 'aprobado';
  }

  get rankingPostulantes(): PostulanteCompleto[] {
    return this.postulantesList
      .filter(postulante => {
        const tienePorcentaje =
          typeof postulante.porcentajeIdoneidad === 'number' &&
          Number.isFinite(postulante.porcentajeIdoneidad);

        return tienePorcentaje;
      })
      .sort((a, b) => {
        const puntajeA =
          typeof a.porcentajeIdoneidad === 'number'
            ? a.porcentajeIdoneidad
            : -1;

        const puntajeB =
          typeof b.porcentajeIdoneidad === 'number'
            ? b.porcentajeIdoneidad
            : -1;

        return puntajeB - puntajeA;
      });
  }

fichaRankingId = '';

private maximoOferta(data: Record<string, any>): number | undefined {
  const preguntas = data['preguntas'] ?? data['cuestionario']?.preguntas;

  if (!Array.isArray(preguntas)) {
    return data['puntajeMaximo'];
  }

  return preguntas.reduce((total, pregunta) => {
    if (
      pregunta?.tipo !== 'seleccion' ||
      !Array.isArray(pregunta.opciones)
    ) {
      return total;
    }

    const puntos = pregunta.opciones.map(
      (opcion: any) => Number(opcion?.puntaje) || 0
    );

    return total + Math.max(0, ...puntos);
  }, 0);
}

private notaOferta(
  data: Record<string, any>,
  oferta: OfertaTrabajo
): number | undefined {
  const numero = (valor: unknown): number | undefined => {
    if (
      typeof valor !== 'number' &&
      (typeof valor !== 'string' || !valor.trim())
    ) {
      return undefined;
    }

    const resultado = Number(valor);
    return Number.isFinite(resultado) && resultado >= 0
      ? resultado
      : undefined;
  };

  const puntos = numero(
    data['puntajeObtenido'] ??
    data['puntajeIdoneidad'] ??
    data['puntajeInoeidad']
  );

  const maximo = numero(
    data['puntajeMaximo'] ?? oferta.maximoCuestionario
  );

  if (puntos !== undefined && maximo !== undefined) {
    if (maximo === 0 || puntos > maximo) return undefined;
    return (puntos / maximo) * 100;
  }

  const porcentajeGuardado = numero(
    data['porcentajeIdoneidad'] ?? data['porcentaje']
  );

  return porcentajeGuardado !== undefined && porcentajeGuardado <= 100
    ? porcentajeGuardado
    : undefined;
}

  get cargosBusquedaDisponibles(): string[] {
    const area = this.normalizarTexto(this.filtroArea);
    if (!area) return this.cargosCatalogoBusqueda;

    const nombres = new Set(
      Array.from(this.catalogoCargosPorId.values())
        .filter(cargo => this.separarAreas(cargo.areaLaboral).some(
          valor => this.normalizarTexto(valor) === area
        ))
        .map(cargo => this.normalizarTexto(cargo.nombre))
    );

    return this.cargosCatalogoBusqueda.filter(
      nombre => nombres.has(this.normalizarTexto(nombre))
    );
  }

  catalogoAbierto = false;
  private textoSugerencias = '';

  abrirCatalogoCargo() {
    this.textoSugerencias = '';
    this.catalogoAbierto = true;
  }

  get opcionesCargo(): string[] {
    const texto = this.normalizarTexto(this.textoSugerencias);
    return this.cargosBusquedaDisponibles.filter(cargo => this.normalizarTexto(cargo).includes(texto));
  }

  elegirCargo(cargo: string) {
    this.actualizarFiltroCargo(cargo);
    this.catalogoAbierto = false;
  }

  cerrarCatalogoAlSalir(event: FocusEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.catalogoAbierto = false;
    }
  }

  get areasBusquedaDisponibles(): string[] {
    const nombre = this.normalizarTexto(this.filtroCargo);
    const areas = new Set<string>();
    for (const cargo of this.catalogoCargosPorId.values()) {

      for (const area of cargo.areaLaboral.split(',')) {
        if (area.trim()) areas.add(area.trim());
      }
    }
    return Array.from(areas).sort((a, b) => a.localeCompare(b, 'es'));
  }

  // CICLO DE VIDA

  ngOnInit() {
    this.filtroArea = '';

    this.navegacion = this.route.queryParamMap.subscribe(
      parametros => {
        this.parametrosActuales = parametros;
        this.aplicarRuta(parametros);
      }
    );

    this.iniciarObservadorAuth();
  }

  ionViewWillEnter() {
    this.titleService.setTitle('ExpertiMente');
    
    this.paginaActiva = true;
    this.cdr.markForCheck();

    const user = this.auth.currentUser;

    if (user) {
      void this.cargarTodo(user);
    } else {
      this.iniciarObservadorAuth();
    }
  }

  ionViewWillLeave() {
    this.paginaActiva = false;
    this.cancelarAvisos?.();
    this.limpiarSuscripcionCargos();
    this.limpiarSuscripcionOfertas();
    this.solicitudBusquedaActual++;
    this.detenerBusquedaEnVivo();
    this.busquedaRealizada = false;
    this.cargandoBusquedaPostulantes = false;
    this.postulantesBusqueda = [];
    this.postulantesBusquedaFiltrados = [];
    this.cdr.markForCheck();
  }

  ngOnDestroy() {
    this.cancelarAvisos?.();
    this.navegacion?.unsubscribe();
    this.authUnsubscribe?.();
    this.solicitudBusquedaActual++;
    this.detenerBusquedaEnVivo();
    this.limpiarSuscripcionCargos();
    this.limpiarSuscripcionOfertas();
  }

  // NAVEGACIÓN

  private navegarAPagina(
    comandos: string[],
    queryParams: Record<string, string> = {}
  ): void {
    void this.router.navigate(comandos, { queryParams });
  }

  ir(vista: string): void {
    if (vista === 'inicio') {
      void this.router.navigate(['/home'], {
        queryParams: { vista: 'inicio' }
      });
      return;
    }

    this.navegarAPagina(['/home'], { vista });
  }

  abrirChatConPostulante(postulanteId: string): void {
    this.navegarAPagina(['/home'], {
      vista: this.vista,
      postulante: postulanteId
    });
    
    if (this.estadoChat === 'cerrado') {
      this.estadoChat = 'pequeno';
    }
  }

  cerrarChatActual(): void {
    this.navegarAPagina(['/home'], { vista: this.vista });
  }

  abrirPostulantes(oferta: OfertaTrabajo): void {
    if (
      !this.puedePublicarOfertas ||
      oferta.reclutadorId !== this.usuarioId
    ) {
      return;
    }

    this.navegarAPagina(['/home'], {
      vista: 'postulantes',
      oferta: oferta.id
    });
  }

  private aplicarRuta(
    parametros: ParamMap = this.parametrosActuales
  ) {
    const permitidas = [
      'inicio',
      'buscar',
      'postulantes',
      'respuestas',
      'aceptados',
      'solicitudes',
      'borradores',
      'perfil'
    ];

    const solicitada = parametros.get('vista') || 'inicio';

    if (solicitada === 'mensajes' || solicitada === 'chat') {
       this.estadoChat = 'pequeno';
       this.vista = 'inicio';
    } else {
       this.vista = permitidas.includes(solicitada) ? solicitada : 'inicio';
    }

    this.filtroOfertas = this.vista === 'borradores' ? 'borradores' : 'publicadas';
    this.catalogoAbierto = false;
    this.isModalBusquedaPostulantesOpen = this.vista === 'buscar';
    this.isModalPostulantesOpen = this.vista === 'postulantes';
    this.isModalRespuestasOpen = this.vista === 'respuestas';

    if (this.vista === 'respuestas') {
      const postulacionId = parametros.get('postulacion');

      this.postulanteRespuestasSeleccionado =
        this.postulantesList.find(
          p => p.postulacionId === postulacionId
        ) || null;
    }

    const ofertaId = parametros.get('oferta');
    if (!['postulantes', 'respuestas'].includes(this.vista) && this.ofertaSeleccionada) {
      this.detenerPostulantesOferta();
    }

    if (
      ['postulantes', 'respuestas'].includes(this.vista) &&
      ofertaId &&
      this.ofertaSeleccionada?.id !== ofertaId
    ) {
      const oferta = this.ofertas.find(o => o.id === ofertaId);

      if (oferta) {
        void this.verPostulantes(oferta, false);
      }
    }

    this.cdr.markForCheck();
  }

  // UTILIDADES

  private normalizarTexto(texto: string): string {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * Un cargo puede declarar su área en Firestore o solo en el catálogo
   * local. El ranking ya usaba ese respaldo, pero el buscador no, y los
   * cargos sin 'areaLaboral' nunca aparecían al filtrar por área.
   */
  private areaDeCargo(nombre: unknown, areaCampo: unknown): string {
    const propia = String(areaCampo ?? '').trim();

    if (propia) {
      return propia;
    }

    const clave = this.normalizarTexto(String(nombre ?? ''));

    if (!clave) {
      return '';
    }

    const encontrado = this.catalogoEstatico.find(
      cargo => this.normalizarTexto(cargo.nombre) === clave
    );

    return String(encontrado?.areaLaboral ?? '').trim();
  }

  private limpiarSuscripcionOfertas() {
    this.detenerPostulantesOferta();
    this.snapshotUnsubscribe?.();
    this.snapshotUnsubscribe = undefined;
  }

  private limpiarSuscripcionCargos() {
    this.cancelarCargos?.();
    this.cancelarCargos = undefined;
  }

  // CARGOS Y ÁREAS

  private escucharCargosBusqueda(): void {
    this.limpiarSuscripcionCargos();

    this.ngZone.run(() => {
      this.cargosCatalogoBusqueda = [];
      this.cargandoCargosBusqueda = true;
      this.errorCargosBusqueda = '';
      this.cdr.markForCheck();
    });

    this.cancelarCargos = onSnapshot(
      collection(this.firestore, 'cargos'),
      snapshot => {
        const nombresUnicos = new Map<string, string>();
        const porId = new Map<string, InfoCargo>();
        const porNombre = new Map<string, InfoCargo>();

        for (const documento of snapshot.docs) {
          const datos = documento.data();
          const nombreRaw = datos['nombre'];

          if (typeof nombreRaw !== 'string') {
            continue;
          }

          const nombre = nombreRaw.trim();
          const clave = this.normalizarTexto(nombre);

          if (!clave) {
            continue;
          }

          const info: InfoCargo = {
            nombre,
            areaLaboral: this.areaDeCargo(nombre, datos['areaLaboral'])
          };

          porId.set(documento.id, info);

          if (!porNombre.has(clave)) {
            porNombre.set(clave, info);
          }

          if (!nombresUnicos.has(clave)) {
            nombresUnicos.set(clave, nombre);
          }
        }

        this.catalogoCargosPorId = porId;
        this.catalogoCargosPorNombre = porNombre;

        const nombres = Array.from(nombresUnicos.values()).sort(
          (a, b) => a.localeCompare(b, 'es', {
            sensitivity: 'base'
          })
        );

        this.ngZone.run(() => {
          this.cargosCatalogoBusqueda = nombres;
          if (!this.areasBusquedaDisponibles.includes(this.filtroArea)) this.filtroArea = '';
          this.cargandoCargosBusqueda = false;
          this.errorCargosBusqueda = '';
          this.cdr.markForCheck();
        });

        // Si hay una búsqueda activa, se reconstruye con el catálogo nuevo
        // (no hace nada cuando no hay una búsqueda en curso).
        this.reconstruirBusqueda(this.solicitudBusquedaActual);
      },
      error => {
        console.error('Error al consultar la colección cargos:', error);

        this.ngZone.run(() => {
          this.cargosCatalogoBusqueda = [];
          this.cargandoCargosBusqueda = false;
          this.errorCargosBusqueda =
            'No fue posible cargar los cargos registrados. ' +
            'Revisa la conexión y los permisos de Firestore.';
          this.cdr.markForCheck();
        });
      }
    );
  }

  // AUTENTICACIÓN

  private iniciarObservadorAuth() {
    if (this.authUnsubscribe) {
      return;
    }

    this.authUnsubscribe = onAuthStateChanged(
      this.auth,
      (user: User | null) => {
        if (user) {
          void this.cargarTodo(user);
        } else {
          this.limpiarSuscripcionCargos();

          this.ngZone.run(() => {
            this.cargosCatalogoBusqueda = [];
            this.router.navigate(['/login']);
          });
        }
      }
    );
  }

  // CARGA GENERAL

  private async cargarTodo(user: User) {
    this.ngZone.run(() => {
      this.isLoading = true;
      this.cdr.detectChanges();
    });

    await this.cargarPerfilReclutador(user);

    if (this.puedePublicarOfertas) {
      this.escucharCargosBusqueda();
    } else {
      this.limpiarSuscripcionCargos();
      this.cargosCatalogoBusqueda = [];
      this.cargandoCargosBusqueda = false;
      this.errorCargosBusqueda = '';
    }

    this.cancelarAvisos?.();

    this.cancelarAvisos = onSnapshot(
      query(
        collection(this.firestore, 'notificaciones-reclutador'),
        where('reclutadorId', '==', user.uid)
      ),
      snapshot => {
        this.ngZone.run(() => {
          this.avisosSinLeer = snapshot.docs.filter(
            documento => !documento.data()['leido']
          ).length;
          this.cdr.markForCheck();
        });
      },
      () => {}
    );

    this.escucharOfertasReales(user.uid);
    this.aplicarRuta();
  }

  // PERFIL DEL RECLUTADOR

  async cargarPerfilReclutador(user: User) {
    this.estadoReclutador = 'pendiente';

    try {
      const referenciaReclutadores = doc(this.firestore, 'reclutadores', user.uid);

      let snapshot = await getDoc(referenciaReclutadores);
      let nombreEncontrado = '';
      let empresaEncontrada = '';

      if (snapshot.exists()) {
        const data = snapshot.data();
        const estadoBD = data['estado'];

        const estadoNormalizado = String(estadoBD ?? '')
          .trim()
          .toLowerCase();

        this.estadoReclutador =
          estadoNormalizado === 'aprobado'
            ? 'aprobado'
            : 'pendiente';

        if (
          estadoBD === undefined ||
          estadoBD === null ||
          String(estadoBD).trim() === ''
        ) {
          await updateDoc(referenciaReclutadores, {
            estado: 'Pendiente'
          });
        }

        nombreEncontrado =
          data['nombre'] ||
          data['nombreCompleto'] ||
          data['nombreReclutador'] ||
          '';

        const empresaId = data['empresaId'];

        if (empresaId) {
          if (this.empresasMockMap[empresaId]) {
            empresaEncontrada = this.empresasMockMap[empresaId];
          } else {
            const empresaSnapshot = await getDoc(
              doc(this.firestore, 'empresas', empresaId)
            );

            if (empresaSnapshot.exists()) {
              empresaEncontrada =
                empresaSnapshot.data()['nombre'] || '';
            }
          }
        }
      }

      if (!nombreEncontrado) {
        nombreEncontrado =
          user.displayName ||
          user.email?.split('@')[0] ||
          'Usuario';
      }

      this.ngZone.run(() => {
        this.nombreReclutador = nombreEncontrado;
        this.nombreEmpresa = empresaEncontrada;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
      this.estadoReclutador = 'pendiente';
    }
  }

  // OFERTAS

  escucharOfertasReales(reclutadorUid: string) {
    this.limpiarSuscripcionOfertas();

    const consulta = query(
      collection(this.firestore, 'ofertas'),
      where('reclutadorId', '==', reclutadorUid)
    );

    this.snapshotUnsubscribe = onSnapshot(
      consulta,
      snapshot => {
        this.ngZone.run(() => {
          this.ofertas = snapshot.docs.map(documento => {
            const data = documento.data();

            return {
              id: documento.id,
              titulo: data['titulo'] || '',
              descripcion: data['descripcion'] || '',
              modalidad: data['modalidad'] || '',
              cargoId: data['cargoId'] || '',
              cargoNombre: data['cargoNombre'] || '',
              formularioId: data['formularioId'] || '',
              areaLaboral: data['areaLaboral'] || '',
              direccion: data['direccion'] || '',
              habilidades: data['habilidades'] || '',
              contactoEmail: data['contactoEmail'] || '',
              contactoTelefono: data['contactoTelefono'] || '',
              estado: this.normalizarEstadoOferta(data['estado']),
              fechaPublicacion: data['fechaPublicacion'],
              fechaActualizacion: data['fechaActualizacion'],
              maximoCuestionario: this.maximoOferta(data),
              reclutadorId: data['reclutadorId']
            };
          });

          this.isLoading = false;
          this.aplicarRuta();
          this.cdr.detectChanges();
        });
      },
      error => {
        console.error('Error al escuchar cambios en ofertas:', error);

        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }

  // POSTULANTES DE UNA OFERTA

  private cancelarPostulaciones?: () => void;
  private perfilesOferta?: PerfilesEnVivo;

  private detenerPostulantesOferta() {
    this.cancelarPostulaciones?.();
    this.cancelarPostulaciones = undefined;
    this.perfilesOferta?.cerrar();
    this.perfilesOferta = undefined;
    this.ofertaSeleccionada = null;
    this.cargandoPostulantes = false;
  }

  verPostulantes(
    oferta: OfertaTrabajo,
    navegar = true
  ) {
    if (
      !this.puedePublicarOfertas ||
      oferta.reclutadorId !== this.usuarioId
    ) {
      return;
    }

    this.detenerPostulantesOferta();
    this.ofertaSeleccionada = oferta;
    this.fichaRankingId = '';
    this.ofertaSeleccionada = oferta;

    if (navegar) {
      this.router.navigate(['/home'], {
        queryParams: {
          vista: 'postulantes',
          oferta: oferta.id
        }
      });
    }

    this.isModalPostulantesOpen = this.vista !== 'respuestas';
    this.cargandoPostulantes = true;
    this.postulantesList = [];
    this.cdr.detectChanges();

    let filas: { id: string; data: Record<string, any> }[] = [];
    const perfiles = new PerfilesEnVivo(this.firestore, () => actualizar());
    this.perfilesOferta = perfiles;
    const actualizar = () => {
      if (this.perfilesOferta !== perfiles) return;
      const postulantes: PostulanteCompleto[] = [];

      for (const documento of filas) {
        const data = documento.data;
        const postulanteId = data['postulanteId'];
        const perfil = perfiles.datos.get(postulanteId);
        if (!perfil) continue;

        const apellidos =
          perfil['apellidos'] ||
          [perfil['apellidoPaterno'], perfil['apellidoMaterno']]
            .filter(Boolean)
            .join(' ');

        const porcentajeCalculado = this.notaOferta(data, oferta);
        const estadoFirestore = String(data['estado'] ?? '')
          .trim()
          .toLowerCase();

        let estado: 'Pendiente' | 'Aceptado' | 'Rechazado' =
          'Pendiente';

        if (estadoFirestore === 'aceptado') {
          estado = 'Aceptado';
        } else if (estadoFirestore === 'rechazado') {
          estado = 'Rechazado';
        }

        postulantes.push({
          postulacionId: documento.id,
          postulanteId,
          fechaPostulacion: data['fechaPostulacion'],
          estado,
          porcentajeIdoneidad: porcentajeCalculado,
          nombres:
            perfil['nombres'] ||
            perfil['nombre'] ||
            'Candidato',
          apellidos,
          correo:
            perfil['correo'] ||
            perfil['email'] ||
            'Sin correo',
          telefono:
            perfil['telefono'] ||
            perfil['celular'] ||
            '',
          fotoPerfil: perfil['fotoPerfil'] || '',
          areaLaboral:
            data['areaLaboral'] ||
            oferta.areaLaboral ||
            '',
          cargoId: data['cargoId'] || oferta.cargoId || '',
          cargoNombre:
            data['cargoNombre'] ||
            oferta.cargoNombre ||
            '',
          ofertaTitulo:
            data['tituloOferta'] ||
            oferta.titulo ||
            '',
          respuestas: this.normalizarRespuestasCuestionario(
            data['respuestasDetalle'] ??
            data['respuestas']
          ),
          cvManual: perfil['cvManual'] || undefined,
          cvBase64: perfil['cvBase64'] || undefined
        });
      }

      postulantes.sort((a, b) => {
        const puntajeA =
          typeof a.porcentajeIdoneidad === 'number'
            ? a.porcentajeIdoneidad
            : -1;

        const puntajeB =
          typeof b.porcentajeIdoneidad === 'number'
            ? b.porcentajeIdoneidad
            : -1;

        return puntajeB - puntajeA;
      });

      this.ngZone.run(() => {
        this.postulantesList = postulantes;

        if (this.vista === 'respuestas') {
          const postulacionId =
            this.parametrosActuales.get('postulacion');

          this.postulanteRespuestasSeleccionado =
            postulantes.find(
              p => p.postulacionId === postulacionId
            ) || null;
        }

        this.cargandoPostulantes = filas.some(fila => !perfiles.datos.has(fila.data['postulanteId']));
        this.cdr.detectChanges();
      });
    };

          const consulta = query(collection(this.firestore, 'postulaciones'), where('ofertaId', '==', oferta.id));
          this.cancelarPostulaciones = onSnapshot(consulta, snapshot => {
            const porPersona = new Map<string, (typeof filas)[number]>();

      for (const documento of snapshot.docs) {
        const data = documento.data();
        const uid = data['postulanteId'];

        if (typeof uid !== 'string' || !uid.trim()) continue;

        const previa = porPersona.get(uid);

        if (previa) {
          const prioridad = this.prioridadPostulacion(data, previa.data);

          if (prioridad < 0) continue;
          if (prioridad === 0 && documento.id <= previa.id) continue;
        }

        porPersona.set(uid, { id: documento.id, data });
      }

      filas = Array.from(porPersona.values());      perfiles.sincronizar(filas.map(fila => fila.data['postulanteId']));
      actualizar();
    }, () => {
      perfiles.cerrar();
      filas = [];
      actualizar();
      void this.mostrarToast('No fue posible actualizar los postulantes de esta oferta.');
    });
  }

private prioridadPostulacion(
  a: Record<string, any>,
  b: Record<string, any>
): number {
  const decidida = (datos: Record<string, any>): boolean => {
    const estado = String(datos['estado'] ?? '').trim().toLowerCase();
    return estado === 'aceptado' || estado === 'rechazado';
  };

  const fecha = (datos: Record<string, any>): number => {
    const valor = datos['fechaDecision'] ?? datos['fechaPostulacion'];
    let tiempo = 0;

    if (typeof valor?.toMillis === 'function') {
      tiempo = valor.toMillis();
    } else if (valor instanceof Date) {
      tiempo = valor.getTime();
    } else if (typeof valor === 'number') {
      tiempo = valor;
    } else if (typeof valor === 'string') {
      tiempo = Date.parse(valor);
    }

    return Number.isFinite(tiempo) ? tiempo : 0;
  };

  return Number(decidida(a)) - Number(decidida(b)) || fecha(a) - fecha(b);
}

  togglePantallaCompletaPostulantes() {
    this.modalPostulantesFullscreen =
      !this.modalPostulantesFullscreen;
    this.cdr.detectChanges();
  }

  toggleRankingCompleto() {
    this.mostrarRankingCompleto = !this.mostrarRankingCompleto;
    this.cdr.detectChanges();
  }

  verDatosPostulanteRanking(candidato: PostulanteCompleto) {
    this.fichaRankingId = candidato.postulacionId;
    setTimeout(() => {
      const elemento = document.getElementById(
        `postulante-${candidato.postulacionId}`
      );

      if (!elemento) {
        void this.mostrarToast(
          'No fue posible localizar la ficha del candidato.'
        );
        return;
      }

      elemento.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      elemento.classList.add('postulante-destacado');

      setTimeout(() => {
        elemento.classList.remove('postulante-destacado');
      }, 2500);
    }, 100);
  }

  // ACEPTAR O RECHAZAR DESDE OFERTA

  async cambiarEstadoPostulante(
    postulante: PostulanteCompleto,
    nuevoEstado: 'Aceptado' | 'Rechazado'
  ) {
    try {
      const uid = this.auth.currentUser?.uid;
      const oferta = this.ofertaSeleccionada;

      if (
        !uid ||
        !oferta ||
        !this.puedePublicarOfertas ||
        !postulante.postulacionId
      ) {
        return;
      }

      const aviso = doc(
        this.firestore,
        'notificaciones',
        `oferta_${postulante.postulacionId}_${nuevoEstado}`
      );

      await runTransaction(this.firestore, async transaccion => {
        const ofertaSnapshot = await transaccion.get(
          doc(this.firestore, 'ofertas', oferta.id)
        );

        const reclutadorSnapshot = await transaccion.get(
          doc(this.firestore, 'reclutadores', uid)
        );

        const postulacionRef = doc(
          this.firestore,
          'postulaciones',
          postulante.postulacionId
        );

        const postulacionSnapshot =
          await transaccion.get(postulacionRef);

        if (
          ofertaSnapshot.data()?.['reclutadorId'] !== uid ||
          reclutadorSnapshot.data()?.['estado'] !== 'aprobado' ||
          postulacionSnapshot.data()?.['ofertaId'] !== oferta.id
        ) {
          throw new Error('Acceso no permitido');
        }

        if (
          postulacionSnapshot.data()?.['estado'] === nuevoEstado
        ) {
          return;
        }

        transaccion.update(postulacionRef, {
          estado: nuevoEstado,
          reclutadorId: uid,
          fechaDecision: serverTimestamp()
        });

        transaccion.set(aviso, {
          postulanteId: postulante.postulanteId,
          ofertaId: oferta.id,
          tituloOferta: oferta.titulo,
          nombreEmpresa: this.nombreEmpresa,
          mensaje:
            `Tu postulación a «${oferta.titulo}» fue ` +
            (nuevoEstado === 'Aceptado' ? 'aceptada.' : 'rechazada.'),
          fecha: serverTimestamp(),
          leido: false,
          tipo:
            nuevoEstado === 'Aceptado'
              ? 'seleccionado'
              : 'rechazado'
        });
      });

      postulante.estado = nuevoEstado;

      void this.mostrarToast(
        nuevoEstado === 'Aceptado'
          ? `Candidato ${postulante.nombres} aceptado y notificación enviada.`
          : `Candidato ${postulante.nombres} rechazado y notificación enviada.`
      );

      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error(
        'Error al actualizar estado o enviar notificación:',
        error
      );
      void this.mostrarToast('Error al procesar la solicitud.');
    }
  }

  // RESPUESTAS

  private normalizarRespuestasCuestionario(
    respuestasRaw: any
  ): RespuestaCuestionario[] {
    if (
      respuestasRaw === undefined ||
      respuestasRaw === null
    ) {
      return [];
    }

    const respuestas: any[] = Array.isArray(respuestasRaw)
      ? respuestasRaw
      : typeof respuestasRaw === 'object'
        ? Object.values(respuestasRaw)
        : [];

    return respuestas.map((item: any, index: number) => {
      const tipo = String(item?.tipo ?? '')
        .trim()
        .toLowerCase();

      const respuestaRaw = item?.respuesta;
      let respuestaTexto = '';
      let puntajeObtenido: number | undefined;

      const puntajeExplicito =
        item?.puntajeObtenido ??
        item?.puntaje;

      if (
        puntajeExplicito !== undefined &&
        puntajeExplicito !== null &&
        !Number.isNaN(Number(puntajeExplicito))
      ) {
        puntajeObtenido = Number(puntajeExplicito);
      }

      if (tipo === 'seleccion') {
        if (typeof respuestaRaw === 'number') {
          respuestaTexto = `${respuestaRaw} puntos`;

          if (puntajeObtenido === undefined) {
            puntajeObtenido = respuestaRaw;
          }
        } else {
          respuestaTexto =
            respuestaRaw !== undefined &&
            respuestaRaw !== null
              ? String(respuestaRaw)
              : '';
        }
      } else {
        respuestaTexto = String(
          respuestaRaw ??
          item?.respuestaTexto ??
          item?.valor ??
          ''
        );
      }

      return {
        preguntaId: String(
          item?.preguntaId ??
          item?.id ??
          `pregunta-${index + 1}`
        ),
        preguntaTexto: String(
          item?.preguntaTexto ??
          item?.pregunta ??
          item?.texto ??
          `Pregunta ${index + 1}`
        ),
        tipo: tipo === 'seleccion' ? 'seleccion' : 'texto',
        respuesta: respuestaTexto,
        puntajeObtenido
      };
    });
  }

  verRespuestasCuestionario(
    postulante: PostulanteCompleto
  ): void {
    const ofertaId = this.ofertaSeleccionada?.id;

    if (!ofertaId || !postulante.postulacionId) {
      void this.mostrarToast(
        'No fue posible identificar la oferta o la postulación.'
      );
      return;
    }

    this.navegarAPagina(['/home'], {
      vista: 'respuestas',
      oferta: ofertaId,
      postulacion: postulante.postulacionId
    });
  }

  cerrarModalRespuestas() {
    this.router.navigate(['/home'], {
      queryParams: {
        vista: 'postulantes',
        oferta: this.ofertaSeleccionada?.id
      }
    });

    this.isModalRespuestasOpen = false;
    this.postulanteRespuestasSeleccionado = null;
    this.cdr.detectChanges();
  }

  // CURRÍCULUM

  verCV(cvBase64: string) {
    if (!cvBase64.startsWith('data:application/pdf')) {
      void this.mostrarToast('No hay un PDF válido disponible.');
      return;
    }

    try {
      const binario = atob(cvBase64.split(',')[1]);

      const bytes = Uint8Array.from(
        binario,
        caracter => caracter.charCodeAt(0)
      );

      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/pdf'
        })
      );

      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      void this.mostrarToast('No se pudo abrir el CV.');
    }
  }

  // CERRAR VISTA DE POSTULANTES

  cerrarModalPostulantes() {
    this.ir('inicio');
    this.isModalRespuestasOpen = false;
    this.postulanteRespuestasSeleccionado = null;
    this.isModalPostulantesOpen = false;
    this.detenerPostulantesOferta();
    this.postulantesList = [];
    this.modalPostulantesFullscreen = false;
    this.mostrarRankingCompleto = false;
  }

  // ACCESOS

  scrollAOfertas() {
    document
      .getElementById('seccion-ofertas')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  crearOferta(): void {
    if (!this.puedePublicarOfertas) {
      return;
    }

    this.navegarAPagina(['/crear-oferta']);
  }

  // BUSCADOR (CONECTADO A postulaciones-terna + postulantes)

  buscarPostulantes(): void {
    if (!this.puedePublicarOfertas) {
      return;
    }

    this.navegarAPagina(['/home'], {
      vista: 'buscar'
    });
  }

  actualizarFiltroCargo(valor: string) {
    this.filtroCargo = valor;

    this.textoSugerencias = valor;
    this.catalogoAbierto = true;
    if (!this.areasBusquedaDisponibles.includes(this.filtroArea)) this.filtroArea = '';
    this.solicitudBusquedaActual++;
    this.detenerBusquedaEnVivo();
    this.busquedaRealizada = false;
    this.cargandoBusquedaPostulantes = false;
    this.cargoBuscado = '';
    this.errorBusquedaPostulantes = '';
    this.postulantesBusqueda = [];
    this.postulantesBusquedaFiltrados = [];
  }

 actualizarFiltroArea(event: Event): void {
  const selector = event.target as HTMLSelectElement | null;
  this.filtroArea = selector?.value || '';
    if (this.filtroCargo && !this.cargosBusquedaDisponibles.includes(this.filtroCargo)) {
      this.actualizarFiltroCargo('');
    }
    this.catalogoAbierto = false;

  if (this.busquedaRealizada) {
    this.reconstruirBusqueda(this.solicitudBusquedaActual);
  }

  this.cdr.markForCheck();
}
  /**
   * Inicia la búsqueda en vivo. En lugar de leer las colecciones una sola
   * vez (lo que dejaba fuera a los postulantes nuevos hasta volver a
   * buscar), se escuchan 'postulaciones-terna' y 'postulantes' y la lista
   * se reconstruye cada vez que cambian.
   */
  cargarPostulantesBusqueda(): void {
    this.catalogoAbierto = false;
    if (
      !this.puedePublicarOfertas ||
      !this.isModalBusquedaPostulantesOpen ||
      this.cargandoBusquedaPostulantes
    ) {
      return;
    }

    const cargoIngresado = this.filtroCargo.trim();
    if (cargoIngresado && this.filtroArea && !this.cargosBusquedaDisponibles.some(
      nombre => this.normalizarTexto(nombre) === this.normalizarTexto(cargoIngresado)
    )) {
      void this.mostrarToast('Selecciona un cargo del área elegida.');
      return;
    }

    if (!cargoIngresado && !this.filtroArea.trim()) {
      void this.mostrarToast('Selecciona un cargo o un área laboral.');
      return;
    }

    this.detenerBusquedaEnVivo();

    const solicitud = ++this.solicitudBusquedaActual;

    this.cargandoBusquedaPostulantes = true;
    this.busquedaRealizada = false;
    this.errorBusquedaPostulantes = '';
    this.postulantesBusqueda = [];
    this.postulantesBusquedaFiltrados = [];
    this.cargoBuscado = cargoIngresado;
    this.cdr.detectChanges();

    const fallo = (error: unknown): void => {
      if (solicitud !== this.solicitudBusquedaActual) {
        return;
      }

      console.error('Error al buscar postulantes:', error);

      const codigo =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String((error as { code: unknown }).code)
          : '';

      this.detenerBusquedaEnVivo();

      this.ngZone.run(() => {
        this.postulantesBusqueda = [];
        this.postulantesBusquedaFiltrados = [];
        this.busquedaRealizada = false;
        this.cargandoBusquedaPostulantes = false;
        this.errorBusquedaPostulantes =
          codigo.includes('permission-denied')
            ? 'Tu cuenta no tiene permiso para consultar los postulantes. Revisa las reglas de acceso de Firestore.'
            : 'No fue posible consultar los postulantes en Firebase. Revisa tu conexión e inténtalo nuevamente.';
        this.cdr.detectChanges();
      });
    };

    const uidActual = this.usuarioId;
    this.cancelarBusquedaEnVivo.push(
      onSnapshot(
        query(
          collection(this.firestore, 'selecciones-cargo'),
          where('reclutadorId', '==', uidActual)
        ),
        snap => {
          if (solicitud !== this.solicitudBusquedaActual) return;
          this.seleccionesBusqueda = new Set(
            snap.docs.map(d => String(d.get('postulanteId') || ''))
          );
          this.reconstruirBusqueda(solicitud);
        },
        fallo
      )
    );
    this.cancelarBusquedaEnVivo.push(
      onSnapshot(collection(this.firestore, 'postulaciones-terna'), snap => {
        if (solicitud !== this.solicitudBusquedaActual) return;

        this.ternaDocs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        this.ternaLista = true;
        this.reconstruirBusqueda(solicitud);
      }, fallo)
    );
  }

  private comprobacionesCV = new Map<string, () => void>();
  private areasConPDF = new Map<string, string[]>();

  private tienePDF(valor: unknown): boolean {
    return typeof valor === 'string' &&
      /^(?:data:application\/pdf[^,]*;base64,)?JVBER/i.test(valor.trimStart());
  }

  private areasDelPerfil(datos: Record<string, any> | undefined): string[] {
    if (!datos || !this.tienePDF(datos['cvBase64'])) return [];

    const raiz = datos['areasInteres'];
    const areas = Array.isArray(raiz) && raiz.length
      ? raiz
      : datos['cvManual']?.areasInteres;

    return Array.isArray(areas)
      ? areas.filter(a => typeof a === 'string').map(a => this.normalizarTexto(a))
      : [];
  }

  private detenerBusquedaEnVivo() {
    this.seleccionesBusqueda = undefined;
    for (const cancelar of this.comprobacionesCV.values()) cancelar();
    this.comprobacionesCV.clear();
    this.areasConPDF.clear();
    this.cancelarBusquedaEnVivo.forEach(cancelar => cancelar());
    this.cancelarBusquedaEnVivo = [];
    this.ternaDocs = [];
    this.ternaLista = false;
  }

  private separarAreas(valor: unknown): string[] {
    return String(valor ?? '').split(',').map(area => area.trim()).filter(Boolean);
  }

  private reconstruirBusqueda(solicitud: number): void {
    if (
      !this.ternaLista ||
      !this.seleccionesBusqueda ||
      solicitud !== this.solicitudBusquedaActual
    ) return;

    const norm = (v: unknown) => this.normalizarTexto(String(v ?? ''));
    const area = norm(this.filtroArea);
    const cargo = norm(this.cargoBuscado);
    const aceptados = new Set(this.seleccionesBusqueda);

    for (const { data: d } of this.ternaDocs) {
      if (
        norm(d['estado']) === 'aceptado' &&
        (d['reclutadorId'] === this.usuarioId || d['aceptadoPor'] === this.usuarioId)
      ) {
        aceptados.add(d['postulanteId']);
      }
    }

    const ids = new Set<string>();
    const filas = new Map<string, PostulanteBusqueda>();

    for (const { id, data: d } of this.ternaDocs) {
      const uid = d['postulanteId'];
      const porcentaje = d['porcentajeIdoneidad'] ?? d['porcentaje'];
      const nombreCargo = String(d['nombreCargo'] || d['cargoNombre'] || '');
      const areas = this.separarAreas(d['areaLaboral']).map(norm);

      if (
        typeof uid !== 'string' || !uid || aceptados.has(uid) ||
        d['disponible'] !== true || norm(d['estado']) !== 'disponible' ||
        !Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100 ||
        (cargo && norm(nombreCargo) !== cargo) ||
        (area && !areas.includes(area))
      ) continue;

      ids.add(uid);

      const intereses = this.areasConPDF.get(uid) ?? [];
      const coincide = area
        ? intereses.includes(area)
        : areas.some(a => intereses.includes(a));

      if (!coincide) continue;

      // En una búsqueda por área, mostrar una sola ficha con su mejor resultado.
      if ((filas.get(uid)?.porcentajeIdoneidad ?? -1) >= porcentaje) continue;

      filas.set(uid, {
        resultadoTernaId: id,
        postulanteId: uid,
        nombres: d['nombrePostulante'] || 'Postulante',
        apellidos: '',
        correo: d['correoPostulante'] || '',
        telefono: d['telefonoPostulante'] || '',
        fotoPerfil: d['fotoPerfil'],
        cargos: [nombreCargo],
        areasLaborales: areas,
        cargosAceptados: [],
        porcentajeIdoneidad: porcentaje
      });
    }

    // Consultar únicamente las fichas de quienes ya tienen una terna coincidente.
    for (const [uid, cancelar] of this.comprobacionesCV) {
      if (!ids.has(uid)) {
        cancelar();
        this.comprobacionesCV.delete(uid);
        this.areasConPDF.delete(uid);
      }
    }

    for (const uid of ids) {
      if (this.comprobacionesCV.has(uid)) continue;

      const cancelar = onSnapshot(
        doc(this.firestore, 'postulantes', uid),
        snap => {
          if (
            solicitud !== this.solicitudBusquedaActual ||
            this.comprobacionesCV.get(uid) !== cancelar
          ) return;

          this.areasConPDF.set(uid, this.areasDelPerfil(snap.data()));
          this.reconstruirBusqueda(solicitud);
        },
        () => {
          if (this.comprobacionesCV.get(uid) !== cancelar) return;
          this.areasConPDF.set(uid, []);
          this.errorBusquedaPostulantes =
            'No se pudo comprobar el CV. Revisa la conexión y los permisos y repite la búsqueda.';
          this.reconstruirBusqueda(solicitud);
        }
      );

      this.comprobacionesCV.set(uid, cancelar);
    }

    this.ngZone.run(() => {
      this.postulantesBusquedaFiltrados = [...filas.values()].sort((a, b) =>
        b.porcentajeIdoneidad! - a.porcentajeIdoneidad! ||
        a.nombres.localeCompare(b.nombres, 'es') ||
        a.postulanteId.localeCompare(b.postulanteId)
      );

      this.postulantesBusqueda = this.postulantesBusquedaFiltrados;
      this.busquedaRealizada = true;
      this.cargandoBusquedaPostulantes = [...ids].some(
        uid => !this.areasConPDF.has(uid)
      );
      this.cdr.detectChanges();
    });
  }

  // ACEPTAR POSTULANTE DESDE BÚSQUEDA Y ENVIAR NOTIFICACIÓN

  async aceptarPostulanteDesdeBusqueda(postulante: PostulanteBusqueda) {
    const uid = this.auth.currentUser?.uid;

    if (
      !uid ||
      !this.puedePublicarOfertas ||
      !postulante.postulanteId ||
      !this.cargoBuscado.trim() ||
      !!this.aceptandoPostulanteId ||
      postulante.aceptado
    ) {
      return;
    }

    this.aceptandoPostulanteId = postulante.postulanteId;
    this.cdr.detectChanges();

    try {
      const cargoReferencia = this.cargoBuscado.trim();
      const empresaNombre = this.nombreEmpresa || 'Una empresa';
      const id = encodeURIComponent(JSON.stringify([uid, postulante.postulanteId]));
      const seleccion = doc(this.firestore, 'selecciones-cargo', id);
      const aviso = doc(collection(this.firestore, 'notificaciones'));

      await runTransaction(this.firestore, async transaccion => {
        const ref = doc(this.firestore, 'postulaciones-terna', postulante.resultadoTernaId!);
        const r = (await transaccion.get(ref)).data();
        const perfilCV = await transaccion.get(
          doc(this.firestore, 'postulantes', postulante.postulanteId)
        );
        const intereses = this.areasDelPerfil(perfilCV.data());
        const areaSeleccionada = this.normalizarTexto(this.filtroArea);
        const areasCargo = this.separarAreas(r?.['areaLaboral'])
          .map(a => this.normalizarTexto(a));

        if (
          !r || r['postulanteId'] !== postulante.postulanteId ||
          r['disponible'] !== true ||
          this.normalizarTexto(String(r['estado'] || '')) !== 'disponible' ||
          this.normalizarTexto(String(r['nombreCargo'] || r['cargoNombre'] || '')) !==
            this.normalizarTexto(cargoReferencia) ||
          !areasCargo.some(a => intereses.includes(a) && (!areaSeleccionada || a === areaSeleccionada))
        ) {
          throw Error('La candidatura dejó de estar disponible.');
        }

        const anterior = await transaccion.get(seleccion);
        if (anterior.exists()) throw Error('Selección ya registrada');
        transaccion.update(ref, {
          disponible: false, estado: 'Aceptado',
          reclutadorId: uid, fechaDecision: serverTimestamp()
        });

        transaccion.set(seleccion, {
          postulanteId: postulante.postulanteId,
          reclutadorId: uid,
          nombreCargo: cargoReferencia,
          nombreEmpresa: empresaNombre,
          nombreReclutador: this.nombreReclutador,
          estado: 'Aceptado',
          fecha: serverTimestamp()
        });

        transaccion.set(aviso, {
          postulanteId: postulante.postulanteId,
          reclutadorId: uid,
          nombreReclutador: this.nombreReclutador,
          nombreEmpresa: empresaNombre,
          cargo: cargoReferencia,
          mensaje: '¡Felicidades! ' + empresaNombre + ' ha aceptado tu perfil para el cargo de «' + cargoReferencia + '».',
          fecha: serverTimestamp(),
          leido: false,
          tipo: 'seleccionado'
        });
      });

      this.ngZone.run(() => {
        postulante.aceptado = true;
        void this.mostrarToast(
          `Postulante ${postulante.nombres} aceptado y notificación enviada.`
        );
      });
    } catch (error) {
      console.error('Error al aceptar postulante desde búsqueda:', error);
      void this.mostrarToast(
        'No se pudo aceptar al postulante. Intenta nuevamente.'
      );
    } finally {
      this.ngZone.run(() => {
        this.aceptandoPostulanteId = '';
        this.cdr.detectChanges();
      });
    }
  }

  limpiarFiltrosBusqueda() {
    this.solicitudBusquedaActual++;
    this.detenerBusquedaEnVivo();
    this.filtroCargo = '';
    this.filtroArea = '';
    this.cargoBuscado = '';
    this.busquedaRealizada = false;
    this.errorBusquedaPostulantes = '';
    this.cargandoBusquedaPostulantes = false;
    this.postulantesBusqueda = [];
    this.postulantesBusquedaFiltrados = [];
    this.cdr.detectChanges();
  }

  cerrarBusquedaPostulantes() {
    this.ir('inicio');
    this.isModalBusquedaPostulantesOpen = false;
    this.limpiarFiltrosBusqueda();
  }

  // GESTIÓN DE OFERTAS

  editarOferta(ofertaId: string): void {
    this.navegarAPagina(['/crear-oferta', ofertaId]);
  }

  continuarBorrador(oferta: OfertaTrabajo): void {
    if (!this.puedePublicarOfertas) {
      return;
    }

    this.editarOferta(oferta.id);
  }

  fechaActualizacionDe(oferta: OfertaTrabajo): Date | null {
    const ms = this.milisegundosDe(oferta.fechaActualizacion);
    return ms ? new Date(ms) : null;
  }

  private normalizarEstadoOferta(
    estado: unknown
  ): 'Activa' | 'Inactiva' | 'Borrador' {
    const valor = String(estado ?? '').trim().toLowerCase();

    if (valor === 'borrador') {
      return 'Borrador';
    }

    return valor === 'inactiva' ? 'Inactiva' : 'Activa';
  }

  private milisegundosDe(valor: any): number {
    if (!valor) {
      return 0;
    }

    if (typeof valor.toMillis === 'function') {
      return valor.toMillis();
    }

    if (valor instanceof Date) {
      return valor.getTime();
    }

    if (typeof valor.seconds === 'number') {
      return valor.seconds * 1000;
    }

    return 0;
  }

  async cambiarEstadoOferta(oferta: OfertaTrabajo) {
    if (oferta.estado === 'Borrador') {
      return;
    }

    const nuevoEstado =
      oferta.estado === 'Activa' ? 'Inactiva' : 'Activa';

    try {
      await updateDoc(
        doc(this.firestore, 'ofertas', oferta.id),
        { estado: nuevoEstado }
      );

      void this.mostrarToast(
        `Oferta marcada como ${nuevoEstado.toLowerCase()}.`
      );
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  }

  async confirmarEliminarOferta(id: string) {
    const alerta = await this.alertas.create({
      header: '¿Realmente quieres eliminar esta oferta?',
      message: 'Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Aceptar', role: 'confirm' }
      ]
    });
    await alerta.present();
    if ((await alerta.onDidDismiss()).role !== 'confirm') return;
    if (!id || !this.puedePublicarOfertas) {
      return;
    }

    try {
      const referencia = doc(this.firestore, 'ofertas', id);
      const oferta = await getDoc(referencia);

      if (oferta.data()?.['reclutadorId'] !== this.usuarioId) {
        throw new Error('Acceso no permitido');
      }

      await deleteDoc(referencia);

      void this.mostrarToast('Oferta eliminada correctamente.');
    } catch {
      void this.mostrarToast('No se pudo eliminar la oferta.');
    }
  }

  // CERRAR SESIÓN

  async cerrarSesion() {
    try {
      this.cerrarBusquedaPostulantes();
      this.limpiarSuscripcionCargos();
      this.limpiarSuscripcionOfertas();
      this.authUnsubscribe?.();
      this.authUnsubscribe = undefined;

      await signOut(this.auth);

      this.ngZone.run(() => {
        this.router.navigate(['/login']).catch(() => {
          window.location.href = '/login';
        });
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      window.location.href = '/login';
    }
  }

  // AVISOS VISUALES

  private async mostrarToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'top'
    });

    await toast.present();
  }
}