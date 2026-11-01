import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { addIcons } from 'ionicons';
import { checkmarkCircle, warning, closeCircle } from 'ionicons/icons';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc, deleteField, serverTimestamp } from '@angular/fire/firestore';
import { IaCvService } from './ia-cv';

@Injectable({ providedIn: 'root' })
export class GeneracionCvService {

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private iaCv = inject(IaCvService);

  private readonly _generando = signal(false);
  readonly generando = this._generando.asReadonly();

  readonly terminado$ = new Subject<boolean>();

  private contadorTrabajos = 0;
  private trabajoActual = 0;

  constructor() {
    addIcons({
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle
    });

    onAuthStateChanged(this.auth, (user) => {
      if (!user && this._generando()) {
        this.trabajoActual = 0;
        this._generando.set(false);
      }
    });
  }

  async iniciar(rutaCv: string): Promise<void> {
    if (this._generando()) {
      await this.mostrarToast('Ya estamos generando tu currículum. Te avisaremos cuando esté listo.', 'warning');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) return;

    const id = ++this.contadorTrabajos;
    this.trabajoActual = id;
    this._generando.set(true);

    const preparado = await this.prepararDatos(user.uid);
    if (!preparado || !this.sigueVigente(id, user.uid)) {
      this.liberar(id);
      return;
    }

    await this.mostrarToast(
      'Estamos redactando tu currículum con IA. Puedes seguir usando la app, te avisaremos cuando esté listo.',
      'success',
      { duracion: 4500 }
    );

    void this.ejecutar(id, user.uid, preparado.datosBD, preparado.cvManual, preparado.tieneExperiencia, rutaCv);
  }

  private async prepararDatos(uid: string): Promise<{ datosBD: any; cvManual: any; tieneExperiencia: boolean } | null> {
    try {
      const docSnap = await getDoc(doc(this.firestore, `postulantes/${uid}`));

      if (!docSnap.exists()) {
        await this.mostrarToast('No se encontraron tus datos en la base de datos.', 'danger');
        return null;
      }

      const datosBD = docSnap.data();
      const cvManual = datosBD['cvManual'];

      const tieneExperiencia = !!(cvManual && Array.isArray(cvManual['areasExperiencia']) && cvManual['areasExperiencia'].length > 0);
      const sinExperiencia = datosBD['sinExperiencia'] === true || (cvManual && cvManual['sinExperiencia'] === true);

      if (
        !datosBD['nombre'] ||
        !cvManual ||
        !cvManual['nivelEducativo'] ||
        !cvManual['habilidadesTecnicas'] ||
        (!tieneExperiencia && sinExperiencia === false)
      ) {
        await this.mostrarToast('Completa tu información profesional', 'warning');
        return null;
      }

      return { datosBD, cvManual, tieneExperiencia };
    } catch (error) {
      console.error('Error al leer los datos del postulante:', error);
      await this.mostrarToast('No se pudieron leer tus datos. Revisa tu conexión e intenta de nuevo.', 'danger');
      return null;
    }
  }

  private async ejecutar(
    id: number,
    uid: string,
    datosBD: any,
    cvManual: any,
    tieneExperiencia: boolean,
    rutaCv: string
  ): Promise<void> {
    try {
      const { texto, metodo } = await this.iaCv.generarTextoCv({
        nombre: datosBD['nombre'],
        apellidoPaterno: datosBD['apellidoPaterno'],
        cvManual,
        tieneExperiencia,
        areasInteres: Array.isArray(datosBD['areasInteres']) ? datosBD['areasInteres'] : []
      });
      if (!this.sigueVigente(id, uid)) return;

      const pdfBase64 = await this.construirPdf(datosBD, cvManual, texto, tieneExperiencia);
      if (!this.sigueVigente(id, uid)) return;

      const nombreArchivoGenerado = `CV_IA_${datosBD['nombre']}_${datosBD['apellidoPaterno']}.pdf`;

      await updateDoc(doc(this.firestore, `postulantes/${uid}`), {
        cvBase64: pdfBase64,
        cvNombre: nombreArchivoGenerado,
        fechaActualizacionPerfil: serverTimestamp(),
        cvGeneradoIA: deleteField()
      });
      if (!this.sigueVigente(id, uid)) return;

      this.liberar(id);
      this.terminado$.next(true);
      await this.avisarListo(metodo, rutaCv);

    } catch (error) {
      console.error('Error al generar el currículum en segundo plano:', error);
      if (this.sigueVigente(id, uid)) {
        this.liberar(id);
        this.terminado$.next(false);
        await this.mostrarToast('No se pudo generar tu currículum. Intenta nuevamente.', 'danger');
      }
    } finally {
      this.liberar(id);
    }
  }

  private sigueVigente(id: number, uid: string): boolean {
    return this.trabajoActual === id && this.auth.currentUser?.uid === uid;
  }

  private liberar(id: number) {
    if (this.trabajoActual === id) {
      this.trabajoActual = 0;
      this._generando.set(false);
    }
  }

  private async avisarListo(metodo: 'gemini' | 'local', rutaCv: string) {
    const urlActual = this.router.url.split('?')[0];
    const rutaBase = (rutaCv || '').split('?')[0];
    const estaEnCv = !!rutaBase && urlActual.startsWith(rutaBase);

    const mensaje = metodo === 'gemini'
      ? '¡Tu currículum con IA está listo!'
      : 'Tu currículum está listo. Usamos la plantilla automática.';

    await this.mostrarToast(
      mensaje,
      metodo === 'gemini' ? 'success' : 'warning',
      {
        duracion: 5500,
        buttons: estaEnCv || !rutaBase
          ? []
          : [{ text: 'Ver', handler: () => { this.router.navigateByUrl(rutaBase); } }]
      }
    );
  }

  private async mostrarToast(
    mensaje: string,
    color: 'success' | 'warning' | 'danger',
    opciones: { duracion?: number; buttons?: any[] } = {}
  ) {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: opciones.duracion ?? 2600,
      position: 'bottom',
      color,
      icon: iconos[color],
      cssClass: 'toast-expertimente',
      buttons: opciones.buttons ?? []
    });
    await toast.present();
  }

  private async construirPdf(
    datosBD: any,
    cvManual: any,
    textoGenerado: string,
    tieneExperiencia: boolean
  ): Promise<string> {
    const { jsPDF } = await import('jspdf');

    let tituloProfesional = cvManual['carrera'] || (tieneExperiencia ? 'Profesional Especializado' : 'Perfil Proactivo en Desarrollo');

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

    return docPdf.output('datauristring');
  }
}