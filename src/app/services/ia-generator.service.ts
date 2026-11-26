import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable, timer, throwError } from 'rxjs';
import { timeout, retry } from 'rxjs/operators';

export interface OpcionRespuesta {
  texto: string;
  puntaje: number;
}

export interface PreguntaCuestionario {
  pregunta: string;
  tipo?: 'seleccion' | 'texto';
  opciones: OpcionRespuesta[];
}

export interface ContextoOferta {
  titulo: string;
  cargoNombre?: string;
  descripcion: string;
  areaLaboral?: string;
  experiencia?: string;
  nivelEducativo?: string;
  jornada?: string;
  habilidades?: string;
  habilidadesTecnicas?: string;
  habilidadesBlandas?: string;
}

export interface OpcionesGeneracion {
  /** true = ignora el caché y pide preguntas nuevas a la IA */
  ignorarCache?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class IaGeneratorService {
  private http = inject(HttpClient);

  private readonly apiKey = '...';

  // El modelo no se toca.
  private readonly model = 'gemini-3.8-flash';

  // Solo una red de seguridad por si la conexión se queda colgada sin dar error (10 minutos).
  // No es un límite para la IA: ella puede pensar todo el tiempo que necesite.
  private readonly TIEMPO_MAXIMO_MS = 600000;

  // Espera máxima que aceptamos cuando Google pide esperar por el límite POR MINUTO (3 minutos).
  private readonly MAX_ESPERA_LIMITE_MINUTO_MS = 180000;
  private readonly ESPERA_LIMITE_MINUTO_POR_DEFECTO_MS = 30000;

  private readonly CACHE_PREFIX = 'expertimente_cuestionario_';
  private readonly CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

  private cacheMemoria = new Map<string, PreguntaCuestionario[]>();
  private enCurso = new Map<string, Promise<PreguntaCuestionario[]>>();

  private get apiUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  // ============================================================
  // API PÚBLICA
  // ============================================================

  async generarCuestionario(
    ctx: ContextoOferta,
    opciones: OpcionesGeneracion = {}
  ): Promise<PreguntaCuestionario[]> {
    const prompt = this.construirPrompt(ctx);
    const clave = this.hash(prompt);

    // 1. Caché (memoria + localStorage): mismos datos de oferta = mismas preguntas, sin gastar uso diario.
    if (!opciones.ignorarCache) {
      const guardado = this.leerCache(clave);
      if (guardado) {
        return guardado;
      }
    }

    // 2. Si ya hay una llamada idéntica en curso, reutilizarla (evita doble gasto por doble toque).
    const pendiente = this.enCurso.get(clave);
    if (pendiente) {
      return pendiente;
    }

    const tarea = this.pedirAGemini(prompt)
      .then(cuestionario => {
        this.guardarCache(clave, cuestionario);
        return cuestionario;
      })
      .finally(() => this.enCurso.delete(clave));

    this.enCurso.set(clave, tarea);
    return tarea;
  }

  /** true cuando Google respondió 429 por agotar el límite DIARIO gratuito (esperar un minuto no sirve). */
  esCuotaDiaria(error: any): boolean {
    return error?.status === 429 && /PerDay/i.test(this.textoError(error));
  }

  // ============================================================
  // PROMPT
  // ============================================================

  private construirPrompt(ctx: ContextoOferta): string {
    const cargo = (ctx.titulo || ctx.cargoNombre || '').trim();
    const tecnicas = (ctx.habilidades || ctx.habilidadesTecnicas || '').trim();

    const datos = [
      `- Cargo: ${cargo}`,
      `- Descripción: ${(ctx.descripcion || '').trim()}`,
      ctx.areaLaboral ? `- Área laboral: ${ctx.areaLaboral}` : '',
      ctx.experiencia ? `- Experiencia requerida: ${ctx.experiencia}` : '',
      ctx.nivelEducativo ? `- Nivel educativo: ${ctx.nivelEducativo}` : '',
      ctx.jornada ? `- Jornada: ${ctx.jornada}` : '',
      tecnicas ? `- Habilidades requeridas: ${tecnicas}` : '',
      ctx.habilidadesBlandas ? `- Habilidades blandas: ${ctx.habilidadesBlandas}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    return `Eres un Headhunter Senior experto en evaluación de talento técnico y conductual.
Diseña un cuestionario inicial, profesional y específico, para filtrar candidatos a esta oferta:

${datos}

Reglas:
- Escribe todo en español y genera exactamente 5 preguntas.
- 3 preguntas de tipo "seleccion" con 4 opciones cada una. Puntaje: 25 la óptima, 15 o 10 las regulares, 0 la incorrecta. Las 4 opciones deben ser plausibles y la óptima no debe estar siempre en la misma posición.
- 2 preguntas de tipo "texto" sobre habilidades blandas o resolución de conflictos, con "opciones": [].

Responde SOLO con un arreglo JSON válido, sin saludos ni markdown:
[{"pregunta":"...","tipo":"seleccion","opciones":[{"texto":"...","puntaje":25}]},{"pregunta":"...","tipo":"texto","opciones":[]}]`;
  }

  // ============================================================
  // LLAMADA A GEMINI
  // ============================================================

  private async pedirAGemini(prompt: string): Promise<PreguntaCuestionario[]> {
    // Sin thinkingConfig y sin maxOutputTokens: el modelo usa su razonamiento por defecto
    // y no se corta la respuesta a la mitad (una respuesta cortada gastaría un uso diario).
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // Fuerza JSON puro (sin ```json ni texto alrededor)
        responseMimeType: 'application/json'
      }
    };

    const response: any = await firstValueFrom(
      this.http.post(this.apiUrl, body).pipe(
        timeout(this.TIEMPO_MAXIMO_MS),
        retry({
          count: 3,
          delay: (error: unknown, intento: number) => this.calcularEspera(error, intento)
        })
      )
    );

    const candidato = response?.candidates?.[0];
    const partes: any[] = candidato?.content?.parts ?? [];
    const texto = partes
      .filter(p => !p?.thought && typeof p?.text === 'string')
      .map(p => p.text)
      .join('')
      .trim();

    if (!texto) {
      throw new Error('La IA devolvió una respuesta vacía.');
    }

    if (candidato?.finishReason === 'MAX_TOKENS') {
      throw new Error('La respuesta de la IA se cortó antes de terminar.');
    }

    const jsonLimpio = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
    return this.normalizar(JSON.parse(jsonLimpio));
  }

  /**
   * Decide cuánto esperar antes de reintentar (o si no vale la pena reintentar).
   * - Timeout / errores de configuración (400, 403, 404): no se reintenta.
   * - 429 por cuota DIARIA: no se reintenta (esperar no lo arregla).
   * - 429 por minuto: espera lo que indique Google (hasta 3 minutos).
   * - 500 / 503: espera 5 s, 10 s, 15 s.
   */
  private calcularEspera(error: unknown, intento: number): Observable<number> {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }

    if (error.status === 429) {
      if (this.esCuotaDiaria(error)) {
        return throwError(() => error);
      }
      const esperaGoogle = this.leerRetryDelayMs(error) ?? this.ESPERA_LIMITE_MINUTO_POR_DEFECTO_MS;
      if (esperaGoogle <= this.MAX_ESPERA_LIMITE_MINUTO_MS) {
        console.warn(`Límite por minuto. Reintentando en ${Math.ceil(esperaGoogle / 1000)}s...`);
        return timer(esperaGoogle + 1000);
      }
      return throwError(() => error);
    }

    if (error.status === 500 || error.status === 503) {
      return timer(5000 * intento);
    }

    return throwError(() => error);
  }

  private leerRetryDelayMs(error: HttpErrorResponse): number | null {
    const detalles = error.error?.error?.details;
    if (!Array.isArray(detalles)) {
      return null;
    }
    const info = detalles.find((d: any) => typeof d?.retryDelay === 'string');
    if (!info) {
      return null;
    }
    const segundos = parseFloat(info.retryDelay);
    return Number.isFinite(segundos) ? Math.ceil(segundos * 1000) : null;
  }

  // ============================================================
  // NORMALIZACIÓN DE LA RESPUESTA
  // ============================================================

  private normalizar(bruto: any): PreguntaCuestionario[] {
    const lista = Array.isArray(bruto) ? bruto : bruto?.preguntas;
    if (!Array.isArray(lista)) {
      throw new Error('La IA no devolvió un arreglo de preguntas.');
    }

    const preguntas: PreguntaCuestionario[] = lista
      .map((p: any) => {
        const opciones: OpcionRespuesta[] = Array.isArray(p?.opciones)
          ? p.opciones
              .map((o: any) => ({
                texto: String(o?.texto ?? o ?? '').trim(),
                puntaje: Number(o?.puntaje) || 0
              }))
              .filter((o: OpcionRespuesta) => o.texto !== '')
          : [];

        const esTexto = p?.tipo === 'texto' || p?.tipo === 'escrita' || opciones.length === 0;

        return {
          pregunta: String(p?.pregunta ?? p?.preguntaTexto ?? '').trim(),
          tipo: esTexto ? 'texto' : 'seleccion',
          opciones: esTexto ? [] : opciones
        } as PreguntaCuestionario;
      })
      .filter(p => p.pregunta !== '');

    if (preguntas.length === 0) {
      throw new Error('La IA no devolvió preguntas válidas.');
    }

    return preguntas;
  }

  // ============================================================
  // CACHÉ
  // ============================================================

  private leerCache(clave: string): PreguntaCuestionario[] | null {
    const enMemoria = this.cacheMemoria.get(clave);
    if (enMemoria) {
      return enMemoria;
    }

    try {
      const crudo = localStorage.getItem(this.CACHE_PREFIX + clave);
      if (!crudo) {
        return null;
      }
      const { t, data } = JSON.parse(crudo);
      if (!Array.isArray(data) || Date.now() - Number(t) > this.CACHE_TTL_MS) {
        localStorage.removeItem(this.CACHE_PREFIX + clave);
        return null;
      }
      this.cacheMemoria.set(clave, data);
      return data;
    } catch {
      return null;
    }
  }

  private guardarCache(clave: string, cuestionario: PreguntaCuestionario[]): void {
    this.cacheMemoria.set(clave, cuestionario);
    try {
      localStorage.setItem(
        this.CACHE_PREFIX + clave,
        JSON.stringify({ t: Date.now(), data: cuestionario })
      );
    } catch {
      // Si localStorage no está disponible o está lleno, basta con el caché en memoria.
    }
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  private hash(texto: string): string {
    let h = 5381;
    for (let i = 0; i < texto.length; i++) {
      h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  private textoError(error: any): string {
    try {
      return JSON.stringify(error?.error ?? error?.message ?? '');
    } catch {
      return '';
    }
  }
}