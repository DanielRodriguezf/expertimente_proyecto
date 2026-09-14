import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    title: 'Home - ExpertiMente' // <-- Agregar el título de pestaña aqui
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
<<<<<<< HEAD
  {
    path: 'hola',
    loadComponent: () => import('./pages/hola/hola.page').then( m => m.HolaPage)
  },
=======
>>>>>>> 8730e012b52730b3c5493bd2430124ab6db109e5
];
