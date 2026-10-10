import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonCard, IonCardContent, IonIcon, IonFooter,
  IonSpinner, IonProgressBar, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, briefcaseOutline, checkmarkCircle, 
  folderOpenOutline, businessOutline, documentTextOutline,
  callOutline, home, homeOutline, chevronBackOutline, 
  chevronForwardOutline, searchOutline, 
  closeCircleOutline, informationCircle // <-- Íconos faltantes importados
} from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot, doc, updateDoc } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-mis-postulaciones',
  templateUrl: './mis-postulaciones.page.html',
  styleUrls: ['./mis-postulaciones.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonButton, IonCard, 
    IonCardContent, IonIcon, IonFooter, IonSpinner,
    IonProgressBar, IonBackButton, IonSegment, IonSegmentButton, IonLabel
  ]
})
export class MisPostulacionesPage implements OnInit {
  
  misPostulaciones: any[] = [];
  postulacionesFiltradas: any[] = []; 
  filtroActual: string = 'revision';  

  itemActual: any = null;
  pasoActual: number = 1;
  totalPasos: number = 1;
  cargando: boolean = true;

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
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
      'search-outline': searchOutline,
      'close-circle-outline': closeCircleOutline, // <-- Registrado para rechazadas
      'information-circle': informationCircle // <-- Registrado para notificaciones
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
      this.aplicarFiltro(); 
      
      this.cargando = false;
      this.cdr.detectChanges();
    }, (error) => {
      console.error('Error cargando postulaciones:', error);
      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  aplicarFiltro() {
    this.postulacionesFiltradas = this.misPostulaciones.filter(p => {
      const estado = p.estado ? p.estado.toLowerCase() : '';

      if (this.filtroActual === 'revision') {
        return estado.includes('enviada') || estado.includes('revisión') || estado.includes('revision');
      }
      if (this.filtroActual === 'aceptadas') {
        return estado.includes('aceptad'); 
      }
      if (this.filtroActual === 'rechazadas') {
        return estado.includes('rechazad'); 
      }
      return false;
    });

    this.totalPasos = this.postulacionesFiltradas.length > 0 ? this.postulacionesFiltradas.length : 1;
    this.pasoActual = 1;
    this.actualizarItemActual();
  }

  segmentChanged(event: any) {
    this.filtroActual = event.detail.value;
    this.aplicarFiltro();
  }

  async actualizarItemActual() {
    if (this.postulacionesFiltradas.length > 0) {
      this.itemActual = this.postulacionesFiltradas[this.pasoActual - 1];

      if (this.itemActual && this.itemActual.leido === false) {
        try {
          const docRef = doc(this.firestore, `postulaciones/${this.itemActual.id}`);
          await updateDoc(docRef, { leido: true });
          
          this.itemActual.leido = true; 
        } catch(error) {
          console.error('Error al actualizar leido:', error);
        }
      }
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