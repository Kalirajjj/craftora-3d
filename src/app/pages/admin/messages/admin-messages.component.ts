import { Component, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactMessageService } from '../../../services/contact-message.service';
import { ContactMessage, MessagesListResponse } from '../../../models/contact-message.model';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-messages.component.html',
  styleUrls: ['./admin-messages.component.css']
})
export class AdminMessagesComponent implements OnInit {
  private messagesApi = inject(ContactMessageService);

  messages: ContactMessage[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';

  // Filter & Search states
  currentFilter: 'ALL' | 'UNREAD' | 'READ' = 'ALL';
  searchQuery = '';

  // Summary counts
  totalCount = 0;
  unreadCount = 0;
  readCount = 0;

  // Pagination
  currentPage = 1;
  pageSize = 5;

  // View Modal state
  selectedMessage: ContactMessage | null = null;
  copiedField: string | null = null;

  // Delete Modal state
  messageToDelete: ContactMessage | null = null;
  isDeleting = false;

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Always fetch ALL messages so tab switching and counts are 100% reactive in memory
    this.messagesApi.getAdminMessages('ALL').subscribe({
      next: (response: MessagesListResponse) => {
        this.messages = response.messages || [];
        this.recalculateCounts();
        this.isLoading = false;
        this.ensureValidPage();
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || err.error?.detail || 'Failed to load customer messages.';
        this.isLoading = false;
      }
    });
  }

  setFilter(filter: 'ALL' | 'UNREAD' | 'READ'): void {
    this.currentFilter = filter;
    this.currentPage = 1;
    this.ensureValidPage();
  }

  isRead(msg: ContactMessage): boolean {
    return Boolean(msg.isRead ?? msg.read);
  }

  // Filtered and searched list
  get filteredMessages(): ContactMessage[] {
    let list = this.messages;

    // 1. Filter by current selected tab (ALL, UNREAD, READ)
    if (this.currentFilter === 'UNREAD') {
      list = list.filter(m => !this.isRead(m));
    } else if (this.currentFilter === 'READ') {
      list = list.filter(m => this.isRead(m));
    }

    // 2. Filter by search query
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.phone && m.phone.toLowerCase().includes(q)) ||
        (m.message && m.message.toLowerCase().includes(q))
      );
    }

    return list;
  }

  // Pagination getters
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMessages.length / this.pageSize));
  }

  get pagedMessages(): ContactMessage[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredMessages.slice(start, start + this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  private ensureValidPage(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  // View full message modal
  openViewModal(msg: ContactMessage): void {
    this.selectedMessage = { ...msg };

    // If it was unread, automatically mark as read
    if (!this.isRead(msg)) {
      this.toggleRead(msg, true);
    }
  }

  closeViewModal(): void {
    this.selectedMessage = null;
    this.copiedField = null;
  }

  // Toggle Read / Unread status
  toggleRead(msg: ContactMessage, targetState?: boolean): void {
    const newState = targetState !== undefined ? targetState : !this.isRead(msg);

    this.messagesApi.markAsRead(msg.id, newState).subscribe({
      next: (updated: ContactMessage) => {
        msg.isRead = updated.isRead ?? updated.read ?? newState;
        msg.read = msg.isRead;
        if (this.selectedMessage && this.selectedMessage.id === msg.id) {
          this.selectedMessage.isRead = msg.isRead;
          this.selectedMessage.read = msg.isRead;
        }
        // Recalculate counts and update sidebar badge in real-time
        this.recalculateCounts();
        this.ensureValidPage();
      },
      error: () => {
        // Fallback: still update locally if network glitch
        msg.isRead = newState;
        msg.read = newState;
        this.recalculateCounts();
        this.ensureValidPage();
      }
    });
  }

  private recalculateCounts(): void {
    this.unreadCount = this.messages.filter(m => !this.isRead(m)).length;
    this.readCount = this.messages.filter(m => this.isRead(m)).length;
    this.totalCount = this.messages.length;
    this.messagesApi.setUnreadCount(this.unreadCount);
  }

  // Delete message modal
  openDeleteModal(msg: ContactMessage): void {
    this.messageToDelete = msg;
    this.errorMessage = '';
  }

  closeDeleteModal(): void {
    if (!this.isDeleting) {
      this.messageToDelete = null;
    }
  }

  confirmDelete(): void {
    if (!this.messageToDelete) return;
    const target = this.messageToDelete;
    this.isDeleting = true;

    this.messagesApi.deleteMessage(target.id).subscribe({
      next: () => {
        this.messages = this.messages.filter(m => m.id !== target.id);
        this.isDeleting = false;
        this.messageToDelete = null;
        if (this.selectedMessage?.id === target.id) {
          this.selectedMessage = null;
        }
        this.recalculateCounts();
        this.ensureValidPage();
        this.successMessage = `Message from “${target.name}” has been deleted.`;
        setTimeout(() => {
          if (this.successMessage.includes(target.name)) {
            this.successMessage = '';
          }
        }, 4000);
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || err.error?.detail || 'Failed to delete message.';
        this.isDeleting = false;
        this.messageToDelete = null;
      }
    });
  }

  copyToClipboard(text: string, field: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = field;
      setTimeout(() => {
        if (this.copiedField === field) {
          this.copiedField = null;
        }
      }, 2500);
    });
  }

  getInitials(name: string): string {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  @HostListener('document:keydown.escape')
  onKeydownEscape(): void {
    if (this.messageToDelete && !this.isDeleting) {
      this.closeDeleteModal();
    } else if (this.selectedMessage) {
      this.closeViewModal();
    }
  }
}
