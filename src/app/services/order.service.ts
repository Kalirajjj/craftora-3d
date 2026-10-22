import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Order, OrderStatus, PaymentStatus, OrderTimelineEvent, CartItem, CheckoutRequest, CheckoutResponse, PaymentVerificationRequest, PaymentVerificationResponse } from '../models/order.model';
import { CURATED_PRODUCTS } from '../data/curated-products';
import { CustomerAuthService, CustomerProfile } from './customer-auth.service';
import { AdminAuthService } from './admin-auth.service';
import { AppConfigService } from './app-config.service';

const STORAGE_KEY = 'craftora_orders';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private customerAuth = inject(CustomerAuthService);
  private adminAuth = inject(AdminAuthService);
  private config = inject(AppConfigService);

  private get checkoutApiUrl(): string {
    return `${this.config.apiGatewayUrl}/api/orders/checkout`;
  }
  private get ordersApiUrl(): string {
    return `${this.config.apiGatewayUrl}/api/orders`;
  }
  private get customerOrdersApiUrl(): string {
    return `${this.config.apiGatewayUrl}/api/customer/orders`;
  }
  private get adminOrdersApiUrl(): string {
    return `${this.config.apiGatewayUrl}/api/admin/orders`;
  }

  constructor() {
    this.ensureSeedOrders();
  }


  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private ensureSeedOrders(): void {
    if (!this.isBrowser()) return;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        const parsed: Order[] = JSON.parse(existing);
        // Ensure seed orders have timeline if missing
        let updated = false;
        parsed.forEach(o => {
          if (!o.timeline || o.timeline.length === 0) {
            o.timeline = this.generateDefaultTimeline(o);
            updated = true;
          }
          if (!o.paymentStatus) {
            o.paymentStatus = o.status === 'Cancelled' ? 'Cancelled' : 'Paid';
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        return;
      } catch {
        // reseed
      }
    }

    const now = Date.now();

    // Default curated seed demo orders for immediate testing across multiple states
    const seedOrders: Order[] = [
      {
        id: 'CRF-10245',
        customerId: 1,
        items: [
          {
            product: CURATED_PRODUCTS[2] || {
              id: 17,
              slug: 'geometric-voronoi-table-lamp',
              name: 'Voronoi Ambient Glow Lamp',
              price: 1899,
              category: 'Lamps & Lighting',
              description: 'Organic cellular Voronoi lattice with ambient warm core illumination.',
              rating: 4.9,
              reviewsCount: 38,
              image: '/images/products/voronoi-lamp.svg',
              imageUrl: '/images/products/voronoi-lamp.svg',
              images: [],
              colors: ['Matte White', 'Warm Amber', 'Teal'],
              dimensions: '14 × 14 × 22 cm',
              material: 'Bio-Polymer PLA',
              featured: true,
              inStock: true
            },
            quantity: 1,
            selectedColor: 'Matte White'
          }
        ],
        customer: {
          fullName: 'Arun Kumar',
          email: 'arun.kumar@gmail.com',
          phone: '+91 98401 23456',
          address: '42, Innovation Street, Indiranagar',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560038'
        },
        subtotal: 1899,
        deliveryFee: 0,
        total: 1899,
        status: 'Printing',
        paymentStatus: 'Paid',
        paymentMethod: 'Prepaid (UPI)',
        transactionId: 'TXN-94810234',
        shippingMethod: 'Express Air Courier',
        trackingNumber: 'BLUEDART-849201IN',
        courierPartner: 'BlueDart Aviation',
        estimatedDelivery: '05 Oct 2026',
        createdAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
        timeline: [
          {
            status: 'Pending',
            title: 'Order Placed',
            description: 'Order submitted by customer via Craftora online studio.',
            timestamp: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
            actor: 'Customer'
          },
          {
            status: 'Confirmed',
            title: 'Payment Confirmed',
            description: 'UPI transaction verified (TXN-94810234). Order confirmed for atelier queue.',
            timestamp: new Date(now - 1000 * 60 * 60 * 17).toISOString(),
            actor: 'System'
          },
          {
            status: 'Printing',
            title: 'Printing Started',
            description: '0.12mm precision additive layer fabrication initiated. Production active.',
            timestamp: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
            actor: 'Admin'
          }
        ]
      },
      {
        id: 'CRF-982144',
        customerId: 2,
        items: [
          {
            product: CURATED_PRODUCTS[1] || {
              id: 16,
              slug: 'cyber-samurai-bust',
              name: 'Cyberpunk Oni Mechanical Mask',
              price: 2499,
              category: 'Art & Collectibles',
              description: 'High-detail wearable mechanical demon mask with dual-tone finish.',
              rating: 4.95,
              reviewsCount: 64,
              image: '/images/products/cyber-samurai.svg',
              imageUrl: '/images/products/cyber-samurai.svg',
              images: [],
              colors: ['Obsidian Black', 'Cyber Crimson'],
              dimensions: '18 × 15 × 24 cm',
              material: 'Engineering Tough Resin',
              featured: true,
              inStock: true
            },
            quantity: 1,
            selectedColor: 'Obsidian Black'
          }
        ],
        customer: {
          fullName: 'Priya Sharma',
          email: 'priya.sharma@craftora.in',
          phone: '+91 97890 54321',
          address: '77, Besant Nagar Beach Avenue',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600090'
        },
        subtotal: 2499,
        deliveryFee: 0,
        total: 2499,
        status: 'Confirmed',
        paymentStatus: 'Paid',
        paymentMethod: 'Prepaid (Card)',
        transactionId: 'TXN-88192031',
        shippingMethod: 'Express Studio Dispatch',
        courierPartner: 'DTDC Priority Express',
        estimatedDelivery: '06 Oct 2026',
        createdAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
        timeline: [
          {
            status: 'Pending',
            title: 'Order Placed',
            description: 'Customer order placed online.',
            timestamp: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
            actor: 'Customer'
          },
          {
            status: 'Confirmed',
            title: 'Order Confirmed',
            description: 'Payment authorized and queued for atelier slicing.',
            timestamp: new Date(now - 1000 * 60 * 60 * 7).toISOString(),
            actor: 'Admin'
          }
        ]
      },
      {
        id: 'CRF-612048',
        customerId: 1,
        items: [
          {
            product: CURATED_PRODUCTS[5] || {
              id: 20,
              slug: 'minimalist-low-poly-succulent-planter',
              name: 'Architectural Geometric Planter',
              price: 749,
              category: 'Planters',
              description: 'Minimalist faceted succulent planter with integrated drainage reservoir.',
              rating: 4.8,
              reviewsCount: 42,
              image: '/images/products/succulent-planter.svg',
              imageUrl: '/images/products/succulent-planter.svg',
              images: [],
              colors: ['Stone White', 'Terracotta', 'Sage'],
              dimensions: '10 × 10 × 9 cm',
              material: 'Stone Composite PLA',
              featured: true,
              inStock: true
            },
            quantity: 2,
            selectedColor: 'Stone White'
          }
        ],
        customer: {
          fullName: 'Kaliraj K',
          email: 'kaliraj@craftora3d.com',
          phone: '+91 93614 16827',
          address: '42, Design Studio Street, OMR',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600096'
        },
        subtotal: 1498,
        deliveryFee: 0,
        total: 1498,
        status: 'Shipped',
        paymentStatus: 'Paid',
        paymentMethod: 'Prepaid (UPI)',
        transactionId: 'TXN-71829304',
        shippingMethod: 'Air Express Priority',
        trackingNumber: 'DTDC-CHN-91823',
        courierPartner: 'DTDC Air Express',
        estimatedDelivery: '04 Oct 2026',
        createdAt: new Date(now - 1000 * 60 * 60 * 42).toISOString(),
        timeline: [
          {
            status: 'Pending',
            title: 'Order Placed',
            timestamp: new Date(now - 1000 * 60 * 60 * 42).toISOString(),
            actor: 'Customer'
          },
          {
            status: 'Confirmed',
            title: 'Order Confirmed',
            timestamp: new Date(now - 1000 * 60 * 60 * 41).toISOString(),
            actor: 'System'
          },
          {
            status: 'Printing',
            title: 'Printing Started',
            description: 'Printed using Stone Composite PLA filament.',
            timestamp: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
            actor: 'Admin'
          },
          {
            status: 'Shipped',
            title: 'Dispatched to Courier',
            description: 'Handed over to DTDC Air Express (AWB: DTDC-CHN-91823).',
            timestamp: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
            actor: 'Admin'
          }
        ]
      },
      {
        id: 'CRF-438902',
        customerId: 3,
        items: [
          {
            product: CURATED_PRODUCTS[2] || {
              id: 17,
              slug: 'geometric-voronoi-table-lamp',
              name: 'Parametric Spiral Amphora',
              price: 1299,
              category: 'Vases & Decor',
              description: 'Mathematically generated continuous helical vase.',
              rating: 4.88,
              reviewsCount: 29,
              image: '/images/products/geometric-vase.svg',
              imageUrl: '/images/products/geometric-vase.svg',
              images: [],
              colors: ['Copper Silk', 'Pearl White'],
              dimensions: '12 × 12 × 26 cm',
              material: 'Silk PLA Formula',
              featured: false,
              inStock: true
            },
            quantity: 1,
            selectedColor: 'Copper Silk'
          }
        ],
        customer: {
          fullName: 'Divya Ramesh',
          email: 'divya.ramesh@gmail.com',
          phone: '+91 94440 98765',
          address: '15, Anna Nagar West Extension',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600101'
        },
        subtotal: 1299,
        deliveryFee: 0,
        total: 1299,
        status: 'Delivered',
        paymentStatus: 'Paid',
        paymentMethod: 'Prepaid (Card)',
        transactionId: 'TXN-66291045',
        shippingMethod: 'Surface Priority',
        trackingNumber: 'DELHIVERY-7749102',
        courierPartner: 'Delhivery Surface',
        estimatedDelivery: '02 Oct 2026',
        createdAt: new Date(now - 1000 * 60 * 60 * 96).toISOString(),
        timeline: [
          {
            status: 'Pending',
            title: 'Order Placed',
            timestamp: new Date(now - 1000 * 60 * 60 * 96).toISOString(),
            actor: 'Customer'
          },
          {
            status: 'Confirmed',
            title: 'Order Confirmed',
            timestamp: new Date(now - 1000 * 60 * 60 * 95).toISOString(),
            actor: 'System'
          },
          {
            status: 'Printing',
            title: 'Printing Started',
            timestamp: new Date(now - 1000 * 60 * 60 * 80).toISOString(),
            actor: 'Admin'
          },
          {
            status: 'Shipped',
            title: 'Shipped',
            timestamp: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
            actor: 'Admin'
          },
          {
            status: 'Delivered',
            title: 'Delivered',
            description: 'Package delivered and signed by customer recipient.',
            timestamp: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
            actor: 'System'
          }
        ]
      },
      {
        id: 'CRF-329104',
        customerId: 4,
        items: [
          {
            product: CURATED_PRODUCTS[2] || {
              id: 17,
              slug: 'geometric-voronoi-table-lamp',
              name: 'Voronoi Ambient Glow Lamp',
              price: 1899,
              category: 'Lamps & Lighting',
              description: 'Organic cellular Voronoi lattice with ambient warm core illumination.',
              rating: 4.9,
              reviewsCount: 38,
              image: '/images/products/voronoi-lamp.svg',
              imageUrl: '/images/products/voronoi-lamp.svg',
              images: [],
              colors: ['Matte White'],
              dimensions: '14 × 14 × 22 cm',
              material: 'Bio-Polymer PLA',
              featured: true,
              inStock: true
            },
            quantity: 1,
            selectedColor: 'Matte White'
          }
        ],
        customer: {
          fullName: 'Karthik Raja',
          email: 'karthik.raja@outlook.com',
          phone: '+91 98840 11223',
          address: '22, T. Nagar South Boag Road',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600017'
        },
        subtotal: 1899,
        deliveryFee: 0,
        total: 1899,
        status: 'Cancelled',
        previousStatus: 'Confirmed',
        paymentStatus: 'Refund Pending',
        paymentMethod: 'Prepaid (UPI)',
        transactionId: 'TXN-55443322',
        cancellationReason: 'Customer requested change of shipping address and color variant before printing started.',
        cancelledBy: 'Customer',
        cancelledAt: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
        createdAt: new Date(now - 1000 * 60 * 60 * 16).toISOString(),
        timeline: [
          {
            status: 'Pending',
            title: 'Order Placed',
            timestamp: new Date(now - 1000 * 60 * 60 * 16).toISOString(),
            actor: 'Customer'
          },
          {
            status: 'Confirmed',
            title: 'Order Confirmed',
            timestamp: new Date(now - 1000 * 60 * 60 * 15).toISOString(),
            actor: 'System'
          },
          {
            status: 'Cancelled',
            title: 'Order Cancelled by Customer',
            description: 'Reason: Customer requested change of shipping address and color variant before printing started.',
            timestamp: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
            actor: 'Customer',
            reason: 'Customer requested change of shipping address and color variant before printing started.'
          }
        ]
      },
      {
        id: 'CRF-210543',
        customerId: 5,
        items: [
          {
            product: CURATED_PRODUCTS[1] || {
              id: 16,
              slug: 'cyber-samurai-bust',
              name: 'Cyberpunk Oni Mechanical Mask',
              price: 2499,
              category: 'Art & Collectibles',
              description: 'High-detail wearable mechanical demon mask with dual-tone finish.',
              rating: 4.95,
              reviewsCount: 64,
              image: '/images/products/cyber-samurai.svg',
              imageUrl: '/images/products/cyber-samurai.svg',
              images: [],
              colors: ['Cyber Crimson'],
              dimensions: '18 × 15 × 24 cm',
              material: 'Engineering Tough Resin',
              featured: true,
              inStock: true
            },
            quantity: 1,
            selectedColor: 'Cyber Crimson'
          }
        ],
        customer: {
          fullName: 'Meera Nambiar',
          email: 'meera.nambiar@yahoo.com',
          phone: '+91 97451 88990',
          address: '88, MG Road, Marine Drive',
          city: 'Kochi',
          state: 'Kerala',
          pincode: '682011'
        },
        subtotal: 2499,
        deliveryFee: 0,
        total: 2499,
        status: 'Pending',
        paymentStatus: 'Pending',
        paymentMethod: 'Prepaid (Net Banking)',
        transactionId: 'TXN-44332211',
        shippingMethod: 'Express Air Courier',
        courierPartner: 'Express Studio Dispatch',
        estimatedDelivery: '07 Oct 2026',
        createdAt: new Date(now - 1000 * 60 * 35).toISOString(), // 35 min ago
        timeline: [
          {
            status: 'Pending',
            title: 'Order Placed',
            description: 'Order placed online, awaiting atelier queue review.',
            timestamp: new Date(now - 1000 * 60 * 35).toISOString(),
            actor: 'Customer'
          }
        ]
      }
    ];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedOrders));
    } catch {
      // ignore
    }
  }

  private generateDefaultTimeline(order: Order): OrderTimelineEvent[] {
    const list: OrderTimelineEvent[] = [
      {
        status: 'Pending',
        title: 'Order Placed',
        description: 'Customer order placed in Craftora 3D atelier.',
        timestamp: order.createdAt,
        actor: 'Customer'
      }
    ];

    if (order.status !== 'Pending') {
      list.push({
        status: 'Confirmed',
        title: 'Order Confirmed',
        description: 'Payment authorized and queued for production.',
        timestamp: order.createdAt,
        actor: 'System'
      });
    }

    if (order.status === 'Printing' || order.status === 'Shipped' || order.status === 'Delivered') {
      list.push({
        status: 'Printing',
        title: '3D Printing Started',
        description: 'Additive layer manufacturing active in atelier.',
        timestamp: order.createdAt,
        actor: 'Admin'
      });
    }

    if (order.status === 'Shipped' || order.status === 'Delivered') {
      list.push({
        status: 'Shipped',
        title: 'Dispatched in Transit',
        description: `Handed over to ${order.courierPartner || 'courier partner'}.`,
        timestamp: order.createdAt,
        actor: 'Admin'
      });
    }

    if (order.status === 'Delivered') {
      list.push({
        status: 'Delivered',
        title: 'Order Delivered',
        description: 'Package delivered safely.',
        timestamp: order.createdAt,
        actor: 'System'
      });
    }

    if (order.status === 'Cancelled') {
      list.push({
        status: 'Cancelled',
        title: order.cancelledBy === 'Admin' ? 'Cancelled by Admin' : 'Cancelled by Customer',
        description: order.cancellationReason || 'Order cancellation processed.',
        timestamp: order.cancelledAt || order.createdAt,
        actor: order.cancelledBy || 'System'
      });
    }

    return list;
  }

  checkout(request: CheckoutRequest, idempotencyKey: string): Observable<CheckoutResponse> {
    const headers = this.customerAuth.authorizationHeaders()
      .set('Idempotency-Key', idempotencyKey.trim());

    return this.http.post<CheckoutResponse>(this.checkoutApiUrl, request, { headers });
  }

  recordPlacedOrder(newOrder: Order): void {
    if (!this.isBrowser()) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: Order[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(o => String(o.id) === String(newOrder.id));
      if (idx >= 0) {
        list[idx] = newOrder;
      } else {
        list.unshift(newOrder);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Could not persist order to local storage:', err);
    }
  }

  createOrder(orderData: Partial<Order>): Observable<Order> {
    const createdAt = new Date().toISOString();
    const initialTimeline: OrderTimelineEvent[] = [
      {
        status: 'Pending',
        title: 'Order Placed',
        description: 'Order placed by customer via Craftora online studio.',
        timestamp: createdAt,
        actor: 'Customer'
      },
      {
        status: 'Confirmed',
        title: 'Payment Confirmed',
        description: 'Payment successfully processed. Production queued.',
        timestamp: createdAt,
        actor: 'System'
      }
    ];

    const newOrder: Order = {
      id: orderData.id || ('CRF-' + Math.floor(100000 + Math.random() * 900000)),
      customerId: orderData.customerId,
      items: orderData.items || [],
      customer: orderData.customer!,
      subtotal: orderData.subtotal || 0,
      deliveryFee: orderData.deliveryFee || 0,
      discount: orderData.discount,
      appliedCoupon: orderData.appliedCoupon,
      total: orderData.total || 0,
      status: (orderData.status as OrderStatus) || 'Confirmed',
      paymentStatus: (orderData.paymentStatus as PaymentStatus) || 'Paid',
      paymentMethod: orderData.paymentMethod || 'Prepaid',
      transactionId: orderData.transactionId || ('TXN-' + Math.floor(10000000 + Math.random() * 90000000)),
      paymentOrderId: orderData.paymentOrderId,
      shippingMethod: orderData.shippingMethod || 'Standard Studio Air Dispatch',
      courierPartner: orderData.courierPartner || 'Express Studio Dispatch',
      estimatedDelivery: '3 - 5 business days',
      createdAt: createdAt,
      timeline: initialTimeline
    };

    this.recordPlacedOrder(newOrder);
    return of(newOrder);
  }

  getAllOrders(): Observable<Order[]> {
    if (!this.isBrowser()) return of([]);
    if (this.adminAuth.isAuthenticated()) {
      return this.http.get<any[]>(this.adminOrdersApiUrl, {
        headers: this.adminAuth.authorizationHeaders()
      }).pipe(
        map(backendOrders => {
          if (!Array.isArray(backendOrders) || backendOrders.length === 0) {
            return this.getLocalAllOrders();
          }
          const mapped = backendOrders.map(bo => this.mapBackendOrderToFrontend(bo));
          const local = this.getLocalAllOrders();
          const backendIds = new Set(mapped.map(o => String(o.id)));
          const uniqueLocal = local.filter(o => !backendIds.has(String(o.id)));
          return [...mapped, ...uniqueLocal];
        }),
        catchError(() => of(this.getLocalAllOrders()))
      );
    }

    return of(this.getLocalAllOrders());
  }

  private getLocalAllOrders(): Order[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: Order[] = raw ? JSON.parse(raw) : [];
      list.forEach(o => {
        if (!o.timeline) o.timeline = this.generateDefaultTimeline(o);
        if (!o.paymentStatus) o.paymentStatus = o.status === 'Cancelled' ? 'Cancelled' : 'Paid';
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list;
    } catch {
      return [];
    }
  }

  getCustomerOrders(customer: CustomerProfile | null): Observable<Order[]> {
    if (!this.isBrowser() || !customer) return of([]);

    if (this.customerAuth.isSignedIn()) {
      return this.http.get<any[]>(this.customerOrdersApiUrl, {
        headers: this.customerAuth.authorizationHeaders()
      }).pipe(
        map(backendOrders => {
          if (!Array.isArray(backendOrders) || backendOrders.length === 0) {
            return this.getLocalCustomerOrders(customer);
          }
          const mapped = backendOrders.map(bo => this.mapBackendOrderToFrontend(bo));
          const local = this.getLocalCustomerOrders(customer);
          const backendIds = new Set(mapped.map(o => String(o.id)));
          const uniqueLocal = local.filter(o => !backendIds.has(String(o.id)));
          return [...mapped, ...uniqueLocal];
        }),
        catchError(() => of(this.getLocalCustomerOrders(customer)))
      );
    }

    return of(this.getLocalCustomerOrders(customer));
  }

  private getLocalCustomerOrders(customer: CustomerProfile): Order[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const allOrders: Order[] = JSON.parse(raw);

      const custEmail = customer.email?.trim().toLowerCase() || '';
      const custPhone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
      const custName = customer.fullName?.trim().toLowerCase() || '';

      const matched = allOrders.filter(o => {
        if (o.customerId && customer.id && o.customerId === customer.id) {
          return true;
        }

        const orderEmail = o.customer.email?.trim().toLowerCase() || '';
        const orderPhone = o.customer.phone ? o.customer.phone.replace(/\D/g, '') : '';
        const orderName = o.customer.fullName?.trim().toLowerCase() || '';

        if (custEmail && orderEmail && (orderEmail === custEmail || orderEmail.includes(custEmail) || custEmail.includes(orderEmail))) {
          return true;
        }

        if (custPhone && orderPhone && (orderPhone.endsWith(custPhone) || custPhone.endsWith(orderPhone))) {
          return true;
        }

        if (custName && orderName && (orderName.includes(custName) || custName.includes(orderName))) {
          return true;
        }

        return false;
      });

      matched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return matched;
    } catch {
      return [];
    }
  }

  getOrderById(orderId: string): Observable<Order | null> {
    if (!orderId || !this.isBrowser()) return of(null);
    const cleanId = orderId.trim().replace(/^#/, '');

    if (this.customerAuth.isSignedIn() && /^\d+$/.test(cleanId)) {
      return this.http.get<any>(`${this.ordersApiUrl}/${cleanId}`, {
        headers: this.customerAuth.authorizationHeaders()
      }).pipe(
        map(backendOrder => this.mapBackendOrderToFrontend(backendOrder)),
        catchError(() => this.getLocalOrderById(orderId))
      );
    }

    return this.getLocalOrderById(orderId);
  }

  private getLocalOrderById(orderId: string): Observable<Order | null> {
    if (!orderId || !this.isBrowser()) return of(null);
    const cleanId = orderId.trim().toUpperCase().replace(/^#/, '');

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return of(null);
      const list: Order[] = JSON.parse(raw);
      const match = list.find(o => String(o.id).toUpperCase().replace(/^#/, '') === cleanId);
      if (match && !match.timeline) {
        match.timeline = this.generateDefaultTimeline(match);
      }
      return of(match || null);
    } catch {
      return of(null);
    }
  }

  private mapBackendOrderToFrontend(backendOrder: any): Order {
    const rawItems = backendOrder.items || [];
    const mappedItems: CartItem[] = rawItems.map((bi: any) => {
      const prodId = Number(bi.productId);
      const matchedCurated = CURATED_PRODUCTS.find(cp => Number(cp.id) === prodId);
      const product: any = matchedCurated ? { ...matchedCurated, id: prodId, price: Number(bi.unitPrice != null ? bi.unitPrice : matchedCurated.price) } : {
        id: prodId,
        name: `Product #${prodId}`,
        price: Number(bi.unitPrice || 0),
        category: 'Catalogue',
        description: '',
        image: '/images/products/astronaut.svg',
        imageUrl: '/images/products/astronaut.svg',
        images: [],
        colors: ['Default'],
        inStock: true
      };
      return {
        product,
        quantity: bi.quantity || 1,
        selectedColor: bi.selectedColor || 'Default'
      };
    });

    const addr = backendOrder.shippingAddress || '';
    const customerInfo = {
      fullName: backendOrder.customerName || 'Customer',
      email: backendOrder.customerEmail || '',
      phone: '',
      address: addr,
      city: '',
      state: '',
      pincode: ''
    };

    const order: Order = {
      id: String(backendOrder.id),
      items: mappedItems,
      customer: customerInfo,
      subtotal: Number(backendOrder.totalAmount || 0),
      deliveryFee: 0,
      total: Number(backendOrder.totalAmount || 0),
      status: backendOrder.orderStatus,
      paymentStatus: backendOrder.paymentStatus,
      paymentOrderId: backendOrder.paymentOrderId,
      transactionId: backendOrder.paymentTransactionId,
      createdAt: backendOrder.createdAt || new Date().toISOString()
    };
    order.timeline = this.generateDefaultTimeline(order);
    return order;
  }

  /**
   * Strictly evaluates whether a customer is allowed to cancel an order based on current backend status.
   * Rule:
   * - Pending / Confirmed: CAN cancel
   * - Printing: CANNOT cancel ("production has started")
   * - Shipped: CANNOT cancel ("already been shipped")
   * - Delivered: CANNOT cancel ("order delivered")
   * - Cancelled: CANNOT cancel again
   */
  canCustomerCancel(status: OrderStatus): { allowed: boolean; reasonMessage?: string } {
    if (status === 'Pending' || status === 'Confirmed') {
      return { allowed: true };
    }
    if (status === 'Printing') {
      return {
        allowed: false,
        reasonMessage: 'This order can no longer be cancelled because production has started.'
      };
    }
    if (status === 'Shipped') {
      return {
        allowed: false,
        reasonMessage: 'This order can no longer be cancelled because it has already been shipped.'
      };
    }
    if (status === 'Delivered') {
      return {
        allowed: false,
        reasonMessage: 'This order has been delivered and cannot be cancelled.'
      };
    }
    if (status === 'Cancelled') {
      return {
        allowed: false,
        reasonMessage: 'This order is already cancelled.'
      };
    }
    return {
      allowed: false,
      reasonMessage: 'Order cannot be cancelled at this time.'
    };
  }

  /**
   * Cancel an order with strict server/service-side validation.
   */
  cancelOrder(
    orderId: string,
    cancelledBy: 'Customer' | 'Admin',
    reason?: string
  ): Observable<{ success: boolean; order?: Order; message?: string }> {
    if (!this.isBrowser()) return of({ success: false, message: 'Platform not supported' });

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return of({ success: false, message: 'Order repository not found' });
      const list: Order[] = JSON.parse(raw);
      const index = list.findIndex(o => o.id.toUpperCase() === orderId.trim().toUpperCase());

      if (index === -1) {
        return of({ success: false, message: `Order #${orderId} not found` });
      }

      const order = list[index];

      // If requested by Customer, strictly validate backend status
      if (cancelledBy === 'Customer') {
        const check = this.canCustomerCancel(order.status);
        if (!check.allowed) {
          return of({
            success: false,
            message: check.reasonMessage || 'This order cannot be cancelled.'
          });
        }
      }

      if (order.status === 'Cancelled') {
        return of({ success: false, message: 'Order is already cancelled' });
      }

      const timestamp = new Date().toISOString();
      const prevStatus = order.status;
      order.previousStatus = prevStatus;
      order.status = 'Cancelled';
      order.cancelledBy = cancelledBy;
      order.cancelledAt = timestamp;
      order.cancellationReason = reason || (cancelledBy === 'Admin' ? 'Administrative cancellation' : 'Cancelled by customer');

      // Rule 17: Payment / Refund Handling
      // "When a customer cancels an order: Do not automatically assume that a refund has happened...
      // Display an appropriate status such as Refund Pending or Refund Processed only when confirmed.
      // Never show 'Refunded' merely because the customer clicked Cancel."
      if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Prepaid') {
        order.paymentStatus = 'Refund Pending';
      } else {
        order.paymentStatus = 'Cancelled';
      }

      if (!order.timeline) {
        order.timeline = this.generateDefaultTimeline(order);
      }

      order.timeline.push({
        status: 'Cancelled',
        title: cancelledBy === 'Admin' ? 'Order Cancelled by Atelier Admin' : 'Order Cancelled by Customer',
        description: order.cancellationReason ? `Reason: ${order.cancellationReason}` : 'Order cancellation processed.',
        timestamp: timestamp,
        actor: cancelledBy,
        reason: order.cancellationReason
      });

      list[index] = order;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return of({ success: true, order, message: 'Order successfully cancelled' });
    } catch (err: any) {
      return of({ success: false, message: err?.message || 'Failed to cancel order' });
    }
  }

  /**
   * Change order status (Admin workflow)
   */
  updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string = 'Admin',
    note?: string
  ): Observable<{ success: boolean; order?: Order; message?: string }> {
    if (!this.isBrowser()) return of({ success: false, message: 'Platform not supported' });

    if (this.adminAuth.isAuthenticated() && /^\d+$/.test(orderId.trim())) {
      return this.http.patch<any>(`${this.adminOrdersApiUrl}/${orderId.trim()}/status`, { orderStatus: newStatus }, {
        headers: this.adminAuth.authorizationHeaders()
      }).pipe(
        map(updated => {
          const frontendOrder = this.mapBackendOrderToFrontend(updated);
          this.recordPlacedOrder(frontendOrder);
          return { success: true, order: frontendOrder, message: `Status updated to ${newStatus}` };
        }),
        catchError(err => of({ success: false, message: err?.error?.message || err?.message || 'Failed to update order status' }))
      );
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return of({ success: false, message: 'Order repository not found' });
      const list: Order[] = JSON.parse(raw);
      const index = list.findIndex(o => o.id.toUpperCase() === orderId.trim().toUpperCase());

      if (index === -1) {
        return of({ success: false, message: `Order #${orderId} not found` });
      }

      const order = list[index];
      if (order.status === newStatus) {
        return of({ success: true, order, message: `Order is already in ${newStatus} status.` });
      }

      const timestamp = new Date().toISOString();
      order.previousStatus = order.status;
      order.status = newStatus;

      if (!order.timeline) {
        order.timeline = this.generateDefaultTimeline(order);
      }

      let timelineTitle = `Status updated to ${newStatus}`;
      let defaultDesc = `Updated by atelier administrator (${changedBy}).`;

      switch (newStatus) {
        case 'Confirmed':
          timelineTitle = 'Order Confirmed';
          defaultDesc = 'Order and specifications confirmed for production queue.';
          break;
        case 'Printing':
          timelineTitle = '3D Printing Started';
          defaultDesc = '0.12mm precision layer fabrication started in atelier. Customer cancellation is now locked.';
          break;
        case 'Shipped':
          timelineTitle = 'Dispatched to Courier';
          defaultDesc = `Package handed over to ${order.courierPartner || 'courier partner'} for transit.`;
          break;
        case 'Delivered':
          timelineTitle = 'Order Delivered';
          defaultDesc = 'Order safely delivered to recipient address.';
          break;
        case 'Cancelled':
          timelineTitle = 'Order Cancelled by Atelier Admin';
          defaultDesc = note || 'Administrative cancellation.';
          break;
      }

      order.timeline.push({
        status: newStatus,
        title: timelineTitle,
        description: note || defaultDesc,
        timestamp: timestamp,
        actor: 'Admin'
      });

      list[index] = order;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return of({ success: true, order, message: `Status updated to ${newStatus}` });
    } catch (err: any) {
      return of({ success: false, message: err?.message || 'Failed to update order status' });
    }
  }

  /**
   * Update Logistics / Courier info
   */
  updateOrderLogistics(
    orderId: string,
    logistics: {
      courierPartner?: string;
      trackingNumber?: string;
      estimatedDelivery?: string;
      shippingMethod?: string;
    }
  ): Observable<{ success: boolean; order?: Order }> {
    if (!this.isBrowser()) return of({ success: false });

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return of({ success: false });
      const list: Order[] = JSON.parse(raw);
      const index = list.findIndex(o => o.id.toUpperCase() === orderId.trim().toUpperCase());
      if (index === -1) return of({ success: false });

      const order = list[index];
      if (logistics.courierPartner !== undefined) order.courierPartner = logistics.courierPartner;
      if (logistics.trackingNumber !== undefined) order.trackingNumber = logistics.trackingNumber;
      if (logistics.estimatedDelivery !== undefined) order.estimatedDelivery = logistics.estimatedDelivery;
      if (logistics.shippingMethod !== undefined) order.shippingMethod = logistics.shippingMethod;

      list[index] = order;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return of({ success: true, order });
    } catch {
      return of({ success: false });
    }
  }

  /**
   * Update Payment / Refund status
   */
  updatePaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    transactionId?: string
  ): Observable<{ success: boolean; order?: Order }> {
    if (!this.isBrowser()) return of({ success: false });

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return of({ success: false });
      const list: Order[] = JSON.parse(raw);
      const index = list.findIndex(o => o.id.toUpperCase() === orderId.trim().toUpperCase());
      if (index === -1) return of({ success: false });

      const order = list[index];
      order.paymentStatus = paymentStatus;
      if (transactionId) order.transactionId = transactionId;

      if (!order.timeline) order.timeline = this.generateDefaultTimeline(order);
      if (paymentStatus === 'Refund Processed') {
        order.timeline.push({
          status: order.status,
          title: 'Refund Processed',
          description: `Refund successfully processed to original payment method.${transactionId ? ' Ref: ' + transactionId : ''}`,
          timestamp: new Date().toISOString(),
          actor: 'System'
        });
      }

      list[index] = order;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return of({ success: true, order });
    } catch {
      return of({ success: false });
    }
  }

  getOrdersByQuery(query: string): Observable<Order[]> {
    if (!query || !this.isBrowser()) return of([]);
    const q = query.trim().toLowerCase();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return of([]);
      const list: Order[] = JSON.parse(raw);
      const matches = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.customer.fullName && o.customer.fullName.toLowerCase().includes(q)) ||
        (o.customer.email && o.customer.email.toLowerCase().includes(q)) ||
        (o.customer.phone && o.customer.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
        o.items.some(item => item.product?.name?.toLowerCase().includes(q))
      );
      return of(matches);
    } catch {
      return of([]);
    }
  }

  getRecentOrders(): Observable<Order[]> {
    return this.getAllOrders();
  }

  verifyPayment(request: PaymentVerificationRequest): Observable<PaymentVerificationResponse> {
    return this.http.post<PaymentVerificationResponse>(`${this.config.apiGatewayUrl}/api/payments/verify`, request, {
      headers: this.customerAuth.authorizationHeaders()
    });
  }

  getPaymentStatus(orderId: number | string): Observable<{ orderId: number; status: string; paymentOrderId?: string; paymentId?: string; amount?: number; currency?: string }> {
    return this.http.get<any>(`${this.config.apiGatewayUrl}/api/payments/order/${orderId}/status`, {
      headers: this.customerAuth.authorizationHeaders()
    });
  }

  getPaymentConfig(): Observable<{ keyId: string; provider: string }> {
    return this.http.get<{ keyId: string; provider: string }>(`${this.config.apiGatewayUrl}/api/payments/config`);
  }

}
