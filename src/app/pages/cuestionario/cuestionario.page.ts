import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ToastController, LoadingController } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon,
  IonSpinner, IonRadioGroup, IonRadio, IonProgressBar,
  IonFooter, IonTextarea
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { 
  Firestore, doc, getDoc, collection, addDoc, updateDoc, increment, setDoc 
} from '@angular/fire/firestore';

@Component({
  selector: 'app-cuestionario',
  templateUrl: './cuestionario.page.html',
  styleUrls: ['./cuestionario.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon,
    IonButton, IonSpinner, IonTextarea,
    IonRadioGroup, IonRadio, IonProgressBar, IonFooter
  ]
})
export class CuestionarioPage implements OnInit {
  
  ofertaId: string = '';
  esTerna: boolean = false;
  oferta: any = null;
  preguntas: any[] = [];
  cargando: boolean = true;
  
  respuestas: { [key: number]: any } = {};
  
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
    const tipoParam = this.route.snapshot.queryParamMap.get('tipo');
    this.esTerna = tipoParam === 'terna';

    if (this.ofertaId) {
      this.cargarCuestionario();
    }
  }

  async cargarCuestionario() {
    this.cargando = true;
    try {
      const coleccion = this.esTerna ? 'cargos' : 'ofertas';
      const docRef = doc(this.firestore, `${coleccion}/${this.ofertaId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        this.oferta = docSnap.data();
        if (this.oferta.preguntas) {
          this.preguntas = this.oferta.preguntas;
        }
      } else {
        this.mostrarMensaje('El registro ya no está disponible.', 'warning');
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

  isRespuestaInvalida(index: number): boolean {
    const resp = this.respuestas[index];
    if (resp === undefined || resp === null) return true;
    if (typeof resp === 'string' && resp.trim() === '') return true;
    return false;
  }

  siguientePaso(indexPregunta: number) {
    if (this.isRespuestaInvalida(indexPregunta)) {
      this.mostrarMensaje('Por favor responde la pregunta para continuar.', 'warning');
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
    if (this.isRespuestaInvalida(this.totalPasos - 1)) {
      this.mostrarMensaje('Por favor responde la última pregunta para finalizar.', 'warning');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarMensaje('Debes iniciar sesión para postular.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Enviando postulación...',
      spinner: 'crescent',
      cssClass: 'loading-expertimente'
    });
    await loading.present();

    try {
      let puntajeObtenido = 0;
      let puntajeMaximo = 0;

      // Calculamos el puntaje de manera interna para que el reclutador lo vea, sin mostrarlo al postulante
      this.preguntas.forEach((pregunta, index) => {
        const respuestaDada = this.respuestas[index];
        let ptsElegidos = 0;
        let maxPregunta = 0;

        if (typeof respuestaDada === 'object' && respuestaDada !== null) {
          ptsElegidos = Number(respuestaDada.puntaje || 0);
        } else if (typeof respuestaDada === 'number') {
          ptsElegidos = respuestaDada;
        }

        puntajeObtenido += ptsElegidos;

        if (Array.isArray(pregunta.opciones)) {
          maxPregunta = Math.max(...pregunta.opciones.map((o: any) => Number(o.puntaje || 0)), 0);
        }
        puntajeMaximo += maxPregunta;
      });

      const porcentajeIdoneidad = puntajeMaximo > 0
        ? Math.round((puntajeObtenido / puntajeMaximo) * 100)
        : 0;

      if (this.esTerna) {
        // --- GUARDAR COMO TERNA (Colección 'resultados') ---
        const postSnap = await getDoc(doc(this.firestore, `postulantes/${user.uid}`));
        const postulanteData = postSnap.exists() ? postSnap.data() : null;

        const resultadoId = `${user.uid}_${this.ofertaId}`;
        const resultadoRef = doc(this.firestore, `postulaciones-terna/${resultadoId}`);

        const payloadResultado = {
          estado: 'Enviada',
          postulanteId: user.uid,
          cargoId: this.ofertaId,
          nombreCargo: this.oferta.nombre || '',
          empresaId: this.oferta.empresaId || '',
          reclutadorId: this.oferta.reclutadorId || '',
          puntajeObtenido,
          puntajeMaximo,
          porcentajeIdoneidad,
          fechaRespuesta: new Date(),
          postulanteSnapshot: {
            uid: user.uid,
            nombre: postulanteData?.['nombre'] || '',
            apellidoPaterno: postulanteData?.['apellidoPaterno'] || '',
            apellidoMaterno: postulanteData?.['apellidoMaterno'] || '',
            rut: postulanteData?.['rut'] || '',
            correo: postulanteData?.['correo'] || '',
            telefono: postulanteData?.['telefono'] || '',
            ciudad: postulanteData?.['ciudad'] || '',
            comuna: postulanteData?.['comuna'] || '',
            fotoPerfil: postulanteData?.['fotoPerfil'] || '',
            cvManual: postulanteData?.['cvManual'] || null,
            cvBase64: postulanteData?.['cvBase64'] || ''
          }
        };

        await setDoc(resultadoRef, payloadResultado, { merge: true });

      } else {
        // --- GUARDAR COMO OFERTA NORMAL (Colección 'postulaciones') ---
        const postulacionData = {
          ofertaId: this.ofertaId,
          postulanteId: user.uid,
          tituloOferta: this.oferta.titulo,
          nombreEmpresa: this.oferta.nombreEmpresa,
          estado: 'Enviada',
          fechaPostulacion: new Date(),
          puntajeIdoneidad: puntajeObtenido
        };

        await addDoc(collection(this.firestore, 'postulaciones'), postulacionData);

        const ofertaRef = doc(this.firestore, `ofertas/${this.ofertaId}`);
        await updateDoc(ofertaRef, { candidatosCount: increment(1) });
      }

      await loading.dismiss();
      // Mensaje general de éxito sin revelar puntaje al candidato
      this.mostrarMensaje('¡Postulación enviada con éxito!', 'success');
      
      setTimeout(() => {
        this.router.navigate(['/home']);
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