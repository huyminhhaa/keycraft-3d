'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, Sparkles } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { soundEngine } from '@/lib/audio/soundEngine';
import { ACOUSTIC_RANGES, describeTone, toMeterPercent } from '@/lib/ui/meter';
import type { PlateMaterial, SwitchType } from '@/types/keyboard';
import { ListOption, Section } from './controls';

export const PLATE_OPTIONS: { id: PlateMaterial; name: string; sound: string }[] = [
  { id: 'aluminum', name: 'Nhôm', sound: 'Đanh, cao' },
  { id: 'fr4', name: 'FR4', sound: 'Cân bằng' },
  { id: 'polycarbonate', name: 'Polycarbonate', sound: 'Trầm, mềm' },
  { id: 'pom', name: 'POM', sound: 'Trầm, sâu' },
];

export const SWITCH_OPTIONS: { id: SwitchType; name: string; feel: string }[] = [
  { id: 'linear', name: 'Linear', feel: 'Trơn, không khấc' },
  { id: 'tactile', name: 'Tactile', feel: 'Có khấc nhẹ' },
  { id: 'clicky', name: 'Clicky', feel: 'Có tiếng click' },
  { id: 'silent_linear', name: 'Silent linear', feel: 'Gõ êm' },
];

export const TONE_COPY = {
  Muted: { label: 'Êm', sentence: 'Gõ êm, tiếng nhỏ và tắt nhanh.' },
  Thock: { label: 'Trầm', sentence: 'Tiếng trầm và dày, ngân lâu hơn.' },
  Clack: { label: 'Đanh', sentence: 'Tiếng cao, đanh và rõ từng phím.' },
  Balanced: { label: 'Cân bằng', sentence: 'Tiếng vừa, không quá trầm cũng không quá đanh.' },
} as const;

const formatValue = (value: number) => value.toFixed(2);

interface MeterProps {
  label: string;
  value: string;
  percent: number;
}

/** Thanh đo tĩnh: chỉ co giãn bằng transform khi giá trị đổi. */
const Meter: React.FC<MeterProps> = ({ label, value, percent }) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-ink">{value}</span>
    </div>
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span className="meter__fill" style={{ transform: `scaleX(${Math.max(0.03, percent / 100)})` }} />
    </div>
  </div>
);

export const SoundPanel: React.FC = () => {
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const setPlateMaterial = useKeyboardStore((s) => s.setPlateMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);
  const setSwitchType = useKeyboardStore((s) => s.setSwitchType);
  const profile = useKeyboardStore((s) => s.soundProfile);
  const tone = TONE_COPY[describeTone(profile)];

  const [muted, setMutedState] = useState(() => soundEngine.isMuted());
  const [volume, setVolumeState] = useState(() => Math.round(soundEngine.getVolume() * 100));

  const handleToggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMutedState(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = Number(e.target.value);
    setVolumeState(nextVal);
    soundEngine.setVolume(nextVal / 100);
    if (muted && nextVal > 0) {
      soundEngine.setMuted(false);
      setMutedState(false);
    }
  };

  const handleTestKey = (code: string) => {
    soundEngine.playKeySound(code);
  };

  return (
    <>
      <Section title="Bộ phát tiếng gõ" value={muted ? 'Tắt tiếng' : `${volume}%`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleToggleMute}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-ink"
            >
              {muted ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-muted" />
                  <span>Bật âm thanh</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-accent" />
                  <span>Tắt tiếng</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTestKey('KeyA')}
                className="btn-press rounded border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-ink transition-colors"
              >
                Gõ phím A
              </button>
              <button
                type="button"
                onClick={() => handleTestKey('Space')}
                className="btn-press rounded border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink hover:border-ink transition-colors"
              >
                Gõ Space
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Âm lượng</span>
              <span className="tabular-nums text-ink">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Âm lượng gõ phím"
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <span>
              Gõ trên bàn phím máy tính thật của bạn hoặc bấm chuột lên phím 3D để nghe âm thanh thời gian thực.
            </span>
          </p>
        </div>
      </Section>

      <Section title="Hồ sơ âm thanh" value={tone.label}>
        <p className="mb-4 text-[14px] text-ink">{tone.sentence}</p>
        <div className="space-y-3.5">
          <Meter label="Cao độ" value={`${formatValue(profile.pitchMultiplier)}×`} percent={toMeterPercent(profile.pitchMultiplier, ACOUSTIC_RANGES.pitch)} />
          <Meter label="Độ vang" value={formatValue(profile.resonance)} percent={toMeterPercent(profile.resonance, ACOUSTIC_RANGES.resonance)} />
          <Meter label="Độ tắt tiếng" value={formatValue(profile.damping)} percent={toMeterPercent(profile.damping, ACOUSTIC_RANGES.damping)} />
        </div>
      </Section>

      <Section title="Plate" value={PLATE_OPTIONS.find((p) => p.id === plateMaterial)?.name}>
        <div className="space-y-1">
          {PLATE_OPTIONS.map((plate) => (
            <ListOption
              key={plate.id}
              label={plate.name}
              detail={plate.sound}
              selected={plateMaterial === plate.id}
              onSelect={() => setPlateMaterial(plate.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="Switch" value={SWITCH_OPTIONS.find((s) => s.id === switchType)?.name}>
        <div className="space-y-1">
          {SWITCH_OPTIONS.map((sw) => (
            <ListOption
              key={sw.id}
              label={sw.name}
              detail={sw.feel}
              selected={switchType === sw.id}
              onSelect={() => setSwitchType(sw.id)}
            />
          ))}
        </div>
      </Section>
    </>
  );
};
