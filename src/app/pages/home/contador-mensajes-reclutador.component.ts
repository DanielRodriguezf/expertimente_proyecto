import {
  Component,
  Input,
  OnChanges,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  NotificacionesChatReclutadorService
} from './notificaciones-chat-reclutador.service';

@Component({
  selector: 'app-contador-mensajes-reclutador',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="estado$ | async as estado">
      <span
        *ngIf="estado.total !== null && estado.total > 0"
        class="contador"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        [attr.aria-label]="
          estado.total + ' mensajes sin leer'
        "
        [attr.title]="
          estado.total + ' mensajes sin leer'
        ">
        {{ estado.total }}
      </span>

      <span
        *ngIf="estado.cargando"
        class="contador sincronizando"
        role="status"
        aria-label="Sincronizando mensajes"
        title="Sincronizando mensajes">
        …
      </span>

      <span
        *ngIf="estado.error"
        class="contador"
        role="status"
        [attr.aria-label]="estado.error"
        [attr.title]="estado.error">
        !
      </span>
    </ng-container>
  `,
  styles: [`
    :host {
      position: absolute;
      top: -7px;
      right: -7px;
      z-index: 2;
      pointer-events: none;
    }

    .contador {
      display: flex;
      align-items: center;
      justify-content: center;

      min-width: 23px;
      height: 23px;
      padding: 0 6px;
      box-sizing: border-box;

      border: 2px solid #ffffff;
      border-radius: 999px;

      background: #dc2626;
      color: #ffffff;

      font-size: 12px;
      font-weight: 800;
      line-height: 1;

      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);
      pointer-events: auto;
    }

    .sincronizando {
      background: #64748b;
    }
  `]
})
export class ContadorMensajesReclutadorComponent
  implements OnChanges {

  @Input() reclutadorId = '';

  private notificaciones =
    inject(NotificacionesChatReclutadorService);

  readonly estado$ = this.notificaciones.estado$;

  ngOnChanges(): void {
    this.notificaciones.iniciar(this.reclutadorId);
  }
}