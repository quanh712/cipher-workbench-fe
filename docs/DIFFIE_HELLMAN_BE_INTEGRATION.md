# Nghiệm thu Diffie–Hellman với BE thật

Trạng thái migration contract 2026-10-08: **43/43 API tests qua với BE thật trong môi trường cô lập**. Không coi discover/lint/typecheck hay HTTP mock pass là nghiệm thu Backend. Contract: [spec FE](DIFFIE_HELLMAN_SPEC.md), authority là BE frontend-integration.md mục 19.

Dùng bản BE có đủ sáu endpoint `/api/dh/*`, database integration riêng đã migrate, `HISTORY_API_ENABLED=true`, health báo database ok/history enabled. Không có traffic khác hoặc retention trong lúc test. Bộ test ghi metadata cho Caesar text/file, không xóa history hay tự deploy BE; không trỏ vào demo dùng chung.

```bash
# Discover, không gọi BE
npm run test:integration:diffie-hellman -- --list
# Origin không gồm /api
DH_BACKEND_URL=http://127.0.0.1:18082 npm run test:integration:diffie-hellman
```

Config riêng chạy API tuần tự, không retry/browser/Vite/mock. Thiếu endpoint/database/history làm acceptance fail. Không cần bật cờ UI để chạy. Không bật Playwright trace vì body chứa private/shared keys; assertion output chỉ dùng dữ liệu minh họa trong DB test.

Bộ test kiểm:

- Exchange preset và hoán đổi hai bên, exact DTO/warning, bốn traces trái→phải bằng oracle BigInt độc lập trong test.
- Params suggestion tách biệt selected alpha và checks explicit; safe-prime random 16 bit và dùng response downstream.
- Keypair explicit/generated; shared-secret cả A/B và vector 353/97/248.
- Caesar JSON encrypt/decrypt; multipart `.TXT`, BOM, Unicode/CRLF, response JSON không attachment.
- Strict decimal/JSON/field/media và các lỗi miền, weak private key, public key, action/data với four-field envelope.
- History bật và hoạt động: năm endpoint tham số/khóa không thêm row; Caesar text/file tạo đúng metadata, không có key/content/trace trong row.

Không giữ assertion cũ về URL/shape, normalization wire, optional trace, body 4 KiB, response 64 KiB hoặc no-store response vì đó không phải contract mới. Test không chứng minh RNG distribution, DB-down independence, toàn bộ logging middleware, resource saturation hoặc tất cả file boundary; cần kiểm BE tương ứng.

| Bằng chứng                         | Trạng thái                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Ngày chạy BE thật                  | 2026-10-08 (Asia/Bangkok)                                                                                |
| BE commit/image digest             | Source `main` `57d5766`, chạy Docker isolated                                                            |
| FE commit                          | Working tree migration hiện tại, chưa commit                                                             |
| Origin / database / history config | `http://127.0.0.1:18084`; SQLite riêng `/tmp/dh-acceptance.sqlite3`; history enabled                     |
| Lệnh / số pass-fail                | `DH_BACKEND_URL=http://127.0.0.1:18084 npm run test:integration:diffie-hellman`; **43 passed**, 2,2 giây |
| DB-down / recorder / log review BE | Chưa nghiệm thu                                                                                          |

Kiểm lại sau fix `57d5766`: warning mới được đồng bộ fixture/UI; thêm regression q manual vượt 128 bit vẫn trả message miền `5..10¹²`. Schema và sáu endpoint giữ nguyên. Container/SQLite kiểm thử tạm đã được dọn sau khi chạy; không deploy demo.
