import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CVPage } from './cv.page';

describe('CVPage', () => {
  let component: CVPage;
  let fixture: ComponentFixture<CVPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CVPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
