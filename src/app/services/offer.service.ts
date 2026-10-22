import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { Offer } from '../models/offer.model';
import { CustomerAuthService } from './customer-auth.service';

const OFFERS_STORAGE_KEY = 'craftora_offers';
const ORDERS_STORAGE_KEY = 'craftora_orders';

export const DEFAULT_OFFERS: Offer[] = [
  {
    id: 'offer-first-299',
    title: '1st Order Special: Free Delivery above ₹299',
    code: 'FIRST299',
    description: 'New to Craftora 3D? Enjoy 100% Free Shipping on your first 3D order when your cart total exceeds ₹299.',
    type: 'FREE_DELIVERY',
    targetAudience: 'FIRST_TIME_BUYERS',
    discountAmount: 0,
    minOrderAmount: 299,
    bannerImageUrl: '/images/offers/free-delivery-299.svg',
    badgeText: '1ST ORDER FREE DELIVERY',
    buttonText: 'Shop Now',
    buttonLink: '/shop',
    active: true,
    highlightColor: '#00A896',
    createdAt: new Date().toISOString()
  },
  {
    id: 'offer-welcome-50',
    title: 'Welcome Gift: Flat ₹50 Off First Purchase',
    code: 'WELCOME50',
    description: 'Get an instant flat ₹50 discount automatically on your very first order of any 3D creation.',
    type: 'FLAT_DISCOUNT',
    targetAudience: 'FIRST_TIME_BUYERS',
    discountAmount: 50,
    minOrderAmount: 0,
    bannerImageUrl: '/images/offers/first-order-50.svg',
    badgeText: 'FLAT ₹50 OFF',
    buttonText: 'Explore Collection',
    buttonLink: '/shop',
    active: true,
    highlightColor: '#FF2E93',
    createdAt: new Date().toISOString()
  },
  {
    id: 'offer-flat-100-499',
    title: 'Super Saver: Flat ₹100 Off Orders Above ₹499',
    code: 'OFF499',
    description: 'Flat ₹100 instant discount on all custom prints, desk accessories and planters above ₹499.',
    type: 'FLAT_DISCOUNT',
    targetAudience: 'ALL_CUSTOMERS',
    discountAmount: 100,
    minOrderAmount: 499,
    bannerImageUrl: '/images/offers/flat-100-499.svg',
    badgeText: 'FLAT ₹100 OFF',
    buttonText: 'Shop Now',
    buttonLink: '/shop',
    active: true,
    highlightColor: '#A855F7',
    createdAt: new Date().toISOString()
  },
  {
    id: 'offer-weekend-15',
    title: 'Decor Special: 15% Off Desk Accessories',
    code: 'CRAFT15',
    description: 'Upgrade your workspace with 15% off artisanal geometric vases and organizers.',
    type: 'PERCENTAGE_DISCOUNT',
    targetAudience: 'ALL_CUSTOMERS',
    discountAmount: 15,
    minOrderAmount: 0,
    bannerImageUrl: '/images/offers/weekend-craft-15.svg',
    badgeText: '15% OFF',
    buttonText: 'View Decor',
    buttonLink: '/shop',
    active: true,
    highlightColor: '#10B981',
    createdAt: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class OfferService {
  private platformId = inject(PLATFORM_ID);
  private customerAuth = inject(CustomerAuthService);

  constructor() {
    this.ensureSeedOffers();
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private ensureSeedOffers(): void {
    if (!this.isBrowser()) return;
    try {
      const existing = localStorage.getItem(OFFERS_STORAGE_KEY);
      if (!existing || existing === '[]') {
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(DEFAULT_OFFERS));
        return;
      }
      const list: Offer[] = JSON.parse(existing);
      let updated = false;
      for (const def of DEFAULT_OFFERS) {
        if (!list.some(o => o.code === def.code)) {
          list.push(def);
          updated = true;
        }
      }
      if (updated) {
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }

  getOffers(): Observable<Offer[]> {
    if (!this.isBrowser()) return of(DEFAULT_OFFERS);
    try {
      const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
      if (!raw || raw === '[]') {
        this.ensureSeedOffers();
        return of(DEFAULT_OFFERS);
      }
      return of(JSON.parse(raw));
    } catch {
      return of(DEFAULT_OFFERS);
    }
  }

  getActiveOffers(): Observable<Offer[]> {
    if (!this.isBrowser()) return of(DEFAULT_OFFERS);
    try {
      const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
      if (!raw || raw === '[]') {
        this.ensureSeedOffers();
        return of(DEFAULT_OFFERS);
      }
      const list: Offer[] = JSON.parse(raw);
      const active = list.filter(o => o.active);
      return of(active.length > 0 ? active : DEFAULT_OFFERS);
    } catch {
      return of(DEFAULT_OFFERS);
    }
  }

  getOfferById(id: string): Observable<Offer | null> {
    if (!this.isBrowser()) return of(null);
    try {
      const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
      const list: Offer[] = raw ? JSON.parse(raw) : [];
      const match = list.find(o => o.id === id);
      return of(match || null);
    } catch {
      return of(null);
    }
  }

  saveOffer(offerData: Partial<Offer>): Observable<Offer> {
    const raw = this.isBrowser() ? localStorage.getItem(OFFERS_STORAGE_KEY) : null;
    const list: Offer[] = raw ? JSON.parse(raw) : [];

    if (offerData.id) {
      // Update existing
      const idx = list.findIndex(o => o.id === offerData.id);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...offerData };
        if (this.isBrowser()) {
          localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(list));
        }
        return of(list[idx]);
      }
    }

    // Create new
    const newOffer: Offer = {
      id: 'offer-' + Math.floor(100000 + Math.random() * 900000),
      title: offerData.title || 'Special Promotion',
      code: (offerData.code || 'SAVE' + Math.floor(10 + Math.random() * 90)).toUpperCase().trim(),
      description: offerData.description || '',
      type: offerData.type || 'FLAT_DISCOUNT',
      targetAudience: offerData.targetAudience || 'FIRST_TIME_BUYERS',
      discountAmount: Number(offerData.discountAmount) || 0,
      minOrderAmount: Number(offerData.minOrderAmount) || 0,
      bannerImageUrl: offerData.bannerImageUrl || '/images/offers/free-delivery-299.svg',
      badgeText: offerData.badgeText || 'SPECIAL OFFER',
      buttonText: offerData.buttonText || 'Shop Now',
      buttonLink: offerData.buttonLink || '/shop',
      active: offerData.active !== undefined ? offerData.active : true,
      highlightColor: offerData.highlightColor || '#00A896',
      createdAt: new Date().toISOString()
    };

    list.unshift(newOffer);
    if (this.isBrowser()) {
      localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(list));
    }
    return of(newOffer);
  }

  toggleOfferStatus(id: string): Observable<Offer | null> {
    if (!this.isBrowser()) return of(null);
    try {
      const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
      const list: Offer[] = raw ? JSON.parse(raw) : [];
      const item = list.find(o => o.id === id);
      if (item) {
        item.active = !item.active;
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(list));
        return of(item);
      }
      return of(null);
    } catch {
      return of(null);
    }
  }

  deleteOffer(id: string): Observable<boolean> {
    if (!this.isBrowser()) return of(false);
    try {
      const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
      const list: Offer[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter(o => o.id !== id);
      localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(filtered));
      return of(true);
    } catch {
      return of(false);
    }
  }

  /**
   * Evaluates if the current user is a first-time customer.
   * Checks if signed-in customer email has prior orders, or guest has past orders recorded in localStorage.
   */
  isFirstTimeCustomer(): boolean {
    if (!this.isBrowser()) return true;
    try {
      const rawOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (!rawOrders) return true;
      const orders = JSON.parse(rawOrders);
      if (!Array.isArray(orders) || orders.length === 0) return true;

      // If user is signed in, check against their email
      const customer = this.customerAuth.customer();
      if (customer && customer.email) {
        const found = orders.some(o => o.customer?.email?.toLowerCase() === customer.email.toLowerCase());
        return !found;
      }

      // If guest has completed any order from this device:
      return orders.length === 0;
    } catch {
      return true;
    }
  }

  /**
   * Applies and validates an offer code against a cart subtotal.
   */
  validateCouponCode(code: string, subtotal: number): {
    valid: boolean;
    offer?: Offer;
    discount: number;
    isFreeDelivery: boolean;
    message: string;
  } {
    if (!code || !this.isBrowser()) {
      return { valid: false, discount: 0, isFreeDelivery: false, message: 'Please enter a coupon code.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
    const list: Offer[] = raw ? JSON.parse(raw) : [];
    const offer = list.find(o => o.code.toUpperCase() === cleanCode && o.active);

    if (!offer) {
      return { valid: false, discount: 0, isFreeDelivery: false, message: `Coupon code "${code}" is invalid or expired.` };
    }

    const isFirstTime = this.isFirstTimeCustomer();

    if (offer.targetAudience === 'FIRST_TIME_BUYERS' && !isFirstTime) {
      return {
        valid: false,
        offer,
        discount: 0,
        isFreeDelivery: false,
        message: 'This offer is exclusive to first-time customers on their first purchase.'
      };
    }

    if (offer.minOrderAmount > 0 && subtotal < offer.minOrderAmount) {
      return {
        valid: false,
        offer,
        discount: 0,
        isFreeDelivery: false,
        message: `Minimum order amount of ₹${offer.minOrderAmount} is required for this offer (Current subtotal: ₹${subtotal}).`
      };
    }

    let discount = 0;
    let isFreeDelivery = false;

    if (offer.type === 'FREE_DELIVERY') {
      isFreeDelivery = true;
    } else if (offer.type === 'FLAT_DISCOUNT') {
      discount = Math.min(subtotal, offer.discountAmount);
    } else if (offer.type === 'PERCENTAGE_DISCOUNT') {
      discount = Math.round((subtotal * offer.discountAmount) / 100);
    }

    return {
      valid: true,
      offer,
      discount,
      isFreeDelivery,
      message: `Offer applied: ${offer.title}!`
    };
  }
}
