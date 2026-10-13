import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonList, IonItem, IonLabel, IonBadge, 
  IonButton, IonButtons, IonIcon,
  IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
  IonAvatar, IonMenu, IonMenuButton, IonSplitPane, IonMenuToggle, AlertController,
  IonSelect, IonSelectOption 
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
  filterOutline, swapVerticalOutline 
} from 'ionicons/icons';

import { AdminService, ReclutadorConEmpresa, Postulante, Oferta } from '../services/admin.service';

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
    IonSelect, IonSelectOption 
  ]
})
export class DashboardPage implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private alertController = inject(AlertController);

  vistaActual: 'reclutadores' | 'postulantes' | 'ofertas' = 'reclutadores';
  
  reclutadores: ReclutadorConEmpresa[] = [];
  postulantes: Postulante[] = [];
  ofertas: Oferta[] = [];

  reclutadoresMostrados: ReclutadorConEmpresa[] = [];
  ofertasMostradas: Oferta[] = [];

  filtroReclutadores: string = 'todos';
  ordenReclutadores: string = 'reciente';

  filtroOfertas: string = 'todas';
  ordenOfertas: string = 'reciente';

  cargando = false;

  isModalReclutadorOpen = false;
  isModalPostulanteOpen = false;
  isModalOfertaOpen = false;

  reclutadorSeleccionado: ReclutadorConEmpresa | null = null;
  postulanteSeleccionado: Postulante | null = null;
  ofertaSeleccionada: Oferta | null = null;

  constructor() {
    addIcons({ 
      checkmarkCircleOutline, closeCircleOutline, businessOutline, 
      briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
      documentTextOutline, downloadOutline, callOutline, calendarOutline, homeOutline, globeOutline,
      linkOutline, peopleOutline, informationCircleOutline, timeOutline,
      menuOutline, listOutline, createOutline, documentOutline, helpCircleOutline,
      shieldCheckmarkOutline, schoolOutline, starOutline, heartOutline, hardwareChipOutline, syncOutline,
      trashOutline, logoLinkedin, filterOutline, swapVerticalOutline
    });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.cargarDatos(this.vistaActual);
  }

  cambiarVista(nuevaVista: 'reclutadores' | 'postulantes' | 'ofertas') {
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
}