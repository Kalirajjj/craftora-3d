export interface Review {
  id: string | number;
  productId: string;
  customerId?: number;
  customerName: string;
  rating: number; // 1 to 5
  comment: string;
  images: string[];
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string; // ISO date string
  updatedAt?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface RatingDistribution {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: RatingDistribution;
}

export type ReviewSortOption = 'recent' | 'highest' | 'lowest' | 'helpful';

export interface ReviewQueryParams {
  rating?: number | null;
  withPhotosOnly?: boolean;
  sortBy?: ReviewSortOption;
  page?: number;
  limit?: number;
}

export interface ReviewsResponse {
  summary: ReviewSummary;
  reviews: Review[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}
