/**
 * Comprehensive Real-Time Visual Filters & Shaders Catalog: 52+ Presets
 * Covering Color & Film Emulation, Glitch & Retro CRT, Blur & Optics, and Artistic Distortions.
 */

export interface EffectPresetItem {
  id: string;
  name: string;
  category: 'Color Grade' | 'Glitch' | 'Retro' | 'Blur & Optical' | 'Artistic' | 'Distortion' | 'Cinematic' | 'Minimal';
  description: string;
  cssFilter: string;
  glslShader: string;
  ffmpegFilter: string;
  tags: string[];
  color: string;
  renderThumbnail: (ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) => void;
}

// Helper to draw a rich test frame onto thumbnail canvas
function drawSampleContent(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base backdrop with dramatic gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1E293B');
  grad.addColorStop(0.5, '#0F172A');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Luminous geometric subject
  const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 4, w * 0.5, h * 0.45, w * 0.35);
  sunGrad.addColorStop(0, '#F59E0B');
  sunGrad.addColorStop(0.5, '#EF4444');
  sunGrad.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.45, w * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Horizon silhouette
  ctx.fillStyle = '#050811';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.7);
  ctx.lineTo(w * 0.3, h * 0.6);
  ctx.lineTo(w * 0.6, h * 0.68);
  ctx.lineTo(w, h * 0.58);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}

export const EFFECTS_CATALOG: EffectPresetItem[] = [
  // =========================================================================
  // 1. Color & Film Emulation (15 presets)
  // =========================================================================
  {
    id: 'filter_film_grain_35mm',
    name: '35mm Vintage Film Grain',
    category: 'Color Grade',
    description: 'Photochemical 35mm grain emulsion with subtle luma agitation',
    cssFilter: 'contrast(108%) brightness(98%)',
    glslShader: 'grain',
    ffmpegFilter: 'noise=c1s=7:c0f=u',
    tags: ['film', 'vintage', 'grain', '35mm', 'trending'],
    color: '#F59E0B',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 80; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
    },
  },
  {
    id: 'filter_film_stock_16mm',
    name: '16mm Warm Stock',
    category: 'Color Grade',
    description: 'Textured 16mm warm vintage color stock with halation warmth',
    cssFilter: 'sepia(18%) saturate(115%) contrast(105%)',
    glslShader: '16mm',
    ffmpegFilter: 'curves=vintage,noise=alls=12:allf=t+u',
    tags: ['16mm', 'warm', 'vintage', 'indie'],
    color: '#D97706',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 180, 50, 0.15)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_teal_orange',
    name: 'Teal & Orange Blockbuster',
    category: 'Color Grade',
    description: 'Hollywood split grade: cyan shadows with warm amber skin tones',
    cssFilter: 'contrast(115%) saturate(125%) hue-rotate(-8deg)',
    glslShader: 'teal_orange',
    ffmpegFilter: 'colorbalance=rs=-0.1:gs=0.02:bs=0.15:rh=0.12:gh=0.03:bh=-0.08',
    tags: ['blockbuster', 'teal', 'orange', 'cinematic', 'trending'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
      grad.addColorStop(1, 'rgba(249, 115, 22, 0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_bleach_bypass',
    name: 'Bleach Bypass',
    category: 'Cinematic',
    description: 'Silver retention look: desaturated hues with crushed high-contrast blacks',
    cssFilter: 'contrast(135%) saturate(55%) brightness(95%)',
    glslShader: 'bleach',
    ffmpegFilter: 'curves=cross_process,eq=saturation=0.55:contrast=1.35',
    tags: ['bleach', 'contrast', 'gritty', 'cinematic'],
    color: '#64748B',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_technicolor_3strip',
    name: 'Technicolor 3-Strip',
    category: 'Retro',
    description: 'Vibrant 1950s golden-age film dye saturation across RGB separations',
    cssFilter: 'saturate(160%) contrast(115%) brightness(102%)',
    glslShader: 'technicolor',
    ffmpegFilter: 'colorbalance=rs=0.15:gs=0.12:bs=-0.1:rh=0.1:gh=0.08:bh=0.05',
    tags: ['technicolor', 'vintage', 'classic', 'retro'],
    color: '#EF4444',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_kodachrome',
    name: 'Kodachrome Warmth',
    category: 'Retro',
    description: 'Classic slide film tonality with rich reds, deep blacks and creamy highlights',
    cssFilter: 'contrast(120%) saturate(125%) sepia(8%)',
    glslShader: 'kodachrome',
    ffmpegFilter: 'curves=strong_contrast,eq=saturation=1.2:gamma_r=1.05',
    tags: ['kodak', 'slide', 'film', 'warm'],
    color: '#EA580C',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(234, 88, 12, 0.12)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_noir_bw',
    name: 'Noir High-Contrast B&W',
    category: 'Cinematic',
    description: 'Moody monochrome dramatic lighting with deep shadow cutoffs',
    cssFilter: 'grayscale(100%) contrast(145%) brightness(95%)',
    glslShader: 'noir',
    ffmpegFilter: 'format=gray,eq=contrast=1.45:brightness=-0.04',
    tags: ['noir', 'monochrome', 'blackwhite', 'dramatic'],
    color: '#E2E8F0',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_sepia_antique',
    name: 'Sepia Antique',
    category: 'Retro',
    description: 'Warm monochrome archival tint reminiscent of early 20th century prints',
    cssFilter: 'sepia(85%) contrast(110%) brightness(90%)',
    glslShader: 'sepia',
    ffmpegFilter: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    tags: ['sepia', 'antique', 'historic', 'retro'],
    color: '#78350F',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(120, 53, 15, 0.35)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_cyberpunk_neon',
    name: 'Cyberpunk Neon Cyan/Magenta',
    category: 'Glitch',
    description: 'High-voltage neon palette boosting cyan-blue and hot magenta highlights',
    cssFilter: 'saturate(150%) contrast(120%) hue-rotate(15deg)',
    glslShader: 'cyber_neon',
    ffmpegFilter: 'colorbalance=rs=-0.15:gs=0.1:bs=0.25:rh=0.25:gh=-0.05:bh=0.2',
    tags: ['cyberpunk', 'neon', 'magenta', 'cyan', 'trending'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(236, 72, 153, 0.25)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0.25)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_golden_hour',
    name: 'Golden Hour Warmth',
    category: 'Color Grade',
    description: 'Soft warm sunset glow infusing highlights with amber and gold',
    cssFilter: 'sepia(25%) saturate(120%) brightness(105%)',
    glslShader: 'golden_hour',
    ffmpegFilter: 'colorbalance=rh=0.2:gh=0.1:bh=-0.12:rs=0.05:gs=0.02:bs=-0.05',
    tags: ['golden', 'sunset', 'warm', 'glow'],
    color: '#FBBF24',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_muted_pastel',
    name: 'Muted Pastel',
    category: 'Minimal',
    description: 'Soft ethereal desaturated look with lifted gentle shadows',
    cssFilter: 'saturate(75%) contrast(92%) brightness(104%)',
    glslShader: 'pastel',
    ffmpegFilter: 'eq=saturation=0.75:contrast=0.92:brightness=0.03',
    tags: ['pastel', 'minimal', 'soft', 'clean'],
    color: '#A78BFA',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_cross_process',
    name: 'Cross-Process E-6',
    category: 'Retro',
    description: 'Experimental laboratory color shift with cyan shadows and yellow highlights',
    cssFilter: 'contrast(125%) hue-rotate(20deg) saturate(115%)',
    glslShader: 'cross_process',
    ffmpegFilter: 'curves=cross_process,eq=contrast=1.2',
    tags: ['crossprocess', 'lomo', 'experimental'],
    color: '#10B981',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_fuji_velvia',
    name: 'Fuji Velvia Vivid',
    category: 'Color Grade',
    description: 'Ultra-saturated landscape look with vivid sky blues and deep greens',
    cssFilter: 'saturate(145%) contrast(118%)',
    glslShader: 'velvia',
    ffmpegFilter: 'eq=saturation=1.4:contrast=1.15',
    tags: ['fuji', 'velvia', 'vivid', 'landscape'],
    color: '#059669',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(5, 150, 105, 0.15)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_film_halation',
    name: 'Film Halation Glow',
    category: 'Cinematic',
    description: 'Soft red-orange scatter along high-contrast luminous boundaries',
    cssFilter: 'contrast(108%) drop-shadow(0 0 6px rgba(255, 60, 20, 0.3))',
    glslShader: 'halation',
    ffmpegFilter: 'boxblur=2:1,eq=contrast=1.1',
    tags: ['halation', 'glow', 'analog', 'cinema'],
    color: '#F43F5E',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 50, 20, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.45, w * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_split_toning',
    name: 'Split Toning Shadow/Highlight',
    category: 'Color Grade',
    description: 'Complementary two-tone grade balancing cold shadows with warm highlights',
    cssFilter: 'contrast(110%) saturate(110%)',
    glslShader: 'split_toning',
    ffmpegFilter: 'colorbalance=bs=0.15:gs=-0.05:rs=-0.08:rh=0.14:gh=0.06:bh=-0.08',
    tags: ['splittone', 'two-tone', 'grade'],
    color: '#8B5CF6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.fillRect(0, 0, w, h);
    },
  },

  // =========================================================================
  // 2. Glitch, CRT & Retro (11 presets)
  // =========================================================================
  {
    id: 'filter_vhs_tape_noise',
    name: 'VHS Tracking Lines & Tape Noise',
    category: 'Glitch',
    description: 'Analog tape head flutter, tracking distortion bands and magnetic jitter',
    cssFilter: 'contrast(115%) saturate(110%)',
    glslShader: 'vhs',
    ffmpegFilter: 'noise=alls=20:allf=t+u,eq=contrast=1.15',
    tags: ['vhs', 'tracking', 'noise', 'retro', 'trending'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      // Tracking distortion bar
      const barY = (p * h * 2) % h;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, barY, w, 8);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.fillRect(-4, barY + 4, w, 4);
    },
  },
  {
    id: 'filter_crt_phosphor',
    name: '90s CRT Phosphor Mask',
    category: 'Retro',
    description: 'Trinitron aperture grille RGB triad subpixel pattern with glass curvature',
    cssFilter: 'contrast(115%) brightness(95%)',
    glslShader: 'crt',
    ffmpegFilter: 'cas=0.5',
    tags: ['crt', 'tv', 'phosphor', '90s'],
    color: '#10B981',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    },
  },
  {
    id: 'filter_arcade_scanlines',
    name: 'Arcade Scanlines',
    category: 'Retro',
    description: 'Horizontal raster beam scanlines simulating arcade monitor cathode displays',
    cssFilter: 'contrast(120%) brightness(92%)',
    glslShader: 'scanlines',
    ffmpegFilter: 'curves=vintage',
    tags: ['scanlines', 'arcade', 'retro', 'raster'],
    color: '#14B8A6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 2);
      }
    },
  },
  {
    id: 'filter_digital_glitch',
    name: 'Digital Data Glitch',
    category: 'Glitch',
    description: 'Packet drop artifacts, slice displacement and RGB channel misregistration',
    cssFilter: 'contrast(125%)',
    glslShader: 'digital_glitch',
    ffmpegFilter: 'eq=contrast=1.2',
    tags: ['glitch', 'digital', 'cyber', 'data'],
    color: '#F43F5E',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      if (Math.sin(p * Math.PI * 4) > 0.4) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.fillRect(8, h * 0.3, w - 16, 12);
        ctx.fillStyle = 'rgba(255, 0, 60, 0.4)';
        ctx.fillRect(-8, h * 0.3 + 4, w - 16, 12);
      }
    },
  },
  {
    id: 'filter_bad_tv_tear',
    name: 'Bad TV Horizontal Tear',
    category: 'Glitch',
    description: 'Loss of horizontal sync resulting in rolling scanlines and tearing bands',
    cssFilter: 'contrast(110%)',
    glslShader: 'bad_tv',
    ffmpegFilter: 'eq=contrast=1.1',
    tags: ['badtv', 'tear', 'sync', 'analog'],
    color: '#8B5CF6',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      const shift = Math.sin(p * Math.PI * 6) * 12;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(shift, h * 0.5, w, 15);
    },
  },
  {
    id: 'filter_pixel_sort',
    name: 'Pixel Sort Dripping',
    category: 'Glitch',
    description: 'Threshold-based pixel streak sorting creating liquid digital cascades',
    cssFilter: 'contrast(115%)',
    glslShader: 'pixel_sort',
    ffmpegFilter: 'cas=0.8',
    tags: ['pixelsort', 'datamosh', 'glitch', 'drip'],
    color: '#6366F1',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let x = 10; x < w; x += 14) {
        const len = (Math.sin(x + p * 6) * 0.5 + 0.5) * 35;
        ctx.fillRect(x, h * 0.35, 6, len);
      }
    },
  },
  {
    id: 'filter_thermal_infrared',
    name: 'Thermal Vision Infrared',
    category: 'Glitch',
    description: 'False-color heatmap palette mapping luminance to ironbow spectrum',
    cssFilter: 'invert(80%) hue-rotate(180deg) saturate(200%)',
    glslShader: 'thermal',
    ffmpegFilter: 'lutrgb=r=val*1.2:g=val*0.8:b=255-val',
    tags: ['thermal', 'infrared', 'heatmap', 'predator'],
    color: '#EF4444',
    renderThumbnail: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#7F1D1D');
      grad.addColorStop(0.3, '#DC2626');
      grad.addColorStop(0.6, '#FBBF24');
      grad.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_night_vision',
    name: 'Night Vision Phosphor Green',
    category: 'Glitch',
    description: 'High-gain monochrome green intensifier tube with dynamic quantum noise',
    cssFilter: 'grayscale(100%) sepia(100%) hue-rotate(85deg) saturate(300%)',
    glslShader: 'night_vision',
    ffmpegFilter: 'colorchannelmixer=0:1:0:0:0:1:0:0:0:1:0:0,noise=alls=25:allf=t+u',
    tags: ['nightvision', 'green', 'military', 'phosphor'],
    color: '#22C55E',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_surveillance_cam',
    name: 'Surveillance Camera Timestamp & Grain',
    category: 'Glitch',
    description: 'Low-bitrate security camera interlacing, sensor noise and washed exposure',
    cssFilter: 'contrast(120%) saturate(40%) brightness(105%)',
    glslShader: 'cctv',
    ffmpegFilter: 'noise=alls=15:allf=t+u,eq=saturation=0.4:contrast=1.25',
    tags: ['cctv', 'surveillance', 'security', 'camera'],
    color: '#94A3B8',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#00F0FF';
      ctx.font = '8px monospace';
      ctx.fillText('REC ● 12:44:09', 6, 12);
    },
  },
  {
    id: 'filter_ascii_terminal',
    name: 'ASCII Terminal Converter',
    category: 'Retro',
    description: 'Monochrome matrix phosphor character quantization',
    cssFilter: 'grayscale(100%) contrast(150%)',
    glslShader: 'ascii',
    ffmpegFilter: 'format=gray',
    tags: ['ascii', 'terminal', 'matrix', 'retro'],
    color: '#10B981',
    renderThumbnail: (ctx, w, h) => {
      ctx.fillStyle = '#050B08';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#10B981';
      ctx.font = '7px monospace';
      for (let y = 10; y < h; y += 9) {
        ctx.fillText('01101001 01100100 01110100 01110011', 4, y);
      }
    },
  },
  {
    id: 'filter_dithering_bayer',
    name: 'Dithering 8-Bit Bayer Matrix',
    category: 'Retro',
    description: 'Classic 8-bit ordered dither matrix reducing color bit-depth to retro palette',
    cssFilter: 'contrast(130%) saturate(120%)',
    glslShader: 'dither',
    ffmpegFilter: 'eq=contrast=1.3:saturation=1.2',
    tags: ['dither', '8bit', 'bayer', 'pixel'],
    color: '#8B5CF6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      for (let x = 0; x < w; x += 4) {
        for (let y = 0; y < h; y += 4) {
          if ((x + y) % 8 === 0) ctx.fillRect(x, y, 2, 2);
        }
      }
    },
  },

  // =========================================================================
  // 3. Blur, Optical & Light (10 presets)
  // =========================================================================
  {
    id: 'filter_anamorphic_flare',
    name: 'Anamorphic Horizontal Lens Flare',
    category: 'Blur & Optical',
    description: 'Cinematic streak bloom emanating horizontally from bright specular points',
    cssFilter: 'contrast(105%)',
    glslShader: 'anamorphic',
    ffmpegFilter: 'boxblur=15:1',
    tags: ['anamorphic', 'lensflare', 'streak', 'cinematic', 'trending'],
    color: '#38BDF8',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      const flare = ctx.createLinearGradient(0, h * 0.45, w, h * 0.45);
      flare.addColorStop(0, 'rgba(0, 240, 255, 0)');
      flare.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
      flare.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = flare;
      ctx.fillRect(0, h * 0.45 - 2, w, 4);
    },
  },
  {
    id: 'filter_promist_bloom',
    name: 'Dreamy Pro-Mist Bloom',
    category: 'Blur & Optical',
    description: 'Diffuses highlight harshness while preserving shadow contrast for a dreamy glow',
    cssFilter: 'brightness(104%) contrast(96%) drop-shadow(0 0 8px rgba(255,255,255,0.25))',
    glslShader: 'bloom',
    ffmpegFilter: 'gblur=sigma=4:steps=2',
    tags: ['promist', 'bloom', 'dreamy', 'soft'],
    color: '#F472B6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.4);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_prism_dispersion',
    name: 'Prism Rainbow Dispersion',
    category: 'Blur & Optical',
    description: 'Radial spectral refraction separating wavelength components at perimeter',
    cssFilter: 'contrast(110%)',
    glslShader: 'prism',
    ffmpegFilter: 'eq=contrast=1.1',
    tags: ['prism', 'dispersion', 'rainbow', 'refraction'],
    color: '#A855F7',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 0, 80, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.strokeRect(6, 6, w - 12, h - 12);
    },
  },
  {
    id: 'filter_tilt_shift',
    name: 'Tilt-Shift Miniature Depth',
    category: 'Blur & Optical',
    description: 'Selective focal plane band turning grand cityscapes into miniature dioramas',
    cssFilter: 'contrast(115%) saturate(120%)',
    glslShader: 'tilt_shift',
    ffmpegFilter: 'boxblur=8:2',
    tags: ['tiltshift', 'miniature', 'depth', 'focus'],
    color: '#10B981',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, h * 0.35, w, h * 0.3);
    },
  },
  {
    id: 'filter_radial_zoom_blur',
    name: 'Radial Zoom Blur',
    category: 'Blur & Optical',
    description: 'Dynamic radial streaks focusing viewer attention toward the center point',
    cssFilter: 'contrast(108%)',
    glslShader: 'zoom_blur',
    ffmpegFilter: 'gblur=sigma=6',
    tags: ['radial', 'zoom', 'blur', 'motion'],
    color: '#3B82F6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < 8; i++) {
        const rad = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(w / 2 + Math.cos(rad) * w, h / 2 + Math.sin(rad) * h);
        ctx.stroke();
      }
    },
  },
  {
    id: 'filter_motion_streak',
    name: 'Directional Motion Streak',
    category: 'Blur & Optical',
    description: 'Linear directional smear simulating extreme high-speed camera movement',
    cssFilter: 'contrast(105%)',
    glslShader: 'motion_streak',
    ffmpegFilter: 'boxblur=12:1',
    tags: ['motion', 'streak', 'smear', 'speed'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, h * 0.4, w, 6);
      ctx.fillRect(0, h * 0.5, w, 10);
    },
  },
  {
    id: 'filter_chromatic_aberration',
    name: 'Chromatic Aberration Fringe',
    category: 'Blur & Optical',
    description: 'Optical lens fringing separating red and blue channel alignments',
    cssFilter: 'contrast(106%)',
    glslShader: 'chromatic',
    ffmpegFilter: 'eq=contrast=1.05',
    tags: ['chromatic', 'fringe', 'rgb', 'lens'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 0, 50, 0.25)';
      ctx.fillRect(3, 0, w, h);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.25)';
      ctx.fillRect(-3, 0, w, h);
    },
  },
  {
    id: 'filter_starburst_highlights',
    name: 'Starburst Highlights',
    category: 'Blur & Optical',
    description: 'Diffraction spikes radiating from bright light sources like night city lights',
    cssFilter: 'contrast(115%) brightness(102%)',
    glslShader: 'starburst',
    ffmpegFilter: 'eq=contrast=1.15',
    tags: ['starburst', 'diffraction', 'specular', 'lights'],
    color: '#FDE047',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 250, 200, 0.6)';
      ctx.lineWidth = 1.5;
      const cx = w * 0.5;
      const cy = h * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy);
      ctx.lineTo(cx + 20, cy);
      ctx.moveTo(cx, cy - 20);
      ctx.lineTo(cx, cy + 20);
      ctx.stroke();
    },
  },
  {
    id: 'filter_vignette_feather',
    name: 'Edge Vignette Feather',
    category: 'Blur & Optical',
    description: 'Smooth optical light falloff feathering inward from perimeter edges',
    cssFilter: 'contrast(105%)',
    glslShader: 'vignette',
    ffmpegFilter: 'vignette=PI/4',
    tags: ['vignette', 'feather', 'shadow', 'perimeter'],
    color: '#0F172A',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.55);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_soft_focus',
    name: 'Soft Focus Glow',
    category: 'Blur & Optical',
    description: 'Romantic glamour diffusion overlaying a sharp core with dreamy luminance',
    cssFilter: 'brightness(102%) contrast(98%) blur(0.4px)',
    glslShader: 'soft_focus',
    ffmpegFilter: 'gblur=sigma=3',
    tags: ['softfocus', 'glamour', 'romantic', 'beauty'],
    color: '#F472B6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 240, 245, 0.15)';
      ctx.fillRect(0, 0, w, h);
    },
  },

  // =========================================================================
  // 4. Artistic & Distortions (16 presets)
  // =========================================================================
  {
    id: 'filter_halftone_popart',
    name: 'Halftone Pop-Art Print',
    category: 'Artistic',
    description: 'Screen-printed dot matrix CMYK pattern inspired by pop art prints',
    cssFilter: 'contrast(150%) saturate(150%)',
    glslShader: 'halftone',
    ffmpegFilter: 'eq=contrast=1.5:saturation=1.5',
    tags: ['halftone', 'popart', 'print', 'dots'],
    color: '#F59E0B',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      for (let x = 4; x < w; x += 6) {
        for (let y = 4; y < h; y += 6) {
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'filter_oil_painting',
    name: 'Oil Painting Brush Stroking',
    category: 'Artistic',
    description: 'Kuwahara-style filter grouping local pixels into textured artistic brush daubs',
    cssFilter: 'contrast(115%) saturate(125%)',
    glslShader: 'oil_paint',
    ffmpegFilter: 'cas=0.9',
    tags: ['oilpainting', 'artistic', 'brush', 'canvas'],
    color: '#D97706',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12, y + 4);
        ctx.stroke();
      }
    },
  },
  {
    id: 'filter_charcoal_sketch',
    name: 'Charcoal Pencil Sketch',
    category: 'Artistic',
    description: 'High-contrast edge sketch rendering resembling hand-drawn graphite lines',
    cssFilter: 'grayscale(100%) contrast(200%) invert(90%)',
    glslShader: 'sketch',
    ffmpegFilter: 'edgedetect=low=0.1:high=0.4,format=gray',
    tags: ['sketch', 'charcoal', 'pencil', 'drawing'],
    color: '#71717A',
    renderThumbnail: (ctx, w, h) => {
      ctx.fillStyle = '#E4E4E7';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.45, w * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_neon_wireframe',
    name: 'Edge Detect Neon Wireframe',
    category: 'Artistic',
    description: 'Sobel edge detection glowing in vibrant electric cyber colors',
    cssFilter: 'contrast(180%) saturate(200%) invert(100%)',
    glslShader: 'wireframe',
    ffmpegFilter: 'edgedetect=low=0.1:high=0.3',
    tags: ['wireframe', 'neon', 'edges', 'cyber'],
    color: '#00F0FF',
    renderThumbnail: (ctx, w, h) => {
      ctx.fillStyle = '#05070D';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.45, w * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_emboss_relief',
    name: 'Emboss Metallic Relief',
    category: 'Artistic',
    description: 'Bas-relief surface extrusion highlighting surface depth and directional lighting',
    cssFilter: 'grayscale(100%) contrast(160%)',
    glslShader: 'emboss',
    ffmpegFilter: 'convolution=0 -1 0 -1 5 -1 0 -1 0',
    tags: ['emboss', 'relief', 'metallic', 'texture'],
    color: '#94A3B8',
    renderThumbnail: (ctx, w, h) => {
      ctx.fillStyle = '#64748B';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.45, w * 0.25, Math.PI, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_water_droplet',
    name: 'Water Droplet Ripple',
    category: 'Distortion',
    description: 'Concentric refractive waves propagating outward across the frame surface',
    cssFilter: 'contrast(105%)',
    glslShader: 'ripple',
    ffmpegFilter: 'lenscorrection=cx=0.5:cy=0.5:k1=0.08',
    tags: ['ripple', 'water', 'droplet', 'waves'],
    color: '#0284C7',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = `rgba(0, 240, 255, ${Math.sin(p * Math.PI) * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, p * w * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_heat_haze',
    name: 'Heat Haze Mirage',
    category: 'Distortion',
    description: 'Vertical turbulent shimmer simulating rising thermal currents over hot tarmac',
    cssFilter: 'contrast(110%)',
    glslShader: 'heat_haze',
    ffmpegFilter: 'eq=contrast=1.1',
    tags: ['heathaze', 'mirage', 'shimmer', 'thermal'],
    color: '#F59E0B',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 180, 50, 0.15)';
      for (let y = h * 0.5; y < h; y += 6) {
        ctx.fillRect(Math.sin(y * 0.1 + p * 5) * 4, y, w, 3);
      }
    },
  },
  {
    id: 'filter_fisheye_barrel',
    name: 'Fish-Eye Barrel Distortion',
    category: 'Distortion',
    description: 'Extreme wide-angle spherical curvature magnifying center subjects',
    cssFilter: 'contrast(106%)',
    glslShader: 'fisheye',
    ffmpegFilter: 'lenscorrection=cx=0.5:cy=0.5:k1=0.25:k2=0.05',
    tags: ['fisheye', 'barrel', 'lens', 'curved'],
    color: '#8B5CF6',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_kaleidoscope_4way',
    name: 'Kaleidoscope Mirror 4-Way',
    category: 'Distortion',
    description: 'Quad symmetry mirroring four quadrants into an ornate repeating mandala',
    cssFilter: 'contrast(115%) saturate(120%)',
    glslShader: 'kaleidoscope_4',
    ffmpegFilter: 'crop=in_w/2:in_h/2:0:0',
    tags: ['kaleidoscope', 'mirror', 'symmetry', 'mandala'],
    color: '#A855F7',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    },
  },
  {
    id: 'filter_kaleidoscope_8way',
    name: 'Kaleidoscope Mirror 8-Way',
    category: 'Distortion',
    description: 'Octagonal radial symmetry generating intricate kaleidoscopic tapestries',
    cssFilter: 'contrast(120%) saturate(125%)',
    glslShader: 'kaleidoscope_8',
    ffmpegFilter: 'crop=in_w/2:in_h/2:0:0',
    tags: ['kaleidoscope', 'octagonal', 'mirror', 'trippy'],
    color: '#A855F7',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
    },
  },
  {
    id: 'filter_underwater_caustics',
    name: 'Underwater Caustics',
    category: 'Distortion',
    description: 'Shifting aquatic sunlight refraction nets with submerged turquoise tint',
    cssFilter: 'hue-rotate(170deg) saturate(130%) contrast(105%)',
    glslShader: 'caustics',
    ffmpegFilter: 'colorbalance=rs=-0.1:gs=0.1:bs=0.2',
    tags: ['underwater', 'caustics', 'ocean', 'aqua'],
    color: '#06B6D4',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_mirror_floor',
    name: 'Mirror Reflection Floor',
    category: 'Distortion',
    description: 'Vertical ground-plane reflection turning subjects into mirrored reflections',
    cssFilter: 'contrast(108%)',
    glslShader: 'mirror_floor',
    ffmpegFilter: 'vflip',
    tags: ['mirror', 'reflection', 'floor', 'symmetry'],
    color: '#6366F1',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
    },
  },
  {
    id: 'filter_vortex_twirl',
    name: 'Vortex Twirl Swirl',
    category: 'Distortion',
    description: 'Centripetal rotational twist warping the center of the frame into a whirlpool',
    cssFilter: 'contrast(110%)',
    glslShader: 'vortex',
    ffmpegFilter: 'lenscorrection=cx=0.5:cy=0.5:k1=-0.15',
    tags: ['vortex', 'twirl', 'swirl', 'whirlpool'],
    color: '#EC4899',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 20, 0, Math.PI * 1.5);
      ctx.stroke();
    },
  },
  {
    id: 'filter_quake_screen_shake',
    name: 'Quake Screen Shake',
    category: 'Distortion',
    description: 'High-energy seismic jitter and impact shockwave displacement',
    cssFilter: 'contrast(115%)',
    glslShader: 'shake',
    ffmpegFilter: 'crop=in_w-20:in_h-20:10:10',
    tags: ['shake', 'earthquake', 'quake', 'impact'],
    color: '#EF4444',
    renderThumbnail: (ctx, w, h, p) => {
      drawSampleContent(ctx, w, h);
      const shake = Math.sin(p * Math.PI * 8) * 4;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.strokeRect(shake + 4, 4, w - 8, h - 8);
    },
  },
  {
    id: 'filter_solarize_invert',
    name: 'Solarize Invert Flash',
    category: 'Artistic',
    description: 'Partial tone reversal turning overexposed highlights into metallic negatives',
    cssFilter: 'invert(70%) contrast(140%)',
    glslShader: 'solarize',
    ffmpegFilter: 'curves=lighter',
    tags: ['solarize', 'invert', 'metallic', 'psychedelic'],
    color: '#A855F7',
    renderThumbnail: (ctx, w, h) => {
      drawSampleContent(ctx, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'filter_duotone_cyber',
    name: 'Duotone Cyberpunk Amber',
    category: 'Color Grade',
    description: 'Two-tone gradient mapping highlights to electric amber and shadows to deep indigo',
    cssFilter: 'contrast(130%) sepia(50%) hue-rotate(190deg)',
    glslShader: 'duotone',
    ffmpegFilter: 'colorbalance=rs=-0.15:bs=0.2:rh=0.25:bh=-0.1',
    tags: ['duotone', 'amber', 'cyber', 'indigo'],
    color: '#F59E0B',
    renderThumbnail: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
  },
];
