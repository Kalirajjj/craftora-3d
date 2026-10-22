import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfferService } from '../../../services/offer.service';
import { Offer, OfferType, OfferAudience } from '../../../models/offer.model';

@Component({
  selector: 'app-admin-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-offers.component.html',
  styleUrls: ['./admin-offers.component.css']
})
export class AdminOffersComponent implements OnInit {
  private offerService = inject(OfferService);

  offers: Offer[] = [];
  isLoading = false;
  isEditing = false;
  successMessage = '';
  errorMessage = '';

  // Form Model
  currentOffer: Partial<Offer> = this.getEmptyOfferModel();
  bannerImagePreview: string = '';
  bannerImageDimensions = '';

  // Preset Banners available for selection
  readonly presetBanners = [
    { label: 'Free Delivery (>₹299) Cyan/Teal', url: '/images/offers/free-delivery-299.svg' },
    { label: 'Flat ₹50 Off Magenta/Purple', url: '/images/offers/first-order-50.svg' }
  ];

  ngOnInit(): void {
    this.loadOffers();
  }

  loadOffers(): void {
    this.isLoading = true;
    this.offerService.getOffers().subscribe(data => {
      this.offers = data;
      this.isLoading = false;
    });
  }

  getEmptyOfferModel(): Partial<Offer> {
    return {
      title: '',
      code: '',
      description: '',
      type: 'FREE_DELIVERY',
      targetAudience: 'FIRST_TIME_BUYERS',
      discountAmount: 0,
      minOrderAmount: 299,
      bannerImageUrl: '/images/offers/free-delivery-299.svg',
      badgeText: '1ST ORDER SPECIAL',
      buttonText: 'Shop Now',
      buttonLink: '/shop',
      active: true,
      highlightColor: '#00A896'
    };
  }

  startCreateNew(): void {
    this.isEditing = true;
    this.currentOffer = this.getEmptyOfferModel();
    this.bannerImagePreview = this.currentOffer.bannerImageUrl || '';
    this.bannerImageDimensions = '1200 × 380 px (Recommended SVG)';
    this.clearNotices();
  }

  applyPreset(presetType: 'FREE_DELIVERY_299' | 'FLAT_50_OFF'): void {
    this.isEditing = true;
    this.clearNotices();

    if (presetType === 'FREE_DELIVERY_299') {
      this.currentOffer = {
        title: '1st Order Special: Free Delivery above ₹299',
        code: 'FIRST299',
        description: 'New customers enjoy 100% Free Shipping on their first 3D order when your cart total exceeds ₹299.',
        type: 'FREE_DELIVERY',
        targetAudience: 'FIRST_TIME_BUYERS',
        discountAmount: 0,
        minOrderAmount: 299,
        bannerImageUrl: '/images/offers/free-delivery-299.svg',
        badgeText: '1ST ORDER FREE DELIVERY',
        buttonText: 'Shop Now',
        buttonLink: '/shop',
        active: true,
        highlightColor: '#00A896'
      };
      this.bannerImagePreview = '/images/offers/free-delivery-299.svg';
      this.bannerImageDimensions = '1200 × 380 px (Preset Vector)';
    } else {
      this.currentOffer = {
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
        highlightColor: '#FF2E93'
      };
      this.bannerImagePreview = '/images/offers/first-order-50.svg';
      this.bannerImageDimensions = '1200 × 380 px (Preset Vector)';
    }
  }

  editOffer(offer: Offer): void {
    this.isEditing = true;
    this.currentOffer = { ...offer };
    this.bannerImagePreview = offer.bannerImageUrl || '';
    this.bannerImageDimensions = 'Current Active Banner';
    this.clearNotices();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.currentOffer = this.getEmptyOfferModel();
    this.bannerImagePreview = '';
    this.clearNotices();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      this.errorMessage = 'Image size exceeds 4MB. Please upload a compressed image.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.bannerImagePreview = result;
      this.currentOffer.bannerImageUrl = result;

      // Check image natural dimensions
      const img = new Image();
      img.onload = () => {
        this.bannerImageDimensions = `${img.naturalWidth} × ${img.naturalHeight} px`;
        if (img.naturalWidth < 800) {
          this.errorMessage = `Image width is ${img.naturalWidth}px. For best single-row display on the home page, 1200×380 px or higher is recommended.`;
        } else {
          this.errorMessage = '';
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  selectPresetBanner(url: string): void {
    this.currentOffer.bannerImageUrl = url;
    this.bannerImagePreview = url;
    this.bannerImageDimensions = '1200 × 380 px (Preset Vector)';
  }

  toggleActive(offer: Offer): void {
    this.offerService.toggleOfferStatus(offer.id).subscribe(updated => {
      if (updated) {
        offer.active = updated.active;
        this.showSuccess(`Offer "${offer.title}" is now ${offer.active ? 'Active' : 'Inactive'}.`);
      }
    });
  }

  deleteOffer(offer: Offer): void {
    if (!confirm(`Are you sure you want to delete the offer "${offer.title}"?`)) return;

    this.offerService.deleteOffer(offer.id).subscribe(success => {
      if (success) {
        this.offers = this.offers.filter(o => o.id !== offer.id);
        this.showSuccess('Offer deleted successfully.');
        if (this.currentOffer.id === offer.id) {
          this.cancelEdit();
        }
      }
    });
  }

  saveOffer(): void {
    if (!this.currentOffer.title || !this.currentOffer.code) {
      this.errorMessage = 'Please provide an Offer Title and Coupon Code.';
      return;
    }

    if (!this.currentOffer.bannerImageUrl) {
      this.errorMessage = 'Please upload a banner image or select a preset banner for the home page.';
      return;
    }

    // Auto-adjust values
    if (this.currentOffer.type === 'FREE_DELIVERY') {
      this.currentOffer.discountAmount = 0;
      if (this.currentOffer.minOrderAmount === undefined || this.currentOffer.minOrderAmount === null) {
        this.currentOffer.minOrderAmount = 299;
      }
    }

    this.offerService.saveOffer(this.currentOffer).subscribe(saved => {
      this.showSuccess(`Offer "${saved.title}" saved successfully!`);
      this.loadOffers();
      this.isEditing = false;
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 4000);
  }

  private clearNotices(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
