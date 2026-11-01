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

/** Se lanza cuando la IA no responde Y el perfil no tiene datos de formulario para el análisis local. */
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

  private readonly MODELOS_GEMINI = [
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];

  private readonly TIMEOUT_PETICION_MS = 25000;
  private readonly PRESUPUESTO_TOTAL_MS = 40000;

  private readonly PAUSA_TRAS_FALLO_MS = 2 * 60 * 1000;

  private iaPausadaHasta = 0;
  private modelosInexistentes = new Set<string>();

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

  /** Genera el texto del CV: primero con Gemini, y si falla con una plantilla local gratuita. */
  async generarTextoCv(datos: DatosGeneracionCv): Promise<ResultadoTextoCv> {
    try {
      const texto = await this.generarTextoCvConGemini(datos);
      return { texto, metodo: 'gemini' };
    } catch (error) {
      console.warn('[IaCv] Gemini no disponible, usando generador local:', error);
      return { texto: this.generarTextoCvLocal(datos), metodo: 'local' };
    }
  }

  /**
   * Evalúa todos los cargos: primero con Gemini (una sola petición) y,
   * para los cargos que la IA no pudo evaluar, con el análisis local por reglas.
   * Lanza DatosInsuficientesError solo si no hay IA y tampoco datos de formulario.
   */
  async evaluarCargos(perfil: any, cargos: any[], areasUsuario: string[]): Promise<ResultadoEvaluacion> {
    const evaluaciones: { [cargoId: string]: EvaluacionCargo } = {};

    try {
      const porIa = await this.evaluarCargosConGemini(perfil, cargos, areasUsuario);
      Object.assign(evaluaciones, porIa);
    } catch (error) {
      console.warn('[IaCv] Gemini no disponible, usando análisis local:', error);
    }

    const pendientes = cargos.filter(c => !evaluaciones[c.id]);
    if (pendientes.length) {
      try {
        const perfilLocal = this.prepararPerfilLocal(perfil);
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
     GEMINI (OPCIÓN 1)
  ======================================================= */

  private async generarTextoCvConGemini(datos: DatosGeneracionCv): Promise<string> {
    const cv = datos.cvManual || {};

    const historialCrudo = datos.tieneExperiencia
      ? JSON.stringify(cv['areasExperiencia'])
      : 'Ninguna experiencia laboral previa. El candidato busca su primera oportunidad profesional, con gran actitud y proactividad.';

    const prompt = `Actúa como un experto reclutador corporativo. Redacta de forma profesional, clara y persuasiva el cuerpo de un currículum en español.
Datos del candidato:
- Nombre: ${datos.nombre} ${datos.apellidoPaterno}
- Formación: ${cv['nivelEducativo']} (${cv['establecimiento'] || 'Institución'})
- Habilidades Técnicas: ${cv['habilidadesTecnicas']}
- Habilidades Blandas: ${cv['habilidadesBlandas']}
- Historial o Proyección: ${historialCrudo}

Instrucciones estrictas:
1. Genera primero una sección llamada exactamente "RESUMEN PROFESIONAL" seguida de un párrafo ejecutivo breve que destaque el perfil del candidato.
2. Genera luego una sección llamada exactamente "EXPERIENCIA LABORAL" detallando la trayectoria o antecedentes laborales de forma profesional mediante viñetas con guiones (-).
3. Genera finalmente una sección llamada exactamente "COMPETENCIAS" detallando sus habilidades técnicas y blandas mediante viñetas con guiones (-).
No incluyas saludos ni explicaciones introductorias, entrega únicamente el contenido estructurado del currículum con esos títulos exactos.`;

    const data = await this.llamarGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6 }
    });

    const texto = this.extraerTexto(data);
    if (texto.length < 40 || !texto.includes('RESUMEN PROFESIONAL')) {
      throw new Error('Gemini devolvió una respuesta vacía o sin la estructura esperada');
    }
    return texto;
  }

  private async evaluarCargosConGemini(
    perfil: any,
    cargos: any[],
    areasUsuario: string[]
  ): Promise<{ [cargoId: string]: EvaluacionCargo }> {
    const cvManual = perfil?.cvManual || {};

    const experiencias = Array.isArray(cvManual.areasExperiencia)
      ? cvManual.areasExperiencia
          .map((e: any) => `- ${e.cargo || ''} en ${e.lugar || ''} (${e.tiempo || ''}): ${e.descripcion || ''}`)
          .join('\n')
      : 'Sin experiencia detallada en formulario';

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

    const prompt = `
Eres un experto en reclutamiento inclusivo de la plataforma ExpertiMente.
Evalúa el nivel de idoneidad (compatibilidad de 0 a 100) entre el Currículum del Postulante y CADA UNO de los cargos listados.

DATOS DEL POSTULANTE (Formulario de Perfil + PDF adjunto si está presente):
- Nivel educativo: ${cvManual.nivelEducativo || 'No especificado'}
- Establecimiento: ${cvManual.establecimiento || 'No especificado'}
- Carrera o especialidad: ${cvManual.carrera || 'No especificada'}
- Disponibilidad: ${cvManual.disponibilidad || 'No especificada'}
- Habilidades técnicas declaradas: ${cvManual.habilidadesTecnicas || 'No especificadas'}
- Habilidades blandas declaradas: ${cvManual.habilidadesBlandas || 'No especificadas'}
- Áreas de interés seleccionadas: ${(areasUsuario || []).join(', ')}
- Experiencia laboral declarada:
${experiencias}

LISTA DE CARGOS A EVALUAR:
${listaCargosTexto}

INSTRUCCIONES DE SALIDA:
Analiza tanto el texto anterior como el documento PDF adjunto (si se incluye) y responde ÚNICAMENTE con un arreglo JSON válido donde cada elemento tenga esta estructura exacta:
[
  {
    "cargoId": "ID exacto del cargo entregado arriba",
    "porcentajeIdoneidad": número entero entre 15 y 98,
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
    const arreglo = JSON.parse(rawText.replace(/```json|```/g, '').trim());

    const idsValidos = new Set(cargos.map(c => String(c.id)));
    const salida: { [cargoId: string]: EvaluacionCargo } = {};

    if (Array.isArray(arreglo)) {
      for (const item of arreglo) {
        const id = String(item?.cargoId ?? '');
        if (!idsValidos.has(id)) continue;

        const porcentaje = this.limitarPorcentaje(Number(item.porcentajeIdoneidad) || 50);
        const fortalezas = Array.isArray(item.fortalezas)
          ? item.fortalezas.map((f: any) => String(f).trim()).filter(Boolean).slice(0, 5)
          : [];
        const resumenIA = typeof item.resumenIA === 'string' && item.resumenIA.trim()
          ? item.resumenIA.trim()
          : `Compatibilidad del ${porcentaje}% calculada con IA.`;

        salida[id] = { porcentajeIdoneidad: porcentaje, fortalezas, resumenIA, metodo: 'gemini' };
      }
    }

    if (!Object.keys(salida).length) {
      throw new Error('Gemini no devolvió evaluaciones válidas');
    }
    return salida;
  }

  /**
   * Llamada a Gemini con: modelos en cadena, reintento ante 5xx, timeout por petición,
   * presupuesto total de tiempo y pausa temporal si todo falla (para no hacer esperar al usuario).
   */
  private async llamarGemini(body: any): Promise<any> {
    const apiKey = (environment as any)?.geminiApiKey || '';
    if (!apiKey || apiKey === 'TU_API_KEY_DE_GEMINI_AQUI') {
      throw new Error('La API Key de Gemini no está configurada en environment.ts');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Sin conexión a internet');
    }
    if (Date.now() < this.iaPausadaHasta) {
      throw new Error('IA en pausa temporal por fallos recientes');
    }

    const bodyJson = JSON.stringify(body);
    const limite = Date.now() + this.PRESUPUESTO_TOTAL_MS;
    let ultimoError: any = null;

    modelos: for (const modelo of this.MODELOS_GEMINI) {
      if (this.modelosInexistentes.has(modelo)) continue;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

      for (let intento = 1; intento <= 2; intento++) {
        if (Date.now() > limite) break modelos;

        let respuesta: Response;
        try {
          respuesta = await this.fetchConTimeout(url, bodyJson);
        } catch (err) {
          ultimoError = err;
          console.warn(`[IaCv] ${modelo}: sin respuesta (intento ${intento})`, err);
          if (intento < 2) await this.esperar(800);
          continue;
        }

        if (respuesta.ok) {
          return await respuesta.json();
        }

        ultimoError = new Error(`HTTP ${respuesta.status} en ${modelo}`);
        console.warn(`[IaCv] ${modelo}: HTTP ${respuesta.status}`);

        if (respuesta.status === 404) {
          this.modelosInexistentes.add(modelo);
          break;
        }
        if (respuesta.status === 429) {
          break; // cuota de ese modelo agotada: pasar al siguiente
        }
        if (respuesta.status >= 500) {
          if (intento < 2) await this.esperar(1000 * intento);
          continue;
        }

        // 400 / 401 / 403: llave inválida o petición rechazada. Seguir intentando no sirve.
        this.pausarIa();
        throw ultimoError;
      }
    }

    this.pausarIa();
    throw ultimoError || new Error('No fue posible conectar con Gemini');
  }

  private async fetchConTimeout(url: string, body: string): Promise<Response> {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), this.TIMEOUT_PETICION_MS);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controlador.signal
      });
    } finally {
      clearTimeout(temporizador);
    }
  }

  private pausarIa() {
    this.iaPausadaHasta = Date.now() + this.PAUSA_TRAS_FALLO_MS;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
  }

  private extraerTexto(data: any): string {
    const partes = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(partes)) return '';
    return partes.map((p: any) => p?.text || '').join('').trim();
  }

  private extraerBase64PuroDePdf(dataUrl: string): string | null {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    if (dataUrl.startsWith('data:application/pdf;base64,')) {
      return dataUrl.split(',')[1] || null;
    }
    return null;
  }

  private limitarPorcentaje(valor: number): number {
    return Math.max(15, Math.min(98, Math.round(valor)));
  }

  /* =======================================================
     RESPALDO LOCAL (OPCIÓN 2) - GENERADOR DE TEXTO DEL CV
     Devuelve el mismo formato que pide el prompt de la IA
     (RESUMEN PROFESIONAL / EXPERIENCIA LABORAL / COMPETENCIAS),
     así el código que arma el PDF funciona igual.
  ======================================================= */

  private generarTextoCvLocal(datos: DatosGeneracionCv): string {
    const cv = datos.cvManual || {};
    const tecnicas = this.aLista(cv['habilidadesTecnicas']);
    const blandas = this.aLista(cv['habilidadesBlandas']);
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
          : 'Profesional con experiencia laboral previa.'
      );
    } else {
      resumen.push('Persona proactiva y con gran disposición para aprender, que busca su primera oportunidad laboral.');
    }

    if (cv['nivelEducativo']) {
      const carrera = cv['carrera'] ? ` (${cv['carrera']})` : '';
      const establecimiento = cv['establecimiento'] ? `, cursado en ${cv['establecimiento']}` : '';
      resumen.push(`Su nivel educativo es ${cv['nivelEducativo']}${carrera}${establecimiento}.`);
    }
    if (tecnicas.length) {
      resumen.push(`Entre sus habilidades técnicas se encuentran ${this.listaNatural(tecnicas.slice(0, 5))}.`);
    }
    if (blandas.length) {
      resumen.push(`Entre sus fortalezas personales destacan ${this.listaNatural(blandas.slice(0, 4))}.`);
    }
    if (datos.areasInteres?.length) {
      resumen.push(`Le interesa desempeñarse en ${this.listaNatural(datos.areasInteres.slice(0, 3))}.`);
    }
    resumen.push('Busca aportar su compromiso, responsabilidad y capacidad de aprendizaje a su próximo equipo de trabajo.');
    lineas.push(resumen.join(' '));

    // --- EXPERIENCIA ---
    lineas.push('EXPERIENCIA LABORAL');
    if (datos.tieneExperiencia && experiencias.length) {
      for (const exp of experiencias) {
        const encabezado = [exp?.cargo, exp?.lugar, exp?.tiempo]
          .map(v => String(v ?? '').trim())
          .filter(Boolean)
          .join(' | ');
        if (encabezado) lineas.push(encabezado);
        for (const punto of this.dividirEnPuntos(exp?.descripcion)) {
          lineas.push(`- ${punto}`);
        }
      }
    } else {
      lineas.push('- Sin experiencia laboral previa: busca su primera oportunidad profesional.');
      lineas.push('- Gran actitud, proactividad y disposición para aprender en el puesto.');
    }

    // --- COMPETENCIAS ---
    lineas.push('COMPETENCIAS');
    if (tecnicas.length) lineas.push(`- Habilidades técnicas: ${tecnicas.join(', ')}.`);
    if (blandas.length) lineas.push(`- Habilidades blandas: ${blandas.join(', ')}.`);
    if (cv['disponibilidad']) lineas.push(`- Disponibilidad: ${cv['disponibilidad']}.`);
    if (!tecnicas.length && !blandas.length && !cv['disponibilidad']) {
      lineas.push('- Responsabilidad, compromiso y disposición para aprender.');
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
     Compara el perfil con lo que pide cada cargo y entrega
     el mismo formato de la IA (porcentaje, fortalezas, resumen).
     Pesos: técnicas 35 | afinidad con el cargo 25 | blandas 15 |
            años de experiencia 15 | nivel educativo 10.
     Si el cargo no especifica un criterio, ese criterio no cuenta.
  ======================================================= */

  private prepararPerfilLocal(perfil: any): PerfilLocal {
    const cv = perfil?.cvManual || {};
    const tecnicas = this.aLista(cv.habilidadesTecnicas);
    const blandas = this.aLista(cv.habilidadesBlandas);
    const experiencias: any[] = Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [];
    const nivel = String(cv.nivelEducativo || '');
    const carrera = String(cv.carrera || '');

    const tieneDatos = tecnicas.length || blandas.length || experiencias.length || nivel || carrera;
    if (!tieneDatos) {
      throw new DatosInsuficientesError(
        'El currículum solo está en PDF y la IA no está disponible para leerlo.'
      );
    }

    const textoPerfil = [
      ...tecnicas,
      ...blandas,
      carrera,
      nivel,
      ...experiencias.map(e => `${e?.cargo || ''} ${e?.descripcion || ''}`)
    ].join(' ');

    return {
      textoNorm: ` ${this.normalizar(textoPerfil)} `,
      tokens: new Set(this.tokensSignificativos(textoPerfil)),
      anosExperiencia: this.sumarAnos(experiencias),
      rangoEducacion: this.rangoEducacion(nivel),
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

    // 1) Habilidades técnicas requeridas
    const reqTecnicas = this.aLista(cargo.habilidadesTecnicas);
    if (reqTecnicas.length) {
      const r = this.puntuarHabilidades(reqTecnicas, perfil);
      componentes.push({ peso: 0.35, puntaje: r.puntaje });
      r.coincidencias.slice(0, 2).forEach(c => fTecnicas.push(`Domina o conoce: ${c}`));
      detalle.push(`coincide con ${r.coincidencias.length} de ${reqTecnicas.length} habilidades técnicas pedidas`);
    }

    // 2) Habilidades blandas requeridas
    const reqBlandas = this.aLista(cargo.habilidadesBlandas);
    if (reqBlandas.length) {
      const r = this.puntuarHabilidades(reqBlandas, perfil);
      componentes.push({ peso: 0.15, puntaje: r.puntaje });
      r.coincidencias.slice(0, 1).forEach(c => fBlandas.push(`Habilidad personal: ${c}`));
      detalle.push(`coincide con ${r.coincidencias.length} de ${reqBlandas.length} habilidades blandas pedidas`);
    }

    // 3) Afinidad general del perfil con el cargo (nombre y descripción)
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

    // 4) Años de experiencia mínimos
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

    // 5) Nivel educativo mínimo
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
      : 0.4;

    const porcentaje = this.limitarPorcentaje(15 + total * 83);
    const fortalezas = [...fTecnicas, ...fExperiencia, ...fEducacion, ...fBlandas, ...fAfinidad].slice(0, 4);
    const frase = detalle.length ? detalle.join('; ') : 'afinidad general del perfil con el cargo';

    return {
      porcentajeIdoneidad: porcentaje,
      fortalezas,
      resumenIA: `Análisis automático básico (sin IA): ${frase}.`,
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

  /** Suma los años de todas las experiencias leyendo textos como "2 años y 6 meses" o "2018 - 2021". */
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

    // Rango de años calendario: "2018 2021" o "2019 actualidad"
    const calendario = t.match(/\b(?:19|20)\d{2}\b/g);
    if (calendario && calendario.length >= 2) {
      return Math.max(0, Number(calendario[1]) - Number(calendario[0]));
    }
    if (calendario && calendario.length === 1 && /(actual|presente|hoy)/.test(t)) {
      return Math.max(0, new Date().getFullYear() - Number(calendario[0]));
    }

    // Duraciones: "3 anos", "6 meses", "2 anos 6 meses"
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

    // Solo un número: se asume que son años
    if (/^\d+(?:[.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
    return 0;
  }
}