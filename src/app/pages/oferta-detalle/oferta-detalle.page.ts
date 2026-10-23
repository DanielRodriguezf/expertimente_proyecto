import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonFooter, ToastController, ViewWillEnter 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  locationOutline, starOutline, callOutline, mailOutline, 
  checkmarkCircle, informationCircle, warning, closeCircle,
  sparkles, shieldCheckmarkOutline, helpCircleOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { 
  Firestore, doc, getDoc, collection, query, where, getDocs 
} from '@angular/fire/firestore';

@Component({
  selector: 'app-oferta-detalle',
  templateUrl: './oferta-detalle.page.html',
  styleUrls: ['./oferta-detalle.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, 
    IonCard, IonCardContent, IonIcon, IonButton, IonSpinner,
    IonFooter
  ]
})
export class OfertaDetallePage implements OnInit, ViewWillEnter {
  
  ofertaId: string = '';
  oferta: any = null;
  esTerna: boolean = false;
  resultadoTerna: any = null;

  cargando: boolean = true;
  yaPostulado: boolean = false;

  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'location-outline': locationOutline,
      'star-outline': starOutline,
      'call-outline': callOutline,
      'mail-outline': mailOutline,
      'checkmark-circle': checkmarkCircle,
      'information-circle': informationCircle,
      'warning': warning,
      'close-circle': closeCircle,
      'sparkles': sparkles,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'help-circle-outline': helpCircleOutline
    });
  }

  ngOnInit() {
    this.ofertaId = this.route.snapshot.paramMap.get('id') || '';
    const tipoParam = this.route.snapshot.queryParamMap.get('tipo');
    this.esTerna = tipoParam === 'terna';
  }

  ionViewWillEnter() {
    if (this.ofertaId) {
      this.cargarDetalle();
    }
  }

  async cargarDetalle() {
    this.cargando = true;
    this.yaPostulado = false;
    this.resultadoTerna = null;

    try {
      // 1. Si viene marcado como 'terna', buscamos directo en 'cargos'
      if (this.esTerna) {
        const cargoRef = doc(this.firestore, `cargos/${this.ofertaId}`);
        const cargoSnap = await getDoc(cargoRef);

        if (cargoSnap.exists()) {
          this.oferta = { id: cargoSnap.id, ...cargoSnap.data() };
          await this.verificarEstadoUsuario();
          return;
        }
      }

      // 2. Buscamos en la colección 'ofertas' (Oferta normal)
      const ofertaRef = doc(this.firestore, `ofertas/${this.ofertaId}`);
      const ofertaSnap = await getDoc(ofertaRef);

      if (ofertaSnap.exists()) {
        this.esTerna = false;
        this.oferta = { id: ofertaSnap.id, ...ofertaSnap.data() };
        await this.verificarEstadoUsuario();
        return;
      }

      // 3. Respaldo: Si no existía en 'ofertas', probamos en 'cargos' por si entró sin el queryParam
      const fallbackCargoRef = doc(this.firestore, `cargos/${this.ofertaId}`);
      const fallbackCargoSnap = await getDoc(fallbackCargoRef);

      if (fallbackCargoSnap.exists()) {
        this.esTerna = true;
        this.oferta = { id: fallbackCargoSnap.id, ...fallbackCargoSnap.data() };
        await this.verificarEstadoUsuario();
        return;
      }

      // Si no está en ninguna de las dos colecciones:
      this.mostrarMensaje('La oferta o cargo ya no está disponible.', 'warning');
      this.router.navigate(['/search']);

    } catch (error) {
      console.error('Error al cargar detalle:', error);
      this.mostrarMensaje('Error al cargar la información.', 'danger');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async verificarEstadoUsuario() {
    const user = await new Promise<any>((resolve) => {
      const unsub = onAuthStateChanged(this.auth, (u) => {
        unsub();
        resolve(u);
      });
    });

    if (!user) return;

    try {
      if (this.esTerna) {
        // Verificar si ya respondió la terna en 'postulaciones-terna' o en 'resultados'
        const resultadoId = `${user.uid}_${this.ofertaId}`;
        const resDoc = await getDoc(doc(this.firestore, `postulaciones-terna/${resultadoId}`));

        if (resDoc.exists()) {
          this.yaPostulado = true;
          this.resultadoTerna = resDoc.data();
          return;
        }

        // Respaldo secundario consultando la colección 'resultados'
        const altResDoc = await getDoc(doc(this.firestore, `resultados/${resultadoId}`));
        if (altResDoc.exists()) {
          this.yaPostulado = true;
          this.resultadoTerna = altResDoc.data();
          return;
        }

        const postRef = collection(this.firestore, 'postulaciones-terna');
        const qTerna = query(
          postRef,
          where('cargoId', '==', this.ofertaId),
          where('postulanteId', '==', user.uid)
        );
        const snapTerna = await getDocs(qTerna);
        if (!snapTerna.empty) {
          this.yaPostulado = true;
          this.resultadoTerna = snapTerna.docs[0].data();
        }
      } else {
        // Verificación normal de ofertas
        const postulacionesRef = collection(this.firestore, 'postulaciones');
        const q = query(
          postulacionesRef, 
          where('ofertaId', '==', this.ofertaId),
          where('postulanteId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          this.yaPostulado = true;
        }
      }
    } catch (error) {
      console.error('Error verificando postulación:', error);
    }
  }

  irAlCuestionario() {
    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarMensaje('Debes iniciar sesión para postular.', 'warning');
      return;
    }

    if (this.esTerna) {
      this.router.navigate(['/cuestionario', this.ofertaId], {
        queryParams: { tipo: 'terna' }
      });
    } else {
      this.router.navigate(['/cuestionario', this.ofertaId]);
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = 'information-circle';
    if (color === 'success') icono = 'checkmark-circle';
    if (color === 'warning') icono = 'warning';
    if (color === 'danger') icono = 'close-circle';

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color: color,
      cssClass: 'toast-expertimente',
      position: 'middle',
      icon: icono
    });
    await toast.present();
  }
}