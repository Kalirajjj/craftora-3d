import { Injectable, inject, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map } from 'rxjs';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';
import { CustomerAuthService } from './customer-auth.service';

const GUEST_STORAGE_KEY = 'craftora_wishlist';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private platformId = inject(PLATFORM_ID);
  private productService = inject(ProductService);
  private customerAuth = inject(CustomerAuthService);

  // Reactive state using Angular Signals
  readonly wishlistIds = signal<Set<string>>(new Set<string>());
  readonly count = computed(() => this.wishlistIds().size);

  constructor() {
    if (this.isBrowser()) {
      this.loadWishlist();

      // Whenever customer auth state changes, reload account-specific wishlist
      effect(() => {
        const customer = this.customerAuth.customer();
        this.loadWishlist();
      }, { allowSignalWrites: true });
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getStorageKey(): string {
    const customer = this.customerAuth.customer();
    if (customer && customer.id) {
      return `craftora_wishlist_user_${customer.id}`;
    }
    return GUEST_STORAGE_KEY;
  }

  private loadWishlist(): void {
    if (!this.isBrowser()) return;
    try {
      const key = this.getStorageKey();
      let raw = localStorage.getItem(key);

      // If logged in and account wishlist is empty, check if guest wishlist has items to merge
      const customer = this.customerAuth.customer();
      if (customer && !raw) {
        const guestRaw = localStorage.getItem(GUEST_STORAGE_KEY);
        if (guestRaw) {
          raw = guestRaw;
          localStorage.setItem(key, guestRaw);
        }
      }

      if (raw) {
        const list: (string | number)[] = JSON.parse(raw);
        const legacyMap: Record<string, number> = {
          'p1': 15, 'astronaut-desk-sculpture': 15,
          'p2': 16, 'cyber-samurai-bust': 16,
          'p3': 17, 'voronoi-lamp': 17, 'geometric-voronoi-table-lamp': 17,
          'p4': 18, 'artisan-articulated-crystal-dragon': 18,
          'p5': 19, 'architectural-bauhaus-pen-holder': 19,
          'p6': 20, 'minimalist-low-poly-succulent-planter': 20,
          'p7': 21, 'custom-dual-tone-monogram-keychain': 21,
          'p8': 22, 'futuristic-mecha-falcon-miniature': 22,
          'p9': 23, 'personalized-led-lithophane-frame': 23,
          'p10': 24, 'levitating-geometric-planter-base': 24,
          'p11': 25, 'gamer-headphone-stand-dock': 25,
          'p12': 26, 'custom-embossed-executive-nameplate': 26,
          'baby-murugar-statue': 10, 'train-engine': 12, 'toy-shark': 13, 'ties': 14
        };
        this.wishlistIds.set(new Set(list.map(id => {
          const str = String(id).trim();
          return legacyMap[str] ? String(legacyMap[str]) : str;
        })));
      } else {
        this.wishlistIds.set(new Set());
      }
    } catch (e) {
      console.warn('Error reading wishlist from localStorage:', e);
      this.wishlistIds.set(new Set());
    }
  }

  private saveWishlist(set: Set<string>): void {
    if (!this.isBrowser()) return;
    try {
      const arr = Array.from(set);
      const key = this.getStorageKey();
      localStorage.setItem(key, JSON.stringify(arr));
      // Also keep guest key updated if guest
      if (!this.customerAuth.isSignedIn()) {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(arr));
      }
    } catch (e) {
      console.warn('Error saving wishlist to localStorage:', e);
    }
  }

  has(productId: string | number): boolean {
    return this.wishlistIds().has(String(productId));
  }

  toggle(product: Product): { added: boolean; count: number } {
    const id = String(product.id);
    const next = new Set(this.wishlistIds());
    let added = false;

    if (next.has(id)) {
      next.delete(id);
      added = false;
    } else {
      next.add(id);
      added = true;
    }

    this.wishlistIds.set(next);
    this.saveWishlist(next);
    return { added, count: next.size };
  }

  add(productId: string | number): void {
    const id = String(productId);
    const next = new Set(this.wishlistIds());
    if (!next.has(id)) {
      next.add(id);
      this.wishlistIds.set(next);
      this.saveWishlist(next);
    }
  }

  remove(productId: string | number): void {
    const id = String(productId);
    const next = new Set(this.wishlistIds());
    if (next.has(id)) {
      next.delete(id);
      this.wishlistIds.set(next);
      this.saveWishlist(next);
    }
  }

  clear(): void {
    const empty = new Set<string>();
    this.wishlistIds.set(empty);
    this.saveWishlist(empty);
  }

  getWishlistProducts(): Observable<Product[]> {
    return this.productService.getProducts().pipe(
      map(all => {
        const ids = this.wishlistIds();
        return all.filter(p => ids.has(String(p.id)));
      })
    );
  }
}
