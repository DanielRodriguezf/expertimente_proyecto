import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  lockClosedOutline,
  checkmarkCircle,
  closeCircle,
  warning,
  personOutline,
  callOutline,
  navigateOutline,
  fingerPrintOutline,
  globeOutline,
  businessOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-perfil-editar',
  templateUrl: './perfil-editar.page.html',
  styleUrls: ['./perfil-editar.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonInput,
    IonProgressBar,
    IonSpinner
  ]
})
export class PerfilEditarPage implements OnInit, OnDestroy {
  pasoActual: number = 1;
  totalPasos: number = 3;
  cargando: boolean = true;
  guardando: boolean = false;
  usuarioUID: string = '';

  usuario = {
    rut: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    correo: '',
    telefono: '',
    comuna: '',
    pais: '',
    ciudad: ''
  };

  private unsubAuth: AuthUnsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'lock-closed-outline': lockClosedOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'warning': warning,
      'person-outline': personOutline,
      'call-outline': callOutline,
      'navigate-outline': navigateOutline,
      'finger-print-outline': fingerPrintOutline,
      'globe-outline': globeOutline,
      'business-outline': businessOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline
    });
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioUID = user.uid;

        try {
          const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            this.ngZone.run(() => {
              this.usuario = {
                rut: data['rut'] || '',
                nombre: data['nombre'] || '',
                apellidoPaterno: data['apellidoPaterno'] || '',
                apellidoMaterno: data['apellidoMaterno'] || '',
                correo: data['correo'] || '',
                telefono: data['telefono'] || '',
                comuna: data['comuna'] || '',
                pais: data['pais'] || '',
                ciudad: data['ciudad'] || ''
              };
            });
          }
        } catch (error) {
          console.error('Error al cargar datos del perfil:', error);
        }
      }

      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      });
    });
  }

  ngOnDestroy() {
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  ionViewWillEnter() {
    this.pasoActual = 1;
    this.guardando = false;
    this.cdr.detectChanges();
  }

  irAPaso(paso: number) {
    if (paso >= 1 && paso <= this.totalPasos) {
      this.pasoActual = paso;
      this.cdr.detectChanges();
    }
  }

  siguientePaso() {
    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
      this.cdr.detectChanges();
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
      this.cdr.detectChanges();
    }
  }

  async guardarCambios() {
    if (!this.usuarioUID) return;

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);

      await updateDoc(docRef, {
        rut: this.usuario.rut,
        nombre: this.usuario.nombre.trim(),
        apellidoPaterno: this.usuario.apellidoPaterno.trim(),
        apellidoMaterno: this.usuario.apellidoMaterno.trim(),
        correo: this.usuario.correo,
        telefono: this.usuario.telefono.trim(),
        pais: this.usuario.pais.trim(),
        ciudad: this.usuario.ciudad.trim(),
        comuna: this.usuario.comuna.trim(),
        fechaActualizacionPerfil: new Date()
      });

      this.ngZone.run(() => {
        this.guardando = false;
        this.pasoActual = 1;
        this.cdr.detectChanges();
      });

      await this.mostrarMensaje('¡Tus datos fueron actualizados con éxito!', 'success');
      this.router.navigate(['/perfil']);

    } catch (error) {
      console.error('Error al actualizar el perfil:', error);
      await this.mostrarMensaje('Hubo un error al guardar los cambios.', 'danger');
      this.ngZone.run(() => {
        this.guardando = false;
        this.cdr.detectChanges();
      });
    }
  }

  private async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color,
      icon: iconos[color],
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }
}