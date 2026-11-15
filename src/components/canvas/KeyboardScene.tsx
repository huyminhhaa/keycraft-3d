'use client';

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Lightformer,
  MeshReflectorMaterial,
  OrbitControls,
  PerformanceMonitor,
} from '@react-three/drei';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useStageStore } from '@/store/useStageStore';
import { attachKeyboardListeners } from '@/lib/keyboard/pressedKeys';
import { INTRO, introPose, orbitAroundY, posedPosition, prefersReducedMotion, turntableStep } from '@/lib/ui/cinematic';
import type { CameraPreset } from '@/types/keyboard';
import { KeyboardModel } from './KeyboardModel';
import { CanvasLoader } from './CanvasLoader';
import { BASE_TARGET_Y, CAMERA_FOV, CameraFraming, explodedTargetY } from './CameraFraming';
import { Hotspots } from './Hotspots';

const TARGET: [number, number, number] = [0, BASE_TARGET_Y, 0];
/** Mặt bàn: ngay dưới chân cao su (tính cả độ nghiêng của vỏ) */
const FLOOR_Y = -0.19;

export const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  perspective: [0, 6.7, 6.3],
  top: [0, 9.6, 0.01],
  front: [0, 1.8, 9.1],
  side: [8.8, 2.8, 0],
  isometric: [6.2, 5.4, 6.2],
};

/**
 * Camera: đưa về đúng góc preset, chạy cảnh mở đầu một lần khi mô hình vừa tải xong,
 * và bàn xoay 360° (tự dừng khi người dùng tự kéo xoay).
 */
const CameraController: React.FC = () => {
  const cameraPreset = useKeyboardStore((s) => s.cameraPreset);
  const introDone = useStageStore((s) => s.introDone);
  const camera = useThree((s) => s.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const introStart = useRef<number | null>(null);
  const goal = useMemo(() => new THREE.Vector3(...CAMERA_POSITIONS.perspective), []);
  const target = useMemo(() => new THREE.Vector3(...TARGET), []);

  // Người bật "giảm chuyển động": bỏ cảnh mở đầu và bàn xoay
  useEffect(() => {
    if (prefersReducedMotion()) {
      useStageStore.getState().setAutoRotate(false);
      useStageStore.getState().setIntroDone(true);
    }
  }, []);

  useEffect(() => {
    if (!useStageStore.getState().introDone) return;
    // Giữ độ nâng tâm nhìn hiện tại (nếu đang tách lớp) khi đổi góc
    const { isExploded, explosionOffset } = useKeyboardStore.getState();
    const lift = explodedTargetY(isExploded, explosionOffset) - BASE_TARGET_Y;
    const [x, y, z] = CAMERA_POSITIONS[cameraPreset];
    camera.position.set(x, y + lift, z);
    camera.lookAt(0, BASE_TARGET_Y + lift, 0);
    controlsRef.current?.target.set(0, BASE_TARGET_Y + lift, 0);
    controlsRef.current?.update();
  }, [cameraPreset, camera]);

  useFrame((state, delta) => {
    const stage = useStageStore.getState();
    if (stage.introDone) {
      // Bàn xoay theo thời gian thực (rad/giây), không theo số khung hình như autoRotate của OrbitControls
      const controls = controlsRef.current;
      if (stage.autoRotate && controls) {
        orbitAroundY(state.camera.position, controls.target, turntableStep(delta));
        controls.update();
      }
      return;
    }
    if (introStart.current === null) introStart.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - introStart.current;
    posedPosition(goal, target, introPose(elapsed), state.camera.position);
    state.camera.lookAt(target);
    if (elapsed >= INTRO.duration) useStageStore.getState().setIntroDone(true);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={TARGET}
      enabled={introDone}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      onStart={() => useStageStore.getState().setAutoRotate(false)}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={4}
      maxDistance={15}
    />
  );
};

/** Gõ phím thật → phím 3D nhấn theo. */
const KeyboardListener: React.FC = () => {
  useEffect(() => attachKeyboardListeners(window), []);
  return null;
};

/**
 * Ánh sáng studio chụp sản phẩm: softbox trên đầu, dải sáng hai bên và một viền sáng phía sau
 * để mép nhôm vát bắt highlight. Chỉ dùng Lightformer, không tải file HDR nào từ mạng.
 */
const StudioLighting: React.FC = () => (
  <>
    <Environment resolution={256} frames={1} environmentIntensity={0.95}>
      <Lightformer form="rect" intensity={2.6} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[12, 5, 1]} />
      <Lightformer form="rect" intensity={1.7} position={[-7, 2.5, 2]} rotation-y={Math.PI / 2} scale={[7, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[7, 3, -3]} rotation-y={-Math.PI / 2} scale={[7, 1.4, 1]} />
      <Lightformer form="rect" intensity={1.4} position={[0, 2.2, -7]} scale={[14, 0.8, 1]} />
      <Lightformer form="rect" intensity={0.5} position={[0, 1.2, 9]} rotation-y={Math.PI} scale={[12, 1.2, 1]} />
    </Environment>
    <ambientLight intensity={0.1} />
    <directionalLight
      position={[3.5, 8, 5]}
      intensity={1.15}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={4}
      shadow-camera-bottom={-4}
    />
  </>
);

/** Bệ trưng bày tròn: rộng bằng thân vỏ TKL, góc vỏ chỉ chìa ra một chút khi xoay chéo như hàng trưng bày thật. */
export const PLINTH = { radius: 3.7, height: 0.3 } as const;

/**
 * Bệ trưng bày kiểu showroom: thân nhôm tối, mặt bóng phản chiếu, viền sáng mảnh cùng màu LED.
 * Mép tròn là mép thật của vật thể, nên không còn tấm sàn lộ mép (alphaMap bị MeshReflectorMaterial bỏ qua trên GPU thật).
 */
const DisplayPlinth: React.FC<{ highQuality: boolean }> = ({ highQuality }) => {
  const ledColor = useKeyboardStore((s) => s.underglowColor);
  const ledEnabled = useKeyboardStore((s) => s.underglowEnabled);

  return (
    <group position={[0, FLOOR_Y, 0]}>
      <mesh position={[0, -PLINTH.height / 2, 0]} receiveShadow>
        <cylinderGeometry args={[PLINTH.radius, PLINTH.radius * 1.02, PLINTH.height, 128]} />
        <meshStandardMaterial color="#1b1b1e" metalness={0.85} roughness={0.32} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
        <circleGeometry args={[PLINTH.radius - 0.03, 128]} />
        {highQuality ? (
          <MeshReflectorMaterial
            color="#17171a"
            metalness={0.5}
            roughness={0.75}
            resolution={512}
            blur={[300, 90]}
            mixBlur={1}
            mixStrength={1.6}
            mirror={0.6}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
          />
        ) : (
          <meshStandardMaterial color="#17171a" metalness={0.6} roughness={0.45} />
        )}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
        <ringGeometry args={[PLINTH.radius - 0.045, PLINTH.radius - 0.03, 160]} />
        <meshBasicMaterial color={ledEnabled ? ledColor : '#3a3a3f'} transparent opacity={ledEnabled ? 0.45 : 0.6} />
      </mesh>
    </group>
  );
};

/** Hiệu ứng hậu kỳ; ambient occlusion chỉ chạy khi máy đủ khoẻ. */
const PostEffects: React.FC<{ highQuality: boolean }> = ({ highQuality }) =>
  highQuality ? (
    <EffectComposer>
      {/* Bóng tối ở khe giữa các phím và chân keycap: thêm chiều sâu như ảnh chụp thật */}
      <N8AO halfRes aoRadius={0.35} distanceFalloff={0.5} intensity={1.6} quality="performance" />
      {/* Chỉ dải LED vượt ngưỡng sáng mới toả glow */}
      <Bloom luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
    </EffectComposer>
  ) : (
    <EffectComposer>
      <Bloom luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
    </EffectComposer>
  );

export const KeyboardScene: React.FC = () => {
  const highQuality = useStageStore((s) => s.highQuality);
  const setHighQuality = useStageStore((s) => s.setHighQuality);

  return (
  <div className="relative h-full w-full">
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ position: CAMERA_POSITIONS.perspective, fov: CAMERA_FOV }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <CameraFraming />
      <KeyboardListener />
      {/* FPS tụt dưới ngưỡng → tắt hẳn hiệu ứng nặng (không bật lại để tránh nhấp nháy) */}
      <PerformanceMonitor onDecline={() => setHighQuality(false)} onFallback={() => setHighQuality(false)} />
      <Suspense fallback={<CanvasLoader />}>
        <StudioLighting />
        <KeyboardModel />
        <Hotspots />
        <DisplayPlinth highQuality={highQuality} />
        <ContactShadows position={[0, FLOOR_Y + 0.004, 0]} opacity={0.6} scale={16} blur={2.4} far={2.5} resolution={1024} color="#000000" />
        <CameraController />
        <PostEffects highQuality={highQuality} />
      </Suspense>
    </Canvas>
  </div>
  );
};

export default KeyboardScene;
