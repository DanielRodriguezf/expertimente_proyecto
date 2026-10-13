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

// Importaciones de Firebase
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

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

  constructor() {
    // Registrar iconos de Ionic
    addIcons({ addOutline, trashOutline, saveOutline });
  }

  ngOnInit() {
    this.cuestionarioForm = this.fb.group({
      titulo: ['', Validators.required],
      preguntas: this.fb.array([this.crearPreguntaFormGroup()]) 
    });
  }

  // Acceso rápido al FormArray de preguntas
  get preguntas(): FormArray {
    return this.cuestionarioForm.get('preguntas') as FormArray;
  }

  // Estructura de cada bloque de pregunta
  crearPreguntaFormGroup(): FormGroup {
    return this.fb.group({
      texto: ['', Validators.required],
      tipo: ['texto', Validators.required],
      opciones: ['']
    });
  }

  // Agregar nueva pregunta
  agregarPregunta() {
    this.preguntas.push(this.crearPreguntaFormGroup());
  }

  // Eliminar pregunta existente
  eliminarPregunta(index: number) {
    if (this.preguntas.length > 1) {
      this.preguntas.removeAt(index);
    } else {
      this.mostrarToast('El cuestionario debe tener al menos una pregunta.', 'warning');
    }
  }

  // Guardar en la colección 'cuestionarios' de Firestore
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