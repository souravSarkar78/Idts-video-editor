/**
 * Comprehensive Title & Kinetic Text Animation Catalog: 52+ Distinct Presets
 * Covering Kinetic & Social, Cinematic & Corporate, and Stylized & Creative animations.
 */
import { TextClipStyle } from '../../types/ipc';

export interface TitlePresetItem {
  id: string;
  name: string;
  category: 'Kinetic & Social' | 'Cinematic & Corporate' | 'Stylized & Creative';
  description: string;
  defaultText: string;
  defaultDuration: number;
  animationType: string;
  tags: string[];
  color: string;
  style: Partial<TextClipStyle>;
  drawtextExpression: string;
  assTemplate: string;
  renderThumbnail: (ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) => void;
}

// Base dark background helper for titles
function drawTitleBase(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0F1219');
  grad.addColorStop(1, '#080A0E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export const TITLES_CATALOG: TitlePresetItem[] = [
  // =========================================================================
  // 1. Kinetic & Social (18 presets)
  // =========================================================================
  {
    id: 'title_typewriter',
    name: 'Typewriter Cursor',
    category: 'Kinetic & Social',
    description: 'Realistic typewriter character-by-character reveal with blinking block cursor',
    defaultText: 'TYPEWRITER EFFECT',
    defaultDuration: 3.5,
    animationType: 'typewriter',
    tags: ['typewriter', 'cursor', 'kinetic', 'terminal', 'trending'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: "drawtext=text='TYPEWRITER':expansion=normal:alpha='if(lt(t,1.5),t/1.5,1)'",
    assTemplate: '{\\k%d}TYPEWRITER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const text = 'TYPEWRITER_';
      const visibleCount = Math.floor(p * text.length);
      const displayText = text.slice(0, visibleCount);
      const cursorVisible = Math.floor(p * 10) % 2 === 0;

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText + (cursorVisible ? '▌' : ' '), w / 2, h / 2);
    },
  },
  {
    id: 'title_word_bounce',
    name: 'Word Bounce',
    category: 'Kinetic & Social',
    description: 'High-energy bouncy stagger effect for social captions and reels',
    defaultText: 'BOUNCE WITH ENERGY',
    defaultDuration: 3.0,
    animationType: 'word_bounce',
    tags: ['bounce', 'kinetic', 'social', 'shorts', 'reels', 'trending'],
    color: '#FACC15',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 36,
      fontWeight: '900',
      fontColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 3,
      alignment: 'center',
    },
    drawtextExpression: "drawtext=text='BOUNCE':y='h/2-abs(sin(t*8))*30'",
    assTemplate: '{\\t(0,200,\\fscy130)\\t(200,400,\\fscy100)}BOUNCE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const bounce = Math.abs(Math.sin(p * Math.PI * 4)) * 12;
      ctx.font = '900 14px sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BOUNCE!', w / 2, h / 2 - bounce);
    },
  },
  {
    id: 'title_karaoke_highlight',
    name: 'Karaoke Highlight',
    category: 'Kinetic & Social',
    description: 'Dynamic wipe color highlight syncing with speech cadence',
    defaultText: 'KARAOKE SYNC HIGHLIGHT',
    defaultDuration: 3.0,
    animationType: 'karaoke',
    tags: ['karaoke', 'caption', 'speech', 'highlight', 'social'],
    color: '#EC4899',
    style: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 34,
      fontWeight: '800',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=KARAOKE:fontcolor_expr=if(lt(t,1.5),white,yellow)',
    assTemplate: '{\\k50}KA {\\k50}RA {\\k50}O {\\k50}KE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '800 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Background dim text
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('KARAOKE HIGHLIGHT', w / 2, h / 2);

      // Clipped active highlight text
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * p, h);
      ctx.clip();
      ctx.fillStyle = '#EC4899';
      ctx.fillText('KARAOKE HIGHLIGHT', w / 2, h / 2);
      ctx.restore();
    },
  },
  {
    id: 'title_pop_squeeze',
    name: 'Pop & Squeeze',
    category: 'Kinetic & Social',
    description: 'Cartoony squash and stretch entrance with elastic settling',
    defaultText: 'POP & SQUEEZE',
    defaultDuration: 2.5,
    animationType: 'pop_squeeze',
    tags: ['pop', 'squeeze', 'cartoon', 'elastic', 'dynamic'],
    color: '#10B981',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 40,
      fontWeight: 'bold',
      fontColor: '#10B981',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=POP',
    assTemplate: '{\\fscx140\\fscy70\\t(0,250,\\fscx90\\fscy110)\\t(250,500,\\fscx100\\fscy100)}POP',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const scaleX = 1 + Math.sin(p * Math.PI * 3) * 0.3 * (1 - p);
      const scaleY = 1 - Math.sin(p * Math.PI * 3) * 0.25 * (1 - p);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, scaleY);
      ctx.font = '900 15px sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POP & SQUEEZE', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_rapid_zoom_punch',
    name: 'Rapid Zoom Punch',
    category: 'Kinetic & Social',
    description: 'Super-fast punch-in zoom with motion blur vibe for dramatic statements',
    defaultText: 'ZOOM PUNCH!',
    defaultDuration: 2.0,
    animationType: 'zoom_punch',
    tags: ['zoom', 'punch', 'action', 'impact', 'trending'],
    color: '#EF4444',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 44,
      fontWeight: 'bold',
      fontColor: '#EF4444',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=PUNCH',
    assTemplate: '{\\fscx250\\fscy250\\t(0,180,\\fscx100\\fscy100)}PUNCH',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const scale = 2.5 - Math.min(1, p * 2.5) * 1.5;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.font = '900 16px sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PUNCH!', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_kinetic_sliding_stagger',
    name: 'Kinetic Sliding Stagger',
    category: 'Kinetic & Social',
    description: 'Lines slide smoothly from alternating left and right margins',
    defaultText: 'KINETIC SLIDE / STAGGER',
    defaultDuration: 3.0,
    animationType: 'stagger_slide',
    tags: ['slide', 'stagger', 'kinetic', 'motion', 'modern'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=SLIDE',
    assTemplate: '{\\move(-200,100,500,100)}SLIDE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const slide1 = (1 - Math.min(1, p * 2)) * -w * 0.5;
      const slide2 = (1 - Math.min(1, p * 2)) * w * 0.5;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KINETIC', w / 2 + slide1, h / 2 - 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('STAGGER', w / 2 + slide2, h / 2 + 8);
    },
  },
  {
    id: 'title_glitch_flicker',
    name: 'Glitch Flicker',
    category: 'Kinetic & Social',
    description: 'Electric erratic flicker with horizontal slice displacements',
    defaultText: 'SYSTEM GLITCH',
    defaultDuration: 2.5,
    animationType: 'glitch_flicker',
    tags: ['glitch', 'flicker', 'cyber', 'error', 'trending'],
    color: '#A855F7',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#A855F7',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=GLITCH',
    assTemplate: '{\\an5}GLITCH',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const flicker = Math.sin(p * 50) > 0.2;
      if (!flicker) return;
      const jitterX = (Math.random() - 0.5) * 6;
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SYSTEM GLITCH', w / 2 + jitterX - 2, h / 2);
      ctx.fillStyle = '#FF0055';
      ctx.fillText('SYSTEM GLITCH', w / 2 + jitterX + 2, h / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('SYSTEM GLITCH', w / 2 + jitterX, h / 2);
    },
  },
  {
    id: 'title_neon_glow_pulse',
    name: 'Neon Glow Pulse',
    category: 'Kinetic & Social',
    description: 'Vibrant cyberpunk neon tube flashing on with humming pulse',
    defaultText: 'NEON NIGHTS',
    defaultDuration: 3.5,
    animationType: 'neon_pulse',
    tags: ['neon', 'glow', 'pulse', 'cyberpunk', 'lighting'],
    color: '#F43F5E',
    style: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fontColor: '#F43F5E',
      strokeColor: '#FF6484',
      strokeWidth: 2,
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=NEON',
    assTemplate: '{\\blur4\\bord3}NEON',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const glow = 5 + Math.sin(p * Math.PI * 6) * 4;
      ctx.font = 'bold 14px sans-serif';
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = glow;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NEON NIGHTS', w / 2, h / 2);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'title_liquid_wave_reveal',
    name: 'Liquid Wave Reveal',
    category: 'Kinetic & Social',
    description: 'Fluids rising mask reveal like filling water with undulating crest',
    defaultText: 'LIQUID REVEAL',
    defaultDuration: 3.0,
    animationType: 'liquid_wave',
    tags: ['liquid', 'wave', 'fluid', 'fill', 'organic'],
    color: '#06B6D4',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#06B6D4',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=LIQUID',
    assTemplate: '{\\clip(0,50,200,100)}LIQUID',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('LIQUID REVEAL', w / 2, h / 2);

      ctx.save();
      ctx.beginPath();
      const waveH = h * (1 - p);
      ctx.moveTo(0, waveH);
      for (let x = 0; x <= w; x += 10) {
        ctx.lineTo(x, waveH + Math.sin(x * 0.05 + p * 10) * 4);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#06B6D4';
      ctx.fillText('LIQUID REVEAL', w / 2, h / 2);
      ctx.restore();
    },
  },
  {
    id: 'title_rubber_band_stretch',
    name: 'Rubber Band Stretch',
    category: 'Kinetic & Social',
    description: 'Stretches horizontally wide before snapping back like elastic latex',
    defaultText: 'RUBBER SNAP',
    defaultDuration: 2.5,
    animationType: 'rubber_stretch',
    tags: ['rubber', 'stretch', 'snap', 'elastic', 'fun'],
    color: '#EAB308',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 38,
      fontWeight: 'bold',
      fontColor: '#EAB308',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=RUBBER',
    assTemplate: '{\\fscx180\\t(0,250,\\fscx95)}RUBBER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const stretch = 1 + Math.sin(p * Math.PI * 4) * 0.4 * (1 - p);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(stretch, 1 / stretch);
      ctx.font = '900 15px sans-serif';
      ctx.fillStyle = '#EAB308';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RUBBER SNAP', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_perspective_flip_3d',
    name: '3D Perspective Flip',
    category: 'Kinetic & Social',
    description: '3D spatial card flip rotating 90 degrees around X-axis into view',
    defaultText: '3D FLIP TITLE',
    defaultDuration: 2.8,
    animationType: 'flip_3d',
    tags: ['3d', 'perspective', 'flip', 'rotation', 'spatial'],
    color: '#8B5CF6',
    style: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#8B5CF6',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=FLIP',
    assTemplate: '{\\frx90\\t(0,350,\\frx0)}FLIP',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const angle = (1 - Math.min(1, p * 2)) * Math.PI * 0.5;
      const cosA = Math.cos(angle);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, cosA);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#8B5CF6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('3D FLIP TITLE', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_stomp_headline',
    name: 'Stomp Headline',
    category: 'Kinetic & Social',
    description: 'Rhythmic percussive stomp that shakes the screen on each beat',
    defaultText: 'STOMP. BEAT. DROP.',
    defaultDuration: 2.0,
    animationType: 'stomp_beat',
    tags: ['stomp', 'rhythm', 'beat', 'fast', 'percussion'],
    color: '#EF4444',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 42,
      fontWeight: 'bold',
      fontColor: '#EF4444',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=STOMP',
    assTemplate: '{\\fscx160\\fscy160\\t(0,80,\\fscx100\\fscy100)}STOMP',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const beat = Math.floor(p * 3);
      const words = ['STOMP', 'BEAT', 'DROP'];
      ctx.font = '900 18px sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(words[beat] || 'DROP', w / 2, h / 2);
    },
  },
  {
    id: 'title_gradient_wave_cycle',
    name: 'Gradient Wave Cycle',
    category: 'Kinetic & Social',
    description: 'Hypnotic iridescent chromatic rainbow cycling smoothly across the letters',
    defaultText: 'IRIDESCENT WAVE',
    defaultDuration: 3.5,
    animationType: 'gradient_cycle',
    tags: ['gradient', 'rainbow', 'color', 'cycle', 'trendy'],
    color: '#F43F5E',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=GRADIENT',
    assTemplate: '{\\1c&H00FFFF&\\t(0,500,\\1c&HFF00FF&)}WAVE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      const shift = p * 2;
      grad.addColorStop(0, `hsl(${(shift * 180) % 360}, 90%, 65%)`);
      grad.addColorStop(0.5, `hsl(${((shift + 0.3) * 180) % 360}, 90%, 65%)`);
      grad.addColorStop(1, `hsl(${((shift + 0.6) * 180) % 360}, 90%, 65%)`);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = grad;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IRIDESCENT WAVE', w / 2, h / 2);
    },
  },
  {
    id: 'title_vhs_osd_stamp',
    name: 'VHS OSD Stamp',
    category: 'Kinetic & Social',
    description: 'Retro camcorder on-screen display with blinking PLAY and timecode',
    defaultText: 'PLAY ▶ 00:04:22:15',
    defaultDuration: 4.0,
    animationType: 'vhs_osd',
    tags: ['vhs', 'osd', 'retro', 'camcorder', '90s'],
    color: '#10B981',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 26,
      fontWeight: 'bold',
      fontColor: '#10B981',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=PLAY',
    assTemplate: '{\\an7}PLAY ▶',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const blink = Math.floor(p * 6) % 2 === 0;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.fillText(blink ? 'PLAY ▶' : '      ', 15, h / 2 - 4);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('00:04:12 SP', 15, h / 2 + 10);
    },
  },
  {
    id: 'title_subtitle_bounce',
    name: 'Subtitle Bounce',
    category: 'Kinetic & Social',
    description: 'Punchy animated subtitle with subtle baseline bounce and black stroke',
    defaultText: 'Engaging Subtitle Highlight',
    defaultDuration: 3.0,
    animationType: 'subtitle_bounce',
    tags: ['subtitle', 'caption', 'bounce', 'stroke', 'reels'],
    color: '#FACC15',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 30,
      fontWeight: '800',
      fontColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 4,
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=SUBTITLE',
    assTemplate: '{\\an2\\bord4\\3c&H000000&}SUBTITLE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const bounce = Math.abs(Math.sin(p * Math.PI * 4)) * 5;
      ctx.font = '800 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('SUBTITLE BOUNCE', w / 2, h / 2 - bounce);
      ctx.fillStyle = '#FACC15';
      ctx.fillText('SUBTITLE BOUNCE', w / 2, h / 2 - bounce);
    },
  },
  {
    id: 'title_social_pop_tag',
    name: 'Social Pop Tag',
    category: 'Kinetic & Social',
    description: 'Glossy rounded bubble tag that pops onto screen with notification badge sound',
    defaultText: '@YOURCHANNEL',
    defaultDuration: 3.0,
    animationType: 'social_pop',
    tags: ['social', 'tag', 'username', 'handle', 'badge'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fontColor: '#FFFFFF',
      backgroundColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=@CHANNEL',
    assTemplate: '{\\an5\\bord0}TAG',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const scale = Math.min(1, p * 2);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.roundRect(-50, -12, 100, 24, 12);
      ctx.fill();
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#080A0E';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('@CHANNEL', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_kinetic_stretchy_marquee',
    name: 'Kinetic Stretchy Marquee',
    category: 'Kinetic & Social',
    description: 'Continuously rolling banner with velocity stretching',
    defaultText: '• BREAKING UPDATE • STREAMING LIVE',
    defaultDuration: 4.0,
    animationType: 'stretchy_marquee',
    tags: ['marquee', 'ticker', 'kinetic', 'stretch', 'scroll'],
    color: '#F43F5E',
    style: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 28,
      fontWeight: '900',
      fontColor: '#F43F5E',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=MARQUEE',
    assTemplate: '{\\move(600,100,-600,100)}MARQUEE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const offset = (p * w * 2) % (w * 1.5);
      ctx.font = '900 12px sans-serif';
      ctx.fillStyle = '#F43F5E';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('• MARQUEE • LIVE • UPDATE •', w - offset, h / 2);
    },
  },
  {
    id: 'title_comic_burst_shout',
    name: 'Comic Shout Bubble',
    category: 'Kinetic & Social',
    description: 'Explosive comic book burst bubble with slanted halftone drop-shadow',
    defaultText: 'BOOM!!',
    defaultDuration: 2.0,
    animationType: 'comic_burst',
    tags: ['comic', 'shout', 'boom', 'pop-art', 'fun'],
    color: '#FACC15',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fontColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 4,
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=BOOM',
    assTemplate: '{\\an5\\bord4\\fscx150}BOOM',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const punch = 1 + Math.sin(p * Math.PI * 3) * 0.2;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(punch, punch);
      ctx.rotate(-0.1);
      ctx.font = '900 20px Impact, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('BOOM!!', 0, 0);
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BOOM!!', 0, 0);
      ctx.restore();
    },
  },

  // =========================================================================
  // 2. Cinematic & Corporate (17 presets)
  // =========================================================================
  {
    id: 'title_cinematic_fade_up',
    name: 'Cinematic Fade-Up & Track',
    category: 'Cinematic & Corporate',
    description: 'Graceful slow opacity fade-up with progressive character tracking expansion',
    defaultText: 'A FILM BY CHRISTOPHER NOLAN',
    defaultDuration: 4.5,
    animationType: 'fade_tracking',
    tags: ['cinematic', 'fade', 'tracking', 'minimal', 'hollywood'],
    color: '#E2E8F0',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 30,
      fontWeight: '500',
      fontColor: '#E2E8F0',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=CINEMATIC',
    assTemplate: '{\\fad(1200,800)\\fsp15}CINEMATIC',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const opacity = Math.min(1, p * 2);
      const spacing = p * 6;
      ctx.font = '12px serif';
      ctx.fillStyle = `rgba(226, 232, 240, ${opacity})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Render with tracking spacing
      const str = 'A FILM PRODUCTION';
      let startX = w / 2 - ((str.length - 1) * (10 + spacing)) / 2;
      for (let i = 0; i < str.length; i++) {
        ctx.fillText(str[i], startX + i * (10 + spacing), h / 2);
      }
    },
  },
  {
    id: 'title_slow_pan_masked',
    name: 'Slow Pan Masked Reveal',
    category: 'Cinematic & Corporate',
    description: 'Text slides up out of an invisible razor-sharp horizontal cut line',
    defaultText: 'PARASITE (2019)',
    defaultDuration: 3.5,
    animationType: 'masked_reveal',
    tags: ['mask', 'reveal', 'cinematic', 'clean', 'trailer'],
    color: '#F8FAFC',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: '600',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=REVEAL',
    assTemplate: '{\\clip(0,50,400,100)\\move(200,100,200,75)}PARASITE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h / 2 + 5);
      ctx.clip();
      const yOffset = (1 - Math.min(1, p * 1.5)) * 25;
      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MASKED REVEAL', w / 2, h / 2 + yOffset);
      ctx.restore();
      // Razor dividing line
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(w * 0.25, h / 2 + 6, w * 0.5, 1);
    },
  },
  {
    id: 'title_elegant_thin_line_draw',
    name: 'Elegant Thin Line Draw',
    category: 'Cinematic & Corporate',
    description: 'Gold delicate rule drawing from center outward beneath the text',
    defaultText: 'ARCHITECTURAL PORTFOLIO',
    defaultDuration: 4.0,
    animationType: 'thin_line_draw',
    tags: ['elegant', 'line', 'minimal', 'gold', 'luxury'],
    color: '#F59E0B',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 30,
      fontWeight: '400',
      fontColor: '#F59E0B',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=PORTFOLIO',
    assTemplate: '{\\fad(800,800)}PORTFOLIO',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '12px serif';
      ctx.fillStyle = '#F59E0B';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LUXURY DESIGN', w / 2, h / 2 - 6);

      const lineWidth = Math.min(1, p * 1.8) * (w * 0.6);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(w / 2 - lineWidth / 2, h / 2 + 8, lineWidth, 1.5);
    },
  },
  {
    id: 'title_lower_third_glassmorphism',
    name: 'Glassmorphism Card',
    category: 'Cinematic & Corporate',
    description: 'Frosted translucent backdrop card with gradient border highlight',
    defaultText: 'SARAH CHEN // HEAD OF AI',
    defaultDuration: 4.0,
    animationType: 'glass_card',
    tags: ['lowerthird', 'glass', 'modern', 'corporate', 'interview'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 28,
      fontWeight: '700',
      fontColor: '#FFFFFF',
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignment: 'left',
    },
    drawtextExpression: 'drawtext=text=SARAH',
    assTemplate: '{\\an1}SARAH',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const cardW = Math.min(1, p * 1.5) * (w * 0.85);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(56, 189, 248,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, h / 2 - 14, cardW, 28, 4);
      ctx.fill();
      ctx.stroke();

      if (p > 0.3) {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#38BDF8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('SARAH CHEN', 20, h / 2 - 4);
        ctx.font = '8px sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('HEAD OF AI RESEARCH', 20, h / 2 + 6);
      }
    },
  },
  {
    id: 'title_news_breaking_banner',
    name: 'Breaking News Banner',
    category: 'Cinematic & Corporate',
    description: 'Urgent broadcast news lower third with flashing red tag and alert tape',
    defaultText: 'BREAKING: MARKET HITS NEW RECORD',
    defaultDuration: 4.5,
    animationType: 'news_banner',
    tags: ['news', 'breaking', 'broadcast', 'urgent', 'lowerthird'],
    color: '#EF4444',
    style: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 32,
      fontWeight: '800',
      fontColor: '#FFFFFF',
      alignment: 'left',
    },
    drawtextExpression: 'drawtext=text=BREAKING',
    assTemplate: '{\\an1}BREAKING',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      // Red tag
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(8, h / 2 - 12, 50, 24);
      ctx.font = '900 8px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ALERT', 33, h / 2);

      // Yellow banner
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(60, h / 2 - 12, w - 68, 24);
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText('BREAKING NEWS UPDATE', 66, h / 2);
    },
  },
  {
    id: 'title_broadcast_split_bar',
    name: 'Broadcast Split Bar',
    category: 'Cinematic & Corporate',
    description: 'High-end TV sports/documentary split graphic separating names and stats',
    defaultText: 'WORLD CHAMPIONSHIP // 2026',
    defaultDuration: 4.0,
    animationType: 'broadcast_split',
    tags: ['broadcast', 'sports', 'split', 'corporate', 'clean'],
    color: '#3B82F6',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 30,
      fontWeight: 'bold',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=BROADCAST',
    assTemplate: '{\\an5}BROADCAST',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(10, h / 2 - 10, w * 0.45, 20);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(10 + w * 0.45, h / 2 - 10, w * 0.45, 20);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINALS', 10 + (w * 0.45) / 2, h / 2);
      ctx.fillStyle = '#60A5FA';
      ctx.fillText('STAGE 04', 10 + w * 0.45 + (w * 0.45) / 2, h / 2);
    },
  },
  {
    id: 'title_minimal_clean_fade',
    name: 'Minimal Clean Fade',
    category: 'Cinematic & Corporate',
    description: 'Subtle high-clarity sans-serif fade with 0.9s ease curve',
    defaultText: 'SIMPLICITY IS SOPHISTICATION',
    defaultDuration: 3.5,
    animationType: 'clean_fade',
    tags: ['minimal', 'clean', 'fade', 'modern', 'simple'],
    color: '#FFFFFF',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 32,
      fontWeight: '400',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=MINIMAL',
    assTemplate: '{\\fad(600,600)}MINIMAL',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '300 13px sans-serif';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, p * 2)})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MINIMAL ESSENTIALS', w / 2, h / 2);
    },
  },
  {
    id: 'title_document_title_underline',
    name: 'Document Underline',
    category: 'Cinematic & Corporate',
    description: 'Editorial serif header with animated fountain pen underline stroke',
    defaultText: 'THE STATE OF GLOBAL TRADE',
    defaultDuration: 4.0,
    animationType: 'underline_draw',
    tags: ['documentary', 'editorial', 'serif', 'underline', 'clean'],
    color: '#CBD5E1',
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#CBD5E1',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=DOCUMENTARY',
    assTemplate: '{\\fad(500,500)}DOCUMENTARY',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 12px serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOCUMENTARY REPORT', w / 2, h / 2 - 5);

      const uW = Math.min(1, p * 1.5) * (w * 0.7);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(w / 2 - uW / 2, h / 2 + 7, uW, 1.5);
    },
  },
  {
    id: 'title_film_studio_serif_reveal',
    name: 'Studio Serif Reveal',
    category: 'Cinematic & Corporate',
    description: 'Grand movie studio typography with subtle letter luminance glow',
    defaultText: 'PARAMOUNT ENTERTAINMENT',
    defaultDuration: 4.5,
    animationType: 'studio_serif',
    tags: ['studio', 'hollywood', 'serif', 'grand', 'epic'],
    color: '#F1F5F9',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#F1F5F9',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=STUDIO',
    assTemplate: '{\\fad(1000,1000)}STUDIO',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 13px serif';
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 6 * p;
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STUDIO REVEAL', w / 2, h / 2);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'title_gold_foil_shimmer',
    name: 'Gold Foil Shimmer',
    category: 'Cinematic & Corporate',
    description: 'Specular metallic gleam sweeping across embossed gold serif typography',
    defaultText: 'AWARD WINNING EXCELLENCE',
    defaultDuration: 3.5,
    animationType: 'gold_shimmer',
    tags: ['gold', 'foil', 'shimmer', 'luxury', 'award'],
    color: '#D97706',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#F59E0B',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=GOLD',
    assTemplate: '{\\fad(500,500)}GOLD',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      const shinePos = p * 1.5;
      grad.addColorStop(Math.max(0, shinePos - 0.3), '#B45309');
      grad.addColorStop(Math.min(1, Math.max(0, shinePos)), '#FEF3C7');
      grad.addColorStop(Math.min(1, shinePos + 0.3), '#B45309');
      ctx.font = 'bold 13px serif';
      ctx.fillStyle = grad;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GOLDEN SHIMMER', w / 2, h / 2);
    },
  },
  {
    id: 'title_deep_shadow_drop',
    name: 'Deep Shadow Drop',
    category: 'Cinematic & Corporate',
    description: 'Clean modern typography with long 45-degree directional depth shadow',
    defaultText: 'ARCHITECTURAL DEPTH',
    defaultDuration: 3.5,
    animationType: 'deep_shadow',
    tags: ['shadow', 'depth', 'modern', 'architectural', 'bold'],
    color: '#94A3B8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: '900',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=SHADOW',
    assTemplate: '{\\shad6}SHADOW',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '900 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Step shadows
      for (let s = 6; s >= 1; s--) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + s * 0.05})`;
        ctx.fillText('DEEP SHADOW', w / 2 + s, h / 2 + s);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('DEEP SHADOW', w / 2, h / 2);
    },
  },
  {
    id: 'title_vignette_framed_header',
    name: 'Vignette Framed Header',
    category: 'Cinematic & Corporate',
    description: 'Header paired with cinematic top and bottom letterbox bars fading in',
    defaultText: 'CHAPTER ONE: THE BEGINNING',
    defaultDuration: 4.0,
    animationType: 'vignette_header',
    tags: ['vignette', 'letterbox', 'chapter', 'story', 'cinematic'],
    color: '#E2E8F0',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 30,
      fontWeight: '600',
      fontColor: '#E2E8F0',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=CHAPTER',
    assTemplate: '{\\an5}CHAPTER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      // Letterbox bars
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, 10);
      ctx.fillRect(0, h - 10, w, 10);
      ctx.font = '600 11px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CHAPTER ONE', w / 2, h / 2);
    },
  },
  {
    id: 'title_letterbox_master_sub',
    name: 'Master Subtitle Slate',
    category: 'Cinematic & Corporate',
    description: 'Theatrical 2.39:1 scope subtitle position with crystal clarity',
    defaultText: '“Every choice leads to this moment.”',
    defaultDuration: 4.0,
    animationType: 'scope_subtitle',
    tags: ['quote', 'dialogue', 'subtitle', 'theatrical', 'master'],
    color: '#F8FAFC',
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: 28,
      fontWeight: '400',
      fontColor: '#F8FAFC',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=DIALOGUE',
    assTemplate: '{\\an2\\fad(400,400)}QUOTE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'italic 11px serif';
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('“Every journey begins here.”', w / 2, h / 2 + 8);
    },
  },
  {
    id: 'title_monospace_timestamp',
    name: 'Monospace Timestamp',
    category: 'Cinematic & Corporate',
    description: 'Precision military/investigative date and coordinate stamp',
    defaultText: 'LOC: 34.0522° N, 118.2437° W | 04:15:00 UTC',
    defaultDuration: 4.0,
    animationType: 'mono_timestamp',
    tags: ['timestamp', 'military', 'coordinates', 'surveillance', 'tech'],
    color: '#94A3B8',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 24,
      fontWeight: 'bold',
      fontColor: '#94A3B8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=COORDS',
    assTemplate: '{\\an7}TIMESTAMP',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('34°N 118°W // 04:15 UTC', w / 2, h / 2);
    },
  },
  {
    id: 'title_corporate_executive_slate',
    name: 'Executive Slate',
    category: 'Cinematic & Corporate',
    description: 'Polished high-trust corporate presentation slate with accent notch',
    defaultText: 'QUARTERLY FINANCIAL REPORT // Q4',
    defaultDuration: 4.0,
    animationType: 'executive_slate',
    tags: ['corporate', 'executive', 'slate', 'clean', 'finance'],
    color: '#3B82F6',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 32,
      fontWeight: '700',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=REPORT',
    assTemplate: '{\\an5}EXECUTIVE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(w * 0.15, h / 2 - 8, 3, 16);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINANCIAL REPORT', w * 0.15 + 8, h / 2);
    },
  },
  {
    id: 'title_clean_divider_split',
    name: 'Clean Divider Split',
    category: 'Cinematic & Corporate',
    description: 'Upper title and lower category separated by an expanding hairline',
    defaultText: 'INNOVATION // TECHNOLOGY',
    defaultDuration: 3.5,
    animationType: 'divider_split',
    tags: ['divider', 'clean', 'split', 'corporate', 'presentation'],
    color: '#E2E8F0',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 30,
      fontWeight: 'bold',
      fontColor: '#E2E8F0',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=DIVIDER',
    assTemplate: '{\\an5}DIVIDER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('INNOVATION', w / 2, h / 2 - 8);
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('SERIES 2026', w / 2, h / 2 + 10);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(w * 0.3, h / 2, w * 0.4, 1);
    },
  },
  {
    id: 'title_boxed_badge_header',
    name: 'Boxed Badge Header',
    category: 'Cinematic & Corporate',
    description: 'Compact solid box enclosing category keyword over full header',
    defaultText: 'SPECIAL FEATURE: BEHIND THE SCENES',
    defaultDuration: 4.0,
    animationType: 'boxed_badge',
    tags: ['badge', 'boxed', 'feature', 'documentary', 'media'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 30,
      fontWeight: '800',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=FEATURE',
    assTemplate: '{\\an5}FEATURE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(w / 2 - 25, h / 2 - 14, 50, 12);
      ctx.font = '900 7px sans-serif';
      ctx.fillStyle = '#0B0D13';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FEATURE', w / 2, h / 2 - 8);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('BEHIND THE SCENES', w / 2, h / 2 + 8);
    },
  },

  // =========================================================================
  // 3. Stylized & Creative (21 presets)
  // =========================================================================
  {
    id: 'title_cyberpunk_rgb_glitch',
    name: 'Cyberpunk RGB Glitch',
    category: 'Stylized & Creative',
    description: 'Neon cyan/red chromatic aberration channels displacing with digital jitter',
    defaultText: 'CYBERCITY 2077',
    defaultDuration: 3.0,
    animationType: 'cyber_rgb',
    tags: ['cyberpunk', 'rgb', 'glitch', 'neon', 'futuristic'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 38,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=CYBER',
    assTemplate: '{\\an5}CYBER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const jx = Math.sin(p * 40) * 3;
      ctx.font = '900 15px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Red shift
      ctx.fillStyle = 'rgba(255, 0, 80, 0.8)';
      ctx.fillText('CYBERCITY', w / 2 + jx + 2, h / 2);
      // Cyan shift
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.fillText('CYBERCITY', w / 2 - jx - 2, h / 2);
      // Main text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('CYBERCITY', w / 2, h / 2);
    },
  },
  {
    id: 'title_hologram_scanline_text',
    name: 'Hologram Scanline',
    category: 'Stylized & Creative',
    description: 'Sci-fi holographic beam transmission with rolling scanlines and blue glow',
    defaultText: 'INCOMING TRANSMISSION',
    defaultDuration: 3.5,
    animationType: 'hologram',
    tags: ['hologram', 'scifi', 'scanline', 'beam', 'cyber'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 30,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=TRANSMISSION',
    assTemplate: '{\\an5}HOLO',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRANSMISSION', w / 2, h / 2);
      ctx.shadowBlur = 0;
      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
    },
  },
  {
    id: 'title_fire_ember_dissolve',
    name: 'Fire Ember Smoke',
    category: 'Stylized & Creative',
    description: 'Letters glowing like burning coals emitting rising fire embers and smoke',
    defaultText: 'INTO THE ASHES',
    defaultDuration: 3.5,
    animationType: 'fire_ember',
    tags: ['fire', 'ember', 'smoke', 'burn', 'fantasy'],
    color: '#F97316',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#F97316',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=FIRE',
    assTemplate: '{\\an5}FIRE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 14px serif';
      ctx.fillStyle = '#F97316';
      ctx.shadowColor = '#EA580C';
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('INTO THE ASHES', w / 2, h / 2);
      ctx.shadowBlur = 0;
      // Floating embers
      for (let i = 0; i < 8; i++) {
        const ex = (w * 0.2 + (i * 17 + p * 60)) % w;
        const ey = (h * 0.7 - (p * 50 + i * 8)) % h;
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(ex, ey, 2, 2);
      }
    },
  },
  {
    id: 'title_comic_halftone_pop',
    name: 'Comic Halftone Pop',
    category: 'Stylized & Creative',
    description: 'Ben-Day dot raster texture fill with 3D drop-out extrusion',
    defaultText: 'POW! WHAM! POP!',
    defaultDuration: 2.5,
    animationType: 'comic_halftone',
    tags: ['comic', 'halftone', 'popart', 'dots', 'marvel'],
    color: '#EAB308',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 40,
      fontWeight: 'bold',
      fontColor: '#EAB308',
      strokeColor: '#000000',
      strokeWidth: 3,
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=COMIC',
    assTemplate: '{\\an5}COMIC',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.06);
      ctx.font = '900 16px Impact, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('POP ART!', 0, 0);
      ctx.fillStyle = '#EAB308';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POP ART!', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_retro_arcade_pixelate',
    name: 'Retro Arcade Pixel',
    category: 'Stylized & Creative',
    description: 'Chunky 8-bit NES gaming font with blinking coin counter sound',
    defaultText: 'PRESS START • 1 PLAYER',
    defaultDuration: 3.5,
    animationType: 'arcade_pixel',
    tags: ['retro', 'arcade', '8bit', 'pixel', 'gaming'],
    color: '#10B981',
    style: {
      fontFamily: 'monospace',
      fontSize: 26,
      fontWeight: 'bold',
      fontColor: '#10B981',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=START',
    assTemplate: '{\\an5}PIXEL',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const blink = Math.floor(p * 8) % 2 === 0;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = blink ? '#10B981' : '#059669';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PRESS START', w / 2, h / 2);
    },
  },
  {
    id: 'title_chalkboard_scratch',
    name: 'Chalkboard Scratch',
    category: 'Stylized & Creative',
    description: 'Gritty chalk texture with dusty particles and uneven pressure strokes',
    defaultText: 'LESSON #01: INTRO',
    defaultDuration: 3.0,
    animationType: 'chalk_scratch',
    tags: ['chalk', 'chalkboard', 'sketch', 'organic', 'education'],
    color: '#E2E8F0',
    style: {
      fontFamily: 'Comic Sans MS, cursive, sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#E2E8F0',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=CHALK',
    assTemplate: '{\\an5}CHALK',
    renderThumbnail: (ctx, w, h, p) => {
      // Dark slate green chalkboard
      ctx.fillStyle = '#142820';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 13px cursive, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CHALK LESSON', w / 2, h / 2);
    },
  },
  {
    id: 'title_matrix_code_rain',
    name: 'Matrix Code Rain',
    category: 'Stylized & Creative',
    description: 'Cascading digital green glyphs coalescing into solid title letters',
    defaultText: 'WAKE UP, NEO',
    defaultDuration: 4.0,
    animationType: 'matrix_rain',
    tags: ['matrix', 'code', 'green', 'rain', 'hacker'],
    color: '#22C55E',
    style: {
      fontFamily: 'Courier New, monospace',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#22C55E',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=MATRIX',
    assTemplate: '{\\an5}MATRIX',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#15803D';
      // Rain streams
      for (let col = 10; col < w; col += 18) {
        const streamY = (p * 60 + col * 7) % h;
        ctx.fillText(String.fromCharCode(0x30a0 + (col % 30)), col, streamY);
      }
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#4ADE80';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SYSTEM READY', w / 2, h / 2);
    },
  },
  {
    id: 'title_smoke_dispersion',
    name: 'Smoke Dispersion',
    category: 'Stylized & Creative',
    description: 'Title dissolving into soft wispy smoke tendrils that drift away',
    defaultText: 'VANISHING ACT',
    defaultDuration: 3.5,
    animationType: 'smoke_disperse',
    tags: ['smoke', 'disperse', 'fog', 'vapor', 'mystery'],
    color: '#94A3B8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: '300',
      fontColor: '#94A3B8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=SMOKE',
    assTemplate: '{\\an5}SMOKE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const blur = p * 6;
      ctx.font = '300 13px sans-serif';
      ctx.shadowColor = 'rgba(148, 163, 184, 0.7)';
      ctx.shadowBlur = blur + 2;
      ctx.fillStyle = `rgba(148, 163, 184, ${1 - p * 0.5})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VANISHING ACT', w / 2, h / 2);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'title_crumple_unfold',
    name: 'Crumple & Unfold',
    category: 'Stylized & Creative',
    description: 'Paper origami unfolding crease animations revealing printed headline',
    defaultText: 'ORIGAMI DISCOVERY',
    defaultDuration: 3.5,
    animationType: 'crumple_unfold',
    tags: ['origami', 'paper', 'unfold', 'craft', 'creative'],
    color: '#FEF08A',
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#FEF08A',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=ORIGAMI',
    assTemplate: '{\\an5}ORIGAMI',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const scaleX = Math.min(1, p * 1.6);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scaleX, 1);
      ctx.font = 'bold 12px serif';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAPER UNFOLD', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_ink_splash_reveal',
    name: 'Ink Splash Reveal',
    category: 'Stylized & Creative',
    description: 'Black watercolor ink bleed expanding dynamically to reveal calligraphic text',
    defaultText: 'EASTERN CALLIGRAPHY',
    defaultDuration: 3.5,
    animationType: 'ink_splash',
    tags: ['ink', 'splash', 'watercolor', 'oriental', 'artistic'],
    color: '#F8FAFC',
    style: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#F8FAFC',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=CALLIGRAPHY',
    assTemplate: '{\\an5}INK',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const rad = Math.min(1, p * 1.5) * (w * 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 12px serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('INK REVEAL', w / 2, h / 2);
    },
  },
  {
    id: 'title_light_leak_burn',
    name: 'Light Leak Burn-In',
    category: 'Stylized & Creative',
    description: 'Warm organic 35mm optical film burn exposing title out of golden haze',
    defaultText: 'SUMMER MEMORIES',
    defaultDuration: 3.5,
    animationType: 'light_leak',
    tags: ['lightleak', 'film', 'burn', 'vintage', 'warmth'],
    color: '#FB923C',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: '600',
      fontColor: '#FFFFFF',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=SUMMER',
    assTemplate: '{\\an5}SUMMER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      // Light leak blob
      const lg = ctx.createRadialGradient(w * 0.3, h * 0.3, 5, w * 0.3, h * 0.3, w * 0.6);
      lg.addColorStop(0, 'rgba(251, 146, 60, 0.7)');
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);

      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUMMER LEAK', w / 2, h / 2);
    },
  },
  {
    id: 'title_shaky_hand_drawn',
    name: 'Hand-Drawn Wobble',
    category: 'Stylized & Creative',
    description: 'Organic 24fps hand-drawn jitter with wobbly outlines',
    defaultText: 'CREATIVE WORKSHOP',
    defaultDuration: 3.0,
    animationType: 'hand_drawn',
    tags: ['handdrawn', 'wobble', 'sketch', 'organic', 'indie'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Comic Sans MS, cursive, sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=WOBBLE',
    assTemplate: '{\\an5}WOBBLE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const wobble = Math.sin(p * 30) * 1.5;
      ctx.font = 'bold 13px cursive, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HAND DRAWN', w / 2 + wobble, h / 2 - wobble);
    },
  },
  {
    id: 'title_electric_discharge',
    name: 'Electric Arc Discharge',
    category: 'Stylized & Creative',
    description: 'High-voltage lightning arcs jumping across text characters',
    defaultText: 'HIGH VOLTAGE',
    defaultDuration: 2.5,
    animationType: 'electric_discharge',
    tags: ['electric', 'lightning', 'arc', 'voltage', 'energy'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=VOLTAGE',
    assTemplate: '{\\an5}VOLTAGE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '900 14px Impact, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HIGH VOLTAGE', w / 2, h / 2);

      // Arc
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h / 2);
      ctx.lineTo(w * 0.4, h / 2 - 6 + Math.sin(p * 20) * 4);
      ctx.lineTo(w * 0.6, h / 2 + 5);
      ctx.lineTo(w * 0.8, h / 2);
      ctx.stroke();
    },
  },
  {
    id: 'title_shatter_fragments',
    name: 'Shatter Fragments',
    category: 'Stylized & Creative',
    description: 'Exploding glass crystal shards blasting apart on impact',
    defaultText: 'SHATTER IMPACT',
    defaultDuration: 2.5,
    animationType: 'shatter_shards',
    tags: ['shatter', 'glass', 'explosion', 'destruction', 'impact'],
    color: '#E0F2FE',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fontColor: '#E0F2FE',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=SHATTER',
    assTemplate: '{\\an5}SHATTER',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      const split = p * 15;
      ctx.font = '900 14px Impact, sans-serif';
      ctx.fillStyle = '#E0F2FE';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Shards
      ctx.fillText('SHAT', w / 2 - 25 - split, h / 2 - split * 0.5);
      ctx.fillText('TER', w / 2 + 25 + split, h / 2 + split * 0.5);
    },
  },
  {
    id: 'title_liquid_melt_drip',
    name: 'Liquid Melt Drip',
    category: 'Stylized & Creative',
    description: 'Viscous paint dripping downward from bottom of text stalks',
    defaultText: 'MELTING COLORS',
    defaultDuration: 3.5,
    animationType: 'liquid_melt',
    tags: ['melt', 'drip', 'paint', 'slime', 'goo'],
    color: '#A855F7',
    style: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#A855F7',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=MELT',
    assTemplate: '{\\an5}MELT',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#A855F7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MELTING', w / 2, h / 2 - 4);
      // Drips
      for (let i = 0; i < 5; i++) {
        const dx = w * 0.35 + i * 15;
        const dy = h / 2 + 3 + (p * 15 + i * 3) % 15;
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'title_drop_reflection_floor',
    name: 'Drop Reflection Floor',
    category: 'Stylized & Creative',
    description: 'Glossy 3D stage floor reflection fading with vertical falloff',
    defaultText: 'PRESTIGE MIRROR',
    defaultDuration: 3.5,
    animationType: 'reflection_floor',
    tags: ['reflection', 'mirror', 'floor', 'glossy', '3d'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#38BDF8',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=MIRROR',
    assTemplate: '{\\an5}MIRROR',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MIRROR FLOOR', w / 2, h / 2 - 8);

      // Inverted reflection
      ctx.save();
      ctx.translate(w / 2, h / 2 + 10);
      ctx.scale(1, -0.6);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillText('MIRROR FLOOR', 0, 0);
      ctx.restore();
    },
  },
  {
    id: 'title_isometric_extrude_3d',
    name: '3D Isometric Extrude',
    category: 'Stylized & Creative',
    description: 'Deep extruded isometric block letters with shaded side planes',
    defaultText: 'ISOMETRIC 3D',
    defaultDuration: 3.5,
    animationType: 'isometric_3d',
    tags: ['isometric', 'extrude', '3d', 'block', 'geometry'],
    color: '#EC4899',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fontColor: '#EC4899',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=ISOMETRIC',
    assTemplate: '{\\an5}ISOMETRIC',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '900 14px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Extrusion layers
      for (let d = 5; d >= 1; d--) {
        ctx.fillStyle = '#831843';
        ctx.fillText('ISOMETRIC', w / 2 - d, h / 2 - d);
      }
      ctx.fillStyle = '#EC4899';
      ctx.fillText('ISOMETRIC', w / 2, h / 2);
    },
  },
  {
    id: 'title_stencil_cutout',
    name: 'Stencil Military Cutout',
    category: 'Stylized & Creative',
    description: 'Industrial stencil font with spray-painted textured overspray edge',
    defaultText: 'SECTOR // 07 SECURE',
    defaultDuration: 3.5,
    animationType: 'stencil_spray',
    tags: ['stencil', 'industrial', 'military', 'spray', 'urban'],
    color: '#FACC15',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#FACC15',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=STENCIL',
    assTemplate: '{\\an5}STENCIL',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '900 13px sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SECTOR 07', w / 2, h / 2);
      // Cutout gaps
      ctx.fillStyle = '#080A0E';
      ctx.fillRect(w / 2 - 30, h / 2 - 2, 60, 2);
    },
  },
  {
    id: 'title_glow_outline_stroke',
    name: 'Glow Outline Stroke',
    category: 'Stylized & Creative',
    description: 'Hollow wireframe contour lines illuminated by electric running neon current',
    defaultText: 'CONTOUR ILLUMINATION',
    defaultDuration: 3.5,
    animationType: 'contour_glow',
    tags: ['outline', 'stroke', 'wireframe', 'glow', 'vector'],
    color: '#38BDF8',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: 'transparent',
      strokeColor: '#38BDF8',
      strokeWidth: 2,
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=OUTLINE',
    assTemplate: '{\\an5\\bord2\\3c&H00F0FF&\\1a&HFF&}OUTLINE',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      ctx.font = '900 14px sans-serif';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('CONTOUR GLOW', w / 2, h / 2);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'title_radial_burst_reveal',
    name: 'Radial Burst Reveal',
    category: 'Stylized & Creative',
    description: 'Starburst rays bursting radially outwards from title epicenter',
    defaultText: 'SUPERNOVA BLAST',
    defaultDuration: 2.5,
    animationType: 'radial_burst',
    tags: ['radial', 'burst', 'sunburst', 'energy', 'impact'],
    color: '#FACC15',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 38,
      fontWeight: 'bold',
      fontColor: '#FACC15',
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=BURST',
    assTemplate: '{\\an5}BURST',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      // Burst rays
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.lineWidth = 1;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(w / 2 + Math.cos(a + p) * 45, h / 2 + Math.sin(a + p) * 45);
        ctx.stroke();
      }
      ctx.font = '900 13px sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUPERNOVA', w / 2, h / 2);
    },
  },
  {
    id: 'title_synthwave_wireframe',
    name: '80s Synthwave Grid',
    category: 'Stylized & Creative',
    description: 'Outrun retro neon sun with purple wireframe perspective grid',
    defaultText: 'OUTRUN 1984',
    defaultDuration: 3.5,
    animationType: 'synthwave_grid',
    tags: ['synthwave', '80s', 'outrun', 'retro', 'neon'],
    color: '#EC4899',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fontColor: '#EC4899',
      strokeColor: '#38BDF8',
      strokeWidth: 2,
      alignment: 'center',
    },
    drawtextExpression: 'drawtext=text=OUTRUN',
    assTemplate: '{\\an5}OUTRUN',
    renderThumbnail: (ctx, w, h, p) => {
      drawTitleBase(ctx, w, h);
      // Sun
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.45, 18, 0, Math.PI, true);
      ctx.fill();
      // Grid lines
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 10; gx < w; gx += 16) {
        ctx.moveTo(gx, h);
        ctx.lineTo(w / 2, h * 0.45);
      }
      ctx.stroke();

      ctx.font = '900 13px Impact, sans-serif';
      ctx.fillStyle = '#EC4899';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SYNTHWAVE', w / 2, h * 0.45);
    },
  },
];
