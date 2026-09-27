import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';

export const customerGuard: CanActivateFn = () => {
  const auth = inject(CustomerAuthService);
  return auth.isSignedIn() || inject(Router).parseUrl('/account/login');
};
