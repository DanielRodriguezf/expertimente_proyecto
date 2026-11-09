import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonList, IonItem, IonLabel, IonBadge, 
  IonButton, IonButtons, IonIcon,
  IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
  IonAvatar, IonMenu, IonMenuButton, IonSplitPane, IonMenuToggle, AlertController,
  IonSelect, IonSelectOption, IonInput, IonTextarea 
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

import { AdminService, ReclutadorConEmpresa, Postulante, Oferta, CargoSolicitud, AreaCatalogo } from '../services/admin.service';

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
    IonSelect, IonSelectOption, IonInput, IonTextarea 
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

  // Variables para editar/estandarizar el Cargo antes de aprobarlo (1 sola área obligatoria)
  mostrandoFormularioCargo = false;
  formularioCargo = {
    nombre: '',
    areaLaboral: '',
    descripcion: '',
    habilidadesTecnicas: '',
    habilidadesBlandas: '',
    anosExperienciaMinima: 0,
    nivelEducativoMinimo: 'Sin requisito'
  };

  // Variables para el catálogo de Áreas desde la colección 'areas' de Firestore
  areasCatalogo: AreaCatalogo[] = [];
  areasFiltradas: AreaCatalogo[] = [];
  mostrarDropdownAreas = false;

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

  ngOnInit() {
    // Limpiar cualquier catálogo antiguo guardado en localStorage
    localStorage.removeItem('expertimente_areas_catalogo');
  }

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
        const [cargosData, areasData] = await Promise.all([
          this.adminService.getTodosCargos(),
          this.adminService.getAreas()
        ]);
        this.cargos = cargosData;
        this.areasCatalogo = areasData;
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
  // LÓGICA DE CARGOS Y 1 ÁREA EN FIRESTORE
  // ==========================================
  async cargarAreasDesdeFirestore() {
    try {
      this.areasCatalogo = await this.adminService.getAreas();
      this.filtrarAreasDisponibles();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar áreas desde Firestore:', error);
    }
  }

  alEnfocarArea() {
    this.filtrarAreasDisponibles();
    this.mostrarDropdownAreas = true;
  }

  alEscribirArea() {
    this.filtrarAreasDisponibles();
    this.mostrarDropdownAreas = true;
  }

  filtrarAreasDisponibles() {
    const texto = (this.formularioCargo.areaLaboral || '').trim().toLowerCase();
    if (!texto) {
      this.areasFiltradas = [...this.areasCatalogo];
    } else {
      this.areasFiltradas = this.areasCatalogo.filter(area =>
        area.nombre.toLowerCase().includes(texto)
      );
    }
  }

  esAreaNueva(): boolean {
    const texto = (this.formularioCargo.areaLaboral || '').trim().toLowerCase();
    if (!texto) return false;
    return !this.areasCatalogo.some(area => area.nombre.toLowerCase() === texto);
  }

  seleccionarAreaExistente(area: AreaCatalogo) {
    this.formularioCargo.areaLaboral = area.nombre;
    this.mostrarDropdownAreas = false;
    this.cdr.detectChanges();
  }

  async crearYSeleccionarArea(nombre: string) {
    const limpia = (nombre || '').trim();
    if (!limpia) return;

    const existente = this.areasCatalogo.find(a => a.nombre.toLowerCase() === limpia.toLowerCase());
    if (existente) {
      this.formularioCargo.areaLaboral = existente.nombre;
      this.mostrarDropdownAreas = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      const nuevaArea = await this.adminService.crearArea(limpia);
      this.areasCatalogo.push(nuevaArea);
      this.areasCatalogo.sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.formularioCargo.areaLaboral = nuevaArea.nombre;
      this.filtrarAreasDisponibles();
      this.mostrarDropdownAreas = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al crear nueva área en Firestore:', error);
    }
  }

  async eliminarAreaDeCatalogo(area: AreaCatalogo, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    const alert = await this.alertController.create({
      header: 'Eliminar Área',
      message: `¿Deseas eliminar "${area.nombre}" de la lista de áreas guardadas en la base de datos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminService.eliminarArea(area.id);
              this.areasCatalogo = this.areasCatalogo.filter(a => a.id !== area.id);
              if ((this.formularioCargo.areaLaboral || '').trim().toLowerCase() === area.nombre.toLowerCase()) {
                this.formularioCargo.areaLaboral = '';
              }
              this.filtrarAreasDisponibles();
              this.cdr.detectChanges();
            } catch (error) {
              console.error('Error al eliminar área de Firestore:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  cerrarDropdownAreasConRetraso() {
    setTimeout(() => {
      this.mostrarDropdownAreas = false;
      this.cdr.detectChanges();
    }, 200);
  }

  cargarDatosEnFormularioCargo(cargo: CargoSolicitud) {
    // Si algún cargo antiguo tenía áreas separadas por coma, tomamos solo la primera
    const areaInicial = cargo.areaLaboral ? cargo.areaLaboral.split(',')[0].trim() : '';

    this.formularioCargo = {
      nombre: cargo.nombre || '',
      areaLaboral: areaInicial,
      descripcion: cargo.descripcion || '',
      habilidadesTecnicas: cargo.habilidadesTecnicas || '',
      habilidadesBlandas: cargo.habilidadesBlandas || '',
      anosExperienciaMinima: cargo.anosExperienciaMinima ?? 0,
      nivelEducativoMinimo: cargo.nivelEducativoMinimo || 'Sin requisito'
    };
  }

  abrirModalCargo(cargo: CargoSolicitud) {
    this.cargoSeleccionado = cargo;
    this.mostrandoFormularioCargo = false;
    this.mostrarDropdownAreas = false;
    this.cargarDatosEnFormularioCargo(cargo);
    this.cargarAreasDesdeFirestore();
    this.isModalCargoOpen = true;
  }

  cerrarModalCargo() {
    this.isModalCargoOpen = false;
    this.cargoSeleccionado = null;
    this.mostrandoFormularioCargo = false;
    this.mostrarDropdownAreas = false;
  }

  mostrarEditorCargo() {
    if (this.cargoSeleccionado) {
      this.cargarDatosEnFormularioCargo(this.cargoSeleccionado);
      this.cargarAreasDesdeFirestore();
    }
    this.mostrandoFormularioCargo = true;
  }

  async confirmarAprobacionCargo() {
    if (!this.cargoSeleccionado) return;

    const nombreLimpio = (this.formularioCargo.nombre || '').trim();
    let areaLimpia = (this.formularioCargo.areaLaboral || '').trim();
    const descripcionLimpia = (this.formularioCargo.descripcion || '').trim();
    const habTecnicasLimpias = (this.formularioCargo.habilidadesTecnicas || '').trim();
    const habBlandasLimpias = (this.formularioCargo.habilidadesBlandas || '').trim();
    const expMinima = Number(this.formularioCargo.anosExperienciaMinima);

    if (!nombreLimpio || !areaLimpia || !descripcionLimpia || !habTecnicasLimpias) {
      const alert = await this.alertController.create({
        header: 'Campos requeridos incompletos',
        message: 'Por favor completa el Nombre del Cargo, 1 Área Laboral obligatoria, la Descripción y las Habilidades Técnicas para que la IA pueda evaluar la idoneidad.',
        buttons: ['Entendido']
      });
      await alert.present();
      return;
    }

    if (isNaN(expMinima) || expMinima < 0) {
      const alert = await this.alertController.create({
        header: 'Experiencia inválida',
        message: 'Los años de experiencia mínima deben ser un número mayor o igual a 0.',
        buttons: ['Entendido']
      });
      await alert.present();
      return;
    }

    try {
      // Verificar si el área escrita ya existe en la colección 'areas' de Firestore; si no existe, la creamos
      const areaExistente = this.areasCatalogo.find(
        a => a.nombre.toLowerCase() === areaLimpia.toLowerCase()
      );

      if (areaExistente) {
        areaLimpia = areaExistente.nombre;
      } else {
        const nuevaArea = await this.adminService.crearArea(areaLimpia);
        this.areasCatalogo.push(nuevaArea);
        this.areasCatalogo.sort((a, b) => a.nombre.localeCompare(b.nombre));
        areaLimpia = nuevaArea.nombre;
      }

      await this.adminService.aprobarYActualizarCargo(this.cargoSeleccionado.id, {
        nombre: nombreLimpio,
        areaLaboral: areaLimpia,
        descripcion: descripcionLimpia,
        habilidadesTecnicas: habTecnicasLimpias,
        habilidadesBlandas: habBlandasLimpias,
        anosExperienciaMinima: expMinima,
        nivelEducativoMinimo: this.formularioCargo.nivelEducativoMinimo || 'Sin requisito'
      });
      this.cerrarModalCargo();
      this.cargarDatos('cargos');
    } catch (error) {
      console.error('Error al actualizar y aprobar el cargo:', error);
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