import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ToastController, LoadingController } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonButton, IonIcon,
  IonSpinner, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
  IonFooter
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { 
  Firestore, doc, getDoc, collection, addDoc, updateDoc, increment 
} from '@angular/fire/firestore';

@Component({
  selector: 'app-cuestionario',
  templateUrl: './cuestionario.page.html',
  styleUrls: ['./cuestionario.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
    IonCard, IonCardContent, IonButton, IonSpinner,
    IonRadioGroup, IonRadio, IonItem, IonProgressBar, IonFooter
  ]
})
export class CuestionarioPage implements OnInit {
  
  ofertaId: string = '';
  oferta: any = null;
  preguntas: any[] = [];
  cargando: boolean = true;
  
  respuestas: { [key: number]: number } = {};
  
  // Control de pasos
  pasoActual: number = 1;
  get totalPasos(): number {
    return this.preguntas.length > 0 ? this.preguntas.length : 1;
  }

  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({ 'arrow-back-outline': arrowBackOutline });
  }

  ngOnInit() {
    this.ofertaId = this.route.snapshot.paramMap.get('id') || '';
    if (this.ofertaId) {
      this.cargarCuestionario();
    }
  }

  async cargarCuestionario() {
    this.cargando = true;
    try {
      const docRef = doc(this.firestore, `ofertas/${this.ofertaId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        this.oferta = docSnap.data();
        if (this.oferta.cuestionario && this.oferta.cuestionario.preguntas) {
          this.preguntas = this.oferta.cuestionario.preguntas;
        }
      } else {
        this.mostrarMensaje('La oferta ya no está disponible.', 'warning');
        this.router.navigate(['/search']);
      }
    } catch (error) {
      console.error('Error al cargar cuestionario:', error);
      this.mostrarMensaje('Error al cargar las preguntas.', 'danger');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  siguientePaso(indexPregunta: number) {
    if (this.respuestas[indexPregunta] === undefined) {
      this.mostrarMensaje('Por favor selecciona una opción.', 'warning');
      return;
    }
    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
    }
  }

  async finalizarPostulacion() {
    // Validar la última pregunta antes de enviar
    if (this.respuestas[this.totalPasos - 1] === undefined) {
      this.mostrarMensaje('Por favor selecciona una opción para finalizar.', 'warning');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) return;

    const loading = await this.loadingCtrl.create({
      message: 'Evaluando perfil y enviando postulación...',
      spinner: 'crescent',
      cssClass: 'loading-expertimente'
    });
    await loading.present();

    try {
      const puntajeTotal = Object.values(this.respuestas).reduce((total, valor) => total + valor, 0);

      const postulacionData = {
        ofertaId: this.ofertaId,
        postulanteId: user.uid,
        tituloOferta: this.oferta.titulo,
        nombreEmpresa: this.oferta.nombreEmpresa,
        estado: 'Enviada',
        fechaPostulacion: new Date(),
        puntajeIdoneidad: puntajeTotal
      };

      await addDoc(collection(this.firestore, 'postulaciones'), postulacionData);

      const ofertaRef = doc(this.firestore, `ofertas/${this.ofertaId}`);
      await updateDoc(ofertaRef, { candidatosCount: increment(1) });

      await loading.dismiss();
      this.mostrarMensaje('¡Postulación exitosa! Ya estás en el proceso.', 'success');
      
      setTimeout(() => {
        this.router.navigate(['/search']);
      }, 2000);

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
      duration: 2500,
      color: color,
      cssClass: 'toast-expertimente',
      position: 'middle',
      icon: icono
    });
    await toast.present();
  }
}