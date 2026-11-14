import * as THREE from 'three';
import type { KeyDef } from '@/lib/keyboard/layouts';

/**
 * Ký tự in trên mặt phím: vẽ chữ trắng lên canvas 2D rồi làm texture trong suốt.
 * Màu thật của chữ do material quyết định (tint), nên một texture dùng được cho mọi bộ màu.
 */

const PX_PER_WORLD = 380;
const cache = new Map<string, THREE.CanvasTexture | null>();

export type LegendLayout = 'single-large' | 'two-line' | 'word' | 'center';

/** Chọn kiểu sắp chữ: chữ cái đơn to góc trái, ký tự hai dòng, từ dài cỡ nhỏ, mũi tên ở giữa. */
export const getLegendLayout = (legend: KeyDef['legend']): LegendLayout => {
  if (Array.isArray(legend)) return 'two-line';
  if (['←', '↑', '→', '↓'].includes(legend)) return 'center';
  return legend.length === 1 ? 'single-large' : 'word';
};

export const createLegendTexture = (
  legend: KeyDef['legend'],
  planeWidth: number,
  planeDepth: number
): THREE.CanvasTexture | null => {
  const text = Array.isArray(legend) ? legend.join('\n') : legend;
  if (!text) return null;

  const width = Math.max(32, Math.round(planeWidth * PX_PER_WORLD));
  const height = Math.max(32, Math.round(planeDepth * PX_PER_WORLD));
  const cacheKey = `${text}|${width}x${height}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) {
    cache.set(cacheKey, null);
    return null;
  }

  const pad = Math.round(height * 0.14);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  const family = '"Helvetica Neue", Arial, sans-serif';

  switch (getLegendLayout(legend)) {
    case 'single-large':
      ctx.font = `500 ${Math.round(height * 0.42)}px ${family}`;
      ctx.fillText(text, pad, pad);
      break;
    case 'two-line': {
      const [top, bottom] = legend as [string, string];
      const size = Math.round(height * 0.32);
      ctx.font = `500 ${size}px ${family}`;
      ctx.fillText(top, pad, pad);
      ctx.fillText(bottom, pad, height - pad - size);
      break;
    }
    case 'word':
      ctx.font = `500 ${Math.round(height * 0.24)}px ${family}`;
      ctx.fillText(text, pad, pad);
      break;
    case 'center':
      ctx.font = `500 ${Math.round(height * 0.44)}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(cacheKey, texture);
  return texture;
};
