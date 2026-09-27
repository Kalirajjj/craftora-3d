import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { CartService } from '../../services/cart.service';

type AccessMode = 'login' | 'register' | 'verify' | 'forgot-password' | 'reset-password';

@Component({
  selector: 'app-account-access', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './account-access.component.html', styleUrls: ['./account.component.css', './account-access.component.css']
})
export class AccountAccessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(CustomerAuthService);
  private readonly cart = inject(CartService);
  mode: AccessMode = (this.route.snapshot.paramMap.get('mode') as AccessMode) || 'login';
  get actionToken(): string { return this.route.snapshot.queryParamMap.get('token') || ''; }
  fullName = ''; email = ''; phone = ''; password = ''; confirmPassword = '';
  showPassword = false; showConfirmPassword = false;
  isBusy = false; message = ''; error = '';

  constructor() {
    this.route.paramMap.subscribe(params => {
      const mode = params.get('mode') as AccessMode;
      if (['login', 'register', 'verify', 'forgot-password', 'reset-password'].includes(mode)) this.mode = mode;
      this.message = ''; this.error = '';
    });
  }

  submit(): void {
    this.message = ''; this.error = '';
    if (this.mode === 'reset-password' && this.password !== this.confirmPassword) { this.error = 'Passwords do not match.'; return; }
    this.isBusy = true;
    let request;
    switch (this.mode) {
      case 'register': request = this.auth.register({ email: this.email, password: this.password, fullName: this.fullName, phone: this.phone }); break;
      case 'verify': request = this.auth.verify(this.actionToken); break;
      case 'forgot-password': request = this.auth.forgotPassword(this.email); break;
      case 'reset-password': request = this.auth.resetPassword(this.actionToken, this.password); break;
      default:
        this.auth.login(this.email, this.password).subscribe({
          next: () => {
            this.isBusy = false;
            this.cart.loadAndMergeSavedCart();
            const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
            const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/account';
            void this.router.navigateByUrl(destination);
          },
          error: error => { this.isBusy = false; this.error = error?.status === 401 ? 'Invalid email or password. Please check your credentials and try again.' : this.errorText(error); }
        }); return;
    }
    request.subscribe({
      next: response => { this.isBusy = false; this.message = response.message; },
      error: error => {
        this.isBusy = false;
        if (this.mode === 'register' && error?.status === 409) {
          this.error = 'An account with this email already exists. Sign in if it’s yours, or resend the verification email below.';
        } else if (this.mode === 'verify' && error?.status === 400) {
          this.error = 'This verification link has already been used or has expired. Your email may already be verified—try signing in. If it is not verified yet, return to sign in and request a new verification email.';
        } else {
          this.error = this.errorText(error);
        }
      }
    });
  }

  resendVerification(): void {
    if (!this.email.trim()) { this.error = 'Enter your email address first.'; return; }
    this.isBusy = true; this.error = ''; this.message = '';
    this.auth.resendVerification(this.email).subscribe({
      next: response => { this.isBusy = false; this.message = response.message; },
      error: error => { this.isBusy = false; this.error = this.errorText(error); }
    });
  }

  private errorText(error: any): string { return error?.error?.detail || error?.error?.message || 'We could not complete that request. Please try again.'; }
}
