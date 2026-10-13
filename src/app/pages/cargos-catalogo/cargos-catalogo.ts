import {
  Firestore,
  collection,
  doc,
  writeBatch
} from '@angular/fire/firestore';


export interface CargoCatalogo {
  nombre: string;
  areaLaboral: string;
}


export const CARGOS_POR_AREA: Record<string, string[]> = {

  // ============================================================
  // ADMINISTRACIÓN Y OFICINA
  // ============================================================

  'Administración y Oficina': [
    'Administrativo/a',
    'Asistente Administrativo/a',
    'Auxiliar Administrativo/a',
    'Secretaria/o',
    'Secretaria/o Ejecutiva/o',
    'Secretaria/o Administrativa/o',
    'Recepcionista',
    'Digitador/a',
    'Archivista',
    'Document Controller',
    'Asistente de Gerencia',
    'Asistente Ejecutivo/a',
    'Analista Administrativo/a',
    'Coordinador/a Administrativo/a',
    'Encargado/a Administrativo/a',
    'Supervisor/a Administrativo/a',
    'Jefe/a Administrativo/a',
    'Jefe/a de Oficina',
    'Office Manager',
    'Gerente Administrativo/a'
  ],


  // ============================================================
  // GERENCIA Y DIRECCIÓN
  // ============================================================

  'Gerencia y Dirección': [
    'Gerente General',
    'Subgerente General',
    'Director/a Ejecutivo/a',
    'CEO',
    'COO',
    'CFO',
    'CTO',
    'CIO',
    'CMO',
    'CHRO',
    'Gerente de Operaciones',
    'Gerente Comercial',
    'Gerente de Administración',
    'Gerente de Finanzas',
    'Gerente de Recursos Humanos',
    'Gerente de Tecnología',
    'Gerente de Proyectos',
    'Gerente de Planta',
    'Gerente de Sucursal',
    'Gerente de Negocios',
    'Gerente de Desarrollo',
    'Gerente de Calidad',
    'Gerente de Logística',
    'Gerente de Producción',
    'Gerente de Marketing',
    'Gerente de Ventas'
  ],


  // ============================================================
  // CONTABILIDAD Y FINANZAS
  // ============================================================

  'Contabilidad y Finanzas': [
    'Contador/a',
    'Contador/a General',
    'Contador/a Auditor/a',
    'Asistente Contable',
    'Auxiliar Contable',
    'Analista Contable',
    'Analista Financiero/a',
    'Analista de Tesorería',
    'Tesorero/a',
    'Encargado/a de Tesorería',
    'Analista de Costos',
    'Analista de Presupuesto',
    'Analista de Facturación',
    'Analista de Crédito',
    'Analista de Cobranza',
    'Ejecutivo/a de Cobranza',
    'Cobrador/a',
    'Auditor/a',
    'Auditor/a Interno/a',
    'Auditor/a Externo/a',
    'Controller Financiero',
    'Jefe/a de Contabilidad',
    'Jefe/a de Finanzas',
    'Jefe/a de Tesorería',
    'Gerente Financiero/a'
  ],


  // ============================================================
  // BANCA Y SEGUROS
  // ============================================================

  'Banca y Seguros': [
    'Ejecutivo/a Bancario/a',
    'Ejecutivo/a de Cuentas',
    'Ejecutivo/a de Inversiones',
    'Ejecutivo/a Hipotecario/a',
    'Cajero/a Bancario/a',
    'Analista de Riesgo Financiero',
    'Analista de Crédito',
    'Analista de Inversiones',
    'Corredor/a de Bolsa',
    'Agente de Seguros',
    'Corredor/a de Seguros',
    'Liquidador/a de Seguros',
    'Suscriptor/a de Seguros',
    'Ejecutivo/a de Seguros',
    'Analista de Siniestros'
  ],


  // ============================================================
  // RECURSOS HUMANOS
  // ============================================================

  'Recursos Humanos': [
    'Asistente de Recursos Humanos',
    'Analista de Recursos Humanos',
    'Generalista de Recursos Humanos',
    'Encargado/a de Recursos Humanos',
    'Coordinador/a de Recursos Humanos',
    'Jefe/a de Recursos Humanos',
    'Gerente de Recursos Humanos',
    'Recruiter',
    'IT Recruiter',
    'Analista de Reclutamiento',
    'Analista de Selección',
    'Especialista de Atracción de Talento',
    'Talent Acquisition Specialist',
    'Analista de Capacitación',
    'Analista de Desarrollo Organizacional',
    'Analista de Remuneraciones',
    'Analista de Compensaciones',
    'Encargado/a de Bienestar',
    'Asistente de Personal',
    'Payroll Specialist'
  ],


  // ============================================================
  // VENTAS Y COMERCIAL
  // ============================================================

  'Ventas y Comercial': [
    'Vendedor/a',
    'Vendedor/a Retail',
    'Vendedor/a Terreno',
    'Vendedor/a Técnico/a',
    'Ejecutivo/a de Ventas',
    'Ejecutivo/a Comercial',
    'Asesor/a Comercial',
    'Representante de Ventas',
    'Promotor/a',
    'Promotor/a de Ventas',
    'Captador/a',
    'Mercaderista',
    'Ejecutivo/a de Televentas',
    'Supervisor/a de Ventas',
    'Jefe/a de Ventas',
    'Jefe/a Comercial',
    'Gerente Comercial',
    'Gerente de Ventas',
    'Key Account Manager',
    'Account Manager',
    'Sales Manager',
    'Business Development Manager',
    'Ejecutivo/a B2B',
    'Ejecutivo/a B2C',
    'Ejecutivo/a de Convenios'
  ],


  // ============================================================
  // ATENCIÓN AL CLIENTE
  // ============================================================

  'Atención al Cliente': [
    'Ejecutivo/a de Atención al Cliente',
    'Asistente de Atención al Cliente',
    'Agente de Servicio al Cliente',
    'Operador/a Call Center',
    'Ejecutivo/a Call Center',
    'Teleoperador/a',
    'Ejecutivo/a Contact Center',
    'Anfitrión/a',
    'Ejecutivo/a de Postventa',
    'Ejecutivo/a de Fidelización',
    'Customer Service Representative',
    'Customer Success Specialist',
    'Customer Success Manager',
    'Supervisor/a Call Center',
    'Jefe/a de Servicio al Cliente'
  ],


  // ============================================================
  // RETAIL Y COMERCIO
  // ============================================================

  'Retail y Comercio': [
    'Cajero/a',
    'Reponedor/a',
    'Vendedor/a de Tienda',
    'Asistente de Tienda',
    'Operador/a de Sala',
    'Bodeguero/a de Tienda',
    'Ordenador/a de Sala',
    'Probadorista',
    'Empaquetador/a',
    'Picker de Supermercado',
    'Supervisor/a de Tienda',
    'Encargado/a de Local',
    'Jefe/a de Tienda',
    'Administrador/a de Local',
    'Store Manager',
    'Jefe/a de Sala',
    'Category Manager'
  ],


  // ============================================================
  // MARKETING
  // ============================================================

  'Marketing': [
    'Asistente de Marketing',
    'Analista de Marketing',
    'Especialista en Marketing',
    'Especialista en Marketing Digital',
    'Marketing Manager',
    'Growth Manager',
    'Growth Hacker',
    'Brand Manager',
    'Product Marketing Manager',
    'Trade Marketing Analyst',
    'Trade Marketing Manager',
    'Especialista SEO',
    'Especialista SEM',
    'Media Buyer',
    'Performance Marketing Specialist',
    'CRM Specialist',
    'Email Marketing Specialist',
    'E-commerce Manager',
    'E-commerce Specialist'
  ],


  // ============================================================
  // COMUNICACIONES
  // ============================================================

  'Comunicaciones': [
    'Periodista',
    'Comunicador/a',
    'Comunicador/a Audiovisual',
    'Analista de Comunicaciones',
    'Encargado/a de Comunicaciones',
    'Jefe/a de Comunicaciones',
    'Relacionador/a Público/a',
    'Community Manager',
    'Social Media Manager',
    'Content Manager',
    'Content Creator',
    'Copywriter',
    'Redactor/a',
    'Editor/a de Contenidos',
    'Director/a de Comunicaciones'
  ],


  // ============================================================
  // INFORMÁTICA Y SOFTWARE
  // ============================================================

  'Informática y Software': [
    'Analista Programador/a',
    'Programador/a',
    'Desarrollador/a de Software',
    'Ingeniero/a de Software',
    'Software Engineer',
    'Desarrollador/a Web',
    'Desarrollador/a Frontend',
    'Frontend Developer',
    'Desarrollador/a Backend',
    'Backend Developer',
    'Desarrollador/a Full Stack',
    'Full Stack Developer',
    'Desarrollador/a Mobile',
    'Android Developer',
    'iOS Developer',
    'Desarrollador/a Java',
    'Desarrollador/a Python',
    'Desarrollador/a JavaScript',
    'Desarrollador/a .NET',
    'Desarrollador/a PHP',
    'Desarrollador/a Angular',
    'Desarrollador/a React',
    'Desarrollador/a Node.js',
    'Desarrollador/a WordPress',
    'Software Architect',
    'Arquitecto/a de Software',
    'Technical Lead',
    'Tech Lead'
  ],


  // ============================================================
  // SOPORTE TI
  // ============================================================

  'Soporte TI': [
    'Soporte TI',
    'Técnico/a de Soporte TI',
    'Analista de Soporte',
    'Ingeniero/a de Soporte',
    'Help Desk',
    'Service Desk Analyst',
    'Analista de Mesa de Ayuda',
    'Técnico/a de Computación',
    'Técnico/a Informático/a',
    'Field Support Technician',
    'Desktop Support',
    'Administrador/a de Sistemas',
    'System Administrator',
    'Administrador/a Windows',
    'Administrador/a Linux',
    'IT Specialist',
    'IT Support Specialist'
  ],


  // ============================================================
  // REDES Y TELECOMUNICACIONES
  // ============================================================

  'Redes y Telecomunicaciones': [
    'Técnico/a de Redes',
    'Administrador/a de Redes',
    'Ingeniero/a de Redes',
    'Network Engineer',
    'Network Administrator',
    'Técnico/a en Telecomunicaciones',
    'Ingeniero/a en Telecomunicaciones',
    'Técnico/a Fibra Óptica',
    'Instalador/a de Fibra Óptica',
    'Técnico/a de Radiofrecuencia',
    'Técnico/a de Antenas',
    'NOC Analyst',
    'NOC Engineer'
  ],


  // ============================================================
  // CIBERSEGURIDAD
  // ============================================================

  'Ciberseguridad': [
    'Analista de Ciberseguridad',
    'Ingeniero/a de Ciberseguridad',
    'Cybersecurity Analyst',
    'Security Engineer',
    'Analista SOC',
    'SOC Analyst',
    'Pentester',
    'Ethical Hacker',
    'Especialista en Seguridad de la Información',
    'Analista de Vulnerabilidades',
    'Especialista IAM',
    'Security Architect',
    'Arquitecto/a de Seguridad',
    'CISO',
    'Analista GRC',
    'Especialista en Riesgo Tecnológico'
  ],


  // ============================================================
  // DATOS
  // ============================================================

  'Datos y Business Intelligence': [
    'Analista de Datos',
    'Data Analyst',
    'Data Scientist',
    'Científico/a de Datos',
    'Data Engineer',
    'Ingeniero/a de Datos',
    'Analytics Engineer',
    'Business Intelligence Analyst',
    'Analista Business Intelligence',
    'BI Developer',
    'Power BI Developer',
    'Database Administrator',
    'Administrador/a de Bases de Datos',
    'DBA',
    'SQL Developer',
    'ETL Developer',
    'Data Architect',
    'Arquitecto/a de Datos',
    'Data Governance Analyst'
  ],


  // ============================================================
  // INTELIGENCIA ARTIFICIAL
  // ============================================================

  'Inteligencia Artificial': [
    'Ingeniero/a de Inteligencia Artificial',
    'AI Engineer',
    'Machine Learning Engineer',
    'Machine Learning Scientist',
    'MLOps Engineer',
    'NLP Engineer',
    'Computer Vision Engineer',
    'Prompt Engineer',
    'AI Developer',
    'AI Researcher',
    'Especialista en Automatización con IA'
  ],


  // ============================================================
  // CLOUD Y DEVOPS
  // ============================================================

  'Cloud y DevOps': [
    'DevOps Engineer',
    'Ingeniero/a DevOps',
    'Cloud Engineer',
    'Ingeniero/a Cloud',
    'Cloud Architect',
    'Arquitecto/a Cloud',
    'Site Reliability Engineer',
    'SRE',
    'Platform Engineer',
    'Infrastructure Engineer',
    'Kubernetes Engineer',
    'AWS Engineer',
    'Azure Engineer',
    'Google Cloud Engineer',
    'FinOps Analyst'
  ],


  // ============================================================
  // QA Y CALIDAD SOFTWARE
  // ============================================================

  'QA y Testing': [
    'QA Tester',
    'Tester de Software',
    'QA Analyst',
    'QA Engineer',
    'Automation Tester',
    'QA Automation Engineer',
    'Performance Tester',
    'Test Engineer',
    'Software Quality Analyst',
    'Líder QA'
  ],


  // ============================================================
  // PROYECTOS Y PRODUCTO
  // ============================================================

  'Gestión de Proyectos y Producto': [
    'Project Manager',
    'Jefe/a de Proyecto',
    'Coordinador/a de Proyectos',
    'Analista de Proyectos',
    'PMO Analyst',
    'PMO Manager',
    'Product Manager',
    'Product Owner',
    'Scrum Master',
    'Agile Coach',
    'Business Analyst',
    'Analista Funcional'
  ],


  // ============================================================
  // DISEÑO
  // ============================================================

  'Diseño': [
    'Diseñador/a',
    'Diseñador/a Gráfico/a',
    'Diseñador/a Industrial',
    'Diseñador/a Web',
    'Diseñador/a UX',
    'Diseñador/a UI',
    'Diseñador/a UX/UI',
    'UX Researcher',
    'Product Designer',
    'Ilustrador/a',
    'Director/a de Arte',
    'Diagramador/a',
    'Animador/a Digital',
    'Diseñador/a 3D'
  ],


  // ============================================================
  // LOGÍSTICA
  // ============================================================

  'Logística y Bodega': [
    'Bodeguero/a',
    'Ayudante de Bodega',
    'Asistente de Bodega',
    'Operario/a de Bodega',
    'Encargado/a de Bodega',
    'Jefe/a de Bodega',
    'Operario/a Logístico/a',
    'Asistente Logístico/a',
    'Analista Logístico/a',
    'Coordinador/a Logístico/a',
    'Supervisor/a Logístico/a',
    'Jefe/a de Logística',
    'Gerente de Logística',
    'Picker',
    'Operario/a de Picking',
    'Operario/a de Packing',
    'Despachador/a',
    'Asistente de Despacho',
    'Controlador/a de Inventario',
    'Analista de Inventario',
    'Encargado/a de Inventario',
    'Pañolero/a',
    'Movilizador/a',
    'Operador/a de Grúa Horquilla',
    'Operador/a Transpaleta'
  ],


  // ============================================================
  // SUPPLY CHAIN Y COMPRAS
  // ============================================================

  'Supply Chain y Compras': [
    'Analista de Supply Chain',
    'Supply Chain Analyst',
    'Supply Chain Planner',
    'Demand Planner',
    'Supply Planner',
    'Planner',
    'Analista de Abastecimiento',
    'Encargado/a de Abastecimiento',
    'Comprador/a',
    'Comprador/a Técnico/a',
    'Analista de Compras',
    'Procurement Analyst',
    'Procurement Specialist',
    'Jefe/a de Compras',
    'Sourcing Specialist'
  ],


  // ============================================================
  // PRODUCCIÓN
  // ============================================================

  'Producción y Manufactura': [
    'Operario/a de Producción',
    'Ayudante de Producción',
    'Asistente de Producción',
    'Operador/a de Planta',
    'Operador/a de Línea',
    'Operador/a de Máquina',
    'Maquinista',
    'Envasador/a',
    'Etiquetador/a',
    'Embalador/a',
    'Supervisor/a de Producción',
    'Jefe/a de Producción',
    'Planificador/a de Producción',
    'Ingeniero/a de Producción',
    'Gerente de Producción'
  ],


  // ============================================================
  // CALIDAD
  // ============================================================

  'Calidad': [
    'Inspector/a de Calidad',
    'Controlador/a de Calidad',
    'Analista de Calidad',
    'Técnico/a de Calidad',
    'Ingeniero/a de Calidad',
    'Coordinador/a de Calidad',
    'Jefe/a de Calidad',
    'Quality Engineer',
    'Quality Assurance Analyst',
    'Auditor/a de Calidad'
  ],


  // ============================================================
  // MANTENIMIENTO
  // ============================================================

  'Mantenimiento Industrial': [
    'Ayudante de Mantención',
    'Técnico/a de Mantenimiento',
    'Mecánico/a de Mantenimiento',
    'Eléctrico/a de Mantenimiento',
    'Electromecánico/a',
    'Mantenedor/a Industrial',
    'Planificador/a de Mantenimiento',
    'Planner de Mantenimiento',
    'Supervisor/a de Mantenimiento',
    'Jefe/a de Mantenimiento',
    'Ingeniero/a de Mantenimiento'
  ],


  // ============================================================
  // CONSTRUCCIÓN
  // ============================================================

  'Construcción': [
    'Albañil',
    'Ayudante de Albañil',
    'Maestro/a de Construcción',
    'Maestro/a Primera',
    'Maestro/a Segunda',
    'Jornal',
    'Ayudante de Obra',
    'Carpintero/a',
    'Carpintero/a de Obra Gruesa',
    'Enfierrador/a',
    'Soldador/a',
    'Pintor/a',
    'Yesero/a',
    'Ceramista',
    'Instalador/a de Cerámica',
    'Techador/a',
    'Gasfíter',
    'Electricista',
    'Cerrajero/a',
    'Vidriero/a',
    'Operador/a de Maquinaria',
    'Capataz',
    'Supervisor/a de Obra',
    'Jefe/a de Obra',
    'Constructor/a Civil',
    'Ingeniero/a en Construcción',
    'Administrador/a de Obra',
    'Topógrafo/a',
    'Arquitecto/a'
  ],


  // ============================================================
  // ELECTRICIDAD
  // ============================================================

  'Electricidad y Electrónica': [
    'Ayudante Electricista',
    'Electricista',
    'Electricista Industrial',
    'Técnico/a Electricista',
    'Técnico/a Electrónico/a',
    'Electromecánico/a',
    'Ingeniero/a Eléctrico/a',
    'Ingeniero/a Electrónico/a',
    'Instrumentista',
    'Técnico/a Instrumentista',
    'Ingeniero/a de Automatización',
    'Técnico/a de Automatización',
    'Técnico/a PLC'
  ],


  // ============================================================
  // MECÁNICA
  // ============================================================

  'Mecánica': [
    'Mecánico/a',
    'Ayudante Mecánico/a',
    'Mecánico/a Automotriz',
    'Mecánico/a Industrial',
    'Mecánico/a de Maquinaria Pesada',
    'Técnico/a Mecánico/a',
    'Ingeniero/a Mecánico/a',
    'Lubricador/a',
    'Vulcanizador/a',
    'Desabollador/a',
    'Pintor/a Automotriz',
    'Electromecánico/a Automotriz'
  ],


  // ============================================================
  // CLIMATIZACIÓN
  // ============================================================

  'Climatización': [
    'Ayudante de Climatización',
    'Técnico/a en Climatización',
    'Técnico/a HVAC',
    'Instalador/a de Aire Acondicionado',
    'Mantenedor/a HVAC',
    'Ingeniero/a en Climatización'
  ],


  // ============================================================
  // MINERÍA
  // ============================================================

  'Minería': [
    'Minero/a',
    'Ayudante Minero/a',
    'Operador/a Mina',
    'Operador/a de Planta Minera',
    'Operador/a de Camión Minero',
    'Operador/a CAEX',
    'Operador/a Bulldozer',
    'Operador/a Excavadora',
    'Operador/a Cargador Frontal',
    'Operador/a Motoniveladora',
    'Perforista',
    'Ayudante Perforista',
    'Tronador/a',
    'Muestrero/a',
    'Geólogo/a',
    'Ingeniero/a de Minas',
    'Ingeniero/a Metalúrgico/a',
    'Metalurgista',
    'Supervisor/a Mina',
    'Jefe/a de Turno Mina'
  ],


  // ============================================================
  // PESCA Y ACUICULTURA
  // ============================================================

  'Pesca y Acuicultura': [
    'Pescador/a',
    'Pescador/a Artesanal',
    'Ayudante de Pesca',
    'Tripulante de Embarcación',
    'Marinero/a',
    'Patrón/a de Nave',
    'Capitán/a de Embarcación',
    'Buzo/a',
    'Buzo/a Mariscador/a',
    'Recolector/a de Orilla',
    'Mariscador/a',
    'Fileteador/a de Pescado',
    'Pescadero/a',
    'Operario/a de Planta Pesquera',
    'Operario/a de Procesamiento de Pescado',
    'Acuicultor/a',
    'Operario/a de Centro de Cultivo',
    'Técnico/a en Acuicultura',
    'Ingeniero/a en Acuicultura',
    'Operador/a de Piscicultura',
    'Encargado/a de Salmonicultura'
  ],


  // ============================================================
  // AGRICULTURA
  // ============================================================

  'Agricultura y Ganadería': [
    'Agricultor/a',
    'Trabajador/a Agrícola',
    'Peón Agrícola',
    'Temporero/a',
    'Cosechador/a',
    'Recolector/a de Fruta',
    'Podador/a',
    'Regador/a',
    'Tractorista',
    'Operador/a de Maquinaria Agrícola',
    'Encargado/a de Campo',
    'Supervisor/a Agrícola',
    'Técnico/a Agrícola',
    'Ingeniero/a Agrónomo/a',
    'Agrónomo/a',
    'Ganadero/a',
    'Cuidador/a de Animales',
    'Ordeñador/a',
    'Criador/a de Animales',
    'Apicultor/a'
  ],


  // ============================================================
  // FORESTAL
  // ============================================================

  'Forestal': [
    'Trabajador/a Forestal',
    'Motosierrista',
    'Talador/a',
    'Podador/a Forestal',
    'Operador/a Forestal',
    'Operador/a de Maquinaria Forestal',
    'Brigadista Forestal',
    'Técnico/a Forestal',
    'Ingeniero/a Forestal',
    'Guardaparques'
  ],


  // ============================================================
  // TRANSPORTE
  // ============================================================

  'Transporte': [
    'Chofer',
    'Conductor/a',
    'Conductor/a Clase B',
    'Conductor/a Profesional',
    'Conductor/a Clase A2',
    'Conductor/a Clase A3',
    'Conductor/a Clase A4',
    'Conductor/a Clase A5',
    'Chofer de Reparto',
    'Repartidor/a',
    'Delivery',
    'Conductor/a de Camión',
    'Camionero/a',
    'Conductor/a de Bus',
    'Conductor/a de Taxi',
    'Conductor/a de Aplicación',
    'Conductor/a de Ambulancia',
    'Conductor/a de Transporte Escolar',
    'Conductor/a de Grúa',
    'Despachador/a de Transporte',
    'Coordinador/a de Transporte',
    'Supervisor/a de Transporte'
  ],


  // ============================================================
  // AUTOMOTRIZ
  // ============================================================

  'Automotriz': [
    'Lavador/a de Autos',
    'Detailer Automotriz',
    'Mecánico/a Automotriz',
    'Ayudante Mecánico/a',
    'Electromecánico/a Automotriz',
    'Vulcanizador/a',
    'Desabollador/a',
    'Pintor/a Automotriz',
    'Asesor/a de Servicio Automotriz',
    'Vendedor/a de Repuestos',
    'Bodeguero/a de Repuestos',
    'Inspector/a Técnico/a Automotriz'
  ],


  // ============================================================
  // SALUD
  // ============================================================

  'Salud': [
    'Médico/a',
    'Médico/a General',
    'Médico/a Familiar',
    'Enfermero/a',
    'Técnico/a en Enfermería',
    'TENS',
    'Auxiliar de Enfermería',
    'Kinesiólogo/a',
    'Terapeuta Ocupacional',
    'Fonoaudiólogo/a',
    'Nutricionista',
    'Psicólogo/a',
    'Tecnólogo/a Médico/a',
    'Matron/a',
    'Paramédico/a',
    'Técnico/a Paramédico/a',
    'Odontólogo/a',
    'Asistente Dental',
    'Higienista Dental',
    'Podólogo/a',
    'Camillero/a',
    'Auxiliar de Servicio Hospitalario',
    'Secretaria/o Médica/o',
    'Recepcionista Médico/a'
  ],


  // ============================================================
  // FARMACIA
  // ============================================================

  'Farmacia': [
    'Químico/a Farmacéutico/a',
    'Auxiliar de Farmacia',
    'Técnico/a en Farmacia',
    'Vendedor/a de Farmacia',
    'Jefe/a de Farmacia',
    'Visitador/a Médico/a'
  ],


  // ============================================================
  // VETERINARIA
  // ============================================================

  'Veterinaria': [
    'Médico/a Veterinario/a',
    'Técnico/a Veterinario/a',
    'Asistente Veterinario/a',
    'Auxiliar Veterinario/a',
    'Peluquero/a Canino/a',
    'Cuidador/a de Animales',
    'Adiestrador/a Canino/a'
  ],


  // ============================================================
  // EDUCACIÓN
  // ============================================================

  'Educación': [
    'Profesor/a',
    'Docente',
    'Profesor/a de Educación Básica',
    'Profesor/a de Educación Media',
    'Profesor/a de Matemáticas',
    'Profesor/a de Lenguaje',
    'Profesor/a de Historia',
    'Profesor/a de Ciencias',
    'Profesor/a de Inglés',
    'Profesor/a de Educación Física',
    'Educador/a Diferencial',
    'Educador/a de Párvulos',
    'Técnico/a en Educación Parvularia',
    'Asistente de Aula',
    'Inspector/a de Colegio',
    'Orientador/a',
    'Bibliotecario/a',
    'Tutor/a',
    'Profesor/a Universitario/a',
    'Investigador/a Académico/a',
    'Director/a de Colegio',
    'Jefe/a UTP'
  ],


  // ============================================================
  // DERECHO
  // ============================================================

  'Legal': [
    'Abogado/a',
    'Abogado/a Corporativo/a',
    'Abogado/a Laboral',
    'Abogado/a Penalista',
    'Abogado/a Tributario/a',
    'Procurador/a',
    'Asistente Legal',
    'Analista Legal',
    'Fiscal',
    'Compliance Officer',
    'Analista de Compliance',
    'Encargado/a de Contratos',
    'Analista de Contratos'
  ],


  // ============================================================
  // GASTRONOMÍA
  // ============================================================

  'Gastronomía': [
    'Cocinero/a',
    'Ayudante de Cocina',
    'Maestro/a de Cocina',
    'Chef',
    'Chef Ejecutivo/a',
    'Sous Chef',
    'Copero/a',
    'Garzón/a',
    'Mesero/a',
    'Runner',
    'Bartender',
    'Barman',
    'Barista',
    'Pastelero/a',
    'Ayudante de Pastelería',
    'Panadero/a',
    'Pizzero/a',
    'Parrillero/a',
    'Manipulador/a de Alimentos',
    'Maestro/a Sandwichero/a',
    'Maestro/a Sushi',
    'Sushiman',
    'Repostero/a'
  ],


  // ============================================================
  // HOTELERÍA Y TURISMO
  // ============================================================

  'Hotelería y Turismo': [
    'Recepcionista de Hotel',
    'Botones',
    'Conserje de Hotel',
    'Mucama/o',
    'Housekeeping',
    'Gobernanta/e',
    'Administrador/a de Hotel',
    'Gerente de Hotel',
    'Guía Turístico/a',
    'Agente de Viajes',
    'Ejecutivo/a de Turismo',
    'Coordinador/a de Turismo',
    'Tour Operador/a'
  ],


  // ============================================================
  // ASEO
  // ============================================================

  'Aseo y Servicios Generales': [
    'Auxiliar de Aseo',
    'Auxiliar de Limpieza',
    'Operario/a de Limpieza',
    'Personal de Aseo',
    'Aseador/a',
    'Limpiador/a',
    'Auxiliar de Servicios',
    'Auxiliar de Servicios Generales',
    'Mayordomo/a',
    'Conserje',
    'Nochero/a',
    'Jardinero/a',
    'Auxiliar de Jardinería',
    'Cuidador/a de Parcela',
    'Cuidador/a de Casa',
    'Asesora del Hogar',
    'Trabajador/a de Casa Particular'
  ],


  // ============================================================
  // SEGURIDAD
  // ============================================================

  'Seguridad': [
    'Guardia de Seguridad',
    'Vigilante Privado',
    'Conserje de Seguridad',
    'Operador/a CCTV',
    'Operador/a de Central de Monitoreo',
    'Supervisor/a de Seguridad',
    'Jefe/a de Seguridad',
    'Escolta',
    'Controlador/a de Acceso',
    'Portero/a'
  ],


  // ============================================================
  // PREVENCIÓN DE RIESGOS
  // ============================================================

  'Prevención de Riesgos': [
    'Prevencionista de Riesgos',
    'Técnico/a en Prevención de Riesgos',
    'Ingeniero/a en Prevención de Riesgos',
    'Asesor/a en Prevención de Riesgos',
    'HSE Specialist',
    'EHS Specialist',
    'Supervisor/a HSE',
    'Jefe/a de Prevención de Riesgos'
  ],


  // ============================================================
  // EMERGENCIAS
  // ============================================================

  'Emergencias': [
    'Bombero/a',
    'Bombero/a Industrial',
    'Brigadista de Emergencia',
    'Rescatista',
    'Salvavidas',
    'Paramédico/a',
    'Operador/a de Emergencias',
    'Despachador/a de Emergencias'
  ],


  // ============================================================
  // BELLEZA
  // ============================================================

  'Belleza y Estética': [
    'Peluquero/a',
    'Estilista',
    'Barbero/a',
    'Colorista',
    'Manicurista',
    'Pedicurista',
    'Cosmetólogo/a',
    'Esteticista',
    'Maquillador/a',
    'Masajista',
    'Técnico/a en Masoterapia',
    'Depilador/a',
    'Tatuador/a',
    'Piercer'
  ],


  // ============================================================
  // TEXTIL Y MODA
  // ============================================================

  'Textil y Moda': [
    'Costurero/a',
    'Modista',
    'Sastre',
    'Operario/a Textil',
    'Cortador/a Textil',
    'Patronista',
    'Diseñador/a de Vestuario',
    'Asesor/a de Imagen',
    'Modelo',
    'Zapatero/a',
    'Marroquinero/a'
  ],


  // ============================================================
  // ALIMENTOS
  // ============================================================

  'Alimentos': [
    'Carnicero/a',
    'Ayudante de Carnicería',
    'Pescadero/a',
    'Fiambrero/a',
    'Panadero/a',
    'Pastelero/a',
    'Confitero/a',
    'Operario/a de Alimentos',
    'Manipulador/a de Alimentos',
    'Inspector/a de Alimentos',
    'Tecnólogo/a en Alimentos',
    'Ingeniero/a en Alimentos'
  ],


  // ============================================================
  // ARTE
  // ============================================================

  'Arte y Cultura': [
    'Actor',
    'Actriz',
    'Músico/a',
    'Cantante',
    'Bailarín/a',
    'Coreógrafo/a',
    'Director/a Teatral',
    'Productor/a Cultural',
    'Gestor/a Cultural',
    'Artista Visual',
    'Escultor/a',
    'Pintor/a Artístico/a',
    'Ilustrador/a'
  ],


  // ============================================================
  // AUDIOVISUAL
  // ============================================================

  'Audiovisual': [
    'Fotógrafo/a',
    'Camarógrafo/a',
    'Operador/a de Cámara',
    'Editor/a de Video',
    'Montajista Audiovisual',
    'Sonidista',
    'Técnico/a de Sonido',
    'Productor/a Audiovisual',
    'Director/a Audiovisual',
    'Director/a de Fotografía',
    'Postproductor/a',
    'Animador/a Digital',
    'Motion Graphics Designer'
  ],


  // ============================================================
  // EVENTOS
  // ============================================================

  'Eventos': [
    'Productor/a de Eventos',
    'Coordinador/a de Eventos',
    'Asistente de Eventos',
    'Montajista de Eventos',
    'Técnico/a de Eventos',
    'Garzón/a de Eventos',
    'Anfitrión/a',
    'Promotor/a',
    'DJ',
    'Animador/a de Eventos'
  ],


  // ============================================================
  // DEPORTE
  // ============================================================

  'Deporte y Fitness': [
    'Entrenador/a',
    'Entrenador/a Personal',
    'Personal Trainer',
    'Preparador/a Físico/a',
    'Profesor/a de Educación Física',
    'Instructor/a de Gimnasio',
    'Instructor/a de Yoga',
    'Instructor/a de Pilates',
    'Entrenador/a de Fútbol',
    'Árbitro/a',
    'Salvavidas',
    'Masajista Deportivo/a',
    'Nutricionista Deportivo/a'
  ],


  // ============================================================
  // CIENCIAS
  // ============================================================

  'Ciencias y Laboratorio': [
    'Biólogo/a',
    'Químico/a',
    'Físico/a',
    'Bioquímico/a',
    'Microbiólogo/a',
    'Biotecnólogo/a',
    'Investigador/a',
    'Asistente de Investigación',
    'Técnico/a de Laboratorio',
    'Analista de Laboratorio',
    'Laboratorista',
    'Laboratorista Químico/a',
    'Jefe/a de Laboratorio'
  ],


  // ============================================================
  // MEDIO AMBIENTE
  // ============================================================

  'Medio Ambiente': [
    'Ingeniero/a Ambiental',
    'Técnico/a Ambiental',
    'Analista Ambiental',
    'Especialista Ambiental',
    'Consultor/a Ambiental',
    'Inspector/a Ambiental',
    'Encargado/a de Medio Ambiente',
    'Gestor/a de Residuos',
    'Operador/a de Planta de Tratamiento'
  ],


  // ============================================================
  // INMOBILIARIA
  // ============================================================

  'Inmobiliaria': [
    'Corredor/a de Propiedades',
    'Agente Inmobiliario/a',
    'Ejecutivo/a Inmobiliario/a',
    'Asesor/a Inmobiliario/a',
    'Captador/a de Propiedades',
    'Administrador/a de Propiedades',
    'Administrador/a de Condominio',
    'Tasador/a',
    'Jefe/a de Ventas Inmobiliarias'
  ],


  // ============================================================
  // SERVICIOS SOCIALES
  // ============================================================

  'Servicios Sociales': [
    'Trabajador/a Social',
    'Asistente Social',
    'Educador/a Social',
    'Monitor/a Social',
    'Gestor/a Comunitario/a',
    'Coordinador/a Social',
    'Mediador/a',
    'Cuidador/a de Adulto Mayor',
    'Cuidador/a',
    'Acompañante Terapéutico/a',
    'Niñera',
    'Babysitter'
  ],


  // ============================================================
  // PUERTOS Y MARÍTIMO
  // ============================================================

  'Portuario y Marítimo': [
    'Estibador/a',
    'Operario/a Portuario/a',
    'Movilizador/a Portuario/a',
    'Gruero/a Portuario/a',
    'Rigger',
    'Señalero/a',
    'Marinero/a',
    'Tripulante',
    'Patrón/a de Nave',
    'Capitán/a de Nave',
    'Oficial de Marina Mercante',
    'Agente de Aduanas',
    'Asistente de Aduanas',
    'Despachador/a de Aduanas'
  ],


  // ============================================================
  // AVIACIÓN
  // ============================================================

  'Aviación': [
    'Piloto/a',
    'Copiloto/a',
    'Tripulante de Cabina',
    'Auxiliar de Vuelo',
    'Mecánico/a de Aviación',
    'Técnico/a Aeronáutico/a',
    'Despachador/a de Vuelo',
    'Operador/a de Rampa',
    'Agente de Aeropuerto',
    'Agente de Tráfico',
    'Controlador/a de Tránsito Aéreo'
  ],


  // ============================================================
  // IMPRENTA
  // ============================================================

  'Imprenta y Gráfica': [
    'Operario/a de Imprenta',
    'Prensista',
    'Encuadernador/a',
    'Troquelador/a',
    'Serigrafista',
    'Impresor/a',
    'Diseñador/a Gráfico/a',
    'Preprensista'
  ],


  // ============================================================
  // MADERA
  // ============================================================

  'Madera y Mueblería': [
    'Carpintero/a',
    'Mueblista',
    'Ebanista',
    'Ayudante de Carpintería',
    'Operario/a de Mueblería',
    'Barnizador/a',
    'Lijador/a',
    'Tapicero/a'
  ],


  // ============================================================
  // SERVICIOS FUNERARIOS
  // ============================================================

  'Servicios Funerarios': [
    'Asistente Funerario/a',
    'Conductor/a Funerario/a',
    'Tanatopractor/a',
    'Embalsamador/a',
    'Asesor/a Funerario/a',
    'Operario/a de Cementerio',
    'Sepulturero/a'
  ]
};


// ============================================================
// NORMALIZAR TEXTO PARA ID
// ============================================================

function generarSlug(
  texto: string
): string {

  return texto
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}


// ============================================================
// CREAR CATÁLOGO PLANO
// ============================================================

export function generarCatalogoCargos():
  CargoCatalogo[] {

  const resultado:
    CargoCatalogo[] =
    [];

  const registrados =
    new Set<string>();


  for (
    const [
      areaLaboral,
      cargos
    ]
    of Object.entries(
      CARGOS_POR_AREA
    )
  ) {

    for (
      const nombre
      of cargos
    ) {

      const clave =
        `${areaLaboral}|${nombre}`
          .toLowerCase();


      if (
        registrados.has(
          clave
        )
      ) {

        continue;
      }


      registrados.add(
        clave
      );


      resultado.push({

        nombre:
          nombre,

        areaLaboral:
          areaLaboral
      });
    }
  }


  return resultado;
}


// ============================================================
// CARGAR CATÁLOGO EN FIRESTORE
// ============================================================

export async function cargarCatalogoCargos(
  firestore: Firestore
): Promise<{
  total: number;
  lotes: number;
}> {

  const cargos =
    generarCatalogoCargos();


  // Firestore admite hasta 500 operaciones
  // por batch. Dejamos margen usando 450.
  const TAMANO_LOTE =
    450;


  let lotesProcesados =
    0;


  for (
    let inicio = 0;
    inicio < cargos.length;
    inicio += TAMANO_LOTE
  ) {

    const loteCargos =
      cargos.slice(
        inicio,
        inicio + TAMANO_LOTE
      );


    const batch =
      writeBatch(
        firestore
      );


    for (
      const cargo
      of loteCargos
    ) {

      const cargoId =
        `${generarSlug(
          cargo.areaLaboral
        )}--${generarSlug(
          cargo.nombre
        )}`;


      const referencia =
        doc(
          collection(
            firestore,
            'cargos'
          ),
          cargoId
        );


      batch.set(
        referencia,
        {

          nombre:
            cargo.nombre,

          areaLaboral:
            cargo.areaLaboral,

          descripcion:
            `Cargo perteneciente al área ${cargo.areaLaboral}.`,

          numeroSolicitud:
            null,

          estado:
            'aceptada',

          activo:
            true,

          tipo:
            'catalogo',

          origen:
            'catalogo_inicial',

          fechaActualizacion:
            new Date()
        },
        {
          merge:
            true
        }
      );
    }


    await batch.commit();


    lotesProcesados++;
  }


  console.log(
    `Catálogo cargado correctamente: ${cargos.length} cargos.`
  );


  return {

    total:
      cargos.length,

    lotes:
      lotesProcesados
  };
}