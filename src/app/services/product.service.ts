import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';
import { AdminAuthService } from './admin-auth.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);
  private apiOrigin = 'http://localhost:8080';
  private apiUrl = this.apiOrigin + '/api/products';

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl).pipe(
      map(products => (products || []).map(product => this.withAbsoluteImageUrl(product)))
    );
  }
  getProductById(id: string | number): Observable<Product> {
    return this.http.get<Product>(this.apiUrl + '/' + id).pipe(
      map(product => this.withAbsoluteImageUrl(product))
    );
  }
  getFeaturedProducts(): Observable<Product[]> {
    return this.getProducts().pipe(map(products => products.filter(p => Boolean(p.featured) || p.badge === 'Bestseller')));
  }
  getCategories(): Observable<Category[]> {
    return this.getProducts().pipe(map(products => {
      const counts = new Map<string, number>();
      for (const product of products) {
        const name = product.category?.trim();
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
      }
      return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, itemCount]) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return { id: slug, name, slug, description: 'Explore 3D printed designs in this collection.', icon: 'pi-box', itemCount };
      });
    }));
  }
  getRelatedProducts(category?: string, currentId?: string | number): Observable<Product[]> {
    if (!category) return of([]);
    return this.getProducts().pipe(map(products =>
      products.filter(p => p.category === category && String(p.id) !== String(currentId)).slice(0, 4)
    ));
  }
  createProduct(product: Omit<Product, 'id' | 'image'>, images: File[]): Observable<Product> {
    const formData = new FormData();
    formData.append('product', new Blob([JSON.stringify(product)], { type: 'application/json' }));
    images.forEach(image => formData.append('images', image));
    return this.http.post<Product>(this.apiUrl, formData, {
      headers: this.adminAuth.authorizationHeaders()
    }).pipe(map(saved => this.withAbsoluteImageUrl(saved)));
  }
  updateProduct(id: string | number, product: Omit<Product, 'id' | 'image'>, images: File[] = []): Observable<Product> {
    const formData = new FormData();
    formData.append('product', new Blob([JSON.stringify(product)], { type: 'application/json' }));
    images.forEach(image => formData.append('images', image));
    return this.http.put<Product>(this.apiUrl + '/' + id, formData, {
      headers: this.adminAuth.authorizationHeaders()
    }).pipe(map(saved => this.withAbsoluteImageUrl(saved)));
  }
  deleteProduct(id: string | number): Observable<void> {
    return this.http.delete<void>(this.apiUrl + '/' + id, {
      headers: this.adminAuth.authorizationHeaders()
    });
  }
  private withAbsoluteImageUrl(product: Product): Product {
    const image = product.image || product.imageUrl;
    const absolute = (url?: string): string | undefined => {
      if (!url || url.startsWith('http://') || url.startsWith('https://')) return url;
      return this.apiOrigin + (url.startsWith('/') ? url : '/' + url);
    };
    const mainImage = absolute(image);
    return { ...product, image: mainImage, imageUrl: absolute(product.imageUrl || image),
      images: product.images?.map(item => ({ ...item, url: absolute(item.url) || item.url })) };
  }
}
