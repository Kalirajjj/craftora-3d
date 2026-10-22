import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OfferService } from '../../services/offer.service';
import { Offer } from '../../models/offer.model';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {
  cartService = inject(CartService);
  private offerService = inject(OfferService);

  couponInput: string = '';
  availableOffers: Offer[] = [];

  ngOnInit(): void {
    this.offerService.getActiveOffers().subscribe(offers => {
      this.availableOffers = offers || [];
    });
  }

  increase(productId: string | number, color: string): void {
    this.cartService.updateQuantity(productId, color, 1);
  }

  decrease(productId: string | number, color: string): void {
    this.cartService.updateQuantity(productId, color, -1);
  }

  remove(productId: string | number, color: string): void {
    this.cartService.removeFromCart(productId, color);
  }

  applyCoupon(code?: string): void {
    const codeToApply = code || this.couponInput;
    if (!codeToApply || !codeToApply.trim()) return;
    this.couponInput = codeToApply.trim().toUpperCase();
    this.cartService.applyCoupon(this.couponInput);
  }

  removeCoupon(): void {
    this.cartService.removeCoupon();
    this.couponInput = '';
  }
}