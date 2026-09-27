import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CartItem } from '../models/order.model';
import { Product } from '../models/product.model';
import { CustomerAuthService } from './customer-auth.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = 'craftora_cart';
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private customerAuth = inject(CustomerAuthService);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly customerCartUrl = 'http://localhost:8080/api/customer/cart';

  cartItems = signal<CartItem[]>(this.loadCartFromStorage());

  totalItemsCount = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  subtotal = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  deliveryFee = computed(() => {
    const sub = this.subtotal();
    return sub > 999 || sub === 0 ? 0 : 99;
  });

  grandTotal = computed(() => this.subtotal() + this.deliveryFee());

  private loadCartFromStorage(): CartItem[] {
    // Only access localStorage in the browser to prevent SSR hydration errors
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private saveCartToStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cartItems()));
      } catch (e) {
        console.error('Failed to save cart to localStorage', e);
      }
    }
    this.scheduleServerSave();
  }

  loadAndMergeSavedCart(): void {
    if (!this.customerAuth.isSignedIn()) return;
    this.http.get<CartItem[]>(this.customerCartUrl, { headers: this.customerAuth.authorizationHeaders() }).subscribe({
      next: saved => {
        const merged = saved.map(item => this.withAbsoluteImages(item));
        for (const guestItem of this.cartItems()) {
          const match = merged.find(item => String(item.product.id) === String(guestItem.product.id) && item.selectedColor === guestItem.selectedColor);
          if (match) match.quantity = Math.min(99, match.quantity + guestItem.quantity);
          else merged.push(guestItem);
        }
        this.cartItems.set(merged);
        this.writeCartToStorage();
        this.saveCartToServer();
      },
      error: () => undefined
    });
  }

  loadSavedCart(): void {
    if (!this.customerAuth.isSignedIn()) return;
    this.http.get<CartItem[]>(this.customerCartUrl, { headers: this.customerAuth.authorizationHeaders() }).subscribe({
      next: saved => {
        this.cartItems.set(saved.map(item => this.withAbsoluteImages(item)));
        this.writeCartToStorage();
      },
      error: () => undefined
    });
  }

  private withAbsoluteImages(item: CartItem): CartItem {
    const absolute = (url?: string): string | undefined => !url || /^https?:\/\//i.test(url)
      ? url : `http://localhost:8080${url.startsWith('/') ? url : '/' + url}`;
    return { ...item, product: { ...item.product, image: absolute(item.product.image), imageUrl: absolute(item.product.imageUrl),
      images: item.product.images?.map(image => ({ ...image, url: absolute(image.url) || image.url })) } };
  }

  private writeCartToStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cartItems())); } catch { /* browser storage can be unavailable */ }
    }
  }

  private scheduleServerSave(): void {
    if (!this.customerAuth.isSignedIn()) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveCartToServer(), 400);
  }

  private saveCartToServer(): void {
    if (!this.customerAuth.isSignedIn()) return;
    const lines = this.cartItems().map(item => ({ productId: Number(item.product.id), quantity: item.quantity, selectedColor: item.selectedColor }))
      .filter(item => Number.isFinite(item.productId));
    this.http.put(this.customerCartUrl, lines, { headers: this.customerAuth.authorizationHeaders() }).subscribe({ error: () => undefined });
  }

  addToCart(product: Product, quantity: number = 1, selectedColor?: string): void {
    const color = selectedColor || product.availableColors?.[0] || 'Default';
    const items = [...this.cartItems()];
    const existingIndex = items.findIndex(
      item => String(item.product.id) === String(product.id) && item.selectedColor === color
    );

    if (existingIndex > -1) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({ product, quantity, selectedColor: color });
    }

    this.cartItems.set(items);
    this.saveCartToStorage();
  }

  updateQuantity(productId: string | number, selectedColor: string, delta: number): void {
    const items = [...this.cartItems()];
    const index = items.findIndex(
      item => String(item.product.id) === String(productId) && item.selectedColor === selectedColor
    );

    if (index > -1) {
      const newQty = items[index].quantity + delta;
      if (newQty <= 0) {
        items.splice(index, 1);
      } else {
        items[index].quantity = newQty;
      }
      this.cartItems.set(items);
      this.saveCartToStorage();
    }
  }

  // Named both removeFromCart and removeItem to prevent template call mismatches
  removeFromCart(productId: string | number, selectedColor: string): void {
    const items = this.cartItems().filter(
      item => !(String(item.product.id) === String(productId) && item.selectedColor === selectedColor)
    );
    this.cartItems.set(items);
    this.saveCartToStorage();
  }

  removeItem(productId: string | number, selectedColor: string): void {
    this.removeFromCart(productId, selectedColor);
  }

  clearCart(): void {
    this.cartItems.set([]);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    this.scheduleServerSave();
  }
}
