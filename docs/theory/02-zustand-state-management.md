# 02. Quản Lý Trạng Thái 3D & AI Với Zustand Store

> **Chủ đề:** Xây dựng Trung tâm điều phối trạng thái (Single Source of Truth) bằng Zustand cho ứng dụng 3D Studio, đồng bộ 2 chiều giữa UI, Canvas 3D, Web Audio và AI Tool Calling.  
> **Mục tiêu:** Nắm vững cơ chế hoạt động của Zustand, cách tránh re-render ngoài ý muốn trong render loop 60/120 FPS của Three.js, và cách thiết kế store chuẩn mở rộng cho AI Agentic UI.

---

## 1. Bản chất hoạt động (Under the hood)

### 1.1. Luồng dữ liệu qua Zustand Store
Trong các ứng dụng thông thường, giao diện chỉ gồm các thẻ HTML DOM 2D. Nhưng trong KeyCraft 3D, chúng ta có đồng thời:
1. **Giao diện HTML 2D** (các thanh điều khiển, nút bấm Glassmorphism, khung chat AI).
2. **WebGL Context 3D** (React Three Fiber render liên tục qua card đồ họa).
3. **Web Audio Context** (xử lý xung âm thanh gõ phím).
4. **AI Assistant** (nhận diện ý định người dùng và gọi hàm thay đổi giao diện).

Nếu dữ liệu phân tán, các khối này sẽ xung đột và làm chậm khung hình. **Zustand** giải quyết triệt để vấn đề này bằng cách hoạt động như một **Bộ nhớ tập trung ngoài cây React (External State Store)**:

```
                    +--------------------------------------------+
                    |             NGUỒN THAY ĐỔI                 |
                    |  - Người dùng bấm nút trên Toolbar         |
                    |  - Người dùng gõ phím vật lý               |
                    |  - AI Tool Calling: applyAIConfig({...})   |
                    +---------------------+----------------------+
                                          |
                                          v (Gọi Action)
                    +--------------------------------------------+
                    |        ZUSTAND STORE (useKeyboardStore)    |
                    |  - layout: '65%' | '75%' | 'TKL'           |
                    |  - isExploded: boolean                     |
                    |  - plateMaterial: 'aluminum' | 'pom'...    |
                    |  - soundProfile: { pitch, damping... }     |
                    +----+-------------------+--------------+----+
                         |                   |              |
         (Selector Hook) |   (Transient read)|              | (React State hook)
                         v   (getState())    v              v
     +---------------------+  +----------------+  +--------------------+
     | 3D Component        |  | Three.js Loop  |  | UI Controls        |
     | (KeyboardModel.tsx) |  | (useFrame)     |  | (ConfigToolbar.tsx)|
     | Chỉ re-render khi   |  | Đọc trực tiếp  |  | Re-render khi      |
     | chất liệu/màu đổi   |  | tọa độ lerp Y  |  | chuyển tab/preset  |
     +---------------------+  +----------------+  +--------------------+
```

### 1.2. Phân tích các file vừa tạo
- [`src/types/keyboard.ts`](file:///d:/Projects/keycraft-3d/src/types/keyboard.ts): Định nghĩa kiểu dữ liệu nghiêm ngặt (Strict TypeScript Types) cho mọi biến thể bàn phím: layout, vật liệu case/plate, switch type, góc camera, và thông số âm học. Tuyệt đối không dùng `any`.
- [`src/store/useKeyboardStore.ts`](file:///d:/Projects/keycraft-3d/src/store/useKeyboardStore.ts):
  - Hàm `calculateSoundProfile`: Tự động tính toán tần số pitch, độ vang (resonance) và triệt tiêu dao động (damping) mỗi khi người dùng thay đổi Plate hoặc Switch.
  - Action `applyAIConfig`: Cho phép AI đưa vào một phần cấu hình (partial update) và tự động chuẩn hóa các giá trị biên (clamping độ sáng từ 0-1, khoảng cách tách lớp từ 0.5-3.0).
- [`src/store/useKeyboardStore.test.ts`](file:///d:/Projects/keycraft-3d/src/store/useKeyboardStore.test.ts): Bộ 16 unit tests kiểm tra toàn diện 100% các hành vi của store.

---

## 2. Tại sao chọn cách này (Trade-offs & Decisions)

| Tiêu chí | Zustand | Redux Toolkit | React Context API |
| :--- | :--- | :--- | :--- |
| **Kích thước thư viện** | **~1.1 KB** (siêu nhẹ) | ~11 KB (khá nặng) | 0 KB (tích hợp sẵn trong React) |
| **Độ phức tạp (Boilerplate)** | Rất thấp, định nghĩa store trong 1 file | Cao (cần Slice, Thunk, Dispatch, Provider bao quanh root) | Trung bình (cần tạo Context, Provider, Custom Hook) |
| **Hiệu năng với 3D (60 FPS)** | **Tối ưu tuyệt đối:** Cho phép component lắng nghe chỉ 1 biến cụ thể (`useKeyboardStore(s => s.isExploded)`), hoặc đọc trực tiếp bằng `getState()` không gây re-render | Tốt với selector, nhưng cấu trúc cồng kềnh cho WebGL loop | **Kém nhất:** Bất kỳ state nào trong Context thay đổi đều ép toàn bộ component con re-render, gây giật lag Canvas 3D |
| **Gọi ngoài luồng React** | Gọi trực tiếp ở bất cứ đâu (`useKeyboardStore.getState().setLayout(...)`) | Cần `store.dispatch` | Không thể gọi ngoài cây React component |

---

## 3. Thử thách tự tay sửa code (5 phút)

Hãy thử nghiệm cách Zustand phản ứng với logic kinh doanh của bàn phím cơ:

### Thử thách 1: Bổ sung chất liệu Plate mới "Đồng thau" (Brass)
1. Mở file [`src/types/keyboard.ts`](file:///d:/Projects/keycraft-3d/src/types/keyboard.ts#L3).
2. Sửa `PlateMaterial` để hỗ trợ thêm `'brass'`:
   ```typescript
   export type PlateMaterial = 'aluminum' | 'polycarbonate' | 'pom' | 'fr4' | 'brass';
   ```
3. Mở file [`src/store/useKeyboardStore.ts`](file:///d:/Projects/keycraft-3d/src/store/useKeyboardStore.ts#L31), trong hàm `calculateSoundProfile`, thêm nhánh xử lý âm thanh cho plate đồng (đồng thau rất cứng và vang cao):
   ```typescript
   case 'brass':
     platePitch = 1.35;
     plateResonance = 1.3;
     plateDamping = 0.9;
     break;
   ```
4. Chạy lệnh:
   ```bash
   npm test -- --run
   ```
5. **Quan sát:** Tất cả test vẫn pass mượt mà và hệ thống của bạn đã sẵn sàng hỗ trợ plate đồng!

### Thử thách 2: Thay đổi màu mặc định của Underglow RGB
1. Mở file [`src/store/useKeyboardStore.ts`](file:///d:/Projects/keycraft-3d/src/store/useKeyboardStore.ts#L80).
2. Tìm dòng `underglowColor: '#00f0ff'` (màu Cyan neon).
3. Đổi thành màu tím neon Cyberpunk:
   ```typescript
   underglowColor: '#a855f7',
   ```
4. Chạy `npm test -- --run` và quan sát xem giá trị khởi tạo mới hoạt động chính xác.

---

## 4. Ba câu hỏi phỏng vấn thực chiến (Interview Q&A)

### Câu hỏi 1: "Transient Updates" trong Zustand là gì và tại sao nó là "vũ khí bí mật" khi lập trình 3D với Three.js?
> **Đáp án:**  
> Thông thường khi state thay đổi, React sẽ re-render lại component. Nhưng trong hoạt họa 3D (Render loop của Three.js), việc re-render component React 60 lần mỗi giây sẽ làm sập hiệu năng CPU.  
> **Transient Updates** là kỹ thuật cập nhật hoặc đọc trực tiếp giá trị từ store mà **không kích hoạt vòng lặp render của React**. Ví dụ trong hook `useFrame`:
> ```typescript
> useFrame(() => {
>   const isExploded = useKeyboardStore.getState().isExploded;
>   // Tính toán vị trí mesh trực tiếp bằng GPU matrix mà không re-render component
> });
> ```
> Điều này giúp ứng dụng 3D đạt tốc độ khung hình 60–120 FPS ổn định mà vẫn kết nối liền mạch với trạng thái chung.

---

### Câu hỏi 2: Sự khác nhau giữa việc lấy state `const state = useKeyboardStore()` và `const isExploded = useKeyboardStore(state => state.isExploded)` là gì?
> **Đáp án:**  
> - Cách 1 (`useKeyboardStore()`): Component đăng ký lắng nghe **toàn bộ Store**. Bất kỳ thuộc tính nào thay đổi (dù chỉ là đổi màu đèn LED RGB), component này cũng bị ép re-render lại toàn bộ.
> - Cách 2 (`useKeyboardStore(state => state.isExploded)`): Sử dụng **Selector**. Component chỉ đăng ký theo dõi duy nhất biến `isExploded`. Chỉ khi biến này đổi từ `false` sang `true` (hoặc ngược lại), component mới re-render. Mọi thay đổi ở các thuộc tính khác (màu sắc, âm lượng, switch) sẽ hoàn toàn bị bỏ qua, giúp tiết kiệm tài nguyên tính toán.

---

### Câu hỏi 3: Làm thế nào để đảm bảo tính an toàn dữ liệu (Data Integrity) khi AI Tool Calling gửi cấu hình sai hoặc bất thường vào Store?
> **Đáp án:**  
> Có 2 tầng bảo vệ:
> 1. **Tầng API Schema Validation (Zod):** Tại endpoint API của AI, ta dùng thư viện Zod để kiểm tra kiểu dữ liệu và giới hạn enum (chỉ chấp nhận các giá trị layout hợp lệ như `'65%'`, `'75%'`, `'TKL'`).
> 2. **Tầng Store Defensive Guarding:** Trong hàm `applyAIConfig` của Zustand, ta chủ động giới hạn (clamp) các giá trị số bằng `Math.max()` và `Math.min()` (ví dụ: độ sáng `underglowBrightness` bắt buộc nằm trong khoảng `[0, 1]`, khoảng cách bung lớp `explosionOffset` nằm trong `[0.5, 3.0]`). Điều này ngăn chặn tình trạng AI sinh ra tham số dị biệt làm vỡ mô hình 3D trên màn hình.
