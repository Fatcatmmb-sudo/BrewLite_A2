# CI trên pull request — A2-4.4 / #24

Workflow [Pull Request CI](../.github/workflows/pr-ci.yml) chạy trên mọi PR vào
`main` (kể cả chỉ sửa tài liệu), push `main`, merge queue và chạy thủ công.
Không dùng path filter hoặc `continue-on-error` cho required check.
Token workflow chỉ có `contents: read`; không cần secret hay DB production.

## Contract ứng dụng

Node **22**, npm đi kèm Node. Hai ứng dụng độc lập `apps/api`, `apps/web` phải có
`package.json`, `package-lock.json` được commit và scripts không rỗng:

| Bước | Lệnh cho mỗi app | Điều kiện |
|---|---|---|
| Validate | `node scripts/ci-projects.mjs validate` tại gốc | Cả hai manifest/lock và scripts tồn tại |
| Install | `npm ci` | Lockfile khớp manifest; cài cả dev dependencies |
| Lint | `npm run lint` | Linter trả exit code khác 0 khi có lỗi |
| Unit Test | `npm run test` | Chạy một lượt, không watch; thiếu test phải fail |
| Build | `npm run build` | Biên dịch ứng dụng thật; không cần secret production |

Mỗi bước chạy API rồi Web trước khi chuyển bước tiếp theo. Một lệnh lỗi sẽ dừng
job, các bước sau không chạy. Không dùng `--if-present` hoặc bỏ qua app thiếu
runtime. Nếu chuyển sang npm workspaces/pnpm/yarn hoặc cần env build public,
cập nhật runner, lockfile và tài liệu trong cùng PR runtime.

Chạy từ gốc repository:

```powershell
node --test scripts/ci-projects.test.mjs
node scripts/ci-projects.mjs validate
node scripts/ci-projects.mjs install
node scripts/ci-projects.mjs lint
node scripts/ci-projects.mjs test
node scripts/ci-projects.mjs build
```

`CI runner tests` kiểm tra thứ tự lệnh, missing manifest/lock/script, lỗi process,
exit code CLI và pipeline fixture bằng npm thật. Fixture tạm không có dependency;
test chủ động tạo unit test trả mã 7 và xác nhận runner trả lỗi, không chạy Web.
Kết quả fixture **không phải** kết quả unit/build của Web/API.

## Required check

Required check cho `main`: **`PR quality gate`**. Job này dùng `always()` và chỉ
pass khi cả `CI runner tests` lẫn `Install, lint, unit test and build` đều
`success`; fail/cancel/skip không được coi là pass. Giữ tên này ổn định để tránh
required check bị treo khi đổi tên job.

Branch protection cần yêu cầu nhánh cập nhật với `main`, required status check
trên và áp dụng cho cả admin; không cho force push/xóa nhánh. Cấu hình GitHub
là trạng thái ngoài Git, không tự được bật chỉ nhờ file YAML. Xem
[GitHub: required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging).

## Giới hạn nghiệm thu

Baseline `aea87f5` có mã catalog nhưng chưa có package/lock/runtime hoàn chỉnh.
Quality job phải **fail tại validate** cho đến khi runtime API/Web được tích hợp.
Không thêm script rỗng hoặc fixture vào app để đổi required check thành xanh.
Issue #24 chỉ hoàn tất khi có thêm run pass toàn pipeline ứng dụng thật và
review độc lập. Xem [evidence](evidence/ci/A2-4.4.md) để phân biệt kiểm thử runner,
run ứng dụng và trạng thái branch protection đã xác minh.
