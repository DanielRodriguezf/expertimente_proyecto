import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CargosInteresPage } from './cargos-interes.page';

describe('CargosInteresPage', () => {
  let component: CargosInteresPage;
  let fixture: ComponentFixture<CargosInteresPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CargosInteresPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
