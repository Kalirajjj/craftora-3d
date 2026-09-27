import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminUserService } from '../../../../services/admin-user.service';

@Component({
  selector: 'app-admin-user-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-user-create.component.html',
  styleUrls: ['./admin-user-create.component.css']
})
export class AdminUserCreateComponent {
  private usersApi = inject(AdminUserService);
  isBusy = false;
  errorMessage = '';
  successMessage = '';
  showPassword = false;
  showConfirmPassword = false;
  userForm = { username: '', password: '', confirmPassword: '' };

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') this.showPassword = !this.showPassword;
    else this.showConfirmPassword = !this.showConfirmPassword;
  }

  create(form: NgForm): void {
    this.errorMessage = ''; this.successMessage = '';
    if (this.userForm.password.length < 12) {
      this.errorMessage = 'Use a password with at least 12 characters.';
      return;
    }
    if (this.userForm.password !== this.userForm.confirmPassword) {
      this.errorMessage = 'The passwords do not match.';
      return;
    }
    this.isBusy = true;
    this.usersApi.create(this.userForm.username.trim(), this.userForm.password).subscribe({
      next: created => {
        this.isBusy = false;
        this.successMessage = 'Admin user ' + created.username + ' was created.';
        this.userForm = { username: '', password: '', confirmPassword: '' };
        form.resetForm(this.userForm);
      },
      error: err => {
        this.isBusy = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Admin user could not be created.';
      }
    });
  }
}
