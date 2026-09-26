import { Component, OnInit, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';

import { Router } from '@angular/router';

import {
  IonContent,
  IonInput,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonRadioGroup,
  IonRadio,
  IonSelect,
  IonSelectOption,
  ToastController
} from '@ionic/angular';

import {
  Auth,
  createUserWithEmailAndPassword
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  setDoc,
  collection,
  addDoc,
  getDocs
} from '@angular/fire/firestore';


@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonTextarea,
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

  private auth = inject(Auth);
  private firestore = inject(Firestore);

  registroForm!: FormGroup;

  pasoActual = 1;

  isLoading = false;
  cargandoEmpresas = false;

  empresasExistentes: {
    id: string;
    nombre: string;
    rut: string;
  }[] = [];


  // ============================================================
  // INICIALIZACIÓN
  // ============================================================

  ngOnInit() {

    this.registroForm = this.fb.group({

      usuario: this.fb.group(
        {
          nombre: [
            '',
            [
              Validators.required,
              Validators.minLength(3)
            ]
          ],

          email: [
            '',
            [
              Validators.required,
              Validators.email
            ]
          ],

          password: [
            '',
            [
              Validators.required,
              Validators.minLength(6)
            ]
          ],

          confirmPassword: [
            '',
            Validators.required
          ]
        },
        {
          validators: this.passwordMatchValidator
        }
      ),

      empresa: this.fb.group({

        modoRegistro: [
          'existente',
          Validators.required
        ],

        // Empresa existente
        empresaId: [''],

        // Empresa nueva
        nombreEmpresa: [''],

        rutEmpresa: [''],

        rubro: [''],

        tamanoEmpresa: [''],

        region: [''],

        comuna: [''],

        direccionEmpresa: [''],

        emailEmpresa: [''],

        telefonoEmpresa: [''],

        sitioWeb: [''],

        descripcionEmpresa: ['']
      })
    });


    // Configurar validaciones dependiendo
    // del tipo de registro.
    this.configurarValidadoresEmpresa();

    this.cargarEmpresas();
  }


  // ============================================================
  // CARGAR EMPRESAS
  // ============================================================

  async cargarEmpresas() {

    this.cargandoEmpresas = true;

    try {

      const querySnapshot = await getDocs(
        collection(
          this.firestore,
          'empresas'
        )
      );

      this.empresasExistentes =
        querySnapshot.docs.map(documento => {

          const data = documento.data();

          return {

            id: documento.id,

            nombre:
              data['nombre'] ||
              'Empresa sin nombre',

            rut:
              data['rut'] || ''
          };
        });

    } catch (error) {

      console.error(
        'Error al cargar las empresas:',
        error
      );

      await this.mostrarError(
        'No fue posible cargar las empresas registradas.'
      );

    } finally {

      this.cargandoEmpresas = false;
    }
  }


  // ============================================================
  // VALIDACIÓN PASSWORD
  // ============================================================

  passwordMatchValidator(
    control: AbstractControl
  ): ValidationErrors | null {

    const password =
      control.get('password')?.value;

    const confirmPassword =
      control.get('confirmPassword')?.value;

    return password === confirmPassword
      ? null
      : { passwordMismatch: true };
  }


  // ============================================================
  // VALIDACIÓN RUT CHILENO
  // ============================================================

  rutValidator(): ValidatorFn {

    return (
      control: AbstractControl
    ): ValidationErrors | null => {

      const valor = control.value;

      if (!valor) {
        return null;
      }

      const rut =
        this.normalizarRut(valor);

      if (rut.length < 8) {

        return {
          rutInvalido: true
        };
      }

      const cuerpo =
        rut.slice(0, -1);

      const dvIngresado =
        rut.slice(-1);

      let suma = 0;
      let multiplicador = 2;

      for (
        let i = cuerpo.length - 1;
        i >= 0;
        i--
      ) {

        suma +=
          Number(cuerpo[i]) *
          multiplicador;

        multiplicador =
          multiplicador === 7
            ? 2
            : multiplicador + 1;
      }

      const resultado =
        11 - (suma % 11);

      let dvCalculado: string;

      if (resultado === 11) {

        dvCalculado = '0';

      } else if (resultado === 10) {

        dvCalculado = 'K';

      } else {

        dvCalculado =
          resultado.toString();
      }

      return dvCalculado === dvIngresado
        ? null
        : {
            rutInvalido: true
          };
    };
  }


  private normalizarRut(
    rut: string
  ): string {

    return String(rut)
      .replace(/[^0-9kK]/g, '')
      .toUpperCase();
  }


  formatearRutEmpresa() {

    const control =
      this.registroForm.get(
        'empresa.rutEmpresa'
      );

    if (!control?.value) {
      return;
    }

    const rut =
      this.normalizarRut(
        control.value
      );

    if (rut.length < 2) {
      return;
    }

    const cuerpo =
      rut.slice(0, -1);

    const dv =
      rut.slice(-1);

    const cuerpoFormateado =
      cuerpo.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        '.'
      );

    control.setValue(
      `${cuerpoFormateado}-${dv}`,
      {
        emitEvent: false
      }
    );
  }


  // ============================================================
  // VALIDADORES EMPRESA
  // ============================================================

  configurarValidadoresEmpresa() {

    const modoControl =
      this.registroForm.get(
        'empresa.modoRegistro'
      );

    this.actualizarValidadoresEmpresa(
      modoControl?.value
    );

    modoControl?.valueChanges.subscribe(
      modo => {

        this.actualizarValidadoresEmpresa(
          modo
        );
      }
    );
  }


  private actualizarValidadoresEmpresa(
    modo: string
  ) {

    const empresaForm =
      this.registroForm.get(
        'empresa'
      ) as FormGroup;

    const empresaId =
      empresaForm.get('empresaId');

    const camposNuevaEmpresa = {

      nombreEmpresa:
        [
          Validators.required,
          Validators.minLength(2)
        ],

      rutEmpresa:
        [
          Validators.required,
          this.rutValidator()
        ],

      rubro:
        [
          Validators.required
        ],

      tamanoEmpresa:
        [
          Validators.required
        ],

      region:
        [
          Validators.required
        ],

      comuna:
        [
          Validators.required,
          Validators.minLength(2)
        ],

      direccionEmpresa:
        [
          Validators.required,
          Validators.minLength(5)
        ],

      emailEmpresa:
        [
          Validators.required,
          Validators.email
        ],

      telefonoEmpresa:
        [
          Validators.required,
          Validators.minLength(8)
        ],

      descripcionEmpresa:
        [
          Validators.required,
          Validators.minLength(20)
        ]
    };


    if (modo === 'existente') {

      empresaId?.setValidators(
        Validators.required
      );

      Object.keys(
        camposNuevaEmpresa
      ).forEach(nombreCampo => {

        empresaForm
          .get(nombreCampo)
          ?.clearValidators();

        empresaForm
          .get(nombreCampo)
          ?.updateValueAndValidity({
            emitEvent: false
          });
      });

    } else {

      empresaId?.clearValidators();

      Object.entries(
        camposNuevaEmpresa
      ).forEach(
        ([nombreCampo, validators]) => {

          empresaForm
            .get(nombreCampo)
            ?.setValidators(validators);

          empresaForm
            .get(nombreCampo)
            ?.updateValueAndValidity({
              emitEvent: false
            });
        }
      );
    }

    empresaId?.updateValueAndValidity({
      emitEvent: false
    });
  }


  // ============================================================
  // DUPLICADOS RUT
  // ============================================================

  private empresaConRutExiste(
    rut: string
  ): boolean {

    const normalizado =
      this.normalizarRut(rut);

    return this.empresasExistentes.some(
      empresa => {

        return (
          this.normalizarRut(
            empresa.rut
          ) === normalizado
        );
      }
    );
  }


  // ============================================================
  // GETTERS
  // ============================================================

  get modoRegistro() {

    return this.registroForm.get(
      'empresa.modoRegistro'
    )?.value;
  }


  // ============================================================
  // NAVEGACIÓN PASOS
  // ============================================================

  siguientePaso() {

    const usuarioForm =
      this.registroForm.get(
        'usuario'
      );

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

    this.router.navigate(
      ['/auth/login']
    );
  }


  // ============================================================
  // REGISTRO
  // ============================================================

  async onSubmit() {

    const empresaForm =
      this.registroForm.get(
        'empresa'
      ) as FormGroup;

    const usuarioForm =
      this.registroForm.get(
        'usuario'
      ) as FormGroup;


    // Validación empresa existente
    if (
      this.modoRegistro ===
      'existente'
    ) {

      if (
        !empresaForm
          .get('empresaId')
          ?.value
      ) {

        await this.mostrarError(
          'Debes seleccionar una empresa existente.'
        );

        return;
      }
    }


    // Validación empresa nueva
    if (
      this.modoRegistro ===
      'nueva'
    ) {

      if (empresaForm.invalid) {

        empresaForm.markAllAsTouched();

        await this.mostrarError(
          'Completa correctamente los datos obligatorios de la empresa.'
        );

        return;
      }


      const rut =
        empresaForm.get(
          'rutEmpresa'
        )?.value;

      if (
        this.empresaConRutExiste(rut)
      ) {

        await this.mostrarError(
          'Ya existe una empresa registrada con este RUT.'
        );

        return;
      }
    }


    this.isLoading = true;


    const email =
      usuarioForm
        .get('email')
        ?.value
        ?.trim();

    const password =
      usuarioForm
        .get('password')
        ?.value;

    const nombreUsuario =
      usuarioForm
        .get('nombre')
        ?.value
        ?.trim();


    try {

      // ======================================================
      // 1. CREAR CUENTA FIREBASE AUTH
      // ======================================================

      const userCredential =
        await createUserWithEmailAndPassword(
          this.auth,
          email,
          password
        );

      const uid =
        userCredential.user.uid;


      let idEmpresaFinal = '';


      // ======================================================
      // 2. CREAR EMPRESA
      // ======================================================

      if (
        this.modoRegistro ===
        'nueva'
      ) {

        const rutFormateado =
          empresaForm
            .get('rutEmpresa')
            ?.value;

        const rutNormalizado =
          this.normalizarRut(
            rutFormateado
          );


        const docRef =
          await addDoc(
            collection(
              this.firestore,
              'empresas'
            ),
            {

              nombre:
                empresaForm
                  .get('nombreEmpresa')
                  ?.value
                  ?.trim(),

              rut:
                rutFormateado,

              rutNormalizado:
                rutNormalizado,

              rubro:
                empresaForm
                  .get('rubro')
                  ?.value
                  ?.trim(),

              tamanoEmpresa:
                empresaForm
                  .get('tamanoEmpresa')
                  ?.value,

              region:
                empresaForm
                  .get('region')
                  ?.value,

              comuna:
                empresaForm
                  .get('comuna')
                  ?.value
                  ?.trim(),

              direccion:
                empresaForm
                  .get('direccionEmpresa')
                  ?.value
                  ?.trim(),

              email:
                empresaForm
                  .get('emailEmpresa')
                  ?.value
                  ?.trim()
                  ?.toLowerCase(),

              telefono:
                empresaForm
                  .get('telefonoEmpresa')
                  ?.value
                  ?.trim(),

              sitioWeb:
                empresaForm
                  .get('sitioWeb')
                  ?.value
                  ?.trim() || '',

              descripcion:
                empresaForm
                  .get('descripcionEmpresa')
                  ?.value
                  ?.trim(),

              creadoPor:
                uid,

              fechaCreacion:
                new Date()
            }
          );

        idEmpresaFinal =
          docRef.id;

      } else {

        idEmpresaFinal =
          empresaForm
            .get('empresaId')
            ?.value;
      }


      // ======================================================
      // 3. CREAR RECLUTADOR
      // ======================================================

      await setDoc(
        doc(
          this.firestore,
          'reclutadores',
          uid
        ),
        {

          nombre:
            nombreUsuario,

          email:
            email,

          rol:
            'reclutador',

          empresaId:
            idEmpresaFinal,

          fechaCreacion:
            new Date()
        }
      );


      // ======================================================
      // 4. MENSAJE + HOME
      // ======================================================

      const toast =
        await this.toastController.create({

          message:
            'Registro exitoso. Bienvenido a ExpertiMente.',

          duration:
            3000,

          color:
            'success',

          position:
            'top'
        });

      await toast.present();


      this.router.navigate(
        ['/home']
      );

    } catch (error: any) {

      console.error(
        'Error durante el registro:',
        error
      );

      let mensajeError =
        'Ocurrió un error en el registro.';


      if (
        error.code ===
        'auth/email-already-in-use'
      ) {

        mensajeError =
          'Este correo ya está registrado.';

      } else if (
        error.code ===
        'auth/invalid-email'
      ) {

        mensajeError =
          'El correo electrónico no es válido.';

      } else if (
        error.code ===
        'auth/weak-password'
      ) {

        mensajeError =
          'La contraseña no cumple los requisitos mínimos.';
      }


      await this.mostrarError(
        mensajeError
      );

    } finally {

      this.isLoading = false;
    }
  }


  // ============================================================
  // TOAST ERROR
  // ============================================================

  async mostrarError(
    mensaje: string
  ) {

    const toast =
      await this.toastController.create({

        message:
          mensaje,

        duration:
          3000,

        color:
          'danger',

        position:
          'top'
      });

    await toast.present();
  }
}