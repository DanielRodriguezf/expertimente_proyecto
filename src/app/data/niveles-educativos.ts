export const NIVELES_EDUCATIVOS = [
  { nombre: 'Enseñanza básica', detalle: '1° a 8° básico' },
  { nombre: 'Educación media C.H. / Técnica', detalle: 'Liceo científico-humanista o técnico-profesional' },
  { nombre: 'Universitaria / I.P. / C.F.T.', detalle: 'Universidad, instituto profesional o centro de formación técnica' },
  { nombre: 'Magíster o Postgrado', detalle: 'Magíster, doctorado, postítulo o diplomado' }
] as const;

const equivalencias = new Map<string, string>([
  ['Enseñanza Media', NIVELES_EDUCATIVOS[1].nombre],
  ['Técnico Nivel Medio', NIVELES_EDUCATIVOS[1].nombre],
  ['Técnico Nivel Superior', NIVELES_EDUCATIVOS[2].nombre],
  ['Universitario', NIVELES_EDUCATIVOS[2].nombre],
  ['Posgrado / Magíster', NIVELES_EDUCATIVOS[3].nombre]
]);

export function nivelEducativoVisible(valor: unknown): string {
  const texto = String(valor ?? '').trim();
  return equivalencias.get(texto) ?? texto;
}

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
