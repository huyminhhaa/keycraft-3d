/**
 * Logic thuần cho trang "Bản build của tôi": lọc theo chế độ hiển thị, tìm theo tên, sắp xếp,
 * và hiển thị thời gian tương đối kiểu "3 giờ trước".
 */

export type VisibilityFilter = 'all' | 'public' | 'private';
export type BuildSort = 'newest' | 'oldest' | 'views' | 'name';

export interface MyBuildItem {
  slug: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  viewCount: number;
  forkCount: number;
  createdAt: string | Date;
}

export interface BuildViewOptions {
  query: string;
  visibility: VisibilityFilter;
  sort: BuildSort;
}

/** Bỏ dấu tiếng Việt + chữ thường để "ban phim" tìm ra "Bàn phím" */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const time = (value: string | Date): number => new Date(value).getTime();

export function filterAndSortBuilds<T extends MyBuildItem>(builds: T[], options: BuildViewOptions): T[] {
  const query = normalizeSearch(options.query);
  const filtered = builds.filter((build) => {
    if (options.visibility === 'public' && !build.isPublic) return false;
    if (options.visibility === 'private' && build.isPublic) return false;
    if (!query) return true;
    return normalizeSearch(`${build.title} ${build.description ?? ''}`).includes(query);
  });

  const sorted = [...filtered];
  switch (options.sort) {
    case 'oldest':
      sorted.sort((a, b) => time(a.createdAt) - time(b.createdAt));
      break;
    case 'views':
      sorted.sort((a, b) => b.viewCount - a.viewCount || time(b.createdAt) - time(a.createdAt));
      break;
    case 'name':
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
      break;
    default:
      sorted.sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }
  return sorted;
}

export function countByVisibility(builds: MyBuildItem[]): Record<VisibilityFilter, number> {
  const publicCount = builds.filter((b) => b.isPublic).length;
  return { all: builds.length, public: publicCount, private: builds.length - publicCount };
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "vừa xong", "5 phút trước", "2 ngày trước"... */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const seconds = Math.round((time(value) - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return 'vừa xong';
  const formatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return 'vừa xong';
}
