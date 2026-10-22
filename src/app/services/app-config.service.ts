import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface RuntimeConfig {
  apiGatewayUrl: string;
  razorpayKeyId?: string;
  environment?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private platformId = inject(PLATFORM_ID);
  private config: RuntimeConfig = {
    apiGatewayUrl: 'http://localhost:8080',
    environment: 'development'
  };
  private isLoaded = false;

  loadConfig(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.isLoaded = true;
      return Promise.resolve();
    }

    return fetch('/runtime-config.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load runtime-config.json: HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((cfg: RuntimeConfig) => {
        if (!cfg.apiGatewayUrl || !cfg.apiGatewayUrl.trim()) {
          throw new Error('Invalid runtime-config.json: apiGatewayUrl is required.');
        }
        this.config = {
          ...this.config,
          ...cfg,
          apiGatewayUrl: cfg.apiGatewayUrl.trim().replace(/\/+$/, '')
        };
        this.isLoaded = true;
      })
      .catch(error => {
        console.warn('Could not load /runtime-config.json, using local development defaults:', error);
        this.isLoaded = true;
      });
  }

  get apiGatewayUrl(): string {
    return this.config.apiGatewayUrl;
  }

  get razorpayKeyId(): string | undefined {
    return this.config.razorpayKeyId;
  }

  get environment(): string {
    return this.config.environment || 'development';
  }

  get isProduction(): boolean {
    return this.config.environment === 'production';
  }
}
