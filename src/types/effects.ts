/**
 * Comprehensive Effects, Transitions, and Title Animation Types for IDTS Video Editor
 */

export type EffectCategory =
  | 'Trending'
  | 'Cinematic'
  | 'Glitch'
  | 'Retro'
  | 'SocialDynamic'
  | 'Minimal'
  | 'Distortion'
  | 'ColorGrade'
  | 'BlurOptical'
  | 'Artistic'
  | 'Geometric'
  | 'WhipMotion'
  | 'LightAtmospheric';

export type ParamType = 'float' | 'color' | 'vec2' | 'vec3' | 'boolean' | 'select';

export interface EffectParam {
  id: string;
  name: string;
  paramType: ParamType;
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface EffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  params: EffectParam[];
  glslShader: string;
  ffmpegFilterTemplate: string;
  tags: string[];
}

export interface TransitionDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  defaultDuration: number;
  xfadeName?: string;
  glslShader: string;
  params: EffectParam[];
  tags: string[];
}

export interface TitleAnimationDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  defaultText: string;
  defaultDuration: number;
  animationType: string;
  assTemplate: string;
  drawtextExpression: string;
  stylePreset: Record<string, any>;
  tags: string[];
}

export interface EffectLibrary {
  titles: TitleAnimationDefinition[];
  filters: EffectDefinition[];
  transitions: TransitionDefinition[];
}
