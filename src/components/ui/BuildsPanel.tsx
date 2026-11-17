'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Check, Play } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useSoundStore } from '@/store/useSoundStore';
import { KEYBOARD_BUILDS, buildPhotoUrl, type KeyboardBuild } from '@/lib/keyboard/builds';
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
      {KEYBOARD_BUILDS.map((build) => (
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
