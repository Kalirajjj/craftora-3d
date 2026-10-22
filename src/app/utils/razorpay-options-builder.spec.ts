import {
  buildRazorpayCheckoutOptions,
  getRazorpayBankCode,
  RAZORPAY_BANK_CODE_MAP,
  RazorpayOptionsBuilderParams
} from './razorpay-options-builder';

describe('Razorpay Options Builder - Payment Method Synchronization', () => {
  const baseParams: RazorpayOptionsBuilderParams = {
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
      expect(getRazorpayBankCode('HDFC')).toBe('HDFC');
      expect(getRazorpayBankCode('ICICI')).toBe('ICIC');
      expect(getRazorpayBankCode('SBI')).toBe('SBIN');
      expect(getRazorpayBankCode('Axis')).toBe('UTIB');
      expect(getRazorpayBankCode('Kotak')).toBe('KKBK');
    });

    it('falls back to uppercase if bank is not in standard map', () => {
      expect(getRazorpayBankCode('custombank')).toBe('CUSTOMBANK');
      expect(getRazorpayBankCode('')).toBe('');
    });
  });

  describe('Google Pay (GPay) Synchronization', () => {
    it('configures Google Pay as prioritized block and prefill method while keeping default blocks', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'gpay'
      });

      expect(options.amount).toBe(149950);
      expect(options.currency).toBe('INR');
      expect(options.order_id).toBe('order_rzp_mock_123456789');

      expect(options.prefill.method).toBe('upi');
      expect(options.prefill.name).toBe('John Doe');
      expect(options.prefill.email).toBe('john.doe@example.com');
      expect(options.prefill.contact).toBe('9876543210');

      expect(options.notes.selected_method).toBe('UPI_GPAY');
      expect(options.notes.order_id).toBe('1001');

      expect(options.config?.display).toBeDefined();
      const display = options.config?.display;
      expect(display?.blocks?.['preferred_gpay']).toBeDefined();
      expect(display?.blocks?.['preferred_gpay']?.instruments).toEqual([
        { method: 'upi', apps: ['google_pay'] }
      ]);
      expect(display?.sequence?.[0]).toBe('block.preferred_gpay');

      // Crucial: fallback default blocks must remain visible
      expect(display?.preferences?.show_default_blocks).toBe(true);
      expect((options.config?.display as any)?.hide).toBeUndefined();
    });
  });

  describe('PhonePe and Paytm Synchronization', () => {
    it('configures PhonePe as prioritized block with fallbacks intact', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'phonepe'
      });

      expect(options.prefill.method).toBe('upi');
      expect(options.notes.selected_method).toBe('UPI_PHONEPE');
      expect(options.config?.display?.blocks?.['preferred_phonepe']).toBeDefined();
      expect(options.config?.display?.blocks?.['preferred_phonepe']?.instruments).toEqual([
        { method: 'upi', apps: ['phonepe'] }
      ]);
      expect(options.config?.display?.sequence?.[0]).toBe('block.preferred_phonepe');
      expect(options.config?.display?.preferences?.show_default_blocks).toBe(true);
    });

    it('configures Paytm as prioritized block with fallbacks intact', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'UPI',
        upiApp: 'paytm'
      });

      expect(options.prefill.method).toBe('upi');
      expect(options.notes.selected_method).toBe('UPI_PAYTM');
      expect(options.config?.display?.blocks?.['preferred_paytm']).toBeDefined();
      expect(options.config?.display?.blocks?.['preferred_paytm']?.instruments).toEqual([
        { method: 'upi', apps: ['paytm'] }
      ]);
      expect(options.config?.display?.sequence?.[0]).toBe('block.preferred_paytm');
      expect(options.config?.display?.preferences?.show_default_blocks).toBe(true);
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

      expect(options.prefill.method).toBe('upi');
      expect(options.prefill.vpa).toBe('craftora.buyer@okhdfcbank');
      expect(options.notes.selected_method).toBe('UPI_COLLECT_ID');
      expect(options.config?.display?.sequence?.[0]).toBe('upi');
      expect(options.config?.display?.preferences?.show_default_blocks).toBe(true);
    });
  });

  describe('Credit / Debit Card Synchronization', () => {
    it('configures Card prefill and prioritizes card block', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'CARD'
      });

      expect(options.prefill.method).toBe('card');
      expect(options.notes.selected_method).toBe('CARD');
      expect(options.config?.display?.blocks?.['preferred_card']).toBeDefined();
      expect(options.config?.display?.blocks?.['preferred_card']?.instruments).toEqual([
        { method: 'card' }
      ]);
      expect(options.config?.display?.sequence?.[0]).toBe('block.preferred_card');
      expect(options.config?.display?.preferences?.show_default_blocks).toBe(true);
    });
  });

  describe('Net Banking Synchronization', () => {
    it('maps selected bank and configures netbanking prefill and custom bank block', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'NET_BANKING',
        selectedBank: 'ICICI'
      });

      expect(options.prefill.method).toBe('netbanking');
      expect(options.prefill.bank).toBe('ICIC'); // mapped to ICIC
      expect(options.notes.selected_method).toBe('NET_BANKING_ICIC');
      expect(options.config?.display?.blocks?.['preferred_bank']).toBeDefined();
      expect(options.config?.display?.blocks?.['preferred_bank']?.instruments).toEqual([
        { method: 'netbanking', banks: ['ICIC'] }
      ]);
      expect(options.config?.display?.sequence?.[0]).toBe('block.preferred_bank');
      expect(options.config?.display?.preferences?.show_default_blocks).toBe(true);
    });

    it('correctly handles SBI netbanking', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'NET_BANKING',
        selectedBank: 'SBI'
      });

      expect(options.prefill.method).toBe('netbanking');
      expect(options.prefill.bank).toBe('SBIN'); // mapped to SBIN
      expect(options.notes.selected_method).toBe('NET_BANKING_SBIN');
    });
  });

  describe('COD and Fallback Behavior', () => {
    it('does not force prefill method for COD and keeps all instruments visible', () => {
      const options = buildRazorpayCheckoutOptions({
        ...baseParams,
        selectedPaymentMethod: 'COD'
      });

      expect(options.prefill.method).toBeUndefined();
      expect(options.notes.selected_method).toBe('COD');
      expect(options.config?.display?.preferences?.show_default_blocks).toBe(true);
      expect(options.config?.display?.sequence).toEqual(['upi', 'card', 'netbanking', 'wallet']);
    });

    it('never specifies a hide list that blocks alternative payment methods', () => {
      const allMethods = ['UPI', 'CARD', 'NET_BANKING', 'COD'];
      for (const method of allMethods) {
        const opts = buildRazorpayCheckoutOptions({
          ...baseParams,
          selectedPaymentMethod: method
        });
        expect((opts.config?.display as any)?.hide).toBeUndefined();
        expect(opts.config?.display?.preferences?.show_default_blocks).toBe(true);
      }
    });
  });
});
