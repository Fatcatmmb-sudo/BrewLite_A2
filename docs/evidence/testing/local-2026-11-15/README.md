# Minh chứng kiểm thử cục bộ ngày 15/11/2026

Bộ ảnh xác nhận kết quả chạy unit test, integration, API E2E và Playwright trên môi trường local. Ảnh migration xác nhận Prisma áp dụng migration, chạy lại không còn migration chờ và schema đã cập nhật.

## Kết quả theo bộ kiểm thử

| Bộ kiểm thử | Lệnh | Kết quả trong ảnh | Minh chứng |
|---|---|---|---|
| Áp dụng migration Prisma | `npm --prefix apps/api run prisma:deploy` | 21 migration được tìm thấy. Prisma báo áp dụng thành công. | [Lệnh và danh sách migration](prisma-deploy-migrations.png), [kết quả](prisma-deploy-success.png) |
| Unit API | `npm --prefix apps/api test` | 532/532 ca đạt trên 50 tệp. | [Tổng kết Vitest API](api-unit.png) |
| Unit Web | `npm --prefix apps/web test` | 103/103 ca đạt, 0 lỗi và 0 bỏ qua. | [Tổng kết Node test runner](web-unit.png) |
| API integration | `npm --prefix apps/api run test:integration` | 91/91 ca đạt trên 11 tệp. | [Tổng kết integration](api-integration.png), [một số ca nghiệp vụ](api-integration-selected-cases.png) |
| Migration và kiểm tra lại schema | `npm --prefix apps/api run test:migration` | 21 migration. Lần chạy lại báo không có migration chờ. Bước integration trong cùng quy trình đạt 91/91 ca. | [Kết quả chạy lại và trạng thái schema](migration-replay-status.png), [tổng kết integration sau migration](migration-integration.png) |
| API E2E | `npm --prefix apps/api run test:e2e` | 32/32 ca đạt trên 4 tệp. | [Tổng kết API E2E](api-e2e.png) |
| Browser E2E | `npm --prefix apps/web run test:e2e` | 25/25 ca đạt qua các project `chromium` và `delivery`. | [Danh sách ca và tổng kết Playwright](browser-e2e.png) |

Hai số 91/91 thuộc hai lượt chạy bộ integration. Bước chạy trong migration được ghi để chứng minh kiểm thử sau khi áp dụng schema.

## Phạm vi nghiệp vụ

- **Đơn hàng và tồn kho.** Integration kiểm tra tạo đơn và giữ nguyên liệu trong cùng giao dịch, hoàn tồn một lần, thứ tự trạng thái đơn và các nghiệp vụ tồn kho dành cho Barista. Ảnh Playwright ghi nhận ca Barista kiểm tra tồn kho trên giao diện desktop và mobile. [Kiểm thử integration](api-integration-selected-cases.png) · [Playwright](browser-e2e.png)
- **Thanh toán và phiên làm việc.** Playwright ghi nhận thử lại giao dịch, khôi phục phiên checkout, xử lý phản hồi 403 khi truy vấn đơn và kịch bản từ menu đến xác nhận đơn. Integration có ca đối soát yêu cầu một người vận hành thứ hai xác nhận kết quả hoàn tiền. [Kiểm thử integration](api-integration-selected-cases.png) · [Playwright](browser-e2e.png)
- **VNPay chạy riêng.** Báo cáo Word liệt kê các kịch bản của `test:e2e:vnpay`. Bộ trích xuất có tổng kết của `test:e2e` trên `chromium` và `delivery`. Kết quả của project `vnpay` chạy riêng cần log hoặc ảnh tổng kết của chính project đó để xác nhận.

## Nguồn và phạm vi đối chiếu

Nguồn là tệp `ThaiKiet_Báo cáo chạy test.docx` do thành viên nhóm cung cấp. Mốc 15/11/2026 xuất hiện trong log integration. Các ảnh được trích nguyên tệp PNG nhúng trong tài liệu. Báo cáo và ảnh không ghi commit SHA của phiên chạy. Kết quả được lưu theo lần chạy cục bộ này, tách khỏi [lượt kiểm thử ngày 14/11](../local-2026-11-14/README.md) và kết quả CI theo commit.

SHA-256 của tệp nguồn: `27fe8dab148ccdc9e1c3f137db787b0b82fcc37ed51b9e0282ae34505162cde3`.

Đọc [kế hoạch kiểm thử](../../../testing/test-plan.md) để tái chạy trên cơ sở dữ liệu test riêng. Tạo cơ sở dữ liệu test rỗng dành cho `test:migration`.
