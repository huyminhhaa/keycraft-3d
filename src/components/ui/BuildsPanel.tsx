'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Play, Search } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useSoundStore } from '@/store/useSoundStore';
import { KEYBOARD_BUILDS, buildBrand, buildPhotoUrl, filterBuilds, type KeyboardBuild } from '@/lib/keyboard/builds';
import { pressKey, releaseKey } from '@/lib/keyboard/pressedKeys';
import { KEYBOARD_LAYOUTS } from '@/types/keyboard';

type LayoutFilter = KeyboardBuild['look']['layout'] | 'all';
const LAYOUT_LABEL: Record<KeyboardBuild['look']['layout'], string> = {
  '60%': '60%',
  '65%': '65%',
  '75%': '75%',
  '75%-screen': '75% + màn hình',
  TKL: 'TKL / 80%',
  '96%': '96–98%',
  '100%': 'Full-size',
};
// Chỉ hiện layout đang có build
const LAYOUT_FILTERS: LayoutFilter[] = ['all', ...KEYBOARD_LAYOUTS.filter((id) => KEYBOARD_BUILDS.some((b) => b.look.layout === id))];
const BRANDS = [...new Set(KEYBOARD_BUILDS.map(buildBrand))].sort((a, b) => a.localeCompare(b));

/** Đoạn gõ thử: "keycraft" rồi phím cách, Enter — đủ nghe phím thường lẫn phím có stabilizer */
export const DEMO_SEQUENCE = ['KeyK', 'KeyE', 'KeyY', 'KeyC', 'KeyR', 'KeyA', 'KeyF', 'KeyT', 'Space', 'KeyG', 'KeyO', 'Enter'];

/** Gõ tự động: nhấn rồi nhả từng phím, nhịp hơi lệch như tay người. Trả về hàm huỷ. */
export const playDemo = (sequence: string[] = DEMO_SEQUENCE): (() => void) => {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let at = 0;
  sequence.forEach((code, i) => {
    at += i === 0 ? 0 : 130 + ((i * 37) % 60);
    timers.push(setTimeout(() => pressKey(code), at));
    timers.push(setTimeout(() => releaseKey(code), at + 70));
  });
  return () => {
    timers.forEach(clearTimeout);
    sequence.forEach(releaseKey);
  };
};

const SPEC_ROWS: { key: keyof KeyboardBuild['specs']; label: string }[] = [
  { key: 'switch', label: 'Switch' },
  { key: 'keycap', label: 'Keycap' },
  { key: 'plate', label: 'Plate' },
  { key: 'mount', label: 'Mount' },
  { key: 'case', label: 'Vỏ' },
  { key: 'foam', label: 'Foam' },
];

const BuildPhoto: React.FC<{ build: KeyboardBuild; className: string; sizes: string }> = ({ build, className, sizes }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      {failed ? (
        // Không tải được ảnh: dải màu vỏ + keycap của build thay ảnh
        <div
          className="h-full w-full"
          style={{
            background: `linear-gradient(135deg, ${build.look.caseColor} 0 40%, ${build.look.keycapColor} 40% 70%, ${build.look.keycapModifierColor} 70%)`,
          }}
          aria-hidden
        />
      ) : (
        <Image
          src={buildPhotoUrl(build)}
          alt={`${build.name} với switch ${build.specs.switch}`}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

/** Chấm màu thật: vỏ, keycap chính, keycap phụ, stem switch */
const ColorDots: React.FC<{ build: KeyboardBuild }> = ({ build }) => {
  const { caseColor, keycapColor, keycapModifierColor, switchColors } = build.look;
  const dots = [caseColor, keycapColor, keycapModifierColor, switchColors?.stem].filter(Boolean) as string[];
  return (
    <span className="flex items-center" aria-hidden>
      {dots.map((color, i) => (
        <span
          key={`${color}-${i}`}
          className="-ml-1 h-3 w-3 rounded-full border border-canvas first:ml-0"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
};

interface BuildRowProps {
  build: KeyboardBuild;
  active: boolean;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onListen: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const BuildRow: React.FC<BuildRowProps> = ({ build, active, onSelect, onListen }) => (
  <li
    className={`overflow-hidden rounded-xl border transition-colors ${
      active ? 'border-ink/40 bg-surface-2' : 'border-line hover:border-ink/20 hover:bg-surface'
    }`}
  >
    <div className="flex items-center gap-3 p-2">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
      >
        <BuildPhoto build={build} className="aspect-[4/3] w-20 shrink-0 rounded-lg" sizes="80px" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-faint">{buildBrand(build)}</span>
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-ink">{build.name.split(' ').slice(1).join(' ')}</span>
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-ink" aria-label="Đang dùng" />}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <ColorDots build={build} />
            <span className="truncate text-[12px] text-muted">{build.specs.switch}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onListen}
        aria-label={`Nghe thử ${build.name}`}
        className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:bg-surface lg:h-9 lg:w-9"
      >
        <Play className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>

    {/* Build đang dùng: ảnh lớn + lưới thông số thật */}
    {active && (
      <div className="border-t border-line p-3">
        <BuildPhoto build={build} className="aspect-video rounded-lg" sizes="(min-width: 1024px) 360px, 100vw" />
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {SPEC_ROWS.map((row) => (
            <div key={row.key} className="rounded-lg border border-line bg-canvas/40 px-2.5 py-2">
              <dt className="text-[10px] uppercase tracking-[0.08em] text-faint">{row.label}</dt>
              <dd className="mt-0.5 text-[12px] leading-snug text-ink">{build.specs[row.key]}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{LAYOUT_LABEL[build.look.layout]}</span>
          {build.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
    )}
  </li>
);

const Chip: React.FC<{ pressed: boolean; onClick: () => void; children: React.ReactNode }> = ({ pressed, onClick, children }) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onClick}
    className={`btn-press min-h-9 shrink-0 rounded-full border px-3 text-[12px] ${
      pressed ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'
    }`}
  >
    {children}
  </button>
);

/** Thư viện build phím thật: chọn một build thì 3D, tiếng gõ và chú thích 7 lớp đổi theo build đó. */
export const BuildsPanel: React.FC = () => {
  const buildId = useKeyboardStore((s) => s.buildId ?? null);
  const applyBuild = useKeyboardStore((s) => s.applyBuild);
  const selectPack = useSoundStore((s) => s.selectPack);
  const stopDemo = React.useRef<(() => void) | null>(null);
  /** Lần bấm "Nghe thử" mới nhất: lần bấm cũ tải xong muộn thì không tự gõ demo nữa */
  const listenToken = React.useRef(0);
  React.useEffect(() => () => stopDemo.current?.(), []);
  const [layoutFilter, setLayoutFilter] = useState<LayoutFilter>('all');
  const [brand, setBrand] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visible = useMemo(
    () => filterBuilds(KEYBOARD_BUILDS, layoutFilter, query).filter((b) => !brand || buildBrand(b) === brand),
    [layoutFilter, query, brand]
  );

  /**
   * Chọn mẫu: dừng demo đang gõ, đổi 3D, rồi luôn đổi gói tiếng (kể cả khi danh sách gói chưa tải xong).
   * Gói cũ bị gỡ ngay trong soundEngine.loadPack; không có gói thì phát tiếng tổng hợp theo plate/switch mới.
   */
  const choose = async (build: KeyboardBuild): Promise<number> => {
    const token = ++listenToken.current;
    stopDemo.current?.();
    stopDemo.current = null;
    applyBuild(build.id);
    await selectPack(build.soundPackId);
    return token;
  };

  const listen = async (build: KeyboardBuild): Promise<void> => {
    const token = await choose(build);
    // Chỉ gõ demo khi gói đã tải xong và người dùng chưa bấm mẫu khác trong lúc chờ
    if (token !== listenToken.current) return;
    stopDemo.current = playDemo();
  };

  /** Bấm bằng chuột thì bỏ focus khỏi nút: gõ Space thử tiếng sau đó không "bấm" lại nút */
  const releaseFocus = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (event.detail > 0) event.currentTarget.blur();
  };

  return (
    <div className="space-y-3 px-5 py-5">
      <p className="text-[12px] leading-relaxed text-muted">
        {KEYBOARD_BUILDS.length} bàn phím thật: chọn một mẫu để đổi mô hình 3D, tiếng gõ và 7 lớp linh kiện theo đúng mẫu đó.
      </p>

      <div className="space-y-2">
        <label className="block">
          <span className="sr-only">Tìm build theo tên phím, switch hoặc chất liệu</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm: Nut75, Cocoa, nhôm…"
              className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-ink/60 focus:outline-none lg:min-h-9"
            />
          </span>
        </label>
        <div role="group" aria-label="Lọc theo layout" className="scroll-thin -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {LAYOUT_FILTERS.map((value) => (
            <Chip key={value} pressed={layoutFilter === value} onClick={() => setLayoutFilter(value)}>
              {value === 'all' ? 'Mọi layout' : LAYOUT_LABEL[value]}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Lọc theo hãng" className="scroll-thin -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          <Chip pressed={brand === null} onClick={() => setBrand(null)}>
            Mọi hãng
          </Chip>
          {BRANDS.map((name) => (
            <Chip key={name} pressed={brand === name} onClick={() => setBrand(brand === name ? null : name)}>
              {name}
            </Chip>
          ))}
        </div>
        <p className="text-[12px] text-muted" aria-live="polite">
          {visible.length} / {KEYBOARD_BUILDS.length} mẫu
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-line px-3 py-4 text-center text-[13px] text-muted">
          Không có mẫu nào khớp. Thử bỏ bớt từ khoá hoặc chọn “Mọi layout”, “Mọi hãng”.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((build) => (
            <BuildRow
              key={build.id}
              build={build}
              active={build.id === buildId}
              onSelect={(event) => {
                releaseFocus(event);
                void choose(build);
              }}
              onListen={(event) => {
                releaseFocus(event);
                void listen(build);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
