import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CalculoIdoneidadService {

  constructor() { }

  calcularIdoneidad(areaBuscada: string, areaPostulante: string | undefined): number {
    if (!areaBuscada || areaBuscada === 'Todas' || !areaPostulante) {
      return 0; 
    }

    const buscarNorm = areaBuscada.trim().toLowerCase();
    const areasPostulanteArr = areaPostulante.split(',').map(a => a.trim().toLowerCase());

    if (areasPostulanteArr.includes(buscarNorm)) {
      return 100; // Asigna el % que consideres apropiado si hay coincidencia
    }
    return 0;
  }
}