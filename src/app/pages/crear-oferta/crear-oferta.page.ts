import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  Router,
  ActivatedRoute
} from '@angular/router';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButton,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonCheckbox,
  ToastController
} from '@ionic/angular';

import {
  addIcons
} from 'ionicons';

import {
  arrowBackOutline,
  saveOutline,
  briefcaseOutline,
  addOutline,
  trashOutline,
  searchOutline
} from 'ionicons/icons';

import {
  Auth
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  deleteField
} from '@angular/fire/firestore';


type PlantillaId =
  | 'ventas'
  | 'admin'
  | 'limpieza'
  | 'logistica';


interface AreaLaboralOption {
  nombre: string;
  plantillaId?: PlantillaId;
}


interface CargoLaboralOption {
  nombre: string;
  area: string;
  plantillaId?: PlantillaId;
}


@Component({
  selector:
    'app-crear-oferta',

  templateUrl:
    './crear-oferta.page.html',

  styleUrls: [
    './crear-oferta.page.scss'
  ],

  standalone:
    true,

  imports: [
    CommonModule,
    ReactiveFormsModule,

    IonContent,
    IonHeader,
    IonToolbar,
    IonButton,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    IonCard,
    IonCardContent,
    IonCheckbox
  ]
})

export class CrearOfertaPage
implements OnInit {

  private fb =
    inject(FormBuilder);

  private auth =
    inject(Auth);

  private firestore =
    inject(Firestore);

  private router =
    inject(Router);

  private route =
    inject(ActivatedRoute);

  private toastController =
    inject(ToastController);


  ofertaForm!: FormGroup;


  isLoading =
    false;

  isEditMode =
    false;

  ofertaId:
    string | null =
    null;


  empresaId =
    '';

  nombreEmpresa =
    '';


  // ============================================================
  // AUTOCOMPLETADO
  // ============================================================

  mostrarSugerenciasCargo =
    false;

  mostrarSugerenciasArea =
    false;


  cargosFiltrados:
    CargoLaboralOption[] =
    [];

  areasFiltradas:
    AreaLaboralOption[] =
    [];


  // ============================================================
  // ÁREAS LABORALES
  // ============================================================

  areasLaborales:
    AreaLaboralOption[] = [

    {
      nombre:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Mantenimiento y Limpieza',

      plantillaId:
        'limpieza'
    },

    {
      nombre:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    { nombre: 'Administración de Empresas' },
    { nombre: 'Administración Pública' },
    { nombre: 'Asistencia Administrativa' },
    { nombre: 'Secretariado' },
    { nombre: 'Gerencia' },
    { nombre: 'Gestión Empresarial' },
    { nombre: 'Planificación Estratégica' },
    { nombre: 'Control de Gestión' },
    { nombre: 'Consultoría' },
    { nombre: 'Desarrollo de Negocios' },

    { nombre: 'Contabilidad' },
    { nombre: 'Auditoría' },
    { nombre: 'Finanzas' },
    { nombre: 'Tesorería' },
    { nombre: 'Banca' },
    { nombre: 'Inversiones' },
    { nombre: 'Seguros' },
    { nombre: 'Crédito y Cobranza' },

    { nombre: 'Recursos Humanos' },
    { nombre: 'Reclutamiento y Selección' },
    { nombre: 'Desarrollo Organizacional' },
    { nombre: 'Remuneraciones' },
    { nombre: 'Capacitación' },
    { nombre: 'Bienestar Laboral' },
    { nombre: 'Relaciones Laborales' },

    { nombre: 'Informática' },
    { nombre: 'Tecnologías de la Información' },
    { nombre: 'Desarrollo de Software' },
    { nombre: 'Ingeniería de Software' },
    { nombre: 'Desarrollo Web' },
    { nombre: 'Desarrollo Mobile' },
    { nombre: 'Frontend' },
    { nombre: 'Backend' },
    { nombre: 'Full Stack' },
    { nombre: 'DevOps' },
    { nombre: 'Cloud Computing' },
    { nombre: 'Ciberseguridad' },
    { nombre: 'Seguridad de la Información' },
    { nombre: 'Soporte TI' },
    { nombre: 'Mesa de Ayuda' },
    { nombre: 'Infraestructura TI' },
    { nombre: 'Redes' },
    { nombre: 'Telecomunicaciones' },
    { nombre: 'Administración de Sistemas' },
    { nombre: 'Bases de Datos' },
    { nombre: 'Data Science' },
    { nombre: 'Análisis de Datos' },
    { nombre: 'Business Intelligence' },
    { nombre: 'Inteligencia Artificial' },
    { nombre: 'Machine Learning' },
    { nombre: 'Automatización' },
    { nombre: 'Robótica' },
    { nombre: 'QA y Testing' },
    { nombre: 'Arquitectura de Software' },
    { nombre: 'Gestión de Proyectos TI' },

    { nombre: 'Ingeniería' },
    { nombre: 'Ingeniería Civil' },
    { nombre: 'Ingeniería Industrial' },
    { nombre: 'Ingeniería Mecánica' },
    { nombre: 'Ingeniería Eléctrica' },
    { nombre: 'Ingeniería Electrónica' },
    { nombre: 'Ingeniería Química' },
    { nombre: 'Ingeniería Ambiental' },
    { nombre: 'Ingeniería en Construcción' },
    { nombre: 'Ingeniería en Minas' },
    { nombre: 'Automatización Industrial' },

    { nombre: 'Producción' },
    { nombre: 'Operaciones' },
    { nombre: 'Manufactura' },
    { nombre: 'Procesos Industriales' },
    { nombre: 'Control de Calidad' },
    { nombre: 'Aseguramiento de Calidad' },
    { nombre: 'Mantenimiento Industrial' },
    { nombre: 'Planificación de Producción' },

    { nombre: 'Logística' },
    { nombre: 'Logística y Distribución' },
    { nombre: 'Logística Internacional' },
    { nombre: 'Operaciones Logísticas' },
    { nombre: 'Supply Chain' },
    { nombre: 'Cadena de Suministro' },
    { nombre: 'Abastecimiento' },
    { nombre: 'Compras' },
    { nombre: 'Inventario' },
    { nombre: 'Distribución' },
    { nombre: 'Despacho' },

    { nombre: 'Ventas' },
    { nombre: 'Ventas Técnicas' },
    { nombre: 'Ventas Corporativas' },
    { nombre: 'Ventas Retail' },
    { nombre: 'Ventas B2B' },
    { nombre: 'Ventas B2C' },
    { nombre: 'Comercial' },
    { nombre: 'Servicio al Cliente' },
    { nombre: 'Postventa' },

    { nombre: 'Marketing' },
    { nombre: 'Marketing Digital' },
    { nombre: 'Publicidad' },
    { nombre: 'Comunicaciones' },
    { nombre: 'Relaciones Públicas' },
    { nombre: 'Community Management' },
    { nombre: 'Redes Sociales' },
    { nombre: 'E-commerce' },
    { nombre: 'SEO' },
    { nombre: 'SEM' },
    { nombre: 'Branding' },
    { nombre: 'Investigación de Mercado' },

    { nombre: 'Diseño' },
    { nombre: 'Diseño Gráfico' },
    { nombre: 'Diseño Industrial' },
    { nombre: 'Diseño UX/UI' },
    { nombre: 'Diseño Web' },
    { nombre: 'Diseño de Productos' },
    { nombre: 'Ilustración' },
    { nombre: 'Animación' },
    { nombre: 'Multimedia' },

    { nombre: 'Construcción' },
    { nombre: 'Arquitectura' },
    { nombre: 'Obras Civiles' },
    { nombre: 'Topografía' },
    { nombre: 'Electricidad' },
    { nombre: 'Gasfitería' },
    { nombre: 'Carpintería' },
    { nombre: 'Climatización' },

    { nombre: 'Salud' },
    { nombre: 'Medicina' },
    { nombre: 'Enfermería' },
    { nombre: 'Odontología' },
    { nombre: 'Kinesiología' },
    { nombre: 'Fonoaudiología' },
    { nombre: 'Nutrición' },
    { nombre: 'Psicología' },
    { nombre: 'Terapia Ocupacional' },
    { nombre: 'Tecnología Médica' },
    { nombre: 'Farmacia' },
    { nombre: 'Veterinaria' },

    { nombre: 'Educación' },
    { nombre: 'Docencia' },
    { nombre: 'Educación Parvularia' },
    { nombre: 'Educación Básica' },
    { nombre: 'Educación Media' },
    { nombre: 'Educación Superior' },
    { nombre: 'Investigación Académica' },

    { nombre: 'Ciencias' },
    { nombre: 'Biología' },
    { nombre: 'Química' },
    { nombre: 'Física' },
    { nombre: 'Biotecnología' },
    { nombre: 'Laboratorio' },
    { nombre: 'Investigación y Desarrollo' },

    { nombre: 'Derecho' },
    { nombre: 'Asesoría Legal' },
    { nombre: 'Compliance' },
    { nombre: 'Asuntos Regulatorios' },
    { nombre: 'Gestión de Contratos' },

    { nombre: 'Trabajo Social' },
    { nombre: 'Servicios Sociales' },
    { nombre: 'Desarrollo Comunitario' },
    { nombre: 'ONG' },

    { nombre: 'Gastronomía' },
    { nombre: 'Cocina' },
    { nombre: 'Pastelería' },
    { nombre: 'Panadería' },
    { nombre: 'Restaurantes' },
    { nombre: 'Hotelería' },
    { nombre: 'Turismo' },

    { nombre: 'Aseo y Limpieza' },
    { nombre: 'Servicios Generales' },
    { nombre: 'Seguridad' },
    { nombre: 'Prevención de Riesgos' },
    { nombre: 'Jardinería' },

    { nombre: 'Agricultura' },
    { nombre: 'Agronomía' },
    { nombre: 'Ganadería' },
    { nombre: 'Forestal' },
    { nombre: 'Pesca' },
    { nombre: 'Acuicultura' },

    { nombre: 'Minería' },
    { nombre: 'Operaciones Mineras' },
    { nombre: 'Geología' },
    { nombre: 'Metalurgia' },

    { nombre: 'Transporte' },
    { nombre: 'Conducción' },
    { nombre: 'Transporte de Carga' },
    { nombre: 'Transporte de Pasajeros' },

    { nombre: 'Arte' },
    { nombre: 'Música' },
    { nombre: 'Teatro' },
    { nombre: 'Cine' },
    { nombre: 'Fotografía' },
    { nombre: 'Producción Audiovisual' },

    { nombre: 'Periodismo' },
    { nombre: 'Medios de Comunicación' },
    { nombre: 'Producción de Contenidos' },
    { nombre: 'Editorial' },

    { nombre: 'Deporte' },
    { nombre: 'Fitness' },
    { nombre: 'Belleza y Estética' },
    { nombre: 'Moda' },
    { nombre: 'Eventos' },
    { nombre: 'Inmobiliaria' },
    { nombre: 'Corretaje de Propiedades' }
  ];


  // ============================================================
  // CARGOS
  // ============================================================

  cargosLaborales:
    CargoLaboralOption[] = [

    {
      nombre:
        'Ejecutivo/a de Ventas',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Vendedor/a',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Vendedor/a Retail',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Ejecutivo/a Comercial',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Asesor/a Comercial',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Ejecutivo/a de Atención al Cliente',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Asistente de Ventas',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Cajero/a',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Operador/a Call Center',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },

    {
      nombre:
        'Ejecutivo/a de Televentas',

      area:
        'Atención al Cliente y Ventas',

      plantillaId:
        'ventas'
    },


    {
      nombre:
        'Administrativo/a',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Asistente Administrativo/a',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Secretario/a',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Recepcionista',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Digitador/a',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Asistente de Gerencia',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },

    {
      nombre:
        'Analista Administrativo/a',

      area:
        'Administración y Oficina',

      plantillaId:
        'admin'
    },


    {
      nombre:
        'Operario/a de Bodega',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Asistente de Bodega',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Encargado/a de Bodega',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Reponedor/a',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Operario/a de Picking',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Operario/a de Packing',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Operario/a Logístico/a',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Despachador/a',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },

    {
      nombre:
        'Controlador/a de Inventario',

      area:
        'Logística y Bodega',

      plantillaId:
        'logistica'
    },


    {
      nombre:
        'Auxiliar de Aseo',

      area:
        'Mantenimiento y Limpieza',

      plantillaId:
        'limpieza'
    },

    {
      nombre:
        'Operario/a de Limpieza',

      area:
        'Mantenimiento y Limpieza',

      plantillaId:
        'limpieza'
    },

    {
      nombre:
        'Auxiliar de Servicios',

      area:
        'Mantenimiento y Limpieza',

      plantillaId:
        'limpieza'
    },

    {
      nombre:
        'Auxiliar de Mantención',

      area:
        'Mantenimiento y Limpieza',

      plantillaId:
        'limpieza'
    },

    {
      nombre:
        'Encargado/a de Aseo',

      area:
        'Mantenimiento y Limpieza',

      plantillaId:
        'limpieza'
    },


    {
      nombre:
        'Desarrollador/a de Software',

      area:
        'Desarrollo de Software'
    },

    {
      nombre:
        'Desarrollador/a Frontend',

      area:
        'Frontend'
    },

    {
      nombre:
        'Desarrollador/a Backend',

      area:
        'Backend'
    },

    {
      nombre:
        'Desarrollador/a Full Stack',

      area:
        'Full Stack'
    },

    {
      nombre:
        'Desarrollador/a Mobile',

      area:
        'Desarrollo Mobile'
    },

    {
      nombre:
        'Analista Programador/a',

      area:
        'Desarrollo de Software'
    },

    {
      nombre:
        'Ingeniero/a de Software',

      area:
        'Ingeniería de Software'
    },

    {
      nombre:
        'Soporte TI',

      area:
        'Soporte TI'
    },

    {
      nombre:
        'Técnico/a de Soporte',

      area:
        'Soporte TI'
    },

    {
      nombre:
        'Analista de Soporte',

      area:
        'Soporte TI'
    },

    {
      nombre:
        'Analista de Mesa de Ayuda',

      area:
        'Mesa de Ayuda'
    },

    {
      nombre:
        'Administrador/a de Sistemas',

      area:
        'Administración de Sistemas'
    },

    {
      nombre:
        'Administrador/a de Redes',

      area:
        'Redes'
    },

    {
      nombre:
        'Ingeniero/a de Redes',

      area:
        'Redes'
    },

    {
      nombre:
        'Analista de Ciberseguridad',

      area:
        'Ciberseguridad'
    },

    {
      nombre:
        'Analista de Datos',

      area:
        'Análisis de Datos'
    },

    {
      nombre:
        'Data Scientist',

      area:
        'Data Science'
    },

    {
      nombre:
        'Data Engineer',

      area:
        'Análisis de Datos'
    },

    {
      nombre:
        'Analista Business Intelligence',

      area:
        'Business Intelligence'
    },

    {
      nombre:
        'QA Tester',

      area:
        'QA y Testing'
    },

    {
      nombre:
        'Ingeniero/a DevOps',

      area:
        'DevOps'
    },

    {
      nombre:
        'Cloud Engineer',

      area:
        'Cloud Computing'
    },


    {
      nombre:
        'Analista de Recursos Humanos',

      area:
        'Recursos Humanos'
    },

    {
      nombre:
        'Asistente de Recursos Humanos',

      area:
        'Recursos Humanos'
    },

    {
      nombre:
        'Analista de Reclutamiento',

      area:
        'Reclutamiento y Selección'
    },

    {
      nombre:
        'Recruiter',

      area:
        'Reclutamiento y Selección'
    },


    {
      nombre:
        'Contador/a',

      area:
        'Contabilidad'
    },

    {
      nombre:
        'Analista Contable',

      area:
        'Contabilidad'
    },

    {
      nombre:
        'Auditor/a',

      area:
        'Auditoría'
    },

    {
      nombre:
        'Analista Financiero/a',

      area:
        'Finanzas'
    },

    {
      nombre:
        'Ejecutivo/a Bancario/a',

      area:
        'Banca'
    },


    {
      nombre:
        'Analista de Marketing',

      area:
        'Marketing'
    },

    {
      nombre:
        'Especialista en Marketing Digital',

      area:
        'Marketing Digital'
    },

    {
      nombre:
        'Community Manager',

      area:
        'Community Management'
    },

    {
      nombre:
        'Diseñador/a Gráfico/a',

      area:
        'Diseño Gráfico'
    },

    {
      nombre:
        'Diseñador/a UX/UI',

      area:
        'Diseño UX/UI'
    },


    {
      nombre:
        'Operario/a de Producción',

      area:
        'Producción'
    },

    {
      nombre:
        'Supervisor/a de Producción',

      area:
        'Producción'
    },

    {
      nombre:
        'Analista de Operaciones',

      area:
        'Operaciones'
    },

    {
      nombre:
        'Técnico/a de Mantenimiento',

      area:
        'Mantenimiento Industrial'
    },

    {
      nombre:
        'Ingeniero/a Industrial',

      area:
        'Ingeniería Industrial'
    },

    {
      nombre:
        'Ingeniero/a Mecánico/a',

      area:
        'Ingeniería Mecánica'
    },

    {
      nombre:
        'Ingeniero/a Eléctrico/a',

      area:
        'Ingeniería Eléctrica'
    },


    {
      nombre:
        'Arquitecto/a',

      area:
        'Arquitectura'
    },

    {
      nombre:
        'Constructor/a Civil',

      area:
        'Construcción'
    },

    {
      nombre:
        'Topógrafo/a',

      area:
        'Topografía'
    },


    {
      nombre:
        'Enfermero/a',

      area:
        'Enfermería'
    },

    {
      nombre:
        'Técnico/a en Enfermería',

      area:
        'Enfermería'
    },

    {
      nombre:
        'Médico/a',

      area:
        'Medicina'
    },

    {
      nombre:
        'Kinesiólogo/a',

      area:
        'Kinesiología'
    },

    {
      nombre:
        'Psicólogo/a',

      area:
        'Psicología'
    },


    {
      nombre:
        'Profesor/a',

      area:
        'Docencia'
    },

    {
      nombre:
        'Educador/a de Párvulos',

      area:
        'Educación Parvularia'
    },


    {
      nombre:
        'Conductor/a',

      area:
        'Conducción'
    },

    {
      nombre:
        'Conductor/a de Camión',

      area:
        'Transporte de Carga'
    },

    {
      nombre:
        'Chofer de Reparto',

      area:
        'Transporte'
    },


    {
      nombre:
        'Guardia de Seguridad',

      area:
        'Seguridad'
    },

    {
      nombre:
        'Prevencionista de Riesgos',

      area:
        'Prevención de Riesgos'
    },


    {
      nombre:
        'Cocinero/a',

      area:
        'Cocina'
    },

    {
      nombre:
        'Ayudante de Cocina',

      area:
        'Cocina'
    },

    {
      nombre:
        'Garzón/a',

      area:
        'Restaurantes'
    },

    {
      nombre:
        'Pastelero/a',

      area:
        'Pastelería'
    },


    {
      nombre:
        'Trabajador/a Social',

      area:
        'Trabajo Social'
    },

    {
      nombre:
        'Abogado/a',

      area:
        'Derecho'
    },

    {
      nombre:
        'Periodista',

      area:
        'Periodismo'
    },

    {
      nombre:
        'Fotógrafo/a',

      area:
        'Fotografía'
    }
  ];


  // ============================================================
  // PLANTILLAS
  // ============================================================

  plantillas:
    Record<string, any> = {


    ventas: {

      preguntas: [

        {
          id:
            'ventas-1',

          texto:
            '¿Qué experiencia previa tiene en atención a público o ventas?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Más de 3 años de experiencia',

              puntaje:
                25
            },

            {
              texto:
                'Entre 1 y 3 años de experiencia',

              puntaje:
                15
            },

            {
              texto:
                'Menos de 1 año o sin experiencia',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'ventas-2',

          texto:
            '¿Cómo prefiere comunicarse y atender a los clientes?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'De manera presencial y directa',

              puntaje:
                25
            },

            {
              texto:
                'Por teléfono o mensajería',

              puntaje:
                20
            },

            {
              texto:
                'Prefiero tareas internas',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'ventas-3',

          texto:
            '¿Tiene disponibilidad para turnos rotativos/fines de semana?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Disponibilidad completa',

              puntaje:
                25
            },

            {
              texto:
                'Solo de lunes a viernes',

              puntaje:
                15
            },

            {
              texto:
                'Solo medio día',

              puntaje:
                20
            }
          ]
        },


        {
          id:
            'ventas-4',

          texto:
            '¿Maneja caja o terminales de pago (Transbank, etc.)?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Sí, manejo fluido',

              puntaje:
                25
            },

            {
              texto:
                'Nociones básicas',

              puntaje:
                15
            },

            {
              texto:
                'No tengo experiencia',

              puntaje:
                5
            }
          ]
        }
      ]
    },


    admin: {

      preguntas: [

        {
          id:
            'admin-1',

          texto:
            '¿Nivel de experiencia en labores administrativas/recepción?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Experiencia comprobable',

              puntaje:
                25
            },

            {
              texto:
                'Apoyo de forma puntual',

              puntaje:
                15
            },

            {
              texto:
                'Sin experiencia en oficina',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'admin-2',

          texto:
            '¿Cómo evalúa su manejo de computador y correo?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Básico - Medio (sé usar correo y Word)',

              puntaje:
                25
            },

            {
              texto:
                'Básico (con ayuda)',

              puntaje:
                15
            },

            {
              texto:
                'Sin experiencia',

              puntaje:
                0
            }
          ]
        },


        {
          id:
            'admin-3',

          texto:
            '¿Cómo organiza el registro de llamadas o visitas?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Con agendas o planillas',

              puntaje:
                25
            },

            {
              texto:
                'Anoto a medida que llegan',

              puntaje:
                15
            },

            {
              texto:
                'Prefiero indicaciones directas',

              puntaje:
                10
            }
          ]
        },


        {
          id:
            'admin-4',

          texto:
            '¿Cuál es su disponibilidad horaria?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Completa (continuada)',

              puntaje:
                25
            },

            {
              texto:
                'Media jornada',

              puntaje:
                20
            },

            {
              texto:
                'Por horas flexibles',

              puntaje:
                10
            }
          ]
        }
      ]
    },


    limpieza: {

      preguntas: [

        {
          id:
            'limpieza-1',

          texto:
            '¿Experiencia en limpieza o mantenimiento?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Extensa en empresas',

              puntaje:
                25
            },

            {
              texto:
                'Casas particulares/esporádicos',

              puntaje:
                15
            },

            {
              texto:
                'Sin experiencia',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'limpieza-2',

          texto:
            'Respecto al esfuerzo físico (estar de pie, moverse):',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Puedo realizar actividad moderada',

              puntaje:
                25
            },

            {
              texto:
                'Prefiero no levantar peso',

              puntaje:
                15
            },

            {
              texto:
                'Requiero pausas constantes',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'limpieza-3',

          texto:
            '¿Conoce el uso de insumos de limpieza y seguridad?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Conozco productos y diluciones',

              puntaje:
                25
            },

            {
              texto:
                'Lo básico para casa',

              puntaje:
                15
            },

            {
              texto:
                'Necesito inducción',

              puntaje:
                10
            }
          ]
        },


        {
          id:
            'limpieza-4',

          texto:
            '¿Qué jornada prefiere?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Turno fijo (mañana o tarde)',

              puntaje:
                25
            },

            {
              texto:
                'Turnos rotativos',

              puntaje:
                20
            },

            {
              texto:
                'Fines de semana',

              puntaje:
                15
            }
          ]
        }
      ]
    },


    logistica: {

      preguntas: [

        {
          id:
            'logistica-1',

          texto:
            '¿Ha trabajado en reposición o bodega?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Sí, más de 1 año',

              puntaje:
                25
            },

            {
              texto:
                'Sí, de forma ocasional',

              puntaje:
                15
            },

            {
              texto:
                'No, me adapto rápido',

              puntaje:
                10
            }
          ]
        },


        {
          id:
            'logistica-2',

          texto:
            '¿Sabe usar listas de verificación o códigos?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Muy cómodo/a y minucioso/a',

              puntaje:
                25
            },

            {
              texto:
                'Sé seguir listas claras',

              puntaje:
                20
            },

            {
              texto:
                'Prefiero tareas mecánicas',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'logistica-3',

          texto:
            '¿Capacidad para mantenerse de pie/caminar?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Buena tolerancia con descansos',

              puntaje:
                25
            },

            {
              texto:
                'Tolerancia moderada',

              puntaje:
                15
            },

            {
              texto:
                'Requiero estar sentado/a',

              puntaje:
                5
            }
          ]
        },


        {
          id:
            'logistica-4',

          texto:
            '¿Disponibilidad de traslado para turnos?',

          tipo:
            'seleccion',

          requerida:
            true,

          opciones: [

            {
              texto:
                'Disponibilidad completa',

              puntaje:
                25
            },

            {
              texto:
                'Dependo de transporte público',

              puntaje:
                15
            },

            {
              texto:
                'Acotada a las mañanas',

              puntaje:
                10
            }
          ]
        }
      ]
    }
  };


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor() {

    addIcons({

      'arrow-back-outline':
        arrowBackOutline,

      'save-outline':
        saveOutline,

      'briefcase-outline':
        briefcaseOutline,

      'add-outline':
        addOutline,

      'trash-outline':
        trashOutline,

      'search-outline':
        searchOutline
    });
  }


  // ============================================================
  // INICIO
  // ============================================================

  async ngOnInit() {

    this.inicializarFormulario();


    this.ofertaId =
      this.route
        .snapshot
        .paramMap
        .get('id');


    this.isEditMode =
      !!this.ofertaId;


    const autorizado =
      await this
        .obtenerDatosReclutador();


    if (!autorizado) {

      return;
    }


    if (
      this.ofertaId
    ) {

      await this
        .cargarOfertaParaEditar(
          this.ofertaId
        );
    }
  }


  // ============================================================
  // FORMULARIO PRINCIPAL
  // ============================================================

  inicializarFormulario() {

    this.ofertaForm =
      this.fb.group({


        titulo: [

          '',

          [

            Validators.required,

            Validators.minLength(
              4
            )
          ]
        ],


        cargoNombre: [

          '',

          [

            Validators.required,

            Validators.minLength(
              2
            )
          ]
        ],


        cargoId: [
          ''
        ],


        formularioId: [
          ''
        ],


        descripcion: [

          '',

          [

            Validators.required,

            Validators.minLength(
              15
            )
          ]
        ],


        modalidad: [

          'Remoto',

          Validators.required
        ],


        areaLaboral: [

          '',

          Validators.required
        ],


        habilidades: [
          ''
        ],


        direccion: [
          ''
        ],


        contactoEmail: [

          '',

          [

            Validators.required,

            Validators.email
          ]
        ],


        contactoTelefono: [
          ''
        ],


        preguntas:
          this.fb.array(
            []
          )
      });
  }


  // ============================================================
  // AUTOCOMPLETADO CARGO
  // ============================================================

  buscarCargo(
    event: any
  ) {

    const texto =
      this.obtenerValorEvento(
        event
      );


    this.ofertaForm
      .get(
        'cargoNombre'
      )
      ?.setValue(
        texto,
        {
          emitEvent:
            false
        }
      );


    this.ofertaForm
      .patchValue(
        {
          cargoId:
            '',

          formularioId:
            ''
        },
        {
          emitEvent:
            false
        }
      );


    this.cargosFiltrados =
      this.filtrarCatalogo(
        texto,
        this.cargosLaborales
      );


    this.mostrarSugerenciasCargo =
      true;
  }


  mostrarCargosIniciales() {

    const valor =
      String(
        this.ofertaForm
          .get(
            'cargoNombre'
          )
          ?.value
        ??
        ''
      );


    this.cargosFiltrados =
      valor.trim()

        ? this.filtrarCatalogo(
            valor,
            this.cargosLaborales
          )

        : this.cargosLaborales
            .slice(
              0,
              15
            );


    this.mostrarSugerenciasCargo =
      true;
  }


  seleccionarCargo(
    cargo:
      CargoLaboralOption
  ) {

    const cargoId =
      this.generarSlug(
        cargo.nombre
      );


    this.ofertaForm
      .patchValue(
        {

          cargoNombre:
            cargo.nombre,

          cargoId:
            cargoId,

          areaLaboral:
            cargo.area,

          formularioId:
            cargo.plantillaId
            ??
            'personalizado'
        },
        {
          emitEvent:
            false
        }
      );


    this.mostrarSugerenciasCargo =
      false;


    this.cargosFiltrados =
      [];


    if (
      cargo.plantillaId
    ) {

      this.cargarPlantilla(
        cargo.plantillaId
      );

    } else {

      this.preguntas.clear();
    }
  }


  ocultarSugerenciasCargo() {

    setTimeout(
      () => {

        this.mostrarSugerenciasCargo =
          false;

      },
      200
    );
  }


  // ============================================================
  // AUTOCOMPLETADO ÁREA
  // ============================================================

  buscarArea(
    event:
      any
  ) {

    const texto =
      this.obtenerValorEvento(
        event
      );


    this.ofertaForm
      .get(
        'areaLaboral'
      )
      ?.setValue(
        texto,
        {
          emitEvent:
            false
        }
      );


    this.areasFiltradas =
      this.filtrarCatalogo(
        texto,
        this.areasLaborales
      );


    this.mostrarSugerenciasArea =
      true;
  }


  mostrarAreasIniciales() {

    const valor =
      String(
        this.ofertaForm
          .get(
            'areaLaboral'
          )
          ?.value
        ??
        ''
      );


    this.areasFiltradas =
      valor.trim()

        ? this.filtrarCatalogo(
            valor,
            this.areasLaborales
          )

        : this.areasLaborales
            .slice(
              0,
              15
            );


    this.mostrarSugerenciasArea =
      true;
  }


  seleccionarArea(
    area:
      AreaLaboralOption
  ) {

    this.ofertaForm
      .patchValue(
        {

          areaLaboral:
            area.nombre,

          formularioId:
            area.plantillaId
            ??
            'personalizado'
        },
        {
          emitEvent:
            false
        }
      );


    this.mostrarSugerenciasArea =
      false;


    this.areasFiltradas =
      [];


    if (
      area.plantillaId
    ) {

      this.cargarPlantilla(
        area.plantillaId
      );
    }
  }


  ocultarSugerenciasArea() {

    setTimeout(
      () => {

        this.mostrarSugerenciasArea =
          false;

      },
      200
    );
  }


  // ============================================================
  // FILTRO GENÉRICO
  // ============================================================

  private filtrarCatalogo<
    T extends {
      nombre: string;
    }
  >(
    texto:
      string,

    catalogo:
      T[]
  ):
    T[] {

    const busqueda =
      this.normalizarTexto(
        texto
      );


    if (!busqueda) {

      return catalogo
        .slice(
          0,
          15
        );
    }


    const comienzanCon =
      catalogo.filter(
        item =>
          this.normalizarTexto(
            item.nombre
          )
            .startsWith(
              busqueda
            )
      );


    const contienen =
      catalogo.filter(
        item => {

          const normalizado =
            this.normalizarTexto(
              item.nombre
            );


          return (

            !normalizado
              .startsWith(
                busqueda
              )

            &&

            normalizado
              .includes(
                busqueda
              )
          );
        }
      );


    return [
      ...comienzanCon,
      ...contienen
    ]
      .slice(
        0,
        15
      );
  }


  private normalizarTexto(
    texto:
      string
  ):
    string {

    return String(
      texto
      ??
      ''
    )
      .trim()
      .toLowerCase()
      .normalize(
        'NFD'
      )
      .replace(
        /[\u0300-\u036f]/g,
        ''
      );
  }


  private obtenerValorEvento(
    event:
      any
  ):
    string {

    return String(

      event
        ?.detail
        ?.value

      ??

      event
        ?.target
        ?.value

      ??

      ''

    );
  }


  private generarSlug(
    texto:
      string
  ):
    string {

    return this
      .normalizarTexto(
        texto
      )
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
  // COMPATIBILIDAD ÁREAS ANTIGUAS
  // ============================================================

  private convertirAreaAntigua(
    area:
      any
  ):
    string {

    const valor =
      String(
        area
        ??
        ''
      );


    const mapa:
      Record<string, string> = {

      ventas:
        'Atención al Cliente y Ventas',

      admin:
        'Administración y Oficina',

      limpieza:
        'Mantenimiento y Limpieza',

      logistica:
        'Logística y Bodega'
    };


    return (
      mapa[
        valor
      ]
      ??
      valor
    );
  }


  private obtenerPlantillaAntigua(
    area:
      any
  ):
    string {

    const valor =
      String(
        area
        ??
        ''
      )
        .trim()
        .toLowerCase();


    if (
      [
        'ventas',
        'admin',
        'limpieza',
        'logistica'
      ]
        .includes(
          valor
        )
    ) {

      return valor;
    }


    return '';
  }


  // ============================================================
  // FORMARRAY
  // ============================================================

  get preguntas():
    FormArray {

    return (
      this.ofertaForm
        .get(
          'preguntas'
        ) as FormArray
    );
  }


  crearPregunta(
    data?:
      any
  ):
    FormGroup {

    const opciones =
      this.fb.array<FormGroup>(
        []
      );


    if (
      Array.isArray(
        data?.opciones
      )
    ) {

      data.opciones
        .forEach(
          (
            opcion:
              any
          ) => {

            opciones.push(
              this.crearOpcion(
                opcion
              )
            );
          }
        );
    }


    return this.fb.group({

      id: [

        data?.id
        ||
        this.generarIdPregunta()
      ],


      texto: [

        data?.texto
        ||
        '',

        [

          Validators.required,

          Validators.minLength(
            5
          )
        ]
      ],


      tipo: [

        data?.tipo
        ||
        (
          Array.isArray(
            data?.opciones
          )
          &&
          data.opciones.length > 0

            ? 'seleccion'
            : 'texto'
        ),

        Validators.required
      ],


      requerida: [

        data?.requerida
        ??
        true
      ],


      opciones:
        opciones
    });
  }


  crearOpcion(
    data?:
      any
  ):
    FormGroup {

    return this.fb.group({

      texto: [

        data?.texto
        ||
        '',

        Validators.required
      ],


      puntaje: [

        data?.puntaje
        ??
        0,

        [

          Validators.required,

          Validators.min(
            0
          )
        ]
      ]
    });
  }


  agregarPregunta() {

    this.preguntas
      .push(

        this.crearPregunta({

          tipo:
            'texto',

          requerida:
            true,

          opciones:
            []
        })
      );


    if (
      !this.ofertaForm
        .get(
          'formularioId'
        )
        ?.value
    ) {

      this.ofertaForm
        .get(
          'formularioId'
        )
        ?.setValue(
          'personalizado'
        );
    }
  }


  eliminarPregunta(
    index:
      number
  ) {

    this.preguntas
      .removeAt(
        index
      );
  }


  getOpciones(
    preguntaIndex:
      number
  ):
    FormArray {

    return (
      this.preguntas
        .at(
          preguntaIndex
        )
        .get(
          'opciones'
        ) as FormArray
    );
  }


  agregarOpcion(
    preguntaIndex:
      number
  ) {

    this.getOpciones(
      preguntaIndex
    )
      .push(

        this.crearOpcion({

          texto:
            '',

          puntaje:
            0
        })
      );
  }


  eliminarOpcion(

    preguntaIndex:
      number,

    opcionIndex:
      number

  ) {

    this.getOpciones(
      preguntaIndex
    )
      .removeAt(
        opcionIndex
      );
  }


  cambiarTipoPregunta(
    index:
      number
  ) {

    const pregunta =
      this.preguntas
        .at(
          index
        );


    const tipo =
      pregunta
        .get(
          'tipo'
        )
        ?.value;


    const opciones =
      pregunta
        .get(
          'opciones'
        ) as FormArray;


    if (
      tipo ===
        'seleccion'
      &&
      opciones.length ===
        0
    ) {

      opciones.push(

        this.crearOpcion({

          texto:
            'Opción 1',

          puntaje:
            0
        })
      );


      opciones.push(

        this.crearOpcion({

          texto:
            'Opción 2',

          puntaje:
            0
        })
      );
    }


    if (
      tipo ===
      'texto'
    ) {

      opciones.clear();
    }
  }


  private generarIdPregunta():
    string {

    return (
      `p-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`
    );
  }


  // ============================================================
  // PUNTAJE MÁXIMO
  // ============================================================

  get puntajeMaximo():
    number {

    return this.preguntas.controls
      .reduce(

        (
          total,
          pregunta
        ) => {

          if (
            pregunta
              .get(
                'tipo'
              )
              ?.value !==
            'seleccion'
          ) {

            return total;
          }


          const opciones =
            pregunta
              .get(
                'opciones'
              )
              ?.value
            ||
            [];


          const puntajes =
            opciones.map(

              (
                opcion:
                  any
              ) =>

                Number(
                  opcion.puntaje
                )
                ||
                0
            );


          const maximo =
            puntajes.length > 0

              ? Math.max(
                  ...puntajes
                )

              : 0;


          return (
            total +
            maximo
          );
        },

        0
      );
  }


  // ============================================================
  // PLANTILLAS
  // ============================================================

  cargarPlantilla(
    area:
      string
  ) {

    this.preguntas.clear();


    const plantilla =
      this.plantillas[
        area
      ];


    if (
      !plantilla
        ?.preguntas
    ) {

      return;
    }


    this.ofertaForm
      .get(
        'formularioId'
      )
      ?.setValue(
        area,
        {
          emitEvent:
            false
        }
      );


    plantilla.preguntas
      .forEach(

        (
          pregunta:
            any
        ) => {

          const clon =
            JSON.parse(
              JSON.stringify(
                pregunta
              )
            );


          this.preguntas.push(
            this.crearPregunta(
              clon
            )
          );
        }
      );
  }


  // ============================================================
  // DATOS RECLUTADOR
  // ============================================================

  async obtenerDatosReclutador():
    Promise<boolean> {

    const user =
      this.auth.currentUser;


    if (!user) {

      await this.mostrarToast(
        'No existe una sesión activa.',
        'danger'
      );


      this.router.navigate(
        ['/auth/login']
      );


      return false;
    }


    try {

      const recDoc =
        await getDoc(

          doc(
            this.firestore,
            'reclutadores',
            user.uid
          )
        );


      if (
        !recDoc.exists()
      ) {

        await this.mostrarToast(
          'No fue posible encontrar tu perfil de reclutador.',
          'danger'
        );


        this.router.navigate(
          ['/home']
        );


        return false;
      }


      const data =
        recDoc.data();


      const estado =
        String(
          data['estado']
          ??
          ''
        )
          .trim()
          .toLowerCase();


      if (
        estado !==
        'aprobado'
      ) {

        await this.mostrarToast(
          'Tu cuenta aún está pendiente de aprobación. No puedes publicar ofertas.',
          'warning'
        );


        this.router.navigate(
          ['/home']
        );


        return false;
      }


      this.empresaId =
        data['empresaId']
        ||
        '';


      if (
        !this.isEditMode
      ) {

        this.ofertaForm.patchValue({

          contactoEmail:
            data['email']
            ||
            user.email
            ||
            ''
        });
      }


      if (
        this.empresaId
      ) {

        const empDoc =
          await getDoc(

            doc(
              this.firestore,
              'empresas',
              this.empresaId
            )
          );


        if (
          empDoc.exists()
        ) {

          this.nombreEmpresa =
            empDoc
              .data()['nombre']
            ||
            '';
        }
      }


      return true;


    } catch (error) {

      console.error(
        'Error al obtener datos del reclutador:',
        error
      );


      await this.mostrarToast(
        'No fue posible validar tu cuenta de reclutador.',
        'danger'
      );


      return false;
    }
  }


  // ============================================================
  // MODO EDICIÓN
  // ============================================================

  async cargarOfertaParaEditar(
    id:
      string
  ) {

    this.isLoading =
      true;


    try {

      const docRef =
        doc(
          this.firestore,
          'ofertas',
          id
        );


      const snap =
        await getDoc(
          docRef
        );


      if (
        !snap.exists()
      ) {

        await this.mostrarToast(
          'La oferta no existe.',
          'danger'
        );


        this.router.navigate(
          ['/home']
        );


        return;
      }


      const data =
        snap.data();


      const areaOriginal =
        data['areaLaboral']
        ||
        '';


      const areaVisible =
        this.convertirAreaAntigua(
          areaOriginal
        );


      const plantillaAntigua =
        this.obtenerPlantillaAntigua(
          areaOriginal
        );


      const cargoNombre =
        data['cargoNombre']
        ||
        data['titulo']
        ||
        '';


      const cargoId =
        data['cargoId']
        ||
        this.generarSlug(
          cargoNombre
        );


      this.ofertaForm.patchValue({

        titulo:
          data['titulo']
          ||
          '',


        cargoNombre:
          cargoNombre,


        cargoId:
          cargoId,


        formularioId:
          data['formularioId']
          ||
          plantillaAntigua
          ||
          '',


        descripcion:
          data['descripcion']
          ||
          '',


        modalidad:
          data['modalidad']
          ||
          'Remoto',


        areaLaboral:
          areaVisible,


        habilidades:
          data['habilidades']
          ||
          '',


        direccion:
          data['direccion']
          ||
          '',


        contactoEmail:
          data['contactoEmail']
          ||
          '',


        contactoTelefono:
          data['contactoTelefono']
          ||
          ''
      });


      this.preguntas.clear();


      if (
        Array.isArray(
          data['preguntas']
        )
      ) {

        data['preguntas']
          .forEach(

            (
              pregunta:
                any
            ) => {

              this.preguntas.push(
                this.crearPregunta(
                  pregunta
                )
              );
            }
          );
      }


      else if (
        data['cuestionario']
        &&
        Array.isArray(
          data['cuestionario'][
            'preguntas'
          ]
        )
      ) {

        data['cuestionario'][
          'preguntas'
        ]
          .forEach(

            (
              pregunta:
                any
            ) => {

              this.preguntas.push(

                this.crearPregunta({

                  ...pregunta,

                  tipo:
                    pregunta.tipo
                    ||
                    (
                      pregunta
                        .opciones
                        ?.length

                        ? 'seleccion'
                        : 'texto'
                    ),

                  requerida:
                    pregunta.requerida
                    ??
                    true
                })
              );
            }
          );
      }


      else if (
        plantillaAntigua
      ) {

        this.cargarPlantilla(
          plantillaAntigua
        );
      }


      if (
        !this.ofertaForm
          .get(
            'formularioId'
          )
          ?.value
        &&
        this.preguntas.length > 0
      ) {

        this.ofertaForm
          .get(
            'formularioId'
          )
          ?.setValue(
            'personalizado',
            {
              emitEvent:
                false
            }
          );
      }


    } catch (error) {

      console.error(
        'Error al cargar la oferta:',
        error
      );


      await this.mostrarToast(
        'No fue posible cargar la oferta.',
        'danger'
      );


    } finally {

      this.isLoading =
        false;
    }
  }


  // ============================================================
  // SERIALIZACIÓN
  // ============================================================

  private obtenerPreguntasParaGuardar() {

    return this.preguntas.controls
      .map(

        control => {

          const pregunta =
            control
              .getRawValue();


          return {

            id:
              pregunta.id
              ||
              this.generarIdPregunta(),


            texto:
              String(
                pregunta.texto
                ||
                ''
              )
                .trim(),


            tipo:
              pregunta.tipo
              ||
              'texto',


            requerida:
              !!pregunta.requerida,


            opciones:
              pregunta.tipo ===
              'seleccion'

                ? (
                    pregunta.opciones
                    ||
                    []
                  )

                    .filter(
                      (
                        opcion:
                          any
                      ) =>

                        String(
                          opcion.texto
                          ||
                          ''
                        )
                          .trim() !==
                        ''
                    )

                    .map(
                      (
                        opcion:
                          any
                      ) => ({

                        texto:
                          String(
                            opcion.texto
                          )
                            .trim(),

                        puntaje:
                          Number(
                            opcion.puntaje
                          )
                          ||
                          0
                      })
                    )

                : []
          };
        }
      );
  }


  // ============================================================
  // GUARDAR / ACTUALIZAR
  // ============================================================

  async guardarOferta() {

    if (
      this.ofertaForm.invalid
    ) {

      this.ofertaForm
        .markAllAsTouched();


      await this.mostrarToast(
        'Revisa los campos obligatorios antes de guardar.',
        'warning'
      );


      return;
    }


    const user =
      this.auth.currentUser;


    if (!user) {

      await this.mostrarToast(
        'No existe una sesión activa.',
        'danger'
      );


      return;
    }


    this.isLoading =
      true;


    const formValues =
      this.ofertaForm
        .getRawValue();


    const preguntas =
      this.obtenerPreguntasParaGuardar();


    const cargoNombre =
      String(
        formValues
          .cargoNombre
        ??
        ''
      )
        .trim();


    const cargoId =
      String(
        formValues
          .cargoId
        ??
        ''
      )
        .trim()

      ||

      this.generarSlug(
        cargoNombre
      );


    const areaLaboral =
      String(
        formValues
          .areaLaboral
        ??
        ''
      )
        .trim();


    let formularioId =
      String(
        formValues
          .formularioId
        ??
        ''
      )
        .trim();


    if (
      !formularioId
    ) {

      formularioId =
        preguntas.length > 0

          ? 'personalizado'

          : '';
    }


    try {

      // ======================================================
      // EDITAR
      // ======================================================

      if (
        this.isEditMode &&
        this.ofertaId
      ) {

        const docRef =
          doc(
            this.firestore,
            'ofertas',
            this.ofertaId
          );


        await updateDoc(
          docRef,
          {

            titulo:
              formValues.titulo,

            cargoId:
              cargoId,

            cargoNombre:
              cargoNombre,

            areaLaboral:
              areaLaboral,

            formularioId:
              formularioId,

            descripcion:
              formValues.descripcion,

            modalidad:
              formValues.modalidad,

            habilidades:
              formValues.habilidades,

            direccion:
              formValues.direccion,

            contactoEmail:
              formValues.contactoEmail,

            contactoTelefono:
              formValues.contactoTelefono,

            preguntas:
              preguntas,

            fechaActualizacion:
              new Date(),

            cuestionario:
              deleteField()
          }
        );


        await this.mostrarToast(
          'Oferta actualizada correctamente.'
        );
      }


      // ======================================================
      // CREAR
      // ======================================================

      else {

        const ofertasRef =
          collection(
            this.firestore,
            'ofertas'
          );


        await addDoc(
          ofertasRef,
          {

            titulo:
              formValues.titulo,

            cargoId:
              cargoId,

            cargoNombre:
              cargoNombre,

            areaLaboral:
              areaLaboral,

            formularioId:
              formularioId,

            descripcion:
              formValues.descripcion,

            modalidad:
              formValues.modalidad,

            habilidades:
              formValues.habilidades,

            direccion:
              formValues.direccion,

            contactoEmail:
              formValues.contactoEmail,

            contactoTelefono:
              formValues.contactoTelefono,

            preguntas:
              preguntas,

            empresaId:
              this.empresaId,

            nombreEmpresa:
              this.nombreEmpresa,

            reclutadorId:
              user.uid,

            estado:
              'Activa',

            candidatosCount:
              0,

            fechaPublicacion:
              new Date()
          }
        );


        await this.mostrarToast(
          '¡Oferta creada exitosamente!'
        );
      }


      this.router.navigate(
        ['/home']
      );


    } catch (error) {

      console.error(
        'Error al guardar:',
        error
      );


      await this.mostrarToast(
        'Ocurrió un error al guardar la oferta.',
        'danger'
      );


    } finally {

      this.isLoading =
        false;
    }
  }


  // ============================================================
  // VOLVER
  // ============================================================

  volver() {

    this.router.navigate(
      ['/home']
    );
  }


  // ============================================================
  // TOAST
  // ============================================================

  private async mostrarToast(

    mensaje:
      string,

    color:
      string =
      'success'

  ) {

    const toast =
      await this
        .toastController
        .create({

          message:
            mensaje,

          duration:
            3000,

          color:
            color,

          position:
            'top'
        });


    await toast.present();
  }
}