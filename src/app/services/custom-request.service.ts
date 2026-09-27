import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CustomOrderRequest } from '../models/order.model';
import { AdminAuthService } from './admin-auth.service';
import { CustomerAuthService } from './customer-auth.service';

export type CustomRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

@Injectable({ providedIn: 'root' })
export class CustomRequestService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);
  private customerAuth = inject(CustomerAuthService);
  private readonly apiUrl = 'http://localhost:8080/api';

  submit(request: CustomOrderRequest, attachment: File | null): Observable<CustomOrderRequest> {
    const formData = new FormData();
    const { id, referenceCode, status, attachmentUrl, createdAt, fileName, ...payload } = request;
    formData.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    if (attachment) formData.append('attachment', attachment);
    return this.http.post<CustomOrderRequest>(this.apiUrl + '/custom-requests', formData, {
      headers: this.customerAuth.authorizationHeaders()
    });
  }

  getRequests(deleted = false): Observable<CustomOrderRequest[]> {
    return this.http.get<CustomOrderRequest[]>(this.apiUrl + '/admin/custom-requests' + (deleted ? '?deleted=true' : ''), {
      headers: this.adminAuth.authorizationHeaders()
    });
  }

  moveToDeleted(id: number): Observable<CustomOrderRequest> {
    return this.http.patch<CustomOrderRequest>(this.apiUrl + '/admin/custom-requests/' + id + '/delete', {}, {
      headers: this.adminAuth.authorizationHeaders()
    });
  }

  restore(id: number): Observable<CustomOrderRequest> {
    return this.http.patch<CustomOrderRequest>(this.apiUrl + '/admin/custom-requests/' + id + '/restore', {}, {
      headers: this.adminAuth.authorizationHeaders()
    });
  }

  updateStatus(id: number, status: CustomRequestStatus): Observable<CustomOrderRequest> {
    return this.http.patch<CustomOrderRequest>(this.apiUrl + '/admin/custom-requests/' + id + '/status', { status }, {
      headers: this.adminAuth.authorizationHeaders()
    });
  }

  downloadAttachment(id: number): Observable<Blob> {
    return this.http.get(this.apiUrl + '/admin/custom-requests/' + id + '/attachment', {
      headers: this.adminAuth.authorizationHeaders(), responseType: 'blob'
    });
  }
}
