# 26 — Keycap, vỏ và switch dựng bằng Blender (.glb) không cần mở Blender

> Task **5.1b-blender-keycap-models** + **5.1c-blender-case-switch**. Tài liệu viết cho chủ dự án học từ số 0.

Mục tiêu: phím trên web trông giống phím ngoài đời hơn (khoảng 40%), theo "Hướng 1": dùng model 3D dựng sẵn (`.glb`) thay cho hình khối vẽ bằng code. Chủ dự án không biết Blender, nên **Blender được điều khiển hoàn toàn bằng script Python chạy nền**. Không ai phải mở giao diện Blender.

Kết quả trong task này:

- Keycap: mép trên bo tròn thật, thân hơi phồng, mặt lõm theo profile, ruột rỗng có trụ chữ thập.
- Khe hở giữa phím 0,9mm như keycap Cherry thật.
- Chữ in to và đậm, màu không bị nhạt.
- Vỏ nhôm anodized không còn trông như nhựa bóng.

---

## 1. Bách khoa công nghệ dùng trong task

### 1.1 Blender chạy nền (`blender -b -P script.py`)

- **Là gì?** Blender là phần mềm dựng 3D miễn phí. Cờ `-b` (background) chạy Blender không có cửa sổ. Cờ `-P` chạy một script Python dùng thư viện `bpy` (API của Blender) để dựng model và xuất file.
- **Tác dụng**: dựng keycap chất lượng "đúc thật" (bo mép bằng cung tròn, nhiều vòng lưới, pháp tuyến mượt) rồi xuất `public/models/keycaps.glb`.
- **Cách dùng**: `npm run models` (hoặc `npm run models -- case` để dựng riêng một phần). Script `scripts/models/build-models.ts` tự tìm Blender theo thứ tự: biến `BLENDER_PATH`, bản portable trong `%LOCALAPPDATA%\keycraft-tools`, lệnh `blender` trong PATH.
- **Pros**: lặp lại được (đổi thông số rồi chạy lại là có model mới), không phụ thuộc file tải trên mạng, không lo bản quyền, xem trước được bằng ảnh render (`scripts/models/preview_keycaps.py`).
- **Cons**: máy build phải có Blender (~365MB). Web chỉ cần file `.glb` đã commit, nên Vercel không cần Blender.

### 1.2 glTF / `.glb`

- **Là gì?** "JPEG của 3D": định dạng chuẩn Khronos để chở lưới 3D (đỉnh, pháp tuyến, chỉ số tam giác). `.glb` là bản nhị phân gói gọn trong 1 file.
- **Tác dụng**: 21 model (20 keycap + 1 trụ chữ thập), 37.564 đỉnh, 1MB.
- **Cách dùng**: `useGLTF(url, false, false)` của drei trong `src/components/canvas/useKeycapModels.ts`. Hai tham số `false` tắt bộ giải nén Draco/Meshopt: file không nén theo các chuẩn đó, và bộ giải nén cần WebAssembly vốn bị CSP của dự án chặn.

### 1.3 Kỹ thuật "kéo giãn phần giữa" (9-slice cho 3D)

- **Là gì?** Chỉ dựng **1 keycap 1u** cho mỗi profile và hàng. Phím dài (Shift 2.25u, Space 6.25u) được tạo bằng cách dời mọi đỉnh có `x > 0` sang phải và `x < 0` sang trái một đoạn `stretch = (w − 1) × 1u / 2`. Đỉnh nằm đúng trục giữa đứng yên.
- **Tác dụng**: góc bo, mép và hai đầu lòng chảo giữ nguyên hình dạng như keycap thật (kéo giãn đều kiểu `scale` sẽ làm góc bo bị méo thành hình bầu dục). File chỉ cần 20 model thay vì hàng trăm.
- **Điều kiện**: lưới 1u phải có đỉnh tại `x = 0` và dày ở quanh trục giữa, để không tam giác nào bắc ngang qua trục. Script Blender chèn các điểm chia dày quanh `x = 0` trên mọi vòng viền (`EDGE_SPLITS`).

### 1.4 Tone mapping Neutral (Khronos PBR Neutral)

- **Là gì?** Bước nén ánh sáng HDR về màu màn hình. AgX và ACES làm màu đậm bị nhạt và lệch sắc (đen thành xám, đỏ ngả cam). **Neutral** được Khronos thiết kế cho ảnh sản phẩm/thương mại điện tử: giữ đúng sắc màu gốc.
- **Ghi chú**: spec Chặng 5 ghi dùng AgX. Task này đổi sang Neutral vì đúng các lỗi màu chủ dự án phản ánh.

---

## 2. Bản chất hoạt động (Under the hood)

```
src/components/canvas/geometry/keyboardGeometry.ts   (công thức gốc: getKeycapShape, keycapSurfaceY)
        │  npx tsx scripts/models/export-specs.ts
        ▼
scripts/models/keycap-specs.json                     (20 keycap 1u: rộng, sâu, cao, nghiêng, lòng chảo, bo góc)
        │  blender -b -P scripts/models/build_keycaps.py
        ▼
public/models/keycaps.glb                            (keycap_cherry_r1 ... keycap_sa_r4 + keycap_stem)
        │  useKeycapModels() -> registerKeycapModels()
        ▼
createKeycapGeometry(w, hàng, profile)
   ├─ có model:  stretchKeycap(model 1u, stretch) + trụ chữ thập co theo chiều cao ruột
   └─ chưa có:   keycap dựng bằng code như cũ (test, môi trường không có file)
```

**Vì sao chữ in vẫn khít mặt phím?** Blender dựng mặt lõm bằng **đúng công thức** `keycapSurfaceY` của web (bản Python trong `build_keycaps.py`). Phía web, `dishDepthAt` cũng tính lòng chảo theo kiểu kéo giãn (đoạn giữa phẳng bằng tâm 1u, hai đầu cong như mép 1u). Chữ in, gờ F/J đặt theo công thức nên nằm đúng mặt lưới. Test bắn tia từ trên xuống xác nhận mặt lưới lệch so với công thức chưa tới 0,06mm.

**Một keycap trong Blender gồm** (đơn vị: 1u = 19,05mm):

1. Thành: 9 vòng viền bo góc từ đáy lên, thuôn dần và phồng 0,22mm ở giữa thân.
2. Bo mép trên: 6 vòng theo cung 1/4 tròn bán kính 0,6mm. Đây là chi tiết làm mép bắt sáng mềm như nhựa đúc, thay vì sắc cạnh kiểu CG.
3. Mặt lõm: 6 vòng thu dần về tâm, độ cao lấy theo công thức.
4. Ruột rỗng: thành dày 1,2mm, nóc dày 1,4mm.
5. Trụ chữ thập: hình trụ 5,5mm khoét lỗ "+" bằng boolean (node riêng để không bị kéo giãn theo phím dài).

**Nạp trên web**: `KeyboardModel` gọi `useKeycapModels()` ở dòng đầu. Hook "treo" (Suspense) tới khi file tải xong, đăng ký model rồi mới dựng keycap. Cache keycap có tiền tố `model-`/`code-` nên không lẫn hai loại.

**Đồng bộ**: `keycapModels.test.ts` nạp chính file `.glb` bằng `GLTFLoader` và đối chiếu với code. Ai đổi `KEYCAP_GAP` hay `TAPER_X` mà quên chạy `npm run models` thì test đỏ.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Quyết định | Cách khác | Lý do |
|---|---|---|
| Blender điều khiển bằng script | Tải model trên Sketchfab rồi sửa tay trong Blender | Sketchfab cần đăng nhập; model tải về không khớp kích thước/profile của web; sửa tay không lặp lại được. Script thì đổi thông số là ra model mới |
| 1 keycap 1u + kéo giãn | Dựng sẵn mọi bề rộng | ~25 bề rộng × 4 hàng × 5 profile = hàng trăm model, file vài MB |
| Mặt lõm theo công thức chung | Raycast mặt lưới để đặt chữ in | Công thức chạy được trong test và lúc chưa tải model; không tốn raycast cho 100 phím |
| Neutral thay AgX | Giữ AgX theo spec | AgX làm đúng các lỗi chủ dự án phản ánh (đen thành xám, đỏ ngả cam) |
| Vỏ nhôm bỏ clearcoat | Giữ clearcoat cho bóng | Lớp clearcoat làm nhôm trông như nhựa sơn bóng; nhôm anodized phun cát thật không có lớp phủ đó |

Vỏ và switch: xem phụ lục bên dưới.

---

## 4. Thử thách tự tay sửa code (5 phút)

1. **Bo mép keycap tròn hơn**: `scripts/models/build_keycaps.py` dòng 35 (`FILLET = 0.6 * MM`), đổi thành `1.2 * MM` rồi chạy `npm run models -- keycaps`. Tải lại `/studio`: mép trên mọi phím tròn mềm hơn hẳn, như keycap ABS đời cũ. (Nhớ đổi lại.)
2. **Khe hở giữa phím**: `src/components/canvas/geometry/keyboardGeometry.ts` dòng 9 (`KEYCAP_GAP = 0.018`), thử `0.04` rồi chạy `npm test -- --run src/components/canvas/geometry/keycapModels.test.ts`: test báo đỏ vì model chưa dựng lại. Chạy `npm run models -- keycaps`, test xanh và trên web khe hở rộng ra, lộ plate.

---

## 5. Ba câu hỏi phỏng vấn thực chiến

**Q1. Vì sao không `scale.x` keycap 1u thành phím Space 6.25u?**

> `scale` nhân mọi toạ độ x: góc bo bán kính r thành elip r×6.25, mép bo phía hai đầu bị kéo dẹt, pháp tuyến sai làm ánh sáng loang lổ. Kéo giãn phần giữa (dời nửa trái sang trái, nửa phải sang phải) giữ nguyên hình học hai đầu; chỉ các tam giác bắc qua giữa dài ra. Điều kiện là lưới phải có đỉnh trên trục giữa.

**Q2. Làm sao đảm bảo dữ liệu giữa Blender và web không lệch nhau?**

> Một nguồn sự thật: công thức nằm trong TypeScript, được xuất ra JSON cho Blender đọc, và bản Python dùng đúng công thức đó. Test nạp file `.glb` thật, so kích thước và độ cao mặt phím với công thức, so JSON với code hiện tại. Thông số đổi mà model chưa dựng lại thì CI đỏ.

**Q3. Vì sao tắt Draco/Meshopt khi `useGLTF`?**

> Hai bộ giải nén đó dùng WebAssembly. CSP của dự án không cho `'wasm-unsafe-eval'`, nên bật lên có thể bị trình duyệt chặn. File keycap chỉ 1MB và không nén theo chuẩn đó. Nếu sau này cần nén, chọn `KHR_mesh_quantization` (thuần dữ liệu, GLTFLoader hỗ trợ sẵn, không cần WebAssembly).

---

## Phụ lục: Vỏ và switch dựng bằng Blender (task 5.1c)

### A. Vỏ: một vỏ mẫu, nắn theo từng bàn phím

41 mẫu bàn phím có 6 bán kính bo góc và 8 độ dày viền khác nhau, nên không dựng sẵn từng vỏ. Blender dựng **một vỏ mẫu** (`public/models/case.glb`, 576 đỉnh, 30KB): khung vuông có lỗ khoang, mặt cắt gồm bo đáy 0,4mm → thành ngoài → **mép vát kim cương 45° 0,8mm** → mặt trên → vát miệng khoang 0,6mm → thành khoang → đáy.

Web nắn vỏ mẫu bằng `fitCaseTemplate` (`src/components/canvas/geometry/caseModel.ts`):

```
Vỏ mẫu: thành ngoài ở ±2, lỗ khoang ở ±1, đường chia ở ±1.5
  đỉnh có |x| > 1.5  -> thuộc thành ngoài : dời theo kích thước ngoài
  đỉnh có |x| <= 1.5 -> thuộc lỗ khoang   : dời theo kích thước lỗ
  (tương tự với z; với y: nửa trên dời theo chiều cao, nửa dưới giữ nguyên)
  đỉnh ở cả hai vùng ngoài (góc) -> dời theo HƯỚNG BÁN KÍNH:
     khoảng cách tới đường bo giữ nguyên  =>  mép vát quanh góc vẫn rộng đúng 0,8mm
     tâm cung + bán kính lấy theo mẫu bàn phím
```

Viền vỏ mẫu cố tình làm rất dày (bằng 1 đơn vị) để vùng góc ngoài và vùng góc lỗ không chồng lên nhau. Vỏ trên và vỏ dưới hình nêm cùng gọi `createCaseGeometry`, nên cả hai dùng chung vỏ mẫu. Vỏ dưới được nắn rồi mới vát đáy theo góc gõ 6,5°.

Mép vát để **sắc cạnh** (tách pháp tuyến ở góc > 30°). Nhờ vậy nó bắt một vệt sáng mảnh từ softbox chạy dọc viền, đúng chi tiết làm nhôm phay CNC trông thật.

### B. Switch MX

`public/models/switch.glb` (4 bộ phận, 3.084 đỉnh, 126KB), đúng kích thước MX và gốc toạ độ của `switchGeometry.ts`:

- **Vỏ trên rỗng**: thành 1mm, vuốt thon từ 15,6mm xuống 11,2mm, bo mép trên 0,6mm, lỗ vuông 6mm cho stem, 4 ngàm kẹp. Vì rỗng nên nhìn qua vỏ trong suốt thấy được stem và lò xo bên trong.
- **Vỏ dưới**: khối bo cạnh từ plate xuống PCB, 2 lẫy bám plate, trụ định vị Ø3,9mm, 2 chân nhựa.
- **Stem**: chữ thập 4,0 × 1,17mm vát đầu, vách chống bụi, thân có ray trượt.
- **Lò xo**: ống tròn quét theo đường xoắn ốc 7,5 vòng (bộ phận mới, vật liệu thép mạ).

Mỗi bộ phận vẫn là `InstancedMesh` (87 switch = 1 lần vẽ cho mỗi bộ phận) và vẫn tô theo màu switch thật của từng mẫu. Cửa sổ LED và chân đồng giữ nguyên bản dựng bằng code.

### C. Bài học: transform của node glTF

Blender lưu vị trí của object (`location`) thành **transform của node** trong file glTF, không ghi vào toạ độ đỉnh. Web chỉ đọc `geometry`, nên stem switch ban đầu bị tụt xuống đáy. Ảnh render bằng Blender trông vẫn đúng vì Blender tự cộng transform khi hiển thị. Cách sửa: `bake_transforms()` (`bpy.ops.object.transform_apply`) trước khi xuất. Test kiểm tra kích thước thật của từng bộ phận để lỗi này không quay lại.

### D. Thử thách thêm

1. **Mép vát vỏ to hơn**: `src/components/canvas/geometry/caseModel.ts` dòng 25 (`topChamfer: 0.016`), đổi thành `0.03` rồi chạy `npm run models -- case` và tải lại `/studio`: vệt sáng quanh viền vỏ dày gấp đôi. Test `caseSwitchModels.test.ts` vẫn xanh vì web và Blender đọc cùng một số.
2. **Lò xo dày vòng hơn**: `scripts/models/build_switch.py` dòng 132, đổi `7.5` vòng thành `11`, chạy `npm run models -- switch`, bấm "Tách 7 lớp" để soi switch.

### E. Câu hỏi phỏng vấn thêm

**Q. Làm sao một model vỏ dùng được cho 41 bàn phím khác kích thước mà góc bo không méo?**

> Không scale; chia vùng theo vị trí đỉnh. Đỉnh thuộc thành ngoài, thành khoang hay nửa trên/dưới được dời theo đúng kích thước của vùng đó. Đỉnh ở góc ngoài dời theo hướng bán kính: tâm cung mới + (khoảng cách tới đường bo − bán kính mẫu + bán kính mới). Mọi chi tiết tính theo khoảng cách tới bề mặt (mép vát, bo đáy) giữ nguyên kích thước thật. Model mẫu phải có viền đủ dày để các vùng không chồng nhau.
