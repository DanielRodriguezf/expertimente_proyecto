import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  NgZone,
  CUSTOM_ELEMENTS_SCHEMA
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
  deleteDoc,
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA], 
  template: `
    <section class="pagina">
      <h1 *ngIf="vista !== 'mensajes'">
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

          <form (ngSubmit)="enviarSolicitud()">
            <label>
              Nombre del cargo

              <input
                name="nombre"
                [value]="asunto"
                (input)="actualizarNombre($event, 'asunto')"
                required
                maxlength="150">
            </label>

            <label>
              Área laboral

              <input
                name="area"
                [value]="area"
                (input)="actualizarNombre($event, 'area')"
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

        <!-- ESTADOS GENERALES -->

        <p *ngIf="cargando">
          Cargando información…
        </p>

        <p *ngIf="!cargando && !filas.length">
          Todavía no hay registros en esta sección.
        </p>

        <!-- LISTADO DE MENSAJES ESTILO WHATSAPP/INSTAGRAM -->
        <ng-container *ngIf="vista === 'mensajes'; else vistaNormal">
          <div class="lista-chats" *ngIf="filas.length > 0">
            <div class="chat-item" *ngFor="let f of filas" (click)="chat(f['postulanteId'])">
              
              <!-- Avatar -->
              <div class="chat-avatar">
                <img *ngIf="f['perfil']?.fotoPerfil || f['fotoPostulante']" 
                     [src]="f['perfil']?.fotoPerfil || f['fotoPostulante']" 
                     alt="Foto">
                <div class="avatar-placeholder" *ngIf="!f['perfil']?.fotoPerfil && !f['fotoPostulante']">
                  {{ (nombre(f['perfil']) || f['nombrePostulante'] || 'P').charAt(0) | uppercase }}
                </div>
              </div>

              <!-- Información -->
              <div class="chat-info">
                <h3>{{ nombre(f['perfil']) || f['nombrePostulante'] || 'Postulante' }}</h3>
                <p>{{ f['ultimoMensaje'] || 'Sin mensajes todavía' }}</p>
              </div>

              <!-- Íconos de acción -->
              <div class="chat-actions-container">
                <div class="chat-action" title="Abrir chat">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                
                <!-- Botón de Eliminar Chat -->
                <button 
                  type="button" 
                  class="btn-eliminar-chat" 
                  (click)="confirmarEliminarChat(f, $event)" 
                  title="Eliminar chat">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>

            </div>
          </div>
        </ng-container>

        <!-- REGISTROS NORMALES (TARJETAS GRANDES) -->
        <ng-template #vistaNormal>
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

          </article>
        </ng-template>

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
    :host { display: block; }

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

    /* ESTILOS PARA LISTA DE CHATS COMPACTA */
    .lista-chats {
      display: flex;
      flex-direction: column;
      background: white;
      border: 1px solid #dce2d2;
      border-radius: 12px;
      overflow: hidden;
    }

    .chat-item {
      display: flex;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #f0f3eb;
      cursor: pointer;
      transition: background 0.2s;
    }

    .chat-item:last-child {
      border-bottom: none;
    }

    .chat-item:hover {
      background: #f9fbf7;
    }

    .chat-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      margin-right: 16px;
      flex-shrink: 0;
      background: #e2e8db;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #4e8b47;
      font-size: 20px;
    }

    .chat-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chat-info {
      flex: 1;
      min-width: 0;
    }

    .chat-info h3 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 600;
      color: #1f2d18;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chat-info p {
      margin: 0;
      font-size: 14px;
      color: #66755d;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* CONTENEDOR DE ACCIONES */
    .chat-actions-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 12px;
    }

    .chat-action {
      color: #4e8b47;
      display: flex;
      align-items: center;
    }

    /* ESTILOS DEL BOTÓN ELIMINAR */
    .btn-eliminar-chat {
      background: #fbecec;
      color: #dc3545;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      padding: 0;
    }

    .btn-eliminar-chat:hover {
      background: #dc3545;
      color: white;
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

    article img {
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
    solicitudes: 'Solicitar cargos'
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
          : 'cargos';

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
          }

          // Cargar los perfiles tanto para la vista de "aceptados" como para la de "mensajes"
          if (this.vista === 'aceptados' || this.vista === 'mensajes') {
            const filasCargadas = await Promise.all(
              filas.map(async fila => {
                const id = fila['postulanteId'];

                if (!id) {
                  return fila;
                }

                const perfil = await getDoc(
                  doc(this.db, 'postulantes', id)
                );

                // FILTRO: Si estamos en aceptados y el perfil del postulante ya no existe, devolvemos null
                if (this.vista === 'aceptados' && !perfil.exists()) {
                  return null;
                }

                return {
                  ...fila,
                  perfil: perfil.exists()
                    ? perfil.data()
                    : fila['postulanteSnapshot']
                };
              })
            );

            // FILTRO: Removemos todos los elementos nulos (postulantes eliminados de la BD)
            filas = filasCargadas.filter(fila => fila !== null);
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
      return '';
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

  // ==========================================
  // LÓGICA: ELIMINAR CHAT
  // ==========================================
  async confirmarEliminarChat(chatObj: any, event: Event) {
    // Evitamos que al hacer clic en el botón se abra el chat accidentalmente
    event.stopPropagation();

    const nombrePersona = this.nombre(chatObj['perfil']) || chatObj['nombrePostulante'] || 'este postulante';
    
    // Utilizamos un confirm nativo para no inyectar módulos externos
    const confirmacion = window.confirm(`¿Estás seguro de que deseas eliminar el chat con ${nombrePersona}? Esta acción no se puede deshacer.`);
    
    if (confirmacion) {
      this.ejecutarEliminacion(chatObj.id);
    }
  }

  async ejecutarEliminacion(chatId: string) {
    if (!chatId) return;

    try {
      // Elimina el documento de la colección 'conversaciones' en Firestore
      await deleteDoc(doc(this.db, 'conversaciones', chatId));
      
      // Lo remueve visualmente al instante del arreglo 'filas'
      this.zone.run(() => {
        this.filas = this.filas.filter(f => f.id !== chatId);
        this.cdr.markForCheck();
      });
    } catch (err) {
      console.error('Error eliminando el chat:', err);
      this.error = 'Ocurrió un error al intentar eliminar el chat.';
      this.cdr.markForCheck();
    }
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

  actualizarNombre(event: Event, campo: 'asunto' | 'area') {
    const input = event.target as HTMLInputElement;
    const limpio = input.value.normalize('NFC').replace(/[^\p{L} ]/gu, '');
    input.value = limpio;
    this[campo] = limpio;
  }

  async enviarSolicitud() {
    if (
      this.enviando ||
      !/^[\p{L} ]+$/u.test(this.asunto.trim()) ||
      !/^[\p{L} ]+$/u.test(this.area.trim()) ||
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

        await addDoc(
          collection(this.db, 'cargos'),
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