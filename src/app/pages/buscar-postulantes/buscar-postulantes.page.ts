import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  IonContent,
  IonSearchbar,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonBadge,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { arrowBackOutline, searchOutline, briefcaseOutline } from 'ionicons/icons';

// IMPORTACIÓN DEL NUEVO SERVICIO (Ajusta la ruta según tu estructura)
import { CalculoIdoneidadService } from '../../services/calculo-idoneidad.service';

export interface PostulacionTerna {
  id?: string;
  postulanteId?: string;
  cargoId?: string;
  nombreCargo?: string;
  nombrePostulante?: string;
  areaLaboral?: string;
  porcentajeIdoneidad?: number | null;
  foto?: string;
  contacto?: string;
  resumenIA?: string;
  fortalezas?: string[];
}

@Component({
  selector: 'app-buscar-postulantes',
  standalone: true,
  templateUrl: './buscar-postulantes.page.html',
  styleUrls: ['./buscar-postulantes.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonSearchbar,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonBadge,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption
  ]
})
export class BuscarPostulantesPage implements OnInit {
  private firestore = inject(Firestore, { optional: true });
  private idoneidadService = inject(CalculoIdoneidadService); // INYECCIÓN DEL SERVICIO

  postulaciones: PostulacionTerna[] = [];
  sugerenciasAreas: string[] = [];
  sugerenciasFiltradas: string[] = [];

  textoBusqueda = '';
  areaSeleccionada = 'Todas';
  candidatoSeleccionado: PostulacionTerna | null = null;
  mostrarSugerencias = false;

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'search-outline': searchOutline,
      'briefcase-outline': briefcaseOutline
    });
  }

  ngOnInit() {
    this.cargarDatosFirebase();
  }

  cargarDatosFirebase() {
    if (!this.firestore) {
      this.postulaciones = [
        {
          postulanteId: 'p1',
          cargoId: 'c1',
          nombrePostulante: 'Daniel Rodriguez Fuentes',
          nombreCargo: 'Chef Ejecutivo',
          areaLaboral: 'Gastronomía, Repostería',
          porcentajeIdoneidad: null, // Dejamos en null para que se calcule dinámicamente
          foto: 'assets/daniel.jpg',
          contacto: 'daniel.rodriguez@email.com',
          resumenIA: 'Experiencia amplia en cocina internacional y manejo de personal.',
          fortalezas: ['Liderazgo de cocina', 'Control de costos', 'Diseño de menú']
        },
        {
          postulanteId: 'p2',
          cargoId: 'c2',
          nombrePostulante: 'María Fernanda López',
          nombreCargo: 'Pastelera Senior',
          areaLaboral: 'Repostería',
          porcentajeIdoneidad: null,
          contacto: 'maria.lopez@email.com',
          resumenIA: 'Especialista en repostería fina y alta pastelería.',
          fortalezas: ['Creatividad', 'Atención al detalle']
        },
        {
          postulanteId: 'p3',
          cargoId: 'c3',
          nombrePostulante: 'Carlos Mendoza',
          nombreCargo: 'Auxiliar de Cocina',
          areaLaboral: 'Gastronomía',
          porcentajeIdoneidad: null,
          contacto: 'carlos.m@email.com'
        }
      ];
      this.extraerAreasUnicas();
      return;
    }

    const ref = collection(this.firestore, 'postulaciones-terna');
    (collectionData(ref, { idField: 'id' }) as Observable<PostulacionTerna[]>)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        if (data && data.length > 0) {
          this.postulaciones = data;
        }
        this.extraerAreasUnicas();
      });
  }

  private extraerAreasUnicas() {
    const setAreas = new Set<string>();
    
    this.postulaciones.forEach(p => {
      if (p.areaLaboral) {
        p.areaLaboral.split(',').forEach(area => {
          const limpia = area.trim();
          if (limpia) {
            setAreas.add(limpia);
          }
        });
      }
    });

    this.sugerenciasAreas = Array.from(setAreas);
  }

  // AQUÍ ESTÁ LA MAGIA: Calculamos y ordenamos los candidatos antes de devolverlos
  get candidatosFiltrados(): PostulacionTerna[] {
    let filtrados = this.postulaciones.map(candidato => {
      // Calculamos la idoneidad basándonos en el dropdown (areaSeleccionada)
      // Si está en "Todas", intentamos calcular usando el texto del buscador
      let areaEvaluar = this.areaSeleccionada !== 'Todas' ? this.areaSeleccionada : this.textoBusqueda;
      
      const nuevoPorcentaje = this.idoneidadService.calcularIdoneidad(areaEvaluar, candidato.areaLaboral);
      
      return {
        ...candidato,
        // Solo sobreescribimos si calculamos un valor, o mantenemos el original si venía de BD
        porcentajeIdoneidad: nuevoPorcentaje > 0 ? nuevoPorcentaje : (candidato.porcentajeIdoneidad || 0)
      };
    });

    // 1. Filtrar por Dropdown de Área
    if (this.areaSeleccionada !== 'Todas') {
      filtrados = filtrados.filter(c => {
        const areasCandidato = c.areaLaboral ? c.areaLaboral.split(',').map(a => a.trim()) : [];
        return areasCandidato.includes(this.areaSeleccionada);
      });
    }

    // 2. Filtrar por Texto de Búsqueda
    const query = this.normalizarTexto(this.textoBusqueda);
    if (query) {
      filtrados = filtrados.filter(c => {
        const area = this.normalizarTexto(c.areaLaboral ?? '');
        const cargo = this.normalizarTexto(c.nombreCargo ?? '');
        const nombre = this.normalizarTexto(c.nombrePostulante ?? '');
        
        return area.includes(query) || cargo.includes(query) || nombre.includes(query);
      });
    }

    // 3. Ordenar (Ranking) de mayor a menor idoneidad
    return filtrados.sort((a, b) => (b.porcentajeIdoneidad || 0) - (a.porcentajeIdoneidad || 0));
  }

  buscarCandidatos(event: any) {
    this.textoBusqueda = event.detail?.value ?? '';
    const query = this.normalizarTexto(this.textoBusqueda);

    if (query.length > 0) {
      this.sugerenciasFiltradas = this.sugerenciasAreas.filter(a =>
        this.normalizarTexto(a).includes(query)
      );
      this.mostrarSugerencias = this.sugerenciasFiltradas.length > 0;
    } else {
      this.mostrarSugerencias = false;
    }
  }

  seleccionarSugerencia(area: string) {
    this.textoBusqueda = area;
    this.mostrarSugerencias = false;
  }

  verDetalle(candidato: PostulacionTerna) {
    this.candidatoSeleccionado = candidato;
    this.mostrarSugerencias = false;
  }

  volverBusqueda() {
    this.candidatoSeleccionado = null;
  }

  tieneIdoneidad(porcentaje: number | null | undefined): boolean {
    return typeof porcentaje === 'number' && !isNaN(porcentaje) && porcentaje >= 0;
  }

  obtenerColorIdoneidad(porcentaje: number | null | undefined): string {
    if (!this.tieneIdoneidad(porcentaje)) return 'medium';
    if (porcentaje! >= 80) return 'success';
    if (porcentaje! >= 50) return 'warning';
    return 'tertiary';
  }

  private normalizarTexto(texto: string): string {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  alCambiarArea() {
    this.textoBusqueda = this.textoBusqueda + ' '; 
    setTimeout(() => this.textoBusqueda = this.textoBusqueda.trim(), 10);
  }
}