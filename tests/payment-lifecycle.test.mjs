import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentLifecycleManager } from '../dist-test/payment-lifecycle.js';

describe('Payment Lifecycle State Manager — Intermittent Cancellation & Race Conditions', () => {

  it('Scenario 1: Open Checkout and cancel immediately', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    assert.equal(typeof attemptId, 'number');
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');
    assert.equal(manager.isProcessing, true);

    // Modal opens
    manager.onCheckoutOpened(attemptId);
    assert.equal(manager.state, 'CHECKOUT_OPEN');
    assert.equal(manager.isProcessing, false); // Backdrop released
    assert.equal(manager.isPayButtonDisabled, true); // Button guarded

    // User immediately closes / cancels
    const dismissed = manager.onCheckoutDismissed(attemptId);
    assert.equal(dismissed, true);
    assert.equal(manager.state, 'PAYMENT_CANCELLED');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, true);
    assert.equal(manager.isPayButtonDisabled, false); // Safe to retry
    assert.match(manager.failureReason, /closed before completion/i);
  });

  it('Scenario 2: Open Checkout and cancel after several seconds', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.setInitializingStatus(attemptId, 'Opening secure Razorpay payment modal...');
    manager.onCheckoutOpened(attemptId);

    // Simulated multi-second delay in checkout modal
    assert.equal(manager.state, 'CHECKOUT_OPEN');
    assert.equal(manager.isProcessing, false);

    // Then user dismisses
    manager.onCheckoutDismissed(attemptId);
    assert.equal(manager.state, 'PAYMENT_CANCELLED');
    assert.equal(manager.canRetry, true);
    assert.equal(manager.isProcessing, false);
  });

  it('Scenario 3: Close Checkout repeatedly across multiple attempts', () => {
    const manager = new PaymentLifecycleManager();

    for (let i = 1; i <= 4; i++) {
      const attemptId = manager.startAttempt();
      assert.equal(attemptId, i);
      manager.onCheckoutOpened(attemptId);
      assert.equal(manager.state, 'CHECKOUT_OPEN');
      assert.equal(manager.isProcessing, false);

      manager.onCheckoutDismissed(attemptId);
      assert.equal(manager.state, 'PAYMENT_CANCELLED');
      assert.equal(manager.canRetry, true);
      assert.equal(manager.isPayButtonDisabled, false);
    }
    assert.equal(manager.attemptId, 4);
  });

  it('Scenario 4: Cancel while an initialization or status request is still pending', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');
    assert.equal(manager.isProcessing, true);

    // User clicks emergency cancel or timeout triggers while order creation/script load is stuck
    const cancelled = manager.cancelPendingAttempt(attemptId, 'Manual cancellation by user');
    assert.equal(cancelled, true);
    assert.equal(manager.state, 'PAYMENT_CANCELLED');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, true);
    assert.equal(manager.isPayButtonDisabled, false);

    // If backend response eventually returns late, it must be ignored
    manager.onCheckoutOpened(attemptId);
    assert.equal(manager.state, 'PAYMENT_CANCELLED'); // Did not regress
  });

  it('Scenario 5: Simulate checkout initialization failure', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');
    assert.equal(manager.isProcessing, true);

    // Simulate backend inventory 409 or network timeout
    manager.onInitializationFailed(attemptId, 'Inventory reservation conflict');
    assert.equal(manager.state, 'PAYMENT_FAILED');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, true);
    assert.equal(manager.failureReason, 'Inventory reservation conflict');
    assert.equal(manager.isPayButtonDisabled, false);
  });

  it('Scenario 6: Simulate payment verification failure', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);

    // Razorpay returns payment ID and signature
    manager.onPaymentSubmittedForVerification(attemptId);
    assert.equal(manager.state, 'VERIFYING_PAYMENT');
    assert.equal(manager.isProcessing, true);
    assert.equal(manager.isPayButtonDisabled, true);

    // Backend verification fails (HMAC signature mismatch)
    manager.onVerificationCompleted(attemptId, false, 'Cryptographic payment signature verification failed.');
    assert.equal(manager.state, 'PAYMENT_FAILED');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, true);
    assert.equal(manager.isPayButtonDisabled, false);
    assert.match(manager.failureReason, /signature verification failed/i);
  });

  it('Scenario 7: Simulate delayed API responses and callback ordering', () => {
    const manager = new PaymentLifecycleManager();
    const attempt1 = manager.startAttempt();
    manager.onCheckoutOpened(attempt1);

    // Attempt 1 was dismissed
    manager.onCheckoutDismissed(attempt1);
    assert.equal(manager.state, 'PAYMENT_CANCELLED');

    // User retries -> Attempt 2 starts
    const attempt2 = manager.startAttempt();
    assert.equal(attempt2, 2);
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');
    assert.equal(manager.isProcessing, true);

    // Delayed callback from Attempt 1 arrives now
    const staleDismissHandled = manager.onCheckoutDismissed(attempt1);
    assert.equal(staleDismissHandled, false);
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT'); // Not overwritten
    assert.equal(manager.isProcessing, true);

    const staleFailureHandled = manager.onPaymentFailed(attempt1, 'Old decline');
    assert.equal(staleFailureHandled, false);
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');

    // Attempt 2 proceeds correctly
    manager.onCheckoutOpened(attempt2);
    assert.equal(manager.state, 'CHECKOUT_OPEN');
    assert.equal(manager.isProcessing, false);
  });

  it('Scenario 8: Complete a successful test payment', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);

    manager.onPaymentSubmittedForVerification(attemptId);
    assert.equal(manager.state, 'VERIFYING_PAYMENT');
    assert.equal(manager.isProcessing, true);

    // Razorpay modal closes upon payment success and fires ondismiss while verification is in-flight
    const dismissIgnored = manager.onCheckoutDismissed(attemptId);
    assert.equal(dismissIgnored, false); // Dismiss must be IGNORED during verification!
    assert.equal(manager.state, 'VERIFYING_PAYMENT'); // Unchanged!
    assert.equal(manager.isProcessing, true);

    // Backend confirms signature
    manager.onVerificationCompleted(attemptId, true);
    assert.equal(manager.state, 'PAYMENT_SUCCESS');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, false);
    assert.equal(manager.statusMessage, 'Payment confirmed and verified successfully!');
  });

  it('Scenario 9: Cancel and then retry successfully', () => {
    const manager = new PaymentLifecycleManager();

    // 1. First attempt cancelled
    const attempt1 = manager.startAttempt();
    manager.onCheckoutOpened(attempt1);
    manager.onCheckoutDismissed(attempt1);
    assert.equal(manager.state, 'PAYMENT_CANCELLED');
    assert.equal(manager.canRetry, true);

    // 2. Retry attempt started
    const attempt2 = manager.startAttempt();
    assert.equal(attempt2, 2);
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');
    manager.onCheckoutOpened(attempt2);
    assert.equal(manager.state, 'CHECKOUT_OPEN');

    // 3. User completes payment
    manager.onPaymentSubmittedForVerification(attempt2);
    assert.equal(manager.state, 'VERIFYING_PAYMENT');

    manager.onVerificationCompleted(attempt2, true);
    assert.equal(manager.state, 'PAYMENT_SUCCESS');
    assert.equal(manager.isProcessing, false);
  });

  it('Scenario 10: Trigger duplicate callbacks and verify that order is not incorrectly marked paid or failed', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);

    // Bank decline occurs in modal
    manager.onPaymentFailed(attemptId, 'Insufficient funds in customer account');
    assert.equal(manager.state, 'PAYMENT_FAILED');
    assert.equal(manager.failureReason, 'Insufficient funds in customer account');

    // Customer closes modal -> ondismiss fires duplicate / secondary event
    manager.onCheckoutDismissed(attemptId);
    // State remains PAYMENT_FAILED, failureReason is NOT overwritten with generic "window closed"
    assert.equal(manager.state, 'PAYMENT_FAILED');
    assert.equal(manager.failureReason, 'Insufficient funds in customer account');
    assert.equal(manager.canRetry, true);

    // Duplicate payment.failed fires
    manager.onPaymentFailed(attemptId, 'Duplicate decline event');
    assert.equal(manager.state, 'PAYMENT_FAILED');

    // Duplicate attempt cannot start while in INITIALIZING or VERIFYING
    manager.startAttempt(); // attempt 2
    const blockedAttempt = manager.startAttempt(); // immediate double click
    assert.equal(blockedAttempt, null); // Blocked!
  });

  it('Scenario 11: Verification timeout releases loading indicators without marking payment as failed or success', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);
    manager.onPaymentSubmittedForVerification(attemptId);

    assert.equal(manager.state, 'VERIFYING_PAYMENT');
    assert.equal(manager.isProcessing, true); // Backdrop active
    assert.equal(manager.isPayButtonDisabled, true); // Button disabled

    // 15-second verification timeout fires
    const timedOut = manager.onVerificationTimedOut(
      attemptId,
      'Payment verification response is delayed. Reconciling payment status with server...'
    );

    assert.equal(timedOut, true);
    assert.equal(manager.state, 'VERIFICATION_TIMEOUT');
    assert.equal(manager.isProcessing, false); // Loading backdrop released!
    assert.equal(manager.isPayButtonDisabled, true); // Pay button still guarded against duplicate charge
    assert.equal(manager.canRetry, false); // Cannot blindly retry without reconciliation
    assert.equal(manager.failureReason, ''); // NOT marked failed!
    assert.match(manager.statusMessage, /verification response is delayed/i);
  });

  it('Scenario 12: Verification timeout followed by late or reconciled backend confirmation succeeds cleanly', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);
    manager.onPaymentSubmittedForVerification(attemptId);
    manager.onVerificationTimedOut(attemptId, 'Verification delayed...');

    assert.equal(manager.state, 'VERIFICATION_TIMEOUT');

    // Server reconciliation or delayed webhook confirms payment success
    const completed = manager.onVerificationCompleted(attemptId, true);
    assert.equal(completed, true);
    assert.equal(manager.state, 'PAYMENT_SUCCESS');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, false);
    assert.match(manager.statusMessage, /verified successfully/i);
    assert.equal(manager.failureReason, '');
  });

  it('Scenario 13: Verification timeout followed by confirmed backend failure safely re-enables retry', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);
    manager.onPaymentSubmittedForVerification(attemptId);
    manager.onVerificationTimedOut(attemptId, 'Verification delayed...');

    assert.equal(manager.state, 'VERIFICATION_TIMEOUT');

    // Server reconciliation confirms payment failed on gateway/bank
    const completed = manager.onVerificationCompleted(
      attemptId,
      false,
      'Payment was declined by payment gateway or bank.'
    );

    assert.equal(completed, true);
    assert.equal(manager.state, 'PAYMENT_FAILED');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, true); // User can now retry
    assert.equal(manager.isPayButtonDisabled, false); // Pay button re-enabled
    assert.match(manager.failureReason, /declined by payment gateway/i);
  });

  it('Scenario 14: Duplicate payment attempt is strictly blocked during VERIFICATION_TIMEOUT', () => {
    const manager = new PaymentLifecycleManager();
    const attempt1 = manager.startAttempt();
    manager.onCheckoutOpened(attempt1);
    manager.onPaymentSubmittedForVerification(attempt1);
    manager.onVerificationTimedOut(attempt1, 'Verification delayed...');

    assert.equal(manager.state, 'VERIFICATION_TIMEOUT');
    assert.equal(manager.isPayButtonDisabled, true);

    // User attempts to click Pay again while verification is ambiguous
    const duplicateAttempt = manager.startAttempt();
    assert.equal(duplicateAttempt, null); // Blocked from creating duplicate order or payment!
    assert.equal(manager.state, 'VERIFICATION_TIMEOUT');
    assert.equal(manager.attemptId, attempt1);
  });

  it('Scenario 15: Delayed callbacks from earlier attempts cannot overwrite subsequent attempts', () => {
    const manager = new PaymentLifecycleManager();

    // Attempt 1 times out
    const attempt1 = manager.startAttempt();
    manager.onCheckoutOpened(attempt1);
    manager.onPaymentSubmittedForVerification(attempt1);
    manager.onVerificationTimedOut(attempt1, 'Verification delayed...');

    // User cancels attempt 1 after finding it declined
    manager.cancelPendingAttempt(attempt1, 'User cancelled timed-out attempt');
    assert.equal(manager.state, 'PAYMENT_CANCELLED');

    // User begins Attempt 2
    const attempt2 = manager.startAttempt();
    assert.equal(attempt2, 2);
    assert.equal(manager.state, 'INITIALIZING_CHECKOUT');
    manager.onCheckoutOpened(attempt2);
    assert.equal(manager.state, 'CHECKOUT_OPEN');

    // Delayed callbacks from Attempt 1 now arrive
    const staleTimeoutResult = manager.onVerificationTimedOut(attempt1, 'Stale timeout');
    assert.equal(staleTimeoutResult, false);
    assert.equal(manager.state, 'CHECKOUT_OPEN'); // Preserved!

    const staleVerifyResult = manager.onVerificationCompleted(attempt1, true);
    assert.equal(staleVerifyResult, false);
    assert.equal(manager.state, 'CHECKOUT_OPEN'); // Preserved!

    const staleDismissResult = manager.onCheckoutDismissed(attempt1);
    assert.equal(staleDismissResult, false);
    assert.equal(manager.state, 'CHECKOUT_OPEN'); // Preserved!

    const staleFailResult = manager.onPaymentFailed(attempt1, 'Stale bank decline');
    assert.equal(staleFailResult, false);
    assert.equal(manager.state, 'CHECKOUT_OPEN'); // Preserved!
  });

  it('Scenario 16: Component cleanup (reset) invalidates in-flight attempts and drops late callbacks', () => {
    const manager = new PaymentLifecycleManager();
    const attemptId = manager.startAttempt();
    manager.onCheckoutOpened(attemptId);
    manager.onPaymentSubmittedForVerification(attemptId);

    // Component unmounts / ngOnDestroy triggers reset()
    manager.reset();
    assert.equal(manager.state, 'IDLE');
    assert.equal(manager.isProcessing, false);
    assert.equal(manager.canRetry, false);

    // Stale responses for the previous attempt arrive after component destruction
    const staleVerify = manager.onVerificationCompleted(attemptId, true);
    assert.equal(staleVerify, false);
    assert.equal(manager.state, 'IDLE');

    const staleTimeout = manager.onVerificationTimedOut(attemptId);
    assert.equal(staleTimeout, false);
    assert.equal(manager.state, 'IDLE');

    const staleDismiss = manager.onCheckoutDismissed(attemptId);
    assert.equal(staleDismiss, false);
    assert.equal(manager.state, 'IDLE');
  });

});
