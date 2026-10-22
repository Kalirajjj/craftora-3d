import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {
  private platformId = inject(PLATFORM_ID);
  private scriptLoadingPromise: Promise<boolean> | null = null;
  private readonly scriptUrl = 'https://checkout.razorpay.com/v1/checkout.js';

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  loadScript(): Promise<boolean> {
    if (!this.isBrowser()) {
      return Promise.resolve(false);
    }

    if (window.Razorpay) {
      return Promise.resolve(true);
    }

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise<boolean>((resolve) => {
      const existingScript = document.querySelector(`script[src="${this.scriptUrl}"]`);
      if (existingScript) {
        if (window.Razorpay) {
          resolve(true);
        } else {
          existingScript.addEventListener('load', () => resolve(true));
          existingScript.addEventListener('error', () => resolve(false));
        }
        return;
      }

      const script = document.createElement('script');
      script.src = this.scriptUrl;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        resolve(!!window.Razorpay);
      };

      script.onerror = () => {
        console.error('Failed to load official Razorpay Checkout SDK.');
        this.scriptLoadingPromise = null;
        resolve(false);
      };

      document.body.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }

  isLoaded(): boolean {
    return this.isBrowser() && !!window.Razorpay;
  }
}
