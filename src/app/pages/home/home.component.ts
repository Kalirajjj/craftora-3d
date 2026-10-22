import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { Hero3dComponent } from '../../components/hero-3d/hero-3d.component';
import { OfferService } from '../../services/offer.service';
import { Offer } from '../../models/offer.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, Hero3dComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private offerService = inject(OfferService);
  private platformId = inject(PLATFORM_ID);

  featuredProducts: Product[] = [];
  categories: Category[] = [];
  activeOffers: Offer[] = [];
  displayOffers: Offer[] = [];
  isLoading = true;
  copiedCode: string | null = null;

  // Auto-scroll Carousel State
  currentOfferIndex = 0;
  noTransition = false;
  private isTransitioning = false;
  private loopLength = 0;
  private autoSlideTimer: any = null;

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get activeOfferIndex(): number {
    if (!this.activeOffers.length) return 0;
    return this.currentOfferIndex % this.activeOffers.length;
  }

  ngOnInit(): void {
    // 1. Safe load of active promotional offers for home banner strip
    this.offerService.getActiveOffers().subscribe({
      next: (offers) => {
        this.activeOffers = offers || [];
        this.setupDisplayOffers();
        if (this.activeOffers.length > 1) {
          this.startAutoSlide();
        }
      },
      error: (err) => console.error('Error loading offers:', err)
    });

    // 2. Safe load of featured products
    this.productService.getFeaturedProducts().subscribe({
      next: (products) => {
        this.featuredProducts = products || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading featured products:', err);
        this.isLoading = false;
      }
    });

    // 3. Safe load of categories
    this.productService.getCategories().subscribe({
      next: (cats) => {
        this.categories = cats || [];
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  setupDisplayOffers(): void {
    if (!this.activeOffers || this.activeOffers.length === 0) {
      this.displayOffers = [];
      this.loopLength = 0;
      return;
    }

    // Ensure base has at least 3 offers so 2.5 cards can always be displayed
    let base = [...this.activeOffers];
    while (base.length < 3) {
      base = [...base, ...this.activeOffers];
    }

    this.loopLength = base.length;
    // Repeat base array 3 times for seamless wrapping
    this.displayOffers = [...base, ...base, ...base];
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  startAutoSlide(): void {
    if (!this.isBrowser()) return;
    this.stopAutoSlide();
    this.autoSlideTimer = setInterval(() => {
      this.nextOffer();
    }, 2000);
  }

  stopAutoSlide(): void {
    if (this.autoSlideTimer) {
      clearInterval(this.autoSlideTimer);
      this.autoSlideTimer = null;
    }
  }

  restartTimer(): void {
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  nextOffer(): void {
    if (this.loopLength <= 1 || this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentOfferIndex++;

    if (this.currentOfferIndex === this.loopLength) {
      setTimeout(() => {
        this.noTransition = true;
        this.currentOfferIndex = 0;
        setTimeout(() => {
          this.noTransition = false;
          this.isTransitioning = false;
        }, 50);
      }, 650);
    } else {
      setTimeout(() => {
        this.isTransitioning = false;
      }, 650);
    }
  }

  prevOffer(): void {
    if (this.loopLength <= 1 || this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.currentOfferIndex === 0) {
      this.noTransition = true;
      this.currentOfferIndex = this.loopLength;
      setTimeout(() => {
        this.noTransition = false;
        this.currentOfferIndex = this.loopLength - 1;
        setTimeout(() => {
          this.isTransitioning = false;
        }, 650);
      }, 50);
    } else {
      this.currentOfferIndex--;
      setTimeout(() => {
        this.isTransitioning = false;
      }, 650);
    }
  }

  goToOffer(index: number): void {
    if (this.isTransitioning) return;
    this.currentOfferIndex = index % this.loopLength;
    this.restartTimer();
  }

  copyOfferCode(code: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    this.copiedCode = code;
    setTimeout(() => {
      if (this.copiedCode === code) {
        this.copiedCode = null;
      }
    }, 2500);
  }
}