import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
  NgZone,
  DestroyRef
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';

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
  searchOutline,
  sparklesOutline,
  documentTextOutline
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
  deleteField,
  getDocs
} from '@angular/fire/firestore';

import {
  IaGeneratorService,
  ContextoOferta
} from '../../services/ia-generator.service';

import {
  buscarPlantillaPorDefecto,
  PLANTILLAS_POR_AREA,
  PlantillaCuestionario
} from '../../services/cuestionarios-defecto.data';

const BORRADOR_LOCAL_KEY = 'borrador_oferta';

// Colecciones de Firestore que alimentan las sugerencias del formulario
const COLECCION_AREAS = 'areas';
const COLECCION_CARGOS = 'cargos';
const SOLO_CARGOS_APROBADOS = false;

interface AreaLaboralOption {
  nombre: string;
  plantillaId?: string;
}

interface CargoLaboralOption {
  nombre: string;
  area: string;
  plantillaId?: string;
}

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
  private iaService = inject(IaGeneratorService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  ofertaForm!: FormGroup;

  isLoading = false;
  isGeneratingIA = false;
  isEditMode = false;
  ofertaId: string | null = null;

  esBorrador = false;
  private autoguardadoLocalActivo = false;

  empresaId = '';
  nombreEmpresa = '';

  // ============================================================
  // SOLICITUD DE NUEVO CARGO
  // ============================================================

  mostrarSolicitudCargo = false;
  enviandoSolicitudCargo = false;
  solicitudCargoForm!: FormGroup;

  // ============================================================
  // AUTOCOMPLETADO
  // ============================================================

  mostrarSugerenciasCargo = false;
  mostrarSugerenciasArea = false;

  cargosFiltrados: CargoLaboralOption[] = [];
  areasFiltradas: AreaLaboralOption[] = [];

  areasLaborales: AreaLaboralOption[] = [];
  cargosLaborales: CargoLaboralOption[] = [];

  cargandoCatalogos = false;
  errorCatalogos = '';
  documentosCargosLeidos = 0;
  documentosAreasLeidos: number | null = null;

  get proyectoFirebase(): string {
    const fs: any = this.firestore;
    const proyecto = fs?.app?.options?.projectId || 'desconocido';
    const baseDatos = fs?._databaseId?.database || '(default)';
    return `${proyecto} / ${baseDatos}`;
  }

  readonly coleccionCargos = COLECCION_CARGOS;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'save-outline': saveOutline,
      'briefcase-outline': briefcaseOutline,
      'add-outline': addOutline,
      'trash-outline': trashOutline,
      'search-outline': searchOutline,
      'sparkles-outline': sparklesOutline,
      'document-text-outline': documentTextOutline
    });
  }

  // ============================================================
  // INICIO
  // ============================================================

  async ngOnInit() {
    this.inicializarFormulario();

    this.ofertaId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.ofertaId;

    const autorizado = await this.obtenerDatosReclutador();
    if (!autorizado) {
      return;
    }

    void this.cargarCatalogosValidados();

    if (this.ofertaId) {
      await this.cargarOfertaParaEditar(this.ofertaId);
      return;
    }

    this.restaurarBorradorLocal();
    this.iniciarAutoguardadoLocal();
  }

  // ============================================================
  // BORRADOR LOCAL (solo creación de oferta nueva)
  // ============================================================

  private restaurarBorradorLocal() {
    const borradorLocal = localStorage.getItem(BORRADOR_LOCAL_KEY);
    if (!borradorLocal) {
      return;
    }

    try {
      const { preguntas, ...resto } = JSON.parse(borradorLocal);

      this.ofertaForm.patchValue(resto, { emitEvent: false });

      if (Array.isArray(preguntas) && preguntas.length > 0) {
        this.preguntas.clear({ emitEvent: false });
        preguntas.forEach((pregunta: any) => {
          this.preguntas.push(this.crearPregunta(pregunta), { emitEvent: false });
        });
      }
    } catch (e) {
      console.error('Error al leer el borrador local', e);
    }
  }

  private iniciarAutoguardadoLocal() {
    this.autoguardadoLocalActivo = true;

    this.ofertaForm.valueChanges
      .pipe(
        debounceTime(2000),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (!this.autoguardadoLocalActivo) {
          return;
        }
        try {
          localStorage.setItem(
            BORRADOR_LOCAL_KEY,
            JSON.stringify(this.ofertaForm.getRawValue())
          );
        } catch (e) {
          console.error('No fue posible autoguardar localmente', e);
        }
      });
  }

  private limpiarBorradorLocal() {
    this.autoguardadoLocalActivo = false;
    localStorage.removeItem(BORRADOR_LOCAL_KEY);
  }

  // ============================================================
  // FORMULARIO PRINCIPAL
  // ============================================================

  inicializarFormulario() {
    this.ofertaForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(4)]],
      cargoNombre: ['', [Validators.required, Validators.minLength(2)]],
      cargoId: [''],
      formularioId: [''],
      descripcion: ['', [Validators.required, Validators.minLength(15)]],
      modalidad: ['Remoto', Validators.required],
      areaLaboral: ['', Validators.required],

      experiencia: ['1 a 3 años', Validators.required],
      nivelEducativo: ['Indiferente', Validators.required],
      jornada: ['Completa', Validators.required],
      rangoSalarial: [''],
      habilidades: [''],
      habilidadesBlandas: [''],

      direccion: [''],
      contactoEmail: ['', [Validators.required, Validators.email]],
      contactoTelefono: [''],
      preguntas: this.fb.array([])
    });

    this.solicitudCargoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  // ============================================================
  // CATÁLOGOS VALIDADOS (BASE LOCAL + FIRESTORE)
  // ============================================================

  private async cargarCatalogosValidados() {
    this.cargandoCatalogos = true;
    this.errorCatalogos = '';

    const cargos = new Map<string, CargoLaboralOption>();
    const areas = new Map<string, AreaLaboralOption>();

    // 1. Base local garantizada desde cuestionarios-defecto.data.ts
    const catalogoBase: Record<string, string[]> = {
      'Administración y Oficina': [
        'Secretaria / Asistente Administrativa',
        'Digitador / Operador de Ingreso de Datos',
        'Administrativo/a',
        'Recepcionista'
      ],
      'Artesanía y Oficios Manuales': [
        'Alfarero / Ceramista',
        'Artesano/a',
        'Orfebre'
      ],
      'Educación y Docencia': [
        'Profesor de Lenguaje y Comunicación',
        'Profesor/a de Educación Básica',
        'Educador/a de Párvulos'
      ],
      'Gastronomía y Producción Alimentaria': [
        'Pastelero',
        'Maestro Panadero',
        'Encargado de Heladería',
        'Cocinero/a',
        'Chef'
      ],
      'Textil y Confección': [
        'Costurera / Operaria de Confección',
        'Modista',
        'Patronista'
      ]
    };

    Object.values(PLANTILLAS_POR_AREA).forEach(plantilla => {
      areas.set(this.normalizarTexto(plantilla.titulo), {
        nombre: plantilla.titulo,
        plantillaId: plantilla.id
      });
    });

    Object.entries(catalogoBase).forEach(([area, listaCargos]) => {
      const plantillaArea = buscarPlantillaPorDefecto('', area);
      areas.set(this.normalizarTexto(area), {
        nombre: area,
        plantillaId: plantillaArea?.id
      });

      listaCargos.forEach(nombreCargo => {
        const plantillaCargo = buscarPlantillaPorDefecto(nombreCargo, area);
        cargos.set(this.normalizarTexto(nombreCargo), {
          nombre: nombreCargo,
          area,
          plantillaId: plantillaCargo?.id
        });
      });
    });

    // 2. Complemento dinámico desde Firestore (si devuelve documentos)
    try {
      const [cargosSnap, areasSnap] = await Promise.all([
        getDocs(collection(this.firestore, COLECCION_CARGOS)),
        getDocs(collection(this.firestore, COLECCION_AREAS)).catch(error => {
          console.warn('No fue posible leer la colección de áreas:', error);
          return null;
        })
      ]);

      cargosSnap.docs.forEach(documento => {
        const data = documento.data();
        const nombre = String(data['nombre'] ?? '').trim();

        if (!nombre) {
          return;
        }

        if (
          SOLO_CARGOS_APROBADOS &&
          String(data['estado'] ?? '').trim().toLowerCase() !== 'aprobado'
        ) {
          return;
        }

        const areasDelCargo = this.separarAreas(data['areaLaboral']);

        areasDelCargo.forEach(area => {
          const plantillaArea = buscarPlantillaPorDefecto('', area);
          areas.set(this.normalizarTexto(area), {
            nombre: area,
            plantillaId: plantillaArea?.id
          });
        });

        const clave = this.normalizarTexto(nombre);
        if (!cargos.has(clave)) {
          const areaPrincipal = areasDelCargo[0] ?? '';
          const plantillaCargo = buscarPlantillaPorDefecto(nombre, areaPrincipal);
          cargos.set(clave, {
            nombre,
            area: areaPrincipal,
            plantillaId: plantillaCargo?.id
          });
        }
      });

      areasSnap?.docs.forEach(documento => {
        const nombre = String(documento.data()['nombre'] ?? '').trim();

        if (nombre) {
          const plantillaArea = buscarPlantillaPorDefecto('', nombre);
          areas.set(this.normalizarTexto(nombre), {
            nombre,
            plantillaId: plantillaArea?.id
          });
        }
      });

      this.documentosCargosLeidos = cargosSnap.size;
      this.documentosAreasLeidos = areasSnap ? areasSnap.size : null;

    } catch (error) {
      console.warn('Usando catálogo local por respaldo ante error de Firestore:', error);
    } finally {
      const ordenar = (a: { nombre: string }, b: { nombre: string }) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

      this.cargosLaborales = Array.from(cargos.values()).sort(ordenar);
      this.areasLaborales = Array.from(areas.values()).sort(ordenar);
      this.cargandoCatalogos = false;

      if (this.mostrarSugerenciasCargo) {
        this.mostrarCargosIniciales();
      }
      if (this.mostrarSugerenciasArea) {
        this.mostrarAreasIniciales();
      }

      this.cdr.detectChanges();
    }
  }

  private separarAreas(valor: unknown): string[] {
    return String(valor ?? '')
      .split(',')
      .map(area => area.trim())
      .filter(area => area !== '');
  }

  // ============================================================
  // AUTOCOMPLETADO CARGO
  // ============================================================

  buscarCargo(event: any) {
    const texto = this.obtenerValorEvento(event);

    this.ofertaForm.get('cargoNombre')?.setValue(texto, { emitEvent: false });
    this.ofertaForm.patchValue(
      { cargoId: '' },
      { emitEvent: false }
    );

    this.cargosFiltrados = this.filtrarCatalogo(texto, this.cargosLaborales);
    this.mostrarSugerenciasCargo = true;

    const areaActual = String(this.ofertaForm.get('areaLaboral')?.value ?? '').trim();
    if (texto.trim().length >= 4) {
      this.aplicarPlantillaPorContexto(texto, areaActual, false);
    }
  }

  mostrarCargosIniciales() {
    const valor = String(this.ofertaForm.get('cargoNombre')?.value ?? '');
    this.cargosFiltrados = valor.trim()
      ? this.filtrarCatalogo(valor, this.cargosLaborales)
      : [...this.cargosLaborales];

    this.mostrarSugerenciasCargo = true;
  }

  seleccionarCargo(cargo: CargoLaboralOption) {
    const cargoId = this.generarSlug(cargo.nombre);
    const areaFinal = cargo.area || String(this.ofertaForm.get('areaLaboral')?.value ?? '').trim();

    this.ofertaForm.patchValue(
      {
        cargoNombre: cargo.nombre,
        cargoId: cargoId,
        areaLaboral: areaFinal
      },
      { emitEvent: false }
    );

    this.mostrarSugerenciasCargo = false;
    this.cargosFiltrados = [];

    this.aplicarPlantillaPorContexto(cargo.nombre, areaFinal, true);
  }

  ocultarSugerenciasCargo() {
    setTimeout(() => {
      this.mostrarSugerenciasCargo = false;
    }, 200);
  }

  // ============================================================
  // AUTOCOMPLETADO ÁREA
  // ============================================================

  buscarArea(event: any) {
    const texto = this.obtenerValorEvento(event);
    this.ofertaForm.get('areaLaboral')?.setValue(texto, { emitEvent: false });
    this.areasFiltradas = this.filtrarCatalogo(texto, this.areasLaborales);
    this.mostrarSugerenciasArea = true;

    const cargoActual = String(this.ofertaForm.get('cargoNombre')?.value ?? '').trim();
    if (texto.trim().length >= 4) {
      this.aplicarPlantillaPorContexto(cargoActual, texto, false);
    }
  }

  mostrarAreasIniciales() {
    const valor = String(this.ofertaForm.get('areaLaboral')?.value ?? '');
    this.areasFiltradas = valor.trim()
      ? this.filtrarCatalogo(valor, this.areasLaborales)
      : [...this.areasLaborales];

    this.mostrarSugerenciasArea = true;
  }

  seleccionarArea(area: AreaLaboralOption) {
    this.ofertaForm.patchValue(
      {
        areaLaboral: area.nombre
      },
      { emitEvent: false }
    );

    this.mostrarSugerenciasArea = false;
    this.areasFiltradas = [];

    const cargoActual = String(this.ofertaForm.get('cargoNombre')?.value ?? '').trim();
    this.aplicarPlantillaPorContexto(cargoActual, area.nombre, true);
  }

  ocultarSugerenciasArea() {
    setTimeout(() => {
      this.mostrarSugerenciasArea = false;
    }, 200);
  }

  // ============================================================
  // CARGA AUTOMÁTICA DE PLANTILLA POR DEFECTO
  // ============================================================

  private aplicarPlantillaPorContexto(
    cargoNombre: string,
    areaLaboral: string,
    notificar: boolean
  ): boolean {
    const formularioActual = String(this.ofertaForm.get('formularioId')?.value ?? '').trim();

    if (
      this.preguntas.length > 0 &&
      (formularioActual === 'personalizado' || formularioActual === 'ia_generado')
    ) {
      return false;
    }

    const plantilla: PlantillaCuestionario | null = buscarPlantillaPorDefecto(
      cargoNombre,
      areaLaboral
    );

    if (!plantilla) {
      return false;
    }

    if (formularioActual === plantilla.id && this.preguntas.length > 0) {
      return true;
    }

    this.ngZone.run(() => {
      this.preguntas.clear();

      plantilla.preguntas.forEach(p => {
        const clon = JSON.parse(JSON.stringify(p));
        this.preguntas.push(this.crearPregunta(clon));
      });

      this.ofertaForm.get('formularioId')?.setValue(plantilla.id, { emitEvent: false });
      this.cdr.detectChanges();
    });

    if (notificar) {
      void this.mostrarToast(`Cuestionario cargado: ${plantilla.titulo}`, 'success');
    }

    return true;
  }

  // ============================================================
  // FILTRO GENÉRICO
  // ============================================================

  private filtrarCatalogo<T extends { nombre: string }>(texto: string, catalogo: T[]): T[] {
    const busqueda = this.normalizarTexto(texto);

    if (!busqueda) {
      return [...catalogo];
    }

    const comienzanCon = catalogo.filter(item =>
      this.normalizarTexto(item.nombre).startsWith(busqueda)
    );

    const contienen = catalogo.filter(item => {
      const normalizado = this.normalizarTexto(item.nombre);
      return !normalizado.startsWith(busqueda) && normalizado.includes(busqueda);
    });

    return [...comienzanCon, ...contienen];
  }

  private normalizarTexto(texto: string): string {
    return String(texto ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private obtenerValorEvento(event: any): string {
    return String(event?.detail?.value ?? event?.target?.value ?? '');
  }

  private generarSlug(texto: string): string {
    return this.normalizarTexto(texto)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ============================================================
  // COMPATIBILIDAD ÁREAS ANTIGUAS
  // ============================================================

  private convertirAreaAntigua(area: any): string {
    const valor = String(area ?? '');
    const mapa: Record<string, string> = {
      ventas: 'Atención al Cliente y Ventas',
      admin: 'Administración y Oficina',
      limpieza: 'Mantenimiento y Limpieza',
      logistica: 'Logística y Bodega'
    };
    return mapa[valor] ?? valor;
  }

  // ============================================================
  // FORMARRAY
  // ============================================================

  get preguntas(): FormArray {
    return this.ofertaForm.get('preguntas') as FormArray;
  }

  crearPregunta(data?: any): FormGroup {
    const opciones = this.fb.array<FormGroup>([]);

    if (Array.isArray(data?.opciones)) {
      data.opciones.forEach((opcion: any) => {
        opciones.push(this.crearOpcion(opcion));
      });
    }

    return this.fb.group({
      id: [data?.id || this.generarIdPregunta()],
      texto: [
        data?.texto || '',
        [Validators.required, Validators.minLength(5)]
      ],
      tipo: [
        data?.tipo ||
          (Array.isArray(data?.opciones) && data.opciones.length > 0
            ? 'seleccion'
            : 'texto'),
        Validators.required
      ],
      requerida: [data?.requerida ?? true],
      opciones: opciones
    });
  }

  crearOpcion(data?: any): FormGroup {
    return this.fb.group({
      texto: [data?.texto || '', Validators.required],
      puntaje: [data?.puntaje ?? 0, [Validators.required, Validators.min(0)]]
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

    this.ofertaForm.get('formularioId')?.setValue('personalizado', { emitEvent: false });
  }

  eliminarPregunta(index: number) {
    this.preguntas.removeAt(index);
    if (this.preguntas.length === 0) {
      this.ofertaForm.get('formularioId')?.setValue('', { emitEvent: false });
    }
  }

  getOpciones(preguntaIndex: number): FormArray {
    return this.preguntas.at(preguntaIndex).get('opciones') as FormArray;
  }

  agregarOpcion(preguntaIndex: number) {
    this.getOpciones(preguntaIndex).push(
      this.crearOpcion({
        texto: '',
        puntaje: 0
      })
    );
  }

  eliminarOpcion(preguntaIndex: number, opcionIndex: number) {
    this.getOpciones(preguntaIndex).removeAt(opcionIndex);
  }

  cambiarTipoPregunta(index: number) {
    const pregunta = this.preguntas.at(index);
    const tipo = pregunta.get('tipo')?.value;
    const opciones = pregunta.get('opciones') as FormArray;

    if (tipo === 'seleccion' && opciones.length === 0) {
      opciones.push(this.crearOpcion({ texto: 'Opción 1', puntaje: 0 }));
      opciones.push(this.crearOpcion({ texto: 'Opción 2', puntaje: 0 }));
    }

    if (tipo === 'texto') {
      opciones.clear();
    }
  }

  private generarIdPregunta(): string {
    return `p-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // ============================================================
  // PUNTAJE MÁXIMO
  // ============================================================

  get puntajeMaximo(): number {
    return this.preguntas.controls.reduce((total, pregunta) => {
      if (pregunta.get('tipo')?.value !== 'seleccion') {
        return total;
      }

      const opciones = pregunta.get('opciones')?.value || [];
      const puntajes = opciones.map((opcion: any) => Number(opcion.puntaje) || 0);
      const maximo = puntajes.length > 0 ? Math.max(...puntajes) : 0;

      return total + maximo;
    }, 0);
  }

  // ============================================================
  // GUARDAR BORRADOR
  // ============================================================

  async guardarComoBorrador() {
    if (this.isLoading) {
      return;
    }

    if (this.isEditMode && !this.esBorrador) {
      await this.mostrarToast(
        'Esta oferta ya está publicada y no puede guardarse como borrador.',
        'warning'
      );
      return;
    }

    const user = this.auth.currentUser;
    if (!user) {
      await this.mostrarToast('No existe una sesión activa.', 'danger');
      return;
    }

    const formVal = this.ofertaForm.getRawValue();
    const titulo = String(formVal.titulo ?? '').trim();
    const cargoNombre = String(formVal.cargoNombre ?? '').trim();

    if (!titulo && !cargoNombre) {
      await this.mostrarToast(
        'Añade un título o un cargo para poder guardar el borrador.',
        'warning'
      );
      return;
    }

    this.isLoading = true;

    try {
      const preguntas = this.obtenerPreguntasParaGuardar();
      const cargoId = String(formVal.cargoId ?? '').trim() || this.generarSlug(cargoNombre);
      let formularioId = String(formVal.formularioId ?? '').trim();

      if (!formularioId) {
        formularioId = preguntas.length > 0 ? 'personalizado' : '';
      }

      const payloadBorrador = {
        titulo: titulo || cargoNombre,
        cargoId: cargoId,
        cargoNombre: cargoNombre,
        areaLaboral: String(formVal.areaLaboral ?? '').trim(),
        formularioId: formularioId,
        descripcion: formVal.descripcion ?? '',
        modalidad: formVal.modalidad ?? '',
        experiencia: formVal.experiencia ?? '',
        nivelEducativo: formVal.nivelEducativo ?? '',
        jornada: formVal.jornada ?? '',
        rangoSalarial: formVal.rangoSalarial ?? '',
        habilidades: formVal.habilidades ?? '',
        habilidadesBlandas: formVal.habilidadesBlandas ?? '',
        direccion: formVal.direccion ?? '',
        contactoEmail: formVal.contactoEmail ?? '',
        contactoTelefono: formVal.contactoTelefono ?? '',
        preguntas: preguntas,
        empresaId: this.empresaId,
        nombreEmpresa: this.nombreEmpresa,
        reclutadorId: user.uid,
        estado: 'Borrador',
        fechaActualizacion: new Date()
      };

      if (this.isEditMode && this.ofertaId) {
        await updateDoc(doc(this.firestore, 'ofertas', this.ofertaId), payloadBorrador);
      } else {
        await addDoc(collection(this.firestore, 'ofertas'), {
          ...payloadBorrador,
          candidatosCount: 0
        });
      }

      this.limpiarBorradorLocal();

      await this.mostrarToast('Borrador guardado exitosamente.', 'success');
      this.router.navigate(['/home']);

    } catch (error) {
      console.error('Error al guardar borrador:', error);
      await this.mostrarToast('Error al guardar el borrador en la nube.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================================
  // GENERACIÓN DE CUESTIONARIOS CON IA (CON RESPALDO POR DEFECTO)
  // ============================================================

  async generarCuestionarioConIA() {
    if (this.isGeneratingIA) {
      return;
    }

    const formVal = this.ofertaForm.getRawValue();
    const titulo = String(formVal.titulo || formVal.cargoNombre || '').trim();
    const cargoNombre = String(formVal.cargoNombre || '').trim();
    const areaLaboral = String(formVal.areaLaboral || '').trim();
    const descripcion = String(formVal.descripcion || '').trim();

    if (!titulo && !cargoNombre && !areaLaboral) {
      await this.mostrarToast(
        'Selecciona un cargo, área o ingresa un título antes de generar el cuestionario.',
        'warning'
      );
      return;
    }

    if (descripcion.length < 10) {
      const plantillaRespaldo = buscarPlantillaPorDefecto(cargoNombre || titulo, areaLaboral);
      if (plantillaRespaldo) {
        this.ngZone.run(() => {
          this.preguntas.clear();
          plantillaRespaldo.preguntas.forEach(p => {
            this.preguntas.push(this.crearPregunta(JSON.parse(JSON.stringify(p))));
          });
          this.ofertaForm.get('formularioId')?.setValue(plantillaRespaldo.id, { emitEvent: false });
          this.cdr.detectChanges();
        });
        await this.mostrarToast(
          `Plantilla cargada para "${plantillaRespaldo.titulo}" (completa la descripción si deseas usar IA personalizada).`,
          'success'
        );
        return;
      }

      await this.mostrarToast(
        'Completa al menos el título (o cargo) y una descripción detallada antes de generar con IA.',
        'warning'
      );
      return;
    }

    this.isGeneratingIA = true;
    this.cdr.detectChanges();

    try {
      const habilidadesTec = String(formVal.habilidades || '').trim();
      const contexto: ContextoOferta = {
        titulo: titulo,
        cargoNombre: cargoNombre,
        descripcion: descripcion,
        areaLaboral: areaLaboral,
        experiencia: String(formVal.experiencia || '').trim(),
        nivelEducativo: String(formVal.nivelEducativo || '').trim(),
        jornada: String(formVal.jornada || '').trim(),
        habilidades: habilidadesTec,
        habilidadesTecnicas: habilidadesTec,
        habilidadesBlandas: String(formVal.habilidadesBlandas || '').trim()
      };

      const preguntasIA = await this.iaService.generarCuestionario(contexto);

      if (!Array.isArray(preguntasIA) || preguntasIA.length === 0) {
        throw new Error('La IA no devolvió preguntas válidas.');
      }

      this.ngZone.run(() => {
        this.preguntas.clear();

        preguntasIA.forEach((p: any) => {
          const opcionesValidas = Array.isArray(p.opciones)
            ? p.opciones.map((opt: any) => ({
                texto: String(opt.texto || opt || '').trim(),
                puntaje: Number(opt.puntaje) || 0
              }))
            : [];

          const nuevaPregunta = this.crearPregunta({
            id: this.generarIdPregunta(),
            texto: String(p.pregunta || p.preguntaTexto || '').trim(),
            tipo: p.tipo === 'texto' || p.tipo === 'escrita' ? 'texto' : 'seleccion',
            requerida: true,
            opciones: opcionesValidas
          });

          this.preguntas.push(nuevaPregunta);
        });

        this.ofertaForm.get('formularioId')?.setValue('ia_generado', { emitEvent: false });
        this.cdr.detectChanges();
      });

      await this.mostrarToast('¡Cuestionario generado con éxito por IA!', 'success');

    } catch (error: any) {
      console.error('Error al generar con IA, aplicando respaldo por defecto:', error);

      const plantillaRespaldo = buscarPlantillaPorDefecto(cargoNombre || titulo, areaLaboral);
      if (plantillaRespaldo) {
        this.ngZone.run(() => {
          this.preguntas.clear();
          plantillaRespaldo.preguntas.forEach(p => {
            this.preguntas.push(this.crearPregunta(JSON.parse(JSON.stringify(p))));
          });
          this.ofertaForm.get('formularioId')?.setValue(plantillaRespaldo.id, { emitEvent: false });
          this.cdr.detectChanges();
        });

        await this.mostrarToast(
          `IA no disponible en este momento. Se cargó la plantilla sugerida: ${plantillaRespaldo.titulo}.`,
          'warning'
        );
        return;
      }

      await this.mostrarToast(
        'No se pudo generar el cuestionario con IA. Revisa tu conexión o agrégalas manualmente.',
        'danger'
      );
    } finally {
      this.ngZone.run(() => {
        this.isGeneratingIA = false;
        this.cdr.detectChanges();
      });
    }
  }

  // ============================================================
  // DATOS RECLUTADOR
  // ============================================================

  async obtenerDatosReclutador(): Promise<boolean> {
    const user = this.auth.currentUser;

    if (!user) {
      await this.mostrarToast('No existe una sesión activa.', 'danger');
      this.router.navigate(['/auth/login']);
      return false;
    }

    try {
      const recDoc = await getDoc(doc(this.firestore, 'reclutadores', user.uid));

      if (!recDoc.exists()) {
        await this.mostrarToast('No fue posible encontrar tu perfil de reclutador.', 'danger');
        this.router.navigate(['/home']);
        return false;
      }

      const data = recDoc.data();
      const estado = String(data['estado'] ?? '').trim().toLowerCase();

      if (estado !== 'aprobado') {
        await this.mostrarToast('Tu cuenta aún está pendiente de aprobación.', 'warning');
        this.router.navigate(['/home']);
        return false;
      }

      this.empresaId = data['empresaId'] || '';

      if (!this.isEditMode) {
        this.ofertaForm.patchValue({
          contactoEmail: data['email'] || user.email || ''
        });
      }

      if (this.empresaId) {
        const empDoc = await getDoc(doc(this.firestore, 'empresas', this.empresaId));
        if (empDoc.exists()) {
          this.nombreEmpresa = empDoc.data()['nombre'] || '';
        }
      }

      return true;

    } catch (error) {
      console.error('Error al obtener datos del reclutador:', error);
      await this.mostrarToast('No fue posible validar tu cuenta de reclutador.', 'danger');
      return false;
    }
  }

  // ============================================================
  // MODO EDICIÓN
  // ============================================================

  async cargarOfertaParaEditar(id: string) {
    this.isLoading = true;

    try {
      const docRef = doc(this.firestore, 'ofertas', id);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        await this.mostrarToast('La oferta no existe.', 'danger');
        this.router.navigate(['/home']);
        return;
      }

      const data = snap.data();

      this.esBorrador =
        String(data['estado'] ?? '').trim().toLowerCase() === 'borrador';

      const areaOriginal = data['areaLaboral'] || '';
      const areaVisible = this.convertirAreaAntigua(areaOriginal);
      const cargoNombre = data['cargoNombre'] || data['titulo'] || '';
      const cargoId = data['cargoId'] || this.generarSlug(cargoNombre);

      this.ofertaForm.patchValue({
        titulo: data['titulo'] || '',
        cargoNombre: cargoNombre,
        cargoId: cargoId,
        formularioId: data['formularioId'] || '',
        descripcion: data['descripcion'] || '',
        modalidad: data['modalidad'] || 'Remoto',
        areaLaboral: areaVisible,
        experiencia: data['experiencia'] || '1 a 3 años',
        nivelEducativo: data['nivelEducativo'] || 'Indiferente',
        jornada: data['jornada'] || 'Completa',
        rangoSalarial: data['rangoSalarial'] || '',
        habilidades: data['habilidades'] || '',
        habilidadesBlandas: data['habilidadesBlandas'] || '',
        direccion: data['direccion'] || '',
        contactoEmail: data['contactoEmail'] || '',
        contactoTelefono: data['contactoTelefono'] || ''
      });

      this.preguntas.clear();

      if (Array.isArray(data['preguntas'])) {
        data['preguntas'].forEach((pregunta: any) => {
          this.preguntas.push(this.crearPregunta(pregunta));
        });
      } else if (data['cuestionario'] && Array.isArray(data['cuestionario']['preguntas'])) {
        data['cuestionario']['preguntas'].forEach((pregunta: any) => {
          this.preguntas.push(
            this.crearPregunta({
              ...pregunta,
              tipo: pregunta.tipo || (pregunta.opciones?.length ? 'seleccion' : 'texto'),
              requerida: pregunta.requerida ?? true
            })
          );
        });
      } else {
        this.aplicarPlantillaPorContexto(cargoNombre, areaVisible, false);
      }

      if (!this.ofertaForm.get('formularioId')?.value && this.preguntas.length > 0) {
        this.ofertaForm.get('formularioId')?.setValue('personalizado', { emitEvent: false });
      }

    } catch (error) {
      console.error('Error al cargar la oferta:', error);
      await this.mostrarToast('No fue posible cargar la oferta.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================================
  // SERIALIZACIÓN
  // ============================================================

  private obtenerPreguntasParaGuardar() {
    return this.preguntas.controls.map(control => {
      const pregunta = control.getRawValue();
      return {
        id: pregunta.id || this.generarIdPregunta(),
        texto: String(pregunta.texto || '').trim(),
        tipo: pregunta.tipo || 'texto',
        requerida: !!pregunta.requerida,
        opciones: pregunta.tipo === 'seleccion'
          ? (pregunta.opciones || [])
              .filter((opcion: any) => String(opcion.texto || '').trim() !== '')
              .map((opcion: any) => ({
                texto: String(opcion.texto).trim(),
                puntaje: Number(opcion.puntaje) || 0
              }))
          : []
      };
    });
  }

  // ============================================================
  // SOLICITUD DE NUEVO CARGO
  // ============================================================

  toggleSolicitudCargo() {
    this.mostrarSolicitudCargo = !this.mostrarSolicitudCargo;
    if (!this.mostrarSolicitudCargo) {
      this.solicitudCargoForm.reset();
    }
  }

  private generarNumeroSolicitud(): string {
    return `SOL-${Date.now()}`;
  }

  async enviarSolicitudCargo() {
    if (this.solicitudCargoForm.invalid) {
      this.solicitudCargoForm.markAllAsTouched();
      await this.mostrarToast('Completa el nombre y la descripción del cargo.', 'warning');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) {
      await this.mostrarToast('No existe una sesión activa.', 'danger');
      return;
    }

    if (!this.empresaId) {
      await this.mostrarToast('No fue posible identificar la empresa asociada a tu cuenta.', 'danger');
      return;
    }

    const valores = this.solicitudCargoForm.getRawValue();
    const numeroSolicitud = this.generarNumeroSolicitud();
    this.enviandoSolicitudCargo = true;

    try {
      await addDoc(collection(this.firestore, 'cargos'), {
        nombre: String(valores.nombre ?? '').trim(),
        descripcion: String(valores.descripcion ?? '').trim(),
        numeroSolicitud: numeroSolicitud,
        estado: 'pendiente',
        reclutadorId: user.uid,
        empresaId: this.empresaId,
        nombreEmpresa: this.nombreEmpresa,
        fechaSolicitud: new Date()
      });

      await this.mostrarToast(`Solicitud ${numeroSolicitud} enviada correctamente.`);
      this.solicitudCargoForm.reset();
      this.mostrarSolicitudCargo = false;

    } catch (error) {
      console.error('Error al enviar solicitud de cargo:', error);
      await this.mostrarToast('No fue posible enviar la solicitud de cargo.', 'danger');
    } finally {
      this.enviandoSolicitudCargo = false;
    }
  }

  // ============================================================
  // GUARDAR / ACTUALIZAR
  // ============================================================

  async guardarOferta() {
    if (this.ofertaForm.invalid) {
      this.ofertaForm.markAllAsTouched();
      await this.mostrarToast('Revisa los campos obligatorios antes de guardar.', 'warning');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) {
      await this.mostrarToast('No existe una sesión activa.', 'danger');
      return;
    }

    this.isLoading = true;
    const formValues = this.ofertaForm.getRawValue();
    const preguntas = this.obtenerPreguntasParaGuardar();
    const cargoNombre = String(formValues.cargoNombre ?? '').trim();
    const cargoId = String(formValues.cargoId ?? '').trim() || this.generarSlug(cargoNombre);
    const areaLaboral = String(formValues.areaLaboral ?? '').trim();
    let formularioId = String(formValues.formularioId ?? '').trim();

    if (!formularioId) {
      formularioId = preguntas.length > 0 ? 'personalizado' : '';
    }

    try {
      const payloadOferta = {
        titulo: formValues.titulo,
        cargoId: cargoId,
        cargoNombre: cargoNombre,
        areaLaboral: areaLaboral,
        formularioId: formularioId,
        descripcion: formValues.descripcion,
        modalidad: formValues.modalidad,
        experiencia: formValues.experiencia,
        nivelEducativo: formValues.nivelEducativo,
        jornada: formValues.jornada,
        rangoSalarial: formValues.rangoSalarial,
        habilidades: formValues.habilidades,
        habilidadesBlandas: formValues.habilidadesBlandas,
        direccion: formValues.direccion,
        contactoEmail: formValues.contactoEmail,
        contactoTelefono: formValues.contactoTelefono,
        preguntas: preguntas
      };

      if (this.isEditMode && this.ofertaId) {
        const docRef = doc(this.firestore, 'ofertas', this.ofertaId);
        const publicandoBorrador = this.esBorrador;

        await updateDoc(docRef, {
          ...payloadOferta,
          fechaActualizacion: new Date(),
          cuestionario: deleteField(),
          ...(publicandoBorrador
            ? {
                empresaId: this.empresaId,
                nombreEmpresa: this.nombreEmpresa,
                reclutadorId: user.uid,
                estado: 'Activa',
                candidatosCount: 0,
                fechaPublicacion: new Date()
              }
            : {})
        });

        if (publicandoBorrador) {
          this.limpiarBorradorLocal();
          await this.mostrarToast('¡Oferta publicada exitosamente!');
        } else {
          await this.mostrarToast('Oferta actualizada correctamente.');
        }
      } else {
        const ofertasRef = collection(this.firestore, 'ofertas');
        await addDoc(ofertasRef, {
          ...payloadOferta,
          empresaId: this.empresaId,
          nombreEmpresa: this.nombreEmpresa,
          reclutadorId: user.uid,
          estado: 'Activa',
          candidatosCount: 0,
          fechaPublicacion: new Date()
        });
        this.limpiarBorradorLocal();
        await this.mostrarToast('¡Oferta creada exitosamente!');
      }

      this.router.navigate(['/home']);

    } catch (error) {
      console.error('Error al guardar la oferta:', error);
      await this.mostrarToast('Ocurrió un error al guardar la oferta.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================================
  // VOLVER
  // ============================================================

  volver() {
    this.router.navigate(['/home']);
  }

  // ============================================================
  // TOAST
  // ============================================================

  private async mostrarToast(mensaje: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      color: color,
      position: 'top'
    });
    await toast.present();
  }
}