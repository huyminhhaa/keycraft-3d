# 19 — Mô hình bàn phím chuẩn CAD: 7 lớp linh kiện thật, dáng vỏ theo từng dòng phím, 20 build thật

> Task 3.6. Nâng mô hình procedural từ các khối hộp lên linh kiện đúng kích thước cơ khí (switch MX 5-pin, plate có lỗ khoét, PCB có mạch in, vỏ nêm 6.5°), thêm dáng vỏ nhận diện cho từng dòng phím và mở rộng thư viện lên 20 build có thông số, tiếng và ảnh thật.

## 1. Bách khoa công nghệ dùng trong task

### 1.1 InstancedMesh
- **Là gì:** một lệnh vẽ (draw call) cho N bản sao cùng hình học + vật liệu, mỗi bản sao có ma trận vị trí riêng.
- **Tác dụng:** 87 switch × 5 bộ phận (vỏ trên, thấu kính LED, vỏ dưới, chân đồng, stem) = 435 vật thể chỉ tốn **5 draw call**. Socket hotswap, LED SMD, stabilizer, tai gasket, chân cao su, ốc vít… đều dùng `StaticInstances` (`parts/StaticInstances.tsx`).
- **Cách dùng:** `<instancedMesh args={[geometry, material, count]} />` rồi `mesh.setMatrixAt(i, matrix)`, `mesh.instanceMatrix.needsUpdate = true`.
- **Pros:** giữ 60fps dù có hàng nghìn chi tiết. **Cons:** mọi bản sao chung một vật liệu; muốn một bản sao chuyển động phải tự cập nhật ma trận (stem lún theo keycap: `SwitchLayer.tsx` chỉ ghi lại ma trận nào vừa đổi).

### 1.2 ExtrudeGeometry có lỗ (Shape.holes)
- **Là gì:** ép đùn một hình 2D thành khối 3D; `shape.holes` khoét lỗ xuyên.
- **Tác dụng:** plate có lỗ switch 14×14mm, lỗ stabilizer 6.75×12.3mm, rãnh flex-cut 1mm giữa các hàng; foam Poron có lỗ tương ứng (`geometry/plateGeometry.ts`).
- **Lưu ý toạ độ:** shape vẽ trên mặt XY rồi xoay −90° quanh X, nên trục y của shape thành **−z** thế giới — phải đảo dấu z khi đặt lỗ (có test riêng cho chỗ này).

### 1.3 mergeGeometries
- **Là gì:** gộp nhiều BufferGeometry thành một (`three/examples/jsm/utils/BufferGeometryUtils.js`).
- **Tác dụng:** vỏ dưới switch = hộp bo góc + trụ giữa + 2 chân nhựa gộp thành 1 hình → 1 draw call.
- **Bẫy đã gặp:** `RoundedBoxGeometry` không có index còn Box/Cylinder có → phải `toNonIndexed()` hết rồi mới gộp.

### 1.4 Texture procedural đóng gói kênh (channel packing)
- **Là gì:** vẽ texture bằng Canvas 2D thay vì tải ảnh. three.js đọc `bumpMap` ở kênh **R**, `roughnessMap` ở **G**, `metalnessMap` ở **B** ⇒ một ảnh "dữ liệu" dùng cho cả ba map.
- **Tác dụng (`geometry/proceduralTextures.ts`):** hạt nhựa PBT, nhôm phun cát, đồng phay xước, sợi FR4, lỗ khí Poron, vân gỗ, PCB (mạch đồng, pad vàng ENIG, via, chữ SW1/D1…), màn hình LCD.
- **Pros:** không tốn băng thông, mọi bàn phím dùng chung (cache). **Cons:** cần canvas — trong test (jsdom) hàm trả về `null` và vật liệu chạy không có map.

### 1.5 LatheGeometry
- **Là gì:** "tiện" một biên dạng 2D quanh trục Y như máy tiện.
- **Tác dụng:** núm xoay nhôm: biên dạng có đỉnh vát chamfer; sau đó đẩy bán kính các đỉnh thân theo sóng tam giác để tạo rãnh khía (AULA khía mịn 60 rãnh, mặc định 36).

### 1.6 Loft keycap (tự dựng BufferGeometry)
- Thành keycap = các vòng viền bo góc thu nhỏ dần lên trên; mặt trên = các vòng nhỏ dần về tâm.
- **Cherry:** lòng chảo trụ (chỉ lõm theo chiều ngang), nghiêng theo hàng. **MOA:** cao đều, bo tròn, lòng chảo cầu (lõm cả hai chiều).
- Ký tự in là một tấm lưới uốn theo đúng lòng chảo (`createLegendGeometry`), không lơ lửng ở giữa hay chìm ở mép.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1 Toạ độ và kích thước thật
`1u = 19.05mm = 0.38` đơn vị thế giới ⇒ `MM = 0.38 / 19.05`. Mọi kích thước MX viết bằng mm rồi nhân `MM`:
```
mặt plate (y=0) ── vỏ trên switch 4.5mm ── stem tới 8.4mm (chui vào keycap ở 7.5mm)
         └─ vỏ dưới lọt qua lỗ 14mm, đáy chạm PCB ở −6.25mm; chân đồng (−3.81,−2.54) & (2.54,−5.08)
```

### 2.2 Vỏ nêm 6.5°
Cả bàn phím xoay `TYPING_ANGLE` quanh X. Để đáy vẫn phẳng trên bàn, đáy vỏ dưới được cắt theo `y = CASE_BOTTOM_Y + z·tan(6.5°)` (`geometry/caseGeometry.ts`): mép sau dày hơn mép trước, khoang rỗng bên trong sâu dần về phía sau. Chân cao su, tạ đồng, badge, tạ gương PVD đều xoay ngược −6.5° để nằm phẳng.

### 2.3 Dáng vỏ theo dòng phím (shellStyle) — `parts/ShellParts.tsx`
| shellStyle | Chi tiết dựng thêm | Build |
|---|---|---|
| aula | rãnh ghép 2 mảnh, chân chống 2 nấc, khe dongle, đèn báo, núm khía mịn | AULA F75 ×2, F99 Pro |
| hi75 | núm to có vòng viền vàng, badge kim loại đáy, góc vuông | Leobog Hi75 (keycap MOA), Hi75C Pro |
| lucky65 | 4 chốt bi nam châm trong lòng vỏ, tạ gương PVD | Lucky65 V2 ×3, Bridge75 Plus, Crush 80 Reboot Pro |
| x85 | hai hông vát chéo, đèn báo | Attack Shark X85 |
| halo-rgb | đáy nhựa trong mờ + dải Halo đổi màu | NuPhy Halo75 V2 |
| wood-accent | hai thanh ốp gỗ hông | Keychron K2 HE Special Edition |
| lcd-75 | module LCD 2U thay 2 phím góc phải | Meletrix Zoom75 |
| frosted-pc | vỏ PC mờ (vật liệu polycarbonate) | Mode Envoy |

### 2.4 Hybrid .glb
`buildModelEntry(build)`: build có `modelUrl` → `GltfKeyboard` nạp file thật (giữ màu gốc); file thiếu/lỗi → `ModelErrorBoundary` hiện bản procedural theo shellStyle.

---

## 3. Tại sao chọn cách này (Trade-offs)
| Cách | Ưu | Nhược |
|---|---|---|
| **Procedural kích thước thật + chi tiết theo shellStyle (đã chọn)** | Không cần file, đổi layout/màu tức thì, 60fps nhờ instancing | Dáng vỏ vẫn là xấp xỉ, không đúng từng đường cong |
| File .glb thật cho từng mẫu | Giống 100% | Không có file CC0 cho các mẫu này (đã tìm, không thấy); mỗi file vài MB |
| Mỗi chi tiết là một mesh riêng | Code đơn giản | Hàng nghìn draw call → tụt FPS |

---

## 4. Thử thách tự tay sửa code (5 phút)
1. **Góc gõ:** `src/components/canvas/geometry/caseGeometry.ts`, đổi `degToRad(6.5)` thành `degToRad(9)` — vỏ nêm dốc hơn, mép sau dày lên.
2. **Lòng chảo keycap sâu hơn:** `src/components/canvas/geometry/keyboardGeometry.ts`, đổi `DISH_DEPTH = 0.011` thành `0.02` — nhìn nghiêng thấy mặt phím lõm rõ.
3. **Thêm một build:** chép một object trong `src/lib/keyboard/builds.ts`, đặt `shellStyle: 'lucky65'` hoặc `'aula'` để có chi tiết vỏ tương ứng; thêm video vào `scripts/sounds/sources.json` và chạy `npm run sounds -- --only <id>`.

---

## 5. 3 câu hỏi phỏng vấn thực chiến
**Q1. Bàn phím có ~450 bộ phận switch, làm sao vẫn 60fps?**
Gom bộ phận giống nhau vào InstancedMesh (1 draw call cho mọi bản sao), gộp các khối cùng vật liệu bằng `mergeGeometries`, cache hình học theo layout và texture theo loại. Chỉ ma trận stem thay đổi khi gõ, và chỉ ghi lại những stem vừa đổi.

**Q2. Vì sao một texture mà dùng được cho cả bump, roughness lẫn metalness?**
Vì shader của three.js đọc ba map ở ba kênh khác nhau (R/G/B). Vẽ độ cao vào R, độ nhám vào G, độ kim loại vào B rồi gán cùng texture cho cả ba thuộc tính — tiết kiệm 2/3 bộ nhớ texture và chỉ một lần upload lên GPU.

**Q3. Vỏ dưới nghiêng 6.5° nhưng các lớp bên trong vẫn song song plate — làm thế nào để đáy chạm bàn phẳng?**
Xoay cả bàn phím +6.5°, rồi cắt đáy vỏ dưới theo mặt phẳng `y = y₀ + z·tanθ` trong toạ độ bàn phím. Sau phép xoay, mọi điểm trên mặt đáy có cùng độ cao thế giới `y₀·cosθ` (có test kiểm chứng), nên đáy nằm phẳng và chân cao su chạm đúng mặt bệ.

---

## 5b. Cập nhật sau phản hồi (tách lớp "chưa thật")
- **Thứ tự bay khi tách lớp** đổi theo sơ đồ của các hãng: vỏ dưới → PCB → foam → plate → switch → **vỏ trên → keycap trên cùng**. Trước đó vỏ trên bay cao hơn keycap nên cả hàng keycap lọt thỏm trong khung. Camera lùi xa hơn (`explodedZoomFactor` 0.62) và nâng tâm nhìn (`explodedTargetY` 1.4 × offset) để thấy trọn 7 lớp.
- **Màu switch thật theo từng build** (`look.switchColors`), lấy từ ảnh sản phẩm (kbd.news, Kinetic Labs) và thumbnail video review switch: Kailh Cocoa (kem/stem nâu), Leobog Reaper (trắng/stem xanh chuối), Vertex V1 (đen/stem tím), Husky, Turtle, Outemu Jade, Jupiter Banana, WS Morandi, Lekker L45, HMX Sunset Gleam (đế cam/stem vàng), Akko Piano Pro (đen). Switch chưa tra được ảnh rõ giữ màu mặc định. Vỏ đục (POM/nylon) vẽ như vật đặc, vỏ PC trong mới bật trong suốt.
- Foam Poron xám than (tách bạch với plate POM/PC trắng); build ghi "Không foam" thì không vẽ lớp foam.
- Tiêu đề sân khấu hiện tên build thật (ví dụ "Meletrix Zoom75") và linh kiện thật.

## 6. Nguồn & giới hạn
- Thông số 11 build mới tra từ trang hãng/shop/review (Keychron, WOBKEY/Tom's Hardware, Divinikey, NuPhy/Tom's Hardware, Meletrix/CannonKeys, Wooting/TechPowerUp, Mode/Pantheon, Qwertykeys, MonsGeek). Chỗ nguồn mâu thuẫn ghi rõ trong `specs`.
- Video sound test chọn theo cấu hình khớp và tạp âm ≤ 0.02; Halo75 V2, Wooting 80HE, Mode Envoy đã đổi sang video sạch hơn.
- Zoom75: video là bản EE (module núm), mô hình dựng module LCD của bản gốc theo yêu cầu.
- K2 HE: bản All-Wood mới là khung gỗ óc chó + hông nhôm; mô hình theo bản Special Edition đời đầu (ốp gỗ hồng mộc hai hông).
- Chưa có file .glb CC0 cho mẫu nào; khung hybrid sẵn sàng khi có file.
