# Class diagram domain - Công thức và kho nguyên liệu

Phiên bản 1.1 · 04/11/2026 · [A2-2.3 / #10](https://github.com/akira-yami/BrewLite_A2/issues/10).

[Nguồn PlantUML](../diagrams/class-domain.puml) · [SVG](../diagrams/class-domain.svg) · [PNG](../diagrams/class-domain.png).

![Class domain tương thích A1](../diagrams/class-domain.svg)

## Nguồn và phạm vi

Đối chiếu trực tiếp [BrewLite_A1 commit 7beb0cb06a2a89bc53a119bcb8d905cf596f548b](https://github.com/akira-yami/BrewLite_A1/tree/7beb0cb06a2a89bc53a119bcb8d905cf596f548b), cụ thể [Prisma schema](https://github.com/akira-yami/BrewLite_A1/blob/7beb0cb06a2a89bc53a119bcb8d905cf596f548b/apps/api/prisma/schema.prisma), OrdersService, InventoryService/Repository và order-item.mapper. Hình giữ tên model/field/enum/FK của schema; chỉ lược timestamps thông thường. Không gọi đây là schema đã được triển khai trong A2.

`Coupon` chính là lớp Promotion theo nghĩa yêu cầu đề bài. Nhãn hình ghi rõ Coupon (Promotion trong đề); không tạo thêm model Promotion/PromotionRedemption khác code. `CouponRedemption` và `LoyaltyTransaction.userId` giữ nguyên quan hệ thật với User, không suy diễn qua Order để thay schema.

## Công thức, tồn và reservation

- ProductVariant có size ProductSize S/M/L, giá và active; không có stock hoặc version. Ingredient có unit G/ML/PCS, stockQuantity, version, active. StockQuantity dùng đơn vị cơ sở nguyên, không gộp các ingredient/đơn vị khác nhau thành một số stock tổng.
- RecipeItem có khóa (productVariantId, ingredientId), quantity cho một ly. ToppingRecipeItem có khóa (toppingId, ingredientId), quantity cho một phần topping. Topping.type PREPACKAGED/PREPARED phân biệt topping nhập sẵn/chế biến; cả hai vẫn tiêu hao Ingredient qua công thức.
- Với mỗi item, nhu cầu ingredient = quantity ly x (BOM món + BOM từng topping được chọn); cộng nhu cầu ingredient qua mọi dòng/variant/topping trước khi giữ kho. Thiếu BOM/ingredient inactive không bán được. availableServings là giá trị tính từ min floor(stockQuantity/recipe.quantity), không là cột ProductVariant.stock; số hiển thị riêng lẻ không thay kiểm tra shared ingredient toàn đơn.
- InventoryReservation unique (orderId, productVariantId) lưu số ly tổng của variant. InventoryReservationItem unique (reservationId, ingredientId) lưu lượng nguyên liệu thực tế đã giữ, gồm cả topping. Hoàn kho theo các item này, không đọc lại BOM mới.
- UPDATE Ingredient có điều kiện version và đủ stockQuantity; giảm tồn/tăng version cùng transaction tạo order/reservation/history/coupon. Consume reservation không giảm tồn lần hai. Status giữ đủ ACTIVE/CONSUMED/RELEASED/EXPIRED và CouponRedemptionStatus tương ứng RESERVED/CONSUMED/RELEASED/EXPIRED.

## Snapshot, tiền, multiplicity và enum

OrderItem.unitPrice là giá variant, không cộng topping vào trường này. OrderItemTopping có toppingNameSnapshot/unitPrice/quantity; runtime tạo quantity=1 cho mỗi topping mỗi ly. Mapper tính lineTotal = (item.unitPrice + tổng topping.unitPrice x topping.quantity) x item.quantity. Subtotal cộng lineTotal, total=subtotal-discountAmount >=0; tiền BigInt VND, response chuyển số nguyên an toàn. Đường/đá/note giữ snapshot; không suy code tham chiếu đã điều chỉnh lượng BOM theo phần trăm đường/đá.

Multiplicity trong hình theo schema: Order có 0..* items/payments/reservations/history; service phải bảo đảm order đã commit có 1..20 dòng và reservation phù hợp. CouponRedemption.orderId unique -> 0..1 redemption/order. LoyaltyTransaction.orderId nullable -> một entry có thể không có order; User có nhiều entry, Order có nhiều entry ở schema. Giữ đầy đủ EARN/REDEEM/ADJUSTMENT/REVERSAL; các loại mở rộng trong schema không tự thêm use case đổi điểm vào MVP. Partial unique EARN/order và SUCCEEDED payment/order nằm ở SQL migration, không suy ra từ FK cardinality.

OrderStatus, PaymentStatus/Method và UserRole giữ nguyên schema. Không dùng Payment SUCCEEDED làm OrderStatus. Referential onDelete là Restrict cho dữ liệu giao dịch; hình dùng association, không dựng composition để ám chỉ cascade delete.

## Truy vết Task 1–3

Tên chuẩn: UC-06: Đặt hàng chỉ tạo PENDING/giữ nguyên liệu; UC-08: Thực hiện thanh toán độc lập mới tạo payment/consume/EARN. UC-07: Áp dụng coupon extend UC-06. Class diagram bao phủ toàn domain nên có Payment/Loyalty; sự có mặt của các lớp này không gộp UC-06 với UC-08.

[SRS](../requirements/srs.md), [scope](../requirements/context-and-scope.md), [NFR](../requirements/non-functional-requirements.md), [kiến trúc](system-architecture.md), [ADR-006](adr/006-a1-recipe-inventory.md) và [test plan](../testing/test-plan.md) được đồng bộ với BOM/Ingredient. [Báo cáo nhất quán](../consistency-review.md) ghi rõ phạm vi sửa và việc còn thiếu. UC-06 riêng trong PR #50, sequence UC-06 riêng trong PR #51; payment #6/#9 theo tài liệu độc lập.

Kiểm chứng khi triển khai: shared ingredient qua nhiều variant/topping, thiếu BOM/inactive ingredient, snapshot BOM giữ chỗ rồi đổi công thức, rollback sau giữ nguyên liệu, cạnh tranh số ly suy từ nguyên liệu, expiry/release đúng một lần. Các test chưa chạy trên A2; source/test A1 là căn cứ thiết kế, không chuyển thành evidence A2.

## Kết xuất

Java + PlantUML 1.2026.8 từ root repository:

```powershell
java '-Djava.awt.headless=true' '-DPLANTUML_LIMIT_SIZE=16000' -jar C:/tools/plantuml-1.2026.8.jar -charset UTF-8 -tsvg docs/diagrams/class-domain.puml
java '-Djava.awt.headless=true' '-DPLANTUML_LIMIT_SIZE=16000' -jar C:/tools/plantuml-1.2026.8.jar -charset UTF-8 -tpng docs/diagrams/class-domain.puml
```

Kiểm tra toàn bộ model/enum/field/quan hệ được vẽ với schema cố định ở commit trên, rồi kiểm tra ảnh/multiplicity. Commit source và hai bản xuất cùng PR.
