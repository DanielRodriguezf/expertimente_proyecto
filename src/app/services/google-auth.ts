import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  Auth,
  GoogleAuthProvider,
  User,
  UserCredential,
  deleteUser,
  getAdditionalUserInfo,
  signInWithCredential,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';

export type EstadoPostulante = 'activa' | 'inactiva' | 'nuevo';

export interface PerfilGoogle {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
}

export interface ResultadoGoogle {
  user: User;
  estado: EstadoPostulante;
  perfil: PerfilGoogle;
}

/** Datos que se piden en el registro (sin contraseñas) */
export interface DatosPostulante {
  rut: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  pais: string;
  ciudad: string;
  comuna: string;
  telefono: string;
}

// Palabras que forman parte de un apellido compuesto ("De la Fuente", "Del Río", "San Martín")
const PARTICULAS_APELLIDO = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'san', 'santa', 'da', 'do', 'dos', 'das', 'di', 'van', 'von', 'der', 'mc', 'mac'
]);

/**
 * Separa los apellidos que entrega Google en paterno y materno:
 * - "Gutierrez Venegas"  → paterno "Gutierrez", materno "Venegas"
 * - "De la Fuente Soto"  → paterno "De la Fuente", materno "Soto"
 * - "Pérez"              → paterno "Pérez", materno vacío
 * - 3 o más apellidos    → el primero va como paterno y el resto como materno
 * Es solo una sugerencia: la persona puede corregirla en el formulario.
 */
export function dividirApellidos(apellidos: string): { paterno: string; materno: string } {
  const grupos: string[] = [];
  let actual: string[] = [];

  for (const palabra of apellidos.trim().split(/\s+/).filter(Boolean)) {
    actual.push(palabra);

    // Una partícula ("de", "la", "del"...) se junta con la palabra que viene después
    if (!PARTICULAS_APELLIDO.has(palabra.toLowerCase())) {
      grupos.push(actual.join(' '));
      actual = [];
    }
  }

  // Si el texto termina en una partícula (caso raro), se agrega igual
  if (actual.length > 0) {
    grupos.push(actual.join(' '));
  }

  return {
    paterno: grupos[0] ?? '',
    materno: grupos.slice(1).join(' ')
  };
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  // Se guarda el último perfil de Google para poder pre-llenar el registro después de ir y volver entre pantallas
  private ultimoPerfil: PerfilGoogle | null = null;

  // Es true desde que se abre Google hasta que la persona termina (o abandona) su registro
  private registroEnCurso = false;

  /**
   * app.component lo consulta antes de "expulsar" a un usuario sin documento en `postulantes`:
   * quien se está registrando con Google ya tiene sesión, pero todavía no tiene su ficha.
   */
  get registroGoogleEnCurso(): boolean {
    return this.registroEnCurso;
  }

  /**
   * Abre Google (ventana emergente en el navegador, selector nativo en el celular),
   * deja la sesión iniciada en Firebase y revisa si ya existe su ficha en "postulantes".
   * @param soloLogin Si es `true` (llamado desde Login) y la cuenta no existe en Firestore, cierra la sesión inmediatamente.
   */
  async iniciarConGoogle(soloLogin: boolean = false): Promise<ResultadoGoogle> {
    // Se marca ANTES de abrir Google: apenas se crea la sesión, el vigilante de app.component ya consulta Firestore
    this.registroEnCurso = true;

    try {
      const credencial = Capacitor.isNativePlatform()
        ? await this.autenticarEnCelular()
        : await this.autenticarEnNavegador();

      const perfil = this.armarPerfil(credencial);
      const estado = await this.obtenerEstado(credencial.user.uid);

      // Si intenta entrar desde el LOGIN pero la cuenta NO está registrada en Firestore:
      if (soloLogin && estado === 'nuevo') {
        this.registroEnCurso = false;
        try {
          // Borramos el usuario recién creado en Firebase Auth para no dejar cuentas fantasmas sin Firestore
          await deleteUser(credencial.user);
        } catch {
          // Si por alguna razón falla deleteUser, cerramos la sesión igualmente
        }
        await this.cerrarSesion();
        return { user: credencial.user, estado: 'nuevo', perfil };
      }

      // Solo quien aún no tiene ficha (y viene desde Registro) sigue "en registro"
      this.registroEnCurso = estado === 'nuevo';

      return { user: credencial.user, estado, perfil };

    } catch (error) {
      // Si algo falla (o la persona cancela), no dejamos una sesión abierta a medias
      await this.cerrarSesion().catch(() => undefined);
      throw error;
    }
  }

  /** Navegador (ionic serve / web): popup de Google con el SDK de Firebase */
  private async autenticarEnNavegador(): Promise<UserCredential> {
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(this.auth, proveedor);
  }

  /**
   * Celular (Android con Capacitor):
   * 1. El plugin muestra el selector nativo de cuentas de Google y entrega el token.
   * 2. Con ese token se inicia sesión en el SDK de Firebase JS (el que usa AngularFire),
   *    así Firestore y el resto de la app quedan autenticados igual que con correo y contraseña.
   * Requiere `skipNativeAuth: true` en capacitor.config.ts.
   */
  private async autenticarEnCelular(): Promise<UserCredential> {
    const resultado = await FirebaseAuthentication.signInWithGoogle();
    const idToken = resultado.credential?.idToken;

    if (!idToken) {
      const error: any = new Error('Google no entregó el token de acceso.');
      error.code = 'google/sin-token';
      throw error;
    }

    const credencial = GoogleAuthProvider.credential(idToken, resultado.credential?.accessToken);
    return signInWithCredential(this.auth, credencial);
  }

  private armarPerfil(credencial: UserCredential): PerfilGoogle {
    const datos: Record<string, unknown> = getAdditionalUserInfo(credencial)?.profile ?? {};
    const perfil = this.construirPerfil(credencial.user, datos);

    this.ultimoPerfil = perfil;
    return perfil;
  }

  /**
   * Arma nombre y apellidos con lo que entrega Google (given_name / family_name).
   * Si Google no los entrega por separado, se separa el nombre completo de la cuenta.
   */
  private construirPerfil(user: User, datos: Record<string, unknown> = {}): PerfilGoogle {
    const limpiar = (valor: unknown): string =>
      typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';

    let nombre = limpiar(datos['given_name']);
    let apellidos = limpiar(datos['family_name']);
    const nombreCompleto = limpiar(user.displayName);

    if (!nombre && nombreCompleto) {
      // Google no separó el nombre: la primera palabra es el nombre y el resto los apellidos
      const palabras = nombreCompleto.split(' ');
      nombre = palabras[0] ?? '';
      apellidos = apellidos || palabras.slice(1).join(' ');
    } else if (nombre && !apellidos && nombreCompleto.toLowerCase().startsWith(nombre.toLowerCase())) {
      // Hay nombre pero no apellido: lo que sobra del nombre completo son los apellidos
      apellidos = nombreCompleto.slice(nombre.length).trim();
    }

    const { paterno, materno } = dividirApellidos(apellidos);

    return {
      nombre,
      apellidoPaterno: paterno,
      apellidoMaterno: materno,
      correo: user.email ?? ''
    };
  }

  /** Revisa en Firestore si la persona ya tiene ficha de postulante y en qué estado está */
  async obtenerEstado(uid: string): Promise<EstadoPostulante> {
    const snap = await getDoc(doc(this.firestore, `postulantes/${uid}`));

    if (!snap.exists()) {
      return 'nuevo';
    }

    return snap.data()['estadoCuenta'] === 'inactiva' ? 'inactiva' : 'activa';
  }

  /**
   * Si esta misma sesión de la app abrió Google y la persona aún no termina su registro,
   * devuelve ese usuario para que la pantalla de registro continúe donde quedó.
   */
  async obtenerSesionGooglePendiente(): Promise<{ user: User; perfil: PerfilGoogle } | null> {
    if (!this.registroEnCurso) {
      return null;
    }

    await this.auth.authStateReady();

    const user = this.auth.currentUser;
    const esDeGoogle = !!user && user.providerData.some((p: { providerId: string }) => p.providerId === 'google.com');

    if (!user || !esDeGoogle) {
      return null;
    }

    const estado = await this.obtenerEstado(user.uid);
    if (estado !== 'nuevo') {
      return null;
    }

    const correo = user.email ?? '';
    const perfil = this.ultimoPerfil && this.ultimoPerfil.correo === correo
      ? this.ultimoPerfil
      : this.construirPerfil(user);

    return { user, perfil };
  }

  /** Crea la ficha del postulante con los mismos campos que el registro con correo y contraseña */
  async crearPostulante(user: User, datos: DatosPostulante): Promise<void> {
    await setDoc(doc(this.firestore, `postulantes/${user.uid}`), {
      uid: user.uid,
      rut: datos.rut,
      nombre: datos.nombre,
      apellidoPaterno: datos.apellidoPaterno,
      apellidoMaterno: datos.apellidoMaterno,
      fechaNacimiento: datos.fechaNacimiento,
      pais: datos.pais,
      ciudad: datos.ciudad,
      comuna: datos.comuna,
      correo: user.email ?? '',
      telefono: datos.telefono,
      estadoCuenta: 'activa',
      fechaRegistro: new Date()
    });

    // Ya tiene su documento: deja de ser un registro en curso
    this.registroEnCurso = false;
  }

  /**
   * Abandonar el registro con Google a medias: se borra el usuario recién creado en Firebase Auth
   * (solo si todavía no tiene ficha) y se cierra la sesión, para no dejar cuentas fantasma en Authentication.
   */
  async abandonarRegistroGoogle(): Promise<void> {
    const user = this.auth.currentUser;

    try {
      // Nunca se borra una cuenta que ya tiene ficha en "postulantes"
      if (user && (await this.obtenerEstado(user.uid)) === 'nuevo') {
        await deleteUser(user);
      }
    } catch (error) {
      // Firebase solo deja borrar cuentas con un inicio de sesión reciente (unos 5 minutos):
      // si no se pudo, igual se cierra la sesión
      console.warn('No se pudo borrar el usuario que quedó a medio registrar:', error);
    } finally {
      await this.cerrarSesion().catch(() => undefined);
    }
  }

  async reactivarCuenta(uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, `postulantes/${uid}`), { estadoCuenta: 'activa' });
  }

  /** Cierra la sesión en Firebase y, en el celular, también en el selector nativo de Google */
  async cerrarSesion(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await FirebaseAuthentication.signOut();
        } catch {
          // Si no había sesión nativa abierta no pasa nada
        }
      }
      await signOut(this.auth);
    } finally {
      this.registroEnCurso = false;
    }
  }

  /** Mensaje claro, en español, para mostrar cuando falla el acceso con Google */
  mensajeDeError(error: any): string {
    const codigo = String(error?.code ?? '');
    const detalle = `${codigo} ${String(error?.message ?? '')}`.toLowerCase();

    if (/cancel|closed-by-user|12501/.test(detalle)) {
      return 'No se completó el acceso con Google. Si cerraste la ventana, inténtalo de nuevo.';
    }

    switch (codigo) {
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'No hay conexión a internet. Revísala e inténtalo de nuevo.';
      case 'auth/account-exists-with-different-credential':
        return 'Ese correo ya está registrado con otro método. Ingresa con tu correo y contraseña.';
      case 'auth/user-disabled':
        return 'Esta cuenta fue deshabilitada. Contacta al equipo de ExpertiMente.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
      case 'auth/operation-not-allowed':
        return 'El acceso con Google aún no está habilitado en Firebase.';
      case 'auth/unauthorized-domain':
        return 'Este dominio no está autorizado en Firebase para usar Google.';
      default:
        return 'No pudimos conectar con Google. Inténtalo de nuevo.';
    }
  }
}