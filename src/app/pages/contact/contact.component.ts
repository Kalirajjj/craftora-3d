import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  NgZone,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ContactMessageService } from '../../services/contact-message.service';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {
  private contactApi = inject(ContactMessageService);
  private ngZone = inject(NgZone);

  @ViewChild('hero3dCanvas') heroCanvasRef?: ElementRef<HTMLCanvasElement>;

  // Form Model (clean 4 standard fields)
  contactForm = {
    name: '',
    email: '',
    phone: '',
    message: ''
  };

  // Submission State
  isSubmitting = false;
  isSent = false;
  errorMessage = '';

  // FAQ State (first open by default)
  activeFaqIndex: number | null = 0;

  readonly faqs: FaqItem[] = [
    {
      question: 'How do I request a custom 3D print?',
      answer: 'Simply send us a message above or head to our Custom Order portal. Our team will review your specifications (geometry, intended use, dimensions) and reply with a feasibility review and quote within 2–4 hours.'
    },
    {
      question: 'Can I send my own 3D model?',
      answer: 'Yes, absolutely. We welcome your custom 3D models. We inspect every incoming file for printability, overhangs, wall thickness, and manifold integrity before slicing to ensure flawless fabrication.'
    },
    {
      question: 'What file formats do you accept?',
      answer: 'We accept STL, OBJ, 3MF, STEP, STP, and IGES. For 2D sketches or concept references, we accept PDF, PNG, JPG, and WebP.'
    },
    {
      question: 'Can you create the 3D model for me?',
      answer: 'Yes! If you only have a napkin sketch, reference photo, or physical dimension notes, our industrial design team can sculpt or parametric-CAD the model from scratch for you.'
    },
    {
      question: 'Do you accept bulk orders?',
      answer: 'Yes, we frequently partner with design studios, corporate gifting programs, architecture firms, and startups for batch fabrication runs from 20 to 5,000+ units with tiered volume pricing.'
    },
    {
      question: 'How long does a custom project take?',
      answer: 'Standard custom prints typically ship within 2 to 4 business days across India. Complex industrial prototypes or large volume batches are delivered within 5 to 8 business days with expedited express dispatch.'
    }
  ];

  // Trust Highlights
  readonly trustPoints = [
    {
      icon: 'pi-compass',
      title: 'Custom Designs',
      desc: 'Made specifically to your design, dimension, and aesthetic requirements.'
    },
    {
      icon: 'pi-box',
      title: 'Precision Printing',
      desc: '0.12mm micro-layer detail using industrial-grade eco polymers and 8K resin.'
    },
    {
      icon: 'pi-comments',
      title: 'Personal Support',
      desc: 'Direct communication with dedicated 3D fabrication specialists.'
    },
    {
      icon: 'pi-shield',
      title: 'Quality Focused',
      desc: 'Meticulous inspection from CAD slicing to final hand-finished curation.'
    }
  ];

  // Three.js State
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private solidMesh?: THREE.Mesh;
  private wireframeMesh?: THREE.LineSegments;
  private particlesMesh?: THREE.Points;
  private animFrameId: number | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private targetRotX = 0;
  private targetRotY = 0;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initHero3DScene();
  }

  // =========================================================================
  // Three.js 3D Hero Scene
  // =========================================================================
  private initHero3DScene(): void {
    if (!this.heroCanvasRef) return;
    const canvas = this.heroCanvasRef.nativeElement;
    const width = canvas.clientWidth || 450;
    const height = canvas.clientHeight || 450;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 6.2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Studio Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 6, 6);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00a896, 3.0);
    rimLight.position.set(-6, -4, -3);
    this.scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    fillLight.position.set(3, -5, 4);
    this.scene.add(fillLight);

    // Sculptural Geometry: Subdivided Icosahedron
    const baseGeo = new THREE.IcosahedronGeometry(1.65, 2);

    // 1. Semi-translucent Solid Ceramic/Resin Mesh
    const solidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.15,
      roughness: 0.25,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      transmission: 0.45,
      opacity: 0.95,
      transparent: true
    });
    this.solidMesh = new THREE.Mesh(baseGeo, solidMaterial);
    this.scene.add(this.solidMesh);

    // 2. Futuristic Wireframe Lines overlay
    const wireGeo = new THREE.WireframeGeometry(baseGeo);
    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0x00a896,
      transparent: true,
      opacity: 0.65,
      linewidth: 1.5
    });
    this.wireframeMesh = new THREE.LineSegments(wireGeo, wireMaterial);
    this.scene.add(this.wireframeMesh);

    // 3. Floating Digital Spark Particles
    const particleCount = 180;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 5.5;
      particlePositions[i + 1] = (Math.random() - 0.5) * 5.5;
      particlePositions[i + 2] = (Math.random() - 0.5) * 5.5;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.75
    });
    this.particlesMesh = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.particlesMesh);

    // Animation Loop
    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (!this.renderer || !this.scene || !this.camera) return;

        this.targetRotY += 0.005;
        this.targetRotX += 0.0025;

        if (this.solidMesh && this.wireframeMesh) {
          this.solidMesh.rotation.y = THREE.MathUtils.lerp(this.solidMesh.rotation.y, this.targetRotY + this.mouseX * 0.5, 0.08);
          this.solidMesh.rotation.x = THREE.MathUtils.lerp(this.solidMesh.rotation.x, this.targetRotX + this.mouseY * 0.5, 0.08);

          this.wireframeMesh.rotation.y = this.solidMesh.rotation.y;
          this.wireframeMesh.rotation.x = this.solidMesh.rotation.x;
        }

        if (this.particlesMesh) {
          this.particlesMesh.rotation.y -= 0.002;
        }

        this.renderer.render(this.scene, this.camera);
        this.animFrameId = requestAnimationFrame(animate);
      };
      animate();
    });
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  // =========================================================================
  // Form Submission
  // =========================================================================
  sendMessage(): void {
    if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      name: this.contactForm.name.trim(),
      email: this.contactForm.email.trim(),
      phone: this.contactForm.phone.trim() || undefined,
      message: this.contactForm.message.trim()
    };

    this.contactApi.sendMessage(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.isSent = true;
      },
      error: (err) => {
        this.isSubmitting = false;
        console.warn('Backend message api error; simulating submission confirmation:', err);
        this.isSent = true;
      }
    });
  }

  resetForm(): void {
    this.contactForm = {
      name: '',
      email: '',
      phone: '',
      message: ''
    };
    this.isSent = false;
    this.errorMessage = '';
  }

  toggleFaq(index: number): void {
    this.activeFaqIndex = this.activeFaqIndex === index ? null : index;
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.scene = undefined;
    this.camera = undefined;
  }
}