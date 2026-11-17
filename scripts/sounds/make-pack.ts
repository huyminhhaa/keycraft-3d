/**
 * Tạo gói âm thanh thật từ video sound test.
 *
 *   npm run sounds                       # tạo lại mọi gói trong scripts/sounds/sources.json
 *   npm run sounds -- --only aula-f75-reaper
 *   npm run sounds -- --id my-board --name "Tên phím" --switch "Tên switch" --url <link> [--start 5 --end 40] [--space 12-18,30-33]
 *
 * Cần yt-dlp và ffmpeg trong PATH. Kết quả: public/sounds/<id>/*.wav + pack.json, và public/sounds/index.json.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectOnsets,
  encodeWav,
  extractClips,
  packGain,
  percentile,
  renderClip,
  selectClips,
  type Clip,
} from '../../src/lib/audio/slicer';
import { packIndexSchema, packManifestSchema, type PackManifest, type PackSummary } from '../../src/lib/audio/soundPacks';

const SAMPLE_RATE = 48000;
const OUT_ROOT = join(process.cwd(), 'public', 'sounds');
const CACHE = join(tmpdir(), 'keycraft-sounds');

interface Source {
  id: string;
  name: string;
  switch: string;
  url: string;
  start?: number;
  end?: number;
  /** Khoảng thời gian (giây, tính từ `start`) chỉ gõ phím cách */
  space?: [number, number][];
}

const run = (command: string, args: string[]): void => {
  const result = spawnSync(command, args, { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} lỗi: ${result.stderr?.slice(-600) ?? result.error?.message}`);
};

const download = (url: string): string => {
  mkdirSync(CACHE, { recursive: true });
  const key = url.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
  const file = join(CACHE, `${key}.m4a`);
  if (!existsSync(file)) run('yt-dlp', ['-q', '--no-warnings', '-f', 'bestaudio[ext=m4a]/bestaudio', '-o', file, url]);
  return file;
};

/** Giải mã về PCM float 32-bit mono 48kHz, cắt theo start/end, lọc bỏ tiếng ù dưới 40Hz. */
const decode = (file: string, start?: number, end?: number): Float32Array => {
  const raw = join(CACHE, 'decode.f32');
  const args = ['-y', '-v', 'error'];
  if (start !== undefined) args.push('-ss', String(start));
  if (end !== undefined) args.push('-to', String(end));
  args.push('-i', file, '-ac', '1', '-ar', String(SAMPLE_RATE), '-af', 'highpass=f=40', '-f', 'f32le', raw);
  run('ffmpeg', args);
  const buffer = readFileSync(raw);
  return new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
};

const makePack = (source: Source): PackManifest => {
  const samples = decode(download(source.url), source.start, source.end);
  const onsets = detectOnsets(samples, { sampleRate: SAMPLE_RATE });
  const clips = extractClips(samples, onsets, { sampleRate: SAMPLE_RATE });
  const selection = selectClips(clips, { sampleRate: SAMPLE_RATE, spaceRanges: source.space });
  if (selection.alpha.length < 4) throw new Error(`chỉ tìm được ${selection.alpha.length} tiếng gõ sạch (cần ≥ 4)`);

  const dir = join(OUT_ROOT, source.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const gain = packGain(selection);
  const write = (category: string, list: Clip[]) =>
    list.map((clip, i) => {
      const name = `${category}-${String(i + 1).padStart(2, '0')}.wav`;
      writeFileSync(join(dir, name), encodeWav(renderClip(samples, clip, gain, SAMPLE_RATE), SAMPLE_RATE));
      return name;
    });

  const manifest = packManifestSchema.parse({
    id: source.id,
    name: source.name,
    switch: source.switch,
    sourceUrl: source.url,
    noise: Number(percentile(selection.alpha.map((c) => c.preNoise), 0.5).toFixed(4)),
    clips: { alpha: write('alpha', selection.alpha), space: write('space', selection.space), up: write('up', selection.up) },
  });
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `✓ ${source.id}: ${onsets.length} tiếng gõ → ${selection.alpha.length} phím thường, ${selection.space.length} phím cách, ${selection.up.length} tiếng nhả`
  );
  return manifest;
};

/** Danh sách gói hiện có (đọc lại từ đĩa để gói tạo trước đó vẫn còn trong danh sách). */
const writeIndex = (): PackSummary[] => {
  const packs = readdirSync(OUT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(OUT_ROOT, entry.name, 'pack.json')))
    .map((entry) => packManifestSchema.parse(JSON.parse(readFileSync(join(OUT_ROOT, entry.name, 'pack.json'), 'utf8'))))
    .map(({ id, name, switch: sw, noise }) => ({ id, name, switch: sw, noise }));
  writeFileSync(join(OUT_ROOT, 'index.json'), JSON.stringify(packIndexSchema.parse(packs), null, 2));
  return packs;
};

const parseArgs = (argv: string[]): Record<string, string> => {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? 'true' : argv[++i];
  }
  return args;
};

const parseRanges = (value?: string): [number, number][] | undefined =>
  value?.split(',').map((part) => part.split('-').map(Number) as [number, number]);

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  const sources: Source[] = args.url
    ? [
        {
          id: args.id,
          name: args.name ?? args.id,
          switch: args.switch ?? 'Không rõ',
          url: args.url,
          start: args.start ? Number(args.start) : undefined,
          end: args.end ? Number(args.end) : undefined,
          space: parseRanges(args.space),
        },
      ]
    : (JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'sounds', 'sources.json'), 'utf8')) as Source[]).filter(
        (source) => !args.only || args.only.split(',').includes(source.id)
      );

  mkdirSync(OUT_ROOT, { recursive: true });
  let failed = 0;
  sources.forEach((source) => {
    try {
      makePack(source);
    } catch (error) {
      failed++;
      console.error(`✗ ${source.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const packs = writeIndex();
  console.log(`\n${packs.length} gói trong public/sounds/index.json${failed ? `, ${failed} gói lỗi` : ''}`);
  if (failed) process.exitCode = 1;
};

main();
