import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    title: 'Home - ExpertiMente',
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage),
    title: 'Login - ExpertiMente' 
    // Sin guardián, es acceso público
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then( m => m.RegisterPage),
    title: 'Register - ExpertiMente' 
    // Sin guardián, es acceso público
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
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/perfil/perfil.page').then( m => m.PerfilPage),
    title: 'User - ExpertiMente',
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'perfil-editar',
    loadComponent: () => import('./pages/perfil-editar/perfil-editar.page').then( m => m.PerfilEditarPage),
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.page').then( m => m.SearchPage),
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'oferta-detalle/:id',
    loadComponent: () => import('./pages/oferta-detalle/oferta-detalle.page').then(m => m.OfertaDetallePage),
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'mis-postulaciones',
    loadComponent: () => import('./pages/mis-postulaciones/mis-postulaciones.page').then( m => m.MisPostulacionesPage),
    canActivate: [authGuard] // <-- Ruta protegida
  },
  {
    path: 'cuestionario/:id',
    loadComponent: () => import('./pages/cuestionario/cuestionario.page').then( m => m.CuestionarioPage),
    canActivate: [authGuard] // <-- Ruta protegida
  }
];