import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

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

import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  saveOutline,
  briefcaseOutline,
  addOutline,
  trashOutline
} from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  deleteField
} from '@angular/fire/firestore';

@Component({
  selector: 'app-crear-oferta',
  templateUrl: './crear-oferta.page.html',
  styleUrls: ['./crear-oferta.page.scss'],
  standalone: true,
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
export class CrearOfertaPage implements OnInit {

  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastController = inject(ToastController);

  ofertaForm!: FormGroup;

  isLoading = false;
  isEditMode = false;
  ofertaId: string | null = null;

  empresaId = '';
  nombreEmpresa = '';

  // ============================================================
  // PLANTILLAS DE PREGUNTAS POR ÁREA
  // ============================================================

  plantillas: Record<string, any> = {

    ventas: {
      preguntas: [
        {
          id: 'ventas-1',
          texto: '¿Qué experiencia previa tiene en atención a público o ventas?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Más de 3 años de experiencia', puntaje: 25 },
            { texto: 'Entre 1 y 3 años de experiencia', puntaje: 15 },
            { texto: 'Menos de 1 año o sin experiencia', puntaje: 5 }
          ]
        },
        {
          id: 'ventas-2',
          texto: '¿Cómo prefiere comunicarse y atender a los clientes?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'De manera presencial y directa', puntaje: 25 },
            { texto: 'Por teléfono o mensajería', puntaje: 20 },
            { texto: 'Prefiero tareas internas', puntaje: 5 }
          ]
        },
        {
          id: 'ventas-3',
          texto: '¿Tiene disponibilidad para turnos rotativos/fines de semana?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Disponibilidad completa', puntaje: 25 },
            { texto: 'Solo de lunes a viernes', puntaje: 15 },
            { texto: 'Solo medio día', puntaje: 20 }
          ]
        },
        {
          id: 'ventas-4',
          texto: '¿Maneja caja o terminales de pago (Transbank, etc.)?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Sí, manejo fluido', puntaje: 25 },
            { texto: 'Nociones básicas', puntaje: 15 },
            { texto: 'No tengo experiencia', puntaje: 5 }
          ]
        }
      ]
    },

    admin: {
      preguntas: [
        {
          id: 'admin-1',
          texto: '¿Nivel de experiencia en labores administrativas/recepción?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Experiencia comprobable', puntaje: 25 },
            { texto: 'Apoyo de forma puntual', puntaje: 15 },
            { texto: 'Sin experiencia en oficina', puntaje: 5 }
          ]
        },
        {
          id: 'admin-2',
          texto: '¿Cómo evalúa su manejo de computador y correo?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Básico - Medio (sé usar correo y Word)', puntaje: 25 },
            { texto: 'Básico (con ayuda)', puntaje: 15 },
            { texto: 'Sin experiencia', puntaje: 0 }
          ]
        },
        {
          id: 'admin-3',
          texto: '¿Cómo organiza el registro de llamadas o visitas?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Con agendas o planillas', puntaje: 25 },
            { texto: 'Anoto a medida que llegan', puntaje: 15 },
            { texto: 'Prefiero indicaciones directas', puntaje: 10 }
          ]
        },
        {
          id: 'admin-4',
          texto: '¿Cuál es su disponibilidad horaria?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Completa (continuada)', puntaje: 25 },
            { texto: 'Media jornada', puntaje: 20 },
            { texto: 'Por horas flexibles', puntaje: 10 }
          ]
        }
      ]
    },

    limpieza: {
      preguntas: [
        {
          id: 'limpieza-1',
          texto: '¿Experiencia en limpieza o mantenimiento?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Extensa en empresas', puntaje: 25 },
            { texto: 'Casas particulares/esporádicos', puntaje: 15 },
            { texto: 'Sin experiencia', puntaje: 5 }
          ]
        },
        {
          id: 'limpieza-2',
          texto: 'Respecto al esfuerzo físico (estar de pie, moverse):',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Puedo realizar actividad moderada', puntaje: 25 },
            { texto: 'Prefiero no levantar peso', puntaje: 15 },
            { texto: 'Requiero pausas constantes', puntaje: 5 }
          ]
        },
        {
          id: 'limpieza-3',
          texto: '¿Conoce el uso de insumos de limpieza y seguridad?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Conozco productos y diluciones', puntaje: 25 },
            { texto: 'Lo básico para casa', puntaje: 15 },
            { texto: 'Necesito inducción', puntaje: 10 }
          ]
        },
        {
          id: 'limpieza-4',
          texto: '¿Qué jornada prefiere?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Turno fijo (mañana o tarde)', puntaje: 25 },
            { texto: 'Turnos rotativos', puntaje: 20 },
            { texto: 'Fines de semana', puntaje: 15 }
          ]
        }
      ]
    },

    logistica: {
      preguntas: [
        {
          id: 'logistica-1',
          texto: '¿Ha trabajado en reposición o bodega?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Sí, más de 1 año', puntaje: 25 },
            { texto: 'Sí, de forma ocasional', puntaje: 15 },
            { texto: 'No, me adapto rápido', puntaje: 10 }
          ]
        },
        {
          id: 'logistica-2',
          texto: '¿Sabe usar listas de verificación o códigos?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Muy cómodo/a y minucioso/a', puntaje: 25 },
            { texto: 'Sé seguir listas claras', puntaje: 20 },
            { texto: 'Prefiero tareas mecánicas', puntaje: 5 }
          ]
        },
        {
          id: 'logistica-3',
          texto: '¿Capacidad para mantenerse de pie/caminar?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Buena tolerancia con descansos', puntaje: 25 },
            { texto: 'Tolerancia moderada', puntaje: 15 },
            { texto: 'Requiero estar sentado/a', puntaje: 5 }
          ]
        },
        {
          id: 'logistica-4',
          texto: '¿Disponibilidad de traslado para turnos?',
          tipo: 'seleccion',
          requerida: true,
          opciones: [
            { texto: 'Disponibilidad completa', puntaje: 25 },
            { texto: 'Dependo de transporte público', puntaje: 15 },
            { texto: 'Acotada a las mañanas', puntaje: 10 }
          ]
        }
      ]
    }
  };

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'save-outline': saveOutline,
      'briefcase-outline': briefcaseOutline,
      'add-outline': addOutline,
      'trash-outline': trashOutline
    });
  }

  async ngOnInit() {

    this.inicializarFormulario();

    this.ofertaId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.ofertaId;

    await this.obtenerDatosReclutador();

    if (this.ofertaId) {
      await this.cargarOfertaParaEditar(this.ofertaId);
    }
  }

  // ============================================================
  // FORMULARIO PRINCIPAL
  // ============================================================

  inicializarFormulario() {

    this.ofertaForm = this.fb.group({

      titulo: [
        '',
        [
          Validators.required,
          Validators.minLength(4)
        ]
      ],

      descripcion: [
        '',
        [
          Validators.required,
          Validators.minLength(15)
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

      habilidades: [''],

      direccion: [''],

      contactoEmail: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      contactoTelefono: [''],

      // NUEVO
      preguntas: this.fb.array([])
    });
  }

  // ============================================================
  // FORMARRAY PREGUNTAS
  // ============================================================

  get preguntas(): FormArray {
    return this.ofertaForm.get('preguntas') as FormArray;
  }

  crearPregunta(data?: any): FormGroup {

    const opciones = this.fb.array<FormGroup>([]);

    if (Array.isArray(data?.opciones)) {

      data.opciones.forEach((opcion: any) => {

        opciones.push(
          this.crearOpcion(opcion)
        );
      });
    }

    return this.fb.group({

      id: [
        data?.id || this.generarIdPregunta()
      ],

      texto: [
        data?.texto || '',
        [
          Validators.required,
          Validators.minLength(5)
        ]
      ],

      tipo: [
        data?.tipo ||
        (
          Array.isArray(data?.opciones) &&
          data.opciones.length > 0
            ? 'seleccion'
            : 'texto'
        ),
        Validators.required
      ],

      requerida: [
        data?.requerida ?? true
      ],

      opciones
    });
  }

  crearOpcion(data?: any): FormGroup {

    return this.fb.group({

      texto: [
        data?.texto || '',
        Validators.required
      ],

      puntaje: [
        data?.puntaje ?? 0,
        [
          Validators.required,
          Validators.min(0)
        ]
      ]
    });
  }

  agregarPregunta() {

    this.preguntas.push(
      this.crearPregunta({
        tipo: 'texto',
        requerida: true,
        opciones: []
      })
    );
  }

  eliminarPregunta(index: number) {

    this.preguntas.removeAt(index);
  }

  getOpciones(preguntaIndex: number): FormArray {

    return this.preguntas
      .at(preguntaIndex)
      .get('opciones') as FormArray;
  }

  agregarOpcion(preguntaIndex: number) {

    this.getOpciones(preguntaIndex)
      .push(
        this.crearOpcion({
          texto: '',
          puntaje: 0
        })
      );
  }

  eliminarOpcion(
    preguntaIndex: number,
    opcionIndex: number
  ) {

    this.getOpciones(preguntaIndex)
      .removeAt(opcionIndex);
  }

  cambiarTipoPregunta(index: number) {

    const pregunta = this.preguntas.at(index);
    const tipo = pregunta.get('tipo')?.value;

    const opciones =
      pregunta.get('opciones') as FormArray;

    if (
      tipo === 'seleccion' &&
      opciones.length === 0
    ) {

      opciones.push(
        this.crearOpcion({
          texto: 'Opción 1',
          puntaje: 0
        })
      );

      opciones.push(
        this.crearOpcion({
          texto: 'Opción 2',
          puntaje: 0
        })
      );
    }

    if (tipo === 'texto') {

      opciones.clear();
    }
  }

  private generarIdPregunta(): string {

    return `p-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;
  }

  // ============================================================
  // PUNTAJE MÁXIMO
  // ============================================================

  get puntajeMaximo(): number {

    return this.preguntas.controls.reduce(
      (total, pregunta) => {

        if (
          pregunta.get('tipo')?.value !==
          'seleccion'
        ) {
          return total;
        }

        const opciones =
          pregunta.get('opciones')?.value || [];

        const puntajes = opciones.map(
          (opcion: any) =>
            Number(opcion.puntaje) || 0
        );

        const maximo =
          puntajes.length > 0
            ? Math.max(...puntajes)
            : 0;

        return total + maximo;
      },
      0
    );
  }

  // ============================================================
  // PLANTILLAS
  // ============================================================

  cargarPlantilla(area: string) {

    this.preguntas.clear();

    const plantilla = this.plantillas[area];

    if (!plantilla?.preguntas) {
      return;
    }

    plantilla.preguntas.forEach(
      (pregunta: any) => {

        const clon = JSON.parse(
          JSON.stringify(pregunta)
        );

        this.preguntas.push(
          this.crearPregunta(clon)
        );
      }
    );
  }

  // ============================================================
  // DATOS RECLUTADOR
  // ============================================================

  async obtenerDatosReclutador() {

    const user = this.auth.currentUser;

    if (!user) {
      return;
    }

    try {

      const recDoc = await getDoc(
        doc(
          this.firestore,
          'reclutadores',
          user.uid
        )
      );

      if (!recDoc.exists()) {
        return;
      }

      const data = recDoc.data();

      this.empresaId =
        data['empresaId'] || '';

      if (!this.isEditMode) {

        this.ofertaForm.patchValue({
          contactoEmail:
            data['email'] ||
            user.email ||
            ''
        });
      }

      if (this.empresaId) {

        const empDoc = await getDoc(
          doc(
            this.firestore,
            'empresas',
            this.empresaId
          )
        );

        if (empDoc.exists()) {

          this.nombreEmpresa =
            empDoc.data()['nombre'] || '';
        }
      }

    } catch (error) {

      console.error(
        'Error al obtener datos del reclutador:',
        error
      );
    }
  }

  // ============================================================
  // MODO EDICIÓN
  // ============================================================

  async cargarOfertaParaEditar(id: string) {

    this.isLoading = true;

    try {

      const docRef = doc(
        this.firestore,
        'ofertas',
        id
      );

      const snap = await getDoc(docRef);

      if (!snap.exists()) {

        await this.mostrarToast(
          'La oferta no existe.',
          'danger'
        );

        this.router.navigate(['/home']);
        return;
      }

      const data = snap.data();

      this.ofertaForm.patchValue({

        titulo: data['titulo'] || '',

        descripcion:
          data['descripcion'] || '',

        modalidad:
          data['modalidad'] || 'Remoto',

        areaLaboral:
          data['areaLaboral'] || '',

        habilidades:
          data['habilidades'] || '',

        direccion:
          data['direccion'] || '',

        contactoEmail:
          data['contactoEmail'] || '',

        contactoTelefono:
          data['contactoTelefono'] || ''
      });

      this.preguntas.clear();

      // ======================================================
      // FORMATO NUEVO
      // ofertas/{id}.preguntas
      // ======================================================

      if (
        Array.isArray(data['preguntas'])
      ) {

        data['preguntas'].forEach(
          (pregunta: any) => {

            this.preguntas.push(
              this.crearPregunta(pregunta)
            );
          }
        );

      }

      // ======================================================
      // COMPATIBILIDAD CON FORMATO ANTIGUO
      // cuestionario.preguntas
      // ======================================================

      else if (
        data['cuestionario'] &&
        Array.isArray(
          data['cuestionario']['preguntas']
        )
      ) {

        data['cuestionario']['preguntas']
          .forEach(
            (pregunta: any) => {

              this.preguntas.push(
                this.crearPregunta({
                  ...pregunta,

                  tipo:
                    pregunta.tipo ||
                    (
                      pregunta.opciones?.length
                        ? 'seleccion'
                        : 'texto'
                    ),

                  requerida:
                    pregunta.requerida ?? true
                })
              );
            }
          );

      }

      // ======================================================
      // OFERTA ANTIGUA SIN CUESTIONARIO
      // ======================================================

      else if (data['areaLaboral']) {

        this.cargarPlantilla(
          data['areaLaboral']
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

      this.isLoading = false;
    }
  }

  // ============================================================
  // SERIALIZACIÓN
  // ============================================================

  private obtenerPreguntasParaGuardar() {

    return this.preguntas.controls.map(
      control => {

        const pregunta =
          control.getRawValue();

        return {

          id:
            pregunta.id ||
            this.generarIdPregunta(),

          texto:
            String(
              pregunta.texto || ''
            ).trim(),

          tipo:
            pregunta.tipo || 'texto',

          requerida:
            !!pregunta.requerida,

          opciones:
            pregunta.tipo === 'seleccion'
              ? (
                  pregunta.opciones || []
                )
                  .filter(
                    (opcion: any) =>
                      String(
                        opcion.texto || ''
                      ).trim() !== ''
                  )
                  .map(
                    (opcion: any) => ({
                      texto:
                        String(
                          opcion.texto
                        ).trim(),

                      puntaje:
                        Number(
                          opcion.puntaje
                        ) || 0
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

    if (this.ofertaForm.invalid) {

      this.ofertaForm.markAllAsTouched();

      await this.mostrarToast(
        'Revisa los campos obligatorios antes de guardar.',
        'warning'
      );

      return;
    }

    const user = this.auth.currentUser;

    if (!user) {

      await this.mostrarToast(
        'No existe una sesión activa.',
        'danger'
      );

      return;
    }

    this.isLoading = true;

    const formValues =
      this.ofertaForm.getRawValue();

    const preguntas =
      this.obtenerPreguntasParaGuardar();

    try {

      // ======================================================
      // EDITAR
      // ======================================================

      if (
        this.isEditMode &&
        this.ofertaId
      ) {

        const docRef = doc(
          this.firestore,
          'ofertas',
          this.ofertaId
        );

        await updateDoc(
          docRef,
          {

            titulo:
              formValues.titulo,

            descripcion:
              formValues.descripcion,

            modalidad:
              formValues.modalidad,

            areaLaboral:
              formValues.areaLaboral,

            habilidades:
              formValues.habilidades,

            direccion:
              formValues.direccion,

            contactoEmail:
              formValues.contactoEmail,

            contactoTelefono:
              formValues.contactoTelefono,

            // FORMATO DEFINITIVO
            preguntas,

            fechaActualizacion:
              new Date(),

            // Elimina el formato antiguo
            // si la oferta todavía lo tenía.
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

            descripcion:
              formValues.descripcion,

            modalidad:
              formValues.modalidad,

            areaLaboral:
              formValues.areaLaboral,

            habilidades:
              formValues.habilidades,

            direccion:
              formValues.direccion,

            contactoEmail:
              formValues.contactoEmail,

            contactoTelefono:
              formValues.contactoTelefono,

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

      this.router.navigate(['/home']);

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

      this.isLoading = false;
    }
  }

  volver() {

    this.router.navigate(['/home']);
  }

  private async mostrarToast(
    mensaje: string,
    color: string = 'success'
  ) {

    const toast =
      await this.toastController.create({
        message: mensaje,
        duration: 3000,
        color,
        position: 'top'
      });

    await toast.present();
  }
}