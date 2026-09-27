import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { CustomerInfo, Order } from '../../models/order.model';
import { CustomerAddress, CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  cartService = inject(CartService);
  private orderService = inject(OrderService);
  private customerAuth = inject(CustomerAuthService);
  savedAddresses: CustomerAddress[] = [];
  selectedAddressId: number | null = null;

  customer: CustomerInfo = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: ''
  };

  placedOrder: Order | null = null;

  ngOnInit(): void {
    if (!this.customerAuth.isSignedIn()) return;
    this.customerAuth.getProfile().subscribe(profile => {
      this.customer.fullName = profile.fullName;
      this.customer.email = profile.email;
      this.customer.phone = profile.phone || '';
    });
    this.customerAuth.getAddresses().subscribe(addresses => {
      this.savedAddresses = addresses;
      const defaultAddress = addresses.find(address => address.defaultAddress) || addresses[0];
      if (defaultAddress) this.useSavedAddress(defaultAddress.id);
    });
  }

  useSavedAddress(addressId: number | null): void {
    if (addressId === null) return;
    const address = this.savedAddresses.find(item => item.id === Number(addressId));
    if (!address) return;
    this.selectedAddressId = address.id;
    this.customer.fullName = address.recipientName;
    this.customer.phone = address.phone;
    this.customer.address = [address.addressLine1, address.addressLine2].filter(Boolean).join(', ');
    this.customer.city = address.city;
    this.customer.state = address.state;
    this.customer.pincode = address.pincode;
  }

  placeOrder(): void {
    const orderData: Partial<Order> = {
      items: this.cartService.cartItems(),
      customer: this.customer,
      subtotal: this.cartService.subtotal(),
      deliveryFee: this.cartService.deliveryFee(),
      total: this.cartService.grandTotal()
    };

    this.orderService.createOrder(orderData).subscribe(res => {
      this.placedOrder = res;
      this.cartService.clearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
