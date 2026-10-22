import { Component, inject, OnInit, OnDestroy, PLATFORM_ID, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { OfferService } from '../../services/offer.service';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { RazorpayService } from '../../services/razorpay.service';
import { AppConfigService } from '../../services/app-config.service';
import { CartItem, CustomerInfo, Order, CheckoutRequest, CheckoutResponse, PaymentVerificationRequest, PaymentVerificationResponse } from '../../models/order.model';
import { Offer } from '../../models/offer.model';
import { buildRazorpayCheckoutOptions } from '../../utils/razorpay-options-builder';
import { PaymentLifecycleManager, PaymentLifecycleState } from '../../utils/payment-lifecycle';

export interface SavedAddress {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  fullName: string;
  phone: string;
  doorNo: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

const SAVED_ADDRESSES_KEY = 'craftora_saved_addresses';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  cartService = inject(CartService);
  private orderService = inject(OrderService);
  private offerService = inject(OfferService);
  private customerAuth = inject(CustomerAuthService);
  private razorpayService = inject(RazorpayService);
  private appConfig = inject(AppConfigService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // Stepper State: 1 = Order Details, 2 = Delivery, 3 = Payment, 4 = Confirmation
  currentStep: 1 | 2 | 3 | 4 = 1;

  // Checkout Mode
  isBuyNowMode = false;
  directItem: CartItem | null = null;

  // Address Management
  savedAddresses: SavedAddress[] = [];
  selectedAddress: SavedAddress | null = null;
  isAddressModalOpen = false;
  editingAddressId: string | null = null;
  addressError = '';

  addressForm: {
    type: 'Home' | 'Work' | 'Other';
    fullName: string;
    phone: string;
    doorNo: string;
    street: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
    saveForFuture: boolean;
  } = {
    type: 'Home',
    fullName: '',
    phone: '',
    doorNo: '',
    street: '',
    landmark: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    saveForFuture: true
  };

  indianStates: string[] = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry',
    'Chandigarh', 'Jammu and Kashmir', 'Ladakh'
  ];

  // Shipping Method
  selectedShippingMethod: 'STANDARD' | 'EXPRESS' = 'STANDARD';

  // Coupon / Offers
  couponInput = '';
  appliedOffer: Offer | null = null;
  couponSuccess = '';
  couponError = '';
  quickOffers = ['FIRST299', 'OFF499', 'WELCOME50', 'CRAFT15'];

  // Payment Options
  selectedPaymentMethod: 'UPI' | 'CARD' | 'NET_BANKING' | 'COD' = 'UPI';
  upiApp: 'gpay' | 'phonepe' | 'paytm' | 'other' = 'gpay';
  upiId = '';
  cardDetails = {
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  };
  selectedBank = 'HDFC';

  // Payment Lifecycle & State Machine
  paymentLifecycle = new PaymentLifecycleManager();
  private activePaymentSub: Subscription | null = null;
  private activeReconcileSub: Subscription | null = null;
  simulateFailure = false;
  isReconciling = false;

  private lastVerificationContext: {
    attemptId: number;
    checkoutResp: CheckoutResponse;
    rzpResponse: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    };
  } | null = null;

  get paymentState(): PaymentLifecycleState {
    return this.paymentLifecycle.state;
  }

  get isProcessingPayment(): boolean {
    return this.paymentLifecycle.isProcessing;
  }

  get isPayButtonDisabled(): boolean {
    return this.paymentLifecycle.isPayButtonDisabled || this.activeCheckoutItems.length === 0;
  }

  get paymentFailed(): boolean {
    return this.paymentLifecycle.state === 'PAYMENT_FAILED';
  }

  get paymentCancelled(): boolean {
    return this.paymentLifecycle.state === 'PAYMENT_CANCELLED';
  }

  get isVerificationTimedOut(): boolean {
    return this.paymentLifecycle.state === 'VERIFICATION_TIMEOUT';
  }

  get paymentFailureReason(): string {
    return this.paymentLifecycle.failureReason;
  }

  get processingStatus(): string {
    return this.paymentLifecycle.statusMessage;
  }

  get canManualCancelProcessing(): boolean {
    return this.paymentLifecycle.state === 'INITIALIZING_CHECKOUT';
  }

  cancelPaymentAttempt(): void {
    this.ngZone.run(() => {
      if (this.activePaymentSub) {
        this.activePaymentSub.unsubscribe();
        this.activePaymentSub = null;
      }
      if (this.activeReconcileSub) {
        this.activeReconcileSub.unsubscribe();
        this.activeReconcileSub = null;
      }
      this.isReconciling = false;
      this.paymentLifecycle.cancelPendingAttempt(
        undefined,
        'Checkout was cancelled. You can retry when ready.'
      );
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.activePaymentSub) {
      this.activePaymentSub.unsubscribe();
      this.activePaymentSub = null;
    }
    if (this.activeReconcileSub) {
      this.activeReconcileSub.unsubscribe();
      this.activeReconcileSub = null;
    }
    this.isReconciling = false;
    this.paymentLifecycle.reset();
  }

  // Order Confirmation
  placedOrder: Order | null = null;
  copiedOrderId = false;
  estimatedDeliveryDateText = '';
  showSignInPrompt = false;
  currentIdempotencyKey: string | null = null;

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // 1. Detect Buy Now Mode
    this.route.queryParams.subscribe(params => {
      this.isBuyNowMode = params['buyNow'] === 'true';
      this.initItems();
    });

    // 2. Check if customer is signed in
    if (!this.customerAuth.isSignedIn()) {
      this.showSignInPrompt = true;
      this.savedAddresses = [];
      this.selectedAddress = null;
      if (this.isBrowser()) {
        try {
          localStorage.removeItem(SAVED_ADDRESSES_KEY);
        } catch { }
      }
    } else {
      // 3. Load Addresses strictly for logged in customer
      this.loadAddresses();
    }

    // 4. Inherit any coupon already active in CartService
    if (this.cartService.appliedOffer()) {
      this.appliedOffer = this.cartService.appliedOffer();
      this.couponSuccess = `Promo code "${this.appliedOffer?.code}" applied!`;
    }

    // 5. Calculate estimated delivery date
    this.calculateDeliveryDate();

    // 6. Preload Razorpay Checkout SDK
    if (this.isBrowser()) {
      this.razorpayService.loadScript().catch(() => {});
    }
  }

  onConfirmSignIn(): void {
    this.showSignInPrompt = false;
    const returnUrl = this.isBuyNowMode ? '/checkout?buyNow=true' : '/checkout';
    this.router.navigate(['/account/login'], { queryParams: { returnUrl } });
  }

  onCancelSignIn(): void {
    this.showSignInPrompt = false;
    this.router.navigate(['/shop']);
  }

  private initItems(): void {
    if (this.isBuyNowMode) {
      this.directItem = this.cartService.getDirectCheckoutItem();
      if (!this.directItem) {
        // If queryParam has buyNow but no item in storage, fall back to cart or shop
        if (this.cartService.cartItems().length > 0) {
          this.isBuyNowMode = false;
        } else if (this.isBrowser()) {
          this.router.navigate(['/shop']);
        }
      }
    }
  }

  // Active items being checked out
  get activeCheckoutItems(): CartItem[] {
    if (this.isBuyNowMode) {
      return this.directItem ? [this.directItem] : [];
    }
    return this.cartService.cartItems();
  }

  // Live Quantity Controls
  increaseQuantity(item: CartItem): void {
    this.currentIdempotencyKey = null;
    if (this.isBuyNowMode && this.directItem) {
      this.cartService.updateDirectCheckoutQuantity(this.directItem.quantity + 1);
      this.directItem = this.cartService.getDirectCheckoutItem();
    } else {
      this.cartService.updateQuantity(item.product.id, item.selectedColor, item.quantity + 1);
    }
    this.recheckCoupon();
  }

  decreaseQuantity(item: CartItem): void {
    if (item.quantity <= 1) return;
    this.currentIdempotencyKey = null;
    if (this.isBuyNowMode && this.directItem) {
      this.cartService.updateDirectCheckoutQuantity(this.directItem.quantity - 1);
      this.directItem = this.cartService.getDirectCheckoutItem();
    } else {
      this.cartService.updateQuantity(item.product.id, item.selectedColor, item.quantity - 1);
    }
    this.recheckCoupon();
  }

  // Financial Calculations
  get subtotal(): number {
    return this.activeCheckoutItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }

  get shippingFee(): number {
    if (this.subtotal === 0) return 0;
    if (this.selectedShippingMethod === 'EXPRESS') {
      return 199;
    }
    // Standard Delivery: Free if >= 999 or offer is FREE_DELIVERY
    if (this.appliedOffer && this.appliedOffer.type === 'FREE_DELIVERY') {
      if (this.appliedOffer.minOrderAmount <= 0 || this.subtotal >= this.appliedOffer.minOrderAmount) {
        return 0;
      }
    }
    if (this.subtotal >= 999) {
      return 0;
    }
    return 99;
  }

  get discountAmount(): number {
    const sub = this.subtotal;
    if (!this.appliedOffer || sub === 0) return 0;

    if (this.appliedOffer.type === 'FLAT_DISCOUNT') {
      return Math.min(sub, this.appliedOffer.discountAmount);
    }
    if (this.appliedOffer.type === 'PERCENTAGE_DISCOUNT') {
      return Math.round((sub * this.appliedOffer.discountAmount) / 100);
    }
    return 0;
  }

  get grandTotal(): number {
    const sub = this.subtotal;
    if (sub === 0) return 0;
    return Math.max(0, sub - this.discountAmount + this.shippingFee);
  }

  // Promo Code Methods
  applyCoupon(codeToApply?: string): void {
    const code = (codeToApply || this.couponInput).trim().toUpperCase();
    if (!code) {
      this.couponError = 'Please enter a coupon code.';
      this.couponSuccess = '';
      return;
    }

    const result = this.offerService.validateCouponCode(code, this.subtotal);
    if (result.valid && result.offer) {
      this.appliedOffer = result.offer;
      this.couponSuccess = result.message;
      this.couponError = '';
      this.couponInput = code;
    } else {
      this.couponError = result.message;
      this.couponSuccess = '';
    }
  }

  removeCoupon(): void {
    this.appliedOffer = null;
    this.couponSuccess = '';
    this.couponError = '';
    this.couponInput = '';
  }

  private recheckCoupon(): void {
    if (this.appliedOffer) {
      const result = this.offerService.validateCouponCode(this.appliedOffer.code, this.subtotal);
      if (!result.valid) {
        this.couponError = `Offer removed: ${result.message}`;
        this.appliedOffer = null;
        this.couponSuccess = '';
      }
    }
  }

  // Address Management
  loadAddresses(): void {
    if (!this.isBrowser()) return;

    // Strictly ensure only logged-in customer's addresses are loaded
    if (!this.customerAuth.isSignedIn()) {
      this.savedAddresses = [];
      this.selectedAddress = null;
      try {
        localStorage.removeItem(SAVED_ADDRESSES_KEY);
      } catch { }
      return;
    }

    const customerStorageKey = this.getCustomerStorageKey();
    let localList: SavedAddress[] = [];
    if (customerStorageKey) {
      try {
        const raw = localStorage.getItem(customerStorageKey);
        localList = raw ? JSON.parse(raw) : [];
      } catch {
        localList = [];
      }
    }

    // Clean up legacy unscoped key so it never leaks across accounts
    try {
      localStorage.removeItem(SAVED_ADDRESSES_KEY);
    } catch { }

    this.customerAuth.getProfile().subscribe(profile => {
      if (!this.addressForm.fullName && profile) {
        this.addressForm.fullName = profile.fullName;
        this.addressForm.phone = profile.phone || '';
      }
    });

    this.customerAuth.getAddresses().subscribe({
      next: serverAddrs => {
        if (serverAddrs && serverAddrs.length > 0) {
          const mapped: SavedAddress[] = serverAddrs.map(sa => ({
            id: 'srv-' + sa.id,
            type: (sa.label === 'Work' || sa.label === 'Other') ? sa.label : 'Home',
            fullName: sa.recipientName,
            phone: sa.phone,
            doorNo: sa.addressLine1,
            street: sa.addressLine2 || '',
            city: sa.city,
            state: sa.state,
            pincode: sa.pincode,
            isDefault: sa.defaultAddress
          }));

          // Merge without duplicates
          for (const s of mapped) {
            if (!localList.some(l => l.phone === s.phone && l.doorNo === s.doorNo && l.pincode === s.pincode)) {
              localList.unshift(s);
            }
          }
          this.persistAddresses(localList);
        }
        this.finishAddressSetup(localList);
      },
      error: () => {
        this.finishAddressSetup(localList);
      }
    });
  }

  private finishAddressSetup(list: SavedAddress[]): void {
    this.savedAddresses = list;
    if (this.savedAddresses.length > 0) {
      const def = this.savedAddresses.find(a => a.isDefault) || this.savedAddresses[0];
      this.selectedAddress = def;
    }
  }

  selectAddress(address: SavedAddress): void {
    this.selectedAddress = address;
    this.addressError = '';
  }

  openAddAddressModal(): void {
    this.editingAddressId = null;
    this.addressForm = {
      type: 'Home',
      fullName: this.selectedAddress?.fullName || '',
      phone: this.selectedAddress?.phone || '',
      doorNo: '',
      street: '',
      landmark: '',
      city: this.selectedAddress?.city || '',
      state: this.selectedAddress?.state || 'Tamil Nadu',
      pincode: '',
      saveForFuture: true
    };
    this.addressError = '';
    this.isAddressModalOpen = true;
  }

  openEditAddressModal(address: SavedAddress, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingAddressId = address.id;
    this.addressForm = {
      type: address.type,
      fullName: address.fullName,
      phone: address.phone,
      doorNo: address.doorNo,
      street: address.street,
      landmark: address.landmark || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      saveForFuture: true
    };
    this.addressError = '';
    this.isAddressModalOpen = true;
  }

  closeAddressModal(): void {
    this.isAddressModalOpen = false;
    this.editingAddressId = null;
    this.addressError = '';
  }

  saveAddressFromModal(): void {
    if (!this.addressForm.fullName.trim()) {
      this.addressError = 'Please enter recipient full name.';
      return;
    }
    if (!this.addressForm.phone.trim() || this.addressForm.phone.trim().length < 10) {
      this.addressError = 'Please enter a valid 10-digit mobile number.';
      return;
    }
    if (!this.addressForm.doorNo.trim()) {
      this.addressError = 'Please enter house / flat / door number.';
      return;
    }
    if (!this.addressForm.street.trim()) {
      this.addressError = 'Please enter street / area name.';
      return;
    }
    if (!this.addressForm.city.trim()) {
      this.addressError = 'Please enter city / town.';
      return;
    }
    if (!this.addressForm.pincode.trim() || this.addressForm.pincode.trim().length < 6) {
      this.addressError = 'Please enter a valid 6-digit PIN code.';
      return;
    }

    if (this.editingAddressId) {
      // Update existing address
      const idx = this.savedAddresses.findIndex(a => a.id === this.editingAddressId);
      if (idx > -1) {
        this.savedAddresses[idx] = {
          ...this.savedAddresses[idx],
          type: this.addressForm.type,
          fullName: this.addressForm.fullName.trim(),
          phone: this.addressForm.phone.trim(),
          doorNo: this.addressForm.doorNo.trim(),
          street: this.addressForm.street.trim(),
          landmark: this.addressForm.landmark.trim(),
          city: this.addressForm.city.trim(),
          state: this.addressForm.state,
          pincode: this.addressForm.pincode.trim()
        };
        this.selectedAddress = this.savedAddresses[idx];
      }
    } else {
      // Add new address
      const newAddr: SavedAddress = {
        id: 'addr-' + Date.now(),
        type: this.addressForm.type,
        fullName: this.addressForm.fullName.trim(),
        phone: this.addressForm.phone.trim(),
        doorNo: this.addressForm.doorNo.trim(),
        street: this.addressForm.street.trim(),
        landmark: this.addressForm.landmark.trim(),
        city: this.addressForm.city.trim(),
        state: this.addressForm.state,
        pincode: this.addressForm.pincode.trim(),
        isDefault: this.savedAddresses.length === 0
      };

      this.savedAddresses.unshift(newAddr);
      this.selectedAddress = newAddr;

      // Sync with server if signed in
      if (this.customerAuth.isSignedIn() && this.addressForm.saveForFuture) {
        this.customerAuth.addAddress({
          label: newAddr.type,
          recipientName: newAddr.fullName,
          phone: newAddr.phone,
          addressLine1: newAddr.doorNo,
          addressLine2: [newAddr.street, newAddr.landmark].filter(Boolean).join(', '),
          city: newAddr.city,
          state: newAddr.state,
          pincode: newAddr.pincode,
          defaultAddress: newAddr.isDefault || false
        }).subscribe({ error: () => undefined });
      }
    }

    if (this.addressForm.saveForFuture) {
      this.persistAddresses(this.savedAddresses);
    }
    this.closeAddressModal();
  }

  deleteAddress(addrId: string, event: Event): void {
    event.stopPropagation();
    this.savedAddresses = this.savedAddresses.filter(a => a.id !== addrId);
    if (this.selectedAddress?.id === addrId) {
      this.selectedAddress = this.savedAddresses.length > 0 ? this.savedAddresses[0] : null;
    }
    this.persistAddresses(this.savedAddresses);
  }

  setDefaultAddress(addrId: string, event: Event): void {
    event.stopPropagation();
    this.savedAddresses = this.savedAddresses.map(a => ({
      ...a,
      isDefault: a.id === addrId
    }));
    this.persistAddresses(this.savedAddresses);
  }

  private getCustomerStorageKey(): string | null {
    const cust = this.customerAuth.customer();
    if (cust?.id) return `craftora_saved_addresses_${cust.id}`;
    if (cust?.email) return `craftora_saved_addresses_${cust.email}`;
    return null;
  }

  private persistAddresses(list: SavedAddress[]): void {
    if (this.isBrowser()) {
      try {
        const key = this.getCustomerStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify(list));
        }
        localStorage.removeItem(SAVED_ADDRESSES_KEY);
      } catch (err) {
        console.warn('Could not persist addresses:', err);
      }
    }
  }

  // Delivery Date Calculation
  private calculateDeliveryDate(): void {
    const daysToAdd = this.selectedShippingMethod === 'EXPRESS' ? 2 : 4;
    const target = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    this.estimatedDeliveryDateText = target.toLocaleDateString('en-IN', options);
  }

  onShippingMethodChange(method: 'STANDARD' | 'EXPRESS'): void {
    this.selectedShippingMethod = method;
    this.calculateDeliveryDate();
  }

  // Flow Navigation: Continue to Payment (Step 3)
  continueToPayment(): void {
    if (this.activeCheckoutItems.length === 0) {
      this.addressError = 'No products selected for checkout.';
      return;
    }

    if (!this.selectedAddress) {
      this.addressError = 'Please select or add a delivery address to proceed.';
      if (this.savedAddresses.length === 0) {
        this.openAddAddressModal();
      }
      return;
    }

    this.addressError = '';
    this.paymentLifecycle.reset();
    if (!this.currentIdempotencyKey) {
      this.currentIdempotencyKey = this.generateIdempotencyKey();
    }
    this.currentStep = 3;
    if (this.isBrowser()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Back to Step 1 & 2
  backToDelivery(): void {
    this.currentStep = 1;
    this.paymentLifecycle.reset();
    this.currentIdempotencyKey = null;
    if (this.isBrowser()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Step 3 Real Backend Payment / Order Submission
  submitPayment(): void {
    // 1. Guard against double-clicks and invalid state
    if (this.paymentLifecycle.isPayButtonDisabled) {
      return;
    }

    // 2. Customer Authentication requirement
    if (!this.customerAuth.isSignedIn()) {
      this.showSignInPrompt = true;
      return;
    }

    // 3. Address and cart validation
    if (!this.selectedAddress) {
      this.addressError = 'Please select a delivery address.';
      this.currentStep = 1;
      return;
    }

    if (this.activeCheckoutItems.length === 0) {
      this.paymentLifecycle.onInitializationFailed(
        this.paymentLifecycle.attemptId,
        'Your cart is empty. Please add products to proceed.'
      );
      return;
    }

    for (const item of this.activeCheckoutItems) {
      const pid = Number(item.product.id);
      if (!Number.isInteger(pid) || pid <= 0) {
        this.paymentLifecycle.onInitializationFailed(
          this.paymentLifecycle.attemptId,
          `Invalid product identifier (${item.product.id}) found in checkout cart.`
        );
        return;
      }
      if (item.quantity <= 0) {
        this.paymentLifecycle.onInitializationFailed(
          this.paymentLifecycle.attemptId,
          'Product quantity must be at least 1.'
        );
        return;
      }
    }

    // 4. Ensure stable idempotency key for this attempt
    if (!this.currentIdempotencyKey) {
      this.currentIdempotencyKey = this.generateIdempotencyKey();
    }

    const attemptId = this.paymentLifecycle.startAttempt();
    if (attemptId === null) {
      return;
    }

    const customerEmail = (this.customerAuth.customer()?.email ||
      `${this.selectedAddress.fullName.toLowerCase().replace(/\s+/g, '')}@craftora-buyer.com`).trim().toLowerCase();

    const shippingAddr = [
      this.selectedAddress.doorNo,
      this.selectedAddress.street,
      this.selectedAddress.landmark,
      this.selectedAddress.city,
      this.selectedAddress.state,
      this.selectedAddress.pincode
    ].filter(Boolean).join(', ');

    const checkoutPayload: CheckoutRequest = {
      customerName: this.selectedAddress.fullName.trim(),
      customerEmail,
      shippingAddress: shippingAddr,
      totalAmount: this.grandTotal,
      shippingFee: this.shippingFee,
      discountAmount: this.discountAmount,
      items: this.activeCheckoutItems.map(item => ({
        productId: Number(item.product.id),
        quantity: item.quantity,
        unitPrice: Number(item.product.price)
      }))
    };

    const idempotencyKey = this.currentIdempotencyKey;

    if (this.activePaymentSub) {
      this.activePaymentSub.unsubscribe();
    }

    this.activePaymentSub = this.orderService.checkout(checkoutPayload, idempotencyKey).subscribe({
      next: (checkoutResp: CheckoutResponse) => {
        this.activePaymentSub = null;
        this.openRazorpayModal(attemptId, checkoutResp, customerEmail, shippingAddr);
      },
      error: (err: HttpErrorResponse) => {
        this.activePaymentSub = null;
        let reason = 'Unable to complete order creation. Please check your network and retry.';
        if (err.status === 409) {
          reason = 'Inventory reservation conflict or insufficient stock for requested products.';
        } else if (err.status === 504 || err.status === 0) {
          reason = 'Network timeout contacting the order service. Your checkout attempt has been preserved; you can safely retry.';
        } else if (err.status === 401) {
          reason = 'Your session has expired. Please sign in again to place your order.';
          this.showSignInPrompt = true;
        } else if (err.error && typeof err.error === 'object') {
          reason = err.error.message || err.error.error || 'Server rejected checkout submission.';
        } else if (typeof err.error === 'string' && err.error.trim()) {
          reason = err.error;
        }

        this.ngZone.run(() => {
          this.paymentLifecycle.onInitializationFailed(attemptId, reason);
          this.cdr.detectChanges();
        });
      }
    });
  }

  private generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'chk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
  }

  // =========================================================================
  // RAZORPAY CHECKOUT & PAYMENT VERIFICATION
  // =========================================================================
  private async openRazorpayModal(
    attemptId: number,
    checkoutResp: CheckoutResponse,
    customerEmail: string,
    shippingAddr: string
  ): Promise<void> {
    try {
      if (attemptId !== this.paymentLifecycle.attemptId) {
        return;
      }

      // 1. If order is already confirmed (e.g. from an idempotent retry)
      if (checkoutResp.paymentStatus === 'PAID' || checkoutResp.orderStatus === 'CONFIRMED') {
        this.paymentLifecycle.onVerificationCompleted(attemptId, true);
        this.finalizeSuccessfulOrder(checkoutResp, checkoutResp.paymentOrderId, checkoutResp.orderStatus);
        return;
      }

      // 2. Resolve Razorpay Key ID (prefer backend-returned keyId, fallback to public config)
      let keyId = checkoutResp.keyId;
      if (!keyId) {
        try {
          const config = await this.orderService.getPaymentConfig().toPromise();
          if (config?.keyId) {
            keyId = config.keyId;
          }
        } catch (err) {
          console.warn('Failed to fetch public payment configuration:', err);
        }
      }
      if (!keyId && this.appConfig.razorpayKeyId) {
        keyId = this.appConfig.razorpayKeyId;
      }

      if (attemptId !== this.paymentLifecycle.attemptId) {
        return;
      }

      if (!keyId) {
        this.ngZone.run(() => {
          this.paymentLifecycle.onInitializationFailed(
            attemptId,
            'Payment gateway configuration is missing. Razorpay key ID not provided by server.'
          );
          this.cdr.detectChanges();
        });
        return;
      }

      // 3. Ensure Razorpay Checkout SDK is loaded
      this.ngZone.run(() => {
        this.paymentLifecycle.setInitializingStatus(attemptId, 'Loading payment security components...');
        this.cdr.detectChanges();
      });

      const loaded = await this.razorpayService.loadScript();
      if (!loaded || !this.isBrowser() || !(window as any).Razorpay) {
        this.ngZone.run(() => {
          this.paymentLifecycle.onInitializationFailed(
            attemptId,
            'Could not initialize Razorpay Checkout in this browser. Please check your network connection.'
          );
          this.cdr.detectChanges();
        });
        return;
      }

      if (attemptId !== this.paymentLifecycle.attemptId) {
        return;
      }

      this.ngZone.run(() => {
        this.paymentLifecycle.setInitializingStatus(attemptId, 'Opening secure Razorpay payment modal...');
        this.cdr.detectChanges();
      });

      // 4. Configure Razorpay Options with synchronized payment method selection & fallbacks
      const options = buildRazorpayCheckoutOptions({
        keyId,
        orderId: checkoutResp.orderId,
        paymentOrderId: checkoutResp.paymentOrderId,
        totalAmount: checkoutResp.totalAmount,
        currency: checkoutResp.currency || 'INR',
        customerName: this.selectedAddress?.fullName || '',
        customerEmail,
        customerPhone: this.selectedAddress?.phone || '',
        shippingAddress: shippingAddr,
        selectedPaymentMethod: this.selectedPaymentMethod,
        themeColor: '#6366f1',
        handler: (response: any) => {
          this.ngZone.run(() => {
            this.verifyAndConfirmPayment(attemptId, checkoutResp, response);
            this.cdr.detectChanges();
          });
        },
        onDismiss: () => {
          this.ngZone.run(() => {
            this.paymentLifecycle.onCheckoutDismissed(attemptId);
            this.cdr.detectChanges();
          });
        }
      });

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        this.ngZone.run(() => {
          const errDesc = response?.error?.description || response?.error?.reason || 'Transaction declined by bank/provider.';
          this.paymentLifecycle.onPaymentFailed(attemptId, `Payment failed: ${errDesc}`);
          this.cdr.detectChanges();
        });
      });

      rzp.open();

      this.ngZone.run(() => {
        this.paymentLifecycle.onCheckoutOpened(attemptId);
        this.cdr.detectChanges();
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.paymentLifecycle.onInitializationFailed(
          attemptId,
          err?.message || 'Failed to initialize Razorpay Checkout modal.'
        );
        this.cdr.detectChanges();
      });
    }
  }

  private verifyAndConfirmPayment(
    attemptId: number,
    checkoutResp: CheckoutResponse,
    rzpResponse: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }
  ): void {
    if (attemptId !== this.paymentLifecycle.attemptId) {
      return;
    }

    this.lastVerificationContext = { attemptId, checkoutResp, rzpResponse };
    this.paymentLifecycle.onPaymentSubmittedForVerification(attemptId);

    const verificationPayload: PaymentVerificationRequest = {
      orderId: checkoutResp.orderId,
      razorpayPaymentId: rzpResponse.razorpay_payment_id,
      razorpayOrderId: rzpResponse.razorpay_order_id,
      razorpaySignature: rzpResponse.razorpay_signature
    };

    if (this.activePaymentSub) {
      this.activePaymentSub.unsubscribe();
    }

    this.activePaymentSub = this.orderService.verifyPayment(verificationPayload).pipe(
      timeout(15000)
    ).subscribe({
      next: (verifyResp: PaymentVerificationResponse) => {
        this.activePaymentSub = null;
        this.ngZone.run(() => {
          if (attemptId !== this.paymentLifecycle.attemptId) {
            return;
          }
          if (verifyResp.success && (verifyResp.status === 'COMPLETED' || verifyResp.status === 'SUCCESS' || verifyResp.orderStatus === 'CONFIRMED')) {
            this.paymentLifecycle.onVerificationCompleted(attemptId, true);
            this.finalizeSuccessfulOrder(checkoutResp, verifyResp.paymentId || rzpResponse.razorpay_payment_id, verifyResp.orderStatus || 'CONFIRMED');
          } else {
            this.paymentLifecycle.onVerificationCompleted(
              attemptId,
              false,
              `Payment verification inconclusive (status: ${verifyResp.status}). Please check your order history.`
            );
          }
          this.cdr.detectChanges();
        });
      },
      error: (err: any) => {
        this.activePaymentSub = null;
        this.ngZone.run(() => {
          if (attemptId !== this.paymentLifecycle.attemptId) {
            return;
          }

          // Handle 15s verification timeout safely without automatically failing the order
          const isTimeout = err instanceof TimeoutError || err?.name === 'TimeoutError';
          if (isTimeout) {
            this.handleVerificationTimeout(attemptId, checkoutResp, rzpResponse);
            return;
          }

          let reason = 'Error communicating with server during payment verification. Please check your order status.';
          if (err.status === 400) {
            reason = 'Cryptographic payment signature verification failed. Your transaction has not been confirmed.';
          } else if (err.status === 403) {
            reason = 'Unauthorized: payment verification rejected due to order ownership mismatch.';
          } else if (err.status === 404) {
            reason = 'Order record not found for payment verification.';
          } else if (err.error && typeof err.error === 'object') {
            reason = err.error.message || err.error.error || 'Server rejected payment verification.';
          }
          this.paymentLifecycle.onVerificationCompleted(attemptId, false, reason);
          this.cdr.detectChanges();
        });
      }
    });
  }

  private handleVerificationTimeout(
    attemptId: number,
    checkoutResp: CheckoutResponse,
    rzpResponse: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }
  ): void {
    // 1. Move to VERIFICATION_TIMEOUT (releases overlay, does NOT mark as failed, keeps Pay button disabled)
    this.paymentLifecycle.onVerificationTimedOut(
      attemptId,
      'Payment verification response is taking longer than expected. We are checking confirmation with the server so your payment is not debited twice.'
    );
    this.cdr.detectChanges();

    // 2. Automatically initiate an immediate background reconciliation check
    this.reconcilePaymentStatus(attemptId, checkoutResp, rzpResponse);
  }

  checkPendingPaymentStatus(): void {
    if (!this.lastVerificationContext || this.isReconciling) {
      return;
    }
    const { attemptId, checkoutResp, rzpResponse } = this.lastVerificationContext;
    this.reconcilePaymentStatus(attemptId, checkoutResp, rzpResponse);
  }

  private reconcilePaymentStatus(
    attemptId: number,
    checkoutResp: CheckoutResponse,
    rzpResponse: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }
  ): void {
    if (attemptId !== this.paymentLifecycle.attemptId) {
      return;
    }

    this.isReconciling = true;
    this.cdr.detectChanges();

    if (this.activeReconcileSub) {
      this.activeReconcileSub.unsubscribe();
    }

    // Check payment status from payment-service first, fallback to getOrderById from order-service
    this.activeReconcileSub = this.orderService.getPaymentStatus(checkoutResp.orderId).subscribe({
      next: (statusResp) => {
        this.activeReconcileSub = null;
        this.ngZone.run(() => {
          this.isReconciling = false;
          if (attemptId !== this.paymentLifecycle.attemptId) {
            return;
          }

          if (statusResp && (statusResp.status === 'COMPLETED' || statusResp.status === 'SUCCESS')) {
            this.paymentLifecycle.onVerificationCompleted(attemptId, true);
            this.finalizeSuccessfulOrder(
              checkoutResp,
              statusResp.paymentId || rzpResponse.razorpay_payment_id,
              'CONFIRMED'
            );
          } else if (statusResp && statusResp.status === 'FAILED') {
            this.paymentLifecycle.onVerificationCompleted(
              attemptId,
              false,
              'Payment was declined by payment gateway or bank. You can retry with another method.'
            );
          } else {
            // Still PENDING at payment-service, query order-service to see if webhook already confirmed the order
            this.checkOrderStatusDirect(attemptId, checkoutResp, rzpResponse);
            return;
          }
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.activeReconcileSub = null;
        this.ngZone.run(() => {
          if (attemptId !== this.paymentLifecycle.attemptId) {
            this.isReconciling = false;
            return;
          }
          // If payment-service status query errored, check order-service
          this.checkOrderStatusDirect(attemptId, checkoutResp, rzpResponse);
        });
      }
    });
  }

  private checkOrderStatusDirect(
    attemptId: number,
    checkoutResp: CheckoutResponse,
    rzpResponse: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }
  ): void {
    if (this.activeReconcileSub) {
      this.activeReconcileSub.unsubscribe();
    }

    this.activeReconcileSub = this.orderService.getOrderById(String(checkoutResp.orderId)).subscribe({
      next: (order) => {
        this.activeReconcileSub = null;
        this.ngZone.run(() => {
          this.isReconciling = false;
          if (attemptId !== this.paymentLifecycle.attemptId) {
            return;
          }

          if (
            order &&
            (order.paymentStatus === 'Paid' ||
              order.paymentStatus === 'PAID' ||
              order.status === 'Confirmed' ||
              order.status === 'CONFIRMED')
          ) {
            this.paymentLifecycle.onVerificationCompleted(attemptId, true);
            this.finalizeSuccessfulOrder(
              checkoutResp,
              order.transactionId || rzpResponse.razorpay_payment_id,
              order.status || 'CONFIRMED'
            );
          } else if (
            order &&
            (order.paymentStatus === 'FAILED' ||
              order.status === 'PAYMENT_FAILED' ||
              order.status === 'Cancelled' ||
              order.status === 'CANCELLED')
          ) {
            this.paymentLifecycle.onVerificationCompleted(
              attemptId,
              false,
              'Payment confirmation failed on server. You can retry payment when ready.'
            );
          } else {
            // Still pending on both services; keep in VERIFICATION_TIMEOUT with guidance
            this.paymentLifecycle.setInitializingStatus(
              attemptId,
              'We are still awaiting confirmation from Razorpay. Please wait a moment and click "Check Payment Status" again.'
            );
          }
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.activeReconcileSub = null;
        this.ngZone.run(() => {
          this.isReconciling = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private finalizeSuccessfulOrder(
    checkoutResp: CheckoutResponse,
    transactionId: string,
    orderStatus: string
  ): void {
    this.placedOrder = {
      id: String(checkoutResp.orderId),
      items: [...this.activeCheckoutItems],
      customer: {
        fullName: this.selectedAddress!.fullName,
        email: checkoutResp.customerEmail,
        phone: this.selectedAddress!.phone,
        address: `${this.selectedAddress!.doorNo}, ${this.selectedAddress!.street}`,
        city: this.selectedAddress!.city,
        state: this.selectedAddress!.state,
        pincode: this.selectedAddress!.pincode
      },
      subtotal: this.subtotal,
      deliveryFee: this.shippingFee,
      discount: this.discountAmount,
      total: checkoutResp.totalAmount,
      status: (orderStatus === 'CONFIRMED' ? 'CONFIRMED' : 'Confirmed'),
      paymentStatus: 'PAID',
      paymentMethod: this.getPaymentMethodLabel(),
      paymentOrderId: checkoutResp.paymentOrderId,
      transactionId: transactionId,
      createdAt: new Date().toISOString()
    };

    if (this.isBuyNowMode) {
      this.cartService.clearDirectCheckoutItem();
    } else {
      this.cartService.clearCart();
    }
    this.cartService.appliedOffer.set(null);

    this.currentStep = 4;
    if (this.isBrowser()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPaymentMethodLabel(): string {
    switch (this.selectedPaymentMethod) {
      case 'UPI':
        return 'UPI / QR Code';
      case 'CARD':
        return 'Credit or Debit Card';
      case 'NET_BANKING':
        return 'Net Banking';
      case 'COD':
        return 'Cash / UPI on Delivery';
      default:
        return 'Online Prepaid';
    }
  }

  copyOrderId(id: string): void {
    if (this.isBrowser() && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      this.copiedOrderId = true;
      setTimeout(() => this.copiedOrderId = false, 2500);
    }
  }

  retryPayment(): void {
    this.submitPayment();
  }
}
