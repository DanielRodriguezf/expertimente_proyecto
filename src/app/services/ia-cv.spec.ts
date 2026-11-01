import { TestBed } from '@angular/core/testing';

import { IaCv } from './ia-cv';

describe('IaCv', () => {
  let service: IaCv;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IaCv);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
