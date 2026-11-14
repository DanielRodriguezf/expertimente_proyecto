import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner,
  AlertController,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personOutline,
  createOutline,
  trashOutline,
  mailOutline,
  callOutline,
  navigateOutline,
  fingerPrintOutline,
  alertCircleOutline,
  checkmarkCircle,
  closeCircle,
  warning
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, signOut, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, updateDoc, Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonSpinner
  ]
})
export class PerfilPage implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private unsubAuth: AuthUnsubscribe | null = null;
  private unsubDoc: Unsubscribe | null = null;

  usuarioData: any = null;
  cargando: boolean = true;
  usuarioUID: string = '';

  constructor() {
    addIcons({
      'person-outline': personOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      'mail-outline': mailOutline,
      'call-outline': callOutline,
      'navigate-outline': navigateOutline,
      'finger-print-outline': fingerPrintOutline,
      'alert-circle-outline': alertCircleOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'warning': warning
    });
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, (user) => {
      if (this.unsubDoc) {
        this.unsubDoc();
        this.unsubDoc = null;
      }

      if (user) {
        this.usuarioUID = user.uid;
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);

        this.unsubDoc = onSnapshot(docRef, (docSnap) => {
          this.ngZone.run(() => {
            if (docSnap.exists()) {
              this.usuarioData = docSnap.data();
            } else {
              this.usuarioData = null;
            }
            this.cargando = false;
            this.cdr.detectChanges();
          });
        }, (error) => {
          console.error('Error al escuchar el perfil:', error);
          this.ngZone.run(() => {
            this.cargando = false;
            this.cdr.detectChanges();
          });
        });
      } else {
        this.ngZone.run(() => {
          this.usuarioUID = '';
          this.usuarioData = null;
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubDoc) {
      this.unsubDoc();
      this.unsubDoc = null;
    }
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  modificarPerfil() {
    this.router.navigate(['/perfil-editar']);
  }

  async borrarCuenta() {
    const alert = await this.alertCtrl.create({
      header: '¿Desactivar tu cuenta?',
      cssClass: 'alerta-expertimente',
      message: 'Tu perfil quedará inactivo y dejarás de ser visible para las empresas. Podrás reactivarlo iniciando sesión de nuevo.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Sí, Desactivar',
          role: 'destructive',
          handler: async () => {
            await this.ejecutarDesactivacion();
          }
        }
      ]
    });

    await alert.present();
  }

  private async ejecutarDesactivacion() {
    if (!this.usuarioUID) return;

    try {
      this.cargando = true;
      this.cdr.detectChanges();

      const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
      await updateDoc(docRef, {
        estadoCuenta: 'inactiva',
        fechaDesactivacion: new Date().toISOString()
      });

      await signOut(this.auth);
      await this.mostrarMensaje('Tu cuenta ha sido desactivada.', 'success');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al desactivar la cuenta:', error);
      await this.mostrarMensaje('Hubo un error al desactivar tu cuenta. Inténtalo más tarde.', 'danger');
    } finally {
      this.ngZone.run(() => {
        this.cargando = false;
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