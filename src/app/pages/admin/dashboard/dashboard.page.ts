import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonList, IonItem, IonLabel, IonBadge, 
  IonButton, IonButtons, IonIcon,
  IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
  IonAvatar, IonMenu, IonMenuButton, IonSplitPane, IonMenuToggle, AlertController,
  IonSelect, IonSelectOption, IonInput 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  checkmarkCircleOutline, closeCircleOutline, businessOutline, 
  briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
  documentTextOutline, downloadOutline, callOutline, calendarOutline, homeOutline, globeOutline,
  linkOutline, peopleOutline, informationCircleOutline, timeOutline,
  menuOutline, listOutline, createOutline, documentOutline, helpCircleOutline,
  shieldCheckmarkOutline, schoolOutline, starOutline,
  heartOutline, hardwareChipOutline, syncOutline, trashOutline, logoLinkedin,
  filterOutline, swapVerticalOutline, addCircleOutline, layersOutline, removeCircleOutline 
} from 'ionicons/icons';

import { AdminService, ReclutadorConEmpresa, Postulante, Oferta, CargoSolicitud, Pregunta } from '../services/admin.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonHeader, IonToolbar, IonTitle, IonContent, 
    IonList, IonItem, IonLabel, IonBadge, 
    IonButton, IonButtons, IonIcon, 
    IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
    IonAvatar, IonMenu, IonMenuButton, IonSplitPane, IonMenuToggle,
    IonSelect, IonSelectOption, IonInput 
  ]
})
export class DashboardPage implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private alertController = inject(AlertController);

  vistaActual: 'reclutadores' | 'postulantes' | 'ofertas' | 'cargos' = 'reclutadores';
  
  reclutadores: ReclutadorConEmpresa[] = [];
  postulantes: Postulante[] = [];
  ofertas: Oferta[] = [];
  cargos: CargoSolicitud[] = [];

  reclutadoresMostrados: ReclutadorConEmpresa[] = [];
  ofertasMostradas: Oferta[] = [];
  cargosMostrados: CargoSolicitud[] = [];

  filtroReclutadores: string = 'todos';
  ordenReclutadores: string = 'reciente';

  filtroOfertas: string = 'todas';
  ordenOfertas: string = 'reciente';

  filtroCargos: string = 'todos';
  ordenCargos: string = 'reciente';

  cargando = false;

  isModalReclutadorOpen = false;
  isModalPostulanteOpen = false;
  isModalOfertaOpen = false;
  isModalCargoOpen = false;

  reclutadorSeleccionado: ReclutadorConEmpresa | null = null;
  postulanteSeleccionado: Postulante | null = null;
  ofertaSeleccionada: Oferta | null = null;
  cargoSeleccionado: CargoSolicitud | null = null;

  // Variables para el formulario de preguntas de Cargo (mínimo 3, máximo 10)
  mostrandoFormularioPreguntas = false;
  preguntasCargo: Pregunta[] = [];

  constructor() {
    addIcons({ 
      checkmarkCircleOutline, closeCircleOutline, businessOutline, 
      briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
      documentTextOutline, downloadOutline, callOutline, calendarOutline, homeOutline, globeOutline,
      linkOutline, peopleOutline, informationCircleOutline, timeOutline,
      menuOutline, listOutline, createOutline, documentOutline, helpCircleOutline,
      shieldCheckmarkOutline, schoolOutline, starOutline, heartOutline, hardwareChipOutline, syncOutline,
      trashOutline, logoLinkedin, filterOutline, swapVerticalOutline, addCircleOutline, layersOutline, removeCircleOutline
    });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.cargarDatos(this.vistaActual);
  }

  cambiarVista(nuevaVista: 'reclutadores' | 'postulantes' | 'ofertas' | 'cargos') {
    this.vistaActual = nuevaVista;
    this.cargarDatos(nuevaVista);
  }

  async cargarDatos(vista: string) {
    this.cargando = true;
    this.cdr.detectChanges();
    
    try {
      if (vista === 'reclutadores') {
        this.reclutadores = await this.adminService.getTodosReclutadores();
      } else if (vista === 'postulantes') {
        this.postulantes = await this.adminService.getPostulantes();
      } else if (vista === 'ofertas') {
        this.ofertas = await this.adminService.getTodasOfertas();
      } else if (vista === 'cargos') {
        this.cargos = await this.adminService.getTodosCargos();
      }
    } catch (error) {
      console.error(`Error al cargar ${vista}:`, error);
    } finally {
      this.cargando = false;
      this.aplicarFiltros();
      this.cdr.detectChanges();
    }
  }

  aplicarFiltros() {
    let rec = [...this.reclutadores];
    if (this.filtroReclutadores !== 'todos') {
      rec = rec.filter(r => r.estado === this.filtroReclutadores);
    }
    rec.sort((a, b) => {
      if (this.ordenReclutadores === 'alfabetico') return a.nombre.localeCompare(b.nombre);
      const timeA = this.obtenerTimestamp(a.fechaCreacion);
      const timeB = this.obtenerTimestamp(b.fechaCreacion);
      return this.ordenReclutadores === 'reciente' ? timeB - timeA : timeA - timeB;
    });
    this.reclutadoresMostrados = rec;

    let ofe = [...this.ofertas];
    if (this.filtroOfertas !== 'todas') {
      ofe = ofe.filter(o => o.estado === this.filtroOfertas);
    }
    ofe.sort((a, b) => {
      if (this.ordenOfertas === 'alfabetico') return (a.titulo || '').localeCompare(b.titulo || '');
      if (this.ordenOfertas === 'empresa') return (a.nombreEmpresa || '').localeCompare(b.nombreEmpresa || '');
      const timeA = this.obtenerTimestamp(a.fechaPublicacion);
      const timeB = this.obtenerTimestamp(b.fechaPublicacion);
      return this.ordenOfertas === 'reciente' ? timeB - timeA : timeA - timeB;
    });
    this.ofertasMostradas = ofe;

    let car = [...this.cargos];
    if (this.filtroCargos !== 'todos') {
      car = car.filter(c => (c.estado || '').toLowerCase() === this.filtroCargos.toLowerCase());
    }
    car.sort((a, b) => {
      if (this.ordenCargos === 'alfabetico') return (a.nombre || '').localeCompare(b.nombre || '');
      if (this.ordenCargos === 'empresa') return (a.nombreEmpresa || '').localeCompare(b.nombreEmpresa || '');
      const timeA = this.obtenerTimestamp(a.fechaSolicitud);
      const timeB = this.obtenerTimestamp(b.fechaSolicitud);
      return this.ordenCargos === 'reciente' ? timeB - timeA : timeA - timeB;
    });
    this.cargosMostrados = car;
  }

  obtenerTimestamp(fecha: any): number {
    if (!fecha) return 0;
    if (fecha.seconds) return fecha.seconds * 1000;
    const parsed = Date.parse(fecha);
    return isNaN(parsed) ? 0 : parsed;
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return 'No disponible';
    if (fecha && fecha.seconds) {
      return new Date(fecha.seconds * 1000).toLocaleDateString('es-CL', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
    return typeof fecha === 'string' ? fecha : fecha.toString();
  }

  descargarCV(base64: string | undefined, nombreArchivo: string | undefined) {
    if (!base64 || !nombreArchivo) return;
    const a = document.createElement('a');
    a.href = base64; 
    a.download = nombreArchivo; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==========================================
  // LÓGICA DE RECLUTADORES
  // ==========================================
  abrirModalReclutador(reclutador: ReclutadorConEmpresa) {
    this.reclutadorSeleccionado = reclutador;
    this.isModalReclutadorOpen = true;
  }
  cerrarModalReclutador() {
    this.isModalReclutadorOpen = false;
    this.reclutadorSeleccionado = null;
  }
  async procesarReclutador(nuevoEstado: 'aprobado' | 'rechazado') {
    if (!this.reclutadorSeleccionado) return;
    try {
      await this.adminService.actualizarEstadoReclutador(this.reclutadorSeleccionado.id, nuevoEstado);
      this.cerrarModalReclutador();
      this.cargarDatos('reclutadores');
    } catch (error) {
      console.error(`Error al marcar como ${nuevoEstado}:`, error);
    }
  }

  async eliminarReclutador(reclutador: ReclutadorConEmpresa) {
    const alert = await this.alertController.create({
      header: 'Eliminar Reclutador y Empresa',
      message: `¿Estás seguro que deseas eliminar permanentemente a ${reclutador.nombre} y toda la información de su empresa asociada? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar Todo',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.eliminarReclutadorYEmpresa(reclutador.id, reclutador.empresaId);
              this.cerrarModalReclutador();
              this.cargarDatos('reclutadores');
            } catch (error) {
              console.error('Error al eliminar reclutador y empresa:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ==========================================
  // LÓGICA DE POSTULANTES
  // ==========================================
  abrirModalPostulante(postulante: Postulante) {
    this.postulanteSeleccionado = postulante;
    this.isModalPostulanteOpen = true;
  }
  cerrarModalPostulante() {
    this.isModalPostulanteOpen = false;
    this.postulanteSeleccionado = null;
  }
  
  async eliminarPostulante(postulante: Postulante) {
    const alert = await this.alertController.create({
      header: 'Eliminar Postulante',
      message: `¿Estás seguro que deseas eliminar permanentemente a ${postulante.nombre} de la base de datos? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.eliminarPostulante(postulante.id);
              this.cerrarModalPostulante();
              this.cargarDatos('postulantes');
            } catch (error) {
              console.error('Error al eliminar postulante:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ==========================================
  // LÓGICA DE OFERTAS
  // ==========================================
  abrirModalOferta(oferta: Oferta) {
    this.ofertaSeleccionada = oferta;
    this.isModalOfertaOpen = true;
  }
  cerrarModalOferta() {
    this.isModalOfertaOpen = false;
    this.ofertaSeleccionada = null;
  }
  async alternarEstadoOferta(oferta: Oferta) {
    try {
      const nuevoEstado = await this.adminService.alternarEstadoOferta(oferta.id, oferta.estado);
      if (this.ofertaSeleccionada) {
        this.ofertaSeleccionada.estado = nuevoEstado;
      }
      this.cargarDatos('ofertas'); 
    } catch (error) {
      console.error('Error al alternar el estado de la oferta:', error);
    }
  }

  async eliminarOferta(oferta: Oferta) {
    const alert = await this.alertController.create({
      header: 'Eliminar Oferta',
      message: `¿Estás seguro que deseas eliminar la oferta "${oferta.titulo}" de la base de datos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.eliminarOferta(oferta.id);
              this.cerrarModalOferta();
              this.cargarDatos('ofertas');
            } catch (error) {
              console.error('Error al eliminar oferta:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ==========================================
  // LÓGICA DE CARGOS Y PREGUNTAS CON PUNTAJE
  // ==========================================
  crearPreguntaVacia(num: number): Pregunta {
    return {
      id: `preg_${Date.now()}_${num}_${Math.floor(Math.random() * 1000)}`,
      texto: '',
      tipo: 'alternativas',
      requerida: true,
      opciones: [
        { texto: '', puntaje: 0 },
        { texto: '', puntaje: 0 }
      ]
    };
  }

  inicializarPreguntasDesdeCargo(cargo: CargoSolicitud): Pregunta[] {
    if (cargo.preguntas && cargo.preguntas.length > 0) {
      const convertidas: Pregunta[] = cargo.preguntas.map((p: any, idx: number) => {
        // Compatibilidad por si había preguntas guardadas como string en pruebas previas
        if (typeof p === 'string') {
          return {
            id: `preg_${Date.now()}_${idx + 1}`,
            texto: p,
            tipo: 'alternativas',
            requerida: true,
            opciones: [
              { texto: '', puntaje: 0 },
              { texto: '', puntaje: 0 }
            ]
          };
        }
        // Si ya es un objeto Pregunta con opciones
        return {
          id: p.id || `preg_${Date.now()}_${idx + 1}`,
          texto: p.texto || '',
          tipo: p.tipo || 'alternativas',
          requerida: true,
          opciones: (p.opciones && p.opciones.length >= 2)
            ? p.opciones.map((o: any) => ({ texto: o.texto || '', puntaje: Number(o.puntaje) || 0 }))
            : [{ texto: '', puntaje: 0 }, { texto: '', puntaje: 0 }]
        };
      });

      while (convertidas.length < 3) {
        convertidas.push(this.crearPreguntaVacia(convertidas.length + 1));
      }
      return convertidas.slice(0, 10);
    }

    return [
      this.crearPreguntaVacia(1),
      this.crearPreguntaVacia(2),
      this.crearPreguntaVacia(3)
    ];
  }

  abrirModalCargo(cargo: CargoSolicitud) {
    this.cargoSeleccionado = cargo;
    this.mostrandoFormularioPreguntas = false;
    this.preguntasCargo = this.inicializarPreguntasDesdeCargo(cargo);
    this.isModalCargoOpen = true;
  }

  cerrarModalCargo() {
    this.isModalCargoOpen = false;
    this.cargoSeleccionado = null;
    this.mostrandoFormularioPreguntas = false;
    this.preguntasCargo = [];
  }

  mostrarCamposPreguntas() {
    if (this.cargoSeleccionado) {
      this.preguntasCargo = this.inicializarPreguntasDesdeCargo(this.cargoSeleccionado);
    }
    this.mostrandoFormularioPreguntas = true;
  }

  // Agregar pregunta (máximo 10)
  agregarPreguntaCargo() {
    if (this.preguntasCargo.length < 10) {
      this.preguntasCargo.push(this.crearPreguntaVacia(this.preguntasCargo.length + 1));
    }
  }

  // Eliminar pregunta (mínimo 3)
  eliminarPreguntaCargo(index: number) {
    if (this.preguntasCargo.length > 3) {
      this.preguntasCargo.splice(index, 1);
    }
  }

  // Agregar alternativa a una pregunta (mínimo 2, máximo 5 en total)
  agregarOpcionPregunta(preguntaIndex: number) {
    const pregunta = this.preguntasCargo[preguntaIndex];
    if (pregunta && pregunta.opciones.length < 5) {
      pregunta.opciones.push({ texto: '', puntaje: 0 });
    }
  }

  // Eliminar alternativa de una pregunta (mínimo 2)
  eliminarOpcionPregunta(preguntaIndex: number, opcionIndex: number) {
    const pregunta = this.preguntasCargo[preguntaIndex];
    if (pregunta && pregunta.opciones.length > 2) {
      pregunta.opciones.splice(opcionIndex, 1);
    }
  }

  async confirmarAprobacionCargo() {
    if (!this.cargoSeleccionado) return;

    if (this.preguntasCargo.length < 3 || this.preguntasCargo.length > 10) {
      const alert = await this.alertController.create({
        header: 'Cantidad de preguntas inválida',
        message: 'Debes definir entre 3 y 10 preguntas obligatorias para el cargo.',
        buttons: ['Entendido']
      });
      await alert.present();
      return;
    }

    // Validar que todas las preguntas tengan texto y que sus alternativas (2 a 5) tengan texto y puntaje válido
    for (let i = 0; i < this.preguntasCargo.length; i++) {
      const p = this.preguntasCargo[i];
      if (!p.texto || p.texto.trim().length === 0) {
        const alert = await this.alertController.create({
          header: 'Pregunta incompleta',
          message: `Por favor escribe el enunciado de la Pregunta ${i + 1}.`,
          buttons: ['Entendido']
        });
        await alert.present();
        return;
      }

      if (!p.opciones || p.opciones.length < 2 || p.opciones.length > 5) {
        const alert = await this.alertController.create({
          header: 'Alternativas inválidas',
          message: `La Pregunta ${i + 1} debe tener entre 2 y 5 alternativas.`,
          buttons: ['Entendido']
        });
        await alert.present();
        return;
      }

      for (let j = 0; j < p.opciones.length; j++) {
        const op = p.opciones[j];
        const puntajeNum = Number(op.puntaje);
        if (!op.texto || op.texto.trim().length === 0 || op.puntaje === null || op.puntaje === undefined || isNaN(puntajeNum)) {
          const alert = await this.alertController.create({
            header: 'Alternativa incompleta',
            message: `Completa el texto y un puntaje válido para la Alternativa ${j + 1} de la Pregunta ${i + 1}.`,
            buttons: ['Entendido']
          });
          await alert.present();
          return;
        }
      }
    }

    // Limpiar y normalizar datos antes de enviar a Firebase
    const preguntasFinales: Pregunta[] = this.preguntasCargo.map((p, idx) => ({
      id: p.id || `preg_${Date.now()}_${idx + 1}`,
      texto: p.texto.trim(),
      tipo: 'alternativas',
      requerida: true,
      opciones: p.opciones.map(op => ({
        texto: op.texto.trim(),
        puntaje: Number(op.puntaje)
      }))
    }));

    try {
      await this.adminService.aprobarCargoConPreguntas(this.cargoSeleccionado.id, preguntasFinales);
      this.cerrarModalCargo();
      this.cargarDatos('cargos');
    } catch (error) {
      console.error('Error al aprobar el cargo con preguntas:', error);
    }
  }

  async rechazarSolicitudCargo() {
    if (!this.cargoSeleccionado) return;
    try {
      await this.adminService.rechazarCargo(this.cargoSeleccionado.id);
      this.cerrarModalCargo();
      this.cargarDatos('cargos');
    } catch (error) {
      console.error('Error al rechazar el cargo:', error);
    }
  }

  async eliminarCargo(cargo: CargoSolicitud) {
    const alert = await this.alertController.create({
      header: 'Eliminar Solicitud de Cargo',
      message: `¿Estás seguro que deseas eliminar el cargo "${cargo.nombre}" (${cargo.numeroSolicitud}) de la base de datos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.eliminarCargo(cargo.id);
              this.cerrarModalCargo();
              this.cargarDatos('cargos');
            } catch (error) {
              console.error('Error al eliminar cargo:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }
}