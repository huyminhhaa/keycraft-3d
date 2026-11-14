'use client';

import React from 'react';
import { Check } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Khối tuỳ chọn: tiêu đề bên trái, giá trị đang chọn bên phải                */
/* -------------------------------------------------------------------------- */
interface SectionProps {
  title: string;
  value?: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, value, children }) => (
  <section className="border-b border-line px-5 py-5 last:border-b-0">
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-medium text-ink">{title}</h2>
      {value && <span className="truncate text-[12px] text-muted">{value}</span>}
    </div>
    {children}
  </section>
);

/* -------------------------------------------------------------------------- */
/* Nhóm nút chọn một (segmented)                                              */
/* -------------------------------------------------------------------------- */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export const Segmented = <T extends string>({ label, options, value, onChange }: SegmentedProps<T>) => (
  <div
    role="group"
    aria-label={label}
    className="grid gap-1 rounded-lg bg-surface p-1"
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(option.value)}
          className={`btn-press flex min-h-11 flex-col items-center justify-center rounded-md px-2 text-[13px] lg:min-h-9 ${
            option.hint ? 'py-1.5' : ''
          } ${selected ? 'bg-ink font-medium text-canvas' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
        >
          <span>{option.label}</span>
          {option.hint && (
            <span className={`text-[11px] ${selected ? 'text-canvas/70' : 'text-faint'}`}>{option.hint}</span>
          )}
        </button>
      );
    })}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Danh sách lựa chọn dạng hàng (plate, switch, bộ keycap)                    */
/* -------------------------------------------------------------------------- */
interface ListOptionProps {
  label: string;
  detail?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

export const ListOption: React.FC<ListOptionProps> = ({ label, detail, selected, onSelect }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onSelect}
    className={`btn-press flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
      selected ? 'border-ink/70 bg-surface-2' : 'border-transparent hover:bg-surface'
    }`}
  >
    <span className="grid h-4 w-4 shrink-0 place-items-center">
      {selected && <Check className="h-4 w-4 text-ink" aria-hidden />}
    </span>
    <span className={`flex-1 text-[13px] ${selected ? 'font-medium text-ink' : 'text-ink/85'}`}>{label}</span>
    {detail && <span className="shrink-0 text-[12px] text-muted">{detail}</span>}
  </button>
);

/* -------------------------------------------------------------------------- */
/* Ô màu                                                                      */
/* -------------------------------------------------------------------------- */
export interface Swatch {
  label: string;
  hex: string;
}

interface SwatchGroupProps {
  label: string;
  swatches: Swatch[];
  value: string;
  onChange: (hex: string) => void;
}

export const SwatchGroup: React.FC<SwatchGroupProps> = ({ label, swatches, value, onChange }) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {swatches.map((swatch) => {
      const selected = swatch.hex.toLowerCase() === value.toLowerCase();
      return (
        <button
          key={swatch.hex}
          type="button"
          aria-label={swatch.label}
          aria-pressed={selected}
          title={swatch.label}
          onClick={() => onChange(swatch.hex)}
          className={`swatch h-11 w-11 rounded-full lg:h-8 lg:w-8 ${selected ? 'swatch--on' : ''}`}
          style={{ backgroundColor: swatch.hex }}
        />
      );
    })}
  </div>
);

/** Dải 3 màu nhỏ minh hoạ một bộ keycap. */
export const ColorStrip: React.FC<{ colors: string[] }> = ({ colors }) => (
  <span className="flex overflow-hidden rounded-[4px] ring-1 ring-inset ring-white/10" aria-hidden>
    {colors.map((hex, i) => (
      <span key={`${hex}-${i}`} className="h-5 w-5" style={{ backgroundColor: hex }} />
    ))}
  </span>
);

/* -------------------------------------------------------------------------- */
/* Công tắc & thanh trượt                                                     */
/* -------------------------------------------------------------------------- */
interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`toggle ${checked ? 'toggle--on' : ''}`}
  >
    <span className="toggle__knob" />
  </button>
);

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

export const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, display, onChange }) => (
  <label className="block">
    <span className="mb-1 flex items-center justify-between text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-ink">{display}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      className="slider"
    />
  </label>
);
