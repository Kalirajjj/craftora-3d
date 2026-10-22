import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Review, ReviewSummary, ReviewQueryParams, ReviewsResponse } from '../models/review.model';
import { CustomerAuthService, CustomerProfile } from './customer-auth.service';
import { OrderService } from './order.service';
import { AppConfigService } from './app-config.service';

const STORAGE_KEY = 'craftora_product_reviews';
const HELPFUL_STORAGE_KEY = 'craftora_helpful_reviews';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private customerAuth = inject(CustomerAuthService);
  private orderService = inject(OrderService);
  private config = inject(AppConfigService);

  private get apiOrigin(): string {
    return this.config.apiGatewayUrl;
  }


  constructor() {
    this.ensureSeedReviews();
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getStoredReviews(): Review[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveStoredReviews(reviews: Review[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    } catch {
      // ignore
    }
  }

  private ensureSeedReviews(): void {
    if (!this.isBrowser()) return;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && parsed.length > 0) return;
      } catch {
        // reseed
      }
    }

    const now = Date.now();
    const day = 1000 * 60 * 60 * 24;

    const seedReviews: Review[] = [
      // Product 12 (TRAIN ENGINE)
      {
        id: 'rev-101',
        productId: '12',
        customerId: 2,
        customerName: 'Aarav Sharma',
        rating: 5,
        comment: 'Incredible detail on the locomotive boiler and miniature bogie wheels! The multicolor filament blending is completely seamless with no stringing or layer defects. Highly recommend for hobbyists and children.',
        images: [
          '/images/products/cyber-samurai-bust.svg'
        ],
        verifiedPurchase: true,
        helpfulCount: 16,
        createdAt: new Date(now - day * 2).toISOString(),
        status: 'APPROVED'
      },
      {
        id: 'rev-102',
        productId: '12',
        customerId: 3,
        customerName: 'Sneha Patel',
        rating: 5,
        comment: 'The tactile quality is exceptional. It feels dense and premium, not like cheap hollow plastic. Packaged in custom bubble mold with an inspection card. Will definitely buy more 3D models!',
        images: [],
        verifiedPurchase: true,
        helpfulCount: 9,
        createdAt: new Date(now - day * 5).toISOString(),
        status: 'APPROVED'
      },
      {
        id: 'rev-103',
        productId: '12',
        customerId: 4,
        customerName: 'Vikram Menon',
        rating: 4,
        comment: 'Solid build and vibrant toy colors. Took about 4 days to deliver to Bangalore. Wheels rotate smoothly. Great collectible piece for my desk.',
        images: [],
        verifiedPurchase: true,
        helpfulCount: 4,
        createdAt: new Date(now - day * 12).toISOString(),
        status: 'APPROVED'
      },
      {
        id: 'rev-104',
        productId: '12',
        customerId: 5,
        customerName: 'Pooja Iyer',
        rating: 5,
        comment: 'My nephew was thrilled! The tolerances on the snap-fit sections are precise. A wonderful showcase of additive 3D manufacturing precision.',
        images: [],
        verifiedPurchase: false,
        helpfulCount: 7,
        createdAt: new Date(now - day * 18).toISOString(),
        status: 'APPROVED'
      },
      {
        id: 'rev-105',
        productId: '12',
        customerId: 6,
        customerName: 'Rohan Deshmukh',
        rating: 5,
        comment: 'Astonishing layer resolution. You can inspect it up close and barely feel any ridges. Top tier Craftora quality.',
        images: [],
        verifiedPurchase: true,
        helpfulCount: 3,
        createdAt: new Date(now - day * 25).toISOString(),
        status: 'APPROVED'
      },

      // Product 1 (Cyber Samurai Bust)
      {
        id: 'rev-201',
        productId: '1',
        customerId: 7,
        customerName: 'Devika Roy',
        rating: 5,
        comment: 'The dual-tone black and crimson finish on the samurai helmet is breathtaking. Sits right in my gaming studio setup. 10/10.',
        images: ['/images/products/cyber-samurai-bust.svg'],
        verifiedPurchase: true,
        helpfulCount: 22,
        createdAt: new Date(now - day * 3).toISOString(),
        status: 'APPROVED'
      },
      {
        id: 'rev-202',
        productId: '1',
        customerId: 8,
        customerName: 'Aditya Nair',
        rating: 5,
        comment: 'Museum-grade surface finish. Heavy and solid resin feel. Best purchase I have made this year.',
        images: [],
        verifiedPurchase: true,
        helpfulCount: 11,
        createdAt: new Date(now - day * 8).toISOString(),
        status: 'APPROVED'
      },

      // Voronoi Lamp / Product 2
      {
        id: 'rev-301',
        productId: 'voronoi-lamp',
        customerId: 9,
        customerName: 'Meera Nambiar',
        rating: 5,
        comment: 'The organic cellular shadow patterns cast on the bedroom walls at night are hypnotic. Very soothing warm ambient core.',
        images: ['/images/products/voronoi-lamp.svg'],
        verifiedPurchase: true,
        helpfulCount: 34,
        createdAt: new Date(now - day * 6).toISOString(),
        status: 'APPROVED'
      }
    ];

    this.saveStoredReviews(seedReviews);
  }

  /**
   * Retrieves reviews for a product with summary, filters, sorting, and progressive loading.
   */
  getReviews(productId: string, params: ReviewQueryParams = {}): Observable<ReviewsResponse> {
    const cleanId = String(productId).trim();
    const page = Math.max(0, params.page || 0);
    const limit = Math.max(1, params.limit || 5);
    const ratingFilter = params.rating;
    const withPhotos = Boolean(params.withPhotosOnly);
    const sortBy = params.sortBy || 'recent';

    // Try backend API first with fallback to local storage
    const url = `${this.apiOrigin}/api/products/${encodeURIComponent(cleanId)}/reviews?page=${page}&limit=${limit}&sortBy=${sortBy}` +
      (ratingFilter ? `&rating=${ratingFilter}` : '') +
      (withPhotos ? `&withPhotos=true` : '');

    return this.http.get<ReviewsResponse>(url).pipe(
      catchError(() => {
        // Graceful local computation fallback
        return of(this.computeLocalReviews(cleanId, params));
      })
    );
  }

  private computeLocalReviews(productId: string, params: ReviewQueryParams): ReviewsResponse {
    const all = this.getStoredReviews();
    const productReviews = all.filter(r => String(r.productId) === String(productId) && r.status === 'APPROVED');

    // Compute distribution and summary
    const distribution: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    productReviews.forEach(r => {
      const star = Math.max(1, Math.min(5, Math.round(r.rating)));
      distribution[star] = (distribution[star] || 0) + 1;
    });

    const total = productReviews.length;
    let avg = 0;
    if (total > 0) {
      const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
      avg = Math.round((sum / total) * 10) / 10;
    }

    const summary: ReviewSummary = {
      averageRating: avg,
      totalReviews: total,
      distribution: {
        5: distribution[5] || 0,
        4: distribution[4] || 0,
        3: distribution[3] || 0,
        2: distribution[2] || 0,
        1: distribution[1] || 0
      }
    };

    // Filter
    let filtered = [...productReviews];
    if (params.rating && params.rating >= 1 && params.rating <= 5) {
      filtered = filtered.filter(r => Math.round(r.rating) === params.rating);
    }
    if (params.withPhotosOnly) {
      filtered = filtered.filter(r => r.images && r.images.length > 0);
    }

    // Sort
    const sortBy = params.sortBy || 'recent';
    switch (sortBy) {
      case 'highest':
        filtered.sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'lowest':
        filtered.sort((a, b) => a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'helpful':
        filtered.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    // Paginate
    const page = Math.max(0, params.page || 0);
    const limit = Math.max(1, params.limit || 5);
    const start = page * limit;
    const paginated = filtered.slice(0, start + limit); // progressive slice

    return {
      summary,
      reviews: paginated,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
      currentPage: page,
      hasMore: (start + limit) < filtered.length
    };
  }

  /**
   * Retrieves summary ratings for a product.
   */
  getSummary(productId: string): Observable<ReviewSummary> {
    return this.getReviews(productId, { limit: 1 }).pipe(
      map(res => res.summary)
    );
  }

  /**
   * Checks if customer has already written a review for this product.
   */
  getUserReview(productId: string, customer?: CustomerProfile | null): Observable<Review | null> {
    if (!customer) return of(null);
    const cleanId = String(productId).trim();

    // Check backend first
    const token = this.customerAuth.token();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<Review | null>(`${this.apiOrigin}/api/customer/products/${encodeURIComponent(cleanId)}/my-review`, { headers }).pipe(
      catchError(() => {
        // Local storage fallback
        const all = this.getStoredReviews();
        const found = all.find(r => 
          String(r.productId) === cleanId && 
          (r.customerId === customer.id || r.customerName.toLowerCase() === customer.fullName.toLowerCase())
        );
        return of(found || null);
      })
    );
  }

  /**
   * Checks if the customer actually ordered this product (Verified Purchase).
   */
  checkVerifiedPurchase(productId: string, customer?: CustomerProfile | null): Observable<boolean> {
    if (!customer) return of(false);
    const cleanId = String(productId).trim();

    return this.orderService.getCustomerOrders(customer).pipe(
      map(orders => {
        if (!orders || orders.length === 0) return false;
        // Check if any non-cancelled order contains an item with this product id
        return orders.some(ord => 
          ord.status !== 'Cancelled' &&
          ord.items &&
          ord.items.some(it => String(it.product.id) === cleanId || it.product.name.toLowerCase().includes(cleanId.toLowerCase()))
        );
      }),
      catchError(() => of(false))
    );
  }

  /**
   * Submits a new review.
   */
  submitReview(
    productId: string,
    data: { rating: number; comment: string; images: string[] },
    customer: CustomerProfile
  ): Observable<{ success: boolean; review?: Review; message?: string }> {
    if (!customer) {
      return of({ success: false, message: 'Please sign in to write a review.' });
    }

    const cleanId = String(productId).trim();

    if (this.customerAuth.isSignedIn()) {
      return this.http.post<any>(`${this.apiOrigin}/api/products/${encodeURIComponent(cleanId)}/reviews`, {
        rating: Math.max(1, Math.min(5, data.rating)),
        comment: data.comment.trim(),
        images: data.images ? data.images.slice(0, 5) : []
      }, {
        headers: this.customerAuth.authorizationHeaders()
      }).pipe(
        map(res => {
          const mapped: Review = {
            id: String(res.id),
            productId: String(res.productId),
            customerId: res.customerId,
            customerName: res.customerName || customer.fullName || 'Verified Customer',
            rating: res.rating,
            comment: res.comment,
            images: res.images || [],
            verifiedPurchase: res.verifiedPurchase,
            helpfulCount: res.helpfulCount || 0,
            createdAt: res.createdAt || new Date().toISOString(),
            status: (res.status as any) || 'APPROVED'
          };
          const all = this.getStoredReviews();
          all.unshift(mapped);
          this.saveStoredReviews(all);
          return { success: true, review: mapped };
        }),
        catchError(err => of({ success: false, message: err?.error?.message || err?.message || 'Failed to submit review to server' }))
      );
    }

    return of({ success: false, message: 'Please sign in to write a review.' });
  }

  /**
   * Edits an existing review.
   */
  updateReview(
    reviewId: string | number,
    data: { rating: number; comment: string; images: string[] }
  ): Observable<{ success: boolean; review?: Review; message?: string }> {
    const cleanId = String(reviewId).trim();
    if (this.customerAuth.isSignedIn() && /^\d+$/.test(cleanId)) {
      return this.http.put<any>(`${this.apiOrigin}/api/customer/reviews/${cleanId}`, {
        rating: Math.max(1, Math.min(5, data.rating)),
        comment: data.comment.trim(),
        images: data.images ? data.images.slice(0, 5) : []
      }, {
        headers: this.customerAuth.authorizationHeaders()
      }).pipe(
        map(res => {
          const mapped: Review = {
            id: String(res.id),
            productId: String(res.productId),
            customerId: res.customerId,
            customerName: res.customerName,
            rating: res.rating,
            comment: res.comment,
            images: res.images || [],
            verifiedPurchase: res.verifiedPurchase,
            helpfulCount: res.helpfulCount || 0,
            createdAt: res.createdAt,
            updatedAt: res.updatedAt,
            status: (res.status as any) || 'APPROVED'
          };
          return { success: true, review: mapped };
        }),
        catchError(err => of({ success: false, message: err?.error?.message || err?.message || 'Failed to update review' }))
      );
    }

    const all = this.getStoredReviews();
    const idx = all.findIndex(r => String(r.id) === cleanId);
    if (idx === -1) {
      return of({ success: false, message: 'Review not found.' });
    }

    const existing = all[idx];
    existing.rating = Math.max(1, Math.min(5, data.rating));
    existing.comment = data.comment.trim();
    existing.images = data.images ? data.images.slice(0, 5) : [];
    existing.updatedAt = new Date().toISOString();

    all[idx] = existing;
    this.saveStoredReviews(all);

    return of({ success: true, review: existing });
  }

  /**
   * Deletes a review.
   */
  deleteReview(reviewId: string | number): Observable<{ success: boolean }> {
    const cleanId = String(reviewId).trim();
    if (this.customerAuth.isSignedIn() && /^\d+$/.test(cleanId)) {
      return this.http.delete<void>(`${this.apiOrigin}/api/customer/reviews/${cleanId}`, {
        headers: this.customerAuth.authorizationHeaders()
      }).pipe(
        map(() => {
          const all = this.getStoredReviews();
          const filtered = all.filter(r => String(r.id) !== cleanId);
          this.saveStoredReviews(filtered);
          return { success: true };
        }),
        catchError(() => of({ success: false }))
      );
    }

    const all = this.getStoredReviews();
    const filtered = all.filter(r => String(r.id) !== cleanId);
    this.saveStoredReviews(filtered);
    return of({ success: true });
  }


  /**
   * Marks a review as helpful.
   */
  markHelpful(reviewId: string | number): Observable<{ helpfulCount: number; alreadyVoted: boolean }> {
    if (!this.isBrowser()) return of({ helpfulCount: 0, alreadyVoted: false });

    let votedList: string[] = [];
    try {
      const raw = localStorage.getItem(HELPFUL_STORAGE_KEY);
      if (raw) votedList = JSON.parse(raw);
    } catch {
      votedList = [];
    }

    const idStr = String(reviewId);
    if (votedList.includes(idStr)) {
      // Already voted
      const all = this.getStoredReviews();
      const match = all.find(r => String(r.id) === idStr);
      return of({ helpfulCount: match ? match.helpfulCount : 0, alreadyVoted: true });
    }

    votedList.push(idStr);
    try {
      localStorage.setItem(HELPFUL_STORAGE_KEY, JSON.stringify(votedList));
    } catch {
      // ignore
    }

    const all = this.getStoredReviews();
    const match = all.find(r => String(r.id) === idStr);
    let count = 1;
    if (match) {
      match.helpfulCount = (match.helpfulCount || 0) + 1;
      count = match.helpfulCount;
      this.saveStoredReviews(all);
    }

    return of({ helpfulCount: count, alreadyVoted: false });
  }
}
