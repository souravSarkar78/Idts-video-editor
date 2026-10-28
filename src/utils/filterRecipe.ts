import { ShaderRecipe } from '../types/ipc';

/**
 * Computes a blended CSS filter string for a given ShaderRecipe and intensity (0.0 to 1.0).
 * If intensity is 1.0, utilizes the precomputed cssFilter for maximum performance.
 * If intensity is between 0.0 and 1.0, proportionally interpolates parameters towards identity.
 */
export function compileShaderRecipeToCssFilter(recipe: ShaderRecipe, intensity: number = 1.0): string {
  const t = Math.max(0, Math.min(1, intensity));
  if (t <= 0.005) {
    return 'none';
  }

  if (Math.abs(t - 1.0) < 0.01 && recipe.cssFilter) {
    return recipe.cssFilter;
  }

  // Identity baselines
  const baseContrast = 1.0;
  const baseSaturation = 1.0;
  const baseBrightness = 1.0;

  const effContrast = baseContrast + (recipe.contrast - baseContrast) * t;
  const effSaturation = baseSaturation + (recipe.saturation - baseSaturation) * t;
  const effBrightness = baseBrightness + recipe.brightness * t;
  const effSepia = recipe.sepia * t;
  const effHueRotate = recipe.hueRotateDeg * t;

  const tokens: string[] = [];

  if (Math.abs(effContrast - 1.0) > 0.01) {
    tokens.push(`contrast(${Math.round(effContrast * 100)}%)`);
  }
  if (Math.abs(effSaturation - 1.0) > 0.01) {
    tokens.push(`saturate(${Math.round(effSaturation * 100)}%)`);
  }
  if (Math.abs(effBrightness - 1.0) > 0.01) {
    tokens.push(`brightness(${Math.round(effBrightness * 100)}%)`);
  }
  if (effSepia > 0.01) {
    tokens.push(`sepia(${Math.round(effSepia * 100)}%)`);
  }
  if (Math.abs(effHueRotate) > 0.5) {
    tokens.push(`hue-rotate(${effHueRotate.toFixed(1)}deg)`);
  }

  return tokens.length > 0 ? tokens.join(' ') : 'none';
}
