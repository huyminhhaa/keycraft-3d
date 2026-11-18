'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Play, Search } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useSoundStore } from '@/store/useSoundStore';
import { KEYBOARD_BUILDS, buildPhotoUrl, filterBuilds, type KeyboardBuild } from '@/lib/keyboard/builds';

type LayoutFilter = KeyboardBuild['look']['layout'] | 'all';
const LAYOUT_FILTERS: { value: LayoutFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: '65%', label: '65%' },
  { value: '75%', label: '75%' },
  { value: 'TKL', label: 'TKL / 80%' },
  { value: '96%', label: '96%' },
];
import { pressKey, releaseKey } from '@/lib/keyboard/pressedKeys';

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
  { key: 'foam', label: 'Foam' },
  { key: 'case', label: 'Vỏ' },
  { key: 'mount', label: 'Kiểu mount' },
];

const BuildPhoto: React.FC<{ build: KeyboardBuild }> = ({ build }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="build-card__photo relative aspect-video overflow-hidden rounded-lg bg-surface">
      {failed ? (
        // Chưa tải ảnh (public/builds không có trong git): dải màu vỏ + keycap của build thay ảnh
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
          sizes="(min-width: 1024px) 320px, 100vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

interface BuildCardProps {
  build: KeyboardBuild;
  active: boolean;
  onSelect: () => void;
  onListen: () => void;
}

const BuildCard: React.FC<BuildCardProps> = ({ build, active, onSelect, onListen }) => (
  <article className={`build-card rounded-xl border p-3 ${active ? 'border-ink/60 bg-surface-2' : 'border-line hover:bg-surface'}`}>
    <button type="button" onClick={onSelect} aria-pressed={active} className="block w-full text-left">
      <BuildPhoto build={build} />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-ink">{build.name}</h3>
          <p className="truncate text-[12px] text-muted">{build.specs.switch}</p>
        </div>
        {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-label="Đang dùng" />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {build.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            {tag}
          </span>
        ))}
      </div>
    </button>

    {/* Thông số chỉ mở ở build đang dùng để danh sách gọn */}
    {active && (
      <dl className="mt-3 divide-y divide-line border-t border-line">
        {SPEC_ROWS.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-4 py-2 text-[12px]">
            <dt className="shrink-0 text-muted">{row.label}</dt>
            <dd className="text-right text-ink">{build.specs[row.key]}</dd>
          </div>
        ))}
      </dl>
    )}

    <button
      type="button"
      onClick={onListen}
      className="btn-press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line text-[13px] text-ink hover:bg-surface lg:min-h-9"
    >
      <Play className="h-3.5 w-3.5" aria-hidden />
      Nghe thử
    </button>
  </article>
);

/** Thư viện build phím thật: chọn một build thì 3D, tiếng gõ và chú thích 7 lớp đổi theo build đó. */
export const BuildsPanel: React.FC = () => {
  const buildId = useKeyboardStore((s) => s.buildId ?? null);
  const applyBuild = useKeyboardStore((s) => s.applyBuild);
  const selectPack = useSoundStore((s) => s.selectPack);
  const packs = useSoundStore((s) => s.packs);
  const stopDemo = React.useRef<(() => void) | null>(null);
  const [layoutFilter, setLayoutFilter] = useState<LayoutFilter>('all');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterBuilds(KEYBOARD_BUILDS, layoutFilter, query), [layoutFilter, query]);

  const choose = async (build: KeyboardBuild): Promise<void> => {
    applyBuild(build.id);
    if (packs.some((pack) => pack.id === build.soundPackId)) await selectPack(build.soundPackId);
  };

  const listen = async (build: KeyboardBuild): Promise<void> => {
    stopDemo.current?.();
    await choose(build);
    stopDemo.current = playDemo();
  };

  return (
    <div className="space-y-3 px-5 py-5">
      <p className="text-[12px] leading-relaxed text-muted">
        Build phím thật: chọn một build để đổi mô hình 3D, tiếng gõ và chú thích 7 lớp theo đúng linh kiện của nó.
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
              placeholder="Tìm: Lucky65, Cocoa, nhôm…"
              className="min-h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-ink/60 focus:outline-none lg:min-h-9"
            />
          </span>
        </label>
        <div role="group" aria-label="Lọc theo layout" className="flex flex-wrap gap-1.5">
          {LAYOUT_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={layoutFilter === option.value}
              onClick={() => setLayoutFilter(option.value)}
              className={`btn-press min-h-9 rounded-full border px-3 text-[12px] ${
                layoutFilter === option.value ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted" aria-live="polite">
          {visible.length} / {KEYBOARD_BUILDS.length} build
        </p>
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-line px-3 py-4 text-center text-[13px] text-muted">
          Không có build nào khớp. Thử bỏ bớt từ khoá hoặc chọn “Tất cả”.
        </p>
      )}
      {visible.map((build) => (
        <BuildCard
          key={build.id}
          build={build}
          active={build.id === buildId}
          onSelect={() => void choose(build)}
          onListen={() => void listen(build)}
        />
      ))}
    </div>
  );
};
