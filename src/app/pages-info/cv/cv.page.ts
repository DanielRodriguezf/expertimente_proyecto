import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, ChangeDetectorRef, NgZone, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { LoadingController, AlertController } from '@ionic/angular';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonButton, IonIcon,
  IonLabel, IonCard, IonCardContent, IonItem,
  IonSegment, IonSegmentButton, IonSpinner
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  cloudUploadOutline, trashOutline, checkmarkCircle,
  closeCircle, warning, colorWandOutline,
  hardwareChipOutline, downloadOutline, folderOpenOutline,
  fileTrayFullOutline, bulbOutline, lockClosedOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, onSnapshot, deleteField, Unsubscribe } from '@angular/fire/firestore';

import { GeneracionCvService } from '../../services/generacion-cv';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-cv',
  templateUrl: './cv.page.html',
  styleUrls: ['./cv.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, HttpClientModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonButton, IonIcon, IonLabel,
    IonCard, IonCardContent, IonItem,
    IonSegment, IonSegmentButton, IonSpinner
  ]
})
export class CvPage implements OnInit, OnDestroy {
  modoOpcion: 'manual' | 'ia' = 'manual';

  tieneCVSubido: boolean = false;
  nombreCVSaved: string = '';
  cvSavedBase64: string = '';
  archivoSeleccionadoNombre: string = '';
  archivoBase64: string = '';

  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  private unsubAuth: AuthUnsubscribe | null = null;
  private unsubDoc: Unsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toast = inject(ToastService);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private generacionCv = inject(GeneracionCvService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({
      'cloud-upload-outline': cloudUploadOutline,
      'trash-outline': trashOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'warning': warning,
      'color-wand-outline': colorWandOutline,
      'hardware-chip-outline': hardwareChipOutline,
      'download-outline': downloadOutline,
      'folder-open-outline': folderOpenOutline,
      'file-tray-full-outline': fileTrayFullOutline,
      'bulb-outline': bulbOutline,
      'lock-closed-outline': lockClosedOutline
    });
  }

  ngOnInit() {
    this.generacionCv.terminado$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((guardado: boolean) => {
        if (guardado) {
          this.ngZone.run(() => {
            this.modoOpcion = 'manual';
            this.cdr.detectChanges();
          });
        }
      });

    this.unsubAuth = onAuthStateChanged(this.auth, (user) => {
      if (this.unsubDoc) {
        this.unsubDoc();
        this.unsubDoc = null;
      }

      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        this.unsubDoc = onSnapshot(docRef, (docSnap) => {
          this.ngZone.run(() => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data['cvBase64']) {
                this.tieneCVSubido = true;
                this.nombreCVSaved = data['cvNombre'] || 'Mi_Curriculum.pdf';
                this.cvSavedBase64 = data['cvBase64'];
              } else {
                this.tieneCVSubido = false;
                this.nombreCVSaved = '';
                this.cvSavedBase64 = '';
              }
            } else {
              this.tieneCVSubido = false;
              this.nombreCVSaved = '';
              this.cvSavedBase64 = '';
            }
            this.cdr.detectChanges();
          });
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

  ionViewWillEnter() {
    this.quitarArchivoPendiente();
  }

  alCambiarModo() {
    this.cdr.detectChanges();
  }

  abrirSelectorArchivo() {
    this.fileInput?.nativeElement.click();
  }

  async alSeleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.toast.advertencia('Selecciona un archivo PDF válido.');
      input.value = '';
      return;
    }

    if (file.size > 600 * 1024) {
      this.toast.advertencia('El PDF debe pesar menos de 600KB.');
      input.value = '';
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Preparando documento...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      this.ngZone.run(() => {
        this.archivoBase64 = base64Data;
        this.archivoSeleccionadoNombre = file.name;
        this.cdr.detectChanges();
      });

      this.toast.exito('¡Documento listo para guardar!');
    } catch (error) {
      console.error('Error al leer el archivo PDF:', error);
      this.toast.error('No se pudo leer el archivo seleccionado.');
    } finally {
      await loading.dismiss();
    }
  }

  quitarArchivoPendiente() {
    this.ngZone.run(() => {
      this.archivoBase64 = '';
      this.archivoSeleccionadoNombre = '';
      if (this.fileInput?.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
      this.cdr.detectChanges();
    });
  }

  async eliminarCVGuardado() {
    const alert = await this.alertCtrl.create({
      header: '¿Eliminar PDF?',
      cssClass: 'alerta-expertimente',
      message: 'Tu archivo actual se borrará y podrás subir o generar uno nuevo con IA.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const user = this.auth.currentUser;
            if (user) {
              const docRef = doc(this.firestore, `postulantes/${user.uid}`);
              await updateDoc(docRef, {
                cvBase64: deleteField(),
                cvNombre: deleteField(),
                cvGeneradoIA: deleteField()
              });

              this.ngZone.run(() => {
                this.tieneCVSubido = false;
                this.nombreCVSaved = '';
                this.cvSavedBase64 = '';
                this.quitarArchivoPendiente();
                this.cdr.detectChanges();
              });

              this.toast.exito('¡Archivo PDF eliminado!');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async verCVSaved() {
    if (!this.cvSavedBase64) {
      this.toast.advertencia('No hay un archivo PDF disponible.');
      return;
    }

    try {
      const nombreArchivo = (this.nombreCVSaved || 'Mi_Curriculum.pdf').replace(/\s+/g, '_');
      const base64Parts = this.cvSavedBase64.split(',');
      const base64Clean = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

      const capacitorGlobal = (window as any).Capacitor;
      if (capacitorGlobal && capacitorGlobal.isNativePlatform && capacitorGlobal.isNativePlatform()) {
        const Filesystem = capacitorGlobal.Plugins?.Filesystem;
        const Share = capacitorGlobal.Plugins?.Share;

        if (Filesystem) {
          try {
            const savedFile = await Filesystem.writeFile({
              path: nombreArchivo,
              data: base64Clean,
              directory: 'DOCUMENTS'
            });

            this.toast.exito(`Descargado en Documentos: ${nombreArchivo}`);

            if (Share) {
              await Share.share({
                title: nombreArchivo,
                url: savedFile.uri,
                dialogTitle: 'Abrir o guardar mi CV'
              });
            }
            return;
          } catch (fsError) {
            console.warn('Fallback a descarga de navegador:', fsError);
          }
        }
      }

      const byteCharacters = atob(base64Clean);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      const enlace = document.createElement('a');
      enlace.style.display = 'none';
      enlace.href = blobUrl;
      enlace.setAttribute('download', nombreArchivo);
      document.body.appendChild(enlace);

      enlace.click();
      document.body.removeChild(enlace);

      this.toast.exito('Descargando archivo PDF en tu dispositivo...');

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);

    } catch (error) {
      console.error('Error al descargar el PDF:', error);
      this.toast.error('No se pudo descargar el archivo PDF.');
    }
  }

  async guardarDatos() {
    if (!this.archivoBase64) {
      this.toast.advertencia('No hay ningún archivo nuevo para guardar');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) return;

    const loading = await this.loadingCtrl.create({
      message: 'Guardando PDF...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const nuevoBase64 = this.archivoBase64;
      const nuevoNombre = this.archivoSeleccionadoNombre || 'Mi_Curriculum.pdf';

      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await updateDoc(docRef, {
        cvBase64: nuevoBase64,
        cvNombre: nuevoNombre,
        fechaActualizacionPerfil: new Date()
      });

      this.ngZone.run(() => {
        this.tieneCVSubido = true;
        this.cvSavedBase64 = nuevoBase64;
        this.nombreCVSaved = nuevoNombre;
        this.archivoBase64 = '';
        this.archivoSeleccionadoNombre = '';
        if (this.fileInput?.nativeElement) {
          this.fileInput.nativeElement.value = '';
        }
        this.cdr.detectChanges();
      });

      this.toast.exito('¡Tu currículum PDF se ha guardado con éxito!');
    } catch (error) {
      this.toast.error('Hubo un error al guardar.');
    } finally {
      await loading.dismiss();
    }
  }

  get generandoCV(): boolean {
    return this.generacionCv.generando();
  }

  async generarCVConIA() {
    if (this.tieneCVSubido) {
      this.toast.advertencia('Primero debes quitar tu PDF actual para generar uno nuevo con IA.');
      return;
    }
    await this.generacionCv.iniciar(this.router.url);
  }
}