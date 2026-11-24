/**
 * Dựng lại public/models/keycaps.glb bằng Blender (không cần mở giao diện Blender):
 *
 *   npm run models:keycaps
 *
 * 1. Xuất thông số keycap từ code web (scripts/models/keycap-specs.json)
 * 2. Chạy Blender nền với scripts/models/build_keycaps.py
 *
 * Tìm Blender theo thứ tự: biến môi trường BLENDER_PATH -> bản portable trong
 * %LOCALAPPDATA%/keycraft-tools -> lệnh `blender` trong PATH.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function findBlender(): string {
  if (process.env.BLENDER_PATH && existsSync(process.env.BLENDER_PATH)) return process.env.BLENDER_PATH;
  const tools = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'keycraft-tools') : null;
  if (tools && existsSync(tools)) {
    const dir = readdirSync(tools)
      .filter((name) => name.startsWith('blender-') && statSync(join(tools, name)).isDirectory())
      .sort()
      .pop();
    const exe = dir ? join(tools, dir, process.platform === 'win32' ? 'blender.exe' : 'blender') : null;
    if (exe && existsSync(exe)) return exe;
  }
  return 'blender';
}

execFileSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'scripts/models/export-keycap-specs.ts'], {
  stdio: 'inherit',
});

const blender = findBlender();
const result = spawnSync(
  blender,
  [
    '-b',
    '--factory-startup',
    '-P',
    'scripts/models/build_keycaps.py',
    '--',
    'scripts/models/keycap-specs.json',
    'public/models/keycaps.glb',
  ],
  { encoding: 'utf8' }
);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const summary = output.split('\n').find((line) => line.includes('[keycaps]'));
if (result.status !== 0 || !summary) {
  console.error(output.slice(-3000));
  console.error(
    result.error
      ? `Không chạy được Blender (${blender}). Đặt BLENDER_PATH tới blender.exe hoặc cài Blender 4.2 LTS.`
      : 'Blender báo lỗi khi dựng keycap.'
  );
  process.exit(1);
}
console.log(summary.trim());
