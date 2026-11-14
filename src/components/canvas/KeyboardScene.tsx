'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { KeyboardModel } from './KeyboardModel';
import { CanvasLoader } from './CanvasLoader';
import { CameraFraming } from './CameraFraming';

// Bộ điều khiển vị trí Camera theo Preset mượt mà
const CameraController: React.FC = () => {
  const cameraPreset = useKeyboardStore((s) => s.cameraPreset);
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    let targetPos: [number, number, number] = [0, 5, 6.5];

    switch (cameraPreset) {
      case 'top':
        targetPos = [0, 9, 0.01];
        break;
      case 'front':
        targetPos = [0, 2, 6];
        break;
      case 'side':
        targetPos = [7, 2.5, 0];
        break;
      case 'isometric':
        targetPos = [5.5, 5, 5.5];
        break;
      case 'perspective':
      default:
        targetPos = [0, 5, 6.5];
        break;
    }

    camera.position.set(targetPos[0], targetPos[1], targetPos[2]);
    camera.lookAt(0, 0, 0);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [cameraPreset, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2.15} // Không cho camera chui xuống dưới đáy bàn
      minDistance={3.5}
      maxDistance={14}
    />
  );
};

export const KeyboardScene: React.FC = () => {
  return (
    <div className="relative w-full h-full min-h-[500px]">
      <Canvas
        shadows
        camera={{ position: [0, 5, 6.5], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        {/* Lens shift: đặt mô hình vào giữa vùng không bị panel UI che */}
        <CameraFraming />

        <Suspense fallback={<CanvasLoader />}>
          {/* Hệ thống Ánh sáng Studio Cinematic */}
          <ambientLight intensity={0.6} color="#94a3b8" />
          
          {/* Key Light (Ánh sáng chính góc trên trái phía trước) */}
          <directionalLight
            position={[6, 9, 6]}
            intensity={2.2}
            color="#ffffff"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={1}
            shadow-camera-far={25}
            shadow-bias={-0.0001}
          />

          {/* Rim Light (Ánh sáng ven tạo viền phản quang kim loại phía sau) */}
          <directionalLight
            position={[-7, 6, -7]}
            intensity={1.8}
            color="#38bdf8"
          />

          {/* Fill Light (Ánh sáng phụ dịu nhẹ) */}
          <directionalLight
            position={[0, -2, 5]}
            intensity={0.4}
            color="#a855f7"
          />

          {/* Mô hình bàn phím cơ 7 lớp procedural */}
          <KeyboardModel />

          {/* Đổ bóng tiếp xúc thực tế dưới đáy bàn phím */}
          <ContactShadows
            position={[0, -0.44, 0]}
            opacity={0.85}
            scale={14}
            blur={1.8}
            far={4}
            resolution={1024}
            color="#000000"
          />

          {/* Sàn Studio phản chiếu mờ cao cấp */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.45, 0]}
            receiveShadow
          >
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial
              color="#07090e"
              roughness={0.25}
              metalness={0.8}
            />
          </mesh>

          {/* Điều khiển Camera & Tương tác xoay 3D */}
          <CameraController />

          {/* Hiệu ứng Hậu kỳ Bloom phát sáng cho RGB Underglow */}
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.75}
              luminanceSmoothing={0.9}
              intensity={1.1}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
};
export default KeyboardScene;
