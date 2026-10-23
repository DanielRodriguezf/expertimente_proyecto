import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonCard, IonCardContent, IonIcon, IonFooter,
  IonSpinner, IonProgressBar, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, ViewWillEnter 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, briefcaseOutline, checkmarkCircle, 
  folderOpenOutline, businessOutline, documentTextOutline,
  callOutline, home, homeOutline, chevronBackOutline, 
  chevronForwardOutline, searchOutline, 
  closeCircleOutline, informationCircle 
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, query, where, doc, updateDoc, getDocs } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-mis-postulaciones',
  templateUrl: './mis-postulaciones.page.html',
  styleUrls: ['./mis-postulaciones.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IonContent, IonHeader, 
    IonToolbar, IonTitle, IonButtons, IonButton, IonCard, 
    IonCardContent, IonIcon, IonFooter, IonSpinner,
    IonProgressBar, IonBackButton, IonSegment, IonSegmentButton, IonLabel
  ]
})
export class MisPostulacionesPage implements OnInit, ViewWillEnter {
  
  uid: string = '';
  misPostulaciones: any[] = [];
  postulacionesFiltradas: any[] = []; 
  filtroActual: string = 'revision';  

  itemActual: any = null;
  pasoActual: number = 1;
  totalPasos: number = 1;
  cargando: boolean = true;

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'briefcase-outline': briefcaseOutline,
      'checkmark-circle': checkmarkCircle,
      'folder-open-outline': folderOpenOutline,
      'business-outline': businessOutline,
      'document-text-outline': documentTextOutline,
      'call-outline': callOutline,
      'home': home,
      'home-outline': homeOutline,
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'search-outline': searchOutline,
      'close-circle-outline': closeCircleOutline,
      'information-circle': informationCircle
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.uid = user.uid;
        await this.cargarMisPostulaciones();
      } else {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  async ionViewWillEnter() {
    if (this.uid) {
      await this.cargarMisPostulaciones();
    }
  }

  // Función auxiliar para extraer el nombre de la empresa desde el mensaje si el campo viene vacío
  private obtenerNombreEmpresa(data: any, tieneRespuestaEmpresa: boolean): string {
    const empresaDirecta = (data['nombreEmpresa'] || data['empresa'] || '').trim();
    if (empresaDirecta !== '') {
      return empresaDirecta;
    }

    // Si no viene en el campo pero sí en el mensaje: 'Has sido seleccionado para el cargo "Panadero" por Empresa A. El reclutador...'
    if (data['mensaje']) {
      const match = data['mensaje'].match(/por\s+([^.]+)\./i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return tieneRespuestaEmpresa ? 'Empresa Reclutadora' : 'ExpertiMente (Terna General)';
  }

  async cargarMisPostulaciones() {
    if (!this.uid) return;
    this.cargando = true;

    try {
      // 1. Ofertas normales
      const postulacionesRef = collection(this.firestore, 'postulaciones');
      const qNormales = query(postulacionesRef, where('postulanteId', '==', this.uid));
      
      // 2. Postulaciones de terna
      const ternasRef = collection(this.firestore, 'postulaciones-terna');
      const qTernas = query(ternasRef, where('postulanteId', '==', this.uid));

      // 3. Notificaciones / Selecciones / Rechazos
      const notifRef = collection(this.firestore, 'notificaciones');
      const qNotif = query(notifRef, where('postulanteId', '==', this.uid));

      const [snapNormales, snapTernas, snapNotif] = await Promise.all([
        getDocs(qNormales),
        getDocs(qTernas),
        getDocs(qNotif).catch(() => null)
      ]);

      const tempPosts: any[] = [];
      const notificacionesPorCargo: { [cargoId: string]: any } = {};
      const notificacionesPorOferta: { [ofertaId: string]: any } = {};

      // Indexamos las notificaciones por cargoId u ofertaId
      if (snapNotif) {
        snapNotif.forEach((docSnap) => {
          const data = docSnap.data();
          const notifItem = { idNotif: docSnap.id, ...data };

          if (data['cargoId']) {
            // Si hay más de una notificación para el mismo cargo, priorizamos la no leída o la más reciente
            const existente = notificacionesPorCargo[data['cargoId']];
            if (!existente || data['leido'] === false) {
              notificacionesPorCargo[data['cargoId']] = notifItem;
            }
          } else if (data['ofertaId'] || data['postulacionId']) {
            const key = data['ofertaId'] || data['postulacionId'];
            notificacionesPorOferta[key] = notifItem;
          }
        });
      }

      // Procesar ofertas normales
      snapNormales.forEach((docSnap) => {
        const data = docSnap.data();
        const notifAsociada = notificacionesPorOferta[docSnap.id] || notificacionesPorOferta[data['ofertaId']] || null;

        const leidoDoc = data['leido'] ?? true;
        const leidoNotif = notifAsociada ? (notifAsociada['leido'] ?? true) : true;
        const estaLeido = leidoDoc && leidoNotif;

        tempPosts.push({
          ...data,
          id: docSnap.id,
          idNotif: notifAsociada ? notifAsociada.idNotif : null,
          coleccionOrigen: 'postulaciones',
          tipo: 'oferta',
          tituloOferta: data['tituloOferta'] || 'Oferta de Empleo',
          nombreEmpresa: (data['nombreEmpresa'] || notifAsociada?.['nombreEmpresa'] || '').trim() || 'Empresa Confidencial',
          estado: notifAsociada?.['estado'] || data['estado'] || 'Enviada',
          leido: estaLeido,
          mostrarBadgeNueva: !estaLeido
        });
      });

      const cargosTernaProcesados = new Set<string>();

      // Procesar postulaciones de terna
      snapTernas.forEach((docSnap) => {
        const data = docSnap.data();
        const cargoId = data['cargoId'];
        if (cargoId) cargosTernaProcesados.add(cargoId);

        const datosNotif = (cargoId && notificacionesPorCargo[cargoId]) ? notificacionesPorCargo[cargoId] : null;
        const dataCombinada = datosNotif ? { ...data, ...datosNotif } : data;

        const estadoRaw = (dataCombinada['estado'] || '').toLowerCase();
        const tipoRaw = (dataCombinada['tipo'] || '').toLowerCase();

        const esRechazado =
          tipoRaw.includes('rechazad') ||
          tipoRaw.includes('descartad') ||
          estadoRaw.includes('rechazad') ||
          estadoRaw.includes('no seleccionad');

        const esSeleccionado = !esRechazado && (
          tipoRaw === 'seleccionado' || 
          estadoRaw.includes('aceptad') || 
          estadoRaw.includes('seleccionad') ||
          (!!datosNotif && !esRechazado)
        );

        let estadoFinal = dataCombinada['estado'] || 'En revisión';
        if (esSeleccionado) estadoFinal = 'Aceptada';
        if (esRechazado) estadoFinal = 'Rechazada';

        const nombreCargo = dataCombinada['nombreCargo'] || dataCombinada['cargo'] || 'Cargo de Interés';
        const nombreEmpresa = this.obtenerNombreEmpresa(dataCombinada, esSeleccionado || esRechazado);

        // Si cualquiera de los dos documentos (postulaciones-terna o notificaciones) tiene leido === false, se considera no leído
        const leidoTerna = data['leido'] !== undefined ? data['leido'] : true;
        const leidoNotif = datosNotif && datosNotif['leido'] !== undefined ? datosNotif['leido'] : true;
        const estaLeido = leidoTerna && leidoNotif;

        tempPosts.push({
          ...dataCombinada,
          id: docSnap.id,
          idNotif: datosNotif ? datosNotif.idNotif : null,
          coleccionOrigen: 'postulaciones-terna',
          tipo: tipoRaw || 'terna',
          esTerna: true,
          tituloOferta: `Terna: ${nombreCargo}`,
          nombreEmpresa: nombreEmpresa,
          estado: estadoFinal,
          mensaje: dataCombinada['mensaje'] || '',
          leido: estaLeido,
          mostrarBadgeNueva: !estaLeido
        });
      });

      // Si había una notificación de terna guardada directamente en 'notificaciones' cuyo cargoId no estaba en 'postulaciones-terna'
      Object.keys(notificacionesPorCargo).forEach(cargoId => {
        if (!cargosTernaProcesados.has(cargoId)) {
          const data = notificacionesPorCargo[cargoId];
          const estadoRaw = (data['estado'] || '').toLowerCase();
          const tipoRaw = (data['tipo'] || '').toLowerCase();

          const esRechazado =
            tipoRaw.includes('rechazad') ||
            tipoRaw.includes('descartad') ||
            estadoRaw.includes('rechazad');

          const estadoFinal = esRechazado ? 'Rechazada' : 'Aceptada';
          const nombreCargo = data['nombreCargo'] || data['cargo'] || 'Cargo de Interés';
          const nombreEmpresa = this.obtenerNombreEmpresa(data, true);
          const estaLeido = data['leido'] ?? true;

          tempPosts.push({
            ...data,
            id: data.idNotif,
            idNotif: data.idNotif,
            coleccionOrigen: 'notificaciones',
            tipo: tipoRaw || 'terna',
            esTerna: true,
            tituloOferta: `Terna: ${nombreCargo}`,
            nombreEmpresa: nombreEmpresa,
            estado: estadoFinal,
            mensaje: data['mensaje'] || '',
            leido: estaLeido,
            mostrarBadgeNueva: !estaLeido
          });
        }
      });

      this.misPostulaciones = tempPosts;
      this.aplicarFiltro(); 
      
    } catch (error) {
      console.error('Error cargando postulaciones y ternas:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  aplicarFiltro() {
    this.postulacionesFiltradas = this.misPostulaciones.filter(p => {
      const estado = p.estado ? p.estado.toLowerCase() : 'enviada';
      const tipo = p.tipo ? p.tipo.toLowerCase() : '';

      if (this.filtroActual === 'revision') {
        return (estado.includes('enviada') || estado.includes('revisión') || estado.includes('revision')) 
          && !estado.includes('aceptad') 
          && !estado.includes('rechazad') 
          && tipo !== 'seleccionado';
      }
      if (this.filtroActual === 'aceptadas') {
        return (estado.includes('aceptad') || estado.includes('seleccionad') || tipo === 'seleccionado') 
          && !estado.includes('rechazad'); 
      }
      if (this.filtroActual === 'rechazadas') {
        return estado.includes('rechazad') || tipo.includes('rechazad') || tipo.includes('descartad'); 
      }
      return false;
    });

    this.totalPasos = this.postulacionesFiltradas.length > 0 ? this.postulacionesFiltradas.length : 1;
    this.pasoActual = 1;
    this.actualizarItemActual();
  }

  segmentChanged(event: any) {
    this.filtroActual = event.detail.value;
    this.aplicarFiltro();
  }

  async actualizarItemActual() {
    if (this.postulacionesFiltradas.length > 0) {
      this.itemActual = this.postulacionesFiltradas[this.pasoActual - 1];

      // Si el documento o su notificación asociada aún figura con leido === false en Firebase, lo actualizamos
      if (this.itemActual && this.itemActual.leido === false) {
        try {
          const promesasActualizacion: Promise<void>[] = [];

          // 1. Actualizar documento principal (postulaciones, postulaciones-terna o notificaciones)
          const nombreColeccion = this.itemActual.coleccionOrigen || (this.itemActual.esTerna ? 'postulaciones-terna' : 'postulaciones');
          if (this.itemActual.id) {
            const docRef = doc(this.firestore, `${nombreColeccion}/${this.itemActual.id}`);
            promesasActualizacion.push(updateDoc(docRef, { leido: true }).catch(() => {}));
          }

          // 2. Si además viene vinculado a un documento en la colección 'notificaciones', actualizarlo también en Firebase
          if (this.itemActual.idNotif && nombreColeccion !== 'notificaciones') {
            const notifDocRef = doc(this.firestore, `notificaciones/${this.itemActual.idNotif}`);
            promesasActualizacion.push(updateDoc(notifDocRef, { leido: true }).catch(() => {}));
          }

          await Promise.all(promesasActualizacion);

          // Marcamos leido = true en memoria para no volver a disparar escrituras en esta sesión
          this.itemActual.leido = true;
          this.cdr.detectChanges();
        } catch (error) {
          console.error('Error al actualizar estado leido en Firebase:', error);
        }
      }
    } else {
      this.itemActual = null;
    }
  }

  siguientePaso() {
    if (this.itemActual) {
      this.itemActual.mostrarBadgeNueva = false;
    }
    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
      this.actualizarItemActual();
    }
  }

  pasoAnterior() {
    if (this.itemActual) {
      this.itemActual.mostrarBadgeNueva = false;
    }
    if (this.pasoActual > 1) {
      this.pasoActual--;
      this.actualizarItemActual();
    }
  }
}