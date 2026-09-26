import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonButton, 
  IonIcon,
  IonSpinner,
  IonModal,
  IonTitle,
  IonButtons,
  ToastController,
  AlertController 
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  briefcaseOutline, 
  addOutline, 
  logOutOutline,
  createOutline,
  trashOutline,
  powerOutline,
  locationOutline,
  mailOutline,
  callOutline,
  peopleOutline,
  closeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  personOutline,
  documentTextOutline,
  schoolOutline,
  timeOutline,
  starOutline
} from 'ionicons/icons';

import { Auth, signOut, onAuthStateChanged, User, Unsubscribe } from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  updateDoc, 
  getDocs,
  addDoc
} from '@angular/fire/firestore';

export interface OfertaTrabajo {
  id: string;
  titulo: string;
  descripcion: string;
  modalidad: string;
  direccion?: string;
  habilidades?: string;
  contactoEmail: string;
  contactoTelefono?: string;
  estado: 'Activa' | 'Inactiva';
  fechaPublicacion?: any;
  reclutadorId?: string;
}

export interface PostulanteCompleto {
  postulacionId: string;
  postulanteId: string;
  fechaPostulacion?: any;
  estado: 'Pendiente' | 'Aceptado' | 'Rechazado';
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  cvManual?: {
    nivelEducativo?: string;
    areaExperiencia?: string;
    anosExperiencia?: number | string;
    habilidades?: string;
  };
  cvBase64?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonSpinner,
    IonModal,
    IonTitle,
    IonButtons
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  nombreReclutador = '';
  nombreEmpresa = '';
  isLoading = true;

  ofertas: OfertaTrabajo[] = [];

  // MODAL Y POSTULANTES
  isModalPostulantesOpen = false;
  cargandoPostulantes = false;
  ofertaSeleccionada: OfertaTrabajo | null = null;
  postulantesList: PostulanteCompleto[] = [];

  private authUnsubscribe?: Unsubscribe;
  private snapshotUnsubscribe?: Unsubscribe;

  private empresasMockMap: { [key: string]: string } = {
    'emp_001': 'Tech Corp Chile',
    'emp_002': 'Innovación Global S.A.',
    'emp_003': 'Desarrollos Rápidos'
  };

  get primerNombre(): string {
    if (!this.nombreReclutador || this.nombreReclutador.toLowerCase() === 'reclutador') {
      const email = this.auth.currentUser?.email;
      if (email) {
        const handle = email.split('@')[0];
        return handle.charAt(0).toUpperCase() + handle.slice(1);
      }
      return 'Usuario';
    }
    return this.nombreReclutador.trim().split(' ')[0];
  }

  get totalOfertasActivas(): number {
    return this.ofertas.filter(o => o.estado === 'Activa').length;
  }

  constructor() {
    addIcons({
      'briefcase-outline': briefcaseOutline,
      'add-outline': addOutline,
      'log-out-outline': logOutOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      'power-outline': powerOutline,
      'location-outline': locationOutline,
      'mail-outline': mailOutline,
      'call-outline': callOutline,
      'people-outline': peopleOutline,
      'close-outline': closeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'person-outline': personOutline,
      'document-text-outline': documentTextOutline,
      'school-outline': schoolOutline,
      'time-outline': timeOutline,
      'star-outline': starOutline
    });
  }

  ngOnInit() {
    this.iniciarObservadorAuth();
  }

  ionViewWillEnter() {
    const user = this.auth.currentUser;
    if (user) {
      this.cargarTodo(user);
    } else {
      this.iniciarObservadorAuth();
    }
  }

  ionViewWillLeave() {
    this.limpiarSuscripcionOfertas();
  }

  ngOnDestroy() {
    if (this.authUnsubscribe) this.authUnsubscribe();
    this.limpiarSuscripcionOfertas();
  }

  private limpiarSuscripcionOfertas() {
    if (this.snapshotUnsubscribe) {
      this.snapshotUnsubscribe();
      this.snapshotUnsubscribe = undefined;
    }
  }

  private iniciarObservadorAuth() {
    if (this.authUnsubscribe) return;

    this.authUnsubscribe = onAuthStateChanged(this.auth, (user: User | null) => {
      if (user) {
        this.cargarTodo(user);
      } else {
        this.ngZone.run(() => {
          this.router.navigate(['/auth/login']);
        });
      }
    });
  }

  private async cargarTodo(user: User) {
    this.ngZone.run(() => {
      this.isLoading = true;
      this.cdr.detectChanges();
    });

    await this.cargarPerfilReclutador(user);
    this.escucharOfertasReales(user.uid);
  }

  async cargarPerfilReclutador(user: User) {
    try {
      const docRef = doc(this.firestore, 'reclutadores', user.uid);
      const docSnap = await getDoc(docRef);

      let nombreEncontrado = '';
      let empresaEncontrada = '';

      if (docSnap.exists()) {
        const data = docSnap.data();
        nombreEncontrado = data['nombre'] || data['nombreCompleto'] || data['nombreReclutador'] || '';
        
        const empId = data['empresaId'];
        if (empId) {
          if (this.empresasMockMap[empId]) {
            empresaEncontrada = this.empresasMockMap[empId];
          } else {
            const empRef = doc(this.firestore, 'empresas', empId);
            const empSnap = await getDoc(empRef);
            if (empSnap.exists()) {
              empresaEncontrada = empSnap.data()['nombre'] || '';
            }
          }
        }
      }

      if (!nombreEncontrado) {
        nombreEncontrado = user.displayName || user.email?.split('@')[0] || 'Usuario';
      }

      this.ngZone.run(() => {
        this.nombreReclutador = nombreEncontrado;
        this.nombreEmpresa = empresaEncontrada;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
    }
  }

  escucharOfertasReales(reclutadorUid: string) {
    this.limpiarSuscripcionOfertas();

    const q = query(
      collection(this.firestore, 'ofertas'),
      where('reclutadorId', '==', reclutadorUid)
    );

    this.snapshotUnsubscribe = onSnapshot(q, (snapshot) => {
      this.ngZone.run(() => {
        this.ofertas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as OfertaTrabajo[];

        this.isLoading = false;
        this.cdr.detectChanges();
      });
    }, (error) => {
      console.error('Error al escuchar cambios en ofertas:', error);
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    });
  }

  async verPostulantes(oferta: OfertaTrabajo) {
    this.ofertaSeleccionada = oferta;
    this.isModalPostulantesOpen = true;
    this.cargandoPostulantes = true;
    this.postulantesList = [];
    this.cdr.detectChanges();

    try {
      const postulacionesRef = collection(this.firestore, 'postulaciones');
      const q = query(postulacionesRef, where('ofertaId', '==', oferta.id));
      const querySnapshot = await getDocs(q);

      const tempPostulantes: PostulanteCompleto[] = [];

      for (const postulacionDoc of querySnapshot.docs) {
        const dataPostulacion = postulacionDoc.data();
        const postulanteId = dataPostulacion['postulanteId'];

        if (postulanteId) {
          const userDocRef = doc(this.firestore, `postulantes/${postulanteId}`);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            tempPostulantes.push({
              postulacionId: postulacionDoc.id,
              postulanteId: postulanteId,
              fechaPostulacion: dataPostulacion['fechaPostulacion'],
              estado: dataPostulacion['estado'] || 'Pendiente',
              nombres: userData['nombres'] || userData['nombre'] || 'Candidato',
              apellidos: userData['apellidos'] || '',
              correo: userData['correo'] || userData['email'] || 'Sin correo',
              telefono: userData['telefono'] || userData['celular'] || '',
              cvManual: userData['cvManual'] || null,
              cvBase64: userData['cvBase64'] || null
            });
          }
        }
      }

      this.ngZone.run(() => {
        this.postulantesList = tempPostulantes;
        this.cargandoPostulantes = false;
        this.cdr.detectChanges();
      });

    } catch (error) {
      console.error('Error al cargar postulantes:', error);
      this.ngZone.run(() => {
        this.cargandoPostulantes = false;
        this.cdr.detectChanges();
      });
    }
  }

  async cambiarEstadoPostulante(p: PostulanteCompleto, nuevoEstado: 'Aceptado' | 'Rechazado') {
    try {
      p.estado = nuevoEstado;

      if (p.postulacionId) {
        await updateDoc(doc(this.firestore, 'postulaciones', p.postulacionId), {
          estado: nuevoEstado
        });
      }

      if (nuevoEstado === 'Aceptado') {
        await addDoc(collection(this.firestore, 'notificaciones'), {
          postulanteId: p.postulanteId,
          ofertaId: this.ofertaSeleccionada?.id || '',
          tituloOferta: this.ofertaSeleccionada?.titulo || 'Oferta de empleo',
          nombreEmpresa: this.nombreEmpresa || 'La Empresa',
          mensaje: `¡Felicidades ${p.nombres}! Has sido aceptado para el puesto de "${this.ofertaSeleccionada?.titulo}". Se pondrán en contacto contigo.`,
          fecha: new Date(),
          leido: false,
          tipo: 'seleccionado'
        });
      }

      const mensajeToast = nuevoEstado === 'Aceptado'
        ? `Candidato ${p.nombres} aceptado y notificación enviada.`
        : `Candidato ${p.nombres} rechazado.`;

      this.mostrarToast(mensajeToast);

      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error al actualizar estado o enviar notificación:', error);
      this.mostrarToast('Error al procesar la solicitud.');
    }
  }

  verCV(cvBase64: string) {
    if (cvBase64) {
      const ventana = window.open();
      ventana?.document.write(`
        <body style="margin:0; padding:0; background-color: #ffffff;">
          <iframe width="100%" height="100%" style="border:none;" src="${cvBase64}"></iframe>
        </body>
      `);
    } else {
      this.mostrarToast('Este postulante no adjuntó archivo PDF.');
    }
  }

  cerrarModalPostulantes() {
    this.isModalPostulantesOpen = false;
    this.ofertaSeleccionada = null;
    this.postulantesList = [];
  }

  scrollAOfertas() {
    const elemento = document.getElementById('seccion-ofertas');
    if (elemento) {
      elemento.scrollIntoView({ behavior: 'smooth' });
    }
  }

  crearOferta() {
    this.router.navigate(['/crear-oferta']);
  }

  editarOferta(ofertaId: string) {
    // CAMBIO IMPORTANTE: Apunta a crear-oferta pasando el ID para re-utilizar el formulario de creación.
    this.router.navigate(['/crear-oferta', ofertaId]);
  }

  async cambiarEstadoOferta(oferta: OfertaTrabajo) {
    const nuevoEstado = oferta.estado === 'Activa' ? 'Inactiva' : 'Activa';
    try {
      await updateDoc(doc(this.firestore, 'ofertas', oferta.id), {
        estado: nuevoEstado
      });
      this.mostrarToast(`Oferta marcada como ${nuevoEstado.toLowerCase()}.`);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  }

  async confirmarEliminarOferta(ofertaId: string) {
    const alert = await this.alertController.create({
      header: 'Eliminar oferta',
      message: '¿Estás seguro de que deseas eliminar esta oferta? Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, 'ofertas', ofertaId));
              this.mostrarToast('Oferta eliminada correctamente.');
            } catch (error) {
              console.error('Error al eliminar oferta:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async cerrarSesion() {
    try {
      this.limpiarSuscripcionOfertas();
      if (this.authUnsubscribe) {
        this.authUnsubscribe();
        this.authUnsubscribe = undefined;
      }
      await signOut(this.auth);
      this.ngZone.run(() => {
        this.router.navigate(['/login']).catch(() => {
          this.router.navigate(['/auth/login']).catch(() => {
            window.location.href = '/login';
          });
        });
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      window.location.href = '/login';
    }
  }

  private async mostrarToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'top'
    });
    await toast.present();
  }
}