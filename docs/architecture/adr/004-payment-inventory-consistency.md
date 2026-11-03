# ADR-004: Reservation và payment attempt bền vững

- Ngày: 03/11/2026. Trạng thái: đề xuất A2.
- Truy vết: [#12](https://github.com/akira-yami/BrewLite_A2/issues/12), [kiến trúc](../system-architecture.md); FR-06/07/09/10, NFR-04/05.

## Bối cảnh

Nhiều khách mua phần tồn cuối; client gửi lại payment hoặc mất response. Gateway và DB không thể commit chung một transaction. Unique payment key đơn lẻ không ngăn hai key khác nhau trả tiền cùng order.

## Quyết định

1. Tạo order/items/history, giảm stock có điều kiện/version, reserve inventory/coupon cùng transaction ngắn. Tổng hợp quantity theo variant, xử lý theo ID ổn định. Lỗi rollback tất cả.
2. Mỗi payment attempt có key unique và hash từ orderId/method do server chuẩn hóa, trạng thái PROCESSING/SUCCEEDED/FAILED. Kiểm tra JWT/chủ đơn trước replay. Khóa order để chỉ một attempt đang xử lý, kể cả khác key; DB thêm partial unique success/order và EARN/order.
3. Gateway qua port `PaymentGateway`, adapter mock trong API, không thu tiền thật. Gọi charge ngoài transaction; finalize trong transaction mới: payment/order/history/reservation/coupon/loyalty/balance cùng commit.
4. Cùng key/hash hoàn tất trả replay; đang xử lý 409 PAYMENT_IN_PROGRESS; đổi payload 409 IDEMPOTENCY_KEY_REUSED. Decline xác định giữ tồn đến hạn retry, key mới và không reserve lần hai. Order PAID không có payment success thứ hai.
5. Timeout/lỗi sau gateway trước DB commit giữ PROCESSING. Mock có kết quả bền vững theo key/attempt (lưu riêng với transaction finalize) và port lookup để phục hồi sau restart; lần gọi lại cùng key không charge mới. Recovery tra cứu rồi finalize idempotent. Nếu không xác định được thì tiếp tục giữ để đối soát, không đoán FAILED/hoàn tồn.
6. Expiry/cancel/pay cùng khóa order và kiểm tra attempt đang xử lý. Chỉ ACTIVE reservation được release/consume một lần; hết hạn chỉ áp dụng đơn chưa paid không có payment chưa rõ. Hủy PAID trước PREPARING theo SRS giữ payment/coupon/điểm, hoàn tồn một lần, không hoàn tiền mock. Luật hủy và tỷ lệ điểm vẫn chờ PO review.

## Lý do và phương án khác

DB constraint/transaction sống qua restart và nhiều instance; mutex/cache memory không đáp ứng. Trừ tồn sau payment có thể để khách đã trả tiền nhưng hết hàng. Giữ DB transaction khi gọi gateway làm lock dài và vẫn không giải quyết atomic commit với hệ ngoài. Mock qua port cho phép test lỗi có kiểm soát và thay adapter nếu phạm vi đổi; payment thật cần ADR riêng, callback/reconciliation và có thể outbox.

## Hệ quả và kiểm chứng

Cần job expiry/recovery, dữ liệu mock lookup bền vững và lock order nhất quán; có trường hợp giữ tồn lâu khi chưa đối soát được. TTL reservation là cấu hình phải review trước code, không tự lấy giá trị cũ A1 làm yêu cầu A2.

Integration trên PostgreSQL thật bắt buộc: stock=5/20 request; fault sau reserve; same-key 20 request/replay/restart; khác payload; khác key cùng order; sai chủ; decline retry; timeout; crash sau gateway success trước finalize; expiry/cancel/payment race; PAID cancel/prepare race; một coupon consume và một EARN. Có thiết kế/constraint không thay bằng chứng các phép thử này đã chạy.
