import { Component, OnInit, OnDestroy, ViewChild, inject, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
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
  Platform,
  NavController,
  AlertController,
  ModalController,
  ActionSheetController,
  PopoverController
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { 
  homeOutline, 
  documentTextOutline, 
  searchOutline, 
  personOutline, 
  logOutOutline,
  lockClosedOutline,
  briefcaseOutline,
  chevronForwardOutline,
  ribbonOutline 
} from 'ionicons/icons';

import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, Unsubscribe } from '@angular/fire/firestore'; 
import { GoogleAuthService } from './services/google-auth';

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
export class AppComponent implements OnInit, OnDestroy { 
  @ViewChild(IonRouterOutlet, { static: true }) routerOutlet!: IonRouterOutlet;

  appPages = [
    { title: 'Inicio', url: '/home', icon: 'home-outline', requiereDatos: false },
    { title: 'Mis Datos Personales', url: '/perfil', icon: 'person-outline', requiereDatos: false },
    { title: 'Mi Currículum / Perfil', url: '/perfil-cv', icon: 'document-text-outline', requiereDatos: true },
    { title: 'Buscar ofertas', url: '/search', icon: 'search-outline', requiereDatos: true },
    { title: 'Mis Cargos de Interés', url: '/cargos-interes', icon: 'ribbon-outline', requiereDatos: true },
    { title: 'Mis Postulaciones', url: '/mis-postulaciones', icon: 'briefcase-outline', requiereDatos: true },
  ];

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private menuCtrl = inject(MenuController);
  private cdr = inject(ChangeDetectorRef); 
  private toastCtrl = inject(ToastController);
  private platform = inject(Platform);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);
  private actionSheetCtrl = inject(ActionSheetController);
  private popoverCtrl = inject(PopoverController);
  private googleAuth = inject(GoogleAuthService);

  usuarioData: any = null;
  sesionActiva: boolean = false; 
  esRutaHome: boolean = false; // Controla si estamos exactamente en /home
  progresoPerfil: number = 0;
  
  mostrandoSplash: boolean = true;

  private backButtonSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  private unsubPerfil: Unsubscribe | null = null;

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'document-text-outline': documentTextOutline,
      'search-outline': searchOutline,
      'person-outline': personOutline,
      'log-out-outline': logOutOutline,
      'lock-closed-outline': lockClosedOutline,
      'briefcase-outline': briefcaseOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'ribbon-outline': ribbonOutline
    });
  }

  ngOnInit() {
    this.configurarBotonAtrasGlobal();
    this.monitorearRutaActiva();

    setTimeout(() => {
      this.mostrandoSplash = false;
      this.cdr.detectChanges();
    }, 3500);

    onAuthStateChanged(this.auth, async (user) => {
      if (this.unsubPerfil) {
        this.unsubPerfil();
        this.unsubPerfil = null;
      }

      if (user) {
        try {
          const docRef = doc(this.firestore, `postulantes/${user.uid}`);
          
          this.unsubPerfil = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
              this.sesionActiva = true; 
              this.usuarioData = docSnap.data(); 
              this.calcularProgreso(this.usuarioData); 
              this.actualizarEstadoMenu();
              this.cdr.detectChanges(); 
            } else {
              if (this.googleAuth.registroGoogleEnCurso) {
                return; // se está registrando con Google: todavía no tiene documento
              }
              console.warn('Usuario fantasma detectado (sin BD). Expulsando...');
              await this.googleAuth.cerrarSesion(); 
              this.sesionActiva = false;
              this.usuarioData = null;
              this.actualizarEstadoMenu();
              this.router.navigate(['/login']); 
            }
          });
          
        } catch (error) {
          console.error('Error al obtener datos para el menú:', error);
        }
      } else {
        this.sesionActiva = false; 
        this.usuarioData = null;
        this.actualizarEstadoMenu();
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
    }
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
    if (this.unsubPerfil) {
      this.unsubPerfil();
    }
  }

  private monitorearRutaActiva() {
    // Evaluamos la ruta inicial
    this.verificarSiEsHome(this.router.url);

    // Escuchamos cada cambio de página
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.verificarSiEsHome(event.urlAfterRedirects);
      });
  }

  private verificarSiEsHome(url: string) {
    const rutaLimpia = url.split('?')[0];
    this.esRutaHome = rutaLimpia === '/home';
    this.actualizarEstadoMenu();
  }

  private async actualizarEstadoMenu() {
    const habilitar = this.sesionActiva && this.esRutaHome;
    await this.menuCtrl.enable(habilitar);
    if (!habilitar) {
      await this.menuCtrl.close();
    }
    this.cdr.detectChanges();
  }

  private configurarBotonAtrasGlobal() {
    this.platform.ready().then(() => {
      this.backButtonSub = this.platform.backButton.subscribeWithPriority(5, async () => {
        const menuAbierto = await this.menuCtrl.isOpen();
        if (menuAbierto) {
          await this.menuCtrl.close();
          return;
        }

        const topModal = await this.modalCtrl.getTop();
        if (topModal) {
          await topModal.dismiss();
          return;
        }

        const topAlert = await this.alertCtrl.getTop();
        if (topAlert) {
          await topAlert.dismiss();
          return;
        }

        const topActionSheet = await this.actionSheetCtrl.getTop();
        if (topActionSheet) {
          await topActionSheet.dismiss();
          return;
        }

        const topPopover = await this.popoverCtrl.getTop();
        if (topPopover) {
          await topPopover.dismiss();
          return;
        }

        const urlActual = this.router.url.split('?')[0];
        const rutasRaiz = ['/home', '/login', '/register', '/registro', '/'];

        if (rutasRaiz.includes(urlActual)) {
          return;
        }

        if (this.routerOutlet && this.routerOutlet.canGoBack()) {
          this.navCtrl.pop();
        } else if (this.sesionActiva) {
          this.navCtrl.navigateBack('/home');
        } else {
          this.navCtrl.navigateBack('/login');
        }
      });
    });
  }

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

  async irACompletarPerfil() {
    await this.menuCtrl.close();
    this.router.navigate(['/perfil-cv']);
  }

  async cerrarSesion() {
    try {
      await this.googleAuth.cerrarSesion(); 
      await this.menuCtrl.close(); 
      this.router.navigateByUrl('/login'); 
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}