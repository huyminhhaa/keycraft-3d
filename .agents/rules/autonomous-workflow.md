---
trigger: always_on
---

# Quy trình thực thi tự động A-Z (Code -> Test -> Explain)
Khi được giao thực hiện task trong `PROGRESS.md`, thực hiện tuần tự 5 bước không cần hỏi lại người dùng giữa chừng:
1. **Inspect:** Đọc `PROGRESS.md` và kiểm tra cấu trúc thư mục hiện tại.
2. **Implement:** Viết code sạch, chuẩn TypeScript strict mode, chia nhỏ component rõ ràng.
3. **Verify & Auto-Fix:** Chạy lệnh kiểm tra type, lint và unit test trong terminal. Nếu lỗi, tự đọc log và sửa cho đến khi pass 100%.
4. **Document Theory:** Viết tài liệu giải thích lý thuyết dễ hiểu vào `docs/theory/` theo đúng chuẩn trong `CLAUDE.md`.
5. **Update Progress:** Đánh dấu `[x]` vào `PROGRESS.md` và tóm tắt những gì đã làm vào Handoff Log để AI tiếp theo nắm bắt.
