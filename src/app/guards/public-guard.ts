import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

export const publicGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Observamos si hay una sesión activa en Firebase al abrir la app
  return authState(auth).pipe(
    take(1), 
    map(user => {
      if (user) {
        // Si el usuario ya está logueado, evitamos que vea el login y lo mandamos al inicio
        console.log('Sesión detectada: Redirigiendo a Home');
        router.navigate(['/home']);
        return false; // Bloqueamos el acceso a la vista pública
      } else {
        // Si no tiene sesión, le damos luz verde para ver el Login o Registro
        return true; 
      }
    })
  );
};