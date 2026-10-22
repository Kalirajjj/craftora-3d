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

export type OrderStatus = 
  | 'Pending' 
  | 'Confirmed' 
  | 'Printing' 
  | 'Shipped' 
  | 'Delivered' 
  | 'Cancelled' 
  | 'PENDING'
  | 'INVENTORY_RESERVED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PROCESSING'
  | 'CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'UNFULFILLABLE_REFUND_REQUIRED';

export type PaymentStatus = 
  | 'Paid' 
  | 'Prepaid' 
  | 'Pending' 
  | 'COD' 
  | 'Refund Pending' 
  | 'Refund Processed' 
  | 'Cancelled'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface CheckoutItemRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface CheckoutRequest {
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  totalAmount: number;
  shippingFee?: number;
  discountAmount?: number;
  items: CheckoutItemRequest[];
}

export interface CheckoutResponse {
  orderId: number;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  paymentOrderId: string;
  reservationIds: number[];
  customerEmail: string;
  keyId?: string;
}

export interface PaymentVerificationRequest {
  orderId: number;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  orderId: number;
  paymentId: string;
  paymentOrderId: string;
  status: string;
  orderStatus: string;
  amount: number;
  currency: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  title: string;
  description?: string;
  timestamp: string;
  actor: 'Customer' | 'Admin' | 'System';
  reason?: string;
}

export interface Order {
  id: string;
  customerId?: number;
  items: CartItem[];
  customer: CustomerInfo;
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  appliedCoupon?: string;
  total: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  transactionId?: string;
  paymentOrderId?: string;
  createdAt: string;
  shippingMethod?: string;
  courierPartner?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  cancellationReason?: string;
  cancelledBy?: 'Customer' | 'Admin';
  cancelledAt?: string;
  previousStatus?: OrderStatus;
  timeline?: OrderTimelineEvent[];
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
