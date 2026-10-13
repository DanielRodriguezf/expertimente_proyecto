import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearOfertaPage } from './crear-oferta.page';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

describe('CrearOfertaPage', () => {
  let component: CrearOfertaPage;
  let fixture: ComponentFixture<CrearOfertaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearOfertaPage],
      providers: [
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { 
          provide: ActivatedRoute, 
          useValue: { snapshot: { paramMap: { get: () => null } } } 
        },
        { provide: ToastController, useValue: { create: () => Promise.resolve({ present: () => {} }) } },
        { provide: Auth, useValue: { currentUser: { uid: 'test-uid', email: 'test@test.com' } } },
        { provide: Firestore, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CrearOfertaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});