# BrewLite - Use-case diagram tổng quát

Phiên bản: 1.0 | Ngày: 28/10/2026 | Phụ trách: Khang | Truy vết: [A2-1.2.3 / Issue #4](https://github.com/phananhkhang/BrewLite_A2/issues/4).

- [Nguồn PlantUML chỉnh sửa được](../diagrams/use-case-overview.puml)
- [Bản xuất SVG](../diagrams/use-case-overview.svg), [bản PNG](../diagrams/use-case-overview.png)
- [Manifest kiểm tra nguồn/bản xuất](../diagrams/use-case-overview.manifest.json)
- [Script render/kiểm tra](../../scripts/render-use-case.mjs)

![Use-case tổng quát BrewLite MVP](../diagrams/use-case-overview.svg)

## 1. Actor và ranh giới

| Actor | Quyền / vai trò |
|---|---|
| Khách hàng | Chưa đăng nhập: đăng ký/đăng nhập, xem menu/detail, chọn tùy chọn và quản lý giỏ. Có role `CUSTOMER` mới tạo/thanh toán đơn, áp coupon tại checkout, đọc và hủy đơn của mình theo luật. |
| Nhân viên quầy / Barista | Đăng nhập với `BARISTA`; cập nhật `PAID -> PREPARING -> READY -> COMPLETED`. Không tự thanh toán hộ khách hay chuyển đơn sang PAID. |
| Mock Payment Gateway | Cộng tác với UC-08, trả success/decline hoặc kết quả chưa rõ. Đây là actor tích hợp logic, không phải tài khoản/JWT role; có thể cùng deployment qua adapter mock. |

Hình chữ nhật chứa chức năng do **BrewLite** chịu trách nhiệm, gồm web, API và dữ liệu do hệ thống quản lý. DB, inventory, loyalty, expiry job và việc kiểm tra JWT là xử lý nội bộ, không phải actor ngoài. Quản lý cửa hàng, giảng viên và nhóm phát triển là stakeholder; MVP không có use case quản trị dành riêng cho họ. Mô hình deployment vật lý được chốt ở Task 3, không suy ra từ vị trí gateway trên sơ đồ logic.

## 2. Ánh xạ use case với FR

FR-01..15 được đặc tả trong `docs/requirements/srs.md` thuộc [issue #2](https://github.com/phananhkhang/BrewLite_A2/issues/2); NFR ở `docs/requirements/non-functional-requirements.md` thuộc [issue #3](https://github.com/phananhkhang/BrewLite_A2/issues/3). Những PR này cần được merge trước khi nghiệm thu bộ SRS hoàn chỉnh. Sơ đồ chỉ vẽ MVP; các mở rộng được theo dõi ở bảng bên dưới.

| UC | Chức năng | FR / MoSCoW | Tiền điều kiện hoặc kết quả cần giữ |
|---|---|---|---|
| UC-01 | Đăng ký | FR-05 / Must | Public chỉ tạo CUSTOMER, không tự cấp BARISTA |
| UC-02 | Đăng nhập | FR-05 / Must | Khách/Barista nhận JWT hợp lệ; sai thông tin bị từ chối |
| UC-03 | Xem menu | FR-01 / Must | Public; active catalog; loading/empty/error |
| UC-04 | Chi tiết và tùy chọn | FR-02/03 / Must | Một size, topping hợp lệ, đường/đá/note; giá tạm tính đúng |
| UC-05 | Quản lý giỏ | FR-04 / Must | Thêm/sửa/xóa, persist lựa chọn và giỏ, giữ giỏ khi lỗi |
| UC-06 | Đặt đơn | FR-06 / Must | CUSTOMER + giỏ hợp lệ; giá server; snapshot, giữ tồn và PENDING cùng transaction |
| UC-07 | Áp dụng coupon | FR-10 / Must | Tùy chọn khi checkout; server kiểm tra hạn/điều kiện/lượt dùng và total không âm |
| UC-08 | Thanh toán | FR-07/10 / Must | Chủ đơn, amount server, key bắt buộc; chống lặp, retry đúng luật; EARN một lần sau success |
| UC-09 | Xác nhận, chi tiết, lịch sử | FR-08 / Must; FR-11 / Should (phân trang) | Chỉ đọc đơn của mình, snapshot/timeline, tải lại lấy trạng thái mới |
| UC-10 | Cập nhật trạng thái / hủy | FR-09 / Must | Khách chỉ hủy của mình khi hợp lệ; BARISTA chỉ tiến độ pha; transition sai 409 |

FR-12 (UI quầy đầy đủ, Could) là mở rộng UC-10; API tiến độ vẫn Must. FR-13 (refresh token, Could) mở rộng UC-02; FR-14 (realtime, Could) mở rộng UC-09. FR-15 (cổng tiền thật, Won't) ngoài MVP. Loyalty thuộc hậu điều kiện UC-08, không thêm actor hay use case đổi điểm.

## 3. Ý nghĩa quan hệ UML và quy tắc nhất quán

1. Đường liền là liên kết actor với chức năng, không biểu diễn thứ tự màn hình. Luồng Menu -> Detail -> Cart -> Checkout sẽ được mô hình bằng activity/sequence ở Task 2.
2. `UC-04 -> UC-03 <<extend>>`: mở detail từ menu là hành vi tùy chọn. `UC-07 -> UC-06 <<extend>>`: chỉ áp coupon nếu khách có mã. Arrow đi từ use case mở rộng tới use case gốc; việc coupon là tùy chọn cho mỗi đơn không làm FR-10 bớt bắt buộc phải được triển khai.
3. Đăng nhập là tiền điều kiện của đặt/thanh toán, không phải `include` bắt phải đăng nhập lại mỗi lần đặt đơn. UC-08 độc lập sau khi tạo đơn; thất bại có thể thử lại mà không tạo đơn/reserve lần hai.
4. Bổ sung liên kết Khách hàng với UC-04 và UC-10 để thể hiện trực tiếp chọn tùy chọn và quyền hủy đơn đã có trong state machine tham khảo; không đổi số UC/actor. Chủ đơn có thể hủy từ PENDING/PAYMENT_FAILED hoặc PAID trước nhận pha; không hủy khi payment còn xử lý. Luật hủy PAID giữ payment/coupon/điểm và hoàn tồn một lần là baseline cần PO review.
5. Trạng thái Order là `PENDING`, `PAYMENT_FAILED`, `PAID`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`; Payment dùng enum riêng `PROCESSING`, `SUCCEEDED`, `FAILED`. Không coi Payment SUCCEEDED là tên trạng thái Order.
6. Kiểm tra ownership áp dụng cả replay payment. Kết quả gateway chưa rõ phải được đối soát; không tự đổi sang FAILED hoặc giải phóng tồn. Các quy tắc này thuộc AC FR-05/07/09 và NFR consistency, không thêm use case kỹ thuật riêng.

## 4. Render lại và kiểm tra

Yêu cầu Node.js, Java, PlantUML **1.2026.8**; môi trường bản xuất hiện tại: Java 27, Windows, Arial, Graphviz 2.44.1. Jar có SHA-256 `5e1ecfa8ecd32c90b03bbf3b1eb6f020943f98ab0fcf4032be31a0002ee2c462`, cùng phiên bản renderer trong baseline tham khảo. Script không tải dữ liệu hoặc gửi sơ đồ ra dịch vụ online.

```powershell
# java-executable là tùy chọn nếu java đã nằm trên PATH.
node scripts/render-use-case.mjs 'C:\tools\plantuml-1.2026.8.jar' 'C:\Program Files\Java\jdk-27\bin\java.exe'
node scripts/render-use-case.mjs 'C:\tools\plantuml-1.2026.8.jar' 'C:\Program Files\Java\jdk-27\bin\java.exe' --check
```

Đổi đường dẫn theo máy. Script chuẩn hóa CRLF -> LF, kiểm tra jar, render SVG/PNG trực tiếp từ cùng nguồn và ghi hash vào manifest. `--check` render lại rồi so từng byte với bản xuất/manifest; môi trường font/renderer khác có thể tạo byte khác dù nội dung giống, nên khi đổi môi trường phải review ảnh và cập nhật manifest cùng PR.

Review hình ở bản SVG và PNG: đủ 3 actor, 10 UC trong một boundary; nhãn/đường không che nhau; 2 quan hệ extend đúng hướng; mọi FR Must 01..10 có UC, role/state/luật hủy phù hợp SRS. Việc render thành công chỉ kiểm chứng tạo phẩm sơ đồ, không xác nhận runtime hoặc stakeholder đã phê duyệt. Đặc tả use case trọng tâm A2 mục 3.3 thuộc issue khác.
