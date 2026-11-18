'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { STAGE_FLOOR_Y } from '@/lib/keyboard/gltfModel';
import { prefersReducedMotion } from '@/lib/ui/cinematic';
import { KeyboardModel, getModelWidth } from './KeyboardModel';
import { StudioLighting } from './StudioLighting';

/**
 * Mô hình 3D ở trang chủ: bàn phím xoay nhẹ, tách 7 lớp rồi ghép lại, sau đó chuyển sang mẫu thật kế tiếp.
 * Dùng đúng KeyboardModel của Studio (cùng dữ liệu build), tắt nhãn chú thích và không nhận chuột
 * (bấm phím ở đây sẽ phát tiếng khi chưa nạp gói của mẫu — dễ gây hiểu nhầm).
 */

/** Các mẫu luân phiên: mỗi mẫu một nét nhận diện (màn hình lớn, khung skeletal, đáy halo, núm, ốp gỗ…) */
export const SHOWCASE_BUILDS = [
  'aula-l99',
  'gravastar-mercury-k1',
  'nuphy-halo75-v2',
  'aula-f75-reaper',
  'keychron-k2-he-se',
  'aula-s75-pro',
] as const;

/** Nhịp một mẫu (giây): ghép → tách lớp → ghép lại → mẫu kế */
export const SHOWCASE_TIMING = { assembled: 3.4, exploded: 2.8, settle: 1.8 } as const;
const CYCLE = SHOWCASE_TIMING.assembled + SHOWCASE_TIMING.exploded + SHOWCASE_TIMING.settle;

/** Pha hoạt cảnh tại thời điểm `t` giây kể từ đầu chu kỳ */
export const showcasePhase = (t: number): 'assembled' | 'exploded' | 'next' => {
  if (t >= CYCLE) return 'next';
  const { assembled, exploded } = SHOWCASE_TIMING;
  return t > assembled && t < assembled + exploded ? 'exploded' : 'assembled';
};

const CAMERA_FOV = 28;
const CAMERA_DIRECTION = new THREE.Vector3(0, 0.62, 1).normalize();

interface ShowcaseProps {
  cycling: boolean;
  reduced: boolean;
}

const Showcase: React.FC<ShowcaseProps> = ({ cycling, reduced }) => {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cycleStart = useRef<number | null>(null);
  const shownBuild = useRef<string | null>(null);
  const goal = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3(0, 0.3, 0));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const store = useKeyboardStore.getState();

    // Người dùng chọn mẫu khác (mục "Nghe thử"): bắt đầu chu kỳ mới với mẫu đó
    if (store.buildId !== shownBuild.current) {
      shownBuild.current = store.buildId ?? null;
      cycleStart.current = t;
    }
    if (cycleStart.current === null) cycleStart.current = t;

    const phase = cycling && !reduced ? showcasePhase(t - cycleStart.current) : 'assembled';
    if (phase === 'next') {
      const current = SHOWCASE_BUILDS.indexOf(store.buildId as (typeof SHOWCASE_BUILDS)[number]);
      const next = SHOWCASE_BUILDS[(current + 1) % SHOWCASE_BUILDS.length];
      store.applyBuild(next);
      shownBuild.current = next;
      cycleStart.current = t;
    } else if (store.isExploded !== (phase === 'exploded')) {
      store.setExploded(phase === 'exploded');
    }

    // Xoay qua lại nhẹ quanh góc 3/4 và bồng bềnh rất ít (giảm chuyển động: đứng yên)
    if (group.current) {
      group.current.rotation.y = reduced ? -0.32 : -0.32 + Math.sin(t * 0.32) * 0.3;
      group.current.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.035;
    }

    // Canh khung theo bề rộng mẫu hiện tại (60% tới full-size) và độ cao khi tách lớp
    const width = getModelWidth(store.layout, store.caseShape?.bezel);
    const halfFov = THREE.MathUtils.degToRad(CAMERA_FOV / 2);
    const aspect = Math.max(0.6, size.width / Math.max(1, size.height));
    const fitWidth = (width * 1.12) / (2 * Math.tan(halfFov) * aspect);
    const fitHeight = store.isExploded ? 4.6 / (2 * Math.tan(halfFov)) : 0;
    const distance = Math.max(5.2, fitWidth, fitHeight);
    const targetY = store.isExploded ? 1.25 : 0.25;
    const step = Math.min(1, delta * 2.4);
    goal.current.copy(CAMERA_DIRECTION).multiplyScalar(distance);
    goal.current.y += targetY;
    camera.position.lerp(goal.current, step);
    lookAt.current.y = THREE.MathUtils.lerp(lookAt.current.y, targetY, step);
    camera.lookAt(0, lookAt.current.y, 0);
  });

  return (
    <group ref={group}>
      <KeyboardModel showLabels={false} />
    </group>
  );
};

interface HeroKeyboardProps {
  /** false: dừng luân phiên mẫu (người dùng đang gõ nghe thử một mẫu) */
  cycling?: boolean;
}

const HeroKeyboard: React.FC<HeroKeyboardProps> = ({ cycling = true }) => {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced] = useState(prefersReducedMotion);

  // Mẫu đầu tiên khi mở trang (về từ Studio thì giữ mẫu đang chọn); rời trang thì ghép lớp lại
  useEffect(() => {
    if (!useKeyboardStore.getState().buildId) useKeyboardStore.getState().applyBuild(SHOWCASE_BUILDS[0]);
    return () => useKeyboardStore.getState().setExploded(false);
  }, []);

  // Cuộn khỏi màn hình thì dừng vẽ (tiết kiệm GPU/pin)
  useEffect(() => {
    const node = container.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className="pointer-events-none h-full w-full" aria-hidden>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ position: [0, 3.4, 5.6], fov: CAMERA_FOV }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      >
        <Suspense fallback={null}>
          <StudioLighting shadows={false} />
          <Showcase cycling={cycling} reduced={reduced} />
          <ContactShadows position={[0, STAGE_FLOOR_Y, 0]} opacity={0.55} scale={14} blur={2.6} far={2.5} resolution={256} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default HeroKeyboard;
