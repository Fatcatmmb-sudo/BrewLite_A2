# ADR-005 Dùng Railway cho production BrewLite A2

**Trạng thái** · Đã áp dụng tại `brewlite-a2 / a2-production`.

## Bối cảnh

Nhóm dùng Next.js, NestJS và PostgreSQL. Mỗi service cần cấu hình build, health check, log và khả năng truy vết về revision triển khai. Project A1 được dùng làm tham chiếu ban đầu khi chọn nền tảng.

## Quyết định

Railway chạy Web và API dưới hai HTTPS domain riêng. PostgreSQL dùng private network và persistent volume. Hai app build từ `Dockerfile.railway` của monorepo, Railway quản lý image runtime. API chạy migration ở pre-deploy. Secret do Railway cấp cho service, biến URL API public được đưa vào bundle Web lúc build.

GitHub Actions chạy quality gate và có workflow tải revision lên Railway rồi smoke test. Bằng chứng deployment, migration, smoke và rollback được ghi theo từng lần chạy. Cấu hình xác minh và nguồn sơ đồ nằm ở [Deployment production](../../deployment.md).

## Hệ quả

Nhóm có một nơi để xem deploy, health, logs và volume. Quy trình khôi phục cần kiểm tra tương thích giữa app revision và schema. [Hướng dẫn rollback](../../evidence/cd/rollback-guide.md).
