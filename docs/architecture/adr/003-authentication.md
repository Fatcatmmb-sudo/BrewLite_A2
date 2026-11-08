# ADR-003: JWT với RBAC và ownership

- Ngày: 03/11/2026. Trạng thái: đề xuất A2.
- Truy vết: [#12](https://github.com/akira-yami/BrewLite_A2/issues/12), [kiến trúc](../system-architecture.md); FR-05, NFR-02/03/10.

## Bối cảnh

Web và API tách riêng; khách chỉ được đọc/thanh toán/hủy đơn của mình. Barista chỉ cập nhật tiến độ theo luật. Mock gateway là cộng tác tích hợp, không phải role.

## Quyết định

API phát/xác minh access JWT sống ngắn với sub/role/iss/aud/exp; xác minh chữ ký bằng thuật toán cho phép và secret từ môi trường. Chỉ có CUSTOMER/BARISTA; public register luôn CUSTOMER, trường role tự thêm bị từ chối. Mật khẩu bcrypt cost >=10, không trả/log hash hoặc password.

Guard bảo vệ route theo role, service kiểm tra chủ tài nguyên trước đọc/ghi/replay payment. MVP giữ access token trong bộ nhớ web; reload xác minh lại nếu có token hợp lệ hoặc yêu cầu login, giữ giỏ. Logout xóa phiên client, không tuyên bố thu hồi JWT còn hạn. Refresh token/HttpOnly cookie là mở rộng FR-13, cần thiết kế rotate/revoke và CSRF riêng trước khi dùng. CORS chỉ cho origin được cấu hình; production HTTPS; auth/order/payment không vào PWA cache.

## Lý do và phương án khác

JWT phù hợp yêu cầu bài và guard NestJS. RBAC đơn thuần không ngăn khách xem đơn người khác nên phải thêm ownership. Token memory giảm lưu bền secret trong browser nhưng phải login lại sau reload nếu không có phiên hợp lệ. Không sao chép mặc định localStorage token của A1. Cookie session là phương án khác nhưng không thay thế JWT được yêu cầu; refresh token tăng phạm vi MVP.

## Hệ quả và kiểm chứng

Session UX cần phối hợp #14/#27. Runtime nền hiện có register/login/me, bcrypt, JWT HS256 với issuer/audience/TTL, CUSTOMER-only public registration, DTO validation và role claims. Test hai customer và một Barista: 401 thiếu/sai/hết hạn JWT, 403 sai role, từ chối đọc/pay/cancel/replay chéo chủ mà không đổi DB; username trùng 409, input sai 400; network error không tự logout; reload/expiry giữ giỏ. Automated unit tests bao phủ auth/JWT; ownership HTTP tests và browser session UX còn thiếu. Log và bundle không chứa secret.
