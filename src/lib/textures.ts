import * as THREE from 'three';

/**
 * Procedural PBR Micro-Textures & Materials Factory
 *
 * Sinh procedural DataTexture nhiễu hạt siêu mịn (256x256) cho roughnessMap và bumpMap,
 * hoạt động 100% độc lập không cần tải ảnh ngoài, tương thích cả trình duyệt WebGL
 * lẫn môi trường kiểm thử Vitest (Node.js / jsdom).
 */

/** Seeded PRNG (mulberry32) để cùng seed luôn sinh cùng kết cấu hạt */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Texture cache */
const textureCache = new Map<string, THREE.Texture>();
const materialCache = new Map<string, THREE.Material>();

/** Xoá sạch toàn bộ texture và material cache */
export const disposeTextures = (): void => {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
  materialCache.forEach((mat) => mat.dispose());
  materialCache.clear();
};

/**
 * 1. PBT Keycap Texture:
 * Hạt sần li ti đặc trưng của nhựa PBT double-shot cao cấp (nhám lì, không bám vân tay).
 *  - R: Bump height (độ cao gồ ghề vi mô)
 *  - G: Micro-roughness (~0.72)
 *  - B: Metalness (0 - phi kim)
 *  - A: 255
 */
export const createPbtNoiseTexture = (size = 256, seed = 42): THREE.DataTexture => {
  const data = new Uint8Array(size * size * 4);
  const rand = seededRandom(seed);

  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const noise = rand();
    // Bump height: 110-170
    data[idx] = Math.floor(110 + noise * 60);
    // Roughness: tập trung quanh ~184 (0.72 * 255) +/- 25
    data[idx + 1] = Math.floor(165 + noise * 45);
    // Metalness: 0
    data[idx + 2] = 0;
    // Alpha: 255
    data[idx + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/**
 * 2. CNC Aluminum Case Texture:
 * Kết cấu nhôm nguyên khối phun cát (bead-blasted) rồi anodized: hạt siêu mịn, độ phản xạ kim loại cao.
 *  - R: Micro-bump (115-145)
 *  - G: Roughness (~0.26 => ~66 trên 255)
 *  - B: Metalness (~0.85 => ~216 trên 255)
 *  - A: 255
 */
export const createCncAluminumTexture = (size = 256, seed = 77): THREE.DataTexture => {
  const data = new Uint8Array(size * size * 4);
  const rand = seededRandom(seed);

  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const noise = rand();
    // Bump: 120-140 (rất mịn)
    data[idx] = Math.floor(120 + noise * 20);
    // Roughness: ~55-75 (trung bình ~66 = 0.26)
    data[idx + 1] = Math.floor(55 + noise * 22);
    // Metalness: ~205-225 (trung bình ~216 = 0.85)
    data[idx + 2] = Math.floor(205 + noise * 20);
    // Alpha
    data[idx + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/**
 * 3. Deskmat Fabric Texture:
 * Vân dệt sợi vải đan chéo (cross-weave / woven texture) với sợi dọc (warp) và sợi ngang (weft).
 * Phù hợp làm thảm lót bàn (deskmat) êm ái, giảm tiếng vang và tăng thẩm mỹ góc làm việc.
 */
export const createDeskmatTexture = (size = 256, seed = 99): THREE.DataTexture => {
  const data = new Uint8Array(size * size * 4);
  const rand = seededRandom(seed);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Mẫu đan sợi sin/cos tạo gân dệt vải
      const warp = Math.sin((x / size) * Math.PI * 32);
      const weft = Math.cos((y / size) * Math.PI * 32);
      const weave = 0.5 + 0.35 * (warp * weft) + (rand() - 0.5) * 0.15;

      // Bump: sợi vải nổi
      data[idx] = Math.floor(Math.max(0, Math.min(255, 100 + weave * 100)));
      // Roughness: vải dệt nhám cao (~0.88 => ~224)
      data[idx + 1] = Math.floor(Math.max(0, Math.min(255, 210 + weave * 30)));
      // Metalness: 0
      data[idx + 2] = 0;
      // Alpha: 255
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/** Singleton texture getters */
export const getPbtTexture = (): THREE.DataTexture => {
  let tex = textureCache.get('pbt') as THREE.DataTexture | undefined;
  if (!tex) {
    tex = createPbtNoiseTexture();
    textureCache.set('pbt', tex);
  }
  return tex;
};

export const getCncAluminumTexture = (): THREE.DataTexture => {
  let tex = textureCache.get('cnc') as THREE.DataTexture | undefined;
  if (!tex) {
    tex = createCncAluminumTexture();
    textureCache.set('cnc', tex);
  }
  return tex;
};

export const getDeskmatTexture = (): THREE.DataTexture => {
  let tex = textureCache.get('deskmat') as THREE.DataTexture | undefined;
  if (!tex) {
    tex = createDeskmatTexture();
    textureCache.set('deskmat', tex);
  }
  return tex;
};

/**
 * 4. Crisp Legends: Vẽ ký tự độ nét cao bằng Canvas 512x512
 * Font sans-serif hiện đại, bo viền sạch sẽ, gán anisotropy = 8 để ký tự luôn sắc nét ở mọi góc máy nghiêng.
 */
export const createCrispLegendTexture = (
  legend: string,
  width = 512,
  height = 512,
  options: { color?: string; background?: string } = {}
): THREE.Texture | null => {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { color = '#ffffff', background = 'transparent' } = options;

  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Điều chỉnh font size theo độ dài ký tự
  const len = legend.length;
  let fontSize = 180;
  if (len > 3) fontSize = 110;
  if (len > 6) fontSize = 80;

  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(legend, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

/* -------------------------------------------------------------------------- */
/* PBR Material Builders                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Tạo vật liệu PBT Keycap chuẩn photorealistic PBR:
 *  - roughness: 0.72
 *  - bumpScale: 0.0018
 *  - bumpMap & roughnessMap: PBT DataTexture
 *  - sheen: 0.25 (bắt ánh sáng mờ sang trọng ở mép vát)
 */
export const createPbtMaterial = (
  color: THREE.ColorRepresentation,
  options?: Partial<THREE.MeshPhysicalMaterialParameters>
): THREE.MeshPhysicalMaterial => {
  const pbtTex = getPbtTexture();
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.72,
    metalness: 0,
    bumpMap: pbtTex,
    bumpScale: 0.0018,
    roughnessMap: pbtTex,
    sheen: 0.25,
    sheenRoughness: 0.85,
    ...options,
  });
};

/**
 * Tạo vật liệu Nhôm CNC (CNC Aluminum Case) chuẩn PBR:
 *  - metalness: 0.85
 *  - roughness: 0.26
 *  - clearcoat: 0.35 (lớp bóng mỏng bề mặt anodized)
 *  - bumpMap & roughnessMap: CNC DataTexture
 */
export const createCncAluminumMaterial = (
  color: THREE.ColorRepresentation,
  options?: Partial<THREE.MeshPhysicalMaterialParameters>
): THREE.MeshPhysicalMaterial => {
  const cncTex = getCncAluminumTexture();
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.85,
    roughness: 0.26,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    bumpMap: cncTex,
    roughnessMap: cncTex,
    ...options,
  });
};

/**
 * Tạo vật liệu Vỏ Switch (Switch Housing) chuẩn PBR:
 *  - transmission: 0.7 (nhựa PC trong suốt quang học cao cấp)
 *  - ior: 1.48 (chỉ số khúc xạ nhựa Polycarbonate thực tế)
 *  - roughness: 0.15 (bề mặt trơn mịn)
 *  - để lộ rõ Stem chữ thập và lò xo / lá đồng bên trong
 */
export const createSwitchHousingMaterial = (
  color: THREE.ColorRepresentation,
  transparent = true,
  options?: Partial<THREE.MeshPhysicalMaterialParameters>
): THREE.MeshPhysicalMaterial => {
  if (!transparent) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      ...options,
    });
  }

  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.15,
    metalness: 0,
    transmission: 0.7,
    ior: 1.48,
    thickness: 0.25,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    ...options,
  });
};

/**
 * Tạo vật liệu Thảm lót bàn (Deskmat Fabric):
 *  - roughness: 0.88
 *  - bumpScale: 0.002
 *  - bumpMap & roughnessMap: Deskmat Fabric DataTexture
 */
export const createDeskmatMaterial = (
  color: THREE.ColorRepresentation,
  options?: Partial<THREE.MeshPhysicalMaterialParameters>
): THREE.MeshPhysicalMaterial => {
  const fabricTex = getDeskmatTexture();
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.88,
    metalness: 0,
    bumpMap: fabricTex,
    bumpScale: 0.002,
    roughnessMap: fabricTex,
    ...options,
  });
};
