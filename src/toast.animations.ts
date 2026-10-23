
import { AnimationController } from '@ionic/angular';

export function toastEnterAnimation(
  animationCtrl: AnimationController,
  baseEl: HTMLElement
) {
  const wrapper = baseEl.shadowRoot?.querySelector('.toast-wrapper');

  return animationCtrl
    .create()
    .addElement(wrapper ?? baseEl)
    .duration(350)
    .easing('cubic-bezier(0.2, 0.8, 0.2, 1)')
    .fromTo('opacity', '0', '1')
    .fromTo('transform', 'translateY(-120%)', 'translateY(0)');
}

export function toastLeaveAnimation(
  animationCtrl: AnimationController,
  baseEl: HTMLElement
) {
  const wrapper = baseEl.shadowRoot?.querySelector('.toast-wrapper');

  return animationCtrl
    .create()
    .addElement(wrapper ?? baseEl)
    .duration(250)
    .easing('ease-in')
    .fromTo('opacity', '1', '0')
    .fromTo('transform', 'translateY(0)', 'translateY(-120%)');
}
