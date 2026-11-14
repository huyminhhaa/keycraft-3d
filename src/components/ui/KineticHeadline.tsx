'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { createStaggerContainer, kineticWord, splitWords } from '@/lib/ui/motion';

export interface HeadlineLine {
  text: string;
  /** Tô gradient aurora (cyan → indigo → purple) cho dòng này */
  accent?: boolean;
}

interface KineticHeadlineProps {
  lines: HeadlineLine[];
  className?: string;
  /** Độ trễ trước khi từ đầu tiên xuất hiện (giây) */
  delay?: number;
  /** Khoảng cách thời gian giữa hai từ liên tiếp (giây) */
  stagger?: number;
}

/**
 * Tiêu đề kinetic: mỗi từ nằm trong một "mặt nạ" overflow-hidden và trồi lên lần lượt.
 * `aria-label` giữ nguyên câu đầy đủ cho trình đọc màn hình; các mảnh chữ bị ẩn khỏi cây a11y.
 */
export const KineticHeadline: React.FC<KineticHeadlineProps> = ({
  lines,
  className = '',
  delay = 0.15,
  stagger = 0.07,
}) => {
  const label = lines.map((line) => line.text.trim()).join(' ');

  return (
    <motion.h1
      aria-label={label}
      className={className}
      initial="hidden"
      animate="visible"
      variants={createStaggerContainer(stagger, delay)}
    >
      {lines.map((line, lineIndex) => (
        <span key={`${line.text}-${lineIndex}`} aria-hidden className="block">
          {splitWords(line.text).map((word, wordIndex) => (
            <span
              key={`${word}-${wordIndex}`}
              className="mr-[0.24em] inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom last:mr-0"
            >
              <motion.span
                variants={kineticWord}
                className={`inline-block origin-bottom-left will-change-transform ${
                  line.accent ? 'text-gradient-aurora' : ''
                }`}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
};
