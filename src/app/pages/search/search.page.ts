import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonSearchbar, ViewWillEnter,
  IonSelect, IonSelectOption, IonItem
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  navigateOutline, constructOutline, searchOutline,
  businessOutline, optionsOutline, chevronForwardOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe, doc, getDoc } from '@angular/fire/firestore';

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
  areaLaboral: string;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [
    FormsModule, IonContent, IonHeader, IonToolbar, IonTitle,
    IonButtons, IonBackButton, IonCard, IonCardContent, IonIcon,
    IonButton, IonSpinner, IonSearchbar,
    IonSelect, IonSelectOption, IonItem
  ]
})
export class SearchPage implements OnInit, ViewWillEnter, OnDestroy {

  ofertasOriginales: Oferta[] = [];
  ofertasFiltradas: Oferta[] = [];

  cargando: boolean = true;

  areasLaborales: string[] = [];
  areasInteresUsuario: string[] = [];
  areaSeleccionada: string = '';
  terminoBusqueda: string = '';

  private uidActual: string = '';
  private unsubAuth: AuthUnsubscribe | null = null;
  private unsubOfertas: Unsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  constructor() {
    addIcons({
      'navigate-outline': navigateOutline,
      'construct-outline': constructOutline,
      'search-outline': searchOutline,
      'business-outline': businessOutline,
      'options-outline': optionsOutline,
      'chevron-forward-outline': chevronForwardOutline
    });
  }

  ngOnInit() {
    // Escucha el estado de sesión por si el usuario entra directo o refresca la vista
    this.unsubAuth = onAuthStateChanged(this.auth, async (user) => {
      this.uidActual = user?.uid || '';
      await this.cargarAreasInteresUsuario();
      this.ordenarSelectorAreas();
      this.aplicarFiltros();
    });
  }

  async ionViewWillEnter() {
    // Si el usuario viene de regreso desde /areas-interes, recarga sus preferencias actualizadas
    if (this.auth.currentUser) {
      this.uidActual = this.auth.currentUser.uid;
      await this.cargarAreasInteresUsuario();
    }
    this.cargarOfertas();
  }

  ngOnDestroy() {
    if (this.unsubOfertas) {
      this.unsubOfertas();
      this.unsubOfertas = null;
    }
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private async cargarAreasInteresUsuario() {
    if (!this.uidActual) {
      this.areasInteresUsuario = [];
      return;
    }

    try {
      const snap = await getDoc(doc(this.firestore, `postulantes/${this.uidActual}`));
      if (!snap.exists()) {
        this.areasInteresUsuario = [];
        return;
      }

      const data = snap.data();
      const areasRaiz = Array.isArray(data['areasInteres']) ? data['areasInteres'] : [];
      const areasManual = Array.isArray(data['cvManual']?.['areasInteres']) ? data['cvManual']['areasInteres'] : [];

      // Unificamos ambas fuentes y limpiamos valores vacíos o no válidos
      const combinadas = [...areasRaiz, ...areasManual]
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map(a => a.trim());

      this.areasInteresUsuario = Array.from(new Set(combinadas));
    } catch (error) {
      console.error('Error al cargar áreas de interés del postulante en search:', error);
      this.areasInteresUsuario = [];
    }
  }

  /**
   * Evalúa si el área laboral de una oferta coincide con alguna de las áreas de interés del postulante.
   * Si el usuario no tiene áreas seleccionadas, devuelve siempre false y mantiene el orden normal por fecha.
   */
  private esAreaDeInteres(areaOferta: string): boolean {
    if (!areaOferta || this.areasInteresUsuario.length === 0) return false;

    const partesOferta = String(areaOferta)
      .split(',')
      .map(p => this.normalizarTexto(p))
      .filter(Boolean);

    return this.areasInteresUsuario.some(areaInteres => {
      const interesNorm = this.normalizarTexto(areaInteres);
      if (!interesNorm) return false;
      return partesOferta.some(
        parte => parte.includes(interesNorm) || interesNorm.includes(parte)
      );
    });
  }

  private ordenarSelectorAreas() {
    if (!this.areasLaborales.length) return;

    this.areasLaborales = [...this.areasLaborales].sort((a, b) => {
      const aRecomendada = this.esAreaDeInteres(a) ? 1 : 0;
      const bRecomendada = this.esAreaDeInteres(b) ? 1 : 0;
      if (aRecomendada !== bRecomendada) {
        return bRecomendada - aRecomendada;
      }
      return a.localeCompare(b);
    });
  }

  cargarOfertas() {
    if (this.unsubOfertas) {
      this.unsubOfertas();
      this.unsubOfertas = null;
    }

    this.cargando = true;
    const ofertasRef = collection(this.firestore, 'ofertas');
    const q = query(ofertasRef, where('estado', '==', 'Activa'));

    this.unsubOfertas = onSnapshot(q, (snapshot) => {
      this.ngZone.run(() => {
        const ofertasTemp: Oferta[] = [];
        const areasSet = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Oferta;
          ofertasTemp.push({ ...data, id: docSnap.id });

          if (data.areaLaboral) {
            areasSet.add(data.areaLaboral);
          }
        });

        this.ofertasOriginales = ofertasTemp;
        this.areasLaborales = Array.from(areasSet);
        this.ordenarSelectorAreas();

        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
      });
    }, (error) => {
      console.error('Error obteniendo ofertas: ', error);
      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      });
    });
  }

  alEscribirBusqueda(event: any) {
    this.terminoBusqueda = (event.target.value || '').toLowerCase().trim();
    this.aplicarFiltros();
  }

  alSeleccionarArea(event: any) {
    this.areaSeleccionada = event.detail.value || '';
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    const filtradas = this.ofertasOriginales.filter((oferta) => {
      const coincideTexto = this.terminoBusqueda === '' ||
        (oferta.titulo && oferta.titulo.toLowerCase().includes(this.terminoBusqueda)) ||
        (oferta.nombreEmpresa && oferta.nombreEmpresa.toLowerCase().includes(this.terminoBusqueda));

      const coincideArea = this.areaSeleccionada === '' ||
        (oferta.areaLaboral === this.areaSeleccionada);

      return coincideTexto && coincideArea;
    });

    // Si el postulante tiene áreas de interés, esas ofertas suben al inicio;
    // si no tiene ninguna, todas empatan en 0 y se ordenan normalmente por fecha más reciente.
    filtradas.sort((a, b) => {
      const aPrioridad = this.esAreaDeInteres(a.areaLaboral) ? 1 : 0;
      const bPrioridad = this.esAreaDeInteres(b.areaLaboral) ? 1 : 0;

      if (aPrioridad !== bPrioridad) {
        return bPrioridad - aPrioridad;
      }

      const dateA = (a.fechaPublicacion && typeof a.fechaPublicacion.toMillis === 'function')
        ? a.fechaPublicacion.toMillis() : 0;
      const dateB = (b.fechaPublicacion && typeof b.fechaPublicacion.toMillis === 'function')
        ? b.fechaPublicacion.toMillis() : 0;
      return dateB - dateA;
    });

    this.ofertasFiltradas = filtradas;
    this.cdr.detectChanges();
  }

  verDetalles(oferta: Oferta) {
    this.router.navigate(['/oferta-detalle', oferta.id]);
  }
}