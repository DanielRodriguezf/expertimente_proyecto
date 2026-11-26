/**
 * Validadores de ExpertiMente (ubicación: src/app/utils/validadores.ts).
 * Las funciones `validar...` devuelven '' si el valor es válido, o un mensaje corto si no lo es.
 */

/* Reglas que puedes ajustar */
export const EDAD_MINIMA = 18;
export const EDAD_MAXIMA = 100;
export const REQUISITOS_PASSWORD = 'Mínimo 8 caracteres, con letras y números.';

/* =======================================================
   TEXTO
======================================================= */
export function normalizarEspacios(valor: string | null | undefined): string {
  return (valor ?? '').trim().replace(/\s+/g, ' ');
}

/* =======================================================
   CORREO
======================================================= */
const REGEX_CORREO = /^[a-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function normalizarCorreo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toLowerCase();
}

export function validarCorreo(valor: string | null | undefined): string {
  const correo = (valor ?? '').trim();

  if (!correo) return 'Ingresa tu correo.';

  const [usuario] = correo.split('@');
  const valido =
    REGEX_CORREO.test(correo) &&
    correo.length <= 254 &&
    usuario.length <= 64 &&
    !usuario.startsWith('.') &&
    !usuario.endsWith('.') &&
    !correo.includes('..');

  return valido ? '' : 'Escribe un correo válido.';
}

/* =======================================================
   RUT (se guarda como 12345678-5)
======================================================= */
function limpiarRut(valor: string | null | undefined): string {
  // Elimina puntos, espacios y cualquier tipo de guión (normal, en-dash, em-dash, signo menos)
  return (valor ?? '')
    .replace(/[.\s\-–—−]/g, '')
    .toUpperCase();
}

/**
 * Formatea en vivo mientras el usuario escribe:
 * - Solo permite números en el cuerpo y un dígito o 'K' al final.
 * - Inserta automáticamente el guión antes del último carácter cuando hay al menos 2 caracteres.
 */
export function formatearRutEnVivo(valor: string | null | undefined): string {
  const soloValidos = (valor ?? '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '');

  if (!soloValidos) return '';

  // El cuerpo solo puede tener números (la K solo es válida al final como dígito verificador)
  const cuerpoBruto = soloValidos.slice(0, -1).replace(/K/g, '');
  const ultimo = soloValidos.slice(-1);
  const limpio = (cuerpoBruto + ultimo).slice(0, 9);

  if (limpio.length <= 1) {
    return limpio;
  }

  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

export function normalizarRut(valor: string | null | undefined): string {
  const limpio = limpiarRut(valor);
  return /^\d{7,8}[0-9K]$/.test(limpio)
    ? `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
    : formatearRutEnVivo(valor);
}

function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
}

export function validarRut(valor: string | null | undefined): string {
  const limpio = limpiarRut(valor);

  if (!limpio) return 'Ingresa tu RUT.';

  if (!/^\d{7,8}[0-9K]$/.test(limpio)) {
    return 'Escribe un RUT completo (ej: 12345678-5).';
  }

  const cuerpo = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1);
  const dvEsperado = digitoVerificador(cuerpo);

  if (dvIngresado !== dvEsperado) {
    return 'El RUT no es válido (revisa el dígito después del guión).';
  }

  return '';
}

/* =======================================================
   NOMBRES Y APELLIDOS
======================================================= */
const REGEX_NOMBRE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

/** @param etiqueta 'nombre', 'apellido paterno'... @param obligatorio si es false, vacío es válido */
export function validarNombrePersona(
  valor: string | null | undefined,
  etiqueta: string,
  obligatorio: boolean = true
): string {
  const texto = normalizarEspacios(valor);

  if (!texto) return obligatorio ? `Ingresa tu ${etiqueta}.` : '';

  return REGEX_NOMBRE.test(texto) ? '' : `Usa solo letras en tu ${etiqueta}.`;
}

/* =======================================================
   CELULAR CHILENO (se guarda como +56912345678)
======================================================= */
function extraerCelular(valor: string | null | undefined): string | null {
  let digitos = (valor ?? '').replace(/[\s()\-.]/g, '').replace(/^\+/, '');

  if (digitos.startsWith('56') && digitos.length === 11) {
    digitos = digitos.slice(2);
  }

  return /^9\d{8}$/.test(digitos) ? digitos : null;
}

export function normalizarTelefono(valor: string | null | undefined): string {
  const celular = extraerCelular(valor);
  return celular ? `+56${celular}` : (valor ?? '').trim();
}

export function validarTelefonoMovil(valor: string | null | undefined): string {
  if (!(valor ?? '').trim()) return 'Ingresa tu celular.';

  return extraerCelular(valor) ? '' : 'Escribe un celular válido.';
}

/* =======================================================
   FECHA DE NACIMIENTO (YYYY-MM-DD, formato de <input type="date">)
======================================================= */
function aFechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Devuelve null si el texto no es una fecha real (ej: 2024-02-31). */
function parsearFechaIso(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;

  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(anio, mes - 1, dia);

  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
    ? fecha
    : null;
}

/** Fecha 'YYYY-MM-DD' de hace N años. Sirve para [min] y [max] del input de fecha. */
export function fechaIsoHaceAnios(anios: number, hoy: Date = new Date()): string {
  return aFechaIso(new Date(hoy.getFullYear() - anios, hoy.getMonth(), hoy.getDate()));
}

export function validarFechaNacimiento(valor: string | null | undefined): string {
  const texto = (valor ?? '').trim();

  if (!texto) return 'Ingresa tu fecha de nacimiento.';

  const fecha = parsearFechaIso(texto);
  if (!fecha) return 'Fecha no válida.';

  // Comparación por texto ISO: evita errores de zona horaria
  if (texto > fechaIsoHaceAnios(EDAD_MINIMA)) {
    return fecha > new Date() ? 'Fecha no válida.' : `Debes tener ${EDAD_MINIMA} años o más.`;
  }
  if (texto < fechaIsoHaceAnios(EDAD_MAXIMA)) return 'Fecha no válida.';

  return '';
}

/* =======================================================
   TEXTO LIBRE OBLIGATORIO (institución, cargo, lugar, habilidades...)
======================================================= */
export function validarTextoObligatorio(
  valor: string | null | undefined,
  mensajeVacio: string,
  maximo: number = 100
): string {
  const texto = normalizarEspacios(valor);

  if (!texto) return mensajeVacio;
  if (!/[\p{L}\p{N}]/u.test(texto)) return 'Escribe un texto válido.';

  return texto.length > maximo ? `Máximo ${maximo} caracteres.` : '';
}

/* =======================================================
   AÑO DE 4 DÍGITOS (estudios)
======================================================= */
export function validarAnio(
  valor: string | number | null | undefined,
  mensajeVacio: string,
  minimo: number = 1945,
  maximo: number = new Date().getFullYear() + 1
): string {
  const texto = String(valor ?? '').trim();

  if (!texto) return mensajeVacio;

  const valido = /^\d{4}$/.test(texto) && Number(texto) >= minimo && Number(texto) <= maximo;
  return valido ? '' : 'Año no válido.';
}

/* =======================================================
   CONTRASEÑA (solo al CREARLA; en el login no se aplican estas reglas)
======================================================= */
export function validarPasswordNueva(valor: string | null | undefined): string {
  const password = valor ?? '';

  if (!password) return 'Crea una contraseña.';

  const valida = password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password);
  return valida ? '' : REQUISITOS_PASSWORD;
}

export function validarConfirmacionPassword(
  password: string | null | undefined,
  confirmacion: string | null | undefined
): string {
  if (!confirmacion) return 'Repite tu contraseña.';

  return password === confirmacion ? '' : 'Las contraseñas no coinciden.';
}