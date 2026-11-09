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

@Injectable({ providedIn: 'root' })
export class IaCvService {

  // Modelo único configurado para Google AI Studio
  private readonly MODELO_GEMINI = 'gemini-3.8-flash';

  // Topes máximos para evitar saturar el CV si el postulante agrega demasiados elementos
  private readonly MAX_AREAS_RELEVANTES = 3;
  private readonly MAX_HABILIDADES_TECNICAS = 6;
  private readonly MAX_HABILIDADES_BLANDAS = 4;

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
   * Evalúa los cargos: 1 sola petición a Gemini esperando todo el tiempo que necesite y,
   * para los cargos que la IA no pudo evaluar, usa el análisis local por reglas.
   */
  async evaluarCargos(perfil: any, cargos: any[], areasUsuario: string[]): Promise<ResultadoEvaluacion> {
    const evaluaciones: { [cargoId: string]: EvaluacionCargo } = {};

    if (!cargos.length) {
      return { evaluaciones };
    }

    const textoPdfExtraido = this.extraerTextoDePdfBase64(perfil?.cvBase64 || '');

    try {
      const porIa = await this.evaluarCargosConGemini(perfil, cargos, areasUsuario, textoPdfExtraido);
      Object.assign(evaluaciones, porIa);
    } catch (error) {
      console.warn('[IaCv] Gemini no disponible en escaneo, usando análisis local:', error);
    }

    const pendientes = cargos.filter(c => !evaluaciones[c.id]);
    if (pendientes.length) {
      try {
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
     GEMINI (OPCIÓN 1 - UN SOLO INTENTO SIN TIMEOUT)
  ======================================================= */

  private async generarTextoCvConGemini(datos: DatosGeneracionCv): Promise<string> {
    const cv = datos.cvManual || {};
    const contextoBase = this.construirContextoRelevancia(cv, datos.areasInteres);

    const todasTecnicas = this.aLista(cv['habilidadesTecnicas']);
    const todasBlandas = this.aLista(cv['habilidadesBlandas']);
    const todasAreas = this.aLista(datos.areasInteres);

    // Pre-filtramos las opciones más afines y pedimos a la IA seleccionar solo las más relevantes
    const tecnicasCandidatas = this.seleccionarMasRelevantes(todasTecnicas, contextoBase, 12);
    const blandasCandidatas = this.seleccionarMasRelevantes(todasBlandas, contextoBase, 10);
    const areasCandidatas = this.seleccionarMasRelevantes(todasAreas, contextoBase, 6);

    const experienciasFormateadas = this.formatearExperienciasParaPrompt(cv['areasExperiencia'], datos.tieneExperiencia);

    const prompt = `Actúa como un experto en redacción de currículums corporativos en español.
Redacta el contenido del currículum del candidato de forma clara, formal y persuasiva, sin inventar empresas ni títulos que no estén en los datos.

DATOS DEL CANDIDATO:
- Nombre: ${datos.nombre} ${datos.apellidoPaterno || ''}
- Nivel educativo: ${cv['nivelEducativo'] || 'No especificado'}
- Carrera o especialidad: ${cv['carrera'] || 'No especificada'}
- Institución: ${cv['establecimiento'] || 'No especificada'}
- Disponibilidad: ${cv['disponibilidad'] || 'Inmediata'}
- Áreas de interés declaradas: ${areasCandidatas.join(', ') || 'General'}
- Habilidades técnicas declaradas: ${tecnicasCandidatas.join(', ') || 'No especificadas'}
- Habilidades blandas declaradas: ${blandasCandidatas.join(', ') || 'No especificadas'}
- Experiencia laboral:
${experienciasFormateadas}

REGLAS DE SELECCIÓN DE RELEVANCIA:
1. Si el candidato declaró muchas áreas de interés, habilidades técnicas o habilidades blandas, NO las incluyas todas.
2. Selecciona ÚNICAMENTE las más relevantes y coherentes con su formación, carrera y experiencia laboral:
   - Máximo ${this.MAX_AREAS_RELEVANTES} áreas de interés principales.
   - Máximo ${this.MAX_HABILIDADES_TECNICAS} habilidades técnicas clave.
   - Máximo ${this.MAX_HABILIDADES_BLANDAS} habilidades blandas destacadas (sin repetir sinónimos).

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin bloques markdown ni asteriscos):
{
  "resumenProfesional": "Un párrafo ejecutivo de 3 a 4 oraciones en tercera persona que sintetice el perfil, formación, las áreas y fortalezas más relevantes y el valor que aporta el candidato.",
  "experiencias": [
    {
      "encabezado": "Cargo o Rol | Empresa o Institución | Periodo o Duración",
      "puntos": [
        "Descripción profesional de las funciones, logros o proyección laboral.",
        "Segundo aporte o responsabilidad destacada."
      ]
    }
  ],
  "competencias": [
    "Habilidades técnicas destacadas: (solo las más relevantes, máximo ${this.MAX_HABILIDADES_TECNICAS})",
    "Habilidades interpersonales: (solo las más relevantes, máximo ${this.MAX_HABILIDADES_BLANDAS})",
    "Disponibilidad: ..."
  ]
}`;

    const data = await this.llamarGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
    });

    const rawText = this.extraerTexto(data);
    const estructurado = this.ensamblarTextoCvDesdeRespuestaIa(rawText, datos);
    if (!estructurado || estructurado.length < 40) {
      throw new Error('Gemini devolvió una respuesta vacía o sin la estructura esperada');
    }
    return estructurado;
  }

  private formatearExperienciasParaPrompt(areasExp: any, tieneExperiencia: boolean): string {
    if (!tieneExperiencia || !Array.isArray(areasExp) || !areasExp.length) {
      return 'Sin experiencia laboral formal previa. El candidato busca su primera oportunidad laboral con alta motivación, compromiso y rápida adaptación.';
    }

    return areasExp.slice(0, 6).map((exp: any, i: number) => {
      if (typeof exp === 'string') return `${i + 1}. ${exp}`;
      const cargo = exp?.cargo || exp?.puesto || exp?.rol || exp?.area || 'Cargo desempeñado';
      const lugar = exp?.lugar || exp?.empresa || exp?.institucion || '';
      const tiempo = exp?.tiempo || exp?.duracion || exp?.periodo || exp?.anos || '';
      const desc = exp?.descripcion || exp?.funciones || exp?.detalle || '';
      return `${i + 1}. Cargo: ${cargo} | Lugar: ${lugar || 'No especificado'} | Tiempo: ${tiempo || 'No especificado'} | Detalle: ${desc || 'Funciones propias del rol'}`;
    }).join('\n');
  }

  private ensamblarTextoCvDesdeRespuestaIa(rawText: string, datos: DatosGeneracionCv): string {
    const limpio = rawText.replace(/```json|```/gi, '').trim();
    let jsonObj: any = null;

    try {
      jsonObj = JSON.parse(limpio);
    } catch {
      const inicio = limpio.indexOf('{');
      const fin = limpio.lastIndexOf('}');
      if (inicio !== -1 && fin !== -1 && fin > inicio) {
        try {
          jsonObj = JSON.parse(limpio.slice(inicio, fin + 1));
        } catch {
          jsonObj = null;
        }
      }
    }

    if (jsonObj && typeof jsonObj === 'object' && !Array.isArray(jsonObj)) {
      const lineas: string[] = [];

      // 1. RESUMEN PROFESIONAL
      const resumen = this.limpiarMarkdown(String(jsonObj.resumenProfesional || '')).replace(/\s+/g, ' ').trim();
      if (resumen) {
        lineas.push('RESUMEN PROFESIONAL');
        lineas.push(resumen);
      }

      // 2. EXPERIENCIA LABORAL
      lineas.push('EXPERIENCIA LABORAL');
      const exps = Array.isArray(jsonObj.experiencias) ? jsonObj.experiencias.slice(0, 5) : [];
      if (exps.length) {
        for (const item of exps) {
          const enc = this.limpiarMarkdown(
            item?.encabezado ||
            [item?.cargo, item?.lugar || item?.empresa, item?.tiempo || item?.periodo]
              .map(v => String(v ?? '').trim())
              .filter(Boolean)
              .join(' | ')
          );
          if (enc) lineas.push(enc);

          const puntos = Array.isArray(item?.puntos)
            ? item.puntos
            : (Array.isArray(item?.logros) ? item.logros : this.dividirEnPuntos(item?.descripcion));

          for (const p of puntos.slice(0, 4)) {
            const puntoLimpio = this.limpiarMarkdown(String(p ?? '')).replace(/^[\s\-*•]+/, '').trim();
            if (puntoLimpio) lineas.push(`- ${puntoLimpio}`);
          }
        }
      } else {
        lineas.push('- Sin experiencia laboral previa: busca su primera oportunidad profesional.');
        lineas.push('- Gran actitud, proactividad y disposición para aprender en el puesto.');
      }

      // 3. COMPETENCIAS
      lineas.push('COMPETENCIAS');
      const comps = Array.isArray(jsonObj.competencias) ? jsonObj.competencias.slice(0, 4) : [];
      if (comps.length) {
        for (const c of comps) {
          const compLimpia = this.limpiarMarkdown(String(c ?? '')).replace(/^[\s\-*•]+/, '').trim();
          if (compLimpia) lineas.push(`- ${compLimpia}`);
        }
      } else {
        const cv = datos.cvManual || {};
        const contexto = this.construirContextoRelevancia(cv, datos.areasInteres);
        const tecnicas = this.seleccionarMasRelevantes(this.aLista(cv['habilidadesTecnicas']), contexto, this.MAX_HABILIDADES_TECNICAS);
        const blandas = this.seleccionarMasRelevantes(this.aLista(cv['habilidadesBlandas']), contexto, this.MAX_HABILIDADES_BLANDAS);
        if (tecnicas.length) lineas.push(`- Habilidades técnicas: ${tecnicas.join(', ')}.`);
        if (blandas.length) lineas.push(`- Habilidades blandas: ${blandas.join(', ')}.`);
        if (cv['disponibilidad']) lineas.push(`- Disponibilidad: ${cv['disponibilidad']}.`);
      }

      return lineas.join('\n');
    }

    return this.normalizarTextoPlanoIa(limpio);
  }

  private normalizarTextoPlanoIa(texto: string): string {
    const lineasEntrada = texto.split('\n');
    const salida: string[] = [];
    let vioPrimeraSeccion = false;

    for (const raw of lineasEntrada) {
      const limpia = this.limpiarMarkdown(raw);
      if (!limpia) continue;

      const mayus = limpia.replace(/^\d+[\.\)]\s*/, '').replace(/:$/, '').trim().toUpperCase();

      if (mayus === 'RESUMEN PROFESIONAL' || mayus === 'PERFIL PROFESIONAL') {
        vioPrimeraSeccion = true;
        salida.push('RESUMEN PROFESIONAL');
        continue;
      }
      if (mayus === 'EXPERIENCIA LABORAL' || mayus === 'EXPERIENCIA' || mayus === 'HISTORIAL LABORAL') {
        vioPrimeraSeccion = true;
        salida.push('EXPERIENCIA LABORAL');
        continue;
      }
      if (mayus === 'COMPETENCIAS' || mayus === 'HABILIDADES' || mayus === 'HABILIDADES Y COMPETENCIAS') {
        vioPrimeraSeccion = true;
        salida.push('COMPETENCIAS');
        continue;
      }
      if (mayus === 'FORMACIÓN ACADÉMICA' || mayus === 'FORMACION ACADEMICA' || mayus === 'EDUCACIÓN') {
        break;
      }

      if (!vioPrimeraSeccion) continue;

      if (/^[\-*•]/.test(raw.trim())) {
        salida.push(`- ${limpia.replace(/^[\-*•\s]+/, '').trim()}`);
      } else {
        salida.push(limpia);
      }
    }

    return salida.join('\n');
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
    textoPdfExtraido: string
  ): Promise<{ [cargoId: string]: EvaluacionCargo }> {
    const cvManual = perfil?.cvManual || {};

    const experiencias = Array.isArray(cvManual.areasExperiencia) && cvManual.areasExperiencia.length
      ? cvManual.areasExperiencia
          .map((e: any) => `- ${e.cargo || ''} en ${e.lugar || ''} (${e.tiempo || ''}): ${e.descripcion || ''}`)
          .join('\n')
      : 'Sin experiencia detallada en formulario';

    const tecnicas = this.aLista(cvManual.habilidadesTecnicas).join(', ') || 'No especificadas';
    const blandas = this.aLista(cvManual.habilidadesBlandas).join(', ') || 'No especificadas';

    const bloqueTextoPdf = textoPdfExtraido
      ? `\nTEXTO DETECTADO EN EL PDF DEL POSTULANTE:\n${textoPdfExtraido.slice(0, 3500)}\n`
      : '';

    const listaCargosTexto = cargos.map((c, idx) => `
CARGO ${idx + 1}:
- cargoId: "${c.id}"
- Nombre: ${c.nombre || ''}
- Área laboral: ${c.areaLaboral || ''}
- Descripción: ${c.descripcion || ''}
- Habilidades técnicas requeridas: ${c.habilidadesTecnicas || 'No especificadas'}
- Habilidades blandas requeridas: ${c.habilidadesBlandas || 'No especificadas'}
- Nivel educativo mínimo: ${c.nivelEducativoMinimo || 'No especificado'}
- Años de experiencia mínima: ${c.anosExperienciaMinima ?? 0}`).join('\n');

    const prompt = `Eres un experto en reclutamiento inclusivo de la plataforma ExpertiMente.
Evalúa el nivel de idoneidad (compatibilidad de 0 a 100) entre el Currículum del Postulante y CADA UNO de los cargos listados.
Si el postulante declaró muchas habilidades o áreas, toma en cuenta las más relevantes para cada cargo.

DATOS DEL POSTULANTE (Formulario de Perfil + PDF adjunto si está presente):
- Nivel educativo: ${cvManual.nivelEducativo || 'No especificado'}
- Establecimiento: ${cvManual.establecimiento || 'No especificado'}
- Carrera o especialidad: ${cvManual.carrera || 'No especificada'}
- Disponibilidad: ${cvManual.disponibilidad || 'No especificada'}
- Habilidades técnicas declaradas: ${tecnicas}
- Habilidades blandas declaradas: ${blandas}
- Áreas de interés seleccionadas: ${(areasUsuario || []).join(', ')}
- Experiencia laboral declarada:
${experiencias}
${bloqueTextoPdf}
LISTA DE CARGOS A EVALUAR:
${listaCargosTexto}

INSTRUCCIONES DE SALIDA:
Analiza tanto el texto anterior como el documento PDF adjunto (si se incluye) y responde ÚNICAMENTE con un arreglo JSON válido en el mismo orden de los cargos entregados, donde cada elemento tenga esta estructura exacta:
[
  {
    "cargoId": "ID exacto del cargo entregado arriba",
    "porcentajeIdoneidad": 80,
    "fortalezas": ["máximo 4 fortalezas o coincidencias breves detectadas en el CV"],
    "resumenIA": "1 oración breve y clara para el reclutador explicando el porqué del porcentaje"
  }
]`;

    const parts: any[] = [{ text: prompt }];

    const pdfBase64 = this.extraerBase64PuroDePdf(perfil?.cvBase64 || '');
    if (pdfBase64) {
      parts.push({ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } });
    }

    const data = await this.llamarGemini({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    });

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
   */
  private async llamarGemini(body: any): Promise<any> {
    const apiKey = ((environment as any)?.geminiApiKey || '').trim();
    if (!apiKey || apiKey === 'TU_API_KEY_DE_GEMINI_AQUI') {
      throw new Error('La API Key de Gemini no está configurada en environment.ts');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Sin conexión a internet');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODELO_GEMINI}:generateContent?key=${apiKey}`;

    console.info(`[IaCv] Consultando ${this.MODELO_GEMINI} (1 único intento, esperando todo el tiempo que necesite)...`);

    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

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
    const experiencias = Array.isArray(cv?.areasExperiencia)
      ? cv.areasExperiencia.map((e: any) => `${e?.cargo || ''} ${e?.descripcion || ''} ${e?.lugar || ''}`).join(' ')
      : '';
    return [
      cv?.carrera || '',
      cv?.nivelEducativo || '',
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
    const cv = datos.cvManual || {};
    const contexto = this.construirContextoRelevancia(cv, datos.areasInteres);

    const tecnicas = this.seleccionarMasRelevantes(
      this.aLista(cv['habilidadesTecnicas']),
      contexto,
      this.MAX_HABILIDADES_TECNICAS
    );
    const blandas = this.seleccionarMasRelevantes(
      this.aLista(cv['habilidadesBlandas']),
      contexto,
      this.MAX_HABILIDADES_BLANDAS
    );
    const areasRelevantes = this.seleccionarMasRelevantes(
      this.aLista(datos.areasInteres),
      contexto,
      this.MAX_AREAS_RELEVANTES
    );

    const experiencias: any[] = Array.isArray(cv['areasExperiencia']) ? cv['areasExperiencia'] : [];
    const anosTotales = this.sumarAnos(experiencias);

    const lineas: string[] = [];

    // --- RESUMEN ---
    lineas.push('RESUMEN PROFESIONAL');
    const resumen: string[] = [];

    if (datos.tieneExperiencia && experiencias.length) {
      resumen.push(
        anosTotales >= 1
          ? `Profesional con ${this.textoAnos(anosTotales)} de trayectoria laboral.`
          : 'Profesional con experiencia laboral comprobable.'
      );
    } else {
      resumen.push('Persona proactiva y con gran disposición para aprender, en búsqueda de su primera oportunidad laboral.');
    }

    if (cv['nivelEducativo']) {
      const carrera = cv['carrera'] ? ` en ${cv['carrera']}` : '';
      const establecimiento = cv['establecimiento'] ? `, cursado en ${cv['establecimiento']}` : '';
      resumen.push(`Cuenta con formación de nivel ${cv['nivelEducativo']}${carrera}${establecimiento}.`);
    }
    if (tecnicas.length) {
      resumen.push(`Domina herramientas y conocimientos técnicos como ${this.listaNatural(tecnicas.slice(0, 5))}.`);
    }
    if (blandas.length) {
      resumen.push(`Destaca por sus cualidades interpersonales en ${this.listaNatural(blandas.slice(0, 4))}.`);
    }
    if (areasRelevantes.length) {
      resumen.push(`Con orientación e interés hacia las áreas de ${this.listaNatural(areasRelevantes)}.`);
    }
    resumen.push('Se caracteriza por su compromiso, responsabilidad y rápida adaptación a nuevos equipos de trabajo.');
    lineas.push(resumen.join(' '));

    // --- EXPERIENCIA ---
    lineas.push('EXPERIENCIA LABORAL');
    if (datos.tieneExperiencia && experiencias.length) {
      for (const exp of experiencias.slice(0, 5)) {
        if (typeof exp === 'string') {
          lineas.push(`- ${exp.trim()}`);
          continue;
        }
        const cargo = exp?.cargo || exp?.puesto || exp?.rol || exp?.area || 'Experiencia Laboral';
        const lugar = exp?.lugar || exp?.empresa || exp?.institucion || '';
        const tiempo = exp?.tiempo || exp?.duracion || exp?.periodo || '';

        const encabezado = [cargo, lugar, tiempo]
          .map(v => String(v ?? '').trim())
          .filter(Boolean)
          .join(' | ');
        if (encabezado) lineas.push(encabezado);

        const puntos = this.dividirEnPuntos(exp?.descripcion || exp?.funciones);
        if (puntos.length) {
          for (const punto of puntos) {
            lineas.push(`- ${punto}`);
          }
        } else {
          lineas.push('- Cumplimiento responsable de las labores y objetivos asignados al puesto.');
        }
      }
    } else {
      lineas.push('Proyección e Inserción Laboral');
      lineas.push('- Sin experiencia laboral formal previa: alta motivación por iniciar su trayectoria laboral.');
      lineas.push('- Disposición inmediata para capacitarse, seguir instrucciones y aportar en terreno o equipo.');
    }

    // --- COMPETENCIAS ---
    lineas.push('COMPETENCIAS');
    if (tecnicas.length) lineas.push(`- Habilidades técnicas destacadas: ${tecnicas.join(', ')}.`);
    if (blandas.length) lineas.push(`- Habilidades interpersonales: ${blandas.join(', ')}.`);
    if (cv['disponibilidad']) lineas.push(`- Disponibilidad laboral: ${cv['disponibilidad']}.`);
    if (!tecnicas.length && !blandas.length && !cv['disponibilidad']) {
      lineas.push('- Responsabilidad, compromiso y disposición para el trabajo en equipo.');
    }

    return lineas.join('\n');
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
    const experiencias: any[] = Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [];
    const nivel = String(cv.nivelEducativo || '');
    const carrera = String(cv.carrera || '');
    const tienePdf = !!(perfil?.cvBase64);

    const tieneDatos =
      tecnicas.length ||
      blandas.length ||
      experiencias.length ||
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
      ...(areasUsuario || []),
      ...experiencias.map(e => `${e?.cargo || ''} ${e?.descripcion || ''}`),
      textoPdfExtraido
    ].join(' ');

    const anosExpFormulario = this.sumarAnos(experiencias);
    const anosExpPdf = textoPdfExtraido ? this.anosDeTexto(textoPdfExtraido) : 0;

    return {
      textoNorm: ` ${this.normalizar(textoPerfil)} `,
      tokens: new Set(this.tokensSignificativos(textoPerfil)),
      anosExperiencia: Math.max(anosExpFormulario, anosExpPdf),
      rangoEducacion: this.rangoEducacion(nivel || textoPdfExtraido),
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