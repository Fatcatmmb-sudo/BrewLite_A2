# Hoàn tiền và nghiệp vụ kho tại quầy

## FR-16 · Yêu cầu hoàn tiền trước pha chế (UC-14, UC-15)

Khách hàng gửi yêu cầu cho đơn của chính mình đã thanh toán và còn ở trạng thái `PAID`. Hệ thống lưu yêu cầu đang chờ và cho khách theo dõi quyết định. Nhân viên có vai trò `BARISTA` có thể chấp nhận hoặc từ chối yêu cầu đang chờ.

Khi chấp nhận, API kiểm tra lại quyền, trạng thái yêu cầu và trạng thái đơn tại thời điểm ghi. Nếu đơn đã chuyển sang `PREPARING` hoặc muộn hơn, API từ chối duyệt. Thao tác duyệt và thao tác bắt đầu pha chế phải phân xử trên cùng đơn để tránh hai kết quả mâu thuẫn. Yêu cầu đã xử lý giữ một kết quả duy nhất khi gửi lại.

Phê duyệt ghi người duyệt và thời điểm xử lý. Trạng thái hoàn tiền chỉ được xác nhận sau khi có kết quả xử lý hoàn tiền. Phạm vi A2 dùng Sandbox hoặc mô phỏng.

## FR-17 · Nhập kho và xem biến động (UC-16, UC-17)

Nhân viên `BARISTA` chọn nguyên liệu, nhập số lượng dương theo đơn vị của nguyên liệu và xác nhận nhập kho. Hệ thống cộng tồn và ghi phiếu biến động trong cùng giao dịch. Bản ghi gồm nguyên liệu, số lượng thay đổi, tồn trước và sau, thời điểm và người thực hiện.

Nhân viên xem lịch sử theo nguyên liệu, khoảng thời gian và loại biến động. Lịch sử phân biệt nhập kho, giữ nguyên liệu khi đặt đơn và hoàn tồn khi hủy hoặc hết hạn. Kết quả sắp theo thời điểm, mới nhất trước.

## Phạm vi triển khai

FR-16 và FR-17 là yêu cầu thiết kế mở rộng. API hiện cho Barista xem tồn kho. Luồng xác nhận hoàn tiền khi đối soát hiện thuộc vai trò `PAYMENT_OPERATOR`. Các Use Case mở rộng mô tả hành vi cần có để kiểm thử ở phiên bản triển khai tương ứng.
