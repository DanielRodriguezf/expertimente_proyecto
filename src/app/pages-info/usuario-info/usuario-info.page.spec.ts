import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsuarioInfoPage } from './usuario-info.page';

describe('UsuarioInfoPage', () => {
  let component: UsuarioInfoPage;
  let fixture: ComponentFixture<UsuarioInfoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UsuarioInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
