import { describe, it, expect } from 'vitest';
import {
  countByVisibility,
  filterAndSortBuilds,
  formatRelativeTime,
  normalizeSearch,
  type MyBuildItem,
} from './myBuildsView';

const build = (over: Partial<MyBuildItem>): MyBuildItem => ({
  slug: 's',
  title: 'Build',
  description: null,
  isPublic: true,
  viewCount: 0,
  forkCount: 0,
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
});

const list = [
  build({ slug: 'a', title: 'Bàn phím Thock', isPublic: true, viewCount: 5, createdAt: '2026-11-10T00:00:00Z' }),
  build({ slug: 'b', title: 'Clack nhôm', isPublic: false, viewCount: 50, createdAt: '2026-11-12T00:00:00Z' }),
  build({ slug: 'c', title: 'Akko văn phòng', description: 'gõ êm', isPublic: true, viewCount: 1, createdAt: '2026-11-05T00:00:00Z' }),
];

describe('myBuildsView', () => {
  it('tìm kiếm không dấu, không phân biệt hoa thường, tìm cả trong mô tả', () => {
    const run = (query: string) =>
      filterAndSortBuilds(list, { query, visibility: 'all', sort: 'newest' }).map((b) => b.slug);
    expect(run('ban phim')).toEqual(['a']);
    expect(run('CLACK')).toEqual(['b']);
    expect(run('go em')).toEqual(['c']);
    expect(run('   ')).toEqual(['b', 'a', 'c']);
  });

  it('lọc công khai / riêng tư', () => {
    expect(filterAndSortBuilds(list, { query: '', visibility: 'private', sort: 'newest' }).map((b) => b.slug)).toEqual(['b']);
    expect(filterAndSortBuilds(list, { query: '', visibility: 'public', sort: 'newest' }).map((b) => b.slug)).toEqual(['a', 'c']);
  });

  it('sắp xếp mới nhất / cũ nhất / nhiều lượt xem / tên', () => {
    const sortBy = (sort: 'newest' | 'oldest' | 'views' | 'name') =>
      filterAndSortBuilds(list, { query: '', visibility: 'all', sort }).map((b) => b.slug);
    expect(sortBy('newest')).toEqual(['b', 'a', 'c']);
    expect(sortBy('oldest')).toEqual(['c', 'a', 'b']);
    expect(sortBy('views')).toEqual(['b', 'a', 'c']);
    expect(sortBy('name')).toEqual(['c', 'a', 'b']);
  });

  it('không làm đổi thứ tự mảng gốc', () => {
    const copy = [...list];
    filterAndSortBuilds(list, { query: '', visibility: 'all', sort: 'views' });
    expect(list).toEqual(copy);
  });

  it('đếm theo chế độ hiển thị', () => {
    expect(countByVisibility(list)).toEqual({ all: 3, public: 2, private: 1 });
  });

  it('normalizeSearch bỏ dấu và chữ đ', () => {
    expect(normalizeSearch('  Đỏ Đen Bàn Phím ')).toBe('do den ban phim');
  });

  it('thời gian tương đối tiếng Việt', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    expect(formatRelativeTime('2026-11-19T11:59:30Z', now)).toBe('vừa xong');
    expect(formatRelativeTime('2026-11-19T11:55:00Z', now)).toBe('5 phút trước');
    expect(formatRelativeTime('2026-11-19T09:00:00Z', now)).toBe('3 giờ trước');
    expect(formatRelativeTime('2026-11-17T12:00:00Z', now)).toMatch(/2 ngày trước|hôm kia/i);
  });
});
