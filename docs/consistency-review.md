# Đối chiếu tính nhất quán Task 1–3

Ngày: 04/11/2026. Nguồn tên/actor: `docs/diagrams/use-case-overview.drawio` và PNG tổng thể của nhóm; nguồn domain: [A1 @7beb0cb06a2a89bc53a119bcb8d905cf596f548b](https://github.com/akira-yami/BrewLite_A1/tree/7beb0cb06a2a89bc53a119bcb8d905cf596f548b).

## Tên use case chuẩn

| ID | Tên |
|---|---|
| UC-01 | Đăng ký |
| UC-02 | Đăng nhập |
| UC-03 | Xem menu |
| UC-04 | Xem chi tiết sản phẩm + size + topping |
| UC-05 | Quản lý giỏ hàng |
| UC-06 | Đặt hàng |
| UC-07 | Áp dụng coupon |
| UC-08 | Thực hiện thanh toán |
| UC-09 | Xem xác nhận và lịch sử đơn hàng |
| UC-10 | Cập nhật trạng thái đơn hàng |

Khách hàng liên kết UC-01/02/03/05/06/07/08/09; Nhân viên quầy liên kết UC-02/10; Mock Payment Gateway chỉ UC-08. Hai extend giữ nguyên: UC-04 -> UC-03 và UC-07 -> UC-06. Không sửa ảnh/nguồn tổng thể gốc hoặc tự thêm include giữa UC-06 và UC-08.

## Các điểm đã sửa và nơi thể hiện

| Phát hiện | Điều chỉnh | Tạo phẩm / PR |
|---|---|---|
| Đặc tả và sequence gộp đặt/thanh toán | UC-06: Đặt hàng riêng, kết thúc ở 201 PENDING; không gateway/payment/EARN. UC-08: Thực hiện thanh toán thuộc #6/#9 riêng | PR #50 đặc tả/source/export UC-06; PR #51 sequence-create-order/source/export |
| Tên UC văn bản lệch tên trên ảnh tổng thể | Chuẩn hóa bảng UC với 10 tên bên trên | [Use case tổng quát](requirements/use-case-overview.md); tài liệu mới #50/#51 |
| Task 1/3 vẫn nói kho variant, loại BOM khỏi scope | Ingredient.stockQuantity/version; RecipeItem/ToppingRecipeItem; reservation item snapshot; giữ mã FR/NFR/AC | [Scope](requirements/context-and-scope.md), [SRS](requirements/srs.md), [NFR](requirements/non-functional-requirements.md), [kiến trúc](architecture/system-architecture.md), ADR-002/004/[006](architecture/adr/006-a1-recipe-inventory.md) trong PR #52 |
| Class cũ thiếu công thức/kho, tự đổi tên model và enum | Theo đủ 18 model/11 enum của schema A1; Coupon (Promotion trong đề), FK cardinality thật, nullable order ledger, enum EXPIRED | [Class domain](architecture/class-domain.md), source/SVG/PNG trong PR #52 |
| Nhầm OrderItem.unitPrice đã cộng topping | unitPrice lưu giá variant, topping snapshot riêng; lineTotal cộng đúng một lần | SRS/kiến trúc/UC/sequence/class |
| Fixture/test/truy vết/backlog tiếp tục dùng stock thành phẩm và sequence chung | Fixture ingredient X=50/BOM X=10, shared ingredient món/topping, UC/sequence tách biệt | [Test plan](testing/test-plan.md), [ma trận](traceability-matrix.md), backlog/DoD/Sprint 2 |
| Deployment nói A1 kho nguyên liệu khác scope A2 | A2 tiếp nhận domain A1 theo chỉ dẫn này; source production vẫn A1 | PR #53 deployment/ADR-005, không đổi cấu hình Railway |

## Giới hạn được giữ rõ

- Code/schema A1 là căn cứ cố định, không phải runtime đã nhập vào A2 hoặc chứng minh AC/NFR A2 đã pass.
- Sơ đồ UC tổng thể là quan hệ chức năng; activity có thể thể hiện end-to-end nhưng không làm hai use case thành một.
- UC-08/sequence payment #6/#9, activity #7 và các tạo phẩm khác chưa có trong main phải được cập nhật theo cùng contract, không ghi đã hoàn thành chỉ từ báo cáo này.
- Hành vi đích về timeout/recovery/hủy PAID không mặc nhiên được chứng minh bởi schema; giữ kế hoạch kiểm chứng riêng. Các phần kiến trúc logging/HTTPS/CI vẫn cần evidence thực tế.
- Các PR độc lập để review: merge #52 đồng bộ baseline trước hoặc cùng #50/#51/#53; không thêm bản sao tệp của PR khác vào từng nhánh.

Kiểm tra hồ sơ: model/field/enum/quan hệ theo schema cố định; tên UC theo XML nguồn gốc; không còn Payment Service hoặc POST /payments trong sequence UC-06; nguồn/bản xuất được render lại; liên kết local mở được trong từng nhánh và nội dung ghép bốn PR. Kiểm tra này không thay test sản phẩm.

Kết quả kiểm tra 04/11/2026: 18 model, 11 enum và 24 quan hệ FK/multiplicity khớp schema A1 tại commit đã ghi; giữ đủ 32 mã AT-FR có sẵn; 10 tên UC khớp XML tổng thể. Source/PNG tổng thể không đổi theo Git; các sơ đồ sửa đã render lại SVG/PNG và xem ảnh. Liên kết local trong các thay đổi bốn nhánh đều tồn tại.
