import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import { Auth } from '@angular/fire/auth';

import {
  Firestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc
} from '@angular/fire/firestore';

@Component({
  selector: 'app-comentarios-administracion',
  standalone: true,
  imports: [
    CommonModule
  ],
  template: `
    <section>
      <h2>
        Comentarios de reclutadores
      </h2>

      <p role="alert">
        {{ error }}
      </p>

      <p *ngIf="!filas.length">
        No hay comentarios para mostrar.
      </p>

      <article *ngFor="let fila of filas">
        <h3>
          {{ fila['asunto'] }}
        </h3>

        <p>
          {{ fila['nombreReclutador'] }}
          ·
          {{ fila['nombreEmpresa'] }}
        </p>

        <p class="texto">
          {{ fila['mensaje'] }}
        </p>

        <button
          type="button"
          *ngIf="!fila['leidoAdministracion']"
          (click)="leer(fila['id'])">
          Marcar como leído
        </button>

        <small *ngIf="fila['leidoAdministracion']">
          Leído
        </small>
      </article>
    </section>
  `,
  styles: [`
    article {
      background: white;
      border: 1px solid #d5dfce;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .texto {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    button {
      background: #4e8b47;
      color: white;
      border: 0;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
    }
  `]
})
export class ComentariosAdministracionComponent
  implements OnInit, OnDestroy {

  private db = inject(Firestore);
  private auth = inject(Auth);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private cancelar?: () => void;
  private destruido = false;

  filas: any[] = [];
  error = '';

  async ngOnInit() {
    try {
      const uid = this.auth.currentUser?.uid;

      if (!uid) {
        throw Error();
      }

      const usuario = await getDoc(
        doc(this.db, 'usuarios', uid)
      );

      if (usuario.data()?.['rol'] !== 'admin') {
        throw Error();
      }

      if (this.destruido) {
        return;
      }

      this.cancelar = onSnapshot(
        collection(
          this.db,
          'comentarios-administracion'
        ),
        snapshot => {
          this.zone.run(() => {
            this.filas = snapshot.docs.map(
              documento => ({
                id: documento.id,
                ...documento.data()
              })
            );

            this.cdr.markForCheck();
          });
        },
        () => {
          this.error =
            'No se pudieron consultar los comentarios.';

          this.cdr.markForCheck();
        }
      );
    } catch {
      this.error =
        'No se pudo verificar el acceso ' +
        'de administración.';

      this.cdr.markForCheck();
    }
  }

  async leer(id: string) {
    try {
      await updateDoc(
        doc(
          this.db,
          'comentarios-administracion',
          id
        ),
        {
          leidoAdministracion: true
        }
      );
    } catch {
      this.error =
        'No se pudo actualizar el comentario.';
    }
  }

  ngOnDestroy() {
    this.destruido = true;
    this.cancelar?.();
  }
}