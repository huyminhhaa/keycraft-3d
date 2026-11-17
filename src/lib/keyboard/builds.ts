import { z } from 'zod';

/**
 * Danh mục build phím thật (kiểu "sound profile" của các shop): mỗi build gồm
 *  - thông số linh kiện thật (tra từ trang hãng/shop/review, chỗ nào nguồn mâu thuẫn thì ghi rõ),
 *  - gói tiếng thu từ chính build đó (public/sounds/<soundPackId>, tạo bằng `npm run sounds`),
 *  - ảnh thật (public/builds/<id>.jpg, thumbnail video sound test),
 *  - cách dựng 3D: layout, màu lấy theo ảnh, chất liệu, dáng vỏ.
 * Ảnh và tiếng không nằm trong git; thiếu thì thẻ vẫn hiện, chỉ không có ảnh/tiếng.
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
  }),
});

export type KeyboardBuild = z.infer<typeof buildSchema>;

export const buildPhotoUrl = (build: Pick<KeyboardBuild, 'id'>): string => `/builds/${build.id}.jpg`;

const AULA_F75_SPECS = {
  case: 'Nhựa ABS',
  mount: 'Gasket mount',
  plate: 'PC flex-cut (theo bản F75 Max/Ultra)',
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
      caseShape: F75_SHAPE,
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
      caseShape: F75_SHAPE,
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
      switch: 'KBDiy Asura (chưa xác minh loại)',
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
      caseShape: { bezel: 0.18, cornerRadius: 0.16, knob: true },
    },
  },
  {
    id: 'leobog-hi75-vertex',
    name: 'Leobog Hi75',
    tags: ['Nhôm', 'Gasket'],
    soundPackId: 'leobog-hi75-vertex',
    sourceUrl: 'https://www.youtube.com/watch?v=bbe4xUERQ08',
    specs: {
      case: 'Nhôm sơn tĩnh điện',
      mount: 'Gasket mount (đệm Poron)',
      plate: 'PC flex-cut (có nguồn ghi PP)',
      foam: 'PO foam, IXPE, PO đáy, PET (tuỳ bản)',
      switch: 'Vertex V1 (chưa xác minh loại)',
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
      caseShape: { bezel: 0.3, cornerRadius: 0.08, knob: false },
    },
  },
  {
    id: 'leobog-hi75c-pro',
    name: 'Leobog Hi75C Pro',
    tags: ['Nhôm', 'Gasket', 'Stock'],
    soundPackId: 'leobog-hi75c-pro',
    sourceUrl: 'https://www.youtube.com/watch?v=3GoVzlVMlMw',
    specs: {
      case: 'Nhôm (có nguồn ghi nhựa, tuỳ bản)',
      mount: 'Gasket mount',
      plate: 'PC flex-cut (có nguồn ghi PP)',
      foam: 'Chưa rõ (bản Hi75C: PO, IXPE, PET)',
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
      caseShape: { bezel: 0.28, cornerRadius: 0.08, knob: true },
    },
  },
  {
    id: 'lucky65-creamy-yellow',
    name: 'Weikav Lucky65 V2',
    tags: ['Nhôm', 'Gasket'],
    soundPackId: 'lucky65-creamy-yellow',
    sourceUrl: 'https://www.youtube.com/watch?v=vHPD1t7wCtU',
    specs: { ...LUCKY65_SPECS, switch: 'Akko Creamy Yellow U1 (linear)', keycap: 'Không ghi trong video' },
    look: {
      layout: '65%',
      caseMaterial: 'aluminum',
      caseColor: '#1d1d20',
      keycapColor: '#242427',
      keycapModifierColor: '#2d2d31',
      keycapAccentColor: '#2d2d31',
      plateMaterial: 'fr4',
      switchType: 'linear',
      caseShape: LUCKY65_SHAPE,
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
      caseShape: LUCKY65_SHAPE,
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
      caseShape: LUCKY65_SHAPE,
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
      plate: 'Nhôm (theo review, hãng không ghi)',
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
      caseShape: { bezel: 0.22, cornerRadius: 0.16, knob: true },
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
