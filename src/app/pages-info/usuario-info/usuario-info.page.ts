import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import {
  ToastController, LoadingController,
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonBackButton, IonButton, IonIcon,
  IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
  IonChip, IonLabel, IonCheckbox, IonModal, IonList, IonSpinner, IonToggle
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  arrowBackOutline, checkmarkCircle, warning, closeCircle,
  informationCircle, schoolOutline, briefcaseOutline,
  timeOutline, starOutline, addOutline, closeOutline, trashOutline,
  businessOutline, addCircleOutline, chevronDownOutline, createOutline,
  bookOutline, libraryOutline, ribbonOutline, alertCircleOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, Unsubscribe as AuthUnsubscribe } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { normalizarEspacios, validarAnio, validarTextoObligatorio } from '../../utils/validadores';

export interface FormacionAcademica {
  id: string;
  nivelEstudio: string;
  nombreEstudio: string;
  institucion: string;
  cursandoActualmente: boolean;
  anioInicio: string;
  anioTermino: string;
}

export interface OpcionNivelEstudio {
  valor: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

/* =======================================================
   VALIDACIÓN: campos del formulario
======================================================= */
type CampoLibre = 'institucion' | 'nombreEstudio' | 'anioInicio' | 'anioTermino' | 'cargo' | 'lugar' | 'tiempo';
type CampoReactivo = 'disponibilidad' | 'habilidadesBlandas' | 'habilidadesTecnicas';
type CampoCv = CampoLibre | CampoReactivo | 'nivelEstudio';

const CAMPOS_FORMACION: CampoCv[] = ['nivelEstudio', 'institucion', 'nombreEstudio', 'anioInicio', 'anioTermino'];
const CAMPOS_EXPERIENCIA: CampoCv[] = ['cargo', 'lugar', 'tiempo'];
const CAMPOS_REACTIVOS: CampoReactivo[] = ['disponibilidad', 'habilidadesBlandas', 'habilidadesTecnicas'];
const TODOS_LOS_CAMPOS: CampoCv[] = [...CAMPOS_FORMACION, ...CAMPOS_EXPERIENCIA, ...CAMPOS_REACTIVOS];

// Campo obligatorio de los pasos 3, 4 y 5
const CAMPO_POR_PASO: Record<number, CampoReactivo> = {
  3: 'disponibilidad',
  4: 'habilidadesBlandas',
  5: 'habilidadesTecnicas'
};

function crearRegistro<T>(valor: T): Record<CampoCv, T> {
  return Object.fromEntries(TODOS_LOS_CAMPOS.map(campo => [campo, valor])) as Record<CampoCv, T>;
}

@Component({
  selector: 'app-usuario-info',
  templateUrl: './usuario-info.page.html',
  styleUrls: ['./usuario-info.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonButton, IonIcon,
    IonInput, IonTextarea, IonRadioGroup, IonRadio, IonItem, IonProgressBar,
    IonChip, IonLabel, IonCheckbox, IonModal, IonList, IonSpinner, IonToggle
  ]
})
export class UsuarioInfoPage implements OnInit, OnDestroy {
  pasoActual: number = 1;
  totalPasos: number = 5;
  cargando: boolean = true;
  guardandoFormacion: boolean = false;
  modalEstudiosAbierto: boolean = false;

  cvForm: FormGroup;

  // --- 4 NIVELES DE ESTUDIO CON DESCRIPCIÓN SOLO EN LA MODAL ---
  readonly OPCIONES_NIVEL_ESTUDIO: OpcionNivelEstudio[] = [
    {
      valor: 'Enseñanza básica',
      titulo: 'Enseñanza básica',
      descripcion: '1° a 8° básico',
      icono: 'book-outline'
    },
    {
      valor: 'Educación media C.H. / Técnica',
      titulo: 'Educación media C.H. / Técnica',
      descripcion: 'Liceo científico-humanista o técnico-profesional',
      icono: 'library-outline'
    },
    {
      valor: 'Universitaria / I.P. / C.F.T.',
      titulo: 'Universitaria / I.P. / C.F.T.',
      descripcion: 'Universidad, instituto profesional o centro de formación técnica',
      icono: 'school-outline'
    },
    {
      valor: 'Magíster o Postgrado',
      titulo: 'Magíster o Postgrado',
      descripcion: 'Magíster, doctorado, postítulo o diplomado',
      icono: 'ribbon-outline'
    }
  ];

  formacionesAcademicas: FormacionAcademica[] = [];
  formacionActual: FormacionAcademica = this.crearFormacionVacia();
  indiceEditandoFormacion: number | null = null;

  experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };

  // Validación por campo: el error solo se muestra cuando el campo fue "tocado"
  errores: Record<CampoCv, string> = crearRegistro<string>('');
  tocados: Record<CampoCv, boolean> = crearRegistro<boolean>(false);

  readonly TODAS_BLANDAS = [
    'Responsabilidad', 'Comunicación', 'Trabajo en equipo',
    'Puntualidad', 'Empatía', 'Proactividad', 'Resolución de problemas'
  ];
  readonly TODAS_TECNICAS = [
    'Uso de computador', 'Atención al cliente', 'Herramientas de oficina (Excel, Word)',
    'Manejo de caja', 'Ventas', 'Control de Bodega', 'Atención telefónica'
  ];

  sugerenciasBlandas: string[] = [...this.TODAS_BLANDAS];
  sugerenciasTecnicas: string[] = [...this.TODAS_TECNICAS];

  private unsubAuth: AuthUnsubscribe | null = null;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private fb = inject(FormBuilder);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'checkmark-circle': checkmarkCircle,
      'warning': warning,
      'close-circle': closeCircle,
      'information-circle': informationCircle,
      'school-outline': schoolOutline,
      'briefcase-outline': briefcaseOutline,
      'time-outline': timeOutline,
      'star-outline': starOutline,
      'add-outline': addOutline,
      'close-outline': closeOutline,
      'trash-outline': trashOutline,
      'business-outline': businessOutline,
      'add-circle-outline': addCircleOutline,
      'chevron-down-outline': chevronDownOutline,
      'create-outline': createOutline,
      'book-outline': bookOutline,
      'library-outline': libraryOutline,
      'ribbon-outline': ribbonOutline,
      'alert-circle-outline': alertCircleOutline
    });

    this.cvForm = this.fb.group({
      areasExperiencia: [[]],
      sinExperiencia: [false],
      disponibilidad: [''],
      habilidadesBlandas: [''],
      habilidadesTecnicas: ['']
    });

    // Si el usuario corrige un campo que ya tenía error, el mensaje se actualiza solo
    this.cvForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      CAMPOS_REACTIVOS.forEach(campo => {
        if (this.tocados[campo]) {
          this.validarCampo(campo);
        }
      });
    });
  }

  ionViewWillEnter() {
    this.pasoActual = 1;
    this.cancelarEdicionFormacion();
    this.limpiarValidacion();
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.unsubAuth = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(this.firestore, `postulantes/${user.uid}`);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const cv = data['cvManual'] || {};

            this.ngZone.run(() => {
              this.formacionesAcademicas = this.extraerFormacionesGuardadas(cv);

              this.cvForm.patchValue({
                areasExperiencia: Array.isArray(cv.areasExperiencia) ? cv.areasExperiencia : [],
                sinExperiencia: !!cv.sinExperiencia,
                disponibilidad: cv.disponibilidad || '',
                habilidadesBlandas: cv.habilidadesBlandas || '',
                habilidadesTecnicas: cv.habilidadesTecnicas || ''
              });
              this.actualizarSugerenciasBlandas();
              this.actualizarSugerenciasTecnicas();
            });
          }
        } catch (error) {
          console.error('Error al cargar datos del postulante:', error);
        } finally {
          this.ngZone.run(() => {
            this.cargando = false;
            this.cdr.detectChanges();
          });
        }
      } else {
        this.ngZone.run(() => {
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
    }
  }

  private crearFormacionVacia(): FormacionAcademica {
    return {
      id: '',
      nivelEstudio: '',
      nombreEstudio: '',
      institucion: '',
      cursandoActualmente: false,
      anioInicio: '',
      anioTermino: ''
    };
  }

  private generarIdFormacion(): string {
    return `form_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  private extraerFormacionesGuardadas(cv: any): FormacionAcademica[] {
    if (Array.isArray(cv.formacionesAcademicas) && cv.formacionesAcademicas.length > 0) {
      return cv.formacionesAcademicas.map((item: any) => {
        // Compatibilidad: los registros antiguos marcaban "En curso" en estadoAcademico
        const cursando = item.cursandoActualmente !== undefined
          ? !!item.cursandoActualmente
          : item.estadoAcademico === 'En curso';

        return {
          id: item.id || this.generarIdFormacion(),
          nivelEstudio: this.normalizarNivelEstudio(item.nivelEstudio || ''),
          nombreEstudio: (item.nombreEstudio || '').trim() || this.normalizarNivelEstudio(item.nivelEstudio || ''),
          institucion: (item.institucion || '').trim(),
          cursandoActualmente: cursando,
          anioInicio: String(item.anioInicio || '').trim(),
          anioTermino: cursando ? '' : String(item.anioTermino || '').trim()
        };
      });
    }

    if (cv.nivelEducativo || cv.establecimiento || cv.carrera) {
      const nivelNorm = this.normalizarNivelEstudio(cv.nivelEducativo || 'Educación media C.H. / Técnica');
      const nombreDefecto = (cv.carrera || '').trim() || nivelNorm;
      return [
        {
          id: this.generarIdFormacion(),
          nivelEstudio: nivelNorm,
          nombreEstudio: nombreDefecto,
          institucion: (cv.establecimiento || 'Institución registrada').trim(),
          cursandoActualmente: false,
          anioInicio: '2018',
          anioTermino: '2022'
        }
      ];
    }

    return [];
  }

  private normalizarNivelEstudio(nivel: string): string {
    const limpio = (nivel || '').trim();
    if (limpio === 'Educación Básica' || limpio === 'Educación básica') {
      return 'Enseñanza básica';
    }
    if (
      limpio === 'Educación Media' ||
      limpio === 'Educación media C.H. (Científico-Humanista)' ||
      limpio === 'Educación media Técnica (Técnico-Profesional)'
    ) {
      return 'Educación media C.H. / Técnica';
    }
    if (
      limpio === 'Técnico Superior' ||
      limpio === 'Universidad' ||
      limpio === 'Universitaria' ||
      limpio === 'Instituto Profesional (I.P.)' ||
      limpio === 'Centro de Formación Técnica (C.F.T.)' ||
      limpio === 'Otro'
    ) {
      return 'Universitaria / I.P. / C.F.T.';
    }
    return limpio;
  }

  abrirModalEstudios() {
    this.modalEstudiosAbierto = true;
    this.cdr.detectChanges();
  }

  seleccionarNivel(nivel: string) {
    // Si cambia el nivel, se limpia la carrera/especialidad para no arrastrar datos de otro nivel
    if (this.formacionActual.nivelEstudio !== nivel) {
      this.formacionActual.nombreEstudio = '';
      this.limpiarCampos(['nombreEstudio']);
    }
    this.formacionActual.nivelEstudio = nivel;
    this.tocados.nivelEstudio = true;
    this.validarCampo('nivelEstudio');
    this.modalEstudiosAbierto = false;
    this.cdr.detectChanges();
  }

  // --- CAMPO DE CARRERA / ÁREA DE ESTUDIO SEGÚN EL NIVEL ---
  get mostrarCampoCarrera(): boolean {
    return [
      'Educación media C.H. / Técnica',
      'Universitaria / I.P. / C.F.T.',
      'Magíster o Postgrado'
    ].includes(this.formacionActual.nivelEstudio);
  }

  get etiquetaCarrera(): string {
    switch (this.formacionActual.nivelEstudio) {
      case 'Universitaria / I.P. / C.F.T.':
        return 'Carrera';
      case 'Magíster o Postgrado':
        return 'Programa o área de estudio';
      default:
        return 'Especialidad (opcional)';
    }
  }

  get placeholderCarrera(): string {
    switch (this.formacionActual.nivelEstudio) {
      case 'Universitaria / I.P. / C.F.T.':
        return 'Ej. Ingeniería en Informática, Enfermería...';
      case 'Magíster o Postgrado':
        return 'Ej. Magíster en Gestión, Diplomado en...';
      default:
        return 'Ej. Administración, Electricidad...';
    }
  }

  alternarCursandoActualmente(cursando: boolean) {
    this.formacionActual.cursandoActualmente = cursando;
    if (cursando) {
      this.formacionActual.anioTermino = '';
      this.limpiarCampos(['anioTermino']);
    }
    this.cdr.detectChanges();
  }

  private normalizarComparacion(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private tieneDatosEnFormularioFormacion(): boolean {
    return !!(
      this.formacionActual.nivelEstudio.trim() ||
      this.formacionActual.institucion.trim() ||
      String(this.formacionActual.anioInicio || '').trim() ||
      String(this.formacionActual.anioTermino || '').trim()
    );
  }

  async guardarFormacionEnLista(): Promise<boolean> {
    // Limpia espacios sobrantes y revisa los campos; si hay errores se muestran bajo cada campo
    this.formacionActual.institucion = normalizarEspacios(this.formacionActual.institucion);
    this.formacionActual.nombreEstudio = normalizarEspacios(this.formacionActual.nombreEstudio);

    if (!this.validarCampos(CAMPOS_FORMACION)) {
      return false;
    }

    const nivelEstudio = this.formacionActual.nivelEstudio.trim();
    const institucion = this.formacionActual.institucion;
    const cursandoActualmente = !!this.formacionActual.cursandoActualmente;
    const anioInicioStr = String(this.formacionActual.anioInicio).trim();
    const anioTerminoStr = cursandoActualmente ? '' : String(this.formacionActual.anioTermino).trim();

    let nombreEstudio = this.formacionActual.nombreEstudio;
    if (nivelEstudio === 'Enseñanza básica' || (nivelEstudio === 'Educación media C.H. / Técnica' && !nombreEstudio)) {
      nombreEstudio = nivelEstudio;
    }

    const esDuplicado = this.formacionesAcademicas.some((item, index) => {
      if (this.indiceEditandoFormacion !== null && index === this.indiceEditandoFormacion) {
        return false;
      }
      return (
        this.normalizarComparacion(item.nivelEstudio) === this.normalizarComparacion(nivelEstudio) &&
        this.normalizarComparacion(item.nombreEstudio) === this.normalizarComparacion(nombreEstudio) &&
        this.normalizarComparacion(item.institucion) === this.normalizarComparacion(institucion) &&
        item.anioInicio === anioInicioStr
      );
    });

    if (esDuplicado) {
      this.mostrarMensaje('Este estudio ya se encuentra agregado.', 'warning');
      return false;
    }

    const registroLimpio: FormacionAcademica = {
      id: this.formacionActual.id || this.generarIdFormacion(),
      nivelEstudio,
      nombreEstudio,
      institucion,
      cursandoActualmente,
      anioInicio: anioInicioStr,
      anioTermino: anioTerminoStr
    };

    const esEdicion = this.indiceEditandoFormacion !== null;
    const copiaLista = [...this.formacionesAcademicas];

    if (esEdicion && this.indiceEditandoFormacion !== null) {
      copiaLista[this.indiceEditandoFormacion] = registroLimpio;
    } else {
      copiaLista.push(registroLimpio);
    }

    this.formacionesAcademicas = copiaLista;
    this.formacionActual = this.crearFormacionVacia();
    this.indiceEditandoFormacion = null;
    this.limpiarCampos(CAMPOS_FORMACION);
    this.cdr.detectChanges();

    await this.sincronizarFormacionesEnFirestore();
    this.mostrarMensaje(esEdicion ? 'Estudio actualizado.' : 'Estudio agregado.', 'success');
    return true;
  }

  editarFormacion(index: number) {
    const seleccionada = this.formacionesAcademicas[index];
    if (!seleccionada) return;

    this.indiceEditandoFormacion = index;
    this.limpiarCampos(CAMPOS_FORMACION);
    this.formacionActual = { ...seleccionada };
    // Si el nombre guardado es solo el nivel (no se ingresó carrera/especialidad), el campo vuelve a quedar vacío
    if (this.formacionActual.nombreEstudio === this.formacionActual.nivelEstudio) {
      this.formacionActual.nombreEstudio = '';
    }
    this.cdr.detectChanges();
  }

  cancelarEdicionFormacion() {
    this.indiceEditandoFormacion = null;
    this.formacionActual = this.crearFormacionVacia();
    this.limpiarCampos(CAMPOS_FORMACION);
    this.cdr.detectChanges();
  }

  async eliminarFormacion(index: number) {
    const copiaLista = [...this.formacionesAcademicas];
    copiaLista.splice(index, 1);
    this.formacionesAcademicas = copiaLista;

    if (this.indiceEditandoFormacion === index) {
      this.cancelarEdicionFormacion();
    } else if (this.indiceEditandoFormacion !== null && this.indiceEditandoFormacion > index) {
      this.indiceEditandoFormacion--;
    }

    this.cdr.detectChanges();
    await this.sincronizarFormacionesEnFirestore();
    this.mostrarMensaje('Estudio eliminado.', 'success');
  }

  private async sincronizarFormacionesEnFirestore() {
    const user = this.auth.currentUser;
    if (!user) return;

    this.guardandoFormacion = true;
    try {
      const principal = this.formacionesAcademicas[this.formacionesAcademicas.length - 1] || null;
      const docRef = doc(this.firestore, `postulantes/${user.uid}`);

      await setDoc(docRef, {
        cvManual: {
          formacionesAcademicas: this.formacionesAcademicas,
          nivelEducativo: principal ? principal.nivelEstudio : '',
          establecimiento: principal ? principal.institucion : '',
          carrera: principal ? principal.nombreEstudio : ''
        },
        fechaActualizacionPerfil: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error al sincronizar estudios en Firestore:', error);
    } finally {
      this.guardandoFormacion = false;
      this.cdr.detectChanges();
    }
  }

  get textoBotonFinal(): string {
    return 'Terminar y Guardar';
  }

  get areasExperiencia(): any[] {
    return this.cvForm.get('areasExperiencia')?.value || [];
  }

  get sinExperiencia(): boolean {
    return !!this.cvForm.get('sinExperiencia')?.value;
  }

  limpiarExperienciaSiAplica() {
    if (this.sinExperiencia) {
      this.cvForm.get('areasExperiencia')?.setValue([]);
      this.limpiarCampos(CAMPOS_EXPERIENCIA);
      this.experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
      this.cdr.detectChanges();
    }
  }

  agregarExperiencia(): boolean {
    this.experienciaActual.cargo = normalizarEspacios(this.experienciaActual.cargo);
    this.experienciaActual.lugar = normalizarEspacios(this.experienciaActual.lugar);
    this.experienciaActual.tiempo = normalizarEspacios(this.experienciaActual.tiempo);

    if (!this.validarCampos(CAMPOS_EXPERIENCIA)) {
      return false;
    }

    const { cargo, lugar, tiempo, descripcion } = this.experienciaActual;
    const nuevaExp = { cargo, lugar, tiempo, descripcion: normalizarEspacios(descripcion) };

    this.cvForm.get('areasExperiencia')?.setValue([...this.areasExperiencia, nuevaExp]);
    this.cvForm.get('areasExperiencia')?.markAsDirty();
    this.experienciaActual = { cargo: '', lugar: '', tiempo: '', descripcion: '' };
    this.limpiarCampos(CAMPOS_EXPERIENCIA);
    this.cdr.detectChanges();
    return true;
  }

  eliminarArea(index: number) {
    const areasActuales = [...this.areasExperiencia];
    areasActuales.splice(index, 1);
    this.cvForm.get('areasExperiencia')?.setValue(areasActuales);
    this.cdr.detectChanges();
  }

  actualizarSugerenciasBlandas() {
    const textoActual = (this.cvForm.get('habilidadesBlandas')?.value || '').toLowerCase();
    this.sugerenciasBlandas = this.TODAS_BLANDAS.filter(hab => !textoActual.includes(hab.toLowerCase()));
  }

  actualizarSugerenciasTecnicas() {
    const textoActual = (this.cvForm.get('habilidadesTecnicas')?.value || '').toLowerCase();
    this.sugerenciasTecnicas = this.TODAS_TECNICAS.filter(hab => !textoActual.includes(hab.toLowerCase()));
  }

  agregarHabilidadBlanda(habilidad: string) {
    const actual = this.cvForm.get('habilidadesBlandas')?.value?.trim() || '';
    this.cvForm.get('habilidadesBlandas')?.setValue(actual ? actual + ', ' + habilidad : habilidad);
    this.actualizarSugerenciasBlandas();
    this.cdr.detectChanges();
  }

  agregarHabilidadTecnica(habilidad: string) {
    const actual = this.cvForm.get('habilidadesTecnicas')?.value?.trim() || '';
    this.cvForm.get('habilidadesTecnicas')?.setValue(actual ? actual + ', ' + habilidad : habilidad);
    this.actualizarSugerenciasTecnicas();
    this.cdr.detectChanges();
  }

  /* =======================================================
     VALIDACIÓN DE CAMPOS
     - El error aparece al salir de un campo con contenido, o al presionar el botón.
     - Una vez visible, se actualiza mientras el usuario corrige.
  ======================================================= */
  errorDe(campo: CampoCv): string {
    return this.tocados[campo] ? this.errores[campo] : '';
  }

  alCambiarCampo(campo: CampoLibre, valor: string | number | null | undefined) {
    const texto = valor === null || valor === undefined ? '' : String(valor);

    switch (campo) {
      case 'institucion': this.formacionActual.institucion = texto; break;
      case 'nombreEstudio': this.formacionActual.nombreEstudio = texto; break;
      case 'anioInicio': this.formacionActual.anioInicio = texto; break;
      case 'anioTermino': this.formacionActual.anioTermino = texto; break;
      case 'cargo': this.experienciaActual.cargo = texto; break;
      case 'lugar': this.experienciaActual.lugar = texto; break;
      case 'tiempo': this.experienciaActual.tiempo = texto; break;
    }

    if (this.tocados[campo]) {
      this.validarCampo(campo);
    }

    // El año de término depende del año de inicio
    if (campo === 'anioInicio' && this.tocados.anioTermino) {
      this.validarCampo('anioTermino');
    }
  }

  alSalirDeCampo(campo: CampoCv) {
    // Campo vacío que nunca se tocó: se avisa recién al presionar el botón
    if (!this.leerValor(campo).trim() && !this.tocados[campo]) {
      return;
    }

    this.tocados[campo] = true;
    this.validarCampo(campo);
  }

  private leerValor(campo: CampoCv): string {
    switch (campo) {
      case 'nivelEstudio': return this.formacionActual.nivelEstudio ?? '';
      case 'institucion': return this.formacionActual.institucion ?? '';
      case 'nombreEstudio': return this.formacionActual.nombreEstudio ?? '';
      case 'anioInicio': return String(this.formacionActual.anioInicio ?? '');
      case 'anioTermino': return String(this.formacionActual.anioTermino ?? '');
      case 'cargo': return this.experienciaActual.cargo ?? '';
      case 'lugar': return this.experienciaActual.lugar ?? '';
      case 'tiempo': return this.experienciaActual.tiempo ?? '';
      default: return String(this.cvForm.get(campo)?.value ?? '');
    }
  }

  private calcularError(campo: CampoCv): string {
    const valor = this.leerValor(campo);

    switch (campo) {
      case 'nivelEstudio':
        return valor ? '' : 'Selecciona tu nivel de estudio.';
      case 'institucion':
        return validarTextoObligatorio(valor, 'Ingresa la institución.', 80);
      case 'nombreEstudio':
        return this.errorCarrera(valor);
      case 'anioInicio':
        return validarAnio(valor, 'Ingresa el año de inicio.');
      case 'anioTermino': {
        if (this.formacionActual.cursandoActualmente) {
          return '';
        }
        const error = validarAnio(valor, 'Ingresa el año de término.');
        const inicio = this.leerValor('anioInicio');

        if (!error && /^\d{4}$/.test(inicio) && Number(valor) < Number(inicio)) {
          return 'Antes del año de inicio.';
        }
        return error;
      }
      case 'cargo':
        return validarTextoObligatorio(valor, 'Ingresa el cargo.', 60);
      case 'lugar':
        return validarTextoObligatorio(valor, 'Ingresa el lugar o empresa.', 80);
      case 'tiempo':
        return validarTextoObligatorio(valor, 'Ingresa el tiempo trabajado.', 40);
      case 'disponibilidad':
        return valor ? '' : 'Selecciona una opción.';
      case 'habilidadesBlandas':
        return validarTextoObligatorio(valor, 'Ingresa tus fortalezas.', 500);
      case 'habilidadesTecnicas':
        return validarTextoObligatorio(valor, 'Ingresa tus habilidades técnicas.', 500);
    }
  }

  /** La carrera es obligatoria en Universitaria y Postgrado; en Media es una especialidad opcional. */
  private errorCarrera(valor: string): string {
    if (!this.mostrarCampoCarrera) {
      return '';
    }

    const nivel = this.formacionActual.nivelEstudio;
    const obligatoria = nivel === 'Universitaria / I.P. / C.F.T.' || nivel === 'Magíster o Postgrado';

    if (!valor.trim()) {
      if (!obligatoria) return '';
      return nivel === 'Magíster o Postgrado' ? 'Ingresa el programa o área de estudio.' : 'Ingresa tu carrera.';
    }

    return validarTextoObligatorio(valor, '', 80);
  }

  private validarCampo(campo: CampoCv) {
    this.errores[campo] = this.calcularError(campo);
  }

  /** Marca los campos como tocados, los valida y, si hay errores, lleva la pantalla al primero. */
  private validarCampos(campos: CampoCv[]): boolean {
    let valido = true;

    for (const campo of campos) {
      this.tocados[campo] = true;
      this.validarCampo(campo);

      if (this.errores[campo]) {
        valido = false;
      }
    }

    this.cdr.detectChanges();

    if (!valido) {
      this.enfocarPrimerError();
    }
    return valido;
  }

  private limpiarCampos(campos: CampoCv[]) {
    campos.forEach(campo => {
      this.errores[campo] = '';
      this.tocados[campo] = false;
    });
  }

  private limpiarValidacion() {
    this.limpiarCampos(TODOS_LOS_CAMPOS);
  }

  private enfocarPrimerError() {
    setTimeout(() => {
      const campo = this.host.nativeElement.querySelector('.campo-invalido') as HTMLElement | null;
      campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  async siguientePaso() {
    if (this.pasoActual === 1) {
      if (this.tieneDatosEnFormularioFormacion()) {
        const guardadoOk = await this.guardarFormacionEnLista();
        if (!guardadoOk) return;
      }

      if (this.formacionesAcademicas.length === 0) {
        this.mostrarMensaje('Agrega al menos un estudio para continuar.', 'warning');
        return;
      }
    }

    if (this.pasoActual === 2 && !this.sinExperiencia) {
      const { cargo, lugar, tiempo } = this.experienciaActual;

      // Si dejó una experiencia a medio escribir, se revisa y se agrega para no perder lo escrito
      if ((cargo.trim() || lugar.trim() || tiempo.trim()) && !this.agregarExperiencia()) {
        return;
      }

      if (this.areasExperiencia.length === 0) {
        this.mostrarMensaje('Agrega una experiencia o marca "No tengo experiencia laboral".', 'warning');
        return;
      }
    }

    const campoDelPaso = CAMPO_POR_PASO[this.pasoActual];
    if (campoDelPaso && !this.validarCampos([campoDelPaso])) {
      return;
    }

    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
      this.cdr.detectChanges();
    } else {
      await this.guardarDatos();
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
      this.cdr.detectChanges();
    }
  }

  async guardarDatos() {
    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarMensaje('Debes iniciar sesión para continuar.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Guardando información...',
      spinner: 'crescent',
      cssClass: 'loading-expertimente'
    });
    await loading.present();

    try {
      const formValues = this.cvForm.getRawValue();
      const principal = this.formacionesAcademicas[this.formacionesAcademicas.length - 1] || null;

      const cvManualLimpio = {
        formacionesAcademicas: this.formacionesAcademicas,
        nivelEducativo: principal ? principal.nivelEstudio : '',
        establecimiento: principal ? principal.institucion : '',
        carrera: principal ? principal.nombreEstudio : '',
        sinExperiencia: !!formValues.sinExperiencia,
        areasExperiencia: Array.isArray(formValues.areasExperiencia) ? formValues.areasExperiencia : [],
        disponibilidad: formValues.disponibilidad || '',
        habilidadesBlandas: (formValues.habilidadesBlandas || '').trim(),
        habilidadesTecnicas: (formValues.habilidadesTecnicas || '').trim()
      };

      const docRef = doc(this.firestore, `postulantes/${user.uid}`);
      await setDoc(docRef, {
        cvManual: cvManualLimpio,
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      await loading.dismiss();
      await this.mostrarMensaje('¡Información guardada con éxito!', 'success');
      this.router.navigate(['/perfil-cv']);
    } catch (error) {
      console.error('Error al guardar en Firestore:', error);
      await loading.dismiss();
      await this.mostrarMensaje('Hubo un error al guardar los datos.', 'danger');
    }
  }

  async mostrarMensaje(mensaje: string, color: 'success' | 'warning' | 'danger' = 'success', duracion: number = 2500) {
    const iconos = {
      success: 'checkmark-circle',
      warning: 'warning',
      danger: 'close-circle'
    };

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: duracion,
      position: 'bottom',
      color,
      icon: iconos[color] || 'information-circle',
      cssClass: 'toast-expertimente'
    });
    await toast.present();
  }
}