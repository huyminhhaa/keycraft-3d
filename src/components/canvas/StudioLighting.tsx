'use client';

import React from 'react';
import { Environment, Lightformer } from '@react-three/drei';

/**
 * Ánh sáng studio chụp sản phẩm: softbox trên đầu, dải sáng hai bên và một viền sáng phía sau
 * để mép nhôm vát bắt highlight. Chỉ dùng Lightformer, không tải file HDR nào từ mạng.
 * Dùng chung cho sân khấu Studio và mô hình ở trang chủ.
 */
export const StudioLighting: React.FC<{ shadows?: boolean }> = ({ shadows = true }) => (
  <>
    <Environment resolution={512} frames={1} environmentIntensity={0.95}>
      {/* Softbox trên đầu: ánh sáng chính, phản chiếu thành mảng sáng mềm trên keycap và mặt nhôm */}
      <Lightformer form="rect" intensity={2.6} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[12, 5, 1]} />
      <Lightformer form="rect" intensity={1.7} position={[-7, 2.5, 2]} rotation-y={Math.PI / 2} scale={[7, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[7, 3, -3]} rotation-y={-Math.PI / 2} scale={[7, 1.4, 1]} />
      {/* Dải rim mảnh, sáng gắt phía sau: vạch một đường sáng sắc dọc cạnh vát chamfer 45° */}
      <Lightformer form="rect" intensity={4.5} position={[0, 2.6, -6.5]} scale={[16, 0.25, 1]} />
      <Lightformer form="rect" intensity={1.4} position={[0, 2.2, -7]} scale={[14, 0.8, 1]} />
      <Lightformer form="rect" intensity={0.5} position={[0, 1.2, 9]} rotation-y={Math.PI} scale={[12, 1.2, 1]} />
      {/* Đèn vòng nhỏ phía trên-trái: điểm bắt sáng trên chân đồng mạ vàng */}
      <Lightformer form="ring" intensity={3} position={[-3, 5, 3]} scale={1.2} />
    </Environment>
    <ambientLight intensity={0.1} />
    <directionalLight
      position={[3.5, 8, 5]}
      intensity={1.15}
      castShadow={shadows}
      shadow-mapSize={[2048, 2048]}
      // bias âm nhỏ + normalBias theo pháp tuyến: hết sọc "shadow acne" trên mặt nghiêng mà bóng không bị hở chân
      shadow-bias={-0.00015}
      shadow-normalBias={0.035}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={4}
      shadow-camera-bottom={-4}
      shadow-camera-near={1}
      shadow-camera-far={20}
    />
    {/* Rim light ngược sáng (không đổ bóng): tách viền bàn phím khỏi nền tối */}
    <directionalLight position={[-4, 3, -6]} intensity={0.55} color="#dfe7ff" />
  </>
);
