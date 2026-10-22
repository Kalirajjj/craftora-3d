import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';
import { AdminAuthService } from './admin-auth.service';
import { AppConfigService } from './app-config.service';
import { CURATED_PRODUCTS } from '../data/curated-products';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);
  private config = inject(AppConfigService);

  private get apiOrigin(): string {
    return this.config.apiGatewayUrl;
  }

  private get apiUrl(): string {
    return this.apiOrigin + '/api/products';
  }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl).pipe(
      map(products => {
        if (!products || products.length === 0) {
          return CURATED_PRODUCTS;
        }
        const enriched = products.map(backendProduct => {
          const matchingCurated = CURATED_PRODUCTS.find(cp =>
            Number(cp.id) === Number(backendProduct.id) ||
            (cp.slug && backendProduct.slug && cp.slug.toLowerCase() === backendProduct.slug.toLowerCase())
          );
          const base: Product = matchingCurated ? { ...matchingCurated, ...backendProduct } : { ...backendProduct };
          base.id = Number(backendProduct.id);
          base.price = Number(backendProduct.price);
          if (backendProduct.name) base.name = backendProduct.name;
          if (backendProduct.slug) base.slug = backendProduct.slug;
          if (backendProduct.inStock !== undefined) base.inStock = backendProduct.inStock;
          return this.withAbsoluteImageUrl(base);
        });

        // If backend has only a subset of products, merge with curated to keep storefront full
        if (enriched.length < CURATED_PRODUCTS.length) {
          const existingIds = new Set(enriched.map(p => Number(p.id)));
          const extra = CURATED_PRODUCTS.filter(cp => !existingIds.has(Number(cp.id)));
          return [...enriched, ...extra];
        }
        return enriched;
      }),
      catchError(err => {
        if (this.config.isProduction) {
          throw err;
        }
        console.warn('Backend product API unavailable, using curated showcase catalogue for development:', err);
        return of(CURATED_PRODUCTS);
      })
    );
  }


  getProductById(idOrSlug: string | number): Observable<Product> {
    const raw = String(idOrSlug).trim();
    const isNumeric = /^\d+$/.test(raw);
    const endpoint = isNumeric ? `${this.apiUrl}/${raw}` : `${this.apiUrl}/slug/${raw.toLowerCase()}`;

    return this.http.get<Product>(endpoint).pipe(
      map(backendProduct => {
        const matchingCurated = CURATED_PRODUCTS.find(cp =>
          Number(cp.id) === Number(backendProduct.id) ||
          (cp.slug && backendProduct.slug && cp.slug.toLowerCase() === backendProduct.slug.toLowerCase())
        );
        const enriched: Product = matchingCurated ? { ...matchingCurated, ...backendProduct } : { ...backendProduct };
        enriched.id = Number(backendProduct.id);
        enriched.price = Number(backendProduct.price);
        return this.withAbsoluteImageUrl(enriched);
      }),
      catchError(() => {
        const search = raw.toLowerCase();
        return this.getProducts().pipe(
          map(products => {
            const found = products.find(p => 
              String(p.id).toLowerCase() === search || 
              (p.slug && p.slug.toLowerCase() === search)
            );
            if (found) return found;
            throw new Error('Product not found');
          })
        );
      })
    );
  }

  getFeaturedProducts(): Observable<Product[]> {
    return this.getProducts().pipe(
      map(products => products.filter(p => Boolean(p.featured) || p.badge === 'BESTSELLER' || p.badge === 'FEATURED'))
    );
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
    if (!images || images.length === 0) {
      return this.http.put<Product>(this.apiUrl + '/' + id, product, {
        headers: this.adminAuth.authorizationHeaders()
      }).pipe(map(saved => this.withAbsoluteImageUrl(saved)));
    }
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
      if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/images/')) return url;
      return this.apiOrigin + (url.startsWith('/') ? url : '/' + url);
    };
    const mainImage = absolute(image);
    return {
      ...product,
      image: mainImage,
      imageUrl: absolute(product.imageUrl || image),
      images: product.images?.map(item => ({ ...item, url: absolute(item.url) || item.url }))
    };
  }
}
