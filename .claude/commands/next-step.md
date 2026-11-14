---
description: Tự động lấy task tiếp theo chưa hoàn thành trong PROGRESS.md, code, viết & chạy unit test, và xuất bài học lý thuyết.
---

Hãy đọc file `PROGRESS.md`, xem mục **Handoff Log** và xác định đúng **1 task đầu tiên** đang ở trạng thái `[ ]`.
Thực hiện trọn vẹn quy trình 5 bước:
1. Lên kế hoạch ngắn gọn các file sẽ tạo/sửa.
2. Tiến hành code đầy đủ tính năng của task đó theo chuẩn Clean Code trong `CLAUDE.md`.
3. Viết unit test bằng Vitest cho phần logic vừa tạo (từ task 1.2 trở đi) và chạy lần lượt: `npx tsc --noEmit`, `npm run lint`, `npm test -- --run`. Tự đọc log và sửa lỗi cho đến khi tất cả pass 100%.
4. Tạo file bài học lý thuyết tương ứng trong `docs/theory/` (đủ 4 phần gồm cả bài tập thực hành 5 phút).
5. Cập nhật `PROGRESS.md` từ `[ ]` thành `[x]`, ghi tóm tắt vào **Handoff Log** và nhắc người dùng chạy `git commit`.