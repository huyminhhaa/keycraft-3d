'use client';

import React from 'react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { describeTone } from '@/lib/ui/meter';

interface AcousticWaveformProps {
  isStreaming?: boolean;
}

const TONE_BADGE = {
  Muted: { label: 'Êm', hint: 'Âm lượng thấp, triệt tiêu vang' },
  Thock: { label: 'Trầm', hint: 'Âm sâu và dày, ngân ấm' },
  Clack: { label: 'Đanh', hint: 'Âm cao giòn, đanh rõ' },
  Balanced: { label: 'Cân bằng', hint: 'Âm hài hòa, tự nhiên' },
} as const;

export const AcousticWaveform: React.FC<AcousticWaveformProps> = ({ isStreaming = false }) => {
  const profile = useKeyboardStore((s) => s.soundProfile);
  const toneType = describeTone(profile);
  const toneInfo = TONE_BADGE[toneType];

  // 12 thanh dải tần số tính theo pitch và resonance của bàn phím hiện tại
  const bars = [
    0.28, 0.45, 0.72, 0.95, 0.65, 0.88, 1.0, 0.78, 0.55, 0.82, 0.48, 0.32,
  ].map((baseWeight, i) => {
    // Điều chỉnh độ cao cơ sở theo pitch và damping
    const freqMod = Math.sin((i / 11) * Math.PI) * profile.pitchMultiplier;
    const heightPercent = Math.min(
      100,
      Math.max(18, Math.round((baseWeight * 0.6 + freqMod * 0.4) * 85))
    );
    return heightPercent;
  });

  return (
    <div
      role="region"
      aria-label="Đo lường âm học thời gian thực"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex items-center justify-between text-[12px]">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isStreaming ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'
            }`}
            aria-hidden
          />
          <span className="font-medium text-ink">Âm sắc: {toneInfo.label}</span>
        </div>
        <span className="text-[11px] text-muted">{toneInfo.hint}</span>
      </div>

      {/* Dải sóng âm thanh 12 thanh */}
      <div
        className="flex h-8 items-end justify-between gap-1 px-1"
        aria-hidden
      >
        {bars.map((height, index) => {
          const delayMs = index * 60;
          return (
            <span
              key={index}
              style={{
                height: `${height}%`,
                animationDelay: isStreaming ? `${delayMs}ms` : undefined,
              }}
              className={`w-full rounded-full transition-all duration-300 ${
                isStreaming
                  ? 'animate-sound-wave bg-ink'
                  : index % 3 === 0
                  ? 'bg-ink/90'
                  : 'bg-muted/50'
              }`}
            />
          );
        })}
      </div>

      <div className="flex justify-between border-t border-line/60 pt-1.5 text-[11px] tabular-nums text-faint">
        <span>Cao độ: {profile.pitchMultiplier.toFixed(2)}x</span>
        <span>Cộng hưởng: {profile.resonance.toFixed(2)}x</span>
        <span>Triệt tiêu: {profile.damping.toFixed(2)}</span>
      </div>
    </div>
  );
};
