# Biên bản bàn giao — Issue #108: Hoàn tiền dạng Loyalty Points qua phê duyệt Barista

- **Người thực hiện:** Huỳnh Thái Kiệt (@htk2k6-hash)
- **Mã công việc:** Issue #108 (Phát triển mở rộng Use Case UC-14 & UC-15 / FR-16)
- **Nhánh triển khai:** `feat/a2-issue-108-refund-loyalty-points`
- **Ngày bàn giao:** 15/11/2026

---

## 1. Tóm tắt nội dung thực hiện
1. **Thiết kế & Migration cơ sở dữ liệu:**
   - Bổ sung bảng `RefundRequest` liên kết `Order`, `User` (khách hàng yêu cầu) và `User` (Barista xử lý).
   - Thêm enum `RefundRequestStatus` (`PENDING`, `APPROVED`, `REJECTED`).
   - Mở rộng enum `LoyaltyTransactionType` thêm giá trị `REFUND`.
   - Tạo partial unique index `loyalty_transactions_order_refund_unique` trên database bảo đảm mỗi đơn chỉ có tối đa một giao dịch tích lũy điểm hoàn tiền.
   - Tạo migration `20261115234500_order_refund_loyalty` và chạy deploy thành công trên database PostgreSQL sạch, seed hoạt động hoàn hảo.

2. **Backend API & Guard phân quyền:**
   - `POST /orders/:id/refund-request`: Khách hàng (`CUSTOMER`) gửi yêu cầu hoàn tiền cho đơn hàng của mình khi đơn còn ở trạng thái `PAID`. Chống gửi 2 yêu cầu hoàn tiền trên cùng một đơn.
   - `GET /orders/:id`: Bổ sung thông tin `refundRequest` vào chi tiết đơn hàng để khách hàng theo dõi.
   - `PATCH /staff/orders/:id/refund/approve`: Barista (`BARISTA`) duyệt hoàn tiền cho đơn hàng `PAID`.
   - `PATCH /staff/orders/:id/refund/reject`: Barista (`BARISTA`) từ chối yêu cầu hoàn tiền kèm lý do từ chối.

3. **Tính toàn vẹn dữ liệu & Idempotency:**
   - Mọi thao tác phê duyệt chạy trong `Prisma.$transaction` (Atomic Transaction): nếu tạo `LoyaltyTransaction` bị lỗi, đơn không bị hủy dở dang, đảm bảo rollback hoàn toàn.
   - Chống duyệt trùng (Double-approval / Idempotency): Khóa đơn bằng `SELECT ... FOR UPDATE`, kiểm tra trạng thái yêu cầu còn `PENDING` và kiểm tra chống trùng `LoyaltyTransaction` type `REFUND`. Bấm duyệt 2 lần không bị cộng điểm 2 lần.
   - Khi hoàn tiền thành công: đơn chuyển sang `CANCELLED`, hoàn nguyên liệu tồn kho theo snapshot reservation items, cộng điểm tích lũy vào tài khoản thành viên của khách hàng.

---

## 2. Kết quả kiểm thử & Nghiệm thu
- **Tổng số Unit Tests Backend:** 51 test suites, **547 tests pass 100%**.
- **Typecheck & Build:**
  - `apps/api`: `tsc --noEmit` và `nest build` pass 100%.
  - `apps/web`: `next build` pass 100%.
- **Lint:** Hoàn thành kiểm tra lint, không có lỗi.
