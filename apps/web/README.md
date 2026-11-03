# apps/web - Next.js/PWA

Hiện **chưa có package.json, dependency hoặc runtime**, chưa có lệnh dev/test/build.

Đích cấu trúc: `src/app` cho route/layout, `src/features` cho catalog/cart/auth/checkout/orders, `src/lib` cho API client, `src/stores` cho giỏ client. Web gọi REST/JSON `/api/v1`, không truy cập DB hoặc tự quyết định giá/payment. API base public dự kiến `NEXT_PUBLIC_API_BASE_URL`; không đưa secret vào biến public.

[Menu #22](https://github.com/akira-yami/BrewLite_A2/issues/22), [detail #25](https://github.com/akira-yami/BrewLite_A2/issues/25), [cart/checkout/history #26](https://github.com/akira-yami/BrewLite_A2/issues/26), [PWA/API boundary #14](https://github.com/akira-yami/BrewLite_A2/issues/14) sẽ bổ sung runtime/version/lockfile và lệnh đã kiểm tra. UI có loading/empty/error, giữ giỏ khi lỗi/reload, mobile-first; offline không tự đặt/thanh toán.

Xem [SRS](../../docs/requirements/srs.md), [NFR](../../docs/requirements/non-functional-requirements.md), [backlog](../../docs/scrum/product-backlog.md), [quy ước PR](../../CONTRIBUTING.md). Khi có app, ghi lệnh install/dev/lint/test/build và env thực sự nạp từ đâu.
