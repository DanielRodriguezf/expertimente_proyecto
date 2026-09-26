import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    title: 'Home - ExpertiMente'
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage),
    title: 'Login - ExpertiMente'
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro.page').then( m => m.RegistroPage),
    title: 'Registro - ExpertiMente'
  },
  {
    path: 'crear-oferta',
    loadComponent: () => import('./pages/crear-oferta/crear-oferta.page').then( m => m.CrearOfertaPage)
  },
  {
    path: 'crear-oferta/:id',
    loadComponent: () => import('./pages/crear-oferta/crear-oferta.page').then( m => m.CrearOfertaPage)
  },
  {
    path: 'crear-cuestionario',
    loadComponent: () => import('./pages/crear-cuestionario/crear-cuestionario.page').then( m => m.CrearCuestionarioPage),
    title: 'Crear Cuestionario - ExpertiMente'
  }
];