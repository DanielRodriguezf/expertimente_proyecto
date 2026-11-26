import { Component, OnInit, OnDestroy, ViewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonIcon, IonButton,
  IonSpinner, IonFooter, IonTextarea,
  ToastController, Platform, NavController, ViewWillEnter, ViewWillLeave
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  chatbubblesOutline, businessOutline, personOutline, send, 
  arrowBackOutline, alertCircleOutline, timeOutline, 
  checkmarkOutline, checkmarkDoneOutline, refreshOutline, chatbubbleEllipsesOutline,
  chevronForwardOutline, checkmarkCircle, warning, closeCircle, informationCircle
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { 
  Firestore, collection, doc, query, where, orderBy, limit, 
  onSnapshot, writeBatch, serverTimestamp, Unsubscribe, Timestamp, QueryDocumentSnapshot, DocumentData 
} from '@angular/fire/firestore';

export interface Conversacion {
  id: string;
  reclutadorId: string;
  postulanteId: string;
  participantes: string[];
  nombreReclutador: string;
  nombrePostulante: string;
  nombreEmpresa: string;
  actualizadoEn: Timestamp | any;
  ultimoMensaje: string;
  ultimoEmisorId: string;
  ultimoEstado?: 'pendiente' | 'visto' | string;
}

export interface Mensaje {
  id: string;
  emisorId: string;
  texto: string;
  estado: 'pendiente' | 'visto' | string;
  creadoEn: Timestamp | any;
}

@Component({
  selector: 'app-mensajes',
  templateUrl: './mensajes.page.html',
  styleUrls: ['./mensajes.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonIcon, IonButton,
    IonSpinner, IonFooter, IonTextarea
  ]
})
export class MensajesPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  @ViewChild(IonContent) content!: IonContent;

  uid: string = '';
  
  // Estados de la Bandeja
  conversaciones: Conversacion[] = [];
  cargandoBandeja: boolean = true;
  errorBandeja: string | null = null;

  // Mapas de control de mensajes no vistos por conversación
  pendientesPorConv: Record<string, number> = {};
  enviadosPendientesPorConv: Record<string, number> = {};

  // Estados de la Conversación Activa
  conversacionActiva: Conversacion | null = null;
  mensajes: Mensaje[] = [];
  ultimoMiMensajeId: string | null = null;
  cargandoMensajes: boolean = false;
  errorMensajes: string | null = null;

  // Estados para Responder
  nuevoMensaje: string = '';
  enviando: boolean = false;
  readonly MAX_CARACTERES = 2000;

  // Suscripciones
  private unsubBandeja: Unsubscribe | null = null;
  private unsubMensajes: Unsubscribe | null = null;
  private unsubAuth: Unsubscribe | null = null;
  private unsubPendientesPorConv = new Map<string, Unsubscribe>();
  private marcandoVistoIds = new Set<string>();
  private backButtonSub: Subscription | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private platform = inject(Platform);
  private navCtrl = inject(NavController);

  constructor() {
    addIcons({
      'chatbubbles-outline': chatbubblesOutline,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
      'business-outline': businessOutline,
      'person-outline': personOutline,
      'send': send,
      'arrow-back-outline': arrowBackOutline,
      'alert-circle-outline': alertCircleOutline,
      'time-outline': timeOutline,
      'checkmark-outline': checkmarkOutline,
      'checkmark-done-outline': checkmarkDoneOutline,
      'refresh-outline': refreshOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle,
      'information-circle': informationCircle
    });
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, (user: User | null) => {
      if (user) {
        this.uid = user.uid;
        this.iniciarEscuchaBandeja();
      } else {
        this.uid = '';
        this.limpiarSuscripciones();
        this.cargandoBandeja = false;
        this.errorBandeja = 'Debes iniciar sesión para ver tus mensajes.';
        this.cdr.detectChanges();
      }
    });
  }

  ionViewWillEnter() {
    if (this.uid && !this.unsubBandeja) {
      this.iniciarEscuchaBandeja();
    }
    if (this.conversacionActiva && !this.unsubMensajes) {
      this.iniciarEscuchaMensajes(this.conversacionActiva.id);
    }
    this.registrarBotonAtrasCelular();
  }

  ionViewWillLeave() {
    this.limpiarSuscripcionesFirestore();
    this.desuscribirBotonAtrasCelular();
  }

  ngOnDestroy() {
    this.limpiarSuscripciones();
  }

  private registrarBotonAtrasCelular() {
    this.desuscribirBotonAtrasCelular();
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, () => {
      if (this.conversacionActiva) {
        this.volverABandeja();
      } else {
        this.navCtrl.navigateBack('/home');
      }
    });
  }

  private desuscribirBotonAtrasCelular() {
    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
      this.backButtonSub = null;
    }
  }

  // ==========================================
  // 3. BANDEJA DEL POSTULANTE
  // ==========================================
  iniciarEscuchaBandeja() {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    this.cargandoBandeja = true;
    this.errorBandeja = null;

    if (this.unsubBandeja) {
      this.unsubBandeja();
    }

    const convRef = collection(this.firestore, 'conversaciones');
    const q = query(
      convRef,
      where('participantes', 'array-contains', currentUser.uid)
    );

    this.unsubBandeja = onSnapshot(
      q,
      (snapshot) => {
        const lista: Conversacion[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            reclutadorId: data['reclutadorId'] || '',
            postulanteId: data['postulanteId'] || '',
            participantes: data['participantes'] || [],
            nombreReclutador: data['nombreReclutador'] || 'Reclutador',
            nombrePostulante: data['nombrePostulante'] || 'Postulante',
            nombreEmpresa: data['nombreEmpresa'] || 'Empresa Reclutadora',
            actualizadoEn: data['actualizadoEn'] || null,
            ultimoMensaje: data['ultimoMensaje'] || 'Sin mensajes aún',
            ultimoEmisorId: data['ultimoEmisorId'] || '',
            ultimoEstado: data['ultimoEstado'] || ''
          };
        });

        lista.sort((a, b) => {
          const tiempoA = this.obtenerMillis(a.actualizadoEn);
          const tiempoB = this.obtenerMillis(b.actualizadoEn);
          return tiempoB - tiempoA;
        });

        this.conversaciones = lista;
        this.cargandoBandeja = false;
        this.errorBandeja = null;

        this.sincronizarEscuchaPendientes(lista);

        if (this.conversacionActiva) {
          const actualizada = lista.find(c => c.id === this.conversacionActiva!.id);
          if (actualizada) {
            this.conversacionActiva = actualizada;
          }
        }

        const convIdParam = this.route.snapshot.queryParamMap.get('conversacionId');
        if (convIdParam && !this.conversacionActiva) {
          const encontrada = lista.find(c => c.id === convIdParam);
          if (encontrada) {
            this.seleccionarConversacion(encontrada);
          }
        }

        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error al consultar bandeja de conversaciones:', error);
        this.cargandoBandeja = false;
        this.errorBandeja = 'No pudimos cargar tus conversaciones. Verifica tu conexión e inténtalo nuevamente.';
        this.cdr.detectChanges();
      }
    );
  }

  private sincronizarEscuchaPendientes(lista: Conversacion[]) {
    const idsActuales = new Set(lista.map(c => c.id));

    this.unsubPendientesPorConv.forEach((unsub, convId) => {
      if (!idsActuales.has(convId)) {
        unsub();
        this.unsubPendientesPorConv.delete(convId);
        delete this.pendientesPorConv[convId];
        delete this.enviadosPendientesPorConv[convId];
      }
    });

    lista.forEach((conv) => {
      if (this.unsubPendientesPorConv.has(conv.id)) return;

      const mensajesRef = collection(this.firestore, `conversaciones/${conv.id}/mensajes`);
      const qPendientes = query(mensajesRef, where('estado', '==', 'pendiente'));

      const unsub = onSnapshot(
        qPendientes,
        (snap) => {
          let recibidosSinVer = 0;
          let enviadosSinVer = 0;

          snap.forEach((msgDoc) => {
            const data = msgDoc.data();
            if (data['emisorId'] && data['emisorId'] !== this.uid) {
              recibidosSinVer++;
            } else if (data['emisorId'] === this.uid) {
              enviadosSinVer++;
            }
          });

          this.pendientesPorConv[conv.id] = recibidosSinVer;
          this.enviadosPendientesPorConv[conv.id] = enviadosSinVer;
          this.cdr.detectChanges();
        },
        () => {
          this.pendientesPorConv[conv.id] = 0;
        }
      );

      this.unsubPendientesPorConv.set(conv.id, unsub);
    });
  }

  esNoLeido(conv: Conversacion): boolean {
    if (this.pendientesPorConv[conv.id] !== undefined) {
      return this.pendientesPorConv[conv.id] > 0;
    }
    return !!conv.ultimoEmisorId && conv.ultimoEmisorId !== this.uid && conv.ultimoEstado === 'pendiente';
  }

  obtenerCantidadNoLeidos(conv: Conversacion): number {
    return this.pendientesPorConv[conv.id] || 0;
  }

  ultimoMensajeFueVisto(conv: Conversacion): boolean {
    if (conv.ultimoEmisorId !== this.uid) return false;
    if (this.enviadosPendientesPorConv[conv.id] !== undefined) {
      return this.enviadosPendientesPorConv[conv.id] === 0;
    }
    return conv.ultimoEstado === 'visto';
  }

  // ==========================================
  // 4. CONVERSACIÓN (MENSAJES)
  // ==========================================
  seleccionarConversacion(conv: Conversacion) {
    this.conversacionActiva = conv;
    this.mensajes = [];
    this.ultimoMiMensajeId = null;
    this.errorMensajes = null;
    this.iniciarEscuchaMensajes(conv.id);
  }

  iniciarEscuchaMensajes(conversacionId: string) {
    if (this.unsubMensajes) {
      this.unsubMensajes();
      this.unsubMensajes = null;
    }

    this.cargandoMensajes = true;
    this.errorMensajes = null;

    const mensajesRef = collection(this.firestore, `conversaciones/${conversacionId}/mensajes`);
    const qMensajes = query(
      mensajesRef,
      orderBy('creadoEn', 'desc'),
      limit(50)
    );

    this.unsubMensajes = onSnapshot(
      qMensajes,
      (snapshot) => {
        const docsParaMarcarVisto: QueryDocumentSnapshot<DocumentData>[] = [];

        const ultimosMensajes: Mensaje[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const emisorId = data['emisorId'] || '';
          const estado = data['estado'] || 'visto';

          if (emisorId && emisorId !== this.uid && estado === 'pendiente' && !this.marcandoVistoIds.has(docSnap.id)) {
            docsParaMarcarVisto.push(docSnap);
          }

          return {
            id: docSnap.id,
            emisorId,
            texto: data['texto'] || '',
            estado,
            creadoEn: data['creadoEn'] || null
          };
        });

        this.mensajes = ultimosMensajes.reverse();

        // Identificar únicamente el último mensaje enviado por el usuario actual
        this.ultimoMiMensajeId = null;
        for (let i = this.mensajes.length - 1; i >= 0; i--) {
          if (this.mensajes[i].emisorId === this.uid) {
            this.ultimoMiMensajeId = this.mensajes[i].id;
            break;
          }
        }

        this.cargandoMensajes = false;
        this.errorMensajes = null;
        this.cdr.detectChanges();
        this.scrollAlFinal();

        if (docsParaMarcarVisto.length > 0 && this.conversacionActiva?.id === conversacionId) {
          this.marcarMensajesComoVistos(conversacionId, docsParaMarcarVisto);
        }
      },
      (error) => {
        console.error('Error al escuchar mensajes de la conversación:', error);
        this.cargandoMensajes = false;
        this.errorMensajes = 'Error al cargar los mensajes de esta conversación.';
        this.cdr.detectChanges();
      }
    );
  }

  private async marcarMensajesComoVistos(
    conversacionId: string,
    docsPendientes: QueryDocumentSnapshot<DocumentData>[]
  ) {
    try {
      const batch = writeBatch(this.firestore);

      docsPendientes.forEach((docSnap) => {
        this.marcandoVistoIds.add(docSnap.id);
        batch.update(docSnap.ref, {
          estado: 'visto'
        });
      });

      const conversacionDocRef = doc(this.firestore, `conversaciones/${conversacionId}`);
      batch.update(conversacionDocRef, {
        ultimoEstado: 'visto'
      });

      await batch.commit();
    } catch (error) {
      console.error('Error al actualizar estado de mensajes a visto:', error);
      docsPendientes.forEach((docSnap) => this.marcandoVistoIds.delete(docSnap.id));
    }
  }

  volverABandeja() {
    if (this.unsubMensajes) {
      this.unsubMensajes();
      this.unsubMensajes = null;
    }
    this.conversacionActiva = null;
    this.mensajes = [];
    this.ultimoMiMensajeId = null;
    this.errorMensajes = null;
    this.cdr.detectChanges();
  }

  // ==========================================
  // 5. RESPONDER
  // ==========================================
  get puedeEnviar(): boolean {
    const textoLimpio = this.nuevoMensaje.trim();
    return (
      !this.enviando &&
      !!this.auth.currentUser &&
      !!this.conversacionActiva &&
      textoLimpio.length > 0 &&
      textoLimpio.length <= this.MAX_CARACTERES
    );
  }

  async enviarRespuesta() {
    if (this.enviando) return;

    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      this.mostrarToast('Tu sesión ha expirado. Vuelve a iniciar sesión.', 'danger');
      return;
    }

    if (!this.conversacionActiva || !this.conversacionActiva.id) {
      this.mostrarToast('No hay una conversación activa seleccionada.', 'warning');
      return;
    }

    const textoLimpio = this.nuevoMensaje.trim();
    if (!textoLimpio) return;

    if (textoLimpio.length > this.MAX_CARACTERES) {
      this.mostrarToast(`El mensaje no puede superar los ${this.MAX_CARACTERES} caracteres.`, 'warning');
      return;
    }

    this.enviando = true;
    this.cdr.detectChanges();

    try {
      const conversacionId = this.conversacionActiva.id;
      const emisorId = currentUser.uid;

      const batch = writeBatch(this.firestore);

      const mensajesColRef = collection(this.firestore, `conversaciones/${conversacionId}/mensajes`);
      const nuevoMensajeDocRef = doc(mensajesColRef);

      batch.set(nuevoMensajeDocRef, {
        emisorId: emisorId,
        texto: textoLimpio,
        estado: 'pendiente',
        creadoEn: serverTimestamp()
      });

      const conversacionDocRef = doc(this.firestore, `conversaciones/${conversacionId}`);
      batch.update(conversacionDocRef, {
        ultimoMensaje: textoLimpio,
        ultimoEmisorId: emisorId,
        ultimoEstado: 'pendiente',
        actualizadoEn: serverTimestamp()
      });

      await batch.commit();

      this.nuevoMensaje = '';
      this.scrollAlFinal();
    } catch (error) {
      console.error('Error al enviar el mensaje:', error);
      this.mostrarToast('No se pudo enviar el mensaje. Inténtalo de nuevo.', 'danger');
    } finally {
      this.enviando = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // 6. LIMPIEZA Y UTILIDADES
  // ==========================================
  private limpiarSuscripcionesFirestore() {
    if (this.unsubBandeja) {
      this.unsubBandeja();
      this.unsubBandeja = null;
    }
    if (this.unsubMensajes) {
      this.unsubMensajes();
      this.unsubMensajes = null;
    }
    this.unsubPendientesPorConv.forEach((unsub) => unsub());
    this.unsubPendientesPorConv.clear();
  }

  private limpiarSuscripciones() {
    this.limpiarSuscripcionesFirestore();
    this.desuscribirBotonAtrasCelular();
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  private obtenerMillis(fecha: any): number {
    if (!fecha) return Date.now();
    if (typeof fecha.toMillis === 'function') return fecha.toMillis();
    if (fecha.seconds) return fecha.seconds * 1000;
    if (fecha instanceof Date) return fecha.getTime();
    return 0;
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return 'Ahora';
    let dateObj: Date;
    if (typeof fecha.toDate === 'function') {
      dateObj = fecha.toDate();
    } else if (fecha.seconds) {
      dateObj = new Date(fecha.seconds * 1000);
    } else if (fecha instanceof Date) {
      dateObj = fecha;
    } else {
      return '';
    }

    const hoy = new Date();
    const esHoy =
      dateObj.getDate() === hoy.getDate() &&
      dateObj.getMonth() === hoy.getMonth() &&
      dateObj.getFullYear() === hoy.getFullYear();

    if (esHoy) {
      return dateObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }
    return dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  }

  private scrollAlFinal() {
    setTimeout(() => {
      if (this.content && this.conversacionActiva) {
        this.content.scrollToBottom(250);
      }
    }, 100);
  }

  async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success', duracion: number = 2500) {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: duracion,
      position: 'bottom',
      color,
      icon: iconos[color] || 'information-circle',
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }
}