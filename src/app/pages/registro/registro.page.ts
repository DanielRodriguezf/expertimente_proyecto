import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  NgIf,
  NgFor
} from '@angular/common';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';

import {
  Router
} from '@angular/router';

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

  private fb =
    inject(FormBuilder);

  private router =
    inject(Router);

  private toastController =
    inject(ToastController);

  private auth =
    inject(Auth);

  private firestore =
    inject(Firestore);


  registroForm!: ReturnType<FormBuilder['group']>;


  pasoActual = 1;

  isLoading = false;

  cargandoEmpresas = false;

  procesandoCV = false;


  readonly maxCvBytes =
    600 * 1024;


  empresasExistentes: {
    id: string;
    nombre: string;
    rut: string;
  }[] = [];


  // ============================================================
  // INICIALIZACIÓN
  // ============================================================

  ngOnInit() {

    this.registroForm =
      this.fb.group({

        usuario:
          this.fb.group(
            {

              nombre: [
                '',
                [
                  Validators.required,
                  Validators.minLength(2)
                ]
              ],

              apellido: [
                '',
                [
                  Validators.required,
                  Validators.minLength(2)
                ]
              ],

              email: [
                '',
                [
                  Validators.required,
                  Validators.email
                ]
              ],

              telefono: [
                '',
                [
                  Validators.required,
                  Validators.minLength(8)
                ]
              ],

              cargoEmpresa: [
                '',
                [
                  Validators.required,
                  Validators.minLength(2)
                ]
              ],

              linkedin: [
                '',
                [
                  this.linkedinValidator()
                ]
              ],

              cvBase64: [
                ''
              ],

              cvNombre: [
                ''
              ],

              descripcionProfesional: [
                '',
                [
                  Validators.maxLength(400)
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
              validators: [
                this.passwordMatchValidator,
                this.linkedinOCvValidator
              ]
            }
          ),


        empresa:
          this.fb.group({

            modoRegistro: [
              'existente',
              Validators.required
            ],

            // Empresa existente
            empresaId: [
              ''
            ],

            // Empresa nueva
            nombreEmpresa: [
              ''
            ],

            rutEmpresa: [
              ''
            ],

            rubro: [
              ''
            ],

            emailEmpresa: [
              ''
            ],

            sitioWeb: [
              ''
            ]

          })

      });


    this.configurarValidadoresEmpresa();

    this.cargarEmpresas();
  }


  // ============================================================
  // CARGAR EMPRESAS
  // ============================================================

  async cargarEmpresas() {

    this.cargandoEmpresas =
      true;


    try {

      const querySnapshot =
        await getDocs(

          collection(
            this.firestore,
            'empresas'
          )

        );


      this.empresasExistentes =
        querySnapshot.docs.map(

          documento => {

            const data =
              documento.data();


            return {

              id:
                documento.id,

              nombre:
                data['nombre']
                ||
                'Empresa sin nombre',

              rut:
                data['rut']
                ||
                ''

            };

          }

        );


    } catch (
      error
    ) {

      console.error(
        'Error al cargar las empresas:',
        error
      );


      await this.mostrarError(
        'No fue posible cargar las empresas registradas.'
      );


    } finally {

      this.cargandoEmpresas =
        false;

    }
  }


  // ============================================================
  // VALIDACIÓN PASSWORD
  // ============================================================

  passwordMatchValidator(
    control: AbstractControl
  ): ValidationErrors | null {

    const password =
      control
        .get('password')
        ?.value;


    const confirmPassword =
      control
        .get('confirmPassword')
        ?.value;


    return password === confirmPassword

      ? null

      : {
          passwordMismatch:
            true
        };
  }


  // ============================================================
  // VALIDACIÓN LINKEDIN O CV
  // ============================================================

  linkedinOCvValidator(
    control: AbstractControl
  ): ValidationErrors | null {

    const linkedin =
      String(
        control
          .get('linkedin')
          ?.value
        ||
        ''
      )
        .trim();


    const cvBase64 =
      String(
        control
          .get('cvBase64')
          ?.value
        ||
        ''
      )
        .trim();


    return linkedin || cvBase64

      ? null

      : {
          linkedinOCvRequerido:
            true
        };
  }


  // ============================================================
  // VALIDACIÓN LINKEDIN
  // ============================================================

  linkedinValidator(): ValidatorFn {

    return (
      control: AbstractControl
    ): ValidationErrors | null => {

      const valor =
        String(
          control.value
          ||
          ''
        )
          .trim();


      if (
        !valor
      ) {

        return null;
      }


      const patron =
        /^(https?:\/\/)?(www\.)?linkedin\.com\/.+$/i;


      return patron.test(
        valor
      )

        ? null

        : {
            linkedinInvalido:
              true
          };
    };
  }


  normalizarLinkedin() {

    const control =
      this.registroForm
        .get(
          'usuario.linkedin'
        );


    const valor =
      String(
        control?.value
        ||
        ''
      )
        .trim();


    if (
      !valor
    ) {

      return;
    }


    if (
      !/^https?:\/\//i.test(
        valor
      )
    ) {

      control?.setValue(
        `https://${valor}`,
        {
          emitEvent:
            false
        }
      );
    }


    control
      ?.updateValueAndValidity();
  }


  // ============================================================
  // CURRÍCULUM PDF
  // ============================================================

  async seleccionarCV(
    event: Event
  ) {

    const input =
      event.target;


    if (
      !(input instanceof HTMLInputElement)
    ) {

      return;
    }


    const archivo =
      input.files?.[0];


    if (
      !archivo
    ) {

      return;
    }


    // =========================================================
    // VALIDAR TIPO
    // =========================================================

    if (
      archivo.type !==
      'application/pdf'
    ) {

      input.value =
        '';


      await this.mostrarError(
        'El currículum debe ser un archivo PDF.'
      );


      return;
    }


    // =========================================================
    // VALIDAR TAMAÑO
    // =========================================================

    if (
      archivo.size >
      this.maxCvBytes
    ) {

      input.value =
        '';


      await this.mostrarError(
        'El PDF no puede superar los 600 KB.'
      );


      return;
    }


    this.procesandoCV =
      true;


    try {

      const base64 =
        await this
          .convertirArchivoABase64(
            archivo
          );


      this.registroForm
        .patchValue({

          usuario: {

            cvBase64:
              base64,

            cvNombre:
              archivo.name

          }

        });


      this.registroForm
        .get(
          'usuario'
        )
        ?.updateValueAndValidity();


    } catch (
      error
    ) {

      console.error(
        'Error al procesar el CV:',
        error
      );


      input.value =
        '';


      await this.mostrarError(
        'No fue posible procesar el currículum.'
      );


    } finally {

      this.procesandoCV =
        false;

    }
  }


  eliminarCV() {

    this.registroForm
      .patchValue({

        usuario: {

          cvBase64:
            '',

          cvNombre:
            ''

        }

      });


    this.registroForm
      .get(
        'usuario'
      )
      ?.updateValueAndValidity();
  }


  private convertirArchivoABase64(
    archivo: File
  ): Promise<string> {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const reader =
          new FileReader();


        reader.onload =
          () => {

            resolve(
              String(
                reader.result
                ||
                ''
              )
            );

          };


        reader.onerror =
          () => {

            reject(
              reader.error
            );

          };


        reader.readAsDataURL(
          archivo
        );

      }
    );
  }


  // ============================================================
  // VALIDACIÓN RUT CHILENO
  // ============================================================

  rutValidator(): ValidatorFn {

    return (
      control: AbstractControl
    ): ValidationErrors | null => {

      const valor =
        control.value;


      if (
        !valor
      ) {

        return null;
      }


      const rut =
        this.normalizarRut(
          valor
        );


      if (
        rut.length <
        8
      ) {

        return {
          rutInvalido:
            true
        };
      }


      const cuerpo =
        rut.slice(
          0,
          -1
        );


      const dvIngresado =
        rut.slice(
          -1
        );


      let suma =
        0;


      let multiplicador =
        2;


      for (
        let i =
          cuerpo.length - 1;

        i >= 0;

        i--
      ) {

        suma +=
          Number(
            cuerpo[i]
          )
          *
          multiplicador;


        multiplicador =
          multiplicador === 7

            ? 2

            : multiplicador + 1;
      }


      const resultado =
        11 -
        (
          suma %
          11
        );


      let dvCalculado:
        string;


      if (
        resultado ===
        11
      ) {

        dvCalculado =
          '0';


      } else if (
        resultado ===
        10
      ) {

        dvCalculado =
          'K';


      } else {

        dvCalculado =
          resultado
            .toString();

      }


      return (
        dvCalculado ===
        dvIngresado
      )

        ? null

        : {
            rutInvalido:
              true
          };

    };
  }


  private normalizarRut(
    rut: string
  ): string {

    return String(
      rut
    )
      .replace(
        /[^0-9kK]/g,
        ''
      )
      .toUpperCase();
  }


  formatearRutEmpresa() {

    const control =
      this.registroForm
        .get(
          'empresa.rutEmpresa'
        );


    if (
      !control?.value
    ) {

      return;
    }


    const rut =
      this.normalizarRut(
        control.value
      );


    if (
      rut.length <
      2
    ) {

      return;
    }


    const cuerpo =
      rut.slice(
        0,
        -1
      );


    const dv =
      rut.slice(
        -1
      );


    const cuerpoFormateado =
      cuerpo.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        '.'
      );


    control.setValue(
      `${cuerpoFormateado}-${dv}`,
      {
        emitEvent:
          false
      }
    );
  }


  // ============================================================
  // VALIDADORES EMPRESA
  // ============================================================

  configurarValidadoresEmpresa() {

    const modoControl =
      this.registroForm
        .get(
          'empresa.modoRegistro'
        );


    this.actualizarValidadoresEmpresa(
      modoControl?.value
    );


    modoControl
      ?.valueChanges
      .subscribe(
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
      this.registroForm
        .get(
          'empresa'
        );


    if (
      !empresaForm
    ) {

      return;
    }


    const empresaId =
      empresaForm
        .get(
          'empresaId'
        );


    const camposNuevaEmpresa = {

      nombreEmpresa: [
        Validators.required,
        Validators.minLength(2)
      ],

      rutEmpresa: [
        Validators.required,
        this.rutValidator()
      ],

      rubro: [
        Validators.required
      ],

      emailEmpresa: [
        Validators.required,
        Validators.email
      ]

    };


    if (
      modo ===
      'existente'
    ) {

      empresaId
        ?.setValidators(
          Validators.required
        );


      Object
        .keys(
          camposNuevaEmpresa
        )
        .forEach(
          nombreCampo => {

            empresaForm
              .get(
                nombreCampo
              )
              ?.clearValidators();


            empresaForm
              .get(
                nombreCampo
              )
              ?.updateValueAndValidity({
                emitEvent:
                  false
              });

          }
        );


    } else {

      empresaId
        ?.clearValidators();


      Object
        .entries(
          camposNuevaEmpresa
        )
        .forEach(
          (
            [
              nombreCampo,
              validators
            ]
          ) => {

            empresaForm
              .get(
                nombreCampo
              )
              ?.setValidators(
                validators
              );


            empresaForm
              .get(
                nombreCampo
              )
              ?.updateValueAndValidity({
                emitEvent:
                  false
              });

          }
        );

    }


    empresaId
      ?.updateValueAndValidity({
        emitEvent:
          false
      });
  }


  // ============================================================
  // DUPLICADOS RUT
  // ============================================================

  private empresaConRutExiste(
    rut: string
  ): boolean {

    const normalizado =
      this.normalizarRut(
        rut
      );


    return this
      .empresasExistentes
      .some(
        empresa => {

          return (
            this.normalizarRut(
              empresa.rut
            )
            ===
            normalizado
          );

        }
      );
  }


  // ============================================================
  // GETTERS
  // ============================================================

  get modoRegistro() {

    return this.registroForm
      .get(
        'empresa.modoRegistro'
      )
      ?.value;
  }


  get nombreCV(): string {

    return String(
      this.registroForm
        .get(
          'usuario.cvNombre'
        )
        ?.value
      ||
      ''
    );
  }


  // ============================================================
  // NAVEGACIÓN
  // ============================================================

  async siguientePaso() {

    const usuarioForm =
      this.registroForm
        .get(
          'usuario'
        );


    if (
      !usuarioForm
    ) {

      await this.mostrarError(
        'No fue posible cargar los datos del formulario.'
      );


      return;
    }


    if (
      usuarioForm.invalid
    ) {

      usuarioForm
        .markAllAsTouched();


      if (
        usuarioForm
          .hasError(
            'linkedinOCvRequerido'
          )
      ) {

        await this.mostrarError(
          'Agrega tu LinkedIn o adjunta tu currículum en PDF.'
        );

      }


      return;
    }


    this.pasoActual =
      2;
  }


  volverPasoAnterior() {

    this.pasoActual =
      1;
  }


  irALogin() {

    this.router.navigate(
      [
        '/auth/login'
      ]
    );
  }


  // ============================================================
  // REGISTRO
  // ============================================================

  async onSubmit() {

    const empresaForm =
      this.registroForm
        .get(
          'empresa'
        );


    const usuarioForm =
      this.registroForm
        .get(
          'usuario'
        );


    // ========================================================
    // SEGURIDAD: LOS GRUPOS DEBEN EXISTIR
    // ========================================================

    if (
      !empresaForm
      ||
      !usuarioForm
    ) {

      await this.mostrarError(
        'No fue posible cargar correctamente el formulario de registro.'
      );


      return;
    }


    // ========================================================
    // VALIDAR USUARIO
    // ========================================================

    if (
      usuarioForm.invalid
    ) {

      usuarioForm
        .markAllAsTouched();


      await this.mostrarError(
        'Revisa los datos personales y profesionales antes de continuar.'
      );


      this.pasoActual =
        1;


      return;
    }


    // ========================================================
    // EMPRESA EXISTENTE
    // ========================================================

    if (
      this.modoRegistro ===
      'existente'
    ) {

      if (
        !empresaForm
          .get(
            'empresaId'
          )
          ?.value
      ) {

        await this.mostrarError(
          'Debes seleccionar una empresa existente.'
        );


        return;
      }
    }


    // ========================================================
    // EMPRESA NUEVA
    // ========================================================

    if (
      this.modoRegistro ===
      'nueva'
    ) {

      if (
        empresaForm.invalid
      ) {

        empresaForm
          .markAllAsTouched();


        await this.mostrarError(
          'Completa correctamente los datos obligatorios de la empresa.'
        );


        return;
      }


      const rut =
        empresaForm
          .get(
            'rutEmpresa'
          )
          ?.value;


      if (
        this.empresaConRutExiste(
          rut
        )
      ) {

        await this.mostrarError(
          'Ya existe una empresa registrada con este RUT.'
        );


        return;
      }
    }


    this.isLoading =
      true;


    // ========================================================
    // DATOS USUARIO
    // ========================================================

    const email =
      String(
        usuarioForm
          .get(
            'email'
          )
          ?.value
        ||
        ''
      )
        .trim()
        .toLowerCase();


    const password =
      String(
        usuarioForm
          .get(
            'password'
          )
          ?.value
        ||
        ''
      );


    const nombre =
      String(
        usuarioForm
          .get(
            'nombre'
          )
          ?.value
        ||
        ''
      )
        .trim();


    const apellido =
      String(
        usuarioForm
          .get(
            'apellido'
          )
          ?.value
        ||
        ''
      )
        .trim();


    const nombreCompleto =
      `${nombre} ${apellido}`
        .trim();


    const telefono =
      String(
        usuarioForm
          .get(
            'telefono'
          )
          ?.value
        ||
        ''
      )
        .trim();


    const cargoEmpresa =
      String(
        usuarioForm
          .get(
            'cargoEmpresa'
          )
          ?.value
        ||
        ''
      )
        .trim();


    const linkedin =
      String(
        usuarioForm
          .get(
            'linkedin'
          )
          ?.value
        ||
        ''
      )
        .trim();


    const cvBase64 =
      String(
        usuarioForm
          .get(
            'cvBase64'
          )
          ?.value
        ||
        ''
      );


    const cvNombre =
      String(
        usuarioForm
          .get(
            'cvNombre'
          )
          ?.value
        ||
        ''
      );


    const descripcionProfesional =
      String(
        usuarioForm
          .get(
            'descripcionProfesional'
          )
          ?.value
        ||
        ''
      )
        .trim();


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
        userCredential
          .user
          .uid;


      let idEmpresaFinal =
        '';


      // ======================================================
      // 2. CREAR EMPRESA NUEVA
      // ======================================================

      if (
        this.modoRegistro ===
        'nueva'
      ) {

        const rutFormateado =
          String(
            empresaForm
              .get(
                'rutEmpresa'
              )
              ?.value
            ||
            ''
          );


        const rutNormalizado =
          this.normalizarRut(
            rutFormateado
          );


        const nombreEmpresa =
          String(
            empresaForm
              .get(
                'nombreEmpresa'
              )
              ?.value
            ||
            ''
          )
            .trim();


        const rubro =
          String(
            empresaForm
              .get(
                'rubro'
              )
              ?.value
            ||
            ''
          )
            .trim();


        const emailEmpresa =
          String(
            empresaForm
              .get(
                'emailEmpresa'
              )
              ?.value
            ||
            ''
          )
            .trim()
            .toLowerCase();


        const sitioWeb =
          String(
            empresaForm
              .get(
                'sitioWeb'
              )
              ?.value
            ||
            ''
          )
            .trim();


        const docRef =
          await addDoc(

            collection(
              this.firestore,
              'empresas'
            ),

            {

              nombre:
                nombreEmpresa,

              rut:
                rutFormateado,

              rutNormalizado:
                rutNormalizado,

              rubro:
                rubro,

              email:
                emailEmpresa,

              sitioWeb:
                sitioWeb,


              // =================================================
              // COMPATIBILIDAD CON CAMPOS ANTIGUOS
              // =================================================

              tamanoEmpresa:
                '',

              region:
                '',

              comuna:
                '',

              direccion:
                '',

              telefono:
                '',

              descripcion:
                '',


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
          String(
            empresaForm
              .get(
                'empresaId'
              )
              ?.value
            ||
            ''
          );

      }


      // ======================================================
      // 3. CREAR PERFIL RECLUTADOR
      // ======================================================

      await setDoc(

        doc(
          this.firestore,
          'reclutadores',
          uid
        ),

        {

          // Se mantiene "nombre" para compatibilidad
          // con el Home actual.

          nombre:
            nombreCompleto,

          nombres:
            nombre,

          apellido:
            apellido,

          nombreCompleto:
            nombreCompleto,

          email:
            email,

          telefono:
            telefono,

          cargoEmpresa:
            cargoEmpresa,

          linkedin:
            linkedin,

          cvBase64:
            cvBase64,

          cvNombre:
            cvNombre,

          descripcionProfesional:
            descripcionProfesional,

          rol:
            'reclutador',

          empresaId:
            idEmpresaFinal,

          // Todo reclutador nuevo debe ser aprobado
          // por el administrador.

          estado:
            'pendiente',

          fechaCreacion:
            new Date()

        }

      );


      // ======================================================
      // 4. MENSAJE
      // ======================================================

      const toast =
        await this
          .toastController
          .create({

            message:
              'Registro exitoso. Tu cuenta quedó pendiente de aprobación.',

            duration:
              4000,

            color:
              'warning',

            position:
              'top'

          });


      await toast.present();


      // El reclutador puede entrar al Home,
      // pero Home bloqueará la publicación
      // mientras estado !== "aprobado".

      await this.router.navigate(
        [
          '/home'
        ]
      );


    } catch (
      error: any
    ) {

      console.error(
        'Error durante el registro:',
        error
      );


      let mensajeError =
        'Ocurrió un error en el registro.';


      if (
        error?.code ===
        'auth/email-already-in-use'
      ) {

        mensajeError =
          'Este correo ya está registrado.';


      } else if (
        error?.code ===
        'auth/invalid-email'
      ) {

        mensajeError =
          'El correo electrónico no es válido.';


      } else if (
        error?.code ===
        'auth/weak-password'
      ) {

        mensajeError =
          'La contraseña no cumple los requisitos mínimos.';

      }


      await this.mostrarError(
        mensajeError
      );


    } finally {

      this.isLoading =
        false;

    }
  }


  // ============================================================
  // TOAST ERROR
  // ============================================================

  async mostrarError(
    mensaje: string
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
            'danger',

          position:
            'top'

        });


    await toast.present();
  }

}