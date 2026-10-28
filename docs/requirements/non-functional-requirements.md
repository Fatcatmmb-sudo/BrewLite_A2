# BrewLite - SRS rút gọn: yêu cầu phi chức năng

Phiên bản: 1.0 | Ngày: 28/10/2026 | Phụ trách: Khang | Truy vết: [A2-1.2.2 / Issue #3](https://github.com/phananhkhang/BrewLite_A2/issues/3).

## 1. Căn cứ và trạng thái

Nguồn chính: `Assignment2-BrewLite (1).pdf`, ver 1.0, mục 1.1, 3.2, 5.1-5.2, 6.4 và 7.2-7.4 (trang PDF 3-7; trang in 2-6): mobile-first/PWA, hiệu năng, bảo mật, tính khả dụng, khả năng triển khai, CI/CD và production HTTPS. Baseline đo kế thừa từ `docs/tham_khao/BrewLite/docs/phan-tich-de-bai.md`, mục 5; đối chiếu tài liệu tham khảo `docs/architecture/security.md`, `order-state-machine.md`, `docs/testing/test-strategy.md` và `docs/deployment/docker-guide.md` bên trong BrewLite.

Giữ nghĩa NFR-01..11 của baseline tham khảo; bổ sung NFR-12 cho hướng PWA của A2. FR liên quan được định nghĩa trong `docs/requirements/srs.md` (issue #2). Các tài liệu tham khảo mô tả hiện trạng cũ không chứng minh BrewLite_A2 đã có code hay vượt qua phép đo.

**Tất cả NFR dưới đây đang ở trạng thái chưa đo.** Đề A2 yêu cầu các nhóm chất lượng và đầu ra, nhưng không quy định p95, số client, cửa sổ uptime, thời gian khởi động/khôi phục hoặc tỷ lệ điểm. Các con số dưới đây là mục tiêu nghiệm thu nhóm đề xuất từ baseline, không phải số đo đã đạt. Ngưỡng API <500 ms được kế thừa từ phân tích đề A1 trong tài liệu tham khảo; cách đo p95 là quy ước nhóm, không được quy cho đề A2.

MoSCoW: **Must** bắt buộc nghiệm thu MVP cuối A2; **Should** có thể hoãn khi review chấp nhận lý do/rủi ro; **Could** mở rộng; **Won't** ngoài MVP. Toàn bộ NFR-01..12 dưới đây là Must vì bảo vệ luồng lõi hoặc đầu ra bắt buộc. Ưu tiên mở rộng được tách ở mục 5.

## 2. Môi trường và quy trình đo dùng chung

1. Dùng DB test riêng. Ghi commit, thời điểm bắt đầu/kết thúc UTC, CPU/RAM/OS, Node/PostgreSQL/Docker/browser/tool version, cấu hình và seed. Không chạy tải hoặc fault injection trên production/DB dùng chung.
2. Dataset hiệu năng: 100 product, 300 variant, 30 topping, 1.000 order của các test user; stock/coupon đủ cho lượt đo. Warm-up 30 giây, đo 5 phút, 20 client đồng thời. Tách từng endpoint; không chọn lọc bỏ request chậm. Tách cold build, startup, steady-state và fault recovery.
3. Công cụ load tạo request liên tục theo 20 virtual user, ghi tổng mẫu/thời lượng thực tế; đo từ lúc gửi HTTP đến khi nhận đủ response. Báo cáo p50/p95/p99 và tỷ lệ lỗi. Request 4xx/409 nghiệp vụ được đếm riêng, không dùng để làm đẹp latency thành công; 5xx/timeout là lỗi hệ thống. Với phép đo kỳ vọng thành công, business rejection không dự kiến làm lượt đo không đạt điều kiện và phải điều tra/reset dataset.
4. Mỗi NFR có evidence gồm lệnh/cấu hình, dataset, log thô đã che bí mật, số đo, ngưỡng và pass/fail. Lưu evidence ở `docs/testing/evidence/<commit>/<NFR-ID>/` khi thực thi; hiện chưa có bộ evidence này.
5. Chỉ gán **đạt** khi đủ phép thử của NFR. Các trạng thái còn lại là **chưa đo**, **không đạt**, **chưa áp dụng** kèm lý do. Chưa có production URL có thể ghi chưa áp dụng ở bước sớm, nhưng không được dùng để hoàn tất yêu cầu production cuối A2.

## 3. Danh mục NFR và phép kiểm chứng

### NFR-01 - Hiệu năng API (Must)

**Mục tiêu:** p95 <500 ms và tỷ lệ 5xx/timeout <1% cho từng API thông thường `GET /products`, `GET /products/:id`, `GET /orders/me`, `POST /orders` hợp lệ, theo điều kiện mục 2. Giữ giá trị snapshot/tồn chính xác dưới tải; không gộp thời gian payment gateway vào bộ mẫu API thông thường.

**Kiểm chứng:** load test riêng từng route trên stack Next.js/NestJS/PostgreSQL đã warm-up; request Orders có JWT hợp lệ. Reset dữ liệu/stock giữa các lượt, không reset khi đang đo; ghi số mẫu, p50/p95/p99, 5xx, timeout và CPU/RAM. Payment được báo cáo latency riêng kèm độ trễ mock gateway; bỏ payment khỏi ngưỡng 500 ms không có nghĩa bỏ test payment. FR-01/02/06/08; ca dự kiến `AT-NFR-01`.

### NFR-02 - Bảo vệ mật khẩu (Must)

**Mục tiêu:** 0 mật khẩu rõ trong DB, response hoặc log; password được hash bằng bcrypt với cost >=10, không trả passwordHash. Đăng nhập đúng/sai được xử lý đúng mà không tiết lộ tài khoản tồn tại.

**Kiểm chứng:** đăng ký tài khoản test, kiểm tra DB chỉ chứa hash khác input, đọc cost và `bcrypt.compare`; integration login đúng/sai, kiểm tra response và log đã che bí mật. Ghi thời gian hash trên máy đo; không lưu password/hash/token thật trong evidence. FR-05; `AT-NFR-02`.

### NFR-03 - Validation và dữ liệu không tin cậy (Must)

**Mục tiêu:** 100% tập ca sai DTO xác định trước trả 400, không ghi DB; không chấp nhận trường tự áp đặt giá/amount/userId/role. Frontend hiển thị lỗi và cho sửa; validation backend vẫn hoạt động khi bỏ qua UI.

**Kiểm chứng:** HTTP qua pipeline thật với thiếu field, sai kiểu, UUID sai, mảng rỗng/>20 dòng, quantity 0/21/số lẻ, topping trùng, sugar/ice ngoài 0..100, note >500, method sai và thiếu idempotency key. So sánh order/items/payment/reservations trước/sau; ca mất JWT được đo ở NFR-10 thay vì kỳ vọng 400. FR-03/05/06/07; `AT-NFR-03`.

### NFR-04 - Nhất quán tồn kho và rollback (Must)

**Mục tiêu:** 0 stock âm, 0 reserve vượt tồn, không có order/reservation/coupon dở dang sau transaction thất bại. Với stock=5, 20 request hợp lệ đồng thời mua 1 cùng variant: đúng 5 order thành công, stock cuối=0, tổng ACTIVE reservation=5.

**Kiểm chứng:** integration trên PostgreSQL thật, stock reset giữa lượt; chạy tối thiểu 3 lượt. Tiêm lỗi sau reserve và assert rollback order/items/history/reservation/coupon; test hủy/expiry lặp chỉ hoàn tồn một lần và race hủy PAID/nhận pha chỉ một transition commit. Lưu số lượng bản ghi và trạng thái trước/sau từng lượt. FR-06/09/10; `AT-NFR-04`. CHECK/unique constraint đơn lẻ không thay thế phép thử đồng thời.

### NFR-05 - Payment idempotency và nhất quán (Must)

**Mục tiêu:** 20 request đồng thời cùng key/payload chỉ tạo 1 attempt và tối đa 1 lần gọi charge mới; replay sau hoàn tất trả cùng kết quả attempt. Mỗi order tối đa 1 Payment SUCCEEDED và 1 EARN; coupon/stock không ghi kép. Khác payload cùng key trả 409; sai chủ không được đọc kết quả replay.

**Kiểm chứng:** gateway stub có bộ đếm; HTTP/integration trên DB thật cho same-key concurrency, replay sau restart API, đổi order/method cùng key, hai key khác nhau cùng order, FAILED retry bằng key mới, timeout chưa rõ kết quả và lỗi sau gateway trước commit. Kiểm tra call count, attempt/order/reservation/coupon/loyalty và history. Khi lỗi chưa rõ kết quả, giữ dữ liệu đối soát; không tự hoàn tồn hay charge lại bằng key mới. FR-07/09/10; `AT-NFR-05`.

### NFR-06 - Tái tạo môi trường local (Must)

**Mục tiêu:** từ checkout sạch và env mẫu không có secret thật, `docker compose config` hợp lệ; build và chạy web/API/DB; sau khi image đã build, các dịch vụ healthy trong <=180 giây trên máy đo. Migration chạy lại không lỗi; seed chạy lại không trùng dữ liệu; dữ liệu đã commit tồn tại sau restart container với volume giữ nguyên.

**Kiểm chứng:** người kiểm tra làm theo README, ghi cold build riêng; chạy migrate/seed hai lần, `/health` 200, menu và tạo/thanh toán một đơn qua stack thật. Ghi `compose ps`, thời điểm startup, commit và ID đơn trước/sau restart. Không xóa volume trong phép kiểm tra persistence. FR-01..10; `AT-NFR-06`.

### NFR-07 - Health, logging và khả năng truy lỗi (Must)

**Mục tiêu:** có `GET /health`; DB truy cập được trả 200, DB mất kết nối trả 503 trong timeout cấu hình. Mỗi lỗi HTTP có requestId đối chiếu được với log; 0 password/JWT/secret/stack trace trong response công khai và bộ log mẫu.

**Kiểm chứng:** trên môi trường test gây 400/401/403/404/409/500/503, so requestId response-log và mã lỗi; dừng/bật DB để kiểm chứng health. Lưu log đã che dữ liệu. Health không được luôn trả 200 khi DB chết; health không tiết lộ connection string. FR-01..10; `AT-NFR-07`.

### NFR-08 - Mobile-first và tính sử dụng được (Must)

**Mục tiêu:** luồng menu/detail/cart/auth/checkout/confirmation/history dùng được ở 375x812 và 1440x900 trên Chrome, Edge, Firefox; không tràn ngang, che nút chính hoặc mất lựa chọn khi reload. Lỗi không làm mất giỏ hoặc khẳng định payment sai; form có label và thao tác chính dùng được bằng keyboard với focus thấy rõ.

**Kiểm chứng:** ghi version/ngày, viewport hoặc thiết bị thật; chạy E2E thành công, chưa đăng nhập, hết hàng, payment FAILED/timeout, loading/empty/error và reload. Ghi screenshot/kết quả ở từng browser/viewport, kiểm tra tab order và focus trả về khi đóng modal. FR-01..08; `AT-NFR-08`.

### NFR-09 - Tính khả dụng và phục hồi (Must)

**Mục tiêu:** steady-state smoke 30 phút có >=99% probe `/health` trả 200, một probe mỗi 5 giây, timeout 2 giây. Trong cửa sổ fault riêng, restart API phục hồi <=60 giây; DB lỗi phải báo unhealthy và sau khôi phục DB API phục hồi <=60 giây. Đơn đã commit không mất.

**Kiểm chứng:** bắt đầu sau startup; cửa sổ steady-state lấy 360 probe, tối đa 3 probe không thành công để đạt >=99%. Sau đó đo fault injection riêng, ghi thời điểm fault đến probe đầu tiên của chuỗi 3 probe 200 liên tiếp. So ID/snapshot đơn trước/sau restart; lưu cả lỗi trong cửa sổ fault, không đưa chúng vào báo cáo steady-state. Đây là mục tiêu demo có kiểm soát, không phải SLA production 24/7 hay chứng minh HA. FR-06..09; `AT-NFR-09`.

### NFR-10 - Kiểm soát truy cập, HTTPS và secret (Must)

**Mục tiêu:** thiếu/sai/hết hạn/chữ ký JWT sai trả 401; sai role trả 403; khách B không đọc/trả tiền/hủy đơn A. Production frontend HTTPS hợp lệ, không mixed content; API được gọi qua HTTPS; DB không public trực tiếp. Không có secret thật trong Git, image layer hoặc log CI.

**Kiểm chứng:** HTTP test bằng hai customer/Barista, cả payment replay, kiểm tra dữ liệu không đổi sau từ chối. Secret scan tracked files/history và artifact phát hành; kiểm tra env bắt buộc, HTTPS/certificate, browser network và cấu hình private DB/firewall trên nền tảng đã chọn. Quét log có che dữ liệu và không thử xâm nhập dịch vụ ngoài phạm vi. FR-05..09; `AT-NFR-10`. Chưa có URL/config production thì phần production chưa được xác nhận đạt.

### NFR-11 - CI/CD và bàn giao release (Must)

**Mục tiêu:** PR tự chạy Install -> Lint -> Unit Test -> Build; required checks chặn merge khi thất bại. Release chạy quality gate, build image gắn commit SHA/version, push registry nếu nền tảng yêu cầu, deploy bằng secret CI, migrate an toàn, health/smoke và dừng khi lỗi. Có URL production, tag/release notes, README local/test/build/deploy/rollback. Diễn tập rollback ứng dụng <=10 phút trên test và không mất đơn đã commit.

**Kiểm chứng:** lưu link một PR/run pass và một run fail, snapshot required checks/bypass của đúng target branch. Một pipeline xanh riêng lẻ không chứng minh merge bị chặn. Lưu commit/image digest, log deploy/migration/smoke, URL và thời điểm xác minh. Trên DB test: backup, restore vào DB mới và so số lượng/ID đơn; rollback sang image tương thích schema, không tự chạy migration down phá dữ liệu. Reviewer từ checkout sạch thực hiện hướng dẫn. A2 mục 6.4, 7.2-7.4; `AT-NFR-11`. Source YAML không phải minh chứng pipeline/deploy đã chạy.

### NFR-12 - Hướng PWA và hành vi khi mất mạng (Must)

**Mục tiêu:** cung cấp manifest hợp lệ, icon, start URL/scope và cơ chế offline fallback cho vỏ ứng dụng; giao diện mobile-first theo NFR-08. Khi mất mạng, hiển thị thông báo và giữ giỏ local; không cache JWT/payment response để dùng chung, không xếp hàng tự động charge hoặc tạo xác nhận giả.

**Kiểm chứng:** trên HTTPS, kiểm tra manifest/service worker/cache, thử mở lại vỏ ứng dụng sau lần tải online và chuyển offline ở menu/checkout/payment. Kiểm tra nút thử lại, giỏ và dữ liệu nhạy cảm sau logout/đổi user; online trở lại phải tra cứu kết quả order/payment từ server. Ghi browser/version và kết quả kiểm tra PWA; khả năng cài vào màn hình chính tùy browser được ghi riêng, không thay thế luồng nghiệp vụ. A2 mục 1.1; FR-04/05/07/08; `AT-NFR-12`. Offline đặt đơn/thanh toán ngoài MVP.

## 4. Truy vết và mẫu evidence

| Nhóm bắt buộc của A2 | NFR bao phủ | Minh chứng tối thiểu dự kiến |
|---|---|---|
| Hiệu năng | NFR-01 | Script/cấu hình load, dataset, số mẫu, latency, tỷ lệ lỗi |
| Bảo mật | NFR-02/03/10 | Hash/validation/auth HTTP test, secret scan, HTTPS/private DB |
| Tính khả dụng | NFR-07/09 | Health/log, probe steady-state, fault/recovery, persistence |
| Khả năng triển khai | NFR-06/11 | Checkout sạch, Compose, migration/seed, CI gate, deploy/rollback |
| Chất lượng luồng lõi | NFR-04/05/08/12 | Concurrency/idempotency, E2E mobile/browser/offline |

Mỗi bản ghi phải có `NFR-ID`, commit, môi trường, lệnh/test, dataset, thời gian UTC, ngưỡng, số đo thực tế, pass/fail, vị trí artifact và reviewer. Nối bản ghi với code/test thật trong `docs/traceability-matrix.md` khi các task triển khai thực hiện. Trạng thái **đặc tả hoàn tất** và **NFR đạt** là hai kết luận khác nhau.

## 5. Ưu tiên mở rộng và giới hạn

| MoSCoW | Nội dung | Cách xác nhận phạm vi |
|---|---|---|
| Should | Tự động hóa toàn bộ ma trận browser/viewport và báo cáo xu hướng latency giữa release | Review CI/report; nếu chưa tự động, phép đo thủ công ở NFR-08 vẫn bắt buộc |
| Could | HA nhiều instance, autoscaling, uptime 24/7, realtime observability | Chỉ đặt SLO/AC mới sau khi chọn hạ tầng và ngân sách |
| Won't | Chứng nhận xử lý thẻ thật, thanh toán offline, SLA ngân hàng production | Review cấu hình/demo xác nhận mock; không coi chúng là điều kiện đạt NFR MVP |

Việc chưa chọn hosting/registry không loại CI/CD, HTTPS hoặc production khỏi yêu cầu A2. Các quyết định đó phải được chốt tại Task 3 và kiểm chứng ở Task 5.
