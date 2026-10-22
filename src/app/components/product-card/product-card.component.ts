import { Component, Input, Output, EventEmitter, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css']
})
export class ProductCardComponent implements OnDestroy {
  @Input({ required: true }) product!: Product;
  @Input() isWishlisted = false;
  @Output() quickView = new EventEmitter<Product>();
  @Output() toggleWishlist = new EventEmitter<Product>();

  private cartService = inject(CartService);
  private wishlistService = inject(WishlistService);

  isAdded = false;
  isCopied = false;
  private timeoutId?: ReturnType<typeof setTimeout>;
  private copyTimeoutId?: ReturnType<typeof setTimeout>;

  onShare(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const productUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/product/${this.product.id}`
      : `https://craftora3d.com/product/${this.product.id}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share({
        title: this.product.name + ' | Craftora 3D',
        text: `Check out "${this.product.name}" on Craftora 3D:`,
        url: productUrl
      }).catch(() => {
        // Ignored
      });
    } else {
      this.copyProductLink(productUrl);
    }
  }

  private copyProductLink(url: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.triggerCopied();
      }).catch(() => {
        this.fallbackCopy(url);
      });
    } else {
      this.fallbackCopy(url);
    }
  }

  private fallbackCopy(text: string): void {
    if (typeof document !== 'undefined') {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.triggerCopied();
    }
  }

  private triggerCopied(): void {
    this.isCopied = true;
    clearTimeout(this.copyTimeoutId);
    this.copyTimeoutId = setTimeout(() => {
      this.isCopied = false;
    }, 2000);
  }

  addToCart(event: MouseEvent): void {
    event.stopPropagation();
    this.cartService.addToCart(this.product, 1);
    this.isAdded = true;

    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.isAdded = false;
    }, 1500);
  }

  onQuickView(event: MouseEvent): void {
    event.stopPropagation();
    this.quickView.emit(this.product);
  }

  get wishlisted(): boolean {
    return this.isWishlisted || (this.product ? this.wishlistService.has(this.product.id) : false);
  }

  onToggleWishlist(event: MouseEvent): void {
    event.stopPropagation();
    if (this.product) {
      this.wishlistService.toggle(this.product);
      this.toggleWishlist.emit(this.product);
    }
  }

  get discountPercent(): number | null {
    if (this.product.originalPrice && this.product.originalPrice > this.product.price) {
      return Math.round(((this.product.originalPrice - this.product.price) / this.product.originalPrice) * 100);
    }
    return null;
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
    clearTimeout(this.copyTimeoutId);
  }
}