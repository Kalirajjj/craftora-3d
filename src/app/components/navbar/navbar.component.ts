import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { ThemeService } from '../../services/theme.service';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  readonly themeService = inject(ThemeService);
  readonly customerAuth = inject(CustomerAuthService);
  readonly adminAuth = inject(AdminAuthService);

  isScrolled = false;
  isMobileMenuOpen = false;
  isUserMenuOpen = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window !== 'undefined') {
      this.isScrolled = window.scrollY > 16;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeUserMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserMenu();
    this.closeMobileMenu();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) {
      this.closeUserMenu();
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  closeAll(): void {
    this.closeUserMenu();
    this.closeMobileMenu();
  }

  getFirstName(): string {
    const fullName = this.customerAuth.customer()?.fullName?.trim();
    if (!fullName) return 'Account';
    const first = fullName.split(' ')[0];
    return first.length > 12 ? first.substring(0, 10) + '...' : first;
  }

  getInitials(): string {
    const fullName = this.customerAuth.customer()?.fullName?.trim();
    if (!fullName) return 'CU';
    const parts = fullName.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  signOut(): void {
    this.customerAuth.logout();
    this.closeAll();
  }
}
