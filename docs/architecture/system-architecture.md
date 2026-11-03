# Kiến trúc hệ thống BrewLite

Phiên bản 1.0 · 03/11/2026 · Phụ trách: Khang · [A2-3.1.1 / #12](https://github.com/akira-yami/BrewLite_A2/issues/12).

**Trạng thái: thiết kế đề xuất cho A2.** Baseline `d600b26` chỉ có tài liệu yêu cầu và thư mục ứng dụng giữ chỗ; chưa có Next.js, NestJS, schema, migration hay dịch vụ chạy được. Các đường dẫn, module và API dưới đây là đích triển khai, không phải minh chứng runtime.

## 1. Căn cứ và phạm vi

- [Bối cảnh và phạm vi](../requirements/context-and-scope.md), [FR-01..15](../requirements/srs.md), [NFR-01..12](../requirements/non-functional-requirements.md), [UC-01..10](../requirements/use-case-overview.md) là baseline yêu cầu của repository A2.
- Tham khảo `docs/tham_khao/BrewLite/docs/architecture/system-architecture.md`, `architecture/foundation-contract.md` và `decisions/ADR-001..004` của BrewLite A1. Kế thừa ranh giới module và nguyên tắc transaction; không kế thừa trạng thái đã triển khai, approval, PR hay evidence của A1. Thư mục tham khảo chỉ có ở máy làm việc, không cần để đọc thiết kế này.
- Phạm vi MVP: một quầy, VND nguyên, JWT với `CUSTOMER`/`BARISTA`, payment mock. Refresh token, realtime, màn quầy đầy đủ là mở rộng; tiền thật và đặt/thanh toán offline ngoài MVP.

## 2. Cấu trúc và ranh giới hệ thống

Chọn **kiến trúc phân lớp trong modular monolith**: Next.js là ứng dụng web riêng; NestJS là một backend chia theo domain; PostgreSQL là nguồn dữ liệu giao dịch duy nhất. Không có kết nối trực tiếp từ trình duyệt tới DB.

| Thành phần | Trách nhiệm | Giao tiếp / ranh giới |
|---|---|---|
| Thiết bị khách hàng/Barista | Trình duyệt/PWA, nhập lựa chọn, xem kết quả | HTTPS tới Web/API; không được quyết định giá, quyền hoặc kết quả thanh toán |
| Next.js / `apps/web` | Menu/detail/cart/auth/checkout/history, mobile-first; vỏ PWA và offline fallback | REST/JSON tới NestJS, prefix `/api/v1`; giỏ local, server state lấy lại từ API |
| NestJS / `apps/api` | JWT/RBAC/ownership, validation, nghiệp vụ, điều phối transaction, health/log | API public qua HTTPS; Prisma tới PostgreSQL trên mạng nội bộ |
| PostgreSQL | Order snapshot, tồn/reservation, payment attempt, coupon, loyalty ledger, history | Chỉ API và migration job được truy cập bằng tài khoản có quyền phù hợp |
| Mock Payment Adapter | Ví/Thẻ giả lập qua port `PaymentGateway`; success/decline/unknown | Chạy trong process API ở MVP; không là container độc lập, không nhận thông tin thẻ thật |
| Công cụ vận hành | Migration một lần trước API; cấu hình, health và log | Local/CI/production dùng cấu hình riêng, secret bên ngoài Git |

```text
Customer / Barista
        | HTTPS
        v
Next.js Web/PWA ---- REST/JSON + Bearer JWT ----> NestJS API
                                                   |
                    +------------------------------+-------------------+
                    |                                                  |
         Controller -> Service -> Repository                 PaymentGateway port
                                   |                                  |
                                 Prisma                       Mock Payment Adapter
                                   |
                              PostgreSQL
```

Đây là mô tả kiến trúc phân lớp, không thay thế các sơ đồ UML bắt buộc ở Task 2 hoặc deployment production. Nền tảng hosting/registry chưa được chọn hoặc xác minh; [#16](https://github.com/akira-yami/BrewLite_A2/issues/16) phải chốt topology, HTTPS, persistent storage, cổng và ranh giới local/CI/production theo môi trường thực tế. Không gọi kiến trúc đích này là deployment đã chạy.

## 3. Backend theo module và lớp

| Module đích | Dữ liệu / trách nhiệm sở hữu | FR / UC |
|---|---|---|
| `auth`, `users` | Đăng ký/login, JWT, role, hồ sơ; không tự quyết định điểm | FR-05; UC-01/02 |
| `catalog` | Product, variant, topping, giá và trạng thái bán | FR-01/02/03; UC-03/04 |
| `orders` | Order/items snapshot, state machine, ownership, history | FR-06/08/09; UC-06/09/10 |
| `inventory` | Tổng hợp số lượng theo variant, reserve/consume/release/expiry đúng một lần | FR-06/09; UC-06/08 |
| `payments` | Attempt, request hash/key, serialize attempt theo order, gateway, đối soát | FR-07; UC-08 |
| `promotions` | Quote, hạn mức coupon, reservation và consumption | FR-10; UC-07/08 |
| `loyalty` | Ledger EARN duy nhất mỗi order, balance trong transaction | FR-10; hậu điều kiện UC-08 |

Luồng phụ thuộc chuẩn là `Controller -> Service -> Repository -> Prisma`.

- Controller xử lý transport/DTO/guard; không query DB, tính giá hoặc mở transaction.
- Service sở hữu business rule, mở transaction và gọi public service của module khác. Repository nhận cùng transaction client; không tự mở transaction rời cho một phần của cùng nghiệp vụ.
- Repository chỉ truy cập dữ liệu; không gọi ngược service hoặc ném HTTP exception. Mapper là helper thuần giữa record/entity/response, không I/O.
- Module khác không inject repository nội bộ. Tránh vòng phụ thuộc: `orders` điều phối create/cancel; `payments` điều phối pay và gọi public order/inventory/promotion/loyalty service với cùng transaction. `orders` chỉ đọc điều kiện payment đang xử lý qua repository dữ liệu order/lock theo contract, không gọi ngược payment orchestration.
- Một transaction có thể đi qua nhiều module nhưng phải có một service điều phối và một DB transaction. Quy tắc order/payment/expiry cùng khóa order trước khi thay đổi để phân xử race.

Đường dẫn đích: `apps/api/src/modules/<domain>/{controllers,services,repositories,dto,entities,mappers}`, `src/common` cho guard/filter/interceptor, `src/config` cho config validation và `prisma/{schema.prisma,migrations,seed.ts}`. Chỉ tạo các lớp cần thiết khi triển khai, không thêm interface/mapper rỗng để đủ cây thư mục.

## 4. Frontend và API boundary

Route/layout ở `apps/web/src/app`; feature ở `src/features/{catalog,cart,auth,checkout,orders}`; API client dùng chung ở `src/lib`. Form và giỏ dùng state client; giỏ persist lựa chọn, đường/đá/note qua localStorage, có xử lý dữ liệu cũ/hỏng. Không lưu giá client như cam kết thanh toán.

API client ghép base URL có `/api/v1`, gửi Bearer access JWT tới route bảo vệ; JWT/credential không ghi log. MVP dùng access token sống ngắn trong bộ nhớ, xác minh phiên với API; reload có thể yêu cầu login lại nhưng phải giữ giỏ. Không coi network error là 401. Thiết kế session chi tiết và PWA cache thuộc [#14](https://github.com/akira-yami/BrewLite_A2/issues/14), xác thực thuộc [#27](https://github.com/akira-yami/BrewLite_A2/issues/27); không mặc nhiên sao chép token localStorage của A1.

PWA cache chỉ phục vụ vỏ/static asset và offline fallback. Không cache response auth/order/payment hoặc tự xếp hàng mutation để gửi lại khi online. Timeout payment: giữ giỏ, báo đang kiểm tra, tra cứu server và replay cùng key; chỉ xóa phần giỏ đã checkout sau xác nhận success. UI luôn có loading/empty/error/retry tương ứng FR/NFR.

| API tương đối đề xuất | Chủ thể / nghiệp vụ | Kiểm soát bắt buộc |
|---|---|---|
| `GET /products`, `GET /products/:id` | Public, catalog active | Validate ID, không trả option không bán được như có thể mua |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Đăng ký/login/xác minh phiên | Chỉ đăng ký CUSTOMER, hash bcrypt, không trả password/hash |
| `POST /orders` | CUSTOMER tạo đơn | JWT, DTO, giá DB, transaction/reservation, không nhận userId/total |
| `GET /orders/me`, `GET /orders/:id` | Khách xem đơn của mình | Ownership kể cả khi biết ID; danh sách chỉ của principal |
| `POST /payments` | Chủ đơn trả tiền mock | `Idempotency-Key`, order/method hợp lệ, amount từ DB |
| `POST /orders/:id/cancel`, `PATCH /orders/:id/status` | Chủ đơn hủy; Barista cập nhật pha chế | Ownership/RBAC, state machine, phân xử race với payment/expiry |
| `GET /health` | Readiness | Kiểm tra DB có timeout, 200/503, không lộ config |

Tên route là contract đề xuất để phối hợp, chưa có OpenAPI/runtime. Contract triển khai phải được review trước [#21](https://github.com/akira-yami/BrewLite_A2/issues/21), [#27](https://github.com/akira-yami/BrewLite_A2/issues/27), [#28](https://github.com/akira-yami/BrewLite_A2/issues/28), [#29](https://github.com/akira-yami/BrewLite_A2/issues/29).

## 5. Dữ liệu, migration và tính nhất quán

PostgreSQL + Prisma; migration versioned trong Git, bổ sung SQL cho CHECK/partial unique index khi ORM không biểu diễn đủ. Tiền lưu số nguyên VND (`BIGINT`), API serialize trong miền số nguyên an toàn đã validate; không trả JavaScript BigInt trực tiếp thành JSON. Thời gian UTC/timestamptz, ID UUID. Dữ liệu giao dịch không cascade-delete theo catalog/user.

Migration one-shot chạy trước API, fail thì không start release mới; không sửa migration đã áp dụng. Seed development/test phải lặp an toàn, không tự cấp tài khoản demo trên production. PostgreSQL có persistent volume/disk; restart không xóa volume. [ADR-002](adr/002-postgresql-prisma.md) ghi lựa chọn; thiết kế chi tiết thuộc [#13](https://github.com/akira-yami/BrewLite_A2/issues/13), triển khai migration/seed thuộc [#35](https://github.com/akira-yami/BrewLite_A2/issues/35).

### 5.1. Tạo đơn

1. JWT/ownership principal và DTO hợp lệ; server chuẩn hóa tối đa 20 dòng, quantity 1..20, tính giá từ catalog active.
2. Transaction ngắn đọc/khóa coupon hợp lệ (nếu có), tạo Order `PENDING`, items/topping snapshot và thời hạn giữ tồn; chỉ insert reservation/redemption sau khi có orderId.
3. Tổng hợp quantity theo variant qua mọi dòng; cập nhật có điều kiện `stock >= requested AND version = expected`, giảm stock và tăng version; xử lý theo thứ tự variant ID ổn định. Conflict còn hàng retry toàn transaction có giới hạn, hết hàng trả 409.
4. Ghi reservation ACTIVE, coupon RESERVED và history cùng transaction. Bất kỳ lỗi nào rollback toàn bộ. Không coi `POST /orders` là idempotent chỉ vì payment có key.

### 5.2. Thanh toán, retry và kết quả chưa rõ

1. Xác thực và kiểm tra chủ đơn **trước replay**. Chuẩn hóa orderId/method, tính hash server-side; kiểm tra key/payload.
2. Transaction ngắn khóa order và tạo duy nhất attempt `PROCESSING` theo key; không cho attempt đang xử lý thứ hai trên cùng order kể cả key khác. Order PAID không có success thứ hai. Unique constraint/key và khóa order phân xử request đồng thời.
3. Cùng key/hash đã hoàn tất trả lại kết quả; đang PROCESSING trả 409 `PAYMENT_IN_PROGRESS`; khác hash trả 409 `IDEMPOTENCY_KEY_REUSED`. Gateway được gọi **ngoài** transaction, dùng cùng key của attempt.
4. Success: transaction khóa order/attempt, cập nhật Payment `SUCCEEDED`, Order `PAID`, consume reservation/coupon, ghi history và một EARN/balance cùng commit. Unique success/order và EARN/order là hàng rào cuối ở DB.
5. Decline xác định: `FAILED` + `PAYMENT_FAILED`, không cộng điểm; giữ reservation đến hạn. Retry bằng key mới, về PENDING trước attempt mới; không reserve tồn lần hai.
6. Timeout hoặc gateway success nhưng DB chưa commit: giữ PROCESSING, phản hồi tạm thời 503 khi chưa xác nhận được; recovery tra cứu mock bằng key/attempt, rồi finalize idempotent. Không charge key mới, hủy hay expire cho tới khi đối soát. Mock phải giữ kết quả truy vấn được qua restart, bằng dữ liệu bền vững riêng cho kết quả gateway; không giữ mỗi trong memory. Chi tiết [ADR-004](adr/004-payment-inventory-consistency.md).

### 5.3. Vòng đời và công việc nền

Order: `PENDING`, `PAYMENT_FAILED`, `PAID`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`. Payment: `PROCESSING`, `SUCCEEDED`, `FAILED`. Không dùng chung hai enum.

Job expiry chạy trong API ở MVP, chỉ expire PENDING/PAYMENT_FAILED hết hạn khi không có payment chưa đối soát; khóa order và chuyển reservation ACTIVE sang RELEASED bằng điều kiện, hoàn stock/coupon một lần. Khi nhiều instance, mỗi lần xử lý vẫn phải dựa vào DB lock/transition, không dựa mutex trong process. PAID chỉ bị chủ đơn hủy trước PREPARING; theo baseline giữ payment/coupon/điểm và hoàn tồn một lần, **không hoàn tiền**. Luật này và tỷ lệ loyalty `floor(total/1000)` là đề xuất trong SRS cần PO review, không phải quyết định đã phê duyệt.

## 6. Cấu hình, health và logging

Đích config: validate `NODE_ENV`, `PORT`, `DATABASE_URL`, JWT secret/issuer/audience/TTL, `CORS_ORIGIN`, `PAYMENT_PROVIDER=mock`, reservation TTL khi startup; thiếu hoặc sai cấu hình thì fail fast. Chỉ `NEXT_PUBLIC_API_BASE_URL` và biến public thực sự được đưa vào bundle web. Secret qua env local/CI secret store/platform secret, không commit `.env`, không log connection string/token/password. [#15](https://github.com/akira-yami/BrewLite_A2/issues/15) sở hữu thiết kế chi tiết và chuẩn hóa tên env khi triển khai.

- `GET /api/v1/health` readiness: truy vấn DB có timeout, DB sẵn sàng trả 200; lỗi DB trả 503 chung. Production platform dùng probe này; liveness process có thể tách nếu cần.
- Log JSON ra stdout: timestamp UTC, level, requestId, route, status, duration, error code; che authorization/cookie/password/secret. Không trả stack/Prisma error ra response.
- Global validation và error filter thống nhất lỗi có code/message/requestId; requestId phải đối chiếu response với log. Chỉ trả details đã lọc an toàn.
- Không public DB; production Web/API dùng HTTPS. Local ports dự kiến web 3000, API 3001, DB 5432; không suy các cổng local thành cổng public production.

## 7. Lý do, hạn chế và phương án khác

| Lựa chọn | Lợi ích | Hạn chế / trade-off | Phương án đã cân nhắc |
|---|---|---|---|
| Monorepo, Web/API riêng | Review cùng FR/contract, phối hợp một PR | Cần giữ ranh giới, build/test từng app | Nhiều repo tốn đồng bộ contract ở quy mô nhóm nhỏ |
| Modular monolith, phân lớp | Một transaction cho nhiều domain; ít vận hành | Deploy/scale toàn API, service có thể phình lớn | Microservices thêm network, distributed transaction và recovery quá sức MVP |
| PostgreSQL + Prisma | ACID, constraint, migration có lịch sử | Vẫn cần SQL/locking và test DB thật | Memory DB không chứng minh concurrency; ORM khác hợp lệ nhưng không dùng song song |
| Mock qua gateway port | Demo có kiểm soát success/decline/timeout | Không chứng minh tích hợp ngân hàng/thẻ thật | Tiền thật tăng phạm vi, rủi ro và bí mật không cần cho bài tập |
| Reservation + durable attempt | Tránh oversell, replay/recovery sau restart | Job expiry và đối soát phức tạp hơn | Giữ transaction khi gọi gateway tạo lock dài; cache key memory mất khi restart |

## 8. ADR và điều kiện kiểm chứng

| Quyết định | Tài liệu |
|---|---|
| Monorepo, modular monolith, lớp và module | [ADR-001](adr/001-monorepo.md) |
| DB, ORM, migration và persistent data | [ADR-002](adr/002-postgresql-prisma.md) |
| JWT, role và ownership | [ADR-003](adr/003-authentication.md) |
| Reservation, payment idempotency/recovery | [ADR-004](adr/004-payment-inventory-consistency.md) |

Các ADR đều là đề xuất cho A2, chưa ghi nhận review độc lập. Thay đổi quyết định phải bổ sung ADR thay thế và cập nhật FR/UC/sơ đồ/test bị ảnh hưởng.

Khi triển khai: unit cho giá/state machine/coupon; HTTP cho DTO/JWT/role/ownership; PostgreSQL integration cho rollback, stock=5/20 request, coupon hạn mức, cùng key/khác key/timeout/restart; browser E2E menu tới confirmation/history, giỏ/offline; readiness, clean-checkout migrate/seed và persistence; đo NFR theo đúng dataset/ngưỡng trong SRS. Liên kết code/test/evidence thật tại [ma trận truy vết](../traceability-matrix.md) khi có; không đánh dấu NFR đạt dựa trên kiến trúc.
