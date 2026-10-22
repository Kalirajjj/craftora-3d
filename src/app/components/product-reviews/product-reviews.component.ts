import { Component, Input, Output, EventEmitter, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ReviewService } from '../../services/review.service';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { Review, ReviewSummary, ReviewSortOption } from '../../models/review.model';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-reviews.component.html',
  styleUrls: ['./product-reviews.component.css']
})
export class ProductReviewsComponent implements OnInit {
  @Input({ required: true }) productId!: string | number;
  @Input() productName: string = '';
  @Output() summaryChange = new EventEmitter<ReviewSummary>();

  private reviewService = inject(ReviewService);
  private customerAuth = inject(CustomerAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Reviews Data
  summary: ReviewSummary = {
    averageRating: 0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  };
  reviews: Review[] = [];
  userReview: Review | null = null;
  isLoading = false;
  hasMore = false;
  totalFilteredReviews = 0;

  // Pagination & Filtering
  currentPage = 0;
  readonly pageSize = 5;
  selectedStarFilter: number | null = null;
  onlyWithPhotos = false;
  selectedSort: ReviewSortOption = 'recent';

  // Review Form State
  isFormOpen = false;
  isEditing = false;
  editingReviewId: string | number | null = null;
  formRating = 0;
  hoverRating = 0;
  formComment = '';
  formImages: string[] = [];
  isSubmitting = false;
  formError = '';
  successMessage = '';

  // Auth & Action Modals
  showAuthPrompt = false;
  showDeleteModal = false;
  reviewToDeleteId: string | number | null = null;

  // Lightbox Image Viewer
  lightboxOpen = false;
  lightboxImages: string[] = [];
  lightboxIndex = 0;

  readonly ratingLabels: { [key: number]: string } = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };

  get isLoggedIn(): boolean {
    return this.customerAuth.isSignedIn();
  }

  get customerName(): string {
    const cust = this.customerAuth.customer();
    return cust?.fullName || 'Verified Customer';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) {
      this.closeLightbox();
    } else if (this.showDeleteModal) {
      this.cancelDelete();
    } else if (this.showAuthPrompt) {
      this.closeAuthPrompt();
    }
  }

  ngOnInit(): void {
    this.loadReviews(true);

    // Check query params to auto-open review form if returning from login
    this.route.queryParams.subscribe(params => {
      if (params['writeReview'] === 'true' && this.isLoggedIn) {
        this.openReviewForm();
      }
    });
  }

  loadReviews(resetPage: boolean = false): void {
    if (resetPage) {
      this.currentPage = 0;
    }
    this.isLoading = true;

    this.reviewService.getReviews(String(this.productId), {
      rating: this.selectedStarFilter,
      withPhotosOnly: this.onlyWithPhotos,
      sortBy: this.selectedSort,
      page: this.currentPage,
      limit: this.pageSize
    }).subscribe(res => {
      this.isLoading = false;
      this.summary = res.summary;
      this.reviews = res.reviews;
      this.totalFilteredReviews = res.totalElements;
      this.hasMore = res.hasMore;
      this.summaryChange.emit(this.summary);

      // Check if logged-in customer already wrote a review
      if (this.isLoggedIn) {
        this.checkUserReview();
      }
    });
  }

  loadMoreReviews(): void {
    this.currentPage++;
    this.isLoading = true;

    this.reviewService.getReviews(String(this.productId), {
      rating: this.selectedStarFilter,
      withPhotosOnly: this.onlyWithPhotos,
      sortBy: this.selectedSort,
      page: this.currentPage,
      limit: this.pageSize
    }).subscribe(res => {
      this.isLoading = false;
      this.reviews = res.reviews;
      this.hasMore = res.hasMore;
    });
  }

  checkUserReview(): void {
    const cust = this.customerAuth.customer();
    this.reviewService.getUserReview(String(this.productId), cust).subscribe(existing => {
      this.userReview = existing;
    });
  }

  getStarDistributionPercentage(star: number): number {
    if (!this.summary || this.summary.totalReviews === 0) return 0;
    const count = this.summary.distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
    return Math.round((count / this.summary.totalReviews) * 100);
  }

  getStarCount(star: number): number {
    if (!this.summary) return 0;
    return this.summary.distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
  }

  setStarFilter(star: number | null): void {
    if (this.selectedStarFilter === star) {
      this.selectedStarFilter = null; // Toggle off
    } else {
      this.selectedStarFilter = star;
    }
    this.loadReviews(true);
  }

  togglePhotosFilter(): void {
    this.onlyWithPhotos = !this.onlyWithPhotos;
    this.loadReviews(true);
  }

  onSortChange(): void {
    this.loadReviews(true);
  }

  // =========================================================================
  // Review Action & Form
  // =========================================================================
  onWriteReviewClick(): void {
    if (!this.isLoggedIn) {
      this.showAuthPrompt = true;
      return;
    }

    if (this.userReview) {
      // User has already reviewed: edit mode
      this.startEditReview(this.userReview);
    } else {
      this.openReviewForm();
    }
  }

  openReviewForm(): void {
    this.isEditing = false;
    this.editingReviewId = null;
    this.formRating = 0;
    this.hoverRating = 0;
    this.formComment = '';
    this.formImages = [];
    this.formError = '';
    this.isFormOpen = true;
  }

  startEditReview(review: Review): void {
    this.isEditing = true;
    this.editingReviewId = review.id;
    this.formRating = review.rating;
    this.hoverRating = 0;
    this.formComment = review.comment;
    this.formImages = [...(review.images || [])];
    this.formError = '';
    this.isFormOpen = true;
  }

  closeReviewForm(): void {
    this.isFormOpen = false;
    this.isEditing = false;
    this.editingReviewId = null;
    this.formRating = 0;
    this.hoverRating = 0;
    this.formComment = '';
    this.formImages = [];
    this.formError = '';
  }

  setRating(rating: number): void {
    this.formRating = rating;
  }

  setHoverRating(rating: number): void {
    this.hoverRating = rating;
  }

  clearHoverRating(): void {
    this.hoverRating = 0;
  }

  get displayedRatingLabel(): string {
    const rate = this.hoverRating || this.formRating;
    return rate > 0 ? `${rate} / 5 — ${this.ratingLabels[rate]}` : 'Select your rating';
  }

  // Multiple Image Upload
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    this.processImageFiles(files);
    input.value = ''; // Reset file input
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer || !event.dataTransfer.files) return;

    const files = Array.from(event.dataTransfer.files);
    this.processImageFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private processImageFiles(files: File[]): void {
    const remainingSlots = 5 - this.formImages.length;
    if (remainingSlots <= 0) {
      this.formError = 'You can upload up to 5 photos.';
      return;
    }

    const validFiles = files.slice(0, remainingSlots);
    for (const file of validFiles) {
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
        this.formError = 'Please upload JPG, PNG, or WebP images only.';
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.formError = `File "${file.name}" exceeds 5MB limit.`;
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && this.formImages.length < 5) {
          this.formImages.push(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeFormImage(index: number): void {
    this.formImages.splice(index, 1);
  }

  submitReview(): void {
    if (!this.isLoggedIn) {
      this.showAuthPrompt = true;
      return;
    }

    this.formError = '';

    if (this.formRating < 1 || this.formRating > 5) {
      this.formError = 'Please select a star rating between 1 and 5.';
      return;
    }

    if (!this.formComment.trim()) {
      this.formError = 'Please write a review comment.';
      return;
    }

    this.isSubmitting = true;
    const cust = this.customerAuth.customer()!;

    if (this.isEditing && this.editingReviewId) {
      this.reviewService.updateReview(this.editingReviewId, {
        rating: this.formRating,
        comment: this.formComment,
        images: this.formImages
      }).subscribe(res => {
        this.isSubmitting = false;
        if (res.success) {
          this.closeReviewForm();
          this.successMessage = 'Your review has been updated successfully!';
          this.loadReviews(true);
          setTimeout(() => this.successMessage = '', 6000);
        } else {
          this.formError = res.message || 'Failed to update review.';
        }
      });
    } else {
      this.reviewService.submitReview(String(this.productId), {
        rating: this.formRating,
        comment: this.formComment,
        images: this.formImages
      }, cust).subscribe(res => {
        this.isSubmitting = false;
        if (res.success) {
          this.closeReviewForm();
          this.successMessage = 'Thank you for your review! Your feedback helps our 3D community.';
          this.loadReviews(true);
          setTimeout(() => this.successMessage = '', 6000);
        } else {
          this.formError = res.message || 'Failed to submit review.';
        }
      });
    }
  }

  // =========================================================================
  // Delete Review
  // =========================================================================
  promptDeleteReview(reviewId: string | number): void {
    this.reviewToDeleteId = reviewId;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.reviewToDeleteId = null;
  }

  confirmDeleteReview(): void {
    if (!this.reviewToDeleteId) return;

    this.reviewService.deleteReview(this.reviewToDeleteId).subscribe(res => {
      this.showDeleteModal = false;
      this.reviewToDeleteId = null;
      if (res.success) {
        this.userReview = null;
        this.successMessage = 'Your review has been removed.';
        this.loadReviews(true);
        setTimeout(() => this.successMessage = '', 4000);
      }
    });
  }

  // =========================================================================
  // Helpful Interaction
  // =========================================================================
  markReviewHelpful(review: Review): void {
    this.reviewService.markHelpful(review.id).subscribe(res => {
      review.helpfulCount = res.helpfulCount;
    });
  }

  // =========================================================================
  // Lightbox Image Viewer
  // =========================================================================
  openLightbox(images: string[], index: number = 0): void {
    this.lightboxImages = images;
    this.lightboxIndex = index;
    this.lightboxOpen = true;
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    this.lightboxImages = [];
    this.lightboxIndex = 0;
  }

  nextLightboxImage(): void {
    if (this.lightboxImages.length <= 1) return;
    this.lightboxIndex = (this.lightboxIndex + 1) % this.lightboxImages.length;
  }

  prevLightboxImage(): void {
    if (this.lightboxImages.length <= 1) return;
    this.lightboxIndex = (this.lightboxIndex - 1 + this.lightboxImages.length) % this.lightboxImages.length;
  }

  // =========================================================================
  // Auth Prompt Modal
  // =========================================================================
  closeAuthPrompt(): void {
    this.showAuthPrompt = false;
  }

  goToSignIn(): void {
    this.showAuthPrompt = false;
    const currentUrl = `/product/${this.productId}?writeReview=true`;
    this.router.navigate(['/account/login'], { queryParams: { returnUrl: currentUrl } });
  }

  goToRegister(): void {
    this.showAuthPrompt = false;
    const currentUrl = `/product/${this.productId}?writeReview=true`;
    this.router.navigate(['/account/register'], { queryParams: { returnUrl: currentUrl } });
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }
}
