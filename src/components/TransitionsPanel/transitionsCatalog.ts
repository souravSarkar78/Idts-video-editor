/**
 * Comprehensive Video Transitions Catalog: 52+ Distinct Presets
 * Spanning Smooth Motion & Whip, Glitch & Digital, Light & Atmospheric,
 * Geometric & Shape Wipes, and Artistic & Organic blends.
 */

export interface TransitionPresetItem {
  id: string;
  name: string;
  category: 'Smooth & Whip' | 'Glitch & Digital' | 'Light & Atmospheric' | 'Geometric & Shapes' | 'Artistic & Organic';
  description: string;
  defaultDuration: number;
  xfadeName: string;
  tags: string[];
  color: string;
  renderThumbnail: (ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) => void;
}

// Helper to draw standard 2-frame preview base
function drawBaseFrames(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Frame A (Outgoing scene: Cyan cinematic tone)
  const gradA = ctx.createLinearGradient(0, 0, w, h);
  gradA.addColorStop(0, '#0E3A4B');
  gradA.addColorStop(1, '#001D28');

  // Frame B (Incoming scene: Purple-Magenta creative tone)
  const gradB = ctx.createLinearGradient(0, 0, w, h);
  gradB.addColorStop(0, '#581C87');
  gradB.addColorStop(1, '#2E0854');

  return { gradA, gradB };
}

export const TRANSITIONS_CATALOG: TransitionPresetItem[] = [
  // =========================================================================
  // 1. Smooth Motion & Whip (15 presets)
  // =========================================================================
  {
    id: 'trans_whip_left',
    name: 'Whip Pan Left',
    category: 'Smooth & Whip',
    description: 'Fast horizontal camera whip moving rapidly left',
    defaultDuration: 0.5,
    xfadeName: 'smoothleft',
    tags: ['whip', 'pan', 'left', 'fast', 'trending'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const offset = p * w;
      ctx.fillStyle = gradA;
      ctx.fillRect(-offset, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(w - offset, 0, w, h);
      // Motion blur streak
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(p * Math.PI) * 0.3})`;
      ctx.fillRect(w - offset - 10, 0, 20, h);
    },
  },
  {
    id: 'trans_whip_right',
    name: 'Whip Pan Right',
    category: 'Smooth & Whip',
    description: 'Fast horizontal camera whip moving rapidly right',
    defaultDuration: 0.5,
    xfadeName: 'smoothright',
    tags: ['whip', 'pan', 'right', 'fast'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const offset = p * w;
      ctx.fillStyle = gradA;
      ctx.fillRect(offset, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(-w + offset, 0, w, h);
    },
  },
  {
    id: 'trans_whip_up',
    name: 'Whip Pan Up',
    category: 'Smooth & Whip',
    description: 'Fast vertical tilt whip upward with motion blur',
    defaultDuration: 0.5,
    xfadeName: 'slideup',
    tags: ['whip', 'pan', 'up', 'vertical'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const offset = p * h;
      ctx.fillStyle = gradA;
      ctx.fillRect(0, -offset, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, h - offset, w, h);
    },
  },
  {
    id: 'trans_whip_down',
    name: 'Whip Pan Down',
    category: 'Smooth & Whip',
    description: 'Fast vertical tilt whip downward with motion blur',
    defaultDuration: 0.5,
    xfadeName: 'slidedown',
    tags: ['whip', 'pan', 'down', 'vertical'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const offset = p * h;
      ctx.fillStyle = gradA;
      ctx.fillRect(0, offset, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, -h + offset, w, h);
    },
  },
  {
    id: 'trans_zoom_in_burst',
    name: 'Zoom In Burst',
    category: 'Smooth & Whip',
    description: 'Hyper-speed optical crash zoom into incoming angle',
    defaultDuration: 0.5,
    xfadeName: 'zoomin',
    tags: ['zoom', 'burst', 'crash', 'trending'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(p, p);
      ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'trans_zoom_out_snap',
    name: 'Zoom Out Snap',
    category: 'Smooth & Whip',
    description: 'Snap zoom out expanding backward from center',
    defaultDuration: 0.5,
    xfadeName: 'distance',
    tags: ['zoom', 'snap', 'out'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1 - p * 0.7, 1 - p * 0.7);
      ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = gradA;
      ctx.globalAlpha = 1 - p;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'trans_spin_cw',
    name: 'Spin Clockwise',
    category: 'Smooth & Whip',
    description: '360-degree clockwise barrel roll with rotational blur',
    defaultDuration: 0.6,
    xfadeName: 'radial',
    tags: ['spin', 'roll', 'clockwise'],
    color: '#818CF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(p * Math.PI);
      ctx.scale(p, p);
      ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'trans_spin_ccw',
    name: 'Spin Counter-Clockwise',
    category: 'Smooth & Whip',
    description: '360-degree counter-clockwise dynamic roll',
    defaultDuration: 0.6,
    xfadeName: 'radial',
    tags: ['spin', 'roll', 'counter'],
    color: '#818CF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-p * Math.PI);
      ctx.scale(p, p);
      ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'trans_smooth_roll',
    name: 'Continuous Smooth Roll',
    category: 'Smooth & Whip',
    description: 'Seamless continuous camera roll between angles',
    defaultDuration: 0.7,
    xfadeName: 'radial',
    tags: ['roll', 'smooth', 'continuous'],
    color: '#818CF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(p * 2 * Math.PI);
      ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'trans_parallax_left',
    name: 'Parallax Slide Left',
    category: 'Smooth & Whip',
    description: 'Multi-plane parallax slide with depth separation',
    defaultDuration: 0.6,
    xfadeName: 'smoothleft',
    tags: ['parallax', 'slide', 'left', 'depth'],
    color: '#34D399',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(-p * w * 0.4, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(w - p * w, 0, w, h);
    },
  },
  {
    id: 'trans_parallax_right',
    name: 'Parallax Slide Right',
    category: 'Smooth & Whip',
    description: 'Multi-plane parallax slide pushing to the right',
    defaultDuration: 0.6,
    xfadeName: 'smoothright',
    tags: ['parallax', 'slide', 'right'],
    color: '#34D399',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(p * w * 0.4, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(-w + p * w, 0, w, h);
    },
  },
  {
    id: 'trans_parallax_up',
    name: 'Parallax Slide Up',
    category: 'Smooth & Whip',
    description: 'Vertical parallax push moving upward',
    defaultDuration: 0.6,
    xfadeName: 'slideup',
    tags: ['parallax', 'slide', 'up'],
    color: '#34D399',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, -p * h * 0.4, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, h - p * h, w, h);
    },
  },
  {
    id: 'trans_parallax_down',
    name: 'Parallax Slide Down',
    category: 'Smooth & Whip',
    description: 'Vertical parallax push moving downward',
    defaultDuration: 0.6,
    xfadeName: 'slidedown',
    tags: ['parallax', 'slide', 'down'],
    color: '#34D399',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, p * h * 0.4, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, -h + p * h, w, h);
    },
  },
  {
    id: 'trans_elastic_push',
    name: 'Elastic Bungee Push',
    category: 'Smooth & Whip',
    description: 'Playful overshooting spring push with bounce settling',
    defaultDuration: 0.55,
    xfadeName: 'squeezev',
    tags: ['elastic', 'bounce', 'bungee'],
    color: '#F472B6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const bounce = Math.sin(p * Math.PI * 1.5) * (1 - p);
      const x = (1 - p + bounce * 0.3) * w;
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(x, 0, w, h);
    },
  },
  {
    id: 'trans_skew_shear',
    name: 'Skew Shear Slide',
    category: 'Smooth & Whip',
    description: 'Angled dynamic shear slide with diagonal momentum',
    defaultDuration: 0.5,
    xfadeName: 'wipetl',
    tags: ['skew', 'shear', 'diagonal'],
    color: '#F59E0B',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.moveTo((1 - p) * w - 30, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h);
      ctx.lineTo((1 - p) * w + 30, h);
      ctx.closePath();
      ctx.fill();
    },
  },

  // =========================================================================
  // 2. Glitch & Digital (8 presets)
  // =========================================================================
  {
    id: 'trans_rgb_split_glitch',
    name: 'RGB Split Glitch',
    category: 'Glitch & Digital',
    description: 'Violent chromatic aberration separation with channel tearing',
    defaultDuration: 0.45,
    xfadeName: 'pixelize',
    tags: ['glitch', 'rgb', 'split', 'trending'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const glitch = Math.sin(p * Math.PI) * 15;
      ctx.fillStyle = 'rgba(255, 0, 50, 0.4)';
      ctx.fillRect(glitch, 0, w, h);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fillRect(-glitch, 0, w, h);
    },
  },
  {
    id: 'trans_block_noise',
    name: 'Block Noise Disruption',
    category: 'Glitch & Digital',
    description: 'Macroblock digital compression tear and digital static',
    defaultDuration: 0.4,
    xfadeName: 'pixelize',
    tags: ['noise', 'blocks', 'static'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.2) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
        for (let i = 0; i < 8; i++) {
          ctx.fillRect(Math.random() * w, Math.random() * h, 30, 8);
        }
      }
    },
  },
  {
    id: 'trans_pixelate_dissolve',
    name: 'Pixelate Dissolve',
    category: 'Glitch & Digital',
    description: 'Mosaic pixelation expanding and refining into incoming scene',
    defaultDuration: 0.6,
    xfadeName: 'pixelize',
    tags: ['pixelate', 'mosaic', 'dissolve'],
    color: '#A855F7',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const size = Math.max(2, Math.sin(p * Math.PI) * 20);
      for (let x = 0; x < w; x += size) {
        for (let y = 0; y < h; y += size) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
          ctx.fillRect(x, y, size - 1, size - 1);
        }
      }
    },
  },
  {
    id: 'trans_datamosh_melt',
    name: 'Data Mosh Melt',
    category: 'Glitch & Digital',
    description: 'P-frame motion vector bleed melting incoming footage',
    defaultDuration: 0.65,
    xfadeName: 'dissolve',
    tags: ['datamosh', 'melt', 'bleed'],
    color: '#A855F7',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      for (let i = 0; i < w; i += 8) {
        const drop = Math.sin(i * 0.1 + p * 5) * 20 * p;
        ctx.fillRect(i, drop, 8, h);
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'trans_digital_slice',
    name: 'Digital Slice Bands',
    category: 'Glitch & Digital',
    description: 'Alternating horizontal slice displacements scanning across cut',
    defaultDuration: 0.5,
    xfadeName: 'hlslice',
    tags: ['slice', 'bands', 'glitch'],
    color: '#6366F1',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const bands = 6;
      const bH = h / bands;
      for (let i = 0; i < bands; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const x = dir * (1 - p) * w;
        ctx.fillStyle = gradA;
        ctx.fillRect(0, i * bH, w, bH);
        ctx.fillStyle = gradB;
        ctx.fillRect(x, i * bH, w, bH);
      }
    },
  },
  {
    id: 'trans_static_flash',
    name: 'Static Flash Interruption',
    category: 'Glitch & Digital',
    description: 'Analog static white noise burst bridging scene cuts',
    defaultDuration: 0.35,
    xfadeName: 'fadewhite',
    tags: ['static', 'flash', 'noise'],
    color: '#E2E8F0',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const flash = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.8})`;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'trans_scanline_sweep',
    name: 'Scanline Sweep',
    category: 'Glitch & Digital',
    description: 'Vertical CRT cathode beam sweep transitioning frames',
    defaultDuration: 0.5,
    xfadeName: 'hrslice',
    tags: ['scanline', 'sweep', 'crt'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, w, p * h);
      // Beam line
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(0, p * h - 2, w, 4);
    },
  },
  {
    id: 'trans_digital_mosaic',
    name: 'Digital Mosaic Bloom',
    category: 'Glitch & Digital',
    description: 'Hexagonal subpixel cluster dissolve',
    defaultDuration: 0.55,
    xfadeName: 'pixelize',
    tags: ['mosaic', 'bloom', 'hex'],
    color: '#10B981',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  },

  // =========================================================================
  // 3. Light & Atmospheric (8 presets)
  // =========================================================================
  {
    id: 'trans_film_burn',
    name: 'Film Burn Flash',
    category: 'Light & Atmospheric',
    description: 'Vintage projector light leak burn with warm amber flares',
    defaultDuration: 0.6,
    xfadeName: 'fadewhite',
    tags: ['filmburn', 'vintage', 'flare', 'trending'],
    color: '#F97316',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const intensity = Math.sin(p * Math.PI);
      const flare = ctx.createRadialGradient(w * 0.7, h * 0.3, 5, w * 0.7, h * 0.3, w * 0.9);
      flare.addColorStop(0, `rgba(255, 230, 150, ${intensity})`);
      flare.addColorStop(0.5, `rgba(255, 100, 20, ${intensity * 0.7})`);
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flare;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'trans_lens_flare_wipe',
    name: 'Lens Flare Wipe',
    category: 'Light & Atmospheric',
    description: 'Horizontal anamorphic flare sweeping across the frame',
    defaultDuration: 0.55,
    xfadeName: 'fadewhite',
    tags: ['lensflare', 'anamorphic', 'wipe'],
    color: '#F59E0B',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const x = p * w;
      const flare = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
      flare.addColorStop(0, 'rgba(56, 189, 248, 0)');
      flare.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
      flare.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flare;
      ctx.fillRect(x - 40, 0, 80, h);
    },
  },
  {
    id: 'trans_light_leak_sweep',
    name: 'Light Leak Sweep',
    category: 'Light & Atmospheric',
    description: 'Warm organic light leak sweeping over the splice',
    defaultDuration: 0.65,
    xfadeName: 'fade',
    tags: ['lightleak', 'warm', 'organic'],
    color: '#FB923C',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      const leak = ctx.createRadialGradient(p * w, h / 2, 0, p * w, h / 2, w * 0.6);
      leak.addColorStop(0, `rgba(255, 180, 50, ${Math.sin(p * Math.PI) * 0.8})`);
      leak.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = leak;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'trans_overexposure_white',
    name: 'Overexposure Flash White',
    category: 'Light & Atmospheric',
    description: 'High-key luminous exposure blowout into incoming clip',
    defaultDuration: 0.4,
    xfadeName: 'fadewhite',
    tags: ['white', 'flash', 'overexposure'],
    color: '#FFFFFF',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const f = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${f})`;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'trans_dip_black',
    name: 'Exposure Dip to Black',
    category: 'Light & Atmospheric',
    description: 'Smooth optical fade out to black then fade in',
    defaultDuration: 0.7,
    xfadeName: 'fadeblack',
    tags: ['black', 'dip', 'fade'],
    color: '#64748B',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const black = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(0, 0, 0, ${black})`;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'trans_rainbow_bokeh',
    name: 'Rainbow Bokeh Dissolve',
    category: 'Light & Atmospheric',
    description: 'Luminous circular aperture bokeh balls expanding into transition',
    defaultDuration: 0.75,
    xfadeName: 'dissolve',
    tags: ['bokeh', 'rainbow', 'optics'],
    color: '#E879F9',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      const bAlpha = Math.sin(p * Math.PI) * 0.6;
      ctx.fillStyle = `rgba(255, 200, 255, ${bAlpha})`;
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.4, 18, 0, Math.PI * 2);
      ctx.arc(w * 0.7, h * 0.6, 24, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'trans_glow_flare_burst',
    name: 'Glow Flare Burst',
    category: 'Light & Atmospheric',
    description: 'Incandescent starburst flare illuminating the scene joint',
    defaultDuration: 0.5,
    xfadeName: 'fadewhite',
    tags: ['glow', 'flare', 'starburst'],
    color: '#FDE047',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      const intensity = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(255, 250, 180, ${intensity * 0.8})`;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.4 * intensity, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'trans_color_bleed_melt',
    name: 'Color Bleed Melt',
    category: 'Light & Atmospheric',
    description: 'Vibrant saturation bleed dissolving boundaries',
    defaultDuration: 0.6,
    xfadeName: 'dissolve',
    tags: ['color', 'bleed', 'melt'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  },

  // =========================================================================
  // 4. Geometric & Shape Wipes (12 presets)
  // =========================================================================
  {
    id: 'trans_clock_wipe',
    name: 'Clock Wipe Radial',
    category: 'Geometric & Shapes',
    description: '360-degree sweep like the hand of a clock',
    defaultDuration: 0.7,
    xfadeName: 'radial',
    tags: ['clock', 'radial', 'wipe'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.arc(w / 2, h / 2, Math.hypot(w, h), -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'trans_circle_iris_open',
    name: 'Circle Iris Open',
    category: 'Geometric & Shapes',
    description: 'Circular aperture expanding outward from center',
    defaultDuration: 0.6,
    xfadeName: 'circleopen',
    tags: ['circle', 'iris', 'open', 'trending'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, p * Math.hypot(w, h) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'trans_circle_iris_close',
    name: 'Circle Iris Close',
    category: 'Geometric & Shapes',
    description: 'Classic vignette circle closing down on outgoing shot',
    defaultDuration: 0.6,
    xfadeName: 'circleclose',
    tags: ['circle', 'iris', 'close'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradA;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (1 - p) * Math.hypot(w, h) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'trans_diamond_expand',
    name: 'Diamond Expand',
    category: 'Geometric & Shapes',
    description: 'Four-sided diamond geometric growth reveal',
    defaultDuration: 0.65,
    xfadeName: 'rectcrop',
    tags: ['diamond', 'expand', 'shape'],
    color: '#3B82F6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      const rad = p * w;
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2 - rad);
      ctx.lineTo(w / 2 + rad, h / 2);
      ctx.lineTo(w / 2, h / 2 + rad);
      ctx.lineTo(w / 2 - rad, h / 2);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'trans_venetian_blinds',
    name: 'Horizontal Venetian Blinds',
    category: 'Geometric & Shapes',
    description: 'Slatted horizontal louvers rotating to reveal next clip',
    defaultDuration: 0.6,
    xfadeName: 'hlslice',
    tags: ['blinds', 'slats', 'horizontal'],
    color: '#3B82F6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      const slats = 6;
      const sH = h / slats;
      ctx.fillStyle = gradB;
      for (let i = 0; i < slats; i++) {
        ctx.fillRect(0, i * sH, w, sH * p);
      }
    },
  },
  {
    id: 'trans_vertical_louvers',
    name: 'Vertical Louvers',
    category: 'Geometric & Shapes',
    description: 'Vertical window blind strips flipping in sequence',
    defaultDuration: 0.6,
    xfadeName: 'hrslice',
    tags: ['louvers', 'vertical', 'blinds'],
    color: '#3B82F6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      const slats = 8;
      const sW = w / slats;
      ctx.fillStyle = gradB;
      for (let i = 0; i < slats; i++) {
        ctx.fillRect(i * sW, 0, sW * p, h);
      }
    },
  },
  {
    id: 'trans_hex_honeycomb',
    name: 'Hexagonal Honeycomb Reveal',
    category: 'Geometric & Shapes',
    description: 'Geometric honeycomb cell grid pop-in',
    defaultDuration: 0.65,
    xfadeName: 'distance',
    tags: ['hex', 'honeycomb', 'grid'],
    color: '#14B8A6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'trans_diagonal_split',
    name: 'Diagonal Split Wipe',
    category: 'Geometric & Shapes',
    description: '45-degree angle diagonal slice across the frame',
    defaultDuration: 0.55,
    xfadeName: 'wipetr',
    tags: ['diagonal', 'split', 'angle'],
    color: '#14B8A6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.moveTo((1 - p) * 2 * w, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h);
      ctx.lineTo((1 - p) * 2 * w - h, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'trans_grid_shuffle',
    name: 'Grid Box Random Shuffle',
    category: 'Geometric & Shapes',
    description: '3x3 matrix tile flip revealing incoming scene',
    defaultDuration: 0.6,
    xfadeName: 'pixelize',
    tags: ['grid', 'shuffle', 'tiles'],
    color: '#14B8A6',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      const cols = 3;
      const rows = 3;
      const cW = w / cols;
      const rH = h / rows;
      ctx.fillStyle = gradB;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((c + r) / 4 <= p) {
            ctx.fillRect(c * cW, r * rH, cW - 1, rH - 1);
          }
        }
      }
    },
  },
  {
    id: 'trans_multi_curtain',
    name: 'Multi-Curtain Open',
    category: 'Geometric & Shapes',
    description: 'Dual stage curtains parting from center outward',
    defaultDuration: 0.7,
    xfadeName: 'horzopen',
    tags: ['curtain', 'stage', 'theatre'],
    color: '#6366F1',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, w, h);
      const curtain = (1 - p) * (w / 2);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, curtain, h);
      ctx.fillRect(w - curtain, 0, curtain, h);
    },
  },
  {
    id: 'trans_spiral_sweep',
    name: 'Spiral Sweep',
    category: 'Geometric & Shapes',
    description: 'Logarithmic spiral unwinding into incoming angle',
    defaultDuration: 0.75,
    xfadeName: 'radial',
    tags: ['spiral', 'sweep', 'whirl'],
    color: '#6366F1',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, p * w * 0.7, 0, p * Math.PI * 4);
      ctx.lineTo(w / 2, h / 2);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'trans_triangle_mosaic',
    name: 'Triangle Mosaic Fold',
    category: 'Geometric & Shapes',
    description: 'Origami triangle polygon mesh folding away',
    defaultDuration: 0.6,
    xfadeName: 'distance',
    tags: ['triangle', 'origami', 'mosaic'],
    color: '#6366F1',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  },

  // =========================================================================
  // 5. Artistic & Organic (9 presets)
  // =========================================================================
  {
    id: 'trans_ink_bleed',
    name: 'Ink Drop Bleed',
    category: 'Artistic & Organic',
    description: 'Water-based sumi-e ink drop spreading organically',
    defaultDuration: 0.7,
    xfadeName: 'dissolve',
    tags: ['ink', 'bleed', 'watercolor', 'trending'],
    color: '#F43F5E',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      const r = p * w * 0.65;
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'trans_watercolor_splatter',
    name: 'Watercolor Brush Splatter',
    category: 'Artistic & Organic',
    description: 'Dynamic artistic paint splatter reveal',
    defaultDuration: 0.65,
    xfadeName: 'dissolve',
    tags: ['splatter', 'paint', 'watercolor'],
    color: '#F43F5E',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'trans_paper_tear',
    name: 'Paper Tear Rip',
    category: 'Artistic & Organic',
    description: 'Textured fibrous paper rip parting two physical layers',
    defaultDuration: 0.55,
    xfadeName: 'wipetl',
    tags: ['paper', 'tear', 'rip'],
    color: '#E11D48',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, w, h);
      const split = (1 - p) * w;
      ctx.fillStyle = gradA;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(split, 0);
      ctx.lineTo(split - 10, h / 2);
      ctx.lineTo(split + 5, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'trans_page_curl',
    name: 'Page Curl 3D',
    category: 'Artistic & Organic',
    description: 'Realistic 3D corner book page turn peeling across',
    defaultDuration: 0.75,
    xfadeName: 'wipeleft',
    tags: ['pagecurl', 'book', '3d'],
    color: '#E11D48',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, (1 - p) * w, h);
      // Curl highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect((1 - p) * w - 6, 0, 12, h);
    },
  },
  {
    id: 'trans_liquid_wave_morph',
    name: 'Liquid Wave Morph',
    category: 'Artistic & Organic',
    description: 'Viscous fluid wave rippling over frame boundary',
    defaultDuration: 0.65,
    xfadeName: 'dissolve',
    tags: ['liquid', 'wave', 'fluid'],
    color: '#0284C7',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) {
        const y = h * (1 - p) + Math.sin(x * 0.05 + p * 6) * 15;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'trans_smoke_dissolve',
    name: 'Smoke Dissolve',
    category: 'Artistic & Organic',
    description: 'Volumetric atmospheric smoke dispersing the cut',
    defaultDuration: 0.8,
    xfadeName: 'dissolve',
    tags: ['smoke', 'haze', 'dissolve'],
    color: '#94A3B8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'trans_glass_shatter',
    name: 'Glass Shard Shatter',
    category: 'Artistic & Organic',
    description: 'Exploding glass shards breaking apart into fragments',
    defaultDuration: 0.55,
    xfadeName: 'distance',
    tags: ['glass', 'shatter', 'break'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = p > 0.5 ? gradB : gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(p * Math.PI) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(w, 0);
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
    },
  },
  {
    id: 'trans_sprocket_roll',
    name: 'Film Sprocket Roll',
    category: 'Artistic & Organic',
    description: 'Vertical film strip gate jump showing sprockets and frame lines',
    defaultDuration: 0.6,
    xfadeName: 'slidedown',
    tags: ['sprocket', 'filmstrip', 'analog'],
    color: '#D97706',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      const y = p * h;
      ctx.fillStyle = gradA;
      ctx.fillRect(0, y, w, h);
      ctx.fillStyle = gradB;
      ctx.fillRect(0, -h + y, w, h);
      // Film boundary line
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, y - 6, w, 12);
    },
  },
  {
    id: 'trans_ripple_distort',
    name: 'Ripple Wave Distort',
    category: 'Artistic & Organic',
    description: 'Concentric surface pond ripple spreading across scene',
    defaultDuration: 0.6,
    xfadeName: 'radial',
    tags: ['ripple', 'water', 'pond'],
    color: '#0284C7',
    renderThumbnail: (ctx, w, h, p) => {
      const { gradA, gradB } = drawBaseFrames(ctx, w, h);
      ctx.fillStyle = gradA;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gradB;
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(56, 189, 248, ${Math.sin(p * Math.PI) * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, p * w * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
];
