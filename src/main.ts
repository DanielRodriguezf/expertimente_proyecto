import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// 1. Importaciones de Firebase
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

// 2. Tus credenciales de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBp-7FozBlNK3hyeV5lU81s7pwl6abowM8",
  authDomain: "expertimente-v1.firebaseapp.com",
  projectId: "expertimente-v1",
  storageBucket: "expertimente-v1.firebasestorage.app",
  messagingSenderId: "1068987662984",
  appId: "1:1068987662984:web:0782b02464121c956c153d",
  measurementId: "G-D0H5MNEYFM"
};

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    
    // 3. Proveedores de Firebase inyectados directamente en el arranque principal
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ],
});