import { Injectable, inject, signal, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  doc,
  setDoc,
  arrayUnion
} from '@angular/fire/firestore';

export interface NotificacionPostulante {
  id: string;
  tipo: string;
  categoria: 'seleccionado' | 'rechazado' | 'mensaje' | 'general';
  tituloGeneralizado: string;
  mensajeGeneralizado: string;
  mensajeOriginal: string;
  nombreEmpresa: string;
  tituloOferta: string;
  ofertaId: string;
  leido: boolean;
  fechaMs: number;
}

/**
 * Servicio global de notificaciones para el postulante.
 * - Dentro de la app: muestra un banner especial superior en cualquier página.
 * - Fuera de la app: lanza una notificación del sistema (LocalNotifications / Push FCM)
 *   y guarda el token FCM del dispositivo en `postulantes/{uid}`.
 * - No modifica el campo `leido` en Firestore para no interferir con "Mis Postulaciones".
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {

  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  /** Ruta a la que lleva al tocar la notificación o el botón "Ver". */
  private readonly RUTA_DESTINO = '/mis-postulaciones';
  /** Ventana máxima para considerar una notificación sin leer como reciente al abrir la app. */
  private readonly MAX_DIAS_AVISO = 14;
  private readonly MAX_AVISADAS_GUARDADAS = 300;
  private readonly CLAVE_AVISADAS = 'expertimente_notif_avisadas_';

  private uidActual: string | null = null;
  private unsub: Unsubscribe | null = null;
  private avisadas = new Set<string>();
  private primeraCarga = true;
  private pushInicializado = false;

  private colaAvisos: NotificacionPostulante[] = [];
  private temporizadorAviso: any = null;

  private readonly _sinLeer = signal(0);
  /** Cantidad de notificaciones con `leido == false`. */
  readonly sinLeer = this._sinLeer.asReadonly();

  private readonly _avisoActivo = signal<NotificacionPostulante | null>(null);
  /** Notificación especial visible actualmente en la parte superior de la app. */
  readonly avisoActivo = this._avisoActivo.asReadonly();

  /** Inicia la escucha global y el registro Push cuando el postulante está autenticado. */
  iniciar(uid: string): void {
    if (this.uidActual === uid && this.unsub) return;

    this.detener();
    this.uidActual = uid;
    this.primeraCarga = true;
    this.avisadas = this.leerAvisadas(uid);

    void this.configurarNotificacionesNativas(uid);

    const consulta = query(
      collection(this.firestore, 'notificaciones'),
      where('postulanteId', '==', uid)
    );

    this.unsub = onSnapshot(
      consulta,
      (snap) => {
        this.ngZone.run(() => {
          this.procesarCambios(uid, snap);
        });
      },
      (error) => console.error('[Notificaciones] Error al escuchar notificaciones:', error)
    );
  }

  /** Detiene la escucha al cerrar sesión. */
  detener(): void {
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
    this.limpiarTemporizador();
    this.colaAvisos = [];
    this._avisoActivo.set(null);
    this.uidActual = null;
    this.primeraCarga = true;
    this.avisadas = new Set<string>();
    this._sinLeer.set(0);
  }

  /** Cierra manualmente el banner especial superior y pasa al siguiente si hay en cola. */
  cerrarAvisoActual(): void {
    this.limpiarTemporizador();
    this._avisoActivo.set(null);

    if (this.colaAvisos.length > 0) {
      setTimeout(() => this.mostrarSiguienteEnCola(), 280);
    }
  }

  /** Abre la sección correspondiente al tocar "Ver" en el banner especial. */
  abrirDestinoAviso(): void {
    this.cerrarAvisoActual();
    const urlActual = this.router.url.split('?')[0];
    if (!urlActual.startsWith(this.RUTA_DESTINO)) {
      this.router.navigateByUrl(this.RUTA_DESTINO);
    }
  }

  /* =======================================================
     PROCESAMIENTO EN TIEMPO REAL (FIRESTORE)
  ======================================================= */

  private procesarCambios(uid: string, snap: any): void {
    if (this.uidActual !== uid) return;

    this._sinLeer.set(snap.docs.filter((d: any) => !this.estaLeida(d.data())).length);

    const limiteMs = Date.now() - this.MAX_DIAS_AVISO * 24 * 60 * 60 * 1000;
    const nuevas: NotificacionPostulante[] = [];
    const esCargaInicial = this.primeraCarga;
    this.primeraCarga = false;

    for (const cambio of snap.docChanges()) {
      if (cambio.type === 'removed') continue;

      const notificacion = this.aNotificacion(cambio.doc.id, cambio.doc.data());
      const claveUnica = `${notificacion.id}_${notificacion.tipo}`;

      if (this.avisadas.has(claveUnica) || this.avisadas.has(notificacion.id)) {
        continue;
      }

      // En la primera carga al abrir la app:
      // - Si ya figura como leída, la registramos como vista para no alertar cosas antiguas,
      //   salvo que haya sido creada hace menos de 2 minutos.
      const esRecienCreada = (Date.now() - notificacion.fechaMs) <= 2 * 60 * 1000;

      if (esCargaInicial && notificacion.leido && !esRecienCreada) {
        this.avisadas.add(claveUnica);
        continue;
      }

      this.avisadas.add(claveUnica);

      if (!esCargaInicial || notificacion.fechaMs >= limiteMs) {
        nuevas.push(notificacion);
      }
    }

    this.guardarAvisadas(uid);

    if (!nuevas.length) return;

    nuevas.sort((a, b) => a.fechaMs - b.fechaMs);
    this.despacharNotificaciones(nuevas);
  }

  private despacharNotificaciones(nuevas: NotificacionPostulante[]): void {
    const appEnSegundoPlano = typeof document !== 'undefined' && document.hidden;

    // Si hay más de 2 acumuladas de golpe, las resumimos en un solo aviso generalizado
    const listaParaMostrar: NotificacionPostulante[] = nuevas.length > 2
      ? [{
          ...nuevas[nuevas.length - 1],
          categoria: 'general',
          tituloGeneralizado: 'Novedades en tus postulaciones 🔔',
          mensajeGeneralizado: `Tienes ${nuevas.length} actualizaciones nuevas de reclutadores. Entra para revisarlas.`
        }]
      : nuevas;

    for (const notif of listaParaMostrar) {
      // 1. Mostrar siempre en el banner especial dentro de la app
      this.encolarAvisoEnApp(notif);

      // 2. Si el postulante está fuera de la app (minimizada / pantalla apagada),
      //    lanzar también la notificación nativa en la barra del sistema operativo.
      if (appEnSegundoPlano) {
        void this.lanzarNotificacionSistema(notif);
      }
    }
  }

  private encolarAvisoEnApp(notificacion: NotificacionPostulante): void {
    this.colaAvisos.push(notificacion);
    if (!this._avisoActivo()) {
      this.mostrarSiguienteEnCola();
    }
  }

  private mostrarSiguienteEnCola(): void {
    const siguiente = this.colaAvisos.shift() || null;
    this._avisoActivo.set(siguiente);

    if (!siguiente) return;

    this.limpiarTemporizador();
    this.temporizadorAviso = setTimeout(() => {
      this.ngZone.run(() => {
        this.cerrarAvisoActual();
      });
    }, 7000);
  }

  private limpiarTemporizador(): void {
    if (this.temporizadorAviso) {
      clearTimeout(this.temporizadorAviso);
      this.temporizadorAviso = null;
    }
  }

  /* =======================================================
     TEXTOS GENERALIZADOS SEGÚN EL TIPO DE EVENTO
  ======================================================= */

  private clasificarTipo(tipo: string): 'seleccionado' | 'rechazado' | 'mensaje' | 'general' {
    if (/selecc|acept|aprob/.test(tipo)) return 'seleccionado';
    if (/rechaz|descart|no_selecc/.test(tipo)) return 'rechazado';
    if (/mensaj|chat|contact/.test(tipo)) return 'mensaje';
    return 'general';
  }

  private generarTextosGeneralizados(
    categoria: 'seleccionado' | 'rechazado' | 'mensaje' | 'general'
  ): { titulo: string; mensaje: string } {
    switch (categoria) {
      case 'seleccionado':
        return {
          titulo: '¡Buenas noticias en tu postulación! 🎉',
          mensaje: 'Un reclutador ha avanzado con tu perfil en una oferta laboral. Entra para ver los detalles.'
        };
      case 'rechazado':
        return {
          titulo: 'Actualización de tu postulación 📋',
          mensaje: 'El estado de una de tus postulaciones ha sido actualizado. Revisa tu historial para más información.'
        };
      case 'mensaje':
        return {
          titulo: 'Tienes un nuevo mensaje 💬',
          mensaje: 'Un reclutador se ha puesto en contacto contigo. Abre la aplicación para leerlo.'
        };
      default:
        return {
          titulo: 'Nueva actualización laboral 🔔',
          mensaje: 'Tienes una novedad sobre tus postulaciones en ExpertiMente. Entra para revisarla.'
        };
    }
  }

  /* =======================================================
     NOTIFICACIONES FUERA DE LA APP (CAPACITOR / ANDROID)
  ======================================================= */

  private async configurarNotificacionesNativas(uid: string): Promise<void> {
    const cap = (window as any).Capacitor;
    const esNativo = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());

    // 1. Permisos para notificaciones del navegador / WebView si aplica
    if (!esNativo && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignorar si el navegador bloquea la solicitud automática
      }
    }

    if (!esNativo) return;

    const LocalNotifications = cap.Plugins?.LocalNotifications;
    const PushNotifications = cap.Plugins?.PushNotifications;

    // 2. Configurar LocalNotifications (para segundo plano)
    if (LocalNotifications) {
      try {
        await LocalNotifications.requestPermissions();

        if (!this.pushInicializado) {
          await LocalNotifications.addListener('localNotificationActionPerformed', () => {
            this.ngZone.run(() => {
              this.router.navigateByUrl(this.RUTA_DESTINO);
            });
          });
        }
      } catch (e) {
        console.warn('[Notificaciones] LocalNotifications no disponible:', e);
      }
    }

    // 3. Configurar PushNotifications con FCM (usa tu google-services.json)
    if (PushNotifications) {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          if (!this.pushInicializado) {
            await PushNotifications.addListener('registration', async (token: { value: string }) => {
              if (token?.value && this.uidActual) {
                await this.guardarTokenFcm(this.uidActual, token.value);
              }
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', () => {
              this.ngZone.run(() => {
                this.router.navigateByUrl(this.RUTA_DESTINO);
              });
            });
          }

          await PushNotifications.register();
        }
      } catch (e) {
        console.warn('[Notificaciones] PushNotifications no disponible:', e);
      }
    }

    this.pushInicializado = true;
  }

  private async guardarTokenFcm(uid: string, token: string): Promise<void> {
    try {
      const postulanteRef = doc(this.firestore, `postulantes/${uid}`);
      await setDoc(
        postulanteRef,
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
    const cap = (window as any).Capacitor;
    const LocalNotifications = cap?.Plugins?.LocalNotifications;

    if (LocalNotifications) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 2147483000),
              title: notif.tituloGeneralizado,
              body: notif.mensajeGeneralizado,
              schedule: { at: new Date(Date.now() + 250) },
              extra: { ruta: this.RUTA_DESTINO, ofertaId: notif.ofertaId }
            }
          ]
        });
        return;
      } catch (e) {
        console.warn('[Notificaciones] Fallback a Notification API:', e);
      }
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(notif.tituloGeneralizado, {
          body: notif.mensajeGeneralizado,
          icon: 'assets/icon/favicon.png'
        });
        n.onclick = () => {
          window.focus();
          this.ngZone.run(() => {
            this.router.navigateByUrl(this.RUTA_DESTINO);
          });
        };
      } catch {
        // Ignorar en entornos sin soporte de Notification constructor
      }
    }
  }

  /* =======================================================
     UTILIDADES Y ALMACENAMIENTO LOCAL
  ======================================================= */

  private estaLeida(data: any): boolean {
    return data?.['leido'] === true || data?.['leida'] === true;
  }

  private aNotificacion(id: string, data: any): NotificacionPostulante {
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
    const generalizados = this.generarTextosGeneralizados(categoria);

    return {
      id,
      tipo,
      categoria,
      tituloGeneralizado: generalizados.titulo,
      mensajeGeneralizado: generalizados.mensaje,
      mensajeOriginal: String(data?.['mensaje'] ?? '').trim(),
      nombreEmpresa: String(data?.['nombreEmpresa'] ?? '').trim(),
      tituloOferta: String(data?.['tituloOferta'] ?? '').trim(),
      ofertaId: String(data?.['ofertaId'] ?? '').trim(),
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