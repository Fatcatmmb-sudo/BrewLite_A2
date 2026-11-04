# Definition of Done - BrewLite A2

Phiên bản 1.0 · 03/11/2026 · [A2-4.1 / #17](https://github.com/akira-yami/BrewLite_A2/issues/17). Tiêu chuẩn nghiệm thu, không xác nhận hạng mục đã Done.

## Mọi hạng mục

- Đối chiếu AC/FR/NFR; có PR đúng mã A2 và liên kết issue, mô tả kết quả cụ thể.
- Ít nhất một thành viên khác review, xử lý ý kiến quan trọng; PO/đại diện nhóm xác nhận AC bằng evidence. Không tự ghi approval/ngày nghiệm thu của người khác.
- Không có secret/dữ liệu nhạy cảm, dependency/build output hoặc bản sao tham khảo; env mẫu chỉ placeholder.
- Cập nhật tài liệu/contract/truy vết, nguồn và bản xuất sơ đồ liên quan. Link/anchor/FR/UC/enum đúng; gap được ghi rõ.
- Evidence có commit, môi trường, lệnh/bước review, expected/actual, thời điểm UTC, artifact/run URL và reviewer. Evidence A1 không thay evidence A2.

## Tài liệu / thiết kế

- Đủ tạo phẩm theo issue, mở được khi clone sạch, không phụ thuộc thư mục tham khảo local bị ignore.
- FR/NFR có ID/MoSCoW/AC; sơ đồ sửa từ nguồn, xuất lại, đọc được và khớp SRS. ADR có bối cảnh/quyết định/lý do/trade-off/trạng thái.
- Tách thiết kế đích khỏi code đã có, test plan khỏi kết quả chạy. Docs thuần có thể ghi app build N/A khi chưa có runtime, kèm lý do; không giả pass.

## Code / API / dữ liệu khi áp dụng

- Lint/unit/build pass theo README/lockfile; CI/required checks theo #24. Test phù hợp business rule/rủi ro, không chỉ sao chép implementation.
- HTTP DTO/JWT/RBAC/ownership được kiểm tra; không tin giá/amount/userId/role client; response/log không lộ secret/stack.
- Migration từ DB rỗng và migrate/seed lặp an toàn; transaction quan trọng có PostgreSQL integration/rollback. Không sửa migration đã áp dụng hoặc reset DB chung.
- State machine từ chối transition sai, phân xử hủy/expiry/nhận pha. BOM X=10, tồn X=50/20 request chỉ 5 đơn thành công, không âm. Payment same-key không charge/side effect kép, khác payload bị từ chối, khác key cùng đơn không success hai lần, timeout/restart được đối soát. Coupon/loyalty giữ/consume/EARN đúng một lần.

## UI / luồng người dùng khi áp dụng

- Có loading/empty/success/error/retry, validate form; giữ giỏ/lựa chọn qua lỗi/reload/login.
- Mobile/desktop/browser/keyboard theo NFR-08, không console error nghiêm trọng, control có label/focus.
- E2E thật menu -> detail -> cart -> auth -> order -> payment -> confirmation/history; chưa login/hết hàng/decline/unknown không tạo xác nhận giả. PWA offline không tự gửi mutation/cache dữ liệu nhạy cảm.

## Release / vận hành khi áp dụng

- Checkout sạch chạy theo README/env mẫu đã thay placeholder, Compose healthy, migration/seed/persistence kiểm chứng; Compose rỗng không đạt.
- CI/CD có run thật, image SHA/digest, migration/health/smoke; production HTTPS/DB riêng, log requestId và readiness DB 200/503.
- Có release/tag/notes/URL, hướng dẫn test/build/deploy/rollback; backup/restore/rollback trên DB test theo NFR-11, không tự migration down phá dữ liệu.
- NFR Must đo theo điều kiện/ngưỡng trong [SRS NFR](../requirements/non-functional-requirements.md); CI xanh không chứng minh hiệu năng/availability/production.

## N/A và khoảng trống

PR ghi mục không áp dụng và lý do theo loại thay đổi. N/A không loại AC của issue hoặc Must khỏi nghiệm thu MVP. Còn gap thì không ghi Done, nêu dependency ở In progress/Blocked. Một tài liệu có thể hoàn tất review trong khi chức năng/NFR nó mô tả chưa triển khai/chưa đo.
