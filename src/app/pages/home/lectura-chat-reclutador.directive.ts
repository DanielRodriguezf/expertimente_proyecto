import {
  ChangeDetectorRef,
  Directive,
  DoCheck,
  HostListener,
  NgZone,
  OnDestroy,
  inject
} from '@angular/core';

import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';

import {
  PerfilChatReclutadorComponent
} from './perfil-chat-reclutador.component';

import {
  NotificacionesChatReclutadorService
} from './notificaciones-chat-reclutador.service';

@Directive({
  selector:
    'app-perfil-chat-reclutador[appLecturaChatReclutador]',
  standalone: true
})
export class LecturaChatReclututadorDirective
  implements DoCheck, OnDestroy {

  private chat = inject(
    PerfilChatReclutadorComponent,
    { self: true }
  );

  private notificaciones =
    inject(NotificacionesChatReclutadorService);

  private router = inject(Router);
  private documento = inject(DOCUMENT);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private destruida = false;
  private frame: number | null = null;
  private guardando = false;

  private ultimaClaveGuardada = '';
  private claveFallida = '';

  ngDoCheck(): void {
    this.programarLectura();
  }

  @HostListener('window:focus')
  alRecuperarFoco(): void {
    this.claveFallida = '';
    this.programarLectura();
  }

  @HostListener('document:visibilitychange')
  alCambiarVisibilidad(): void {
    if (this.documento.visibilityState === 'visible') {
      this.claveFallida = '';
      this.programarLectura();
    }
  }

  private chatVisible(
    conversacionId: string,
    postulanteId: string
  ): boolean {
    if (
      this.destruida ||
      this.documento.visibilityState !== 'visible' ||
      !this.documento.hasFocus() ||
      !this.chat.pagina ||
      !this.chat.abierto ||
      this.chat.vista !== 'chat' ||
      !this.chat.chatDisponible ||
      this.chat.cargandoMensajes ||
      this.chat.conversacionId !== conversacionId ||
      this.chat.postulanteId !== postulanteId
    ) {
      return false;
    }

    const url = this.router.parseUrl(this.router.url);

    const segmentos =
      url.root.children['primary']?.segments || [];

    return (
      segmentos[0]?.path === 'home' &&
      url.queryParams['postulante'] === postulanteId &&
      url.queryParams['vista'] !== 'perfil'
    );
  }

  private ultimoMensajeRecibido(): string {
    for (let i = this.chat.mensajes.length - 1; i >= 0; i--) {
      const mensaje = this.chat.mensajes[i];

      if (
        mensaje.emisorId === this.chat.postulanteId &&
        !mensaje.pendiente &&
        mensaje.fecha
      ) {
        return mensaje.id;
      }
    }

    return '';
  }

  private programarLectura(): void {
    const ventana = this.documento.defaultView;

    if (
      !ventana ||
      this.destruida ||
      this.guardando ||
      this.frame !== null
    ) {
      return;
    }

    const conversacionId = this.chat.conversacionId;
    const postulanteId = this.chat.postulanteId;

    if (!this.chatVisible(conversacionId, postulanteId)) {
      return;
    }

    const mensajeId = this.ultimoMensajeRecibido();

    if (!mensajeId) {
      return;
    }

    const clave = `${conversacionId}/${mensajeId}`;

    if (
      clave === this.ultimaClaveGuardada ||
      clave === this.claveFallida
    ) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.frame = ventana.requestAnimationFrame(() => {
        this.frame = null;

        void this.guardarLectura(
          conversacionId,
          postulanteId,
          mensajeId,
          clave
        );
      });
    });
  }

  private async guardarLectura(
    conversacionId: string,
    postulanteId: string,
    mensajeId: string,
    clave: string
  ): Promise<void> {
    if (!this.chatVisible(conversacionId, postulanteId)) {
      return;
    }

    this.guardando = true;

    try {
      const guardada =
        await this.notificaciones.marcarLeidoHasta(
          conversacionId,
          mensajeId,
          () => this.chatVisible(
            conversacionId,
            postulanteId
          )
        );

      if (guardada && !this.destruida) {
        this.ultimaClaveGuardada = clave;
        this.claveFallida = '';
      }
    } catch (error) {
      console.error(
        'No se pudo registrar la lectura del chat:',
        error
      );

      if (!this.destruida) {
        this.claveFallida = clave;

        if (
          this.chat.conversacionId === conversacionId &&
          this.chat.postulanteId === postulanteId
        ) {
          this.zone.run(() => {
            this.chat.error =
              'No se pudo registrar la lectura. ' +
              'Revisa la conexión y los permisos de Firestore. ' +
              'Al volver a esta pestaña se intentará nuevamente.';

            this.cdr.markForCheck();
          });
        }
      }
    } finally {
      this.guardando = false;

      if (!this.destruida) {
        this.programarLectura();
      }
    }
  }

  ngOnDestroy(): void {
    this.destruida = true;

    if (this.frame !== null) {
      this.documento.defaultView?.cancelAnimationFrame(
        this.frame
      );

      this.frame = null;
    }
  }
}