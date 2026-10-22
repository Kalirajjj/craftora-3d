import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from '../../../services/product.service';
import { ContactMessageService } from '../../../services/contact-message.service';
import { CustomRequestService } from '../../../services/custom-request.service';
import { AdminUserService } from '../../../services/admin-user.service';
import { AdminAuthService } from '../../../services/admin-auth.service';
import { ContactMessage } from '../../../models/contact-message.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private productsApi = inject(ProductService);
  private messagesApi = inject(ContactMessageService);
  private customRequestsApi = inject(CustomRequestService);
  private adminUsersApi = inject(AdminUserService);
  private auth = inject(AdminAuthService);

  today = new Date();
  isLoading = true;
  adminUsername = '';

  // Metrics
  productCount = 0;
  unreadMessagesCount = 0;
  totalMessagesCount = 0;
  quoteRequestCount = 0;
  pendingQuotesCount = 0;
  adminUserCount = 0;

  // Recent Inquiries
  recentMessages: ContactMessage[] = [];

  ngOnInit(): void {
    this.adminUsername = this.auth.getUsername() || 'Admin';
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;

    forkJoin({
      products: this.productsApi.getProducts().pipe(catchError(() => of([]))),
      messages: this.messagesApi.getAdminMessages('ALL').pipe(catchError(() => of({ messages: [], totalCount: 0, unreadCount: 0, readCount: 0 }))),
      quotes: this.customRequestsApi.getRequests().pipe(catchError(() => of([]))),
      admins: this.adminUsersApi.getAll().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ products, messages, quotes, admins }) => {
        this.productCount = products.length;

        const allMessages = messages.messages || [];
        this.totalMessagesCount = messages.totalCount ?? allMessages.length;
        this.unreadMessagesCount = messages.unreadCount ?? allMessages.filter(m => !(m.isRead ?? m.read)).length;
        this.recentMessages = allMessages.slice(0, 4);
        this.messagesApi.setUnreadCount(this.unreadMessagesCount);

        this.quoteRequestCount = quotes.length;
        this.pendingQuotesCount = quotes.filter(q => q.status === 'PENDING').length;

        this.adminUserCount = admins.length;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  isMessageRead(msg: ContactMessage): boolean {
    return Boolean(msg.isRead ?? msg.read);
  }

  getInitials(name: string): string {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
}
