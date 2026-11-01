import { TestBed } from '@angular/core/testing';

import { GeneracionCv } from './generacion-cv';

describe('GeneracionCv', () => {
  let service: GeneracionCv;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeneracionCv);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
