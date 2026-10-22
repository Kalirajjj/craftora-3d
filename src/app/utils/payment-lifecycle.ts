/**
 * Payment Lifecycle State Manager
 * Explicit state model and lifecycle management for Razorpay Checkout
 * to prevent race conditions, stuck loading states, and callback overwrites.
 */

export type PaymentLifecycleState =
  | 'IDLE'
  | 'INITIALIZING_CHECKOUT'
  | 'CHECKOUT_OPEN'
  | 'VERIFYING_PAYMENT'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'VERIFICATION_TIMEOUT';

export interface PaymentStateSnapshot {
  state: PaymentLifecycleState;
  attemptId: number;
  isProcessing: boolean;
  canRetry: boolean;
  isPayButtonDisabled: boolean;
  statusMessage: string;
  failureReason: string;
}

export class PaymentLifecycleManager {
  private _state: PaymentLifecycleState = 'IDLE';
  private _attemptId: number = 0;
  private _isProcessing: boolean = false;
  private _canRetry: boolean = false;
  private _statusMessage: string = '';
  private _failureReason: string = '';

  get state(): PaymentLifecycleState {
    return this._state;
  }

  get attemptId(): number {
    return this._attemptId;
  }

  get isProcessing(): boolean {
    return this._isProcessing;
  }

  get canRetry(): boolean {
    return this._canRetry;
  }

  get statusMessage(): string {
    return this._statusMessage;
  }

  get failureReason(): string {
    return this._failureReason;
  }

  get isPayButtonDisabled(): boolean {
    return (
      this._state === 'INITIALIZING_CHECKOUT' ||
      this._state === 'CHECKOUT_OPEN' ||
      this._state === 'VERIFYING_PAYMENT' ||
      this._state === 'VERIFICATION_TIMEOUT'
    );
  }

  getSnapshot(): PaymentStateSnapshot {
    return {
      state: this._state,
      attemptId: this._attemptId,
      isProcessing: this._isProcessing,
      canRetry: this._canRetry,
      isPayButtonDisabled: this.isPayButtonDisabled,
      statusMessage: this._statusMessage,
      failureReason: this._failureReason
    };
  }

  /**
   * Starts a new payment attempt. Increments attemptId to invalidate stale callbacks.
   * Returns null if already actively processing or awaiting ambiguous verification
   * to guard against duplicate submits and double payments.
   */
  startAttempt(): number | null {
    if (
      this._state === 'INITIALIZING_CHECKOUT' ||
      this._state === 'VERIFYING_PAYMENT' ||
      this._state === 'VERIFICATION_TIMEOUT'
    ) {
      return null;
    }

    this._attemptId += 1;
    this._state = 'INITIALIZING_CHECKOUT';
    this._isProcessing = true;
    this._canRetry = false;
    this._failureReason = '';
    this._statusMessage = 'Reserving stock and creating verified order...';
    return this._attemptId;
  }

  /**
   * Updates progress message during initialization phase (e.g. loading script or opening modal).
   */
  setInitializingStatus(attemptId: number, message: string): boolean {
    if (attemptId !== this._attemptId || this._state !== 'INITIALIZING_CHECKOUT') {
      return false;
    }
    this._statusMessage = message;
    return true;
  }

  /**
   * Called when Razorpay Checkout modal has opened.
   * Releases full-screen blocking overlay while keeping Pay button safely disabled.
   */
  onCheckoutOpened(attemptId: number): boolean {
    if (attemptId !== this._attemptId) {
      return false;
    }
    // Do not regress if already moved forward to verification or terminal state
    if (
      this._state === 'VERIFYING_PAYMENT' ||
      this._state === 'VERIFICATION_TIMEOUT' ||
      this._state === 'PAYMENT_SUCCESS' ||
      this._state === 'PAYMENT_FAILED' ||
      this._state === 'PAYMENT_CANCELLED'
    ) {
      return false;
    }

    this._state = 'CHECKOUT_OPEN';
    this._isProcessing = false;
    this._canRetry = false;
    this._statusMessage = 'Checkout window open. Please complete payment in the modal.';
    return true;
  }

  /**
   * Called when Razorpay Checkout modal is dismissed or closed by the user.
   * Ensures loading is always released and Pay button is re-enabled for retry.
   */
  onCheckoutDismissed(attemptId: number): boolean {
    if (attemptId !== this._attemptId) {
      return false;
    }

    // CRITICAL: Never abort or mark failed if payment verification or ambiguous timeout is in flight, or order succeeded!
    if (
      this._state === 'VERIFYING_PAYMENT' ||
      this._state === 'VERIFICATION_TIMEOUT' ||
      this._state === 'PAYMENT_SUCCESS'
    ) {
      return false;
    }

    // If payment already recorded as failed (e.g. from payment.failed event), keep the bank's failure reason
    if (this._state === 'PAYMENT_FAILED') {
      this._isProcessing = false;
      this._canRetry = true;
      return true;
    }

    this._state = 'PAYMENT_CANCELLED';
    this._isProcessing = false;
    this._canRetry = true;
    this._failureReason =
      'Payment window was closed before completion. You can retry payment when ready.';
    this._statusMessage = '';
    return true;
  }

  /**
   * Called when payment is rejected by bank/provider during checkout modal interaction.
   */
  onPaymentFailed(attemptId: number, errorDescription?: string): boolean {
    if (attemptId !== this._attemptId) {
      return false;
    }

    if (
      this._state === 'VERIFYING_PAYMENT' ||
      this._state === 'VERIFICATION_TIMEOUT' ||
      this._state === 'PAYMENT_SUCCESS'
    ) {
      return false;
    }

    this._state = 'PAYMENT_FAILED';
    this._isProcessing = false;
    this._canRetry = true;
    this._failureReason = errorDescription || 'Payment declined by bank or provider.';
    this._statusMessage = '';
    return true;
  }

  /**
   * Called when backend order creation, payment config fetch, or script load fails.
   */
  onInitializationFailed(attemptId: number, errorMessage: string): boolean {
    if (attemptId !== this._attemptId) {
      return false;
    }

    this._state = 'PAYMENT_FAILED';
    this._isProcessing = false;
    this._canRetry = true;
    this._failureReason = errorMessage;
    this._statusMessage = '';
    return true;
  }

  /**
   * Called when Razorpay reports payment success and returns cryptographic signature.
   */
  onPaymentSubmittedForVerification(attemptId: number): boolean {
    if (attemptId !== this._attemptId) {
      return false;
    }

    this._state = 'VERIFYING_PAYMENT';
    this._isProcessing = true;
    this._canRetry = false;
    this._failureReason = '';
    this._statusMessage = 'Verifying cryptographic payment signature with bank...';
    return true;
  }

  /**
   * Called when payment verification response takes longer than timeout window (e.g. 15s).
   * Releases full-screen blocking overlay WITHOUT marking order or payment as failed.
   * Keeps Pay button disabled to prevent duplicate payments while reconciliation is pending.
   */
  onVerificationTimedOut(attemptId: number, message?: string): boolean {
    if (attemptId !== this._attemptId || this._state !== 'VERIFYING_PAYMENT') {
      return false;
    }

    this._state = 'VERIFICATION_TIMEOUT';
    this._isProcessing = false;
    this._canRetry = false;
    this._failureReason = '';
    this._statusMessage =
      message ||
      'Payment verification response is delayed. Reconciling payment status with server...';
    return true;
  }

  /**
   * Called when backend payment verification or status reconciliation completes.
   * Supports transitions from either active VERIFYING_PAYMENT or ambiguous VERIFICATION_TIMEOUT.
   */
  onVerificationCompleted(attemptId: number, success: boolean, errorMessage?: string): boolean {
    if (
      attemptId !== this._attemptId ||
      (this._state !== 'VERIFYING_PAYMENT' && this._state !== 'VERIFICATION_TIMEOUT')
    ) {
      return false;
    }

    if (success) {
      this._state = 'PAYMENT_SUCCESS';
      this._isProcessing = false;
      this._canRetry = false;
      this._statusMessage = 'Payment confirmed and verified successfully!';
      this._failureReason = '';
    } else {
      this._state = 'PAYMENT_FAILED';
      this._isProcessing = false;
      this._canRetry = true;
      this._failureReason = errorMessage || 'Payment verification failed.';
      this._statusMessage = '';
    }
    return true;
  }

  /**
   * User manually cancels an in-flight initialization attempt (e.g. network hang recovery).
   */
  cancelPendingAttempt(attemptId?: number, reason?: string): boolean {
    if (attemptId !== undefined && attemptId !== this._attemptId) {
      return false;
    }

    if (
      this._state === 'INITIALIZING_CHECKOUT' ||
      this._state === 'CHECKOUT_OPEN' ||
      this._state === 'VERIFICATION_TIMEOUT'
    ) {
      this._state = 'PAYMENT_CANCELLED';
      this._isProcessing = false;
      this._canRetry = true;
      this._failureReason =
        reason || 'Payment initialization cancelled. You can retry when ready.';
      this._statusMessage = '';
      return true;
    }

    return false;
  }

  /**
   * Resets lifecycle to IDLE, invalidating any pending operations.
   */
  reset(): void {
    this._attemptId += 1;
    this._state = 'IDLE';
    this._isProcessing = false;
    this._canRetry = false;
    this._statusMessage = '';
    this._failureReason = '';
  }
}
