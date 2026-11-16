import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonButton, IonCard, IonCardContent, IonIcon,
  IonSpinner, IonProgressBar, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, ViewWillEnter 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, briefcaseOutline, checkmarkCircle, 
  folderOpenOutline, businessOutline, documentTextOutline,
  callOutline, home, homeOutline, chevronBackOutline, 
  chevronForwardOutline, searchOutline, 
  closeCircleOutline, informationCircle,
  timeOutline, checkmarkCircleOutline
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
    IonCardContent, IonIcon, IonSpinner,
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
      'information-circle': informationCircle,
      'time-outline': timeOutline,
      'checkmark-circle-outline': checkmarkCircleOutline
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

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private obtenerTimestamp(fecha: any): number {
    if (!fecha) return 0;
    if (typeof fecha.toMillis === 'function') return fecha.toMillis();
    if (typeof fecha.seconds === 'number') return fecha.seconds * 1000;
    const parsed = new Date(fecha).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }

  // Función auxiliar para extraer el nombre de la empresa desde el mensaje si el campo viene vacío
  private obtenerNombreEmpresa(data: any, tieneRespuestaEmpresa: boolean): string {
    const empresaDirecta = (data['nombreEmpresa'] || data['empresa'] || '').trim();
    if (empresaDirecta !== '') {
      return empresaDirecta;
    }

    if (data['mensaje']) {
      const matchPor = data['mensaje'].match(/por\s+([^.]+)\./i);
      if (matchPor && matchPor[1]) {
        return matchPor[1].trim();
      }
      const matchFelicidades = data['mensaje'].match(/¡Felicidades!\s+(.+?)\s+ha\s+aceptado/i);
      if (matchFelicidades && matchFelicidades[1]) {
        return matchFelicidades[1].trim();
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
      const listaNotificaciones: any[] = [];
      const notificacionesProcesadas = new Set<string>();

      if (snapNotif) {
        snapNotif.forEach((docSnap) => {
          listaNotificaciones.push({
            idNotif: docSnap.id,
            ...docSnap.data()
          });
        });
      }

      // Ordenar notificaciones: primero las no leídas y luego las más recientes
      listaNotificaciones.sort((a, b) => {
        if (a['leido'] === false && b['leido'] !== false) return -1;
        if (a['leido'] !== false && b['leido'] === false) return 1;
        return this.obtenerTimestamp(b['fecha']) - this.obtenerTimestamp(a['fecha']);
      });

      // Procesar ofertas normales
      snapNormales.forEach((docSnap) => {
        const data = docSnap.data();
        const tituloNorm = this.normalizarTexto(data['tituloOferta'] || '');

        const notifsAsociadas = listaNotificaciones.filter((n) => {
          if (n['ofertaId'] && (n['ofertaId'] === docSnap.id || n['ofertaId'] === data['ofertaId'])) {
            return true;
          }
          if (n['postulacionId'] && n['postulacionId'] === docSnap.id) {
            return true;
          }
          const notifTituloNorm = this.normalizarTexto(n['tituloOferta'] || '');
          return Boolean(tituloNorm && notifTituloNorm && tituloNorm === notifTituloNorm && !n['cargo'] && !n['cargoId']);
        });

        notifsAsociadas.forEach((n) => notificacionesProcesadas.add(n.idNotif));
        const notifAsociada = notifsAsociadas[0] || null;

        const leidoDoc = data['leido'] !== false;
        const leidoNotifs = notifsAsociadas.every((n) => n['leido'] !== false);
        const estaLeido = leidoDoc && leidoNotifs;

        tempPosts.push({
          ...data,
          id: docSnap.id,
          idNotif: notifAsociada ? notifAsociada.idNotif : null,
          idsNotif: notifsAsociadas.map((n) => n.idNotif),
          coleccionOrigen: 'postulaciones',
          tipo: 'oferta',
          tituloOferta: data['tituloOferta'] || 'Oferta de Empleo',
          nombreEmpresa: (data['nombreEmpresa'] || notifAsociada?.['nombreEmpresa'] || '').trim() || 'Empresa Confidencial',
          estado: notifAsociada?.['estado'] || (notifAsociada?.['tipo'] === 'seleccionado' ? 'Aceptada' : data['estado']) || 'Enviada',
          fechaOrden: this.obtenerTimestamp(notifAsociada?.['fecha'] || data['fecha'] || data['fechaPostulacion']),
          leido: estaLeido,
          mostrarBadgeNueva: !estaLeido
        });
      });

      // Procesar postulaciones de terna
      snapTernas.forEach((docSnap) => {
        const data = docSnap.data();
        const cargoId = data['cargoId'];
        const nombreCargoTernaNorm = this.normalizarTexto(data['nombreCargo'] || data['cargo'] || '');

        // Vinculamos notificaciones tanto por cargoId como por el nombre del cargo ("Profesor de Lenguaje y Comunicación")
        const notifsAsociadas = listaNotificaciones.filter((n) => {
          if (cargoId && n['cargoId'] && n['cargoId'] === cargoId) {
            return true;
          }
          const nombreCargoNotifNorm = this.normalizarTexto(n['cargo'] || n['nombreCargo'] || '');
          return Boolean(nombreCargoTernaNorm && nombreCargoNotifNorm && nombreCargoTernaNorm === nombreCargoNotifNorm);
        });

        notifsAsociadas.forEach((n) => notificacionesProcesadas.add(n.idNotif));
        const datosNotif = notifsAsociadas[0] || null;
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

        const leidoTerna = data['leido'] !== false;
        const leidoNotifs = notifsAsociadas.every((n) => n['leido'] !== false);
        const estaLeido = leidoTerna && leidoNotifs;

        tempPosts.push({
          ...dataCombinada,
          id: docSnap.id,
          idNotif: datosNotif ? datosNotif.idNotif : null,
          idsNotif: notifsAsociadas.map((n) => n.idNotif),
          coleccionOrigen: 'postulaciones-terna',
          tipo: tipoRaw || 'terna',
          esTerna: true,
          tituloOferta: `Terna: ${nombreCargo}`,
          nombreEmpresa: nombreEmpresa,
          estado: estadoFinal,
          mensaje: dataCombinada['mensaje'] || '',
          fechaOrden: this.obtenerTimestamp(datosNotif?.['fecha'] || data['fechaEvaluacion'] || data['fecha']),
          leido: estaLeido,
          mostrarBadgeNueva: !estaLeido
        });
      });

      // Procesar notificaciones directas en 'notificaciones' que no tenían documento previo en 'postulaciones-terna' u 'ofertas'
      listaNotificaciones.forEach((notif) => {
        if (notificacionesProcesadas.has(notif.idNotif)) return;

        const estadoRaw = (notif['estado'] || '').toLowerCase();
        const tipoRaw = (notif['tipo'] || '').toLowerCase();

        if (tipoRaw === 'mensaje' && !estadoRaw) return;

        const esRechazado =
          tipoRaw.includes('rechazad') ||
          tipoRaw.includes('descartad') ||
          estadoRaw.includes('rechazad') ||
          estadoRaw.includes('no seleccionad');

        const estadoFinal = esRechazado ? 'Rechazada' : 'Aceptada';
        const esNotifTerna = Boolean(notif['cargo'] || notif['nombreCargo'] || notif['cargoId']) && !notif['ofertaId'];
        const nombreCargo = notif['nombreCargo'] || notif['cargo'] || notif['tituloOferta'] || 'Cargo de Interés';
        const nombreEmpresa = this.obtenerNombreEmpresa(notif, true);
        const estaLeido = notif['leido'] !== false;

        tempPosts.push({
          ...notif,
          id: notif.idNotif,
          idNotif: notif.idNotif,
          idsNotif: [notif.idNotif],
          coleccionOrigen: 'notificaciones',
          tipo: tipoRaw || (esNotifTerna ? 'terna' : 'oferta'),
          esTerna: esNotifTerna,
          tituloOferta: esNotifTerna ? `Terna: ${nombreCargo}` : nombreCargo,
          nombreEmpresa: nombreEmpresa,
          estado: estadoFinal,
          mensaje: notif['mensaje'] || '',
          fechaOrden: this.obtenerTimestamp(notif['fecha']),
          leido: estaLeido,
          mostrarBadgeNueva: !estaLeido
        });
      });

      this.misPostulaciones = tempPosts;

      // Si al entrar hay una postulación aceptada o rechazada sin leer, abrimos automáticamente esa pestaña
      const tieneNoLeidasEnAceptadas = this.misPostulaciones.some(
        (p) => !p.leido && this.perteneceAFiltro(p, 'aceptadas')
      );
      const tieneNoLeidasEnRechazadas = this.misPostulaciones.some(
        (p) => !p.leido && this.perteneceAFiltro(p, 'rechazadas')
      );

      if (tieneNoLeidasEnAceptadas) {
        this.filtroActual = 'aceptadas';
      } else if (tieneNoLeidasEnRechazadas) {
        this.filtroActual = 'rechazadas';
      }

      this.aplicarFiltro(); 
      
    } catch (error) {
      console.error('Error cargando postulaciones y ternas:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private perteneceAFiltro(p: any, filtro: string): boolean {
    const estado = p.estado ? p.estado.toLowerCase() : 'enviada';
    const tipo = p.tipo ? p.tipo.toLowerCase() : '';

    if (filtro === 'revision') {
      return (estado.includes('enviada') || estado.includes('revisión') || estado.includes('revision') || estado.includes('disponible')) 
        && !estado.includes('aceptad') 
        && !estado.includes('rechazad') 
        && tipo !== 'seleccionado';
    }
    if (filtro === 'aceptadas') {
      return (estado.includes('aceptad') || estado.includes('seleccionad') || tipo === 'seleccionado') 
        && !estado.includes('rechazad'); 
    }
    if (filtro === 'rechazadas') {
      return estado.includes('rechazad') || tipo.includes('rechazad') || tipo.includes('descartad'); 
    }
    return false;
  }

  aplicarFiltro() {
    this.postulacionesFiltradas = this.misPostulaciones
      .filter((p) => this.perteneceAFiltro(p, this.filtroActual))
      .sort((a, b) => {
        // Mostrar primero las no leídas y luego las más recientes
        if (a.leido === false && b.leido !== false) return -1;
        if (a.leido !== false && b.leido === false) return 1;
        return (b.fechaOrden || 0) - (a.fechaOrden || 0);
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

      // Si el documento o sus notificaciones asociadas tienen leido === false, actualizamos a true en Firebase
      if (this.itemActual && this.itemActual.leido === false) {
        this.itemActual.leido = true;

        try {
          const promesasActualizacion: Promise<void>[] = [];
          const nombreColeccion = this.itemActual.coleccionOrigen || (this.itemActual.esTerna ? 'postulaciones-terna' : 'postulaciones');

          // 1. Actualizar documento en su colección de origen
          if (this.itemActual.id) {
            const docRef = doc(this.firestore, nombreColeccion, this.itemActual.id);
            promesasActualizacion.push(updateDoc(docRef, { leido: true }).catch(() => {}));
          }

          // 2. Actualizar todas las notificaciones vinculadas en la colección 'notificaciones'
          const idsNotif: string[] = Array.isArray(this.itemActual.idsNotif) && this.itemActual.idsNotif.length > 0
            ? this.itemActual.idsNotif
            : (this.itemActual.idNotif ? [this.itemActual.idNotif] : []);

          idsNotif.forEach((idNotificacion) => {
            if (nombreColeccion === 'notificaciones' && idNotificacion === this.itemActual.id) {
              return;
            }
            const notifDocRef = doc(this.firestore, 'notificaciones', idNotificacion);
            promesasActualizacion.push(updateDoc(notifDocRef, { leido: true }).catch(() => {}));
          });

          await Promise.all(promesasActualizacion);
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