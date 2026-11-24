/**
 * Dựng lại toàn bộ model 3D bằng Blender (không cần mở giao diện Blender):
 *
 *   npm run models            # keycap + vỏ + switch
 *   npm run models -- case    # chỉ dựng vỏ (keycaps | case | switch)
 *
 * 1. Xuất thông số từ code web (scripts/models/*.json)
 * 2. Chạy Blender nền với từng script Python -> public/models/*.glb
 *
 * Tìm Blender theo thứ tự: biến môi trường BLENDER_PATH -> bản portable trong
 * %LOCALAPPDATA%/keycraft-tools -> lệnh `blender` trong PATH.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const MODELS = {
  keycaps: { script: 'build_keycaps.py', spec: 'keycap-specs.json', out: 'keycaps.glb', tag: '[keycaps]' },
  case: { script: 'build_case.py', spec: 'case-template.json', out: 'case.glb', tag: '[case]' },
  switch: { script: 'build_switch.py', spec: 'switch-specs.json', out: 'switch.glb', tag: '[switch]' },
} as const;
type ModelName = keyof typeof MODELS;

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

const requested = process.argv.slice(2).filter((arg): arg is ModelName => arg in MODELS);
const targets: ModelName[] = requested.length > 0 ? requested : ['keycaps', 'case', 'switch'];

execFileSync(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'scripts/models/export-specs.ts'], {
  stdio: 'inherit',
});

const blender = findBlender();
let failed = false;
for (const name of targets) {
  const model = MODELS[name];
  const result = spawnSync(
    blender,
    [
      '-b',
      '--factory-startup',
      '-P',
      `scripts/models/${model.script}`,
      '--',
      `scripts/models/${model.spec}`,
      `public/models/${model.out}`,
    ],
    { encoding: 'utf8' }
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const summary = output.split('\n').find((line) => line.includes(model.tag));
  if (result.status !== 0 || !summary) {
    failed = true;
    console.error(output.slice(-3000));
    console.error(
      result.error
        ? `Không chạy được Blender (${blender}). Đặt BLENDER_PATH tới blender.exe hoặc cài Blender 4.2 LTS.`
        : `Blender báo lỗi khi dựng ${name}.`
    );
    continue;
  }
  console.log(summary.trim());
}
if (failed) process.exit(1);
