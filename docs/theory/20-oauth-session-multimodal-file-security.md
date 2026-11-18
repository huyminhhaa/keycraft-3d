# Bài học 19: Cơ chế Session Cookie Toàn cục, Google OAuth 2.0 (PKCE), AI Chat Đa Luồng & Phòng thủ 7 Lớp Tệp Đính Kèm Độc Hại

## 1. Bách khoa công nghệ sử dụng trong task

### 1.1. Stateless JWT trong `httpOnly` Cookie & Root Auth Hydration
* **Định nghĩa:** Lưu cặp mã xác thực `accessToken` (15 phút) và `refreshToken` (7 ngày) trong cookie gắn cờ `HttpOnly; SameSite=Lax; Path=/` thay vì `localStorage`, kết hợp component `AuthHydrator` đặt ở `RootLayout` để đồng bộ trạng thái về Zustand store ngay khi mở bất kỳ trang nào.
* **Tác dụng trong dự án:** Giải quyết triệt để lỗi "Trang chủ (`/`) hiện chưa đăng nhập nhưng vào `/studio` lại thấy đã đăng nhập" (do trước đây chỉ `Sidebar.tsx` gọi `/api/auth/me`).
* **Cách sử dụng chuẩn:**
  ```tsx
  // src/app/layout.tsx
  <body>
    <AuthHydrator />
    {children}
  </body>
  ```
* **Pros:** Chống đánh cắp token qua XSS (JS không đọc được `document.cookie`), tự động Silent-Refresh khi Access Token hết hạn, trạng thái nhất quán 100% giữa mọi route.
* **Cons:** Cần gọi `/api/auth/me` một lần lúc tải trang để client biết đang đăng nhập dưới tên ai.

### 1.2. Google OAuth 2.0 Authorization Code Flow + PKCE (S256)
* **Định nghĩa:** Giao thức ủy quyền chuẩn công nghiệp cho phép người dùng đăng nhập bằng tài khoản Google mà không bao giờ phải giao mật khẩu cho ứng dụng của bạn, tăng cường bằng **PKCE** (Proof Key for Code Exchange) và **CSRF `state`**.
* **Tác dụng trong dự án:** Thêm nút **"Tiếp tục với Google"** 1-click trong `AuthModal.tsx`, tự động tạo/liên kết tài khoản trong bảng `users` (lưu `googleId`, `avatarUrl`, `authProvider = 'google'`).
* **Syntax luồng PKCE:**
  ```ts
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  ```
* **Pros:** Không cần thư viện nặng nề bên thứ ba, kiểm soát hoàn toàn cookie JWT và bảo mật CSRF bằng `timingSafeEqual`, chặn tuyệt đối Open Redirect.
* **Cons:** Cần khai báo `Authorized redirect URIs` chính xác trên Google Cloud Console cho cả localhost và domain Vercel.

### 1.3. Phòng thủ 7 lớp cho Upload Ảnh & Tệp (`fileGuard.ts` + `clientFileSanitizer.ts`)
* **Định nghĩa:** Chuỗi kiểm định nhiều tầng (Defense-in-Depth) đảm bảo tệp người dùng gửi lên AI **không thể gây XSS, không thể thực thi mã độc trên server, không làm tràn RAM, và không thao túng prompt của AI**.
* **Tác dụng trong dự án:** Cho phép người dùng đã đăng nhập gửi ảnh bàn phím (`JPG/PNG/WebP`) hoặc tài liệu (`PDF/TXT/MD/JSON/CSV`) cho Gemini phân tích mà vẫn an toàn ở mức production.
* **Pros:** Chặn được hầu hết kỹ thuật tấn công upload phổ biến (đổi đuôi `.exe` thành `.jpg`, SVG XSS, Image Decompression Bomb, PDF nhúng JavaScript, Polyglot EXIF, Indirect Prompt Injection).
* **Cons:** Yêu cầu tăng thêm bước kiểm tra nhị phân (vài mili-giây trong RAM) và chặn các định dạng rủi ro cao như `.svg`, `.zip`, `.docx` có macro.

---

## 2. Bản chất hoạt động (Under the hood)

### 2.1. Tại sao trước đây Home chưa đăng nhập nhưng vào Studio lại đã đăng nhập?
1. Cookie `keycraft_access_token` và `keycraft_refresh_token` có `Path=/` nên **trình duyệt luôn gửi kèm ở cả `/` lẫn `/studio`**.
2. Nhưng Zustand store (`useAuthStore`) sống trên RAM trình duyệt, mặc định khởi tạo `{ user: null, isAuthenticated: false }`.
3. Trước đây, chỉ duy nhất `Sidebar.tsx` (chỉ mount ở `/studio`) gọi `useEffect(() => checkAuth(), [])`. Khi bạn mở `/`, không có ai gọi `/api/auth/me` nên UI vẫn vẽ nút "Đăng nhập", đến lúc sang `/studio` thì `Sidebar` mới gọi `/api/auth/me` và đột ngột hiện tên tài khoản!
4. Sau khi đặt `<AuthHydrator />` trong `src/app/layout.tsx`, mọi trang đều đồng bộ phiên ngay lập tức.

### 2.2. Kiến trúc AI giống ChatGPT / Gemini (Khách vs Đã đăng nhập)
* **Khách (Chưa đăng nhập):**
  * Giao diện báo **"Đoạn chat tạm thời"**.
  * Tin nhắn chỉ sống trong React state (F5 là mất), server **không** ghi vào bảng `chat_sessions` / `chat_messages`.
  * Nếu cố gửi tệp/ảnh, server trả `HTTP 401 AUTH_REQUIRED_FOR_ATTACHMENTS`.
* **Đã đăng nhập (Google / Tài khoản KeyCraft):**
  * Khi gửi tin nhắn, `/api/chat` tự tạo hoặc nối vào `chat_sessions` gắn với `userId`, lưu tin nhắn user (kèm **chỉ metadata an toàn** của tệp, không lưu binary) và trong callback `onFinish` của `streamText` lưu phản hồi AI + các tool 3D đã chạy vào PostgreSQL.
  * Server trả header `X-Chat-Session-Id` để client cập nhật danh sách Lịch sử chat ngay lập tức.

### 2.3. Điều gì xảy ra nếu hacker cố gửi file độc vào ô chat AI?
Tệp đi qua **7 chốt chặn tuần tự**:
1. **Client Canvas Re-encode (`clientFileSanitizer.ts`):** Ảnh bị vẽ lại lên `<canvas>` sạch, tẩy hết GPS EXIF và mã ẩn sau đuôi EOF.
2. **Auth Gate (`/api/chat`):** Khách vãng lai bị chặn ngay lập tức.
3. **Filename & Double Extension Guard:** Chặn `../../etc/passwd`, null-byte, `banphim.jpg.exe`, `.svg`.
4. **Magic Bytes & Binary Signature Scanner:** Đọc các byte đầu tiên trong buffer. File `.exe` (`4D 5A`) hoặc `.elf` (`7F 45 4C 46`) hay `.zip` (`50 4B 03 04`) dù đổi tên thành `.jpg` vẫn bị bắt sống và trả `HTTP 400 MALICIOUS_SIGNATURE`.
5. **Decompression Bomb & PDF Active Content Scan:** Đọc kích thước ảnh từ header nhị phân (chặn > `4096×4096px`); quét PDF tìm `/JavaScript`, `/JS`, `/Launch`, `/OpenAction`, `/EmbeddedFile`.
6. **Zero-Disk / Zero-Execution:** Tệp **không bao giờ** ghi vào thư mục `public/` hay chạy qua shell/eval; chỉ nằm tạm trong RAM rồi gửi qua HTTPS sang Gemini Vision encoder.
7. **Anti-Indirect Prompt Injection:** Mọi tệp văn bản đều bị bọc trong `<attached_file untrusted_data="true">...</attached_file>` kèm luật hệ thống cấm AI nghe theo mệnh lệnh nằm bên trong tệp.

---

## 3. Tại sao chọn cách này (Trade-offs)

| Hạng mục | Cách làm thông thường (nguy hiểm / cồng kềnh) | Cách KeyCraft 3D chọn |
| :--- | :--- | :--- |
| Lưu file người dùng | Ghi thẳng ra `public/uploads/` | **Zero-Disk RAM-only** truyền thẳng sang Gemini, chỉ lưu metadata `{ name, mimeType, size }` vào DB |
| Kiểm tra loại file | Chỉ check `file.name.endsWith('.jpg')` hoặc `file.type` | **Check Magic Bytes + Signature + Pixel Dimensions + PDF Token Scan** |
| OAuth | Cài framework lớn gây xung đột Next.js 16 | **OAuth 2.0 + PKCE + CSRF State thuần** tích hợp trực tiếp hệ thống JWT `httpOnly` sẵn có |

---

## 4. Thử thách tự tay sửa code (5 phút)
1. **Thử đổi giới hạn dung lượng file:** Mở `src/lib/security/fileGuard.ts` dòng 16 (`MAX_FILE_SIZE_BYTES`), thử đổi thành `1 * 1024 * 1024` (1MB) và chạy lại `npm test -- --run src/lib/security/fileGuard.test.ts` để xem unit test phản ứng ra sao.
2. **Thử tấn công hệ thống của chính mình:** Tạo 1 file `test.txt` chứa `<script>alert(1)</script>`, thử đổi tên thành `test.jpg` rồi upload vào ô chat AI khi đã đăng nhập — bạn sẽ thấy hệ thống chặn ngay với thông báo lỗi bảo mật rõ ràng!

---

## 5. 3 câu hỏi phỏng vấn thực chiến

1. **Hỏi:** *Tại sao kiểm tra `file.type` (MIME type) ở cả frontend lẫn backend vẫn chưa đủ để ngăn hacker upload file độc?*  
   **Đáp:** Vì `Content-Type` và đuôi file đều do client tự khai báo và có thể giả mạo trong 1 giây (ví dụ đổi `shell.exe` thành `anh.jpg`). Backend bắt buộc phải đọc **Magic Bytes** (những byte đầu tiên trong nội dung nhị phân) để xác định định dạng thật, đồng thời không bao giờ lưu vào thư mục public có thể thực thi.

2. **Hỏi:** *Tại sao phải cấm `image/svg+xml` trong danh sách ảnh được phép upload?*  
   **Đáp:** SVG bản chất là tài liệu XML chứ không phải ảnh bitmap; nó có thể chứa trực tiếp thẻ `<script>` hoặc thuộc tính `onload="..."`. Nếu ứng dụng vô tình render lại SVG hoặc phục vụ cùng origin, kẻ tấn công có thể thực hiện **Stored XSS** đánh cắp phiên người dùng khác.

3. **Hỏi:** *Trong Google OAuth 2.0, tham số `state` và `PKCE (code_verifier / code_challenge)` bảo vệ chống lại hai loại tấn công nào?*  
   **Đáp:** `state` (lưu trong `httpOnly` cookie và đối chiếu bằng `timingSafeEqual`) chống tấn công **Login CSRF** (ép nạn nhân đăng nhập vào tài khoản của kẻ tấn công). Còn **PKCE (S256)** chống tấn công **Authorization Code Interception** — dù kẻ gian chặn được `code` trên đường truyền callback cũng không đổi được token vì thiếu `code_verifier` bí mật.
