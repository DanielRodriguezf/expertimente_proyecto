import { Injectable, inject, signal, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import {
  Firestore,
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  doc,
  setDoc,
  arrayUnion,
  arrayRemove,
  QuerySnapshot,
  DocumentData
} from '@angular/fire/firestore';

export type CategoriaAviso = 'seleccionado' | 'rechazado' | 'mensaje' | 'general';

export interface NotificacionPostulante {
  id: string;
  tipo: string;
  categoria: CategoriaAviso;
  /** 'oferta' = postulación a una oferta normal · 'terna' = perfil aceptado por cargo */
  origen: 'oferta' | 'terna';
  /** Título corto (ej. "¡Buenas noticias!") */
  titulo: string;
  /** Texto que ve el usuario (el mensaje real del documento) */
  mensaje: string;
  nombreEmpresa: string;
  /** Título de la oferta (origen 'oferta') o cargo (origen 'terna') */
  referencia: string;
  leido: boolean;
  fechaMs: number;
}

/** Canal de Android (el mismo que debe usar el push enviado desde el servidor). */
const CANAL_ID = 'expertimente_avisos';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {

  /**
   * Mantenlo en `false` para que el celular SIEMPRE lance la notificación local
   * en segundo plano aunque el servidor push no esté corriendo o falle FCM.
   */
  private readonly USAR_PUSH_SERVIDOR = false;

  /** Duración del aviso en pantalla (también la usa la barra de progreso del CSS). */
  readonly duracionAvisoMs = 6000;
  private readonly DURACION_SALIDA_MS = 260;

  /** Ruta a la que lleva el aviso (ofertas y ternas). */
  private readonly RUTA_OFERTA = '/mis-postulaciones';
  private readonly RUTA_TERNA = '/mis-postulaciones';

  private readonly MAX_DIAS_AVISO = 14;
  private readonly MAX_AVISADAS_GUARDADAS = 300;
  private readonly CLAVE_AVISADAS = 'expertimente_notif_avisadas_';

  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private uidActual: string | null = null;
  private unsub: Unsubscribe | null = null;
  private avisadas = new Set<string>();
  private tocadasDesdeSistema = new Set<string>();
  private primeraCarga = true;

  private appActiva = true;
  private listenersNativosListos = false;
  private tokenActual: string | null = null;

  private colaAvisos: NotificacionPostulante[] = [];
  private temporizadorAviso: any = null;

  private readonly _sinLeer = signal(0);
  readonly sinLeer = this._sinLeer.asReadonly();

  private readonly _avisoActivo = signal<NotificacionPostulante | null>(null);
  readonly avisoActivo = this._avisoActivo.asReadonly();

  private readonly _avisoSaliendo = signal(false);
  readonly avisoSaliendo = this._avisoSaliendo.asReadonly();

  constructor() {
    void this.vigilarEstadoApp();
  }

  /* =======================================================
     API PÚBLICA
  ======================================================= */

  iniciar(uid: string): void {
    if (this.uidActual === uid && this.unsub) return;

    this.detener();
    this.uidActual = uid;
    this.primeraCarga = true;
    this.avisadas = this.leerAvisadas(uid);

    void this.prepararDispositivo();

    const consulta = query(
      collection(this.firestore, 'notificaciones'),
      where('postulanteId', '==', uid)
    );

    this.unsub = onSnapshot(
      consulta,
      (snap) => {
        this.ngZone.run(() => this.procesarCambios(uid, snap));
      },
      (error) => console.error('[Notificaciones] Error al escuchar notificaciones:', error)
    );
  }

  detener(): void {
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
    this.limpiarTemporizador();
    this.colaAvisos = [];
    this._avisoActivo.set(null);
    this._avisoSaliendo.set(false);
    this.uidActual = null;
    this.primeraCarga = true;
    this.avisadas = new Set<string>();
    this.tocadasDesdeSistema = new Set<string>();
    this._sinLeer.set(0);
  }

  async desregistrarDispositivo(): Promise<void> {
    const uid = this.uidActual;
    const token = this.tokenActual;
    if (!uid || !token) return;

    try {
      const escritura = setDoc(
        doc(this.firestore, `postulantes/${uid}`),
        { fcmTokens: arrayRemove(token) },
        { merge: true }
      ).catch(() => undefined);

      await Promise.race([escritura, new Promise<void>((r) => setTimeout(r, 2500))]);
    } catch (e) {
      console.warn('[Notificaciones] No se pudo quitar el token del dispositivo:', e);
    }
  }

  cerrarAvisoActual(): void {
    this.limpiarTemporizador();
    if (!this._avisoActivo() || this._avisoSaliendo()) return;

    this._avisoSaliendo.set(true);

    setTimeout(() => {
      this._avisoActivo.set(null);
      this._avisoSaliendo.set(false);
      if (this.colaAvisos.length > 0) {
        setTimeout(() => this.mostrarSiguienteEnCola(), 120);
      }
    }, this.DURACION_SALIDA_MS);
  }

  abrirDestinoAviso(): void {
    const aviso = this._avisoActivo();
    this.cerrarAvisoActual();
    this.navegarA(this.destinoDe(aviso?.origen ?? 'oferta'));
  }

  /* =======================================================
     PROCESAMIENTO EN TIEMPO REAL (FIRESTORE)
  ======================================================= */

  private procesarCambios(uid: string, snap: QuerySnapshot<DocumentData>): void {
    if (this.uidActual !== uid) return;

    this._sinLeer.set(snap.docs.filter((d) => !this.estaLeida(d.data())).length);

    const limiteMs = Date.now() - this.MAX_DIAS_AVISO * 24 * 60 * 60 * 1000;
    const esCargaInicial = this.primeraCarga;
    this.primeraCarga = false;

    const nuevas: NotificacionPostulante[] = [];

    for (const cambio of snap.docChanges()) {
      if (cambio.type === 'removed') continue;

      const notif = this.aNotificacion(cambio.doc.id, cambio.doc.data());
      const clave = `${notif.id}_${notif.tipo}`;

      if (this.avisadas.has(clave) || this.avisadas.has(notif.id)) continue;
      this.avisadas.add(clave);

      if (this.tocadasDesdeSistema.has(notif.id)) continue;

      const esReciente = Date.now() - notif.fechaMs <= 2 * 60 * 1000;
      if (esCargaInicial && notif.leido && !esReciente) continue;

      if (!esCargaInicial || notif.fechaMs >= limiteMs) {
        nuevas.push(notif);
      }
    }

    this.guardarAvisadas(uid);

    if (!nuevas.length) return;

    nuevas.sort((a, b) => a.fechaMs - b.fechaMs);
    this.despachar(nuevas);
  }

  private despachar(nuevas: NotificacionPostulante[]): void {
    const lista = nuevas.length > 2 ? [this.resumir(nuevas)] : nuevas;
    const enSegundoPlano = !this.appActiva || (typeof document !== 'undefined' && document.hidden);

    for (const notif of lista) {
      if (!enSegundoPlano) {
        // App abierta en primer plano: mostrar banner superior en la app
        this.encolarAvisoEnApp(notif);
      } else if (!this.USAR_PUSH_SERVIDOR) {
        // App fuera de pantalla / minimizada: lanzar notificación del sistema Android
        void this.lanzarNotificacionSistema(notif);
      }
    }
  }

  private resumir(nuevas: NotificacionPostulante[]): NotificacionPostulante {
    const ultima = nuevas[nuevas.length - 1];
    return {
      ...ultima,
      id: 'resumen',
      categoria: 'general',
      titulo: 'Novedades en ExpertiMente',
      mensaje: `Tienes ${nuevas.length} avisos nuevos. Entra para revisarlos.`
    };
  }

  /* =======================================================
     AVISO DENTRO DE LA APP (COLA + TEMPORIZADOR)
  ======================================================= */

  private encolarAvisoEnApp(notif: NotificacionPostulante): void {
    this.colaAvisos.push(notif);
    if (!this._avisoActivo() && !this._avisoSaliendo()) {
      this.mostrarSiguienteEnCola();
    }
  }

  private mostrarSiguienteEnCola(): void {
    const siguiente = this.colaAvisos.shift() ?? null;
    this._avisoActivo.set(siguiente);
    if (!siguiente) return;

    this.limpiarTemporizador();
    this.temporizadorAviso = setTimeout(() => this.cerrarAvisoActual(), this.duracionAvisoMs);
  }

  private limpiarTemporizador(): void {
    if (this.temporizadorAviso) {
      clearTimeout(this.temporizadorAviso);
      this.temporizadorAviso = null;
    }
  }

  /* =======================================================
     TEXTOS Y CLASIFICACIÓN
  ======================================================= */

  private clasificarTipo(tipo: string): CategoriaAviso {
    if (/no[_\s-]?selecc|rechaz|descart/.test(tipo)) return 'rechazado';
    if (/selecc|acept|aprob/.test(tipo)) return 'seleccionado';
    if (/mensaj|chat|contact/.test(tipo)) return 'mensaje';
    return 'general';
  }

  private tituloDe(categoria: CategoriaAviso): string {
    switch (categoria) {
      case 'seleccionado': return '¡Buenas noticias!';
      case 'rechazado': return 'Actualización de tu postulación';
      case 'mensaje': return 'Tienes un nuevo mensaje';
      default: return 'Novedad en ExpertiMente';
    }
  }

  private mensajeRespaldo(categoria: CategoriaAviso, empresa: string, referencia: string): string {
    const de = empresa ? ` de ${empresa}` : '';
    const para = referencia ? ` («${referencia}»)` : '';
    switch (categoria) {
      case 'seleccionado': return `Avanzaron con tu perfil${de}${para}.`;
      case 'rechazado': return `Hay una actualización${de}${para}. Revisa tu historial.`;
      case 'mensaje': return `Un reclutador${de} te escribió${para}.`;
      default: return 'Tienes una novedad. Entra para revisarla.';
    }
  }

  private textoCortoTerna(
    categoria: CategoriaAviso,
    empresa: string,
    cargo: string
  ): { titulo: string; mensaje: string } | null {
    if (!cargo) return null;

    const detalle = empresa ? `${cargo} en ${empresa}` : cargo;

    if (categoria === 'seleccionado') {
      return { titulo: '¡Tu perfil fue aceptado!', mensaje: detalle };
    }
    if (categoria === 'rechazado') {
      return { titulo: 'Actualización de tu perfil', mensaje: detalle };
    }
    return null;
  }

  private destinoDe(origen: 'oferta' | 'terna'): string {
    return origen === 'terna' ? this.RUTA_TERNA : this.RUTA_OFERTA;
  }

  /* =======================================================
     NOTIFICACIONES DEL SISTEMA (ANDROID)
  ======================================================= */

  private async vigilarEstadoApp(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await App.addListener('appStateChange', ({ isActive }) => {
          this.appActiva = isActive;
        });
      }
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          this.appActiva = !document.hidden;
        });
      }
    } catch (e) {
      console.warn('[Notificaciones] No se pudo vigilar el estado de la app:', e);
    }
  }

  private async prepararDispositivo(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { /* bloqueado */ }
      }
      return;
    }

    if (!this.listenersNativosListos) {
      await this.registrarListenersNativos();
    }

    // 1. Pedir permisos de LocalNotifications primero (garantiza el permiso en Android 13+)
    try {
      let permLocal = await LocalNotifications.checkPermissions();
      if (permLocal.display === 'prompt' || permLocal.display === 'prompt-with-rationale') {
        permLocal = await LocalNotifications.requestPermissions();
      }
    } catch (e) {
      console.warn('[Notificaciones] Error al pedir permiso LocalNotifications:', e);
    }

    // 2. Crear canal de alta prioridad en Android
    try {
      await LocalNotifications.createChannel({
        id: CANAL_ID,
        name: 'Avisos de postulaciones',
        description: 'Novedades y mensajes de reclutadores',
        importance: 5,
        visibility: 1,
        vibration: true
      });
    } catch (e) {
      console.warn('[Notificaciones] No se pudo crear el canal:', e);
    }

    // 3. Registrar PushNotifications (FCM) para cuando la app esté 100% cerrada
    try {
      let permisoPush = await PushNotifications.checkPermissions();
      if (permisoPush.receive === 'prompt' || permisoPush.receive === 'prompt-with-rationale') {
        permisoPush = await PushNotifications.requestPermissions();
      }

      if (permisoPush.receive !== 'granted') {
        console.warn('[Notificaciones] Permiso Push no concedido.');
        return;
      }

      if (this.tokenActual && this.uidActual) {
        void this.guardarToken(this.uidActual, this.tokenActual);
      }

      await PushNotifications.register();
    } catch (e) {
      console.warn('[Notificaciones] Push FCM no disponible (verifica google-services.json en android/app/):', e);
    }
  }

  private async registrarListenersNativos(): Promise<void> {
    this.listenersNativosListos = true;

    try {
      await PushNotifications.addListener('registration', (token) => {
        console.log('[Notificaciones] Token FCM obtenido:', token.value);
        this.tokenActual = token.value;
        if (this.uidActual) void this.guardarToken(this.uidActual, token.value);
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[Notificaciones] Error al registrar el dispositivo en FCM:', error);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (accion) => {
        const data = accion.notification?.data ?? {};
        this.alTocarNotificacion(data['notifId'], data['destino']);
      });

      await LocalNotifications.addListener('localNotificationActionPerformed', (accion) => {
        const extra = accion.notification?.extra ?? {};
        this.alTocarNotificacion(extra['notifId'], extra['destino']);
      });
    } catch (e) {
      console.warn('[Notificaciones] No se pudieron registrar los listeners nativos:', e);
    }
  }

  private alTocarNotificacion(notifId: unknown, destino: unknown): void {
    if (typeof notifId === 'string' && notifId) {
      this.tocadasDesdeSistema.add(notifId);
    }
    const ruta = typeof destino === 'string' && destino.startsWith('/') ? destino : this.RUTA_OFERTA;
    this.navegarA(ruta);
  }

  private navegarA(ruta: string): void {
    const urlActual = this.router.url.split('?')[0];
    if (urlActual.startsWith(ruta)) return;
    this.ngZone.run(() => this.router.navigateByUrl(ruta));
  }

  private async guardarToken(uid: string, token: string): Promise<void> {
    try {
      await setDoc(
        doc(this.firestore, `postulantes/${uid}`),
        {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          fechaActualizacionToken: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[Notificaciones] No se pudo guardar el token FCM:', error);
    }
  }

  private async lanzarNotificacionSistema(notif: NotificacionPostulante): Promise<void> {
    const destino = this.destinoDe(notif.origen);

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: this.idNumerico(notif.id),
              title: notif.titulo,
              body: notif.mensaje,
              channelId: CANAL_ID,
              schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true },
              extra: { notifId: notif.id, destino }
            }
          ]
        });
      } catch (e) {
        console.warn('[Notificaciones] No se pudo mostrar la notificación local:', e);
      }
      return;
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(notif.titulo, { body: notif.mensaje, icon: 'assets/icon/favicon.png' });
        n.onclick = () => {
          window.focus();
          this.navegarA(destino);
        };
      } catch { /* entorno sin soporte */ }
    }
  }

  private idNumerico(texto: string): number {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      hash = (hash * 31 + texto.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 2147483000;
  }

  /* =======================================================
     UTILIDADES Y ALMACENAMIENTO LOCAL
  ======================================================= */

  private estaLeida(data: DocumentData): boolean {
    return data?.['leido'] === true || data?.['leida'] === true;
  }

  private aNotificacion(id: string, data: DocumentData): NotificacionPostulante {
    const fecha = data?.['fecha'];
    let fechaMs = Date.now();

    if (fecha && typeof fecha.toMillis === 'function') {
      fechaMs = fecha.toMillis();
    } else if (fecha instanceof Date) {
      fechaMs = fecha.getTime();
    } else if (typeof fecha === 'string' && !isNaN(Date.parse(fecha))) {
      fechaMs = Date.parse(fecha);
    }

    const tipo = String(data?.['tipo'] ?? '').toLowerCase().trim();
    const categoria = this.clasificarTipo(tipo);

    const origen: 'oferta' | 'terna' =
      !data?.['ofertaId'] && (data?.['cargo'] || data?.['reclutadorId']) ? 'terna' : 'oferta';

    const nombreEmpresa = String(data?.['nombreEmpresa'] ?? '').trim();
    const referencia = String(
      (origen === 'terna' ? data?.['cargo'] : data?.['tituloOferta']) ?? ''
    ).trim();

    const mensaje =
      String(data?.['mensaje'] ?? '').trim() ||
      this.mensajeRespaldo(categoria, nombreEmpresa, referencia);

    const corto = origen === 'terna'
      ? this.textoCortoTerna(categoria, nombreEmpresa, referencia)
      : null;

    return {
      id,
      tipo,
      categoria,
      origen,
      titulo: corto?.titulo ?? this.tituloDe(categoria),
      mensaje: corto?.mensaje ?? mensaje,
      nombreEmpresa,
      referencia,
      leido: this.estaLeida(data),
      fechaMs
    };
  }

  private leerAvisadas(uid: string): Set<string> {
    try {
      const crudo = typeof localStorage !== 'undefined'
        ? localStorage.getItem(this.CLAVE_AVISADAS + uid)
        : null;
      const lista = crudo ? JSON.parse(crudo) : [];
      return new Set<string>(Array.isArray(lista) ? lista.map(String) : []);
    } catch {
      return new Set<string>();
    }
  }

  private guardarAvisadas(uid: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const recientes = Array.from(this.avisadas).slice(-this.MAX_AVISADAS_GUARDADAS);
      localStorage.setItem(this.CLAVE_AVISADAS + uid, JSON.stringify(recientes));
    } catch {
      // Sin acceso a localStorage
    }
  }
}