import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import { ContactMessageService } from '../../services/contact-message.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  private auth = inject(AdminAuthService);
  private router = inject(Router);
  private messagesApi = inject(ContactMessageService);
  private unreadSub?: Subscription;

  unreadMessagesCount = 0;

  ngOnInit(): void {
    this.unreadSub = this.messagesApi.unreadCount$.subscribe(count => {
      this.unreadMessagesCount = count;
    });

    this.refreshUnreadCount();
  }

  ngOnDestroy(): void {
    this.unreadSub?.unsubscribe();
  }

  refreshUnreadCount(): void {
    this.messagesApi.getAdminMessages('UNREAD').subscribe({
      next: (res) => {
        const count = res.unreadCount ?? res.messages.length;
        this.unreadMessagesCount = count;
        this.messagesApi.setUnreadCount(count);
      },
      error: () => {
        // Silently ignore if not authorized
      }
    });
  }

  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
