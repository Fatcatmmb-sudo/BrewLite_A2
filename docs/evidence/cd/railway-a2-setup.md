# A2-5.3.1 — CD trên Railway

[Issue #37](https://github.com/akira-yami/BrewLite_A2/issues/37)

Workflow Railway CD nhận commit của lần PR CI thành công sau push lên `main`. Job build hai image và tag bằng SHA. Railway CLI tải lên source của đúng commit để Railway build và lưu image cho từng service. Pipeline dùng registry do Railway quản lý. Cấu hình API chạy `prisma migrate deploy` trước khi nhận traffic. Job dừng nếu deploy hoặc smoke test lỗi. Khi cần quay về revision cũ, xem [hướng dẫn rollback](rollback-guide.md).

## Cấu hình một lần

1. Tạo hoặc chọn environment riêng cho A2. Tạo hai service rỗng `api` và `web` dành cho upload qua Railway CLI, cùng PostgreSQL có volume. PostgreSQL dùng mạng nội bộ và không tạo public domain hoặc TCP proxy.
2. Tạo domain HTTPS cho API (port 3001) và Web (port 3000). Mỗi lần CLI upload, thư mục app là root và chứa `railway.toml` cùng `Dockerfile.railway`.
3. Đặt biến API trên Railway gồm `DATABASE_URL` tham chiếu PostgreSQL private, `JWT_SECRET` ngẫu nhiên riêng cho A2 (ít nhất 32 byte), `WEB_ORIGIN` là HTTPS origin của Web A2, `NODE_ENV=production` và `PORT=3001`. Đặt biến Web `NEXT_PUBLIC_API_URL=<API origin>/api/v1` và `PORT=3000`. Next.js đọc URL API lúc build.
4. Tạo GitHub Actions environment `a2-production`. Đặt secret `RAILWAY_TOKEN` bằng project token giới hạn vào environment Railway của A2. Đặt các biến sau trong GitHub Actions environment.

| Biến | Giá trị |
|---|---|
| `RAILWAY_PROJECT_ID` | ID project chứa environment A2 |
| `RAILWAY_ENVIRONMENT_ID` | ID environment Railway của A2 |
| `RAILWAY_API_SERVICE_ID` | ID service API A2 |
| `RAILWAY_WEB_SERVICE_ID` | ID service Web A2 |
| `A2_API_ORIGIN` | HTTPS origin API, bỏ `/api/v1` và dấu `/` cuối |
| `A2_WEB_ORIGIN` | HTTPS origin Web, bỏ dấu `/` cuối |

5. Sau khi cấu hình và merge workflow vào `main`, xem run CD sau PR CI. Lưu SHA, ID deployment, log migration và kết quả smoke. Chuẩn bị dữ liệu catalog và cấu hình VNPay Sandbox của A2 trước demo checkout. Smoke hiện chỉ kiểm tra health và HTTP catalog.

[Railway CLI và token](https://docs.railway.com/cli/deploying) · [Cấu hình Railway bằng mã nguồn](https://docs.railway.com/config-as-code/reference)
