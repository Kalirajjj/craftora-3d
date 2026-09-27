import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface CustomerProfile { id: number; email: string; fullName: string; phone: string | null; verified: boolean; }
export interface CustomerQuote { referenceCode: string; productType: string; description: string; quantity: number; preferredColor: string | null; additionalNotes: string | null; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'; createdAt: string; requiredDate: string | null; }
export interface CustomerAddress { id: number; label: string; recipientName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; state: string; pincode: string; defaultAddress: boolean; }

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly http = inject(HttpClient);
  private readonly api = 'http://localhost:8080/api/customer';
  private readonly tokenKey = 'craftora_customer_token';
  private readonly profileKey = 'craftora_customer_profile';
  readonly token = signal<string | null>(this.read(this.tokenKey));
  readonly customer = signal<CustomerProfile | null>(this.readProfile());
  isSignedIn(): boolean { return Boolean(this.token()); }
  authorizationHeaders(): HttpHeaders { return this.token() ? new HttpHeaders({ Authorization: `Bearer ${this.token()}` }) : new HttpHeaders(); }

  register(payload: { email: string; password: string; fullName: string; phone: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/register`, payload);
  }
  login(email: string, password: string): Observable<{ token: string; customer: CustomerProfile }> {
    return this.http.post<{ token: string; customer: CustomerProfile }>(`${this.api}/auth/login`, { email, password }).pipe(tap(result => {
      this.token.set(result.token); this.customer.set(result.customer);
      this.store(this.tokenKey, result.token); this.store(this.profileKey, JSON.stringify(result.customer));
    }));
  }
  verify(token: string): Observable<{ message: string }> { return this.http.post<{ message: string }>(`${this.api}/auth/verify`, { token }); }
  resendVerification(email: string): Observable<{ message: string }> { return this.http.post<{ message: string }>(`${this.api}/auth/resend-verification`, { email }); }
  forgotPassword(email: string): Observable<{ message: string }> { return this.http.post<{ message: string }>(`${this.api}/auth/forgot-password`, { email }); }
  resetPassword(token: string, password: string): Observable<{ message: string }> { return this.http.post<{ message: string }>(`${this.api}/auth/reset-password`, { token, password }); }
  getProfile(): Observable<CustomerProfile> { return this.http.get<CustomerProfile>(`${this.api}/profile`, { headers: this.authorizationHeaders() }).pipe(tap(profile => this.setProfile(profile))); }
  updateProfile(fullName: string, phone: string): Observable<CustomerProfile> {
    return this.http.put<CustomerProfile>(`${this.api}/profile`, { fullName, phone }, { headers: this.authorizationHeaders() }).pipe(tap(profile => this.setProfile(profile)));
  }
  getQuotes(): Observable<CustomerQuote[]> { return this.http.get<CustomerQuote[]>(`${this.api}/quotes`, { headers: this.authorizationHeaders() }); }
  getAddresses(): Observable<CustomerAddress[]> { return this.http.get<CustomerAddress[]>(`${this.api}/addresses`, { headers: this.authorizationHeaders() }); }
  addAddress(address: Omit<CustomerAddress, 'id'>): Observable<CustomerAddress> { return this.http.post<CustomerAddress>(`${this.api}/addresses`, address, { headers: this.authorizationHeaders() }); }
  deleteAddress(id: number): Observable<void> { return this.http.delete<void>(`${this.api}/addresses/${id}`, { headers: this.authorizationHeaders() }); }
  logout(): void {
    this.http.post(`${this.api}/auth/logout`, {}, { headers: this.authorizationHeaders() }).subscribe({ error: () => undefined });
    this.token.set(null); this.customer.set(null); this.store(this.tokenKey, null); this.store(this.profileKey, null);
  }
  private setProfile(profile: CustomerProfile): void { this.customer.set(profile); this.store(this.profileKey, JSON.stringify(profile)); }
  private read(key: string): string | null { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key); } catch { return null; } }
  private readProfile(): CustomerProfile | null { try { const profile = this.read(this.profileKey); return profile ? JSON.parse(profile) as CustomerProfile : null; } catch { return null; } }
  private store(key: string, value: string | null): void { try { if (typeof sessionStorage !== 'undefined') value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value); } catch { /* storage can be unavailable in private browsing */ } }
}
