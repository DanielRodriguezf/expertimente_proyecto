import { Component, OnInit, inject } from '@angular/core';
import { NgIf, NgClass, NgFor } from '@angular/common'; 
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonInput, 
  IonButton, 
  IonSpinner, 
  IonRadioGroup,
  IonRadio,
  IonSelect,
  IonSelectOption,
  ToastController 
} from '@ionic/angular';

// Importaciones reales de Firebase
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgClass,
    NgFor,
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonRadioGroup,
    IonRadio,
    IonSelect,
    IonSelectOption
  ]
})
export class RegistroPage implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private toastController = inject(ToastController);
  
  // Inyección de dependencias de Firebase
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  registroForm!: FormGroup;
  pasoActual = 1;
  isLoading = false;

  // Simulación de empresas existentes (idealmente cargar desde Firestore)
  empresasExistentes = [
    { id: 'emp_001', nombre: 'Tech Corp Chile' },
    { id: 'emp_002', nombre: 'Innovación Global S.A.' },
    { id: 'emp_003', nombre: 'Desarrollos Rápidos' }
  ];

  ngOnInit() {
    this.registroForm = this.fb.group({
      usuario: this.fb.group({
        nombre: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]]
      }, { validators: this.passwordMatchValidator }),
      
      empresa: this.fb.group({
        modoRegistro: ['existente', Validators.required],
        empresaId: [''], 
        nombreEmpresa: [''], 
        rutEmpresa: ['']
      })
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  get modoRegistro() {
    return this.registroForm.get('empresa.modoRegistro')?.value;
  }

  siguientePaso() {
    const usuarioForm = this.registroForm.get('usuario');
    if (usuarioForm?.invalid) {
      usuarioForm.markAllAsTouched();
      return;
    }
    this.pasoActual = 2;
  }

  volverPasoAnterior() {
    this.pasoActual = 1;
  }

  irALogin() {
    this.router.navigate(['/auth/login']);
  }

  async onSubmit() {
    const empresaForm = this.registroForm.get('empresa');
    const usuarioForm = this.registroForm.get('usuario');
    
    if (this.modoRegistro === 'existente' && !empresaForm?.get('empresaId')?.value) {
      this.mostrarError('Debes seleccionar una empresa existente.');
      return;
    }
    if (this.modoRegistro === 'nueva' && !empresaForm?.get('nombreEmpresa')?.value) {
      this.mostrarError('Debes ingresar el nombre de la nueva empresa.');
      return;
    }

    this.isLoading = true;

    // Extraemos los valores de los formularios
    const email = usuarioForm?.get('email')?.value;
    const password = usuarioForm?.get('password')?.value;
    const nombreUsuario = usuarioForm?.get('nombre')?.value;
    
    const empresaId = empresaForm?.get('empresaId')?.value;
    const nombreEmpresa = empresaForm?.get('nombreEmpresa')?.value;
    const rutEmpresa = empresaForm?.get('rutEmpresa')?.value;

    try {
      // 1. Crear el usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = userCredential.user.uid;

      let idEmpresaFinal = '';

      // 2. Gestionar la Empresa en Firestore
      if (this.modoRegistro === 'nueva') {
        const docRef = await addDoc(collection(this.firestore, 'empresas'), {
          nombre: nombreEmpresa,
          rut: rutEmpresa || ''
        });
        idEmpresaFinal = docRef.id;
      } else {
        idEmpresaFinal = empresaId; 
      }

      // 3. Guardar los datos del Reclutador en la nueva colección 'reclutadores'
      await setDoc(doc(this.firestore, 'reclutadores', uid), {
        nombre: nombreUsuario,
        email: email,
        rol: 'reclutador',
        empresaId: idEmpresaFinal
      });

      this.isLoading = false;
      const toast = await this.toastController.create({
        message: 'Registro exitoso. Bienvenido a ExpertiMente.',
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
      
      // 4. Redirección al home
      this.router.navigate(['/home']);

    } catch (error: any) {
      this.isLoading = false;
      console.error(error);
      
      let mensajeError = 'Ocurrió un error en el registro.';
      if (error.code === 'auth/email-already-in-use') {
        mensajeError = 'Este correo ya está registrado.';
      }
      this.mostrarError(mensajeError);
    }
  }

  async mostrarError(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }
}