import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { 
  IonApp, 
  IonRouterOutlet, 
  IonMenu, 
  IonContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonIcon,
  IonFooter,
  MenuController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  homeOutline, 
  documentTextOutline, 
  searchOutline, 
  personOutline, 
  logOutOutline,
  lockClosedOutline,
  briefcaseOutline,
  chevronForwardOutline // <-- Añadido para el botón de completar
} from 'ionicons/icons';

import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    IonApp, 
    IonRouterOutlet, 
    IonMenu, 
    IonContent, 
    IonList, 
    IonItem, 
    IonLabel, 
    IonIcon,
    IonFooter
  ],
})
export class AppComponent implements OnInit { 
  
  appPages = [
    { title: 'Inicio', url: '/home', icon: 'home-outline', requiereDatos: false },
    { title: 'Mis Datos Personales', url: '/perfil', icon: 'person-outline', requiereDatos: false },
    { title: 'Mi Currículum / Perfil', url: '/perfil-cv', icon: 'document-text-outline', requiereDatos: true },
    { title: 'Buscar ofertas', url: '/search', icon: 'search-outline', requiereDatos: true },
    { title: 'Mis Postulaciones', url: '/mis-postulaciones', icon: 'briefcase-outline', requiereDatos: true },
  ];

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private menuCtrl = inject(MenuController);
  private cdr = inject(ChangeDetectorRef); 
  private toastCtrl = inject(ToastController);

  usuarioData: any = null;
  sesionActiva: boolean = false; 
  progresoPerfil: number = 0; // <-- Nueva variable para el porcentaje

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'document-text-outline': documentTextOutline,
      'search-outline': searchOutline,
      'person-outline': personOutline,
      'log-out-outline': logOutOutline,
      'lock-closed-outline': lockClosedOutline,
      'briefcase-outline': briefcaseOutline,
      'chevron-forward-outline': chevronForwardOutline
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(this.firestore, `postulantes/${user.uid}`);
          
          onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
              this.sesionActiva = true; 
              this.usuarioData = docSnap.data(); 
              this.calcularProgreso(this.usuarioData); // <-- Calculamos progreso en tiempo real
              this.cdr.detectChanges(); 
            } else {
              console.warn('Usuario fantasma detectado (sin BD). Expulsando...');
              await signOut(this.auth); 
              this.sesionActiva = false;
              this.usuarioData = null;
              this.router.navigate(['/login']); 
            }
          });
          
        } catch (error) {
          console.error('Error al obtener datos para el menú:', error);
        }
      } else {
        this.sesionActiva = false; 
        this.usuarioData = null;
        this.cdr.detectChanges();
      }
    });
  }

  // --- NUEVA FUNCIÓN DE CÁLCULO ---
  calcularProgreso(data: any) {
    if (!data) return;
    const cv = data['cvManual'] || {};
    let completados = 0;
    
    if (cv.nivelEducativo) completados++;
    if (cv.areaExperiencia) completados++;
    if (cv.anosExperiencia !== null && cv.anosExperiencia !== undefined) completados++;
    if (cv.habilidades) completados++;
    if (data['fotoPerfil']) completados++;
    if (data['cvBase64']) completados++;

    this.progresoPerfil = completados / 6;
  }

  tieneDatosCompletos(): boolean {
    return this.usuarioData && this.usuarioData.telefono ? true : false;
  }

  async seleccionarOpcion(pagina: any) {
    if (pagina.requiereDatos && !this.tieneDatosCompletos()) {
      const toast = await this.toastCtrl.create({
        message: 'Debes completar tus Datos Personales primero para acceder aquí.',
        duration: 3500,
        color: 'warning',
        position: 'bottom',
        icon: 'lock-closed-outline'
      });
      await toast.present();
      return; 
    }

    await this.menuCtrl.close(); 
    this.router.navigateByUrl(pagina.url); 
  }

  // Permite al usuario tocar la barra e ir directo a llenar su CV
  async irACompletarPerfil() {
    await this.menuCtrl.close();
    this.router.navigate(['/perfil-cv']);
  }

  async cerrarSesion() {
    try {
      await signOut(this.auth); 
      await this.menuCtrl.close(); 
      this.router.navigateByUrl('/login'); 
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}