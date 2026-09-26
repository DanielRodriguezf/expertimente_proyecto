import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonMenuButton, IonButton, IonIcon, IonCard, IonCardContent, 
  IonFooter, IonCardHeader, IonCardTitle, IonCardSubtitle, 
  IonItem, IonLabel 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  documentTextOutline, personOutline, searchOutline, briefcaseOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, IonContent, IonHeader, IonToolbar, 
    IonTitle, IonButtons, IonMenuButton, IonButton, IonIcon, 
    IonCard, IonCardContent, IonFooter, IonCardHeader, 
    IonCardTitle, IonCardSubtitle, IonItem, IonLabel
  ]
})
export class HomePage implements OnInit {
  nombreUsuario: string = 'Cargando...'; 
  cvBase64: string = ''; 
  usuarioUID: string = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'document-text-outline': documentTextOutline,
      'person-outline': personOutline,
      'search-outline': searchOutline,
      'briefcase-outline': briefcaseOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.usuarioUID = user.uid;
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.nombreUsuario = data['nombre'] || 'Usuario'; 
            this.cvBase64 = data['cvBase64'] || ''; 
          }
          this.cdr.detectChanges();
        });
      }
    });
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