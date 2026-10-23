import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MisPostulacionesPage } from './mis-postulaciones.page';

describe('MisPostulacionesPage', () => {
  let component: MisPostulacionesPage;
  let fixture: ComponentFixture<MisPostulacionesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MisPostulacionesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
