import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  seededRandom,
  createPbtNoiseTexture,
  createCncAluminumTexture,
  createDeskmatTexture,
  getPbtTexture,
  getCncAluminumTexture,
  getDeskmatTexture,
  createPbtMaterial,
  createCncAluminumMaterial,
  createSwitchHousingMaterial,
  createDeskmatMaterial,
  createCrispLegendTexture,
  disposeTextures,
} from './textures';

describe('Engine Textures & Materials PBR (textures.ts)', () => {
  beforeEach(() => {
    disposeTextures();
  });

  describe('Sinh số giả ngẫu nhiên có hạt giống (seededRandom)', () => {
    it('cùng seed luôn sinh ra cùng dãy số ngẫu nhiên', () => {
      const rand1 = seededRandom(12345);
      const rand2 = seededRandom(12345);
      const seq1 = [rand1(), rand1(), rand1()];
      const seq2 = [rand2(), rand2(), rand2()];
      expect(seq1).toEqual(seq2);
    });

    it('giá trị luôn nằm trong khoảng [0, 1)', () => {
      const rand = seededRandom(42);
      for (let i = 0; i < 50; i++) {
        const val = rand();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('Procedural DataTexture PBR', () => {
    it('createPbtNoiseTexture: kích thước 256x256, lặp UV, hạt sần PBT nhám lì', () => {
      const texture = createPbtNoiseTexture(256, 42);
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture.image.width).toBe(256);
      expect(texture.image.height).toBe(256);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      expect(texture.repeat.x).toBe(2);
      expect(texture.anisotropy).toBe(8);

      const data = texture.image.data;
      expect(data).toBeTruthy();
      if (!data) throw new Error('DataTexture data is null');
      expect(data.length).toBe(256 * 256 * 4);
      // Kênh R (bump): 110-170
      expect(data[0]).toBeGreaterThanOrEqual(110);
      expect(data[0]).toBeLessThanOrEqual(170);
      // Kênh G (roughness): ~165-210 (tương đương 0.65-0.82)
      expect(data[1]).toBeGreaterThanOrEqual(165);
      expect(data[1]).toBeLessThanOrEqual(210);
      // Kênh B (metalness): 0 (phi kim)
      expect(data[2]).toBe(0);
      // Kênh Alpha: 255
      expect(data[3]).toBe(255);
    });

    it('createCncAluminumTexture: độ nhám thấp (~0.26), độ kim loại cao (~0.85)', () => {
      const texture = createCncAluminumTexture(256, 77);
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture.repeat.x).toBe(3);

      const data = texture.image.data;
      expect(data).toBeTruthy();
      if (!data) throw new Error('DataTexture data is null');
      // Roughness (~0.26 => 55-80 trên 255)
      expect(data[1]).toBeGreaterThanOrEqual(50);
      expect(data[1]).toBeLessThanOrEqual(85);
      // Metalness (~0.85 => 205-230 trên 255)
      expect(data[2]).toBeGreaterThanOrEqual(200);
      expect(data[2]).toBeLessThanOrEqual(235);
    });

    it('createDeskmatTexture: cấu trúc đan sợi vải dệt (cross-weave)', () => {
      const texture = createDeskmatTexture(256, 99);
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture.repeat.x).toBe(4);

      const data = texture.image.data;
      expect(data).toBeTruthy();
      if (!data) throw new Error('DataTexture data is null');
      // Roughness cao của vải dệt
      expect(data[1]).toBeGreaterThanOrEqual(190);
      expect(data[2]).toBe(0); // Vải không phải kim loại
    });

    it('Singleton getters lưu cache và tái sử dụng cùng instance', () => {
      const pbt1 = getPbtTexture();
      const pbt2 = getPbtTexture();
      expect(pbt1).toBe(pbt2);

      const cnc1 = getCncAluminumTexture();
      const cnc2 = getCncAluminumTexture();
      expect(cnc1).toBe(cnc2);

      const desk1 = getDeskmatTexture();
      const desk2 = getDeskmatTexture();
      expect(desk1).toBe(desk2);
    });
  });

  describe('PBR Material Factories', () => {
    it('createPbtMaterial: chuẩn thông số PBT (roughness 0.72, bumpScale 0.0018, sheen)', () => {
      const mat = createPbtMaterial('#f8f6f0');
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.roughness).toBeCloseTo(0.72, 2);
      expect(mat.metalness).toBe(0);
      expect(mat.bumpScale).toBeCloseTo(0.0018, 4);
      expect(mat.sheen).toBeCloseTo(0.25, 2);
      expect(mat.bumpMap).toBe(getPbtTexture());
      expect(mat.roughnessMap).toBe(getPbtTexture());
    });

    it('createCncAluminumMaterial: chuẩn vỏ nhôm CNC (metalness 0.85, roughness 0.26, clearcoat 0.35)', () => {
      const mat = createCncAluminumMaterial('#b3141f');
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.metalness).toBeCloseTo(0.85, 2);
      expect(mat.roughness).toBeCloseTo(0.26, 2);
      expect(mat.clearcoat).toBeCloseTo(0.35, 2);
      expect(mat.clearcoatRoughness).toBeCloseTo(0.25, 2);
      expect(mat.bumpMap).toBe(getCncAluminumTexture());
      expect(mat.roughnessMap).toBe(getCncAluminumTexture());
    });

    it('createSwitchHousingMaterial: transmission 0.7, ior 1.48 cho vỏ switch trong suốt', () => {
      const mat = createSwitchHousingMaterial('#ffffff', true);
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.transmission).toBeCloseTo(0.7, 2);
      expect(mat.ior).toBeCloseTo(1.48, 2);
      expect(mat.roughness).toBeCloseTo(0.15, 2);
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
    });

    it('createSwitchHousingMaterial (đục): tắt transmission cho switch vỏ POM/Nylon', () => {
      const mat = createSwitchHousingMaterial('#232326', false);
      expect(mat.transmission).toBe(0);
      expect(mat.transparent).toBe(false);
      expect(mat.roughness).toBeCloseTo(0.42, 2);
    });

    it('createDeskmatMaterial: thảm lót vải dệt có roughness 0.88, bumpScale 0.002', () => {
      const mat = createDeskmatMaterial('#1a1a1e');
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.roughness).toBeCloseTo(0.88, 2);
      expect(mat.metalness).toBe(0);
      expect(mat.bumpScale).toBeCloseTo(0.002, 4);
      expect(mat.bumpMap).toBe(getDeskmatTexture());
    });
  });

  describe('Crisp Legends & Cleanup', () => {
    it('createCrispLegendTexture tạo texture an toàn (trả null khi jsdom không hỗ trợ 2d context hoặc texture khi có canvas)', () => {
      const tex = createCrispLegendTexture('KeyCraft', 512, 512);
      if (tex) {
        expect(tex).toBeInstanceOf(THREE.CanvasTexture);
        expect(tex.anisotropy).toBe(8);
      } else {
        expect(tex).toBeNull();
      }
    });

    it('disposeTextures giải phóng toàn bộ tài nguyên không ném lỗi', () => {
      getPbtTexture();
      getCncAluminumTexture();
      getDeskmatTexture();
      expect(() => disposeTextures()).not.toThrow();
    });
  });
});
