export interface OpcionPlantilla {
  texto: string;
  puntaje: number;
}

export interface PreguntaPlantilla {
  id: string;
  texto: string;
  tipo: 'seleccion' | 'texto';
  requerida: boolean;
  opciones: OpcionPlantilla[];
}

export interface PlantillaCuestionario {
  id: string;
  titulo: string;
  preguntas: PreguntaPlantilla[];
}

function normalizarClave(valor: string): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function crearPlantillaBase(
  id: string,
  titulo: string,
  preguntaDominio: string,
  preguntaHerramientas: string,
  opcionesHerramientas: [string, string, string]
): PlantillaCuestionario {
  return {
    id,
    titulo,
    preguntas: [
      {
        id: `${id}-1`,
        texto: `¿Cuánta experiencia laboral tienes en funciones de ${titulo}?`,
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Más de 2 años de experiencia comprobable', puntaje: 25 },
          { texto: 'Entre 1 y 2 años de experiencia', puntaje: 18 },
          { texto: 'Menos de 1 año o prácticas', puntaje: 10 },
          { texto: 'Sin experiencia laboral previa', puntaje: 0 }
        ]
      },
      {
        id: `${id}-2`,
        texto: preguntaDominio,
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Dominio alto / ejecución autónoma', puntaje: 25 },
          { texto: 'Manejo intermedio con supervisión ocasional', puntaje: 16 },
          { texto: 'Conocimientos básicos / requiere inducción', puntaje: 8 }
        ]
      },
      {
        id: `${id}-3`,
        texto: preguntaHerramientas,
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: opcionesHerramientas[0], puntaje: 25 },
          { texto: opcionesHerramientas[1], puntaje: 16 },
          { texto: opcionesHerramientas[2], puntaje: 6 }
        ]
      },
      {
        id: `${id}-4`,
        texto: '¿Cuál es tu disponibilidad horaria y adaptación a la modalidad del puesto?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Disponibilidad completa e inmediata', puntaje: 25 },
          { texto: 'Disponibilidad sujeta a horario fijo', puntaje: 16 },
          { texto: 'Disponibilidad parcial / por horas', puntaje: 8 }
        ]
      }
    ]
  };
}

/**
 * 1) PLANTILLAS POR CARGO ESPECÍFICO
 */
export const PLANTILLAS_POR_CARGO: Record<string, PlantillaCuestionario> = {
  'pastelero': {
    id: 'cargo-pastelero',
    titulo: 'Pastelero (Gastronomía)',
    preguntas: [
      {
        id: 'past-1',
        texto: '¿Cuál es tu experiencia elaborando masas dulces, bizcochos, cremas y decoración de tortas?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Más de 2 años en pastelería o producción de líneas dulces', puntaje: 25 },
          { texto: 'Entre 1 y 2 años de experiencia comprobable', puntaje: 18 },
          { texto: 'Menos de 1 año o formación práctica', puntaje: 10 },
          { texto: 'Sin experiencia previa en pastelería', puntaje: 0 }
        ]
      },
      {
        id: 'past-2',
        texto: '¿Qué dominio tienes en temperado de chocolate, uso de manga pastelera y fondant?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Dominio avanzado en temperado, manga y acabados finos', puntaje: 25 },
          { texto: 'Manejo intermedio en decoración y coberturas', puntaje: 15 },
          { texto: 'Conocimientos básicos / en aprendizaje', puntaje: 8 }
        ]
      },
      {
        id: 'past-3',
        texto: '¿Cómo aplicas las Buenas Prácticas de Manufactura (BPM), gramajes y control de mermas?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Trabajo estricto con fichas estandarizadas, pesaje exacto y protocolo BPM', puntaje: 25 },
          { texto: 'Sigo normas de higiene y medidas habituales de cocina', puntaje: 15 },
          { texto: 'Me guío por cálculo visual sin gramaje fijo', puntaje: 5 }
        ]
      },
      {
        id: 'past-4',
        texto: '¿Cuentas con disponibilidad para turnos rotativos o fines de semana en obrador?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, disponibilidad completa', puntaje: 25 },
          { texto: 'Disponibilidad solo en turno de mañana', puntaje: 15 },
          { texto: 'Solo días hábiles', puntaje: 8 }
        ]
      }
    ]
  },

  'maestro panadero': {
    id: 'cargo-maestro-panadero',
    titulo: 'Maestro Panadero (Gastronomía)',
    preguntas: [
      {
        id: 'pan-1',
        texto: '¿Cuánta experiencia tienes en panadería artesanal o industrial (amasado, leudado y horneado)?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: '2 años o más como maestro panadero o encargado de producción', puntaje: 25 },
          { texto: 'Entre 1 y 2 años como ayudante avanzado de panadería', puntaje: 18 },
          { texto: 'Menos de 1 año de experiencia', puntaje: 8 }
        ]
      },
      {
        id: 'pan-2',
        texto: '¿Cuál es tu nivel de manejo con masa madre, porcentajes de hidratación y control de fermentación?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Manejo experto de masa madre, fermentaciones largas e hidratación', puntaje: 25 },
          { texto: 'Conozco masas tradicionales y bollería básica', puntaje: 15 },
          { texto: 'Solo he trabajado con premezclas industriales', puntaje: 8 }
        ]
      },
      {
        id: 'pan-3',
        texto: '¿Tienes experiencia operando hornos industriales rotativos o de piso y controlando curvas de cocción?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, opero y regulo temperatura y vapor de forma autónoma', puntaje: 25 },
          { texto: 'Sí, bajo supervisión del jefe de turno', puntaje: 15 },
          { texto: 'No he operado hornos industriales', puntaje: 5 }
        ]
      },
      {
        id: 'pan-4',
        texto: '¿Cómo te adaptas a turnos tempranos/madrugada y ritmo físico continuo?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Totalmente acostumbrado/a a turnos de madrugada', puntaje: 25 },
          { texto: 'Puedo adaptarme sin inconvenientes', puntaje: 18 },
          { texto: 'Prefiero exclusivamente horarios diurnos administrativos', puntaje: 5 }
        ]
      }
    ]
  },

  'encargado de heladeria': {
    id: 'cargo-encargado-heladeria',
    titulo: 'Encargado de Heladería (Gastronomía)',
    preguntas: [
      {
        id: 'hel-1',
        texto: '¿Tienes experiencia previa en elaboración de helados, pasteurización o mantecación de bases?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, más de 1 año en producción y mantecación de helados', puntaje: 25 },
          { texto: 'Experiencia en vitrina, servicio y apoyo en obrador', puntaje: 16 },
          { texto: 'Sin experiencia en heladería, pero con base gastronómica', puntaje: 10 }
        ]
      },
      {
        id: 'hel-2',
        texto: '¿Qué nivel de conocimiento tienes sobre control de cadena de frío, inocuidad y BPM?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Conozco rangos térmicos de conservación, vitrinas y sanitización BPM', puntaje: 25 },
          { texto: 'Tengo nociones generales de higiene y refrigeración', puntaje: 15 },
          { texto: 'Requiero capacitación completa desde cero', puntaje: 5 }
        ]
      },
      {
        id: 'hel-3',
        texto: '¿Comprendes conceptos como formulación de bases, balanceo o control de overrun (aire)?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, los aplico en la producción diaria', puntaje: 25 },
          { texto: 'Tengo nociones teóricas básicas', puntaje: 15 },
          { texto: 'No los conozco aún', puntaje: 5 }
        ]
      },
      {
        id: 'hel-4',
        texto: 'Si notas una fluctuación de temperatura en la vitrina en hora punta, ¿cuál es tu prioridad?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Verificar termostato, resguardar producto en cámara y reportar de inmediato', puntaje: 25 },
          { texto: 'Seguir atendiendo y revisar al cierre del turno', puntaje: 5 },
          { texto: 'Avisar a un compañero cuando haya menos público', puntaje: 10 }
        ]
      }
    ]
  },

  'alfarero / ceramista': {
    id: 'cargo-alfarero-ceramista',
    titulo: 'Alfarero / Ceramista (Artesanía)',
    preguntas: [
      {
        id: 'alf-1',
        texto: '¿Cuál es tu experiencia en preparación de arcilla (amasado/cuña) y modelado en torno alfarero?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Más de 2 años produciendo piezas en torno alfarero', puntaje: 25 },
          { texto: 'Entre 1 y 2 años de práctica en taller cerámico', puntaje: 18 },
          { texto: 'Experiencia inicial o solo modelado manual sin torno', puntaje: 10 }
        ]
      },
      {
        id: 'alf-2',
        texto: '¿Qué dominio tienes sobre engobes, esmaltado y control de secado para evitar fisuras?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Dominio completo de tiempos de secado, engobes y esmaltes', puntaje: 25 },
          { texto: 'Manejo básico de esmaltado por inmersión o pincel', puntaje: 15 },
          { texto: 'Sin experiencia en esmaltes cerámicos', puntaje: 5 }
        ]
      },
      {
        id: 'alf-3',
        texto: '¿Has realizado estiba (carga) y control de curvas de temperatura en hornos cerámicos?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, programo y superviso quemas de bizcocho y esmalte', puntaje: 25 },
          { texto: 'He ayudado a cargar hornos siguiendo instrucciones', puntaje: 15 },
          { texto: 'No he operado hornos cerámicos', puntaje: 5 }
        ]
      },
      {
        id: 'alf-4',
        texto: '¿Cómo describes tu precisión manual y constancia para producir lotes homogéneos?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Alta motricidad fina, uso calibradores/plantillas y mantengo medidas exactas', puntaje: 25 },
          { texto: 'Buena terminación artesanal con ligeras variaciones', puntaje: 18 },
          { texto: 'Prefiero piezas únicas sin medida estándar', puntaje: 10 }
        ]
      }
    ]
  },

  'secretaria / asistente administrativa': {
    id: 'cargo-secretaria',
    titulo: 'Secretaria / Asistente Administrativa (Administración)',
    preguntas: [
      {
        id: 'sec-1',
        texto: '¿Cuánta experiencia tienes en gestión de agenda, atención telefónica/presencial y apoyo administrativo?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Más de 2 años en secretaría o asistencia ejecutiva', puntaje: 25 },
          { texto: 'Entre 1 y 2 años en recepción o labores administrativas', puntaje: 18 },
          { texto: 'Menos de 1 año o prácticas profesionales', puntaje: 10 }
        ]
      },
      {
        id: 'sec-2',
        texto: '¿Cuál es tu nivel de manejo en Office (Word, Excel), correo corporativo y agendas digitales?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Avanzado: redacción formal, tablas en Excel y gestión de calendarios', puntaje: 25 },
          { texto: 'Intermedio: uso fluido de correo, documentos y planillas básicas', puntaje: 18 },
          { texto: 'Básico: necesito apoyo frecuente', puntaje: 5 }
        ]
      },
      {
        id: 'sec-3',
        texto: '¿Tienes experiencia en archivo documental, facturación básica o coordinación de reuniones?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, gestiono archivo físico/digital y apoyo en facturación', puntaje: 25 },
          { texto: 'Solo archivo y coordinación de salas/reuniones', puntaje: 16 },
          { texto: 'Sin experiencia en esas tareas', puntaje: 5 }
        ]
      },
      {
        id: 'sec-4',
        texto: 'Ante múltiples solicitudes urgentes al mismo tiempo, ¿cómo organizas tu trabajo?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Priorizo por urgencia/impacto, registro en lista y confirmo plazos', puntaje: 25 },
          { texto: 'Resuelvo en estricto orden de llegada', puntaje: 15 },
          { texto: 'Espero que me indiquen qué hacer primero', puntaje: 8 }
        ]
      }
    ]
  },

  'digitador / operador de ingreso de datos': {
    id: 'cargo-digitador',
    titulo: 'Digitador / Operador de Ingreso de Datos (Administración)',
    preguntas: [
      {
        id: 'dig-1',
        texto: '¿Cuál es tu experiencia realizando ingreso masivo de datos, digitalización y validación de registros?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Más de 1 año en digitación de alto volumen y control de calidad', puntaje: 25 },
          { texto: 'Experiencia administrativa con carga periódica de datos', puntaje: 16 },
          { texto: 'Sin experiencia laboral como digitador/a', puntaje: 5 }
        ]
      },
      {
        id: 'dig-2',
        texto: '¿Qué nivel de dominio tienes en Excel y Google Sheets (filtros, fórmulas, validación de datos)?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Avanzado: fórmulas, cruces de bases de datos y depuración', puntaje: 25 },
          { texto: 'Intermedio: filtros, ordenamiento y formato de planillas', puntaje: 16 },
          { texto: 'Básico: solo escritura en celdas', puntaje: 6 }
        ]
      },
      {
        id: 'dig-3',
        texto: '¿Has trabajado con sistemas ERP o bases de datos empresariales?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, tengo experiencia ingresando y auditando registros en ERP/CRM', puntaje: 25 },
          { texto: 'He usado formularios web y planillas compartidas', puntaje: 15 },
          { texto: 'No tengo experiencia con sistemas de gestión', puntaje: 5 }
        ]
      },
      {
        id: 'dig-4',
        texto: '¿Cómo aseguras la precisión y ausencia de errores cuando digitas grandes volúmenes de información?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Aplico doble verificación, reglas de validación y revisión por lotes', puntaje: 25 },
          { texto: 'Reviso al azar al finalizar la jornada', puntaje: 12 },
          { texto: 'Priorizo la velocidad por sobre la revisión', puntaje: 5 }
        ]
      }
    ]
  },

  'profesor de lenguaje y comunicacion': {
    id: 'cargo-profesor-lenguaje',
    titulo: 'Profesor de Lenguaje y Comunicación (Educación)',
    preguntas: [
      {
        id: 'edu-1',
        texto: '¿Cuentas con título profesional en Pedagogía en Lenguaje/Castellano y experiencia en aula?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Título universitario y más de 1 año de experiencia docente en aula', puntaje: 25 },
          { texto: 'Título universitario con experiencia en prácticas o reemplazos', puntaje: 18 },
          { texto: 'Egresado/a en proceso de titulación', puntaje: 10 }
        ]
      },
      {
        id: 'edu-2',
        texto: '¿Qué experiencia tienes en planificación curricular, evaluación formativa y fomento de comprensión lectora?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Diseño unidades completas, rúbricas formativas y planes lectores', puntaje: 25 },
          { texto: 'Adapto planificaciones existentes y aplico evaluaciones estándar', puntaje: 16 },
          { texto: 'Experiencia inicial en diseño curricular', puntaje: 8 }
        ]
      },
      {
        id: 'edu-3',
        texto: '¿Aplicas estrategias de Diseño Universal para el Aprendizaje (DUA) y adecuaciones curriculares?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, integro DUA y diversificación de aula de forma habitual', puntaje: 25 },
          { texto: 'Conozco el marco DUA y lo aplico ocasionalmente', puntaje: 15 },
          { texto: 'Tengo nociones teóricas básicas', puntaje: 8 }
        ]
      },
      {
        id: 'edu-4',
        texto: '¿Cómo abordas el manejo de grupo y la resolución de conflictos dentro de la sala de clases?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Mediación dialogante, normas claras y comunicación asertiva con estudiantes', puntaje: 25 },
          { texto: 'Derivación inmediata a inspectoría o convivencia escolar', puntaje: 12 },
          { texto: 'Sanciones disciplinarias directas', puntaje: 5 }
        ]
      }
    ]
  },

  'costurera / operaria de confeccion': {
    id: 'cargo-costurera',
    titulo: 'Costurera / Operaria de Confección (Textil)',
    preguntas: [
      {
        id: 'tex-1',
        texto: '¿Cuál es tu experiencia en armado y ensamblaje de prendas en taller o producción textil?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Más de 1 año trabajando en confección por producción o taller', puntaje: 25 },
          { texto: 'Experiencia en arreglos, composturas o confección independiente', puntaje: 18 },
          { texto: 'Conocimientos básicos de costura doméstica', puntaje: 8 }
        ]
      },
      {
        id: 'tex-2',
        texto: '¿Qué máquinas industriales de costura manejas con fluidez?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Máquina recta, overlock (remalladora) y collaretera/especial', puntaje: 25 },
          { texto: 'Máquina recta y overlock industrial', puntaje: 20 },
          { texto: 'Solo máquina recta familiar o industrial básica', puntaje: 12 }
        ]
      },
      {
        id: 'tex-3',
        texto: '¿Tienes conocimientos de interpretación de moldes, patronaje y control de calidad de terminaciones?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Sí, interpreto fichas/moldes y reviso tensiones, dobladillos y costuras', puntaje: 25 },
          { texto: 'Sigo piezas ya cortadas cuidando las terminaciones', puntaje: 16 },
          { texto: 'Necesito guía constante para el ensamblaje', puntaje: 6 }
        ]
      },
      {
        id: 'tex-4',
        texto: '¿Cómo equilibras la rapidez de producción con la prolijidad en las terminaciones?',
        tipo: 'seleccion',
        requerida: true,
        opciones: [
          { texto: 'Mantengo ritmo constante de taller sin descuidar tensión ni remates', puntaje: 25 },
          { texto: 'Trabajo prolijo pero a ritmo lento', puntaje: 15 },
          { texto: 'Priorizo terminar rápido aunque queden detalles', puntaje: 5 }
        ]
      }
    ]
  }
};

/**
 * 2) PLANTILLAS POR ÁREA LABORAL (Cubre las 49 áreas de CARGOS_POR_AREA + alias de Firestore)
 */
const PLANTILLA_ADMINISTRACION = crearPlantillaBase(
  'area-administracion',
  'Administración y Oficina',
  '¿Qué nivel de autonomía tienes en gestión documental, agendas y atención a público interno/externo?',
  '¿Cuál es tu dominio en herramientas de oficina (Word, Excel, correo corporativo y planillas)?',
  [
    'Avanzado: fórmulas en Excel, redacción formal y agendas digitales',
    'Intermedio: uso fluido de correo, documentos y planillas básicas',
    'Básico: necesito apoyo frecuente'
  ]
);

const PLANTILLA_TEXTIL = crearPlantillaBase(
  'area-textil',
  'Textil y Confección',
  '¿Qué nivel de experiencia tienes en confección, patronaje o armado de prendas/artículos textiles?',
  '¿Qué maquinaria textil sabes operar con fluidez?',
  [
    'Recta industrial, overlock/remalladora y máquinas especiales',
    'Recta y overlock industrial',
    'Solo máquina recta doméstica o básica'
  ]
);

export const PLANTILLAS_POR_AREA: Record<string, PlantillaCuestionario> = {
  // Áreas activas en Firestore
  'administracion': PLANTILLA_ADMINISTRACION,
  'administracion y oficina': PLANTILLA_ADMINISTRACION,
  'textil': PLANTILLA_TEXTIL,
  'textil y moda': PLANTILLA_TEXTIL,

  'artesania': crearPlantillaBase(
    'area-artesania',
    'Artesanía y Oficios Manuales',
    '¿Qué nivel de dominio tienes en preparación de materias primas, herramientas de taller y acabados?',
    '¿Cómo evalúas tu motricidad fina, paciencia y precisión en producción manual?',
    [
      'Muy alta: mantengo medidas, pulso y calidad homogénea en lotes',
      'Buena terminación artesanal con supervisión puntual',
      'Nivel inicial en aprendizaje'
    ]
  ),

  'gastronomia': crearPlantillaBase(
    'area-gastronomia',
    'Gastronomía y Producción Alimentaria',
    '¿Conoces y aplicas normas de higiene, manipulación de alimentos y Buenas Prácticas de Manufactura (BPM)?',
    '¿Tienes experiencia trabajando con recetas estandarizadas, gramajes y control de mermas?',
    [
      'Sí, trabajo estricto con pesaje exacto, fichas técnicas y BPM',
      'Ocasionalmente en preparaciones habituales',
      'Sin experiencia con fichas técnicas o BPM'
    ]
  ),

  'educacion': crearPlantillaBase(
    'area-educacion',
    'Educación y Docencia',
    '¿Qué experiencia tienes en planificación de clases, evaluación formativa y manejo de grupo en aula?',
    '¿Aplicas estrategias de inclusión educativa y Diseño Universal para el Aprendizaje (DUA)?',
    [
      'Sí, diseño planificaciones con DUA y adecuaciones curriculares',
      'Adapto planificaciones existentes con apoyo del equipo',
      'Nociones teóricas básicas'
    ]
  ),

  // Resto de áreas de CARGOS_POR_AREA
  'gerencia y direccion': crearPlantillaBase(
    'area-gerencia',
    'Gerencia y Dirección',
    '¿Cuántos años has liderado equipos multidisciplinarios, presupuestos y cumplimiento de KPIs estratégicos?',
    '¿Cuál es tu experiencia en planificación operacional y toma de decisiones ejecutivas?',
    [
      'Dirección integral de áreas/unidades con resultados medibles',
      'Supervisión de equipos operativos y reporte a gerencia',
      'Experiencia inicial en coordinación'
    ]
  ),

  'contabilidad y finanzas': crearPlantillaBase(
    'area-finanzas',
    'Contabilidad y Finanzas',
    '¿Qué dominio tienes en balances, conciliaciones bancarias, impuestos (IVA/Renta) y análisis financiero?',
    '¿Qué sistemas contables y herramientas de análisis manejas?',
    [
      'ERP contables (SAP, Softland, Defontana) y Excel avanzado',
      'Software contable básico y planillas intermedias',
      'Solo registros contables simples'
    ]
  ),

  'banca y seguros': crearPlantillaBase(
    'area-banca',
    'Banca y Seguros',
    '¿Qué experiencia tienes en evaluación comercial/crediticia, colocación de productos financieros o pólizas?',
    '¿Conoces la normativa vigente de cumplimiento, riesgo financiero y atención de cartera?',
    [
      'Amplio manejo de cartera, evaluación de riesgo y normativa',
      'Experiencia comercial en productos financieros básicos',
      'Sin experiencia previa en banca o seguros'
    ]
  ),

  'recursos humanos': crearPlantillaBase(
    'area-rrhh',
    'Recursos Humanos',
    '¿En qué subsistemas de RR.HH. tienes mayor experiencia (reclutamiento, remuneraciones, DO o bienestar)?',
    '¿Qué dominio tienes de legislación laboral vigente y plataformas de gestión de personas?',
    [
      'Dominio integral de Código del Trabajo, contratos, finiquitos y selección',
      'Experiencia enfocada en entrevistas o apoyo administrativo de personal',
      'Conocimientos teóricos iniciales'
    ]
  ),

  'ventas y comercial': crearPlantillaBase(
    'area-ventas',
    'Ventas y Comercial',
    '¿Cuál es tu experiencia cumpliendo metas comerciales, prospección y cierre de ventas?',
    '¿Manejas herramientas CRM, cotizaciones y seguimiento de cartera de clientes?',
    [
      'Sí, gestión completa de embudo comercial en CRM y negociación',
      'Experiencia en venta directa/mesón sin CRM formal',
      'Sin experiencia previa en ventas'
    ]
  ),

  'atencion al cliente': crearPlantillaBase(
    'area-atencion-cliente',
    'Atención al Cliente',
    '¿Cómo gestionas reclamos, consultas complejas y fidelización de clientes bajo alta demanda?',
    '¿Tienes experiencia usando plataformas omnicanal, ticketing o sistemas de Call/Contact Center?',
    [
      'Sí, manejo fluido de CRM/ticketing y resolución en primer contacto',
      'Atención presencial o telefónica con registro básico',
      'Sin experiencia previa en servicio al cliente'
    ]
  ),

  'retail y comercio': crearPlantillaBase(
    'area-retail',
    'Retail y Comercio',
    '¿Tienes experiencia en sala de ventas, reposición, inventario o cuadratura de caja?',
    '¿Manejas terminales POS (Transbank), lectores de código y protocolos de apertura/cierre de local?',
    [
      'Sí, manejo completo de caja, POS, inventario y atención en sala',
      'Experiencia en reposición y apoyo en tienda',
      'Sin experiencia previa en retail'
    ]
  ),

  'marketing': crearPlantillaBase(
    'area-marketing',
    'Marketing',
    '¿Qué experiencia tienes ejecutando campañas digitales, posicionamiento de marca o generación de leads?',
    '¿Qué herramientas de analítica y pauta manejas (Meta Ads, Google Ads, GA4, SEO/CRM)?',
    [
      'Gestión autónoma de campañas, métricas de conversión y analítica',
      'Apoyo en contenidos y campañas básicas',
      'Conocimientos teóricos iniciales'
    ]
  ),

  'comunicaciones': crearPlantillaBase(
    'area-comunicaciones',
    'Comunicaciones',
    '¿Cuál es tu experiencia en redacción corporativa, gestión de prensa o estrategia de redes sociales?',
    '¿Qué herramientas de edición, planificación de contenidos y monitoreo de medios utilizas?',
    [
      'Dominio de parrillas editoriales, redacción periodística y herramientas digitales',
      'Gestión básica de publicaciones y comunicados',
      'Experiencia inicial en comunicaciones'
    ]
  ),

  'informatica y software': crearPlantillaBase(
    'area-software',
    'Informática y Software',
    '¿Cuál es tu nivel de autonomía diseñando, desarrollando y desplegando aplicaciones o servicios?',
    '¿Qué dominio tienes de control de versiones (Git), pruebas automatizadas y arquitectura limpia?',
    [
      'Dominio sólido de Git, APIs, bases de datos y buenas prácticas',
      'Desarrollo funcional con apoyo en arquitectura o despliegue',
      'Nivel junior / proyectos académicos'
    ]
  ),

  'soporte ti': crearPlantillaBase(
    'area-soporte-ti',
    'Soporte TI',
    '¿Cuál es tu experiencia resolviendo incidencias de hardware, software, redes y soporte a usuarios?',
    '¿Manejas sistemas de tickets, Active Directory / Microsoft 365 y diagnóstico remoto?',
    [
      'Sí, resolución nivel 1-2, administración de cuentas y redes locales',
      'Soporte básico de equipos, impresoras y formateo',
      'Conocimientos iniciales de computación'
    ]
  ),

  'redes y telecomunicaciones': crearPlantillaBase(
    'area-redes',
    'Redes y Telecomunicaciones',
    '¿Qué experiencia tienes en instalación, configuración y mantenimiento de infraestructura de red o fibra óptica?',
    '¿Manejas equipamiento (routers, switches, fusionadoras, certificadores) y protocolos TCP/IP?',
    [
      'Dominio técnico en terreno/NOC, configuración y certificación',
      'Apoyo en cableado estructurado e instalaciones básicas',
      'Sin experiencia práctica en redes'
    ]
  ),

  'ciberseguridad': crearPlantillaBase(
    'area-ciberseguridad',
    'Ciberseguridad',
    '¿Cuál es tu experiencia en monitoreo de incidentes (SOC), análisis de vulnerabilidades o gobierno de seguridad?',
    '¿Qué herramientas y marcos normativos manejas (SIEM, ISO 27001, OWASP, pentesting)?',
    [
      'Experiencia comprobable en respuesta a incidentes, auditoría y normas',
      'Conocimientos intermedios en hardening y análisis básico',
      'Formación teórica sin experiencia operativa'
    ]
  ),

  'datos y business intelligence': crearPlantillaBase(
    'area-datos',
    'Datos y Business Intelligence',
    '¿Cuál es tu experiencia construyendo modelos de datos, procesos ETL y tableros ejecutivos?',
    '¿Qué nivel de dominio tienes en SQL, Python/R y herramientas BI (Power BI, Tableau, Looker)?',
    [
      'Avanzado: consultas SQL complejas, modelado y dashboards automatizados',
      'Intermedio: reportes en Power BI/Excel y consultas básicas',
      'Nivel inicial en análisis de datos'
    ]
  ),

  'inteligencia artificial': crearPlantillaBase(
    'area-ia',
    'Inteligencia Artificial',
    '¿Qué experiencia tienes entrenando, integrando o evaluando modelos de Machine Learning / LLMs en producción?',
    '¿Qué frameworks y pipelines manejas (Python, PyTorch/TensorFlow, APIs LLM, MLOps)?',
    [
      'Despliegue en producción, evaluación de modelos y pipelines de datos',
      'Prototipado e integración de APIs de IA',
      'Exploración académica inicial'
    ]
  ),

  'cloud y devops': crearPlantillaBase(
    'area-devops',
    'Cloud y DevOps',
    '¿Cuál es tu experiencia administrando infraestructura cloud, contenedores y pipelines CI/CD?',
    '¿Qué tecnologías dominas (AWS/Azure/GCP, Docker, Kubernetes, Terraform)?',
    [
      'Automatización completa CI/CD, IaC y orquestación en producción',
      'Despliegues básicos en nube y manejo de contenedores',
      'Conocimientos introductorios'
    ]
  ),

  'qa y testing': crearPlantillaBase(
    'area-qa',
    'QA y Testing',
    '¿Cuál es tu experiencia diseñando planes de prueba, reportando bugs y validando criterios de aceptación?',
    '¿Manejas herramientas de automatización y pruebas de API (Cypress, Playwright, Selenium, Postman)?',
    [
      'Sí, automatización de pruebas funcionales/API y gestión en Jira',
      'Ejecución de pruebas manuales y reporte de incidencias',
      'Sin experiencia formal en QA'
    ]
  ),

  'gestion de proyectos y producto': crearPlantillaBase(
    'area-proyectos',
    'Gestión de Proyectos y Producto',
    '¿Cuál es tu experiencia liderando cronogramas, alcance, riesgos y comunicación con stakeholders?',
    '¿Qué marcos metodológicos y herramientas dominas (Scrum, Kanban, PMI, Jira/Notion)?',
    [
      'Liderazgo comprobable de proyectos/productos end-to-end',
      'Coordinación de tareas y seguimiento de equipos',
      'Conocimiento teórico de metodologías ágiles'
    ]
  ),

  'diseno': crearPlantillaBase(
    'area-diseno',
    'Diseño',
    '¿Cuál es tu experiencia creando piezas gráficas, interfaces digitales o productos centrados en el usuario?',
    '¿Qué nivel de dominio tienes en herramientas de diseño (Figma, Adobe Creative Cloud, prototipado)?',
    [
      'Dominio avanzado y portafolio comprobable en proyectos reales',
      'Manejo intermedio de herramientas gráficas/UI',
      'Nivel inicial / en formación'
    ]
  ),

  'logistica y bodega': crearPlantillaBase(
    'area-logistica',
    'Logística y Bodega',
    '¿Tienes experiencia en recepción, almacenamiento, picking/packing y despacho de mercadería?',
    '¿Manejas sistemas WMS/radiofrecuencia, inventarios cíclicos o maquinaria (grúa horquilla/transpaleta)?',
    [
      'Sí, manejo fluido de WMS, inventarios y operación de bodega',
      'Experiencia en picking, orden y carga/descarga manual',
      'Sin experiencia previa en bodega'
    ]
  ),

  'supply chain y compras': crearPlantillaBase(
    'area-supply-chain',
    'Supply Chain y Compras',
    '¿Cuál es tu experiencia negociando con proveedores, gestionando órdenes de compra y controlando stock?',
    '¿Qué herramientas utilizas para planificación de demanda y abastecimiento (ERP, Excel avanzado)?',
    [
      'Dominio de ERP, proyección de demanda y evaluación de proveedores',
      'Emisión de órdenes de compra y seguimiento de entregas',
      'Experiencia inicial en abastecimiento'
    ]
  ),

  'produccion y manufactura': crearPlantillaBase(
    'area-produccion',
    'Producción y Manufactura',
    '¿Cuál es tu experiencia operando líneas de producción, maquinaria industrial y cumpliendo metas de turno?',
    '¿Conoces protocolos de seguridad industrial, orden 5S y control básico de procesos?',
    [
      'Sí, experiencia continua en planta industrial y normas de seguridad',
      'Apoyo en envasado, etiquetado o línea manual',
      'Sin experiencia previa en planta'
    ]
  ),

  'calidad': crearPlantillaBase(
    'area-calidad',
    'Calidad',
    '¿Cuál es tu experiencia realizando inspecciones, auditorías y control de estándares de calidad?',
    '¿Conoces normas ISO, registros de no conformidades y calibración/medición técnica?',
    [
      'Dominio de protocolos de inspección, ISO y trazabilidad',
      'Control visual y registro de planillas de calidad',
      'Sin experiencia en aseguramiento de calidad'
    ]
  ),

  'mantenimiento industrial': crearPlantillaBase(
    'area-mantenimiento',
    'Mantenimiento Industrial',
    '¿Cuál es tu experiencia ejecutando mantenimiento preventivo y correctivo en maquinaria o instalaciones?',
    '¿Qué nivel de dominio tienes en lectura de planos, diagnóstico electromecánico y bloqueo LOTO?',
    [
      'Diagnóstico autónomo, mantenimiento preventivo/correctivo y seguridad LOTO',
      'Apoyo técnico en reparaciones y lubricación',
      'Conocimientos básicos de herramientas'
    ]
  ),

  'construccion': crearPlantillaBase(
    'area-construccion',
    'Construcción',
    '¿Cuál es tu experiencia en obra gruesa, terminaciones, instalaciones o supervisión en terreno?',
    '¿Sabes interpretar planos/especificaciones técnicas y cumples estrictamente normas de seguridad en obra?',
    [
      'Amplia experiencia en obra, lectura de planos y uso seguro de herramientas',
      'Experiencia como ayudante o maestro en partidas específicas',
      'Sin experiencia previa en construcción'
    ]
  ),

  'electricidad y electronica': crearPlantillaBase(
    'area-electricidad',
    'Electricidad y Electrónica',
    '¿Cuál es tu experiencia en montaje eléctrico, tableros, instrumentación o automatización?',
    '¿Cuentas con certificación SEC o dominio en lectura de diagramas unilineales y medición?',
    [
      'Certificación/dominio técnico en tableros, diagnóstico y normativa vigente',
      'Instalaciones eléctricas domiciliarias o apoyo industrial',
      'Conocimientos teóricos iniciales'
    ]
  ),

  'mecanica': crearPlantillaBase(
    'area-mecanica',
    'Mecánica',
    '¿Cuál es tu experiencia diagnosticando y reparando sistemas mecánicos, hidráulicos o motores?',
    '¿Qué herramientas de diagnóstico, escáner o metrología manejas con precisión?',
    [
      'Diagnóstico completo, desmontaje y reparación autónoma',
      'Mantenimiento preventivo (frenos, cambios, ajustes básicos)',
      'Ayudante en formación'
    ]
  ),

  'climatizacion': crearPlantillaBase(
    'area-climatizacion',
    'Climatización',
    '¿Cuál es tu experiencia en instalación y mantenimiento de equipos HVAC, chiller o aire acondicionado?',
    '¿Manejas gases refrigerantes, soldadura de cobre, vacío y medición de presiones?',
    [
      'Dominio completo en instalación, carga de refrigerante y diagnóstico HVAC',
      'Mantenimiento preventivo y limpieza de unidades',
      'Sin experiencia previa en climatización'
    ]
  ),

  'mineria': crearPlantillaBase(
    'area-mineria',
    'Minería',
    '¿Cuentas con experiencia en faena minera (rajo o subterránea), planta o operación de maquinaria pesada?',
    '¿Conoces estándares de seguridad minera, gestión de riesgos críticos y trabajo en sistema de turnos?',
    [
      'Experiencia comprobable en faena, acreditaciones y cultura cero daño',
      'Experiencia industrial adaptable a turnos mineros',
      'Sin experiencia previa en minería'
    ]
  ),

  'pesca y acuicultura': crearPlantillaBase(
    'area-pesca',
    'Pesca y Acuicultura',
    '¿Cuál es tu experiencia en centros de cultivo, embarcaciones o plantas de proceso pesquero?',
    '¿Cuentas con matrícula marítima vigente, protocolos sanitarios o manejo de cadena de frío?',
    [
      'Experiencia comprobable en faena marítima/planta y certificaciones al día',
      'Apoyo en procesamiento o labores portuarias',
      'Sin experiencia previa en el rubro'
    ]
  ),

  'agricultura y ganaderia': crearPlantillaBase(
    'area-agricultura',
    'Agricultura y Ganadería',
    '¿Cuál es tu experiencia en labores de campo, cosecha, riego, maquinaria agrícola o manejo animal?',
    '¿Conoces buenas prácticas agrícolas, seguridad en uso de herramientas/insumos y trabajo por temporada?',
    [
      'Amplia experiencia en producción agrícola/ganadera y operación en campo',
      'Experiencia en cosecha o labores estacionales',
      'Sin experiencia previa en el área'
    ]
  ),

  'forestal': crearPlantillaBase(
    'area-forestal',
    'Forestal',
    '¿Cuál es tu experiencia en faenas forestales, silvicultura, operación de equipos o brigadas?',
    '¿Cumples estrictamente protocolos de seguridad forestal y uso de elementos de protección personal?',
    [
      'Experiencia comprobable en faena forestal y normas de seguridad',
      'Experiencia en trabajos de terreno y herramientas manuales',
      'Sin experiencia previa en el sector forestal'
    ]
  ),

  'transporte': crearPlantillaBase(
    'area-transporte',
    'Transporte',
    '¿Qué licencia de conducir profesional o clase B posees vigente y cuántos años de experiencia en ruta tienes?',
    '¿Conoces planificación de rutas, guías de despacho, revisión preventiva del vehículo y normativa vial?',
    [
      'Licencia vigente al día, hoja de vida intachable y experiencia en reparto/ruta',
      'Licencia vigente con experiencia urbana básica',
      'No cuento con la licencia requerida para el cargo'
    ]
  ),

  'automotriz': crearPlantillaBase(
    'area-automotriz',
    'Automotriz',
    '¿Cuál es tu experiencia en talleres automotrices, servicio técnico, estética vehicular o repuestos?',
    '¿Qué nivel de dominio tienes en diagnóstico técnico, atención al cliente de taller o catálogos?',
    [
      'Experiencia comprobable en taller/concesionario con alta calidad de servicio',
      'Conocimientos prácticos intermedios',
      'Sin experiencia previa en el rubro automotriz'
    ]
  ),

  'salud': crearPlantillaBase(
    'area-salud',
    'Salud',
    '¿Cuentas con inscripción en la Superintendencia de Salud (SIS) y experiencia clínica/asistencial?',
    '¿Manejas protocolos de atención de pacientes, ficha clínica electrónica y control de infecciones (IAAS)?',
    [
      'Registro SIS vigente, experiencia clínica y dominio de protocolos IAAS',
      'Título/certificación con experiencia en prácticas o reemplazos',
      'En proceso de titulación o sin registro'
    ]
  ),

  'farmacia': crearPlantillaBase(
    'area-farmacia',
    'Farmacia',
    '¿Cuentas con carné de Auxiliar de Farmacia / título profesional y experiencia en dispensación?',
    '¿Conoces control de recetas retenidas/cheque, cadena de frío y manejo de inventario farmacéutico?',
    [
      'Habilitación vigente y experiencia comprobable en farmacia comercial/asistencial',
      'Conocimientos básicos de ventas y atención al público',
      'Sin experiencia ni habilitación en farmacia'
    ]
  ),

  'veterinaria': crearPlantillaBase(
    'area-veterinaria',
    'Veterinaria',
    '¿Cuál es tu experiencia en clínica veterinaria, manejo de animales, peluquería o asistencia médica?',
    '¿Manejas protocolos de sujeción segura, higiene clínica y orientación a tutores?',
    [
      'Experiencia comprobable en clínica/centro veterinario',
      'Experiencia básica en cuidado y manejo de mascotas',
      'Sin experiencia previa en el área'
    ]
  ),

  'legal': crearPlantillaBase(
    'area-legal',
    'Legal',
    '¿Cuál es tu experiencia en redacción/revisión de contratos, tramitación judicial o cumplimiento normativo?',
    '¿Qué nivel de dominio tienes en plataformas judiciales (Oficina Judicial Virtual) y gestión documental?',
    [
      'Manejo autónomo de causas, contratos y asesoría corporativa',
      'Apoyo en procuraduría, trámites y archivo legal',
      'Formación teórica inicial'
    ]
  ),

  'hoteleria y turismo': crearPlantillaBase(
    'area-hoteleria',
    'Hotelería y Turismo',
    '¿Cuál es tu experiencia en recepción hotelera, housekeeping, reservas o guiado turístico?',
    '¿Manejas sistemas de gestión hotelera (PMS), idiomas o protocolos de hospitalidad?',
    [
      'Experiencia comprobable en hotelería/turismo y excelente trato al huésped',
      'Experiencia en atención de público adaptable al rubro',
      'Sin experiencia previa en hotelería'
    ]
  ),

  'aseo y servicios generales': crearPlantillaBase(
    'area-aseo',
    'Aseo y Servicios Generales',
    '¿Cuál es tu experiencia en limpieza institucional, mantenimiento de áreas verdes o servicios generales?',
    '¿Conoces el uso seguro de productos químicos, diluciones y maquinaria de aseo?',
    [
      'Experiencia en empresas/instituciones y manejo seguro de insumos',
      'Experiencia en aseo domiciliario o labores generales',
      'Sin experiencia previa, con disposición para aprender'
    ]
  ),

  'seguridad': crearPlantillaBase(
    'area-seguridad',
    'Seguridad',
    '¿Cuentas con curso OS-10 vigente y experiencia en control de acceso, rondas o monitoreo CCTV?',
    '¿Cómo actúas ante incidentes, emergencias o situaciones conflictivas en instalación?',
    [
      'OS-10 al día, aplicación estricta de protocolos y reporte oportuno',
      'Experiencia en conserjería o control de acceso básico',
      'Sin curso OS-10 ni experiencia en seguridad'
    ]
  ),

  'prevencion de riesgos': crearPlantillaBase(
    'area-prevencion',
    'Prevención de Riesgos',
    '¿Cuentas con registro SEREMI de Salud y experiencia implementando matrices MIPER y planes de emergencia?',
    '¿Conoces normativa DS 44 / Ley 16.744, investigación de accidentes y gestión de contratistas?',
    [
      'Registro vigente, experiencia en terreno y dominio normativo completo',
      'Apoyo en charlas de seguridad, inspecciones y entrega de EPP',
      'Recién titulado/a sin experiencia en terreno'
    ]
  ),

  'emergencias': crearPlantillaBase(
    'area-emergencias',
    'Emergencias',
    '¿Cuál es tu experiencia en respuesta a emergencias, rescate, primeros auxilios o brigadas industriales?',
    '¿Cuentas con certificaciones vigentes (BLS, rescate, materiales peligrosos o guardavidas)?',
    [
      'Certificaciones vigentes y experiencia operativa en respuesta crítica',
      'Capacitación básica en primeros auxilios y evacuación',
      'Sin formación en emergencias'
    ]
  ),

  'belleza y estetica': crearPlantillaBase(
    'area-belleza',
    'Belleza y Estética',
    '¿Cuál es tu especialidad y experiencia comprobable atendiendo clientes en salón o gabinete?',
    '¿Cumples protocolos de esterilización, bioseguridad y asesoría personalizada?',
    [
      'Amplia experiencia, portafolio de trabajos y protocolos de higiene estrictos',
      'Manejo intermedio de servicios estéticos básicos',
      'En etapa de aprendizaje'
    ]
  ),

  'alimentos': crearPlantillaBase(
    'area-alimentos',
    'Alimentos',
    '¿Cuál es tu experiencia en plantas procesadoras de alimentos, carnicería, panadería o control sanitario?',
    '¿Conoces protocolos HACCP, BPM, trazabilidad y control de cadena de frío?',
    [
      'Experiencia comprobable en industria alimentaria bajo normas BPM/HACCP',
      'Experiencia en manipulación básica de alimentos',
      'Sin experiencia previa en el rubro'
    ]
  ),

  'arte y cultura': crearPlantillaBase(
    'area-arte',
    'Arte y Cultura',
    '¿Cuál es tu experiencia en producción artística, talleres culturales o gestión de proyectos creativos?',
    '¿Cuentas con portafolio/trayectoria comprobable y experiencia trabajando con públicos diversos?',
    [
      'Trayectoria comprobable y dominio técnico de mi disciplina',
      'Participación en proyectos independientes o comunitarios',
      'Formación inicial'
    ]
  ),

  'audiovisual': crearPlantillaBase(
    'area-audiovisual',
    'Audiovisual',
    '¿Cuál es tu experiencia en grabación, iluminación, sonido o postproducción audiovisual?',
    '¿Qué nivel de dominio tienes en equipos técnicos y software de edición (Premiere, DaVinci, After Effects)?',
    [
      'Dominio profesional de cámara/sonido y flujo completo de postproducción',
      'Edición básica y apoyo en rodaje',
      'Nivel inicial / autodidacta'
    ]
  ),

  'eventos': crearPlantillaBase(
    'area-eventos',
    'Eventos',
    '¿Cuál es tu experiencia en producción, montaje, logística o atención en eventos corporativos/masivos?',
    '¿Cómo te desempeñas trabajando bajo presión con plazos estrictos de montaje y servicio?',
    [
      'Amplia experiencia coordinando o ejecutando eventos de principio a fin',
      'Apoyo puntual en montaje, acreditación o servicio',
      'Sin experiencia previa en eventos'
    ]
  ),

  'deporte y fitness': crearPlantillaBase(
    'area-deporte',
    'Deporte y Fitness',
    '¿Cuentas con formación en Educación Física / certificación deportiva y experiencia dirigiendo entrenamientos?',
    '¿Sabes evaluar condición física, adaptar rutinas y prevenir lesiones en alumnos/clientes?',
    [
      'Título o certificación vigente y experiencia comprobable guiando grupos/personas',
      'Experiencia práctica en acondicionamiento físico',
      'Sin certificación ni experiencia previa'
    ]
  ),

  'ciencias y laboratorio': crearPlantillaBase(
    'area-ciencias',
    'Ciencias y Laboratorio',
    '¿Cuál es tu experiencia realizando análisis de laboratorio, muestreo y manejo de instrumental científico?',
    '¿Conoces normas de bioseguridad, buenas prácticas de laboratorio (BPL) y calibración de equipos?',
    [
      'Dominio técnico en ensayos, BPL y análisis de resultados',
      'Apoyo en preparación de muestras y registro de datos',
      'Formación teórica sin experiencia en laboratorio'
    ]
  ),

  'medio ambiente': crearPlantillaBase(
    'area-medio-ambiente',
    'Medio Ambiente',
    '¿Cuál es tu experiencia en gestión ambiental, monitoreo, manejo de residuos o cumplimiento RCA?',
    '¿Conoces la legislación ambiental vigente (SEIA, Ley REP) y reportes de sustentabilidad?',
    [
      'Experiencia comprobable en terreno, normativa ambiental y auditorías',
      'Apoyo en gestión de residuos y mediciones básicas',
      'Conocimientos teóricos iniciales'
    ]
  ),

  'inmobiliaria': crearPlantillaBase(
    'area-inmobiliaria',
    'Inmobiliaria',
    '¿Cuál es tu experiencia en corretaje, arriendo, venta de propiedades o administración de edificios/condominios?',
    '¿Conoces trámites notariales/conservador, evaluación de arrendatarios o Ley de Copropiedad?',
    [
      'Gestión integral de cartera inmobiliaria y cierre de operaciones',
      'Captación y muestra de propiedades con apoyo administrativo',
      'Sin experiencia previa en el rubro inmobiliario'
    ]
  ),

  'servicios sociales': crearPlantillaBase(
    'area-servicios-sociales',
    'Servicios Sociales',
    '¿Cuál es tu experiencia en intervención social, trabajo comunitario o cuidado integral de personas?',
    '¿Manejas redes de apoyo institucional, registro de casos y protocolos de trato digno?',
    [
      'Experiencia comprobable en atención directa, seguimiento y trabajo en red',
      'Experiencia en voluntariado o apoyo asistencial básico',
      'Sin experiencia previa en el área'
    ]
  ),

  'portuario y maritimo': crearPlantillaBase(
    'area-portuario',
    'Portuario y Marítimo',
    '¿Cuentas con permiso portuario / matrícula marítima vigente y experiencia en faenas de carga/descarga?',
    '¿Conoces protocolos de seguridad portuaria, estiba/trinca y operación en terminales?',
    [
      'Documentación vigente y experiencia comprobable en puerto/nave',
      'Experiencia logística adaptable a operaciones portuarias',
      'Sin habilitación ni experiencia portuaria'
    ]
  ),

  'aviacion': crearPlantillaBase(
    'area-aviacion',
    'Aviación',
    '¿Cuentas con licencias/habilitaciones aeronáuticas DGAC vigentes y experiencia en operaciones aéreas?',
    '¿Conoces regulaciones aeronáuticas (DAN), seguridad operacional (SMS) y procedimientos de rampa/vuelo?',
    [
      'Licencias DGAC al día y experiencia comprobable en aviación',
      'Experiencia en atención de pasajeros o logística aeroportuaria',
      'Sin habilitación aeronáutica'
    ]
  ),

  'imprenta y grafica': crearPlantillaBase(
    'area-imprenta',
    'Imprenta y Gráfica',
    '¿Cuál es tu experiencia operando prensas, guillotinas, serigrafía o procesos de terminación gráfica?',
    '¿Manejas preprensa, calibración de color y control de calidad de tirajes?',
    [
      'Dominio técnico en maquinaria gráfica, acabados y control de color',
      'Apoyo en encuadernación, corte y empaque',
      'Sin experiencia previa en imprenta'
    ]
  ),

  'madera y muebleria': crearPlantillaBase(
    'area-madera',
    'Madera y Mueblería',
    '¿Cuál es tu experiencia en carpintería, mueblería a medida, ebanistería o tapicería?',
    '¿Manejas maquinaria de taller (escuadradora, router, enchapadora) e interpretación de planos de corte?',
    [
      'Dominio completo en fabricación, armado y terminaciones en madera/melamina',
      'Apoyo en lijado, armado básico e instalación',
      'Conocimientos iniciales de carpintería'
    ]
  ),

  'servicios funerarios': crearPlantillaBase(
    'area-funerarios',
    'Servicios Funerarios',
    '¿Cuál es tu experiencia en atención de familias, coordinación de servicios funerarios o logística asociada?',
    '¿Cuentas con empatía, discreción, licencia de conducir (si aplica) y disponibilidad horaria?',
    [
      'Experiencia comprobable en el rubro, trato respetuoso y disponibilidad total',
      'Experiencia en atención al cliente o conducción con alta empatía',
      'Sin experiencia previa en servicios funerarios'
    ]
  )
};

/**
 * Busca la mejor plantilla disponible priorizando:
 * 1) Coincidencia exacta o parcial por CARGO
 * 2) Coincidencia exacta o parcial por ÁREA LABORAL
 */
export function buscarPlantillaPorDefecto(
  cargoNombre?: string,
  areaLaboral?: string
): PlantillaCuestionario | null {
  const cargoNorm = normalizarClave(cargoNombre ?? '');
  const areaNorm = normalizarClave(areaLaboral ?? '');

  if (cargoNorm) {
    if (PLANTILLAS_POR_CARGO[cargoNorm]) {
      return PLANTILLAS_POR_CARGO[cargoNorm];
    }

    const claveCargoParcial = Object.keys(PLANTILLAS_POR_CARGO).find(
      clave => cargoNorm.includes(clave) || clave.includes(cargoNorm)
    );
    if (claveCargoParcial) {
      return PLANTILLAS_POR_CARGO[claveCargoParcial];
    }
  }

  if (areaNorm) {
    if (PLANTILLAS_POR_AREA[areaNorm]) {
      return PLANTILLAS_POR_AREA[areaNorm];
    }

    const claveAreaParcial = Object.keys(PLANTILLAS_POR_AREA).find(
      clave => areaNorm.includes(clave) || clave.includes(areaNorm)
    );
    if (claveAreaParcial) {
      return PLANTILLAS_POR_AREA[claveAreaParcial];
    }
  }

  return null;
}