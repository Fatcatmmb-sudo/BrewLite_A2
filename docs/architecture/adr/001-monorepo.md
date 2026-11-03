# ADR-001: Monorepo và modular monolith phân lớp

- Ngày: 03/11/2026. Trạng thái: đề xuất A2, chờ review.
- Truy vết: [#12](https://github.com/akira-yami/BrewLite_A2/issues/12), [kiến trúc](../system-architecture.md); FR-01..10, NFR-06/11.

## Bối cảnh

Đội xây Next.js/NestJS/PostgreSQL trong hai Sprint. Order, inventory, payment, coupon và loyalty cần commit nhất quán. A2 hiện chỉ có khung ứng dụng, chưa có runtime.

## Quyết định

Giữ `apps/web`, `apps/api`, `docs` trong một repository. Web/API là hai ứng dụng riêng; API là modular monolith theo domain `auth/users/catalog/orders/inventory/payments/promotions/loyalty`. Trong module dùng Controller -> Service -> Repository; mapper thuần và DTO/entity hỗ trợ, không là lớp I/O mới. Module khác chỉ gọi public service. Service điều phối truyền cùng DB transaction client cho mọi thao tác phải commit nguyên tử.

Không chia sẻ Prisma model với frontend; contract công khai được review cùng thay đổi API/UI. Không tạo package dùng chung hay lớp trừu tượng khi chưa có nhu cầu.

## Lý do và phương án khác

Một repository giúp review yêu cầu/contract/code cùng nhau; một API giảm chi phí deploy và giữ transaction đơn giản. Nhiều repository tăng lệch contract; microservices yêu cầu distributed transaction/observability/recovery không phù hợp nguồn lực MVP. Chia layer toàn cục làm domain rải rác; kiến trúc quá nhiều lớp tăng boilerplate.

## Hệ quả và kiểm chứng

Scale/release chủ yếu toàn API; lỗi process có thể ảnh hưởng mọi domain. Reviewer kiểm tra controller không query Prisma, module không inject repository nội bộ, không có vòng phụ thuộc service; test transaction qua nhiều module phải rollback toàn bộ. Tách service chỉ khi có nhu cầu scale/ownership thực tế và ADR thay thế.
