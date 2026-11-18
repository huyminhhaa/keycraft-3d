import { describe, it, expect } from 'vitest';
import { KEYBOARD_BUILDS } from './builds';
import { PHOTO_FOLDERS, fitWithin, pickPrimaryPhoto } from './buildPhotos';

describe('buildPhotos: đồng bộ ảnh thật từ pics/', () => {
  it('đủ 41/41 build đều có tên thư mục ảnh, không thừa', () => {
    expect(Object.keys(PHOTO_FOLDERS).sort()).toEqual(KEYBOARD_BUILDS.map((b) => b.id).sort());
    expect(new Set(Object.values(PHOTO_FOLDERS)).size).toBe(41);
  });

  it('thư mục trống hoặc không có ảnh: null (giữ ảnh cũ)', () => {
    expect(pickPrimaryPhoto([])).toBeNull();
    expect(pickPrimaryPhoto([{ file: 'ghi-chu.txt', width: 0, height: 0 }])).toBeNull();
  });

  it('ưu tiên ảnh đặt tên cover/main/dai-dien, không thì ảnh ngang nét nhất', () => {
    const files = [
      { file: 'switch-can-canh.jpg', width: 3000, height: 4000 },
      { file: 'toan-canh.png', width: 1600, height: 900 },
      { file: 'day-may.jpg', width: 800, height: 600 },
    ];
    expect(pickPrimaryPhoto(files)?.file).toBe('toan-canh.png');
    expect(pickPrimaryPhoto([...files, { file: 'cover.jpg', width: 400, height: 300 }])?.file).toBe('cover.jpg');
  });

  it('thu nhỏ giữ đúng tỷ lệ, cạnh dài ≤ 1280, không phóng to ảnh nhỏ', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(600, 600)).toEqual({ width: 600, height: 600 });
  });
});
