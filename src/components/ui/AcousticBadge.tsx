'use client';

import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioWaveform } from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { SPRINGS } from '@/lib/ui/motion';
import { ACOUSTIC_RANGES, buildWaveform, describeTone, toMeterPercent } from '@/lib/ui/meter';

interface MetricTileProps {
  label: string;
  value: string;
  percent: number;
  barClass: string;
}

/** Ô bento chỉ số: con số mono lớn + thanh đo co giãn bằng lò xo. */
const MetricTile: React.FC<MetricTileProps> = ({ label, value, percent, barClass }) => (
  <div className="glass-tile rounded-2xl p-3">
    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="mt-1.5 font-display text-lg font-semibold tabular-nums tracking-tight text-white">{value}</p>
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        className={`h-full rounded-full ${barClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(6, percent)}%` }}
        transition={SPRINGS.smooth}
      />
    </div>
  </div>
);

/** Bảng Acoustic Telemetry dạng bento: dạng sóng + 3 chỉ số + dòng phần cứng. */
export const AcousticBadge: React.FC = () => {
  const soundProfile = useKeyboardStore((s) => s.soundProfile);
  const plateMaterial = useKeyboardStore((s) => s.plateMaterial);
  const switchType = useKeyboardStore((s) => s.switchType);

  const waveform = useMemo(() => buildWaveform(soundProfile, 16), [soundProfile]);
  const tone = describeTone(soundProfile);

  return (
    <motion.section
      aria-label="Acoustic telemetry"
      initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ ...SPRINGS.smooth, delay: 0.55 }}
      className="fixed bottom-6 left-6 z-30 hidden w-[320px] lg:block xl:left-10"
    >
      <div className="glass-liquid rounded-[26px] p-2">
        <div className="grid grid-cols-3 gap-2">
          {/* Ô lớn: nhãn âm thanh + dạng sóng */}
          <div className="glass-tile col-span-3 rounded-2xl p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">
                  <AudioWaveform className="h-3 w-3 text-cyan-300" aria-hidden />
                  Acoustic Telemetry
                </p>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.h4
                    key={soundProfile.label}
                    initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                    transition={SPRINGS.smooth}
                    className="mt-1.5 truncate font-display text-[17px] font-semibold tracking-tight text-white"
                  >
                    {soundProfile.label}
                  </motion.h4>
                </AnimatePresence>
              </div>
              <span className="shrink-0 rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200 ring-1 ring-inset ring-cyan-300/25">
                {tone}
              </span>
            </div>

            {/* Dạng sóng suy ra từ hồ sơ âm học (pitch → tần số, damping → độ tắt) */}
            <div aria-hidden className="mt-3 flex h-10 items-center gap-[3px]">
              {waveform.map((amp, idx) => (
                <motion.span
                  key={idx}
                  className="h-full flex-1 origin-center rounded-full bg-gradient-to-t from-cyan-400 via-indigo-400 to-purple-400"
                  animate={{ scaleY: [amp * 0.45, amp, amp * 0.6] }}
                  transition={{
                    duration: 1.1 + (idx % 5) * 0.17,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  }}
                  style={{ opacity: 0.55 + amp * 0.45 }}
                />
              ))}
            </div>
          </div>

          <MetricTile
            label="Pitch"
            value={`${soundProfile.pitchMultiplier}x`}
            percent={toMeterPercent(soundProfile.pitchMultiplier, ACOUSTIC_RANGES.pitch)}
            barClass="bg-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.7)]"
          />
          <MetricTile
            label="Resonance"
            value={`${soundProfile.resonance}`}
            percent={toMeterPercent(soundProfile.resonance, ACOUSTIC_RANGES.resonance)}
            barClass="bg-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.7)]"
          />
          <MetricTile
            label="Damping"
            value={`${soundProfile.damping}`}
            percent={toMeterPercent(soundProfile.damping, ACOUSTIC_RANGES.damping)}
            barClass="bg-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.7)]"
          />

          <div className="col-span-3 flex items-center justify-between px-2 pb-1 pt-0.5 text-[11px] text-[#94a3b8]">
            <span>
              Plate <span className="ml-1 capitalize text-zinc-200">{plateMaterial}</span>
            </span>
            <span>
              Switch <span className="ml-1 capitalize text-zinc-200">{switchType.replace('_', ' ')}</span>
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
