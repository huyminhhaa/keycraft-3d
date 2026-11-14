'use client';

import React from 'react';
import { Html, useProgress } from '@react-three/drei';

export const CanvasLoader: React.FC = () => {
  const { progress } = useProgress();
  const percent = Math.round(progress);

  return (
    <Html center>
      <div className="scene-loading" role="status">
        <span>Đang tải mô hình</span>
        <span className="scene-loading__bar" aria-hidden>
          <span style={{ width: `${Math.max(6, percent)}%` }} />
        </span>
      </div>
    </Html>
  );
};
