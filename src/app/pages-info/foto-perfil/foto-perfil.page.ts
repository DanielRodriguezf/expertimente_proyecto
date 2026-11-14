import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastController, LoadingController, AlertController, NavController, ViewWillEnter } from '@ionic/angular';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonButton, IonIcon, IonCard, IonCardContent,
  IonModal
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  personOutline, imageOutline, trashOutline,
  syncOutline, swapHorizontalOutline, checkmarkCircle,
  closeCircle, warning, informationCircle, sparklesOutline,
  addOutline, removeOutline, locateOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, getDoc, onSnapshot, deleteField, setDoc, Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-foto-perfil',
  templateUrl: './foto-perfil.page.html',
  styleUrls: ['./foto-perfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonButton, IonIcon, IonCard, IonCardContent,
    IonModal
  ]
})
export class FotoPerfilPage implements OnInit, OnDestroy, ViewWillEnter {
  fotoPerfilSavedBase64: string = '';
  fotoPendienteBase64: string = '';
  guardandoFoto: boolean = false;
  eliminandoFoto: boolean = false;

  @ViewChild('fotoInput', { static: false }) fotoInput?: ElementRef<HTMLInputElement>;

  /* =========================================================
     RECORTADOR PROPIO (modal)
     - El círculo siempre queda lleno: la imagen nunca deja bordes vacíos.
     - Se mueve arrastrando, se acerca con pellizco / slider / botones +/-.
     ========================================================= */
  mostrandoRecortador: boolean = false;
  cropListo: boolean = false;          // true cuando ya se midió el área visible del modal
  cropImagenUrl: string = '';          // imagen de trabajo (ya girada / volteada) para mostrar
  cropAncho: number = 0;               // tamaño real (px) de la imagen de trabajo
  cropAlto: number = 0;
  cropZoom: number = 1;                // 1 = la imagen justo cubre el círculo
  stageAncho: number = 0;              // área visible del modal (px CSS)
  stageAlto: number = 0;
  diametro: number = 0;                // diámetro del círculo de recorte (px CSS)

  readonly zoomMin = 1;
  readonly zoomMax = 5;
  readonly pasoZoom = 0.25;

  private readonly LADO_MAX_TRABAJO = 2048;  // las fotos enormes se reducen a este lado máximo
  private readonly LADO_SALIDA = 400;        // la foto final queda de 400 x 400 px
  private readonly CALIDAD_JPEG = 0.82;
  private readonly MARGEN_CIRCULO = 16;
  private readonly DIAMETRO_MAX = 440;

  // Punto de la imagen (en px reales) que está justo en el centro del círculo
  private focoX: number = 0;
  private focoY: number = 0;

  private canvasFuente: HTMLCanvasElement | null = null;   // foto original reducida
  private canvasTrabajo: HTMLCanvasElement | null = null;  // foto original + giro + volteo
  private rotacion: number = 0;                            // 0 | 90 | 180 | 270
  private volteadoH: boolean = false;
  private regenerando: boolean = false;

  private punteros = new Map<number, { x: number; y: number }>();
  private distanciaPinch: number = 0;
  private observadorStage: ResizeObserver | null = null;

  private uidActual: string = '';
  private ignorarSnapshotTemporal: boolean = false;
  private unsubAuth: AuthUnsubscribe | null = null;
  private unsubDoc: Unsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private navCtrl = inject(NavController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  constructor() {
    addIcons({
      'person-outline': personOutline,
      'image-outline': imageOutline,
      'trash-outline': trashOutline,
      'sync-outline': syncOutline,
      'swap-horizontal-outline': swapHorizontalOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'warning': warning,
      'information-circle': informationCircle,
      'sparkles-outline': sparklesOutline,
      'add-outline': addOutline,
      'remove-outline': removeOutline,
      'locate-outline': locateOutline
    });
  }

  /* =========================================================
     GEOMETRÍA DEL RECORTADOR
     ========================================================= */

  /** Escala con la que la imagen justo cubre el círculo (sin bordes vacíos). */
  get escalaBase(): number {
    if (!this.cropAncho || !this.cropAlto || !this.diametro) return 1;
    return Math.max(this.diametro / this.cropAncho, this.diametro / this.cropAlto);
  }

  /** Escala real aplicada = base * zoom del usuario. */
  get escala(): number {
    return this.escalaBase * this.cropZoom;
  }

  /** Transformación CSS: lleva el "foco" de la imagen al centro del círculo. */
  get transformImagen(): string {
    const s = this.escala;
    const tx = this.stageAncho / 2 - this.focoX * s;
    const ty = this.stageAlto / 2 - this.focoY * s;
    return `translate(${tx}px, ${ty}px) scale(${s})`;
  }

  /* =========================================================
     CICLO DE VIDA
     ========================================================= */

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, (user) => {
      if (this.unsubDoc) {
        this.unsubDoc();
        this.unsubDoc = null;
      }

      if (user) {
        this.uidActual = user.uid;
        this.iniciarEscuchaTiempoReal(user.uid);
      } else {
        this.uidActual = '';
        this.actualizarVista(() => {
          this.fotoPerfilSavedBase64 = '';
          this.fotoPendienteBase64 = '';
        });
      }
    });
  }

  ngOnDestroy() {
    this.limpiarRecortador();
    if (this.unsubDoc) {
      this.unsubDoc();
      this.unsubDoc = null;
    }
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  async ionViewWillEnter() {
    this.descartarFotoPendiente();
    const uid = this.auth.currentUser?.uid || this.uidActual;
    if (uid) {
      await this.refrescarFotoDesdeFirestore(uid);
    }
  }

  private actualizarVista(fn: () => void) {
    this.ngZone.run(() => {
      fn();
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  private iniciarEscuchaTiempoReal(uid: string) {
    const docRef = doc(this.firestore, `postulantes/${uid}`);
    this.unsubDoc = onSnapshot(docRef, (docSnap) => {
      if (this.ignorarSnapshotTemporal) return;

      this.actualizarVista(() => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          this.fotoPerfilSavedBase64 = (typeof data['fotoPerfil'] === 'string' && data['fotoPerfil'].trim())
            ? data['fotoPerfil']
            : '';
        } else {
          this.fotoPerfilSavedBase64 = '';
        }
      });
    });
  }

  private async refrescarFotoDesdeFirestore(uid: string) {
    try {
      const docRef = doc(this.firestore, `postulantes/${uid}`);
      const docSnap = await getDoc(docRef);
      this.actualizarVista(() => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          this.fotoPerfilSavedBase64 = (typeof data['fotoPerfil'] === 'string' && data['fotoPerfil'].trim())
            ? data['fotoPerfil']
            : '';
        } else {
          this.fotoPerfilSavedBase64 = '';
        }
      });
    } catch (error) {
      console.error('Error al refrescar foto de perfil:', error);
    }
  }

  /* =========================================================
     SELECCIÓN DE IMAGEN
     ========================================================= */

  abrirSelectorFoto() {
    if (this.fotoInput?.nativeElement) {
      this.fotoInput.nativeElement.value = '';
      this.fotoInput.nativeElement.click();
    }
  }

  async alSeleccionarFoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png|webp|heic|heif)/i)) {
      this.mostrarMensaje('Formato no soportado. Usa JPG, PNG o WebP.', 'warning');
      input.value = '';
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Preparando imagen...',
      spinner: 'crescent',
      cssClass: 'loading-expertimente',
      id: 'loader-foto'
    });
    await loading.present();

    try {
      // 1. Se decodifica y se reduce la foto (evita problemas de memoria con fotos de 12 MP o más)
      this.canvasFuente = await this.cargarImagenReducida(file);
      this.rotacion = 0;
      this.volteadoH = false;

      // 2. Se genera la imagen de trabajo (aplica giro / volteo)
      await this.prepararImagenTrabajo();

      await loading.dismiss().catch(() => {});

      // 3. Se abre el modal; el área visible se mide al terminar de presentarse
      this.actualizarVista(() => {
        this.cropListo = false;
        this.mostrandoRecortador = true;
      });
    } catch (error) {
      console.error('Error al preparar la imagen:', error);
      await loading.dismiss().catch(() => {});
      this.actualizarVista(() => {
        this.mostrandoRecortador = false;
        this.limpiarRecortador();
      });
      this.mostrarMensaje('No se pudo abrir la imagen. Prueba con otra foto.', 'danger');
    }
  }

  /** Decodifica el archivo y lo dibuja en un canvas con un lado máximo de LADO_MAX_TRABAJO. */
  private async cargarImagenReducida(file: File): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
        el.src = url;
      });

      const anchoOriginal = img.naturalWidth;
      const altoOriginal = img.naturalHeight;
      if (!anchoOriginal || !altoOriginal) {
        throw new Error('Imagen sin dimensiones');
      }

      const factor = Math.min(1, this.LADO_MAX_TRABAJO / Math.max(anchoOriginal, altoOriginal));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(anchoOriginal * factor));
      lienzo.height = Math.max(1, Math.round(altoOriginal * factor));

      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      return lienzo;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Aplica giro y volteo sobre la foto reducida y la deja lista para mostrarse y recortarse. */
  private async prepararImagenTrabajo(): Promise<void> {
    const fuente = this.canvasFuente;
    if (!fuente) throw new Error('Sin imagen fuente');

    const girado90 = this.rotacion % 180 !== 0;
    const ancho = girado90 ? fuente.height : fuente.width;
    const alto = girado90 ? fuente.width : fuente.height;

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    // Fondo blanco (por si la imagen tiene transparencia, igual que la foto final)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(ancho / 2, alto / 2);
    ctx.scale(this.volteadoH ? -1 : 1, 1);
    ctx.rotate((this.rotacion * Math.PI) / 180);
    ctx.drawImage(fuente, -fuente.width / 2, -fuente.height / 2);

    const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('No se pudo generar la imagen de trabajo');

    const urlAnterior = this.cropImagenUrl;
    const urlNueva = URL.createObjectURL(blob);
    this.canvasTrabajo = lienzo;

    this.actualizarVista(() => {
      this.cropAncho = ancho;
      this.cropAlto = alto;
      this.cropImagenUrl = urlNueva;
      this.cropZoom = 1;
      this.focoX = ancho / 2;
      this.focoY = alto / 2;
    });

    if (urlAnterior) {
      URL.revokeObjectURL(urlAnterior);
    }
  }

  /* =========================================================
     MODAL: MEDICIÓN DEL ÁREA VISIBLE
     ========================================================= */

  alModalPresentado(ev?: Event) {
    const modal = ev?.target as HTMLElement | null;
    const stage = (modal?.querySelector?.('.crop-stage') ?? document.querySelector('.crop-stage')) as HTMLElement | null;
    if (!stage) return;

    this.medirStage(stage);

    this.observadorStage?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      this.observadorStage = new ResizeObserver(() => this.medirStage(stage));
      this.observadorStage.observe(stage);
    }
  }

  private medirStage(stage: HTMLElement) {
    const ancho = stage.clientWidth;
    const alto = stage.clientHeight;
    if (!ancho || !alto) return;

    this.actualizarVista(() => {
      this.stageAncho = ancho;
      this.stageAlto = alto;
      const lado = Math.min(ancho, alto) - this.MARGEN_CIRCULO * 2;
      this.diametro = Math.max(120, Math.floor(Math.min(lado, this.DIAMETRO_MAX)));
      this.limitarFoco();
      this.cropListo = true;
    });
  }

  /* =========================================================
     MODAL: GESTOS (arrastrar, pellizcar, rueda del mouse)
     ========================================================= */

  alPunteroAbajo(ev: PointerEvent) {
    if (!this.cropListo) return;
    try {
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    } catch { /* algunos navegadores no soportan la captura */ }

    this.punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.punteros.size === 2) {
      this.distanciaPinch = this.distanciaEntrePunteros();
    }
  }

  alPunteroMover(ev: PointerEvent) {
    if (!this.cropListo) return;
    const previo = this.punteros.get(ev.pointerId);
    if (!previo) return;

    const actual = { x: ev.clientX, y: ev.clientY };

    if (this.punteros.size === 1) {
      // Un dedo: mover la imagen
      this.punteros.set(ev.pointerId, actual);
      this.moverEncuadre(actual.x - previo.x, actual.y - previo.y);
      return;
    }

    // Dos dedos: pellizco (zoom) + movimiento del punto medio
    const centroAntes = this.centroEntrePunteros();
    this.punteros.set(ev.pointerId, actual);
    const centroDespues = this.centroEntrePunteros();
    const distancia = this.distanciaEntrePunteros();

    if (this.distanciaPinch > 0 && distancia > 0) {
      this.aplicarZoom(this.cropZoom * (distancia / this.distanciaPinch));
    }
    this.distanciaPinch = distancia;
    this.moverEncuadre(centroDespues.x - centroAntes.x, centroDespues.y - centroAntes.y);
  }

  alPunteroArriba(ev: PointerEvent) {
    this.punteros.delete(ev.pointerId);
    this.distanciaPinch = this.punteros.size === 2 ? this.distanciaEntrePunteros() : 0;
  }

  alRuedaMouse(ev: WheelEvent) {
    if (!this.cropListo) return;
    ev.preventDefault();
    this.aplicarZoom(this.cropZoom * (ev.deltaY < 0 ? 1.1 : 0.9));
  }

  private distanciaEntrePunteros(): number {
    const [a, b] = Array.from(this.punteros.values());
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private centroEntrePunteros(): { x: number; y: number } {
    const [a, b] = Array.from(this.punteros.values());
    if (!a || !b) return { x: 0, y: 0 };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private moverEncuadre(dx: number, dy: number) {
    const s = this.escala;
    if (!s) return;
    this.focoX -= dx / s;
    this.focoY -= dy / s;
    this.limitarFoco();
  }

  /** Evita que el círculo se salga de la imagen (nunca quedan bordes vacíos). */
  private limitarFoco() {
    const s = this.escala;
    if (!s || !this.diametro || !this.cropAncho || !this.cropAlto) return;

    const mitad = this.diametro / (2 * s);
    this.focoX = Math.min(Math.max(this.focoX, mitad), this.cropAncho - mitad);
    this.focoY = Math.min(Math.max(this.focoY, mitad), this.cropAlto - mitad);
  }

  /* =========================================================
     MODAL: CONTROLES (zoom, girar, voltear, centrar)
     ========================================================= */

  private aplicarZoom(valor: number) {
    if (!this.cropListo) return;
    this.cropZoom = Math.min(this.zoomMax, Math.max(this.zoomMin, valor));
    this.limitarFoco();
  }

  acercar() {
    this.aplicarZoom(this.cropZoom + this.pasoZoom);
  }

  alejar() {
    this.aplicarZoom(this.cropZoom - this.pasoZoom);
  }

  alCambiarSlider(event: Event) {
    const valor = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(valor)) {
      this.aplicarZoom(valor);
    }
  }

  centrarImagen() {
    if (!this.cropListo) return;
    this.cropZoom = 1;
    this.focoX = this.cropAncho / 2;
    this.focoY = this.cropAlto / 2;
  }

  async girarImagen() {
    if (!this.cropListo || this.regenerando) return;
    this.rotacion = (this.rotacion + 90) % 360;
    await this.regenerarImagenTrabajo();
  }

  async voltearHorizontal() {
    if (!this.cropListo || this.regenerando) return;
    this.volteadoH = !this.volteadoH;
    await this.regenerarImagenTrabajo();
  }

  private async regenerarImagenTrabajo() {
    this.regenerando = true;
    try {
      await this.prepararImagenTrabajo();
    } catch (error) {
      console.error('Error al transformar la imagen:', error);
      this.mostrarMensaje('No se pudo modificar la imagen.', 'danger');
    } finally {
      this.regenerando = false;
    }
  }

  /* =========================================================
     MODAL: CONFIRMAR / CANCELAR
     ========================================================= */

  confirmarRecorte() {
    const origen = this.canvasTrabajo;
    const s = this.escala;
    if (!this.cropListo || !origen || !s || !this.diametro) return;

    try {
      // Cuadrado que se ve dentro del círculo, expresado en px reales de la imagen
      const lado = this.diametro / s;
      const u0 = Math.min(Math.max(this.focoX - lado / 2, 0), Math.max(0, origen.width - lado));
      const v0 = Math.min(Math.max(this.focoY - lado / 2, 0), Math.max(0, origen.height - lado));

      const salida = document.createElement('canvas');
      salida.width = this.LADO_SALIDA;
      salida.height = this.LADO_SALIDA;
      const ctx = salida.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.LADO_SALIDA, this.LADO_SALIDA);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(origen, u0, v0, lado, lado, 0, 0, this.LADO_SALIDA, this.LADO_SALIDA);

      const resultado = salida.toDataURL('image/jpeg', this.CALIDAD_JPEG);

      this.actualizarVista(() => {
        this.fotoPendienteBase64 = resultado;
        this.mostrandoRecortador = false;
        if (this.fotoInput?.nativeElement) {
          this.fotoInput.nativeElement.value = '';
        }
      });
    } catch (error) {
      console.error('Error al recortar la imagen:', error);
      this.mostrarMensaje('No se pudo recortar la imagen. Intenta nuevamente.', 'danger');
    }
  }

  cancelarRecorte() {
    this.actualizarVista(() => {
      this.mostrandoRecortador = false;
      if (this.fotoInput?.nativeElement) {
        this.fotoInput.nativeElement.value = '';
      }
    });
  }

  /** Se ejecuta siempre al cerrarse el modal (confirmar, cancelar o botón atrás): libera memoria. */
  alCerrarModalRecorte() {
    this.actualizarVista(() => {
      this.mostrandoRecortador = false;
      this.limpiarRecortador();
    });
  }

  private limpiarRecortador() {
    this.observadorStage?.disconnect();
    this.observadorStage = null;
    this.punteros.clear();
    this.distanciaPinch = 0;
    this.regenerando = false;

    if (this.cropImagenUrl) {
      URL.revokeObjectURL(this.cropImagenUrl);
    }
    this.canvasFuente = null;
    this.canvasTrabajo = null;
    this.rotacion = 0;
    this.volteadoH = false;

    this.cropImagenUrl = '';
    this.cropListo = false;
    this.cropAncho = 0;
    this.cropAlto = 0;
    this.cropZoom = 1;
    this.stageAncho = 0;
    this.stageAlto = 0;
    this.diametro = 0;
    this.focoX = 0;
    this.focoY = 0;
  }

  /* =========================================================
     FOTO PENDIENTE / GUARDADA
     ========================================================= */

  descartarFotoPendiente() {
    this.actualizarVista(() => {
      this.fotoPendienteBase64 = '';
      if (this.fotoInput?.nativeElement) {
        this.fotoInput.nativeElement.value = '';
      }
    });
  }

  async eliminarFotoGuardada() {
    const alert = await this.alertCtrl.create({
      header: '¿Quitar Foto?',
      message: 'Tu foto actual se borrará y podrás elegir una nueva cuando quieras.',
      cssClass: 'alerta-expertimente',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: () => {
            void this.ejecutarEliminacionFoto();
          }
        }
      ]
    });
    await alert.present();
  }

  private async ejecutarEliminacionFoto() {
    const uid = this.auth.currentUser?.uid || this.uidActual;
    if (!uid || this.eliminandoFoto) return;

    const respaldoFotoAnterior = this.fotoPerfilSavedBase64;
    this.ignorarSnapshotTemporal = true;

    // 1. Limpieza visual instantánea (Optimistic UI)
    this.actualizarVista(() => {
      this.eliminandoFoto = true;
      this.fotoPerfilSavedBase64 = '';
      this.fotoPendienteBase64 = '';
      if (this.fotoInput?.nativeElement) {
        this.fotoInput.nativeElement.value = '';
      }
    });

    try {
      const docRef = doc(this.firestore, `postulantes/${uid}`);
      await setDoc(docRef, {
        fotoPerfil: deleteField(),
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      this.mostrarMensaje('Foto eliminada correctamente.', 'success');
    } catch (error) {
      console.error('Error al eliminar la foto de perfil:', error);
      // Si falla en el servidor, restauramos la foto anterior
      this.actualizarVista(() => {
        this.fotoPerfilSavedBase64 = respaldoFotoAnterior;
      });
      this.mostrarMensaje('No se pudo eliminar la foto. Intenta nuevamente.', 'danger');
    } finally {
      this.ignorarSnapshotTemporal = false;
      this.actualizarVista(() => {
        this.eliminandoFoto = false;
      });
    }
  }

  async guardarDatos() {
    if (!this.fotoPendienteBase64 || this.guardandoFoto) return;

    const uid = this.auth.currentUser?.uid || this.uidActual;
    if (!uid) return;

    const nuevaFoto = this.fotoPendienteBase64;
    this.ignorarSnapshotTemporal = true;

    this.actualizarVista(() => {
      this.guardandoFoto = true;
    });

    const loading = await this.loadingCtrl.create({
      message: 'Guardando foto...',
      spinner: 'crescent',
      cssClass: 'loading-expertimente'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${uid}`);

      await setDoc(docRef, {
        fotoPerfil: nuevaFoto,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      this.actualizarVista(() => {
        this.fotoPerfilSavedBase64 = nuevaFoto;
        this.fotoPendienteBase64 = '';
        this.guardandoFoto = false;
      });

      await loading.dismiss();
      await this.mostrarMensaje('¡Tu foto de perfil se ha guardado con éxito!', 'success');
      await this.navCtrl.navigateBack('/perfil-cv');
    } catch (error) {
      console.error('Error al guardar la foto de perfil:', error);
      this.actualizarVista(() => {
        this.guardandoFoto = false;
      });
      await loading.dismiss();
      await this.mostrarMensaje('Hubo un error al guardar.', 'danger');
    } finally {
      this.ignorarSnapshotTemporal = false;
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