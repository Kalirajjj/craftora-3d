import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../../../services/admin-auth.service';

@Component({ selector: 'app-admin-login', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.component.html', styleUrls: ['./admin-login.component.css'] })
export class AdminLoginComponent {
  private auth = inject(AdminAuthService);
  private router = inject(Router);
  username = ''; password = ''; isBusy = false; errorMessage = '';
  showPassword = false;

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }

  signIn(): void {
    this.isBusy = true; this.errorMessage = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => { this.isBusy = false; this.router.navigate(['/admin/dashboard']); },
      error: () => { this.isBusy = false; this.errorMessage = 'The username or password is incorrect.'; }
    });
  }
}
