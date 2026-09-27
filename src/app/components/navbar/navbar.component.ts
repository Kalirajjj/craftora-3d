import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { ThemeService } from '../../services/theme.service';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  private host = inject(ElementRef<HTMLElement>);
  cartService = inject(CartService);
  themeService = inject(ThemeService);
  customerAuth = inject(CustomerAuthService);
  isMobileMenuOpen = false;
  isUtilityMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  toggleUtilityMenu(): void { this.isUtilityMenuOpen = !this.isUtilityMenuOpen; }
  closeUtilityMenu(): void { this.isUtilityMenuOpen = false; }

  @HostListener('document:click', ['$event'])
  closeUtilityMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.closeUtilityMenu();
  }
}
