import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_PCB_MASK,
  pcbPalette,
  MX_FOOTPRINT,
  SURFACE_SPECS,
  disposeProceduralTextures,
  getPcbTextures,
  getSurfaceTexture,
  seededRandom,
  surfaceSample,
  type SurfaceKind,
} from './proceduralTextures';

afterEach(() => disposeProceduralTextures());

describe('seededRandom', () => {
  it('cùng hạt giống cho cùng dãy số, nằm trong [0, 1)', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('surfaceSample (R cao, G nhám, B kim loại)', () => {
  const kinds = Object.keys(SURFACE_SPECS) as SurfaceKind[];

  it('mọi kênh nằm trong 0–255 với mọi mức nhiễu', () => {
    kinds.forEach((kind) => {
      [0, 0.5, 0.999].forEach((noise) => {
        surfaceSample(kind, 17, 33, noise).forEach((v) => {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        });
      });
    });
  });

  it('nhôm là kim loại, PBT và Poron không; PBT nhám hơn nhôm phun cát', () => {
    expect(surfaceSample('beadBlast', 0, 0, 0.5)[2]).toBe(255);
    expect(surfaceSample('pbt', 0, 0, 0.5)[2]).toBe(0);
    expect(surfaceSample('poron', 0, 0, 0.5)[2]).toBe(0);
    expect(surfaceSample('pbt', 0, 0, 0.5)[1]).toBeGreaterThan(surfaceSample('beadBlast', 0, 0, 0.5)[1]);
  });

  it('Poron: lỗ khí tối hơn hẳn nền', () => {
    expect(surfaceSample('poron', 0, 0, 0.1)[0]).toBeLessThan(surfaceSample('poron', 0, 0, 0.6)[0] - 100);
  });
});

describe('không có canvas (jsdom) thì trả về null, không ném lỗi', () => {
  it('bề mặt và PCB', () => {
    expect(getSurfaceTexture('pbt')).toBeNull();
    expect(getPcbTextures('t', 2, 1, [{ x: 0, z: 0 }])).toBeNull();
  });
});

describe('pcbPalette', () => {
  const lightness = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace).l;

  it('mask tối (đen, xanh lá): đường đồng sáng hơn mask, chữ in lụa trắng', () => {
    [DEFAULT_PCB_MASK, '#1b1c1f'].forEach((mask) => {
      const p = pcbPalette(mask);
      expect(lightness(p.trace)).toBeGreaterThan(lightness(p.mask));
      expect(lightness(p.silk)).toBeGreaterThan(0.8);
    });
  });

  it('mask trắng: đường đồng tối hơn mask, chữ in lụa đen để còn đọc được', () => {
    const p = pcbPalette('#ecebe6');
    expect(lightness(p.trace)).toBeLessThan(lightness(p.mask));
    expect(lightness(p.silk)).toBeLessThan(0.2);
  });

  it('giữ nguyên màu mask (sRGB) sau khi đi qua THREE.Color', () => {
    expect(pcbPalette('#ecebe6').mask).toBe('#ecebe6');
  });
});

it('footprint MX: 2 chân đồng phía bắc, LED phía nam', () => {
  MX_FOOTPRINT.pins.forEach(([, z]) => expect(z).toBeLessThan(0));
  expect(MX_FOOTPRINT.led[1]).toBeGreaterThan(0);
});
