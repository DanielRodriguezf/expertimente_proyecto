import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonList, IonItem, IonLabel, IonBadge, 
  IonButton, IonButtons, IonIcon,
  IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
  IonAvatar, IonMenu, IonMenuButton, IonSplitPane, IonMenuToggle
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  checkmarkCircleOutline, closeCircleOutline, businessOutline, 
  briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
  documentTextOutline, downloadOutline, callOutline, calendarOutline, homeOutline, globeOutline,
  linkOutline, peopleOutline, informationCircleOutline, timeOutline,
  menuOutline, listOutline, createOutline, documentOutline, helpCircleOutline,
  shieldCheckmarkOutline, schoolOutline, starOutline,
  heartOutline, hardwareChipOutline, syncOutline // <-- Íconos nuevos
} from 'ionicons/icons';

// Importamos el servicio y las interfaces
import { AdminService, ReclutadorConEmpresa, Postulante, Empresa, Oferta } from '../services/admin.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonHeader, IonToolbar, IonTitle, IonContent, 
    IonList, IonItem, IonLabel, IonBadge, 
    IonButton, IonButtons, IonIcon, 
    IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
    IonAvatar, IonMenu, IonMenuButton, IonSplitPane, IonMenuToggle
  ]
})
export class DashboardPage implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  // Control del menú lateral
  vistaActual: 'reclutadores' | 'postulantes' | 'empresas' | 'ofertas' = 'reclutadores';
  
  // --- Variables de Datos ---
  reclutadores: ReclutadorConEmpresa[] = [];
  postulantes: Postulante[] = [];
  empresas: Empresa[] = [];
  ofertas: Oferta[] = [];

  // --- Estados de Carga ---
  cargando = false;

  // --- Control de Modales ---
  isModalReclutadorOpen = false;
  isModalPostulanteOpen = false;
  isModalEmpresaOpen = false;
  isModalOfertaOpen = false;

  // --- Elementos Seleccionados ---
  reclutadorSeleccionado: ReclutadorConEmpresa | null = null;
  postulanteSeleccionado: Postulante | null = null;
  empresaSeleccionada: Empresa | null = null;
  ofertaSeleccionada: Oferta | null = null;

  constructor() {
    addIcons({ 
      checkmarkCircleOutline, closeCircleOutline, businessOutline, 
      briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
      documentTextOutline, downloadOutline, callOutline, calendarOutline, homeOutline, globeOutline,
      linkOutline, peopleOutline, informationCircleOutline, timeOutline,
      menuOutline, listOutline, createOutline, documentOutline, helpCircleOutline,
      shieldCheckmarkOutline, schoolOutline, starOutline, heartOutline, hardwareChipOutline, syncOutline
    });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.cargarDatos(this.vistaActual);
  }

  // ==========================================
  // NAVEGACIÓN DEL MENÚ
  // ==========================================
  cambiarVista(nuevaVista: 'reclutadores' | 'postulantes' | 'empresas' | 'ofertas') {
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
      } else if (vista === 'empresas') {
        this.empresas = await this.adminService.getTodasEmpresas();
      } else if (vista === 'ofertas') {
        this.ofertas = await this.adminService.getTodasOfertas();
      }
    } catch (error) {
      console.error(`Error al cargar ${vista}:`, error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // UTILIDAD: FORMATEAR FECHA DE FIREBASE
  // ==========================================
  formatearFecha(fecha: any): string {
    if (!fecha) return 'No disponible';
    if (fecha && fecha.seconds) {
      return new Date(fecha.seconds * 1000).toLocaleDateString('es-CL', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
    return typeof fecha === 'string' ? fecha : fecha.toString();
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
  // LÓGICA DE EMPRESAS
  // ==========================================
  abrirModalEmpresa(empresa: Empresa) {
    this.empresaSeleccionada = empresa;
    this.isModalEmpresaOpen = true;
  }
  cerrarModalEmpresa() {
    this.isModalEmpresaOpen = false;
    this.empresaSeleccionada = null;
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
}