import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private productService = inject(ProductService);

  featuredProducts: Product[] = [];
  categories: Category[] = [];
  isLoading = true;

  ngOnInit(): void {
    // 1. Safe load of featured products
    this.productService.getFeaturedProducts().subscribe({
      next: (products) => {
        this.featuredProducts = products || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading featured products:', err);
        this.isLoading = false;
      }
    });

    // 2. Safe load of categories
    this.productService.getCategories().subscribe({
      next: (cats) => {
        this.categories = cats || [];
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }
}