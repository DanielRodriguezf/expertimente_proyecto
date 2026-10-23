import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerfilCvPage } from './perfil-cv.page';

describe('PerfilCvPage', () => {
  let component: PerfilCvPage;
  let fixture: ComponentFixture<PerfilCvPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PerfilCvPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
