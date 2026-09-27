import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonSearchbar, ViewWillEnter 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { locationOutline, starOutline, searchOutline } from 'ionicons/icons';

import { Firestore, collection, query, where, onSnapshot } from '@angular/fire/firestore';

export interface Oferta {
  id: string;
  candidatosCount: number;
  contactoEmail: string;
  contactoTelefono: string;
  descripcion: string;
  direccion: string;
  empresaId: string;
  estado: string;
  fechaPublicacion: any;
  habilidades: string;
  modalidad: string;
  nombreEmpresa: string;
  reclutadorId: string;
  titulo: string;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, 
    IonCard, IonCardContent, IonIcon, IonButton, IonSpinner,
    IonSearchbar
  ]
})
export class SearchPage implements ViewWillEnter { // Usamos ViewWillEnter en lugar de OnInit
  
  ofertasOriginales: Oferta[] = []; 
  ofertasFiltradas: Oferta[] = [];  
  cargando: boolean = true;

  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // <-- El actualizador de pantalla infalible

  constructor() {
    addIcons({
      'location-outline': locationOutline,
      'star-outline': starOutline,
      'search-outline': searchOutline
    });
  }

  // Esto se ejecuta SIEMPRE que entras a la pantalla
  ionViewWillEnter() {
    this.cargarOfertas();
  }

  cargarOfertas() {
    this.cargando = true;
    this.cdr.detectChanges(); // Obligamos a mostrar el spinner

    const ofertasRef = collection(this.firestore, 'ofertas');
    const q = query(ofertasRef, where('estado', '==', 'Activa'));

    onSnapshot(q, (snapshot) => {
      const ofertasTemp: Oferta[] = [];
      
      snapshot.forEach((doc) => {
        ofertasTemp.push({
          id: doc.id,
          ...doc.data()
        } as Oferta);
      });

      // Ordenar por fecha (Protegido contra errores)
      ofertasTemp.sort((a, b) => {
        // Validamos que exista la fecha y tenga la función toMillis antes de usarla
        const dateA = (a.fechaPublicacion && typeof a.fechaPublicacion.toMillis === 'function') 
                        ? a.fechaPublicacion.toMillis() : 0;
        const dateB = (b.fechaPublicacion && typeof b.fechaPublicacion.toMillis === 'function') 
                        ? b.fechaPublicacion.toMillis() : 0;
        return dateB - dateA; 
      });

      this.ofertasOriginales = ofertasTemp;
      this.ofertasFiltradas = [...this.ofertasOriginales];
      this.cargando = false; 

      // ESTA LÍNEA ES LA MAGIA: Le dice a Angular "Revisa todo de nuevo y dibújalo YA"
      this.cdr.detectChanges();

    }, (error) => {
      console.error("Error obteniendo ofertas: ", error);
      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  filtrarOfertas(event: any) {
    const texto = event.target.value;

    if (!texto || texto.trim() === '') {
      this.ofertasFiltradas = [...this.ofertasOriginales];
      this.cdr.detectChanges();
      return;
    }

    const terminoBusqueda = texto.toLowerCase();

    this.ofertasFiltradas = this.ofertasOriginales.filter((oferta) => {
      const coincideTitulo = oferta.titulo ? oferta.titulo.toLowerCase().includes(terminoBusqueda) : false;
      const coincideEmpresa = oferta.nombreEmpresa ? oferta.nombreEmpresa.toLowerCase().includes(terminoBusqueda) : false;
      
      return coincideTitulo || coincideEmpresa;
    });

    this.cdr.detectChanges(); // Actualizamos la vista tras escribir
  }

    verDetalles(oferta: Oferta) {
    this.router.navigate(['/oferta-detalle', oferta.id]);
  }
}