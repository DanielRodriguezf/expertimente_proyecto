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

const SEPARACION_TOAST = 16;

function obtenerSafeAreaInferior(): number {
  const sonda = document.createElement('div');
  sonda.style.cssText =
    'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-bottom:var(--ion-safe-area-bottom, 0px);';
  document.body.appendChild(sonda);
  const px = parseFloat(getComputedStyle(sonda).paddingBottom) || 0;
  sonda.remove();
  return px;
}

function obtenerWrapper(baseEl: HTMLElement): Element {
  return baseEl.shadowRoot?.querySelector('.toast-wrapper') ?? baseEl;
}

// Respeta a quienes tienen desactivadas las animaciones en el celular
function movimientoReducido(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    provideIonicAngular({
      mode: 'md',

      // ENTRADA: sube desde abajo de la pantalla, pasa un poquito de largo
      // y se asienta flotando POR ENCIMA de la barra de navegación.
      toastEnter: (baseEl: HTMLElement) => {
        const y = SEPARACION_TOAST + obtenerSafeAreaInferior();
        const posFinal = `translateY(${-y}px)`;

        const animacion = createAnimation()
          .addElement(obtenerWrapper(baseEl))
          .afterStyles({ transform: posFinal, opacity: '1' });

        if (movimientoReducido()) {
          return animacion
            .duration(150)
            .fromTo('transform', posFinal, posFinal)
            .fromTo('opacity', '0', '1');
        }

        return animacion
          .duration(450)
          .easing('cubic-bezier(0.22, 1, 0.36, 1)')
          .keyframes([
            { offset: 0,    opacity: '0', transform: 'translateY(120%) scale(0.92)' },
            { offset: 0.65, opacity: '1', transform: `translateY(${-y - 6}px) scale(1.01)` },
            { offset: 1,    opacity: '1', transform: `${posFinal} scale(1)` }
          ]);
      },

      // SALIDA: baja suavemente y se esconde hacia abajo de la pantalla.
      toastLeave: (baseEl: HTMLElement) => {
        const y = SEPARACION_TOAST + obtenerSafeAreaInferior();

        const animacion = createAnimation().addElement(obtenerWrapper(baseEl));

        if (movimientoReducido()) {
          return animacion.duration(150).fromTo('opacity', '1', '0');
        }

        return animacion
          .duration(300)
          .easing('cubic-bezier(0.4, 0, 1, 1)')
          .fromTo('transform', `translateY(${-y}px) scale(1)`, 'translateY(120%) scale(0.94)')
          .fromTo('opacity', '1', '0');
      }
    }),

    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ],
});