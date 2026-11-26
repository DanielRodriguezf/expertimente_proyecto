import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface OpcionRespuesta {
  texto: string;
  puntaje: number;
}

export interface PreguntaCuestionario {
  pregunta: string;
  opciones: OpcionRespuesta[];
}

@Injectable({
  providedIn: 'root'
})
export class IaGeneratorService {
  private http = inject(HttpClient);

  // Coloca aquí la API Key de Gemini / Google AI Studio que tienes en tu imagen
  private apiKey = '...'; 
  private apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

  async generarCuestionario(titulo: string, descripcion: string, requisitos: string): Promise<PreguntaCuestionario[]> {
    const prompt = `
      Eres un reclutador experto de Recursos Humanos. 
      Genera un cuestionario de selección técnica y de habilidades de 5 preguntas de selección múltiple para el siguiente cargo:
      - Título del puesto: ${titulo}
      - Descripción del puesto: ${descripcion}
      - Requisitos y Habilidades: ${requisitos}
      
      Cada pregunta debe tener exactamente 4 opciones de respuesta. Asigna un puntaje de 0 a 10 a cada opción según qué tan correcta o deseable sea la respuesta.
      
      Devuelve ÚNICAMENTE un arreglo JSON válido con la siguiente estructura exacta (sin bloques de código markdown ni texto adicional):
      [
        {
          "pregunta": "Texto de la pregunta",
          "opciones": [
            { "texto": "Opción 1", "puntaje": 10 },
            { "texto": "Opción 2", "puntaje": 5 },
            { "texto": "Opción 3", "puntaje": 2 },
            { "texto": "Opción 4", "puntaje": 0 }
          ]
        }
      ]
    `;

    const body = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    try {
      const response: any = await firstValueFrom(this.http.post(this.apiUrl, body));
      const respuestaTexto = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Limpia la respuesta por si la IA devuelve comillas o formato Markdown ```json
      const jsonLimpio = respuestaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
      const cuestionario: PreguntaCuestionario[] = JSON.parse(jsonLimpio);
      
      return cuestionario;
    } catch (error) {
      console.error('Error al generar preguntas con IA:', error);
      throw error;
    }
  }
}