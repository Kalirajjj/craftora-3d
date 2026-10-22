import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCardComponent],
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.css']
})
export class ShopComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);

  @ViewChild('modal3dCanvas') modalCanvasRef?: ElementRef<HTMLCanvasElement>;

  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];

  // Curated category pills matching prompt
  readonly categoryPills = [
    { name: 'All', icon: 'pi-th-large' },
    { name: 'Home Décor', icon: 'pi-home' },
    { name: 'Miniatures', icon: 'pi-box' },
    { name: 'Characters', icon: 'pi-user' },
    { name: 'Keychains', icon: 'pi-key' },
    { name: 'Desk Accessories', icon: 'pi-desktop' },
    { name: 'Personalized', icon: 'pi-star' },
    { name: 'Collectibles', icon: 'pi-sparkles' },
    { name: 'New Arrivals', icon: 'pi-bolt' }
  ];

  // Available Filter Options
  readonly materials = ['All', 'Silk Composite', 'High-Detail Resin', 'Eco-PLA', 'Carbon Fiber PLA', 'Marble Composite'];
  readonly sizeOptions = ['All', 'Small', 'Medium', 'Large'];
  readonly colorOptions = [
    { label: 'All', hex: '' },
    { label: 'Obsidian Black', hex: '#0f172a' },
    { label: 'Titanium White', hex: '#f8fafc' },
    { label: 'Neon Teal', hex: '#00a896' },
    { label: 'Gold / Amber', hex: '#f59e0b' },
    { label: 'Crimson', hex: '#ef4444' },
    { label: 'Marble Grey', hex: '#94a3b8' }
  ];

  // Filter States
  searchQuery = '';
  selectedCategory = 'All';
  maxPrice = 3000;
  selectedMaterial = 'All';
  selectedSize = 'All';
  selectedColor = 'All';
  inStockOnly = false;
  minRating = 0;
  sortBy = 'popular';

  isLoading = true;
  isMobileFilterOpen = false;
  showDesktopFilters = false;

  // Editorial & Spotlight Showcase
  featuredHero: Product | null = null;
  featuredSecondary: Product[] = [];
  isHeroAdded = false;

  // Quick View & 3D Interactive Modal
  selectedQuickProduct: Product | null = null;
  isQuickViewOpen = false;
  quickViewColor = '';
  quickViewQty = 1;
  quickViewTab: '3d' | 'specs' = '3d';
  isModalAdded = false;

  // Three.js 3D Modal Engine
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private current3dMesh?: THREE.Mesh;
  private animFrameId: number | null = null;
  private isDragging3D = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private rotVelocityX = 0;
  private rotVelocityY = 0.006;

  // Toast and Feedback
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // 1. Fetch categories
    this.productService.getCategories().subscribe({
      next: (cats) => (this.categories = cats),
      error: (err) => console.error('Failed to load categories:', err)
    });

    // 2. Fetch live or curated products
    this.productService.getProducts().subscribe({
      next: (prods) => {
        this.allProducts = prods;
        this.isLoading = false;
        this.initFeaturedSpotlight();
        this.applyFilters();
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.isLoading = false;
      }
    });

    // 3. Listen to URL params (?category=...)
    this.route.queryParams.subscribe((params) => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
      this.applyFilters();
    });
  }

  initFeaturedSpotlight(): void {
    if (!this.allProducts.length) return;
    const featuredList = this.allProducts.filter(p => p.featured || p.badge === 'BESTSELLER' || p.badge === 'FEATURED');
    this.featuredHero = featuredList[0] || this.allProducts[0];
    this.featuredSecondary = (featuredList.length > 1 ? featuredList.slice(1, 4) : this.allProducts.slice(1, 4));
  }

  applyFilters(): void {
    if (!this.allProducts || this.allProducts.length === 0) {
      this.filteredProducts = [];
      return;
    }

    const query = this.searchQuery.trim().toLowerCase();

    this.filteredProducts = this.allProducts.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const material = (item.material || '').toLowerCase();
      const size = (item.sizeCategory || '').toLowerCase();
      const colors = (item.availableColors || []).map(c => c.toLowerCase());

      const matchSearch = !query || name.includes(query) || description.includes(query) || category.includes(query);
      
      let matchCat = true;
      if (this.selectedCategory === 'New Arrivals') {
        matchCat = item.badge === 'NEW' || Boolean(item.featured);
      } else if (this.selectedCategory !== 'All') {
        matchCat = category === this.selectedCategory.toLowerCase();
      }

      const matchPrice = item.price <= this.maxPrice;
      const matchStock = !this.inStockOnly || item.inStock !== false;
      const matchRating = !this.minRating || (item.rating || 0) >= this.minRating;
      const matchMaterial = this.selectedMaterial === 'All' || material.includes(this.selectedMaterial.toLowerCase());
      const matchSize = this.selectedSize === 'All' || size === this.selectedSize.toLowerCase();
      
      let matchColor = true;
      if (this.selectedColor !== 'All') {
        const targetColor = this.selectedColor.toLowerCase();
        matchColor = colors.some(c => c.includes(targetColor));
      }

      return matchSearch && matchCat && matchPrice && matchStock && matchRating && matchMaterial && matchSize && matchColor;
    });

    // Sorting
    if (this.sortBy === 'price-low') {
      this.filteredProducts.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'price-high') {
      this.filteredProducts.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === 'rating') {
      this.filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.sortBy === 'newest') {
      this.filteredProducts.sort((a, b) => (a.badge === 'NEW' ? -1 : 1));
    }
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.searchQuery.trim() !== '') count++;
    if (this.selectedCategory !== 'All') count++;
    if (this.maxPrice < 3000) count++;
    if (this.selectedMaterial !== 'All') count++;
    if (this.selectedSize !== 'All') count++;
    if (this.selectedColor !== 'All') count++;
    if (this.inStockOnly) count++;
    if (this.minRating > 0) count++;
    if (this.sortBy !== 'popular') count++;
    return count;
  }

  get hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  setCategory(cat: string): void {
    this.selectedCategory = cat;
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.maxPrice = 3000;
    this.selectedMaterial = 'All';
    this.selectedSize = 'All';
    this.selectedColor = 'All';
    this.inStockOnly = false;
    this.minRating = 0;
    this.sortBy = 'popular';
    this.applyFilters();
  }

  toggleMobileFilters(): void {
    this.isMobileFilterOpen = !this.isMobileFilterOpen;
  }

  toggleDesktopFilters(): void {
    this.showDesktopFilters = !this.showDesktopFilters;
  }

  // Wishlist Handling
  toggleWishlist(product: Product): void {
    const res = this.wishlistService.toggle(product);
    this.showToast(res.added ? `Saved "${product.name}" to your Wishlist` : `Removed "${product.name}" from your Wishlist`);
  }

  isWishlisted(product: Product): boolean {
    return this.wishlistService.has(product.id);
  }

  // Toast notification
  showToast(msg: string): void {
    this.toastMessage = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
    }, 2400);
  }

  // Hero Spotlight Add To Cart
  addHeroToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
    this.isHeroAdded = true;
    this.showToast(`Added "${product.name}" to your cart`);
    setTimeout(() => (this.isHeroAdded = false), 1500);
  }

  // =========================================================================
  // Quick View & Interactive 3D Modal
  // =========================================================================
  openQuickView(product: Product): void {
    this.selectedQuickProduct = product;
    this.quickViewColor = product.availableColors?.[0] || 'Default';
    this.quickViewQty = 1;
    this.quickViewTab = '3d';
    this.isQuickViewOpen = true;

    // Initialize 3D scene after DOM render
    setTimeout(() => {
      this.init3DScene();
    }, 50);
  }

  closeQuickView(): void {
    this.isQuickViewOpen = false;
    this.destroy3DScene();
    this.selectedQuickProduct = null;
  }

  addModalToCart(): void {
    if (!this.selectedQuickProduct) return;
    this.cartService.addToCart(this.selectedQuickProduct, this.quickViewQty);
    this.isModalAdded = true;
    this.showToast(`Added ${this.quickViewQty} × "${this.selectedQuickProduct.name}" to cart`);
    setTimeout(() => (this.isModalAdded = false), 1500);
  }

  // Three.js Interactive 3D Model in Modal
  private init3DScene(): void {
    if (!this.modalCanvasRef) return;
    const canvas = this.modalCanvasRef.nativeElement;
    const width = canvas.clientWidth || 400;
    const height = canvas.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 5.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 5, 5);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00a896, 2.0);
    rimLight.position.set(-5, -3, -4);
    this.scene.add(rimLight);

    // Dynamic 3D Geometry based on product category
    const cat = (this.selectedQuickProduct?.category || '').toLowerCase();
    let geometry: THREE.BufferGeometry;

    if (cat.includes('lamp') || cat.includes('home')) {
      geometry = new THREE.TorusKnotGeometry(1.2, 0.42, 128, 32, 2, 3);
    } else if (cat.includes('dragon') || cat.includes('collect')) {
      geometry = new THREE.IcosahedronGeometry(1.6, 2);
    } else if (cat.includes('character') || cat.includes('mini')) {
      geometry = new THREE.DodecahedronGeometry(1.5, 1);
    } else {
      geometry = new THREE.CylinderGeometry(1.1, 1.3, 2.2, 32, 8);
    }

    // Modern PBR physical material
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x00a896,
      roughness: 0.28,
      metalness: 0.15,
      clearcoat: 0.4,
      clearcoatRoughness: 0.1,
      wireframe: false
    });

    this.current3dMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.current3dMesh);

    // Animation Loop
    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (!this.renderer || !this.scene || !this.camera || !this.current3dMesh) return;

        if (!this.isDragging3D) {
          this.current3dMesh.rotation.y += this.rotVelocityY;
          this.current3dMesh.rotation.x += this.rotVelocityX;
          this.rotVelocityX *= 0.95;
        }

        this.renderer.render(this.scene, this.camera);
        this.animFrameId = requestAnimationFrame(animate);
      };
      animate();
    });
  }

  on3DMouseDown(event: MouseEvent): void {
    this.isDragging3D = true;
    this.prevMouseX = event.clientX;
    this.prevMouseY = event.clientY;
  }

  on3DMouseMove(event: MouseEvent): void {
    if (!this.isDragging3D || !this.current3dMesh) return;
    const deltaX = event.clientX - this.prevMouseX;
    const deltaY = event.clientY - this.prevMouseY;

    this.current3dMesh.rotation.y += deltaX * 0.01;
    this.current3dMesh.rotation.x += deltaY * 0.01;
    this.rotVelocityY = deltaX * 0.005;
    this.rotVelocityX = deltaY * 0.005;

    this.prevMouseX = event.clientX;
    this.prevMouseY = event.clientY;
  }

  on3DMouseUp(): void {
    this.isDragging3D = false;
  }

  on3DTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging3D = true;
      this.prevMouseX = event.touches[0].clientX;
      this.prevMouseY = event.touches[0].clientY;
    }
  }

  on3DTouchMove(event: TouchEvent): void {
    if (!this.isDragging3D || !this.current3dMesh || event.touches.length !== 1) return;
    const deltaX = event.touches[0].clientX - this.prevMouseX;
    const deltaY = event.touches[0].clientY - this.prevMouseY;

    this.current3dMesh.rotation.y += deltaX * 0.01;
    this.current3dMesh.rotation.x += deltaY * 0.01;

    this.prevMouseX = event.touches[0].clientX;
    this.prevMouseY = event.touches[0].clientY;
  }

  on3DTouchEnd(): void {
    this.isDragging3D = false;
  }

  selectColor(colorName: string): void {
    this.quickViewColor = colorName;
    if (this.current3dMesh) {
      const mat = this.current3dMesh.material as THREE.MeshPhysicalMaterial;
      const lower = colorName.toLowerCase();
      if (lower.includes('red') || lower.includes('crimson')) mat.color.setHex(0xef4444);
      else if (lower.includes('black') || lower.includes('obsidian') || lower.includes('ebony')) mat.color.setHex(0x1e293b);
      else if (lower.includes('gold') || lower.includes('amber') || lower.includes('yellow')) mat.color.setHex(0xf59e0b);
      else if (lower.includes('white') || lower.includes('carrara')) mat.color.setHex(0xf8fafc);
      else if (lower.includes('teal') || lower.includes('emerald') || lower.includes('green')) mat.color.setHex(0x00a896);
      else mat.color.setHex(0x38bdf8);
    }
  }

  private destroy3DScene(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = undefined;
    }
    this.scene = undefined;
    this.camera = undefined;
    this.current3dMesh = undefined;
  }

  ngOnDestroy(): void {
    this.destroy3DScene();
    clearTimeout(this.toastTimer);
  }
}