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
  addCircleOutline, sparklesOutline, searchOutline
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

  cargando: boolean = true;
  guardando: boolean = false;

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
      'search-outline': searchOutline
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
    this.limpiarBusquedaArea();
    if (this.uid) {
      void this.cargarDatos(false);
    }
  }

  /**
   * Otras páginas pueden indicar a dónde volver al guardar con ?volver=/ruta
   * (ej. cargos-interes o perfil-cv). Si no viene, se vuelve al home.
   */
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
    this.areasInteres = areasGuardadas;

    this.cargando = false;
    this.filtrarAreas();
    this.cdr.detectChanges();
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

  filtrarAreas() {
    const termino = this.normalizarTexto(this.terminoBusquedaArea);
    if (!termino) {
      this.areasFiltradas = [];
      return;
    }

    this.areasFiltradas = this.listaAreasDisponibles.filter(area =>
      this.normalizarTexto(area).includes(termino)
    );
  }

  limpiarBusquedaArea() {
    this.terminoBusquedaArea = '';
    this.areasFiltradas = [];
    this.cdr.detectChanges();
  }

  esAreaSeleccionada(area: string): boolean {
    return this.areasInteres.some(a => this.normalizarTexto(a) === this.normalizarTexto(area));
  }

  toggleAreaInteres(area: string) {
    const index = this.areasInteres.findIndex(
      a => this.normalizarTexto(a) === this.normalizarTexto(area)
    );

    if (index >= 0) {
      this.areasInteres = this.areasInteres.filter((_, i) => i !== index);
    } else {
      this.areasInteres = [...this.areasInteres, area];
    }
    this.cdr.detectChanges();
  }

  async guardarAreas() {
    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarMensaje('Debes iniciar sesión para continuar.', 'warning');
      return;
    }

    if (this.areasInteres.length === 0) {
      this.mostrarMensaje('Busca y selecciona al menos un área laboral de tu interés.', 'warning');
      return;
    }

    this.guardando = true;
    const loading = await this.loadingCtrl.create({ message: 'Guardando áreas de interés...', spinner: 'crescent' });
    await loading.present();

    try {
      // merge: true hace un merge profundo, así que cvManual conserva el resto de sus campos.
      await setDoc(doc(this.firestore, `postulantes/${user.uid}`), {
        areasInteres: this.areasInteres,
        cvManual: { areasInteres: this.areasInteres },
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();
      this.mostrarMensaje('¡Áreas de interés guardadas con éxito!', 'success');
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