import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WishlistService } from '../../services/wishlist.service';
import { CartService } from '../../services/cart.service';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './wishlist.component.html',
  styleUrls: ['./wishlist.component.css']
})
export class WishlistComponent implements OnInit {
  readonly wishlistService = inject(WishlistService);
  readonly customerAuth = inject(CustomerAuthService);
  private cartService = inject(CartService);
  private productService = inject(ProductService);
  private router = inject(Router);

  products: Product[] = [];
  trendingProducts: Product[] = [];
  isLoading = true;
  toastMessage = '';
  showClearModal = false;

  constructor() {
    // When wishlistIds signal changes, refresh loaded products
    effect(() => {
      const ids = this.wishlistService.wishlistIds();
      this.refreshProducts();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.refreshProducts();
    this.loadTrendingProducts();
  }

  refreshProducts(): void {
    this.isLoading = true;
    this.wishlistService.getWishlistProducts().subscribe({
      next: (list) => {
        this.products = list;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadTrendingProducts(): void {
    this.productService.getFeaturedProducts().subscribe(prods => {
      this.trendingProducts = prods.slice(0, 4);
    });
  }

  removeFromWishlist(product: Product, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.wishlistService.remove(product.id);
    this.showToast(`Removed "${product.name}" from your wishlist`);
  }

  moveToCart(product: Product, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.cartService.addToCart(product, 1);
    this.showToast(`Added "${product.name}" to cart!`);
  }

  buyNow(product: Product, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const color = product.availableColors?.[0] || 'Studio Edition';
    if (!this.customerAuth.isSignedIn()) {
      this.cartService.setDirectCheckoutItem(product, 1, color);
      this.router.navigate(['/account/login'], { queryParams: { returnUrl: '/checkout?buyNow=true' } });
      return;
    }
    this.cartService.setDirectCheckoutItem(product, 1, color);
    this.router.navigate(['/checkout'], { queryParams: { buyNow: 'true' } });
  }

  moveAllToCart(): void {
    if (this.products.length === 0) return;
    for (const p of this.products) {
      this.cartService.addToCart(p, 1);
    }
    this.showToast(`All ${this.products.length} items moved to your cart!`);
  }

  openClearModal(): void {
    this.showClearModal = true;
  }

  closeClearModal(): void {
    this.showClearModal = false;
  }

  confirmClear(): void {
    this.wishlistService.clear();
    this.showClearModal = false;
    this.showToast('Your wishlist has been cleared');
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => {
      if (this.toastMessage === msg) {
        this.toastMessage = '';
      }
    }, 3200);
  }
}
