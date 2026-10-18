import {
  Component,
  Input,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSpinner
} from '@ionic/angular';

import { Auth } from '@angular/fire/auth';

import {
  Firestore,
  collection,
  doc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp
} from '@angular/fire/firestore';

interface MensajeChat {
  id: string;
  emisorId: string;
  texto: string;
  fecha: Date | null;
  pendiente: boolean;
}

interface CampoPerfil {
  etiqueta: string;
  valor: string;
}

@Component({
  selector: 'app-perfil-chat-reclutador',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSpinner
  ],
  template: `
    <div class="acciones">
      <ion-button
        type="button"
        fill="outline"
        (click)="abrirPerfil()">
        Ver perfil completo
      </ion-button>

      <ion-button
        type="button"
        (click)="abrirChat()">
        Enviar mensaje
      </ion-button>
    </div>

    <ion-modal
      [isOpen]="abierto"
      (didDismiss)="cerrar()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>
              {{ vista === 'perfil' ? 'Perfil del postulante' : nombrePostulante }}
            </ion-title>

            <ion-buttons slot="end">
              <ion-button
                type="button"
                (click)="cerrar()">
                Cerrar
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <main class="contenido">
            <div
              class="estado"
              *ngIf="cargando">
              <ion-spinner name="crescent"></ion-spinner>
              <p>{{ vista === 'perfil' ? 'Cargando perfil...' : 'Abriendo conversación...' }}</p>
            </div>

            <p
              class="error"
              role="alert"
              *ngIf="error">
              {{ error }}
            </p>

            <ng-container *ngIf="vista === 'perfil' && !cargando">
              <section
                class="perfil"
                *ngIf="perfilDisponible">
                <header class="persona">
                  <img
                    *ngIf="foto"
                    [src]="foto"
                    [alt]="'Foto de ' + nombrePerfil">

                  <div>
                    <span class="etiqueta">POSTULANTE</span>
                    <h2>{{ nombrePerfil }}</h2>
                    <p>{{ cargosPerfil.join(' · ') || 'Sin cargos registrados' }}</p>
                  </div>
                </header>

                <dl class="campos">
                  <div *ngFor="let campo of camposPerfil">
                    <dt>{{ campo.etiqueta }}</dt>
                    <dd>{{ campo.valor }}</dd>
                  </div>
                </dl>

                <div class="acciones">
                  <ion-button
                    type="button"
                    (click)="abrirChat()">
                    Enviar mensaje
                  </ion-button>
                </div>
              </section>
            </ng-container>

            <ng-container *ngIf="vista === 'chat'">
              <p class="aviso">
                Conversación con {{ nombrePostulante }}.
                Se muestran los últimos 50 mensajes.
              </p>

              <p
                class="estado"
                *ngIf="
                  chatDisponible &&
                  !cargandoMensajes &&
                  mensajes.length === 0
                ">
                Todavía no hay mensajes. Puedes iniciar la conversación.
              </p>

              <p
                class="estado"
                *ngIf="cargandoMensajes">
                Cargando mensajes...
              </p>

              <section
                class="mensajes"
                aria-live="polite">
                <article
                  *ngFor="let mensaje of mensajes; trackBy: identificarMensaje"
                  class="mensaje"
                  [class.propio]="mensaje.emisorId === usuarioId">
                  <span class="autor">
                    {{ mensaje.emisorId === usuarioId ? 'Tú' : nombrePostulante }}
                  </span>

                  <p>{{ mensaje.texto }}</p>

                  <small>
                    {{
                      mensaje.pendiente
                        ? 'Pendiente de confirmación'
                        : mensaje.fecha
                          ? (mensaje.fecha | date:'dd/MM/yyyy HH:mm')
                          : 'Sin fecha'
                    }}
                  </small>
                </article>
              </section>

              <form
                class="redaccion"
                (ngSubmit)="enviarMensaje()">
                <label for="texto-mensaje">
                  Escribe tu mensaje
                </label>

                <textarea
                  id="texto-mensaje"
                  name="textoMensaje"
                  [(ngModel)]="textoMensaje"
                  [disabled]="!chatDisponible || enviando"
                  maxlength="2000"
                  rows="4"
                  placeholder="Escribe aquí...">
                </textarea>

                <div class="pie-redaccion">
                  <small>{{ textoMensaje.length }}/2000</small>

                  <ion-button
                    type="submit"
                    [disabled]="
                      !chatDisponible ||
                      enviando ||
                      !textoMensaje.trim()
                    ">
                    {{ enviando ? 'Enviando...' : 'Enviar' }}
                  </ion-button>
                </div>
              </form>
            </ng-container>
          </main>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host {
      display: block;
      margin-top: 1rem;
    }

    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: .6rem;
    }

    ion-button {
      --border-radius: 9px;
      margin: 0;
      font-weight: 700;
    }

    ion-modal {
      --width: min(850px, 96vw);
      --height: 90vh;
      --border-radius: 18px;
      --ion-color-primary: #4f9d14;
      --ion-color-primary-contrast: #fff;
      --ion-color-primary-shade: #458a12;
      --ion-color-primary-tint: #61a72c;
    }

    ion-toolbar {
      --background: #1f2d18;
      --color: #fff;
    }

    ion-content {
      --background: #f1eedd;
    }

    .contenido {
      max-width: 800px;
      margin: auto;
      padding: 1.25rem;
      color: #1f2d18;
    }

    .estado {
      padding: 1rem;
      text-align: center;
      color: #527947;
    }

    .error {
      padding: 1rem;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #fef2f2;
      color: #991b1b;
    }

    .perfil {
      padding: 1.25rem;
      border-radius: 14px;
      background: #fff;
    }

    .persona {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .persona img {
      width: 70px;
      height: 70px;
      flex-shrink: 0;
      border-radius: 50%;
      object-fit: cover;
    }

    .persona h2 {
      margin: .25rem 0;
      font-size: 1.3rem;
      font-weight: 800;
    }

    .persona p {
      margin: 0;
      color: #527947;
    }

    .etiqueta {
      color: #458a12;
      font-size: .7rem;
      font-weight: 800;
    }

    .campos {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: .8rem;
    }

    .campos > div {
      padding: .85rem;
      border: 1px solid #d4d1c2;
      border-radius: 9px;
    }

    dt {
      margin-bottom: .35rem;
      color: #527947;
      font-size: .78rem;
      font-weight: 700;
    }

    dd {
      margin: 0;
      font-size: .9rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .aviso {
      color: #527947;
      font-size: .8rem;
      line-height: 1.5;
    }

    .mensajes {
      display: flex;
      flex-direction: column;
      gap: .8rem;
      padding: 1rem 0;
    }

    .mensaje {
      max-width: 85%;
      align-self: flex-start;
      padding: .85rem 1rem;
      border: 1px solid #d4d1c2;
      border-radius: 12px;
      background: #fff;
    }

    .mensaje.propio {
      align-self: flex-end;
      border-color: #aac78e;
      background: #e2eed5;
    }

    .autor {
      font-size: .75rem;
      font-weight: 800;
      color: #457a3e;
    }

    .mensaje p {
      margin: .4rem 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }

    .mensaje small {
      color: #527947;
      font-size: .68rem;
    }

    .redaccion {
      margin-top: 1rem;
      padding: 1rem;
      border: 1px solid #d4d1c2;
      border-radius: 12px;
      background: #fff;
    }

    .redaccion label {
      display: block;
      margin-bottom: .6rem;
      font-weight: 700;
    }

    textarea {
      box-sizing: border-box;
      width: 100%;
      padding: .8rem;
      border: 1px solid #d4d1c2;
      border-radius: 8px;
      background: #fff;
      color: #1f2d18;
      font: inherit;
      resize: vertical;
    }

    .pie-redaccion {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      margin-top: .6rem;
    }

    .pie-redaccion small {
      color: #527947;
    }

    @media (max-width: 600px) {
      ion-modal {
        --width: 100%;
        --height: 100%;
        --border-radius: 0;
      }

      .campos {
        grid-template-columns: 1fr;
      }

      .mensaje {
        max-width: 95%;
      }

      .acciones ion-button {
        width: 100%;
      }
    }
  `]
})
export class PerfilChatReclutadorComponent implements OnDestroy {
  @Input() postulanteId = '';
  @Input() nombrePostulante = '';
  @Input() nombreReclutador = '';
  @Input() nombreEmpresa = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  private cancelarMensajes?: () => void;
  private version = 0;

  abierto = false;
  vista: 'perfil' | 'chat' = 'perfil';

  cargando = false;
  cargandoMensajes = false;
  enviando = false;
  error = '';

  perfilDisponible = false;
  chatDisponible = false;

  nombrePerfil = '';
  foto = '';
  cargosPerfil: string[] = [];
  camposPerfil: CampoPerfil[] = [];

  usuarioId = '';
  conversacionId = '';
  textoMensaje = '';
  mensajes: MensajeChat[] = [];

  private actualizar(accion: () => void) {
    this.zone.run(() => {
      accion();
      this.cdr.detectChanges();
    });
  }

  private detenerEscucha() {
    this.cancelarMensajes?.();
    this.cancelarMensajes = undefined;
  }

  async abrirPerfil() {
    this.detenerEscucha();

    const version = ++this.version;

    this.abierto = true;
    this.vista = 'perfil';
    this.cargando = true;
    this.error = '';
    this.perfilDisponible = false;

    try {
      const snapshot = await getDocFromServer(
        doc(this.firestore, 'postulantes', this.postulanteId)
      );

      if (version !== this.version) {
        return;
      }

      if (!snapshot.exists()) {
        throw new Error('El perfil ya no está disponible.');
      }

      const data = snapshot.data();
      const cv = data['cvManual'] || {};

      const apellidos =
        data['apellidos'] ||
        [data['apellidoPaterno'], data['apellidoMaterno']]
          .filter(Boolean)
          .join(' ');

      const cargos = Array.isArray(data['cargosInteres'])
        ? data['cargosInteres']
        : Array.isArray(cv.cargosInteres)
          ? cv.cargosInteres
          : [];

      const campos: CampoPerfil[] = [
        { etiqueta: 'Correo', valor: data['correo'] || data['email'] },
        { etiqueta: 'Teléfono', valor: data['telefono'] || data['celular'] },
        { etiqueta: 'RUT', valor: data['rut'] },
        { etiqueta: 'Fecha de nacimiento', valor: data['fechaNacimiento'] },
        { etiqueta: 'País', valor: data['pais'] },
        { etiqueta: 'Ciudad', valor: data['ciudad'] },
        { etiqueta: 'Comuna', valor: data['comuna'] },
        { etiqueta: 'Nivel educativo', valor: cv.nivelEducativo },
        { etiqueta: 'Establecimiento', valor: cv.establecimiento },
        { etiqueta: 'Carrera', valor: cv.carrera },
        { etiqueta: 'Disponibilidad', valor: cv.disponibilidad },
        { etiqueta: 'Habilidades técnicas', valor: cv.habilidadesTecnicas },
        { etiqueta: 'Habilidades blandas', valor: cv.habilidadesBlandas },
        {
          etiqueta: 'Experiencia declarada',
          valor:
            cv.sinExperiencia === true
              ? 'Declara no tener experiencia'
              : cv.sinExperiencia === false
                ? 'Declara tener experiencia'
                : 'No especificado'
        },
        { etiqueta: 'Archivo de CV', valor: data['cvNombre'] }
      ].map(campo => ({
        etiqueta: campo.etiqueta,
        valor: String(campo.valor ?? '').trim() || 'No especificado'
      }));

      this.actualizar(() => {
        this.nombrePerfil =
          `${data['nombres'] || data['nombre'] || ''} ${apellidos || ''}`
            .trim() || this.nombrePostulante;

        this.foto = data['fotoPerfil'] || '';

        this.cargosPerfil = cargos
          .map((cargo: any) => String(cargo?.cargo || '').trim())
          .filter(Boolean);

        this.camposPerfil = campos;
        this.perfilDisponible = true;
      });
    } catch (error) {
      if (version !== this.version) {
        return;
      }

      console.error('Error al consultar perfil:', error);

      this.actualizar(() => {
        this.error = 'No fue posible consultar el perfil del postulante.';
      });
    } finally {
      if (version === this.version) {
        this.actualizar(() => {
          this.cargando = false;
        });
      }
    }
  }

  async abrirChat() {
    this.detenerEscucha();

    const version = ++this.version;
    const usuario = this.auth.currentUser;

    this.abierto = true;
    this.vista = 'chat';
    this.error = '';
    this.chatDisponible = false;
    this.cargandoMensajes = false;
    this.mensajes = [];
    this.textoMensaje = '';

    if (!usuario || !this.postulanteId) {
      this.error = 'Debes iniciar sesión para abrir la conversación.';
      return;
    }

    this.usuarioId = usuario.uid;
    this.cargando = true;

    this.conversacionId =
      `r_${usuario.uid}_p_${this.postulanteId}`;

    try {
      // Se crea o reutiliza la misma conversación.
      // No se sobrescribe el último mensaje.
      await setDoc(
        doc(this.firestore, 'conversaciones', this.conversacionId),
        {
          reclutadorId: usuario.uid,
          postulanteId: this.postulanteId,
          participantes: [usuario.uid, this.postulanteId],
          nombreReclutador: this.nombreReclutador,
          nombrePostulante: this.nombrePostulante,
          nombreEmpresa: this.nombreEmpresa,
          actualizadoEn: serverTimestamp()
        },
        { merge: true }
      );

      if (version !== this.version) {
        return;
      }

      this.actualizar(() => {
        this.chatDisponible = true;
        this.cargandoMensajes = true;
      });

      const consulta = query(
        collection(
          this.firestore,
          'conversaciones',
          this.conversacionId,
          'mensajes'
        ),
        orderBy('creadoEn', 'desc'),
        limit(50)
      );

      this.cancelarMensajes = onSnapshot(
        consulta,
        { includeMetadataChanges: true },
        snapshot => {
          if (version !== this.version) {
            return;
          }

          const mensajes = snapshot.docs.map(documento => {
            const data = documento.data();
            const fecha = data['creadoEn'];

            return {
              id: documento.id,
              emisorId: String(data['emisorId'] || ''),
              texto: String(data['texto'] || ''),
              fecha: fecha?.toDate ? fecha.toDate() : null,
              pendiente: documento.metadata.hasPendingWrites
            } as MensajeChat;
          }).reverse();

          this.actualizar(() => {
            this.mensajes = mensajes;
            this.cargandoMensajes = false;
          });
        },
        error => {
          if (version !== this.version) {
            return;
          }

          console.error('Error al escuchar mensajes:', error);

          this.actualizar(() => {
            this.cargandoMensajes = false;
            this.chatDisponible = false;
            this.error =
              'No fue posible leer los mensajes. Revisa los permisos de la conversación.';
          });
        }
      );
    } catch (error) {
      if (version !== this.version) {
        return;
      }

      console.error('Error al abrir conversación:', error);

      this.actualizar(() => {
        this.error =
          'No fue posible abrir el chat. Comprueba la conexión y las reglas de Firestore.';
      });
    } finally {
      if (version === this.version) {
        this.actualizar(() => {
          this.cargando = false;
        });
      }
    }
  }

  async enviarMensaje() {
    const usuario = this.auth.currentUser;
    const texto = this.textoMensaje.trim();

    if (
      !usuario ||
      usuario.uid !== this.usuarioId ||
      !this.chatDisponible ||
      this.enviando ||
      !texto ||
      texto.length > 2000
    ) {
      return;
    }

    const version = this.version;
    const conversacionId = this.conversacionId;

    this.enviando = true;
    this.error = '';

    try {
      const conversacion = doc(
        this.firestore,
        'conversaciones',
        conversacionId
      );

      const mensaje = doc(
        collection(conversacion, 'mensajes')
      );

      const lote = writeBatch(this.firestore);

      lote.set(mensaje, {
        emisorId: usuario.uid,
        texto,
        creadoEn: serverTimestamp()
      });

      lote.update(conversacion, {
        ultimoMensaje: texto,
        ultimoEmisorId: usuario.uid,
        actualizadoEn: serverTimestamp()
      });

      await lote.commit();

      if (version === this.version) {
        this.actualizar(() => {
          this.textoMensaje = '';
        });
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);

      if (version === this.version) {
        this.actualizar(() => {
          this.error =
            'El mensaje no se pudo confirmar. Conservamos el texto para que puedas intentarlo nuevamente.';
        });
      }
    } finally {
      this.actualizar(() => {
        this.enviando = false;
      });
    }
  }

  identificarMensaje(_indice: number, mensaje: MensajeChat) {
    return mensaje.id;
  }

  cerrar() {
    this.version++;
    this.detenerEscucha();

    this.abierto = false;
    this.cargando = false;
    this.cargandoMensajes = false;
    this.chatDisponible = false;
    this.error = '';
  }

  ngOnDestroy() {
    this.version++;
    this.detenerEscucha();
  }
}