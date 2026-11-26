import { nivelMayorVisible, experienciaVisible } from '../../data/niveles-educativos';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  ViewChild,
  ElementRef,
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
  IonSpinner,
  IonIcon
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  checkmarkDoneOutline,
  send,
  personOutline,
  arrowUpCircleOutline
} from 'ionicons/icons';

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
  estado: 'pendiente' | 'visto';
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
    IonSpinner,
    IonIcon
  ],
  template: `
    <div class="acciones" *ngIf="!pagina">
      <ion-button
        type="button"
        fill="outline"
        (click)="abrirPerfil()">
        {{ soloDetalles ? 'Ver detalles' : 'Ver perfil completo' }}
      </ion-button>

      <ion-button
        *ngIf="!soloDetalles"
        type="button"
        (click)="abrirChat()">
        Enviar mensaje
      </ion-button>
    </div>

    <section
      class="pagina-perfil-chat"
      [class.modo-widget]="enWidget"
      [class.ficha-completa]="!enWidget && vista === 'perfil'"
      *ngIf="pagina && abierto">

      <!-- CABECERA SOLO CUANDO ES PÁGINA COMPLETA (NO WIDGET) -->
      <ion-header *ngIf="!enWidget">
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

      <!-- SUBCABECERA COMPACTA DEL CHAT EN WIDGET -->
      <header class="widget-chat-topbar" *ngIf="enWidget && vista === 'chat'">
        <div class="widget-user-badge">
          <div class="widget-avatar">
            <img *ngIf="foto" [src]="foto" [alt]="nombrePostulante">
            <ion-icon *ngIf="!foto" name="person-outline"></ion-icon>
          </div>
          <div class="widget-user-meta">
            <strong>{{ nombrePostulante || 'Postulante' }}</strong>
          </div>
        </div>
      </header>

      <!-- VISTA DE PERFIL COMPLETO -->
      <main class="contenido" *ngIf="vista === 'perfil'">
        <div class="estado" *ngIf="cargando">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Cargando perfil...</p>
        </div>

        <p class="error" role="alert" *ngIf="error">
          {{ error }}
        </p>

        <section class="perfil" *ngIf="!cargando && perfilDisponible">
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
      </main>

      <!-- VISTA DE CONVERSACIÓN (LAYOUT FLEX FIJO) -->
      <div class="chat-layout-flex" *ngIf="vista === 'chat'">
        
        <!-- ZONA CON SCROLL DE MENSAJES -->
        <div class="mensajes-scroll-area" #contenedorMensajes>
          <div class="aviso-pill">
            Conversación directa con <strong>{{ nombrePostulante }}</strong>
          </div>

          <div class="estado" *ngIf="cargando || cargandoMensajes">
            <ion-spinner name="crescent"></ion-spinner>
            <p>Cargando conversación...</p>
          </div>

          <p class="error" role="alert" *ngIf="error">
            {{ error }}
          </p>

          <p
            class="estado-vacio-chat"
            *ngIf="
              chatDisponible &&
              !cargando &&
              !cargandoMensajes &&
              mensajes.length === 0
            ">
            Aún no hay mensajes. Escribe abajo para iniciar la conversación.
          </p>

          <div class="btn-historial-wrap" *ngIf="hayMasMensajes">
            <button
              type="button"
              class="btn-historial"
              [disabled]="cargandoMensajes"
              (click)="cargarAnteriores()">
              <ion-icon name="arrow-up-circle-outline"></ion-icon>
              Ver mensajes anteriores
            </button>
          </div>

          <section class="mensajes" aria-live="polite">
            <article
              *ngFor="let mensaje of mensajes; trackBy: identificarMensaje"
              class="mensaje"
              [class.propio]="mensaje.emisorId === usuarioId">

              <p class="texto-burbuja">{{ mensaje.texto }}</p>

              <div class="pie-mensaje">
                <small>
                  {{
                    mensaje.pendiente
                      ? 'Enviando...'
                      : mensaje.fecha
                        ? (mensaje.fecha | date:'HH:mm')
                        : ''
                  }}
                </small>

                <ion-icon
                  *ngIf="mensaje.emisorId === usuarioId && !mensaje.pendiente"
                  name="checkmark-done-outline"
                  class="estado-visto"
                  [class.visto]="mensaje.estado === 'visto'"
                  [attr.aria-label]="mensaje.estado === 'visto' ? 'Leído' : 'Enviado'"
                  [title]="mensaje.estado === 'visto' ? 'Leído' : 'Enviado'">
                </ion-icon>
              </div>
            </article>
          </section>
        </div>

        <!-- BARRA DE ESCRITURA SIEMPRE VISIBLE ABAJO -->
        <form
          class="barra-escritura"
          (ngSubmit)="enviarMensaje()">

          <textarea
            id="texto-mensaje"
            name="textoMensaje"
            [(ngModel)]="textoMensaje"
            [disabled]="!chatDisponible || enviando"
            maxlength="2000"
            rows="1"
            (keydown.enter)="manejarEnter($event)"
            placeholder="Escribe un mensaje...">
          </textarea>

          <button
            type="submit"
            class="btn-enviar-circular"
            title="Enviar mensaje"
            [disabled]="
              !chatDisponible ||
              enviando ||
              !textoMensaje.trim()
            ">
            <ion-icon name="send"></ion-icon>
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;

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
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
      background: #f4f7f1;
    }

    /* Subcabecera del contacto dentro del widget */
    .widget-chat-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: #eef6e7;
      border-bottom: 1px solid #d6e5c9;
      flex-shrink: 0;
    }

    .widget-user-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .widget-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #4f9d14;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 5px rgba(31, 45, 24, 0.12);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      ion-icon {
        font-size: 1.1rem;
      }
    }

    .widget-user-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;

      strong {
        font-size: 0.88rem;
        font-weight: 800;
        color: #1f2d18;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      span {
        font-size: 0.7rem;
        color: #4f9d14;
        font-weight: 600;
      }
    }

    /* Estructura Flex del Chat para fijar input abajo */
    .chat-layout-flex {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
      overflow: hidden;
      background-color: #f3f6ef;
      background-image: radial-gradient(#dce7d2 1px, transparent 1px);
      background-size: 16px 16px;
    }

    .mensajes-scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .aviso-pill {
      align-self: center;
      background: #ffffff;
      border: 1px solid #d7e5cb;
      color: #4a6b3e;
      font-size: 0.72rem;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 4px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }

    .estado-vacio-chat {
      margin: auto;
      text-align: center;
      color: #5d7a52;
      font-size: 0.84rem;
      background: rgba(255, 255, 255, 0.85);
      padding: 14px 18px;
      border-radius: 12px;
      border: 1px dashed #c8dab8;
    }

    .btn-historial-wrap {
      display: flex;
      justify-content: center;
      margin: 4px 0;
    }

    .btn-historial {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #c9dbb9;
      color: #458a12;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 999px;
      cursor: pointer;

      &:hover {
        background: #eef7e6;
      }
    }

    .mensajes {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* BURBUJAS COMPACTAS Y ESTÉTICAS */
    .mensaje {
      width: fit-content;
      min-width: 72px;
      max-width: 78%;
      align-self: flex-start;
      padding: 7px 11px 5px;
      border: 1px solid #dce6d3;
      border-radius: 14px 14px 14px 4px;
      background: #ffffff;
      color: #1f2d18;
      box-shadow: 0 1px 3px rgba(31, 45, 24, 0.06);
    }

    .mensaje.propio {
      align-self: flex-end;
      border-color: #b7d69c;
      border-radius: 14px 14px 4px 14px;
      background: #dcf1c9;
    }

    .texto-burbuja {
      margin: 0;
      font-size: 0.86rem;
      line-height: 1.38;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #1a2714;
    }

    .pie-mensaje {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 2px;
    }

    .mensaje small {
      color: #5b7850;
      font-size: 0.65rem;
      font-weight: 600;
    }

    /* PALOMITAS DE VISTO (GRIS -> AZUL AL LEER) */
    .estado-visto {
      font-size: 1rem;
      color: #8aa182;
      flex-shrink: 0;
      transition: color 0.2s ease, transform 0.2s ease;

      &.visto {
        color: #0ea5e9;
      }
    }

    /* BARRA DE ESCRITURA COMPACTA Y FIJA ABAJO */
    .barra-escritura {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #d6e5c9;
      flex-shrink: 0;

      textarea {
        flex: 1;
        min-height: 38px;
        max-height: 84px;
        padding: 9px 14px;
        border: 1px solid #cde0bd;
        border-radius: 20px;
        background: #f6faf2;
        color: #1f2d18;
        font-family: inherit;
        font-size: 0.86rem;
        line-height: 1.35;
        resize: none;
        outline: none;
        transition: border-color 0.2s, background-color 0.2s;

        &:focus {
          background: #ffffff;
          border-color: #4f9d14;
          box-shadow: 0 0 0 3px rgba(79, 157, 20, 0.12);
        }

        &::placeholder {
          color: #829978;
        }
      }

      .btn-enviar-circular {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #458a12 0%, #5ab034 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(79, 157, 20, 0.28);
        transition: transform 0.15s ease, opacity 0.15s ease;

        ion-icon {
          font-size: 1rem;
          margin-left: 2px;
        }

        &:hover:not(:disabled) {
          transform: scale(1.06);
        }

        &:disabled {
          background: #cbd8c0;
          box-shadow: none;
          cursor: not-allowed;
          opacity: 0.7;
        }
      }
    }

    /* ESTILOS DE VISTA PERFIL COMPLETO */
    .contenido {
      flex: 1;
      overflow-y: auto;
      max-width: 800px;
      width: 100%;
      margin: auto;
      padding: 1.25rem;
      color: #1f2d18;
    }

    .pagina-perfil-chat.ficha-completa {
      height: auto;
      flex: none;

      .contenido {
        box-sizing: border-box;
        flex: none;
        overflow: visible;
        padding-bottom: 2rem;
      }
    }

    .estado {
      padding: 1rem;
      text-align: center;
      color: #527947;
    }

    .error {
      padding: 0.75rem 1rem;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 0.82rem;
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

    @media (max-width: 600px) {
      .campos {
        grid-template-columns: 1fr;
      }

      .mensaje {
        max-width: 88%;
      }
    }
  `]
})
export class PerfilChatReclutadorComponent
  implements OnChanges, OnDestroy {

  @Input() soloDetalles = false;
  @Input() pagina = false;
  @Input() enWidget = false;
  @Input() modoInicial = 'perfil';

  @Input() postulanteId = '';
  @Input() nombrePostulante = '';
  @Input() nombreReclutador = '';
  @Input() nombreEmpresa = '';

  @ViewChild('contenedorMensajes')
  contenedorMensajes?: ElementRef<HTMLDivElement>;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  private cancelarPerfil?: () => void;
  private cancelarMensajes?: () => void;
  private cancelarCabeceraConv?: () => void;
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
  private ultimaLecturaPostulanteMs = 0;

  limiteMensajes = 50;
  hayMasMensajes = false;

  constructor() {
    addIcons({
      'checkmark-done-outline': checkmarkDoneOutline,
      'send': send,
      'person-outline': personOutline,
      'arrow-up-circle-outline': arrowUpCircleOutline
    });
  }

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

  manejarEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      keyEvent.preventDefault();
      void this.enviarMensaje();
    }
  }

  private bajarAlUltimoMensaje(): void {
    setTimeout(() => {
      const el = this.contenedorMensajes?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 60);
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
    this.cancelarPerfil?.();
    this.cancelarPerfil = undefined;
    this.cancelarMensajes?.();
    this.cancelarMensajes = undefined;
    this.cancelarCabeceraConv?.();
    this.cancelarCabeceraConv = undefined;
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

    const fallo = () => {
      if (version !== this.version) return;
      this.actualizar(() => {
        this.error = 'No fue posible consultar el perfil del postulante.';
        this.cargando = false;
        this.perfilDisponible = false;
      });
    };

    this.cancelarPerfil = onSnapshot(doc(this.firestore, 'postulantes', this.postulanteId), snapshot => {
      if (version !== this.version) {
        return;
      }

      if (!snapshot.exists()) {
        fallo();
        return;
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
        { etiqueta: 'Nivel educativo', valor: nivelMayorVisible(cv.nivelEducativo ?? data['nivelEducativo']) },
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
        { etiqueta: 'Años de experiencia', valor: experienciaVisible(cv) },
        { etiqueta: 'Archivo de CV', valor: data['cvNombre'] }
      ].map(campo => ({
        etiqueta: campo.etiqueta,
        valor: String(campo.valor ?? '').trim() || 'No especificado'
      }));

      this.actualizar(() => {
        this.nombrePerfil =
          `${data['nombres'] || data['nombre'] || ''} ${apellidos || ''}`.trim() ||
          this.nombrePostulante;

        this.foto = data['fotoPerfil'] || '';
        this.cargosPerfil = cargos
          .map((cargo: any) => String(cargo?.cargo || '').trim())
          .filter(Boolean);
        this.experiencias = Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [];
        this.cvDocumento = data['cvBase64'] || '';
        this.camposPerfil = campos;
        this.perfilDisponible = true;
        this.error = '';
        this.cargando = false;
      });
    }, fallo);
  }

  abrirDocumento(): void {
    if (!this.cvDocumento.startsWith('data:application/pdf')) {
      return;
    }

    try {
      const contenidoBase64 = this.cvDocumento.split(',')[1];
      const binario = atob(contenidoBase64);
      const bytes = Uint8Array.from(binario, caracter => caracter.charCodeAt(0));
      const archivo = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(archivo);

      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error al abrir CV:', error);
      this.error = 'No se pudo abrir el CV.';
    }
  }

  async abrirChat(): Promise<void> {
    if (!this.pagina || this.modoInicial !== 'chat') {
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
    this.ultimaLecturaPostulanteMs = 0;

    if (!usuario || !this.postulanteId) {
      this.error = 'Debes iniciar sesión para abrir la conversación.';
      return;
    }

    this.usuarioId = usuario.uid;
    this.cargando = true;
    this.conversacionId = `r_${usuario.uid}_p_${this.postulanteId}`;

    try {
      const persona = await getDocFromServer(
        doc(this.firestore, 'postulantes', this.postulanteId)
      );

      const reclutador = await getDocFromServer(
        doc(this.firestore, 'reclutadores', usuario.uid)
      );

      if (version !== this.version) {
        return;
      }

      if (!persona.exists() || reclutador.data()?.['estado'] !== 'aprobado') {
        throw new Error('No se pudo verificar el acceso al chat.');
      }

      const datos = persona.data();
      const apellidos =
        datos['apellidos'] ||
        [datos['apellidoPaterno'], datos['apellidoMaterno']]
          .filter(Boolean)
          .join(' ');

      this.nombrePostulante = [
        datos['nombre'] || datos['nombres'],
        apellidos
      ]
        .filter(Boolean)
        .join(' ') || 'Postulante';

      this.foto = datos['fotoPerfil'] || '';

      await setDoc(
        doc(this.firestore, 'conversaciones', this.conversacionId),
        {
          reclutadorId: usuario.uid,
          postulanteId: this.postulanteId,
          participantes: [usuario.uid, this.postulanteId],
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
      this.escucharEstadoConversacion(version);
      this.escucharHistorial(version);
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

  private escucharEstadoConversacion(version: number): void {
    this.cancelarCabeceraConv = onSnapshot(
      doc(this.firestore, 'conversaciones', this.conversacionId),
      snap => {
        if (version !== this.version || !snap.exists()) {
          return;
        }
        const data = snap.data();
        const lectura =
          data['ultimaLecturaPostulante'] ??
          data['leidoPostulanteEn'] ??
          data['vistoPostulanteEn'];

        const ms = lectura?.toMillis
          ? lectura.toMillis()
          : lectura instanceof Date
            ? lectura.getTime()
            : 0;

        if (ms > this.ultimaLecturaPostulanteMs) {
          this.ultimaLecturaPostulanteMs = ms;
          this.actualizar(() => {
            this.mensajes = this.mensajes.map(m => ({
              ...m,
              estado:
                m.emisorId === this.usuarioId &&
                m.fecha &&
                m.fecha.getTime() <= ms
                  ? 'visto'
                  : m.estado
            }));
          });
        }
      },
      () => {}
    );
  }

  cargarAnteriores(): void {
    if (this.cargandoMensajes || !this.chatDisponible) {
      return;
    }

    this.limiteMensajes += 50;
    this.cargandoMensajes = true;

    this.cancelarMensajes?.();
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

        const loteLectura = writeBatch(this.firestore);
        let hayMensajesSinLeer = false;

        const mensajes: MensajeChat[] = snapshot.docs
          .map(documento => {
            const data = documento.data();
            const fechaRaw = data['creadoEn'];
            const fecha: Date | null = fechaRaw?.toDate ? fechaRaw.toDate() : null;
            const emisorId = String(data['emisorId'] || '');
            const estadoRaw = String(data['estado'] || '').toLowerCase();

            const marcadoVisto =
              estadoRaw === 'visto' ||
              estadoRaw === 'leido' ||
              data['leido'] === true ||
              data['visto'] === true ||
              (fecha !== null &&
                this.ultimaLecturaPostulanteMs > 0 &&
                fecha.getTime() <= this.ultimaLecturaPostulanteMs);

            const estado: 'pendiente' | 'visto' = marcadoVisto ? 'visto' : 'pendiente';

            if (
              emisorId &&
              emisorId !== this.usuarioId &&
              estado !== 'visto' &&
              !documento.metadata.hasPendingWrites
            ) {
              loteLectura.update(documento.ref, {
                estado: 'visto',
                vistoEn: serverTimestamp()
              });
              hayMensajesSinLeer = true;
            }

            return {
              id: documento.id,
              emisorId,
              texto: String(data['texto'] || ''),
              estado: emisorId !== this.usuarioId ? 'visto' : estado,
              fecha,
              pendiente: documento.metadata.hasPendingWrites
            };
          })
          .reverse();

        if (hayMensajesSinLeer) {
          void loteLectura.commit().catch(err =>
            console.error('Error al marcar mensajes como vistos:', err)
          );
        }

        this.actualizar(() => {
          this.hayMasMensajes = snapshot.size >= this.limiteMensajes;
          this.mensajes = mensajes;
          this.cargandoMensajes = false;
        });

        this.bajarAlUltimoMensaje();
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
      const conversacion = doc(this.firestore, 'conversaciones', conversacionId);
      const mensaje = doc(collection(conversacion, 'mensajes'));
      const lote = writeBatch(this.firestore);

      lote.set(mensaje, {
        emisorId: usuario.uid,
        texto,
        estado: 'pendiente',
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
        this.bajarAlUltimoMensaje();
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

  identificarMensaje(_indice: number, mensaje: MensajeChat): string {
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
      const parametros = await firstValueFrom(this.route.queryParamMap);

      await this.router.navigate(['/home'], {
        queryParams: {
          vista: parametros.get('volver') || 'buscar',
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