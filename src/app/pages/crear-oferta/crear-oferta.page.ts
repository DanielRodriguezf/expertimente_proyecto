import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButton, 
  IonInput, 
  IonTextarea, 
  IonSelect, 
  IonSelectOption, 
  IonIcon, 
  IonSpinner,
  ToastController 
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { arrowBackOutline, saveOutline, briefcaseOutline } from 'ionicons/icons';

import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, addDoc, updateDoc, collection } from '@angular/fire/firestore';

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
    IonTitle,
    IonButton,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner
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

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'save-outline': saveOutline,
      'briefcase-outline': briefcaseOutline
    });
  }

  async ngOnInit() {
    this.inicializarFormulario();
    this.ofertaId = this.route.snapshot.paramMap.get('id');

    await this.obtenerDatosReclutador();

    if (this.ofertaId) {
      this.isEditMode = true;
      await this.cargarOfertaParaEditar(this.ofertaId);
    }
  }

  inicializarFormulario() {
    this.ofertaForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(4)]],
      descripcion: ['', [Validators.required, Validators.minLength(15)]],
      modalidad: ['Remoto', [Validators.required]],
      habilidades: [''],          // Opcional
      direccion: [''],            // Opcional
      contactoEmail: ['', [Validators.required, Validators.email]],
      contactoTelefono: ['']      // Opcional
    });
  }

  async obtenerDatosReclutador() {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const recDoc = await getDoc(doc(this.firestore, 'reclutadores', user.uid));
      if (recDoc.exists()) {
        const data = recDoc.data();
        this.empresaId = data['empresaId'] || '';
        
        if (!this.isEditMode) {
          this.ofertaForm.patchValue({ contactoEmail: data['email'] || user.email });
        }

        if (this.empresaId) {
          const empDoc = await getDoc(doc(this.firestore, 'empresas', this.empresaId));
          if (empDoc.exists()) {
            this.nombreEmpresa = empDoc.data()['nombre'];
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener datos del reclutador:', error);
    }
  }

  async cargarOfertaParaEditar(id: string) {
    this.isLoading = true;
    try {
      const docRef = doc(this.firestore, 'ofertas', id);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        this.ofertaForm.patchValue({
          titulo: data['titulo'],
          descripcion: data['descripcion'],
          modalidad: data['modalidad'],
          habilidades: data['habilidades'] || '',
          direccion: data['direccion'] || '',
          contactoEmail: data['contactoEmail'],
          contactoTelefono: data['contactoTelefono'] || ''
        });
      }
    } catch (error) {
      console.error('Error al cargar la oferta:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async guardarOferta() {
    if (this.ofertaForm.invalid) {
      this.ofertaForm.markAllAsTouched();
      return;
    }

    const user = this.auth.currentUser;
    if (!user) return;

    this.isLoading = true;
    const formValues = this.ofertaForm.value;

    try {
      if (this.isEditMode && this.ofertaId) {
        // ACTUALIZAR EN FIRESTORE
        const docRef = doc(this.firestore, 'ofertas', this.ofertaId);
        await updateDoc(docRef, {
          titulo: formValues.titulo,
          descripcion: formValues.descripcion,
          modalidad: formValues.modalidad,
          habilidades: formValues.habilidades,
          direccion: formValues.direccion,
          contactoEmail: formValues.contactoEmail,
          contactoTelefono: formValues.contactoTelefono,
          fechaActualizacion: new Date()
        });

        this.mostrarToast('Oferta actualizada correctamente.');
      } else {
        // CREAR EN FIRESTORE
        const ofertasRef = collection(this.firestore, 'ofertas');
        await addDoc(ofertasRef, {
          titulo: formValues.titulo,
          descripcion: formValues.descripcion,
          modalidad: formValues.modalidad,
          habilidades: formValues.habilidades,
          direccion: formValues.direccion,
          contactoEmail: formValues.contactoEmail,
          contactoTelefono: formValues.contactoTelefono,
          empresaId: this.empresaId,
          nombreEmpresa: this.nombreEmpresa,
          reclutadorId: user.uid,
          estado: 'Activa',
          candidatosCount: 0,
          fechaPublicacion: new Date()
        });

        this.mostrarToast('¡Oferta creada exitosamente!');
      }

      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al guardar:', error);
      this.mostrarToast('Ocurrió un error al guardar la oferta.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  volver() {
    this.router.navigate(['/home']);
  }

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