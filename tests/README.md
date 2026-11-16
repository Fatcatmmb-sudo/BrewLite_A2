# Hướng dẫn chạy test BrewLite

Chạy các lệnh PowerShell từ thư mục gốc `BrewLite_A2`. Cần Node.js **24.x** và npm. Các bộ test dùng DB bên dưới chạy trên PostgreSQL cục bộ riêng.

```powershell
node -v
npm ci --prefix apps/api
npm ci --prefix apps/web
```

| Bộ test | Lệnh từ gốc repo | Điều kiện |
|---|---|---|
| API unit | `npm --prefix apps/api test` | Dependencies API |
| API coverage | `npm --prefix apps/api run test:cov` | Dependencies API |
| Web unit | `npm --prefix apps/web test` | Dependencies Web |
| Script CI và cấu hình | `node --test scripts/*.test.mjs` | Node.js |
| Migration smoke | `npm --prefix apps/api run test:migration` | DB smoke trống |
| API integration | `npm --prefix apps/api run test:integration` | DB smoke đã migrate |
| API E2E | `npm --prefix apps/api run test:e2e` | DB smoke đã migrate, `NODE_ENV=test` |
| Web E2E | `npm --prefix apps/web run test:e2e` | DB browser đã migrate và seed, Chromium |
| VNPay E2E | `npm --prefix apps/web run test:e2e:vnpay` | Cùng môi trường Web E2E |

## Unit test và coverage

API unit kiểm tra service, DTO và quy tắc nghiệp vụ. Web unit kiểm tra giỏ hàng, phiên đăng nhập, API client và trạng thái giao diện. Cả hai chạy độc lập với PostgreSQL.

Unit test API nằm tại `apps/api/test/unit`. Mỗi nghiệp vụ có thư mục riêng trong `modules/`, còn cấu hình và tiện ích dùng chung nằm trong `config/` và `common/`. Test với PostgreSQL nằm trong `apps/api/test/integration`, test HTTP end-to-end nằm trong `apps/api/test/e2e`.

```powershell
npm --prefix apps/api test
npm --prefix apps/api run test:cov
npm --prefix apps/web test
node --test scripts/*.test.mjs
```

API coverage in kết quả ra terminal và ghi JSON tại `apps/api/coverage/coverage-summary.json`.

## PostgreSQL dành riêng cho kiểm thử

Nếu đã có PostgreSQL local, tạo DB `brewlite_foundation_smoke_local` và `brewlite_local_e2e` rồi thay URL kết nối trong các bước sau. Ví dụ với Docker và cổng riêng `55487` dùng cấu hình sau.

```powershell
docker run --rm -d --name brewlite-test-pg -p 127.0.0.1:55487:5432 -e POSTGRES_USER=brewlite_test -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=brewlite_foundation_smoke_local postgres:18.4-alpine3.23
docker exec brewlite-test-pg pg_isready -h 127.0.0.1 -U brewlite_test -d brewlite_foundation_smoke_local
```

Chạy lại `pg_isready` đến khi có `accepting connections`. Dùng cùng terminal cho các bước cần biến môi trường.

## API integration, migration và E2E

Thiết lập kết nối cho DB smoke. Tên DB phải bắt đầu bằng `brewlite_foundation_smoke`. Ví và thẻ mô phỏng trong API E2E cần `NODE_ENV=test`.

```powershell
$env:SMOKE_DATABASE_URL = 'postgresql://brewlite_test:local-test-only@127.0.0.1:55487/brewlite_foundation_smoke_local'
$env:DATABASE_URL = $env:SMOKE_DATABASE_URL
$env:NODE_ENV = 'test'
$env:JWT_SECRET = 'local-test-jwt-secret-at-least-32-bytes'
$env:VNPAY_ENABLED = 'false'
```

**Migration smoke trên DB trống.** Lệnh deploy migration, chạy lại migration để kiểm tra tính lặp và chạy luôn toàn bộ integration. Mỗi lần chạy migration smoke cần một DB trống mới.

```powershell
npm --prefix apps/api run test:migration
```

**Integration trên DB đã migrate.** Nếu chưa chạy migration smoke, chạy `prisma:deploy` trước. Suite này kiểm tra giao dịch PostgreSQL, rollback, chống sửa giá và tranh tồn kho.

```powershell
npm --prefix apps/api run prisma:deploy
npm --prefix apps/api run test:integration
```

**API E2E trên cùng DB smoke đã migrate.** Test tự khởi tạo NestJS và gọi HTTP. Các ca checkout dùng cổng thanh toán mô phỏng.

```powershell
npm --prefix apps/api run test:e2e
```

## Web E2E và VNPay

Playwright tự khởi động Web và API trên các cổng `3100` và `3101`. Chuẩn bị DB khác có tên kết thúc bằng `_e2e`. Nếu dùng PostgreSQL local có sẵn, tạo DB bằng công cụ quản trị của bạn và bỏ qua dòng `docker exec`.

```powershell
docker exec brewlite-test-pg createdb -U brewlite_test brewlite_local_e2e
$env:DATABASE_URL = 'postgresql://brewlite_test:local-test-only@127.0.0.1:55487/brewlite_local_e2e'
$env:JWT_SECRET = 'local-test-jwt-secret-at-least-32-bytes'
Remove-Item Env:E2E_EXTERNAL_BASE_URL, Env:E2E_API_URL, Env:VNPAY_TMN_CODE, Env:VNPAY_HASH_SECRET -ErrorAction SilentlyContinue
npm --prefix apps/api run prisma:deploy
Push-Location apps/api
node --import=tsx prisma/seed-e2e.ts
Pop-Location
Push-Location apps/web
npx playwright install chromium
Pop-Location
```

Chạy **Web E2E** cho giỏ hàng, phiên, checkout và màn hình quầy. Chạy **VNPay E2E** để kiểm tra chữ ký, IPN, thanh toán lặp, polling và phục hồi. Khi chạy local, Playwright dùng thông tin VNPay thử nghiệm mặc định và mô phỏng luồng cổng thanh toán. PR CI chạy nhóm `chromium` và `delivery`. Nhóm `vnpay` có lệnh riêng.

```powershell
npm --prefix apps/web run test:e2e
npm --prefix apps/web run test:e2e:vnpay
```

Xem báo cáo HTML tại `apps/web/playwright-report/index.html` sau mỗi lượt chạy. Nếu cổng đang bận, có thể đặt `E2E_WEB_PORT` và `E2E_API_PORT` trước khi chạy. Nếu gặp lỗi thiếu Chromium, chạy lại bước `npx playwright install chromium` trong `apps/web`.

## Chạy một file hoặc một ca

Chuẩn bị DB tương ứng trước khi chạy integration hoặc E2E. Dùng `-t` để lọc theo một phần tên ca trong Vitest và `-g` trong Playwright.

```powershell
# API unit theo file
npm --prefix apps/api test -- create-order.dto.spec.ts

# Toàn bộ API unit test của module thanh toán
npm --prefix apps/api test -- test/unit/modules/payments

# Web unit theo file
node --test apps/web/tests/unit/cart-store.test.mjs

# Từ chối giá do client gửi khi tạo đơn
npm --prefix apps/api run test:integration -- orders.integration-spec.ts -t 'TC-FR-06-A' --reporter=verbose

# Thanh toán theo giá đã chốt
npm --prefix apps/api run test:e2e -- checkout.e2e-spec.ts -t 'TC-FR-06-B' --reporter=verbose

# Checkout qua trình duyệt và kiểm tra chữ ký VNPay
npm --prefix apps/web run test:e2e -- checkout-flow.spec.ts
npm --prefix apps/web run test:e2e:vnpay -- vnpay-signature.spec.ts -g 'chữ ký sai'
```

Nếu cần lưu log Vitest, nối `*> "$env:TEMP/brewlite-test.log"` vào cuối lệnh và kiểm tra `$LASTEXITCODE` ngay sau khi chạy.

## Smoke, Postman và test phi chức năng

- **Smoke API.** Khi API local đã chạy trên cổng `3001`, dùng `node apps/api/scripts/smoke.mjs http://localhost:3001`.
- **Postman/Newman.** Chạy `npm --prefix apps/api run test:api` với API local cổng `3001` trỏ đến DB test đã migrate và seed. Collection có thanh toán ví mô phỏng, nên API cần `NODE_ENV=test` và `MOCK_PAYMENT_MODE=deterministic`. Báo cáo nằm tại `logs/newman-report.json`.
- **Đo tải NFR-01.** Chuẩn bị DB có dữ liệu đo và chạy `node scripts/run-load-test-nfr01.mjs`. [Hướng dẫn seed và chạy đo tải](../docs/evidence/perf/README.md).
- **PWA NFR-12.** Cài Chromium, khởi động Web local rồi chạy `node scripts/run-nfr12-pwa-test.mjs`. Script dùng `http://localhost:3000` mặc định, có thể đổi qua `PWA_BASE_URL`. Script ghi báo cáo và ảnh vào `docs/evidence/pwa`. [Phạm vi đã kiểm tra](../docs/evidence/pwa/nfr-12-pwa-offline-report.md).

Dừng PostgreSQL tạm bằng `docker stop brewlite-test-pg` sau khi hoàn tất. Với container `--rm` ở trên, dữ liệu test bên trong sẽ bị xóa.

Tra tiêu chí nghiệp vụ và các ca tương ứng tại [kế hoạch kiểm thử](../docs/testing/test-plan.md) và [ma trận truy vết](../docs/traceability-matrix.md).
