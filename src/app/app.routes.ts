import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  
  // --- RUTAS DE AUTENTICACIÓN ---
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/auth/registro/registro.page').then( m => m.RegistroPage)
  },

  // --- RUTAS DE RECLUTADOR ---
  {
    path: 'home', 
    loadComponent: () => import('./pages/reclutador/home/home.page').then( m => m.HomePage)
  },
  {
    path: 'crear-oferta',
    loadComponent: () => import('./pages/reclutador/crear-oferta/crear-oferta.page').then( m => m.CrearOfertaPage)
  },

  // --- RUTAS DE ADMIN ---
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/admin/dashboard/dashboard.page').then( m => m.DashboardPage)
  }
];