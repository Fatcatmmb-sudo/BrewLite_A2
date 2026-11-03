# Quy ước đóng góp BrewLite A2

Truy vết: [A2-4.1 / #17](https://github.com/akira-yami/BrewLite_A2/issues/17). Nhánh tích hợp là `main` của `akira-yami/BrewLite_A2`; thay đổi được review bằng PR.

## Issue -> nhánh -> commit -> PR

1. Đọc issue, FR/NFR/AC và dependency trong [backlog](docs/scrum/product-backlog.md). Giữ mã/owner/phạm vi; ghi đề xuất chia nhỏ trong PR.
2. Nhánh `codex/A2-<mã>-<mo-ta>`, ví dụ `codex/A2-4.1-repository-backlog-dod`, `codex/A2-3.1.1-architecture-adr`, `codex/A2-TV.1-traceability`. Git không cho dấu `[` hoặc khoảng trắng trong tên nhánh.
3. Commit `<type>(<scope>): <nội dung ngắn>`, một mục đích; ví dụ `docs(scrum): define two-sprint backlog`. Type: feat/fix/docs/test/chore/ci/refactor. Tham chiếu `Refs #17` trong body khi cần. Không commit secret/build output/bản sao tham khảo.
4. PR nhắm `main`, tiêu đề **`[A2-<mã>] <kết quả cụ thể>`**, ví dụ `[A2-4.1] Repository, backlog và DoD`. Dùng `Closes #17` nếu hoàn tất, `Refs #17` nếu một phần; cross-repo dùng `Closes akira-yami/BrewLite_A2#17`.
5. PR nêu vấn đề/kết quả, FR/NFR, lệnh và kết quả kiểm tra thật, gap và dependency. Cập nhật tài liệu/contract/truy vết, nguồn và bản xuất sơ đồ liên quan cùng PR. Không ghi test/build pass khi chưa có runtime.
6. Ít nhất một thành viên khác review, xử lý ý kiến quan trọng và đạt [DoD](docs/scrum/definition-of-done.md) trước merge. Có thể squash PR một issue; tiêu đề merge giữ mã A2/issue link. Không tự ghi approval của người khác, không push trực tiếp main.

Ví dụ trên repository chính:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/A2-4.1-repository-backlog-dod
```

Kiểm tra `git remote -v` trước push. Nếu origin là fork cá nhân, giữ remote đó và mở PR vào `akira-yami/BrewLite_A2`; không tự đổi remote thành viên. Tránh force push nhánh chung. PR phụ thuộc ghi rõ thứ tự merge, không coi tài liệu ở PR đã có trên main.

## Trạng thái và minh chứng

`Planned` -> `In progress` -> `In review` -> `Done`; `Blocked` ghi dependency/người phối hợp. Backlog ban đầu là kế hoạch. Chỉ cập nhật Done khi đủ review, AC và evidence; có commit/PR không tự chứng minh nghiệm thu.

Evidence ghi commit, môi trường, lệnh/bước kiểm tra, expected/actual, thời điểm UTC, artifact/run URL, reviewer và kết luận. Phân biệt test chưa viết/chưa chạy/fail. Tài liệu A1 là căn cứ thiết kế, kết quả A1 không thay kết quả A2.

## Kiểm tra PR

- `git diff --check`, xem diff và staged files đúng phạm vi.
- Docs: kiểm tra link/anchor/FR/UC/enum; sơ đồ sửa từ nguồn và xuất lại, kiểm tra đọc được.
- Code: lint/unit/build, integration/E2E phù hợp theo README runtime. Tồn/payment cần PostgreSQL concurrency/rollback/idempotency.
- Env mẫu chỉ placeholder; không commit JWT/dump/dữ liệu thẻ, không cache secret/response payment trong PWA.

CI/required checks thuộc [#24](https://github.com/akira-yami/BrewLite_A2/issues/24). Chưa có workflow/branch protection đã xác minh; quy ước này không phải evidence CI chặn merge.
