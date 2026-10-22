import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  HostListener,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import * as THREE from 'three';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { CustomerAuthService } from '../../services/customer-auth.service';
import { ProductReviewsComponent } from '../../components/product-reviews/product-reviews.component';
import { ReviewService } from '../../services/review.service';
import { ReviewSummary } from '../../models/review.model';

export interface SizeOption {
  id: string;
  label: string;
  scaleDesc: string;
  priceDelta: number;
}

export interface MaterialOption {
  id: string;
  label: string;
  badge: string;
  description: string;
  priceDelta: number;
}

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCardComponent, ProductReviewsComponent],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('threeCanvasContainer') threeCanvasContainer?: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  private customerAuth = inject(CustomerAuthService);
  private reviewService = inject(ReviewService);
  private ngZone = inject(NgZone);

  // Core Product State
  product?: Product;
  reviewSummary: ReviewSummary | null = null;
  relatedProducts: Product[] = [];
  selectedColor = '';
  quantity = 1;
  addedAlert = false;
  selectedImageUrl = '';
  copiedLink = false;
  showSignInPrompt = false;
  toastMessage = '';
  get isWishlisted(): boolean {
    return this.product ? this.wishlistService.has(this.product.id) : false;
  }

  // Media Mode (Photography vs 3D Turntable)
  activeMediaMode: 'photo' | '3d' = 'photo';
  perspectiveLabels = ['Front Angle', 'Profile View', 'Macro Detail', 'Dimensional Scale', 'Atelier Studio'];

  // Image Zoom & Lightbox State
  isHoverZooming = false;
  zoomOriginX = 50;
  zoomOriginY = 50;
  lightboxOpen = false;
  lightboxIndex = 0;

  // Customization Options (3D Specific)
  readonly sizeOptions: SizeOption[] = [
    { id: 'std', label: 'Standard Studio', scaleDesc: '100% Scale · Default', priceDelta: 0 },
    { id: 'petite', label: 'Desk Petite', scaleDesc: '75% Scale · Compact', priceDelta: -30 },
    { id: 'gallery', label: 'Gallery Statement', scaleDesc: '130% Scale · Expanded', priceDelta: 60 }
  ];
  selectedSize: SizeOption = this.sizeOptions[0];

  readonly materialOptions: MaterialOption[] = [
    { id: 'matte', label: 'Matte Organic PLA+', badge: 'Included', description: 'Silky tactile matte finish, zero plastic shine', priceDelta: 0 },
    { id: 'silk', label: 'Satin Silk Polymer', badge: '+₹40', description: 'Lustrous dual-tone light refraction', priceDelta: 40 },
    { id: 'carbon', label: 'Carbon-Fiber Reinforced', badge: '+₹80', description: 'Textured micro-grain, maximum structural rigidity', priceDelta: 80 }
  ];
  selectedMaterial: MaterialOption = this.materialOptions[0];

  // Custom Text / Personalized Engraving
  hasCustomEngraving = false;
  engravingText = '';
  readonly engravingPrice = 50;

  // Content Tabs
  activeTab: 'overview' | 'specs' | 'material' | 'care' | 'shipping' = 'overview';

  // Mobile Sticky Bottom Bar
  showMobileStickyBar = false;

  // Three.js 3D Inspector Engine
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private modelGroup = new THREE.Group();
  private basePlatform = new THREE.Group();
  private mainMesh?: THREE.Mesh;
  private wireframeMesh?: THREE.LineSegments;
  is3dAutoRotate = true;
  is3dWireframe = false;
  private isPointerDown = false;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private threeListenerCleanup: (() => void) | null = null;

  get imagesList(): string[] {
    if (!this.product) return [];
    if (this.product.images && this.product.images.length > 0) {
      return this.product.images.map(img => img.url);
    }
    const fallback = this.product.image || this.product.imageUrl;
    return fallback ? [fallback] : [];
  }

  get currentImageIndex(): number {
    const idx = this.imagesList.indexOf(this.selectedImageUrl);
    return idx >= 0 ? idx : 0;
  }

  // Dynamic Calculated Price
  get calculatedUnitPrice(): number {
    if (!this.product) return 0;
    const base = this.product.price;
    const sizeDelta = this.selectedSize?.priceDelta || 0;
    const matDelta = this.selectedMaterial?.priceDelta || 0;
    const engraveDelta = (this.hasCustomEngraving && this.engravingText.trim().length > 0) ? this.engravingPrice : 0;
    return Math.max(1, base + sizeDelta + matDelta + engraveDelta);
  }

  get calculatedOriginalPrice(): number | undefined {
    if (!this.product?.originalPrice) return undefined;
    const diff = (this.product.originalPrice - this.product.price);
    return this.calculatedUnitPrice + diff;
  }

  get discountPercent(): number {
    if (!this.calculatedOriginalPrice || this.calculatedOriginalPrice <= this.calculatedUnitPrice) return 0;
    return Math.round(((this.calculatedOriginalPrice - this.calculatedUnitPrice) / this.calculatedOriginalPrice) * 100);
  }

  get skuCode(): string {
    if (!this.product) return 'CRFT-3D-0001';
    const numId = typeof this.product.id === 'number'
      ? this.product.id
      : Number(String(this.product.id).replace(/\D/g, ''));
    const padded = Number.isInteger(numId) && numId > 0
      ? String(numId).padStart(4, '0')
      : '0015';
    return `CRFT-3D-${padded}`;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window !== 'undefined') {
      this.showMobileStickyBar = window.scrollY > 480;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) {
      this.closeLightbox();
    }
    if (this.showSignInPrompt) {
      this.onCancelSignIn();
    }
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadProduct(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.teardownThree();
  }

  loadProduct(id: string): void {
    this.productService.getProductById(id).subscribe(p => {
      this.product = p;
      if (p) {
        this.selectedImageUrl = p.images?.[0]?.url || p.image || p.imageUrl || '';
        this.selectedColor = p.availableColors?.[0] || 'Studio Edition';

        this.productService.getRelatedProducts(p.category || '', p.id)
          .subscribe(r => this.relatedProducts = r);

        // Fetch real customer review summary
        this.reviewService.getReviews(String(p.id)).subscribe(res => {
          this.reviewSummary = res.summary;
        });
      }
    });
  }

  onReviewsSummaryUpdated(summary: ReviewSummary): void {
    this.reviewSummary = summary;
  }

  // =========================================================================
  // Gallery & Media Controls
  // =========================================================================
  setMediaMode(mode: 'photo' | '3d'): void {
    this.activeMediaMode = mode;
    if (mode === '3d') {
      setTimeout(() => this.initThreeViewer(), 80);
    } else {
      this.teardownThree();
    }
  }

  selectImage(url: string): void {
    this.selectedImageUrl = url;
    if (this.activeMediaMode === '3d') {
      this.activeMediaMode = 'photo';
      this.teardownThree();
    }
  }

  previousImage(): void {
    const list = this.imagesList;
    if (list.length <= 1) return;
    const prevIdx = (this.currentImageIndex - 1 + list.length) % list.length;
    this.selectedImageUrl = list[prevIdx];
  }

  nextImage(): void {
    const list = this.imagesList;
    if (list.length <= 1) return;
    const nextIdx = (this.currentImageIndex + 1) % list.length;
    this.selectedImageUrl = list[nextIdx];
  }

  getPerspectiveLabel(index: number): string {
    return this.perspectiveLabels[index % this.perspectiveLabels.length] || `Angle 0${index + 1}`;
  }

  // Hover Zoom
  onImageMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.zoomOriginX = Math.max(0, Math.min(100, x));
    this.zoomOriginY = Math.max(0, Math.min(100, y));
  }

  onImageMouseEnter(): void {
    this.isHoverZooming = true;
  }

  onImageMouseLeave(): void {
    this.isHoverZooming = false;
  }

  // Lightbox
  openLightbox(index?: number): void {
    this.lightboxIndex = index !== undefined ? index : this.currentImageIndex;
    this.lightboxOpen = true;
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
  }

  lightboxNext(): void {
    if (this.imagesList.length <= 1) return;
    this.lightboxIndex = (this.lightboxIndex + 1) % this.imagesList.length;
  }

  lightboxPrev(): void {
    if (this.imagesList.length <= 1) return;
    this.lightboxIndex = (this.lightboxIndex - 1 + this.imagesList.length) % this.imagesList.length;
  }

  // =========================================================================
  // Customization Logic
  // =========================================================================
  selectColor(color: string): void {
    this.selectedColor = color;
    if (this.mainMesh) {
      const hex = this.getColorHexValue(color);
      (this.mainMesh.material as THREE.MeshPhysicalMaterial).color.set(hex);
    }
  }

  selectSize(size: SizeOption): void {
    this.selectedSize = size;
  }

  selectMaterial(mat: MaterialOption): void {
    this.selectedMaterial = mat;
    if (this.mainMesh) {
      const pmat = this.mainMesh.material as THREE.MeshPhysicalMaterial;
      if (mat.id === 'matte') {
        pmat.roughness = 0.85;
        pmat.metalness = 0.05;
        pmat.clearcoat = 0.0;
      } else if (mat.id === 'silk') {
        pmat.roughness = 0.25;
        pmat.metalness = 0.35;
        pmat.clearcoat = 0.8;
      } else if (mat.id === 'carbon') {
        pmat.roughness = 0.65;
        pmat.metalness = 0.6;
        pmat.clearcoat = 0.3;
      }
    }
  }

  toggleCustomEngraving(): void {
    this.hasCustomEngraving = !this.hasCustomEngraving;
    if (!this.hasCustomEngraving) {
      this.engravingText = '';
    }
  }

  getColorHex(colorName: string): string {
    const map: Record<string, string> = {
      'Titanium White': '#f8fafc',
      'White': '#ffffff',
      'Matte Black': '#1e293b',
      'Black': '#0f172a',
      'Gold Visor': '#d97706',
      'Gold': '#f59e0b',
      'Cyberpunk Red': '#ef4444',
      'Red': '#dc2626',
      'Neon Teal': '#00A896',
      'Teal': '#14b8a6',
      'Warm Amber': '#f59e0b',
      'Arctic White': '#f1f5f9',
      'Emerald Green': '#10b981',
      'Green': '#059669',
      'Blue': '#3b82f6',
      'Sky Blue': '#0ea5e9',
      'Multicolor': 'linear-gradient(135deg, #ef4444, #f59e0b, #10b981, #3b82f6)'
    };
    return map[colorName] || '#00A896';
  }

  private getColorHexValue(colorName: string): number {
    const map: Record<string, number> = {
      'Titanium White': 0xf8fafc,
      'White': 0xffffff,
      'Matte Black': 0x1e293b,
      'Black': 0x0f172a,
      'Gold Visor': 0xd97706,
      'Gold': 0xf59e0b,
      'Cyberpunk Red': 0xef4444,
      'Red': 0xdc2626,
      'Neon Teal': 0x00A896,
      'Teal': 0x14b8a6,
      'Warm Amber': 0xf59e0b,
      'Arctic White': 0xf1f5f9,
      'Emerald Green': 0x10b981,
      'Green': 0x059669,
      'Blue': 0x3b82f6,
      'Sky Blue': 0x0ea5e9,
      'Multicolor': 0x00A896
    };
    return map[colorName] || 0x00A896;
  }

  // =========================================================================
  // Quantity & Purchase Actions
  // =========================================================================
  incrementQty(): void {
    this.quantity++;
  }

  decrementQty(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  getCustomizedVariantDescriptor(): string {
    const parts = [this.selectedColor];
    if (this.selectedSize && this.selectedSize.id !== 'std') {
      parts.push(this.selectedSize.label);
    }
    if (this.selectedMaterial && this.selectedMaterial.id !== 'matte') {
      parts.push(this.selectedMaterial.label);
    }
    if (this.hasCustomEngraving && this.engravingText.trim()) {
      parts.push(`Engraved: "${this.engravingText.trim()}"`);
    }
    return parts.join(' · ');
  }

  addToCart(): void {
    if (!this.product) return;

    // Create customized product with dynamic price
    const customizedProduct: Product = {
      ...this.product,
      price: this.calculatedUnitPrice
    };

    const variantLabel = this.getCustomizedVariantDescriptor();
    this.cartService.addToCart(customizedProduct, this.quantity, variantLabel);

    this.addedAlert = true;
    this.showToast(`Added ${this.quantity} item(s) to cart with ${variantLabel}`);
    setTimeout(() => this.addedAlert = false, 2800);
  }

  buyNow(): void {
    if (!this.product) return;

    if (!this.customerAuth.isSignedIn()) {
      this.showSignInPrompt = true;
      return;
    }

    const customizedProduct: Product = {
      ...this.product,
      price: this.calculatedUnitPrice
    };

    const variantLabel = this.getCustomizedVariantDescriptor();
    this.cartService.setDirectCheckoutItem(customizedProduct, this.quantity, variantLabel);
    this.router.navigate(['/checkout'], { queryParams: { buyNow: 'true' } });
  }

  onConfirmSignIn(): void {
    if (this.product) {
      const customizedProduct: Product = {
        ...this.product,
        price: this.calculatedUnitPrice
      };
      const variantLabel = this.getCustomizedVariantDescriptor();
      this.cartService.setDirectCheckoutItem(customizedProduct, this.quantity, variantLabel);
    }
    this.showSignInPrompt = false;
    this.router.navigate(['/account/login'], { queryParams: { returnUrl: '/checkout?buyNow=true' } });
  }

  onCancelSignIn(): void {
    this.showSignInPrompt = false;
  }

  // =========================================================================
  // Wishlist Handling
  // =========================================================================
  toggleWishlist(): void {
    if (!this.product) return;
    const res = this.wishlistService.toggle(this.product);
    if (res.added) {
      this.showToast(`Saved "${this.product.name}" to your Atelier Wishlist`);
    } else {
      this.showToast(`Removed "${this.product.name}" from your Wishlist`);
    }
  }

  showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      if (this.toastMessage === message) {
        this.toastMessage = '';
      }
    }, 3200);
  }

  // =========================================================================
  // Sharing & Navigation Helpers
  // =========================================================================
  shareNativeOrToggle(): void {
    if (!this.product) return;
    const shareUrl = window.location.href;
    const shareTitle = `${this.product.name} | Craftora 3D Atelier`;
    const shareText = `Discover ${this.product.name} on Craftora 3D.`;

    if (navigator.share) {
      navigator.share({ title: shareTitle, text: shareText, url: shareUrl }).catch(() => {});
    } else {
      this.copyLink();
    }
  }

  shareOnWhatsApp(): void {
    if (!this.product) return;
    const text = encodeURIComponent(`Explore ${this.product.name} on Craftora 3D: ${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  shareOnTwitter(): void {
    if (!this.product) return;
    const text = encodeURIComponent(`Check out ${this.product.name} crafted by Craftora 3D Atelier!`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  shareOnTelegram(): void {
    if (!this.product) return;
    const text = encodeURIComponent(`Check out ${this.product.name} on Craftora 3D!`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  }

  copyLink(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.copiedLink = true;
        this.showToast('Product link copied to clipboard');
        setTimeout(() => this.copiedLink = false, 2000);
      }).catch(() => {});
    }
  }

  scrollToReviews(): void {
    const el = document.getElementById('customerReviewsSection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // =========================================================================
  // Three.js Interactive 3D Model Inspector
  // =========================================================================
  private initThreeViewer(): void {
    if (!this.threeCanvasContainer) return;
    this.teardownThree();

    const container = this.threeCanvasContainer.nativeElement;
    const width = container.clientWidth || 560;
    const height = container.clientHeight || 520;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 1.8, 4.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainKeyLight.position.set(3, 5, 4);
    mainKeyLight.castShadow = true;
    this.scene.add(mainKeyLight);

    const fillLight = new THREE.DirectionalLight(0x00A896, 0.7);
    fillLight.position.set(-4, 2, -2);
    this.scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffffff, 1.2, 10);
    rimLight.position.set(0, 3, -3);
    this.scene.add(rimLight);

    // Build Model Hierarchy
    this.modelGroup = new THREE.Group();
    this.buildProceduralModel();
    this.buildTurntableBase();
    this.scene.add(this.modelGroup);

    // Interactive pointer drag
    this.bindThreeInteractions(container);

    // Start render loop outside Angular
    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        if (this.is3dAutoRotate && !this.isPointerDown && this.modelGroup) {
          this.modelGroup.rotation.y += 0.005;
        }
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
        this.animFrameId = requestAnimationFrame(render);
      };
      this.animFrameId = requestAnimationFrame(render);
    });
  }

  private buildProceduralModel(): void {
    const colorHex = this.getColorHexValue(this.selectedColor);

    // Sleek geometric sculpture representative of Craftora 3D printing
    const geometry = new THREE.DodecahedronGeometry(1.2, 2);

    const physicalMat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2
    });

    this.mainMesh = new THREE.Mesh(geometry, physicalMat);
    this.mainMesh.castShadow = true;
    this.mainMesh.position.y = 0.5;
    this.modelGroup.add(this.mainMesh);

    // Architectural Wireframe overlay
    const wireframeGeo = new THREE.WireframeGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0x00A896,
      transparent: true,
      opacity: 0.45
    });
    this.wireframeMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
    this.wireframeMesh.position.y = 0.5;
    this.wireframeMesh.visible = this.is3dWireframe;
    this.modelGroup.add(this.wireframeMesh);
  }

  private buildTurntableBase(): void {
    this.basePlatform = new THREE.Group();
    const diskGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.08, 48);
    const diskMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.7,
      metalness: 0.3
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.position.y = -0.9;
    disk.receiveShadow = true;
    this.basePlatform.add(disk);

    // Laser concentric circular indicator
    const ringGeo = new THREE.RingGeometry(1.3, 1.34, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00A896, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.85;
    this.basePlatform.add(ring);

    this.modelGroup.add(this.basePlatform);
  }

  private bindThreeInteractions(container: HTMLElement): void {
    const onDown = (e: MouseEvent | TouchEvent) => {
      this.isPointerDown = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      this.prevPointerX = clientX;
      this.prevPointerY = clientY;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown || !this.modelGroup) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - this.prevPointerX;
      const deltaY = clientY - this.prevPointerY;
      this.prevPointerX = clientX;
      this.prevPointerY = clientY;

      this.modelGroup.rotation.y += deltaX * 0.008;
      this.modelGroup.rotation.x = Math.max(-0.6, Math.min(0.6, this.modelGroup.rotation.x + deltaY * 0.006));
    };

    const onUp = () => {
      this.isPointerDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!this.camera) return;
      this.camera.position.z = Math.max(2.2, Math.min(6.5, this.camera.position.z + e.deltaY * 0.003));
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    this.threeListenerCleanup = () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      container.removeEventListener('wheel', onWheel);
    };
  }

  toggle3dAutoRotate(): void {
    this.is3dAutoRotate = !this.is3dAutoRotate;
  }

  toggle3dWireframe(): void {
    this.is3dWireframe = !this.is3dWireframe;
    if (this.wireframeMesh) {
      this.wireframeMesh.visible = this.is3dWireframe;
    }
  }

  setCameraAngle(angle: 'front' | 'iso' | 'top' | 'side'): void {
    if (!this.camera || !this.modelGroup) return;
    this.modelGroup.rotation.x = 0;
    if (angle === 'front') {
      this.modelGroup.rotation.y = 0;
      this.camera.position.set(0, 1.0, 4.2);
    } else if (angle === 'iso') {
      this.modelGroup.rotation.y = Math.PI / 4;
      this.camera.position.set(0, 1.8, 4.2);
    } else if (angle === 'top') {
      this.modelGroup.rotation.x = Math.PI / 2.5;
      this.camera.position.set(0, 3.2, 3.0);
    } else if (angle === 'side') {
      this.modelGroup.rotation.y = Math.PI / 2;
      this.camera.position.set(0, 1.0, 4.2);
    }
  }

  toggle3dFullscreen(): void {
    const elem = this.threeCanvasContainer?.nativeElement;
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  private teardownThree(): void {
    if (this.threeListenerCleanup) {
      this.threeListenerCleanup();
      this.threeListenerCleanup = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement?.remove();
      this.renderer = undefined;
    }
  }
}
