# FE release — 08/10/2026

## Thay đổi

- Playfair: cập nhật contract/spec về bản thô `result`, metadata `padding`, checkbox lọc và
  `strip_padding` cho download. Bỏ helper gợi ý filler cũ không còn được UI sử dụng;
  giao diện vẫn dùng metadata BE.
- RSA: API mã hóa/giải mã độc lập, sinh hoặc nhập khóa, JSON chuỗi số, thao tác input/output,
  không tự chạy; bố cục dọc và khoảng cách đã chốt với người dùng.
- SQLite: chốt cấu hình runtime/backup và xử lý history 503 của FE từ đợt sửa trước.
  Handoff deployment dùng wrapper SQLite hiện hành.
- `npm run test:e2e:production` kiểm đủ 8 thuật toán và history trên stack đang chạy,
  không khởi động/build Backend. Default E2E loại các bộ RSA riêng khỏi suite không bật RSA.

## Nguồn và image

Các commit implementation:

- `b42c84b`: runtime SQLite, history và backup.
- `366c44a`: RSA API và giao diện.
- `175219d5626414329645a8b40049c04c36ff0136`: tài liệu Playfair và regression production.

FE image `cipher-workbench-frontend:175219d` được build từ `git archive` của commit cuối,
không dùng file chưa commit trong workspace. Image digest và revision label đã đối chiếu:

```text
sha256:21fd5f2e9ebcc2056d9abb64957b484779831cfbc7f5aab7bd11ab3975e23dd5
org.opencontainers.image.revision=175219d5626414329645a8b40049c04c36ff0136
```

Local cổng 18081 và integration cổng 18082 cùng dùng image trên. Các file mẫu/cấu hình
công cụ có sẵn trong workspace không được đưa vào các commit implementation.

## Kiểm chứng

| Kiểm tra                                                      | Kết quả                                     |
| ------------------------------------------------------------- | ------------------------------------------- |
| Unit/component                                                | 318/318, 46 files                           |
| Backup/restore/retention                                      | 6/6 với `PYTHONPATH=../cipher-workbench-be` |
| Regression production trên image từ commit, cổng 18082        | 74/74, không skip                           |
| Smoke local Playfair text/file padding và history, cổng 18081 | 2/2                                         |
| ESLint, TypeScript, Docker production build                   | Đạt                                         |
| Prettier các file đã chốt, diff whitespace, shell syntax      | Đạt                                         |
| FE/BE/backup hai stack                                        | Healthy                                     |

74 kịch bản gồm 28 cho năm cipher cũ/history, 20 Hill, 20 DES và 6 RSA.
Các phép mã hóa/giải mã trong test thêm metadata history thông thường.

Chạy lại:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18082 REQUIRE_SERVER_HISTORY=1 npm run test:e2e:production
```

## Boundary BE và rollback

Không thay source/image/container BE trong đợt này. Runtime giữ revision `229c69d` và
image `sha256:c3332dd77a66c98e6dacb28666332501b6946f6414a36283347d95dd232677ae`.
Checkout sibling BE tại thời điểm kiểm đã ở `9a442fb` và sạch; không dùng checkout mới
để rebuild runtime. API Playfair không đổi giữa hai revision này.

Pin FE trước release lưu riêng ở `backups/runtime/fe-release-175219d/previous-frontend-pin.json`
(ignored, private). Rollback chỉ đổi `FRONTEND_IMAGE` trong env của stack tương ứng rồi
chạy wrapper với `up --no-deps frontend`; giữ nguyên BE, DB và backup.
