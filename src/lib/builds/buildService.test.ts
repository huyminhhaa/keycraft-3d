import { describe, it, expect, beforeEach } from 'vitest';
import {
  slugify,
  createBuild,
  getTrendingBuilds,
  getBuildBySlug,
  forkBuild,
  resetMemoryBuilds,
  canViewBuild,
  isBuildOwner,
  updateBuild,
  deleteBuild,
} from './buildService';
import type { KeyboardState } from '@/types/keyboard';

const mockKeyboardConfig: KeyboardState = {
  modelId: 'procedural-default',
  layout: '75%',
  isExploded: false,
  explosionOffset: 1.5,
  plateMaterial: 'pom',
  caseMaterial: 'aluminum',
  switchType: 'linear',
  keycapColor: '#1e293b',
  keycapModifierColor: '#c41f2d',
  keycapAccentColor: '#3b82f6',
  caseColor: '#0f172a',
  underglowColor: '#00f0ff',
  underglowBrightness: 0.8,
  underglowEnabled: true,
  cameraPreset: 'perspective',
  soundProfile: {
    pitchMultiplier: 0.85,
    damping: 0.88,
    resonance: 1.25,
    label: 'Deep Thock',
  },
};

describe('Build Service (src/lib/builds/buildService.ts)', () => {
  beforeEach(() => {
    resetMemoryBuilds();
  });

  it('slugify chuyển đổi tiếng Việt có dấu sang slug URL hợp lệ', () => {
    const slug1 = slugify('Bàn Phím Cơ Deep Thock 75% Đỉnh Cao');
    expect(slug1).toMatch(/^ban-phim-co-deep-thock-75-dinh-cao-[a-z0-9]{4}$/);

    const slug2 = slugify('!!! @#$ Special Chars');
    expect(slug2).toMatch(/^special-chars-[a-z0-9]{4}$/);

    const slugEmpty = slugify('');
    expect(slugEmpty).toMatch(/^custom-keyboard-[a-z0-9]{4}$/);
  });

  it('createBuild lưu thành công bản build với cấu hình 3D hoàn chỉnh', async () => {
    const build = await createBuild({
      title: 'Deep Thock Special 75',
      description: 'Cấu hình plate POM và switch Oil King',
      config: mockKeyboardConfig,
      userId: 'user-123',
      isPublic: true,
    });

    expect(build.id).toBeDefined();
    expect(build.title).toBe('Deep Thock Special 75');
    expect(build.description).toContain('plate POM');
    expect(build.config.plateMaterial).toBe('pom');
    expect(build.viewCount).toBe(0);
    expect(build.forkCount).toBe(0);
    expect(build.isPublic).toBe(true);
  });

  it('getBuildBySlug lấy đúng bản build và tự động tăng lượt xem', async () => {
    const created = await createBuild({
      title: 'Retro Clack TKL',
      config: mockKeyboardConfig,
    });

    // Lần 1: Xem chi tiết -> viewCount tăng lên 1
    const fetched1 = await getBuildBySlug(created.slug, true);
    expect(fetched1).not.toBeNull();
    expect(fetched1?.title).toBe('Retro Clack TKL');
    expect(fetched1?.viewCount).toBe(1);

    // Lần 2: Xem chi tiết tiếp -> viewCount tăng lên 2
    const fetched2 = await getBuildBySlug(created.slug, true);
    expect(fetched2?.viewCount).toBe(2);

    // Truy vấn slug không tồn tại -> null
    const notFound = await getBuildBySlug('slug-khong-ton-tai-xyz');
    expect(notFound).toBeNull();
  });

  it('getTrendingBuilds sắp xếp theo lượt xem giảm dần', async () => {
    const b1 = await createBuild({ title: 'Build Ít Xem', config: mockKeyboardConfig });
    const b2 = await createBuild({ title: 'Build Thịnh Hành Nhất', config: mockKeyboardConfig });
    const b3 = await createBuild({ title: 'Build Riêng Tư', config: mockKeyboardConfig, isPublic: false });

    // Tăng lượt xem cho b2 lên 5 lần
    for (let i = 0; i < 5; i++) {
      await getBuildBySlug(b2.slug, true);
    }
    // Tăng lượt xem cho b1 lên 1 lần
    await getBuildBySlug(b1.slug, true);

    const trending = await getTrendingBuilds(10, 0);

    // Build riêng tư (isPublic = false) không được xuất hiện trong trending
    const slugs = trending.map((b) => b.slug);
    expect(slugs).not.toContain(b3.slug);

    // Build có lượt xem nhiều nhất đứng đầu danh sách
    expect(trending[0].slug).toBe(b2.slug);
    expect(trending[0].viewCount).toBe(5);
    expect(trending[1].slug).toBe(b1.slug);
  });

  it('forkBuild tăng forkCount của bản build gốc và tạo bản build mới thừa kế config', async () => {
    const original = await createBuild({
      title: 'Original Wave75',
      config: mockKeyboardConfig,
    });

    const forked = await forkBuild(original.slug, 'user-remixer-456', 'My Custom Wave75');
    expect(forked).not.toBeNull();
    expect(forked?.title).toBe('My Custom Wave75');
    expect(forked?.config.layout).toBe('75%');
    expect(forked?.slug).not.toBe(original.slug);

    // Kiểm tra build gốc đã được tăng forkCount lên 1
    const updatedOriginal = await getBuildBySlug(original.slug, false);
    expect(updatedOriginal?.forkCount).toBe(1);
  });
});

describe('Phân quyền bản build (chống IDOR)', () => {
  beforeEach(() => {
    resetMemoryBuilds();
  });

  it('canViewBuild: công khai ai cũng xem; riêng tư chỉ chủ sở hữu', () => {
    expect(canViewBuild({ isPublic: true, userId: 'a' }, null)).toBe(true);
    expect(canViewBuild({ isPublic: false, userId: 'a' }, 'a')).toBe(true);
    expect(canViewBuild({ isPublic: false, userId: 'a' }, 'b')).toBe(false);
    expect(canViewBuild({ isPublic: false, userId: null }, null)).toBe(false);
  });

  it('isBuildOwner: build ẩn danh không có chủ, null không khớp null', () => {
    expect(isBuildOwner({ userId: 'a' }, 'a')).toBe(true);
    expect(isBuildOwner({ userId: 'a' }, 'b')).toBe(false);
    expect(isBuildOwner({ userId: null }, null)).toBe(false);
  });

  it('updateBuild / deleteBuild: người khác bị forbidden, chủ sở hữu thành công', async () => {
    const build = await createBuild({ title: 'Của A', config: mockKeyboardConfig, userId: 'user-a' });

    expect((await updateBuild(build.slug, 'user-b', { title: 'Của B' })).status).toBe('forbidden');
    expect((await deleteBuild(build.slug, 'user-b')).status).toBe('forbidden');
    expect((await getBuildBySlug(build.slug, false))?.title).toBe('Của A');

    const updated = await updateBuild(build.slug, 'user-a', { title: 'Đổi tên', isPublic: false });
    expect(updated.status).toBe('ok');
    if (updated.status === 'ok') {
      expect(updated.build.title).toBe('Đổi tên');
      expect(updated.build.isPublic).toBe(false);
      expect(updated.build.userId).toBe('user-a');
    }

    expect((await deleteBuild(build.slug, 'user-a')).status).toBe('ok');
    expect(await getBuildBySlug(build.slug, false)).toBeNull();
    expect((await deleteBuild(build.slug, 'user-a')).status).toBe('not_found');
  });
});