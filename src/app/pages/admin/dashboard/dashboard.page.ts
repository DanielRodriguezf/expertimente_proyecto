import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonList, IonItem, IonLabel, IonBadge, 
  IonButton, IonButtons, IonIcon, IonSegment, IonSegmentButton,
  IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
  IonAvatar
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  checkmarkCircleOutline, closeCircleOutline, businessOutline, 
  briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
  documentTextOutline, downloadOutline, 
  callOutline, calendarOutline, homeOutline, globeOutline,
  linkOutline, peopleOutline, informationCircleOutline, timeOutline // <-- Íconos nuevos para la empresa
} from 'ionicons/icons';

// Importamos el servicio y las interfaces
import { AdminService, ReclutadorConEmpresa, Postulante } from '../services/admin.service';

// --- INTERFACES PARA FIRESTORE (Las otras pestañas) ---
export interface Oferta {
  id?: string;
  titulo: string;
  empresa: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonHeader, IonToolbar, IonTitle, IonContent, 
    IonList, IonItem, IonLabel, IonBadge, 
    IonButton, IonButtons, IonIcon, IonSegment, IonSegmentButton,
    IonModal, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
    IonAvatar
  ]
})
export class DashboardPage implements OnInit {
  private adminService = inject(AdminService);

  segmentoActual: string = 'empresas';
  
  // --- Variables para los Reclutadores ---
  reclutadores: ReclutadorConEmpresa[] = [];
  cargandoReclutadores = true;
  isModalOpen = false;
  reclutadorSeleccionado: ReclutadorConEmpresa | null = null;

  // --- Variables para los Postulantes ---
  postulantes: Postulante[] = [];
  cargandoPostulantes = true;
  isModalPostulanteOpen = false;
  postulanteSeleccionado: Postulante | null = null;

  // Arreglo vacío para las ofertas
  ofertas: Oferta[] = [];

  constructor() {
    // Registramos los íconos
    addIcons({ 
      checkmarkCircleOutline, closeCircleOutline, businessOutline, 
      briefcaseOutline, personOutline, mailOutline, locationOutline, mapOutline, cardOutline,
      documentTextOutline, downloadOutline,
      callOutline, calendarOutline, homeOutline, globeOutline,
      linkOutline, peopleOutline, informationCircleOutline, timeOutline
    });
  }

  ngOnInit() {
    this.cargarReclutadoresPendientes();
    this.cargarPostulantes();
  }

  cambiarSegmento(event: any) {
    this.segmentoActual = event.detail.value;
  }

  // ==========================================
  // LÓGICA DE RECLUTADORES
  // ==========================================
  async cargarReclutadoresPendientes() {
    this.cargandoReclutadores = true;
    try {
      this.reclutadores = await this.adminService.getReclutadoresPendientes();
    } catch (error) {
      console.error('Error al cargar reclutadores:', error);
    } finally {
      this.cargandoReclutadores = false;
    }
  }

  abrirModalDetalles(reclutador: ReclutadorConEmpresa) {
    this.reclutadorSeleccionado = reclutador;
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.reclutadorSeleccionado = null;
  }

  async procesarReclutador(nuevoEstado: 'aprobado' | 'rechazado') {
    if (!this.reclutadorSeleccionado) return;
    
    try {
      await this.adminService.actualizarEstadoReclutador(this.reclutadorSeleccionado.id, nuevoEstado);
      this.cerrarModal();
      this.cargarReclutadoresPendientes();
    } catch (error) {
      console.error(`Error al marcar como ${nuevoEstado}:`, error);
    }
  }

  // ==========================================
  // LÓGICA DE POSTULANTES
  // ==========================================
  async cargarPostulantes() {
    this.cargandoPostulantes = true;
    try {
      this.postulantes = await this.adminService.getPostulantes();
    } catch (error) {
      console.error('Error al cargar postulantes:', error);
    } finally {
      this.cargandoPostulantes = false;
    }
  }

  abrirModalPostulante(postulante: Postulante) {
    this.postulanteSeleccionado = postulante;
    this.isModalPostulanteOpen = true;
  }

  cerrarModalPostulante() {
    this.isModalPostulanteOpen = false;
    this.postulanteSeleccionado = null;
  }

  // ==========================================
  // LÓGICA DE OFERTAS (Para el futuro)
  // ==========================================
  aprobarOferta(id: string | undefined) {}
  rechazarOferta(id: string | undefined) {}

  // ==========================================
  // DESCARGA DE CURRÍCULUM
  // ==========================================
  descargarCV(base64: string | undefined, nombreArchivo: string | undefined) {
    if (!base64 || !nombreArchivo) return;

    // Creamos un enlace <a> invisible en el HTML
    const a = document.createElement('a');
    a.href = base64; // Le pasamos el string del PDF
    a.download = nombreArchivo; // Le asignamos el nombre original
    
    // Lo "clickeamos" virtualmente para iniciar la descarga y luego lo borramos
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}