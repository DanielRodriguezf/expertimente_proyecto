import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { ToastController, LoadingController, AlertController, Platform } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon,
  IonLabel, IonCard, IonCardContent, IonItem,
  IonSegment, IonSegmentButton
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, documentTextOutline, 
  trashOutline, eyeOutline, checkmarkCircle, 
  closeCircle, informationCircle, warning, sparklesOutline, 
  hardwareChipOutline, downloadOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, onSnapshot, deleteField, getDoc, serverTimestamp } from '@angular/fire/firestore';

import { jsPDF } from 'jspdf';
import { GoogleGenAI } from '@google/genai';

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
    IonSegment, IonSegmentButton
  ]
})
export class CvPage implements OnInit {
  modoOpcion: 'manual' | 'ia' = 'manual';
  
  tieneCVSubido: boolean = false;
  nombreCVSaved: string = '';
  cvSavedBase64: string = '';
  archivoSeleccionadoNombre: string = '';
  archivoBase64: string = ''; 
  
  formularioIA = {
    oficio: '',
    experiencia: '',
    habilidades: ''
  };

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private platform = inject(Platform);

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
        this.mostrarMensaje('Selecciona un archivo PDF válido.', 'warning');
        return;
      }
      if (file.size > 600 * 1024) { 
        this.mostrarMensaje('El PDF debe pesar menos de 600KB.', 'warning');
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
          this.mostrarMensaje('¡Documento cargado con exito!', 'success');
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
              this.mostrarMensaje('¡Archivo PDF eliminado!', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async verCVSaved() {
    if (!this.cvSavedBase64) {
      this.mostrarMensaje('No hay un archivo PDF disponible.', 'warning');
      return;
    }

    try {
      const nombreArchivo = (this.nombreCVSaved || 'Mi_Curriculum.pdf').replace(/\s+/g, '_');
      const base64Parts = this.cvSavedBase64.split(',');
      const base64Clean = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

      // 1. Si está corriendo dentro de APK nativa (Capacitor) y tiene el plugin Filesystem disponible
      const capacitorGlobal = (window as any).Capacitor;
      if (capacitorGlobal && capacitorGlobal.isNativePlatform && capacitorGlobal.isNativePlatform()) {
        const Filesystem = capacitorGlobal.Plugins?.Filesystem;
        const Share = capacitorGlobal.Plugins?.Share;

        if (Filesystem) {
          try {
            // Guarda directamente en la carpeta Documents/Download del teléfono
            const savedFile = await Filesystem.writeFile({
              path: nombreArchivo,
              data: base64Clean,
              directory: 'DOCUMENTS'
            });

            this.mostrarMensaje(`Descargado en Documentos: ${nombreArchivo}`, 'success');

            // Si además está el plugin Share, abre el diálogo nativo para visualizarlo de inmediato
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

      // 2. Conversión a Blob para descarga directa en el dispositivo (Android Chrome / iOS Safari / PC)
      const byteCharacters = atob(base64Clean);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Usamos application/octet-stream para obligar al navegador móvil a DESCARGAR el archivo en vez de bloquearlo
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      const enlace = document.createElement('a');
      enlace.style.display = 'none';
      enlace.href = blobUrl;
      enlace.setAttribute('download', nombreArchivo);
      document.body.appendChild(enlace);
      
      // Ejecución síncrona directa para que Android/iOS no bloquee la descarga
      enlace.click();
      document.body.removeChild(enlace);

      this.mostrarMensaje('Descargando archivo PDF en tu dispositivo...', 'success');

      // Liberamos el objeto después de 60 segundos para dar tiempo a la descarga en móvil
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);

    } catch (error) {
      console.error('Error al descargar el PDF:', error);
      this.mostrarMensaje('No se pudo descargar el archivo PDF.', 'danger');
    }
  }

  async guardarDatos() {
    if (!this.archivoBase64) {
      this.mostrarMensaje('No hay ningún archivo nuevo para guardar', 'warning');
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
      this.mostrarMensaje('¡Tu currículum PDF se ha guardado con éxito!', 'success');
    } catch (error) {
      this.mostrarMensaje('Hubo un error al guardar.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async generarCVConIA() {
    const user = this.auth.currentUser;
    if (!user) return;

    const loading = await this.loadingCtrl.create({
      message: 'Conectando con la IA...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        this.mostrarMensaje('No se encontraron tus datos en la base de datos.', 'danger');
        return;
      }

      const datosBD = docSnap.data();
      const cvManual = datosBD['cvManual'];

      // Validación reforzada para evitar errores si areasExperiencia viene vacío o no es un arreglo
      const tieneExperiencia = cvManual && Array.isArray(cvManual['areasExperiencia']) && cvManual['areasExperiencia'].length > 0;
      const sinExperiencia = datosBD['sinExperiencia'] === true || (cvManual && cvManual['sinExperiencia'] === true);

      if (
        !datosBD['nombre'] || 
        !cvManual || 
        !cvManual['nivelEducativo'] || 
        !cvManual['habilidadesTecnicas'] || 
        (!tieneExperiencia && sinExperiencia === false)
      ) {
        this.mostrarMensaje('Completa tu información profesional', 'warning');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: environment.geminiApiKey });

      loading.message = 'La IA está redactando tu currículum personalizado...';

      const historialCrudo = tieneExperiencia 
        ? JSON.stringify(cvManual['areasExperiencia']) 
        : 'Ninguna experiencia laboral previa. El candidato busca su primera oportunidad profesional, con gran actitud y proactividad.';

      const promptTexto = `Actúa como un experto reclutador corporativo. Redacta de forma profesional, clara y persuasiva el cuerpo de un currículum en español.
      Datos del candidato:
      - Nombre: ${datosBD['nombre']} ${datosBD['apellidoPaterno']}
      - Formación: ${cvManual['nivelEducativo']} (${cvManual['establecimiento'] || 'Institución'})
      - Habilidades Técnicas: ${cvManual['habilidadesTecnicas']}
      - Habilidades Blandas: ${cvManual['habilidadesBlandas']}
      - Historial o Proyección: ${historialCrudo}
      
      Instrucciones estrictas:
      1. Genera primero una sección llamada exactamente "RESUMEN PROFESIONAL" seguida de un párrafo ejecutivo breve que destaque el perfil del candidato.
      2. Genera luego una sección llamada exactamente "EXPERIENCIA LABORAL" detallando la trayectoria o antecedentes laborales de forma profesional mediante viñetas con guiones (-).
      3. Genera finalmente una sección llamada exactamente "COMPETENCIAS" detallando sus habilidades técnicas y blandas mediante viñetas con guiones (-).
      No incluyas saludos ni explicaciones introductorias, entrega únicamente el contenido estructurado del currículum con esos títulos exactos.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptTexto,
      });

      const textoGenerado = response.text ? response.text.trim() : 'No se pudo generar el contenido.';

      loading.message = 'Compilando documento PDF final...';

      // Fallback si la carrera viene vacía
      let tituloProfesional = this.formularioIA.oficio || cvManual['carrera'] || (tieneExperiencia ? 'Profesional Especializado' : 'Perfil Proactivo en Desarrollo');

      const docPdf = new jsPDF();
      const pageWidth = docPdf.internal.pageSize.getWidth();
      const pageHeight = docPdf.internal.pageSize.getHeight();
      const margenIzquierdo = 25;
      const margenDerecho = 25;
      const anchoUtil = pageWidth - margenIzquierdo - margenDerecho;
      
      const colorPrimario = [79, 157, 20]; 
      const colorOscuro = [44, 62, 80];
      const colorGris = [90, 90, 90];
      const colorClaro = [249, 247, 235]; 

      docPdf.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
      docPdf.rect(0, 0, pageWidth, 45, 'F');

      docPdf.setFontSize(24);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(255, 255, 255);
      const nombreCompleto = `${datosBD['nombre']} ${datosBD['apellidoPaterno']} ${datosBD['apellidoMaterno'] || ''}`;
      docPdf.text(nombreCompleto.toUpperCase(), pageWidth / 2, 22, { align: 'center' });
      
      docPdf.setFontSize(12);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(230, 245, 220);
      docPdf.text(tituloProfesional.toUpperCase(), pageWidth / 2, 32, { align: 'center' });

      let yPos = 60;

      const lineasIA = textoGenerado.split('\n');

      for (let i = 0; i < lineasIA.length; i++) {
        let linea = lineasIA[i].trim();
        if (!linea) continue;

        if (yPos > pageHeight - 35) { 
            docPdf.addPage(); 
            yPos = 30; 
        }

        if (linea.includes('RESUMEN PROFESIONAL') || linea.includes('EXPERIENCIA') || linea.includes('COMPETENCIAS')) {
          yPos += 4;
          docPdf.setFontSize(13);
          docPdf.setFont('helvetica', 'bold');
          docPdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
          
          const tituloLimpio = linea.replace(/\*|:/g, '').trim();
          docPdf.text(tituloLimpio, margenIzquierdo, yPos);
          yPos += 2;

          docPdf.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
          docPdf.setLineWidth(0.5);
          docPdf.line(margenIzquierdo, yPos, pageWidth - margenDerecho, yPos);
          yPos += 6;

        } else {
          const esVineta = linea.startsWith('-') || linea.startsWith('*');
          
          if (linea.includes('|') || (!esVineta && linea.length < 90)) {
            docPdf.setFontSize(11);
            docPdf.setFont('helvetica', 'bold');
            docPdf.setTextColor(colorOscuro[0], colorOscuro[1], colorOscuro[2]);
          } else {
            docPdf.setFontSize(10);
            docPdf.setFont('helvetica', 'normal');
            docPdf.setTextColor(colorGris[0], colorGris[1], colorGris[2]);
          }

          let sangriaX = margenIzquierdo;
          let maxAncho = anchoUtil;

          if (esVineta) {
            linea = linea.substring(1).trim();
            sangriaX = margenIzquierdo + 5;
            maxAncho = anchoUtil - 5;
            
            docPdf.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
            docPdf.circle(margenIzquierdo + 2, yPos - 1.5, 1, 'F');
          }

          const lineasTexto = docPdf.splitTextToSize(linea, maxAncho);
          docPdf.text(lineasTexto, sangriaX, yPos);
          yPos += (lineasTexto.length * 5) + 2;
        }
      }

      yPos += 6;

      if (yPos > pageHeight - 40) { docPdf.addPage(); yPos = 30; }
      
      docPdf.setFontSize(13);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
      docPdf.text('FORMACIÓN ACADÉMICA', margenIzquierdo, yPos);
      yPos += 2;
      
      docPdf.setLineWidth(0.5);
      docPdf.line(margenIzquierdo, yPos, pageWidth - margenDerecho, yPos);
      yPos += 7;

      docPdf.setFontSize(11);
      docPdf.setTextColor(colorOscuro[0], colorOscuro[1], colorOscuro[2]);
      docPdf.text(cvManual['nivelEducativo'] || 'Educación Superior', margenIzquierdo, yPos);
      yPos += 5;
      docPdf.setFontSize(10);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(colorGris[0], colorGris[1], colorGris[2]);
      docPdf.text(cvManual['establecimiento'] || 'Institución no especificada', margenIzquierdo, yPos);

      const totalPages = docPdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        docPdf.setPage(i);
        
        docPdf.setFillColor(colorClaro[0], colorClaro[1], colorClaro[2]);
        docPdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');

        docPdf.setFontSize(8);
        docPdf.setTextColor(120, 120, 120);
        docPdf.text(`Generado por ExpertiMente - Plataforma de Inclusión Laboral`, pageWidth / 2, pageHeight - 6, { align: 'center' });
      }

      const pdfBase64 = docPdf.output('datauristring');
      const nombreArchivoGenerado = `CV_IA_${datosBD['nombre']}_${datosBD['apellidoPaterno']}.pdf`;

      await updateDoc(docRef, {
        cvBase64: pdfBase64,
        cvNombre: nombreArchivoGenerado,
        fechaActualizacionPerfil: serverTimestamp(),
        cvGeneradoIA: deleteField() 
      });

      this.modoOpcion = 'manual'; 
      this.mostrarMensaje('¡Currículum redactado con IA exitosamente!', 'success');

    } catch (error: any) {
      console.error('Error de IA con Google GenAI:', error);

      if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand')) {
        this.mostrarMensaje('El motor de IA está experimentando alta demanda. Por favor, intenta de nuevo en unos segundos.', 'warning');
      } else {
        this.mostrarMensaje('Ocurrió un error al conectar con la IA.', 'danger');
      }
    } finally {
      await loading.dismiss();
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' | string) {
    let icono = 'information-circle';
    if (color === 'success') icono = 'checkmark-circle';
    if (color === 'warning') icono = 'warning';
    if (color === 'danger') icono = 'close-circle';

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      color: color,
      cssClass: 'toast-expertimente',
      position: 'middle',
      icon: icono
    });
    await toast.present();
  }
}