'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { fadeRise } from '@/lib/ui/motion';

interface BentoCardProps {
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  /** Nút/điều khiển phụ đặt ở góc phải header */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Ô bento: một nhóm điều khiển có header (eyebrow mono + tiêu đề) trong tấm kính phụ. */
export const BentoCard: React.FC<BentoCardProps> = ({
  title,
  eyebrow,
  icon: Icon,
  action,
  className = '',
  children,
}) => (
  <motion.section variants={fadeRise} className={`glass-tile rounded-2xl p-3.5 ${className}`}>
    <header className="mb-3 flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-cyan-300 ring-1 ring-inset ring-white/10">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
          )}
          <h4 className="text-[13px] font-medium leading-tight tracking-tight text-zinc-100">{title}</h4>
        </div>
      </div>
      {action}
    </header>
    {children}
  </motion.section>
);
