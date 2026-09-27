import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  readonly isDarkMode = signal(false);

  constructor() {
    const savedTheme = isPlatformBrowser(this.platformId)
      ? window.localStorage.getItem('craftora-theme')
      : null;
    this.setDarkMode(savedTheme === 'dark', false);
  }

  toggle(): void { this.setDarkMode(!this.isDarkMode()); }

  private setDarkMode(enabled: boolean, persist = true): void {
    this.isDarkMode.set(enabled);
    this.document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
    if (persist && isPlatformBrowser(this.platformId)) {
      window.localStorage.setItem('craftora-theme', enabled ? 'dark' : 'light');
    }
  }
}
