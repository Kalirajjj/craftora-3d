import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CartItem } from '../models/order.model';
import { Product } from '../models/product.model';
import { CustomerAuthService } from './customer-auth.service';
import { OfferService } from './offer.service';
import { AppConfigService } from './app-config.service';
import { Offer } from '../models/offer.model';
import { CURATED_PRODUCTS } from '../data/curated-products';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = 'craftora_cart';
  private readonly DIRECT_BUY_KEY = 'craftora_buy_now_item';
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private customerAuth = inject(CustomerAuthService);
  private offerService = inject(OfferService);
  private config = inject(AppConfigService);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private get customerCartUrl(): string {
    return `${this.config.apiGatewayUrl}/api/customer/cart`;
  }

  cartItems = signal<CartItem[]>(this.loadCartFromStorage());
  directCheckoutItem = signal<CartItem | null>(this.loadDirectCheckoutFromStorage());
  appliedOffer = signal<Offer | null>(null);
  couponMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Total distinct items in the cart (e.g., 2 items if 2 products are added, regardless of quantity)
  totalItemsCount = computed(() =>
    this.cartItems().length
  );

  // Total quantity of units across all items in cart
  totalUnitsCount = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  subtotal = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  discount = computed(() => {
    const offer = this.appliedOffer();
    const sub = this.subtotal();
    if (!offer || sub === 0) return 0;

    if (offer.type === 'FLAT_DISCOUNT') {
      return Math.min(sub, offer.discountAmount);
    }
    if (offer.type === 'PERCENTAGE_DISCOUNT') {
      return Math.round((sub * offer.discountAmount) / 100);
    }
    return 0;
  });

  deliveryFee = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    if (sub > 999) return 0;
    const offer = this.appliedOffer();
    if (offer && offer.type === 'FREE_DELIVERY') {
      // Check minimum order amount if required
      if (offer.minOrderAmount <= 0 || sub >= offer.minOrderAmount) {
        return 0;
      }
    }
    return 99;
  });

  grandTotal = computed(() => {
    const sub = this.subtotal();
    if (sub === 0) return 0;
    return Math.max(0, sub - this.discount() + this.deliveryFee());
  });

  applyCoupon(code: string): { success: boolean; message: string } {
    const result = this.offerService.validateCouponCode(code, this.subtotal());
    if (result.valid && result.offer) {
      this.appliedOffer.set(result.offer);
      this.couponMessage.set({ type: 'success', text: result.message });
      return { success: true, message: result.message };
    } else {
      this.couponMessage.set({ type: 'error', text: result.message });
      return { success: false, message: result.message };
    }
  }

  removeCoupon(): void {
    this.appliedOffer.set(null);
    this.couponMessage.set(null);
  }

  constructor() {
    this.customerAuth.onLogout(() => {
      this.clearLocalCartOnly();
    });
    if (this.customerAuth.isSignedIn()) {
      this.loadSavedCart();
    }
  }

  private static readonly LEGACY_ID_MAP: Record<string, number> = {
    'p1': 15,
    'astronaut-desk-sculpture': 15,
    'p2': 16,
    'cyber-samurai-bust': 16,
    'p3': 17,
    'voronoi-lamp': 17,
    'geometric-voronoi-table-lamp': 17,
    'p4': 18,
    'artisan-articulated-crystal-dragon': 18,
    'p5': 19,
    'architectural-bauhaus-pen-holder': 19,
    'p6': 20,
    'minimalist-low-poly-succulent-planter': 20,
    'p7': 21,
    'custom-dual-tone-monogram-keychain': 21,
    'p8': 22,
    'futuristic-mecha-falcon-miniature': 22,
    'p9': 23,
    'personalized-led-lithophane-frame': 23,
    'p10': 24,
    'levitating-geometric-planter-base': 24,
    'p11': 25,
    'gamer-headphone-stand-dock': 25,
    'p12': 26,
    'custom-embossed-executive-nameplate': 26,
    'baby-murugar-statue': 10,
    'train-engine': 12,
    'toy-shark': 13,
    'ties': 14
  };

  private normalizeProduct(product: Product): Product {
    if (!product) return product;
    let id = product.id;
    if (typeof id === 'string') {
      const trimmed = id.trim();
      if (/^\d+$/.test(trimmed)) {
        id = Number(trimmed);
      } else if (CartService.LEGACY_ID_MAP[trimmed]) {
        id = CartService.LEGACY_ID_MAP[trimmed];
      } else if (product.slug && CartService.LEGACY_ID_MAP[product.slug]) {
        id = CartService.LEGACY_ID_MAP[product.slug];
      }
    }
    return { ...product, id };
  }

  setDirectCheckoutItem(product: Product, quantity: number, selectedColor: string = 'Default'): void {
    const normalized = this.normalizeProduct(product);
    const item: CartItem = {
      product: normalized,
      quantity: Math.max(1, quantity),
      selectedColor: selectedColor || 'Default'
    };
    this.directCheckoutItem.set(item);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.DIRECT_BUY_KEY, JSON.stringify(item));
      } catch (err) {
        console.warn('Could not save direct buy item:', err);
      }
    }
  }

  getDirectCheckoutItem(): CartItem | null {
    if (!this.directCheckoutItem()) {
      const stored = this.loadDirectCheckoutFromStorage();
      if (stored) {
        this.directCheckoutItem.set(stored);
      }
    }
    return this.directCheckoutItem();
  }

  updateDirectCheckoutQuantity(qty: number): void {
    const current = this.directCheckoutItem();
    if (!current) return;
    const updated: CartItem = {
      ...current,
      quantity: Math.max(1, qty)
    };
    this.directCheckoutItem.set(updated);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.DIRECT_BUY_KEY, JSON.stringify(updated));
      } catch {}
    }
  }

  clearDirectCheckoutItem(): void {
    this.directCheckoutItem.set(null);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(this.DIRECT_BUY_KEY);
      } catch {}
    }
  }

  private loadDirectCheckoutFromStorage(): CartItem | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const raw = localStorage.getItem(this.DIRECT_BUY_KEY);
        const parsed: CartItem | null = raw ? JSON.parse(raw) : null;
        return parsed ? { ...parsed, product: this.normalizeProduct(parsed.product) } : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private loadCartFromStorage(): CartItem[] {
    // Only access localStorage in the browser to prevent SSR hydration errors
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        const parsed: CartItem[] = data ? JSON.parse(data) : [];
        return parsed.map(item => ({
          ...item,
          product: this.normalizeProduct(item.product)
        }));
      } catch {
        return [];
      }
    }
    return [];
  }

  private saveCartToStorage(): void {
    this.writeCartToStorage();
    this.scheduleServerSave();
  }

  loadAndMergeSavedCart(): void {
    if (!this.customerAuth.isSignedIn()) return;
    this.http.get<any[]>(this.customerCartUrl, { headers: this.customerAuth.authorizationHeaders() }).subscribe({
      next: saved => {
        const savedMerged: CartItem[] = (saved || []).map(item => this.mapServerCartLine(item));
        const guestItems = this.cartItems();

        if (guestItems.length > 0) {
          for (const guestItem of guestItems) {
            const guestNormalized = {
              ...guestItem,
              product: this.normalizeProduct(guestItem.product)
            };
            const guestId = Number(guestNormalized.product.id);
            const guestColor = (guestNormalized.selectedColor || 'Default').trim();

            const match = savedMerged.find(item =>
              Number(item.product.id) === guestId &&
              (item.selectedColor || 'Default').trim().toLowerCase() === guestColor.toLowerCase()
            );
            if (match) {
              match.quantity = Math.min(99, match.quantity + guestNormalized.quantity);
            } else {
              savedMerged.push(guestNormalized);
            }
          }
          this.cartItems.set(savedMerged);
          this.writeCartToStorage();
          this.saveCartToServer();
        } else {
          this.cartItems.set(savedMerged);
          this.writeCartToStorage();
        }
      },
      error: err => {
        console.error('Failed to load customer cart from server:', err);
      }
    });
  }

  loadSavedCart(): void {
    if (!this.customerAuth.isSignedIn()) return;
    this.http.get<any[]>(this.customerCartUrl, { headers: this.customerAuth.authorizationHeaders() }).subscribe({
      next: saved => {
        const mapped = (saved || []).map(item => this.mapServerCartLine(item));
        if (mapped.length > 0) {
          this.cartItems.set(mapped);
          this.writeCartToStorage();
        }
      },
      error: err => {
        console.error('Failed to load saved cart:', err);
      }
    });
  }

  private mapServerCartLine(item: any): CartItem {
    const rawProd = item.product || {};
    const normProd = this.normalizeProduct(rawProd);
    const prodId = Number(normProd.id);
    const matchingCurated = CURATED_PRODUCTS.find(cp => Number(cp.id) === prodId);
    const product: Product = matchingCurated
      ? { ...matchingCurated, ...normProd, id: prodId, price: Number(normProd.price != null ? normProd.price : matchingCurated.price) }
      : { ...normProd, id: prodId, price: Number(normProd.price || 0) };

    return this.withAbsoluteImages({
      product,
      quantity: Math.max(1, Math.min(99, item.quantity || 1)),
      selectedColor: item.selectedColor || 'Default'
    });
  }

  private withAbsoluteImages(item: CartItem): CartItem {
    const absolute = (url?: string): string | undefined => !url || /^https?:\/\//i.test(url)
      ? url : `${this.config.apiGatewayUrl}${url.startsWith('/') ? url : '/' + url}`;
    return { ...item, product: { ...item.product, image: absolute(item.product.image), imageUrl: absolute(item.product.imageUrl),
      images: item.product.images?.map(image => ({ ...image, url: absolute(image.url) || image.url })) } };
  }


  private writeCartToStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cartItems()));
      } catch { /* browser storage can be unavailable */ }
    }
  }

  private scheduleServerSave(): void {
    if (!this.customerAuth.isSignedIn()) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveCartToServer(), 300);
  }

  private saveCartToServer(): void {
    if (!this.customerAuth.isSignedIn()) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const lines = this.cartItems().map(item => ({
      productId: Number(item.product.id),
      quantity: Math.max(1, Math.min(99, item.quantity)),
      selectedColor: item.selectedColor || 'Default'
    })).filter(item => Number.isInteger(item.productId) && item.productId > 0);

    this.http.put<any[]>(this.customerCartUrl, lines, { headers: this.customerAuth.authorizationHeaders() }).subscribe({
      next: updatedLines => {
        if (Array.isArray(updatedLines) && updatedLines.length > 0) {
          const current = this.cartItems();
          let modified = false;
          const mapped = current.map(localItem => {
            const serverLine = updatedLines.find(sl =>
              sl && sl.product && Number(sl.product.id) === Number(localItem.product.id) &&
              (sl.selectedColor || 'Default') === (localItem.selectedColor || 'Default')
            );
            if (serverLine && serverLine.product) {
              const serverPrice = Number(serverLine.product.price);
              if (serverPrice > 0 && serverPrice !== localItem.product.price) {
                modified = true;
                return {
                  ...localItem,
                  product: {
                    ...localItem.product,
                    price: serverPrice,
                    name: serverLine.product.name || localItem.product.name
                  }
                };
              }
            }
            return localItem;
          });
          if (modified) {
            this.cartItems.set(mapped);
            this.writeCartToStorage();
          }
        }
      },
      error: err => console.error('Failed to sync cart to server:', err)
    });
  }

  addToCart(product: Product, quantity: number = 1, selectedColor?: string): void {
    const normalized = this.normalizeProduct(product);
    const color = selectedColor || normalized.availableColors?.[0] || 'Default';
    const items = [...this.cartItems()];
    const existingIndex = items.findIndex(
      item => String(item.product.id) === String(normalized.id) && item.selectedColor === color
    );

    if (existingIndex > -1) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({ product: normalized, quantity, selectedColor: color });
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

  /**
   * Clears only local state and browser storage on sign out without deleting
   * the customer's cart in the server database.
   */
  clearLocalCartOnly(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.cartItems.set([]);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch { /* ignore storage error */ }
    }
  }

  /**
   * Clears both local cart and tells server (used on checkout completion or explicit empty cart).
   */
  clearCart(): void {
    this.clearLocalCartOnly();
    if (this.customerAuth.isSignedIn()) {
      this.http.delete(this.customerCartUrl, { headers: this.customerAuth.authorizationHeaders() }).subscribe({
        error: err => console.error('Failed to clear customer cart on server:', err)
      });
    }
  }
}
