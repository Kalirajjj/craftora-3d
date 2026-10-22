import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';
import { Order, OrderStatus, PaymentStatus } from '../../../models/order.model';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css']
})
export class AdminOrdersComponent implements OnInit {
  private orderService = inject(OrderService);

  orders: Order[] = [];
  filteredOrders: Order[] = [];
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // Filter state
  activeStatusFilter: 'ALL' | OrderStatus = 'ALL';
  searchQuery = '';
  selectedPaymentStatus: 'ALL' | PaymentStatus = 'ALL';
  selectedDateRange: 'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS' = 'ALL';

  // Counts
  totalCount = 0;
  pendingCount = 0;
  confirmedCount = 0;
  printingCount = 0;
  shippedCount = 0;
  deliveredCount = 0;
  cancelledCount = 0;

  // Drawer / View Order state
  selectedOrder: Order | null = null;
  isDrawerOpen = false;

  // Status management in drawer
  statusSelection: OrderStatus = 'Pending';
  statusChangeNote = '';
  isUpdatingStatus = false;

  // Logistics update state in drawer
  editCourierPartner = '';
  editTrackingNumber = '';
  editEstimatedDelivery = '';
  editShippingMethod = '';
  isSavingLogistics = false;
  isEditingLogistics = false;

  // Admin Cancellation Modal state
  showCancelModal = false;
  orderToCancel: Order | null = null;
  adminCancelReason = '';
  isCancelling = false;

  // Payment update state
  isUpdatingPayment = false;

  // Available status transitions
  readonly progressiveStatuses: OrderStatus[] = [
    'Pending',
    'Confirmed',
    'Printing',
    'Shipped',
    'Delivered'
  ];

  getPrimaryProductName(order?: Order | null): string {
    return order?.items?.[0]?.product?.name || '3D Custom Order';
  }

  getPrimaryProductImage(order?: Order | null): string {
    return (
      order?.items?.[0]?.product?.image ||
      order?.items?.[0]?.product?.imageUrl ||
      '/images/products/voronoi-lamp.svg'
    );
  }

  getFirstItem(order?: Order | null) {
    return order?.items?.[0];
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(targetOrderIdToSelect?: string): void {
    this.isLoading = true;
    this.orderService.getAllOrders().subscribe(orders => {
      this.isLoading = false;
      this.orders = orders;
      this.computeCounts();
      this.applyFilters();

      if (targetOrderIdToSelect) {
        const found = this.orders.find(o => o.id === targetOrderIdToSelect);
        if (found) {
          this.openOrderDrawer(found);
        }
      } else if (this.selectedOrder) {
        const refreshed = this.orders.find(o => o.id === this.selectedOrder!.id);
        if (refreshed) {
          this.syncSelectedOrder(refreshed);
        }
      }
    });
  }

  computeCounts(): void {
    this.totalCount = this.orders.length;
    this.pendingCount = this.orders.filter(o => o.status === 'Pending').length;
    this.confirmedCount = this.orders.filter(o => o.status === 'Confirmed').length;
    this.printingCount = this.orders.filter(o => o.status === 'Printing').length;
    this.shippedCount = this.orders.filter(o => o.status === 'Shipped').length;
    this.deliveredCount = this.orders.filter(o => o.status === 'Delivered').length;
    this.cancelledCount = this.orders.filter(o => o.status === 'Cancelled').length;
  }

  setStatusFilter(status: 'ALL' | OrderStatus): void {
    this.activeStatusFilter = status;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.orders];

    // Status filter
    if (this.activeStatusFilter !== 'ALL') {
      result = result.filter(o => o.status === this.activeStatusFilter);
    }

    // Payment status filter
    if (this.selectedPaymentStatus !== 'ALL') {
      result = result.filter(o => o.paymentStatus === this.selectedPaymentStatus);
    }

    // Date range filter
    if (this.selectedDateRange !== 'ALL') {
      const now = new Date().getTime();
      result = result.filter(o => {
        const orderTime = new Date(o.createdAt).getTime();
        const diffMs = now - orderTime;
        if (this.selectedDateRange === 'TODAY') {
          return diffMs <= 24 * 60 * 60 * 1000;
        } else if (this.selectedDateRange === '7_DAYS') {
          return diffMs <= 7 * 24 * 60 * 60 * 1000;
        } else if (this.selectedDateRange === '30_DAYS') {
          return diffMs <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }

    // Search query filter (Order ID, Customer name, Email, Phone, Product name)
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(o => {
        const idMatch = o.id.toLowerCase().includes(q);
        const nameMatch = o.customer.fullName?.toLowerCase().includes(q);
        const emailMatch = o.customer.email?.toLowerCase().includes(q);
        const phoneMatch = o.customer.phone?.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
        const trackingMatch = o.trackingNumber?.toLowerCase().includes(q);
        const productMatch = o.items.some(it => it.product?.name?.toLowerCase().includes(q));
        return idMatch || nameMatch || emailMatch || phoneMatch || trackingMatch || productMatch;
      });
    }

    this.filteredOrders = result;
  }

  get hasActiveFilters(): boolean {
    return (
      this.activeStatusFilter !== 'ALL' ||
      this.selectedPaymentStatus !== 'ALL' ||
      this.selectedDateRange !== 'ALL' ||
      this.searchQuery.trim() !== ''
    );
  }

  clearFilters(): void {
    this.activeStatusFilter = 'ALL';
    this.selectedPaymentStatus = 'ALL';
    this.selectedDateRange = 'ALL';
    this.searchQuery = '';
    this.applyFilters();
  }

  openOrderDrawer(order: Order): void {
    this.selectedOrder = order;
    this.syncSelectedOrder(order);
    this.isDrawerOpen = true;
  }

  closeOrderDrawer(): void {
    this.isDrawerOpen = false;
    this.selectedOrder = null;
    this.isEditingLogistics = false;
  }

  private syncSelectedOrder(order: Order): void {
    this.selectedOrder = order;
    this.statusSelection = order.status;
    this.statusChangeNote = '';
    this.editCourierPartner = order.courierPartner || '';
    this.editTrackingNumber = order.trackingNumber || '';
    this.editEstimatedDelivery = order.estimatedDelivery || '';
    this.editShippingMethod = order.shippingMethod || '';
  }

  updateStatus(): void {
    if (!this.selectedOrder) return;
    if (this.statusSelection === this.selectedOrder.status) return;

    // If admin selects 'Cancelled' from status control, open the confirmation modal instead
    if (this.statusSelection === 'Cancelled') {
      this.openAdminCancelModal(this.selectedOrder);
      return;
    }

    this.isUpdatingStatus = true;
    this.orderService
      .updateOrderStatus(this.selectedOrder.id, this.statusSelection, 'Admin', this.statusChangeNote)
      .subscribe(res => {
        this.isUpdatingStatus = false;
        if (res.success && res.order) {
          this.showSuccess(`Order #${res.order.id} status changed to ${res.order.status}`);
          this.loadOrders(res.order.id);
        } else {
          this.showError(res.message || 'Failed to update order status');
        }
      });
  }

  quickStatusTransition(targetStatus: OrderStatus): void {
    if (!this.selectedOrder) return;
    this.statusSelection = targetStatus;
    this.updateStatus();
  }

  saveLogistics(): void {
    if (!this.selectedOrder) return;
    this.isSavingLogistics = true;

    this.orderService
      .updateOrderLogistics(this.selectedOrder.id, {
        courierPartner: this.editCourierPartner,
        trackingNumber: this.editTrackingNumber,
        estimatedDelivery: this.editEstimatedDelivery,
        shippingMethod: this.editShippingMethod
      })
      .subscribe(res => {
        this.isSavingLogistics = false;
        if (res.success && res.order) {
          this.isEditingLogistics = false;
          this.showSuccess('Shipping & logistics details updated successfully');
          this.loadOrders(res.order.id);
        } else {
          this.showError('Could not update logistics');
        }
      });
  }

  openAdminCancelModal(order: Order): void {
    this.orderToCancel = order;
    this.adminCancelReason = '';
    this.showCancelModal = true;
  }

  closeAdminCancelModal(): void {
    this.showCancelModal = false;
    this.orderToCancel = null;
    this.adminCancelReason = '';
    // Restore status dropdown to actual order status if drawer was open
    if (this.selectedOrder) {
      this.statusSelection = this.selectedOrder.status;
    }
  }

  confirmAdminCancel(): void {
    if (!this.orderToCancel) return;
    this.isCancelling = true;

    const reason = this.adminCancelReason.trim() || 'Administrative cancellation by atelier administrator.';

    this.orderService.cancelOrder(this.orderToCancel.id, 'Admin', reason).subscribe(res => {
      this.isCancelling = false;
      if (res.success && res.order) {
        this.showSuccess(`Order #${res.order.id} has been cancelled.`);
        const id = res.order.id;
        this.closeAdminCancelModal();
        this.loadOrders(id);
      } else {
        this.showError(res.message || 'Could not cancel order');
      }
    });
  }

  markRefundProcessed(order: Order): void {
    this.isUpdatingPayment = true;
    const txn = 'REF-' + Math.floor(10000000 + Math.random() * 90000000);
    this.orderService.updatePaymentStatus(order.id, 'Refund Processed', txn).subscribe(res => {
      this.isUpdatingPayment = false;
      if (res.success && res.order) {
        this.showSuccess(`Refund marked as processed for Order #${res.order.id} (${txn})`);
        this.loadOrders(res.order.id);
      } else {
        this.showError('Could not update refund status');
      }
    });
  }

  copyToClipboard(text: string, label: string): void {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccess(`Copied ${label} to clipboard`);
    });
  }

  getStatusBadgeClass(status: OrderStatus): string {
    switch (status) {
      case 'Pending':
        return 'badge-pending';
      case 'Confirmed':
        return 'badge-confirmed';
      case 'Printing':
        return 'badge-printing';
      case 'Shipped':
        return 'badge-shipped';
      case 'Delivered':
        return 'badge-delivered';
      case 'Cancelled':
        return 'badge-cancelled';
      default:
        return 'badge-pending';
    }
  }

  getPaymentBadgeClass(paymentStatus?: PaymentStatus): string {
    switch (paymentStatus) {
      case 'Paid':
      case 'Prepaid':
        return 'pay-paid';
      case 'Refund Processed':
        return 'pay-refunded';
      case 'Refund Pending':
        return 'pay-refund-pending';
      case 'Cancelled':
        return 'pay-cancelled';
      case 'COD':
        return 'pay-cod';
      default:
        return 'pay-pending';
    }
  }

  showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => {
      if (this.successMessage === msg) this.successMessage = '';
    }, 4500);
  }

  showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => {
      if (this.errorMessage === msg) this.errorMessage = '';
    }, 5500);
  }

  dismissAlert(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
