import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonCard, IonCardContent, IonIcon, IonFooter,
  IonSpinner, IonMenuButton, IonProgressBar, IonBackButton // <-- Añadido IonBackButton
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, briefcaseOutline, checkmarkCircle, 
  folderOpenOutline, businessOutline, documentTextOutline,
  callOutline, home, homeOutline, chevronBackOutline, 
  chevronForwardOutline, searchOutline // <-- Añadidos los nuevos íconos
} from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-mis-postulaciones',
  templateUrl: './mis-postulaciones.page.html',
  styleUrls: ['./mis-postulaciones.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonButton, IonCard, 
    IonCardContent, IonIcon, IonFooter, IonSpinner, IonMenuButton, 
    IonProgressBar, IonBackButton // <-- Registrado en los imports
  ]
})
export class MisPostulacionesPage implements OnInit {
  
  misPostulaciones: any[] = [];
  itemActual: any = null;
  pasoActual: number = 1;
  totalPasos: number = 1;
  cargando: boolean = true;

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Registramos todos los íconos visuales del nuevo diseño
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'briefcase-outline': briefcaseOutline,
      'checkmark-circle': checkmarkCircle,
      'folder-open-outline': folderOpenOutline,
      'business-outline': businessOutline,
      'document-text-outline': documentTextOutline,
      'call-outline': callOutline,
      'home': home,
      'home-outline': homeOutline,
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'search-outline': searchOutline
    });
  }

  ngOnInit() {
    this.cargarMisPostulaciones();
  }

  cargarMisPostulaciones() {
    const user = this.auth.currentUser;
    if (!user) {
      this.cargando = false;
      return;
    }

    this.cargando = true;
    const postulacionesRef = collection(this.firestore, 'postulaciones');
    const q = query(postulacionesRef, where('postulanteId', '==', user.uid));

    onSnapshot(q, (snapshot) => {
      const tempPosts: any[] = [];
      snapshot.forEach((doc) => {
        tempPosts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      this.misPostulaciones = tempPosts;
      this.totalPasos = this.misPostulaciones.length > 0 ? this.misPostulaciones.length : 1;
      
      if (this.pasoActual > this.totalPasos) {
        this.pasoActual = this.totalPasos;
      }
      
      this.actualizarItemActual();
      this.cargando = false;
      this.cdr.detectChanges();
    }, (error) => {
      console.error('Error cargando postulaciones:', error);
      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  actualizarItemActual() {
    if (this.misPostulaciones.length > 0) {
      this.itemActual = this.misPostulaciones[this.pasoActual - 1];
    } else {
      this.itemActual = null;
    }
  }

  siguientePaso() {
    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
      this.actualizarItemActual();
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
      this.actualizarItemActual();
    }
  }
}