import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {
  cartService = inject(CartService);

  increase(productId: string | number, color: string): void {
    this.cartService.updateQuantity(productId, color, 1);
  }

  decrease(productId: string | number, color: string): void {
    this.cartService.updateQuantity(productId, color, -1);
  }

  remove(productId: string | number, color: string): void {
    this.cartService.removeFromCart(productId, color);
  }
}