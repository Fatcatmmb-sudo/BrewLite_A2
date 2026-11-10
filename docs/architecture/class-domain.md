# Class Diagram domain BrewLite A2

[Nguồn PlantUML](../diagrams/class-domain.puml) · [SVG](../diagrams/class-domain.svg) · [PNG](../diagrams/class-domain.png) · [Prisma schema](../../apps/api/prisma/schema.prisma).

![Class Diagram domain BrewLite A2](../diagrams/class-domain.svg)

Sơ đồ thể hiện thuộc tính domain chính, quan hệ, multiplicity và enum theo schema A2. `Coupon` đại diện cho Promotion trong phạm vi đề. `Ingredient` giữ số lượng và version. Công thức món/topping mô tả nhu cầu nguyên liệu, còn reservation item giữ snapshot lượng đã trừ để hoàn theo lượng thực tế.

`Payment` hỗ trợ `VNPAY`, `MANUAL_REVIEW` và `REFUNDED`. Các model recovery ghi yêu cầu, audit và quyết định có bằng chứng của luồng đối soát. `LoyaltyTransaction` có thể ghi EARN theo đơn hoặc REDEEM khi khách đổi điểm lấy voucher. Xem [ERD](../../database/BrewLite.svg) cho tên bảng, cột, FK và ràng buộc vật lý.
