import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Auth } from '@angular/fire/auth';

import {
  Firestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp
} from '@angular/fire/firestore';

import { Router } from '@angular/router';

import {
  PerfilChatReclutadorComponent
} from './perfil-chat-reclutador.component';

@Component({
  selector: 'app-reclutador-herramientas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PerfilChatReclutadorComponent
  ],
  template: `
    <section class="pagina">
      <h1>
        {{ titulos[vista] || 'Reclutador' }}
      </h1>

      <p role="alert" *ngIf="error">
        {{ error }}
      </p>

      <p role="status" *ngIf="aviso">
        {{ aviso }}
      </p>

      <ng-container *ngIf="aprobado; else pendiente">
        <!-- SOLICITUDES DE CARGOS -->

        <ng-container *ngIf="vista === 'solicitudes'">
          <aside
            *ngFor="let n of notificaciones"
            class="aviso">

            <strong>
              {{ n['mensaje'] }}
            </strong>

            <small>
              {{ fecha(n['fecha']) }}
            </small>

            <button
              type="button"
              (click)="leer(n)">
              Marcar como leído
            </button>
          </aside>

          <form (ngSubmit)="enviar('cargos')">
            <label>
              Nombre del cargo

              <input
                name="nombre"
                [(ngModel)]="asunto"
                required
                maxlength="150">
            </label>

            <label>
              Área laboral

              <input
                name="area"
                [(ngModel)]="area"
                required
                maxlength="150"
                placeholder="Ejemplo: Tecnología">
            </label>

            <label>
              Descripción

              <textarea
                name="descripcion"
                [(ngModel)]="mensaje"
                required
                maxlength="3000">
              </textarea>
            </label>

            <button
              type="submit"
              [disabled]="
                enviando ||
                !asunto.trim() ||
                !area.trim() ||
                !mensaje.trim()
              ">
              Enviar solicitud
            </button>
          </form>
        </ng-container>

        <!-- COMENTARIOS A ADMINISTRACIÓN -->

        <form
          *ngIf="vista === 'comentarios'"
          (ngSubmit)="enviar('comentarios-administracion')">

          <label>
            Asunto

            <input
              name="asunto"
              [(ngModel)]="asunto"
              required
              maxlength="150">
          </label>

          <label>
            Comentario

            <textarea
              name="mensaje"
              [(ngModel)]="mensaje"
              required
              maxlength="3000">
            </textarea>
          </label>

          <button
            type="submit"
            [disabled]="
              enviando ||
              !asunto.trim() ||
              !mensaje.trim()
            ">
            Enviar a administración
          </button>
        </form>

        <!-- ESTADOS GENERALES -->

        <p *ngIf="cargando">
          Cargando información…
        </p>

        <p *ngIf="!cargando && !filas.length">
          Todavía no hay registros en esta sección.
        </p>

        <!-- REGISTROS -->

        <article *ngFor="let f of filas">
          <!-- POSTULANTES ACEPTADOS -->

          <ng-container *ngIf="vista === 'aceptados'">
            <img
              *ngIf="f['perfil']?.fotoPerfil"
              [src]="f['perfil'].fotoPerfil"
              alt="Foto del postulante">

            <h2>
              {{ nombre(f['perfil']) }}
            </h2>

            <p>
              {{
                f['nombreCargo'] ||
                f['cargoNombre'] ||
                f['ofertaTitulo']
              }}
              · Aceptado
            </p>

            <p>
              {{ f['perfil']?.correo }}
              ·
              {{ f['perfil']?.telefono }}
            </p>

            <app-perfil-chat-reclutador
              [postulanteId]="f['postulanteId']"
              [nombrePostulante]="nombre(f['perfil'])"
              [nombreReclutador]="nombreReclutador"
              [nombreEmpresa]="nombreEmpresa">
            </app-perfil-chat-reclutador>
          </ng-container>

          <!-- CONVERSACIONES -->

          <ng-container *ngIf="vista === 'mensajes'">
            <h2>
              {{ f['nombrePostulante'] || 'Postulante' }}
            </h2>

            <p>
              {{ f['ultimoMensaje'] || 'Sin mensajes todavía' }}
            </p>

            <button
              type="button"
              (click)="chat(f['postulanteId'])">
              Abrir conversación
            </button>
          </ng-container>

          <!-- HISTORIAL DE SOLICITUDES -->

          <ng-container *ngIf="vista === 'solicitudes'">
            <h2>
              {{ f['nombre'] }}
            </h2>

            <p>
              {{ f['descripcion'] }}
            </p>

            <strong>
              Estado: {{ f['estado'] }}
            </strong>

            <small>
              {{ f['numeroSolicitud'] }}
            </small>
          </ng-container>

          <!-- HISTORIAL DE COMENTARIOS -->

          <ng-container *ngIf="vista === 'comentarios'">
            <h2>
              {{ f['asunto'] }}
            </h2>

            <p>
              {{ f['mensaje'] }}
            </p>

            <small>
              {{
                f['leidoAdministracion']
                  ? 'Leído por administración'
                  : 'Enviado a administración'
              }}
            </small>
          </ng-container>
        </article>
      </ng-container>

      <ng-template #pendiente>
        <p>
          Tu perfil debe estar aprobado para acceder
          a esta sección.
        </p>
      </ng-template>
    </section>
  `,
  styles: [`
    .pagina {
      max-width: 1050px;
      margin: 24px auto;
      padding: 24px;
      color: #1f2d18;
    }

    h1 {
      font-weight: 800;
    }

    form,
    article,
    .aviso {
      background: white;
      border: 1px solid #dce2d2;
      padding: 24px;
      border-radius: 16px;
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-weight: 700;
      margin-bottom: 16px;
    }

    input,
    textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid #b9c5ae;
      border-radius: 8px;
      background: #fafbf6;
      color: #1f2d18;
      font: inherit;
    }

    textarea {
      min-height: 120px;
    }

    button {
      background: #4e8b47;
      color: white;
      border: 0;
      border-radius: 8px;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.5;
    }

    img {
      width: 70px;
      height: 70px;
      object-fit: cover;
      border-radius: 50%;
    }

    small {
      display: block;
      margin: 8px 0;
    }

    article p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `]
})
export class ReclutadorHerramientasComponent
  implements OnChanges, OnDestroy {

  @Input() vista = '';
  @Input() reclutadorId = '';
  @Input() nombreReclutador = '';
  @Input() nombreEmpresa = '';
  @Input() aprobado = false;

  private db = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  titulos: Record<string, string> = {
    aceptados: 'Postulantes aceptados',
    mensajes: 'Conversaciones',
    solicitudes: 'Solicitar cargos',
    comentarios: 'Comentarios a administración'
  };

  filas: any[] = [];
  notificaciones: any[] = [];

  asunto = '';
  mensaje = '';
  area = '';

  error = '';
  aviso = '';

  enviando = false;
  cargando = false;

  private cancelaciones: (() => void)[] = [];
  private version = 0;

  ngOnChanges() {
    this.limpiar();

    this.filas = [];
    this.notificaciones = [];
    this.error = '';

    if (!this.aprobado || !this.reclutadorId) {
      return;
    }

    this.cargando = true;

    const v = this.version;

    const fuente =
      this.vista === 'aceptados'
        ? 'selecciones-cargo'
        : this.vista === 'mensajes'
          ? 'conversaciones'
          : this.vista === 'solicitudes'
            ? 'cargos'
            : 'comentarios-administracion';

    const filtro =
      this.vista === 'mensajes'
        ? where(
            'participantes',
            'array-contains',
            this.reclutadorId
          )
        : where(
            'reclutadorId',
            '==',
            this.reclutadorId
          );

    const cancelar = onSnapshot(
      query(
        collection(this.db, fuente),
        filtro
      ),
      async snap => {
        try {
          let filas = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          })) as any[];

          if (this.vista === 'aceptados') {
            const ofertas = await getDocs(
              query(
                collection(this.db, 'ofertas'),
                where(
                  'reclutadorId',
                  '==',
                  this.reclutadorId
                )
              )
            );

            const resultados = await Promise.all(
              ofertas.docs.map(async oferta => {
                const postulaciones = await getDocs(
                  query(
                    collection(this.db, 'postulaciones'),
                    where(
                      'ofertaId',
                      '==',
                      oferta.id
                    )
                  )
                );

                return postulaciones.docs
                  .filter(documento =>
                    String(
                      documento.data()['estado']
                    ).toLowerCase() === 'aceptado'
                  )
                  .map(documento => ({
                    id: documento.id,
                    ...documento.data(),
                    ofertaTitulo: oferta.data()['titulo']
                  }));
              })
            );

            filas = [
              ...filas,
              ...resultados.flat()
            ];

            filas = await Promise.all(
              filas.map(async fila => {
                const id = fila['postulanteId'];

                if (!id) {
                  return fila;
                }

                const perfil = await getDoc(
                  doc(this.db, 'postulantes', id)
                );

                return {
                  ...fila,
                  perfil: perfil.exists()
                    ? perfil.data()
                    : fila['postulanteSnapshot']
                };
              })
            );
          }

          if (v !== this.version) {
            return;
          }

          this.zone.run(() => {
            this.filas = filas.sort((a, b) => {
              const fechaB =
                b['actualizadoEn'] ||
                b['fechaSolicitud'] ||
                b['fecha'] ||
                b['fechaAceptacion'];

              const fechaA =
                a['actualizadoEn'] ||
                a['fechaSolicitud'] ||
                a['fecha'] ||
                a['fechaAceptacion'];

              return (
                fechaB?.toMillis?.() -
                fechaA?.toMillis?.()
              );
            });

            this.cargando = false;
            this.cdr.markForCheck();
          });
        } catch {
          this.fallar(
            'No se pudieron cargar todos los datos.',
            v
          );
        }
      },
      () => this.fallar(
        'No se pudo cargar esta sección. ' +
        'Revisa los permisos y la conexión.',
        v
      )
    );

    this.cancelaciones.push(cancelar);

    if (this.vista === 'solicitudes') {
      const cancelarNotificaciones = onSnapshot(
        query(
          collection(
            this.db,
            'notificaciones-reclutador'
          ),
          where(
            'reclutadorId',
            '==',
            this.reclutadorId
          )
        ),
        snapshot => {
          this.zone.run(() => {
            this.notificaciones = snapshot.docs
              .map(documento => ({
                id: documento.id,
                ...documento.data()
              }))
              .filter((n: any) => !n.leido);

            this.cdr.markForCheck();
          });
        },
        () => this.fallar(
          'No se pudieron consultar las notificaciones.',
          v
        )
      );

      this.cancelaciones.push(
        cancelarNotificaciones
      );
    }
  }

  private fallar(
    mensaje: string,
    version: number
  ) {
    if (version !== this.version) {
      return;
    }

    this.zone.run(() => {
      this.error = mensaje;
      this.cargando = false;
      this.cdr.markForCheck();
    });
  }

  private limpiar() {
    this.version++;

    this.cancelaciones.forEach(
      cancelar => cancelar()
    );

    this.cancelaciones = [];
  }

  ngOnDestroy() {
    this.limpiar();
  }

  nombre(perfil: any): string {
    if (!perfil) {
      return 'Perfil no disponible';
    }

    const apellidos =
      perfil.apellidos ||
      [
        perfil.apellidoPaterno,
        perfil.apellidoMaterno
      ]
        .filter(Boolean)
        .join(' ');

    return [
      perfil.nombre || perfil.nombres,
      apellidos
    ]
      .filter(Boolean)
      .join(' ');
  }

  fecha(valor: any): string {
    return valor
      ?.toDate?.()
      .toLocaleString('es-CL') || '';
  }

  chat(postulanteId: string) {
    this.router.navigate(
      ['/home'],
      {
        queryParams: {
          vista: 'chat',
          postulante: postulanteId,
          volver: 'mensajes'
        }
      }
    );
  }

  async leer(notificacion: any) {
    try {
      await updateDoc(
        doc(
          this.db,
          'notificaciones-reclutador',
          notificacion.id
        ),
        {
          leido: true
        }
      );
    } catch {
      this.error =
        'No se pudo marcar el aviso como leído.';
    }
  }

  async enviar(destino: string) {
    if (
      this.enviando ||
      !this.asunto.trim() ||
      !this.mensaje.trim() ||
      !this.aprobado
    ) {
      return;
    }

    this.enviando = true;
    this.error = '';
    this.aviso = '';

    try {
      const uid = this.auth.currentUser?.uid;

      if (uid !== this.reclutadorId) {
        throw Error('Sesión no válida');
      }

      const perfil = await getDoc(
        doc(this.db, 'reclutadores', uid)
      );

      const datos = perfil.data();

      if (datos?.['estado'] !== 'aprobado') {
        throw Error('Perfil no aprobado');
      }

      const comun = {
        reclutadorId: uid,
        empresaId: datos['empresaId'] || '',
        nombreEmpresa: this.nombreEmpresa,
        nombreReclutador: this.nombreReclutador
      };

      if (destino === 'cargos') {
        await addDoc(
          collection(this.db, destino),
          {
            ...comun,
            nombre: this.asunto.trim(),
            descripcion: this.mensaje.trim(),
            areaLaboral: this.area.trim(),
            estado: 'pendiente',
            fechaSolicitud: serverTimestamp(),
            numeroSolicitud:
              'SOL-' + crypto.randomUUID()
          }
        );
      } else {
        await addDoc(
          collection(this.db, destino),
          {
            ...comun,
            asunto: this.asunto.trim(),
            mensaje: this.mensaje.trim(),
            fecha: serverTimestamp(),
            leidoAdministracion: false
          }
        );
      }

      this.asunto = '';
      this.mensaje = '';
      this.area = '';
      this.aviso = 'Enviado correctamente.';
    } catch {
      this.error =
        'No fue posible enviar. ' +
        'Revisa tu sesión y los permisos.';
    } finally {
      this.enviando = false;
      this.cdr.markForCheck();
    }
  }
}