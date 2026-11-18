/**
 * Đồng bộ ảnh thật: pics/<thư mục build>/* → public/builds/<build.id>.jpg
 *   npm run photos
 * - Thư mục có ảnh: chọn ảnh đại diện (pickPrimaryPhoto), xoay theo EXIF, nền trong suốt → trắng,
 *   cạnh dài ≤ 1280px giữ tỷ lệ, JPEG mozjpeg q86.
 * - Thư mục trống / không có: giữ nguyên ảnh cũ.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { KEYBOARD_BUILDS } from '../../src/lib/keyboard/builds';
import { PHOTO_FOLDERS, fitWithin, pickPrimaryPhoto, type PhotoCandidate } from '../../src/lib/keyboard/buildPhotos';

const PICS = join(process.cwd(), 'pics');
const OUT = join(process.cwd(), 'public', 'builds');

const main = async (): Promise<void> => {
  const rows: string[] = [];
  for (const build of KEYBOARD_BUILDS) {
    const folder = PHOTO_FOLDERS[build.id];
    const dir = folder ? join(PICS, folder) : '';
    const files = dir && existsSync(dir) ? readdirSync(dir) : [];
    const candidates: PhotoCandidate[] = [];
    for (const file of files) {
      try {
        const meta = await sharp(join(dir, file)).metadata();
        candidates.push({ file, width: meta.width ?? 0, height: meta.height ?? 0 });
      } catch {
        // Không phải ảnh: bỏ qua
      }
    }
    const primary = pickPrimaryPhoto(candidates);
    if (!primary) {
      rows.push(`${build.id.padEnd(24)} giữ ảnh cũ`);
      continue;
    }
    const size = fitWithin(primary.width, primary.height);
    const info = await sharp(join(dir, primary.file))
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(join(OUT, `${build.id}.jpg`));
    rows.push(`${build.id.padEnd(24)} ← pics/${folder}/${primary.file} (${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB)`);
  }
  console.log(rows.join('\n'));
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
