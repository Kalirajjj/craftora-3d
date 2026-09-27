import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private readonly sessionUrl = 'http://localhost:8080/api/admin/session';
  private username: string | null = null;
  private password: string | null = null;

  login(username: string, password: string): Observable<void> {
    return this.http.get<void>(this.sessionUrl, {
      headers: this.createHeaders(username, password)
    }).pipe(tap(() => {
      this.username = username;
      this.password = password;
    }));
  }

  isAuthenticated(): boolean {
    return this.username !== null && this.password !== null;
  }

  authorizationHeaders(): HttpHeaders {
    if (!this.username || !this.password) return new HttpHeaders();
    return this.createHeaders(this.username, this.password);
  }

  logout(): void {
    this.username = null;
    this.password = null;
  }

  private createHeaders(username: string, password: string): HttpHeaders {
    const bytes = new TextEncoder().encode(username + ':' + password);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return new HttpHeaders({ Authorization: 'Basic ' + btoa(binary) });
  }
}
