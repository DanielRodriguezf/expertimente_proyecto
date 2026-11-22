import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import {
  Auth,
  onAuthStateChanged
} from '@angular/fire/auth';

import {
  Firestore,
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction
} from '@angular/fire/firestore';

export interface EstadoMensajesReclutador {
  total: number | null;
  cargando: boolean;
  error: string;
}

interface ConversacionObservada {
  postulanteId: string;
  lectura: Timestamp | null;
  pendientes: number;
  lista: boolean;
  error: string;
  cancelar: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionesChatReclutadorService
  implements OnDestroy {

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private zone = inject(NgZone);

  private estadoSubject =
    new BehaviorSubject<EstadoMensajesReclutador>({
      total: null,
      cargando: false,
      error: ''
    });

  readonly estado$ = this.estadoSubject.asObservable();

  private usuarioId = '';
  private version = 0;
  private conversacionesListas = false;
  private errorPrincipal = '';

  private conversaciones =
    new Map<string, ConversacionObservada>();

  private cancelarConversaciones?: () => void;
  private cancelarAuth: () => void;

  constructor() {
    this.cancelarAuth = onAuthStateChanged(
      this.auth,
      usuario => {
        if (
          this.usuarioId &&
          usuario?.uid !== this.usuarioId
        ) {
          this.detener();
        }
      }
    );
  }

  iniciar(usuarioId: string): void {
    if (
      !usuarioId ||
      this.auth.currentUser?.uid !== usuarioId
    ) {
      this.detener();
      return;
    }

    if (this.usuarioId === usuarioId) {
      return;
    }

    this.detener();
    this.usuarioId = usuarioId;

    const version = this.version;

    this.emitir({
      total: null,
      cargando: true,
      error: ''
    });

    const consulta = query(
      collection(this.firestore, 'conversaciones'),
      where('participantes', 'array-contains', usuarioId)
    );

    this.cancelarConversaciones = onSnapshot(
      consulta,
      { includeMetadataChanges: true },
      snapshot => {
        if (version !== this.version) {
          return;
        }

        this.conversacionesListas =
          !snapshot.metadata.fromCache;

        this.errorPrincipal = '';

        const idsVigentes = new Set<string>();

        for (const documento of snapshot.docs) {
          const datos = documento.data();

          if (datos['reclutadorId'] !== usuarioId) {
            continue;
          }

          const postulanteId = datos['postulanteId'];

          if (
            typeof postulanteId !== 'string' ||
            !postulanteId
          ) {
            this.errorPrincipal =
              'Una conversación no tiene un postulante válido.';
            continue;
          }

          idsVigentes.add(documento.id);

          const valorLectura =
            datos['ultimaLecturaReclutador'];

          const lectura =
            valorLectura instanceof Timestamp
              ? valorLectura
              : null;

          let entrada =
            this.conversaciones.get(documento.id);

          if (
            entrada &&
            entrada.postulanteId !== postulanteId
          ) {
            entrada.cancelar();
            this.conversaciones.delete(documento.id);
            entrada = undefined;
          }

          if (entrada) {
            entrada.lectura = lectura;
            continue;
          }

          this.observarMensajes(
            documento.id,
            postulanteId,
            lectura,
            version
          );
        }

        for (const [id, entrada] of this.conversaciones) {
          if (!idsVigentes.has(id)) {
            entrada.cancelar();
            this.conversaciones.delete(id);
          }
        }

        this.publicarTotal();
      },
      error => {
        if (version !== this.version) {
          return;
        }

        console.error(
          'No se pudieron escuchar las conversaciones:',
          error
        );

        this.errorPrincipal =
          'No se pudo consultar el contador de mensajes.';

        this.publicarTotal();
      }
    );
  }

  private observarMensajes(
    conversacionId: string,
    postulanteId: string,
    lectura: Timestamp | null,
    version: number
  ): void {
    const entrada: ConversacionObservada = {
      postulanteId,
      lectura,
      pendientes: 0,
      lista: false,
      error: '',
      cancelar: () => {}
    };

    this.conversaciones.set(conversacionId, entrada);

    const consulta = query(
      collection(
        this.firestore,
        'conversaciones',
        conversacionId,
        'mensajes'
      ),
      where('emisorId', '==', postulanteId)
    );

    entrada.cancelar = onSnapshot(
      consulta,
      { includeMetadataChanges: true },
      snapshot => {
        if (
          version !== this.version ||
          this.conversaciones.get(conversacionId) !== entrada
        ) {
          return;
        }

        let pendientes = 0;

        for (const documento of snapshot.docs) {
          if (documento.metadata.hasPendingWrites) {
            continue;
          }

          const data = documento.data();
          const estado = String(data['estado'] || '').toLowerCase();

          // Si el documento ya tiene estado explícito ('visto' / 'pendiente')
          if (estado === 'visto') {
            continue;
          }
          if (estado === 'pendiente') {
            pendientes++;
            continue;
          }

          // Compatibilidad con mensajes antiguos sin campo 'estado'
          const fecha = data['creadoEn'];
          if (
            fecha instanceof Timestamp &&
            (!entrada.lectura || this.esPosterior(fecha, entrada.lectura))
          ) {
            pendientes++;
          }
        }

        entrada.pendientes = pendientes;
        entrada.lista = !snapshot.metadata.fromCache;
        entrada.error = '';

        this.publicarTotal();
      },
      error => {
        if (
          version !== this.version ||
          this.conversaciones.get(conversacionId) !== entrada
        ) {
          return;
        }

        console.error(
          'No se pudieron contar los mensajes:',
          error
        );

        entrada.error =
          'No se pudieron consultar los mensajes de una conversación.';

        this.publicarTotal();
      }
    );
  }

  private publicarTotal(): void {
    const entradas = [...this.conversaciones.values()];

    const error =
      this.errorPrincipal ||
      entradas.find(entrada => entrada.error)?.error ||
      '';

    if (error) {
      this.emitir({
        total: null,
        cargando: false,
        error
      });
      return;
    }

    if (
      !this.conversacionesListas ||
      entradas.some(entrada => !entrada.lista)
    ) {
      this.emitir({
        total: null,
        cargando: true,
        error: ''
      });
      return;
    }

    const total = entradas.reduce(
      (acumulado, entrada) => acumulado + entrada.pendientes,
      0
    );

    this.emitir({
      total,
      cargando: false,
      error: ''
    });
  }

  async marcarLeidoHasta(
    conversacionId: string,
    mensajeId: string,
    sigueVisible: () => boolean
  ): Promise<boolean> {
    const usuarioId = this.auth.currentUser?.uid;

    if (!usuarioId || !sigueVisible()) {
      return false;
    }

    const conversacionRef = doc(
      this.firestore,
      'conversaciones',
      conversacionId
    );

    const mensajeRef = doc(
      conversacionRef,
      'mensajes',
      mensajeId
    );

    return runTransaction(
      this.firestore,
      async transaccion => {
        const conversacion =
          await transaccion.get(conversacionRef);

        const mensaje =
          await transaccion.get(mensajeRef);

        if (
          this.auth.currentUser?.uid !== usuarioId ||
          !sigueVisible()
        ) {
          return false;
        }

        if (!conversacion.exists() || !mensaje.exists()) {
          throw new Error('La conversación o el mensaje no existe.');
        }

        const datosConversacion = conversacion.data();
        const datosMensaje = mensaje.data();

        if (
          datosConversacion['reclutadorId'] !== usuarioId ||
          datosMensaje['emisorId'] !==
            datosConversacion['postulanteId']
        ) {
          throw new Error('No se pudo verificar la lectura.');
        }

        const fechaMensaje = datosMensaje['creadoEn'];
        const ultimaLectura =
          datosConversacion['ultimaLecturaReclutador'];

        if (!(fechaMensaje instanceof Timestamp)) {
          throw new Error('El mensaje todavía no tiene fecha válida.');
        }

        if (datosMensaje['estado'] !== 'visto') {
          transaccion.update(mensajeRef, {
            estado: 'visto',
            vistoEn: serverTimestamp()
          });
        }

        if (
          !(ultimaLectura instanceof Timestamp) ||
          this.esPosterior(fechaMensaje, ultimaLectura)
        ) {
          transaccion.update(conversacionRef, {
            ultimaLecturaReclutador: fechaMensaje
          });
        }

        return true;
      }
    );
  }

  private esPosterior(
    fecha: Timestamp,
    referencia: Timestamp
  ): boolean {
    return (
      fecha.seconds > referencia.seconds ||
      (
        fecha.seconds === referencia.seconds &&
        fecha.nanoseconds > referencia.nanoseconds
      )
    );
  }

  private emitir(estado: EstadoMensajesReclutador): void {
    this.zone.run(() => {
      this.estadoSubject.next(estado);
    });
  }

  detener(): void {
    this.version++;

    this.cancelarConversaciones?.();
    this.cancelarConversaciones = undefined;

    for (const entrada of this.conversaciones.values()) {
      entrada.cancelar();
    }

    this.conversaciones.clear();
    this.usuarioId = '';
    this.conversacionesListas = false;
    this.errorPrincipal = '';

    this.emitir({
      total: null,
      cargando: false,
      error: ''
    });
  }

  ngOnDestroy(): void {
    this.cancelarAuth();
    this.detener();
  }
}