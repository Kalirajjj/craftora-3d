import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../models/product.model';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-product-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-product-create.component.html',
  styleUrls: ['./admin-product-create.component.css']
})
export class AdminProductCreateComponent implements OnInit, OnDestroy {
  private productsApi = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  productId: string | null = null;
  isLoadingProduct = false;
  currentImages: string[] = [];
  isBusy = false;
  errorMessage = '';
  successMessage = '';
  readonly maxImages = 10;
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  isImageDialogOpen = false;
  productForm = { name: '', category: '', description: '', price: 0, dimensions: '',
    weightGrams: null as number | null, availableColors: '', featured: false, inStock: true };

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id');
    if (!this.productId) return;
    this.isLoadingProduct = true;
    this.productsApi.getProductById(this.productId).subscribe({
      next: product => {
        this.productForm = { name: product.name || '', category: product.category || '',
          description: product.description || '', price: Number(product.price) || 0, dimensions: product.dimensions || '',
          weightGrams: product.weightGrams ?? null, availableColors: (product.availableColors || []).join(', '),
          featured: Boolean(product.featured), inStock: product.inStock !== false };
        this.currentImages = (product.images?.map(image => image.url).filter(Boolean) || []);
        if (!this.currentImages.length && (product.image || product.imageUrl)) this.currentImages = [product.image || product.imageUrl!];
        this.isLoadingProduct = false;
      },
      error: err => { this.errorMessage = err.error?.detail || err.error?.message || 'Product could not be loaded.'; this.isLoadingProduct = false; }
    });
  }

  openImageDialog(): void { this.isImageDialogOpen = true; }
  closeImageDialog(): void { this.isImageDialogOpen = false; }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const incoming = Array.from(input.files || []);
    this.errorMessage = '';
    const valid = incoming.filter(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024);
    if (valid.length !== incoming.length) this.errorMessage = 'Use JPEG, PNG or WebP images up to 5 MB each.';
    const available = this.maxImages - this.selectedImages.length;
    if (valid.length > available) this.errorMessage = `You can add up to ${this.maxImages} images per product.`;
    const additions = valid.slice(0, Math.max(0, available));
    this.selectedImages = [...this.selectedImages, ...additions];
    this.imagePreviews = [...this.imagePreviews, ...additions.map(file => URL.createObjectURL(file))];
    input.value = '';
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.imagePreviews[index]);
    this.imagePreviews.splice(index, 1);
    this.selectedImages.splice(index, 1);
    this.imagePreviews = [...this.imagePreviews];
    this.selectedImages = [...this.selectedImages];
  }

  save(form: NgForm): void {
    if (!this.productId && !this.selectedImages.length) { this.errorMessage = 'Choose at least one product image before saving.'; return; }
    this.isBusy = true; this.errorMessage = ''; this.successMessage = '';
    const payload: Omit<Product, 'id' | 'image'> = {
      name: this.productForm.name.trim(), category: this.productForm.category.trim(),
      description: this.productForm.description.trim(), price: Number(this.productForm.price),
      dimensions: this.productForm.dimensions.trim(), weightGrams: this.productForm.weightGrams || undefined,
      availableColors: this.productForm.availableColors.split(',').map(color => color.trim()).filter(Boolean),
      featured: this.productForm.featured, inStock: this.productForm.inStock
    };
    const saveRequest = this.productId
      ? this.productsApi.updateProduct(this.productId, payload, this.selectedImages)
      : this.productsApi.createProduct(payload, this.selectedImages);
    saveRequest.subscribe({
      next: () => {
        this.isBusy = false;
        if (this.productId) {
          this.router.navigate(['/admin/products']);
          return;
        }
        this.successMessage = 'Product saved to the catalogue.';
        this.productForm = { name: '', category: '', description: '', price: 0, dimensions: '',
          weightGrams: null, availableColors: '', featured: false, inStock: true };
        form.resetForm(this.productForm);
        this.clearImages();
      },
      error: err => {
        this.isBusy = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Product could not be saved.';
      }
    });
  }

  private clearImages(): void {
    this.imagePreviews.forEach(url => URL.revokeObjectURL(url));
    this.imagePreviews = [];
    this.selectedImages = [];
  }

  ngOnDestroy(): void { this.clearImages(); }
}
