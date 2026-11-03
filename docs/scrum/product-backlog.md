# Product backlog BrewLite A2 - hai Sprint

Phiên bản 1.0 · 03/11/2026 · [A2-4.1 / #17](https://github.com/akira-yami/BrewLite_A2/issues/17).

Đây là **kế hoạch**, không phải báo cáo Done. Mã và phân công lấy từ issue ở `akira-yami/BrewLite_A2`, đối chiếu 03/11/2026; không tự đặt ngày, SP, capacity hoặc kết quả review. A1 tham khảo dùng ba Sprint; **A2 dùng đúng hai Sprint**. Baseline `d600b26` có context/SRS/NFR/UC tổng quát, chưa có runtime/test/CI/deployment. Chỉ ghi Done khi có evidence và [DoD](definition-of-done.md).

## Chuẩn bị - Task 1–3

| Issue | Phụ trách theo issue | Đầu ra / dependency |
|---|---|---|
| [#1](https://github.com/akira-yami/BrewLite_A2/issues/1), [#2](https://github.com/akira-yami/BrewLite_A2/issues/2), [#3](https://github.com/akira-yami/BrewLite_A2/issues/3), [#4](https://github.com/akira-yami/BrewLite_A2/issues/4) | Khang | Context/FR/NFR/UC tổng quát có trong baseline, review lại khi đổi scope |
| [#5](https://github.com/akira-yami/BrewLite_A2/issues/5), [#6](https://github.com/akira-yami/BrewLite_A2/issues/6) | Khang (cả hai issue; nội dung yêu cầu phối hợp Kiệt) | Một UC Đặt và thanh toán: actor/pre/post/main/alternative/exception, FR, source/export |
| [#7](https://github.com/akira-yami/BrewLite_A2/issues/7) | Khải | Activity checkout: chưa login/hết hàng/payment fail, source/export |
| [#8](https://github.com/akira-yami/BrewLite_A2/issues/8), [#9](https://github.com/akira-yami/BrewLite_A2/issues/9) | Khang / Kiệt | Một sequence chung: JWT/validation/transaction và success/fail/idempotency |
| [#10](https://github.com/akira-yami/BrewLite_A2/issues/10) | Khang | Class domain đủ lớp/thuộc tính/quan hệ/multiplicity/enum |
| [#11](https://github.com/akira-yami/BrewLite_A2/issues/11) | Khải | Nguồn/export 2 UC + activity + sequence + class + deployment; link/enum nhất quán |
| [#12](https://github.com/akira-yami/BrewLite_A2/issues/12) | Khang | Kiến trúc phân lớp/C4, Next/Nest/PostgreSQL/mock, trade-off và ADR |
| [#13](https://github.com/akira-yami/BrewLite_A2/issues/13) | Hoàng | Persistence/migration/transaction |
| [#14](https://github.com/akira-yami/BrewLite_A2/issues/14) | Khải | Next/PWA/API boundary, lỗi và hosting |
| [#15](https://github.com/akira-yami/BrewLite_A2/issues/15) | Huy | Logging/readiness/config/secrets |
| [#16](https://github.com/akira-yami/BrewLite_A2/issues/16) | Khang | Deployment khớp hosting thực tế; source/export, mạng/cổng/HTTPS/storage/CI/secret |

Tạo phẩm Task 1 -> 2 -> 3 phải có lịch sử trước nghiệm thu task sau. Khung quy trình có thể chuẩn bị song song, không bỏ qua dependency thiết kế.

## Sprint 1 - Nền tảng, menu thật và CI

| Mã A2 / Issue | Phụ trách | Giá trị / AC chính | Dependency | Ưu tiên |
|---|---|---|---|---|
| A2-4.1 / [#17](https://github.com/akira-yami/BrewLite_A2/issues/17) | Khang | Clone được; apps/web/api/docs, README/env/gitignore, quy ước, backlog hai Sprint/DoD | Baseline yêu cầu | Must |
| A2-4.2 / [#18](https://github.com/akira-yami/BrewLite_A2/issues/18) | Khải | Hồ sơ Task 1–3 có version qua commit/PR nêu lý do | #1–#16 | Must |
| A2-4.3.1 / [#21](https://github.com/akira-yami/BrewLite_A2/issues/21) | Hoàng | Catalog list/detail với DB/seed, FR-01/02 | #12/#13/#17, contract | Must |
| A2-4.3.2 / [#22](https://github.com/akira-yami/BrewLite_A2/issues/22) | Hoàng | Menu gọi API thật, loading/empty/error/mobile, FR-01 | #14/#17/#21 | Must |
| A2-4.3.3 / [#23](https://github.com/akira-yami/BrewLite_A2/issues/23) | Hoàng | Test API/menu, lint/test/build có evidence | #21/#22 | Must |
| A2-4.4 / [#24](https://github.com/akira-yami/BrewLite_A2/issues/24) | Khang | Install -> Lint -> Unit -> Build; pass/fail/required checks chặn lỗi | Runtime/lockfile #21/#22 | Must |

**Issue trùng:** [#19](https://github.com/akira-yami/BrewLite_A2/issues/19) và #21 cùng A2-4.3.1; [#20](https://github.com/akira-yami/BrewLite_A2/issues/20) và #22 cùng A2-4.3.2. Kế hoạch dùng #21/#22 làm hạng mục chính, giữ #19/#20 để truy vết. Nhóm cần xác nhận duplicate trước đóng; chưa đóng/đổi phân công hoặc tính capacity hai lần.

Exit: checkout sạch chạy Web/API/DB với menu thật; demo UI states; test/lint/build pass; CI chặn lỗi đã xác minh; hồ sơ Task 1–3 có version. Thiếu điều kiện thì ghi gap, không tự ghi Done.

## Sprint 2 - Checkout, kiểm chứng và bàn giao

| Mã A2 / Issue | Phụ trách | Giá trị / AC chính | Dependency | Ưu tiên |
|---|---|---|---|---|
| A2-5.1.1 / [#25](https://github.com/akira-yami/BrewLite_A2/issues/25) | Hoàng | Detail/size/topping/đường/đá/note, giá/hết hàng, FR-02/03 | #21/#22 | Must |
| A2-5.1.2 / [#26](https://github.com/akira-yami/BrewLite_A2/issues/26) | Khải | Cart/persist, checkout/confirmation/history/lỗi thật, FR-04/08 | #25/#27/#28/#29 | Must |
| A2-5.1.3 / [#27](https://github.com/akira-yami/BrewLite_A2/issues/27) | Huy | JWT/register/login/hash/role/ownership/phiên, FR-05 | #12/#15/#17/#35 | Must |
| A2-5.1.4 / [#28](https://github.com/akira-yami/BrewLite_A2/issues/28) | Khang | Tạo đơn/giá server/snapshot/reservation/coupon, trạng thái/hủy/history, FR-06/08/09/10 | #21/#27/#35, ADR, phối hợp inventory/loyalty | Must |
| A2-5.1.5 / [#29](https://github.com/akira-yami/BrewLite_A2/issues/29) | Kiệt | Ví/Thẻ mock, success/decline/unknown/retry/idempotency và side effect, FR-07/10 | #28/#35, ADR, phối hợp Hoàng/Huy | Must |
| A2-5.2.1.1 / [#30](https://github.com/akira-yami/BrewLite_A2/issues/30) | Kiệt | Orders: validate/rollback/ownership/state machine/race | #28 | Must |
| A2-5.2.1.2 / [#31](https://github.com/akira-yami/BrewLite_A2/issues/31) | Kiệt | Payment: replay/concurrency/khác payload/timeout/recovery | #29 | Must |
| A2-5.2.1.3 / [#32](https://github.com/akira-yami/BrewLite_A2/issues/32) | Hoàng | Inventory: stock=5/20 request, consume/release/expiry một lần | #28/#35 | Must |
| A2-5.2.1.4 / [#33](https://github.com/akira-yami/BrewLite_A2/issues/33) | Huy | Auth/loyalty: trái quyền, một EARN/order, không cộng khi fail | #27/#29 | Must |
| A2-5.2.2 / [#34](https://github.com/akira-yami/BrewLite_A2/issues/34) | Khải | Browser E2E menu -> confirmation/history, ca lỗi/giỏ | #25–#29 | Must |
| A2-5.2.3 / [#35](https://github.com/akira-yami/BrewLite_A2/issues/35) | Hoàng | Migration/seed từ DB rỗng, lặp an toàn, constraint | #13/#17; schema chốt sớm cùng #28/#29 | Must |
| A2-5.2.4 / [#36](https://github.com/akira-yami/BrewLite_A2/issues/36) | Hoàng | Compose Web/API/DB/health/persistence, checkout sạch | #25–#29/#35 | Must |
| A2-5.3.1 / [#37](https://github.com/akira-yami/BrewLite_A2/issues/37) | Khang | CD quality gate, image SHA/version, registry/deploy/smoke | #16/#24/#36 | Must |
| A2-5.3.2 / [#38](https://github.com/akira-yami/BrewLite_A2/issues/38) | Kiệt | Migration/backup/restore/rollback app tương thích schema | #35/#37 | Must |
| A2-5.4.1 / [#39](https://github.com/akira-yami/BrewLite_A2/issues/39) | Khải | Production HTTPS, API/health, DB riêng, secret ngoài Git | #16/#37/#38 | Must |
| A2-5.4.2 / [#40](https://github.com/akira-yami/BrewLite_A2/issues/40) | Kiệt | Release/tag/notes/demo/hướng dẫn/rollback | #30–#39/#41 | Must |
| A2-TV.1 / [#41](https://github.com/akira-yami/BrewLite_A2/issues/41) | Khang | FR -> UC/story -> diagram -> Code/API -> test, link/gap/evidence rõ | SRS, cập nhật cùng các PR | Must |

Inventory/promotions/loyalty chưa có issue implementation riêng trong danh sách gốc. Đề xuất đặt orchestration/reservation/coupon ở #28, side effect payment ở #29, phối hợp #32/#33; không thay owner GitHub. Nhóm phải chốt hoặc tách issue trước code để FR-09/10 không bị sót. Coupon/loyalty vẫn Must theo SRS.

Phân trang FR-11 là Should, dự kiến #28/#26 sau Must. UI quầy đầy đủ FR-12, refresh token FR-13, realtime FR-14 là Could, backlog mở rộng nếu chưa có capacity; API tiến độ FR-09 vẫn Must. FR-15 tiền thật là Won't.

## Planning và cập nhật

[Sprint 1](sprint-01.md), [Sprint 2](sprint-02.md), [DoD](definition-of-done.md) là tiêu chí phối hợp. Nhóm chốt ngày/capacity/ước lượng/reviewer trong Planning; hiện chưa có dữ kiện. Thay phạm vi phải dẫn FR/AC/dependency trong PR. Review/Retro/burndown chỉ ghi từ họp và kết quả thật, không dựng số liệu.
