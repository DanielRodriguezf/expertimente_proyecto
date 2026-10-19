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

import {
  IonButton,
  IonSpinner
} from '@ionic/angular';

import { Auth } from '@angular/fire/auth';

import {
  Firestore,
  collection,
  doc,
  query,
  where,
  getDocsFromServer,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from '@angular/fire/firestore';

import {
  PerfilChatReclutadorComponent
} from './perfil-chat-reclutador.component';

interface ResultadoCuestionario {
  documentoId: string;
  postulanteId: string;
  cargoId: string;
  estado: string;
  puntajeObtenido: unknown;
  puntajeMaximo: unknown;
  fechaRespuesta: unknown;
}

interface Candidato {
  documentoId: string;
  postulanteId: string;
  nombre: string;
  correo: string;
  fotoPerfil: string;
  obtenido: number;
  maximo: number;
  porcentaje: number;
  posicion: number;
}

interface PerfilPostulante {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  correo?: string;
  fotoPerfil?: string;
}

interface Grupo {
  cargoId: string;
  nombre: string;
  candidatos: Candidato[];
  resultados: ResultadoCuestionario[];
  seleccionados: Set<string>;
  perfiles: Map<string, PerfilPostulante>;
  resultadosListos: boolean;
  seleccionesListas: boolean;
  procesandoResultados: boolean;
  revision: number;
  error: string;
  advertencia: string;
}

@Component({
  selector: 'app-ranking-cargo',
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonSpinner,
    PerfilChatReclutadorComponent
  ],
  template: `
    <section class="ranking">
      <header class="encabezado">
        <div class="encabezado-texto">
          <span class="etiqueta">
            EVALUACIÓN POR CARGO
          </span>

          <h2>Ranking general</h2>

          <p>
            Postulantes evaluados para los cargos que coinciden
            con tu búsqueda. Las posiciones se actualizan
            automáticamente.
          </p>
        </div>

        <ion-button
          class="actualizar-btn"
          fill="outline"
          size="small"
          [disabled]="cargando || procesando !== ''"
          (click)="cargarRanking()">
          Actualizar
        </ion-button>
      </header>

      <div
        class="estado"
        *ngIf="cargando"
        role="status">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Cargando ranking…</p>
      </div>

      <div
        class="mensaje mensaje-error"
        role="alert"
        *ngIf="error">
        {{ error }}
      </div>

      <div
        class="mensaje mensaje-exito"
        role="status"
        *ngIf="mensaje">
        {{ mensaje }}
      </div>

      <div
        class="estado"
        *ngIf="
          !cargando &&
          !error &&
          grupos.length === 0
        ">
        <h3>No encontramos cargos coincidentes</h3>
        <p>
          Intenta buscar con otro nombre de cargo.
        </p>
      </div>

      <article
        class="grupo"
        *ngFor="let grupo of grupos; trackBy: identificarGrupo">

        <div class="titulo-grupo">
          <div class="titulo-cargo">
            <span class="subetiqueta">
              RANKING POR CARGO
            </span>

            <h3>{{ grupo.nombre }}</h3>

            <small class="cargo-id">
              {{ grupo.cargoId }}
            </small>
          </div>

          <span
            class="cantidad"
            *ngIf="
              grupo.resultadosListos &&
              grupo.seleccionesListas &&
              !grupo.procesandoResultados &&
              !grupo.error
            ">
            {{ grupo.candidatos.length }}
            {{
              grupo.candidatos.length === 1
                ? 'disponible'
                : 'disponibles'
            }}
          </span>
        </div>

        <div
          class="mensaje mensaje-error"
          role="alert"
          *ngIf="grupo.error">
          {{ grupo.error }}
        </div>

        <div
          class="mensaje mensaje-advertencia"
          role="status"
          *ngIf="grupo.advertencia">
          {{ grupo.advertencia }}
        </div>

        <div
          class="estado"
          role="status"
          *ngIf="
            !grupo.error &&
            (
              !grupo.resultadosListos ||
              !grupo.seleccionesListas ||
              grupo.procesandoResultados
            )
          ">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Actualizando candidatos…</p>
        </div>

        <ng-container
          *ngIf="
            !grupo.error &&
            grupo.resultadosListos &&
            grupo.seleccionesListas &&
            !grupo.procesandoResultados
          ">

          <div
            class="estado"
            *ngIf="grupo.candidatos.length === 0">
            <h4>No hay candidatos disponibles</h4>

            <p>
              No existen evaluaciones válidas disponibles
              para este cargo o sus candidatos ya fueron
              seleccionados.
            </p>
          </div>

          <div
            class="candidato"
            [class.primer-lugar]="candidato.posicion === 1"
            *ngFor="
              let candidato of grupo.candidatos;
              trackBy: identificarCandidato
            ">

            <div class="fila-principal">
              <span
                class="posicion"
                [class.posicion-primera]="candidato.posicion === 1"
                [class.posicion-segunda]="candidato.posicion === 2"
                [class.posicion-tercera]="candidato.posicion === 3"
                [attr.aria-label]="
                  'Posición ' + candidato.posicion
                ">
                #{{ candidato.posicion }}
              </span>

              <ng-container
                *ngIf="candidato.fotoPerfil; else sinFoto">
                <img
                  class="foto-postulante"
                  [src]="candidato.fotoPerfil"
                  [alt]="'Foto de ' + candidato.nombre"
                  loading="lazy"
                  (error)="ocultarFoto(candidato)">
              </ng-container>

              <ng-template #sinFoto>
                <span
                  class="foto-postulante foto-inicial"
                  aria-hidden="true">
                  {{ obtenerInicial(candidato.nombre) }}
                </span>
              </ng-template>

              <div class="datos">
                <h4>{{ candidato.nombre }}</h4>

                <p *ngIf="candidato.correo">
                  {{ candidato.correo }}
                </p>
              </div>

              <div class="puntaje">
                <strong>
                  {{ candidato.porcentaje | number:'1.0-0' }} %
                </strong>

                <small>
                  {{ candidato.obtenido }} /
                  {{ candidato.maximo }} puntos
                </small>
              </div>
            </div>

            <div
              class="barra"
              role="progressbar"
              aria-label="Resultado del cuestionario"
              [attr.aria-valuenow]="candidato.porcentaje"
              aria-valuemin="0"
              aria-valuemax="100">
              <span
                [style.width.%]="candidato.porcentaje">
              </span>
            </div>

            <div class="acciones">
              <app-perfil-chat-reclutador
                [postulanteId]="candidato.postulanteId"
                [nombreReclutador]="nombreReclutador"
                [nombreEmpresa]="nombreEmpresa">
              </app-perfil-chat-reclutador>

              <ion-button
                class="aceptar-btn"
                size="small"
                [disabled]="procesando !== ''"
                (click)="aceptar(grupo, candidato)">

                <ion-spinner
                  *ngIf="
                    procesando ===
                    claveSeleccion(
                      grupo.cargoId,
                      candidato.postulanteId
                    )
                  "
                  name="crescent">
                </ion-spinner>

                {{
                  procesando ===
                  claveSeleccion(
                    grupo.cargoId,
                    candidato.postulanteId
                  )
                    ? 'Guardando…'
                    : 'Aceptar postulante'
                }}
              </ion-button>
            </div>
          </div>
        </ng-container>
      </article>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .ranking {
      padding: 1.4rem;
      margin-bottom: 1.5rem;
      background: #ffffff;
      border: 1px solid #dce5d8;
      border-radius: 18px;
      color: #24371e;
      box-shadow: 0 5px 18px rgba(39, 64, 25, 0.04);
    }

    .encabezado {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .encabezado-texto {
      flex: 1;
      min-width: 0;
    }

    .etiqueta,
    .subetiqueta {
      display: block;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 1px;
      color: #537a3c;
    }

    .encabezado h2 {
      margin: 0.4rem 0;
      font-size: 1.45rem;
      font-weight: 800;
      color: #263c1d;
    }

    .encabezado p {
      max-width: 650px;
      margin: 0.4rem 0 0;
      color: #61725a;
      font-size: 0.85rem;
      line-height: 1.6;
    }

    .actualizar-btn {
      --color: #527c35;
      --border-color: #a7bd97;
      --border-radius: 9px;
      font-weight: 700;
      text-transform: none;
      letter-spacing: 0;
    }

    .grupo {
      margin-top: 1.4rem;
      padding-top: 1.3rem;
      border-top: 1px solid #e4eadf;
    }

    .titulo-grupo {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .titulo-cargo {
      min-width: 0;
    }

    .titulo-cargo h3 {
      margin: 0.35rem 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #2d4722;
    }

    .cargo-id {
      display: block;
      color: #72806b;
      font-size: 0.68rem;
      overflow-wrap: anywhere;
    }

    .cantidad {
      padding: 0.45rem 0.7rem;
      border-radius: 8px;
      background: #edf4e7;
      color: #52743d;
      font-size: 0.75rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .candidato {
      margin-top: 1rem;
      padding: 1rem;
      border: 1px solid #e0e8dc;
      border-radius: 13px;
      background: #ffffff;
    }

    .primer-lugar {
      border-color: #b7cc9d;
      background: #fcfef9;
    }

    .fila-principal {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .posicion {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 42px;
      height: 42px;
      padding: 0 0.4rem;
      border-radius: 10px;
      background: #edf1e9;
      color: #5b7150;
      font-size: 0.95rem;
      font-weight: 800;
      flex-shrink: 0;
    }

    .posicion-primera {
      background: #fff0bb;
      color: #8b6515;
    }

    .posicion-segunda {
      background: #e9edf2;
      color: #59697b;
    }

    .posicion-tercera {
      background: #f3e3d5;
      color: #92633e;
    }

    .foto-postulante {
      display: block;
      width: 56px;
      height: 56px;
      flex: 0 0 56px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center;
      border: 2px solid #dce8d3;
      background: #edf3e7;
    }

    .foto-inicial {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #527c35;
      font-size: 1.3rem;
      font-weight: 800;
    }

    .datos {
      flex: 1;
      min-width: 0;
    }

    .datos h4 {
      margin: 0;
      color: #2c4023;
      font-size: 0.95rem;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .datos p {
      margin: 0.35rem 0 0;
      color: #6a7763;
      font-size: 0.8rem;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .puntaje {
      flex-shrink: 0;
      text-align: right;
    }

    .puntaje strong {
      display: block;
      color: #47732c;
      font-size: 1.3rem;
      font-weight: 800;
    }

    .puntaje small {
      display: block;
      margin-top: 0.25rem;
      color: #6a7763;
      font-size: 0.75rem;
    }

    .barra {
      height: 7px;
      margin: 1rem 0;
      overflow: hidden;
      border-radius: 8px;
      background: #edf1ea;
    }

    .barra span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #6b963e;
      transition: width 0.2s ease;
    }

    .acciones {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .aceptar-btn {
      --background: #527c35;
      --background-hover: #42672a;
      --background-activated: #3d6027;
      --color: #ffffff;
      --border-radius: 9px;
      --box-shadow: none;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: none;
      letter-spacing: 0;
    }

    .aceptar-btn ion-spinner {
      width: 16px;
      height: 16px;
      margin-right: 0.45rem;
    }

    .estado {
      padding: 1.5rem 0.5rem;
      text-align: center;
      color: #68755f;
    }

    .estado ion-spinner {
      color: #638c45;
    }

    .estado h3,
    .estado h4 {
      margin: 0 0 0.5rem;
      color: #42563a;
      font-size: 0.95rem;
      font-weight: 800;
    }

    .estado p {
      margin: 0.5rem 0 0;
      font-size: 0.85rem;
      line-height: 1.6;
    }

    .mensaje {
      padding: 0.85rem 1rem;
      margin-top: 1rem;
      border-radius: 10px;
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .mensaje-error {
      color: #a52c2c;
      background: #fff1f1;
      border: 1px solid #f1cece;
    }

    .mensaje-exito {
      color: #356524;
      background: #eef7e9;
      border: 1px solid #d4e7c9;
    }

    .mensaje-advertencia {
      color: #7c641d;
      background: #fff9e7;
      border: 1px solid #eee0af;
    }

    @media (max-width: 600px) {
      .ranking {
        padding: 1rem;
      }

      .fila-principal {
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      .posicion {
        min-width: 35px;
        height: 35px;
        font-size: 0.8rem;
      }

      .foto-postulante {
        width: 48px;
        height: 48px;
        flex-basis: 48px;
      }

      .datos {
        flex-basis: calc(100% - 110px);
      }

      .puntaje {
        width: 100%;
        text-align: left;
        padding-top: 0.35rem;
      }

      .puntaje strong,
      .puntaje small {
        display: inline-block;
        margin: 0;
      }

      .puntaje small {
        margin-left: 0.6rem;
      }

      .acciones {
        align-items: stretch;
      }
    }
  `]
})
export class RankingCargoComponent implements OnChanges, OnDestroy {
  @Input() cargo = '';
  @Input() nombreReclutador = '';
  @Input() nombreEmpresa = '';

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  private escuchas: Array<() => void> = [];
  private version = 0;
  private destruido = false;

  grupos: Grupo[] = [];

  cargando = false;
  procesando = '';
  error = '';
  mensaje = '';

  ngOnChanges(): void {
    void this.cargarRanking();
  }

  identificarGrupo(
    _indice: number,
    grupo: Grupo
  ): string {
    return grupo.cargoId;
  }

  identificarCandidato(
    _indice: number,
    candidato: Candidato
  ): string {
    return candidato.postulanteId;
  }

  claveSeleccion(
    cargoId: string,
    postulanteId: string
  ): string {
    return `${cargoId}_${postulanteId}`;
  }

  obtenerInicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase() || '?';
  }

  ocultarFoto(candidato: Candidato): void {
    this.actualizar(() => {
      candidato.fotoPerfil = '';
    });
  }

  private actualizar(accion: () => void): void {
    if (this.destruido) {
      return;
    }

    this.zone.run(() => {
      accion();
      this.cdr.markForCheck();
    });
  }

  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private detenerEscuchas(): void {
    for (const cancelar of this.escuchas) {
      cancelar();
    }

    this.escuchas = [];
  }

  private fecha(valor: unknown): number {
    if (
      valor &&
      typeof valor === 'object' &&
      'toMillis' in valor &&
      typeof valor.toMillis === 'function'
    ) {
      const milisegundos = valor.toMillis();

      return typeof milisegundos === 'number' &&
        Number.isFinite(milisegundos)
          ? milisegundos
          : 0;
    }

    if (valor instanceof Date) {
      const milisegundos = valor.getTime();

      return Number.isFinite(milisegundos)
        ? milisegundos
        : 0;
    }

    return 0;
  }

  private puntajeValido(
    obtenido: unknown,
    maximo: unknown
  ): boolean {
    return (
      typeof obtenido === 'number' &&
      typeof maximo === 'number' &&
      Number.isFinite(obtenido) &&
      Number.isFinite(maximo) &&
      maximo > 0 &&
      obtenido >= 0 &&
      obtenido <= maximo
    );
  }

  async cargarRanking(): Promise<void> {
    const version = ++this.version;

    this.detenerEscuchas();

    this.actualizar(() => {
      this.grupos = [];
      this.error = '';
      this.mensaje = '';
      this.cargando = true;
    });

    try {
      const texto = this.normalizar(this.cargo);

      if (!texto) {
        return;
      }

      const snapshot = await getDocsFromServer(
        collection(this.firestore, 'cargos')
      );

      if (
        version !== this.version ||
        this.destruido
      ) {
        return;
      }

      const grupos: Grupo[] = snapshot.docs
        .map((documento): Grupo => ({
          cargoId: documento.id,
          nombre: String(
            documento.data()['nombre'] ?? ''
          ).trim(),
          candidatos: [],
          resultados: [],
          seleccionados: new Set<string>(),
          perfiles: new Map<string, PerfilPostulante>(),
          resultadosListos: false,
          seleccionesListas: false,
          procesandoResultados: false,
          revision: 0,
          error: '',
          advertencia: ''
        }))
        .filter(grupo =>
          this.normalizar(grupo.nombre).includes(texto)
        )
        .sort((a, b) =>
          a.nombre.localeCompare(
            b.nombre,
            'es',
            { sensitivity: 'base' }
          )
        );

      this.actualizar(() => {
        this.grupos = grupos;
      });

      for (const grupo of grupos) {
        const consultaResultados = query(
          collection(
            this.firestore,
            'postulaciones-terna'
          ),
          where('cargoId', '==', grupo.cargoId)
        );

        const fallo = (error: unknown): void => {
          if (
            this.destruido ||
            version !== this.version
          ) {
            return;
          }

          console.error(
            'Error al escuchar el ranking:',
            error
          );

          grupo.revision++;

          this.actualizar(() => {
            grupo.error =
              'No se pudo actualizar este ranking. ' +
              'Revisa la conexión y los permisos.';

            grupo.procesandoResultados = false;
            grupo.candidatos = [];
          });
        };

        const cancelarResultados = onSnapshot(
          consultaResultados,
          resultado => {
            if (
              this.destruido ||
              version !== this.version
            ) {
              return;
            }

            grupo.resultados = resultado.docs.map(
              (documento): ResultadoCuestionario => {
                const datos = documento.data();

                return {
                  documentoId: documento.id,
                  postulanteId: String(
                    datos['postulanteId'] ?? ''
                  ).trim(),
                  cargoId: String(
                    datos['cargoId'] ?? ''
                  ),
                  estado: String(
                    datos['estado'] ?? ''
                  ),
                  puntajeObtenido:
                    datos['puntajeObtenido'],
                  puntajeMaximo:
                    datos['puntajeMaximo'],
                  fechaRespuesta:
                    datos['fechaRespuesta']
                };
              }
            );

            grupo.resultadosListos = true;

            void this.reconstruir(grupo, version);
          },
          fallo
        );

        this.escuchas.push(cancelarResultados);

        const consultaSelecciones = query(
          collection(
            this.firestore,
            'selecciones-cargo'
          ),
          where('cargoId', '==', grupo.cargoId)
        );

        const cancelarSelecciones = onSnapshot(
          consultaSelecciones,
          resultado => {
            if (
              this.destruido ||
              version !== this.version
            ) {
              return;
            }

            grupo.seleccionados = new Set(
              resultado.docs
                .filter(documento =>
                  this.normalizar(
                    documento.data()['estado']
                  ) === 'aceptado'
                )
                .map(documento =>
                  String(
                    documento.data()['postulanteId'] ?? ''
                  ).trim()
                )
                .filter(uid => uid !== '')
            );

            grupo.seleccionesListas = true;

            void this.reconstruir(grupo, version);
          },
          fallo
        );

        this.escuchas.push(cancelarSelecciones);
      }
    } catch (error) {
      console.error(
        'Error al cargar los cargos:',
        error
      );

      if (version === this.version) {
        this.actualizar(() => {
          this.error =
            'No fue posible cargar los cargos. ' +
            'Revisa tu conexión y vuelve a intentarlo.';
        });
      }
    } finally {
      if (version === this.version) {
        this.actualizar(() => {
          this.cargando = false;
        });
      }
    }
  }

  private async reconstruir(
    grupo: Grupo,
    version: number
  ): Promise<void> {
    const revision = ++grupo.revision;

    if (
      !grupo.resultadosListos ||
      !grupo.seleccionesListas ||
      grupo.error
    ) {
      return;
    }

    const vigente = (): boolean =>
      !this.destruido &&
      version === this.version &&
      revision === grupo.revision;

    this.actualizar(() => {
      grupo.procesandoResultados = true;
      grupo.advertencia = '';
    });

    try {
      const ultimos = new Map<
        string,
        ResultadoCuestionario
      >();

      const aceptados = new Set(
        grupo.seleccionados
      );

      for (const resultado of grupo.resultados) {
        const uid = resultado.postulanteId;

        if (!uid) {
          continue;
        }

        if (
          this.normalizar(resultado.estado) === 'aceptado'
        ) {
          aceptados.add(uid);
        }

        const anterior = ultimos.get(uid);

        if (
          !anterior ||
          this.fecha(resultado.fechaRespuesta) >
            this.fecha(anterior.fechaRespuesta) ||
          (
            this.fecha(resultado.fechaRespuesta) ===
              this.fecha(anterior.fechaRespuesta) &&
            resultado.documentoId > anterior.documentoId
          )
        ) {
          ultimos.set(uid, resultado);
        }
      }

      const disponibles = [...ultimos.entries()]
        .filter(([uid, resultado]) =>
          !aceptados.has(uid) &&
          this.puntajeValido(
            resultado.puntajeObtenido,
            resultado.puntajeMaximo
          )
        );

      let perfilesIncompletos = false;

      const candidatos = await Promise.all(
        disponibles.map(
          async ([uid, resultado]): Promise<Candidato | null> => {
            try {
              let perfil = grupo.perfiles.get(uid);

              if (!perfil) {
                const snapshot = await getDocFromServer(
                  doc(
                    this.firestore,
                    'postulantes',
                    uid
                  )
                );

                if (!snapshot.exists()) {
                  perfilesIncompletos = true;
                  return null;
                }

                perfil =
                  snapshot.data() as PerfilPostulante;

                grupo.perfiles.set(uid, perfil);
              }

              const nombre = [
                perfil.nombre,
                perfil.apellidoPaterno,
                perfil.apellidoMaterno
              ]
                .filter(Boolean)
                .join(' ')
                .trim();

              const obtenido =
                resultado.puntajeObtenido as number;

              const maximo =
                resultado.puntajeMaximo as number;

              return {
                documentoId: resultado.documentoId,
                postulanteId: uid,
                nombre: nombre || 'Postulante',
                correo: String(
                  perfil.correo ?? ''
                ),
                fotoPerfil: String(
                  perfil.fotoPerfil ?? ''
                ),
                obtenido,
                maximo,
                porcentaje: obtenido / maximo * 100,
                posicion: 0
              };
            } catch (error) {
              console.error(
                'No se pudo consultar el perfil:',
                uid,
                error
              );

              perfilesIncompletos = true;

              return null;
            }
          }
        )
      );

      if (!vigente()) {
        return;
      }

      const ordenados = candidatos
        .filter(
          (candidato): candidato is Candidato =>
            candidato !== null
        )
        .sort((a, b) =>
          b.porcentaje - a.porcentaje ||
          a.nombre.localeCompare(
            b.nombre,
            'es',
            { sensitivity: 'base' }
          ) ||
          a.postulanteId.localeCompare(b.postulanteId)
        );

      ordenados.forEach((candidato, indice) => {
        const anterior = ordenados[indice - 1];

        candidato.posicion =
          anterior &&
          candidato.porcentaje === anterior.porcentaje
            ? anterior.posicion
            : indice + 1;
      });

      this.actualizar(() => {
        grupo.candidatos = ordenados;

        grupo.advertencia = perfilesIncompletos
          ? 'El ranking está incompleto porque no se ' +
            'pudieron consultar algunos perfiles.'
          : '';
      });
    } catch (error) {
      console.error(
        'Error al reconstruir el ranking:',
        error
      );

      if (vigente()) {
        this.actualizar(() => {
          grupo.candidatos = [];

          grupo.error =
            'No fue posible reconstruir el ranking.';
        });
      }
    } finally {
      if (vigente()) {
        this.actualizar(() => {
          grupo.procesandoResultados = false;
        });
      }
    }
  }

  async aceptar(
    grupo: Grupo,
    candidato: Candidato
  ): Promise<void> {
    if (this.procesando) {
      return;
    }

    const usuario = this.auth.currentUser;

    if (!usuario) {
      this.actualizar(() => {
        this.error =
          'Debes iniciar sesión como reclutador.';
      });

      return;
    }

    const confirmado = window.confirm(
      `¿Aceptar a ${candidato.nombre} para ` +
      `el cargo "${grupo.nombre}"?\n\n` +
      'Dejará de aparecer en el ranking de este cargo ' +
      'para todos los reclutadores y se registrará ' +
      'una notificación para el postulante.'
    );

    if (!confirmado) {
      return;
    }

    const clave = this.claveSeleccion(
      grupo.cargoId,
      candidato.postulanteId
    );

    this.actualizar(() => {
      this.procesando = clave;
      this.error = '';
      this.mensaje = '';
    });

    try {
      const resultadoRef = doc(
        this.firestore,
        'postulaciones-terna',
        candidato.documentoId
      );

      const seleccionRef = doc(
        this.firestore,
        'selecciones-cargo',
        clave
      );

      const notificacionRef = doc(
        this.firestore,
        'notificaciones',
        `seleccion_${clave}`
      );

      await runTransaction(
        this.firestore,
        async transaccion => {
          const reclutador = await transaccion.get(
            doc(
              this.firestore,
              'reclutadores',
              usuario.uid
            )
          );

          const resultado = await transaccion.get(
            resultadoRef
          );

          const seleccion = await transaccion.get(
            seleccionRef
          );

          if (
            !reclutador.exists() ||
            this.normalizar(
              reclutador.data()['estado']
            ) !== 'aprobado'
          ) {
            throw new Error(
              'Tu cuenta debe estar aprobada como reclutador.'
            );
          }

          if (!resultado.exists()) {
            throw new Error(
              'La evaluación del postulante ya no existe.'
            );
          }

          const datos = resultado.data();

          if (
            datos['cargoId'] !== grupo.cargoId ||
            datos['postulanteId'] !== candidato.postulanteId
          ) {
            throw new Error(
              'La evaluación no corresponde al cargo ' +
              'o al postulante seleccionado.'
            );
          }

          if (
            !this.puntajeValido(
              datos['puntajeObtenido'],
              datos['puntajeMaximo']
            )
          ) {
            throw new Error(
              'La evaluación no contiene un puntaje válido.'
            );
          }

          if (
            seleccion.exists() ||
            this.normalizar(datos['estado']) === 'aceptado'
          ) {
            throw new Error(
              'Este postulante ya fue seleccionado ' +
              'para este cargo.'
            );
          }

          transaccion.update(resultadoRef, {
            estado: 'Aceptado',
            fechaAceptacion: serverTimestamp(),
            aceptadoPor: usuario.uid
          });

          transaccion.set(seleccionRef, {
            cargoId: grupo.cargoId,
            nombreCargo: grupo.nombre,
            postulanteId: candidato.postulanteId,
            resultadoId: candidato.documentoId,
            reclutadorId: usuario.uid,
            nombreReclutador: this.nombreReclutador,
            nombreEmpresa: this.nombreEmpresa,
            estado: 'Aceptado',
            fecha: serverTimestamp()
          });

          const empresaTexto = this.nombreEmpresa
            ? ` por ${this.nombreEmpresa}`
            : '';

          transaccion.set(notificacionRef, {
            postulanteId: candidato.postulanteId,
            cargoId: grupo.cargoId,
            nombreCargo: grupo.nombre,
            reclutadorId: usuario.uid,
            nombreEmpresa: this.nombreEmpresa,
            resultadoId: candidato.documentoId,
            mensaje:
              `Has sido seleccionado para el cargo ` +
              `"${grupo.nombre}"${empresaTexto}. ` +
              'El reclutador podrá contactarte ' +
              'dentro de la aplicación.',
            fecha: serverTimestamp(),
            leido: false,
            tipo: 'seleccionado'
          });
        }
      );

      this.actualizar(() => {
        this.mensaje =
          `${candidato.nombre} fue seleccionado. ` +
          'La notificación quedó registrada.';
      });
    } catch (error) {
      console.error(
        'Error al aceptar al postulante:',
        error
      );

      this.actualizar(() => {
        this.error = error instanceof Error
          ? error.message
          : 'No se pudo guardar la selección.';
      });
    } finally {
      this.actualizar(() => {
        this.procesando = '';
      });
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.version++;

    this.detenerEscuchas();
  }
}