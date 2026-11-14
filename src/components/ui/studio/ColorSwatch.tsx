'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { SPRINGS } from '@/lib/ui/motion';

export interface SwatchOption {
  label: string;
  hex: string;
}

interface SwatchRowProps {
  options: SwatchOption[];
  value: string;
  onChange: (hex: string) => void;
  /** Tên nhóm cho vòng chọn trượt (layoutId) */
  group: string;
  size?: 'sm' | 'md';
}

/** Hàng ô màu: vòng sáng của màu đang chọn trượt bằng lò xo giữa các ô. */
export const SwatchRow: React.FC<SwatchRowProps> = ({ options, value, onChange, group, size = 'md' }) => {
  const dimension = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {options.map((option) => {
        const selected = value.toLowerCase() === option.hex.toLowerCase();
        return (
          <motion.button
            key={option.hex}
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            title={option.label}
            onClick={() => onChange(option.hex)}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            transition={SPRINGS.snappy}
            className={`relative ${dimension} rounded-full ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_10px_rgba(0,0,0,0.4)]`}
            style={{ backgroundColor: option.hex }}
          >
            {selected && (
              <motion.span
                layoutId={`${group}-ring`}
                transition={SPRINGS.smooth}
                className="absolute -inset-[4px] rounded-full ring-[1.5px] ring-cyan-300/90 shadow-[0_0_14px_rgba(0,240,255,0.45)]"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
