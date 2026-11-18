import * as THREE from 'three';

/**
 * Texture PBR vẽ bằng code (Canvas 2D), không tải file ảnh nào.
 *
 * Mẹo đóng gói kênh: three.js đọc bumpMap ở kênh R, roughnessMap ở kênh G, metalnessMap ở kênh B.
 * Vì vậy một "data texture" duy nhất (R = độ cao, G = độ nhám, B = độ kim loại) dùng được cho cả ba map.
 *
 * Texture được cache theo khoá: cả bàn phím dùng chung, chỉ tạo một lần.
 * Môi trường không có canvas (unit test jsdom) thì trả về null; vật liệu vẫn chạy, chỉ không có map.
 */

const cache = new Map<string, THREE.CanvasTexture | null>();

/** Xoá toàn bộ texture đã tạo (gọi khi rời studio hoặc trong test). */
export const disposeProceduralTextures = (): void => {
  cache.forEach((texture) => texture?.dispose());
  cache.clear();
};

/** Số giả ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống thì cùng hoa văn, render nào cũng giống nhau. */
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

interface Canvas2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const createCanvas = (width: number, height: number): Canvas2D | null => {
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
  return ctx ? { canvas, ctx } : null;
};

const toTexture = (canvas: HTMLCanvasElement, color: boolean, repeat: [number, number] = [1, 1]): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  return texture;
};

const cached = (key: string, build: () => THREE.CanvasTexture | null): THREE.CanvasTexture | null => {
  if (cache.has(key)) return cache.get(key) ?? null;
  const texture = build();
  cache.set(key, texture);
  return texture;
};

/** Ghi từng điểm ảnh RGB bằng ImageData (nhanh hơn fillRect từng pixel cả trăm lần). */
const paintPixels = (
  { ctx, canvas }: Canvas2D,
  pixel: (x: number, y: number) => [number, number, number]
): void => {
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const [r, g, b] = pixel(x, y);
      const i = (y * canvas.width + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
};

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/* -------------------------------------------------------------------------- */
/* Bề mặt vật liệu (data texture: R độ cao, G độ nhám, B độ kim loại)           */
/* -------------------------------------------------------------------------- */

export type SurfaceKind = 'pbt' | 'beadBlast' | 'brushed' | 'fr4' | 'poron' | 'wood';

/** Thông số sinh từng loại bề mặt; export để test kiểm tra dải giá trị. */
export const SURFACE_SPECS: Record<SurfaceKind, { size: [number, number]; repeat: [number, number]; seed: number }> = {
  // Nhựa PBT: hạt li ti đều, nhám lì
  pbt: { size: [256, 256], repeat: [2, 2], seed: 11 },
  // Nhôm phun cát (bead-blast) rồi anodize: hạt mịn hơn PBT, kim loại
  beadBlast: { size: [256, 256], repeat: [3, 3], seed: 23 },
  // Đồng phay xước: vệt dài theo một chiều
  brushed: { size: [512, 128], repeat: [1, 3], seed: 37 },
  // Sợi thuỷ tinh FR4: ô dệt đan chéo
  fr4: { size: [256, 256], repeat: [6, 6], seed: 41 },
  // Mút Poron: lỗ khí li ti tối trên nền sáng
  poron: { size: [256, 256], repeat: [4, 4], seed: 53 },
  // Vân gỗ: thớ chạy dọc chiều dài
  wood: { size: [512, 256], repeat: [1, 1], seed: 67 },
};

/** Giá trị [độ cao, độ nhám, kim loại] (0–255) tại một điểm của bề mặt. */
export const surfaceSample = (kind: SurfaceKind, x: number, y: number, noise: number): [number, number, number] => {
  switch (kind) {
    case 'pbt':
      // Độ nhám cao (≈ 0.82–0.98 × roughness gốc), cao độ dao động nhẹ
      return [110 + noise * 70, 210 + noise * 40, 0];
    case 'beadBlast':
      return [120 + noise * 40, 150 + noise * 60, 255];
    case 'brushed': {
      // Vệt ngang: cùng một hàng y gần như cùng giá trị, thêm nhiễu rất nhỏ theo x
      return [100 + noise * 110, 90 + noise * 70, 255];
    }
    case 'fr4': {
      const cell = 16;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const over = (cx + cy) % 2 === 0;
      const u = (x % cell) / cell;
      const v = (y % cell) / cell;
      // Sợi ngang ở ô "over", sợi dọc ở ô "under": độ cao nhô giữa sợi, lõm ở mép
      const along = over ? Math.sin(v * Math.PI) : Math.sin(u * Math.PI);
      return [70 + along * 120 + noise * 20, 170 - along * 40, 25];
    }
    case 'poron':
      return [noise < 0.18 ? 30 : 170 + noise * 50, 245, 0];
    case 'wood': {
      const grain = Math.sin(y * 0.11 + Math.sin(x * 0.012) * 6 + noise * 1.5);
      return [120 + grain * 60, 180 + grain * 30, 0];
    }
  }
};

export const getSurfaceTexture = (kind: SurfaceKind): THREE.CanvasTexture | null =>
  cached(`surface:${kind}`, () => {
    const spec = SURFACE_SPECS[kind];
    const surface = createCanvas(spec.size[0], spec.size[1]);
    if (!surface) return null;
    const random = seededRandom(spec.seed);
    // Vệt xước: mỗi hàng một giá trị gốc, cộng nhiễu nhỏ
    const rowNoise = Array.from({ length: spec.size[1] }, () => random());
    paintPixels(surface, (x, y) => {
      const n = kind === 'brushed' ? rowNoise[y] * 0.85 + random() * 0.15 : random();
      return surfaceSample(kind, x, y, n).map(clamp255) as [number, number, number];
    });
    return toTexture(surface.canvas, false, spec.repeat);
  });

/** Màu vân gỗ óc chó (texture màu, dùng làm map cho vỏ gỗ). */
export const getWoodColorTexture = (): THREE.CanvasTexture | null =>
  cached('color:wood', () => {
    const spec = SURFACE_SPECS.wood;
    const surface = createCanvas(spec.size[0], spec.size[1]);
    if (!surface) return null;
    const random = seededRandom(spec.seed);
    paintPixels(surface, (x, y) => {
      const grain = Math.sin(y * 0.11 + Math.sin(x * 0.012) * 6 + random() * 1.5);
      const shade = 0.78 + grain * 0.14 + random() * 0.05;
      return [clamp255(122 * shade), clamp255(76 * shade), clamp255(44 * shade)];
    });
    return toTexture(surface.canvas, true);
  });

/** Màn hình LCD mini (module 2U kiểu Zoom75): giờ, pin, chế độ kết nối, nền tối phát sáng */
export const getLcdTexture = (): THREE.CanvasTexture | null =>
  cached('color:lcd', () => {
    const screen = createCanvas(320, 144);
    if (!screen) return null;
    const { ctx } = screen;
    const gradient = ctx.createLinearGradient(0, 0, 320, 144);
    gradient.addColorStop(0, '#0d1b2a');
    gradient.addColorStop(1, '#1b3a4b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, 144);
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '700 54px Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('12:45', 22, 22);
    ctx.font = '600 20px Arial, sans-serif';
    ctx.fillStyle = '#7fd1ff';
    ctx.fillText('2.4G  ·  NKRO', 24, 96);
    // Pin
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(232, 28, 62, 28);
    ctx.fillRect(294, 36, 5, 12);
    ctx.fillStyle = '#5ee39a';
    ctx.fillRect(237, 33, 40, 18);
    return toTexture(screen.canvas, true);
  });

/* -------------------------------------------------------------------------- */
/* PCB: mạch đồng, lỗ via, pad mạ vàng ENIG, chữ in lụa                        */
/* -------------------------------------------------------------------------- */

/** Điểm ảnh trên mỗi đơn vị thế giới của texture PCB (giới hạn 2048px chiều rộng) */
const PCB_PX_PER_WORLD = 256;
/** 1mm quy ra đơn vị thế giới (1u = 19.05mm = 0.38) */
const MM = 0.38 / 19.05;

export interface PcbSwitch {
  /** Tâm switch (x, z) trong toạ độ PCB, gốc ở tâm bo mạch */
  x: number;
  z: number;
}

export interface PcbTextures {
  /** Màu: phủ xanh solder mask, mạch đồng, pad vàng, chữ trắng */
  map: THREE.CanvasTexture;
  /** R độ cao (bumpMap), G độ nhám (roughnessMap), B kim loại (metalnessMap) */
  data: THREE.CanvasTexture;
}

/**
 * Chân hàn footprint MX 5-pin (mm, nhìn từ trên, z dương là phía người gõ):
 * 2 chân đồng ở (−3.81, −2.54) và (2.54, −5.08), trụ giữa (0, 0), 2 chân nhựa (±5.08, 0), LED (0, +4.7).
 */
export const MX_FOOTPRINT: {
  pins: [number, number][];
  pegs: [number, number][];
  led: [number, number];
  diode: [number, number];
} = {
  pins: [
    [-3.81, -2.54],
    [2.54, -5.08],
  ],
  pegs: [
    [-5.08, 0],
    [5.08, 0],
  ],
  led: [0, 4.7],
  diode: [5.6, 4.2],
};

/** Solder mask xanh lá kinh điển, dùng khi build chưa có màu PCB thật */
export const DEFAULT_PCB_MASK = '#0e3b28';

/**
 * Bảng màu bo mạch suy ra từ màu solder mask:
 * - đường đồng dưới lớp phủ: sáng hơn mask một chút (mask tối) hoặc tối hơn (mask sáng)
 * - chữ in lụa: trắng trên mask tối, đen trên mask trắng (như PCB trắng AULA thật)
 */
export const pcbPalette = (mask: string): { mask: string; trace: string; silk: string } => {
  const base = new THREE.Color(mask);
  const hsl = { h: 0, s: 0, l: 0 };
  // Tính trong không gian sRGB (cảm nhận mắt người), không phải linear
  base.getHSL(hsl, THREE.SRGBColorSpace);
  const isLight = hsl.l > 0.5;
  const trace = new THREE.Color().setHSL(
    hsl.h,
    hsl.s,
    isLight ? hsl.l - 0.07 : Math.min(1, hsl.l + 0.1),
    THREE.SRGBColorSpace
  );
  return {
    mask: `#${base.getHexString()}`,
    trace: `#${trace.getHexString()}`,
    silk: isLight ? '#2a2a2c' : '#e8ece9',
  };
};

export const getPcbTextures = (
  key: string,
  width: number,
  depth: number,
  switches: PcbSwitch[],
  maskColor: string = DEFAULT_PCB_MASK
): PcbTextures | null => {
  const palette = pcbPalette(maskColor);
  const cacheKey = `pcb:${key}:${palette.mask}:${width.toFixed(3)}x${depth.toFixed(3)}`;
  const mapKey = `${cacheKey}:map`;
  const dataKey = `${cacheKey}:data`;
  if (cache.has(mapKey)) {
    const map = cache.get(mapKey);
    const data = cache.get(dataKey);
    return map && data ? { map, data } : null;
  }

  const scale = Math.min(PCB_PX_PER_WORLD, 2048 / width);
  const w = Math.round(width * scale);
  const h = Math.round(depth * scale);
  const color = createCanvas(w, h);
  const data = createCanvas(w, h);
  if (!color || !data) {
    cache.set(mapKey, null);
    cache.set(dataKey, null);
    return null;
  }

  // Toạ độ bo mạch (gốc ở tâm) → điểm ảnh. Texture của BoxGeometry: mép trên ảnh là phía sau (z âm).
  const px = (x: number) => (x + width / 2) * scale;
  const pz = (z: number) => (z + depth / 2) * scale;
  const mm = MM * scale;

  // Hai canvas vẽ song song cùng hình: một bản màu, một bản dữ liệu (R cao, G nhám, B kim loại)
  const both = (draw: (ctx: CanvasRenderingContext2D, isData: boolean) => void) => {
    draw(color.ctx, false);
    draw(data.ctx, true);
  };

  both((ctx, isData) => {
    ctx.fillStyle = isData ? 'rgb(70, 120, 0)' : palette.mask;
    ctx.fillRect(0, 0, w, h);
  });

  // Mạch đồng dưới lớp phủ: ngang theo hàng, dọc theo cột (ma trận phím)
  const rows = [...new Set(switches.map((s) => s.z.toFixed(3)))].map(Number);
  const cols = [...new Set(switches.map((s) => s.x.toFixed(2)))].map(Number);
  both((ctx, isData) => {
    ctx.strokeStyle = isData ? 'rgb(150, 105, 40)' : palette.trace;
    ctx.lineWidth = Math.max(1, 0.45 * mm);
    rows.forEach((z) => {
      ctx.beginPath();
      ctx.moveTo(px(-width / 2 + 0.05), pz(z + 6.5 * MM));
      ctx.lineTo(px(width / 2 - 0.05), pz(z + 6.5 * MM));
      ctx.stroke();
    });
    cols.forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(px(x - 7 * MM), pz(-depth / 2 + 0.04));
      ctx.lineTo(px(x - 7 * MM), pz(depth / 2 - 0.04));
      ctx.stroke();
    });
  });

  const random = seededRandom(97);
  switches.forEach((s, index) => {
    const at = (dx: number, dz: number): [number, number] => [px(s.x + dx * MM), pz(s.z + dz * MM)];
    const circle = (ctx: CanvasRenderingContext2D, [x, y]: [number, number], r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    both((ctx, isData) => {
      // Pad vàng ENIG quanh 2 chân đồng: nhẵn (nhám thấp), kim loại, nhô lên
      ctx.fillStyle = isData ? 'rgb(185, 55, 255)' : '#d9b24c';
      MX_FOOTPRINT.pins.forEach(([dx, dz]) => circle(ctx, at(dx, dz), 1.25 * mm));
      // Lỗ khoan: tối, sâu
      ctx.fillStyle = isData ? 'rgb(0, 200, 0)' : '#05110b';
      MX_FOOTPRINT.pins.forEach(([dx, dz]) => circle(ctx, at(dx, dz), 0.75 * mm));
      circle(ctx, at(0, 0), 2.0 * mm);
      MX_FOOTPRINT.pegs.forEach(([dx, dz]) => circle(ctx, at(dx, dz), 0.9 * mm));

      // Pad LED SMD phía nam và diode SMD
      ctx.fillStyle = isData ? 'rgb(170, 60, 255)' : '#d9b24c';
      const [lx, ly] = at(MX_FOOTPRINT.led[0], MX_FOOTPRINT.led[1]);
      ctx.fillRect(lx - 2.6 * mm, ly - 0.9 * mm, 1.4 * mm, 1.8 * mm);
      ctx.fillRect(lx + 1.2 * mm, ly - 0.9 * mm, 1.4 * mm, 1.8 * mm);
      const [dx, dy] = at(MX_FOOTPRINT.diode[0], MX_FOOTPRINT.diode[1]);
      ctx.fillRect(dx - 1.6 * mm, dy - 0.6 * mm, 0.9 * mm, 1.2 * mm);
      ctx.fillRect(dx + 0.7 * mm, dy - 0.6 * mm, 0.9 * mm, 1.2 * mm);
      ctx.fillStyle = isData ? 'rgb(150, 160, 0)' : '#141414';
      ctx.fillRect(dx - 0.7 * mm, dy - 0.7 * mm, 1.4 * mm, 1.4 * mm);

      // Via: vòng đồng nhỏ rải ngẫu nhiên quanh switch
      ctx.fillStyle = isData ? 'rgb(170, 70, 230)' : '#c7a24a';
      for (let v = 0; v < 2; v++) circle(ctx, at(-7 + random() * 14, 7 + random() * 1.5), 0.45 * mm);

      // Chữ in lụa: SWn / Dn
      ctx.fillStyle = isData ? 'rgb(110, 200, 0)' : palette.silk;
      ctx.font = `600 ${Math.max(6, Math.round(1.7 * mm))}px Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      const [sx, sy] = at(-6.8, 6.6);
      ctx.fillText(`SW${index + 1}`, sx, sy);
      const [tx, ty] = at(3.4, 6.6);
      ctx.fillText(`D${index + 1}`, tx, ty);
    });
  });

  // Tên bo mạch ở mép sau
  both((ctx, isData) => {
    ctx.fillStyle = isData ? 'rgb(110, 200, 0)' : palette.silk;
    ctx.font = `700 ${Math.max(10, Math.round(3.2 * mm))}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText('KEYCRAFT-PCB REV 2.0', px(-width / 2 + 0.06), pz(-depth / 2) + 0.6 * mm);
  });

  const map = toTexture(color.canvas, true);
  const dataTexture = toTexture(data.canvas, false);
  cache.set(mapKey, map);
  cache.set(dataKey, dataTexture);
  return { map, data: dataTexture };
};
