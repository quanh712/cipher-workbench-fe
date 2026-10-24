# Backend Contract Reference

Frontend tích hợp theo contract chính thức của repo
[`kiendt2312/cipher_workbench-be`](https://github.com/kiendt2312/cipher_workbench-be).

## Contract hiện hành

Đối chiếu source BE `9d22937682434bc8847ae53449f612716e0ef6b8` ngày 24/10/2026.
Authority là [consumer guide Backend](../../cipher-workbench-be/repo_docs/frontend-integration.md),
[OpenSpec Backend](../../cipher-workbench-be/openspec/specs), các route/schema tại cùng revision.
Schema SQLite hiện hành là `sqlite_0004`. Source revision không chứng minh image đang
chạy đã được cập nhật; phải kiểm riêng image và runtime trước khi release.
Các báo cáo có ngày trong `docs/` giữ bằng chứng rollout cũ, không phải contract hiện hành.

## Runtime boundary

- Backend thật chạy tại `http://localhost:8000`.
- FE gọi URL tương đối `/api/...`; Vite proxy `/api` về Backend khi phát triển.
- Production là same-origin; không yêu cầu CORS.
- SQLite chỉ nằm trên backend; frontend không mount hoặc đọc file database. Nếu
  browser gọi backend cross-origin, BE chỉ cho phép exact origins qua
  `CORS_ALLOW_ORIGINS`; không cần đổi CORS khi tiếp tục dùng proxy `/api` same-origin.
- `/docs` và `/openapi.json` dùng để đối chiếu schema. BE có `GET /api/health`;
  không có `GET /health` và không phục vụ UI tĩnh tại `/`.

## Hill

- `key` gửi ma trận không kèm `m`; từ khóa gửi `keyword,m`. Analyze/random trả
  `{success:true,result:HillKeyAnalysis,warnings}`, transform trả thêm `blocks,key,warnings`.
- Lỗi nghiệp vụ `{success:false,message,code,details}` phẳng; giữ nguyên message BE.
- Chỉ cụm ký tự đơn ASCII tham gia khối; chữ Việt NFC/NFD giữ nguyên hoặc BE bỏ dấu theo options.
- FE đọc `.txt` UTF-8 fatal, kiểm 5.242.880 raw bytes rồi gửi JSON text; không có file route.
  Text BE cũng giới hạn 5.242.880 byte UTF-8 trước chuẩn hóa. Copy/download từ result đầy đủ.
- Analyze/random không ghi history; transform ghi `cipher=hill,source=text`, kể cả nguồn file FE.
  PostgreSQL legacy từng cần migration Hill `0002`; SQLite dùng baseline
  `sqlite_0001` đã chứa Hill. Đổi image tag không tự cập nhật schema.
- Checkout sibling đã cập nhật lên `main` tại `80b61b6` ngày 01/10/2026, có cả Hill/DES.
  Stack local cổng 18081 build lại với `VITE_ENABLE_HILL=true` và `VITE_ENABLE_DES=true`;
  các môi trường khác cần build lại Backend/Frontend riêng, không tự nhận cập nhật này.

## RSA

Bật bằng `VITE_ENABLE_RSA=true` sau khi kiểm chứng Backend tương thích.
Xem [RSA_SPEC.md](RSA_SPEC.md) và [contract RSA BE](../../cipher-workbench-be/repo_docs/rsa-frontend-contract.md).

- `POST /api/rsa/keys`: `{p,q,e}`; `POST /api/rsa/keys/random`: `{bits}`,
  với `bits` là JSON integer `16|32|64|128`. Giữ số lớn dưới dạng chuỗi decimal.
- `POST /api/rsa/encrypt` và `/api/rsa/decrypt`: số hoặc text `char|block`.
  Block decrypt phải giữ nguyên `cipher`, `mode`, `originalUtf8ByteLength` của package.
  `traceBlockIndex` chọn khối phân tích; không tính kết quả hoặc trace ở FE.
- Mã hóa file gửi multipart tới `/api/rsa/encrypt` gồm `file,e,n,mode` và
  `traceBlockIndex` nếu chọn. Không có `/api/rsa/file`; decrypt luôn gửi JSON.
  File `.txt` UTF-8 tối đa 1.000.000 raw byte, text tối đa 10.000 code point.
- Chữ ký số nguyên: `/api/rsa/sign/raw`, `/api/rsa/verify/raw`.
  Chữ ký chuẩn: `/api/rsa/sign`, `/api/rsa/verify`, RSA-PSS/SHA-256, PEM và
  chữ ký base64. Text dùng JSON với `source:"text"`; file dùng multipart.
  `valid:false` là kết quả kiểm tra hợp lệ về giao thức, không phải lỗi dịch vụ.

## Lịch sử chung theo hồ sơ trình duyệt

- Mọi request xử lý và lịch sử phải giữ cookie `cw_history_profile`. FE dùng
  same-origin và credentials; proxy không xóa Cookie hoặc Set-Cookie.
- Chỉ có một nguồn `GET /api/history`; không có `/api/rsa/history` hay
  `/api/dh/history`. Không gộp nhiều lần cùng endpoint để tránh lặp bản ghi.
- List trả `{success:true,result:{items,nextCursor}}`; `limit=1..100` (mặc định 20),
  filter `cipher` gồm chín thuật toán, `operation` gồm encrypt/decrypt, sign/verify
  và năm thao tác DH standalone. Giữ nguyên cursor opaque, bỏ cursor khi đổi filter.
- Item có metadata cùng `valid`, `processingState`, `contentAvailable`, `logicalSize`.
  `GET /api/history/{id}` trả thêm `payload`; khóa riêng và trace không được lưu.
  `GET /api/history/{id}/content` chỉ tải khi `contentAvailable=true`.
- `DELETE /api/history/{id}` xóa một bản ghi; `DELETE /api/history` xóa tất cả
  của hồ sơ hiện tại, không chỉ những mục đang lọc trên UI. UI yêu cầu xác nhận.
- Cipher/DH metadata và chữ ký RSA dùng cùng owner, thứ tự `createdAt DESC,id DESC`.
  Chữ ký kiểm tra sai vẫn có `succeeded:true`, `valid:false` khi request thành công.
- TTL cố định 5 giờ từ lúc tạo, đọc không gia hạn; hạn mức 50 MiB/hồ sơ,
  500 MiB/toàn hệ thống có thể loại bản ghi sớm. Không có tài khoản.
- Health giữ envelope `{success:true,result:{app,database,history}}`.
  History flag tắt trả 404; DB không sẵn sàng trả 503; query sai trả 422.
  Bản ghi thiếu, hết hạn hoặc thuộc hồ sơ khác trả 404 khi xem/xóa/tải.

## Cấu hình Backend SQLite

- `DATABASE_URL=sqlite+aiosqlite:////data/cipher-history.sqlite3`: local absolute path,
  migrate/backend cùng persistent volume `/data`, UID/GID `10001:10001`.
- Chạy `alembic -c alembic_sqlite.ini upgrade head` trước app process; head hiện tại
  `sqlite_0004`. Không chạy/stamp migration PostgreSQL lên SQLite.
- Có database thì bắt buộc `HISTORY_PROFILE_SIGNING_KEY`: đúng 64 ký tự hex ngẫu nhiên.
  Giữ nguyên secret qua restart/update; thay key làm cookie cũ mất hiệu lực.
- `HISTORY_COOKIE_SECURE=true` cho HTTPS; chỉ dùng `false` khi phát triển HTTP local.
  Không đổi secret hay cookie settings của stack đang chạy chỉ để cập nhật FE.
- `HISTORY_API_ENABLED` mặc định tắt; bật có chủ đích khi triển khai UI lịch sử.
  API tắt không tắt ghi metadata khi storage hoạt động. `HISTORY_RETENTION_DAYS`
  thuộc runtime cũ; không dùng để thay TTL 5 giờ của private history hiện hành.
- Same-origin không cần CORS. Nếu gọi cross-origin, dùng exact `CORS_ALLOW_ORIGINS`
  và credentials theo Backend; ưu tiên proxy same-origin hiện có.
- Xem [SQLite operation](SQLITE_COMPOSE.md), [deployment](DEPLOYMENT.md).

## Handoff lịch sử cho bên Backend: đồng bộ runtime Columnar (24/09/2026)

Đây là việc **đồng bộ checkout và tiến trình BE đang chạy**, không phải yêu cầu thay đổi thuật toán
hoặc mở contract mới. Tại lần kiểm tra ngày 24/09/2026, BE `main` trên GitHub đã ở
`c0a1927b397926dbf89d62a4b0270d4ec0fb71d7`, nhưng clone sibling mặc định
`../cipher-workbench-be` trên máy FE vẫn ở `c55278f207e84811cf26e3a748df612cd6a9915e`
(Affine-only). `git status` báo sạch với `origin/main` **không chứng minh đã cập nhật** nếu chưa
`fetch`; remote-tracking ref cục bộ có thể cũ. FE đã gọi API Columnar thật, nên runtime BE cũ
sẽ trả `404` cho `/api/columnar/*`.

Các bước bên BE thực hiện trên đúng checkout được server/Docker build sử dụng:

```bash
cd /home/quanh-tran/Documents/Cipher-workbench/cipher-workbench-be
git status --short
git fetch origin main
git pull --ff-only origin main
git rev-parse HEAD
```

Nếu worktree có thay đổi, dừng và xử lý chúng trước; không dùng `reset --hard` hoặc force pull.
Sau khi checkout chứa commit đã ghim, **build lại và restart BE** theo cách vận hành hiện tại.
Compose runtime phía FE dùng `.env.sqlite` và image digest đã pin;
`deploy/sqlite-stack.sh` giữ đúng project/volume hiện hành. Nhãn revision không
tự cập nhật code hoặc image. Chỉ cập nhật BE image khi phạm vi đã được yêu cầu;
`.env.deploy` chỉ dùng cho proxy host/HTTPS.

Kiểm tra runtime mới tại cổng BE `8000` (hoặc thay bằng `8080` nếu đi qua proxy FE):

```bash
curl --fail --show-error --silent \
  -X POST http://127.0.0.1:8000/api/columnar/encrypt \
  -H 'Content-Type: application/json' \
  -d '{"text":"ABCDE","key":"3 1 4 2"}'
```

Kết quả chính xác phải là `{"success":true,"result":"BDAEC"}`. BE đang chạy cũng phải công bố
`/api/columnar/encrypt`, `/api/columnar/decrypt` và `/api/columnar/file` trong `/openapi.json`.
Nếu checkout đúng mà cổng `8000` vẫn trả `404`, kiểm tra process/container đang chạy có thật sự
được rebuild từ checkout ấy và proxy `/api` có trỏ tới đúng container không. FE đã chạy 16/16
browser integration tests với BE ở commit được ghim, gồm Unicode round-trip và file có BOM.

## Điểm tích hợp phải giữ

- Caesar, Vigenère, Affine, Columnar và Playfair encrypt: success JSON có `success,result`.
  Playfair decrypt text/file preview có thêm `padding:{count,positions,filtered}`.
  Error của năm cipher này dùng `success,message`.
- FE kiểm tra HTTP status và body, hiển thị nguyên văn `message` hợp lệ từ Backend.
- Caesar text gửi key dưới dạng JSON integer thật sự. Vigenère và Playfair gửi key string.
- Affine text gửi đúng `text`, `a`, `b`; hai khóa là JSON integer token không mất precision. File
  Affine gửi đúng `file`, `a`, `b`, `action`, `response_mode`, không gửi `key`.
- Columnar text gửi chính xác `text`, `key` (cả hai string); file gửi `file`, `key`, `action`,
  `response_mode`. Khóa truyền nguyên văn; BE tự nhận dạng hoán vị số hoặc keyword. Không gửi
  `key_type`, `pad`, field thừa hoặc field trùng. BE chỉ trim khoảng trắng ASCII (`SP`, tab, CR,
  LF, FF, VT) ở hai đầu khóa, giới hạn 2048 Unicode code point sau trim và 2–256 cột; hint FE
  phải nói rõ quy tắc trim và giới hạn cột, không tự trim hoặc sửa khóa trước khi gửi.
- Khóa file Affine là signed-decimal string tối đa 32 ký tự sau khi Backend trim; FE gửi nguyên raw
  control value. Backend từ chối field thừa/trùng; thứ tự kiểm tra là `file`, `a`, `b`, `action`,
  `response_mode`.
- Vigenère key phải khớp `[A-Za-z]+` và không được trim/sửa trước khi gửi.
- Playfair normalize có mất dữ liệu; decrypt trả bản thô `result` giữ mọi filler và
  `padding:{count,positions,filtered}` do BE nhận dạng theo mẫu digraph. `positions` bắt đầu từ 0
  trong bản thô. FE mặc định hiển thị `padding.filtered`, tắt lọc để giữ nguyên `result`;
  copy/download text theo lựa chọn này. File preview trả bản thô và padding; download gửi
  `strip_padding="true"|"false"` theo lựa chọn (BE mặc định false). Bộ lọc có thể bỏ nhầm X/Q thật.
  Phân tích dùng bản thô để giữ đủ cặp chữ; FE không tính bộ lọc thay BE.
  Chi tiết và ví dụ ở [PLAYFAIR_VIGENERE_SPEC.md](PLAYFAIR_VIGENERE_SPEC.md#4-playfair).
- Columnar giữ nguyên Unicode code point, kể cả whitespace/CRLF/emoji; không chuẩn hóa hoặc đệm.
  File UTF-8 có BOM đầu vào: preview bỏ BOM logic, attachment giữ BOM. File BOM-only hợp lệ.
- File năm cipher cũ giới hạn chính xác 5 MiB; preview dùng `response_mode=content`.
- Download file năm cipher cũ là request thứ hai với `response_mode=file`, dùng attachment của Backend.
- Result server là nguồn có thẩm quyền; không có runtime mock hoặc local cipher result.

Không sao chép lại ma trận lỗi và toàn bộ scenario ở đây. Khi cần chi tiết, đọc handoff và
OpenSpec đã ghim ở trên.
