'use client';

import React from 'react';
import { useProgress } from '@react-three/drei';

/**
 * Lớp "Đang tải mô hình" phủ lên sân khấu 3D, render NGOÀI <Canvas> (DOM thường).
 *
 * Không dùng <Html> của drei làm fallback của Suspense trong Canvas: <Html> tự tạo một React root
 * riêng, khi Suspense gỡ fallback giữa lúc React đang render (model .glb vừa tải xong) nó gỡ nút DOM
 * sai thứ tự -> lỗi "removeChild ... not a child of this node". useProgress đọc trạng thái tải của
 * three.js (DefaultLoadingManager) nên dùng được cả bên ngoài Canvas.
 */
export const CanvasLoader: React.FC = () => {
  const { active, progress } = useProgress();
  if (!active) return null;
  const percent = Math.round(progress);

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="scene-loading" role="status">
        <span>Đang tải mô hình</span>
        <span className="scene-loading__bar" aria-hidden>
          <span style={{ width: `${Math.max(6, percent)}%` }} />
        </span>
      </div>
    </div>
  );
};
