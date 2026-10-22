import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';
import { AppConfigService } from './app-config.service';
import { ContactMessage, MessagesListResponse } from '../models/contact-message.model';

@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);
  private config = inject(AppConfigService);

  private get publicUrl(): string {
    return `${this.config.apiGatewayUrl}/api/contact`;
  }
  private get adminUrl(): string {
    return `${this.config.apiGatewayUrl}/api/admin/messages`;
  }

  private unreadCountSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }

  // Public: Send a message from contact page
  sendMessage(payload: { name: string; email: string; phone?: string; message: string }): Observable<{ success: boolean; message: string; id: number }> {
    return this.http.post<{ success: boolean; message: string; id: number }>(this.publicUrl, payload);
  }

  // Admin: Get messages with filter (ALL, UNREAD, READ) and summary counts
  getAdminMessages(filter: 'ALL' | 'UNREAD' | 'READ' = 'ALL'): Observable<MessagesListResponse> {
    return this.http.get<MessagesListResponse>(`${this.adminUrl}?filter=${filter}`, {
      headers: this.auth.authorizationHeaders()
    }).pipe(
      tap((res) => {
        if (res && res.unreadCount !== undefined) {
          this.setUnreadCount(res.unreadCount);
        }
      })
    );
  }

  // Admin: Mark message as read/unread
  markAsRead(id: number, isRead: boolean = true): Observable<ContactMessage> {
    return this.http.patch<ContactMessage>(
      `${this.adminUrl}/${id}/read`,
      { isRead },
      { headers: this.auth.authorizationHeaders() }
    );
  }

  // Admin: Delete a message
  deleteMessage(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`, {
      headers: this.auth.authorizationHeaders()
    });
  }
}
