import {
  Component, OnInit, OnDestroy, inject, Input, Output, EventEmitter,
  ViewChild, signal, ApplicationRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonModal, IonContent, IonHeader, IonButton, IonIcon
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  help, helpBuoyOutline, closeOutline, chevronForwardOutline, arrowForwardOutline,
  arrowBackOutline, helpCircleOutline, bulbOutline, personOutline, compassOutline,
  documentTextOutline, statsChartOutline, chatbubblesOutline, searchOutline,
  sparklesOutline
} from 'ionicons/icons';

export interface AccionAyuda {
  etiqueta: string;
  ruta: string;
  queryParams?: Record<string, string>;
}

export interface TemaAyuda {
  id: string;
  icono: string;
  pregunta: string;
  parrafos: string[];
  pasos?: string[];
  acciones: AccionAyuda[];
}

export interface MensajeAyuda {
  autor: 'asistente' | 'usuario';
  parrafos: string[];
  pasos?: string[];
}

export const TEMAS_AYUDA: TemaAyuda[] = [
  {
    id: 'como-funciona',
    icono: 'bulb-outline',
    pregunta: '¿Cómo funciona ExpertiMente?',
    parrafos: [
      'En ExpertiMente no tienes que postular a cada oferta de trabajo.',
      'Tú completas tu perfil y eliges las áreas que te interesan. Nosotros analizamos tu currículum y te ubicamos en el ranking de los cargos de esas áreas, donde los reclutadores pueden encontrarte y contactarte.',
      'Estos son los pasos:'
    ],
    pasos: [
      'Completa tu información profesional.',
      'Elige tus áreas de interés.',
      'Agrega tu currículum.',
      'Revisa tu porcentaje en «Mis Cargos de Interés».'
    ],
    acciones: [{ etiqueta: 'Ir a Mi Perfil', ruta: '/perfil-cv' }]
  },
  {
    id: 'completar-perfil',
    icono: 'person-outline',
    pregunta: '¿Cómo completo mi perfil?',
    parrafos: [
      'Tu perfil tiene cuatro partes. En «Mi Perfil» verás una marca verde en las que ya terminaste:'
    ],
    pasos: [
      'Información Profesional: tus estudios, experiencia y habilidades.',
      'Áreas de Interés: los tipos de trabajo que buscas.',
      'Foto de Perfil.',
      'Currículum en PDF.'
    ],
    acciones: [{ etiqueta: 'Ir a Mi Perfil', ruta: '/perfil-cv' }]
  },
  {
    id: 'areas-interes',
    icono: 'compass-outline',
    pregunta: '¿Para qué sirven las áreas de interés?',
    parrafos: [
      'Las áreas son los tipos de trabajo que te gustaría hacer, por ejemplo Gastronomía o Repostería.',
      'Analizamos tu currículum frente a los cargos de las áreas que elijas. Si no eliges ninguna, no podemos calcular tu porcentaje.',
      'Puedes cambiarlas cuando quieras.'
    ],
    acciones: [{ etiqueta: 'Elegir mis áreas', ruta: '/areas-interes', queryParams: { volver: '/home' } }]
  },
  {
    id: 'curriculum',
    icono: 'document-text-outline',
    pregunta: '¿Cómo agrego mi currículum?',
    parrafos: [
      'Entra a «Currículum en PDF», dentro de Mi Perfil. Ahí puedes generar uno con los datos que ya ingresaste o subir el tuyo.',
      'Para generarlo, primero completa tu información profesional. Mientras se prepara puedes seguir usando la app: te avisaremos cuando esté listo.'
    ],
    acciones: [{ etiqueta: 'Ir a mi currículum', ruta: '/cv' }]
  },
  {
    id: 'porcentaje',
    icono: 'stats-chart-outline',
    pregunta: '¿Qué es mi porcentaje de idoneidad?',
    parrafos: [
      'Es un número de 0 a 100 que indica qué tan bien encaja tu currículum con cada cargo. Mientras más alto, mejor posición tienes en el ranking que ven los reclutadores.',
      'Antes necesitas haber elegido tus áreas de interés y tener tu información profesional o tu currículum. Luego:'
    ],
    pasos: [
      'Entra a «Mis Cargos de Interés».',
      'Toca el botón para analizar tu currículum.',
      'Mira tu porcentaje en cada cargo.'
    ],
    acciones: [{ etiqueta: 'Ir a Mis Cargos de Interés', ruta: '/cargos-interes' }]
  },
  {
    id: 'contacto',
    icono: 'chatbubbles-outline',
    pregunta: '¿Cómo me contactan los reclutadores?',
    parrafos: [
      'Si un reclutador se interesa en tu perfil, puede llamarte, escribirte a tu correo o WhatsApp, o enviarte un mensaje dentro de la app.',
      'Tus mensajes están en el ícono de burbujas, arriba a la derecha de esta pantalla. Cuando tengas mensajes nuevos verás un número sobre el ícono.',
      'La decisión final siempre la toma una persona, no la aplicación.'
    ],
    acciones: [{ etiqueta: 'Ir a mis mensajes', ruta: '/mensajes' }]
  },
  {
    id: 'buscar-empleo',
    icono: 'search-outline',
    pregunta: '¿Para qué sirve «Buscar Empleo»?',
    parrafos: [
      'Ahí puedes explorar las ofertas de trabajo disponibles.',
      'Es un camino extra: aunque no busques ofertas, igual puedes aparecer en el ranking de los cargos de tus áreas.'
    ],
    acciones: [{ etiqueta: 'Ir a Buscar Empleo', ruta: '/search' }]
  }
];

@Component({
  selector: 'app-help',
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
  standalone: true,
  imports: [CommonModule, IonModal, IonContent, IonHeader, IonButton, IonIcon]
})
export class Help implements OnInit, OnDestroy {
  @Input() nombre: string = '';
  @Input() mostrarBanner: boolean = true;
  @Output() cerrarBannerDefinitivo = new EventEmitter<void>();

  readonly temas = TEMAS_AYUDA;

  abierto = signal<boolean>(false);
  mensajes = signal<MensajeAyuda[]>([]);
  temaActual = signal<TemaAyuda | null>(null);
  enModoChat = signal<boolean>(false);
  pensando = signal<boolean>(false);
  animandoTexto = signal<boolean>(false);

  @ViewChild(IonModal) private modal?: IonModal;
  @ViewChild(IonContent) private contenido?: IonContent;

  private router = inject(Router);
  private appRef = inject(ApplicationRef);

  private timerPensando: ReturnType<typeof setTimeout> | null = null;
  private intervaloEscritura: ReturnType<typeof setInterval> | null = null;
  private ultimoScrollMs: number = 0;

  private listenerAbrirDesdeMenu = () => {
    this.abrir();
  };

  constructor() {
    addIcons({
      'help': help,
      'help-buoy-outline': helpBuoyOutline,
      'close-outline': closeOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'arrow-forward-outline': arrowForwardOutline,
      'arrow-back-outline': arrowBackOutline,
      'help-circle-outline': helpCircleOutline,
      'bulb-outline': bulbOutline,
      'person-outline': personOutline,
      'compass-outline': compassOutline,
      'document-text-outline': documentTextOutline,
      'stats-chart-outline': statsChartOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'search-outline': searchOutline,
      'sparkles-outline': sparklesOutline
    });
  }

  ngOnInit() {
    window.addEventListener('abrir-asistente-ayuda', this.listenerAbrirDesdeMenu);
  }

  ngOnDestroy() {
    window.removeEventListener('abrir-asistente-ayuda', this.listenerAbrirDesdeMenu);
    this.detenerAnimaciones();
  }

  ocultarParaSiempre(event: Event) {
    event.stopPropagation();
    this.cerrarBannerDefinitivo.emit();
  }

  abrir() {
    this.reiniciarVistaCentrada();
    this.abierto.set(true);
    this.refrescarVista();
  }

  cerrar() {
    void this.modal?.dismiss();
  }

  alCerrarModal() {
    this.detenerAnimaciones();
    this.abierto.set(false);
    this.enModoChat.set(false);
    this.temaActual.set(null);
    this.refrescarVista();
  }

  elegirTema(tema: TemaAyuda) {
    this.detenerAnimaciones();

    const saludoInicial = this.crearMensajeBienvenida();
    this.enModoChat.set(true);
    this.temaActual.set(tema);
    this.pensando.set(true);

    this.mensajes.set([
      saludoInicial,
      { autor: 'usuario', parrafos: [tema.pregunta] }
    ]);
    this.refrescarVista();
    this.desplazarAlFinal();

    this.timerPensando = setTimeout(() => {
      this.timerPensando = null;
      this.pensando.set(false);
      this.iniciarEfectoEscritura(tema);
    }, 650);
  }

  volverAlInicio() {
    this.reiniciarVistaCentrada();
    this.refrescarVista();
    this.desplazarAlInicio();
  }

  completarEscrituraInmediata() {
    const tema = this.temaActual();
    if (!tema || !this.animandoTexto()) return;

    this.detenerAnimaciones();
    const saludoInicial = this.crearMensajeBienvenida();
    this.mensajes.set([
      saludoInicial,
      { autor: 'usuario', parrafos: [tema.pregunta] },
      { autor: 'asistente', parrafos: [...tema.parrafos], pasos: tema.pasos ? [...tema.pasos] : undefined }
    ]);
    this.refrescarVista();
    this.desplazarAlFinal();
  }

  async irA(accion: AccionAyuda) {
    this.detenerAnimaciones();
    await this.modal?.dismiss();
    await this.router.navigate([accion.ruta], { queryParams: accion.queryParams });
  }

  private iniciarEfectoEscritura(tema: TemaAyuda) {
    this.animandoTexto.set(true);

    const saludoInicial = this.crearMensajeBienvenida();
    const preguntaUsuario: MensajeAyuda = { autor: 'usuario', parrafos: [tema.pregunta] };

    const parrafosObjetivo = tema.parrafos || [];
    const pasosObjetivo = tema.pasos || [];

    const parrafosActuales: string[] = [''];
    const pasosActuales: string[] = [];

    let indiceParrafo = 0;
    let indiceCharParrafo = 0;
    let escribiendoPasos = false;
    let indicePaso = 0;
    let indiceCharPaso = 0;
    let ticksEnPausa = 0;

    const VELOCIDAD_CHARS = 1;
    const PAUSA_ENTRE_BLOQUES_TICKS = 8;

    this.mensajes.set([
      saludoInicial,
      preguntaUsuario,
      { autor: 'asistente', parrafos: [...parrafosActuales] }
    ]);
    this.refrescarVista();
    this.desplazarAlFinal();

    this.intervaloEscritura = setInterval(() => {
      if (ticksEnPausa > 0) {
        ticksEnPausa--;
        return;
      }

      if (!escribiendoPasos) {
        const textoObjetivo = parrafosObjetivo[indiceParrafo] || '';
        indiceCharParrafo = Math.min(indiceCharParrafo + VELOCIDAD_CHARS, textoObjetivo.length);
        parrafosActuales[indiceParrafo] = textoObjetivo.slice(0, indiceCharParrafo);

        if (indiceCharParrafo >= textoObjetivo.length) {
          indiceParrafo++;
          indiceCharParrafo = 0;
          ticksEnPausa = PAUSA_ENTRE_BLOQUES_TICKS;

          if (indiceParrafo < parrafosObjetivo.length) {
            parrafosActuales.push('');
          } else if (pasosObjetivo.length > 0) {
            escribiendoPasos = true;
            pasosActuales.push('');
          } else {
            this.finalizarEfectoEscritura();
            return;
          }
        }
      } else {
        const pasoObjetivo = pasosObjetivo[indicePaso] || '';
        indiceCharPaso = Math.min(indiceCharPaso + VELOCIDAD_CHARS, pasoObjetivo.length);
        pasosActuales[indicePaso] = pasoObjetivo.slice(0, indiceCharPaso);

        if (indiceCharPaso >= pasoObjetivo.length) {
          indicePaso++;
          indiceCharPaso = 0;
          ticksEnPausa = PAUSA_ENTRE_BLOQUES_TICKS;

          if (indicePaso < pasosObjetivo.length) {
            pasosActuales.push('');
          } else {
            this.finalizarEfectoEscritura();
            return;
          }
        }
      }

      this.mensajes.set([
        saludoInicial,
        preguntaUsuario,
        {
          autor: 'asistente',
          parrafos: [...parrafosActuales],
          pasos: pasosActuales.length > 0 ? [...pasosActuales] : undefined
        }
      ]);

      this.refrescarVista();
      this.desplazarSuaveDuranteEscritura();
    }, 30);
  }

  private finalizarEfectoEscritura() {
    this.detenerAnimaciones();
    this.refrescarVista();
    this.desplazarAlFinal();
  }

  private reiniciarVistaCentrada() {
    this.detenerAnimaciones();
    this.enModoChat.set(false);
    this.temaActual.set(null);
    this.mensajes.set([this.crearMensajeBienvenida()]);
  }

  private crearMensajeBienvenida(): MensajeAyuda {
    const nombreLimpio = (this.nombre || '').trim();
    return {
      autor: 'asistente',
      parrafos: [
        nombreLimpio ? `¡Hola, ${nombreLimpio}! Soy tu asistente de ayuda.` : '¡Hola! Soy tu asistente de ayuda.',
        'Elige una pregunta y te explico paso a paso cómo funciona ExpertiMente.'
      ]
    };
  }

  private desplazarSuaveDuranteEscritura() {
    const ahora = Date.now();
    if (ahora - this.ultimoScrollMs > 240) {
      this.ultimoScrollMs = ahora;
      void this.contenido?.scrollToBottom(200);
    }
  }

  private desplazarAlFinal() {
    setTimeout(() => {
      void this.contenido?.scrollToBottom(300);
    }, 70);
  }

  private desplazarAlInicio() {
    setTimeout(() => {
      void this.contenido?.scrollToTop(250);
    }, 60);
  }

  private refrescarVista() {
    this.appRef.tick();
  }

  private detenerAnimaciones() {
    if (this.timerPensando) {
      clearTimeout(this.timerPensando);
      this.timerPensando = null;
    }
    if (this.intervaloEscritura) {
      clearInterval(this.intervaloEscritura);
      this.intervaloEscritura = null;
    }
    this.pensando.set(false);
    this.animandoTexto.set(false);
  }
}