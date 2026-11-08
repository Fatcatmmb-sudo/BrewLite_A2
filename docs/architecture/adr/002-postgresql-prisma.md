# ADR-002: PostgreSQL, Prisma và migration có phiên bản

- Ngày: 03/11/2026. Trạng thái: đề xuất A2.
- Truy vết: [#12](https://github.com/akira-yami/BrewLite_A2/issues/12), [#13](https://github.com/akira-yami/BrewLite_A2/issues/13), [kiến trúc](../system-architecture.md); FR-06/07/09/10, NFR-04/05/06/11.

## Bối cảnh

Quan hệ order/items/payment/reservation/coupon/ledger cần FK, transaction và hàng rào chống ghi lặp. Dữ liệu phải còn sau restart; file Compose hiện tại chưa có cấu hình chạy.

## Quyết định

Dùng PostgreSQL và Prisma; schema/migration/seed đích đặt trong `apps/api/prisma`. Tiền là BIGINT VND, thời gian UTC/timestamptz, ID UUID. API chuyển tiền sang JSON number trong miền số nguyên an toàn đã validate. CHECK Ingredient.stockQuantity >=0, unique idempotency key, partial unique success/order và EARN/order bổ sung bằng SQL migration khi cần.

Migration mới là append-only, chạy một lần trước API bằng `prisma migrate deploy` khi runtime được thiết lập; không tự dùng schema push/reset trên production. Migration fail chặn release mới. Seed local/test lặp an toàn và tách khỏi dữ liệu production. DB có persistent storage, quyền migration tách khỏi runtime khi deploy. Không cascade-delete lịch sử giao dịch. Rollback app dùng image tương thích schema, không tự migration down phá dữ liệu.

## Lý do và phương án khác

PostgreSQL phù hợp ràng buộc quan hệ và ACID; Prisma hỗ trợ truy cập type-safe/migration trong TypeScript. Memory/in-process mock không chứng minh tồn dưới concurrency hoặc recovery. ORM khác có thể dùng nhưng chỉ chọn một cách truy cập DB; database tài liệu không có lợi thế rõ cho quan hệ chặt này.

## Hệ quả và kiểm chứng

Phải hiểu isolation, lock order và unique conflict; ORM không loại race. Integration dùng PostgreSQL thật: migration từ DB rỗng, migrate/seed lần hai, CHECK/FK/unique, transaction rollback, stock concurrency, persistence sau restart, backup/restore trên DB test. Hiện chưa có schema/migration hoặc kết quả đo; #13/#35/#38 sẽ cụ thể hóa và kiểm chứng.

Cập nhật 04/11/2026: schema đích tương thích A1 @7beb0cb, có Ingredient/RecipeItem/ToppingRecipeItem/InventoryReservationItem; không có stock/version ở ProductVariant. Xem [ADR-006](006-a1-recipe-inventory.md).
