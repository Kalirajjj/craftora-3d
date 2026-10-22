import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AppConfigService } from './app-config.service';

interface AdminSession {
  username: string;
  authHeader: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get sessionUrl(): string {
    return `${this.config.apiGatewayUrl}/api/admin/session`;
  }
  private readonly storageKey = 'craftora_admin_session';

  readonly isLoggedIn = signal<boolean>(this.hasSession());

  login(username: string, password: string): Observable<void> {
    const authHeader = this.createAuthHeader(username, password);
    return this.http.get<void>(this.sessionUrl, {
      headers: new HttpHeaders({ Authorization: authHeader })
    }).pipe(tap(() => {
      this.storeSession({
        username: username.trim(),
        authHeader
      });
      this.isLoggedIn.set(true);
    }));
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  getUsername(): string | null {
    return this.getSession()?.username || null;
  }

  authorizationHeaders(): HttpHeaders {
    const session = this.getSession();
    if (!session?.authHeader) return new HttpHeaders();
    return new HttpHeaders({ Authorization: session.authHeader });
  }

  logout(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(this.storageKey);
      }
    } catch {
      /* ignore storage errors */
    }
    this.isLoggedIn.set(false);
  }

  private hasSession(): boolean {
    return this.getSession() !== null;
  }

  private getSession(): AdminSession | null {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AdminSession;
      return parsed?.authHeader ? parsed : null;
    } catch {
      return null;
    }
  }

  private storeSession(session: AdminSession): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(this.storageKey, JSON.stringify(session));
      }
    } catch {
      /* ignore storage errors */
    }
  }

  private createAuthHeader(username: string, password: string): string {
    const bytes = new TextEncoder().encode(username.trim() + ':' + password);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return 'Basic ' + btoa(binary);
  }
}
