import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonMenuButton, IonIcon, IonCard,
  IonItem, IonLabel, IonButton, ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  documentTextOutline, searchOutline, briefcaseOutline,
  chatbubblesOutline, chatbubbleEllipsesOutline, sparklesOutline,
  chevronForwardOutline, ribbonOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import {
  Firestore, doc, collection, query, where, onSnapshot, updateDoc, Unsubscribe
} from '@angular/fire/firestore';
import { Help } from '../../components/help/help.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, IonContent, IonHeader, IonToolbar,
    IonTitle, IonButtons, IonMenuButton, IonIcon,
    IonCard, IonItem, IonLabel, IonButton,
    Help
  ]
})
export class HomePage implements OnInit, OnDestroy {
  nombreUsuario: string = '';
  usuarioUID: string = '';
  mensajesNuevosCount: number = 0;
  mostrarBannerAyuda: boolean = false;

  private unsubAuth: AuthUnsubscribe | null = null;
  private unsubPerfil: Unsubscribe | null = null;
  private unsubConversaciones: Unsubscribe | null = null;
  private unsubPendientesPorConv = new Map<string, Unsubscribe>();
  private conteoPendientesPorConv = new Map<string, number>();

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({
      'document-text-outline': documentTextOutline,
      'search-outline': searchOutline,
      'briefcase-outline': briefcaseOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
      'sparkles-outline': sparklesOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'ribbon-outline': ribbonOutline
    });
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, (user) => {
      this.limpiarSuscripcionesDatos();

      if (user) {
        this.usuarioUID = user.uid;

        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        this.unsubPerfil = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.nombreUsuario = data['nombre'] || 'Usuario';

            const esCuentaNueva = data['ocultarAyudaInicial'] === false;
            const ocultoRemoto = data['ocultarAyudaInicial'] === true;
            const ocultoLocal = this.ayudaOcultaLocal(user.uid);

            if (ocultoRemoto && !ocultoLocal) {
              this.guardarAyudaOcultaLocal(user.uid);
            }

            this.mostrarBannerAyuda = esCuentaNueva && !ocultoLocal;
          } else {
            this.mostrarBannerAyuda = false;
          }
          this.cdr.detectChanges();
        });

        const convRef = collection(this.firestore, 'conversaciones');
        const qConv = query(convRef, where('participantes', 'array-contains', user.uid));
        this.unsubConversaciones = onSnapshot(
          qConv,
          (snapshot) => {
            const idsActuales = new Set<string>();

            snapshot.forEach((docSnap) => {
              const convId = docSnap.id;
              idsActuales.add(convId);

              if (!this.unsubPendientesPorConv.has(convId)) {
                const mensajesRef = collection(this.firestore, `conversaciones/${convId}/mensajes`);
                const qPendientes = query(mensajesRef, where('estado', '==', 'pendiente'));

                const unsubMsg = onSnapshot(
                  qPendientes,
                  (msgSnap) => {
                    let sinVerEnConv = 0;
                    msgSnap.forEach((msgDoc) => {
                      const msgData = msgDoc.data();
                      if (msgData['emisorId'] && msgData['emisorId'] !== user.uid) {
                        sinVerEnConv++;
                      }
                    });
                    this.conteoPendientesPorConv.set(convId, sinVerEnConv);
                    this.recalcularTotalMensajesNuevos();
                  },
                  () => {
                    this.conteoPendientesPorConv.set(convId, 0);
                    this.recalcularTotalMensajesNuevos();
                  }
                );

                this.unsubPendientesPorConv.set(convId, unsubMsg);
              }
            });

            // Limpiar conversaciones eliminadas
            this.unsubPendientesPorConv.forEach((unsub, convId) => {
              if (!idsActuales.has(convId)) {
                unsub();
                this.unsubPendientesPorConv.delete(convId);
                this.conteoPendientesPorConv.delete(convId);
              }
            });

            this.recalcularTotalMensajesNuevos();
          },
          () => {
            this.mensajesNuevosCount = 0;
            this.cdr.detectChanges();
          }
        );
      } else {
        this.usuarioUID = '';
        this.nombreUsuario = '';
        this.mensajesNuevosCount = 0;
        this.mostrarBannerAyuda = false;
        this.cdr.detectChanges();
      }
    });
  }

  private recalcularTotalMensajesNuevos() {
    let total = 0;
    this.conteoPendientesPorConv.forEach((cantidad) => {
      total += cantidad;
    });
    this.mensajesNuevosCount = total;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.limpiarSuscripcionesDatos();
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  async ocultarAyudaParaSiempre() {
    this.mostrarBannerAyuda = false;
    this.cdr.detectChanges();

    if (this.usuarioUID) {
      this.guardarAyudaOcultaLocal(this.usuarioUID);
      try {
        const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
        await updateDoc(docRef, { ocultarAyudaInicial: true });
      } catch (err) {
        console.warn('No se pudo sincronizar ocultarAyudaInicial en Firestore:', err);
      }
    }

    const toast = await this.toastCtrl.create({
      message: 'Aviso ocultado. Siempre podrás abrir la Ayuda desde el menú principal (☰).',
      duration: 3800,
      position: 'bottom',
      color: 'success',
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }

  private obtenerClaveAyuda(uid: string): string {
    return `expertimente_ayuda_oculta_${uid}`;
  }

  private ayudaOcultaLocal(uid: string): boolean {
    try {
      return localStorage.getItem(this.obtenerClaveAyuda(uid)) === 'true';
    } catch {
      return false;
    }
  }

  private guardarAyudaOcultaLocal(uid: string) {
    try {
      localStorage.setItem(this.obtenerClaveAyuda(uid), 'true');
    } catch {
      // Sin almacenamiento local: igual queda guardado en Firestore
    }
  }

  private limpiarSuscripcionesDatos() {
    if (this.unsubPerfil) {
      this.unsubPerfil();
      this.unsubPerfil = null;
    }
    if (this.unsubConversaciones) {
      this.unsubConversaciones();
      this.unsubConversaciones = null;
    }
    this.unsubPendientesPorConv.forEach((unsub) => unsub());
    this.unsubPendientesPorConv.clear();
    this.conteoPendientesPorConv.clear();
  }
}