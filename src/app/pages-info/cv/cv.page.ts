import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonButton, IonIcon, IonFooter,
  IonLabel, IonCard, IonCardContent, IonItem,
  IonSegment, IonSegmentButton, IonInput, IonTextarea 
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, documentTextOutline, 
  trashOutline, eyeOutline, checkmarkCircle, 
  closeCircle, informationCircle, warning, sparklesOutline, hardwareChipOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, onSnapshot, deleteField, getDoc, serverTimestamp } from '@angular/fire/firestore';

import { jsPDF } from 'jspdf';
// Importación oficial del nuevo SDK de Google Gen AI
import { GoogleGenAI } from '@google/genai';

@Component({
  selector: 'app-cv',
  templateUrl: './cv.page.html',
  styleUrls: ['./cv.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, HttpClientModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonBackButton, 
    IonButton, IonIcon, IonFooter, IonLabel, 
    IonCard, IonCardContent, IonItem,
    IonSegment, IonSegmentButton, IonInput, IonTextarea
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
      'hardware-chip-outline': hardwareChipOutline
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

      const reader = new FileReader();
      reader.onload = async () => {
        this.archivoBase64 = reader.result as string; 
        this.archivoSeleccionadoNombre = file.name;
        await loading.dismiss();
        this.cdr.detectChanges(); 
        this.mostrarMensaje('¡Documento cargado con exito!', 'success');
      };
      reader.readAsDataURL(file);
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
      message: 'Tu archivo se borrará de tu perfil.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, eliminar',
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

  verCVSaved() {
    if (!this.cvSavedBase64) return;
    try {
      const base64Parts = this.cvSavedBase64.split(',');
      const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      enlace.download = this.nombreCVSaved || 'Mi_Curriculum.pdf';
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 250);
    } catch (error) {
      this.mostrarMensaje('No se pudo abrir el archivo PDF.', 'danger');
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
      await loading.dismiss();
      this.mostrarMensaje('¡Tu currículum PDF se ha guardado con éxito!', 'success');
    } catch (error) {
      await loading.dismiss();
      this.mostrarMensaje('Hubo un error al guardar.', 'danger');
    }
  }

  // ==========================================
  // FLUJO DE IA REAL: GOOGLE GEN AI SDK OFICIAL
  // ==========================================
  async generarCVConIA() {
    const user = this.auth.currentUser;
    if (!user) return;

    const loading = await this.loadingCtrl.create({
      message: 'Conectando con Google AI Studio...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await loading.dismiss();
        this.mostrarMensaje('No se encontraron tus datos en la base de datos.', 'danger');
        return;
      }

      const datosBD = docSnap.data();
      const cvManual = datosBD['cvManual'];

      const tieneExperiencia = cvManual && cvManual['areasExperiencia'] && cvManual['areasExperiencia'].length > 0;
      const sinExperiencia = datosBD['sinExperiencia'] === true || (cvManual && cvManual['sinExperiencia'] === true);

      if (
        !datosBD['nombre'] || 
        !cvManual || 
        !cvManual['nivelEducativo'] || 
        !cvManual['habilidadesTecnicas'] || 
        (!tieneExperiencia && sinExperiencia === false)
      ) {
        await loading.dismiss();
        this.mostrarMensaje('⚠️ Completa tu información laboral o indica que buscas primer empleo.', 'warning');
        return;
      }

     // const ai = new GoogleGenAI({ api/Key: 'LLAVESITA' });

      loading.message = 'Google AI está redactando tu currículum personalizado...';

      const historialCrudo = tieneExperiencia 
        ? JSON.stringify(cvManual['areasExperiencia']) 
        : 'Ninguna experiencia laboral previa. El candidato busca su primera oportunidad profesional, con gran actitud y proactividad.';

      // PROMPT MEJORADO: Separar explícitamente EXPERIENCIA y COMPETENCIAS
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

      let tituloProfesional = this.formularioIA.oficio || cvManual['carrera'] || (tieneExperiencia ? 'Profesional Especializado' : 'Perfil Proactivo en Desarrollo');

      // ==========================================
      // DISEÑO VISUAL MEJORADO DEL PDF (jsPDF)
      // ==========================================
      const docPdf = new jsPDF();
      const pageWidth = docPdf.internal.pageSize.getWidth();
      const pageHeight = docPdf.internal.pageSize.getHeight();
      const margenIzquierdo = 20;
      const margenDerecho = 20;
      const anchoUtil = pageWidth - margenIzquierdo - margenDerecho;
      let yPos = 20;

      // Color primario ExpertiMente (#4f9d14) y color oscuro de texto
      const colorPrimario = [79, 157, 20];
      const colorTextoOscuro = [33, 37, 41];
      const colorGris = [100, 100, 100];

      // Franja superior decorativa de diseño
      docPdf.setFillColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
      docPdf.rect(0, 0, pageWidth, 6, 'F');

      yPos = 16;

      // Encabezado: Nombre del Postulante
      docPdf.setFontSize(22);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(colorTextoOscuro[0], colorTextoOscuro[1], colorTextoOscuro[2]);
      docPdf.text(`${datosBD['nombre']} ${datosBD['apellidoPaterno']} ${datosBD['apellidoMaterno'] || ''}`, margenIzquierdo, yPos);
      yPos += 7;
      
      // Título / Oficio con color primario
      docPdf.setFontSize(13);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]); 
      docPdf.text(tituloProfesional.toUpperCase(), margenIzquierdo, yPos);
      yPos += 4;

      // Línea divisoria elegante bajo el encabezado
      docPdf.setDrawColor(200, 200, 200);
      docPdf.setLineWidth(0.5);
      docPdf.line(margenIzquierdo, yPos, pageWidth - margenDerecho, yPos);
      yPos += 8;

      // Procesamiento de secciones generadas por la IA
      // Dividimos el texto por líneas o secciones lógicas para maquetarlas ordenadamente
      docPdf.setFontSize(10);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(colorGris[0], colorGris[1], colorGris[2]);

      const lineasIA = docPdf.splitTextToSize(textoGenerado, anchoUtil);

      for (let i = 0; i < lineasIA.length; i++) {
        const linea = lineasIA[i].trim();
        
        // Detectar si es un encabezado generado por la IA (RESUMEN PROFESIONAL, EXPERIENCIA, COMPETENCIAS)
        if (linea.includes('RESUMEN PROFESIONAL') || linea.includes('EXPERIENCIA') || linea.includes('COMPETENCIAS')) {
          yPos += 4;
          if (yPos > pageHeight - 25) { docPdf.addPage(); yPos = 20; }

          // Título de sección estilizado con barra lateral o color primario
          docPdf.setFontSize(12);
          docPdf.setFont('helvetica', 'bold');
          docPdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
          docPdf.text(linea.replace(':', ''), margenIzquierdo, yPos);
          yPos += 6;

          // Línea fina debajo del título de sección
          docPdf.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
          docPdf.setLineWidth(0.3);
          docPdf.line(margenIzquierdo, yPos - 2, margenIzquierdo + 40, yPos - 2);
          
          docPdf.setFontSize(10);
          docPdf.setFont('helvetica', 'normal');
          docPdf.setTextColor(colorGris[0], colorGris[1], colorGris[2]);
          yPos += 2;
        } else {
          if (yPos > pageHeight - 20) { docPdf.addPage(); yPos = 20; }
          docPdf.text(linea, margenIzquierdo, yPos);
          yPos += 5;
        }
      }

      yPos += 4;

      // Formación Académica (Sección fija estructurada)
      if (yPos > pageHeight - 35) { docPdf.addPage(); yPos = 20; }
      
      docPdf.setFontSize(12);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
      docPdf.text('FORMACIÓN ACADÉMICA', margenIzquierdo, yPos);
      yPos += 6;

      docPdf.setDrawColor(colorPrimario[0], colorPrimario[1], colorPrimario[2]);
      docPdf.setLineWidth(0.3);
      docPdf.line(margenIzquierdo, yPos - 2, margenIzquierdo + 40, yPos - 2);
      yPos += 2;

      docPdf.setFontSize(10);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(colorGris[0], colorGris[1], colorGris[2]);
      
      const textoFormacion = `• Nivel Alcanzado: ${cvManual['nivelEducativo']}\n• Institución / Establecimiento: ${cvManual['establecimiento'] || 'No especificada'}`;
      const lineasEducacion = docPdf.splitTextToSize(textoFormacion, anchoUtil);
      docPdf.text(lineasEducacion, margenIzquierdo, yPos);

      // Pie de página sutil institucional en el PDF
      const totalPages = docPdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        docPdf.setPage(i);
        docPdf.setFontSize(8);
        docPdf.setTextColor(150, 150, 150);
        docPdf.text(`Generado por ExpertiMente - Plataforma de Inclusión Laboral`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      // CONVERSIÓN A BASE64 Y GUARDADO EN FIRESTORE
      const pdfBase64 = docPdf.output('datauristring');
      const nombreArchivoGenerado = `CV_Gemini_${datosBD['nombre']}_${datosBD['apellidoPaterno']}.pdf`;

      await updateDoc(docRef, {
        cvBase64: pdfBase64,
        cvNombre: nombreArchivoGenerado,
        fechaActualizacionPerfil: serverTimestamp(),
        cvGeneradoIA: deleteField() 
      });

      await loading.dismiss();
      this.modoOpcion = 'manual'; 
      this.mostrarMensaje('¡Currículum redactado por Google AI exitosamente!', 'success');

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error de IA con Google GenAI:', error);
      this.mostrarMensaje('Ocurrió un error al conectar con Google AI Studio.', 'danger');
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