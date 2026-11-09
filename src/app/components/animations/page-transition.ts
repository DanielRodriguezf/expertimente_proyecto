import { createAnimation } from '@ionic/angular';

interface OpcionesTransicion {
  enteringEl: HTMLElement;
  leavingEl?: HTMLElement;
  direction?: 'forward' | 'back';
}

// ─── Ajustes: aquí puedes afinar el look ─────────────────────────────
const DURACION_PAGINA = 450;
const EASING_PAGINA = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SOMBRA_PAGINA = '-12px 0 32px rgba(31, 45, 24, 0.25)';

const DURACION_CONTENIDO = 380;
const EASING_CONTENIDO = 'cubic-bezier(0.22, 1, 0.36, 1)';
const RETRASO_INICIAL = 100; // ms antes de que empiece el primer bloque (al avanzar)
const ESCALON = 40;          // ms entre un bloque y el siguiente
const MAX_BLOQUES = 6;       // máximo de bloques animados (para no alargar la transición)

const ETIQUETAS_IGNORADAS = new Set([
  'ION-REFRESHER', 'ION-FAB', 'ION-INFINITE-SCROLL',
  'ION-LOADING', 'ION-TOAST', 'ION-ALERT', 'ION-MODAL',
  'ION-ACTION-SHEET', 'ION-POPOVER', 'SCRIPT', 'STYLE'
]);

function movimientoReducido(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Mismo criterio que usa Ionic internamente para encontrar el elemento .ion-page
function obtenerPagina(el: HTMLElement): HTMLElement {
  if (el.classList.contains('ion-page')) return el;
  const pagina = el.querySelector(':scope > .ion-page, :scope > ion-nav, :scope > ion-tabs');
  return (pagina as HTMLElement) ?? el;
}

// Deja solo los elementos que realmente conviene animar
function filtrarBloques(elementos: Element[]): HTMLElement[] {
  return (elementos as HTMLElement[]).filter((el) => {
    if (ETIQUETAS_IGNORADAS.has(el.tagName) || el.hasAttribute('slot')) return false;
    if (getComputedStyle(el).display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  });
}

// Obtiene los bloques del contenido (hijos directos de ion-content, en el DOM normal).
// Si todo está envuelto en un único contenedor, baja un nivel para cascadear lo de adentro.
function obtenerBloques(pagina: HTMLElement): HTMLElement[] {
  const contenido = pagina.querySelector('ion-content');
  if (!contenido) return [];

  let bloques = filtrarBloques(Array.from(contenido.children));
  for (let i = 0; i < 2 && bloques.length === 1 && bloques[0].children.length > 1; i++) {
    bloques = filtrarBloques(Array.from(bloques[0].children));
  }
  return bloques.slice(0, MAX_BLOQUES);
}

/**
 * Transición global entre páginas de ExpertiMente.
 */
export const transicionPagina = (_: HTMLElement, opts: OpcionesTransicion) => {
  const esAtras = opts.direction === 'back';
  const paginaEntrante = obtenerPagina(opts.enteringEl);
  const paginaSaliente = opts.leavingEl ? obtenerPagina(opts.leavingEl) : undefined;

  const raiz = createAnimation()
    .duration(DURACION_PAGINA)
    .easing(EASING_PAGINA);

  // ── Accesibilidad: si el usuario desactivó animaciones, solo un fundido corto ──
  if (movimientoReducido()) {
    raiz.addAnimation(
      createAnimation()
        .addElement(paginaEntrante)
        .beforeRemoveClass('ion-page-invisible')
        .duration(150)
        .fromTo('opacity', '0', '1')
    );
    if (paginaSaliente) {
      raiz.addAnimation(
        createAnimation()
          .addElement(paginaSaliente)
          .duration(150)
          .fromTo('opacity', '1', '0')
      );
    }
    return raiz;
  }

  // ── Página que entra ──
  const entrada = createAnimation()
    .addElement(paginaEntrante)
    .beforeRemoveClass('ion-page-invisible')
    .duration(DURACION_PAGINA)
    .easing(EASING_PAGINA);

  if (esAtras) {
    // Al volver, esta página queda DEBAJO: aparece desde la izquierda (parallax)
    entrada
      .fromTo('transform', 'translateX(-25%)', 'translateX(0)')
      .fromTo('opacity', '0.5', '1');
  } else {
    // Al avanzar, esta página queda ENCIMA: entra completa desde la derecha con sombra
    entrada
      .beforeStyles({ 'box-shadow': SOMBRA_PAGINA })
      .afterClearStyles(['box-shadow'])
      .fromTo('transform', 'translateX(100%)', 'translateX(0)');
  }
  raiz.addAnimation(entrada);

  // ── Página que sale ──
  if (paginaSaliente) {
    const salida = createAnimation()
      .addElement(paginaSaliente)
      .duration(DURACION_PAGINA)
      .easing(EASING_PAGINA);

    if (esAtras) {
      // Al volver, esta página está ENCIMA: se va hacia la derecha con sombra
      salida
        .beforeStyles({ 'box-shadow': SOMBRA_PAGINA })
        .afterClearStyles(['box-shadow'])
        .fromTo('transform', 'translateX(0)', 'translateX(100%)');
    } else {
      // Al avanzar, queda DEBAJO: retrocede un poco y se atenúa
      salida
        .fromTo('transform', 'translateX(0)', 'translateX(-25%)')
        .fromTo('opacity', '1', '0.5');
    }
    raiz.addAnimation(salida);
  }

  // ── Contenido de la página que entra, en cascada ──
  const retrasoInicial = esAtras ? 0 : RETRASO_INICIAL;
  const desplazamientoY = esAtras ? 12 : 26;

  obtenerBloques(paginaEntrante).forEach((bloque, i) => {
    raiz.addAnimation(
      createAnimation()
        .addElement(bloque)
        .fill('both')
        .duration(DURACION_CONTENIDO)
        .delay(retrasoInicial + i * ESCALON)
        .easing(EASING_CONTENIDO)
        .keyframes([
          { offset: 0, opacity: '0', transform: `translateY(${desplazamientoY}px)` },
          { offset: 1, opacity: '1', transform: 'translateY(0)' }
        ])
    );
  });

  return raiz;
};