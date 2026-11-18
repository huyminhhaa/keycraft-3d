'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useStageStore } from '@/store/useStageStore';
import { countKeys } from '@/lib/keyboard/layouts';
import { KEYBOARD_MODELS, getModelEntry } from '@/lib/keyboard/models';
import { EXPORT_ROOT_NAME, downloadFile, exportObjectToGlb, getExportScene } from '@/lib/keyboard/exportGlb';
import { KEYCAP_SETS, findKeycapSet } from '@/lib/keyboard/keycapSets';
import { KEYBOARD_LAYOUTS, type CaseMaterial, type KeyboardLayout } from '@/types/keyboard';
import { ColorStrip, ListOption, Section, Segmented, Slider, SwatchGroup, Toggle, type Swatch } from './controls';

const LAYOUT_OPTIONS: { value: KeyboardLayout; label: string; hint: string }[] = KEYBOARD_LAYOUTS.map(
  (id) => ({ value: id, label: id === '75%-screen' ? '75% + màn hình' : id, hint: `${countKeys(id)} phím` })
);

export const CASE_MATERIAL_LABELS: Record<CaseMaterial, string> = {
  aluminum: 'Nhôm',
  plastic: 'Nhựa',
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

type ExportStatus = 'idle' | 'working' | 'failed';

/** Chọn mẫu bàn phím, và xuất mẫu dựng bằng code ra file .glb để mở bằng Blender. */
const ModelSection: React.FC = () => {
  const modelId = useKeyboardStore((s) => s.modelId);
  const setModel = useKeyboardStore((s) => s.setModel);
  const isExploded = useKeyboardStore((s) => s.isExploded);
  const modelError = useStageStore((s) => s.modelError);
  const setModelError = useStageStore((s) => s.setModelError);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const active = getModelEntry(modelId);

  const exportGlb = async () => {
    const root = getExportScene()?.getObjectByName(EXPORT_ROOT_NAME);
    if (!root) {
      setStatus('failed');
      return;
    }
    setStatus('working');
    try {
      downloadFile(await exportObjectToGlb(root), 'keycraft-starter.glb');
      setStatus('idle');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <Section title="Mẫu bàn phím" value={active.source === 'glb' ? 'File 3D' : 'Dựng bằng code'}>
      <div className="space-y-1">
        {KEYBOARD_MODELS.map((entry) => (
          <ListOption
            key={entry.id}
            label={entry.name}
            selected={entry.id === active.id}
            detail={entry.source === 'glb' ? '.glb' : undefined}
            onSelect={() => {
              setModelError(null);
              setModel(entry.id);
            }}
          />
        ))}
      </div>

      {modelError && (
        <p role="alert" className="mt-3 text-[12px] leading-relaxed text-ink/85">
          Không mở được file 3D của mẫu này nên đang hiện mẫu dựng bằng code. Kiểm tra file trong public/models.
        </p>
      )}

      {active.source === 'procedural' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={exportGlb}
            disabled={isExploded || status === 'working'}
            className="btn-press flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-[13px] text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9"
          >
            <Download className="h-4 w-4" aria-hidden />
            {status === 'working' ? 'Đang xuất file…' : 'Tải file .glb để mở bằng Blender'}
          </button>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {isExploded
              ? 'Ghép các lớp lại rồi mới xuất được file.'
              : status === 'failed'
                ? 'Chưa xuất được file. Đợi mô hình tải xong rồi bấm lại.'
                : 'File giữ đúng màu, chất liệu và tên từng bộ phận đang chọn.'}
          </p>
        </div>
      )}
    </Section>
  );
};

export const DesignPanel: React.FC = () => {
  const modelId = useKeyboardStore((s) => s.modelId);
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
  const fromFile = getModelEntry(modelId).source === 'glb';

  return (
    <>
      <ModelSection />

      <Section title="Bố cục" value={fromFile ? `${layout}, theo file 3D` : `${countKeys(layout)} phím`}>
        {fromFile ? (
          <p className="text-[12px] leading-relaxed text-muted">Mẫu nạp từ file 3D giữ nguyên bố cục phím trong file.</p>
        ) : (
          <Segmented label="Bố cục" options={LAYOUT_OPTIONS} value={layout} onChange={setLayout} />
        )}
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
