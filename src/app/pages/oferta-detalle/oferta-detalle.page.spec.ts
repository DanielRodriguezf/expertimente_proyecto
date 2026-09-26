import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfertaDetallePage } from './oferta-detalle.page';

describe('OfertaDetallePage', () => {
  let component: OfertaDetallePage;
  let fixture: ComponentFixture<OfertaDetallePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(OfertaDetallePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
