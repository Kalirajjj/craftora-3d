import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerAddress, CustomerAuthService, CustomerProfile } from '../../services/customer-auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-customer-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-account.component.html',
  styleUrls: ['./account.component.css', './customer-account.component.css']
})
export class CustomerAccountComponent implements OnInit {
  readonly auth = inject(CustomerAuthService);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);

  profile: CustomerProfile | null = null;
  addresses: CustomerAddress[] = [];
  quotesCount = 0;

  fullName = '';
  phone = '';
  isSaving = false;
  message = '';
  error = '';

  isAddingAddress = false;
  address = {
    label: 'Home',
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    defaultAddress: false
  };
  addressMessage = '';
  addressError = '';
  isSavingAddress = false;

  ngOnInit(): void {
    forkJoin({
      profile: this.auth.getProfile(),
      addresses: this.auth.getAddresses(),
      quotes: this.auth.getQuotes()
    }).subscribe({
      next: data => {
        this.profile = data.profile;
        this.fullName = data.profile.fullName;
        this.phone = data.profile.phone || '';
        this.addresses = data.addresses;
        this.quotesCount = data.quotes?.length || 0;
      },
      error: () => {
        this.auth.logout();
        void this.router.navigate(['/account/login']);
      }
    });
  }

  getInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getAddressIcon(label: string): string {
    const l = (label || '').toLowerCase();
    if (l.includes('home')) return 'pi-home';
    if (l.includes('work') || l.includes('office')) return 'pi-briefcase';
    return 'pi-map-marker';
  }

  toggleAddAddress(): void {
    this.isAddingAddress = !this.isAddingAddress;
    this.addressMessage = '';
    this.addressError = '';
  }

  cancelAddAddress(): void {
    this.isAddingAddress = false;
    this.addressMessage = '';
    this.addressError = '';
    this.resetAddressForm();
  }

  resetAddressForm(): void {
    this.address = {
      label: 'Home',
      recipientName: this.fullName || '',
      phone: this.phone || '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      defaultAddress: this.addresses.length === 0
    };
  }

  saveAddress(): void {
    this.isSavingAddress = true;
    this.addressMessage = '';
    this.addressError = '';

    this.auth.addAddress(this.address).subscribe({
      next: saved => {
        this.addresses = [
          saved,
          ...this.addresses.map(item => ({
            ...item,
            defaultAddress: saved.defaultAddress ? false : item.defaultAddress
          }))
        ];
        this.isSavingAddress = false;
        this.addressMessage = 'Delivery address saved successfully.';
        this.isAddingAddress = false;
        this.resetAddressForm();
      },
      error: error => {
        this.isSavingAddress = false;
        this.addressError = error?.error?.detail || 'Address could not be saved.';
      }
    });
  }

  removeAddress(address: CustomerAddress): void {
    this.auth.deleteAddress(address.id).subscribe({
      next: () => {
        this.addresses = this.addresses.filter(item => item.id !== address.id);
      },
      error: () => {
        this.addressError = 'Address could not be removed.';
      }
    });
  }

  settingDefaultId: number | null = null;

  setDefaultAddress(address: CustomerAddress): void {
    if (address.defaultAddress || this.settingDefaultId !== null) return;
    this.settingDefaultId = address.id;
    this.addressMessage = '';
    this.addressError = '';

    this.auth.setDefaultAddress(address.id).subscribe({
      next: updatedAddresses => {
        this.addresses = updatedAddresses;
        this.settingDefaultId = null;
        this.addressMessage = `"${address.label}" set as default delivery address.`;
      },
      error: error => {
        this.settingDefaultId = null;
        this.addressError = error?.error?.detail || 'Could not update default address.';
      }
    });
  }

  saveProfile(): void {
    this.isSaving = true;
    this.message = '';
    this.error = '';

    this.auth.updateProfile(this.fullName, this.phone).subscribe({
      next: profile => {
        this.profile = profile;
        this.isSaving = false;
        this.message = 'Your profile has been saved successfully.';
      },
      error: error => {
        this.isSaving = false;
        this.error = error?.error?.detail || 'Profile could not be saved.';
      }
    });
  }

  signOut(): void {
    this.auth.logout();
    void this.router.navigate(['/']);
  }
}
