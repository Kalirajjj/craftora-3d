import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import compiled or source module
import {
  buildRazorpayCheckoutOptions,
  getRazorpayBankCode,
  RAZORPAY_BANK_CODE_MAP
} from '../dist-test/razorpay-options-builder.js';

describe('Razorpay Options Builder - Payment Method Synchronization', () => {
  const baseParams = {
    keyId: 'rzp_test_TmCU7veRqWGyKO',
    orderId: 1001,
    paymentOrderId: 'order_rzp_mock_123456789',
    totalAmount: 1499.5,
    currency: 'INR',
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    customerPhone: '9876543210',
    shippingAddress: '123 Craft Lane, Bangalore, Karnataka, 560001',
    selectedPaymentMethod: 'UPI'
  };

  describe('Bank Code Mapping', () => {
    it('correctly maps popular Indian banks to Razorpay 4-letter IFSC codes', () => {
      assert.equal(getRazorpayBankCode('HDFC'), 'HDFC');
      assert.equal(getRazorpayBankCode('ICICI'), 'ICIC');
      assert.equal(getRazorpayBankCode('SBI'), 'SBIN');
      assert.equal(getRazorpayBankCode('Axis'), 'UTIB');
      assert.equal(getRazorpayBankCode('Kotak'), 'KKBK');
    });

    it('falls back to uppercase if bank is not in standard map', () => {
      assert.equal(getRazorpayBankCode('custombank'), 'CUSTOMBANK');
      assert.equal(getRazorpayBankCode(''), '');
    });
  });

  describe('Google Pay (GPay) Synchronization', () => {
    it('configures Google Pay as prioritized block and prefill method while keeping default blocks', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'gpay'
      });

      // Amount converted to paise
      assert.equal(options.amount, 149950);
      assert.equal(options.currency, 'INR');
      assert.equal(options.order_id, 'order_rzp_mock_123456789');

      // Prefill
      assert.equal(options.prefill.method, 'upi');
      assert.equal(options.prefill.name, 'John Doe');
      assert.equal(options.prefill.email, 'john.doe@example.com');
      assert.equal(options.prefill.contact, '9876543210');

      // Notes
      assert.equal(options.notes.selected_method, 'UPI_GPAY');
      assert.equal(options.notes.order_id, '1001');

      // Config Display blocks & sequence
      assert.ok(options.config?.display);
      const display = options.config.display;
      assert.ok(display.blocks?.preferred_gpay);
      assert.deepEqual(display.blocks.preferred_gpay.instruments, [
        { method: 'upi', apps: ['google_pay'] }
      ]);
      assert.equal(display.sequence?.[0], 'block.preferred_gpay');

      // Crucial requirement: show_default_blocks must be true (never hide fallback options)
      assert.equal(display.preferences?.show_default_blocks, true);
      assert.equal(options.config?.display?.hide, undefined);
    });
  });

  describe('PhonePe and Paytm Synchronization', () => {
    it('configures PhonePe as prioritized block with fallbacks intact', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'phonepe'
      });

      assert.equal(options.prefill.method, 'upi');
      assert.equal(options.notes.selected_method, 'UPI_PHONEPE');
      assert.ok(options.config?.display?.blocks?.preferred_phonepe);
      assert.deepEqual(options.config.display.blocks.preferred_phonepe.instruments, [
        { method: 'upi', apps: ['phonepe'] }
      ]);
      assert.equal(options.config.display.sequence?.[0], 'block.preferred_phonepe');
      assert.equal(options.config.display.preferences?.show_default_blocks, true);
    });

    it('configures Paytm as prioritized block with fallbacks intact', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'paytm'
      });

      assert.equal(options.prefill.method, 'upi');
      assert.equal(options.notes.selected_method, 'UPI_PAYTM');
      assert.ok(options.config?.display?.blocks?.preferred_paytm);
      assert.deepEqual(options.config.display.blocks.preferred_paytm.instruments, [
        { method: 'upi', apps: ['paytm'] }
      ]);
      assert.equal(options.config.display.sequence?.[0], 'block.preferred_paytm');
      assert.equal(options.config.display.preferences?.show_default_blocks, true);
    });
  });

  describe('Custom UPI ID (VPA) Collect Synchronization', () => {
    it('prefills customer VPA and prioritizes UPI sequence', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'other',
        upiId: 'craftora.buyer@okhdfcbank'
      });

      assert.equal(options.prefill.method, 'upi');
      assert.equal(options.prefill.vpa, 'craftora.buyer@okhdfcbank');
      assert.equal(options.notes.selected_method, 'UPI_COLLECT_ID');
      assert.equal(options.config?.display?.sequence?.[0], 'upi');
      assert.equal(options.config?.display?.preferences?.show_default_blocks, true);
    });
  });

  describe('Credit / Debit Card Synchronization', () => {
    it('configures Card prefill and prioritizes card block', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'CARD'
      });

      assert.equal(options.prefill.method, 'card');
      assert.equal(options.notes.selected_method, 'CARD');
      assert.ok(options.config?.display?.blocks?.preferred_card);
      assert.deepEqual(options.config.display.blocks.preferred_card.instruments, [
        { method: 'card' }
      ]);
      assert.equal(options.config.display.sequence?.[0], 'block.preferred_card');
      assert.equal(options.config.display.preferences?.show_default_blocks, true);
    });
  });

  describe('Net Banking Synchronization', () => {
    it('maps selected bank and configures netbanking prefill and custom bank block', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'NET_BANKING',
        selectedBank: 'ICICI'
      });

      assert.equal(options.prefill.method, 'netbanking');
      assert.equal(options.prefill.bank, 'ICIC'); // mapped to ICIC
      assert.equal(options.notes.selected_method, 'NET_BANKING_ICIC');
      assert.ok(options.config?.display?.blocks?.preferred_bank);
      assert.deepEqual(options.config.display.blocks.preferred_bank.instruments, [
        { method: 'netbanking', banks: ['ICIC'] }
      ]);
      assert.equal(options.config.display.sequence?.[0], 'block.preferred_bank');
      assert.equal(options.config.display.preferences?.show_default_blocks, true);
    });

    it('correctly handles SBI netbanking', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'NET_BANKING',
        selectedBank: 'SBI'
      });

      assert.equal(options.prefill.method, 'netbanking');
      assert.equal(options.prefill.bank, 'SBIN'); // mapped to SBIN
      assert.equal(options.notes.selected_method, 'NET_BANKING_SBIN');
    });

    it('correctly handles generic Net Banking mode without specifying a bank', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'NET_BANKING'
      });

      assert.equal(options.prefill.method, 'netbanking');
      assert.equal(options.prefill.bank, undefined);
      assert.equal(options.notes.selected_method, 'NET_BANKING');
      assert.deepEqual(options.config?.display?.sequence, ['netbanking', 'upi', 'card', 'wallet']);
      assert.equal(options.config?.display?.preferences?.show_default_blocks, true);
    });
  });

  describe('Pure UPI Mode Selection', () => {
    it('configures generic UPI when no sub-app is passed', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI'
      });

      assert.equal(options.prefill.method, 'upi');
      assert.equal(options.notes.selected_method, 'UPI');
      assert.deepEqual(options.config?.display?.sequence, ['upi', 'card', 'netbanking', 'wallet']);
      assert.equal(options.config?.display?.preferences?.show_default_blocks, true);
    });
  });

  describe('COD and Fallback Behavior', () => {
    it('does not force prefill method for COD and keeps all instruments visible', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'COD'
      });

      assert.equal(options.prefill.method, undefined);
      assert.equal(options.notes.selected_method, 'COD');
      assert.equal(options.config?.display?.preferences?.show_default_blocks, true);
      assert.deepEqual(options.config?.display?.sequence, ['upi', 'card', 'netbanking', 'wallet']);
    });

    it('never specifies a hide list that blocks alternative payment methods', () => {
      const allMethods = ['UPI', 'CARD', 'NET_BANKING', 'COD'];
      for (const method of allMethods) {
        const opts = buildRazorpayCheckoutOptions({
          ...baseParams,
          selectedPaymentMethod: method
        });
        assert.equal(opts.config?.display?.hide, undefined);
        assert.equal(opts.config?.display?.preferences?.show_default_blocks, true);
      }
    });
  });
});
