# Nghiệm thu Diffie–Hellman với BE thật

Bằng chứng migration contract 2026-10-08 (trước khi BE mở rộng lịch sử): **43/43 API tests qua với BE thật trong môi trường cô lập**. Không coi discover/lint/typecheck hay HTTP mock pass là nghiệm thu Backend. Contract: [spec FE](DIFFIE_HELLMAN_SPEC.md), authority là BE frontend-integration.md mục 19.

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
- History bật và hoạt động: cả năm endpoint tham số/khóa tạo row với operation tương ứng, source text và hai length null; Caesar text/file tạo đúng metadata; bộ lọc `cipher=dh&operation=exchange` trả đúng row, không có key/content/trace trong row.

Cập nhật UI/contract ngày 2026-10-13 theo BE `expand-dh-operation-history`: bộ test hiện tại kỳ vọng 7 row cho 5 thao tác standalone và 2 thao tác Caesar. Kết quả 43/43 ngày 2026-10-08 phía dưới là bằng chứng lịch sử cho contract cũ; kết quả nghiệm thu mới được ghi ở mục cập nhật BE ngày 2026-10-13.

Kiểm tra FE cho phần mở rộng: 585 unit/component tests qua với `npm run test -- --maxWorkers=2`; lint, typecheck và build qua. `npm run test:e2e:diffie-hellman -- e2e/diffie-hellman-history.spec.ts` qua 2/2 trên desktop và màn hình 375px, dùng HTTP mock để kiểm mapping `dh`, bộ lọc, pagination và retry 503. Các kết quả này không thay thế nghiệm thu BE thật.

### Cập nhật FE cổng 18081 ngày 2026-10-13

Đã thay riêng FE bằng image `cipher-workbench-frontend:dh-history-20261013`, bundle `index-DotHYDVD.js`; giữ Hill/DES/RSA/DH enabled. Lịch sử DH đọc qua alias `/api/dh/history?cipher=dh`, Nginx chuyển tới `/api/history` trên cùng BE đang xử lý `/api/dh/*`. UI hợp nhất nguồn DH với nguồn lịch sử chung/chữ ký bằng cursor và id riêng; Vite và Nginx một-BE cũng hỗ trợ alias này.

Sau cập nhật routing: 39 test history qua, 2/2 browser mock tests qua, lint/typecheck/format và Docker build qua; Nginx syntax và container health qua. Trình duyệt thật ở `http://127.0.0.1:18081` xác nhận thuật toán DH và đủ năm bộ lọc mới hiển thị, alias lịch sử DH trả 200 khi không lọc operation.

Trước cập nhật BE, runtime là `cipher-workbench-be-app:rsa-da77d54`; `cipher=dh&operation=exchange` trả 422. BE source đã có commit `9d22937` mở rộng operation history nhưng chưa chạy trong runtime này. Tại thời điểm kiểm tra FE này, chưa nâng cấp image BE hoặc migrate database. Phần cập nhật sau đó được ghi dưới đây.

### Cập nhật BE và nghiệm thu ngày 2026-10-13

Đã triển khai `cipher-workbench-be-app:dh-history-9d22937` từ source sạch `9d22937682434bc8847ae53449f612716e0ef6b8`, manifest image `sha256:c8233ee9be81006ae0b2f0427060d9314ac1700e7e952b0aca121e68b7ff3be1`. Giữ nguyên volume `cipher-workbench-be_history-data`, env và signing key runtime. Dừng writer trước khi sao lưu; backup ngoài volume và restore rehearsal đã verify bằng `app.history.continuity`. Migration rehearsal và live `sqlite_0003 → sqlite_0004` xác nhận integrity, dữ liệu hai bảng, index và sequence giữ nguyên trước khi khởi động BE. Backup/evidence lưu trong thư mục ignored `backups/dh-history-update-20261013/` với quyền hạn chế. Nginx được reload để cập nhật upstream container mới.

Kết quả chạy lại:

- Health BE: database ok, history enabled; cả `exchange` và `derive_shared_secret` trả 200 qua `/api/dh/history` tại 18081.
- API acceptance: `DH_BACKEND_URL=http://127.0.0.1:18083 npm run test:integration:diffie-hellman` **43/43 passed (4,3 giây)** trên cùng image BE, database riêng trong container cô lập, schema `sqlite_0004`. Container kiểm thử được dọn sau nghiệm thu.
- Browser thật tại `http://127.0.0.1:18081`: desktop 1280px và mobile 375px đều trao đổi khóa thành công, hiển thị bản ghi `exchange` thành công, bộ lọc trả 200 và reload vẫn đọc được lịch sử.
- Smoke RSA qua 18081: ký, kiểm tra chữ ký và lưu private history đều thành công.

API suite ban đầu không kết nối được vì cấu hình container kiểm thử dùng filesystem/key không được BE chấp nhận. Sau khi dùng overlay local và key fixture 64 hex đúng contract, toàn bộ suite qua. Các lỗi đó không nằm ở runtime 18081.

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

### Bộ lọc thao tác theo thuật toán — 2026-10-13

FE image `cipher-workbench-frontend:history-operation-filters-20261013` lọc danh sách thao tác theo thuật toán: bảy hệ mã thông thường chỉ encrypt/decrypt; RSA thêm sign/verify; DH thêm năm thao tác standalone và giữ encrypt/decrypt cho Caesar qua DH. Tất cả hiển thị hợp các thao tác. Đổi thuật toán giữ thao tác hợp lệ, còn thao tác không được hỗ trợ thì reset về Tất cả trước khi tải lịch sử. 49 test history qua, bao gồm ma trận đủ chín thuật toán và chuyển bộ lọc; lint/typecheck/Docker build qua.

Đã triển khai riêng FE lên 18081; kiểm tra trình duyệt thật ở 1280px và 375px xác nhận danh sách thao tác đúng cho cả chín thuật toán, reset thao tác không hợp lệ và giữ thao tác hợp lệ khi đổi thuật toán.
