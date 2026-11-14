import { CanDeactivateFn } from '@angular/router';
 
export interface PuedeSalirDelRegistro {
  prepararSalida(): Promise<boolean>;
}

export const salirDelRegistroGuard: CanDeactivateFn<PuedeSalirDelRegistro> = (pagina: PuedeSalirDelRegistro) => pagina.prepararSalida();