import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { unregisterGuard } from './unregister-guard';

describe('unregisterGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => unregisterGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
