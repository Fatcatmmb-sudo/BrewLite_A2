# BrewLite - Assignment 2

Ứng dụng đặt đồ uống tại quầy: menu -> chọn món/tùy chọn -> giỏ -> đăng nhập -> tạo đơn -> Ví/Thẻ mô phỏng -> xác nhận/lịch sử. Công nghệ theo đề: **Next.js/PWA, NestJS, PostgreSQL**.

Repository chính: [akira-yami/BrewLite_A2](https://github.com/akira-yami/BrewLite_A2). Thiết lập và quy trình: [A2-4.1 / #17](https://github.com/akira-yami/BrewLite_A2/issues/17).

## Trạng thái hiện tại

Đã có runtime tối thiểu cho NestJS API catalog và Next.js menu, cùng manifest/lockfile và lệnh lint/unit/build. Đây chưa phải MVP đầy đủ: auth/cart/checkout/payment/PWA và deployment còn thuộc các issue riêng; `docker-compose.yml` vẫn giữ chỗ. Xem hướng dẫn [API](apps/api/README.md) và [Web](apps/web/README.md).

Runtime tối thiểu được bổ sung trong [PR CI #63](https://github.com/akira-yami/BrewLite_A2/pull/63); menu nâng cao thuộc #22, test nghiệm thu #23. [CI #24](docs/ci-pull-request.md) kiểm tra cả hai ứng dụng bằng lệnh thật và chặn merge khi lỗi. Checkout/delivery thuộc Sprint 2. [#12](https://github.com/akira-yami/BrewLite_A2/issues/12) sở hữu kiến trúc/ADR, [#16](https://github.com/akira-yami/BrewLite_A2/issues/16) deployment thực tế.

## Clone và đọc hồ sơ

```powershell
git clone https://github.com/akira-yami/BrewLite_A2.git
cd BrewLite_A2
git status
```

Cần Git, Node **24.x** (xem `.nvmrc`) và npm. Mỗi app có lockfile riêng; chạy `npm ci`, `npm run lint`, `npm test`, `npm run build` trong từng thư mục. Build/unit không cần DB. API chạy local cần PostgreSQL và `DATABASE_URL`; Web dùng port 3000, API dùng 3001. Xem README ứng dụng để cấu hình/chạy.

| Thư mục / tệp | Nội dung |
|---|---|
| [apps/web](apps/web/README.md) | Ranh giới Next.js/PWA và việc còn lại |
| [apps/api](apps/api/README.md) | Ranh giới NestJS/API/DB và việc còn lại |
| [docs](docs/README.md) | Yêu cầu, sơ đồ, kiến trúc và Scrum |
| `tests/` | Chỗ cho test xuyên ứng dụng; unit test nằm trong từng app |
| `.github/workflows/` | [PR CI](docs/ci-pull-request.md): Install → Lint → Unit Test → Build và required gate |
| [.env.example](.env.example) | Mẫu local, chỉ có placeholder; API/Web có working directory riêng |
| `docker-compose.yml` | Chờ cấu hình Web/API/PostgreSQL tại #36 |

Cấu trúc bên trong Web/API, Prisma, kiểm thử và minh chứng đã được tạo bằng các thư mục giữ chỗ. Xem [cây thư mục và quy ước đặt mã nguồn](docs/repository-structure.md).

## Cấu hình

API đọc `apps/api/.env`; Web đọc `apps/web/.env.local`. Tạo từ mẫu gốc, thay mọi placeholder theo README ứng dụng. Các biến auth/payment trong mẫu chưa được runtime catalog sử dụng. Không commit `.env`, token, mật khẩu, DB dump. `NEXT_PUBLIC_*` công khai trong browser, không chứa secret. DB URL host `localhost` dành cho ứng dụng trên máy; container phải dùng hostname service khi #36 chốt Compose.

Không dùng mẫu trên production; CI/hosting cấp secret từ secret store. Chưa có production URL/registry/deploy đã xác minh. Chỉ ghi migrate/seed/start/test/build/rollback hoạt động khi có code và evidence từ checkout sạch.

## Quy trình

- [Nhánh, commit và PR](CONTRIBUTING.md).
- [Backlog hai Sprint](docs/scrum/product-backlog.md), [Definition of Done](docs/scrum/definition-of-done.md).
- [Sprint 1](docs/scrum/sprint-01.md): nền tảng/menu thật/CI; [Sprint 2](docs/scrum/sprint-02.md): checkout/test/production/bàn giao.

PR có mã như `[A2-4.1] Repository, backlog và DoD`, liên kết issue, cách kiểm tra và gap. Chỉ ghi Done khi đạt DoD; có tài liệu không chứng minh code/test/deployment đã đạt.
