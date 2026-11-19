/**
 * Thống kê nhanh trên bản thu gốc (cache của `npm run sounds`): mỗi video có bao nhiêu tiếng gõ
 * bị lẫn giọng nói / tiếng bíp — đo trên chính đoạn cắt và trên 150ms ngay trước tiếng gõ.
 *
 *   npx tsx scripts/sounds/audit-sources.ts [--only id1,id2]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectOnsets, extractClips, MAX_HARMONICITY } from '../../src/lib/audio/slicer';

const SR = 48000;
const CACHE = join(tmpdir(), 'keycraft-sounds');

interface Source {
  id: string;
  url: string;
  start?: number;
  end?: number;
}

const decode = (file: string, start?: number, end?: number): Float32Array => {
  const raw = join(CACHE, 'audit.f32');
  const args = ['-y', '-v', 'error'];
  if (start !== undefined) args.push('-ss', String(start));
  if (end !== undefined) args.push('-to', String(end));
  args.push('-i', file, '-ac', '1', '-ar', String(SR), '-af', 'highpass=f=40', '-f', 'f32le', raw);
  const result = spawnSync('ffmpeg', args, { stdio: 'ignore' });
  if (result.status !== 0) throw new Error('ffmpeg lỗi');
  const buffer = readFileSync(raw);
  return new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const sources = (JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'sounds', 'sources.json'), 'utf8')) as Source[]).filter(
  (s) => !only || only.includes(s.id)
);

for (const source of sources) {
  const key = source.url.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
  const file = join(CACHE, `${key}.m4a`);
  if (!existsSync(file)) {
    console.log(`${source.id}\t(chưa có trong cache)`);
    continue;
  }
  const samples = decode(file, source.start, source.end);
  const clips = extractClips(samples, detectOnsets(samples, { sampleRate: SR }), { sampleRate: SR });
  const own = clips.filter((c) => c.harmonicity >= MAX_HARMONICITY).length;
  const context = clips.filter((c) => c.contextHarmonicity >= MAX_HARMONICITY).length;
  const pct = (n: number) => `${((n / Math.max(1, clips.length)) * 100).toFixed(0)}%`;
  console.log(`${source.id}\t${clips.length} tiếng\tđuôi ${own} (${pct(own)})\ttrước ${context} (${pct(context)})`);
}
