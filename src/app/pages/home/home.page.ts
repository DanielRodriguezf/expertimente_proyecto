import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';

import { CommonModule } from '@angular/common';

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
  contractOutline
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
  getDocsFromServer
} from '@angular/fire/firestore';

import {
  CargoCatalogo,
  generarCatalogoCargos
} from '../cargos-catalogo/cargos-catalogo';

import {
  PerfilChatReclutadorComponent
} from './perfil-chat-reclutador.component';

import {
  RankingCargoComponent
} from './ranking-cargo.component';

import {
  ReclutadorHerramientasComponent
} from './reclutador-herramientas.component';

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

  estado: 'Activa' | 'Inactiva';

  fechaPublicacion?: any;
  reclutadorId?: string;
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
  postulanteId: string;

  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;

  fotoPerfil?: string;

  cargos: string[];
  areasLaborales: string[];

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
    RankingCargoComponent,
    ReclutadorHerramientasComponent
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private toastController = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  private navegacion?: Subscription;
  private cancelarAvisos?: () => void;
  private authUnsubscribe?: Unsubscribe;
  private snapshotUnsubscribe?: Unsubscribe;

  // Se actualiza con cada emisión de queryParamMap.
  private parametrosActuales: ParamMap =
    convertToParamMap({});

  // NAVEGACIÓN

  vista = 'inicio';
  paginaActiva = true;
  avisosSinLeer = 0;
  eliminarPendiente = '';

  // PERFIL

  nombreReclutador = '';
  nombreEmpresa = '';

  estadoReclutador:
    'aprobado' | 'pendiente' = 'pendiente';

  isLoading = true;

  // OFERTAS

  ofertas: OfertaTrabajo[] = [];

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

  cargosCatalogoBusqueda: CargoCatalogo[] =
    generarCatalogoCargos();

  filtroCargo = '';
  filtroArea = '';

  busquedaRealizada = false;
  cargoBuscado = '';
  errorBusquedaPostulantes = '';

  private solicitudBusquedaActual = 0;

  // RESPUESTAS

  isModalRespuestasOpen = false;

  postulanteRespuestasSeleccionado:
    PostulanteCompleto | null = null;

  // COMPATIBILIDAD CON REFERENCIAS ANTIGUAS DEL PROYECTO

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
      'contract-outline': contractOutline
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

        return (
          handle.charAt(0).toUpperCase() +
          handle.slice(1)
        );
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

  get puedePublicarOfertas(): boolean {
    return this.estadoReclutador === 'aprobado';
  }

  get rankingPostulantes(): PostulanteCompleto[] {
    return this.postulantesList
      .filter(postulante => {
        const tienePuntaje =
          typeof postulante.puntajeInoeidad === 'number' &&
          Number.isFinite(postulante.puntajeInoeidad);

        const sigueDisponible =
          postulante.estado === 'Pendiente';

        return tienePuntaje && sigueDisponible;
      })
      .sort((a, b) => {
        const puntajeA =
          typeof a.puntajeInoeidad === 'number'
            ? a.puntajeInoeidad
            : -1;

        const puntajeB =
          typeof b.puntajeInoeidad === 'number'
            ? b.puntajeInoeidad
            : -1;

        return puntajeB - puntajeA;
      });
  }

  get top3Postulantes(): PostulanteCompleto[] {
    return this.rankingPostulantes.slice(0, 3);
  }

  get cargosBusquedaDisponibles(): string[] {
    const nombres = [
      ...this.cargosCatalogoBusqueda.map(
        cargo => String(cargo.nombre ?? '').trim()
      ),
      ...this.postulantesBusqueda.flatMap(
        postulante => postulante.cargos
      )
    ];

    const unicos = new Map<string, string>();

    for (const nombre of nombres) {
      const clave = this.normalizarTexto(nombre);

      if (clave && !unicos.has(clave)) {
        unicos.set(clave, nombre);
      }
    }

    return Array.from(unicos.values()).sort((a, b) =>
      a.localeCompare(b, 'es', {
        sensitivity: 'base'
      })
    );
  }

  get areasBusquedaDisponibles(): string[] {
    return Array.from(
      new Set(
        this.cargosCatalogoBusqueda
          .map(cargo =>
            String(cargo.areaLaboral ?? '').trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, 'es', {
        sensitivity: 'base'
      })
    );
  }

  get postulantesBusquedaFiltrados(): PostulanteBusqueda[] {
    if (!this.busquedaRealizada) {
      return [];
    }

    const textoCargo =
      this.normalizarTexto(this.cargoBuscado);

    if (!textoCargo && !this.filtroArea) {
      return [];
    }

    return this.postulantesBusqueda.filter(postulante => {
      const coincideCargo =
        !textoCargo ||
        postulante.cargos.some(cargo =>
          this.normalizarTexto(cargo).includes(textoCargo)
        );

      const coincideArea =
        !this.filtroArea ||
        postulante.areasLaborales.some(area =>
          this.normalizarTexto(area) ===
          this.normalizarTexto(this.filtroArea)
        );

      return coincideCargo && coincideArea;
    });
  }

  // CICLO DE VIDA

  ngOnInit() {
    this.cargosCatalogoBusqueda =
      generarCatalogoCargos();

    this.navegacion = this.route.queryParamMap.subscribe(
      parametros => {
        // Usamos los parámetros recibidos.
        this.parametrosActuales = parametros;
        this.aplicarRuta(parametros);
      }
    );

    this.iniciarObservadorAuth();
  }

  ionViewWillEnter() {
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
    this.limpiarSuscripcionOfertas();

    this.solicitudBusquedaActual++;

    this.cdr.markForCheck();
  }

  ngOnDestroy() {
    this.cancelarAvisos?.();
    this.navegacion?.unsubscribe();
    this.authUnsubscribe?.();

    this.solicitudBusquedaActual++;

    this.limpiarSuscripcionOfertas();
  }

  // NAVEGACIÓN

  ir(vista: string) {
    this.router.navigate(
      ['/home'],
      {
        queryParams: {
          vista
        }
      }
    );
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
      'comentarios',
      'mensajes',
      'perfil',
      'chat'
    ];

    const solicitada =
      parametros.get('vista') || 'inicio';

    this.vista = permitidas.includes(solicitada)
      ? solicitada
      : 'inicio';

    this.isModalBusquedaPostulantesOpen =
      this.vista === 'buscar';

    this.isModalPostulantesOpen =
      this.vista === 'postulantes';

    this.isModalRespuestasOpen =
      this.vista === 'respuestas';

    if (this.vista === 'respuestas') {
      const postulacionId =
        parametros.get('postulacion');

      this.postulanteRespuestasSeleccionado =
        this.postulantesList.find(
          p => p.postulacionId === postulacionId
        ) || null;
    }

    const ofertaId = parametros.get('oferta');

    if (
      ['postulantes', 'respuestas'].includes(this.vista) &&
      ofertaId &&
      !this.cargandoPostulantes &&
      this.ofertaSeleccionada?.id !== ofertaId
    ) {
      const oferta = this.ofertas.find(
        o => o.id === ofertaId
      );

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

  private limpiarSuscripcionOfertas() {
    this.snapshotUnsubscribe?.();
    this.snapshotUnsubscribe = undefined;
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
          this.ngZone.run(() => {
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
      void getDocsFromServer(
        collection(this.firestore, 'cargos')
      )
        .then(snapshot => {
          const catalogo = generarCatalogoCargos();

          for (const documento of snapshot.docs) {
            const data = documento.data();

            if (data['nombre'] && data['areaLaboral']) {
              catalogo.push({
                nombre: String(data['nombre']),
                areaLaboral: String(data['areaLaboral'])
              });
            }
          }

          this.cargosCatalogoBusqueda = catalogo;
          this.cdr.markForCheck();
        })
        .catch(() => {});
    }

    this.cancelarAvisos?.();

    this.cancelarAvisos = onSnapshot(
      query(
        collection(
          this.firestore,
          'notificaciones-reclutador'
        ),
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
      const referencia = doc(
        this.firestore,
        'reclutadores',
        user.uid
      );

      const snapshot = await getDoc(referencia);

      let nombreEncontrado = '';
      let empresaEncontrada = '';

      if (snapshot.exists()) {
        const data = snapshot.data();
        const estadoBD = data['estado'];

        const estadoNormalizado =
          String(estadoBD ?? '')
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
          await updateDoc(referencia, {
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
            empresaEncontrada =
              this.empresasMockMap[empresaId];
          } else {
            const empresaSnapshot = await getDoc(
              doc(
                this.firestore,
                'empresas',
                empresaId
              )
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
      console.error(
        'Error al cargar datos del perfil:',
        error
      );

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
              contactoTelefono:
                data['contactoTelefono'] || '',
              estado:
                data['estado'] === 'Inactiva'
                  ? 'Inactiva'
                  : 'Activa',
              fechaPublicacion:
                data['fechaPublicacion'],
              reclutadorId:
                data['reclutadorId']
            };
          });

          this.isLoading = false;
          this.aplicarRuta();
          this.cdr.detectChanges();
        });
      },
      error => {
        console.error(
          'Error al escuchar cambios en ofertas:',
          error
        );

        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }

  // POSTULANTES DE UNA OFERTA

  async verPostulantes(
    oferta: OfertaTrabajo,
    navegar = true
  ) {
    if (
      !this.puedePublicarOfertas ||
      oferta.reclutadorId !== this.usuarioId
    ) {
      return;
    }

    this.ofertaSeleccionada = oferta;
    this.modalPostulantesFullscreen = false;
    this.mostrarRankingCompleto = false;

    if (navegar) {
      this.router.navigate(
        ['/home'],
        {
          queryParams: {
            vista: 'postulantes',
            oferta: oferta.id
          }
        }
      );
    }

    this.isModalPostulantesOpen =
      this.vista !== 'respuestas';

    this.cargandoPostulantes = true;
    this.postulantesList = [];

    this.cdr.detectChanges();

    try {
      const consulta = query(
        collection(this.firestore, 'postulaciones'),
        where('ofertaId', '==', oferta.id)
      );

      const snapshot = await getDocs(consulta);
      const postulantes: PostulanteCompleto[] = [];

      for (const documento of snapshot.docs) {
        const data = documento.data();
        const postulanteId = data['postulanteId'];

        if (!postulanteId) {
          continue;
        }

        const perfilSnapshot = await getDoc(
          doc(
            this.firestore,
            'postulantes',
            postulanteId
          )
        );

        if (!perfilSnapshot.exists()) {
          continue;
        }

        const perfil = perfilSnapshot.data();

        const apellidos =
          perfil['apellidos'] ||
          [
            perfil['apellidoPaterno'],
            perfil['apellidoMaterno']
          ]
            .filter(Boolean)
            .join(' ');

        const puntajeRaw =
          data['puntajeInoeidad'] ??
          data['puntajeIdoneidad'];

        const puntajeInoeidad =
          puntajeRaw !== undefined &&
          puntajeRaw !== null &&
          !Number.isNaN(Number(puntajeRaw))
            ? Number(puntajeRaw)
            : undefined;

        const estadoFirestore =
          String(data['estado'] ?? '')
            .trim()
            .toLowerCase();

        let estado:
          'Pendiente' | 'Aceptado' | 'Rechazado' =
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
          puntajeInoeidad,

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

          fotoPerfil:
            perfil['fotoPerfil'] || '',

          areaLaboral:
            data['areaLaboral'] ||
            oferta.areaLaboral ||
            '',

          cargoId:
            data['cargoId'] ||
            oferta.cargoId ||
            '',

          cargoNombre:
            data['cargoNombre'] ||
            oferta.cargoNombre ||
            '',

          ofertaTitulo:
            data['tituloOferta'] ||
            oferta.titulo ||
            '',

          respuestas:
            this.normalizarRespuestasCuestionario(
              data['respuestasDetalle'] ??
              data['respuestas']
            ),

          cvManual:
            perfil['cvManual'] || undefined,

          cvBase64:
            perfil['cvBase64'] || undefined
        });
      }

      postulantes.sort((a, b) => {
        const puntajeA =
          typeof a.puntajeInoeidad === 'number'
            ? a.puntajeInoeidad
            : -1;

        const puntajeB =
          typeof b.puntajeInoeidad === 'number'
            ? b.puntajeInoeidad
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

        this.cargandoPostulantes = false;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error(
        'Error al cargar postulantes:',
        error
      );

      this.ngZone.run(() => {
        this.cargandoPostulantes = false;
        this.cdr.detectChanges();
      });
    }
  }

  // CONTROLES DE POSTULANTES

  togglePantallaCompletaPostulantes() {
    this.modalPostulantesFullscreen =
      !this.modalPostulantesFullscreen;

    this.cdr.detectChanges();
  }

  toggleRankingCompleto() {
    this.mostrarRankingCompleto =
      !this.mostrarRankingCompleto;

    this.cdr.detectChanges();
  }

  verDatosPostulanteRanking(
    candidato: PostulanteCompleto
  ) {
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
        elemento.classList.remove(
          'postulante-destacado'
        );
      }, 2500);
    }, 100);
  }

  // ACEPTAR O RECHAZAR

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

      await runTransaction(
        this.firestore,
        async transaccion => {
          const ofertaSnapshot = await transaccion.get(
            doc(
              this.firestore,
              'ofertas',
              oferta.id
            )
          );

          const reclutadorSnapshot =
            await transaccion.get(
              doc(
                this.firestore,
                'reclutadores',
                uid
              )
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
            reclutadorSnapshot.data()?.['estado'] !==
              'aprobado' ||
            postulacionSnapshot.data()?.['ofertaId'] !==
              oferta.id
          ) {
            throw new Error('Acceso no permitido');
          }

          if (
            postulacionSnapshot.data()?.['estado'] ===
            nuevoEstado
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
              (
                nuevoEstado === 'Aceptado'
                  ? 'aceptada.'
                  : 'rechazada.'
              ),

            fecha: serverTimestamp(),
            leido: false,

            tipo:
              nuevoEstado === 'Aceptado'
                ? 'seleccionado'
                : 'rechazado'
          });
        }
      );

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

      void this.mostrarToast(
        'Error al procesar la solicitud.'
      );
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

    const respuestas: any[] =
      Array.isArray(respuestasRaw)
        ? respuestasRaw
        : typeof respuestasRaw === 'object'
          ? Object.values(respuestasRaw)
          : [];

    return respuestas.map(
      (item: any, index: number) => {
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
          puntajeObtenido =
            Number(puntajeExplicito);
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

          tipo:
            tipo === 'seleccion'
              ? 'seleccion'
              : 'texto',

          respuesta: respuestaTexto,
          puntajeObtenido
        };
      }
    );
  }

  verRespuestasCuestionario(
    postulante: PostulanteCompleto
  ) {
    this.postulanteRespuestasSeleccionado =
      postulante;

    this.router.navigate(
      ['/home'],
      {
        queryParams: {
          vista: 'respuestas',
          oferta: this.ofertaSeleccionada?.id,
          postulacion: postulante.postulacionId
        }
      }
    );

    this.isModalRespuestasOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModalRespuestas() {
    this.router.navigate(
      ['/home'],
      {
        queryParams: {
          vista: 'postulantes',
          oferta: this.ofertaSeleccionada?.id
        }
      }
    );

    this.isModalRespuestasOpen = false;
    this.postulanteRespuestasSeleccionado = null;

    this.cdr.detectChanges();
  }

  // CURRÍCULUM

  verCV(cvBase64: string) {
    if (!cvBase64.startsWith('data:application/pdf')) {
      void this.mostrarToast(
        'No hay un PDF válido disponible.'
      );

      return;
    }

    try {
      const binario = atob(cvBase64.split(',')[1]);

      const bytes = Uint8Array.from(
        binario,
        caracter => caracter.charCodeAt(0)
      );

      const url = URL.createObjectURL(
        new Blob(
          [bytes],
          {
            type: 'application/pdf'
          }
        )
      );

      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );

      setTimeout(
        () => URL.revokeObjectURL(url),
        60000
      );
    } catch {
      void this.mostrarToast(
        'No se pudo abrir el CV.'
      );
    }
  }

  // CERRAR VISTA DE POSTULANTES

  cerrarModalPostulantes() {
    this.ir('inicio');

    this.isModalRespuestasOpen = false;
    this.postulanteRespuestasSeleccionado = null;

    this.isModalPostulantesOpen = false;
    this.ofertaSeleccionada = null;
    this.postulantesList = [];

    this.modalPostulantesFullscreen = false;
    this.mostrarRankingCompleto = false;
  }

  // ACCESOS

  scrollAOfertas() {
    document
      .getElementById('seccion-ofertas')
      ?.scrollIntoView({
        behavior: 'smooth'
      });
  }

  crearOferta() {
    if (!this.puedePublicarOfertas) {
      return;
    }

    this.router.navigate(['/crear-oferta']);
  }

  // BUSCADOR

  buscarPostulantes() {
    this.ir('buscar');

    void getDocsFromServer(
      collection(this.firestore, 'cargos')
    )
      .then(snapshot => {
        for (const documento of snapshot.docs) {
          const data = documento.data();

          if (data['nombre'] && data['areaLaboral']) {
            this.cargosCatalogoBusqueda.push({
              nombre: String(data['nombre']),
              areaLaboral: String(data['areaLaboral'])
            });
          }
        }

        this.cdr.markForCheck();
      })
      .catch(() => {});

    if (!this.puedePublicarOfertas) {
      return;
    }

    this.limpiarFiltrosBusqueda();

    this.cargosCatalogoBusqueda =
      generarCatalogoCargos();

    this.isModalBusquedaPostulantesOpen = true;

    this.cdr.detectChanges();
  }

  actualizarFiltroCargo(valor: string) {
    this.filtroCargo = valor;
    this.busquedaRealizada = false;
    this.cargoBuscado = '';
    this.errorBusquedaPostulantes = '';
  }

  private obtenerCargosInteres(data: any): string[] {
    const principales = data['cargosInteres'];

    const origen: unknown[] =
      Array.isArray(principales)
        ? principales
        : Array.isArray(
            data['cvManual']?.cargosInteres
          )
          ? data['cvManual'].cargosInteres
          : [];

    const unicos = new Map<string, string>();

    for (const elemento of origen) {
      if (
        !elemento ||
        typeof elemento !== 'object'
      ) {
        continue;
      }

      const nombreRaw = (
        elemento as {
          cargo?: unknown;
        }
      ).cargo;

      if (typeof nombreRaw !== 'string') {
        continue;
      }

      const nombre = nombreRaw.trim();
      const clave = this.normalizarTexto(nombre);

      if (clave && !unicos.has(clave)) {
        unicos.set(clave, nombre);
      }
    }

    return Array.from(unicos.values());
  }

  async cargarPostulantesBusqueda() {
    if (
      !this.puedePublicarOfertas ||
      !this.isModalBusquedaPostulantesOpen ||
      this.cargandoBusquedaPostulantes
    ) {
      return;
    }

    const cargoIngresado =
      this.filtroCargo.trim();

    if (!cargoIngresado && !this.filtroArea) {
      void this.mostrarToast(
        'Escribe un cargo o selecciona un área.'
      );

      return;
    }

    const solicitud =
      ++this.solicitudBusquedaActual;

    this.cargandoBusquedaPostulantes = true;
    this.busquedaRealizada = false;
    this.errorBusquedaPostulantes = '';
    this.postulantesBusqueda = [];
    this.cargoBuscado = cargoIngresado;

    this.cdr.detectChanges();

    try {
      const catalogoRemoto = await getDocsFromServer(
        collection(this.firestore, 'cargos')
      );

      for (const documento of catalogoRemoto.docs) {
        const data = documento.data();

        const yaExiste =
          this.cargosCatalogoBusqueda.some(cargo =>
            this.normalizarTexto(cargo.nombre) ===
            this.normalizarTexto(data['nombre'])
          );

        if (
          data['nombre'] &&
          data['areaLaboral'] &&
          !yaExiste
        ) {
          this.cargosCatalogoBusqueda.push({
            nombre: String(data['nombre']),
            areaLaboral: String(data['areaLaboral'])
          });
        }
      }

      const areasPorId =
        new Map<string, string>();

      const areasPorNombre =
        new Map<string, string>();

      for (const cargo of this.cargosCatalogoBusqueda) {
        areasPorNombre.set(
          this.normalizarTexto(cargo.nombre),
          cargo.areaLaboral
        );
      }

      for (const documento of catalogoRemoto.docs) {
        const data = documento.data();

        if (data['areaLaboral']) {
          areasPorId.set(
            documento.id,
            String(data['areaLaboral'])
          );

          areasPorNombre.set(
            this.normalizarTexto(data['nombre']),
            String(data['areaLaboral'])
          );
        }
      }

      const snapshot = await getDocsFromServer(
        collection(this.firestore, 'postulantes')
      );

      if (
        solicitud !==
        this.solicitudBusquedaActual
      ) {
        return;
      }

      const postulantes: PostulanteBusqueda[] = [];

      for (const documento of snapshot.docs) {
        const data = documento.data();

        const cargos =
          this.obtenerCargosInteres(data);

        if (cargos.length === 0) {
          continue;
        }

        const apellidos =
          data['apellidos'] ||
          [
            data['apellidoPaterno'],
            data['apellidoMaterno']
          ]
            .filter(Boolean)
            .join(' ');

        const cvManual =
          data['cvManual'] || undefined;

        const areaExperiencia = String(
          cvManual?.areaExperiencia ?? ''
        ).trim();

        const intereses: any[] =
          Array.isArray(data['cargosInteres'])
            ? data['cargosInteres']
            : cvManual?.cargosInteres || [];

        const areasIntereses =
          intereses.map(cargo =>
            String(
              cargo?.areaLaboral ||
              areasPorId.get(cargo?.id) ||
              areasPorNombre.get(
                this.normalizarTexto(cargo?.cargo)
              ) ||
              ''
            )
          );

        postulantes.push({
          postulanteId: documento.id,

          nombres: String(
            data['nombres'] ||
            data['nombre'] ||
            'Candidato'
          ),

          apellidos: String(apellidos || ''),

          correo: String(
            data['correo'] ||
            data['email'] ||
            ''
          ),

          telefono: String(
            data['telefono'] ||
            data['celular'] ||
            ''
          ),

          fotoPerfil:
            data['fotoPerfil'] || '',

          cargos,

          areasLaborales: Array.from(
            new Set(
              [
                areaExperiencia,
                ...areasIntereses
              ].filter(Boolean)
            )
          ),

          cvManual,

          cvBase64:
            data['cvBase64'] || undefined
        });
      }

      postulantes.sort((a, b) =>
        `${a.nombres} ${a.apellidos}`
          .trim()
          .localeCompare(
            `${b.nombres} ${b.apellidos}`.trim(),
            'es',
            {
              sensitivity: 'base'
            }
          )
      );

      this.ngZone.run(() => {
        this.postulantesBusqueda = postulantes;
        this.busquedaRealizada = true;
      });
    } catch (error: unknown) {
      if (
        solicitud !==
        this.solicitudBusquedaActual
      ) {
        return;
      }

      console.error(
        'Error al buscar postulantes:',
        error
      );

      const codigo =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      this.ngZone.run(() => {
        this.postulantesBusqueda = [];
        this.busquedaRealizada = false;

        this.errorBusquedaPostulantes =
          codigo.includes('permission-denied')
            ? 'Tu cuenta no tiene permiso para consultar los postulantes. Revisa las reglas de acceso de Firestore.'
            : 'No fue posible consultar los postulantes en Firebase. Revisa tu conexión e inténtalo nuevamente.';
      });
    } finally {
      if (
        solicitud ===
        this.solicitudBusquedaActual
      ) {
        this.ngZone.run(() => {
          this.cargandoBusquedaPostulantes = false;
          this.cdr.detectChanges();
        });
      }
    }
  }

  limpiarFiltrosBusqueda() {
    this.solicitudBusquedaActual++;

    this.filtroCargo = '';
    this.filtroArea = '';
    this.cargoBuscado = '';

    this.busquedaRealizada = false;
    this.errorBusquedaPostulantes = '';
    this.cargandoBusquedaPostulantes = false;
    this.postulantesBusqueda = [];

    this.cdr.detectChanges();
  }

  cerrarBusquedaPostulantes() {
    this.ir('inicio');

    this.isModalBusquedaPostulantesOpen = false;

    this.limpiarFiltrosBusqueda();
  }

  // GESTIÓN DE OFERTAS

  editarOferta(ofertaId: string) {
    this.router.navigate([
      '/crear-oferta',
      ofertaId
    ]);
  }

  async cambiarEstadoOferta(
    oferta: OfertaTrabajo
  ) {
    const nuevoEstado =
      oferta.estado === 'Activa'
        ? 'Inactiva'
        : 'Activa';

    try {
      await updateDoc(
        doc(
          this.firestore,
          'ofertas',
          oferta.id
        ),
        {
          estado: nuevoEstado
        }
      );

      void this.mostrarToast(
        `Oferta marcada como ${nuevoEstado.toLowerCase()}.`
      );
    } catch (error) {
      console.error(
        'Error al cambiar estado:',
        error
      );
    }
  }

  confirmarEliminarOferta(ofertaId: string) {
    this.eliminarPendiente = ofertaId;
  }

  async eliminarOfertaConfirmada() {
    const id = this.eliminarPendiente;

    if (
      !id ||
      !this.puedePublicarOfertas
    ) {
      return;
    }

    try {
      const referencia = doc(
        this.firestore,
        'ofertas',
        id
      );

      const oferta = await getDoc(referencia);

      if (
        oferta.data()?.['reclutadorId'] !==
        this.usuarioId
      ) {
        throw new Error('Acceso no permitido');
      }

      await deleteDoc(referencia);

      this.eliminarPendiente = '';

      void this.mostrarToast(
        'Oferta eliminada correctamente.'
      );
    } catch {
      void this.mostrarToast(
        'No se pudo eliminar la oferta.'
      );
    }
  }

  // CERRAR SESIÓN

  async cerrarSesion() {
    try {
      this.cerrarBusquedaPostulantes();
      this.limpiarSuscripcionOfertas();

      this.authUnsubscribe?.();
      this.authUnsubscribe = undefined;

      await signOut(this.auth);

      this.ngZone.run(() => {
        this.router.navigate(['/login'])
          .catch(() => {
            window.location.href = '/login';
          });
      });
    } catch (error) {
      console.error(
        'Error al cerrar sesión:',
        error
      );

      window.location.href = '/login';
    }
  }

  // AVISOS VISUALES

  private async mostrarToast(
    mensaje: string
  ) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'top'
    });

    await toast.present();
  }
}