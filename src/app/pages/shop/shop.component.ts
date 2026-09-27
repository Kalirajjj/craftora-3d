import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent],
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.css']
})
export class ShopComponent implements OnInit {
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);

  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];

  searchQuery = '';
  selectedCategory = 'All';
  maxPrice = 2500;
  sortBy = 'popular';
  isLoading = true; // Indicates whether data is still loading from Spring Boot

  ngOnInit(): void {
    // 1. Fetch Categories
    this.productService.getCategories().subscribe({
      next: (cats) => (this.categories = cats),
      error: (err) => console.error('Failed to load categories:', err)
    });

    // 2. Fetch Live Products from Spring Boot / PostgreSQL
    this.productService.getProducts().subscribe({
      next: (prods) => {
        this.allProducts = prods;
        this.isLoading = false;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Failed to load products from Spring Boot:', err);
        this.isLoading = false;
      }
    });

    // 3. Listen to URL query params (e.g., ?category=Planters)
    this.route.queryParams.subscribe((params) => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
      this.applyFilters();
    });
  }

  applyFilters(): void {
    if (!this.allProducts || this.allProducts.length === 0) {
      this.filteredProducts = [];
      return;
    }

    const query = this.searchQuery.trim().toLowerCase();

    this.filteredProducts = this.allProducts.filter((item) => {
      // Safe checks using (item.prop || '') in case any column is null in PostgreSQL
      const name = (item.name || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const category = item.category || '';

      const matchSearch = !query || name.includes(query) || description.includes(query);
      const matchCat = this.selectedCategory === 'All' || category.toLowerCase() === this.selectedCategory.toLowerCase();
      const matchPrice = item.price <= this.maxPrice;

      return matchSearch && matchCat && matchPrice;
    });

    // Sorting
    if (this.sortBy === 'price-low') {
      this.filteredProducts.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'price-high') {
      this.filteredProducts.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === 'rating') {
      this.filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
  }

  setCategory(cat: string): void {
    this.selectedCategory = cat;
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.maxPrice = 2500;
    this.sortBy = 'popular';
    this.applyFilters();
  }
}