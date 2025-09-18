
import type { RGBColor } from '../types';

export function hexToRgb(hex: string): RGBColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex({ r, g, b }: RGBColor): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padEnd(6, '0');
}

export function colorDistance(color1: RGBColor, color2: RGBColor): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function parseColorString(colorStr: string): RGBColor | null {
  if (!colorStr || colorStr.toLowerCase() === 'none') {
    return null;
  }

  if (colorStr.startsWith('#')) {
    return hexToRgb(colorStr);
  }

  if (colorStr.startsWith('rgb')) {
    const parts = colorStr.match(/(\d+)/g);
    if (parts && parts.length >= 3) {
      return {
        r: parseInt(parts[0], 10),
        g: parseInt(parts[1], 10),
        b: parseInt(parts[2], 10),
      };
    }
  }

  // Fallback for named colors by creating a temporary DOM element
  const temp = document.createElement('div');
  temp.style.color = colorStr;
  document.body.appendChild(temp);
  const computedColor = window.getComputedStyle(temp).color;
  document.body.removeChild(temp);
  return parseColorString(computedColor);
}
