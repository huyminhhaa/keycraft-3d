'use client';

import React from 'react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
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

  return (
    <>
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
