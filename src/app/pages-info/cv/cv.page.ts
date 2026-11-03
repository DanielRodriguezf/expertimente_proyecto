import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef, NgZone, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { LoadingController, AlertController, Platform } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon,
  IonLabel, IonCard, IonCardContent, IonItem,
  IonSegment, IonSegmentButton, IonSpinner
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, documentTextOutline, 
  trashOutline, eyeOutline, checkmarkCircle, 
  closeCircle, informationCircle, warning, sparklesOutline, 
  hardwareChipOutline, downloadOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, onSnapshot, deleteField } from '@angular/fire/firestore';

import { GeneracionCvService } from '../../services/generacion-cv';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-cv',
  templateUrl: './cv.page.html',
  styleUrls: ['./cv.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, HttpClientModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, 
    IonButton, IonIcon, IonLabel, 
    IonCard, IonCardContent, IonItem,
    IonSegment, IonSegmentButton, IonSpinner
  ]
})
export class CvPage implements OnInit {
  modoOpcion: 'manual' | 'ia' = 'manual';
  
  tieneCVSubido: boolean = false;
  nombreCVSaved: string = '';
  cvSavedBase64: string = '';
  archivoSeleccionadoNombre: string = '';
  archivoBase64: string = ''; 
  
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toast = inject(ToastService);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private platform = inject(Platform);
  private generacionCv = inject(GeneracionCvService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({
      'cloud-upload-outline': cloudUploadOutline,
      'document-text-outline': documentTextOutline,
      'trash-outline': trashOutline,
      'eye-outline': eyeOutline,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      'information-circle': informationCircle,
      'warning': warning,
      'sparkles-outline': sparklesOutline,
      'hardware-chip-outline': hardwareChipOutline,
      'download-outline': downloadOutline
    });
  }

  ngOnInit() {
    this.generacionCv.terminado$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((guardado: boolean) => {
        if (guardado) {
          this.modoOpcion = 'manual';
          this.cdr.detectChanges();
        }
      });

    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        onSnapshot(docRef, (docSnap) => {
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
              this.cdr.detectChanges();
            }
          });
        });
      }
    });
  }

  ionViewWillEnter() {
    this.quitarArchivoPendiente();
  }

  abrirSelectorArchivo() {
    this.fileInput.nativeElement.click();
  }

  async alSeleccionarArchivo(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.toast.advertencia('Selecciona un archivo PDF válido.');
        return;
      }
      if (file.size > 600 * 1024) { 
        this.toast.advertencia('El PDF debe pesar menos de 600KB.');
        return;
      }
      const loading = await this.loadingCtrl.create({
        message: 'Preparando documento...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const reader = new FileReader();
        reader.onload = () => {
          this.archivoBase64 = reader.result as string; 
          this.archivoSeleccionadoNombre = file.name;
          this.cdr.detectChanges(); 
          this.toast.exito('¡Documento cargado con éxito!');
        };
        reader.readAsDataURL(file);
      } finally {
        await loading.dismiss();
      }
    }
  }

  quitarArchivoPendiente() {
    this.archivoBase64 = '';
    this.archivoSeleccionadoNombre = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.cdr.detectChanges(); 
  }

  async eliminarCVGuardado() {
    const alert = await this.alertCtrl.create({
      header: '¿Eliminar PDF?',
      cssClass: 'alerta-expertimente',
      message: 'Tu archivo se borrará de tu perfil.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const user = this.auth.currentUser;
            if (user) {
              const docRef = doc(this.firestore, `postulantes/${user.uid}`);
              await updateDoc(docRef, { cvBase64: deleteField(), cvNombre: deleteField(), cvGeneradoIA: deleteField() });
              this.quitarArchivoPendiente();
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
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const payload: any = {
        cvBase64: this.archivoBase64,
        cvNombre: this.archivoSeleccionadoNombre,
        fechaActualizacionPerfil: new Date()
      };
      
      await updateDoc(docRef, payload);
      this.quitarArchivoPendiente(); 
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
    await this.generacionCv.iniciar(this.router.url);
  }
}