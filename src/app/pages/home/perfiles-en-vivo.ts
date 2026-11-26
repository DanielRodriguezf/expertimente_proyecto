import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';

/** Comparte una escucha por postulante dentro de una lista o ranking. */
export class PerfilesEnVivo {
  private escuchas = new Map<string, () => void>();
  readonly datos = new Map<string, Record<string, any> | null>();

  constructor(private firestore: Firestore, private actualizar: () => void) {}

  sincronizar(ids: Iterable<string>): void {
    const actuales = new Set(ids);
    for (const [id, cancelar] of this.escuchas) {
      if (!actuales.has(id)) {
        cancelar();
        this.escuchas.delete(id);
        this.datos.delete(id);
      }
    }
    for (const id of actuales) {
      if (this.escuchas.has(id)) continue;
      const recibir = (datos: Record<string, any> | null) => {
        this.datos.set(id, datos);
        this.actualizar();
      };
      const cancelar = onSnapshot(doc(this.firestore, 'postulantes', id),
        snapshot => recibir(snapshot.data() ?? null),
        error => {
          console.error('No fue posible leer un perfil del listado.', error);
          recibir(null);
        });
      this.escuchas.set(id, cancelar);
    }
  }

  cerrar(): void {
    this.sincronizar([]);
  }
}