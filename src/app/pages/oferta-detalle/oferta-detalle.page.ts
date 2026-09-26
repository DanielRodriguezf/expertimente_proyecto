import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonFooter, ToastController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  locationOutline, starOutline, callOutline, mailOutline, checkmarkCircle, informationCircle, warning, closeCircle 
} from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
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
export class OfertaDetallePage implements OnInit {
  
  ofertaId: string = '';
  oferta: any = null;
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
      'close-circle': closeCircle
    });
  }

  ngOnInit() {
    this.ofertaId = this.route.snapshot.paramMap.get('id') || '';
    if (this.ofertaId) {
      this.cargarDetalleOferta();
    }
  }

  async cargarDetalleOferta() {
    this.cargando = true;
    try {
      const docRef = doc(this.firestore, `ofertas/${this.ofertaId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        this.oferta = docSnap.data();
        await this.verificarSiYaPostulo();
      } else {
        this.mostrarMensaje('La oferta ya no está disponible.', 'warning');
        this.router.navigate(['/search']);
      }
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      this.mostrarMensaje('Error al cargar la información.', 'danger');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async verificarSiYaPostulo() {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
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
    
    // Asumo que la ruta de tu componente de cuestionario se llama 'cuestionario'
    // y recibe el id de la oferta por la URL. Si se llama diferente, ajusta la ruta aquí:
    this.router.navigate(['/cuestionario', this.ofertaId]);
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