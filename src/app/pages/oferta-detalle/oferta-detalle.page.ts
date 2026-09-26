import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonFooter, ToastController, LoadingController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  locationOutline, starOutline, callOutline, mailOutline, checkmarkCircle 
} from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { 
  Firestore, doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, increment 
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
    IonFooter // <-- Agregado aquí para que reconozca el footer
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
  private loadingCtrl = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'location-outline': locationOutline,
      'star-outline': starOutline,
      'call-outline': callOutline,
      'mail-outline': mailOutline,
      'checkmark-circle': checkmarkCircle
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

  async postularse() {
    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarMensaje('Debes iniciar sesión para postular.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Enviando postulación...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const postulacionData = {
        ofertaId: this.ofertaId,
        postulanteId: user.uid,
        tituloOferta: this.oferta.titulo,
        nombreEmpresa: this.oferta.nombreEmpresa,
        estado: 'Enviada',
        fechaPostulacion: new Date()
      };

      await addDoc(collection(this.firestore, 'postulaciones'), postulacionData);

      const ofertaRef = doc(this.firestore, `ofertas/${this.ofertaId}`);
      await updateDoc(ofertaRef, {
        candidatosCount: increment(1)
      });

      this.yaPostulado = true;
      await loading.dismiss();
      
      this.mostrarMensaje('¡Postulación enviada con éxito!', 'success');
      
      setTimeout(() => {
        this.router.navigate(['/search']);
      }, 1500);

    } catch (error) {
      await loading.dismiss();
      console.error('Error al postular:', error);
      this.mostrarMensaje('Hubo un error al enviar tu postulación.', 'danger');
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = 'information-circle';
    if (color === 'success') icono = 'checkmark-circle';
    if (color === 'warning') icono = 'warning';
    if (color === 'danger') icono = 'close-circle';

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color: color,
      cssClass: 'toast-expertimente',
      position: 'middle',
      icon: icono
    });
    await toast.present();
  }
}