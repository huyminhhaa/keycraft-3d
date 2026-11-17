# 12 — Thư viện mẫu bàn phím: nạp file 3D `.glb` và tự làm mô hình giống thật

> Bài này dành cho người **chưa biết gì về 3D**. Đọc từ trên xuống, làm theo phần 6 là tự đưa được một mẫu bàn phím của riêng bạn lên web.

## 0. Nói thật trước: "giống ngoài đời 100%" đến từ đâu?

Code (như `keyboardGeometry.ts`) chỉ vẽ được hình **gần giống**: hộp bo góc, keycap vát. Để giống *đúng* Aurora 80, AULA F75, Wave75… cần **dữ liệu hình học thật** của chiếc phím đó. Có 3 nguồn:

| Nguồn | Giống thật | Chi phí | Ghi chú |
|---|---|---|---|
| Mua/tải file 3D (Sketchfab, CGTrader, CAD hãng/cộng đồng chia sẻ) | Cao | 0–vài trăm nghìn/mẫu | **Đọc kỹ giấy phép**: có cho đưa lên web không, có phải ghi tên tác giả không |
| Tự dựng trong Blender theo ảnh + thước đo | Cao nếu kỹ | Miễn phí, vài ngày/mẫu | Cách học tốt nhất, phần 6 hướng dẫn |
| Scan 3D bằng điện thoại (Polycam, RealityScan) | Rất cao về màu, kém ở chi tiết nhỏ | Miễn phí/rẻ | Cần có máy thật; bề mặt bóng/kim loại scan khó |

Web này giờ đã có **khung nạp**: file nào đặt tên bộ phận đúng quy ước là tự tách lớp, tự nhấn phím khi gõ, tự đổi màu.

---

## 1. Bách khoa công nghệ dùng trong task

### 1.1 glTF / GLB
- **Là gì:** định dạng file 3D mở của Khronos, được gọi là "JPEG của 3D". `.gltf` là JSON + file phụ; `.glb` là **một file nhị phân gộp tất cả** (hình, vật liệu, texture).
- **Tác dụng trong dự án:** mọi mẫu bàn phím ngoài mẫu dựng bằng code đều là một file `public/models/<ten>.glb`.
- **Cách dùng:** Blender → File → Export → glTF 2.0 → Format: *glTF Binary (.glb)*.
- **Pros:** trình duyệt nạp nhanh, giữ vật liệu PBR (kim loại, độ nhám), Blender/three.js hỗ trợ sẵn, nén được (Draco/meshopt).
- **Cons:** không giữ được mọi hiệu ứng của Blender (node shader phức tạp, modifier chưa apply); file chi tiết cao rất nặng.

### 1.2 `useGLTF` (drei) và `GLTFLoader` (three)
- **Là gì:** `GLTFLoader` đọc file glTF thành cây `Object3D` của three.js; `useGLTF(url)` là hook React bọc nó, có **cache** và tích hợp **Suspense**.
- **Tác dụng:** `src/components/canvas/GltfKeyboard.tsx` gọi `useGLTF(entry.url)`.
- **Cách dùng:**
  ```tsx
  const { scene } = useGLTF('/models/aurora-80.glb');
  const model = useMemo(() => scene.clone(true), [scene]); // bản sao riêng
  return <primitive object={model} />;
  ```
- **Pros:** đang tải thì `<Suspense fallback>` tự hiện vòng chờ; tải 1 lần dùng nhiều nơi.
- **Cons:** scene trong cache là **dùng chung** — sửa trực tiếp sẽ hỏng lần nạp sau, nên phải `clone`. Lỗi tải (404, file hỏng) *ném lỗi* → cần Error Boundary.

### 1.3 `GLTFExporter`
- **Là gì:** chiều ngược lại: cây `Object3D` → file `.glb`.
- **Tác dụng:** nút **"Tải file .glb để mở bằng Blender"** xuất chính bàn phím đang hiện trên web (`src/lib/keyboard/exportGlb.ts`). File mẫu `public/models/keycraft-starter.glb` được tạo bằng nút này.
- **Cách dùng:** `await new GLTFExporter().parseAsync(object, { binary: true })` → `ArrayBuffer`.
- **Pros:** cho bạn một file **đã đặt tên bộ phận đúng quy ước** để mở Blender sửa tiếp, khỏi bắt đầu từ số 0.
- **Cons:** chỉ chạy trong trình duyệt (cần canvas để xuất texture ký tự phím); đèn bị bỏ khỏi file vì vào Blender sẽ quá chói.

### 1.4 Zod `discriminatedUnion`
- **Là gì:** kiểu "hoặc A hoặc B", phân biệt bằng một trường (ở đây là `source`).
- **Tác dụng:** `src/lib/keyboard/models.ts` — mẫu `procedural` không cần `url`, mẫu `glb` bắt buộc `url` + `layout`. Khai báo sai thì `npm run dev` báo lỗi rõ ràng ngay.
- **Pros:** TypeScript tự hiểu `entry.url` chỉ có khi `entry.source === 'glb'`.
- **Cons:** thêm một lớp kiểm tra lúc chạy (rất nhẹ, chỉ 1 lần khi nạp module).

### 1.5 React Error Boundary
- **Là gì:** component dạng class có `getDerivedStateFromError`, bắt lỗi của cây con và hiện giao diện thay thế.
- **Tác dụng:** `ModelErrorBoundary` — file `.glb` thiếu hoặc hỏng thì hiện mẫu dựng bằng code và báo lỗi trong mục "Mẫu bàn phím", không làm trắng cả sân khấu 3D.
- **Cons:** chỉ viết được bằng class component (React chưa có hook tương đương).

### 1.6 Blender
- **Là gì:** phần mềm dựng 3D miễn phí, mã nguồn mở (blender.org).
- **Tác dụng:** nơi bạn sửa hình dáng vỏ, keycap cho giống mẫu thật rồi xuất `.glb`.
- **Pros:** miễn phí, cực nhiều video hướng dẫn, xuất glTF chuẩn.
- **Cons:** giao diện khó với người mới; cần vài buổi làm quen phím tắt.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1 Quy ước đặt tên — "hợp đồng" giữa file 3D và web
`src/lib/keyboard/modelParts.ts` quy định tên object:

| Tên trong Blender | Web hiểu là | Tách lớp | Đổi màu theo web |
|---|---|---|---|
| `TopCase`, `BottomCase` | vỏ trên / dưới | có | màu + chất liệu vỏ |
| `Plate` | plate | có | chất liệu plate |
| `PCB`, `Foam`, `Switches`, `Weight` | linh kiện | có | giữ màu trong file |
| `Keycaps` (nhóm) | cả hàng keycap | có | — |
| `Keycap_KeyA_alpha` | phím A, nhóm màu chính | đi theo `Keycaps` | màu keycap chính |
| `Keycap_Space_modifier` | phím cách, nhóm phím chức năng | | màu phím chức năng |
| `Legend` | ký tự in trên phím | đi theo cha | giữ màu trong file |
| `Detail_<gì cũng được>` | chân cao su, LED, ốc… | đi theo cha | giữ màu trong file |

Tên phím lấy theo chuẩn `KeyboardEvent.code` (`KeyA`, `Digit1`, `Enter`, `ShiftLeft`, `ArrowUp`…). Nhờ vậy gõ phím thật thì phím 3D lún đúng chỗ. Object tên lạ (`Cube.001`) lấy bộ phận theo **cha gần nhất** có tên hợp lệ.

Blender tự thêm `.001` khi trùng tên, và GLTFLoader xoá dấu chấm → `Keycap_KeyA_alpha001`. Hàm `parsePartName` đã bỏ số thừa đó.

### 2.2 Luồng dữ liệu khi chọn một mẫu `.glb`
```
DesignPanel (bấm "KeyCraft TKL (file .glb mẫu)")
  → useKeyboardStore.setModel(id)            // đổi modelId, layout theo file
  → KeyboardScene/ActiveKeyboard             // đọc getModelEntry(modelId)
      ├─ procedural → <KeyboardModel />
      └─ glb → <ModelErrorBoundary><GltfKeyboard entry/></ModelErrorBoundary>
GltfKeyboard
  1. useGLTF(url)              → tải file (Suspense hiện vòng chờ)
  2. scene.clone(true)         → bản sao riêng
  3. prepareModel(model)       → tìm gốc lớp, keycap theo mã phím, mesh cần đổi màu
  4. fitToStage(box, width)    → file tính bằng mm hay m cũng thu/phóng về đúng cỡ, đặt lên bệ
  5. useFrame mỗi khung hình   → applyNodePositions(): y = gốc + (độ tách lớp − độ lún phím) / tỉ lệ
                               → màu vỏ/keycap trượt dần về màu đang chọn (nếu recolor)
```

### 2.3 Vì sao chia cho `scale`?
Sân khấu tính bằng "đơn vị web" (1u phím = 0.38). File của bạn có thể tính bằng mm (1u = 19.05). `fitToStage` bọc mô hình trong `<group scale={s}>`. Muốn dời 0.07 đơn vị web thì trong toạ độ của file phải dời `0.07 / s`.

### 2.4 Nút xuất file
Sidebar nằm **ngoài** `<Canvas>` nên không gọi được `useThree`. `ExportSceneHandle` (trong Canvas) gửi `scene` vào `setExportScene`, nút xuất lấy lại bằng `getExportScene()` và tìm group tên `KeyCraftKeyboard`.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Cách | Ưu | Nhược |
|---|---|---|
| **Quy ước tên + một bộ nạp chung (đã chọn)** | Thêm mẫu = thêm file + 1 dòng, không viết code | Người làm file phải đặt tên đúng |
| Viết code riêng cho từng mẫu | Tinh chỉnh từng mẫu | 10 mẫu = 10 component, khó bảo trì |
| Chỉ hiện file, không tách lớp/nhấn phím | Đơn giản nhất | Mất tính năng "tách 7 lớp", gõ thử, đổi màu |

`recolor: false` dành cho mô hình scan/mua có texture thật: giữ đúng màu ngoài đời thay vì tô màu của web lên.

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Giữ màu gốc của file:** mở `src/lib/keyboard/models.ts` dòng 66, đổi `recolor: true` thành `recolor: false`. Chọn "KeyCraft TKL (file .glb mẫu)" rồi đổi màu vỏ: mô hình giữ nguyên màu đỏ của file.
2. **Phím lún sâu hơn:** `src/components/canvas/KeyboardModel.tsx` dòng 48, đổi `KEY_TRAVEL = 0.07` thành `0.15`. Gõ phím thật: cả mẫu code lẫn mẫu `.glb` đều lún sâu gấp đôi.
3. **Thêm mẫu thứ hai (bài tập chính):** bấm "Tải file .glb để mở bằng Blender" khi đang chọn layout 65% + vỏ xanh navy, lưu thành `public/models/keycraft-65.glb`, rồi thêm vào `MODEL_ENTRIES` (models.ts):
   ```ts
   { id: 'keycraft-65', name: 'KeyCraft 65% navy', source: 'glb', url: '/models/keycraft-65.glb', layout: '65%', recolor: false },
   ```
   Tải lại trang: mẫu mới xuất hiện trong danh sách.

---

## 5. 3 câu hỏi phỏng vấn thực chiến

**Q1. Vì sao phải `scene.clone(true)` sau `useGLTF`?**
`useGLTF` cache theo url và trả về **cùng một** đối tượng cho mọi lần gọi. Đổi material, dời vị trí trên bản gốc sẽ làm hỏng lần mount sau (vd chuyển mẫu rồi quay lại thì các lớp vẫn đang tách). Clone tạo cây node riêng nhưng dùng chung geometry nên không tốn thêm bộ nhớ cho đỉnh.

**Q2. File 3D người dùng tải về tính bằng mm, có cái tính bằng m. Làm sao hiển thị đúng cỡ mà không bắt họ sửa file?**
Tính hộp bao (`Box3.setFromObject`), lấy tỉ lệ = bề ngang mong muốn / bề ngang thật, canh giữa x/z, đặt `min.y` lên mặt sàn. Mọi chuyển động sau đó (tách lớp, nhấn phím) đổi từ đơn vị sân khấu về đơn vị file bằng cách chia cho tỉ lệ (`fitToStage`, `applyNodePositions`).

**Q3. Nếu file `.glb` hỏng hoặc bị xoá, trang web phản ứng thế nào và vì sao không trắng màn hình?**
`useGLTF` ném lỗi khi tải thất bại. `ModelErrorBoundary` bắt lỗi đó, hiện `<KeyboardModel />` thay thế và gọi `setModelError`, mục "Mẫu bàn phím" hiện thông báo. Boundary có `key={entry.id}` nên chọn mẫu khác thì nó reset và thử lại từ đầu.

---

## 6. Lộ trình tự làm một mẫu giống thật (cho người mới hoàn toàn)

**Buổi 1 — làm quen Blender (2–3 giờ)**
1. Cài Blender bản mới nhất từ blender.org.
2. Xem một khoá cơ bản miễn phí (tìm "Blender beginner donut tutorial"): chỉ cần biết xoay/zoom (chuột giữa), chọn object, `G` di chuyển, `S` co giãn, `R` xoay, `Tab` vào chế độ sửa đỉnh.

**Buổi 2 — mở file mẫu**
1. Trên web: chọn layout và màu gần với mẫu bạn muốn làm, bấm **Tải file .glb để mở bằng Blender**.
2. Blender: File → Import → glTF 2.0 → chọn file vừa tải.
3. Nhìn bảng *Outliner* (góc trên phải): bạn sẽ thấy `TopCase`, `BottomCase`, `Plate`, `Keycaps` → `Keycap_KeyA_alpha`… Đó chính là quy ước ở phần 2.1.

**Buổi 3+ — sửa cho giống mẫu thật**
1. Tìm ảnh sản phẩm chụp thẳng từ trên và từ cạnh bên, cùng kích thước dài × rộng × cao của nhà sản xuất.
2. Kéo ảnh vào Blender làm ảnh nền tham chiếu (Add → Image → Reference).
3. Sửa `TopCase`/`BottomCase` cho khớp đường viền, góc bo, độ dày viền, góc nghiêng gõ. Thêm chi tiết bằng object tên `Detail_...` (núm xoay, logo, cổng USB).
4. Màu thật: chọn object → tab Material → chỉnh *Base Color*, *Metallic*, *Roughness*.

**Xuất và đưa lên web**
1. File → Export → glTF 2.0 → Format **glTF Binary (.glb)**, tick *Apply Modifiers*. Để `+Y Up` mặc định.
2. Lưu vào `public/models/<ten-mau>.glb`.
3. Thêm một dòng vào `MODEL_ENTRIES` trong `src/lib/keyboard/models.ts` (như thử thách 3). Nếu mô hình có màu thật thì để `recolor: false`. Ghi `credit` nếu file là của người khác.
4. Chạy `npm test -- --run`: test sẽ báo nếu url khai báo không có file thật.

**Lưu ý dung lượng:** giữ mỗi file dưới khoảng 5 MB để web mượt. File nặng thì dùng `npx @gltf-transform/cli optimize in.glb out.glb` (nén hình học + texture).
