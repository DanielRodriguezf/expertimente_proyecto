import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
  IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
  IonSpinner, IonFooter, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
  ToastController, AlertController, ViewWillEnter
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  briefcaseOutline, star, addCircleOutline, addCircle, trashOutline, 
  eyeOutline, checkmarkCircle, searchOutline, timeOutline, 
  clipboardOutline, sparklesOutline, checkmarkDoneCircle, informationCircleOutline,
  closeOutline
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, collection, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-cargos-interes',
  templateUrl: './cargos-interes.page.html',
  styleUrls: ['./cargos-interes.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonCard, IonCardContent, IonIcon, IonButton,
    IonSpinner, IonFooter, IonSearchbar, IonSegment, IonSegmentButton, IonLabel
  ]
})
export class CargosInteresPage implements OnInit, ViewWillEnter {
  
  uid: string = '';
  cargando: boolean = true;
  cargandoCargos: boolean = true;
  guardando: boolean = false;

  vistaActiva: 'catalogo' | 'activos' = 'catalogo';

  mostrarAyudaCatalogo: boolean = true;
  mostrarAyudaActivos: boolean = true;

  cargosDisponibles: any[] = [];
  cargosInteres: any[] = [];
  resultadosMap: { [cargoId: string]: any } = {};
  
  filtroCatalogo: string = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      'briefcase-outline': briefcaseOutline,
      'star': star,
      'add-circle-outline': addCircleOutline,
      'add-circle': addCircle,
      'trash-outline': trashOutline,
      'eye-outline': eyeOutline,
      'checkmark-circle': checkmarkCircle,
      'search-outline': searchOutline,
      'time-outline': timeOutline,
      'clipboard-outline': clipboardOutline,
      'sparkles-outline': sparklesOutline,
      'checkmark-done-circle': checkmarkDoneCircle,
      'information-circle-outline': informationCircleOutline,
      'close-outline': closeOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.uid = user.uid;
        await Promise.all([
          this.cargarCargosAprobados(),
          this.cargarPerfilUsuario()
        ]);
      } else {
        this.cargando = false;
      }
    });
  }

  async ionViewWillEnter() {
    if (this.uid) {
      await this.cargarPerfilUsuario();
    }
  }

  get cargosDisponiblesNoSeleccionados(): any[] {
    return this.cargosDisponibles.filter(disp => 
      !this.cargosInteres.some(sel => sel.id === disp.id || sel.cargo === disp.nombre)
    );
  }

  get cargosCatalogoFiltrados(): any[] {
    const termino = this.filtroCatalogo.trim().toLowerCase();
    if (!termino) return this.cargosDisponiblesNoSeleccionados;

    return this.cargosDisponiblesNoSeleccionados.filter(c => 
      (c.nombre && c.nombre.toLowerCase().includes(termino)) ||
      (c.descripcion && c.descripcion.toLowerCase().includes(termino))
    );
  }

  async cargarCargosAprobados() {
    try {
      this.cargandoCargos = true;
      const cargosRef = collection(this.firestore, 'cargos');
      const q = query(cargosRef, where('estado', '==', 'aprobado'));
      const querySnapshot = await getDocs(q);
      
      this.cargosDisponibles = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
    } catch (error) {
      console.error('Error al cargar cargos disponibles:', error);
      this.mostrarMensaje('Error al cargar el catálogo de cargos', 'danger');
    } finally {
      this.cargandoCargos = false;
      this.cdr.detectChanges();
    }
  }

  async cargarPerfilUsuario() {
    try {
      const docRef = doc(this.firestore, `postulantes/${this.uid}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.cargosInteres = data['cargosInteres'] || data['cvManual']?.['cargosInteres'] || [];
      }

      const mapaTemp: { [cargoId: string]: any } = {};

      const ternaRef = collection(this.firestore, 'postulaciones-terna');
      const qTerna = query(ternaRef, where('postulanteId', '==', this.uid));
      const ternaSnap = await getDocs(qTerna);
      ternaSnap.forEach(d => {
        const data = d.data();
        if (data['cargoId']) mapaTemp[data['cargoId']] = data;
      });

      const resRef = collection(this.firestore, 'resultados');
      const qRes = query(resRef, where('postulanteId', '==', this.uid));
      const resSnap = await getDocs(qRes);
      resSnap.forEach(d => {
        const data = d.data();
        if (data['cargoId']) mapaTemp[data['cargoId']] = data;
      });

      this.resultadosMap = mapaTemp;

    } catch (error) {
      console.error('Error al cargar perfil del usuario:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async agregarCargoDirecto(cargo: any) {
    if (this.guardando) return;

    const yaExiste = this.cargosInteres.some(c => c.id === cargo.id || c.cargo === cargo.nombre);
    if (yaExiste) {
      this.mostrarMensaje('Este cargo ya está en tus intereses.', 'warning');
      return;
    }

    const nuevoItem = {
      id: cargo.id,
      cargo: cargo.nombre,
      descripcion: cargo.descripcion || ''
    };

    const nuevaLista = [...this.cargosInteres, nuevoItem];
    await this.guardarCargosEnFirebase(nuevaLista, `Cargo agregado a tu lista`);
  }

  async confirmarEliminarCargo(index: number, nombreCargo: string) {
    const cargoTarget = this.cargosInteres[index];
    if (cargoTarget && this.resultadosMap[cargoTarget.id]) {
      this.mostrarMensaje('No puedes eliminar un cargo con evaluación completada.', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Quitar Cargo de Interés',
      message: `¿Deseas quitar "${nombreCargo}" de tu lista de cargos de interés?`,
      cssClass: 'alerta-expertimente',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Sí, quitar',
          role: 'destructive',
          handler: () => {
            this.eliminarCargoInteres(index);
          }
        }
      ]
    });
    await alert.present();
  }

  async eliminarCargoInteres(index: number) {
    const cargoTarget = this.cargosInteres[index];
    if (cargoTarget && this.resultadosMap[cargoTarget.id]) {
      return;
    }

    const nuevaLista = [...this.cargosInteres];
    nuevaLista.splice(index, 1);
    await this.guardarCargosEnFirebase(nuevaLista, 'Cargo eliminado de tu lista.');
  }

  async guardarCargosEnFirebase(nuevaLista: any[], mensajeExito: string) {
    this.guardando = true;
    const listaPrevia = [...this.cargosInteres];
    
    this.cargosInteres = nuevaLista;
    this.cdr.detectChanges();

    try {
      const docRef = doc(this.firestore, `postulantes/${this.uid}`);
      await setDoc(docRef, {
        cargosInteres: nuevaLista,
        cvManual: {
          cargosInteres: nuevaLista
        },
        fechaActualizacionPerfil: new Date()
      }, { merge: true });

      this.mostrarMensaje(mensajeExito, 'success');
    } catch (error) {
      this.cargosInteres = listaPrevia;
      console.error('Error al guardar intereses:', error);
      this.mostrarMensaje('Error al actualizar en Firebase.', 'danger');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  verDetallesCargo(cargoId: string) {
    this.router.navigate(['/oferta-detalle', cargoId], {
      queryParams: { tipo: 'terna' }
    });
  }

  async mostrarMensaje(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      cssClass: 'toast-expertimente',
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}