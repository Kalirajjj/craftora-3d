import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Order } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  createOrder(order: Partial<Order>): Observable<Order> {
    const newOrder: Order = {
      id: 'CRF-' + Math.floor(100000 + Math.random() * 900000),
      items: order.items || [],
      customer: order.customer!,
      subtotal: order.subtotal || 0,
      deliveryFee: order.deliveryFee || 0,
      total: order.total || 0,
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    };
    return of(newOrder);
  }
}
