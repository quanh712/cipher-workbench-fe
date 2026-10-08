# Backend Contract Reference

Frontend tích hợp theo contract chính thức của repo
[`kiendt2312/cipher_workbench-be`](https://github.com/kiendt2312/cipher_workbench-be).

## Phiên bản được ghim

- Contract SQLite hiện hành: checkout BE sibling tại
  `229c69d7c9af8413a780002b266bdb7651e79cb4`, đối chiếu ngày 07/10/2026 với
  [consumer guide](../../cipher-workbench-be/repo_docs/frontend-integration.md),
  [health route](../../cipher-workbench-be/app/api/routes_health.py),
  [history route](../../cipher-workbench-be/app/api/routes_history.py) và
  [config](../../cipher-workbench-be/app/config.py). Runtime history dùng SQLite local
  trên backend; các mốc PostgreSQL dưới đây là lịch sử. Mốc source này không chứng
  minh image trong stack FE đang chạy đã được cập nhật.
- Contract DES: [`31438eb`](https://github.com/kiendt2312/cipher_workbench-be/blob/31438eb49c94cdef570b3ca5afd2c2fff9e73501/repo_docs/frontend-integration.md),
  nhánh `docs/des-fe-guide`, mục 4.7, 8, 9.2; OpenSpec DES hiện hành và implementation
  cùng revision. Xem [DES_SPEC.md](DES_SPEC.md). Bật bằng `VITE_ENABLE_DES=true` sau khi
  build/deploy BE tương thích; PostgreSQL legacy từng cần migration `0003`, còn
  SQLite dùng baseline `sqlite_0001` đã chứa DES. DES demo là cờ riêng,
  không fallback cho API thật.

- Contract Hill: [`4505ef7`](https://github.com/kiendt2312/cipher_workbench-be/blob/4505ef776d51d6657f26552531a9809e436318b9/repo_docs/frontend-integration.md),
  mục A.7, 4.6, 9.1 và các OpenSpec trong `openspec/changes/add-hill-cipher/specs/`.
  Xem [HILL_SPEC.md](HILL_SPEC.md) cho payload, response, Unicode và giới hạn 5 MiB.
- Mốc lịch sử cho health và lịch sử: BE [`main` tại `c314fa8`](https://github.com/kiendt2312/cipher_workbench-be/blob/c314fa87bb87ad42ea10cd4fd96889ca176bfe26/repo_docs/frontend-integration.md),
  mục A và 16–17. `GET /api/health` trả cả `database` lẫn `history`; chỉ đọc lịch sử
  máy chủ nếu `database: "ok"` **và** `history: "enabled"`.
- Nhánh [`feature/add-postgres-persistence` tại `9b75d576`](https://github.com/kiendt2312/cipher_workbench-be/blob/9b75d576f201f9df3c219fdc4f8f70834bd807ff/repo_docs/frontend-integration.md)
  là mốc triển khai PostgreSQL ban đầu, **chưa có** cờ `history` trong health.
- Consumer guide và Backend implementation: [`fb459dd`](https://github.com/kiendt2312/cipher_workbench-be/blob/fb459ddcf35c622250b836f75fb14702b2eb0cf4/repo_docs/frontend-integration.md)
  (`fb459ddcf35c622250b836f75fb14702b2eb0cf4`, cập nhật Playfair ngày 28/09/2026).
- Nguồn có thẩm quyền hiện hành: [OpenSpec trong checkout Backend](../../cipher-workbench-be/openspec/specs).
  `openspec/changes/archive/` chỉ giữ lịch sử quyết định. Các revision Hill/DES
  ở trên là mốc bổ sung cipher; schema SQLite hiện có cả tám cipher, gồm RSA.

Nếu tài liệu FE khác OpenSpec Backend, OpenSpec Backend được ưu tiên và tài liệu FE phải sửa.
Checkout BE được Compose build sử dụng phải đúng revision đã ghim; đổi nhãn image hoặc
`BACKEND_REVISION` không tự cập nhật code trong container.

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

FE nối API RSA của BE `229c69d` qua `src/features/rsa/services/rsaApi.ts`, bật bằng `VITE_ENABLE_RSA=true`. Sinh khóa dùng `/api/rsa/keys`; mỗi tác vụ số/văn bản chọn mã hóa hoặc giải mã riêng qua `/api/rsa/encrypt` hoặc `/api/rsa/decrypt`, dùng khóa sinh hoặc khóa nhập tay tương ứng. Bản mã hiển thị và nhập giải mã dùng mảng JSON chuỗi số. Không tự chạy khi mở workspace hoặc chọn ví dụ. Văn bản dùng `mode=char`. Tất cả operand là chuỗi thập phân; trace lấy từ BE. `P ≥ n` hoặc ký tự có code point ≥ n bị BE từ chối; FE giữ nguyên message và không tính fallback. Xem [RSA_SPEC.md](RSA_SPEC.md) cho mapping và lệnh integration test.

## Lịch sử server trên SQLite

- BE tự ghi metadata cho các POST route cipher được recorder hỗ trợ vào SQLite
  khi có `DATABASE_URL`, kể cả lỗi;
  ghi thất bại không thay đổi response cipher. FE không gọi API ghi lịch sử.
- Hill analyze/random, RSA keygen và DES trace không ghi history. RSA encrypt/decrypt
  dùng history chung và hỗ trợ filter `cipher=rsa`; không có API history riêng cho RSA.
- `GET /api/history` trả `items` và `nextCursor`, lọc bằng `cipher`/`operation`, phân trang
  bằng cursor opaque. `GET /api/health` báo DB `ok`, `disabled` hoặc `unavailable`, cùng
  cờ lịch sử `enabled`/`disabled`. Cờ lịch sử mặc định tắt; khi tắt `/api/history` trả 404
  trước cả bước kiểm tra query. Nếu cấu hình đổi giữa phiên, FE xử lý 404 và bỏ dữ liệu cũ.
- Health giữ envelope `{"success":true,"result":{"app":"ok","database":"ok","history":"enabled"}}`.
  `database=ok/disabled` trả HTTP 200; `unavailable` trả HTTP 503, vẫn có
  `success:true`. `history` không quyết định status HTTP. Health là read probe,
  không bảo đảm lần ghi history kế tiếp thành công.
- History giữ envelope `{"success":true,"result":{"items":[],"nextCursor":null}}`.
  Item có `id`, `createdAt` (UTC), `cipher`, `operation`, `source`, `responseMode`,
  `inputLength`, `outputLength`, `httpStatus`, `succeeded`, `durationMs`.
  `operation`, `responseMode`, `inputLength`, `outputLength` có thể là `null`.
- Query: `limit=1..100` (mặc định `20`), `cipher` trong
  `caesar|vigenere|playfair|affine|columnar|hill|des|rsa`, `operation=encrypt|decrypt`.
  Thứ tự `createdAt DESC, id DESC`; gửi nguyên cursor opaque từ `nextCursor`,
  bỏ cursor khi đổi filter. Trang rỗng và `nextCursor:null` là kết quả hợp lệ.
- History lỗi trả `{"success":false,"message":"..."}`: 404 khi flag tắt,
  422 khi limit/cursor/filter sai, 503 khi không có database hoặc đọc database lỗi.
  Khi flag bật nhưng DB không được cấu hình, health trả `database:disabled` và
  history trả 503 với query hợp lệ. FE giữ nguyên message và xử lý trạng thái lỗi
  riêng với kết quả danh sách rỗng.
- Không lưu input, result, key, file hoặc tên file. Lịch sử chung toàn instance, không có auth,
  detail hay delete; retention mặc định 30 ngày, cấu hình `HISTORY_RETENTION_DAYS`
  từ 1–3650 ngày, purge định kỳ có thể lệch tối đa 6 giờ. Không bật API đọc lịch sử trên
  môi trường public. FE gọi file preview và download hai lần nên có hai bản ghi.
- Với file UTF-8 có BOM, `inputLength` và `outputLength` của metadata đều tính cả BOM ở cả
  preview và download; FE hiển thị số byte BE trả, không tự tính lại. BE `c314fa8` sửa cách
  ghi metadata này, không đổi 15 route cipher hay schema Alembic `0001`.
- Lịch sử trên trình duyệt (nếu bổ sung sau) khác lịch sử server: nó chứa cả input, key và
  result; phải có công tắc lưu/xóa, giới hạn 50 mục và cảnh báo riêng tư. FE hiện chưa lưu loại này.
- [POSTGRES_FE_ROADMAP.md](POSTGRES_FE_ROADMAP.md) và
  [POSTGRES_BE_BRANCH_FINDINGS.md](POSTGRES_BE_BRANCH_FINDINGS.md) ghi scope và
  findings của PostgreSQL trước đây; không dùng làm hướng dẫn SQLite runtime.

## Cấu hình backend SQLite cho lần tích hợp sau

- `DATABASE_URL=sqlite+aiosqlite:////data/cipher-history.sqlite3`: absolute local
  file path, parent directory tồn tại và ghi được. URL PostgreSQL không còn hợp lệ
  với runtime source mới; URL trống tắt storage, cipher vẫn hoạt động.
- Mount cùng persistent volume `/data` cho migrate và backend, quyền UID/GID
  `10001:10001`; root filesystem vẫn có thể `read_only: true`. FE không mount volume.
- Chạy `alembic -c alembic_sqlite.ini upgrade head` trước một app process. App
  không tự tạo database/schema. Không chạy/stamp PostgreSQL `0001`–`0004` lên SQLite.
- `HISTORY_API_ENABLED` mặc định tắt và chỉ kiểm soát API đọc; storage được cấu hình
  vẫn ghi metadata khi flag tắt. Không bật API trên shared/public khi chưa có auth.
- Phạm vi cleanup ngày 08/10/2026 chỉ nằm ở FE. Backend source và image
  giữ nguyên; runtime history đang dùng SQLite. Legacy transfer tooling phía BE
  vẫn thuộc quyền quản lý của BE, FE không sử dụng `LEGACY_DATABASE_URL`.
- Cả Compose mặc định và Compose SQLite đều chạy migration SQLite, mount `/data`
  cho migrate/backend; frontend tiếp tục chỉ gọi HTTP `/api`.
- Xem [checklist cấu hình chung](../../sqlite-integration-config-checklist.md).
  Compose SQLite standalone và hướng dẫn rehearsal ở [SQLITE_COMPOSE.md](SQLITE_COMPOSE.md).
  PostgreSQL local/verify đã được retire sau backup và restore reconciliation.

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
