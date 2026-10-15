import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; 
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonButton, 
  IonIcon,
  IonFooter,
  IonInput,
  IonProgressBar,
  IonSpinner 
} from '@ionic/angular'; 
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline,
  checkmarkCircleOutline 
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-perfil-editar',
  templateUrl: './perfil-editar.page.html',
  styleUrls: ['./perfil-editar.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    IonContent, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonButton, 
    IonIcon,
    IonFooter,
    IonInput,
    IonProgressBar,
    IonSpinner
  ]
})
export class PerfilEditarPage implements OnInit {
  pasoActual: number = 1;
  totalPasos: number = 3;
  cargando: boolean = true;
  guardando: boolean = false;
  usuarioUID: string = ''; 

  usuario = {
    rut: '',
    nombre: '', 
    apellidoPaterno: '', 
    apellidoMaterno: '',
    correo: '',
    telefono: '',
    comuna: '',
    direccion: '',
    pais: '',
    ciudad: ''
  };

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); 

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'checkmark-circle-outline': checkmarkCircleOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioUID = user.uid; 
        
        try {
          const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            this.usuario = {
              rut: data['rut'] || '',
              nombre: data['nombre'] || '',
              apellidoPaterno: data['apellidoPaterno'] || '',
              apellidoMaterno: data['apellidoMaterno'] || '',
              correo: data['correo'] || '', 
              telefono: data['telefono'] || '',
              comuna: data['comuna'] || '',
              direccion: data['direccion'] || '',
              pais: data['pais'] || '',
              ciudad: data['ciudad'] || ''
            };
          }
        } catch (error) {
          console.error('Error al cargar datos del perfil:', error);
        }
      }
      this.cargando = false; 
      this.cdr.detectChanges(); 
    });
  }

  // Refuerzo: Limpiamos la vista cada vez que el usuario entra a la pantalla
  ionViewWillEnter() {
    this.pasoActual = 1;
    this.guardando = false;
    this.cdr.detectChanges();
  }

  siguientePaso() {
    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
    }
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
    }
  }

  async guardarCambios() {
    if (!this.usuarioUID) return; 

    this.guardando = true;
    
    try {
      const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
      
      await updateDoc(docRef, {
        rut: this.usuario.rut,
        nombre: this.usuario.nombre,
        apellidoPaterno: this.usuario.apellidoPaterno,
        apellidoMaterno: this.usuario.apellidoMaterno,
        correo: this.usuario.correo,
        telefono: this.usuario.telefono,
        pais: this.usuario.pais,
        ciudad: this.usuario.ciudad,
        comuna: this.usuario.comuna,
        direccion: this.usuario.direccion
      });

      console.log('¡Datos actualizados con éxito!');
      
      // SOLUCIÓN: Reiniciamos las variables de estado ANTES de cambiar de página
      this.guardando = false;
      this.pasoActual = 1;
      
      this.router.navigate(['/perfil']);
      
    } catch (error) {
      console.error('Error al actualizar el perfil:', error);
      alert('Hubo un error al guardar los cambios.');
      this.guardando = false;
    }
  }
}