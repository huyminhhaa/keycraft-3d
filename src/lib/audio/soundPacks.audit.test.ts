import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { harmonicity, MAX_HARMONICITY } from './slicer';

/**
 * Quét MỌI đoạn tiếng gõ đã commit trong public/sounds: không đoạn nào được chứa giọng người
 * hoặc tiếng bíp (đo bằng độ tuần hoàn phần đuôi, giống bộ lọc lúc tạo gói).
 * Thêm gói mới bằng `npm run sounds` thì bộ lọc đã tự loại; test này chặn file chép tay vào.
 */

const ROOT = join(process.cwd(), 'public', 'sounds');
const SR = 48000;

interface PackJson {
  clips: { alpha: string[]; space: string[]; up: string[] };
}

const readWav = (file: string): { samples: Float32Array; sampleRate: number } => {
  const buf = readFileSync(file);
  const sampleRate = buf.readUInt32LE(24);
  const count = (buf.length - 44) >> 1;
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) samples[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return { samples, sampleRate };
};

const packs = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, 'pack.json')))
  .map((entry) => entry.name);

describe('Gói tiếng thật không lẫn giọng nói / tiếng bíp', () => {
  it('có đủ gói để quét', () => {
    expect(packs.length).toBeGreaterThanOrEqual(41);
  });

  it(`mọi đoạn có độ tuần hoàn đuôi < ${MAX_HARMONICITY}`, () => {
    const offenders: string[] = [];
    for (const id of packs) {
      const pack = JSON.parse(readFileSync(join(ROOT, id, 'pack.json'), 'utf8')) as PackJson;
      for (const file of [...pack.clips.alpha, ...pack.clips.space, ...pack.clips.up]) {
        const { samples, sampleRate } = readWav(join(ROOT, id, file));
        expect(sampleRate).toBe(SR);
        const score = harmonicity(samples.subarray(Math.round(SR * 0.02)), sampleRate);
        if (score >= MAX_HARMONICITY) offenders.push(`${id}/${file} (${score.toFixed(2)})`);
      }
    }
    expect(offenders).toEqual([]);
  }, 60_000);
});
