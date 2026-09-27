import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomRequestService } from '../../services/custom-request.service';
import { CustomOrderRequest } from '../../models/order.model';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'app-custom-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './custom-order.component.html',
  styleUrls: ['./custom-order.component.css']
})
export class CustomOrderComponent {
  private quoteRequests = inject(CustomRequestService);
  private customerAuth = inject(CustomerAuthService);
  readonly minRequiredDate = this.getMinimumRequiredDate();

  formData: CustomOrderRequest = {
    name: '',
    email: '',
    phone: '',
    productType: 'Home Décor / Vase',
    description: '',
    preferredColor: 'Teal',
    quantity: 1,
    requiredDate: '',
    additionalNotes: '',
    fileName: ''
  };

  submittedOrderNumber: string | null = null;
  submittedStatus = '';
  uploadedFileName: string | null = null;
  selectedFile: File | null = null;
  isSubmitting = false;
  errorMessage = '';

  constructor() {
    const customer = this.customerAuth.customer();
    if (customer) {
      this.formData.name = customer.fullName;
      this.formData.email = customer.email;
      this.formData.phone = customer.phone || '';
    }
  }

  get isSignedIn(): boolean { return this.customerAuth.isSignedIn() && Boolean(this.customerAuth.customer()); }
  get signedInCustomer() { return this.customerAuth.customer(); }

  private getMinimumRequiredDate(): string {
    const minimum = new Date();
    minimum.setHours(0, 0, 0, 0);
    minimum.setDate(minimum.getDate() + 3);
    const year = minimum.getFullYear();
    const month = String(minimum.getMonth() + 1).padStart(2, '0');
    const day = String(minimum.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 25 * 1024 * 1024) {
        this.errorMessage = 'The attachment must be 25 MB or smaller.';
        this.selectedFile = null;
        this.uploadedFileName = null;
        this.formData.fileName = '';
        input.value = '';
        return;
      }
      this.selectedFile = file;
      this.errorMessage = '';
      this.uploadedFileName = input.files[0].name;
      this.formData.fileName = this.uploadedFileName;
    }
  }

  onSubmit(): void {
    const customer = this.customerAuth.customer();
    if (!this.isSignedIn || !customer) { this.errorMessage = 'Please sign in before requesting a quote.'; return; }
    this.formData.name = customer.fullName;
    this.formData.email = customer.email;
    this.formData.phone = customer.phone?.trim() || this.formData.phone.trim();
    if (!this.formData.phone) { this.errorMessage = 'Add a phone number to your account or enter one for this request.'; return; }
    if (this.formData.requiredDate && this.formData.requiredDate < this.minRequiredDate) {
      this.errorMessage = 'Choose a required delivery date at least 3 days from today.';
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = '';
    this.quoteRequests.submit(this.formData, this.selectedFile).subscribe({
      next: request => {
        this.isSubmitting = false;
        this.submittedOrderNumber = request.referenceCode || 'RFQ-SUCCESS';
        this.submittedStatus = request.status === 'IN_PROGRESS' ? 'In progress'
          : request.status === 'COMPLETED' ? 'Completed' : 'Pending';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: error => {
        this.isSubmitting = false;
        this.errorMessage = error.error?.detail || error.error?.message || 'Your quote request could not be submitted. Please try again.';
      }
    });
  }

  saveQuoteDetails(): void {
    if (!this.submittedOrderNumber) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 720;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#f3f8f7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.roundRect(48, 48, 1104, 624, 28);
    context.fill();
    context.fillStyle = '#00a896';
    context.fillRect(48, 48, 12, 624);

    context.fillStyle = '#00a896';
    context.font = '700 22px Arial, sans-serif';
    context.fillText('CRAFTORA 3D  •  CUSTOM PRINTING', 100, 125);
    context.fillStyle = '#111827';
    context.font = '700 44px Arial, sans-serif';
    context.fillText('Quote request received', 100, 205);

    context.fillStyle = '#64748b';
    context.font = '600 18px Arial, sans-serif';
    context.fillText('QUOTE REFERENCE', 100, 278);
    context.fillStyle = '#111827';
    context.font = '700 40px Arial, sans-serif';
    context.fillText(this.submittedOrderNumber, 100, 330);

    context.fillStyle = '#64748b';
    context.font = '600 18px Arial, sans-serif';
    context.fillText('CURRENT STATUS', 100, 395);
    context.fillStyle = '#0f766e';
    context.font = '700 26px Arial, sans-serif';
    context.fillText(this.submittedStatus, 100, 435);

    context.fillStyle = '#334155';
    context.font = '500 21px Arial, sans-serif';
    context.fillText(`Project: ${this.formData.productType}`, 100, 505);
    if (this.formData.requiredDate) {
      context.fillText(`Requested delivery: ${this.formData.requiredDate}`, 100, 545);
    }
    context.fillStyle = '#64748b';
    context.font = '500 18px Arial, sans-serif';
    context.fillText('Save this image for your records. Track your request any time while signed in.', 100, 610);

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.submittedOrderNumber}-quote-details.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  resetForm(): void {
    this.submittedOrderNumber = null;
    this.submittedStatus = '';
    this.uploadedFileName = null;
    this.selectedFile = null;
    this.errorMessage = '';
    this.formData = {
      name: '',
      email: '',
      phone: '',
      productType: 'Home Décor / Vase',
      description: '',
      preferredColor: 'Teal',
      quantity: 1,
      requiredDate: '',
      additionalNotes: '',
      fileName: ''
    };
  }
}
