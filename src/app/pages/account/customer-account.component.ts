import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerAddress, CustomerAuthService, CustomerProfile } from '../../services/customer-auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-customer-account', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-account.component.html', styleUrls: ['./account.component.css', './customer-account.component.css']
})
export class CustomerAccountComponent implements OnInit {
  private readonly auth = inject(CustomerAuthService);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);
  profile: CustomerProfile | null = null;
  addresses: CustomerAddress[] = [];
  fullName = ''; phone = ''; isSaving = false; message = ''; error = '';
  address = { label: 'Home', recipientName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', defaultAddress: false };
  addressMessage = ''; addressError = ''; isSavingAddress = false;

  ngOnInit(): void {
    forkJoin({ profile: this.auth.getProfile(), addresses: this.auth.getAddresses() }).subscribe({
      next: data => { this.profile = data.profile; this.fullName = data.profile.fullName; this.phone = data.profile.phone || ''; this.addresses = data.addresses; },
      error: () => { this.auth.logout(); void this.router.navigate(['/account/login']); }
    });
  }

  saveAddress(): void {
    this.isSavingAddress = true; this.addressMessage = ''; this.addressError = '';
    this.auth.addAddress(this.address).subscribe({
      next: saved => { this.addresses = [saved, ...this.addresses.map(item => ({ ...item, defaultAddress: saved.defaultAddress ? false : item.defaultAddress }))]; this.isSavingAddress = false; this.addressMessage = 'Delivery address saved.'; this.address = { label: 'Home', recipientName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', defaultAddress: false }; },
      error: error => { this.isSavingAddress = false; this.addressError = error?.error?.detail || 'Address could not be saved.'; }
    });
  }

  removeAddress(address: CustomerAddress): void {
    this.auth.deleteAddress(address.id).subscribe({ next: () => this.addresses = this.addresses.filter(item => item.id !== address.id), error: () => this.addressError = 'Address could not be removed.' });
  }

  saveProfile(): void {
    this.isSaving = true; this.message = ''; this.error = '';
    this.auth.updateProfile(this.fullName, this.phone).subscribe({
      next: profile => { this.profile = profile; this.isSaving = false; this.message = 'Your profile has been saved.'; },
      error: error => { this.isSaving = false; this.error = error?.error?.detail || 'Profile could not be saved.'; }
    });
  }

  signOut(): void { this.auth.logout(); this.cart.clearCart(); void this.router.navigate(['/']); }
}
