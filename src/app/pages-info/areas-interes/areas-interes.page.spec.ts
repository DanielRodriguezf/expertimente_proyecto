import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AreasInteresPage } from './areas-interes.page';

describe('AreasInteresPage', () => {
  let component: AreasInteresPage;
  let fixture: ComponentFixture<AreasInteresPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AreasInteresPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
