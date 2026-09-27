import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; 
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonBackButton, 
  IonButton, 
  IonIcon,
  IonFooter,
  IonCard,
  IonCardContent,
  IonSpinner,
  AlertController // <-- 1. Importamos el controlador de alertas
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  personOutline, 
  createOutline, 
  trashOutline, 
  mailOutline, 
  callOutline, 
  locationOutline, 
  idCardOutline,
  arrowBackOutline
} from 'ionicons/icons';

// <-- 2. Importamos signOut para echarlo de la app al desactivar
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
// <-- 3. Importamos updateDoc para actualizar su estado
import { Firestore, doc, onSnapshot, updateDoc } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    IonContent, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonBackButton, 
    IonButton, 
    IonIcon,
    IonFooter,
    IonCard,
    IonCardContent,
    IonSpinner
  ]
})
export class PerfilPage implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router); 
  private cdr = inject(ChangeDetectorRef); 
  private alertCtrl = inject(AlertController); // <-- 4. Inyectamos AlertController

  usuarioData: any = null;
  cargando: boolean = true;
  usuarioUID: string = ''; // Guardaremos el ID aquí para usarlo al borrar

  constructor() {
    addIcons({
      'person-outline': personOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      'mail-outline': mailOutline,
      'call-outline': callOutline,
      'location-outline': locationOutline,
      'id-card-outline': idCardOutline,
      'arrow-back-outline': arrowBackOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.usuarioUID = user.uid; // Guardamos el ID
        const docRef = doc(this.firestore, `postulantes/${user.uid}`);
        
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            this.usuarioData = docSnap.data();
          }
          this.cargando = false;
          this.cdr.detectChanges(); 
        }, (error) => {
          console.error('Error al escuchar el perfil:', error);
          this.cargando = false;
          this.cdr.detectChanges();
        });
      } else {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  modificarPerfil() {
    this.router.navigate(['/perfil-editar']);
  }

  // --- NUEVA LÓGICA DE ELIMINACIÓN LÓGICA ---
  async borrarCuenta() {
    // Creamos la alerta de confirmación
    const alert = await this.alertCtrl.create({
      header: '¿Desactivar tu cuenta?',
      message: 'Tu perfil quedará inactivo y dejarás de ser visible para las empresas. Podrás reactivarlo simplemente iniciando sesión de nuevo. ¿Estás seguro?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Sí, Desactivar',
          role: 'destructive', // Esto lo pinta de rojo (peligro) en iOS/Android
          handler: async () => {
            await this.ejecutarDesactivacion();
          }
        }
      ]
    });

    await alert.present(); // Mostramos la alerta en pantalla
  }

  // Función privada que hace el trabajo sucio si el usuario dice que sí
  private async ejecutarDesactivacion() {
    if (!this.usuarioUID) return;

    try {
      this.cargando = true; // Mostramos spinner si es muy rápido
      
      const docRef = doc(this.firestore, `postulantes/${this.usuarioUID}`);
      
      // 1. Le ponemos la "etiqueta" de inactiva
      await updateDoc(docRef, {
        estadoCuenta: 'inactiva',
        fechaDesactivacion: new Date().toISOString() // Guardamos cuándo se arrepintió
      });

      console.log('Cuenta marcada como inactiva');

      // 2. Cerramos su sesión en Firebase
      await signOut(this.auth);

      // 3. Lo pateamos al Login
      this.router.navigate(['/login']);

    } catch (error) {
      console.error('Error al desactivar la cuenta:', error);
      alert('Hubo un error. Inténtalo más tarde.');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}