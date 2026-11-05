# apps/api - NestJS

Hiện **chưa có package.json, source, schema/migration hoặc runtime**, chưa có lệnh start/test/migrate/seed.

Đã tạo khung thư mục giữ chỗ: `src/modules` theo auth/users/catalog/orders/inventory/payments/promotions/loyalty/health, `src/common` cho decorator/guard/filter/interceptor/pipe, `src/config` cho env validation, `src/database` cho Prisma service, `prisma/migrations` cho migration và `test` cho HTTP/API test. `schema.prisma` và `seed.ts` sẽ được thêm khi triển khai dữ liệu. Xem [cấu trúc chi tiết](../../docs/repository-structure.md). Backend là nguồn giá/quyền/tồn/trạng thái.

[Catalog #21](https://github.com/akira-yami/BrewLite_A2/issues/21), [Auth #27](https://github.com/akira-yami/BrewLite_A2/issues/27), [Orders #28](https://github.com/akira-yami/BrewLite_A2/issues/28), [Payment #29](https://github.com/akira-yami/BrewLite_A2/issues/29), [migration/seed #35](https://github.com/akira-yami/BrewLite_A2/issues/35) bổ sung runtime. [#12](https://github.com/akira-yami/BrewLite_A2/issues/12) sở hữu kiến trúc/ADR; payment chỉ mock, không nhận thẻ thật.

[Mẫu env gốc](../../.env.example) là đề xuất, chưa có env loader. API local dự kiến port 3001, DB qua DATABASE_URL. Khi có runtime, README phải ghi version/lockfile, env loading, lệnh install/dev/lint/test/build/migrate/seed, DB test riêng và readiness `/api/v1/health` đã kiểm chứng.

Xem [SRS](../../docs/requirements/srs.md), [NFR](../../docs/requirements/non-functional-requirements.md), [DoD](../../docs/scrum/definition-of-done.md).
