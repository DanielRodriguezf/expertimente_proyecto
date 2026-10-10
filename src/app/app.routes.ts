import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { publicGuard } from './guards/public-guard'; 

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    title: 'Inicio - ExpertiMente',
    canActivate: [authGuard] 
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage),
    title: 'Login - ExpertiMente',
    canActivate: [publicGuard] // <-- 2. Protegemos el login de usuarios ya logueados
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then( m => m.RegisterPage),
    title: 'Registro - ExpertiMente',
    canActivate: [publicGuard] // <-- 3. Protegemos el registro
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'perfil-cv',
    loadComponent: () => import('./pages/perfil-cv/perfil-cv.page').then( m => m.PerfilCvPage),
    title: 'CV - ExpertiMente',
    canActivate: [authGuard] 
  },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/perfil/perfil.page').then( m => m.PerfilPage),
    title: 'Perfil - ExpertiMente',
    canActivate: [authGuard] 
  },
  {
    path: 'perfil-editar',
    loadComponent: () => import('./pages/perfil-editar/perfil-editar.page').then( m => m.PerfilEditarPage),
    title: 'Editar Perfil - ExpertiMente',
    canActivate: [authGuard] 
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.page').then( m => m.SearchPage),
    title: 'Buscar Ofertas - ExpertiMente',
    canActivate: [authGuard] 
  },
  {
    path: 'oferta-detalle/:id',
    loadComponent: () => import('./pages/oferta-detalle/oferta-detalle.page').then(m => m.OfertaDetallePage),
    title: 'Detalle Oferta - ExpertiMente',
    canActivate: [authGuard] 
  },
  {
    path: 'mis-postulaciones',
    loadComponent: () => import('./pages/mis-postulaciones/mis-postulaciones.page').then( m => m.MisPostulacionesPage),
    title: 'Mis Postulaciones - ExpertiMente', 
    canActivate: [authGuard] 
  },
  {
    path: 'cuestionario/:id',
    loadComponent: () => import('./pages/cuestionario/cuestionario.page').then( m => m.CuestionarioPage),
    title: 'Cuestionario - ExpertiMente', 
    canActivate: [authGuard] 
  },
  {
    path: 'cv',
    loadComponent: () => import('./pages-info/cv/cv.page').then( m => m.CvPage),
    title: 'Curriculum - ExpertiMente', 
    canActivate: [authGuard] 
  },
  {
    path: 'foto-perfil',
    loadComponent: () => import('./pages-info/foto-perfil/foto-perfil.page').then( m => m.FotoPerfilPage),
    title: 'Foto - ExpertiMente', 
    canActivate: [authGuard] 
  },
  {
    path: 'usuario-info',
    loadComponent: () => import('./pages-info/usuario-info/usuario-info.page').then( m => m.UsuarioInfoPage),
    title: 'Información - ExpertiMente', 
    canActivate: [authGuard] 
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.page').then( m => m.ForgotPasswordPage),
    title: 'Contraseña - ExpertiMente',
  }
];