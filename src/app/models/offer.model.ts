export type OfferType = 'FREE_DELIVERY' | 'FLAT_DISCOUNT' | 'PERCENTAGE_DISCOUNT';
export type OfferAudience = 'FIRST_TIME_BUYERS' | 'ALL_CUSTOMERS';

export interface Offer {
  id: string;
  title: string;
  code: string;
  description: string;
  type: OfferType;
  targetAudience: OfferAudience;
  discountAmount: number; // e.g., 50 for ₹50, or 10 for 10%
  minOrderAmount: number; // e.g., 299 for free delivery above ₹299
  bannerImageUrl: string; // Base64 data URI or image URL (Recommended: 1200x380 px)
  badgeText: string;      // e.g., '1ST ORDER SPECIAL', 'LIMITED TIME'
  buttonText: string;     // e.g., 'Claim Offer', 'Shop Now'
  buttonLink: string;     // e.g., '/shop'
  active: boolean;
  highlightColor?: string;// Custom accent/gradient theme
  createdAt: string;
}
