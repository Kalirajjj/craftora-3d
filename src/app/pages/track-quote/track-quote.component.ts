import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerAuthService, CustomerQuote } from '../../services/customer-auth.service';

@Component({
  selector: 'app-track-quote',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './track-quote.component.html',
  styleUrls: ['./track-quote.component.css']
})
export class TrackQuoteComponent implements OnInit {
  readonly customerAuth = inject(CustomerAuthService);
  quotes: CustomerQuote[] = [];
  selectedQuote: CustomerQuote | null = null;
  isLoading = false;
  errorMessage = '';

  get isSignedIn(): boolean { return this.customerAuth.isSignedIn() && Boolean(this.customerAuth.customer()); }
  get pendingCount(): number { return this.quotes.filter(quote => quote.status === 'PENDING').length; }
  get inProgressCount(): number { return this.quotes.filter(quote => quote.status === 'IN_PROGRESS').length; }
  get completedCount(): number { return this.quotes.filter(quote => quote.status === 'COMPLETED').length; }

  ngOnInit(): void {
    if (!this.isSignedIn) return;
    this.isLoading = true;
    this.customerAuth.getQuotes().subscribe({
      next: quotes => { this.quotes = quotes; this.isLoading = false; },
      error: () => { this.errorMessage = 'We could not load your quote requests. Please try again.'; this.isLoading = false; }
    });
  }

  statusLabel(status: CustomerQuote['status']): string {
    if (status === 'IN_PROGRESS') return 'In progress';
    if (status === 'COMPLETED') return 'Completed';
    return 'Pending';
  }

  openDetails(quote: CustomerQuote): void { this.selectedQuote = quote; }
  closeDetails(): void { this.selectedQuote = null; }
}
