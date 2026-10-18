import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';

// --- NUEVA INTERFAZ INDEPENDIENTE PARA EMPRESAS ---
export interface Empresa {
  id: string;
  nombre: string;
  rut: string;
  rutNormalizado?: string;
  rubro: string;
  email: string;
  comuna?: string;
  region?: string;
  direccion?: string;
  descripcion?: string;
  sitioWeb?: string;
  tamanoEmpresa?: string;
  telefono?: string;
  fechaCreacion?: string;
  creadoPor?: string;
}

// --- INTERFAZ DE RECLUTADORES ---
export interface ReclutadorConEmpresa {
  id: string;
  nombre: string;
  nombreCompleto?: string;
  nombres?: string;
  apellido?: string;
  email: string;
  telefono?: string;
  rol: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fechaCreacion?: string;
  cargoEmpresa?: string;
  descripcionProfesional?: string;
  linkedin?: string;
  cvNombre?: string;
  cvBase64?: string;
  empresa: Empresa | null;
  empresaId?: string; 
}

// --- INTERFACES AUXILIARES PARA POSTULANTE ---
export interface AreaExperiencia {
  cargo: string;
  descripcion: string;
  lugar: string;
  tiempo: string;
}

export interface CargoInteres {
  cargo: string;
  descripcion: string;
}

// --- INTERFAZ PARA POSTULANTES (Actualizada con todos los campos) ---
export interface Postulante {
  id: string;
  uid?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
  rut: string;
  telefono: string;
  ciudad: string;
  comuna: string;
  direccion?: string;
  pais?: string;
  fechaNacimiento: string;
  estadoCuenta?: string;
  fechaRegistro?: any;
  fechaActualizacionPerfil?: any;
  fotoPerfil?: string;
  cvNombre?: string;
  cvBase64?: string;
  cvManual?: {
    anosExperiencia?: number; 
    areasExperiencia?: AreaExperiencia[]; // Ahora es arreglo de objetos
    cargosInteres?: CargoInteres[]; // Nuevo campo
    carrera?: string; // Nuevo campo
    disponibilidad?: string; // Nuevo campo
    establecimiento?: string; // Nuevo campo
    habilidades?: string;
    habilidadesBlandas?: string;
    habilidadesTecnicas?: string;
    nivelEducativo?: string;
    sinExperiencia?: boolean; // Nuevo campo booleano
  };
}

// --- INTERFACES PARA OFERTAS Y PREGUNTAS ---
export interface OpcionPregunta {
  texto: string;
  puntaje: number;
}

export interface Pregunta {
  id: string;
  texto: string;
  tipo: string;
  requerida: boolean;
  opciones: OpcionPregunta[];
}

export interface Oferta {
  id: string;
  titulo?: string;
  nombreEmpresa?: string;
  empresaId?: string;
  reclutadorId?: string;
  areaLaboral?: string;
  modalidad?: string;
  descripcion?: string;
  direccion?: string;
  habilidades?: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  candidatosCount?: number;
  cargoId?: string; // Nuevo campo
  cargoNombre?: string; // Nuevo campo
  formularioId?: string; // Nuevo campo
  fechaPublicacion?: any; // Ahora lo trae de Firebase
  fechaActualizacion?: any; // Nuevo campo
  estado: string; 
  preguntas?: Pregunta[];
}

// --- INTERFAZ PARA SOLICITUDES DE CARGOS ---
export interface CargoSolicitud {
  id: string;
  nombre: string;
  descripcion: string;
  empresaId: string;
  nombreEmpresa: string;
  reclutadorId: string;
  numeroSolicitud: string;
  fechaSolicitud?: any;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | string;
  preguntas?: Pregunta[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private firestore = inject(Firestore);

  constructor() { }

  // 1. Obtener TODOS los reclutadores y sus empresas
  async getTodosReclutadores(): Promise<ReclutadorConEmpresa[]> {
    const reclutadoresRef = collection(this.firestore, 'reclutadores');
    const snapshot = await getDocs(reclutadoresRef);
    
    const todos: ReclutadorConEmpresa[] = [];

    for (const document of snapshot.docs) {
      const data = document.data();
      const estadoActual = data['estado'] || 'pendiente';
      let datosEmpresa = null;
      
      if (data['empresaId']) {
        const empresaRef = doc(this.firestore, `empresas/${data['empresaId']}`);
        const empresaSnap = await getDoc(empresaRef);
        
        if (empresaSnap.exists()) {
          const empData = empresaSnap.data();
          datosEmpresa = {
            id: empresaSnap.id,
            ...empData
          } as Empresa;
        }
      }

      todos.push({
        id: document.id,
        nombre: data['nombreCompleto'] || data['nombre'],
        nombres: data['nombres'],
        apellido: data['apellido'],
        email: data['email'],
        telefono: data['telefono'],
        rol: data['rol'],
        estado: estadoActual,
        fechaCreacion: data['fechaCreacion'],
        cargoEmpresa: data['cargoEmpresa'],
        descripcionProfesional: data['descripcionProfesional'],
        linkedin: data['linkedin'],
        cvNombre: data['cvNombre'],
        cvBase64: data['cvBase64'],
        empresa: datosEmpresa,
        empresaId: data['empresaId'] 
      });
    }

    return todos;
  }

  // 2. Actualizar estado de Reclutador
  async actualizarEstadoReclutador(reclutadorId: string, nuevoEstado: 'aprobado' | 'rechazado') {
    const reclutadorRef = doc(this.firestore, `reclutadores/${reclutadorId}`);
    await updateDoc(reclutadorRef, { estado: nuevoEstado });
  }

  // 3. Obtener TODOS los Postulantes
  async getPostulantes(): Promise<Postulante[]> {
    const postulantesRef = collection(this.firestore, 'postulantes');
    const snapshot = await getDocs(postulantesRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as Postulante;
    });
  }

  // 4. Eliminar Postulante
  async eliminarPostulante(id: string) {
    const postulanteRef = doc(this.firestore, `postulantes/${id}`);
    await deleteDoc(postulanteRef);
  }

  // 5. Obtener TODAS las Ofertas
  async getTodasOfertas(): Promise<Oferta[]> {
    const ofertasRef = collection(this.firestore, 'ofertas');
    const snapshot = await getDocs(ofertasRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        estado: data['estado'] || 'Activa',
        ...data 
      } as Oferta;
    });
  }

  // 6. Cambiar estado de la Oferta
  async alternarEstadoOferta(ofertaId: string, estadoActual: string) {
    const nuevoEstado = (estadoActual === 'Activa' || estadoActual === 'Pendiente') ? 'Inactiva' : 'Activa';
    const ofertaRef = doc(this.firestore, `ofertas/${ofertaId}`);
    await updateDoc(ofertaRef, { estado: nuevoEstado });
    return nuevoEstado;
  }

  // 7. Eliminar Oferta de la base de datos
  async eliminarOferta(id: string) {
    const ofertaRef = doc(this.firestore, `ofertas/${id}`);
    await deleteDoc(ofertaRef);
  }

  // 8. Eliminar Reclutador y su Empresa vinculada
  async eliminarReclutadorYEmpresa(reclutadorId: string, empresaId?: string) {
    const reclutadorRef = doc(this.firestore, `reclutadores/${reclutadorId}`);
    await deleteDoc(reclutadorRef);

    if (empresaId) {
      const empresaRef = doc(this.firestore, `empresas/${empresaId}`);
      await deleteDoc(empresaRef);
    }
  }

  // 9. Obtener TODAS las solicitudes de Cargos
  async getTodosCargos(): Promise<CargoSolicitud[]> {
    const cargosRef = collection(this.firestore, 'cargos');
    const snapshot = await getDocs(cargosRef);

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        estado: data['estado'] || 'pendiente',
        ...data
      } as CargoSolicitud;
    });
  }

  // 10. Aprobar Cargo guardando las preguntas con sus alternativas y puntajes (3 a 10 preguntas)
  async aprobarCargoConPreguntas(cargoId: string, preguntas: Pregunta[]) {
    const cargoRef = doc(this.firestore, `cargos/${cargoId}`);
    await updateDoc(cargoRef, {
      estado: 'aprobado',
      preguntas: preguntas
    });
  }

  // 11. Rechazar solicitud de Cargo
  async rechazarCargo(cargoId: string) {
    const cargoRef = doc(this.firestore, `cargos/${cargoId}`);
    await updateDoc(cargoRef, {
      estado: 'rechazado'
    });
  }

  // 12. Eliminar solicitud de Cargo
  async eliminarCargo(id: string) {
    const cargoRef = doc(this.firestore, `cargos/${id}`);
    await deleteDoc(cargoRef);
  }
}