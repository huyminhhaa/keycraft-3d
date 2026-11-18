import { z } from 'zod';
import { SHELL_STYLES } from '@/types/keyboard';

/**
 * Danh mục build phím thật (kiểu "sound profile" của các shop): mỗi build gồm
 *  - thông số linh kiện thật (tra từ trang hãng/shop/review, chỗ nào nguồn mâu thuẫn thì ghi rõ),
 *  - gói tiếng thu từ chính build đó (public/sounds/<soundPackId>, tạo bằng `npm run sounds`),
 *  - ảnh thật (public/builds/<id>.jpg, thumbnail video sound test),
 *  - cách dựng 3D: layout, màu lấy theo ảnh, chất liệu, dáng vỏ đặc trưng (shellStyle), profile keycap,
 *  - tuỳ chọn modelUrl: file .glb thật trong public/models/ (thiếu hoặc lỗi thì dựng bằng code).
 * Thiếu ảnh/tiếng thì thẻ vẫn hiện, chỉ không có ảnh/tiếng.
 */

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const buildSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Tên bàn phím */
  name: z.string().min(1),
  /** Đặc điểm nổi bật ngắn: kiểu mount, switch đặc biệt… */
  tags: z.array(z.string()).max(3),
  soundPackId: z.string(),
  /** Video gốc của bản thu */
  sourceUrl: z.string().url(),
  /** File .glb thật (public/models/…) thay cho bản dựng bằng code */
  modelUrl: z
    .string()
    .regex(/^\/models\/[\w.-]+\.glb$/, 'modelUrl phải có dạng /models/<ten-file>.glb')
    .optional(),
  specs: z.object({
    case: z.string(),
    mount: z.string(),
    plate: z.string(),
    foam: z.string(),
    switch: z.string(),
    keycap: z.string(),
  }),
  look: z.object({
    layout: z.enum(['65%', '75%', 'TKL', '96%']),
    caseMaterial: z.enum(['aluminum', 'plastic', 'polycarbonate', 'wood', 'acrylic']),
    caseColor: hex,
    keycapColor: hex,
    keycapModifierColor: hex,
    keycapAccentColor: hex,
    plateMaterial: z.enum(['aluminum', 'polycarbonate', 'pom', 'fr4']),
    switchType: z.enum(['linear', 'tactile', 'clicky', 'silent_linear']),
    caseShape: z.object({
      bezel: z.number().min(0.08).max(0.4),
      cornerRadius: z.number().min(0.02).max(0.3),
      knob: z.boolean(),
    }),
    shellStyle: z.enum(SHELL_STYLES).default('default'),
    keycapProfile: z.enum(['cherry', 'moa']).default('cherry'),
    /** Màu switch thật, lấy theo ảnh sản phẩm/review; không tra được thì bỏ trống (dùng màu mặc định) */
    switchColors: z
      .object({ top: hex, bottom: hex, stem: hex, topOpacity: z.number().min(0.1).max(1) })
      .optional(),
    /** Màu solder mask PCB thật (theo video tháo máy); bỏ trống = xanh lá mặc định */
    pcbColor: hex.optional(),
    /** Màu foam plate thật (theo video tháo máy); bỏ trống = Poron xám than mặc định */
    foamColor: hex.optional(),
  }),
});

/* Màu PCB và foam soi từ storyboard video tháo máy trên YouTube */
const PCB = { black: '#1b1c1f', white: '#ecebe6' } as const;
const FOAM = {
  white: '#e9e8e2',
  black: '#222326',
  beige: '#cdb48c',
  tan: '#b88d62',
} as const;

/* Màu switch theo ảnh thật (kbd.news, Kinetic Labs, thumbnail video review switch) */
const SWITCH_COLORS = {
  reaper: { top: '#f1f1ec', bottom: '#f3f3ef', stem: '#9bd84a', topOpacity: 0.6 },
  vertexV1: { top: '#1f1f23', bottom: '#1a1a1d', stem: '#6c4ed8', topOpacity: 0.95 },
  husky: { top: '#d8dbe0', bottom: '#4b4e56', stem: '#d2d5da', topOpacity: 0.6 },
  turtle: { top: '#1e1e20', bottom: '#1b1b1d', stem: '#232326', topOpacity: 0.95 },
  outemuJade: { top: '#eef3f4', bottom: '#e6eef0', stem: '#f6f6f3', topOpacity: 0.3 },
  cocoa: { top: '#efe4cd', bottom: '#ece0c8', stem: '#6b3a24', topOpacity: 0.97 },
  jupiterBanana: { top: '#f4f4f0', bottom: '#f3f2ec', stem: '#e8e690', topOpacity: 0.3 },
  morandi: { top: '#eef0f7', bottom: '#eceef6', stem: '#f2f3f8', topOpacity: 0.92 },
  lekkerL45: { top: '#eef2f2', bottom: '#e8eeee', stem: '#f2c94c', topOpacity: 0.3 },
  sunsetGleam: { top: '#f4f2ec', bottom: '#d9762e', stem: '#f0c92a', topOpacity: 0.92 },
  // Akko V3 Piano Pro bản gốc màu đen (bản đặc biệt mới màu trắng)
  pianoPro: { top: '#27272a', bottom: '#1e1e21', stem: '#2c2c30', topOpacity: 0.95 },
  // Theo ảnh sản phẩm (Google/Bing Images, ảnh chủ dự án gửi)
  iceVein: { top: '#93d6cd', bottom: '#8acfc6', stem: '#f3f5f5', topOpacity: 0.92 },
  asura: { top: '#7466c9', bottom: '#6253b8', stem: '#5c48b3', topOpacity: 0.55 },
  turquoise: { top: '#f3f3f0', bottom: '#1fb3c4', stem: '#23b7c6', topOpacity: 0.92 },
  creamyYellowU1: { top: '#f3d77c', bottom: '#eccc65', stem: '#f4ecd4', topOpacity: 0.95 },
  princess: { top: '#ecc9d8', bottom: '#a493d3', stem: '#9a86d5', topOpacity: 0.7 },
  raspberry: { top: '#ec7a70', bottom: '#df675f', stem: '#f08b82', topOpacity: 0.9 },
  xinhai: { top: '#f3f3f1', bottom: '#2c3f75', stem: '#2f4ba3', topOpacity: 0.95 },
  doubleRailNebula: { top: '#eef0f2', bottom: '#e9ecee', stem: '#8b5bd8', topOpacity: 0.3 },
} as const;

export type KeyboardBuild = z.infer<typeof buildSchema>;

export const buildPhotoUrl = (build: Pick<KeyboardBuild, 'id'>): string => `/builds/${build.id}.jpg`;

const AULA_F75_SPECS = {
  case: 'Nhựa ABS',
  mount: 'Gasket mount',
  plate: 'PC flex-cut',
  foam: '5 lớp: 2 Poron, IXPE, PET, silicone đáy',
};

const F75_SHAPE = { bezel: 0.2, cornerRadius: 0.18, knob: true };

const LUCKY65_SPECS = {
  case: 'Nhôm CNC 6063',
  mount: 'Gasket mount (đệm silicone)',
  plate: 'FR4 1.2mm flex-cut',
  foam: '5 lớp: foam plate, IXPE, PET, foam PCB',
};

const LUCKY65_SHAPE = { bezel: 0.26, cornerRadius: 0.12, knob: false };

const BUILD_LIST: z.input<typeof buildSchema>[] = [
  {
    id: 'aula-f75-reaper',
    name: 'AULA F75',
    tags: ['Gasket', 'Stock'],
    soundPackId: 'aula-f75-reaper',
    sourceUrl: 'https://www.youtube.com/watch?v=efs36WEdby0',
    specs: { ...AULA_F75_SPECS, switch: 'Leobog Reaper (linear)', keycap: 'PBT Double Shot, profile Cherry' },
    look: {
      layout: '75%',
      caseMaterial: 'plastic',
      caseColor: '#e4e7ec',
      keycapColor: '#e3eaf4',
      keycapModifierColor: '#93b2da',
      keycapAccentColor: '#4f78b5',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.reaper,
      pcbColor: PCB.white,
      foamColor: FOAM.white,
      caseShape: F75_SHAPE,
      shellStyle: 'aula',
    },
  },
  {
    id: 'aula-f75-ice-vein',
    name: 'AULA F75',
    tags: ['Gasket', 'Stock'],
    soundPackId: 'aula-f75-ice-vein',
    sourceUrl: 'https://www.youtube.com/watch?v=AUa1SIhlNVE',
    specs: { ...AULA_F75_SPECS, switch: 'Leobog Ice Vein (linear)', keycap: 'PBT Double Shot, profile Cherry' },
    look: {
      layout: '75%',
      caseMaterial: 'plastic',
      caseColor: '#eef0f3',
      keycapColor: '#f2f3f5',
      keycapModifierColor: '#a8bcdc',
      keycapAccentColor: '#2f4a7c',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.iceVein,
      pcbColor: PCB.white,
      foamColor: FOAM.white,
      caseShape: F75_SHAPE,
      shellStyle: 'aula',
    },
  },
  {
    id: 'aula-f99-asura',
    name: 'AULA F99 Pro',
    tags: ['Gasket', '96%'],
    soundPackId: 'aula-f99-asura',
    sourceUrl: 'https://www.youtube.com/watch?v=sSSM0Z2B8ro',
    specs: {
      case: 'Nhựa ABS',
      mount: 'Gasket mount',
      plate: 'PC',
      foam: '5 lớp: sandwich, IXPE, PET, foam đáy, silicone',
      switch: 'KBDiy Asura',
      keycap: 'Theo máy',
    },
    look: {
      layout: '96%',
      caseMaterial: 'plastic',
      caseColor: '#3a3d42',
      keycapColor: '#cfc7b6',
      keycapModifierColor: '#4b4f56',
      keycapAccentColor: '#8e949c',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.asura,
      pcbColor: PCB.white,
      foamColor: FOAM.white,
      caseShape: { bezel: 0.18, cornerRadius: 0.16, knob: true },
      shellStyle: 'aula',
    },
  },
  {
    id: 'leobog-hi75-vertex',
    name: 'Leobog Hi75',
    tags: ['Nhôm', 'Gasket', 'MOA'],
    soundPackId: 'leobog-hi75-vertex',
    sourceUrl: 'https://www.youtube.com/watch?v=bbe4xUERQ08',
    specs: {
      case: 'Nhôm sơn tĩnh điện',
      mount: 'Gasket mount (đệm Poron)',
      plate: 'PP',
      foam: 'PO foam, IXPE, PO đáy, PET',
      switch: 'Vertex V1',
      keycap: 'MOA',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#b5a8d4',
      keycapColor: '#f0ebf6',
      keycapModifierColor: '#b7a2df',
      keycapAccentColor: '#e3a0b6',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.vertexV1,
      pcbColor: PCB.black,
      foamColor: FOAM.black,
      caseShape: { bezel: 0.3, cornerRadius: 0.06, knob: false },
      shellStyle: 'hi75',
      keycapProfile: 'moa',
    },
  },
  {
    id: 'leobog-hi75c-pro',
    name: 'Leobog Hi75C Pro',
    tags: ['Nhôm', 'Gasket', 'Stock'],
    soundPackId: 'leobog-hi75c-pro',
    sourceUrl: 'https://www.youtube.com/watch?v=3GoVzlVMlMw',
    specs: {
      case: 'Nhôm',
      mount: 'Gasket mount',
      plate: 'PC flex-cut',
      foam: 'PO foam, IXPE, PET',
      switch: 'Turquoise (linear)',
      keycap: 'Theo máy',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#e8e3d8',
      keycapColor: '#efe6d5',
      keycapModifierColor: '#b99b72',
      keycapAccentColor: '#7a5c3c',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.turquoise,
      foamColor: FOAM.black,
      caseShape: { bezel: 0.28, cornerRadius: 0.06, knob: true },
      shellStyle: 'hi75',
    },
  },
  {
    id: 'lucky65-creamy-yellow',
    name: 'Weikav Lucky65 V2',
    tags: ['Nhôm', 'Gasket'],
    soundPackId: 'lucky65-creamy-yellow',
    sourceUrl: 'https://www.youtube.com/watch?v=vHPD1t7wCtU',
    specs: { ...LUCKY65_SPECS, switch: 'Akko Creamy Yellow U1 (linear)', keycap: 'Theo máy' },
    look: {
      layout: '65%',
      caseMaterial: 'aluminum',
      caseColor: '#1d1d20',
      keycapColor: '#242427',
      keycapModifierColor: '#2d2d31',
      keycapAccentColor: '#2d2d31',
      plateMaterial: 'fr4',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.creamyYellowU1,
      pcbColor: PCB.black,
      caseShape: LUCKY65_SHAPE,
      shellStyle: 'lucky65',
    },
  },
  {
    id: 'lucky65-husky',
    name: 'Weikav Lucky65 V2',
    tags: ['Nhôm', 'Gasket'],
    soundPackId: 'lucky65-husky',
    sourceUrl: 'https://www.youtube.com/watch?v=8P5YRp5ndgQ',
    specs: { ...LUCKY65_SPECS, switch: 'Kinetic Labs Husky (linear)', keycap: 'Kinetic Labs Apex PBT' },
    look: {
      layout: '65%',
      caseMaterial: 'aluminum',
      caseColor: '#b9bcc1',
      keycapColor: '#e8e8e5',
      keycapModifierColor: '#5e6269',
      keycapAccentColor: '#3d4148',
      plateMaterial: 'fr4',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.husky,
      pcbColor: PCB.black,
      caseShape: LUCKY65_SHAPE,
      shellStyle: 'lucky65',
    },
  },
  {
    id: 'lucky65-turtle-silent',
    name: 'Weikav Lucky65 V2',
    tags: ['Nhôm', 'Silent'],
    soundPackId: 'lucky65-turtle-silent',
    sourceUrl: 'https://www.youtube.com/watch?v=AK7_8pk-35Q',
    specs: { ...LUCKY65_SPECS, switch: 'Kinetic Labs Turtle (silent tactile)', keycap: 'Kinetic Labs Matcha PBT' },
    look: {
      layout: '65%',
      caseMaterial: 'aluminum',
      caseColor: '#e7e8e6',
      keycapColor: '#eef0e7',
      keycapModifierColor: '#91ae7e',
      keycapAccentColor: '#5f7d52',
      plateMaterial: 'fr4',
      switchType: 'tactile',
      switchColors: SWITCH_COLORS.turtle,
      pcbColor: PCB.black,
      caseShape: LUCKY65_SHAPE,
      shellStyle: 'lucky65',
    },
  },
  {
    id: 'attack-shark-x85',
    name: 'Attack Shark X85',
    tags: ['Gasket', 'Stock'],
    soundPackId: 'attack-shark-x85',
    sourceUrl: 'https://www.youtube.com/watch?v=Bk5vONQeJao',
    specs: {
      case: 'Nhựa + nhôm',
      mount: 'Gasket mount',
      plate: 'Nhôm',
      foam: '5 lớp: Poron sandwich, IXPE, PET, foam vỏ, silicone đáy',
      switch: 'Outemu White Jade (linear)',
      keycap: 'PBT',
    },
    look: {
      layout: '75%',
      caseMaterial: 'plastic',
      caseColor: '#2f3135',
      keycapColor: '#e5e5e2',
      keycapModifierColor: '#9b9da1',
      keycapAccentColor: '#5a5d62',
      plateMaterial: 'aluminum',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.outemuJade,
      foamColor: FOAM.white,
      caseShape: { bezel: 0.22, cornerRadius: 0.16, knob: true },
      shellStyle: 'x85',
    },
  },
  /* -------------------------------------------------------------------------- */
  /* Mẫu bổ sung (thông số tra từ trang hãng/shop/review, xem docs/theory/18)    */
  /* -------------------------------------------------------------------------- */
  {
    id: 'wobkey-rainy75-pro',
    name: 'WOBKEY Rainy75 Pro',
    tags: ['Nhôm', 'Gasket'],
    soundPackId: 'wobkey-rainy75-pro',
    sourceUrl: 'https://www.youtube.com/watch?v=Kvb3prJbcBY',
    specs: {
      case: 'Nhôm CNC 6063',
      mount: 'Gasket mount',
      plate: 'FR4',
      foam: 'Poron, IXPE switch pad, PET, đáy EPDM',
      switch: 'Kailh Cocoa (linear, lube sẵn)',
      keycap: 'PBT Double Shot',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#8a1f2e',
      keycapColor: '#f1c9cd',
      keycapModifierColor: '#b6323f',
      keycapAccentColor: '#f3ece4',
      plateMaterial: 'fr4',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.cocoa,
      pcbColor: PCB.black,
      caseShape: { bezel: 0.24, cornerRadius: 0.12, knob: false },
    },
  },
  {
    id: 'wobkey-crush80-pro',
    name: 'WOBKEY Crush 80 Reboot Pro',
    tags: ['Nhôm', 'Ball-catch', '80%'],
    soundPackId: 'wobkey-crush80-pro',
    sourceUrl: 'https://www.youtube.com/watch?v=BiOV_MQJ6Oc',
    specs: {
      case: 'Nhôm CNC đánh bóng, mở nhanh bằng chốt bi',
      mount: 'Gasket mount',
      plate: 'FR4 flex-cut',
      foam: 'Poron plate, IXPE switch pad, foam PCB, Poron vỏ, PET',
      switch: 'Kailh Cocoa (linear, 45g, hành trình 3.6mm)',
      keycap: 'Theo máy',
    },
    look: {
      layout: 'TKL',
      caseMaterial: 'aluminum',
      caseColor: '#1f2a3d',
      keycapColor: '#2c3a52',
      keycapModifierColor: '#9fa6ad',
      keycapAccentColor: '#ece4d0',
      plateMaterial: 'fr4',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.cocoa,
      pcbColor: PCB.black,
      caseShape: { bezel: 0.24, cornerRadius: 0.1, knob: false },
      shellStyle: 'lucky65',
    },
  },
  {
    id: 'bridge75-plus',
    name: 'Shortcut Studio Bridge75 Plus',
    tags: ['Nhôm', 'Ball-catch'],
    soundPackId: 'bridge75-plus',
    sourceUrl: 'https://www.youtube.com/watch?v=0hCFtMQ1KqM',
    specs: {
      case: 'Nhôm CNC, mở bằng chốt bi',
      mount: 'Gasket mount trên PCB',
      plate: 'FR4 flex-cut',
      foam: 'Poron INOAC, IXPE, foam vỏ EPDM, PET',
      switch: 'SC Princess V2 (linear)',
      keycap: 'PBT Double Shot, profile Cherry',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#1c1c1f',
      keycapColor: '#26262a',
      keycapModifierColor: '#303034',
      keycapAccentColor: '#e9dcc0',
      plateMaterial: 'fr4',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.princess,
      pcbColor: PCB.black,
      foamColor: FOAM.beige,
      caseShape: { bezel: 0.24, cornerRadius: 0.1, knob: false },
      shellStyle: 'lucky65',
    },
  },
  {
    id: 'keychron-q1-max',
    name: 'Keychron Q1 Max',
    tags: ['Nhôm', 'Double-gasket', 'Tactile'],
    soundPackId: 'keychron-q1-max',
    sourceUrl: 'https://www.youtube.com/watch?v=9dopQ-n9wFo',
    specs: {
      case: 'Nhôm CNC',
      mount: 'Double-gasket (đệm silicone giữa vỏ trên và dưới)',
      plate: 'PC',
      foam: 'Foam tiêu âm, IXPE, PET, đệm latex, foam đáy vỏ',
      switch: 'Gateron Jupiter Banana (tactile)',
      keycap: 'KSA PBT Double Shot',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#262b33',
      keycapColor: '#eef0f2',
      keycapModifierColor: '#2f3b52',
      keycapAccentColor: '#3fb6a8',
      plateMaterial: 'polycarbonate',
      switchType: 'tactile',
      switchColors: SWITCH_COLORS.jupiterBanana,
      pcbColor: PCB.black,
      caseShape: { bezel: 0.26, cornerRadius: 0.1, knob: true },
      keycapProfile: 'moa',
    },
  },
  {
    id: 'keychron-k2-he-se',
    name: 'Keychron K2 HE Special Edition',
    tags: ['Hall Effect', 'Ốp gỗ'],
    soundPackId: 'keychron-k2-he-se',
    sourceUrl: 'https://www.youtube.com/watch?v=0qNnm-UiKIw',
    specs: {
      case: 'Nhôm + khung, 2 thanh ốp gỗ hồng mộc hai bên hông',
      mount: 'Tray mount',
      plate: 'Nhôm',
      foam: 'Theo máy',
      switch: 'Gateron Double-Rail Magnetic (Hall Effect, kích hoạt 0.2–3.8mm)',
      keycap: 'OSA Double Shot',
    },
    look: {
      layout: '75%',
      caseMaterial: 'plastic',
      caseColor: '#ece9e2',
      keycapColor: '#f3efe8',
      keycapModifierColor: '#e7c4a6',
      keycapAccentColor: '#e39a72',
      plateMaterial: 'aluminum',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.doubleRailNebula,
      pcbColor: PCB.black,
      caseShape: { bezel: 0.2, cornerRadius: 0.12, knob: false },
      shellStyle: 'wood-accent',
    },
  },
  {
    id: 'nuphy-halo75-v2',
    name: 'NuPhy Halo75 V2',
    tags: ['Gasket', 'Halo RGB'],
    soundPackId: 'nuphy-halo75-v2',
    sourceUrl: 'https://www.youtube.com/watch?v=T0xKQYG_aHs',
    specs: {
      case: 'Khung trên nhôm, đáy ABS trong mờ',
      mount: 'Gasket mount trên PCB',
      plate: 'POM',
      foam: 'Foam plate, IXPE switch pad, foam PCB, silicone đáy',
      switch: 'NuPhy Raspberry (linear)',
      keycap: 'Keycap theo máy',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#a9dcc7',
      keycapColor: '#f1f5f1',
      keycapModifierColor: '#bfe5d3',
      keycapAccentColor: '#8fcfb5',
      plateMaterial: 'pom',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.raspberry,
      caseShape: { bezel: 0.18, cornerRadius: 0.18, knob: false },
      shellStyle: 'halo-rgb',
    },
  },
  {
    id: 'zoom75-ee',
    name: 'Meletrix Zoom75',
    tags: ['Nhôm', 'Gasket', 'Màn hình'],
    soundPackId: 'zoom75-ee',
    sourceUrl: 'https://www.youtube.com/watch?v=HmFH3E1xahQ',
    specs: {
      case: 'Nhôm CNC',
      mount: 'Gasket mount',
      plate: 'PC',
      foam: 'Poron đầy đủ',
      switch: 'WS Morandi (lube 205g0)',
      keycap: 'KAT Mizu',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#222326',
      keycapColor: '#cfe0ec',
      keycapModifierColor: '#9fb7cb',
      keycapAccentColor: '#eef3f6',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.morandi,
      pcbColor: PCB.black,
      foamColor: FOAM.tan,
      caseShape: { bezel: 0.24, cornerRadius: 0.1, knob: false },
      // Module góc phải 2U: bản gốc là màn hình LCD; bản EE trong video dùng núm
      shellStyle: 'lcd-75',
    },
  },
  {
    id: 'wooting-80he',
    name: 'Wooting 80HE',
    tags: ['Hall Effect', 'Gasket', '80%'],
    soundPackId: 'wooting-80he',
    sourceUrl: 'https://www.youtube.com/watch?v=7CB89nFIkPU',
    specs: {
      case: 'Nhựa PCR ABS',
      mount: 'Gasket mount, pad silicone sandwich',
      plate: 'PC',
      foam: 'Pad silicone sandwich',
      switch: 'Lekker Linear45 V2 (Hall Effect)',
      keycap: 'Wooting Double Shot PBT xuyên LED',
    },
    look: {
      layout: 'TKL',
      caseMaterial: 'plastic',
      caseColor: '#1f2024',
      keycapColor: '#1c1c1f',
      keycapModifierColor: '#232327',
      keycapAccentColor: '#2b2b30',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.lekkerL45,
      pcbColor: PCB.black,
      caseShape: { bezel: 0.2, cornerRadius: 0.14, knob: false },
    },
  },
  {
    id: 'mode-envoy-pc',
    name: 'Mode Envoy (Polycarbonate)',
    tags: ['PC mờ', 'Block mount'],
    soundPackId: 'mode-envoy-pc',
    sourceUrl: 'https://www.youtube.com/watch?v=ekRfFOoB3zc',
    specs: {
      case: 'Polycarbonate phay CNC, mờ (frosted)',
      mount: 'Lattice block mount',
      plate: 'Nhôm',
      foam: 'Không foam',
      switch: 'HMX Xinhai',
      keycap: 'GMK Oblivion (ABS, profile Cherry)',
    },
    look: {
      layout: '65%',
      caseMaterial: 'polycarbonate',
      caseColor: '#d3cdd1',
      keycapColor: '#2a2a2d',
      keycapModifierColor: '#3a3a3e',
      keycapAccentColor: '#d94f3d',
      plateMaterial: 'aluminum',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.xinhai,
      pcbColor: PCB.white,
      caseShape: { bezel: 0.24, cornerRadius: 0.14, knob: false },
      shellStyle: 'frosted-pc',
    },
  },
  {
    id: 'neo65',
    name: 'Qwertykeys Neo65',
    tags: ['Nhôm', 'O-ring'],
    soundPackId: 'neo65',
    sourceUrl: 'https://www.youtube.com/watch?v=B1tixGFsUT0',
    specs: {
      case: 'Nhôm nguyên khối (unibody)',
      mount: 'Gasket trên PCB hoặc O-ring',
      plate: 'Nhôm',
      foam: 'Không foam',
      switch: 'HMX Sunset Gleam V2',
      keycap: 'Theo máy',
    },
    look: {
      layout: '65%',
      caseMaterial: 'aluminum',
      caseColor: '#2b2b2e',
      keycapColor: '#f1f0ec',
      keycapModifierColor: '#e4e1d9',
      keycapAccentColor: '#c8442f',
      plateMaterial: 'aluminum',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.sunsetGleam,
      pcbColor: PCB.white,
      caseShape: { bezel: 0.26, cornerRadius: 0.12, knob: false },
    },
  },
  {
    id: 'monsgeek-m1w-v3',
    name: 'MonsGeek M1W V3',
    tags: ['Nhôm', 'Gasket', 'Stock'],
    soundPackId: 'monsgeek-m1w-v3',
    sourceUrl: 'https://www.youtube.com/watch?v=cu_Xb6eI03A',
    specs: {
      case: 'Nhôm',
      mount: 'Gasket mount',
      plate: 'PC trong suốt',
      foam: 'Poron plate, foam vỏ',
      switch: 'Akko V3 Piano Pro',
      keycap: 'PBT Double Shot',
    },
    look: {
      layout: '75%',
      caseMaterial: 'aluminum',
      caseColor: '#2a2b2e',
      keycapColor: '#d9dadb',
      keycapModifierColor: '#5c5f64',
      keycapAccentColor: '#9fa3a8',
      plateMaterial: 'polycarbonate',
      switchType: 'linear',
      switchColors: SWITCH_COLORS.pianoPro,
      pcbColor: PCB.black,
      foamColor: FOAM.black,
      caseShape: { bezel: 0.24, cornerRadius: 0.12, knob: false },
    },
  },
];

export const KEYBOARD_BUILDS: KeyboardBuild[] = z
  .array(buildSchema)
  .superRefine((builds, ctx) => {
    const seen = new Set<string>();
    builds.forEach((build, index) => {
      if (seen.has(build.id)) ctx.addIssue({ code: 'custom', message: `id "${build.id}" bị trùng`, path: [index, 'id'] });
      seen.add(build.id);
    });
  })
  .parse(BUILD_LIST);

export const findBuild = (id: string | null): KeyboardBuild | undefined =>
  id ? KEYBOARD_BUILDS.find((build) => build.id === id) : undefined;

/** Lọc thư viện build theo layout và từ khoá (tên phím, switch, tag) */
export const filterBuilds = (
  builds: KeyboardBuild[],
  layout: KeyboardBuild['look']['layout'] | 'all',
  query: string
): KeyboardBuild[] => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return builds.filter((build) => {
    if (layout !== 'all' && build.look.layout !== layout) return false;
    const haystack = [build.name, build.specs.switch, build.specs.case, ...build.tags].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
};
