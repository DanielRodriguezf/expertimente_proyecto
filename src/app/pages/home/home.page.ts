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

            // El registro guarda ocultarAyudaInicial: false en las cuentas nuevas. Las cuentas antiguas
            // no tienen el campo, así que no ven el aviso de "primera vez".
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
            let pendientes = 0;
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data['ultimoEmisorId'] && data['ultimoEmisorId'] !== user.uid) {
                pendientes++;
              }
            });
            this.mensajesNuevosCount = pendientes;
            this.cdr.detectChanges();
          },
          () => {
            this.mensajesNuevosCount = 0;
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
  }
}