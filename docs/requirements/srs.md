# BrewLite - SRS rút gọn: yêu cầu chức năng

Phiên bản: 1.0 | Ngày: 28/10/2026 | Phụ trách: Khang | Truy vết: [A2-1.2.1 / Issue #2](https://github.com/phananhkhang/BrewLite_A2/issues/2).

## 1. Căn cứ, cấu trúc và quy ước

Nguồn chính: `Assignment2-BrewLite (1).pdf`, ver 1.0, mục 1.1, 3.2, 6.3 và 7.1-7.2 (trang PDF 3-4, 6-7; trang in 2-3, 5-6). Baseline kế thừa: `docs/tham_khao/BrewLite/docs/phan-tich-de-bai.md`, `docs/architecture/use-case-overview.md`, `order-state-machine.md`, `api-spec.md`, `docs/use-cases/UC-06-tao-don-hang.md`, `UC-08-thuc-hien-thanh-toan.md` và `apps/api/prisma/schema.prisma` bên trong thư mục tham khảo.

SRS được chia theo trách nhiệm để review từng issue:

| Thành phần | Tạo phẩm | Issue |
|---|---|---|
| Bối cảnh/phạm vi | `docs/requirements/context-and-scope.md` | #1 |
| FR, quy tắc nghiệp vụ, AC | `docs/requirements/srs.md` (tệp này) | #2 |
| NFR và cách đo | `docs/requirements/non-functional-requirements.md` | #3 |
| Actor, boundary, UC và ánh xạ FR | `docs/requirements/use-case-overview.md`, nguồn/bản xuất trong `docs/diagrams/` | #4 |

Các tệp thuộc issue khác được nêu bằng đường dẫn để không coi chúng đã tồn tại trước khi PR tương ứng được merge. Đây là đặc tả đích, **chưa phải kết quả triển khai hay test**. Mã `AT-FR-*` là ca kiểm chứng cần thực hiện ở task sau, không phải tên test đã có.

- **Must**: bắt buộc để nghiệm thu MVP cuối A2; **Should**: cần có, có thể hoãn nếu có lý do và rủi ro được review; **Could**: mở rộng khi còn nguồn lực; **Won't**: chủ ý không làm trong MVP.
- Giữ FR-01..10 và UC-01..10 theo baseline tham khảo để không đổi nghĩa khi truy vết. FR-11..15 tách phần ưu tiên bổ sung.
- Role tài khoản chỉ gồm `CUSTOMER` và `BARISTA`. Khách chưa đăng nhập thực hiện phần public của actor Khách hàng. Mock Payment Gateway là actor tích hợp, không có JWT role.
- Tiền là số nguyên VND; thời gian lưu UTC; API tương đối dưới `/api/v1`. SRS quy định kết quả nghiệp vụ, hợp đồng endpoint chi tiết sẽ được chốt khi thiết kế.

## 2. Danh mục yêu cầu và ưu tiên

| Mã | Yêu cầu | MoSCoW | Actor / UC | Căn cứ |
|---|---|---|---|---|
| FR-01 | Xem menu và các trạng thái tải/rỗng/lỗi | Must | Khách hàng / UC-03 | A2 mục 6.3 |
| FR-02 | Xem chi tiết sản phẩm | Must | Khách hàng / UC-04 | A2 mục 7.1 |
| FR-03 | Chọn size, topping, đường/đá và ghi chú hợp lệ | Must | Khách hàng / UC-04 | A2 mục 7.1; đường/đá/note kế thừa baseline |
| FR-04 | Quản lý giỏ và tạm tính | Must | Khách hàng / UC-05 | A2 mục 7.1 |
| FR-05 | Đăng ký, đăng nhập, phiên JWT và phân quyền | Must | Khách hàng, Barista / UC-01/02 | A2 mục 7.1 |
| FR-06 | Tạo đơn, tính giá và giữ tồn nguyên tử | Must | Khách hàng / UC-06 | A2 mục 7.1-7.2; quy tắc A1 |
| FR-07 | Thanh toán Ví/Thẻ mock, chống lặp và thử lại | Must | Khách hàng, Gateway / UC-08 | A2 mục 4.2, 7.1-7.2 |
| FR-08 | Xác nhận, chi tiết và lịch sử đơn của mình | Must | Khách hàng / UC-09 | A2 mục 7.1 |
| FR-09 | Quản lý vòng đời, hủy đơn và tiến độ pha chế | Must | Khách hàng, Barista / UC-10 | A2 mục 3.2, 7.1; state machine A1 |
| FR-10 | Coupon và loyalty nhất quán | Must | Khách hàng / UC-07/08 | Kế thừa baseline A1, thuộc phạm vi đề xuất A2 |
| FR-11 | Phân trang lịch sử đơn | Should | Khách hàng / UC-09 | Thiết kế nhóm, không phải ngưỡng do đề A2 quy định |
| FR-12 | UI vận hành quầy đầy đủ | Could | Barista / mở rộng UC-10 | Mở rộng; API tiến độ thuộc FR-09 vẫn Must |
| FR-13 | Gia hạn phiên bằng refresh token | Could | Khách hàng, Barista / mở rộng UC-02 | Khuyến nghị baseline |
| FR-14 | Cập nhật trạng thái realtime | Could | Khách hàng / mở rộng UC-09 | Mở rộng; MVP tải lại để xem trạng thái |
| FR-15 | Thanh toán/hoàn tiền qua nhà cung cấp tiền thật | Won't | Ngoài MVP | MVP chỉ mô phỏng, không thu tiền thật |

## 3. Tiêu chí chấp nhận có thể kiểm chứng

### FR-01 - Menu

- **AT-FR-01.1:** Với seed có sản phẩm/biến thể active và inactive, `GET /products` trả danh sách active; mỗi thẻ có tên, ảnh hoặc ảnh thay thế và giá niêm yết từ variant active. Tùy chọn inactive không được đặt mua.
- **AT-FR-01.2:** Khi API đang chờ, UI hiển thị loading; danh sách rỗng có thông báo rỗng; lỗi mạng/5xx có thông báo và nút thử lại. Không hiển thị lỗi như danh sách rỗng. Khi thử lại thành công, menu được cập nhật.
- Kiểm chứng: API integration với seed có kiểm soát; UI test ba response chậm/rỗng/lỗi và một response thành công. UC-03, dự kiến Sprint 1.

### FR-02 - Chi tiết

- **AT-FR-02.1:** Chọn một sản phẩm từ menu hiển thị tên, mô tả, ảnh, size/giá và topping được phép; sản phẩm inactive/không tồn tại trả 404; ID sai định dạng trả 400. UI có trạng thái lỗi và đường quay lại menu.
- **AT-FR-02.2:** Variant hết tồn hoặc sản phẩm không có variant mua được không cho thêm vào giỏ; không coi dữ liệu catalog cũ ở client là cam kết còn hàng.
- Kiểm chứng: API fixture active/inactive/hết tồn; UI mở đúng sản phẩm và xử lý 400/404. UC-04.

### FR-03 - Tùy chọn món

- **AT-FR-03.1:** Mỗi dòng có đúng một size, không lặp topping và chỉ chọn topping hợp lệ của sản phẩm. UI cho chọn đường/đá chuẩn (`null`) hoặc 0/25/50/75/100%; API nhận số nguyên 0..100 hoặc null. `0` được giữ nguyên, không thay bằng mặc định.
- **AT-FR-03.2:** Ghi chú trim hai đầu, tối đa 500 ký tự; trống/không gửi thành null. Tùy chọn và note áp dụng cho toàn quantity của dòng. Quantity là số nguyên 1..20; đơn tối đa 20 dòng sau chuẩn hóa. Backend từ chối quantity 0/21, topping trùng/sai sản phẩm, mức ngoài khoảng hoặc note quá dài bằng 400 và không ghi đơn.
- **AT-FR-03.3:** Đơn giá tạm tính = giá size + tổng giá từng topping; thành tiền dòng = đơn giá x quantity. Size 50.000 + topping 7.000, quantity 2 cho 114.000 VND; đổi đường/đá/note không đổi giá.
- Kiểm chứng: unit pricing/normalization, UI lựa chọn, HTTP validation và kiểm tra DB không đổi khi lỗi. UC-04.

### FR-04 - Giỏ hàng

- **AT-FR-04.1:** Thêm, sửa quantity/tùy chọn và xóa cập nhật đúng dòng, số lượng và tạm tính; giỏ rỗng không checkout. Cùng variant, tập topping, đường/đá và note đã chuẩn hóa gộp thành một dòng trong giới hạn 1..20; khác một thành phần giữ dòng riêng.
- **AT-FR-04.2:** Reload giữ món/quantity/tùy chọn/note; localStorage lỗi hoặc dữ liệu cũ hỏng không làm ứng dụng crash. Chưa đăng nhập thì chuyển tới đăng nhập trước tạo đơn và giữ giỏ để quay lại checkout.
- **AT-FR-04.3:** Khi tạo đơn/thanh toán lỗi hoặc chưa rõ kết quả, không xóa dữ liệu giỏ. Khi xác nhận thanh toán thành công, chỉ xóa phần giỏ đã dùng cho đơn đó và giữ các món mới thêm sau checkout.
- Kiểm chứng: store/component test và browser E2E reload, đăng nhập, thất bại/retry. UC-05.

### FR-05 - Xác thực và quyền

- **AT-FR-05.1:** Username 3..50 ký tự thuộc `[a-zA-Z0-9_.-]`, password 6..100 ký tự theo contract kế thừa; đăng ký hợp lệ tạo duy nhất tài khoản `CUSTOMER`, không trả password/hash. Username trùng trả 409; trường role do client tự thêm bị từ chối. BARISTA được cấp qua seed/quy trình nội bộ.
- **AT-FR-05.2:** Thông tin đúng cấp access JWT có hạn; sai username/password trả cùng thông báo 401, không tiết lộ tài khoản tồn tại. Thiếu/sai/hết hạn JWT trên route được bảo vệ trả 401; sai role trả 403.
- **AT-FR-05.3:** Reload xác minh phiên với server; JWT hết hạn đưa về đăng nhập và giữ giỏ. Lỗi mạng tạm thời không bị diễn giải thành đăng xuất. Logout xóa phiên client; MVP không tuyên bố thu hồi JWT đã phát trước hạn.
- **AT-FR-05.4:** Khách B không được đọc, thanh toán hoặc hủy đơn của A, kể cả biết orderId hoặc idempotency key; request bị từ chối và không đổi dữ liệu. Kiểm tra ownership trước khi trả kết quả payment replay.
- Kiểm chứng: auth unit/HTTP integration với hai customer và một Barista; phiên hết hạn; thử payload tự cấp role. UC-01/02, áp dụng cho UC-06..10.

### FR-06 - Tạo đơn

- **AT-FR-06.1:** Khách đã đăng nhập gửi giỏ hợp lệ tạo mã đơn duy nhất, trạng thái `PENDING`, items/topping snapshot và mốc hết hạn giữ tồn. Chủ đơn lấy từ JWT; tên/giá lấy từ DB. Không nhận giá/tổng/userId do client áp đặt.
- **AT-FR-06.2:** Snapshot giữ giá/tên món, size, topping, đường/đá (null khác 0) và note; đổi catalog sau đó không đổi đơn cũ. Tổng `subtotal - discountAmount = total >= 0`.
- **AT-FR-06.3:** Gộp tồn cần giữ theo variant qua mọi dòng. Tạo order/items/reservations/history và giữ coupon (nếu có) cùng transaction; một lỗi sau giữ tồn phải rollback toàn bộ. Hết tồn trả 409 và không tạo bộ dữ liệu dở dang.
- **AT-FR-06.4:** Stock 5, 20 request đồng thời mỗi request mua 1 cùng variant, không restock trong lượt: đúng 5 đơn được tạo, 15 bị từ chối nghiệp vụ, stock cuối 0 và tổng reservation ACTIVE là 5, không stock âm.
- Kiểm chứng: integration với PostgreSQL thật, fault injection sau reserve, cập nhật catalog và ca concurrency. UC-06.

### FR-07 - Thanh toán

- **AT-FR-07.1:** Chủ đơn chọn `E_WALLET` hoặc `CARD`, gửi `orderId`, `method`, header `Idempotency-Key`; amount lấy từ order server. Thiếu key/sai method trả 400. Chỉ thanh toán khi đơn và reservation hợp lệ.
- **AT-FR-07.2:** Gateway thành công lưu Payment `SUCCEEDED`, Order `PAID`, consume reservation/coupon, ghi history và cộng điểm đúng một lần, cùng transaction. Gateway được gọi ngoài transaction DB dài.
- **AT-FR-07.3:** Cùng key và payload đã hoàn tất trả kết quả attempt đã lưu, không charge/ghi kép. Attempt đang `PROCESSING` trả 409 `PAYMENT_IN_PROGRESS`; cùng key khác order/method/hash trả 409 `IDEMPOTENCY_KEY_REUSED`. Key mới cũng không được tạo thành công thứ hai cho đơn đã paid.
- **AT-FR-07.4:** Gateway từ chối xác định lưu `FAILED`, đơn `PAYMENT_FAILED`, không cộng điểm; giữ reservation đến hạn retry. Retry dùng key mới, chuyển về `PENDING` trước attempt mới, không giữ tồn lần hai. Hết hạn/hủy đơn không được retry.
- **AT-FR-07.5:** Timeout/lỗi gateway chưa rõ kết quả trả lỗi tạm thời 503; UI báo đang kiểm tra và cho tra cứu/gửi lại cùng key. Không khẳng định thất bại, không tạo attempt mới hoặc hoàn tồn khi chưa đối soát attempt đang xử lý.
- Kiểm chứng: gateway stub success/decline/timeout; integration replay nối tiếp và đồng thời, payload khác, key khác cùng đơn, sai chủ và lỗi trước commit. UC-08.

### FR-08 - Xác nhận và lịch sử

- **AT-FR-08.1:** Sau thanh toán, màn xác nhận hiển thị mã đơn, kết quả payment và trạng thái order do server trả; không suy ra thành công chỉ từ việc đã tạo đơn. Refresh trang vẫn lấy được đơn, không tạo đơn/payment mới.
- **AT-FR-08.2:** `GET /orders/me` chỉ trả đơn của principal, mới nhất trước; `GET /orders/:id` trả snapshot, tổng tiền và timeline của đơn được cấp quyền. Không có đơn hiển thị empty; API lỗi có thử lại. ID không tồn tại trả 404, ID của khách khác bị từ chối không lộ nội dung.
- **AT-FR-08.3:** Tải lại sau Barista cập nhật cho thấy trạng thái mới, tên/tổng tiền/tùy chọn/note của đơn cũ giữ nguyên.
- Kiểm chứng: API với hai customer, thay catalog sau mua, UI refresh/empty/error và E2E từ menu tới xác nhận. UC-09.

### FR-09 - Vòng đời đơn hàng

- **AT-FR-09.1:** Chỉ chấp nhận transition trong bảng dưới; mỗi transition hợp lệ ghi trạng thái trước/sau, thời gian và actor (user hoặc hệ thống). `PENDING -> READY`, chuyển khỏi trạng thái cuối hoặc chuyển lặp về chính trạng thái trả 409 `ORDER_INVALID_TRANSITION`, không đổi dữ liệu.
- **AT-FR-09.2:** Chỉ BARISTA được cập nhật tiến độ pha chế. Chủ đơn được hủy theo điều kiện; user khác bị từ chối. Không hủy/expire khi payment còn xử lý chưa đối soát. Hủy/hết hạn hoàn tồn và giải phóng coupon chưa dùng đúng một lần.
- **AT-FR-09.3:** Hai request `PAID -> CANCELLED` và `PAID -> PREPARING` đua nhau chỉ một request commit; request còn lại nhận 409, không có history/hoàn tồn kép. Hủy PAID giữ payment thành công/coupon/điểm theo baseline, không mô phỏng hoàn tiền.
- Kiểm chứng: test bảng transition, HTTP RBAC/ownership và integration race/expiry với DB thật. UC-10; nhánh hủy do khách cũng thuộc UC-10, không tạo actor tài khoản cho job.

| Từ | Tới | Tác nhân khởi tạo / điều kiện |
|---|---|---|
| Khởi tạo | PENDING | Khách tạo đơn hợp lệ; server giữ tồn |
| PENDING | PAID / PAYMENT_FAILED | Kết quả payment thành công / từ chối xác định |
| PAYMENT_FAILED | PENDING | Chủ đơn retry bằng key mới khi reservation còn hạn |
| PENDING / PAYMENT_FAILED | CANCELLED | Chủ đơn hủy hoặc hệ thống hết hạn; không có attempt đang xử lý |
| PAID | CANCELLED | Chủ đơn hủy trước khi nhận pha; giữ payment/coupon/điểm, hoàn tồn một lần |
| PAID | PREPARING | BARISTA nhận pha |
| PREPARING | READY | BARISTA pha xong |
| READY | COMPLETED | BARISTA giao khách |

`COMPLETED` và `CANCELLED` là trạng thái cuối. Thanh toán, hết hạn và history là xử lý nội bộ BrewLite; không vẽ chúng thành người dùng bên ngoài.

### FR-10 - Coupon và loyalty

- **AT-FR-10.1:** Coupon là tùy chọn, tối đa một mã/đơn. Server kiểm tra active, thời gian, minimum subtotal, phạm vi và hạn mức tổng/theo user. Coupon sai/hết hạn/hết lượt không được giảm giá; thông báo để khách bỏ/sửa mã trước đặt đơn.
- **AT-FR-10.2:** Quote chỉ để xem trước; tạo đơn kiểm tra lại và giữ lượt dùng nguyên tử. Ví dụ subtotal 114.000, giảm cố định 10.000 cho total 104.000; giảm không vượt subtotal, total không âm. Hủy/hết hạn đơn chưa thanh toán giải phóng lượt đúng một lần; đơn PAID consume lượt đúng một lần.
- **AT-FR-10.3:** Quy ước nhóm đề xuất để chốt phép kiểm chứng: `floor(total VND / 1000)` sau payment SUCCEEDED; ví dụ total 104.000 nhận 104 điểm. Tài liệu tham khảo chưa chốt tỷ lệ điểm, nên tỷ lệ này cần PO review trước triển khai. Lưu ledger `EARN` gắn order và cập nhật balance cùng transaction. Replay/đồng thời không tăng thêm; payment FAILED không có EARN. Hủy PAID giữ điểm theo luật FR-09.
- Kiểm chứng: unit biên thời gian/số tiền, integration coupon hạn mức 1 với request đồng thời và payment replay; kiểm tra ledger/balance. UC-07 và UC-08; loyalty là hậu điều kiện backend của thanh toán, không có thao tác đổi điểm trong MVP.

### FR-11..15 - Ưu tiên bổ sung

| Mã | Tiêu chí kiểm chứng khi triển khai / review phạm vi |
|---|---|
| FR-11 / Should | Lịch sử có limit mặc định 20, tối đa 100; ID/timestamp làm thứ tự ổn định; duyệt hai trang của dataset cố định không lặp/mất đơn, không lộ đơn người khác; tham số sai trả 400. API integration có ít nhất 45 đơn. |
| FR-12 / Could | Nếu đưa vào release: Barista xem đơn đã paid cùng tùy chọn/note, thao tác tiến độ theo FR-09, UI có loading/error; customer không vào màn quầy. Nếu hoãn: ghi backlog, API FR-09 vẫn phải được test. |
| FR-13 / Could | Nếu đưa vào release: refresh token HttpOnly, rotate/revoke theo thiết kế được review; token sai/hết hạn bị từ chối và có test HTTP. Nếu hoãn: đăng nhập lại khi access token hết hạn vẫn đạt MVP. |
| FR-14 / Could | Nếu đưa vào release: chỉ chủ đơn nhận cập nhật, kết nối lại không mất trạng thái và vẫn tải lại được. Nếu hoãn: UI reload theo FR-08 vẫn phải hoạt động. |
| FR-15 / Won't | Review code/cấu hình/demo xác nhận dùng mock, không có thông tin thẻ thật hoặc charge tiền thật; mọi tích hợp thật phải qua thay đổi phạm vi và AC mới. |

## 4. Các quy tắc dùng chung và giới hạn

1. Client hiển thị tạm tính; server là nguồn giá/tồn/quyền và kết quả thanh toán. Tự thêm `total`, `amount`, `userId` hoặc `role` vào request nghiệp vụ không thay đổi kết quả được server cho phép.
2. Một đơn có thể có nhiều payment attempt; tối đa một payment SUCCEEDED và một EARN. Số đơn được tạo không thay thế kiểm chứng chống lặp payment; `POST /orders` không được mặc nhiên coi là idempotent.
3. Lỗi validate không ghi DB; lỗi nghiệp vụ không để dữ liệu dở dang. Frontend và backend đều validate, backend vẫn kiểm tra khi gọi API trực tiếp.
4. Không đưa giao hàng, nhiều chi nhánh, quản trị nguyên liệu, đổi điểm hoặc hoàn tiền thật vào AC MVP. PWA/mobile, bảo mật, latency và deployment được đo trong NFR ở issue #3.
5. Mọi AC trên là kế hoạch kiểm chứng. Khi triển khai, ma trận `docs/traceability-matrix.md` cần trỏ tới test/code thật và evidence có commit; không đánh dấu pass bằng việc chỉ đọc baseline tham khảo.
