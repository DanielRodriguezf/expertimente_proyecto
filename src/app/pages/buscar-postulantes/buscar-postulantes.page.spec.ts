import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuscarPostulantesPage } from './buscar-postulantes.page';

describe('BuscarPostulantesPage', () => {
  let component: BuscarPostulantesPage;
  let fixture: ComponentFixture<BuscarPostulantesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BuscarPostulantesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
