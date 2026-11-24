/**
 * Xuất thông số hình học keycap 1u (mọi profile × hàng) từ code web sang JSON cho Blender đọc.
 * Blender dựng mặt phím bằng ĐÚNG công thức `keycapSurfaceY` này, nên chữ in / gờ F-J trên web
 * (đặt theo công thức) nằm khít lên model .glb.
 *
 *   npx tsx scripts/models/export-keycap-specs.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISH_DEPTH, KEY_UNIT, getKeycapShape } from '../../src/components/canvas/geometry/keyboardGeometry';
import { KEYCAP_PROFILES } from '../../src/types/keyboard';

const ROWS = [1, 2, 3, 4] as const;

const specs = KEYCAP_PROFILES.flatMap((profile) =>
  ROWS.map((row) => {
    const shape = getKeycapShape(1, row, profile);
    return {
      name: `keycap_${profile}_r${row}`,
      bottomWidth: shape.bottomWidth,
      bottomDepth: shape.bottomDepth,
      topWidth: shape.topWidth,
      topDepth: shape.topDepth,
      height: shape.height,
      tilt: shape.tilt,
      dish: shape.dish,
      cornerBottom: shape.cornerBottom,
      cornerTop: shape.cornerTop,
    };
  })
);

const out = join(process.cwd(), 'scripts', 'models', 'keycap-specs.json');
writeFileSync(
  out,
  JSON.stringify({ keyUnit: KEY_UNIT, mm: KEY_UNIT / 19.05, dishDepth: DISH_DEPTH, keycaps: specs }, null, 2)
);
console.log(`${specs.length} keycap -> ${out}`);
