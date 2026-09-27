import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, doc, getDoc, updateDoc } from '@angular/fire/firestore';

// Interfaz combinada para la vista (Actualizada con los nuevos campos de la empresa)
export interface ReclutadorConEmpresa {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fechaCreacion?: string;
  empresa: {
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
  } | null;
}

// --- INTERFAZ PARA POSTULANTES (Actualizada) ---
export interface Postulante {
  id: string;
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
  
  // Foto de perfil en Base64
  fotoPerfil?: string;
  
  // Archivo PDF
  cvNombre?: string;
  cvBase64?: string;
  
  // Datos manuales
  cvManual?: {
    anosExperiencia: number;
    areaExperiencia: string;
    habilidades: string;
    nivelEducativo: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private firestore = inject(Firestore);

  constructor() { }

  // 1. Obtener todos los reclutadores pendientes
  async getReclutadoresPendientes(): Promise<ReclutadorConEmpresa[]> {
    const reclutadoresRef = collection(this.firestore, 'reclutadores');
    const snapshot = await getDocs(reclutadoresRef);
    
    const pendientes: ReclutadorConEmpresa[] = [];

    for (const document of snapshot.docs) {
      const data = document.data();
      // Si no tiene estado definido, o su estado es "pendiente"
      const estadoActual = data['estado'] || 'pendiente';
      
      if (estadoActual === 'pendiente') {
        let datosEmpresa = null;
        
        // Si el reclutador tiene una empresa vinculada, vamos a buscar sus datos
        if (data['empresaId']) {
          const empresaRef = doc(this.firestore, `empresas/${data['empresaId']}`);
          const empresaSnap = await getDoc(empresaRef);
          
          if (empresaSnap.exists()) {
            const empData = empresaSnap.data();
            datosEmpresa = {
              id: empresaSnap.id,
              nombre: empData['nombre'],
              rut: empData['rut'],
              rutNormalizado: empData['rutNormalizado'],
              rubro: empData['rubro'],
              email: empData['email'],
              comuna: empData['comuna'],
              region: empData['region'],
              direccion: empData['direccion'],
              descripcion: empData['descripcion'],
              sitioWeb: empData['sitioWeb'],
              tamanoEmpresa: empData['tamanoEmpresa'],
              telefono: empData['telefono'],
              fechaCreacion: empData['fechaCreacion'],
              creadoPor: empData['creadoPor']
            };
          }
        }

        pendientes.push({
          id: document.id,
          nombre: data['nombre'],
          email: data['email'],
          rol: data['rol'],
          estado: 'pendiente',
          fechaCreacion: data['fechaCreacion'],
          empresa: datosEmpresa
        });
      }
    }

    return pendientes;
  }

  // 2. Actualizar el estado en Firestore
  async actualizarEstadoReclutador(reclutadorId: string, nuevoEstado: 'aprobado' | 'rechazado') {
    const reclutadorRef = doc(this.firestore, `reclutadores/${reclutadorId}`);
    // Usamos updateDoc para agregar o modificar el campo "estado"
    await updateDoc(reclutadorRef, {
      estado: nuevoEstado
    });
  }

  // 3. Obtener TODOS los Postulantes
  async getPostulantes(): Promise<Postulante[]> {
    const postulantesRef = collection(this.firestore, 'postulantes');
    const snapshot = await getDocs(postulantesRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data
      } as Postulante;
    });
  }
}