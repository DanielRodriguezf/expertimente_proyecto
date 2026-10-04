import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, doc, getDoc, updateDoc } from '@angular/fire/firestore';

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

// --- INTERFAZ DE RECLUTADORES (Actualizada) ---
export interface ReclutadorConEmpresa {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fechaCreacion?: string;
  empresa: Empresa | null;
}

// --- INTERFAZ PARA POSTULANTES (Con todos los campos de Firebase) ---
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
    anosExperiencia: number;
    areasExperiencia?: string[]; // Ahora es un arreglo
    habilidades?: string;
    habilidadesBlandas?: string;
    habilidadesTecnicas?: string;
    nivelEducativo: string;
  };
}

// --- NUEVAS INTERFACES PARA OFERTAS Y PREGUNTAS ---
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
  fechaPublicacion?: string;
  estado: string; // 'Activa' o 'Inactiva'
  preguntas?: Pregunta[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private firestore = inject(Firestore);

  constructor() { }

  // 1. Obtener TODOS los reclutadores (Aprobados, Rechazados y Pendientes)
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
        nombre: data['nombre'],
        email: data['email'],
        rol: data['rol'],
        estado: estadoActual,
        fechaCreacion: data['fechaCreacion'],
        empresa: datosEmpresa
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

  // 4. Obtener TODAS las Empresas
  async getTodasEmpresas(): Promise<Empresa[]> {
    const empresasRef = collection(this.firestore, 'empresas');
    const snapshot = await getDocs(empresasRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as Empresa;
    });
  }

  // 5. Obtener TODAS las Ofertas
  async getTodasOfertas(): Promise<Oferta[]> {
    const ofertasRef = collection(this.firestore, 'ofertas');
    const snapshot = await getDocs(ofertasRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        estado: data['estado'] || 'Activa', // Por defecto Activa si no tiene estado
        ...data 
      } as Oferta;
    });
  }

  // 6. Cambiar estado de la Oferta (Habilitar/Deshabilitar)
  async alternarEstadoOferta(ofertaId: string, estadoActual: string) {
    const nuevoEstado = (estadoActual === 'Activa' || estadoActual === 'Pendiente') ? 'Inactiva' : 'Activa';
    const ofertaRef = doc(this.firestore, `ofertas/${ofertaId}`);
    await updateDoc(ofertaRef, { estado: nuevoEstado });
    return nuevoEstado;
  }
}