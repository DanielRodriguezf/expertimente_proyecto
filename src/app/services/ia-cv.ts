import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type MetodoIA = 'gemini' | 'local';

export interface EvaluacionCargo {
  porcentajeIdoneidad: number;
  fortalezas: string[];
  resumenIA: string;
  metodo: MetodoIA;
}

export interface DatosGeneracionCv {
  nombre: string;
  apellidoPaterno: string;
  cvManual: any;
  tieneExperiencia: boolean;
  areasInteres?: string[];
}

export interface ResultadoTextoCv {
  texto: string;
  metodo: MetodoIA;
}

export interface ResultadoEvaluacion {
  evaluaciones: { [cargoId: string]: EvaluacionCargo };
}

/** Se lanza cuando la IA no responde Y el perfil no tiene ningún dato ni PDF para el análisis local. */
export class DatosInsuficientesError extends Error {
  constructor(mensaje = 'No hay datos suficientes en el perfil para evaluar.') {
    super(mensaje);
    this.name = 'DatosInsuficientesError';
    Object.setPrototypeOf(this, DatosInsuficientesError.prototype);
  }
}

/** Una formación académica ya limpia y lista para mostrarse en el CV. */
export interface FormacionCv {
  institucion: string;
  /** Nombre del estudio o carrera. Vacío si solo se conoce el nivel (ej. "Enseñanza básica"). */
  titulo: string;
  /** Nivel en lenguaje simple: "Educación superior", "Enseñanza media", etc. */
  nivel: string;
  /** "2023 – Actualidad", "2019 – 2022" o vacío si no hay años. */
  periodo: string;
  enCurso: boolean;
  /** 1 = básica ... 5 = postgrado (0 si no se pudo determinar). */
  rango: number;
}

/** Una experiencia laboral ya limpia (sin filas vacías). */
export interface ExperienciaCv {
  cargo: string;
  lugar: string;
  tiempo: string;
  descripcion: string;
}

/* =======================================================
   TIPOS INTERNOS
======================================================= */
interface PerfilLocal {
  textoNorm: string;
  tokens: Set<string>;
  anosExperiencia: number;
  rangoEducacion: number;
  tecnicas: string[];
  blandas: string[];
}

interface Componente {
  peso: number;
  puntaje: number;
}

/** Datos del perfil ya depurados que usan tanto Gemini como el generador local. */
interface BaseCv {
  cv: any;
  contexto: string;
  formaciones: FormacionCv[];
  experiencias: ExperienciaCv[];
  tecnicas: string[];
  blandas: string[];
  areas: string[];
}

@Injectable({ providedIn: 'root' })
export class IaCvService {

  // Modelo único configurado para Google AI Studio
  private readonly MODELO_GEMINI = 'gemini-3.8-flash';

  // Topes máximos para evitar saturar el CV si el postulante agrega demasiados elementos
  private readonly MAX_AREAS_RELEVANTES = 3;
  private readonly MAX_HABILIDADES_TECNICAS = 6;
  private readonly MAX_HABILIDADES_BLANDAS = 4;

  private readonly MAX_FORMACIONES = 5;
  private readonly MAX_EXPERIENCIAS = 5;

  // true = se pide a Gemini que responda sin "pensar" antes (mucho más rápido).
  // Si el modelo no lo acepta, se reintenta solo sin ese ajuste. Cámbialos a false para desactivarlo.
  private readonly RESPUESTA_RAPIDA_CV = true;
  private readonly RESPUESTA_RAPIDA_ESCANEO = true;

  // Caché de resultados del escaneo (se guarda en el dispositivo).
  // Sube VERSION_ESCANEO si cambias el prompt del escaneo, para descartar los resultados antiguos.
  private readonly VERSION_ESCANEO = 'v2';
  private readonly CLAVE_CACHE_ESCANEO = 'expertimente_cache_escaneo';
  private readonly MAX_CACHE_ESCANEO = 300;
  private cacheEscaneo: Map<string, EvaluacionCargo> | null = null;

  private readonly PALABRAS_VACIAS = new Set([
    'los', 'las', 'del', 'con', 'para', 'por', 'que', 'sus', 'una', 'uno', 'unos', 'unas',
    'como', 'mas', 'muy', 'sin', 'sobre', 'entre', 'manejo', 'conocimiento', 'conocimientos',
    'capacidad', 'habilidad', 'habilidades', 'uso', 'nivel', 'basico', 'intermedio', 'avanzado',
    'experiencia', 'minimo', 'deseable', 'requerido', 'persona', 'cargo', 'area', 'buen',
    'buena', 'bueno', 'alto', 'alta', 'tener', 'ser', 'estar', 'hacer'
  ]);

  /* =======================================================
     API PÚBLICA
  ======================================================= */

  /** Genera el texto del CV: 1 intento con Gemini (esperando lo que demore) y, si falla, usa la plantilla local. */
  async generarTextoCv(datos: DatosGeneracionCv): Promise<ResultadoTextoCv> {
    try {
      const texto = await this.generarTextoCvConGemini(datos);
      return { texto, metodo: 'gemini' };
    } catch (error) {
      console.warn('[IaCv] Gemini no disponible para crear CV, usando generador local:', error);
      return { texto: this.generarTextoCvLocal(datos), metodo: 'local' };
    }
  }

  /**
   * Evalúa los cargos con 1 sola petición a Gemini (esperando todo el tiempo que necesite).
   * - Los cargos que ya fueron evaluados por IA con este mismo perfil se reutilizan: no gastan IA ni tiempo.
   *   Si el postulante cambia su perfil o el administrador edita el cargo, se evalúan de nuevo.
   * - Los cargos que la IA no pudo evaluar usan el análisis local por reglas (y no se guardan en la caché).
   * Con `ignorarCache: true` se fuerza una evaluación nueva de todos los cargos.
   */
  async evaluarCargos(
    perfil: any,
    cargos: any[],
    areasUsuario: string[],
    opciones: { ignorarCache?: boolean } = {}
  ): Promise<ResultadoEvaluacion> {
    const evaluaciones: { [cargoId: string]: EvaluacionCargo } = {};

    if (!cargos.length) {
      return { evaluaciones };
    }

    const adjuntarPdf = this.debeAdjuntarPdf(perfil);
    const huellaPerfil = this.huellaPerfil(perfil, areasUsuario, adjuntarPdf);

    // 1) Reutilizar lo que la IA ya evaluó con este mismo perfil y este mismo cargo
    const clavesPorCargo = new Map<string, string>();
    const paraIa: any[] = [];

    for (const cargo of cargos) {
      const clave = this.claveCache(huellaPerfil, cargo);
      clavesPorCargo.set(String(cargo.id), clave);

      const guardada = opciones.ignorarCache ? null : this.leerCache(clave);
      if (guardada) {
        evaluaciones[cargo.id] = guardada;
      } else {
        paraIa.push(cargo);
      }
    }

    // 2) Gemini solo para los cargos nuevos o modificados
    if (paraIa.length) {
      try {
        const porIa = await this.evaluarCargosConGemini(perfil, paraIa, areasUsuario, adjuntarPdf);
        for (const [id, evaluacion] of Object.entries(porIa)) {
          evaluaciones[id] = evaluacion;
          const clave = clavesPorCargo.get(id);
          if (clave) this.guardarCache(clave, evaluacion);
        }
        this.persistirCache();
      } catch (error) {
        console.warn('[IaCv] Gemini no disponible en escaneo, usando análisis local:', error);
      }
    } else {
      console.info('[IaCv] Escaneo resuelto con resultados guardados (sin consultar a la IA).');
    }

    // 3) Respaldo local para lo que la IA no pudo evaluar
    const pendientes = cargos.filter(c => !evaluaciones[c.id]);
    if (pendientes.length) {
      try {
        const textoPdfExtraido = this.extraerTextoDePdfBase64(perfil?.cvBase64 || '');
        const perfilLocal = this.prepararPerfilLocal(perfil, areasUsuario, textoPdfExtraido);
        for (const cargo of pendientes) {
          evaluaciones[cargo.id] = this.evaluarCargoLocal(perfilLocal, cargo);
        }
      } catch (error) {
        if (!Object.keys(evaluaciones).length) throw error;
      }
    }

    return { evaluaciones };
  }

  /* =======================================================
     ESCANEO: PDF, HUELLAS Y CACHÉ DE RESULTADOS
  ======================================================= */

  /**
   * El PDF solo se envía a la IA si lo subió el postulante. El que genera la app ("CV_IA_...")
   * sale de los mismos datos del formulario, así que enviarlo solo alarga la petición.
   */
  private debeAdjuntarPdf(perfil: any): boolean {
    const cvBase64 = perfil?.cvBase64;
    if (typeof cvBase64 !== 'string' || cvBase64.length < 100) return false;
    return !/^CV_IA_/i.test(String(perfil?.cvNombre ?? ''));
  }

  /** Huella de todo lo que influye en la evaluación del perfil (si cambia algo, cambia la huella). */
  private huellaPerfil(perfil: any, areasUsuario: string[], adjuntarPdf: boolean): string {
    const cv = perfil?.cvManual || {};

    const partes = [
      JSON.stringify(this.obtenerFormaciones(cv)),
      JSON.stringify(this.obtenerExperiencias(cv)),
      this.aLista(cv.habilidadesTecnicas).join(','),
      this.aLista(cv.habilidadesBlandas).join(','),
      this.textoLimpio(cv.disponibilidad),
      this.textoLimpio(cv.nivelEducativo),
      this.textoLimpio(cv.carrera),
      this.textoLimpio(cv.establecimiento),
      (areasUsuario || []).map(a => this.normalizar(a)).sort().join(','),
      adjuntarPdf ? String(perfil?.cvBase64 || '') : ''
    ];

    return this.huella(partes.join('\u0001'));
  }

  private claveCache(huellaPerfil: string, cargo: any): string {
    const huellaCargo = this.huella(
      [
        cargo?.id, cargo?.nombre, cargo?.areaLaboral, cargo?.descripcion,
        cargo?.habilidadesTecnicas, cargo?.habilidadesBlandas,
        cargo?.nivelEducativoMinimo, cargo?.anosExperienciaMinima
      ].map(v => String(v ?? '')).join('\u0001')
    );
    return `${this.VERSION_ESCANEO}|${this.MODELO_GEMINI}|${huellaPerfil}|${huellaCargo}`;
  }

  /** Huella de 53 bits (cyrb53): suficiente para distinguir perfiles y cargos distintos. */
  private huella(texto: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < texto.length; i++) {
      const c = texto.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  private cargarCache(): Map<string, EvaluacionCargo> {
    if (this.cacheEscaneo) return this.cacheEscaneo;

    const cache = new Map<string, EvaluacionCargo>();
    try {
      const crudo = typeof localStorage !== 'undefined' ? localStorage.getItem(this.CLAVE_CACHE_ESCANEO) : null;
      const lista = crudo ? JSON.parse(crudo) : [];
      if (Array.isArray(lista)) {
        for (const entrada of lista) {
          const [clave, valor] = Array.isArray(entrada) ? entrada : [];
          if (typeof clave === 'string' && valor && typeof valor.porcentajeIdoneidad === 'number') {
            cache.set(clave, valor);
          }
        }
      }
    } catch {
      // Caché ilegible: se ignora y se parte de cero
    }

    this.cacheEscaneo = cache;
    return cache;
  }

  private leerCache(clave: string): EvaluacionCargo | null {
    const guardada = this.cargarCache().get(clave);
    return guardada ? { ...guardada, fortalezas: [...(guardada.fortalezas || [])] } : null;
  }

  private guardarCache(clave: string, evaluacion: EvaluacionCargo): void {
    // Solo se guarda lo que calculó la IA: lo del análisis local se vuelve a intentar con IA la próxima vez
    if (evaluacion.metodo !== 'gemini') return;

    const cache = this.cargarCache();
    cache.delete(clave);
    cache.set(clave, evaluacion);

    while (cache.size > this.MAX_CACHE_ESCANEO) {
      const masAntigua = cache.keys().next().value;
      if (masAntigua === undefined) break;
      cache.delete(masAntigua);
    }
  }

  private persistirCache(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.CLAVE_CACHE_ESCANEO, JSON.stringify(Array.from(this.cargarCache().entries())));
    } catch {
      // Sin espacio o sin acceso al almacenamiento: la caché sigue funcionando en memoria
    }
  }

  private recortar(texto: any, maximo: number): string {
    const limpio = this.textoLimpio(texto);
    return limpio.length > maximo ? `${limpio.slice(0, maximo - 1).trimEnd()}…` : limpio;
  }

  /* =======================================================
     DATOS DEL PERFIL PARA EL CV
     (públicos: también los usa el servicio que arma el PDF)
  ======================================================= */

  /**
   * Devuelve las formaciones académicas limpias y ordenadas (la más reciente primero).
   * Funciona con perfiles sin estudios ingresados, con solo algunos niveles y con perfiles
   * antiguos que solo tienen nivelEducativo / carrera / establecimiento.
   */
  obtenerFormaciones(cv: any): FormacionCv[] {
    const crudas: any[] = Array.isArray(cv?.formacionesAcademicas) ? cv.formacionesAcademicas : [];
    const candidatas: Array<{ formacion: FormacionCv; inicio: number; fin: number }> = [];

    for (const f of crudas) {
      const nivelCrudo = this.textoLimpio(f?.nivelEstudio);
      const nombre = this.textoLimpio(f?.nombreEstudio);
      const institucion = this.textoLimpio(f?.institucion);
      if (!nivelCrudo && !nombre && !institucion) continue;

      const anioInicio = this.textoLimpio(f?.anioInicio);
      const anioTermino = this.textoLimpio(f?.anioTermino);
      const enCurso = f?.cursandoActualmente === true;

      candidatas.push({
        formacion: this.crearFormacion(nivelCrudo, nombre, institucion, anioInicio, anioTermino, enCurso),
        inicio: Number(anioInicio) || 0,
        fin: enCurso ? 9999 : (Number(anioTermino) || 0)
      });
    }

    if (!candidatas.length) {
      const nivelCrudo = this.textoLimpio(cv?.nivelEducativo);
      const nombre = this.textoLimpio(cv?.carrera);
      const institucion = this.textoLimpio(cv?.establecimiento);
      if (nivelCrudo || nombre || institucion) {
        candidatas.push({
          formacion: this.crearFormacion(nivelCrudo, nombre, institucion, '', '', false),
          inicio: 0,
          fin: 0
        });
      }
    }

    return candidatas
      .sort((a, b) => b.fin - a.fin || b.inicio - a.inicio || b.formacion.rango - a.formacion.rango)
      .slice(0, this.MAX_FORMACIONES)
      .map(c => c.formacion);
  }

  /** Devuelve las experiencias con algún dato real. Si el postulante marcó "sin experiencia", devuelve []. */
  obtenerExperiencias(cv: any): ExperienciaCv[] {
    if (!cv || cv.sinExperiencia === true) return [];

    const crudas: any[] = Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [];
    const salida: ExperienciaCv[] = [];

    for (const exp of crudas) {
      if (typeof exp === 'string') {
        const descripcion = this.textoLimpio(exp);
        if (descripcion) salida.push({ cargo: '', lugar: '', tiempo: '', descripcion });
        continue;
      }

      const experiencia: ExperienciaCv = {
        cargo: this.textoLimpio(exp?.cargo || exp?.puesto || exp?.rol || exp?.area),
        lugar: this.textoLimpio(exp?.lugar || exp?.empresa || exp?.institucion),
        tiempo: this.textoLimpio(exp?.tiempo || exp?.duracion || exp?.periodo || exp?.anos),
        descripcion: this.textoLimpio(exp?.descripcion || exp?.funciones || exp?.detalle)
      };

      if (experiencia.cargo || experiencia.lugar || experiencia.descripcion) {
        salida.push(experiencia);
      }
    }

    return salida.slice(0, this.MAX_EXPERIENCIAS);
  }

  /** true si hay al menos un dato (estudios, experiencia o habilidades) para armar un CV. */
  tieneInformacionParaCv(cv: any): boolean {
    return (
      this.obtenerFormaciones(cv).length > 0 ||
      this.obtenerExperiencias(cv).length > 0 ||
      this.aLista(cv?.habilidadesTecnicas).length > 0 ||
      this.aLista(cv?.habilidadesBlandas).length > 0
    );
  }

  /** Texto de una formación: línea principal (negrita) y línea de detalle. */
  textoFormacion(f: FormacionCv): { principal: string; detalle: string } {
    const principal = f.titulo || f.nivel || f.institucion;
    const detalle = [
      principal === f.institucion ? '' : f.institucion,
      f.titulo ? f.nivel : '',
      f.periodo
    ].filter(Boolean).join('  •  ');
    return { principal, detalle };
  }

  private crearFormacion(
    nivelCrudo: string,
    nombre: string,
    institucion: string,
    anioInicio: string,
    anioTermino: string,
    enCurso: boolean
  ): FormacionCv {
    const rango = this.rangoEducacion(nivelCrudo || nombre);
    const repiteNivel = !!nombre && this.normalizar(nombre) === this.normalizar(nivelCrudo);

    return {
      institucion,
      titulo: repiteNivel ? '' : nombre,
      nivel: this.nombreNivel(rango, nivelCrudo),
      periodo: this.textoPeriodo(anioInicio, anioTermino, enCurso),
      enCurso,
      rango
    };
  }

  private nombreNivel(rango: number, nivelCrudo: string): string {
    switch (rango) {
      case 1: return 'Enseñanza básica';
      case 2: return 'Enseñanza media';
      case 3: return 'Educación técnica';
      case 4: return 'Educación superior';
      case 5: return 'Postgrado';
      default: return nivelCrudo;
    }
  }

  private textoPeriodo(inicio: string, termino: string, enCurso: boolean): string {
    if (enCurso) return inicio ? `${inicio} – Actualidad` : 'En curso';
    if (inicio && termino) return inicio === termino ? inicio : `${inicio} – ${termino}`;
    if (termino) return termino;
    if (inicio) return `Desde ${inicio}`;
    return '';
  }

  private textoLimpio(valor: any): string {
    return String(valor ?? '').replace(/\s+/g, ' ').trim();
  }

  /* =======================================================
     GEMINI (OPCIÓN 1 - UN SOLO INTENTO SIN TIMEOUT)
     La IA solo redacta el resumen y las viñetas de cada experiencia.
     Encabezados, estudios y competencias se arman localmente: es más rápido y no inventa datos.
  ======================================================= */

  private async generarTextoCvConGemini(datos: DatosGeneracionCv): Promise<string> {
    const base = this.prepararBaseCv(datos);
    const prompt = this.construirPromptCv(datos, base);

    const data = await this.llamarGemini(
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
      },
      { sinRazonamiento: this.RESPUESTA_RAPIDA_CV }
    );

    return this.ensamblarTextoCvDesdeRespuestaIa(this.extraerTexto(data), base);
  }

  private prepararBaseCv(datos: DatosGeneracionCv): BaseCv {
    const cv = datos.cvManual || {};
    const contexto = this.construirContextoRelevancia(cv, datos.areasInteres);

    return {
      cv,
      contexto,
      formaciones: this.obtenerFormaciones(cv),
      experiencias: datos.tieneExperiencia === false ? [] : this.obtenerExperiencias(cv),
      tecnicas: this.seleccionarMasRelevantes(this.aLista(cv['habilidadesTecnicas']), contexto, this.MAX_HABILIDADES_TECNICAS),
      blandas: this.seleccionarMasRelevantes(this.aLista(cv['habilidadesBlandas']), contexto, this.MAX_HABILIDADES_BLANDAS),
      areas: this.seleccionarMasRelevantes(this.aLista(datos.areasInteres), contexto, this.MAX_AREAS_RELEVANTES)
    };
  }

  private construirPromptCv(datos: DatosGeneracionCv, base: BaseCv): string {
    const formaciones = base.formaciones.length
      ? base.formaciones.map(f => {
          const t = this.textoFormacion(f);
          return `- ${t.principal}${t.detalle ? ` | ${t.detalle.split('  •  ').join(' | ')}` : ''}`;
        }).join('\n')
      : '- No especificada';

    const instruccionExperiencias = base.experiencias.length
      ? `2. "experiencias": un elemento por cada experiencia numerada, en el mismo orden, con "n" (su número) y "puntos": 2 viñetas breves (máximo 3) con funciones y aportes reales según el detalle entregado. Si el detalle es escaso, redacta funciones habituales del cargo sin inventar empresas, cifras ni logros.`
      : `2. "experiencias": el candidato no tiene experiencia laboral, devuelve un arreglo vacío [].`;

    return `Eres un experto en redacción de currículums en español.
Escribe de forma clara, formal y breve, sin inventar empresas, títulos, cifras ni logros que no estén en los datos.

DATOS DEL CANDIDATO:
- Nombre: ${datos.nombre} ${datos.apellidoPaterno || ''}
- Formación académica (de la más reciente a la más antigua):
${formaciones}
- Disponibilidad: ${base.cv['disponibilidad'] || 'No especificada'}
- Áreas de interés: ${base.areas.join(', ') || 'General'}
- Habilidades técnicas: ${base.tecnicas.join(', ') || 'No especificadas'}
- Habilidades blandas: ${base.blandas.join(', ') || 'No especificadas'}
- Experiencia laboral:
${this.formatearExperienciasParaPrompt(base.experiencias)}

QUÉ DEBES ENTREGAR:
1. "resumenProfesional": un párrafo de 3 oraciones en tercera persona. Destaca la formación más avanzada o relevante (no menciones estudios básicos o medios si tiene estudios superiores), la experiencia si existe y las habilidades y áreas de interés más afines. Si no tiene experiencia, resalta su motivación y disposición para aprender, sin escribir "sin experiencia".
${instruccionExperiencias}

Responde ÚNICAMENTE con un objeto JSON válido (sin bloques markdown ni asteriscos) con esta estructura exacta:
{
  "resumenProfesional": "texto",
  "experiencias": [
    { "n": 1, "puntos": ["viñeta 1", "viñeta 2"] }
  ]
}`;
  }

  private formatearExperienciasParaPrompt(experiencias: ExperienciaCv[]): string {
    if (!experiencias.length) {
      return 'Sin experiencia laboral formal previa.';
    }

    return experiencias.map((e, i) =>
      `${i + 1}. Cargo: ${e.cargo || 'No especificado'} | Lugar: ${e.lugar || 'No especificado'} | Tiempo: ${e.tiempo || 'No especificado'} | Detalle: ${e.descripcion || 'Funciones propias del rol'}`
    ).join('\n');
  }

  private ensamblarTextoCvDesdeRespuestaIa(rawText: string, base: BaseCv): string {
    const jsonObj = this.parsearObjetoJsonSeguro(rawText);

    const resumen = this.limpiarMarkdown(String(jsonObj?.resumenProfesional ?? '')).replace(/\s+/g, ' ').trim();
    if (resumen.length < 40) {
      throw new Error('Gemini devolvió una respuesta sin un resumen profesional válido');
    }

    const itemsIa: any[] = Array.isArray(jsonObj?.experiencias) ? jsonObj.experiencias : [];
    return this.armarTextoCv(base, resumen, (i) => this.puntosDesdeIa(itemsIa, i, base.experiencias[i]));
  }

  /** Arma el texto final del CV. Lo comparten Gemini y el generador local. */
  private armarTextoCv(base: BaseCv, resumen: string, puntosDe: (indice: number) => string[]): string {
    const lineas: string[] = ['RESUMEN PROFESIONAL', resumen];

    if (base.experiencias.length) {
      lineas.push('EXPERIENCIA LABORAL');
      base.experiencias.forEach((exp, i) => {
        lineas.push([exp.cargo || 'Experiencia previa', exp.lugar, exp.tiempo].filter(Boolean).join(' | '));

        const puntos = puntosDe(i);
        const finales = puntos.length
          ? puntos
          : ['Cumplimiento responsable de las labores y objetivos asignados al puesto.'];
        finales.forEach(p => lineas.push(`- ${p}`));
      });
    }

    const competencias = this.construirCompetencias(base);
    if (competencias.length) {
      lineas.push('COMPETENCIAS');
      lineas.push(...competencias);
    }

    return lineas.join('\n');
  }

  private construirCompetencias(base: BaseCv): string[] {
    const lineas: string[] = [];
    if (base.tecnicas.length) lineas.push(`- Habilidades técnicas destacadas: ${base.tecnicas.join(', ')}.`);
    if (base.blandas.length) lineas.push(`- Habilidades interpersonales: ${base.blandas.join(', ')}.`);

    const disponibilidad = this.textoLimpio(base.cv['disponibilidad']);
    if (disponibilidad) lineas.push(`- Disponibilidad laboral: ${disponibilidad}.`);

    return lineas;
  }

  private puntosDesdeIa(items: any[], indice: number, exp: ExperienciaCv): string[] {
    const item = items.find(it => Number(it?.n ?? it?.indice) === indice + 1) ?? items[indice];
    const crudos: any[] = Array.isArray(item?.puntos)
      ? item.puntos
      : (Array.isArray(item?.logros) ? item.logros : []);

    const puntos = crudos
      .map(p => this.limpiarMarkdown(String(p ?? '')).replace(/^[\s\-*•]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    return puntos.length ? puntos : this.dividirEnPuntos(exp.descripcion);
  }

  private parsearObjetoJsonSeguro(rawText: string): any | null {
    const limpio = (rawText || '').replace(/```json|```/gi, '').trim();

    try {
      const directo = JSON.parse(limpio);
      if (directo && typeof directo === 'object' && !Array.isArray(directo)) return directo;
    } catch {
      // Se intenta extraer el objeto por delimitadores
    }

    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio !== -1 && fin > inicio) {
      try {
        return JSON.parse(limpio.slice(inicio, fin + 1));
      } catch {
        return null;
      }
    }
    return null;
  }

  private limpiarMarkdown(texto: string): string {
    return (texto || '')
      .replace(/^#+\s*/g, '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .trim();
  }

  private async evaluarCargosConGemini(
    perfil: any,
    cargos: any[],
    areasUsuario: string[],
    adjuntarPdf: boolean
  ): Promise<{ [cargoId: string]: EvaluacionCargo }> {
    const cvManual = perfil?.cvManual || {};

    const formaciones = this.obtenerFormaciones(cvManual);
    const textoFormaciones = formaciones.length
      ? formaciones.map(f => {
          const t = this.textoFormacion(f);
          return `- ${t.principal}${t.detalle ? ` (${t.detalle.split('  •  ').join(', ')})` : ''}`;
        }).join('\n')
      : '- No especificada';

    const listaExperiencias = this.obtenerExperiencias(cvManual);
    const anosTotales = this.sumarAnos(listaExperiencias);
    const totalExperiencia = listaExperiencias.length
      ? (anosTotales > 0 ? this.textoAnos(anosTotales) : 'no indicada')
      : 'sin experiencia';
    const experiencias = listaExperiencias.length
      ? listaExperiencias
          .map(e => `- ${e.cargo || 'Cargo no indicado'}${e.lugar ? ` en ${e.lugar}` : ''}${e.tiempo ? ` (${e.tiempo})` : ''}${e.descripcion ? `: ${e.descripcion}` : ''}`)
          .join('\n')
      : '- Sin experiencia laboral declarada';

    const tecnicas = this.aLista(cvManual.habilidadesTecnicas).join(', ') || 'No especificadas';
    const blandas = this.aLista(cvManual.habilidadesBlandas).join(', ') || 'No especificadas';

    // El PDF solo viaja si lo subió el postulante (ver debeAdjuntarPdf)
    const pdfBase64 = adjuntarPdf ? this.extraerBase64PuroDePdf(perfil?.cvBase64 || '') : null;

    const listaCargosTexto = cargos.map((c, idx) => {
      const tecnicasPedidas = this.aLista(c.habilidadesTecnicas).join(', ');
      const blandasPedidas = this.aLista(c.habilidadesBlandas).join(', ');
      const anosMinimos = Number(c.anosExperienciaMinima) || 0;

      return [
        `#${idx + 1} cargoId="${c.id}"`,
        `Nombre: ${c.nombre || ''}`,
        c.areaLaboral ? `Área: ${c.areaLaboral}` : '',
        c.descripcion ? `Descripción: ${this.recortar(c.descripcion, 220)}` : '',
        tecnicasPedidas ? `Técnicas pedidas: ${tecnicasPedidas}` : '',
        blandasPedidas ? `Blandas pedidas: ${blandasPedidas}` : '',
        c.nivelEducativoMinimo ? `Educación mínima: ${c.nivelEducativoMinimo}` : '',
        anosMinimos > 0 ? `Experiencia mínima: ${anosMinimos} años` : ''
      ].filter(Boolean).join(' | ');
    }).join('\n');

    const prompt = `Eres un experto en reclutamiento inclusivo de la plataforma ExpertiMente.
Evalúa la idoneidad (compatibilidad de 0 a 100) del postulante para CADA cargo listado, usando solo la información entregada.
Si el postulante declaró muchas habilidades o áreas, considera las más relevantes para cada cargo.

POSTULANTE:
- Formación académica:
${textoFormaciones}
- Experiencia laboral (total declarada: ${totalExperiencia}):
${experiencias}
- Habilidades técnicas: ${tecnicas}
- Habilidades blandas: ${blandas}
- Disponibilidad: ${cvManual.disponibilidad || 'No especificada'}
- Áreas de interés: ${(areasUsuario || []).join(', ') || 'No especificadas'}${pdfBase64 ? '\n- Se adjunta su currículum en PDF: úsalo como fuente adicional de información.' : ''}

CARGOS (cada línea es un cargo):
${listaCargosTexto}

CRITERIO DE EVALUACIÓN (el mismo para todos los cargos):
- 35% habilidades técnicas pedidas frente a las que tiene o demuestra en su experiencia
- 25% afinidad del cargo con su experiencia, estudios e intereses
- 15% experiencia mínima pedida
- 15% habilidades blandas
- 10% nivel educativo mínimo
Si un cargo no pide alguno de estos puntos, reparte su peso entre los demás. Usa valores entre 15 y 98, sé exigente y distingue entre cargos: si un cargo pide bastante más de lo que el postulante tiene, el porcentaje debe ser bajo.

Responde ÚNICAMENTE con un arreglo JSON válido (sin markdown), un elemento por cargo y en el mismo orden:
[
  {
    "cargoId": "ID exacto del cargo",
    "porcentajeIdoneidad": 80,
    "fortalezas": ["hasta 4 coincidencias reales con el perfil, de máximo 8 palabras cada una"],
    "resumenIA": "una oración de máximo 25 palabras que explique el porcentaje al reclutador"
  }
]`;

    const parts: any[] = [{ text: prompt }];
    if (pdfBase64) {
      parts.push({ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } });
    }

    const data = await this.llamarGemini(
      {
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      },
      { sinRazonamiento: this.RESPUESTA_RAPIDA_ESCANEO }
    );

    const rawText = this.extraerTexto(data) || '[]';
    const arreglo = this.parsearArregloJsonSeguro(rawText);

    const idsValidos = new Set(cargos.map(c => String(c.id)));
    const mapaPorNombre = new Map<string, string>();
    cargos.forEach(c => {
      const nombreNorm = this.normalizar(c.nombre);
      if (nombreNorm) mapaPorNombre.set(nombreNorm, String(c.id));
    });

    const salida: { [cargoId: string]: EvaluacionCargo } = {};

    if (Array.isArray(arreglo)) {
      arreglo.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;

        let id = String(item?.cargoId ?? item?.id ?? '').trim();

        if (!idsValidos.has(id)) {
          const matchIndice = id.match(/^cargo\s*(\d+)$/i);
          if (matchIndice) {
            const pos = Number(matchIndice[1]) - 1;
            if (cargos[pos]) id = String(cargos[pos].id);
          }
        }
        if (!idsValidos.has(id)) {
          const porNombre = mapaPorNombre.get(this.normalizar(item?.nombre || item?.nombreCargo || item?.cargoId));
          if (porNombre && !salida[porNombre]) {
            id = porNombre;
          } else if (cargos[idx] && !salida[String(cargos[idx].id)]) {
            id = String(cargos[idx].id);
          }
        }

        if (!idsValidos.has(id)) return;

        const numPorcentaje = Number(item?.porcentajeIdoneidad ?? item?.porcentaje ?? item?.puntaje);
        const porcentaje = this.limitarPorcentaje(isNaN(numPorcentaje) ? 55 : numPorcentaje);
        const fortalezas = Array.isArray(item?.fortalezas)
          ? item.fortalezas.map((f: any) => String(f).trim()).filter(Boolean).slice(0, 4)
          : [];
        const resumenIA = typeof item?.resumenIA === 'string' && item.resumenIA.trim()
          ? item.resumenIA.trim()
          : `Compatibilidad del ${porcentaje}% calculada con IA.`;

        salida[id] = { porcentajeIdoneidad: porcentaje, fortalezas, resumenIA, metodo: 'gemini' };
      });
    }

    if (!Object.keys(salida).length) {
      throw new Error('Gemini no devolvió evaluaciones válidas');
    }
    return salida;
  }

  /**
   * Realiza 1 ÚNICO intento a gemini-3.8-flash sin AbortController ni límite de tiempo,
   * esperando todo lo que el modelo necesite para responder.
   *
   * Con `sinRazonamiento` se pide al modelo que no "piense" antes de responder (mucho más rápido
   * en tareas de redacción). Si el modelo no acepta ese ajuste (HTTP 400, error de parámetros),
   * se repite la misma petición sin él.
   */
  private async llamarGemini(body: any, opciones: { sinRazonamiento?: boolean } = {}): Promise<any> {
    const apiKey = ((environment as any)?.geminiApiKey || '').trim();
    if (!apiKey || apiKey === 'TU_API_KEY_DE_GEMINI_AQUI') {
      throw new Error('La API Key de Gemini no está configurada en environment.ts');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Sin conexión a internet');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODELO_GEMINI}:generateContent?key=${apiKey}`;

    const enviar = (cuerpo: any) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });

    let cuerpoEnviado = body;
    if (opciones.sinRazonamiento) {
      cuerpoEnviado = {
        ...body,
        generationConfig: {
          ...(body.generationConfig || {}),
          thinkingConfig: { thinkingBudget: 0 }
        }
      };
    }

    console.info(`[IaCv] Consultando ${this.MODELO_GEMINI} (esperando todo el tiempo que necesite)...`);

    let respuesta = await enviar(cuerpoEnviado);

    if (!respuesta.ok && respuesta.status === 400 && cuerpoEnviado !== body) {
      console.warn('[IaCv] El modelo no acepta desactivar el razonamiento; se repite sin ese ajuste.');
      respuesta = await enviar(body);
    }

    if (respuesta.ok) {
      console.info(`[IaCv] ¡Respuesta exitosa de ${this.MODELO_GEMINI}!`);
      return await respuesta.json();
    }

    const detalleServidor = await respuesta.text().catch(() => 'Sin detalle');
    console.warn(`[IaCv] ${this.MODELO_GEMINI} respondió HTTP ${respuesta.status} →`, detalleServidor);
    throw new Error(`HTTP ${respuesta.status} en ${this.MODELO_GEMINI}: ${detalleServidor}`);
  }

  private extraerTexto(data: any): string {
    const partes = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(partes)) return '';
    const partesFinales = partes.filter((p: any) => !p?.thought && typeof p?.text === 'string');
    const fuente = partesFinales.length ? partesFinales : partes;
    return fuente.map((p: any) => p?.text || '').join('').trim();
  }

  private extraerBase64PuroDePdf(dataUrl: string): string | null {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const indiceComa = dataUrl.indexOf(',');
    if (indiceComa !== -1) {
      const cabecera = dataUrl.slice(0, indiceComa).toLowerCase();
      if (!cabecera.includes('application/pdf')) return null;
      const base64 = dataUrl.slice(indiceComa + 1).replace(/\s+/g, '');
      return base64 || null;
    }
    return dataUrl.replace(/\s+/g, '') || null;
  }

  /**
   * Extrae texto legible desde un PDF en base64 usando únicamente manipulación de strings,
   * evitando cualquier conflicto de tipos binarios (Uint8Array / BufferSource) en Angular.
   */
  private extraerTextoDePdfBase64(dataUrl: string): string {
    const base64 = this.extraerBase64PuroDePdf(dataUrl);
    if (!base64) return '';

    try {
      const binario = atob(base64);
      const fragmentos: string[] = [];
      const regexParentesis = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let match: RegExpExecArray | null;

      while ((match = regexParentesis.exec(binario)) !== null) {
        const decodificado = match[1]
          .replace(/\\n/g, ' ')
          .replace(/\\r/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\')
          .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));

        const limpio = decodificado.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').replace(/\s+/g, ' ').trim();
        if (limpio.length >= 2) {
          fragmentos.push(limpio);
        }
      }

      return fragmentos.join(' ').replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  }

  /**
   * Parsea de forma segura el arreglo de evaluaciones de cargos devuelto por Gemini,
   * evitando confundir el arreglo interno "fortalezas" (strings) con el arreglo de cargos (objetos).
   */
  private parsearArregloJsonSeguro(rawText: string): any[] {
    const limpio = rawText.replace(/```json|```/gi, '').trim();

    const extraerDeValor = (val: any): any[] | null => {
      if (!val) return null;

      if (Array.isArray(val)) {
        const objetos = val.filter(el => el && typeof el === 'object' && !Array.isArray(el));
        if (objetos.length) return objetos;
        return null;
      }

      if (typeof val === 'object') {
        if ('porcentajeIdoneidad' in val || 'cargoId' in val || 'resumenIA' in val) {
          return [val];
        }

        for (const prop of Object.values(val)) {
          if (Array.isArray(prop)) {
            const objetos = prop.filter(el => el && typeof el === 'object' && !Array.isArray(el));
            if (objetos.length) return objetos;
          }
        }

        const entradas = Object.entries(val)
          .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
          .map(([k, v]: [string, any]) => ({ cargoId: v.cargoId || k, ...v }));
        if (entradas.length) return entradas;
      }

      return null;
    };

    try {
      const directo = JSON.parse(limpio);
      const resultado = extraerDeValor(directo);
      if (resultado) return resultado;
    } catch {
      // Continuamos con extracción por delimitadores
    }

    const primerCorchete = limpio.indexOf('[');
    const ultimoCorchete = limpio.lastIndexOf(']');
    const primeraLlave = limpio.indexOf('{');
    const ultimaLlave = limpio.lastIndexOf('}');

    if (primerCorchete !== -1 && ultimoCorchete > primerCorchete) {
      try {
        const arr = JSON.parse(limpio.slice(primerCorchete, ultimoCorchete + 1));
        const res = extraerDeValor(arr);
        if (res) return res;
      } catch {
        // Probamos con llaves
      }
    }

    if (primeraLlave !== -1 && ultimaLlave > primeraLlave) {
      try {
        const obj = JSON.parse(limpio.slice(primeraLlave, ultimaLlave + 1));
        const res = extraerDeValor(obj);
        if (res) return res;
      } catch (e) {
        console.warn('[IaCv] No se pudo parsear el JSON extraído en escaneo:', e);
      }
    }

    return [];
  }

  private limitarPorcentaje(valor: number): number {
    return Math.max(15, Math.min(98, Math.round(valor)));
  }

  /* =======================================================
     FILTRO DE RELEVANCIA PARA MUCHAS HABILIDADES O ÁREAS
  ======================================================= */

  private construirContextoRelevancia(cv: any, areasInteres?: string[]): string {
    const experiencias = this.obtenerExperiencias(cv)
      .map(e => `${e.cargo} ${e.descripcion} ${e.lugar}`)
      .join(' ');
    const estudios = this.obtenerFormaciones(cv)
      .map(f => `${f.titulo} ${f.nivel}`)
      .join(' ');

    return [
      cv?.carrera || '',
      cv?.nivelEducativo || '',
      estudios,
      experiencias,
      ...(areasInteres || [])
    ].join(' ');
  }

  private seleccionarMasRelevantes(items: string[], textoContexto: string, maxItems: number): string[] {
    const unicos: string[] = [];
    const vistos = new Set<string>();

    for (const item of items) {
      const limpio = item.trim();
      const norm = this.normalizar(limpio);
      if (!norm || vistos.has(norm)) continue;
      vistos.add(norm);
      unicos.push(limpio);
    }

    if (unicos.length <= maxItems) return unicos;

    const tokensContexto = new Set(this.tokensSignificativos(textoContexto));
    const textoContextoNorm = ` ${this.normalizar(textoContexto)} `;

    const conPuntaje = unicos.map((item, indiceOriginal) => {
      const norm = this.normalizar(item);
      const tokensItem = this.tokensSignificativos(item);
      let puntos = 0;

      if (textoContextoNorm.includes(` ${norm} `)) {
        puntos += 3;
      }
      for (const t of tokensItem) {
        if (tokensContexto.has(t)) puntos += 1.5;
      }
      if (item.length >= 3 && item.length <= 45) {
        puntos += 0.5;
      }

      return { item, puntos, indiceOriginal };
    });

    conPuntaje.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return a.indiceOriginal - b.indiceOriginal;
    });

    return conPuntaje.slice(0, maxItems).map(x => x.item);
  }

  /* =======================================================
     RESPALDO LOCAL (OPCIÓN 2) - GENERADOR DE TEXTO DEL CV
  ======================================================= */

  private generarTextoCvLocal(datos: DatosGeneracionCv): string {
    const base = this.prepararBaseCv(datos);
    const resumen = this.construirResumenLocal(base);

    return this.armarTextoCv(base, resumen, (i) => this.dividirEnPuntos(base.experiencias[i].descripcion));
  }

  private construirResumenLocal(base: BaseCv): string {
    const partes: string[] = [];

    if (base.experiencias.length) {
      const anos = this.sumarAnos(base.experiencias);
      partes.push(
        anos > 0
          ? `Profesional con ${this.textoAnos(anos)} de trayectoria laboral.`
          : 'Profesional con experiencia laboral comprobable.'
      );
    } else {
      partes.push('Persona proactiva y con gran disposición para aprender, en búsqueda de su primera oportunidad laboral.');
    }

    // Se destaca solo la formación más avanzada (si empatan, la más reciente)
    const principal = base.formaciones.reduce<FormacionCv | null>(
      (mejor, f) => (!mejor || f.rango > mejor.rango ? f : mejor),
      null
    );
    if (principal) {
      const frase = this.frasePrincipalFormacion(principal);
      if (frase) partes.push(frase);
    }

    if (base.tecnicas.length) {
      partes.push(`Domina herramientas y conocimientos técnicos como ${this.listaNatural(base.tecnicas.slice(0, 5))}.`);
    }
    if (base.blandas.length) {
      partes.push(`Destaca por sus cualidades interpersonales en ${this.listaNatural(base.blandas.slice(0, 4))}.`);
    }
    if (base.areas.length) {
      partes.push(`Con orientación e interés hacia las áreas de ${this.listaNatural(base.areas)}.`);
    }
    partes.push('Se caracteriza por su compromiso, responsabilidad y rápida adaptación a nuevos equipos de trabajo.');

    return partes.join(' ');
  }

  private frasePrincipalFormacion(f: FormacionCv): string {
    const lugar = f.institucion ? ` (${f.institucion})` : '';

    if (f.titulo) {
      return `Cuenta con formación en ${f.titulo}${lugar}${f.enCurso ? ', actualmente en curso' : ''}.`;
    }
    if (f.nivel) {
      return `Cuenta con ${f.nivel.toLowerCase()}${f.enCurso ? ' en curso' : ''}${lugar}.`;
    }
    return f.institucion ? `Cuenta con estudios cursados en ${f.institucion}.` : '';
  }

  private dividirEnPuntos(descripcion: any): string[] {
    return String(descripcion ?? '')
      .split(/\n|•|;|\.(?=\s|$)/)
      .map(p => p.replace(/^[\s\-*•]+/, '').trim())
      .filter(p => p.length > 2)
      .slice(0, 4)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1));
  }

  private listaNatural(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
  }

  private textoAnos(anos: number): string {
    if (anos < 1) {
      const meses = Math.max(1, Math.round(anos * 12));
      return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    const redondeado = Math.round(anos * 10) / 10;
    return `${redondeado} ${redondeado === 1 ? 'año' : 'años'}`;
  }

  /* =======================================================
     RESPALDO LOCAL (OPCIÓN 2) - EVALUADOR POR REGLAS
  ======================================================= */

  private prepararPerfilLocal(perfil: any, areasUsuario: string[], textoPdfExtraido: string): PerfilLocal {
    const cv = perfil?.cvManual || {};
    const tecnicas = this.aLista(cv.habilidadesTecnicas);
    const blandas = this.aLista(cv.habilidadesBlandas);
    const experiencias = this.obtenerExperiencias(cv);
    const formaciones = this.obtenerFormaciones(cv);
    const nivel = String(cv.nivelEducativo || '');
    const carrera = String(cv.carrera || '');
    const tienePdf = !!(perfil?.cvBase64);

    const tieneDatos =
      tecnicas.length ||
      blandas.length ||
      experiencias.length ||
      formaciones.length ||
      nivel ||
      carrera ||
      textoPdfExtraido.length > 10 ||
      tienePdf;

    if (!tieneDatos) {
      throw new DatosInsuficientesError(
        'No hay datos suficientes en el perfil para evaluar.'
      );
    }

    const textoPerfil = [
      ...tecnicas,
      ...blandas,
      carrera,
      nivel,
      ...formaciones.map(f => `${f.titulo} ${f.nivel}`),
      ...(areasUsuario || []),
      ...experiencias.map(e => `${e.cargo} ${e.descripcion}`),
      textoPdfExtraido
    ].join(' ');

    const anosExpFormulario = this.sumarAnos(experiencias);
    const anosExpPdf = textoPdfExtraido ? this.anosDeTexto(textoPdfExtraido) : 0;

    return {
      textoNorm: ` ${this.normalizar(textoPerfil)} `,
      tokens: new Set(this.tokensSignificativos(textoPerfil)),
      anosExperiencia: Math.max(anosExpFormulario, anosExpPdf),
      rangoEducacion: Math.max(
        this.rangoEducacion(nivel || textoPdfExtraido),
        ...formaciones.map(f => f.rango)
      ),
      tecnicas,
      blandas
    };
  }

  private evaluarCargoLocal(perfil: PerfilLocal, cargo: any): EvaluacionCargo {
    const componentes: Componente[] = [];
    const detalle: string[] = [];
    const fTecnicas: string[] = [];
    const fExperiencia: string[] = [];
    const fEducacion: string[] = [];
    const fBlandas: string[] = [];
    const fAfinidad: string[] = [];

    const reqTecnicas = this.aLista(cargo.habilidadesTecnicas);
    if (reqTecnicas.length) {
      const r = this.puntuarHabilidades(reqTecnicas, perfil);
      componentes.push({ peso: 0.35, puntaje: r.puntaje });
      r.coincidencias.slice(0, 2).forEach(c => fTecnicas.push(`Domina o conoce: ${c}`));
      detalle.push(`coincide con ${r.coincidencias.length} de ${reqTecnicas.length} habilidades técnicas pedidas`);
    }

    const reqBlandas = this.aLista(cargo.habilidadesBlandas);
    if (reqBlandas.length) {
      const r = this.puntuarHabilidades(reqBlandas, perfil);
      componentes.push({ peso: 0.15, puntaje: r.puntaje });
      r.coincidencias.slice(0, 1).forEach(c => fBlandas.push(`Habilidad personal: ${c}`));
      detalle.push(`coincide con ${r.coincidencias.length} de ${reqBlandas.length} habilidades blandas pedidas`);
    }

    const tokensNombre = this.tokensSignificativos(cargo.nombre);
    const tokensDescripcion = this.tokensSignificativos(cargo.descripcion).slice(0, 40);
    if (tokensNombre.length || tokensDescripcion.length) {
      const a = tokensNombre.length
        ? tokensNombre.filter(t => perfil.tokens.has(t)).length / tokensNombre.length
        : 0;
      const b = Math.min(1, tokensDescripcion.filter(t => perfil.tokens.has(t)).length / 6);
      const afinidad = tokensNombre.length ? 0.6 * a + 0.4 * b : b;

      componentes.push({ peso: 0.25, puntaje: afinidad });
      if (afinidad >= 0.5) {
        fAfinidad.push('Perfil y experiencia afines al cargo');
        detalle.push('perfil afín al cargo');
      } else if (afinidad >= 0.25) {
        detalle.push('afinidad parcial con el cargo');
      } else {
        detalle.push('poca afinidad con el cargo');
      }
    }

    const minAnos = Number(cargo.anosExperienciaMinima) || 0;
    if (minAnos > 0) {
      componentes.push({ peso: 0.15, puntaje: Math.min(1, perfil.anosExperiencia / minAnos) });
      if (perfil.anosExperiencia >= minAnos) {
        fExperiencia.push(`${this.textoAnos(perfil.anosExperiencia)} de experiencia (mínimo ${minAnos})`);
        detalle.push('cumple la experiencia mínima');
      } else {
        detalle.push('tiene menos experiencia que la mínima pedida');
      }
    }

    const rangoMinimo = this.rangoEducacion(cargo.nivelEducativoMinimo);
    if (rangoMinimo > 0 && perfil.rangoEducacion > 0) {
      const puntaje = perfil.rangoEducacion >= rangoMinimo
        ? 1
        : Math.max(0, 1 - (rangoMinimo - perfil.rangoEducacion) * 0.35);
      componentes.push({ peso: 0.10, puntaje });
      if (perfil.rangoEducacion >= rangoMinimo) {
        fEducacion.push('Nivel educativo acorde a lo pedido');
        detalle.push('cumple el nivel educativo');
      } else {
        detalle.push('nivel educativo menor al pedido');
      }
    }

    const pesoTotal = componentes.reduce((s, c) => s + c.peso, 0);
    const total = pesoTotal > 0
      ? componentes.reduce((s, c) => s + c.puntaje * c.peso, 0) / pesoTotal
      : 0.45;

    const porcentaje = this.limitarPorcentaje(15 + total * 83);
    const fortalezas = [...fTecnicas, ...fExperiencia, ...fEducacion, ...fBlandas, ...fAfinidad].slice(0, 4);
    if (!fortalezas.length) {
      fortalezas.push('Interés y disponibilidad en el área laboral del cargo');
    }
    const frase = detalle.length ? detalle.join('; ') : 'afinidad general del perfil con el cargo';

    return {
      porcentajeIdoneidad: porcentaje,
      fortalezas,
      resumenIA: `Evaluación de compatibilidad del perfil: ${frase}.`,
      metodo: 'local'
    };
  }

  private puntuarHabilidades(
    requeridas: string[],
    perfil: PerfilLocal
  ): { puntaje: number; coincidencias: string[] } {
    let suma = 0;
    const coincidencias: string[] = [];

    for (const req of requeridas) {
      const reqNorm = this.normalizar(req);
      if (!reqNorm) continue;

      const tokens = this.tokensSignificativos(req);
      let p = 0;

      if (perfil.textoNorm.includes(` ${reqNorm} `)) {
        p = 1;
      } else if (tokens.length) {
        const aciertos = tokens.filter(t => perfil.tokens.has(t)).length;
        p = aciertos / tokens.length;
        if (p < 0.5) p = 0;
      }

      suma += p;
      if (p >= 0.5) coincidencias.push(req.trim());
    }

    return { puntaje: requeridas.length ? suma / requeridas.length : 0, coincidencias };
  }

  /* =======================================================
     UTILIDADES DE TEXTO
  ======================================================= */

  private aLista(valor: any): string[] {
    if (Array.isArray(valor)) {
      return valor.map(v => String(v ?? '').trim()).filter(Boolean);
    }
    if (typeof valor !== 'string') return [];
    return valor
      .split(/[,;\n•|]+/)
      .map(v => v.trim())
      .filter(v => {
        const n = this.normalizar(v);
        return n && n !== 'no especificadas' && n !== 'no especificada' && n !== 'no especificado';
      });
  }

  private normalizar(texto: any): string {
    return String(texto ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9+#\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private raiz(token: string): string {
    let t = token;
    if (t.length > 4 && t.endsWith('es')) t = t.slice(0, -2);
    else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
    return t.slice(0, 6);
  }

  private tokensSignificativos(texto: any): string[] {
    const salida: string[] = [];
    for (const palabra of this.normalizar(texto).split(' ')) {
      if (palabra.length < 3 || this.PALABRAS_VACIAS.has(palabra)) continue;
      const r = this.raiz(palabra);
      if (!salida.includes(r)) salida.push(r);
    }
    return salida;
  }

  private rangoEducacion(texto: any): number {
    const t = this.normalizar(texto);
    if (!t) return 0;
    if (/(postgrado|magister|master|doctor)/.test(t)) return 5;
    if (/\b(media|secundaria|liceo|colegio)\b/.test(t) && !/(superior|universit)/.test(t)) return 2;
    if (/(tecnic|\bcft\b|\bip\b)/.test(t)) return 3;
    if (/(universit|profesional|licenciatur|ingenier|titulo|superior)/.test(t)) return 4;
    if (/(basica|primaria|escuela)/.test(t)) return 1;
    return 0;
  }

  private sumarAnos(experiencias: any[]): number {
    const total = experiencias.reduce((suma, e) => suma + this.anosDeTexto(e?.tiempo), 0);
    return Math.min(50, Math.round(total * 10) / 10);
  }

  private anosDeTexto(texto: any): number {
    let t = this.normalizar(texto);
    if (!t) return 0;

    const numeros: { [palabra: string]: string } = {
      un: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6',
      siete: '7', ocho: '8', nueve: '9', diez: '10', doce: '12'
    };
    t = t.replace(/\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\b/g, m => numeros[m]);

    const calendario = t.match(/\b(?:19|20)\d{2}\b/g);
    if (calendario && calendario.length >= 2) {
      return Math.max(0, Number(calendario[1]) - Number(calendario[0]));
    }
    if (calendario && calendario.length === 1 && /(actual|presente|hoy)/.test(t)) {
      return Math.max(0, new Date().getFullYear() - Number(calendario[0]));
    }

    let anos = 0;
    let encontrado = false;
    const regex = /(\d+(?:[.,]\d+)?)\s*(anos?|meses|mes)\b/g;
    let coincidencia: RegExpExecArray | null;
    while ((coincidencia = regex.exec(t)) !== null) {
      encontrado = true;
      const cantidad = parseFloat(coincidencia[1].replace(',', '.'));
      anos += coincidencia[2].startsWith('ano') ? cantidad : cantidad / 12;
    }
    if (encontrado) return anos;

    if (/^\d+(?:[.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
    return 0;
  }
}