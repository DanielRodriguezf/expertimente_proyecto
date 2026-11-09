import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import {
  ToastController, LoadingController, NavController, ViewWillEnter,
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonButton, IonIcon, IonInput, IonChip, IonLabel, IonSpinner
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  checkmarkCircle, warning, closeCircle, informationCircle,
  addCircleOutline, sparklesOutline, searchOutline,
  chevronDownOutline, chevronUpOutline, trashOutline, closeOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-areas-interes',
  templateUrl: './areas-interes.page.html',
  styleUrls: ['./areas-interes.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonButton, IonIcon, IonInput, IonChip, IonLabel, IonSpinner
  ]
})
export class AreasInteresPage implements OnInit, OnDestroy, ViewWillEnter {

  readonly LIMITE_SUGERENCIAS = 2;

  cargando: boolean = true;
  guardando: boolean = false;
  mostrarTodas: boolean = false;
  mostrarBannerInfo: boolean = true;

  listaAreasDisponibles: string[] = [];
  areasFiltradas: string[] = [];
  terminoBusquedaArea: string = '';
  areasInteres: string[] = [];

  private uid: string = '';
  private rutaRetorno: string = '/home';
  private desuscribirAuth: (() => void) | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle,
      'information-circle': informationCircle,
      'add-circle-outline': addCircleOutline,
      'sparkles-outline': sparklesOutline,
      'search-outline': searchOutline,
      'chevron-down-outline': chevronDownOutline,
      'chevron-up-outline': chevronUpOutline,
      'trash-outline': trashOutline,
      'close-outline': closeOutline
    });
  }

  ngOnInit() {
    this.leerRutaRetorno();

    this.desuscribirAuth = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.uid = user.uid;
        await this.cargarDatos();
      } else {
        this.uid = '';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.desuscribirAuth?.();
  }

  ionViewWillEnter() {
    this.leerRutaRetorno();
    this.terminoBusquedaArea = '';
    this.mostrarTodas = false;
    if (this.uid) {
      void this.cargarDatos(false);
    }
  }

  cerrarBannerInfo() {
    this.mostrarBannerInfo = false;
    this.cdr.detectChanges();
  }

  private leerRutaRetorno() {
    const destino = this.route.snapshot.queryParamMap.get('volver') || '';
    this.rutaRetorno = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/home';
  }

  private async cargarDatos(mostrarCarga: boolean = true) {
    if (mostrarCarga) {
      this.cargando = true;
      this.cdr.detectChanges();
    }

    const [areasDeCargos, areasGuardadas] = await Promise.all([
      this.obtenerAreasDeCargos(),
      this.obtenerAreasGuardadas()
    ]);

    this.listaAreasDisponibles = [];
    [...areasDeCargos, ...areasGuardadas].forEach(area => this.asegurarAreaEnLista(area));

    // Mezclamos aleatoriamente las opciones disponibles para mostrar 3 al azar
    this.listaAreasDisponibles = this.mezclarAleatoriamente(this.listaAreasDisponibles);
    this.areasInteres = areasGuardadas;

    this.cargando = false;
    this.filtrarAreas();
    this.cdr.detectChanges();
  }

  private mezclarAleatoriamente(lista: string[]): string[] {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  private async obtenerAreasDeCargos(): Promise<string[]> {
    const resultado: string[] = [];
    try {
      const cargosRef = collection(this.firestore, 'cargos');
      const snap = await getDocs(cargosRef);

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const origenAreas = data['areas'] ?? data['areaLaboral'] ?? data['area'];

        if (Array.isArray(origenAreas)) {
          origenAreas.forEach((item: any) => {
            if (typeof item === 'string') {
              item.split(',').map(p => p.trim()).filter(Boolean).forEach(p => resultado.push(p));
            }
          });
        } else if (typeof origenAreas === 'string' && origenAreas.trim()) {
          origenAreas
            .split(',')
            .map(p => p.trim())
            .filter(Boolean)
            .forEach(parte => resultado.push(parte));
        }
      });
    } catch (error) {
      console.error('Error al extraer áreas desde la colección cargos:', error);
    }
    return resultado;
  }

  private async obtenerAreasGuardadas(): Promise<string[]> {
    try {
      const docSnap = await getDoc(doc(this.firestore, `postulantes/${this.uid}`));
      if (!docSnap.exists()) return [];

      const data = docSnap.data();
      const cv = data['cvManual'] || {};
      const guardadas: any[] = Array.isArray(cv['areasInteres'])
        ? cv['areasInteres']
        : (Array.isArray(data['areasInteres']) ? data['areasInteres'] : []);

      return guardadas.filter((area): area is string => typeof area === 'string');
    } catch (error) {
      console.error('Error al cargar las áreas de interés del postulante:', error);
      return [];
    }
  }

  private asegurarAreaEnLista(nuevaArea: string) {
    const limpia = nuevaArea.trim();
    if (!limpia) return;
    const existe = this.listaAreasDisponibles.some(
      a => this.normalizarTexto(a) === this.normalizarTexto(limpia)
    );
    if (!existe) {
      this.listaAreasDisponibles.push(limpia);
    }
  }

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Filtra las opciones disponibles excluyendo las que el usuario ya seleccionó abajo.
   */
  filtrarAreas() {
    const termino = this.normalizarTexto(this.terminoBusquedaArea);

    const disponiblesNoSeleccionadas = this.listaAreasDisponibles.filter(
      area => !this.esAreaSeleccionada(area)
    );

    if (!termino) {
      this.areasFiltradas = disponiblesNoSeleccionadas;
    } else {
      this.areasFiltradas = disponiblesNoSeleccionadas.filter(area =>
        this.normalizarTexto(area).includes(termino)
      );
    }
    this.cdr.detectChanges();
  }

  /**
   * Devuelve solo 3 opciones aleatorias por defecto, o todas si el usuario activó "mostrarTodas".
   */
  get areasVisibles(): string[] {
    if (this.mostrarTodas) {
      return this.areasFiltradas;
    }
    return this.areasFiltradas.slice(0, this.LIMITE_SUGERENCIAS);
  }

  get cantidadOcultas(): number {
    return Math.max(0, this.areasFiltradas.length - this.LIMITE_SUGERENCIAS);
  }

  toggleMostrarTodas() {
    this.mostrarTodas = !this.mostrarTodas;
    this.cdr.detectChanges();
  }

  limpiarBusquedaArea() {
    this.terminoBusquedaArea = '';
    this.filtrarAreas();
  }

  esAreaSeleccionada(area: string): boolean {
    return this.areasInteres.some(a => this.normalizarTexto(a) === this.normalizarTexto(area));
  }

  /**
   * Agrega un área a la lista de seleccionadas (abajo) y la retira del buscador (arriba).
   */
  agregarAreaInteres(area: string) {
    if (!this.esAreaSeleccionada(area)) {
      this.areasInteres = [...this.areasInteres, area];
      this.filtrarAreas();
    }
  }

  /**
   * Quita un área de la lista de seleccionadas (abajo) y la devuelve al buscador (arriba).
   */
  quitarAreaInteres(area: string) {
    this.areasInteres = this.areasInteres.filter(
      a => this.normalizarTexto(a) !== this.normalizarTexto(area)
    );
    this.filtrarAreas();
  }

  limpiarTodasSeleccionadas() {
    this.areasInteres = [];
    this.filtrarAreas();
  }

  async omitirPaso() {
    await this.navCtrl.navigateBack(this.rutaRetorno);
  }

  async guardarAreas() {
    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarMensaje('Debes iniciar sesión para continuar.', 'warning');
      return;
    }

    this.guardando = true;
    const loading = await this.loadingCtrl.create({ message: 'Guardando preferencias...', spinner: 'crescent' });
    await loading.present();

    try {
      await setDoc(doc(this.firestore, `postulantes/${user.uid}`), {
        areasInteres: this.areasInteres,
        cvManual: { areasInteres: this.areasInteres },
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();

      const mensaje = this.areasInteres.length > 0
        ? '¡Áreas de interés guardadas con éxito!'
        : 'Preferencias guardadas sin áreas seleccionadas.';

      this.mostrarMensaje(mensaje, 'success');
      await this.navCtrl.navigateBack(this.rutaRetorno);
    } catch (error) {
      console.error('Error al guardar las áreas de interés en Firestore:', error);
      await loading.dismiss();
      this.mostrarMensaje('Hubo un error al guardar las áreas.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success', duracion: number = 2500) {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: duracion,
      position: 'bottom',
      color,
      icon: iconos[color] || 'information-circle',
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }
}