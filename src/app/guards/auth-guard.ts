import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // authState observa si hay una sesión activa en Firebase
  return authState(auth).pipe(
    take(1), // Toma el estado actual UNA sola vez al intentar entrar a la ruta
    map(user => {
      if (user) {
        // Si 'user' tiene datos, significa que inició sesión. Le damos luz verde.
        return true; 
      } else {
        // Si 'user' es null, no tiene sesión. Lo pateamos al Login.
        console.warn('Acceso denegado: Debes iniciar sesión');
        router.navigate(['/login']);
        return false;
      }
    })
  );
};