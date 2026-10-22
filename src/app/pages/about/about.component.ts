import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface CreationStage {
  id: string;
  stepNumber: string;
  title: string;
  subtitle: string;
  description: string;
  manifesto: string;
  badge: string;
  icon: string;
}

export interface CoreValue {
  num: string;
  title: string;
  tagline: string;
  description: string;
  aspect: string;
}

export interface VisionPillar {
  title: string;
  desc: string;
  highlight: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent {
  // Current active transformation stage for Section 4
  activeStageIndex = 0;

  // Active hero highlight
  activeHeroConcept: 'idea' | 'digital' | 'physical' = 'physical';

  // 4 Stages: From Digital to Real
  readonly creationStages: CreationStage[] = [
    {
      id: 'concept',
      stepNumber: '01',
      title: 'Concept',
      subtitle: 'The Spark of Thought',
      description:
        'Every object begins as an unconstrained human impulse — a sketch on paper, a spatial dilemma, or an artistic idea that yearns to exist outside the mind.',
      manifesto: 'Nothing meaningful begins with code alone. It starts with intuition.',
      badge: 'Unconstrained Idea',
      icon: 'pi-lightbulb'
    },
    {
      id: 'digital',
      stepNumber: '02',
      title: 'Digital Design',
      subtitle: 'Parametric Topology',
      description:
        'We sculpt ideas into mathematical 3D coordinate space. Every curvature, structural wall thickness, and bevel is dialed with sub-millimeter intent.',
      manifesto: 'Digital geometry gives abstract imagination its architectural blueprint.',
      badge: 'Spatial Geometry',
      icon: 'pi-compass'
    },
    {
      id: 'creation',
      stepNumber: '03',
      title: '3D Creation',
      subtitle: 'Additive Synthesis',
      description:
        'Through thermal extrusion and light-cured resin photopolymerization, digital voxels transform into layered matter — slice by microscopic slice.',
      manifesto: 'Additive manufacturing is not speed printing. It is modern sculpture.',
      badge: 'Physical Slicing',
      icon: 'pi-box'
    },
    {
      id: 'physical',
      stepNumber: '04',
      title: 'Physical Object',
      subtitle: 'The Living Artifact',
      description:
        'The piece is curated, post-processed, and inspected under studio light. It arrives in your hands as a tactile, durable artifact with permanence.',
      manifesto: 'Made to be held, displayed, kept, and cherished.',
      badge: 'Tactile Reality',
      icon: 'pi-sparkles'
    }
  ];

  // 4 Core Values
  readonly coreValues: CoreValue[] = [
    {
      num: '01',
      title: 'Precision',
      tagline: 'Small details define the character of an object.',
      description:
        'A single tenth of a millimeter changes how light grazes an edge and how an object settles in the palm. We engineer geometries where microscopic tolerance meets physical poise.',
      aspect: 'Tolerance · Light · Structure'
    },
    {
      num: '02',
      title: 'Creativity',
      tagline: 'Moving far beyond conventional shapes and standard forms.',
      description:
        'Traditional manufacturing favors flat faces and uniform molds. 3D geometry liberates design to embrace bio-mimicry, mathematical lattices, and organic complexity.',
      aspect: 'Bio-structures · Generative Form'
    },
    {
      num: '03',
      title: 'Craftsmanship',
      tagline: 'Technology enables creation; human care gives it soul.',
      description:
        'A high-end 3D printer is only an instrument. The final excellence relies on how materials are calibrated, how overhangs are tuned, and the critical eye of the maker.',
      aspect: 'Materiality · Finish · Human Eye'
    },
    {
      num: '04',
      title: 'Curiosity',
      tagline: 'Perpetually experimenting with materials and frontiers.',
      description:
        'We obsessively test biodegradable biopolymers, composite stone infusions, matte architectural finishes, and translucent engineering resins to expand what can be made.',
      aspect: 'Experimentation · Future Materials'
    }
  ];

  // Future Vision Pillars
  readonly visionPillars: VisionPillar[] = [
    {
      title: 'Curated 3D Atelier',
      desc: 'An international catalog of sculptural home artifacts, kinetic accents, and architectural objects crafted by visionary designers.',
      highlight: 'Discover Distinctive Objects'
    },
    {
      title: 'Expressive Personalization',
      desc: 'Empowering individuals to alter geometries, scale, textures, and bespoke engravings without needing a degree in engineering.',
      highlight: 'Tailored to Your Identity'
    },
    {
      title: 'Zero-Waste Fabrication',
      desc: 'Only producing what is wanted and valued. Eliminating warehouses full of forgotten plastic through on-demand local additive manufacturing.',
      highlight: 'Responsible Materiality'
    },
    {
      title: 'Democratized Creation',
      desc: 'Transforming rough concept drawings and digital ideas from individuals and independent creators into museum-worthy physical reality.',
      highlight: 'From Idea to Matter'
    }
  ];

  selectStage(index: number): void {
    this.activeStageIndex = index;
  }

  setHeroConcept(concept: 'idea' | 'digital' | 'physical'): void {
    this.activeHeroConcept = concept;
  }
}