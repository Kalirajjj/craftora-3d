import { Component, inject, OnInit, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { Order } from '../../models/order.model';

export interface TrackingStep {
  stepNum: number;
  label: string;
  sublabel: string;
  icon: string;
}

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './track-order.component.html',
  styleUrls: ['./track-order.component.css']
})
export class TrackOrderComponent implements OnInit {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  readonly customerAuth = inject(CustomerAuthService);

  isLoggedIn = false;
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  isLoading = false;
  isLoadingOrderDetails = false;
  isOrderModalOpen = false;
  errorMessage = '';

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Escape key closes modals
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showCancelModal) {
      this.closeCancelModal();
    } else if (this.isOrderModalOpen) {
      this.closeOrderModal();
    }
  }

  // Timeline Step Definitions
  readonly trackingSteps: TrackingStep[] = [
    {
      stepNum: 1,
      label: 'Order Confirmed',
      sublabel: 'Payment verified & order queued',
      icon: 'pi-check-circle'
    },
    {
      stepNum: 2,
      label: '3D Slicing & Prep',
      sublabel: 'G-code slicing & resin/PLA calibration',
      icon: 'pi-sliders-h'
    },
    {
      stepNum: 3,
      label: 'Additive 3D Printing',
      sublabel: '0.12mm precision layer fabrication',
      icon: 'pi-box'
    },
    {
      stepNum: 4,
      label: 'Inspection & Finishing',
      sublabel: 'Hand-cured & tactile edge quality check',
      icon: 'pi-shield'
    },
    {
      stepNum: 5,
      label: 'Dispatched in Transit',
      sublabel: 'Handed over to courier with live AWB',
      icon: 'pi-send'
    },
    {
      stepNum: 6,
      label: 'Delivered',
      sublabel: 'Safely arrived at destination',
      icon: 'pi-home'
    }
  ];

  ngOnInit(): void {
    this.isLoggedIn = this.customerAuth.isSignedIn();

    this.route.queryParams.subscribe(params => {
      const targetOrderId = params['orderId'];

      if (this.isLoggedIn) {
        this.loadCustomerOrders(targetOrderId);
      } else {
        // If not logged in, but orderId query param exists, try to locate that specific order
        if (targetOrderId) {
          this.loadSpecificOrder(targetOrderId);
        }
      }
    });
  }

  loadCustomerOrders(targetOrderId?: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    const cust = this.customerAuth.customer();

    this.orderService.getCustomerOrders(cust).subscribe(orders => {
      this.isLoading = false;
      this.orders = orders;

      // Only open order modal if an explicit order ID was provided in the URL
      if (targetOrderId && orders.length > 0) {
        const found = orders.find(o => o.id.toUpperCase() === targetOrderId.trim().toUpperCase());
        if (found) {
          this.openOrderModal(found);
        }
      }
    });
  }

  loadSpecificOrder(orderId: string): void {
    this.isLoading = true;
    this.orderService.getOrderById(orderId).subscribe(order => {
      this.isLoading = false;
      if (order) {
        this.openOrderModal(order);
      }
    });
  }

  /**
   * Opens the Order Details modal for a specific order.
   * Loads fresh order details and timeline while preventing background scrolling.
   */
  openOrderModal(order: Order): void {
    this.selectedOrder = order;
    this.isOrderModalOpen = true;
    this.isLoadingOrderDetails = true;

    if (this.isBrowser()) {
      document.body.style.overflow = 'hidden';
    }

    this.orderService.getOrderById(order.id).subscribe({
      next: (fullOrder) => {
        this.isLoadingOrderDetails = false;
        if (fullOrder) {
          this.selectedOrder = fullOrder;
        }
      },
      error: () => {
        this.isLoadingOrderDetails = false;
      }
    });
  }

  /**
   * Closes the Order Details modal and restores page scroll.
   */
  closeOrderModal(): void {
    this.isOrderModalOpen = false;
    this.isLoadingOrderDetails = false;
    if (this.isBrowser()) {
      document.body.style.overflow = '';
    }
  }

  // Roadmap Stages: Ordered (1) -> Confirmed (2) -> Printing (3) -> Shipped (4) -> Delivered (5)
  getRoadmapStep(status: string): number {
    switch (status) {
      case 'Pending':
        return 1;
      case 'Confirmed':
        return 2;
      case 'Printing':
        return 3;
      case 'Shipped':
        return 4;
      case 'Delivered':
        return 5;
      default:
        return 2;
    }
  }

  getOrderProgressStep(status: string): number {
    return this.getRoadmapStep(status);
  }

  isRoadmapCompleted(step: number): boolean {
    if (!this.selectedOrder) return false;
    return step <= this.getRoadmapStep(this.selectedOrder.status);
  }

  isRoadmapCurrent(step: number): boolean {
    if (!this.selectedOrder) return false;
    return step === this.getRoadmapStep(this.selectedOrder.status);
  }

  isStepCompleted(stepNum: number): boolean {
    if (!this.selectedOrder) return false;
    const currentStep = this.getRoadmapStep(this.selectedOrder.status);
    return stepNum <= currentStep;
  }

  isStepActive(stepNum: number): boolean {
    if (!this.selectedOrder) return false;
    const currentStep = this.getRoadmapStep(this.selectedOrder.status);
    return stepNum === currentStep;
  }

  getWhatsAppSupportUrl(): string {
    if (!this.selectedOrder) return 'https://wa.me/919361416827';
    const text = encodeURIComponent(
      `Hello Craftora 3D! I am inquiring about my order: ${this.selectedOrder.id} (${this.selectedOrder.customer.fullName}).`
    );
    return `https://wa.me/919361416827?text=${text}`;
  }

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

  getPrimaryProductQuantity(order?: Order | null): number {
    return order?.items?.[0]?.quantity || 1;
  }

  // Cancellation Modal & Rules
  showCancelModal = false;
  selectedCancelReason = 'Ordered by mistake';
  otherCancelReason = '';
  isCancelling = false;
  cancelSuccessMessage = '';

  readonly cancellationReasons: string[] = [
    'Ordered by mistake',
    'Need to change delivery address or phone',
    'Want to change color or model variant',
    'Delivery timeline is too long',
    'Other reason'
  ];

  canCancelSelectedOrder(): { allowed: boolean; message?: string } {
    if (!this.selectedOrder) return { allowed: false };
    return this.orderService.canCustomerCancel(this.selectedOrder.status);
  }

  getCancellationReasonExplanation(): string {
    if (!this.selectedOrder) return '';
    const check = this.canCancelSelectedOrder();
    return check.message || '';
  }

  openCancelModal(): void {
    if (!this.selectedOrder) return;
    const check = this.canCancelSelectedOrder();
    if (!check.allowed) {
      this.errorMessage = check.message || 'This order cannot be cancelled.';
      return;
    }
    this.selectedCancelReason = this.cancellationReasons[0];
    this.otherCancelReason = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.otherCancelReason = '';
  }

  confirmCancelOrder(): void {
    if (!this.selectedOrder) return;
    this.isCancelling = true;

    const reason = this.selectedCancelReason === 'Other reason' && this.otherCancelReason.trim()
      ? this.otherCancelReason.trim()
      : this.selectedCancelReason;

    this.orderService.cancelOrder(this.selectedOrder.id, 'Customer', reason).subscribe(res => {
      this.isCancelling = false;
      if (res.success && res.order) {
        this.selectedOrder = res.order;
        this.closeCancelModal();
        this.cancelSuccessMessage = `Order #${res.order.id} has been cancelled successfully.`;
        if (res.order.paymentStatus === 'Refund Pending') {
          this.cancelSuccessMessage += ' Your refund request is pending and will be processed back to your original payment method.';
        }
        // Refresh customer orders list
        this.loadCustomerOrders(res.order.id);
        setTimeout(() => {
          this.cancelSuccessMessage = '';
        }, 8000);
      } else {
        this.errorMessage = res.message || 'Failed to cancel order';
        this.closeCancelModal();
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Printing':
        return 'badge-printing';
      case 'Shipped':
        return 'badge-shipped';
      case 'Delivered':
        return 'badge-delivered';
      case 'Confirmed':
        return 'badge-confirmed';
      case 'Cancelled':
        return 'badge-cancelled';
      default:
        return 'badge-pending';
    }
  }
}

