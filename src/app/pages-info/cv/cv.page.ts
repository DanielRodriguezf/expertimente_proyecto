import { Component, inject, ViewChild, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

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
  
  cvGeneradoIA: string = '';
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
  private http = inject(HttpClient); 

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
  // FLUJO 2: GENERACIÓN IA SIMULADA (MOCK INCLUSIVO DINÁMICO)
  // ==========================================
  async generarCVConIA() {
    const user = this.auth.currentUser;
    if (!user) return;

    const loading = await this.loadingCtrl.create({
      message: 'Analizando perfil y redactando antecedentes...',
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
        !datosBD['apellidoPaterno'] || 
        !cvManual || 
        !cvManual['nivelEducativo'] || 
        !cvManual['habilidadesTecnicas'] || 
        (!tieneExperiencia && !sinExperiencia)
      ) {
        await loading.dismiss();
        this.mostrarMensaje('⚠️ Para usar la IA, primero debes completar tu información laboral o indicar que buscas tu primer empleo.', 'warning');
        return;
      }

      loading.message = 'La Inteligencia Artificial está estructurando y formateando tu PDF...';

      let experienciaPrevia = '';
      let textoResumen = '';
      let tituloProfesional = this.formularioIA.oficio || cvManual['carrera'] || '';

      if (tieneExperiencia) {
        // --- 1A. MODO CON EXPERIENCIA (DINÁMICO) ---
        if(!tituloProfesional) tituloProfesional = 'Profesional Especializado';
        
        textoResumen = `Profesional altamente motivado con sólida trayectoria en el área, destacando en roles operativos y técnicos como ${cvManual['areasExperiencia'][0]?.cargo}. Poseo una capacidad probada para resolver problemas complejos, adaptarme rápidamente a nuevos entornos organizacionales y aportar valor inmediato a los equipos de trabajo. Mi enfoque se centra en la eficiencia, la calidad del servicio y el cumplimiento estricto de los objetivos trazados por la empresa.`;

        const variacionesIA = [
          ["- Optimización de los tiempos de ejecución y mejora constante en la calidad del trabajo.", "- Trabajo colaborativo con el equipo para alcanzar y superar los objetivos propuestos."],
          ["- Rápida adaptación a los protocolos de la empresa, manteniendo altos estándares de seguridad y orden.", "- Resolución proactiva de incidencias operativas, garantizando la continuidad del servicio."],
          ["- Gestión responsable de los recursos e inventarios asignados, cumpliendo a cabalidad con las normativas.", "- Comunicación efectiva con supervisores y compañeros para asegurar un excelente clima laboral."],
          ["- Atención al detalle en cada tarea asignada, logrando minimizar errores y aumentar la productividad.", "- Demostración de compromiso, puntualidad y gran capacidad de trabajo bajo presión."]
        ];

        experienciaPrevia = cvManual['areasExperiencia'].map((exp: any, i: number) => {
          const plantilla = variacionesIA[i % variacionesIA.length];
          return `• Cargo: ${exp.cargo.toUpperCase()}\n` +
                 `  Empresa: ${exp.lugar} | Duración: ${exp.tiempo}\n` +
                 `  Responsabilidades y Logros:\n` +
                 `  - Ejecución integral de labores de ${exp.descripcion.toLowerCase()}.\n` +
                 `  ${plantilla[0]}\n` +
                 `  ${plantilla[1]}`;
        }).join('\n\n');

      } else {
        // --- 1B. MODO SIN EXPERIENCIA NI TÍTULO (DINÁMICO PERSUASIVO) ---
        // Extraemos su habilidad técnica más destacada para darle peso al perfil
        let skillDestacada = cvManual['habilidadesTecnicas'] ? cvManual['habilidadesTecnicas'].split(',')[0].trim() : 'Nuevos Desafíos';
        
        // Títulos aleatorios dinámicos para perfiles junior
        const titulosIA = [
          `Candidato/a Proactivo/a | Enfoque en ${skillDestacada}`,
          `Perfil Formativo con Alto Potencial de Desarrollo`,
          `Aspirante en Búsqueda de Primera Oportunidad Laboral`
        ];
        if(!tituloProfesional) tituloProfesional = titulosIA[Math.floor(Math.random() * titulosIA.length)];

        // Resúmenes actitudinales aleatorios (simula que la IA redacta algo nuevo cada vez)
        const resumenesIA = [
          `Persona altamente proactiva y orientada al aprendizaje continuo, en búsqueda de mi primera oportunidad laboral formal. Destaco por mi gran disposición para adaptarme a nuevos entornos, absorber conocimientos técnicos y aportar valor desde el primer día mediante competencias sólidas en ${cvManual['habilidadesBlandas']}.`,
          `Perfil dinámico, responsable y con gran entusiasmo por iniciar mi trayectoria profesional. Aunque me encuentro en la etapa inicial de mi carrera, compenso la falta de experiencia formal con una fuerte ética de trabajo, capacidad de resolución y conocimientos prácticos en ${skillDestacada}. Estoy preparado/a para asumir responsabilidades y crecer junto a la empresa.`,
          `Candidato/a con excelente actitud y compromiso inquebrantable. Mi objetivo es integrarme a un equipo de trabajo donde pueda aplicar mis conocimientos en ${skillDestacada}, desarrollar nuevas habilidades y contribuir activamente al éxito operativo de la organización, respaldado/a por mi responsabilidad y puntualidad.`
        ];
        textoResumen = resumenesIA[Math.floor(Math.random() * resumenesIA.length)];

        // Enfoque en Proyección de Valor en lugar de Experiencia Laboral
        const aportesIA = [
          `• PROYECCIÓN DE VALOR Y ACTITUD PROFESIONAL\n` +
          `  Disposición inmediata para iniciar trayectoria formativa y laboral.\n\n` +
          `  Aportes estratégicos al equipo:\n` +
          `  - Alta motivación para integrarse a dinámicas de trabajo exigentes y colaborativas.\n` +
          `  - Fuerte orientación al aprendizaje rápido y ejecución proactiva de instrucciones.\n` +
          `  - Compromiso inquebrantable con la puntualidad, la ética de trabajo y la responsabilidad.\n` +
          `  - Aplicación de habilidades fundamentales y capacidad para operar bajo supervisión o de forma autónoma.`,
          
          `• OBJETIVOS Y PLAN DE DESARROLLO EN LA EMPRESA\n` +
          `  Enfoque total en la asimilación de procesos operativos y la mejora continua.\n\n` +
          `  Competencias de apoyo inmediato:\n` +
          `  - Excelente capacidad de comunicación y empatía para el trato directo e indirecto.\n` +
          `  - Iniciativa para proponer soluciones simples frente a problemas cotidianos del puesto.\n` +
          `  - Disposición para rotar en diferentes áreas según las necesidades operativas del negocio.\n` +
          `  - Responsabilidad demostrada y cumplimiento riguroso de normativas internas.`
        ];
        experienciaPrevia = aportesIA[Math.floor(Math.random() * aportesIA.length)];
      }

      // 2. SIMULAR EL TIEMPO DE PROCESAMIENTO
      await new Promise(resolve => setTimeout(resolve, 2800));

      // 3. GENERAR EL PDF USANDO JSPDF
      const docPdf = new jsPDF();
      const pageWidth = docPdf.internal.pageSize.getWidth();
      const margenIzquierdo = 20;
      let yPos = 20;

      // --- Encabezado ---
      docPdf.setFontSize(24);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(33, 37, 41);
      docPdf.text(`${datosBD['nombre']} ${datosBD['apellidoPaterno']} ${datosBD['apellidoMaterno'] || ''}`, margenIzquierdo, yPos);
      yPos += 8;
      
      docPdf.setFontSize(14);
      docPdf.setFont('helvetica', 'italic');
      docPdf.setTextColor(79, 157, 20); // Color primario
      docPdf.text(tituloProfesional, margenIzquierdo, yPos);
      yPos += 15;
      docPdf.setTextColor(33, 37, 41); 

      // --- Resumen Profesional ---
      docPdf.setFontSize(14);
      docPdf.setFont('helvetica', 'bold');
      docPdf.text('PERFIL PROFESIONAL', margenIzquierdo, yPos);
      yPos += 6;
      
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(70, 70, 70);
      const lineasResumen = docPdf.splitTextToSize(textoResumen, pageWidth - (margenIzquierdo * 2));
      docPdf.text(lineasResumen, margenIzquierdo, yPos);
      yPos += (lineasResumen.length * 5) + 8;

      // --- Habilidades ---
      docPdf.setFontSize(14);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(33, 37, 41);
      docPdf.text('COMPETENCIAS CLAVE', margenIzquierdo, yPos);
      yPos += 6;
      
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(70, 70, 70);
      const habilidadesTxt = `• Competencias Técnicas: ${cvManual['habilidadesTecnicas'] || this.formularioIA.habilidades}\n• Competencias Blandas: ${cvManual['habilidadesBlandas']}\n• Disponibilidad: ${cvManual['disponibilidad'] || 'Inmediata'}`;
      const lineasHabilidades = docPdf.splitTextToSize(habilidadesTxt, pageWidth - (margenIzquierdo * 2));
      docPdf.text(lineasHabilidades, margenIzquierdo, yPos);
      yPos += (lineasHabilidades.length * 5) + 8;

      // --- Experiencia Laboral / Proyección ---
      docPdf.setFontSize(14);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(33, 37, 41);
      docPdf.text(tieneExperiencia ? 'HISTORIAL LABORAL' : 'PROYECCIÓN LABORAL Y ACTITUD', margenIzquierdo, yPos);
      yPos += 6;
      
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(70, 70, 70);
      const lineasExperiencia = docPdf.splitTextToSize(experienciaPrevia, pageWidth - (margenIzquierdo * 2));
      docPdf.text(lineasExperiencia, margenIzquierdo, yPos);
      yPos += (lineasExperiencia.length * 5) + 8;

      // --- Educación ---
      if(yPos > 260) { docPdf.addPage(); yPos = 20; }
      
      docPdf.setFontSize(14);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setTextColor(33, 37, 41);
      docPdf.text('FORMACIÓN ACADÉMICA', margenIzquierdo, yPos);
      yPos += 6;
      
      docPdf.setFontSize(11);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(70, 70, 70);
      docPdf.text(`• Nivel Alcanzado: ${cvManual['nivelEducativo']}\n• Institución: ${cvManual['establecimiento']}`, margenIzquierdo, yPos);

      // 4. CONVERTIR A BASE64 Y GUARDAR
      const pdfBase64 = docPdf.output('datauristring');
      const nombreArchivoGenerado = `CV_IA_${datosBD['nombre']}_${datosBD['apellidoPaterno']}.pdf`;

      await updateDoc(docRef, {
        cvBase64: pdfBase64,
        cvNombre: nombreArchivoGenerado,
        fechaActualizacionPerfil: serverTimestamp(),
        cvGeneradoIA: deleteField() 
      });

      await loading.dismiss();
      this.modoOpcion = 'manual'; 
      this.mostrarMensaje('¡Tu perfil PDF ha sido analizado y generado con éxito!', 'success');

    } catch (error) {
      await loading.dismiss();
      console.error(error);
      this.mostrarMensaje('Ocurrió un error en la generación del PDF inteligente.', 'danger');
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