import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
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
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonSpinner
  ],
  template: `
    <div class="acciones" *ngIf="!pagina">
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

    <section
      class="pagina-perfil-chat"
      *ngIf="pagina && abierto">

      <ion-header>
        <ion-toolbar>
          <ion-title>
            {{
              vista === 'perfil'
                ? 'Perfil del postulante'
                : nombrePostulante
            }}
          </ion-title>

          <ion-buttons slot="end">
            <ion-button
              type="button"
              (click)="cerrar()">
              Volver
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <main class="contenido">
        <div class="estado" *ngIf="cargando">
          <ion-spinner name="crescent"></ion-spinner>

          <p>
            {{
              vista === 'perfil'
                ? 'Cargando perfil...'
                : 'Abriendo conversación...'
            }}
          </p>
        </div>

        <p
          class="error"
          role="alert"
          *ngIf="error">
          {{ error }}
        </p>

        <ng-container *ngIf="vista === 'perfil' && !cargando">
          <section class="perfil" *ngIf="perfilDisponible">
            <header class="persona">
              <img
                *ngIf="foto"
                [src]="foto"
                [alt]="'Foto de ' + nombrePerfil">

              <div>
                <span class="etiqueta">POSTULANTE</span>

                <h2>{{ nombrePerfil }}</h2>

                <p>
                  {{
                    cargosPerfil.join(' · ') ||
                    'Sin cargos registrados'
                  }}
                </p>
              </div>
            </header>

            <dl class="campos">
              <div *ngFor="let campo of camposPerfil">
                <dt>{{ campo.etiqueta }}</dt>
                <dd>{{ campo.valor }}</dd>
              </div>
            </dl>

            <h3>Experiencia laboral</h3>

            <p *ngIf="!experiencias.length">
              Sin experiencias registradas.
            </p>

            <article
              class="experiencia"
              *ngFor="let experiencia of experiencias">

              <strong>
                {{ experiencia.cargo }} · {{ experiencia.lugar }}
              </strong>

              <p>{{ experiencia.tiempo }}</p>
              <p>{{ experiencia.descripcion }}</p>
            </article>

            <div class="acciones">
              <ion-button
                *ngIf="cvDocumento"
                type="button"
                fill="outline"
                (click)="abrirDocumento()">
                Abrir CV en PDF
              </ion-button>

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
            La conversación se actualiza en tiempo real.
            Conversación con {{ nombrePostulante }}.
            Puedes cargar los mensajes anteriores con el botón
            del historial.
          </p>

          <p
            class="estado"
            *ngIf="
              chatDisponible &&
              !cargandoMensajes &&
              mensajes.length === 0
            ">
            Todavía no hay mensajes.
            Puedes iniciar la conversación.
          </p>

          <p class="estado" *ngIf="cargandoMensajes">
            Cargando mensajes...
          </p>

          <ion-button
            *ngIf="hayMasMensajes"
            type="button"
            fill="outline"
            [disabled]="cargandoMensajes"
            (click)="cargarAnteriores()">
            Cargar mensajes anteriores
          </ion-button>

          <section
            class="mensajes"
            aria-live="polite">

            <article
              *ngFor="
                let mensaje of mensajes;
                trackBy: identificarMensaje
              "
              class="mensaje"
              [class.propio]="mensaje.emisorId === usuarioId">

              <span class="autor">
                {{
                  mensaje.emisorId === usuarioId
                    ? 'Tú'
                    : nombrePostulante
                }}
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
    </section>
  `,
  styles: [`
    :host {
      display: block;
      margin-top: 1rem;

      --ion-color-primary: #4f9d14;
      --ion-color-primary-contrast: #ffffff;
      --ion-color-primary-shade: #458a12;
      --ion-color-primary-tint: #61a72c;
    }

    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    ion-button {
      --border-radius: 9px;
      margin: 0;
      font-weight: 700;
    }

    ion-toolbar {
      --background: #1f2d18;
      --color: #ffffff;
    }

    .pagina-perfil-chat {
      background: #f1eedd;
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
      background: #ffffff;
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
      margin: 0.25rem 0;
      font-size: 1.3rem;
      font-weight: 800;
    }

    .persona p {
      margin: 0;
      color: #527947;
    }

    .etiqueta {
      color: #458a12;
      font-size: 0.7rem;
      font-weight: 800;
    }

    .campos {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.8rem;
    }

    .campos > div {
      padding: 0.85rem;
      border: 1px solid #d4d1c2;
      border-radius: 9px;
    }

    dt {
      margin-bottom: 0.35rem;
      color: #527947;
      font-size: 0.78rem;
      font-weight: 700;
    }

    dd {
      margin: 0;
      font-size: 0.9rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .experiencia {
      padding: 1rem;
      margin-bottom: 0.8rem;
      border: 1px solid #d4d1c2;
      border-radius: 9px;
    }

    .experiencia p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }

    .aviso {
      color: #527947;
      font-size: 0.8rem;
      line-height: 1.5;
    }

    .mensajes {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      padding: 1rem 0;
    }

    .mensaje {
      max-width: 85%;
      align-self: flex-start;
      padding: 0.85rem 1rem;
      border: 1px solid #d4d1c2;
      border-radius: 12px;
      background: #ffffff;
    }

    .mensaje.propio {
      align-self: flex-end;
      border-color: #aac78e;
      background: #e2eed5;
    }

    .autor {
      font-size: 0.75rem;
      font-weight: 800;
      color: #457a3e;
    }

    .mensaje p {
      margin: 0.4rem 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }

    .mensaje small {
      color: #527947;
      font-size: 0.68rem;
    }

    .redaccion {
      margin-top: 1rem;
      padding: 1rem;
      border: 1px solid #d4d1c2;
      border-radius: 12px;
      background: #ffffff;
    }

    .redaccion label {
      display: block;
      margin-bottom: 0.6rem;
      font-weight: 700;
    }

    textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 0.8rem;
      border: 1px solid #d4d1c2;
      border-radius: 8px;
      background: #ffffff;
      color: #1f2d18;
      font: inherit;
      resize: vertical;
    }

    .pie-redaccion {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: 0.6rem;
    }

    .pie-redaccion small {
      color: #527947;
    }

    @media (max-width: 600px) {
      .campos {
        grid-template-columns: 1fr;
      }

      .mensaje {
        max-width: 95%;
      }

      .acciones ion-button {
        width: 100%;
      }

      .persona {
        align-items: flex-start;
      }
    }
  `]
})
export class PerfilChatReclutadorComponent
  implements OnChanges, OnDestroy {

  @Input() pagina = false;
  @Input() modoInicial = 'perfil';

  @Input() postulanteId = '';
  @Input() nombrePostulante = '';
  @Input() nombreReclutador = '';
  @Input() nombreEmpresa = '';

  private router = inject(Router);
  private route = inject(ActivatedRoute);
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
  experiencias: any[] = [];

  cvDocumento = '';

  usuarioId = '';
  conversacionId = '';
  textoMensaje = '';

  mensajes: MensajeChat[] = [];

  limiteMensajes = 50;
  hayMasMensajes = false;

  ngOnChanges(): void {
    if (!this.pagina) {
      return;
    }

    if (this.modoInicial === 'chat') {
      void this.abrirChat();
    } else {
      void this.abrirPerfil();
    }
  }

  private async navegar(modo: string): Promise<void> {
    const parametros = await firstValueFrom(
      this.route.queryParamMap
    );

    await this.router.navigate(['/home'], {
      queryParams: {
        vista: modo,
        postulante: this.postulanteId,
        oferta: parametros.get('oferta'),
        volver:
          parametros.get('volver') ||
          parametros.get('vista') ||
          'buscar'
      }
    });
  }

  private actualizar(accion: () => void): void {
    this.zone.run(() => {
      accion();
      this.cdr.detectChanges();
    });
  }

  private detenerEscucha(): void {
    this.cancelarMensajes?.();
    this.cancelarMensajes = undefined;
  }

  async abrirPerfil(): Promise<void> {
    if (!this.pagina) {
      await this.navegar('perfil');
      return;
    }

    this.detenerEscucha();

    if (!this.postulanteId) {
      return;
    }

    const version = ++this.version;

    this.abierto = true;
    this.vista = 'perfil';
    this.cargando = true;
    this.error = '';
    this.perfilDisponible = false;

    try {
      const snapshot = await getDocFromServer(
        doc(
          this.firestore,
          'postulantes',
          this.postulanteId
        )
      );

      if (version !== this.version) {
        return;
      }

      if (!snapshot.exists()) {
        throw new Error(
          'El perfil ya no está disponible.'
        );
      }

      const data = snapshot.data();
      const cv = data['cvManual'] || {};

      const apellidos =
        data['apellidos'] ||
        [
          data['apellidoPaterno'],
          data['apellidoMaterno']
        ]
          .filter(Boolean)
          .join(' ');

      const cargos = Array.isArray(data['cargosInteres'])
        ? data['cargosInteres']
        : Array.isArray(cv.cargosInteres)
          ? cv.cargosInteres
          : [];

      const campos: CampoPerfil[] = [
        {
          etiqueta: 'Correo',
          valor: data['correo'] || data['email']
        },
        {
          etiqueta: 'Teléfono',
          valor: data['telefono'] || data['celular']
        },
        {
          etiqueta: 'RUT',
          valor: data['rut']
        },
        {
          etiqueta: 'Fecha de nacimiento',
          valor: data['fechaNacimiento']
        },
        {
          etiqueta: 'País',
          valor: data['pais']
        },
        {
          etiqueta: 'Ciudad',
          valor: data['ciudad']
        },
        {
          etiqueta: 'Comuna',
          valor: data['comuna']
        },
        {
          etiqueta: 'Nivel educativo',
          valor: cv.nivelEducativo
        },
        {
          etiqueta: 'Establecimiento',
          valor: cv.establecimiento
        },
        {
          etiqueta: 'Carrera',
          valor: cv.carrera
        },
        {
          etiqueta: 'Disponibilidad',
          valor: cv.disponibilidad
        },
        {
          etiqueta: 'Habilidades técnicas',
          valor: cv.habilidadesTecnicas
        },
        {
          etiqueta: 'Habilidades blandas',
          valor: cv.habilidadesBlandas
        },
        {
          etiqueta: 'Experiencia declarada',
          valor:
            cv.sinExperiencia === true
              ? 'Declara no tener experiencia'
              : cv.sinExperiencia === false
                ? 'Declara tener experiencia'
                : 'No especificado'
        },
        {
          etiqueta: 'Archivo de CV',
          valor: data['cvNombre']
        }
      ].map(campo => ({
        etiqueta: campo.etiqueta,
        valor:
          String(campo.valor ?? '').trim() ||
          'No especificado'
      }));

      this.actualizar(() => {
        this.nombrePerfil =
          `${
            data['nombres'] || data['nombre'] || ''
          } ${apellidos || ''}`.trim() ||
          this.nombrePostulante;

        this.foto = data['fotoPerfil'] || '';

        this.cargosPerfil = cargos
          .map((cargo: any) =>
            String(cargo?.cargo || '').trim()
          )
          .filter(Boolean);

        this.experiencias =
          Array.isArray(cv.areasExperiencia)
            ? cv.areasExperiencia
            : [];

        this.cvDocumento = data['cvBase64'] || '';
        this.camposPerfil = campos;
        this.perfilDisponible = true;
      });
    } catch (error) {
      if (version !== this.version) {
        return;
      }

      console.error(
        'Error al consultar perfil:',
        error
      );

      this.actualizar(() => {
        this.error =
          'No fue posible consultar el perfil del postulante.';
      });
    } finally {
      if (version === this.version) {
        this.actualizar(() => {
          this.cargando = false;
        });
      }
    }
  }

  abrirDocumento(): void {
    if (
      !this.cvDocumento.startsWith(
        'data:application/pdf'
      )
    ) {
      return;
    }

    try {
      const contenidoBase64 =
        this.cvDocumento.split(',')[1];

      const binario = atob(contenidoBase64);

      const bytes = Uint8Array.from(
        binario,
        caracter => caracter.charCodeAt(0)
      );

      const archivo = new Blob(
        [bytes],
        { type: 'application/pdf' }
      );

      const url = URL.createObjectURL(archivo);

      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (error) {
      console.error('Error al abrir CV:', error);
      this.error = 'No se pudo abrir el CV.';
    }
  }

  async abrirChat(): Promise<void> {
    if (
      !this.pagina ||
      this.modoInicial !== 'chat'
    ) {
      await this.navegar('chat');
      return;
    }

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
    this.hayMasMensajes = false;

    if (!usuario || !this.postulanteId) {
      this.error =
        'Debes iniciar sesión para abrir la conversación.';
      return;
    }

    this.usuarioId = usuario.uid;
    this.cargando = true;

    this.conversacionId =
      `r_${usuario.uid}_p_${this.postulanteId}`;

    try {
      const persona = await getDocFromServer(
        doc(
          this.firestore,
          'postulantes',
          this.postulanteId
        )
      );

      const reclutador = await getDocFromServer(
        doc(
          this.firestore,
          'reclutadores',
          usuario.uid
        )
      );

      if (version !== this.version) {
        return;
      }

      if (
        !persona.exists() ||
        reclutador.data()?.['estado'] !== 'aprobado'
      ) {
        throw new Error(
          'No se pudo verificar el acceso al chat.'
        );
      }

      const datos = persona.data();

      const apellidos =
        datos['apellidos'] ||
        [
          datos['apellidoPaterno'],
          datos['apellidoMaterno']
        ]
          .filter(Boolean)
          .join(' ');

      this.nombrePostulante = [
        datos['nombre'] || datos['nombres'],
        apellidos
      ]
        .filter(Boolean)
        .join(' ') || 'Postulante';

      // Reutiliza la conversación sin borrar su historial
      // ni sobrescribir el último mensaje.
      await setDoc(
        doc(
          this.firestore,
          'conversaciones',
          this.conversacionId
        ),
        {
          reclutadorId: usuario.uid,
          postulanteId: this.postulanteId,
          participantes: [
            usuario.uid,
            this.postulanteId
          ],
          nombreReclutador: this.nombreReclutador,
          nombrePostulante: this.nombrePostulante,
          nombreEmpresa: this.nombreEmpresa
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

      this.limiteMensajes = 50;
      this.escucharHistorial(version);
    } catch (error) {
      if (version !== this.version) {
        return;
      }

      console.error(
        'Error al abrir conversación:',
        error
      );

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

  cargarAnteriores(): void {
    if (
      this.cargandoMensajes ||
      !this.chatDisponible
    ) {
      return;
    }

    this.limiteMensajes += 50;
    this.cargandoMensajes = true;

    this.detenerEscucha();
    this.escucharHistorial(this.version);
  }

  private escucharHistorial(version: number): void {
    const consulta = query(
      collection(
        this.firestore,
        'conversaciones',
        this.conversacionId,
        'mensajes'
      ),
      orderBy('creadoEn', 'desc'),
      limit(this.limiteMensajes)
    );

    this.cancelarMensajes = onSnapshot(
      consulta,
      { includeMetadataChanges: true },
      snapshot => {
        if (version !== this.version) {
          return;
        }

        const mensajes: MensajeChat[] =
          snapshot.docs
            .map(documento => {
              const data = documento.data();
              const fecha = data['creadoEn'];

              return {
                id: documento.id,
                emisorId: String(
                  data['emisorId'] || ''
                ),
                texto: String(data['texto'] || ''),
                fecha: fecha?.toDate
                  ? fecha.toDate()
                  : null,
                pendiente:
                  documento.metadata.hasPendingWrites
              };
            })
            .reverse();

        this.actualizar(() => {
          this.hayMasMensajes =
            snapshot.size >= this.limiteMensajes;

          this.mensajes = mensajes;
          this.cargandoMensajes = false;
        });
      },
      error => {
        if (version !== this.version) {
          return;
        }

        console.error(
          'Error al escuchar mensajes:',
          error
        );

        this.actualizar(() => {
          this.cargandoMensajes = false;
          this.chatDisponible = false;

          this.error =
            'No fue posible leer los mensajes. Revisa los permisos de la conversación.';
        });
      }
    );
  }

  async enviarMensaje(): Promise<void> {
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
      console.error(
        'Error al enviar mensaje:',
        error
      );

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

  identificarMensaje(
    _indice: number,
    mensaje: MensajeChat
  ): string {
    return mensaje.id;
  }

  async cerrar(): Promise<void> {
    this.version++;
    this.detenerEscucha();

    this.abierto = false;
    this.cargando = false;
    this.cargandoMensajes = false;
    this.chatDisponible = false;
    this.error = '';

    if (this.pagina) {
      const parametros = await firstValueFrom(
        this.route.queryParamMap
      );

      await this.router.navigate(['/home'], {
        queryParams: {
          vista:
            parametros.get('volver') || 'buscar',
          oferta: parametros.get('oferta')
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.version++;
    this.detenerEscucha();
  }
}