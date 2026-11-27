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
  criterios?: string;
  estadoCV?: string;
  resumenPerfil?: string[];
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
    return this.cargosCatalogoBusqueda;
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
      if (nombre && this.normalizarTexto(cargo.nombre) !== nombre) continue;
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

    this.cancelarBusquedaEnVivo.push(
      onSnapshot(
        collection(this.firestore, 'postulaciones-terna'),
        snapshot => {
          if (solicitud !== this.solicitudBusquedaActual) {
            return;
          }

          this.ternaDocs = snapshot.docs.map(documento => ({
            id: documento.id,
            data: documento.data()
          }));
          this.ternaLista = true;
          this.reconstruirBusqueda(solicitud);
        },
        fallo
      )
    );

    this.cancelarBusquedaEnVivo.push(
      onSnapshot(
        collection(this.firestore, 'postulantes'),
        snapshot => {
          if (solicitud !== this.solicitudBusquedaActual) {
            return;
          }

          const perfiles = new Map<string, Record<string, any>>();
          snapshot.docs.forEach(documento =>
            perfiles.set(documento.id, documento.data())
          );

          this.perfilesDocs = perfiles;
          this.perfilesLista = true;
          this.reconstruirBusqueda(solicitud);
        },
        fallo
      )
    );
  }

  private revisionRanking = 0;
  private textosPDF = new Map<string, Promise<string>>();

  private detenerBusquedaEnVivo(): void {
    this.revisionRanking++;
    this.textosPDF.clear();
    for (const cancelar of this.cancelarBusquedaEnVivo) {
      cancelar();
    }

    this.cancelarBusquedaEnVivo = [];
    this.ternaDocs = [];
    this.perfilesDocs = new Map();
    this.ternaLista = false;
    this.perfilesLista = false;
  }

  private reconstruirBusqueda(solicitud: number): void {
    if (
      solicitud !== this.solicitudBusquedaActual ||
      !this.ternaLista ||
      !this.perfilesLista
    ) {
      return;
    }

    const candidatos = this.construirCandidatosBusqueda();

    this.ngZone.run(() => {
      this.postulantesBusqueda = candidatos;
      this.busquedaRealizada = true;
      this.cargandoBusquedaPostulantes = false;
      this.aplicarFiltrosBusqueda();
      this.cdr.detectChanges();
    });
  }

 private construirCandidatosBusqueda(): PostulanteBusqueda[] {
  const candidatos = new Map<string, PostulanteBusqueda>();
  const cargoBuscado = this.normalizarTexto(this.cargoBuscado);
  const areaBuscada = this.normalizarTexto(this.filtroArea);

  // Primero reunimos los intereses declarados en el perfil y en el CV.
  for (const [uid, perfil] of this.perfilesDocs) {
    const cv = perfil['cvManual'] ?? {};

    const intereses = [
      perfil['cargosInteres'],
      perfil['cargosPreferencia'],
      perfil['cargos'],
      cv.cargosInteres
    ].flatMap(valor => this.resolverCargosInteres(valor));

    const areas = [
      perfil['areaInteres'],
      perfil['areasInteres'],
      cv.areaInteres,
      cv.areasInteres
    ].flatMap(valor => this.leerAreasInteres(valor));

    if (!intereses.length && !areas.length) continue;

    const candidato = this.crearCandidatoBusqueda(uid, perfil, {}, '');

    for (const area of areas) {
      this.agregarCargoACandidato(candidato, '', area);
    }

    for (const interes of intereses) {
      this.agregarCargoACandidato(
        candidato,
        interes.nombre,
        interes.areaLaboral
      );
    }

    candidatos.set(uid, candidato);
  }

  // Después incorporamos las evaluaciones guardadas en la aplicación.
  for (const { id, data } of this.ternaDocs) {
    const uid = String(data['postulanteId'] || id);
    const nombreGuardado = String(
      data['nombreCargo'] || data['cargoNombre'] || ''
    ).trim();

    const catalogo =
      this.catalogoCargosPorId.get(String(data['cargoId'] ?? '')) ||
      this.catalogoCargosPorNombre.get(this.normalizarTexto(nombreGuardado));

    const nombreCargo = catalogo?.nombre || nombreGuardado;
    const areaLaboral = String(
      data['areaLaboral'] || catalogo?.areaLaboral || ''
    ).trim();

    let candidato = candidatos.get(uid);

    if (!candidato) {
      candidato = this.crearCandidatoBusqueda(
        uid,
        this.perfilesDocs.get(uid) || {},
        data,
        ''
      );
      candidatos.set(uid, candidato);
    }

    this.agregarCargoACandidato(candidato, nombreCargo, areaLaboral);

    const nombreNormalizado = this.normalizarTexto(nombreCargo);
    const correspondeAlCargo =
      !!cargoBuscado && nombreNormalizado === cargoBuscado;

    const correspondeAlArea =
      !!areaBuscada && this.separarAreas(areaLaboral).some(
        area => this.normalizarTexto(area) === areaBuscada
      );

    const correspondeALaBusqueda = cargoBuscado
      ? correspondeAlCargo
      : correspondeAlArea;

    const porcentaje = this.porcentajeDeTerna(data);

    if (correspondeALaBusqueda && porcentaje !== undefined) {
      candidato.porcentajeEvaluacion = Math.max(
        candidato.porcentajeEvaluacion ?? 0,
        porcentaje
      );
      candidato.tieneEvaluacion = true;
    }

    if (this.normalizarTexto(String(data['estado'] ?? '')) === 'aceptado') {
      candidato.cargosAceptados.push(nombreNormalizado);
    }
  }

  return Array.from(candidatos.values());
}

  private crearCandidatoBusqueda(
    postulanteId: string,
    perfil: Record<string, any>,
    data: Record<string, any>,
    areaInicial: string
  ): PostulanteBusqueda {
    const { nombres, apellidos } = this.nombreDeCandidato(perfil, data);
    const cvPerfil = perfil['cvManual'] || {};

    return {
      postulanteId,
      nombres,
      apellidos,
      correo: String(
        perfil['correo'] ?? perfil['email'] ?? data['correoPostulante'] ?? ''
      ),
      telefono: String(
        perfil['telefono'] ?? perfil['celular'] ?? data['telefonoPostulante'] ?? ''
      ),
      fotoPerfil: String(
        perfil['fotoPerfil'] ?? data['fotoPerfil'] ?? ''
      ),
      cargos: [],
      areasLaborales: [],
      cargosAceptados: [],
      cvManual: {
        ...cvPerfil,
        nivelEducativo:
          cvPerfil.nivelEducativo || data['nivelEducativo'] || '',
        areaExperiencia: cvPerfil.areaExperiencia || areaInicial || ''
      },
      cvBase64: perfil['cvBase64'] || data['cvBase64'] || undefined,
      tieneEvaluacion: false,
      aceptado: false
    };
  }

  /**
   * Misma resolución de nombre que usa la lista de postulantes por
   * oferta (nombres/nombre y apellidos/apellidoPaterno + apellidoMaterno).
   * Antes el buscador solo leía 'nombres' y 'apellidos', y los perfiles
   * nuevos aparecían como "Candidato".
   */
  private nombreDeCandidato(
    perfil: Record<string, any>,
    data: Record<string, any>
  ): { nombres: string; apellidos: string } {
    const completo = String(data['nombrePostulante'] || '').trim();
    const partes = completo ? completo.split(' ') : [];

    const nombres = String(
      perfil['nombres'] ||
        perfil['nombre'] ||
        data['nombres'] ||
        partes[0] ||
        'Candidato'
    );

    const apellidosPerfil =
      perfil['apellidos'] ||
      [perfil['apellidoPaterno'], perfil['apellidoMaterno']]
        .filter(Boolean)
        .join(' ');

    const apellidos = String(
      apellidosPerfil ||
        data['apellidos'] ||
        partes.slice(1).join(' ') ||
        ''
    );

    return { nombres, apellidos };
  }

  /**
   * El ranking por cargo calcula el porcentaje con
   * puntajeObtenido / puntajeMaximo. El buscador solo leía
   * 'porcentajeIdoneidad' o 'porcentaje', por eso los resultados
   * nuevos salían sin porcentaje y al final de la lista.
   */
  private porcentajeDeTerna(data: Record<string, any>): number | undefined {
    for (const candidato of [data['porcentajeIdoneidad'], data['porcentaje']]) {
      if (typeof candidato === 'number' && Number.isFinite(candidato) && candidato >= 0 && candidato <= 100) {
        return candidato;
      }
    }

    const obtenido = data['puntajeObtenido'];
    const maximo = data['puntajeMaximo'];

    if (
      typeof obtenido === 'number' &&
      typeof maximo === 'number' &&
      Number.isFinite(obtenido) &&
      Number.isFinite(maximo) &&
      maximo > 0 &&
      obtenido >= 0 &&
      obtenido <= maximo
    ) {
      return (obtenido / maximo) * 100;
    }

    return undefined;
  }

 private valoresDeInteres(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(',');
  if (!raw || typeof raw !== 'object') return [];

  const objeto = raw as Record<string, unknown>;
  const claves = [
    'id', 'cargoId', 'cargo', 'nombreCargo', 'cargoNombre',
    'nombre', 'area', 'areaLaboral'
  ];

  if (claves.some(clave => clave in objeto)) {
    return [objeto];
  }

  return Object.entries(objeto).flatMap(([clave, valor]) => {
    if (valor === true) return [clave];
    if (valor === false || valor == null) return [];
    return [valor];
  });
}

private leerAreasInteres(raw: unknown): string[] {
  return this.valoresDeInteres(raw).flatMap(item => {
    if (typeof item === 'string') {
      return this.separarAreas(item);
    }

    if (!item || typeof item !== 'object') return [];

    const objeto = item as Record<string, unknown>;
    const nombre = objeto['areaLaboral'] ?? objeto['area'] ?? objeto['nombre'];

    return typeof nombre === 'string' ? this.separarAreas(nombre) : [];
  });
}

private resolverCargosInteres(raw: unknown): InfoCargo[] {
  const resultado: InfoCargo[] = [];

  for (const item of this.valoresDeInteres(raw)) {
    if (!item) continue;

    const objeto = typeof item === 'object'
      ? item as Record<string, unknown>
      : undefined;

    const id = String(
      objeto?.['cargoId'] ?? objeto?.['id'] ?? item
    ).trim();

    const nombreDirecto = String(
      objeto
        ? objeto['cargo'] ?? objeto['nombreCargo'] ??
          objeto['cargoNombre'] ?? objeto['nombre'] ?? ''
        : item
    ).trim();

    const catalogo =
      this.catalogoCargosPorId.get(id) ||
      this.catalogoCargosPorNombre.get(this.normalizarTexto(nombreDirecto));

    const nombre = catalogo?.nombre || nombreDirecto;
    const areaDeclarada = objeto?.['areaLaboral'] ?? objeto?.['area'];
    const areaLaboral = this.areaDeCargo(
      nombre,
      areaDeclarada || catalogo?.areaLaboral || ''
    );

    if (!nombre || /^[A-Za-z0-9]{20}$/.test(nombre)) {
      if (areaLaboral) resultado.push({ nombre: '', areaLaboral });
      continue;
    }

    resultado.push({ nombre, areaLaboral });
  }

  return resultado;
}

  private separarAreas(valor: unknown): string[] {
    return String(valor ?? '')
      .split(',')
      .map(parte => parte.trim())
      .filter(parte => parte !== '');
  }

  private agregarCargoACandidato(
    candidato: PostulanteBusqueda,
    nombreCargo: string,
    areaLaboral: string
  ): void {
    const nombre = nombreCargo.trim();

    if (
      nombre &&
      !candidato.cargos.some(
        cargo =>
          this.normalizarTexto(cargo) === this.normalizarTexto(nombre)
      )
    ) {
      candidato.cargos.push(nombre);
    }

    for (const area of this.separarAreas(areaLaboral)) {
      if (
        !candidato.areasLaborales.some(
          existente =>
            this.normalizarTexto(existente) === this.normalizarTexto(area)
        )
      ) {
        candidato.areasLaborales.push(area);
      }
    }
  }

  /**
   * Filtra en memoria por cargo y área, calcula el estado "aceptado"
   * solo para el cargo buscado y ordena por porcentaje de idoneidad.
   */
private async aplicarFiltrosBusqueda(): Promise<void> {
  const revision = ++this.revisionRanking;
  if (!this.busquedaRealizada) {
    this.postulantesBusquedaFiltrados = [];
    return;
  }

  const cargo = this.normalizarTexto(this.cargoBuscado);
  const area = this.normalizarTexto(this.filtroArea);

  const resultados = this.postulantesBusqueda.filter(postulante => {
    if (area) {
      return postulante.areasLaborales.some(
        valor => this.normalizarTexto(valor) === area
      );
    }

    return !!cargo && postulante.cargos.some(
      valor => this.normalizarTexto(valor).includes(cargo)
    );
  });

  for (const postulante of resultados) {
    this.puntuarPerfil(postulante, cargo, area, '');
    postulante.estadoCV = postulante.cvBase64
      ? 'Leyendo CV…'
      : 'Sin CV adjunto';
    postulante.aceptado = !!cargo && postulante.cargosAceptados.includes(cargo);
  }

  const ordenar = () => resultados.sort((a, b) => {
    const diferencia =
      (b.porcentajeIdoneidad ?? -1) - (a.porcentajeIdoneidad ?? -1);

    if (diferencia !== 0) return diferencia;

    return `${a.nombres} ${a.apellidos}`.localeCompare(
      `${b.nombres} ${b.apellidos}`,
      'es',
      { sensitivity: 'base' }
    );
  });

  this.postulantesBusquedaFiltrados = ordenar();

  // El perfil se muestra de inmediato. Si tiene PDF, se completa la ficha al leerlo.
  for (const p of resultados.slice()) {
    if (!p.cvBase64) continue;

    const texto = await this.textoDelPDF(p.cvBase64);
    if (revision !== this.revisionRanking) return;

    this.puntuarPerfil(p, cargo, area, texto);
    p.estadoCV = texto
      ? 'CV leído'
      : 'CV sin texto legible · se usaron los datos del perfil';

    this.postulantesBusquedaFiltrados = ordenar();
    this.cdr.detectChanges();
  }
}

private textoDelPDF(archivo: string): Promise<string> {
  const previo = this.textosPDF.get(archivo);
  if (previo) return previo;

  const lectura = (async () => {
    const pdfjs = await import('pdfjs-dist');

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'assets/pdfjs/pdf.worker.min.mjs',
      document.baseURI
    ).href;

    const base64 = archivo.replace(/^data:application\/pdf[^,]*,/i, '');
    const data = Uint8Array.from(atob(base64), caracter => caracter.charCodeAt(0));
    const tarea = pdfjs.getDocument({ data, isEvalSupported: false });

    try {
      const pdf = await tarea.promise;
      const paginas: string[] = [];

      for (let numero = 1; numero <= pdf.numPages; numero++) {
        const pagina = await pdf.getPage(numero);
        const contenido = await pagina.getTextContent();

        paginas.push(
          contenido.items
            .map(item => 'str' in item ? item.str : '')
            .join(' ')
        );

        pagina.cleanup();
      }

      return paginas.join(' ').trim();
    } finally {
      await tarea.destroy();
    }
  })().catch(() => '');

  this.textosPDF.set(archivo, lectura);
  return lectura;
}

private puntuarPerfil(
  p: PostulanteBusqueda,
  cargo: string,
  area: string,
  pdf: string
): void {
  const perfil = this.perfilesDocs.get(p.postulanteId) ?? {};
  const cv = { ...perfil, ...perfil['cvManual'] };

  const texto = (valor: unknown): string => {
    if (Array.isArray(valor)) {
      return valor.map(texto).filter(Boolean).join(', ');
    }

    return typeof valor === 'string' || typeof valor === 'number'
      ? String(valor).trim()
      : '';
  };

  const limpiar = (valor: string): string =>
    this.normalizarTexto(valor).replace(/[^a-z0-9]+/g, ' ').trim();

  const trabajos = Array.isArray(cv.areasExperiencia)
    ? cv.areasExperiencia
    : [];

  const evidencia = ' ' + limpiar([
    cv.carrera,
    cv.areaExperiencia,
    cv.habilidades,
    cv.habilidadesTecnicas,
    cv.resumenProfesional,
    ...trabajos.flatMap((e: any) => [e?.cargo, e?.descripcion]),
    pdf
  ].map(texto).join(' ')) + ' ';

  const contiene = (valor: string): boolean => {
    const termino = limpiar(valor);
    return !!termino && evidencia.includes(' ' + termino + ' ');
  };

  const alternativas = (valor: string): string[] =>
    valor
      .replace(/([a-z])\/([ao])\b/g, '$1')
      .split(/\s+\/\s+|,|;| y /)
      .map(parte => parte.trim())
      .filter(Boolean);

  const grupos: [string, string[]][] = [];

  if (cargo) {
    grupos.push(['Cargo', alternativas(cargo)]);
  }

  const sector = area ||
    this.catalogoCargosPorNombre.get(cargo)?.areaLaboral ||
    '';

  if (sector && limpiar(sector) !== limpiar(cargo)) {
    grupos.push(['Área laboral', alternativas(sector)]);
  }

  if (/secretaria|asistente administrativ/.test(cargo)) {
    grupos.push(
      ['Gestión de agenda', ['agenda', 'agendas', 'calendarización']],
      ['Ofimática', ['excel', 'word', 'office', 'ofimática']],
      ['Atención', [
        'atención al cliente',
        'atención de público',
        'atención telefónica',
        'recepción'
      ]]
    );
  }

  const coincidencias = grupos.filter(
    ([, palabras]) => palabras.some(contiene)
  );

  const coincideInteres = cargo
    ? p.cargos.some(valor => limpiar(valor) === limpiar(cargo))
    : p.areasLaborales.some(valor => limpiar(valor) === limpiar(area));

  const preferencia: [string, string[]] = [
    cargo ? 'Interés en el cargo' : 'Interés en el área',
    []
  ];

  grupos.push(preferencia);

  if (coincideInteres) {
    coincidencias.push(preferencia);
  }

  p.porcentajeIdoneidad = Math.round(
    100 * coincidencias.length / grupos.length
  );

  p.criterios = coincidencias.length + '/' + grupos.length +
    ' criterios con coincidencia' +
    (coincidencias.length
      ? ' · ' + coincidencias.map(([nombre]) => nombre).join(', ')
      : '');

  const datos: [string, unknown][] = [
    ['Áreas de interés', p.areasLaborales],
    ['Carrera', cv.carrera],
    ['Disponibilidad', cv.disponibilidad],
    ['Habilidades técnicas', cv.habilidadesTecnicas],
    ['Habilidades blandas', cv.habilidadesBlandas],
    ['Experiencia', experienciaVisible(cv)]
  ];

  p.resumenPerfil = datos.map(
    ([etiqueta, valor]) => etiqueta + ': ' + (texto(valor) || 'Sin registrar')
  );
}

  // ACEPTAR POSTULANTE DESDE BÚSQUEDA Y ENVIAR NOTIFICACIÓN

  async aceptarPostulanteDesdeBusqueda(postulante: PostulanteBusqueda) {
    const uid = this.auth.currentUser?.uid;

    if (
      !uid ||
      !this.puedePublicarOfertas ||
      !postulante.postulanteId ||
      !this.cargoBuscado.trim() ||
      !postulante.tieneEvaluacion ||
      postulante.aceptado
    ) {
      return;
    }

    this.aceptandoPostulanteId = postulante.postulanteId;
    this.cdr.detectChanges();

    try {
      const cargoReferencia = this.cargoBuscado.trim();
      const cargoClave = this.normalizarTexto(cargoReferencia);
      const empresaNombre = this.nombreEmpresa || 'Una empresa';

      const corresponde = (data: Record<string, any>) => {
        const cargo = this.catalogoCargosPorId.get(String(data['cargoId'] ?? ''));
        const nombre = cargo?.nombre || data['nombreCargo'] || data['cargoNombre'] || '';
        return this.normalizarTexto(nombre) === cargoClave;
      };

      const referencias = this.ternaDocs
        .filter(({ data }) => data['postulanteId'] === postulante.postulanteId && corresponde(data))
        .map(({ id }) => doc(this.firestore, 'postulaciones-terna', id));

      const aviso = doc(collection(this.firestore, 'notificaciones'));
      await runTransaction(this.firestore, async transaccion => {
        const registros = await Promise.all(referencias.map(ref => transaccion.get(ref)));
        const delCargo = registros.filter(registro => {
          const data = registro.data();
          return data && data['postulanteId'] === postulante.postulanteId && corresponde(data);
        });

        if (!delCargo.some(r => this.porcentajeDeTerna(r.data()!) !== undefined)) {
          throw new Error('Ya no hay una evaluación para este cargo.');
        }
        if (delCargo.some(r => this.normalizarTexto(String(r.get('estado') ?? '')) === 'aceptado')) {
          throw new Error('La selección ya fue registrada.');
        }

        for (const registro of delCargo) {
          transaccion.update(registro.ref, {
            estado: 'Aceptado',
            disponible: false,
            reclutadorId: uid,
            fechaDecision: serverTimestamp()
          });
        }

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