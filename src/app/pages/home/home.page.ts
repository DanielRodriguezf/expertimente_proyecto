import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonMenuButton, IonIcon, IonCard, IonFooter,
  IonItem, IonLabel, IonButton
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  documentTextOutline, personOutline, searchOutline, briefcaseOutline,
  chatbubblesOutline, chatbubbleEllipsesOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { 
  Firestore, doc, collection, query, where, onSnapshot, Unsubscribe 
} from '@angular/fire/firestore'; 

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, IonContent, IonHeader, IonToolbar, 
    IonTitle, IonButtons, IonMenuButton, IonIcon, 
    IonCard, IonFooter, IonItem, IonLabel, IonButton
  ]
})
export class HomePage implements OnInit, OnDestroy {
  nombreUsuario: string = ''; 
  cvBase64: string = ''; 
  usuarioUID: string = '';
  mensajesNuevosCount: number = 0;

  private unsubAuth: AuthUnsubscribe | null = null;
  private unsubPerfil: Unsubscribe | null = null;
  private unsubConversaciones: Unsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'document-text-outline': documentTextOutline,
      'person-outline': personOutline,
      'search-outline': searchOutline,
      'briefcase-outline': briefcaseOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline
    });
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, (user) => {
      this.limpiarSuscripcionesDatos();

      if (user) {
        this.usuarioUID = user.uid;

        // 1. Escuchar datos del perfil del postulante
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        this.unsubPerfil = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.nombreUsuario = data['nombre'] || 'Usuario'; 
            this.cvBase64 = data['cvBase64'] || ''; 
          }
          this.cdr.detectChanges();
        });

        // 2. Escuchar conversaciones para mostrar indicador si el último mensaje lo envió el reclutador
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

  abrirMiCV() {
    if (this.cvBase64) {
      const ventana = window.open();
      ventana?.document.write(`
        <body style="margin:0; padding:0; background-color: #333;">
          <iframe width="100%" height="100%" style="border:none;" src="${this.cvBase64}"></iframe>
        </body>
      `);
    }
  }
}