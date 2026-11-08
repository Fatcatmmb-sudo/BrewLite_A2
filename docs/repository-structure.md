# Cấu trúc thư mục BrewLite A2

Khung được bổ sung theo mục 9 của [đề Assignment 2](Assignment2-BrewLite.md) và [kiến trúc hiện có](architecture/system-architecture.md). Các thư mục mới chứa `.gitkeep` để Git lưu được thư mục trống. Đây là khung tổ chức mã nguồn, chưa có Next.js/NestJS runtime, schema, migration, test hay pipeline thực thi.

```text
BrewLite_A2/
|-- apps/
|   |-- web/                         # Next.js mobile-first/PWA
|   |   |-- src/
|   |   |   |-- app/                 # App Router: route, layout, loading, error
|   |   |   |-- components/          # UI dùng chung
|   |   |   |-- features/
|   |   |   |   |-- catalog/         # Menu và chi tiết sản phẩm
|   |   |   |   |-- cart/            # Giỏ hàng
|   |   |   |   |-- auth/            # Đăng ký, đăng nhập
|   |   |   |   |-- checkout/        # Đặt đơn và thanh toán mô phỏng
|   |   |   |   `-- orders/          # Xác nhận, theo dõi và lịch sử đơn
|   |   |   |-- lib/                 # API client và tiện ích dùng chung
|   |   |   |-- stores/              # State phía client
|   |   |   `-- types/               # Kiểu dữ liệu dùng chung trong web
|   |   |-- public/                  # Ảnh, icon và tài nguyên tĩnh/PWA
|   |   `-- tests/                   # Component/UI test của web
|   `-- api/                         # NestJS modular monolith
|       |-- src/
|       |   |-- modules/
|       |   |   |-- auth/
|       |   |   |-- users/
|       |   |   |-- catalog/
|       |   |   |-- orders/
|       |   |   |-- inventory/
|       |   |   |-- payments/        # Bao gồm adapter thanh toán mock
|       |   |   |-- promotions/
|       |   |   |-- loyalty/
|       |   |   `-- health/
|       |   |-- common/
|       |   |   |-- decorators/
|       |   |   |-- guards/
|       |   |   |-- filters/
|       |   |   |-- interceptors/
|       |   |   `-- pipes/
|       |   |-- config/              # Cấu hình và validate environment
|       |   `-- database/            # Prisma service và kết nối DB
|       |-- prisma/
|       |   `-- migrations/          # Migration PostgreSQL có phiên bản
|       `-- test/                    # HTTP/API test riêng của backend
|-- docs/
|   |-- requirements/               # Task 1: phạm vi, SRS, use-case
|   |-- diagrams/                   # Task 2: nguồn và bản xuất sơ đồ
|   |-- architecture/               # Task 3: thiết kế kiến trúc
|   |   `-- adr/                     # Quyết định kiến trúc
|   |-- scrum/
|   |   |-- reviews/                 # Sprint Review
|   |   `-- retrospectives/          # Sprint Retrospective
|   |-- testing/                    # Kế hoạch kiểm thử
|   |-- evidence/
|   |   |-- ci/                      # Log/ảnh/link CI pass và fail
|   |   |-- cd/                      # Minh chứng deploy, health, rollback
|   |   `-- demo/                    # Hướng dẫn hoặc link video demo
|   |-- traceability-matrix.md
|   |-- deployment.md
|   `-- repository-structure.md
|-- tests/                          # Test xuyên ứng dụng
|   |-- integration/                # Tích hợp nghiệp vụ/API và PostgreSQL
|   |-- e2e/                        # Menu đến xác nhận đơn qua UI/API/DB
|   |-- fixtures/                   # Dữ liệu kiểm thử dùng chung
|   `-- smoke/                      # Kiểm tra sau triển khai
|-- scripts/                        # Script hỗ trợ khi triển khai runtime
|-- .github/
|   |-- workflows/                  # CI/CD, hiện chỉ giữ chỗ
|   `-- pull_request_template.md
|-- .env.example
|-- .gitignore
|-- docker-compose.yml              # Hiện giữ chỗ cho web/API/PostgreSQL
|-- CONTRIBUTING.md
`-- README.md
```

## Quy ước khi thêm mã nguồn

- Tạo route trong `apps/web/src/app` khi hiện thực màn hình; đặt logic theo feature và chỉ đưa UI dùng chung vào `components`.
- Với mỗi domain API, thêm controller/service/repository/DTO khi cần, theo luồng `Controller -> Service -> Repository -> Prisma`. Không tạo lớp rỗng chỉ để đủ cấu trúc.
- `schema.prisma` và `seed.ts` sẽ nằm trực tiếp trong `apps/api/prisma` khi triển khai dữ liệu; chưa tạo file rỗng có thể bị hiểu là schema/seed hợp lệ.
- Unit test có thể đặt cạnh mã nguồn dưới dạng `*.spec.ts` hoặc `*.test.tsx`. Test xuyên ứng dụng nằm ở `tests`; tránh sao chép cùng ca sang nhiều nơi.
- Thay `.gitkeep` bằng mã nguồn/tài nguyên khi thư mục có nội dung. Không sửa nội dung thư mục tham khảo `docs/tham_khao` để triển khai A2.

Tiếp tục hoàn thiện các tạo phẩm Task 1–3 trước khi nghiệm thu Sprint 1 theo đề. Lệnh install/dev/test/build, Docker và workflow sẽ được bổ sung cùng runtime và kiểm chứng ở bước triển khai.
