import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CustomOrderRequest } from '../../../models/order.model';
import { CustomRequestService, CustomRequestStatus } from '../../../services/custom-request.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-requests.component.html',
  styleUrls: ['./admin-requests.component.css']
})
export class AdminRequestsComponent implements OnInit {
  private quoteRequests = inject(CustomRequestService);
  requests: CustomOrderRequest[] = [];
  activeRequests: CustomOrderRequest[] = [];
  deletedRequests: CustomOrderRequest[] = [];
  showDeleted = false;
  selectedStatus: CustomRequestStatus = 'PENDING';
  isLoading = true;
  updatingId: number | null = null;
  downloadingId: number | null = null;
  errorMessage = '';
  expandedId: number | null = null;
  openStatusMenuId: number | null = null;
  readonly statusOptions: { value: CustomRequestStatus; label: string; icon: string }[] = [
    { value: 'PENDING', label: 'Pending', icon: 'pi-clock' },
    { value: 'IN_PROGRESS', label: 'In progress', icon: 'pi-cog' },
    { value: 'COMPLETED', label: 'Completed', icon: 'pi-check-circle' }
  ];

  get visibleRequests(): CustomOrderRequest[] {
    if (this.showDeleted) return this.requests;
    return this.requests.filter(request => (request.status || 'PENDING') === this.selectedStatus);
  }

  get emptyTitle(): string {
    if (this.showDeleted) return 'No deleted requests';
    return `No ${this.statusLabel(this.selectedStatus).toLowerCase()} quote requests`;
  }

  get emptyDescription(): string {
    if (this.showDeleted) return 'Requests moved here stay available for review and can be restored.';
    if (this.selectedStatus === 'PENDING') return 'You’re all caught up. New pending quote requests will appear here.';
    if (this.selectedStatus === 'IN_PROGRESS') return 'There are no quote requests being worked on right now.';
    return 'No quote requests have been completed yet.';
  }

  get pendingCount(): number { return this.activeRequests.filter(request => request.status === 'PENDING').length; }
  get inProgressCount(): number { return this.activeRequests.filter(request => request.status === 'IN_PROGRESS').length; }
  get completedCount(): number { return this.activeRequests.filter(request => request.status === 'COMPLETED').length; }

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.isLoading = true;
    this.errorMessage = '';
    forkJoin({ active: this.quoteRequests.getRequests(), deleted: this.quoteRequests.getRequests(true) }).subscribe({
      next: result => {
        this.activeRequests = result.active;
        this.deletedRequests = result.deleted;
        this.requests = this.showDeleted ? this.deletedRequests : this.activeRequests;
        this.isLoading = false;
      },
      error: () => { this.errorMessage = 'Could not load quote requests. Check that the backend is running and you are signed in.'; this.isLoading = false; }
    });
  }

  showRequestView(deleted: boolean): void {
    this.showDeleted = deleted;
    this.requests = deleted ? this.deletedRequests : this.activeRequests;
    this.expandedId = null;
    this.openStatusMenuId = null;
  }

  selectStatus(status: CustomRequestStatus): void {
    this.selectedStatus = status;
    this.openStatusMenuId = null;
  }

  moveToDeleted(request: CustomOrderRequest): void {
    if (request.id == null) return;
    this.updatingId = request.id;
    this.errorMessage = '';
    this.quoteRequests.moveToDeleted(request.id).subscribe({
      next: deleted => {
        this.activeRequests = this.activeRequests.filter(item => item.id !== deleted.id);
        this.deletedRequests = [deleted, ...this.deletedRequests];
        this.requests = this.showDeleted ? this.deletedRequests : this.activeRequests;
        this.updatingId = null;
      },
      error: () => { this.errorMessage = 'The quote request could not be moved to deleted.'; this.updatingId = null; }
    });
  }

  restoreRequest(request: CustomOrderRequest): void {
    if (request.id == null) return;
    this.updatingId = request.id;
    this.errorMessage = '';
    this.quoteRequests.restore(request.id).subscribe({
      next: restored => {
        this.deletedRequests = this.deletedRequests.filter(item => item.id !== restored.id);
        this.activeRequests = [restored, ...this.activeRequests];
        this.requests = this.showDeleted ? this.deletedRequests : this.activeRequests;
        this.updatingId = null;
      },
      error: () => { this.errorMessage = 'The quote request could not be restored.'; this.updatingId = null; }
    });
  }

  toggleDetails(id?: number): void {
    if (id == null) return;
    this.expandedId = this.expandedId === id ? null : id;
  }

  statusLabel(status?: string): string {
    if (status === 'IN_PROGRESS') return 'In progress';
    if (status === 'COMPLETED') return 'Completed';
    return 'Pending';
  }

  statusIcon(status?: string): string {
    if (status === 'IN_PROGRESS') return 'pi-cog';
    if (status === 'COMPLETED') return 'pi-check-circle';
    return 'pi-clock';
  }

  toggleStatusMenu(id?: number): void {
    if (id == null) return;
    this.openStatusMenuId = this.openStatusMenuId === id ? null : id;
  }

  setStatus(request: CustomOrderRequest, next: CustomRequestStatus): void {
    if (request.id == null) return;
    const previous = request.status || 'PENDING';
    this.openStatusMenuId = null;
    if (next === previous) return;
    this.updatingId = request.id;
    this.errorMessage = '';
    this.quoteRequests.updateStatus(request.id, next).subscribe({
      next: updated => { Object.assign(request, updated); this.updatingId = null; },
      error: () => { this.errorMessage = 'The request status could not be updated.'; this.updatingId = null; }
    });
  }

  downloadAttachment(request: CustomOrderRequest): void {
    if (request.id == null) return;
    this.downloadingId = request.id;
    this.errorMessage = '';
    this.quoteRequests.downloadAttachment(request.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = request.attachmentName || 'quote-attachment';
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingId = null;
      },
      error: () => { this.errorMessage = 'The attachment could not be downloaded.'; this.downloadingId = null; }
    });
  }
}
