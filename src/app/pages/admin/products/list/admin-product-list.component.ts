import { Component, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../models/product.model';

@Component({
  selector: 'app-admin-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-product-list.component.html',
  styleUrls: ['./admin-product-list.component.css']
})
export class AdminProductListComponent implements OnInit {
  private productsApi = inject(ProductService);

  products: Product[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';

  // Filter & Search states
  searchQuery = '';
  selectedCategory = 'ALL';
  selectedStock = 'ALL'; // 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'
  sortBy = 'DEFAULT'; // 'DEFAULT' | 'PRICE_LOW' | 'PRICE_HIGH' | 'NAME_ASC' | 'NAME_DESC'

  // Delete modal state
  productToDelete: Product | null = null;
  isDeleting = false;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.productsApi.getProducts().subscribe({
      next: (products) => {
        this.products = products || [];
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Could not load products from the backend database.';
        this.isLoading = false;
      }
    });
  }

  get categories(): string[] {
    const categorySet = new Set<string>();
    for (const p of this.products) {
      if (p.category?.trim()) {
        categorySet.add(p.category.trim());
      }
    }
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }

  get inStockCount(): number {
    return this.products.filter(p => p.inStock).length;
  }

  get outOfStockCount(): number {
    return this.products.filter(p => !p.inStock).length;
  }

  get filteredProducts(): Product[] {
    let list = [...this.products];

    // Search query filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        String(p.id).toLowerCase().includes(q)
      );
    }

    // Category filter
    if (this.selectedCategory !== 'ALL') {
      list = list.filter(p => p.category?.trim() === this.selectedCategory);
    }

    // Stock availability filter
    if (this.selectedStock === 'IN_STOCK') {
      list = list.filter(p => Boolean(p.inStock));
    } else if (this.selectedStock === 'OUT_OF_STOCK') {
      list = list.filter(p => !p.inStock);
    }

    // Sorting
    switch (this.sortBy) {
      case 'PRICE_LOW':
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'PRICE_HIGH':
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'NAME_ASC':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'NAME_DESC':
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      default:
        break;
    }

    return list;
  }

  get hasActiveFilters(): boolean {
    return Boolean(
      this.searchQuery.trim() ||
      this.selectedCategory !== 'ALL' ||
      this.selectedStock !== 'ALL' ||
      this.sortBy !== 'DEFAULT'
    );
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'ALL';
    this.selectedStock = 'ALL';
    this.sortBy = 'DEFAULT';
  }

  filterByStock(status: 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'): void {
    this.selectedStock = status;
  }

  openDeleteModal(product: Product): void {
    this.productToDelete = product;
    this.errorMessage = '';
  }

  @HostListener('document:keydown.escape')
  onKeydownEscape(): void {
    if (this.productToDelete && !this.isDeleting) {
      this.closeDeleteModal();
    }
  }

  closeDeleteModal(): void {
    if (!this.isDeleting) {
      this.productToDelete = null;
    }
  }

  confirmDelete(): void {
    if (!this.productToDelete) return;
    const target = this.productToDelete;
    this.isDeleting = true;
    this.errorMessage = '';

    this.productsApi.deleteProduct(target.id).subscribe({
      next: () => {
        this.products = this.products.filter(item => item.id !== target.id);
        this.isDeleting = false;
        this.productToDelete = null;
        this.successMessage = `“${target.name}” has been successfully deleted from the catalogue.`;
        setTimeout(() => {
          if (this.successMessage.includes(target.name)) {
            this.successMessage = '';
          }
        }, 5000);
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || err.error?.message || `Failed to delete “${target.name}”.`;
        this.isDeleting = false;
        this.productToDelete = null;
      }
    });
  }

  dismissAlert(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
  }
}
