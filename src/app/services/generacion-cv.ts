import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc, deleteField, serverTimestamp } from '@angular/fire/firestore';
import { IaCvService } from './ia-cv';
import { ToastService } from './toast';

@Injectable({ providedIn: 'root' })
export class GeneracionCvService {

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toast = inject(ToastService);
  private iaCv = inject(IaCvService);

  private readonly _generando = signal(false);
  readonly generando = this._generando.asReadonly();

  readonly terminado$ = new Subject<boolean>();

  private contadorTrabajos = 0;
  private trabajoActual = 0;

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      if (!user && this._generando()) {
        this.trabajoActual = 0;
        this._generando.set(false);
      }
    });
  }

  async iniciar(rutaCv: string): Promise<void> {
    if (this._generando()) {
      this.toast.advertencia('Ya estamos generando tu currículum. Te avisaremos cuando esté listo.');
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

    this.toast.exito(
      'Estamos preparando tu currículum. Puedes seguir usando la app, te avisaremos cuando esté listo.',
      { duration: 4500 }
    );

    void this.ejecutar(id, user.uid, preparado.datosBD, preparado.cvManual, preparado.tieneExperiencia, rutaCv);
  }

  private async prepararDatos(uid: string): Promise<{ datosBD: any; cvManual: any; tieneExperiencia: boolean } | null> {
    try {
      const docSnap = await getDoc(doc(this.firestore, `postulantes/${uid}`));

      if (!docSnap.exists()) {
        this.toast.error('No se encontraron tus datos en la base de datos.');
        return null;
      }

      const datosBD = docSnap.data();
      const cvManual = datosBD['cvManual'];

      const tieneExperiencia = !!(cvManual && Array.isArray(cvManual['areasExperiencia']) && cvManual['areasExperiencia'].length > 0);
      const tieneHabilidades = !!(cvManual && (cvManual['habilidadesTecnicas'] || cvManual['habilidadesBlandas']));

      if (
        !datosBD['nombre'] ||
        !cvManual ||
        !cvManual['nivelEducativo'] ||
        !tieneHabilidades
      ) {
        this.toast.advertencia('Completa tu información profesional en "Mi Experiencia".');
        return null;
      }

      return { datosBD, cvManual, tieneExperiencia };
    } catch (error) {
      console.error('Error al leer los datos del postulante:', error);
      this.toast.error('No se pudieron leer tus datos. Revisa tu conexión e intenta de nuevo.');
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
        apellidoPaterno: datosBD['apellidoPaterno'] || '',
        cvManual,
        tieneExperiencia,
        areasInteres: Array.isArray(datosBD['areasInteres']) ? datosBD['areasInteres'] : []
      });

      console.info('[CV] Método de generación utilizado:', metodo);

      if (!this.sigueVigente(id, uid)) return;

      const pdfBase64 = await this.construirPdf(datosBD, cvManual, texto, tieneExperiencia);
      if (!this.sigueVigente(id, uid)) return;

      const nombreArchivoGenerado = `CV_IA_${datosBD['nombre']}_${datosBD['apellidoPaterno'] || 'Postulante'}.pdf`;

      await updateDoc(doc(this.firestore, `postulantes/${uid}`), {
        cvBase64: pdfBase64,
        cvNombre: nombreArchivoGenerado,
        fechaActualizacionPerfil: serverTimestamp(),
        cvGeneradoIA: deleteField()
      });
      if (!this.sigueVigente(id, uid)) return;

      this.liberar(id);
      this.terminado$.next(true);
      this.avisarListo(rutaCv);

    } catch (error) {
      console.error('Error al generar el currículum en segundo plano:', error);
      if (this.sigueVigente(id, uid)) {
        this.liberar(id);
        this.terminado$.next(false);
        this.toast.error('No se pudo generar tu currículum. Intenta nuevamente.');
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

  private avisarListo(rutaCv: string): void {
    const urlActual = this.router.url.split('?')[0];
    const rutaBase = (rutaCv || '').split('?')[0];
    const estaEnCv = !!rutaBase && urlActual.startsWith(rutaBase);

    const opciones = {
      duration: 5500,
      buttons: estaEnCv || !rutaBase
        ? []
        : [{ text: 'Ver', handler: () => { this.router.navigateByUrl(rutaBase); } }]
    };

    this.toast.exito('¡Tu currículum está listo!', opciones);
  }

  /**
   * Identifica únicamente líneas que son títulos exactos de sección,
   * evitando que oraciones con la palabra "experiencia" o "competencias" se conviertan en títulos.
   */
  private obtenerTituloSeccion(linea: string): 'RESUMEN PROFESIONAL' | 'EXPERIENCIA LABORAL' | 'COMPETENCIAS' | null {
    const limpia = linea
      .replace(/^[#*\-\d\.\)\s]+/, '')
      .replace(/[#*:]+$/g, '')
      .trim()
      .toUpperCase();

    if (limpia === 'RESUMEN PROFESIONAL' || limpia === 'PERFIL PROFESIONAL') {
      return 'RESUMEN PROFESIONAL';
    }
    if (limpia === 'EXPERIENCIA LABORAL' || limpia === 'EXPERIENCIA' || limpia === 'HISTORIAL LABORAL') {
      return 'EXPERIENCIA LABORAL';
    }
    if (limpia === 'COMPETENCIAS' || limpia === 'HABILIDADES' || limpia === 'HABILIDADES Y COMPETENCIAS') {
      return 'COMPETENCIAS';
    }
    return null;
  }

  private async construirPdf(
    datosBD: any,
    cvManual: any,
    textoGenerado: string,
    tieneExperiencia: boolean
  ): Promise<string> {
    const { jsPDF } = await import('jspdf');

    const tituloProfesional =
      cvManual['carrera'] ||
      (tieneExperiencia ? 'Profesional con Experiencia' : 'Perfil Proactivo en Desarrollo');

    const docPdf = new jsPDF();
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const pageHeight = docPdf.internal.pageSize.getHeight();
    const margenIzquierdo = 22;
    const margenDerecho = 22;
    const anchoUtil = pageWidth - margenIzquierdo - margenDerecho;
    const limiteInferior = pageHeight - 24;

    const colorPrimario: [number, number, number] = [79, 157, 20];
    const colorOscuro: [number, number, number] = [44, 62, 80];
    const colorGris: [number, number, number] = [80, 80, 80];
    const colorClaro: [number, number, number] = [249, 247, 235];

    // --- ENCABEZADO SUPERIOR ---
    docPdf.setFillColor(...colorPrimario);
    docPdf.rect(0, 0, pageWidth, 46, 'F');

    const nombreCompleto = [
      datosBD['nombre'] || '',
      datosBD['apellidoPaterno'] || '',
      datosBD['apellidoMaterno'] || ''
    ].filter(Boolean).join(' ').trim() || 'POSTULANTE';

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(20);
    docPdf.setTextColor(255, 255, 255);
    const lineasNombre = docPdf.splitTextToSize(nombreCompleto.toUpperCase(), anchoUtil);
    docPdf.text(lineasNombre[0], pageWidth / 2, 18, { align: 'center' });

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(11);
    docPdf.setTextColor(235, 248, 225);
    const lineasSubtitulo = docPdf.splitTextToSize(String(tituloProfesional).toUpperCase(), anchoUtil);
    docPdf.text(lineasSubtitulo[0], pageWidth / 2, 27, { align: 'center' });

    // Datos de contacto en el encabezado si están disponibles
    const ubicacion = [datosBD['comuna'], datosBD['ciudad']].filter(Boolean).join(', ');
    const datosContacto = [
      datosBD['correo'],
      datosBD['telefono'],
      ubicacion
    ].map(v => String(v ?? '').trim()).filter(Boolean).join('  •  ');

    if (datosContacto) {
      docPdf.setFontSize(9.5);
      docPdf.setTextColor(255, 255, 255);
      const lineaContacto = docPdf.splitTextToSize(datosContacto, anchoUtil);
      docPdf.text(lineaContacto[0], pageWidth / 2, 37, { align: 'center' });
    }

    let yPos = 58;
    let seccionActual: 'RESUMEN PROFESIONAL' | 'EXPERIENCIA LABORAL' | 'COMPETENCIAS' | null = null;

    const asegurarEspacio = (altoRequerido: number) => {
      if (yPos + altoRequerido > limiteInferior) {
        docPdf.addPage();
        yPos = 25;
      }
    };

    const dibujarTituloSeccion = (titulo: string) => {
      asegurarEspacio(16);
      yPos += 3;
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(12.5);
      docPdf.setTextColor(...colorPrimario);
      docPdf.text(titulo, margenIzquierdo, yPos);
      yPos += 2;

      docPdf.setDrawColor(...colorPrimario);
      docPdf.setLineWidth(0.5);
      docPdf.line(margenIzquierdo, yPos, pageWidth - margenDerecho, yPos);
      yPos += 6.5;
    };

    const lineasIA = (textoGenerado || '').split('\n');

    for (let i = 0; i < lineasIA.length; i++) {
      const lineaCruda = lineasIA[i].trim();
      if (!lineaCruda) continue;

      const tituloDetectado = this.obtenerTituloSeccion(lineaCruda);
      if (tituloDetectado) {
        seccionActual = tituloDetectado;
        dibujarTituloSeccion(tituloDetectado);
        continue;
      }

      const esVineta = /^[\-*•]/.test(lineaCruda);
      const textoLimpio = lineaCruda
        .replace(/^[\-*•\s]+/, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .trim();

      if (!textoLimpio) continue;

      // Encabezado de puesto dentro de EXPERIENCIA LABORAL (ej. "Cargo | Empresa | Tiempo")
      const esSubtituloExperiencia =
        !esVineta &&
        seccionActual === 'EXPERIENCIA LABORAL' &&
        (textoLimpio.includes('|') || textoLimpio.length < 95);

      if (esSubtituloExperiencia) {
        const lineasSub = docPdf.splitTextToSize(textoLimpio, anchoUtil);
        const altoBloque = lineasSub.length * 5 + 2;
        asegurarEspacio(altoBloque + 4);

        yPos += 1.5;
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(10.5);
        docPdf.setTextColor(...colorOscuro);
        docPdf.text(lineasSub, margenIzquierdo, yPos);
        yPos += altoBloque;
        continue;
      }

      if (esVineta) {
        const sangriaX = margenIzquierdo + 5;
        const maxAncho = anchoUtil - 5;
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(10);
        const lineasVineta = docPdf.splitTextToSize(textoLimpio, maxAncho);
        const altoBloque = lineasVineta.length * 4.8 + 1.8;

        asegurarEspacio(altoBloque);

        docPdf.setFillColor(...colorPrimario);
        docPdf.circle(margenIzquierdo + 1.8, yPos - 1.3, 0.9, 'F');

        docPdf.setTextColor(...colorGris);
        docPdf.text(lineasVineta, sangriaX, yPos);
        yPos += altoBloque;
      } else {
        // Párrafo normal (por ejemplo, el cuerpo de RESUMEN PROFESIONAL)
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(10);
        docPdf.setTextColor(...colorGris);
        const lineasParrafo = docPdf.splitTextToSize(textoLimpio, anchoUtil);
        const altoBloque = lineasParrafo.length * 5 + 3;

        asegurarEspacio(altoBloque);
        docPdf.text(lineasParrafo, margenIzquierdo, yPos);
        yPos += altoBloque;
      }
    }

    // --- FORMACIÓN ACADÉMICA ---
    yPos += 2;
    dibujarTituloSeccion('FORMACIÓN ACADÉMICA');

    const tituloEducacion = [cvManual['nivelEducativo'], cvManual['carrera']]
      .map(v => String(v ?? '').trim())
      .filter(Boolean)
      .join(' — ') || 'Educación declarada en perfil';

    const institucion = String(cvManual['establecimiento'] || 'Institución académica').trim();

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(10.5);
    docPdf.setTextColor(...colorOscuro);
    const lineasEdu = docPdf.splitTextToSize(tituloEducacion, anchoUtil);
    asegurarEspacio(lineasEdu.length * 5 + 8);
    docPdf.text(lineasEdu, margenIzquierdo, yPos);
    yPos += lineasEdu.length * 5 + 1;

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(10);
    docPdf.setTextColor(...colorGris);
    const lineasInst = docPdf.splitTextToSize(institucion, anchoUtil);
    docPdf.text(lineasInst, margenIzquierdo, yPos);

    // --- PIE DE PÁGINA EN TODAS LAS HOJAS ---
    const totalPages = docPdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      docPdf.setPage(i);

      docPdf.setFillColor(...colorClaro);
      docPdf.rect(0, pageHeight - 14, pageWidth, 14, 'F');

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(8.5);
      docPdf.setTextColor(120, 120, 120);
      docPdf.text(
        'Generado por ExpertiMente - Plataforma de Inclusión Laboral',
        pageWidth / 2,
        pageHeight - 5.5,
        { align: 'center' }
      );
    }

    return docPdf.output('datauristring');
  }
}