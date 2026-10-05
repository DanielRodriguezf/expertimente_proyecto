import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonSpinner,
  IonModal,
  IonTitle,
  IonButtons,
  ToastController,
  AlertController
} from '@ionic/angular';

import { addIcons } from 'ionicons';

import {
  briefcaseOutline,
  addOutline,
  logOutOutline,
  createOutline,
  trashOutline,
  powerOutline,
  locationOutline,
  mailOutline,
  callOutline,
  peopleOutline,
  closeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  personOutline,
  documentTextOutline,
  schoolOutline,
  timeOutline,
  starOutline,
  lockClosedOutline
} from 'ionicons/icons';

import {
  Auth,
  signOut,
  onAuthStateChanged,
  User,
  Unsubscribe
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  updateDoc,
  getDocs,
  addDoc
} from '@angular/fire/firestore';


export interface OfertaTrabajo {

  id: string;

  titulo: string;

  descripcion: string;

  modalidad: string;

  cargoId?: string;

  cargoNombre?: string;

  formularioId?: string;

  areaLaboral?: string;

  direccion?: string;

  habilidades?: string;

  contactoEmail: string;

  contactoTelefono?: string;

  estado:
    | 'Activa'
    | 'Inactiva';

  fechaPublicacion?: any;

  reclutadorId?: string;
}


export interface RespuestaCuestionario {

  preguntaId: string;

  preguntaTexto: string;

  tipo:
    | 'texto'
    | 'seleccion';

  respuesta: string;

  puntajeObtenido?: number;
}


export interface PostulanteCompleto {

  postulacionId: string;

  postulanteId: string;

  fechaPostulacion?: any;

  estado:
    | 'Pendiente'
    | 'Aceptado'
    | 'Rechazado';

  nombres: string;

  apellidos: string;

  correo: string;

  telefono: string;

  fotoPerfil?: string;

  puntajeInoeidad?: number;

  areaLaboral?: string;

  cargoId?: string;

  cargoNombre?: string;

  ofertaTitulo?: string;

  respuestas?: RespuestaCuestionario[];

  cvManual?: {

    nivelEducativo?: string;

    areaExperiencia?: string;

    anosExperiencia?:
      number | string;

    habilidades?: string;
  };

  cvBase64?: string;
}


@Component({

  selector:
    'app-home',

  templateUrl:
    './home.page.html',

  styleUrls: [
    './home.page.scss'
  ],

  standalone:
    true,

  imports: [

    CommonModule,

    IonContent,

    IonHeader,

    IonToolbar,

    IonButton,

    IonIcon,

    IonSpinner,

    IonModal,

    IonTitle,

    IonButtons
  ]

})
export class HomePage
implements OnInit, OnDestroy {


  private auth =
    inject(Auth);


  private firestore =
    inject(Firestore);


  private router =
    inject(Router);


  private toastController =
    inject(
      ToastController
    );


  private alertController =
    inject(
      AlertController
    );


  private cdr =
    inject(
      ChangeDetectorRef
    );


  private ngZone =
    inject(
      NgZone
    );


  nombreReclutador =
    '';


  nombreEmpresa =
    '';


  estadoReclutador:
    'aprobado'
    |
    'pendiente'
    =
    'pendiente';


  isLoading =
    true;


  ofertas:
    OfertaTrabajo[] =
    [];


  // ============================================================
  // MODAL POSTULANTES
  // ============================================================

  isModalPostulantesOpen =
    false;


  cargandoPostulantes =
    false;


  ofertaSeleccionada:
    OfertaTrabajo | null =
    null;


  postulantesList:
    PostulanteCompleto[] =
    [];


  // ============================================================
  // MODAL RESPUESTAS CUESTIONARIO
  // ============================================================

  isModalRespuestasOpen =
    false;


  postulanteRespuestasSeleccionado:
    PostulanteCompleto | null =
    null;


  // ============================================================
  // SUSCRIPCIONES
  // ============================================================

  private authUnsubscribe?:
    Unsubscribe;


  private snapshotUnsubscribe?:
    Unsubscribe;


  // ============================================================
  // EMPRESAS ANTIGUAS / MOCK
  // ============================================================

  private empresasMockMap: {

    [key: string]:
      string;

  } = {

    emp_001:
      'Tech Corp Chile',

    emp_002:
      'Innovación Global S.A.',

    emp_003:
      'Desarrollos Rápidos'

  };


  // ============================================================
  // GETTERS
  // ============================================================

  get primerNombre():
    string {

    if (

      !this.nombreReclutador
      ||
      this.nombreReclutador
        .toLowerCase()
        ===
        'reclutador'

    ) {

      const email =
        this.auth
          .currentUser
          ?.email;


      if (
        email
      ) {

        const handle =
          email
            .split(
              '@'
            )[0];


        return (

          handle
            .charAt(0)
            .toUpperCase()

          +

          handle
            .slice(1)

        );
      }


      return 'Usuario';
    }


    return this
      .nombreReclutador
      .trim()
      .split(' ')[0];
  }


  get totalOfertasActivas():
    number {

    return this
      .ofertas
      .filter(

        oferta =>
          oferta.estado ===
          'Activa'

      )
      .length;
  }


  get puedePublicarOfertas():
    boolean {

    return (

      this.estadoReclutador ===
      'aprobado'

    );
  }


  get top3Postulantes():
    PostulanteCompleto[] {

    return this
      .postulantesList
      .filter(

        postulante =>

          typeof postulante
            .puntajeInoeidad ===
            'number'

          &&

          Number.isFinite(
            postulante
              .puntajeInoeidad
          )

      )
      .slice(
        0,
        3
      );
  }


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor() {

    addIcons({

      'briefcase-outline':
        briefcaseOutline,

      'add-outline':
        addOutline,

      'log-out-outline':
        logOutOutline,

      'create-outline':
        createOutline,

      'trash-outline':
        trashOutline,

      'power-outline':
        powerOutline,

      'location-outline':
        locationOutline,

      'mail-outline':
        mailOutline,

      'call-outline':
        callOutline,

      'people-outline':
        peopleOutline,

      'close-outline':
        closeOutline,

      'checkmark-circle-outline':
        checkmarkCircleOutline,

      'close-circle-outline':
        closeCircleOutline,

      'person-outline':
        personOutline,

      'document-text-outline':
        documentTextOutline,

      'school-outline':
        schoolOutline,

      'time-outline':
        timeOutline,

      'star-outline':
        starOutline,

      'lock-closed-outline':
        lockClosedOutline

    });
  }


  // ============================================================
  // CICLO DE VIDA
  // ============================================================

  ngOnInit() {

    this
      .iniciarObservadorAuth();
  }


  ionViewWillEnter() {

    const user =
      this.auth
        .currentUser;


    if (
      user
    ) {

      this.cargarTodo(
        user
      );

    } else {

      this
        .iniciarObservadorAuth();
    }
  }


  ionViewWillLeave() {

    this
      .limpiarSuscripcionOfertas();
  }


  ngOnDestroy() {

    if (
      this.authUnsubscribe
    ) {

      this
        .authUnsubscribe();
    }


    this
      .limpiarSuscripcionOfertas();
  }


  // ============================================================
  // SUSCRIPCIONES
  // ============================================================

  private limpiarSuscripcionOfertas() {

    if (
      this.snapshotUnsubscribe
    ) {

      this
        .snapshotUnsubscribe();


      this.snapshotUnsubscribe =
        undefined;
    }
  }


  private iniciarObservadorAuth() {

    if (
      this.authUnsubscribe
    ) {

      return;
    }


    this.authUnsubscribe =
      onAuthStateChanged(

        this.auth,

        (
          user:
            User | null
        ) => {

          if (
            user
          ) {

            this.cargarTodo(
              user
            );

          } else {

            this.ngZone.run(
              () => {

                this.router.navigate(
                  [
                    '/auth/login'
                  ]
                );

              }
            );
          }
        }
      );
  }


  // ============================================================
  // CARGA GENERAL
  // ============================================================

  private async cargarTodo(
    user:
      User
  ) {

    this.ngZone.run(
      () => {

        this.isLoading =
          true;


        this.cdr
          .detectChanges();

      }
    );


    await this
      .cargarPerfilReclutador(
        user
      );


    this
      .escucharOfertasReales(
        user.uid
      );
  }


  // ============================================================
  // PERFIL RECLUTADOR
  // ============================================================

  async cargarPerfilReclutador(
    user:
      User
  ) {

    this.estadoReclutador =
      'pendiente';


    try {

      const docRef =
        doc(

          this.firestore,

          'reclutadores',

          user.uid

        );


      const docSnap =
        await getDoc(
          docRef
        );


      let nombreEncontrado =
        '';


      let empresaEncontrada =
        '';


      if (
        docSnap.exists()
      ) {

        const data =
          docSnap.data();


        // ======================================================
        // ESTADO RECLUTADOR
        // ======================================================

        const estadoBD =
          data[
            'estado'
          ];


        const estadoNormalizado =
          String(
            estadoBD ??
            ''
          )
            .trim()
            .toLowerCase();


        this.estadoReclutador =

          estadoNormalizado ===
          'aprobado'

            ? 'aprobado'

            : 'pendiente';


        if (

          estadoBD ===
            undefined

          ||

          estadoBD ===
            null

          ||

          String(
            estadoBD
          )
            .trim() ===
            ''

        ) {

          await updateDoc(

            docRef,

            {
              estado:
                'Pendiente'
            }

          );
        }


        nombreEncontrado =

          data[
            'nombre'
          ]

          ||

          data[
            'nombreCompleto'
          ]

          ||

          data[
            'nombreReclutador'
          ]

          ||

          '';


        const empId =
          data[
            'empresaId'
          ];


        if (
          empId
        ) {

          if (
            this
              .empresasMockMap[
                empId
              ]
          ) {

            empresaEncontrada =
              this
                .empresasMockMap[
                  empId
                ];

          } else {

            const empRef =
              doc(

                this.firestore,

                'empresas',

                empId

              );


            const empSnap =
              await getDoc(
                empRef
              );


            if (
              empSnap.exists()
            ) {

              empresaEncontrada =

                empSnap
                  .data()[
                    'nombre'
                  ]

                ||

                '';

            }
          }
        }
      }


      if (
        !nombreEncontrado
      ) {

        nombreEncontrado =

          user.displayName

          ||

          user.email
            ?.split('@')[0]

          ||

          'Usuario';
      }


      this.ngZone.run(
        () => {

          this.nombreReclutador =
            nombreEncontrado;


          this.nombreEmpresa =
            empresaEncontrada;


          this.cdr
            .detectChanges();

        }
      );


    } catch (
      error
    ) {

      console.error(
        'Error al cargar datos del perfil:',
        error
      );


      this.estadoReclutador =
        'pendiente';
    }
  }


  // ============================================================
  // OFERTAS
  // ============================================================

  escucharOfertasReales(
    reclutadorUid:
      string
  ) {

    this
      .limpiarSuscripcionOfertas();


    const q =
      query(

        collection(
          this.firestore,
          'ofertas'
        ),

        where(

          'reclutadorId',

          '==',

          reclutadorUid

        )

      );


    this.snapshotUnsubscribe =
      onSnapshot(

        q,

        snapshot => {

          this.ngZone.run(
            () => {

              this.ofertas =
                snapshot.docs.map(

                  documento => {

                    const data =
                      documento.data();


                    return {

                      id:
                        documento.id,


                      titulo:
                        data[
                          'titulo'
                        ]
                        ||
                        '',


                      descripcion:
                        data[
                          'descripcion'
                        ]
                        ||
                        '',


                      modalidad:
                        data[
                          'modalidad'
                        ]
                        ||
                        '',


                      cargoId:
                        data[
                          'cargoId'
                        ]
                        ||
                        '',


                      cargoNombre:
                        data[
                          'cargoNombre'
                        ]
                        ||
                        '',


                      formularioId:
                        data[
                          'formularioId'
                        ]
                        ||
                        '',


                      areaLaboral:
                        data[
                          'areaLaboral'
                        ]
                        ||
                        '',


                      direccion:
                        data[
                          'direccion'
                        ]
                        ||
                        '',


                      habilidades:
                        data[
                          'habilidades'
                        ]
                        ||
                        '',


                      contactoEmail:
                        data[
                          'contactoEmail'
                        ]
                        ||
                        '',


                      contactoTelefono:
                        data[
                          'contactoTelefono'
                        ]
                        ||
                        '',


                      estado:

                        data[
                          'estado'
                        ] ===
                        'Inactiva'

                          ? 'Inactiva'

                          : 'Activa',


                      fechaPublicacion:
                        data[
                          'fechaPublicacion'
                        ],


                      reclutadorId:
                        data[
                          'reclutadorId'
                        ]

                    };

                  }

                );


              this.isLoading =
                false;


              this.cdr
                .detectChanges();

            }
          );

        },

        error => {

          console.error(
            'Error al escuchar cambios en ofertas:',
            error
          );


          this.ngZone.run(
            () => {

              this.isLoading =
                false;


              this.cdr
                .detectChanges();

            }
          );

        }

      );
  }


  // ============================================================
  // POSTULANTES
  // ============================================================

  async verPostulantes(
    oferta:
      OfertaTrabajo
  ) {

    this.ofertaSeleccionada =
      oferta;


    this.isModalPostulantesOpen =
      true;


    this.cargandoPostulantes =
      true;


    this.postulantesList =
      [];


    this.cdr
      .detectChanges();


    try {

      const postulacionesRef =
        collection(
          this.firestore,
          'postulaciones'
        );


      const q =
        query(

          postulacionesRef,

          where(

            'ofertaId',

            '==',

            oferta.id

          )

        );


      const querySnapshot =
        await getDocs(
          q
        );


      const tempPostulantes:
        PostulanteCompleto[] =
        [];


      for (

        const postulacionDoc
        of querySnapshot.docs

      ) {

        const dataPostulacion =
          postulacionDoc
            .data();


        const postulanteId =
          dataPostulacion[
            'postulanteId'
          ];


        // ======================================================
        // PUNTAJE
        // ======================================================
        // Se aceptan ambas variantes porque actualmente
        // existen documentos con "puntajeIdoneidad".
        // ======================================================

        const puntajeRaw =

          dataPostulacion[
            'puntajeInoeidad'
          ]

          ??

          dataPostulacion[
            'puntajeIdoneidad'
          ];


        const puntajeInoeidad =

          puntajeRaw !==
            undefined

          &&

          puntajeRaw !==
            null

          &&

          !Number.isNaN(
            Number(
              puntajeRaw
            )
          )

            ? Number(
                puntajeRaw
              )

            : undefined;


        if (
          postulanteId
        ) {

          const userDocRef =
            doc(

              this.firestore,

              `postulantes/${postulanteId}`

            );


          const userDocSnap =
            await getDoc(
              userDocRef
            );


          if (
            userDocSnap.exists()
          ) {

            const userData =
              userDocSnap.data();


            const apellidos =

              userData[
                'apellidos'
              ]

              ||

              [

                userData[
                  'apellidoPaterno'
                ],

                userData[
                  'apellidoMaterno'
                ]

              ]
                .filter(
                  Boolean
                )
                .join(
                  ' '
                );


            const fotoPerfil =

              userData[
                'fotoPerfil'
              ]

              ||

              '';


            // ====================================================
            // ESTADO REAL DE LA POSTULACIÓN
            // ====================================================
            //
            // Firebase actualmente guarda:
            //
            // estado: "Enviada"
            //
            // Para la vista Recruiter:
            //
            // Enviada   -> Pendiente
            // Pendiente -> Pendiente
            // Aceptado  -> Aceptado
            // Rechazado -> Rechazado
            //
            // ====================================================

            const estadoFirestore =
              String(

                dataPostulacion[
                  'estado'
                ]

                ??

                ''

              )
                .trim()
                .toLowerCase();


            let estadoVista:
              | 'Pendiente'
              | 'Aceptado'
              | 'Rechazado'
              =
              'Pendiente';


            if (
              estadoFirestore ===
              'aceptado'
            ) {

              estadoVista =
                'Aceptado';


            } else if (
              estadoFirestore ===
              'rechazado'
            ) {

              estadoVista =
                'Rechazado';

            }


            // ====================================================
            // CREAR CANDIDATO
            // ====================================================

            tempPostulantes.push({

              postulacionId:
                postulacionDoc.id,


              postulanteId:
                postulanteId,


              fechaPostulacion:
                dataPostulacion[
                  'fechaPostulacion'
                ],


              estado:
                estadoVista,


              puntajeInoeidad:
                puntajeInoeidad,


              areaLaboral:

                dataPostulacion[
                  'areaLaboral'
                ]

                ||

                oferta.areaLaboral

                ||

                '',


              cargoId:

                dataPostulacion[
                  'cargoId'
                ]

                ||

                oferta.cargoId

                ||

                '',


              cargoNombre:

                dataPostulacion[
                  'cargoNombre'
                ]

                ||

                oferta.cargoNombre

                ||

                '',


              ofertaTitulo:

                dataPostulacion[
                  'tituloOferta'
                ]

                ||

                oferta.titulo

                ||

                '',


              // =================================================
              // RESPUESTAS DEL CUESTIONARIO
              // =================================================
              //
              // La APP actualmente guarda:
              //
              // respuestasDetalle
              //
              // Se mantiene "respuestas" como fallback
              // por compatibilidad futura/antigua.
              //
              // =================================================

              respuestas:
                this
                  .normalizarRespuestasCuestionario(

                    dataPostulacion[
                      'respuestasDetalle'
                    ]

                    ??

                    dataPostulacion[
                      'respuestas'
                    ]

                  ),


              nombres:

                userData[
                  'nombres'
                ]

                ||

                userData[
                  'nombre'
                ]

                ||

                'Candidato',


              apellidos:
                apellidos,


              fotoPerfil:
                fotoPerfil,


              correo:

                userData[
                  'correo'
                ]

                ||

                userData[
                  'email'
                ]

                ||

                'Sin correo',


              telefono:

                userData[
                  'telefono'
                ]

                ||

                userData[
                  'celular'
                ]

                ||

                '',


              cvManual:

                userData[
                  'cvManual'
                ]

                ||

                undefined,


              cvBase64:

                userData[
                  'cvBase64'
                ]

                ||

                undefined

            });

          }
        }
      }


      // ========================================================
      // ORDENAR POR PUNTAJE
      // ========================================================

      tempPostulantes.sort(

        (
          a,
          b
        ) => {

          const puntajeA =

            typeof a
              .puntajeInoeidad ===
              'number'

              ? a.puntajeInoeidad

              : -1;


          const puntajeB =

            typeof b
              .puntajeInoeidad ===
              'number'

              ? b.puntajeInoeidad

              : -1;


          return (
            puntajeB -
            puntajeA
          );
        }

      );


      this.ngZone.run(
        () => {

          this.postulantesList =
            tempPostulantes;


          this.cargandoPostulantes =
            false;


          this.cdr
            .detectChanges();

        }
      );


    } catch (
      error
    ) {

      console.error(
        'Error al cargar postulantes:',
        error
      );


      this.ngZone.run(
        () => {

          this.cargandoPostulantes =
            false;


          this.cdr
            .detectChanges();

        }
      );
    }
  }


  // ============================================================
  // VER DATOS DESDE RANKING
  // ============================================================

  verDatosPostulanteRanking(
    candidato:
      PostulanteCompleto
  ) {

    setTimeout(
      () => {

        const elemento =
          document.getElementById(

            `postulante-${candidato.postulacionId}`

          );


        if (
          !elemento
        ) {

          this.mostrarToast(
            'No fue posible localizar la ficha del candidato.'
          );


          return;
        }


        elemento.scrollIntoView({

          behavior:
            'smooth',

          block:
            'center'

        });


        elemento.classList.add(
          'postulante-destacado'
        );


        setTimeout(
          () => {

            elemento
              .classList
              .remove(
                'postulante-destacado'
              );

          },
          2500
        );

      },
      100
    );
  }


  // ============================================================
  // CAMBIAR ESTADO POSTULANTE
  // ============================================================

  async cambiarEstadoPostulante(

    p:
      PostulanteCompleto,

    nuevoEstado:
      | 'Aceptado'
      | 'Rechazado'

  ) {

    try {

      p.estado =
        nuevoEstado;


      if (
        p.postulacionId
      ) {

        await updateDoc(

          doc(

            this.firestore,

            'postulaciones',

            p.postulacionId

          ),

          {

            estado:
              nuevoEstado

          }

        );
      }


      const tituloOferta =

        this
          .ofertaSeleccionada
          ?.titulo

        ||

        'Oferta de empleo';


      const ofertaId =

        this
          .ofertaSeleccionada
          ?.id

        ||

        '';


      const nombreEmpresa =

        this.nombreEmpresa

        ||

        'La Empresa';


      // ======================================================
      // ACEPTADO
      // ======================================================

      if (
        nuevoEstado ===
        'Aceptado'
      ) {

        await addDoc(

          collection(

            this.firestore,

            'notificaciones'

          ),

          {

            postulanteId:
              p.postulanteId,


            ofertaId:
              ofertaId,


            tituloOferta:
              tituloOferta,


            nombreEmpresa:
              nombreEmpresa,


            mensaje:
              `¡Felicidades ${p.nombres}! Has sido aceptado para el puesto de "${tituloOferta}". Se pondrán en contacto contigo.`,


            fecha:
              new Date(),


            leido:
              false,


            tipo:
              'seleccionado'

          }

        );
      }


      // ======================================================
      // RECHAZADO
      // ======================================================

      if (
        nuevoEstado ===
        'Rechazado'
      ) {

        await addDoc(

          collection(

            this.firestore,

            'notificaciones'

          ),

          {

            postulanteId:
              p.postulanteId,


            ofertaId:
              ofertaId,


            tituloOferta:
              tituloOferta,


            nombreEmpresa:
              nombreEmpresa,


            mensaje:
              `Hola ${p.nombres}. Tu postulación para "${tituloOferta}" ha sido revisada. En esta oportunidad no continuarás en el proceso de selección. Te invitamos a seguir revisando nuevas oportunidades en ExpertiMente.`,


            fecha:
              new Date(),


            leido:
              false,


            tipo:
              'rechazado'

          }

        );
      }


      const mensajeToast =

        nuevoEstado ===
        'Aceptado'

          ? `Candidato ${p.nombres} aceptado y notificación enviada.`

          : `Candidato ${p.nombres} rechazado y notificación enviada.`;


      this.mostrarToast(
        mensajeToast
      );


      this.ngZone.run(
        () => {

          this.cdr
            .detectChanges();

        }
      );


    } catch (
      error
    ) {

      console.error(
        'Error al actualizar estado o enviar notificación:',
        error
      );


      this.mostrarToast(
        'Error al procesar la solicitud.'
      );
    }
  }


  // ============================================================
  // RESPUESTAS DEL CUESTIONARIO
  // ============================================================

  private normalizarRespuestasCuestionario(
    respuestasRaw:
      any
  ):
    RespuestaCuestionario[] {

    if (

      respuestasRaw ===
        undefined

      ||

      respuestasRaw ===
        null

    ) {

      return [];
    }


    const listaRespuestas:
      any[] =

      Array.isArray(
        respuestasRaw
      )

        ? respuestasRaw

        : typeof respuestasRaw ===
          'object'

          ? Object.values(
              respuestasRaw
            )

          : [];


    return listaRespuestas.map(

      (
        item:
          any,

        index:
          number
      ) => {

        const tipoNormalizado =
          String(

            item?.tipo

            ??

            ''

          )
            .trim()
            .toLowerCase();


        const respuestaRaw =
          item?.respuesta;


        let respuestaTexto =
          '';


        let puntajeObtenido:
          number | undefined;


        // ======================================================
        // PUNTAJE EXPLÍCITO
        // ======================================================
        //
        // Si más adelante la APP guarda:
        //
        // puntajeObtenido: 25
        //
        // lo usamos directamente.
        //
        // ======================================================

        const puntajeExplicito =

          item?.puntajeObtenido

          ??

          item?.puntaje;


        if (

          puntajeExplicito !==
            undefined

          &&

          puntajeExplicito !==
            null

          &&

          !Number.isNaN(
            Number(
              puntajeExplicito
            )
          )

        ) {

          puntajeObtenido =
            Number(
              puntajeExplicito
            );

        }


        // ======================================================
        // RESPUESTA DE SELECCIÓN
        // ======================================================
        //
        // Actualmente Firestore guarda, por ejemplo:
        //
        // respuesta: 25
        // tipo: "seleccion"
        //
        // En ese caso 25 representa el valor/puntaje
        // guardado por la APP.
        //
        // ======================================================

        if (
          tipoNormalizado ===
          'seleccion'
        ) {

          if (
            typeof respuestaRaw ===
            'number'
          ) {

            respuestaTexto =
              `${respuestaRaw} puntos`;


            if (
              puntajeObtenido ===
              undefined
            ) {

              puntajeObtenido =
                respuestaRaw;
            }


          } else if (

            respuestaRaw !==
              undefined

            &&

            respuestaRaw !==
              null

          ) {

            respuestaTexto =
              String(
                respuestaRaw
              );


          } else {

            respuestaTexto =
              '';
          }


        } else {

          // ====================================================
          // RESPUESTA ESCRITA
          // ====================================================
          //
          // Firebase guarda directamente:
          //
          // respuesta: "Me manejo más en Transbank"
          //
          // ====================================================

          respuestaTexto =
            String(

              respuestaRaw

              ??

              item?.respuestaTexto

              ??

              item?.valor

              ??

              ''

            );

        }


        return {

          preguntaId:
            String(

              item?.preguntaId

              ??

              item?.id

              ??

              `pregunta-${index + 1}`

            ),


          preguntaTexto:
            String(

              item?.preguntaTexto

              ??

              item?.pregunta

              ??

              item?.texto

              ??

              `Pregunta ${index + 1}`

            ),


          tipo:

            tipoNormalizado ===
            'seleccion'

              ? 'seleccion'

              : 'texto',


          respuesta:
            respuestaTexto,


          puntajeObtenido:
            puntajeObtenido

        };

      }

    );
  }


  verRespuestasCuestionario(
    postulante:
      PostulanteCompleto
  ) {

    this.postulanteRespuestasSeleccionado =
      postulante;


    this.isModalRespuestasOpen =
      true;


    this.cdr
      .detectChanges();
  }


  cerrarModalRespuestas() {

    this.isModalRespuestasOpen =
      false;


    this.postulanteRespuestasSeleccionado =
      null;


    this.cdr
      .detectChanges();
  }


  // ============================================================
  // VER CV
  // ============================================================

  verCV(
    cvBase64:
      string
  ) {

    if (
      cvBase64
    ) {

      const ventana =
        window.open();


      ventana
        ?.document
        .write(`

          <body
            style="
              margin:0;
              padding:0;
              background-color:#ffffff;
            "
          >

            <iframe
              width="100%"
              height="100%"
              style="border:none;"
              src="${cvBase64}">
            </iframe>

          </body>

        `);


    } else {

      this.mostrarToast(
        'Este postulante no adjuntó archivo PDF.'
      );
    }
  }


  // ============================================================
  // MODALES
  // ============================================================

  cerrarModalPostulantes() {

    this.isModalRespuestasOpen =
      false;


    this.postulanteRespuestasSeleccionado =
      null;


    this.isModalPostulantesOpen =
      false;


    this.ofertaSeleccionada =
      null;


    this.postulantesList =
      [];
  }


  // ============================================================
  // SCROLL
  // ============================================================

  scrollAOfertas() {

    const elemento =
      document.getElementById(
        'seccion-ofertas'
      );


    if (
      elemento
    ) {

      elemento.scrollIntoView({

        behavior:
          'smooth'

      });
    }
  }


  // ============================================================
  // CREAR OFERTA
  // ============================================================

  crearOferta() {

    if (
      !this.puedePublicarOfertas
    ) {

      return;
    }


    this.router.navigate(
      [
        '/crear-oferta'
      ]
    );
  }


  // ============================================================
  // EDITAR OFERTA
  // ============================================================

  editarOferta(
    ofertaId:
      string
  ) {

    this.router.navigate(
      [

        '/crear-oferta',

        ofertaId

      ]
    );
  }


  // ============================================================
  // ACTIVAR / DESACTIVAR
  // ============================================================

  async cambiarEstadoOferta(
    oferta:
      OfertaTrabajo
  ) {

    const nuevoEstado =

      oferta.estado ===
      'Activa'

        ? 'Inactiva'

        : 'Activa';


    try {

      await updateDoc(

        doc(

          this.firestore,

          'ofertas',

          oferta.id

        ),

        {

          estado:
            nuevoEstado

        }

      );


      this.mostrarToast(

        `Oferta marcada como ${nuevoEstado.toLowerCase()}.`

      );


    } catch (
      error
    ) {

      console.error(
        'Error al cambiar estado:',
        error
      );
    }
  }


  // ============================================================
  // ELIMINAR
  // ============================================================

  async confirmarEliminarOferta(
    ofertaId:
      string
  ) {

    const alert =
      await this
        .alertController
        .create({

          header:
            'Eliminar oferta',


          message:
            '¿Estás seguro de que deseas eliminar esta oferta? Esta acción no se puede deshacer.',


          buttons: [

            {

              text:
                'Cancelar',

              role:
                'cancel'

            },

            {

              text:
                'Eliminar',

              role:
                'destructive',

              handler:
                async () => {

                  try {

                    await deleteDoc(

                      doc(

                        this.firestore,

                        'ofertas',

                        ofertaId

                      )

                    );


                    this.mostrarToast(
                      'Oferta eliminada correctamente.'
                    );


                  } catch (
                    error
                  ) {

                    console.error(
                      'Error al eliminar oferta:',
                      error
                    );

                  }
                }

            }

          ]

        });


    await alert
      .present();
  }


  // ============================================================
  // CERRAR SESIÓN
  // ============================================================

  async cerrarSesion() {

    try {

      this
        .limpiarSuscripcionOfertas();


      if (
        this.authUnsubscribe
      ) {

        this
          .authUnsubscribe();


        this.authUnsubscribe =
          undefined;
      }


      await signOut(
        this.auth
      );


      this.ngZone.run(
        () => {

          this.router
            .navigate(
              [
                '/login'
              ]
            )
            .catch(
              () => {

                this.router
                  .navigate(
                    [
                      '/auth/login'
                    ]
                  )
                  .catch(
                    () => {

                      window.location.href =
                        '/login';

                    }
                  );

              }
            );

        }
      );


    } catch (
      error
    ) {

      console.error(
        'Error al cerrar sesión:',
        error
      );


      window.location.href =
        '/login';
    }
  }


  // ============================================================
  // TOAST
  // ============================================================

  private async mostrarToast(
    mensaje:
      string
  ) {

    const toast =
      await this
        .toastController
        .create({

          message:
            mensaje,


          duration:
            2500,


          position:
            'top'

        });


    await toast
      .present();
  }

}