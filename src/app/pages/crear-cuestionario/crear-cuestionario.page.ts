import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton,
  IonInput, IonItem, IonSelect, IonSelectOption,
  IonIcon, IonCard, IonCardContent, ToastController, IonSpinner
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline, saveOutline } from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

import {
  buscarPlantillaPorDefecto,
  PLANTILLAS_POR_AREA
} from '../../services/cuestionarios-defecto.data';

const CARGOS_DESTACADOS_POR_AREA: Record<string, string[]> = {
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
  'Gastronomía y Producción Alimentaria': [
    'Pastelero',
    'Maestro Panadero',
    'Encargado de Heladería',
    'Cocinero/a',
    'Chef'
  ],
  'Educación y Docencia': [
    'Profesor de Lenguaje y Comunicación',
    'Profesor/a de Educación Básica',
    'Educador/a de Párvulos'
  ],
  'Textil y Confección': [
    'Costurera / Operaria de Confección',
    'Modista',
    'Patronista'
  ]
};

@Component({
  selector: 'app-crear-cuestionario',
  templateUrl: './crear-cuestionario.page.html',
  styleUrls: ['./crear-cuestionario.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonContent, IonHeader,
    IonToolbar, IonTitle, IonButton, IonInput, IonItem,
    IonSelect, IonSelectOption, IonIcon, IonCard, IonCardContent, IonSpinner
  ]
})
export class CrearCuestionarioPage implements OnInit {
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private toastController = inject(ToastController);
  private router = inject(Router);

  cuestionarioForm!: FormGroup;
  isSaving = false;

  areasDisponibles: string[] = Array.from(
    new Set(Object.values(PLANTILLAS_POR_AREA).map(p => p.titulo))
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  cargosDelArea: string[] = [];

  constructor() {
    addIcons({ addOutline, trashOutline, saveOutline });
  }

  ngOnInit() {
    this.cuestionarioForm = this.fb.group({
      titulo: ['', Validators.required],
      areaLaboral: [''],
      cargoNombre: [''],
      preguntas: this.fb.array([this.crearPreguntaFormGroup()])
    });
  }

  get preguntas(): FormArray {
    return this.cuestionarioForm.get('preguntas') as FormArray;
  }

  crearPreguntaFormGroup(data?: { texto?: string; tipo?: string; opciones?: string }): FormGroup {
    return this.fb.group({
      texto: [data?.texto ?? '', Validators.required],
      tipo: [data?.tipo ?? 'texto', Validators.required],
      opciones: [data?.opciones ?? '']
    });
  }

  alCambiarArea(event: any) {
    const area = String(event?.detail?.value ?? '').trim();
    this.cuestionarioForm.patchValue({ cargoNombre: '' }, { emitEvent: false });
    this.cargosDelArea = CARGOS_DESTACADOS_POR_AREA[area] ?? [];
    this.cargarPlantillaInmediata('', area);
  }

  alCambiarCargo(event: any) {
    const cargo = String(event?.detail?.value ?? '').trim();
    const area = String(this.cuestionarioForm.get('areaLaboral')?.value ?? '').trim();
    this.cargarPlantillaInmediata(cargo, area);
  }

  private cargarPlantillaInmediata(cargo: string, area: string) {
    const plantilla = buscarPlantillaPorDefecto(cargo, area);
    if (!plantilla) {
      return;
    }

    if (!String(this.cuestionarioForm.get('titulo')?.value ?? '').trim()) {
      this.cuestionarioForm.patchValue({
        titulo: `Evaluación - ${cargo || area}`
      });
    }

    this.preguntas.clear();

    plantilla.preguntas.forEach(p => {
      const esSeleccion = p.tipo === 'seleccion' && p.opciones.length > 0;
      this.preguntas.push(
        this.crearPreguntaFormGroup({
          texto: p.texto,
          tipo: esSeleccion ? 'opcion_multiple' : 'texto',
          opciones: esSeleccion ? p.opciones.map(o => o.texto).join(', ') : ''
        })
      );
    });

    void this.mostrarToast(`Plantilla cargada: ${plantilla.titulo}`, 'success');
  }

  agregarPregunta() {
    this.preguntas.push(this.crearPreguntaFormGroup());
  }

  eliminarPregunta(index: number) {
    if (this.preguntas.length > 1) {
      this.preguntas.removeAt(index);
    } else {
      this.mostrarToast('El cuestionario debe tener al menos una pregunta.', 'warning');
    }
  }

  async guardarCuestionario() {
    if (this.cuestionarioForm.invalid) {
      this.cuestionarioForm.markAllAsTouched();
      this.mostrarToast('Por favor, completa todos los campos requeridos.', 'danger');
      return;
    }

    const user = this.auth.currentUser;
    if (!user) {
      this.mostrarToast('Debes iniciar sesión para crear un cuestionario.', 'danger');
      return;
    }

    this.isSaving = true;
    const formValues = this.cuestionarioForm.value;

    try {
      const preguntasFormateadas = formValues.preguntas.map((p: any, index: number) => {
        let opcionesArray: string[] = [];
        if (p.tipo === 'opcion_multiple' && p.opciones) {
          opcionesArray = p.opciones.split(',').map((opt: string) => opt.trim());
        }
        return {
          id: `pregunta_${index + 1}`,
          texto: p.texto,
          tipo: p.tipo,
          opciones: opcionesArray
        };
      });

      const nuevoCuestionario = {
        titulo: formValues.titulo,
        areaLaboral: formValues.areaLaboral || '',
        cargoNombre: formValues.cargoNombre || '',
        reclutadorId: user.uid,
        preguntas: preguntasFormateadas,
        fechaCreacion: new Date()
      };

      await addDoc(collection(this.firestore, 'cuestionarios'), nuevoCuestionario);

      this.mostrarToast('Cuestionario guardado exitosamente.', 'success');
      this.router.navigate(['/home']);

    } catch (error) {
      console.error('Error al guardar:', error);
      this.mostrarToast('Hubo un error al guardar el cuestionario.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      color: color,
      position: 'top'
    });
    await toast.present();
  }
}