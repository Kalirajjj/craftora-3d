import { Component, Input, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../models/product.model';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css']
})
export class ProductCardComponent implements OnDestroy {
  @Input({ required: true }) product!: Product;
  private cartService = inject(CartService);

  isAdded = false;
  private timeoutId?: ReturnType<typeof setTimeout>;

  addToCart(event: MouseEvent): void {
    event.stopPropagation();
    this.cartService.addToCart(this.product, 1);
    this.isAdded = true;

    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.isAdded = false;
    }, 1500);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
  }
}