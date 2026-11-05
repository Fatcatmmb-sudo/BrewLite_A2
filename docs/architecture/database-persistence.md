Tài liệu Mô tả Lớp Lưu trữ và Cơ chế Migration (A2-3.1.2)

# 1. Cơ chế Lưu trữ Bền vững (Persistent Storage)
+Hệ quản trị Cơ sở Dữ liệu: Dự án sử dụng PostgreSQL làm nguồn dữ liệu giao dịch duy nhất cho toàn bộ hệ thống backend (NestJS).
-Tính bền vững (Persistence): Dữ liệu được lưu trữ thông qua các Docker Volumes cấu hình trong tệp compose.yaml. Điều này đảm bảo toàn bộ thông tin về người dùng, sản phẩm, giỏ hàng, đơn hàng, lịch sử thanh toán và kho hàng không bị mất mát khi các container khởi động lại.

# Quy tắc kiểu dữ liệu:
-Các giá trị tiền tệ (giá sản phẩm, tổng đơn, giảm giá) được lưu bằng kiểu dữ liệu BIGINT (tính bằng Đồng/VND) nhằm tránh sai số do số thực (floating-point).
+Thời gian sử dụng chuẩn TIMESTAMPTZ(6) (UTC).
-Định danh sử dụng UUID cho các khóa chính.

# 2. Quản lý Tồn kho qua Định mức Nguyên liệu (BOM)
-Không lưu số lượng thành phẩm tĩnh: Các bảng sản phẩm (product_variants) không lưu số lượng tồn kho tĩnh. Thay vào đó, hệ thống tính toán khả năng phục vụ theo thời gian thực dựa trên định mức nguyên liệu thô (RecipeItem và ToppingRecipeItem) kết hợp với số lượng tồn kho thực tế của bảng ingredients.
-Đơn vị tính nguyên liệu: Quản lý theo đơn vị cơ sở (G cho gram, ML cho mililit, PCS cho cái).

# 3. Cơ chế Migration (Prisma Migrate)
-Quản lý mã nguồn: Toàn bộ cấu trúc cơ sở dữ liệu được định nghĩa trong schema.prisma và các tệp migration có phiên bản (append-only) nằm trong thư mục apps/api/prisma/migrations/.
-Quy trình triển khai (Deployment):
+Trên môi trường production, migration được thực thi một lần trước khi khởi chạy ứng dụng API thông qua lệnh prisma migrate deploy.
+Tuyệt đối không sử dụng các lệnh làm mất dữ liệu như db push hay migrate reset trên môi trường production.

# 4. Kết nối Database và Cơ chế Xử lý Giao dịch (Transaction & Concurrency)
-Kết nối: NestJS kết nối trực tiếp đến PostgreSQL thông qua Prisma Client (hỗ trợ adapter PrismaPg), cấu hình bảo mật thông qua biến môi trường DATABASE_URL
-Xử lý đồng thời và toàn vẹn dữ liệu (ACID):
+Giao dịch (Transactions): Các luồng quan trọng như tạo đơn hàng, trừ tồn kho nguyên liệu, áp dụng mã giảm giá (coupon_redemptions) đều được bọc trong Prisma $transaction. Nếu bất kỳ bước nào lỗi, toàn bộ thay đổi sẽ được hoàn tác (rollback) an toàn.
+Chống ghi lặp (Idempotency): Giao dịch thanh toán (payments) sử dụng ràng buộc độc nhất (UNIQUE) trên idempotency_key kết hợp với chỉ mục một chiều (uq_one_successful_payment_per_order) để ngăn chặn tuyệt đối tình trạng thanh toán lặp (double-charge) khi có nhiều request đồng thời gửi đến.