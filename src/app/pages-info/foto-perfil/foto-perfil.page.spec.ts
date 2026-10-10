import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FotoPerfilPage } from './foto-perfil.page';

describe('FotoPerfilPage', () => {
  let component: FotoPerfilPage;
  let fixture: ComponentFixture<FotoPerfilPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FotoPerfilPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
