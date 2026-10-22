import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminUserService, AdminUserItem } from '../../../../services/admin-user.service';
import { AdminAuthService } from '../../../../services/admin-auth.service';

@Component({
  selector: 'app-admin-user-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-user-create.component.html',
  styleUrls: ['./admin-user-create.component.css']
})
export class AdminUserCreateComponent implements OnInit {
  private usersApi = inject(AdminUserService);
  auth = inject(AdminAuthService);

  isBusy = false;
  errorMessage = '';
  successMessage = '';
  showPassword = false;
  showConfirmPassword = false;
  userForm = { username: '', password: '', confirmPassword: '' };

  // Admins List State
  adminUsers: AdminUserItem[] = [];
  isLoadingList = false;
  listErrorMessage = '';
  revealedPasswordIds = new Set<number>();

  // Search & Pagination State (5 rows per page)
  searchQuery = '';
  readonly pageSize = 5;
  currentPage = 1;

  // Edit Modal State
  editingAdmin: AdminUserItem | null = null;
  editForm = { username: '', password: '', confirmPassword: '' };
  isEditBusy = false;
  editErrorMessage = '';
  showEditPassword = false;
  showEditConfirmPassword = false;

  ngOnInit(): void {
    this.loadAdmins();
  }

  loadAdmins(): void {
    this.isLoadingList = true;
    this.listErrorMessage = '';
    this.usersApi.getAll().subscribe({
      next: users => {
        this.isLoadingList = false;
        this.adminUsers = users;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
      },
      error: err => {
        this.isLoadingList = false;
        this.listErrorMessage = err.error?.message || 'Failed to load admin users.';
      }
    });
  }

  get filteredAdmins(): AdminUserItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.adminUsers;
    return this.adminUsers.filter(u => u.username.toLowerCase().includes(q));
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAdmins.length / this.pageSize));
  }

  get paginatedAdmins(): AdminUserItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAdmins.slice(start, start + this.pageSize);
  }

  get startIndex(): number {
    if (this.filteredAdmins.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredAdmins.length);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') this.showPassword = !this.showPassword;
    else this.showConfirmPassword = !this.showConfirmPassword;
  }

  toggleEditPasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') this.showEditPassword = !this.showEditPassword;
    else this.showEditConfirmPassword = !this.showEditConfirmPassword;
  }

  toggleRowPassword(id: number): void {
    if (this.revealedPasswordIds.has(id)) {
      this.revealedPasswordIds.delete(id);
    } else {
      this.revealedPasswordIds.add(id);
    }
  }

  isPasswordVisible(id: number): boolean {
    return this.revealedPasswordIds.has(id);
  }

  create(form: NgForm): void {
    this.errorMessage = '';
    this.successMessage = '';
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
        this.loadAdmins();
      },
      error: err => {
        this.isBusy = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Admin user could not be created.';
      }
    });
  }

  startEdit(admin: AdminUserItem): void {
    this.editingAdmin = admin;
    this.editForm = {
      username: admin.username,
      password: admin.password || '',
      confirmPassword: admin.password || ''
    };
    this.editErrorMessage = '';
    this.showEditPassword = false;
    this.showEditConfirmPassword = false;
  }

  cancelEdit(): void {
    this.editingAdmin = null;
  }

  saveEdit(): void {
    if (!this.editingAdmin) return;
    this.editErrorMessage = '';
    const newUsername = this.editForm.username.trim();
    if (!newUsername || newUsername.length < 3) {
      this.editErrorMessage = 'Username must be at least 3 characters.';
      return;
    }
    const newPassword = this.editForm.password.trim();
    if (newPassword && newPassword.length < 12) {
      this.editErrorMessage = 'Password must be at least 12 characters.';
      return;
    }
    if (newPassword && newPassword !== this.editForm.confirmPassword.trim()) {
      this.editErrorMessage = 'The passwords do not match.';
      return;
    }

    this.isEditBusy = true;
    this.usersApi.update(this.editingAdmin.id, newUsername, newPassword).subscribe({
      next: updated => {
        this.isEditBusy = false;
        this.successMessage = `Admin user "${updated.username}" updated successfully.`;
        this.editingAdmin = null;
        this.loadAdmins();
      },
      error: err => {
        this.isEditBusy = false;
        this.editErrorMessage = err.error?.detail || err.error?.message || 'Could not update admin user.';
      }
    });
  }

  // Delete Modal State
  adminToDelete: AdminUserItem | null = null;
  isDeleting = false;

  openDeleteModal(admin: AdminUserItem): void {
    if (admin.username.toLowerCase() === this.auth.getUsername()?.toLowerCase()) {
      return;
    }
    this.adminToDelete = admin;
  }

  closeDeleteModal(): void {
    if (!this.isDeleting) {
      this.adminToDelete = null;
    }
  }

  confirmDelete(): void {
    if (!this.adminToDelete) return;
    this.isDeleting = true;
    const target = this.adminToDelete;
    this.usersApi.delete(target.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.adminToDelete = null;
        this.successMessage = `Admin user "${target.username}" was deleted.`;
        this.loadAdmins();
      },
      error: err => {
        this.isDeleting = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Could not delete admin user.';
      }
    });
  }

  dismissAlert(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
