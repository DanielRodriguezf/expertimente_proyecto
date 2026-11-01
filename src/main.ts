import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular, createAnimation } from '@ionic/angular';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBp-7FozBlNK3hyeV5lU81s7pwl6abowM8",
  authDomain: "expertimente-v1.firebaseapp.com",
  projectId: "expertimente-v1",
  storageBucket: "expertimente-v1.firebasestorage.app",
  messagingSenderId: "1068987662984",
  appId: "1:1068987662984:web:0782b02464121c956c153d",
  measurementId: "G-D0H5MNEYFM"
};

// Altura extra hacia arriba donde se detendrá el toast (ajústalo a -40px, -55px o -75px según prefieras)
const ALTURA_TOAST = '-10px';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    provideIonicAngular({
      mode: 'md',
      // Animación de entrada: sube desde abajo (100%) hasta quedar flotando más arriba (ALTURA_TOAST)
      toastEnter: (baseEl: HTMLElement) => {
        const root = baseEl.shadowRoot;
        const wrapper = root?.querySelector('.toast-wrapper') || baseEl;
        return createAnimation()
          .addElement(wrapper)
          .duration(380)
          .easing('cubic-bezier(0.22, 1, 0.36, 1)')
          .fromTo('transform', 'translateY(100%) scale(0.96)', `translateY(${ALTURA_TOAST}) scale(1)`)
          .fromTo('opacity', '0', '1');
      },
      // Animación de salida: baja desde esa misma altura (ALTURA_TOAST) hasta esconderse abajo (100%)
      toastLeave: (baseEl: HTMLElement) => {
        const root = baseEl.shadowRoot;
        const wrapper = root?.querySelector('.toast-wrapper') || baseEl;
        return createAnimation()
          .addElement(wrapper)
          .duration(300)
          .easing('cubic-bezier(0.4, 0, 1, 1)')
          .fromTo('transform', `translateY(${ALTURA_TOAST}) scale(1)`, 'translateY(100%) scale(0.96)')
          .fromTo('opacity', '1', '0');
      }
    }),

    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ],
});