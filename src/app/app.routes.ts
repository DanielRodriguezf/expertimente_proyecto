import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    title: 'Home - ExpertiMente' // <-- Agregar el título de pestaña aqui
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage),
    title: 'Login - ExpertiMente' // <-- Agregar el título de pestaña aqui
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro.page').then( m => m.RegistroPage),
    title: 'Registro - ExpertiMente' // <-- Agregar el título de pestaña aqui
  },
  {
    path: 'crear-oferta',
    loadComponent: () => import('./pages/crear-oferta/crear-oferta.page').then( m => m.CrearOfertaPage)
  },
];
