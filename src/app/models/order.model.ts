import { Product } from './product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor: string;
}

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  customer: CustomerInfo;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: 'Pending' | 'Confirmed' | 'Printing' | 'Shipped' | 'Delivered';
  createdAt: string;
}

export interface CustomOrderRequest {
  id?: number;
  referenceCode?: string;
  name: string;
  email: string;
  phone: string;
  productType: string;
  description: string;
  preferredColor: string;
  quantity: number;
  requiredDate: string;
  additionalNotes?: string;
  fileName?: string;
  attachmentName?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  attachmentUrl?: string;
  createdAt?: string;
  deleted?: boolean;
  deletedAt?: string;
}

export interface QuoteTrackingResult {
  referenceCode: string;
  productType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  requiredDate: string | null;
}
