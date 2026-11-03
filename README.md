# BrewLite - Assignment 2

Ứng dụng đặt đồ uống tại quầy: menu -> chọn món/tùy chọn -> giỏ -> đăng nhập -> tạo đơn -> Ví/Thẻ mô phỏng -> xác nhận/lịch sử. Công nghệ theo đề: **Next.js/PWA, NestJS, PostgreSQL**.

Repository chính: [akira-yami/BrewLite_A2](https://github.com/akira-yami/BrewLite_A2). Thiết lập và quy trình: [A2-4.1 / #17](https://github.com/akira-yami/BrewLite_A2/issues/17).

## Trạng thái hiện tại

Đây là khung repository và hồ sơ A2, đã có SRS/FR/NFR và use-case tổng quát. `apps/web`, `apps/api` chưa có package/runtime; `docker-compose.yml`, `docs/deployment.md` đang giữ chỗ. **Chưa có lệnh install/dev/test/build/deploy chạy ứng dụng**; khung này chưa phải MVP chạy được.

Runtime catalog/menu thuộc #21/#22, test #23, CI #24; checkout/delivery thuộc Sprint 2. [#12](https://github.com/akira-yami/BrewLite_A2/issues/12) sở hữu kiến trúc/ADR, [#16](https://github.com/akira-yami/BrewLite_A2/issues/16) deployment thực tế. Cập nhật README bằng lệnh đã kiểm tra từ checkout sạch khi các phần đó tích hợp.

## Clone và đọc hồ sơ

```powershell
git clone https://github.com/akira-yami/BrewLite_A2.git
cd BrewLite_A2
git status
```

Hiện chỉ cần Git và trình đọc Markdown. Nhóm sẽ chốt Node/package manager/PostgreSQL version và lockfile trong PR runtime; chưa có dependency được khóa ở bước này.

| Thư mục / tệp | Nội dung |
|---|---|
| [apps/web](apps/web/README.md) | Ranh giới Next.js/PWA và việc còn lại |
| [apps/api](apps/api/README.md) | Ranh giới NestJS/API/DB và việc còn lại |
| [docs](docs/README.md) | Yêu cầu, sơ đồ, kiến trúc và Scrum |
| `tests/` | Chỗ cho test xuyên ứng dụng; chưa có test executable |
| `.github/workflows/` | Chỗ cho CI/CD; chưa có workflow executable |
| [.env.example](.env.example) | Biến local đề xuất, chỉ có placeholder |
| `docker-compose.yml` | Chờ cấu hình Web/API/PostgreSQL tại #36 |

## Cấu hình

`.env.example` là mẫu phối hợp, **chưa có chương trình đọc các biến này**. Khi có runtime, tạo `.env` từ mẫu, thay mọi placeholder và theo README ứng dụng. Không commit `.env`, token, mật khẩu, DB dump. `NEXT_PUBLIC_*` công khai trong browser, không chứa secret. DB URL host `localhost` dành cho ứng dụng trên máy; container phải dùng hostname service khi #36 chốt Compose.

Không dùng mẫu trên production; CI/hosting cấp secret từ secret store. Chưa có production URL/registry/deploy đã xác minh. Chỉ ghi migrate/seed/start/test/build/rollback hoạt động khi có code và evidence từ checkout sạch.

## Quy trình

- [Nhánh, commit và PR](CONTRIBUTING.md).
- [Backlog hai Sprint](docs/scrum/product-backlog.md), [Definition of Done](docs/scrum/definition-of-done.md).
- [Sprint 1](docs/scrum/sprint-01.md): nền tảng/menu thật/CI; [Sprint 2](docs/scrum/sprint-02.md): checkout/test/production/bàn giao.

PR có mã như `[A2-4.1] Repository, backlog và DoD`, liên kết issue, cách kiểm tra và gap. Chỉ ghi Done khi đạt DoD; có tài liệu không chứng minh code/test/deployment đã đạt.
