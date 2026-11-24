/**
 * Xuất thông số hình học từ code web sang JSON cho các script Blender đọc:
 *   - keycap-specs.json : keycap 1u mọi profile × hàng (Blender dựng mặt phím bằng ĐÚNG công thức
 *                         `keycapSurfaceY`, nên chữ in / gờ F-J trên web nằm khít model)
 *   - case-template.json: vỏ mẫu (CASE_TEMPLATE) — web nắn vỏ mẫu theo cùng bộ số này
 *   - switch-specs.json : kích thước switch MX (mm) + vị trí chân, đèn LED
 *
 *   npx tsx scripts/models/export-specs.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISH_DEPTH, KEY_UNIT, getKeycapShape } from '../../src/components/canvas/geometry/keyboardGeometry';
import { CASE_TEMPLATE } from '../../src/components/canvas/geometry/caseModel';
import { MX_FOOTPRINT } from '../../src/components/canvas/geometry/proceduralTextures';
import { PLATE_TO_PCB, STEM_TOP, TOP_HOUSING_HEIGHT } from '../../src/components/canvas/geometry/switchGeometry';
import { KEYCAP_PROFILES } from '../../src/types/keyboard';

const ROWS = [1, 2, 3, 4] as const;
const MM = KEY_UNIT / 19.05;
const dir = join(process.cwd(), 'scripts', 'models');
const write = (name: string, data: unknown) => writeFileSync(join(dir, name), JSON.stringify(data, null, 2));

const keycaps = KEYCAP_PROFILES.flatMap((profile) =>
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
write('keycap-specs.json', { keyUnit: KEY_UNIT, mm: MM, dishDepth: DISH_DEPTH, keycaps });
write('case-template.json', CASE_TEMPLATE);
write('switch-specs.json', {
  mm: MM,
  plateToPcbMm: PLATE_TO_PCB / MM,
  topHousingHeightMm: TOP_HOUSING_HEIGHT / MM,
  stemTopMm: STEM_TOP / MM,
  pegsMm: MX_FOOTPRINT.pegs,
});

console.log(`${keycaps.length} keycap, vỏ mẫu, switch -> scripts/models/*.json`);
