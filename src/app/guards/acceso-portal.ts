import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDocFromServer } from '@angular/fire/firestore';

type Panel = '/home' | '/dashboard';

export async function panelAutorizado(
  db: Firestore,
  uid: string
): Promise<Panel | null> {
  const reclutador = await getDocFromServer(doc(db, 'reclutadores', uid));

  if (reclutador.exists()) {
    return reclutador.get('estado') === 'aprobado' ? '/home' : null;
  }

  const usuario = await getDocFromServer(doc(db, 'usuarios', uid));

  return usuario.exists() && usuario.get('rol') === 'admin'
    ? '/dashboard'
    : null;
}

export function soloPanel(panel: Panel): CanActivateFn {
  return async () => {
    const auth = inject(Auth);
    const db = inject(Firestore);
    const router = inject(Router);
    const login = router.parseUrl('/login');

    try {
      await auth.authStateReady();

      const uid = auth.currentUser?.uid;
      if (!uid) return login;

      const destino = await panelAutorizado(db, uid);

      if (!destino || auth.currentUser?.uid !== uid) return login;

      return destino === panel || router.parseUrl(destino);
    } catch {
      return login;
    }
  };
}