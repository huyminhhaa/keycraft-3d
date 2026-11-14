'use client';

import React from 'react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { countKeys } from '@/lib/keyboard/layouts';
import { KEYCAP_SETS, findKeycapSet } from '@/lib/keyboard/keycapSets';
import type { CaseMaterial, KeyboardLayout } from '@/types/keyboard';
import { ColorStrip, ListOption, Section, Segmented, Slider, SwatchGroup, Toggle, type Swatch } from './controls';

const LAYOUT_OPTIONS: { value: KeyboardLayout; label: string; hint: string }[] = (['65%', '75%', 'TKL'] as const).map(
  (id) => ({ value: id, label: id, hint: `${countKeys(id)} phím` })
);

export const CASE_MATERIAL_LABELS: Record<CaseMaterial, string> = {
  aluminum: 'Nhôm',
  polycarbonate: 'PC',
  acrylic: 'Acrylic',
  wood: 'Gỗ',
};

const CASE_MATERIAL_OPTIONS = (Object.keys(CASE_MATERIAL_LABELS) as CaseMaterial[]).map((id) => ({
  value: id,
  label: CASE_MATERIAL_LABELS[id],
}));

export const CASE_COLORS: Swatch[] = [
  { label: 'Đỏ', hex: '#b3141f' },
  { label: 'Đen', hex: '#1d1d20' },
  { label: 'Bạc', hex: '#b9bcc1' },
  { label: 'Xám than', hex: '#4a4c52' },
  { label: 'Xanh navy', hex: '#22355e' },
  { label: 'Xanh rêu', hex: '#4f5b41' },
  { label: 'Kem', hex: '#ddd3bd' },
];

const LED_COLORS: Swatch[] = [
  { label: 'Hổ phách', hex: '#ff9a3c' },
  { label: 'Trắng ấm', hex: '#ffe2b8' },
  { label: 'Đỏ', hex: '#ff3b30' },
  { label: 'Xanh dương', hex: '#3d8bff' },
  { label: 'Xanh lá', hex: '#3ddc84' },
];

export const DesignPanel: React.FC = () => {
  const layout = useKeyboardStore((s) => s.layout);
  const setLayout = useKeyboardStore((s) => s.setLayout);
  const caseMaterial = useKeyboardStore((s) => s.caseMaterial);
  const setCaseMaterial = useKeyboardStore((s) => s.setCaseMaterial);
  const caseColor = useKeyboardStore((s) => s.caseColor);
  const setCaseColor = useKeyboardStore((s) => s.setCaseColor);
  const keycapColor = useKeyboardStore((s) => s.keycapColor);
  const keycapModifierColor = useKeyboardStore((s) => s.keycapModifierColor);
  const keycapAccentColor = useKeyboardStore((s) => s.keycapAccentColor);
  const setKeycapColor = useKeyboardStore((s) => s.setKeycapColor);
  const setKeycapModifierColor = useKeyboardStore((s) => s.setKeycapModifierColor);
  const setKeycapAccentColor = useKeyboardStore((s) => s.setKeycapAccentColor);
  const ledEnabled = useKeyboardStore((s) => s.underglowEnabled);
  const setLedEnabled = useKeyboardStore((s) => s.setUnderglowEnabled);
  const ledColor = useKeyboardStore((s) => s.underglowColor);
  const setLedColor = useKeyboardStore((s) => s.setUnderglowColor);
  const ledBrightness = useKeyboardStore((s) => s.underglowBrightness);
  const setLedBrightness = useKeyboardStore((s) => s.setUnderglowBrightness);

  const activeSet = findKeycapSet({ keycapColor, keycapModifierColor, keycapAccentColor });
  const caseColorName = CASE_COLORS.find((c) => c.hex.toLowerCase() === caseColor.toLowerCase())?.label;
  const woodCase = caseMaterial === 'wood';

  return (
    <>
      <Section title="Bố cục" value={`${countKeys(layout)} phím`}>
        <Segmented label="Bố cục" options={LAYOUT_OPTIONS} value={layout} onChange={setLayout} />
      </Section>

      <Section
        title="Vỏ"
        value={woodCase ? 'Gỗ óc chó' : [CASE_MATERIAL_LABELS[caseMaterial], caseColorName?.toLowerCase()].filter(Boolean).join(', ')}
      >
        <Segmented label="Chất liệu vỏ" options={CASE_MATERIAL_OPTIONS} value={caseMaterial} onChange={setCaseMaterial} />
        {!woodCase && (
          <div className="mt-3">
            <SwatchGroup label="Màu vỏ" swatches={CASE_COLORS} value={caseColor} onChange={setCaseColor} />
          </div>
        )}
      </Section>

      <Section title="Bộ keycap" value={activeSet?.name ?? 'Tự phối'}>
        <div className="space-y-1">
          {KEYCAP_SETS.map((set) => (
            <ListOption
              key={set.id}
              label={set.name}
              selected={activeSet?.id === set.id}
              detail={<ColorStrip colors={[set.alpha, set.modifier, set.accent]} />}
              onSelect={() => {
                setKeycapColor(set.alpha);
                setKeycapModifierColor(set.modifier);
                setKeycapAccentColor(set.accent);
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Đèn LED hông" value={ledEnabled ? `${Math.round(ledBrightness * 100)}%` : 'Tắt'}>
        <div className="flex items-center justify-between gap-3">
          <SwatchGroup label="Màu đèn LED" swatches={LED_COLORS} value={ledColor} onChange={setLedColor} />
          <Toggle label="Bật đèn LED hông" checked={ledEnabled} onChange={setLedEnabled} />
        </div>
        {ledEnabled && (
          <div className="mt-4">
            <Slider
              label="Độ sáng"
              min={0}
              max={1}
              step={0.05}
              value={ledBrightness}
              display={`${Math.round(ledBrightness * 100)}%`}
              onChange={setLedBrightness}
            />
          </div>
        )}
      </Section>
    </>
  );
};
