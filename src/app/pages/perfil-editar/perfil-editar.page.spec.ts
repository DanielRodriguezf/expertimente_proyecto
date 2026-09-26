import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerfilEditarPage } from './perfil-editar.page';

describe('PerfilEditarPage', () => {
  let component: PerfilEditarPage;
  let fixture: ComponentFixture<PerfilEditarPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PerfilEditarPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
