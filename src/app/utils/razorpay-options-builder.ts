/**
 * Razorpay Checkout Options Builder
 * Synchronizes Craftora 3D UI payment selection with Razorpay Checkout Standard JS options.
 *
 * Supported Razorpay parameters used:
 * - prefill.method: 'upi' | 'card' | 'netbanking' | 'wallet'
 * - prefill.vpa: customer VPA handle when provided
 * - prefill.bank: standard 4-character IFSC bank identifier for Net Banking
 * - config.display.blocks: prioritizes the customer's selected instrument/app/bank
 * - config.display.sequence: sequences the preferred block first
 * - config.display.preferences.show_default_blocks: true (preserves fallback payment methods so customer is never locked out)
 */

export interface RazorpayOptionsBuilderParams {
  keyId: string;
  orderId: number | string;
  paymentOrderId: string;
  totalAmount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  selectedPaymentMethod: 'UPI' | 'CARD' | 'NET_BANKING' | 'COD' | string;
  upiApp?: 'gpay' | 'phonepe' | 'paytm' | 'other' | string;
  upiId?: string;
  selectedBank?: string;
  themeColor?: string;
  handler?: (response: any) => void;
  onDismiss?: () => void;
}

export interface RazorpayDisplayInstrument {
  method: string;
  apps?: string[];
  banks?: string[];
  issuers?: string[];
}

export interface RazorpayDisplayBlock {
  name: string;
  instruments: RazorpayDisplayInstrument[];
}

export interface RazorpayConfigDisplay {
  blocks?: Record<string, RazorpayDisplayBlock>;
  sequence?: string[];
  preferences?: {
    show_default_blocks?: boolean;
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
    method?: string;
    vpa?: string;
    bank?: string;
  };
  notes: {
    order_id: string;
    shipping_address: string;
    selected_method?: string;
  };
  theme: {
    color: string;
  };
  config?: {
    display: RazorpayConfigDisplay;
  };
  handler?: (response: any) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

/**
 * Standard Razorpay 4-letter netbanking bank codes.
 */
export const RAZORPAY_BANK_CODE_MAP: Record<string, string> = {
  HDFC: 'HDFC',
  ICICI: 'ICIC',
  SBI: 'SBIN',
  Axis: 'UTIB',
  Kotak: 'KKBK',
  PNB: 'PUNB',
  BOB: 'BARB_R',
  Canara: 'CNRB',
  IndusInd: 'INDB',
  Yes: 'YESB'
};

export function getRazorpayBankCode(bank: string): string {
  if (!bank) return '';
  const normalized = bank.trim();
  return RAZORPAY_BANK_CODE_MAP[normalized] || normalized.toUpperCase();
}

/**
 * Builds the official Razorpay Checkout Standard options object with synchronized
 * payment method prioritization, while ensuring fallback methods remain accessible.
 */
export function buildRazorpayCheckoutOptions(
  params: RazorpayOptionsBuilderParams
): RazorpayCheckoutOptions {
  const currency = params.currency || 'INR';
  const amountPaise = Math.round(params.totalAmount * 100);

  const prefill: RazorpayCheckoutOptions['prefill'] = {
    name: params.customerName || '',
    email: (params.customerEmail || '').trim().toLowerCase(),
    contact: params.customerPhone || ''
  };

  const notes: RazorpayCheckoutOptions['notes'] = {
    order_id: String(params.orderId),
    shipping_address: params.shippingAddress || '',
    selected_method: params.selectedPaymentMethod
  };

  let configDisplay: RazorpayConfigDisplay | undefined;

  switch (params.selectedPaymentMethod) {
    case 'UPI': {
      prefill.method = 'upi';

      if (params.upiApp === 'gpay') {
        notes.selected_method = 'UPI_GPAY';
        configDisplay = {
          blocks: {
            preferred_gpay: {
              name: 'Google Pay',
              instruments: [
                {
                  method: 'upi',
                  apps: ['google_pay']
                }
              ]
            },
            other_options: {
              name: 'Other Payment Methods',
              instruments: [
                { method: 'upi' },
                { method: 'card' },
                { method: 'netbanking' },
                { method: 'wallet' }
              ]
            }
          },
          sequence: ['block.preferred_gpay', 'block.other_options'],
          preferences: {
            show_default_blocks: true // Never hide fallback methods!
          }
        };
      } else if (params.upiApp === 'phonepe') {
        notes.selected_method = 'UPI_PHONEPE';
        configDisplay = {
          blocks: {
            preferred_phonepe: {
              name: 'PhonePe',
              instruments: [
                {
                  method: 'upi',
                  apps: ['phonepe']
                }
              ]
            },
            other_options: {
              name: 'Other Payment Methods',
              instruments: [
                { method: 'upi' },
                { method: 'card' },
                { method: 'netbanking' },
                { method: 'wallet' }
              ]
            }
          },
          sequence: ['block.preferred_phonepe', 'block.other_options'],
          preferences: {
            show_default_blocks: true
          }
        };
      } else if (params.upiApp === 'paytm') {
        notes.selected_method = 'UPI_PAYTM';
        configDisplay = {
          blocks: {
            preferred_paytm: {
              name: 'Paytm UPI',
              instruments: [
                {
                  method: 'upi',
                  apps: ['paytm']
                }
              ]
            },
            other_options: {
              name: 'Other Payment Methods',
              instruments: [
                { method: 'upi' },
                { method: 'card' },
                { method: 'netbanking' },
                { method: 'wallet' }
              ]
            }
          },
          sequence: ['block.preferred_paytm', 'block.other_options'],
          preferences: {
            show_default_blocks: true
          }
        };
      } else if (params.upiApp === 'other') {
        notes.selected_method = 'UPI_COLLECT_ID';
        if (params.upiId && params.upiId.trim()) {
          prefill.vpa = params.upiId.trim();
        }
        configDisplay = {
          sequence: ['upi', 'card', 'netbanking', 'wallet'],
          preferences: {
            show_default_blocks: true
          }
        };
      } else {
        notes.selected_method = 'UPI';
        configDisplay = {
          sequence: ['upi', 'card', 'netbanking', 'wallet'],
          preferences: {
            show_default_blocks: true
          }
        };
      }
      break;
    }

    case 'CARD': {
      prefill.method = 'card';
      notes.selected_method = 'CARD';
      configDisplay = {
        blocks: {
          preferred_card: {
            name: 'Credit or Debit Card',
            instruments: [
              {
                method: 'card'
              }
            ]
          },
          other_options: {
            name: 'Other Payment Methods',
            instruments: [
              { method: 'upi' },
              { method: 'netbanking' },
              { method: 'wallet' }
            ]
          }
        },
        sequence: ['block.preferred_card', 'block.other_options'],
        preferences: {
          show_default_blocks: true
        }
      };
      break;
    }

    case 'NET_BANKING': {
      prefill.method = 'netbanking';
      const bankCode = params.selectedBank ? getRazorpayBankCode(params.selectedBank) : '';
      if (bankCode) {
        prefill.bank = bankCode;
        const bankDisplayName = `${params.selectedBank} Net Banking`;
        notes.selected_method = `NET_BANKING_${bankCode}`;

        configDisplay = {
          blocks: {
            preferred_bank: {
              name: bankDisplayName,
              instruments: [
                {
                  method: 'netbanking',
                  banks: [bankCode]
                }
              ]
            },
            other_options: {
              name: 'Other Payment Methods',
              instruments: [
                { method: 'netbanking' },
                { method: 'upi' },
                { method: 'card' },
                { method: 'wallet' }
              ]
            }
          },
          sequence: ['block.preferred_bank', 'block.other_options'],
          preferences: {
            show_default_blocks: true
          }
        };
      } else {
        notes.selected_method = 'NET_BANKING';
        configDisplay = {
          sequence: ['netbanking', 'upi', 'card', 'wallet'],
          preferences: {
            show_default_blocks: true
          }
        };
      }
      break;
    }

    case 'COD':
    default: {
      notes.selected_method = params.selectedPaymentMethod || 'GENERAL';
      configDisplay = {
        sequence: ['upi', 'card', 'netbanking', 'wallet'],
        preferences: {
          show_default_blocks: true
        }
      };
      break;
    }
  }

  const options: RazorpayCheckoutOptions = {
    key: params.keyId,
    amount: amountPaise,
    currency,
    name: 'Craftora 3D',
    description: `Order #${params.orderId}`,
    order_id: params.paymentOrderId,
    prefill,
    notes,
    theme: {
      color: params.themeColor || '#6366f1'
    }
  };

  if (configDisplay) {
    options.config = {
      display: configDisplay
    };
  }

  if (params.handler) {
    options.handler = params.handler;
  }

  if (params.onDismiss) {
    options.modal = {
      ondismiss: params.onDismiss
    };
  }

  return options;
}
