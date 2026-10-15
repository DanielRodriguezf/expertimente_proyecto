import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonSearchbar, ViewWillEnter, IonFooter,
  IonSelect, IonSelectOption, IonItem
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
  areaLaboral: string; // <-- AÑADIDO: Propiedad mapeada de Firestore
}

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  // Importamos los módulos de Select de Ionic y quitamos CommonModule (gracias a @if/@for)
  imports: [
    FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, 
    IonButtons, IonBackButton, IonCard, IonCardContent, IonIcon, 
    IonButton, IonSpinner, IonSearchbar, IonFooter, 
    IonSelect, IonSelectOption, IonItem
  ]
})
export class SearchPage implements ViewWillEnter {
  
  ofertasOriginales: Oferta[] = []; 
  ofertasFiltradas: Oferta[] = [];  
  cargando: boolean = true;

  // --- VARIABLES DE FILTROS ---
  areasLaborales: string[] = []; // Lista dinámica de áreas
  areaSeleccionada: string = '';
  terminoBusqueda: string = '';

  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); 

  constructor() {
    addIcons({
      'location-outline': locationOutline,
      'star-outline': starOutline,
      'search-outline': searchOutline
    });
  }

  ionViewWillEnter() {
    this.cargarOfertas();
  }

  cargarOfertas() {
    this.cargando = true;
    this.cdr.detectChanges(); 

    const ofertasRef = collection(this.firestore, 'ofertas');
    const q = query(ofertasRef, where('estado', '==', 'Activa'));

    onSnapshot(q, (snapshot) => {
      const ofertasTemp: Oferta[] = [];
      const areasSet = new Set<string>();
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Oferta;
        ofertasTemp.push({ ...data, id: doc.id });

        // Guardamos el área laboral si existe
        if (data.areaLaboral) {
          areasSet.add(data.areaLaboral);
        }
      });

      ofertasTemp.sort((a, b) => {
        const dateA = (a.fechaPublicacion && typeof a.fechaPublicacion.toMillis === 'function') 
                        ? a.fechaPublicacion.toMillis() : 0;
        const dateB = (b.fechaPublicacion && typeof b.fechaPublicacion.toMillis === 'function') 
                        ? b.fechaPublicacion.toMillis() : 0;
        return dateB - dateA; 
      });

      this.ofertasOriginales = ofertasTemp;
      // Convertimos el Set a Array y ordenamos alfabéticamente
      this.areasLaborales = Array.from(areasSet).sort(); 
      
      this.aplicarFiltros(); // Aplicamos filtros por si recarga manteniendo estado
      this.cargando = false; 
      this.cdr.detectChanges();

    }, (error) => {
      console.error("Error obteniendo ofertas: ", error);
      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  alEscribirBusqueda(event: any) {
    this.terminoBusqueda = (event.target.value || '').toLowerCase();
    this.aplicarFiltros();
  }

  alSeleccionarArea(event: any) {
    this.areaSeleccionada = event.detail.value || '';
    this.aplicarFiltros();
  }

  // --- LÓGICA CENTRALIZADA DE FILTRADO ---
  aplicarFiltros() {
    this.ofertasFiltradas = this.ofertasOriginales.filter((oferta) => {
      
      // 1. Condición de texto (Título o Empresa)
      const coincideTexto = this.terminoBusqueda === '' || 
        (oferta.titulo && oferta.titulo.toLowerCase().includes(this.terminoBusqueda)) || 
        (oferta.nombreEmpresa && oferta.nombreEmpresa.toLowerCase().includes(this.terminoBusqueda));

      // 2. Condición de Área Laboral
      const coincideArea = this.areaSeleccionada === '' || 
        (oferta.areaLaboral === this.areaSeleccionada);

      // Solo retorna true si pasa AMBOS filtros
      return coincideTexto && coincideArea;
    });

    this.cdr.detectChanges(); 
  }

  verDetalles(oferta: Oferta) {
    this.router.navigate(['/oferta-detalle', oferta.id]);
  }
}