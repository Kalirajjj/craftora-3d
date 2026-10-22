import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  NgZone,
  HostListener,
  inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';

type RenderPhase = 'wireframe' | 'slicing' | 'solid';

@Component({
  selector: 'app-hero-3d',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hero-3d.component.html',
  styleUrls: ['./hero-3d.component.css']
})
export class Hero3dComponent implements OnInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  canvasContainerRef!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  // Three.js Core
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;

  // 3D Meshes & Groups
  private mainGroup = new THREE.Group();
  private solidMesh!: THREE.Mesh;
  private wireframeMesh!: THREE.LineSegments;
  private laserRing!: THREE.Mesh;
  private particlesMesh!: THREE.Points;
  private cadRingsGroup = new THREE.Group();
  private basePlatform!: THREE.Group;

  // Materials for morphing
  private solidMaterial!: THREE.MeshPhysicalMaterial;
  private wireframeMaterial!: THREE.LineBasicMaterial;
  private laserMaterial!: THREE.MeshBasicMaterial;

  // Animation & Interaction State
  currentPhase: RenderPhase = 'slicing';
  private phaseTimer = 0;
  private sliceProgress = 0; // 0 to 1
  private sliceDirection = 1;

  // Mouse interaction
  private mouseX = 0;
  private mouseY = 0;
  private targetRotX = 0;
  private targetRotY = 0;
  private isDragging = false;
  private prevPointerX = 0;
  private prevPointerY = 0;

  // Live HUD metrics
  hudRotation = 0;
  hudSlicePct = 85;
  hudFps = 60;
  private lastFpsTime = performance.now();
  private frameCount = 0;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => {
      this.initThree();
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.disposeThree();
  }

  private initThree(): void {
    const container = this.canvasContainerRef.nativeElement;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 550;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b0f14, 0.05);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 0.8, 6.2);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. Lights
    this.setupLighting();

    // 5. Construct 3D Centerpiece
    this.buildSculpture();

    // 6. CAD Construction & Measurement Guides
    this.buildCadGuides();

    // 7. Particle Swarm
    this.buildParticleSwarm();

    // 8. Base Platform Grid
    this.buildPlatform();

    this.scene.add(this.mainGroup);

    // Resize Observer
    this.setupResizeObserver(container);
  }

  private setupLighting(): void {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0x0e1722, 1.2);
    this.scene.add(ambientLight);

    // Key Light (Clean White Studio Key)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(4, 5, 4);
    this.scene.add(keyLight);

    // Rim Light (Craftora Teal Glow)
    const rimLight = new THREE.DirectionalLight(0x00a896, 3.2);
    rimLight.position.set(-4, -2, -3);
    this.scene.add(rimLight);

    // Soft Overhead Point Light (Layer Highlight)
    const pointLight = new THREE.PointLight(0x02c39a, 2.0, 15);
    pointLight.position.set(0, 3, 2);
    this.scene.add(pointLight);

    // Warm Metallic Accent Light
    const fillWarm = new THREE.DirectionalLight(0x94a3b8, 1.0);
    fillWarm.position.set(-3, 3, 2);
    this.scene.add(fillWarm);
  }

  private buildSculpture(): void {
    // High-precision parametric geometry (Torus Knot sculpture)
    const geometry = new THREE.TorusKnotGeometry(1.3, 0.42, 160, 32, 2, 3);
    geometry.computeVertexNormals();

    // Solid PBR Material (High-end matte/satin polymer with micro layer effect)
    this.solidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x18202a,
      roughness: 0.32,
      metalness: 0.18,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15,
      reflectivity: 0.6,
      transparent: true,
      opacity: 0.95
    });

    this.solidMesh = new THREE.Mesh(geometry, this.solidMaterial);
    this.mainGroup.add(this.solidMesh);

    // Wireframe Digital Mesh
    const wireGeo = new THREE.WireframeGeometry(geometry);
    this.wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x00a896,
      transparent: true,
      opacity: 0.35,
      linewidth: 1
    });

    this.wireframeMesh = new THREE.LineSegments(wireGeo, this.wireframeMaterial);
    this.wireframeMesh.scale.setScalar(1.002); // avoid z-fighting
    this.mainGroup.add(this.wireframeMesh);

    // Slicing Laser Ring
    const ringGeo = new THREE.TorusGeometry(1.9, 0.015, 16, 100);
    this.laserMaterial = new THREE.MeshBasicMaterial({
      color: 0x00e5c3,
      transparent: true,
      opacity: 0.8
    });
    this.laserRing = new THREE.Mesh(ringGeo, this.laserMaterial);
    this.laserRing.rotation.x = Math.PI / 2;
    this.mainGroup.add(this.laserRing);
  }

  private buildCadGuides(): void {
    // CAD Circular Guidance Rings
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.4
    });

    for (let r = 2.1; r <= 2.7; r += 0.3) {
      const circleGeo = new THREE.BufferGeometry();
      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
      }
      circleGeo.setFromPoints(points);
      const circleLine = new THREE.Line(circleGeo, ringMat);
      circleLine.position.y = -1.5;
      this.cadRingsGroup.add(circleLine);
    }

    // Outer Gyro Axis Ring (tilted 45deg)
    const gyroGeo = new THREE.BufferGeometry();
    const gyroPoints = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      gyroPoints.push(new THREE.Vector3(Math.cos(theta) * 2.5, Math.sin(theta) * 2.5, 0));
    }
    gyroGeo.setFromPoints(gyroPoints);
    const gyroMat = new THREE.LineBasicMaterial({
      color: 0x00a896,
      transparent: true,
      opacity: 0.25
    });
    const gyroRing = new THREE.Line(gyroGeo, gyroMat);
    gyroRing.rotation.y = Math.PI / 4;
    this.cadRingsGroup.add(gyroRing);

    this.mainGroup.add(this.cadRingsGroup);
  }

  private buildParticleSwarm(): void {
    const particleCount = 450;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const teal = new THREE.Color(0x00a896);
    const white = new THREE.Color(0xf1f5f9);

    for (let i = 0; i < particleCount; i++) {
      // Cylindrical/spherical cloud around sculpture
      const radius = 1.4 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 3.4;

      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius;

      const mixed = Math.random() > 0.4 ? teal : white;
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    this.particlesMesh = new THREE.Points(geometry, material);
    this.mainGroup.add(this.particlesMesh);
  }

  private buildPlatform(): void {
    this.basePlatform = new THREE.Group();

    // Precision radial grid
    const grid = new THREE.GridHelper(5, 20, 0x00a896, 0x1e293b);
    grid.position.y = -1.8;
    this.basePlatform.add(grid);

    this.scene.add(this.basePlatform);
  }

  private setupResizeObserver(container: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width && height && this.camera && this.renderer) {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height);
        }
      }
    });
    ro.observe(container);
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);

    const time = performance.now() * 0.001;

    // Phase management: cycle through Wireframe -> Slicing/Printing -> Solid Object
    this.phaseTimer += 0.008;
    this.sliceProgress += 0.006 * this.sliceDirection;

    if (this.sliceProgress > 1) {
      this.sliceProgress = 1;
      this.sliceDirection = -1;
    } else if (this.sliceProgress < 0) {
      this.sliceProgress = 0;
      this.sliceDirection = 1;
    }

    // Laser Ring scan vertical movement
    const laserY = (this.sliceProgress - 0.5) * 2.8;
    this.laserRing.position.y = laserY;
    const pulse = Math.sin(time * 6) * 0.2 + 0.8;
    this.laserMaterial.opacity = 0.5 + 0.4 * pulse;

    // Wireframe vs Solid transition
    const wireIntensity = 0.2 + 0.4 * (1 - this.sliceProgress);
    this.wireframeMaterial.opacity = wireIntensity;

    // Smooth Continuous Rotation + Mouse Parallax
    this.mainGroup.rotation.y += 0.005;
    this.mainGroup.rotation.x = THREE.MathUtils.lerp(this.mainGroup.rotation.x, this.targetRotX, 0.06);
    this.mainGroup.rotation.z = THREE.MathUtils.lerp(this.mainGroup.rotation.z, -this.targetRotY * 0.5, 0.06);

    // Gently rotate cad rings & particles in opposite directions
    this.cadRingsGroup.rotation.y -= 0.003;
    this.particlesMesh.rotation.y += 0.002;
    this.basePlatform.rotation.y += 0.001;

    // Camera breathing wave
    this.camera.position.y = 0.8 + Math.sin(time * 0.8) * 0.08;

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    // Periodic HUD update (every 10 frames to avoid Angular thrashing)
    this.frameCount++;
    if (this.frameCount % 8 === 0) {
      this.hudRotation = Math.round((this.mainGroup.rotation.y * (180 / Math.PI)) % 360);
      this.hudSlicePct = Math.round(this.sliceProgress * 100);
    }
  };

  // Pointer & Drag Handlers
  onPointerDown(e: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    this.prevPointerX = clientX;
    this.prevPointerY = clientY;
  }

  onPointerMove(e: MouseEvent | TouchEvent): void {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (this.isDragging) {
      const deltaX = clientX - this.prevPointerX;
      const deltaY = clientY - this.prevPointerY;
      this.targetRotY += deltaX * 0.006;
      this.targetRotX += deltaY * 0.006;
      this.prevPointerX = clientX;
      this.prevPointerY = clientY;
    } else {
      // Subtle parallax when merely moving cursor
      const rect = this.canvasContainerRef.nativeElement.getBoundingClientRect();
      const normX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((clientY - rect.top) / rect.height) * 2 - 1;
      this.targetRotX = normY * 0.25;
      this.targetRotY = normX * 0.35;
    }
  }

  onPointerUp(): void {
    this.isDragging = false;
  }

  setPhase(phase: RenderPhase): void {
    this.currentPhase = phase;
    if (phase === 'wireframe') {
      this.solidMaterial.opacity = 0.15;
      this.wireframeMaterial.opacity = 0.85;
      this.laserMaterial.opacity = 0.2;
    } else if (phase === 'solid') {
      this.solidMaterial.opacity = 0.98;
      this.wireframeMaterial.opacity = 0.1;
      this.laserMaterial.opacity = 0.1;
    } else {
      this.solidMaterial.opacity = 0.85;
      this.wireframeMaterial.opacity = 0.45;
      this.laserMaterial.opacity = 0.8;
    }
  }

  private disposeThree(): void {
    if (this.solidMesh) {
      this.solidMesh.geometry.dispose();
      this.solidMaterial.dispose();
    }
    if (this.wireframeMesh) {
      this.wireframeMesh.geometry.dispose();
      this.wireframeMaterial.dispose();
    }
    if (this.laserRing) {
      this.laserRing.geometry.dispose();
      this.laserMaterial.dispose();
    }
    if (this.particlesMesh) {
      this.particlesMesh.geometry.dispose();
      (this.particlesMesh.material as THREE.Material).dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
      const dom = this.renderer.domElement;
      if (dom && dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }
    }
  }
}
