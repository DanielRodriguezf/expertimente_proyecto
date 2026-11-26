const fs = require('node:fs');
const path = require('node:path');

const raiz = __dirname;
const cambios = new Map();

function editar(rutaRelativa, transformar) {
  const ruta = path.join(raiz, 'src', 'app', rutaRelativa);

  if (!fs.existsSync(ruta)) {
    throw new Error(`No se encontró src/app/${rutaRelativa}`);
  }

  const original = fs.readFileSync(ruta, 'utf8');
  const usaCRLF = original.includes('\r\n');
  const normalizado = original.replace(/\r\n/g, '\n');

  try {
    const modificado = transformar(normalizado);
    const contenido = usaCRLF
      ? modificado.replace(/\n/g, '\r\n')
      : modificado;

    if (contenido !== original) {
      cambios.set(ruta, contenido);
    }
  } catch (error) {
    throw new Error(`src/app/${rutaRelativa}\n${error.message}`);
  }
}

function reemplazar(texto, anterior, nuevo) {
  if (texto.includes(nuevo)) {
    return texto;
  }

  const inicio = texto.indexOf(anterior);

  if (inicio === -1) {
    throw new Error(
      `No se encontró este fragmento:\n\n${anterior}`
    );
  }

  return (
    texto.slice(0, inicio) +
    nuevo +
    texto.slice(inicio + anterior.length)
  );
}

function agregarAlFinal(texto, bloque) {
  const contenido = bloque.trim();

  if (texto.includes(contenido)) {
    return texto;
  }

  return `${texto.trimEnd()}\n\n${contenido}\n`;
}

function prepararCambios() {
  // 1. Compartir el criterio de estudios y experiencia entre ambas vistas.
  editar('data/niveles-educativos.ts', texto =>
    agregarAlFinal(texto, String.raw`
export function nivelMayorVisible(valor: unknown): string {
  const opciones = Array.isArray(valor) ? valor : [valor];

  const niveles = opciones.flatMap(opcion => {
    const texto: string =
      typeof opcion === 'string'
        ? opcion
        : typeof opcion?.nivelEducativo === 'string'
          ? opcion.nivelEducativo
          : '';

    return texto
      .split(/[,;|\n]+/)
      .map(nivel => nivelEducativoVisible(nivel))
      .filter(Boolean);
  });

  function rangoEducativo(texto: string): number {
    const nivel = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (/postgrado|posgrado|magister|doctorado|postitulo|diplomado/.test(nivel)) {
      return 4;
    }

    if (/universitari|universidad|tecnico nivel superior|instituto profesional|c\.?f\.?t/.test(nivel)) {
      return 3;
    }

    if (/media|liceo|tecnico nivel medio/.test(nivel)) {
      return 2;
    }

    if (/basic/.test(nivel)) {
      return 1;
    }

    return 0;
  }

  const nivelMayor = niveles.reduce(
    (actual, siguiente) =>
      rangoEducativo(siguiente) >= rangoEducativo(actual)
        ? siguiente
        : actual,
    ''
  );

  const rango = rangoEducativo(nivelMayor);

  return rango > 0
    ? NIVELES_EDUCATIVOS[rango - 1].nombre
    : nivelMayor;
}

export function experienciaVisible(cv: {
  sinExperiencia?: boolean;
  anosExperiencia?: unknown;
}): string {
  if (cv.sinExperiencia === true) {
    return 'Sin experiencia declarada';
  }

  const valor = cv.anosExperiencia;

  if (typeof valor !== 'number' && typeof valor !== 'string') {
    return 'No especificado';
  }

  const texto = String(valor).trim();

  if (!texto || Number(texto.replace(',', '.')) < 0) {
    return 'No especificado';
  }

  // Conserva rangos ya escritos, por ejemplo "3 a 5 años".
  if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
    return texto;
  }

  const cantidad = Number(texto.replace(',', '.'));
  return texto + (cantidad === 1 ? ' año' : ' años');
}
`)
  );

  // 2. Exponer los dos formatos en la plantilla del Home.
  editar('pages/home/home.page.ts', texto => {
    texto = reemplazar(
      texto,
      'import { nivelEducativoVisible }',
      'import { nivelMayorVisible, experienciaVisible }'
    );

    return reemplazar(
      texto,
      'readonly nivelEducativoVisible = nivelEducativoVisible;',
      `readonly nivelEducativoVisible = nivelMayorVisible;
  readonly experienciaVisible = experienciaVisible;`
    );
  });

  // 3. Cambiar el nombre del buscador, el botón inferior y la ficha de oferta.
  editar('pages/home/home.page.html', texto => {
    texto = texto.replaceAll('Buscar postulantes', 'Búsqueda por cargo');

    texto = reemplazar(
      texto,
      `type="button"
            (click)="crearOferta()"`,
      `class="crear-primera-oferta"
            type="button"
            (click)="crearOferta()"`
    );

    texto = reemplazar(
      texto,
      `{{ cv.anosExperiencia ?? '0' }} años`,
      `{{ experienciaVisible(cv) }}`
    );

    return reemplazar(
      texto,
      '<div class="candidate-documents">',
      `<div class="candidate-documents">
              <app-perfil-chat-reclutador
                [soloDetalles]="true"
                [postulanteId]="p.postulanteId"
                [nombrePostulante]="p.nombres + ' ' + p.apellidos"
                [nombreEmpresa]="nombreEmpresa"
                [nombreReclutador]="nombreReclutador">
              </app-perfil-chat-reclutador>`
    );
  });

  // 4. Reutilizar la ficha completa de Búsqueda por cargo desde una oferta.
  editar('pages/home/perfil-chat-reclutador.component.ts', texto => {
    texto = reemplazar(
      texto,
      'import { nivelEducativoVisible }',
      'import { nivelMayorVisible, experienciaVisible }'
    );

    texto = reemplazar(
      texto,
      '@Input() pagina = false;',
      `@Input() soloDetalles = false;
  @Input() pagina = false;`
    );

    texto = reemplazar(
      texto,
      '        Ver perfil completo',
      `        {{ soloDetalles ? 'Ver detalles' : 'Ver perfil completo' }}`
    );

    texto = reemplazar(
      texto,
      `type="button"
        (click)="abrirChat()"`,
      `*ngIf="!soloDetalles"
        type="button"
        (click)="abrirChat()"`
    );

    texto = reemplazar(
      texto,
      'nivelEducativoVisible(cv.nivelEducativo)',
      `nivelMayorVisible(cv.nivelEducativo ?? data['nivelEducativo'])`
    );

    return reemplazar(
      texto,
      `{ etiqueta: 'Archivo de CV'`,
      `{ etiqueta: 'Años de experiencia', valor: experienciaVisible(cv) },
        { etiqueta: 'Archivo de CV'`
    );
  });

  // 5. Ajustar únicamente el botón inferior del estado sin ofertas.
  editar('pages/home/home.page.scss', texto =>
    agregarAlFinal(texto, `
.main-content .empty-state ion-button.crear-primera-oferta {
  --background: #376b20;
  --background-hover: #2b541a;
  --color: #ffffff;
  --border-radius: 12px;
  --padding-start: 18px;
  --padding-end: 18px;
  --box-shadow: none;

  min-height: 44px;
  text-transform: none;
  font-weight: 700;
}

.main-content .empty-state ion-button.crear-primera-oferta ion-icon {
  margin: 0 8px 0 0;
  font-size: 20px;
  color: currentColor;
}
`)
  );

  // 6. Mantener legibles los campos de Crear oferta en modo oscuro.
  editar('pages/crear-oferta/crear-oferta.page.scss', texto =>
    agregarAlFinal(texto, `
@media (prefers-color-scheme: dark) {
  :host ion-input,
  :host ion-textarea,
  :host ion-select {
    color-scheme: light;
    --background: #f3f1e6;
    --color: #203119;
    --placeholder-color: #47583e;
    --placeholder-opacity: 1;

    color: #203119;
    font-weight: 700;
  }

  :host ion-select::part(text),
  :host ion-select::part(placeholder) {
    font-weight: 700;
  }
}
`)
  );
}

try {
  prepararCambios();

  for (const [ruta, contenido] of cambios) {
    fs.writeFileSync(ruta, contenido, 'utf8');
    console.log(`Actualizado: ${path.relative(raiz, ruta)}`);
  }

  console.log(
    cambios.size === 0
      ? 'Los cambios ya estaban aplicados.'
      : `Portal actualizado. Archivos modificados: ${cambios.size}.`
  );
} catch (error) {
  console.error(`No se pudo completar la actualización.\n${error.message}`);
  process.exitCode = 1;
}