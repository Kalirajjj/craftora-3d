export interface Product {
  id: string | number;
  name: string;
  category?: string;
  price: number;
  description: string;
  image?: string;
  imageUrl?: string; // Supports both image and imageUrl
  images?: ProductImage[];
  availableColors?: string[];
  rating?: number;
  featured?: boolean;
  dimensions?: string;
  weightGrams?: number;
  inStock?: boolean;
  slug?: string;
  badge?: string;
}

export interface ProductImage {
  id?: number;
  url: string;
  displayOrder: number;
}
