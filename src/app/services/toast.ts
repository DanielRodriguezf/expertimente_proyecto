import { Injectable, inject } from '@angular/core';
import { ToastController, ToastOptions } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, warning, closeCircle, informationCircle } from 'ionicons/icons';

// Pausa breve entre un toast y el siguiente para que no se sientan pegados
const PAUSA_ENTRE_TOASTS_MS = 150;
const DURACION_POR_DEFECTO_MS = 3000;

/**
 * Servicio global de toasts de ExpertiMente.
 *
 * - Solo se muestra UN toast a la vez.
 * - Si se dispara otro mientras hay uno visible, queda en cola y se muestra
 *   cuando el anterior terminó de desaparecer (incluida su animación de salida).
 * - Aplica por defecto la clase global `toast-expertimente` (global.scss).
 *
 * Ubicación sugerida: src/app/services/toast.ts
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastCtrl = inject(ToastController);

  // Cola de turnos: cada toast se encadena al final de la promesa anterior
  private cola: Promise<void> = Promise.resolve();

  constructor() {
    // Registra los íconos para que funcionen también en el APK
    addIcons({ checkmarkCircle, warning, closeCircle, informationCircle });
  }

  /** Encola un toast con opciones libres (mismas opciones que ToastController.create). */
  mostrar(opciones: ToastOptions): void {
    this.cola = this.cola
      .then(() => this.mostrarYEsperar(opciones))
      // Si un toast falla, la cola sigue funcionando para los siguientes
      .catch((error) => console.error('[ToastService] No se pudo mostrar el toast:', error));
  }

  exito(mensaje: string, opciones: ToastOptions = {}): void {
    this.mostrar({ message: mensaje, color: 'success', icon: 'checkmark-circle', ...opciones });
  }

  advertencia(mensaje: string, opciones: ToastOptions = {}): void {
    this.mostrar({ message: mensaje, color: 'warning', icon: 'warning', ...opciones });
  }

  error(mensaje: string, opciones: ToastOptions = {}): void {
    this.mostrar({ message: mensaje, color: 'danger', icon: 'close-circle', duration: 4500, ...opciones });
  }

  info(mensaje: string, opciones: ToastOptions = {}): void {
    this.mostrar({ message: mensaje, icon: 'information-circle', ...opciones });
  }

  private async mostrarYEsperar(opciones: ToastOptions): Promise<void> {
    // Puente para páginas aún sin migrar: si hay un toast abierto directamente
    // con ToastController, se espera a que se cierre antes de mostrar este.
    const abierto = await this.toastCtrl.getTop();
    if (abierto) {
      await abierto.onDidDismiss();
    }

    const duration = opciones.duration ?? DURACION_POR_DEFECTO_MS;

    const toast = await this.toastCtrl.create({
      position: 'bottom',
      ...opciones,
      duration,
      cssClass: ['toast-expertimente', ...this.comoLista(opciones.cssClass)],
    });

    await toast.present();

    // Seguro: si por algún motivo no se cierra solo, se fuerza el cierre
    // para que la cola nunca quede bloqueada.
    let seguro: ReturnType<typeof setTimeout> | undefined;
    if (duration > 0) {
      seguro = setTimeout(() => toast.dismiss(), duration + 1500);
    }

    // onDidDismiss se resuelve cuando la animación de salida ya terminó
    await toast.onDidDismiss();
    if (seguro) {
      clearTimeout(seguro);
    }

    await new Promise<void>((resolver) => setTimeout(resolver, PAUSA_ENTRE_TOASTS_MS));
  }

  private comoLista(valor?: string | string[]): string[] {
    if (!valor) {
      return [];
    }
    return Array.isArray(valor) ? valor : valor.split(/\s+/).filter(Boolean);
  }
}