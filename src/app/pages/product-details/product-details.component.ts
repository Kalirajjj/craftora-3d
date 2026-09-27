import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);

  product?: Product;
  relatedProducts: Product[] = [];
  selectedColor = '';
  quantity = 1;
  addedAlert = false;
  selectedImageUrl = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadProduct(id);
      }
    });
  }

  loadProduct(id: string): void {
    this.productService.getProductById(id).subscribe(p => {
      this.product = p;
      if (p) {
        this.selectedImageUrl = p.images?.[0]?.url || p.image || '';
        this.selectedColor = p.availableColors?.[0] || 'Default';

        this.productService.getRelatedProducts(p.category || '', p.id)
          .subscribe(r => this.relatedProducts = r);
      }
    });
  }

  selectImage(url: string): void { this.selectedImageUrl = url; }

  selectColor(color: string): void {
    this.selectedColor = color;
  }

  incrementQty(): void {
    this.quantity++;
  }

  decrementQty(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity, this.selectedColor);
      this.addedAlert = true;
      setTimeout(() => this.addedAlert = false, 2500);
    }
  }

  buyNow(): void {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity, this.selectedColor);
      this.router.navigate(['/cart']);
    }
  }
}
