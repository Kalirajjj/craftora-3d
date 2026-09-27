import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../models/product.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-product-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-product-list.component.html',
  styleUrls: ['./admin-product-list.component.css']
})
export class AdminProductListComponent implements OnInit {
  private productsApi = inject(ProductService);
  products: Product[] = [];
  isLoading = true;
  errorMessage = '';
  deletingId: string | number | null = null;

  ngOnInit(): void { this.refresh(); }
  refresh(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.productsApi.getProducts().subscribe({
      next: products => { this.products = products; this.isLoading = false; },
      error: () => { this.errorMessage = 'Could not load products from the backend.'; this.isLoading = false; }
    });
  }

  deleteProduct(product: Product): void {
    if (!window.confirm(`Delete “${product.name}” from the catalogue? This cannot be undone.`)) return;
    this.deletingId = product.id;
    this.errorMessage = '';
    this.productsApi.deleteProduct(product.id).subscribe({
      next: () => { this.products = this.products.filter(item => item.id !== product.id); this.deletingId = null; },
      error: err => { this.errorMessage = err.error?.detail || err.error?.message || 'Product could not be deleted.'; this.deletingId = null; }
    });
  }
}
