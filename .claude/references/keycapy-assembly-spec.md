# Feature Specification: KeyCapy-Style Photorealistic 3D & /assembly Builder

## 1. Công thức Render 3D Siêu Thực (Bắt buộc áp dụng để đạt 85% chất lượng KeyCapy)
Tuyệt đối không dựng keycap bằng BoxGeometry phẳng. Phải thực hiện đúng 4 kỹ thuật sau:

1. **Sculpted Keycap Vertex Deformation (`src/lib/keycapGeometry.ts`):**
   - Khởi tạo base mesh bằng `RoundedBoxGeometry(width, height, depth, 6, radius)` với nhiều subdivisions để biến dạng mượt.
   - Duyệt qua từng vertex có `y > 0` (nửa trên keycap):
     - **Taper (thu nhỏ mặt trên):** Thu hẹp `x` và `z` dần về đỉnh (`topScale`: `0.78` cho Cherry/OEM, `0.72` cho SA, `0.86` cho XDA/MOA).
     - **Concave Dish (khoét lõm mặt phím):** Tính khoảng cách chuẩn hóa `r` từ tâm mặt trên; trừ tọa độ `y` đi `dishDepth * Math.max(0, 1 - r * r)`:
       - `moa`: `radius = 0.09` (bo tròn 4 góc cực mềm như viên kẹo), chiều cao đồng đều, lõm tròn giữa (`dishDepth = 0.045`).
       - `cherry`: `radius = 0.025`, thấp gọn, nghiêng theo từng hàng R1–R4, lõm hình trụ theo trục X (`dishDepth = 0.035`).
       - `oem`: Tương tự Cherry nhưng cao hơn 18% và độ dốc lớn hơn.
       - `xda`: Chiều cao đồng đều, mặt rộng, bo nhẹ (`radius = 0.04`), lõm nhẹ (`dishDepth = 0.025`).
       - `sa`: Cao vút (+35% chiều cao), bo tròn cổ điển, lõm sâu hình cầu (`dishDepth = 0.055`).

2. **Micro-PBR Materials & Crisp Legends (`src/lib/textures.ts`):**
   - Sinh `DataTexture` nhiễu hạt mịn (`256x256`) làm `roughnessMap` và `bumpMap`:
     - **PBT Keycap:** `roughness: 0.72`, `bumpScale: 0.0018`, màu pastel/cream tự nhiên.
     - **CNC Aluminum Case:** `metalness: 0.85`, `roughness: 0.26`, có viền vát chamfer quanh mép case.
     - **Switch Housing:** `MeshPhysicalMaterial` với `transmission: 0.7`, `ior: 1.48`, `roughness: 0.15`, để lộ rõ **Stem chữ thập `+`** và lá đồng/lò xo bên trong.
   - **Legends:** Vẽ bằng Canvas `512x512` (font sans-serif gọn đẹp), gán `texture.anisotropy = 8` để chữ sắc nét ở mọi góc nghiêng.

3. **Crevice Shadows & Studio Lighting:**
   - Bắt buộc dùng `<EffectComposer multisampling={4}><N8AO aoRadius={0.45} intensity={2.0} distanceFalloff={0.7} /><Bloom mipmapBlur luminanceThreshold={1.15} intensity={0.35} /></EffectComposer>` để tạo bóng đổ tối tự nhiên trong khe giữa các nút phím.
   - Canvas cấu hình `gl={{ toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 }}`, `<Environment preset="apartment" />`, nền sáng ấm (`#eae5dc` hoặc bàn gỗ tối ấm `#24201d`), kèm `DirectionalLight` màu nắng ấm (`#fff3e0`, `intensity={2.4}`, `castShadow`, `shadow-mapSize={[2048, 2048]}`) và `<ContactShadows opacity={0.5} blur={2} />`.

4. **Cozy Desk Environment Props (`src/components/canvas/DeskEnvironment.tsx`):**
   - Tấm **Deskmat vải dệt** lớn dưới phím (có texture dệt vải + viền chỉ bo quanh mép, cho phép đổi màu/họa tiết).
   - **Coiled Aviator Cable:** Dựng bằng `CatmullRomCurve3` tạo đoạn dây xoắn lò xo + đầu nối kim loại Aviator cắm vào cạnh trên bàn phím.
   - 1–2 vật trang trí tối giản ở góc bàn (chậu cây mini / cốc gốm nhỏ).

## 2. Luồng tương tác trang `/assembly` (Tự build phím từ A–Z)
- Tạo route `src/app/assembly/page.tsx` và gắn nút chuyển đổi `Studio` / `Assembly` rõ ràng trên thanh điều hướng.
- **4 Bước lắp ráp trực quan:**
  1. **Chọn Case:** Chọn chất liệu & màu vỏ phím (Nhôm CNC Bạc/Đỏ/Đen, Nhựa trắng sữa, Acrylic mờ, Gỗ óc chó). Case nằm sẵn trên bàn lộ rõ Plate và các lỗ Socket Hot-swap.
  2. **Chọn Switch & Kéo thả lắp vào phím:**
     - Chia nhóm rõ ràng: `Linear`, `Clacky`, `Thocky`, `Tactile`, `Silent` (mỗi loại có màu stem và thông số âm thanh riêng).
     - **Kéo thả (Drag & Drop) + Quét chuột (Paint-Drag):** Kéo switch từ khay thả vào từng ô socket (hiển thị ghost preview xanh lá tại ô đang trỏ chuột) HOẶC giữ chuột kéo ngang qua cả hàng phím để cắm liên tục với hiệu ứng rơi nảy lò xo (`spring damping`). Có nút "Lắp nhanh toàn bộ Switch".
  3. **Chọn Keycap Profile & Kéo thả lắp đè lên Switch:**
     - Chọn phối màu keycap + chọn Profile (`Cherry`, `OEM`, `XDA`, `MOA`, `SA`).
     - **Ràng buộc thực tế:** Chỉ cho phép lắp keycap lên ô **đã có switch** (nếu thả vào ô trống chưa có switch thì rung nhẹ và nhắc *"Hãy cắm Switch vào vị trí này trước"*). Hỗ trợ cả kéo thả từng nút lẫn quét chuột lắp hàng loạt.
  4. **Test Gõ Phím Thực Tế:**
     - Gõ trên bàn phím thật của người dùng -> nút 3D lún xuống `3.6mm` theo hành trình thật và phát âm thanh Web Audio API kết hợp từ **Vật liệu Case + Loại Switch (`Clacky`/`Thocky`/`Silent`) + Độ vang khoang Profile Keycap (`SA`/`MOA` trầm ấm hơn `Cherry`/`OEM`)**.