# Cipher Workbench Frontend

Giao diện web để mã hóa, giải mã và phân tích kết quả bằng Caesar, Vigenère, Playfair, Affine,
Hệ mã hàng, Hill, DES, RSA và Diffie–Hellman. Dự án dùng React, TypeScript và Vite; kết quả xử lý lấy từ Backend thật.
Hill, DES và RSA được bật bằng cờ cấu hình khi Backend tương ứng đã sẵn sàng.
RSA đã nối API BE `229c69d`: sinh/nhập khóa, mã hóa hoặc giải mã riêng số/văn bản và trace. Fake gateway chỉ dùng trong test.

## Mốc release đã kiểm thử — 08/10/2026

Báo cáo release ghi nhận FE tại <http://127.0.0.1:18081> từ commit `175219d`, bật đủ tám thuật toán,
kết nối API thật và dùng lịch sử SQLite. Mốc release này đã đạt **318 unit/component test**,
**74 kịch bản regression production** và **6 kiểm tra backup/restore/retention**.
Thông tin image, phạm vi thay đổi và rollback nằm trong [báo cáo release](docs/FE_RELEASE_20261008.md).
Backend của mốc release ghim revision `229c69d`; cập nhật FE bằng wrapper bên dưới giữ nguyên Backend.
Các thay đổi Diffie–Hellman sau mốc này được kiểm thử riêng trong [báo cáo UI DH](docs/DIFFIE_HELLMAN_UI_QA.md); số kiểm thử release trên không mô tả toàn bộ trạng thái hiện tại.

## Cập nhật giao diện — 10/10/2026

- Sao chép/dán dùng popup chung như Caesar, có nút đóng và tự tắt sau 2,5 giây; áp dụng cả kết quả thiết lập bí mật chung DH và RSA. DES có thông báo khi dán thành công.
- RSA có tab **Chữ ký số** dùng chung phần khóa; tab này dùng ví dụ cố định có nhãn **Dữ liệu minh họa** trong lúc chờ contract Backend, không gọi API ký/kiểm tra và không ghi lịch sử.
- Hill hiển thị popup “Mã hóa thành công.” hoặc “Giải mã thành công.” sau khi Backend xử lý thành công.
- RSA khối số và văn bản dùng thanh trạng thái ở đáy ô đầu vào/kết quả: chưa có dữ liệu, hợp lệ sơ bộ, đang xử lý, thất bại hoặc thành công kèm số khối. Kiểm tra sơ bộ số/JSON không thay thế xác thực của Backend.
- Caesar bằng khóa chung nhận khóa từ thao tác tính bí mật chung thành công của bên A/B đang chọn hoặc từ kết quả trao đổi DH. Đổi tham số sẽ vô hiệu hóa kết quả cũ.
- Bảng trace trong phân tích DH dùng cùng kiểu bảng desktop và thẻ mobile như phần thực hành. Hai dòng cuối phân tích Caesar bằng khóa chung được căn lề thống nhất.
- Phần thiết lập DH đã bỏ hai dòng hướng dẫn “Mô phỏng học tập…” và “Nhập tham số hoặc bấm Tạo ví dụ…”. Các cảnh báo trong phản hồi Backend vẫn được hiển thị.

## Trạng thái tính năng

| Thuật toán     | Văn bản                                | File `.txt`           | Trạng thái                        |
| -------------- | -------------------------------------- | --------------------- | --------------------------------- |
| Caesar         | Mã hóa / giải mã                       | Preview / tải kết quả | Đang sử dụng                      |
| Vigenère       | Mã hóa / giải mã                       | Preview / tải kết quả | Đang sử dụng                      |
| Playfair       | Mã hóa / giải mã                       | Preview / tải kết quả | Đang sử dụng                      |
| Affine         | Mã hóa / giải mã                       | Preview / tải kết quả | Đang sử dụng                      |
| Hệ mã hàng     | Mã hóa / giải mã                       | Preview / tải kết quả | Đang sử dụng                      |
| Hill           | Mã hóa / giải mã                       | Preview / tải kết quả | `VITE_ENABLE_HILL=true`           |
| DES            | Text/HEX, ECB/CBC                      | Preview / tải kết quả | `VITE_ENABLE_DES=true`            |
| RSA minh họa   | Mã hóa / giải mã số, văn bản           | Chưa hỗ trợ           | `VITE_ENABLE_RSA=true`            |
| Diffie–Hellman | Trao đổi khóa / Caesar bằng khóa chung | Caesar text/file      | `VITE_ENABLE_DIFFIE_HELLMAN=true` |

Affine dùng hai khóa nguyên `a`, `b` (được thêm từ BE revision `c55278f`). Chi tiết hành vi
giao diện nằm trong [`docs/AFFINE_SPEC.md`](docs/AFFINE_SPEC.md). Hệ mã hàng dùng contract BE
`c0a1927`; quy tắc Unicode, khóa và file nằm trong [`docs/COLUMNAR_SPEC.md`](docs/COLUMNAR_SPEC.md).

## Chức năng chính

- Chuyển đổi giữa tám thuật toán trong cùng một workspace khi đã bật Hill, DES và RSA.
- Diffie–Hellman dùng contract BE `/api/dh/*` sau cờ `VITE_ENABLE_DIFFIE_HELLMAN=true` (mặc định false, cả Docker build). Entry đã nối HTTP adapter; bật bằng `VITE_ENABLE_DIFFIE_HELLMAN=true npm run dev`. Có exchange A/B, trace trái→phải, kiểm/sinh tham số, tạo khóa, khóa chung và Caesar text/file. Xem [hướng dẫn DH](src/features/diffieHellman/README.md).
- Chạy `npm run dev:rsa` để dùng RSA với API thật qua `BACKEND_DEV_URL`; build production bằng `VITE_ENABLE_RSA=true npm run build`.
- `RsaGateway` là ranh giới cho sinh/nhập khóa, mã hóa hoặc giải mã riêng số/văn bản và trace; fake gateway nằm trong thư mục test, không được App import.
- Chạy `npm run test:e2e:rsa` để kiểm tra UI RSA với fixture test riêng trên desktop, 375 px và light/dark theme. `npm run test:e2e:rsa:integration` kiểm Backend thật trên stack SQLite integration cổng 18082; không build hoặc cập nhật BE.
- Nghiệm thu DH: `DH_BACKEND_URL=http://127.0.0.1:18084 npm run test:integration:diffie-hellman` với BE DH và DB integration riêng, history bật. Đã pass 43/43 ca với BE thật; năm endpoint tham số/khóa không ghi history, Caesar chỉ ghi metadata. Xem [bằng chứng nghiệm thu](docs/DIFFIE_HELLMAN_BE_INTEGRATION.md).
- Mã hóa hoặc giải mã nội dung nhập trực tiếp và file `.txt`.
- Preview kết quả, sao chép, dán và tải file kết quả.
- Tab **Phân tích** dùng bố cục thống nhất, giữ ô kết quả bằng kích thước ô đầu vào và cuộn bên trong.
- Trước khi xử lý, tab **Phân tích** hiển thị ghi chú chung trên nền giống tab File .txt.
- Bộ lọc ký tự đệm Playfair/Hill nằm ở đáy ô kết quả; bản thô và bản đã lọc nằm trong tab **Phân tích**.
- DES hỗ trợ ECB/CBC, IV và phân tích các vòng xử lý từ Backend.
- Giao diện responsive, hỗ trợ bàn phím, screen reader và light/dark theme có ghi nhớ.
- Giữ Backend làm nguồn dữ liệu có thẩm quyền cho mọi kết quả runtime.
- Xem lịch sử metadata của các request cipher khi SQLite và quyền đọc lịch sử đều được bật
  ở Backend; không lưu input hoặc khóa trong lịch sử của trình duyệt.

## Kiến trúc kết nối

Khi phát triển:

```text
Browser -> Vite :5173 -> /api proxy -> FastAPI Backend :8000
```

Khi chạy bằng Docker Compose:

```text
Browser -> localhost :18081 -> Frontend/Nginx :8080 -> Backend :8000 -> SQLite /data/cipher-history.sqlite3
```

Frontend chỉ gọi các URL tương đối `/api/...`. Vì vậy code runtime không ghi cứng địa chỉ Backend và
không cần cấu hình CORS trong mô hình triển khai same-origin.

## Yêu cầu môi trường

- Node.js và npm.
- Backend chính thức: [`kiendt2312/cipher_workbench-be`](https://github.com/kiendt2312/cipher_workbench-be).
- Docker khi chạy browser E2E với Backend tích hợp hoặc chạy production stack cục bộ.

Theo cấu hình mặc định, repo Backend nằm cùng cấp với repo này:

```text
Cipher-workbench/
├── cipher-workbench-fe/
└── cipher-workbench-be/
```

Có thể đặt Backend ở vị trí khác thông qua `BACKEND_CONTEXT` khi chạy integration test hoặc Docker
Compose.

## Chạy ứng dụng để phát triển

### 1. Khởi động Backend

Khởi động Backend thật tại `http://localhost:8000` theo hướng dẫn của repo Backend. Có thể kiểm tra
schema đang chạy tại:

- <http://localhost:8000/docs>
- <http://localhost:8000/openapi.json>

Để dùng Hệ mã hàng, checkout Backend phải chứa revision `c0a1927` hoặc mới hơn; bản Backend cũ
chỉ có Affine sẽ trả `404` cho `/api/columnar/*`. Repo Backend sibling trên máy cần được cập nhật
riêng trước khi chạy stack cục bộ.

Để nghiệm thu lịch sử máy chủ theo contract mới nhất đã đối chiếu, dùng Backend SQLite,
migration `alembic -c alembic_sqlite.ini upgrade head` và `HISTORY_API_ENABLED=true` **chỉ ở môi trường dev/nội bộ**. FE chỉ gọi
`/api/history` khi `/api/health` báo đồng thời `database: "ok"` và `history: "enabled"`;
BE cũ thiếu trường `history` sẽ không tải dữ liệu lịch sử. Không bật API lịch sử trên
Funnel/public vì endpoint này chưa có xác thực. Nếu BE Compose chạy trên host `8080`, khởi động
FE bằng `BACKEND_DEV_URL=http://localhost:8080 npm run dev`. BE không phục vụ UI ở `/`;
dùng `/docs` để thử API.
Thẻ **Lịch sử thao tác** chỉ xuất hiện khi health báo đồng thời hai trạng thái cho phép.

### 2. Cài dependency và chạy Frontend

```bash
npm install
npm run dev
```

Để bật đủ tám thuật toán với Backend có đủ endpoint:

```bash
VITE_ENABLE_HILL=true VITE_ENABLE_DES=true VITE_ENABLE_RSA=true npm run dev
```

Mở <http://localhost:5173>. Vite chuyển tiếp `/api` tới `BACKEND_DEV_URL`
từ shell hoặc file `.env.local`; mặc định là `http://127.0.0.1:8000`.
Nếu dùng stack local đang chạy ở `18081`, đặt trong `.env.local`:

```dotenv
BACKEND_DEV_URL=http://127.0.0.1:18081
```

Restart Vite sau khi đổi file env. Stack SQLite thử riêng dùng cổng `18082` khi
đã khởi động. `ECONNREFUSED` tại `8000` nghĩa là target proxy chưa có backend lắng nghe;
chọn đúng cổng đang phục vụ `/api/health`.

Nếu Backend dev chạy ở địa chỉ khác, truyền target khi khởi động Vite:

```bash
BACKEND_DEV_URL=http://127.0.0.1:9000 npm run dev
```

Thẻ **Hệ mã hàng** xuất hiện trong selector ở cả dev và production. Mã hóa, giải mã, preview file
và tải attachment đều gọi Backend qua `/api/columnar/*`. **Tạo ví dụ** chỉ điền đầu vào/khóa, không
gửi request cho đến khi bấm Mã hóa.

### 3. Sử dụng workspace

1. Chọn thuật toán và chế độ mã hóa hoặc giải mã.
2. Chọn nguồn đầu vào là văn bản hoặc file `.txt`.
3. Nhập khóa theo yêu cầu của thuật toán rồi gửi xử lý.
4. Xem phân tích, sao chép kết quả hoặc tải file kết quả.

Với Playfair, chuẩn hóa đầu vào có thể làm mất định dạng và gộp J/I. Khi giải mã Playfair hoặc
Hill, FE dùng thông tin `padding` do Backend trả về để hiển thị bản đã lọc. Tắt **Tự động lọc ký
tự đệm** để giữ bản thô; mở **Xem bản thô và bản đã lọc** trong tab **Phân tích** để đối chiếu.
Chữ thật trùng mẫu đệm có thể bị lọc nhầm, và kết quả không khôi phục nguyên văn đầu vào.

Hill hỗ trợ khóa ma trận cấp 2–4 hoặc từ khóa, kiểm tra khóa và các khối kết quả; chi tiết ở
[spec Hill](docs/HILL_SPEC.md). DES hỗ trợ Text/HEX, ECB/CBC và IV; khi dùng CBC, giữ IV cùng
bản mã để giải mã đúng. Chi tiết ở [spec DES](docs/DES_SPEC.md).

## Các lệnh thường dùng

| Lệnh                           | Mục đích                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| `npm run dev`                  | Chạy Vite dev server tại cổng `5173`                             |
| `npm run build`                | Type-check và tạo production build trong `dist/`                 |
| `npm run preview`              | Preview production build bằng Vite                               |
| `npm run typecheck`            | Kiểm tra TypeScript                                              |
| `npm run lint`                 | Chạy ESLint                                                      |
| `npm run format`               | Format toàn bộ repo bằng Prettier                                |
| `npm run format:check`         | Kiểm tra format mà không sửa file                                |
| `npm test`                     | Chạy unit/component test một lần                                 |
| `npm run test:watch`           | Chạy Vitest ở watch mode                                         |
| `npm run test:e2e`             | E2E mặc định với Backend thật; Hill/DES/RSA có bộ riêng          |
| `npm run test:e2e:integration` | Chạy riêng bộ kiểm tra contract tích hợp Backend                 |
| `npm run test:e2e:production`  | Regression 8 cipher và history trên production `127.0.0.1:18081` |
| `npm run check`                | Format check, lint, type-check, unit test và build               |
| `npm run check:all`            | Chạy `check` rồi chạy E2E mặc định                               |

## Kiểm thử

### DES — API thật và demo

DES hỗ trợ Text/HEX, ECB/CBC với IV, file `.txt` UTF-8 tối đa 5 MiB, warnings và tải file
chính thức từ Backend. Contract ghim tại BE `31438eb`, chi tiết ở [spec DES](docs/DES_SPEC.md).

```bash
VITE_ENABLE_HILL=true VITE_ENABLE_DES=true npm run dev
BACKEND_CONTEXT=/path/to/backend-at-31438eb npm run test:e2e:des:integration
```

BE phải có DES trước khi bật cờ FE; checkout sibling cũ không tự cập nhật. SQLite cần
baseline `sqlite_0001`. Docker/Compose nhận build arg `VITE_ENABLE_DES` (mặc định false).

Demo độc lập vẫn dùng `VITE_ENABLE_DES_DEMO=true npm run dev` và `npm run test:e2e:des`.
Demo có nhãn mô phỏng, dùng fixture cố định và không gọi API. Nếu bật cả hai cờ, API thật
được ưu tiên; không dùng demo làm fallback khi API lỗi. Integration chạy desktop/375 px trên
Vite cổng 4178; bộ demo dùng 4176/4177.

### Kiểm tra trước khi tạo commit

```bash
npm run check
```

Lệnh này không chạy browser E2E. Khi thay đổi luồng người dùng hoặc tích hợp API, chạy thêm:

```bash
npm run test:e2e
```

`test:e2e` tự build và khởi động Backend sibling bằng Docker tại cổng riêng `18000`, sau đó chạy
Playwright trên Desktop Chrome và Pixel 7. Cổng riêng giúp test không vô tình dùng service dev đang
chạy tại `8000`.

Để chỉ chạy scenario xác nhận contract Backend:

```bash
npm run test:e2e:integration
```

Có thể tùy chỉnh vị trí Backend và cổng integration:

```bash
BACKEND_CONTEXT=../path-to-backend BACKEND_INTEGRATION_PORT=18001 npm run test:e2e
```

Script integration sẽ dọn container Backend khi Playwright kết thúc.

Regression production cần stack đang chạy với Hill/DES/RSA đã bật; không build hoặc
khởi động lại BE. Bộ kiểm tra gồm 74 kịch bản: năm cipher cũ và history trên desktop,
Hill/DES/RSA trên desktop và 375 px. Để yêu cầu history bật và kiểm stack integration:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18082 REQUIRE_SERVER_HISTORY=1 npm run test:e2e:production
```

## Chạy production stack cục bộ

Stack hiện hành dùng project `cipher-workbench-sqlite`, volume
`cipher-workbench-sqlite_history-data` và `.env.sqlite`. `docker-compose.yml` là
symlink tới `docker-compose.sqlite.yml`, nên cả hai dùng cùng một cấu hình.

Chỉ tạo `.env.sqlite` từ `.env.sqlite.example` khi cài mới; giữ env hiện tại khi
cập nhật. Image FE/BE được pin, không tự build hoặc đổi Backend.

```bash
./deploy/sqlite-stack.sh prepare-backups
./deploy/sqlite-stack.sh config --quiet
./deploy/sqlite-stack.sh up
./deploy/sqlite-stack.sh ps
./deploy/smoke-test.sh http://127.0.0.1:18081
```

Backup chạy mỗi giờ, giữ 7 ngày tại `backups/sqlite/local/` trên host, ngoài
volume DB. Mỗi snapshot được restore thử và đối soát trước khi retention dọn
snapshot hết hạn. Xem [backup SQLite](docs/SQLITE_COMPOSE.md#backup-tự-động).

Khi cập nhật image FE đã ghim trong `.env.sqlite`, chỉ thay container Frontend:

```bash
./deploy/sqlite-stack.sh up --no-deps frontend
```

Xem [cấu hình SQLite](docs/SQLITE_COMPOSE.md) để chuẩn bị image và env cho máy mới.

Ứng dụng bind <http://127.0.0.1:18081>; Nginx trong container dùng `8080`.
Stack integration dùng `./deploy/sqlite-stack.sh --integration ...`, cổng `18082`
và volume/backup riêng. `.env.deploy` chỉ dùng cho Nginx host/HTTPS, không dùng
để khởi động Compose. VPS/HTTPS xem [deployment](docs/DEPLOYMENT.md).

### Bản local 18081 với Backend DH riêng

Bản local ngày 10/10 dùng override để chuyển riêng `/api/dh/*` tới container Backend
`cipher-workbench-be-app-1:8000`. Các API khác vẫn dùng Backend SQLite hiện hành.
Cần có network Docker `cipher-workbench-be_default` và container BE DH đang chạy.

```bash
docker build --build-arg VITE_ENABLE_HILL=true --build-arg VITE_ENABLE_DES=true --build-arg VITE_ENABLE_RSA=true --build-arg VITE_ENABLE_DIFFIE_HELLMAN=true --build-arg FRONTEND_REVISION=local-dh-ui-20261010 -t cipher-workbench-frontend:local-dh-ui-20261010 .
docker compose --env-file .env.sqlite -f docker-compose.yml -f deploy/docker-compose.18081-dh.yml up -d --no-deps frontend
```

Override này dành cho máy local; không thay đổi image BE hay volume lịch sử.

## Cấu trúc dự án

```text
src/
├── app/                 # App shell, composition và runtime wiring
├── features/
│   ├── caesar/          # Caesar workspace
│   ├── vigenere/        # Vigenère workspace
│   ├── playfair/        # Playfair workspace
│   ├── affine/          # Affine workspace và API adapter
│   ├── columnar/        # Hệ mã hàng, validation, Phân tích và API adapter
│   ├── hill/            # Khóa ma trận, phân tích khối và API Hill
│   ├── des/             # ECB/CBC, IV, trace DES và API adapter
│   ├── diffieHellman/   # Trao đổi khóa, thực hành DH và Caesar bằng khóa chung
│   └── rsa/             # Sinh/nhập khóa, mã hóa/giải mã số và văn bản, trace RSA
├── shared/              # UI, hook, service và utility dùng chung
└── test/                # Thiết lập và helper dùng trong test
e2e/                     # Playwright scenarios
docs/                    # Spec, Backend contract và tài liệu deploy
scripts/                 # Script phục vụ integration/deployment
deploy/ và nginx/        # Cấu hình reverse proxy và hạ tầng container
```

Mỗi cipher giữ component, hook, type, utility và service boundary trong feature riêng. `src/app/`
chịu trách nhiệm ghép các feature đã sẵn sàng vào ứng dụng.

## Quy tắc tích hợp Backend

Các điểm quan trọng khi sửa luồng API:

- Contract chính thức được ghim tại [`docs/BACKEND_CONTRACT.md`](docs/BACKEND_CONTRACT.md).
- Năm cipher cổ điển dùng success response có `success`, `result`; Playfair giải mã thêm
  `padding`. Hill/DES/RSA có DTO riêng được mô tả trong contract; lỗi cipher có `success`, `message`.
- FE phải kiểm tra cả HTTP status và response body, đồng thời giữ nguyên thông báo lỗi hợp lệ từ
  Backend.
- Giới hạn file là đúng `5 MiB`.
- Với các endpoint file multipart, preview dùng `response_mode=content`; download dùng
  `response_mode=file`. Hill đọc file UTF-8 rồi gửi nội dung qua text API.
- Affine text gửi `a` và `b` dưới dạng JSON integer token; Affine file gửi hai field multipart
  `a`/`b` nguyên trạng và giới hạn mỗi khóa tối đa 32 ký tự sau trim.
- Hệ mã hàng gửi nguyên `text` và khóa string, không chuẩn hóa hoặc thêm padding; file dùng đúng
  `file,key,action,response_mode`. Phân tích chỉ là minh họa, không tạo result.
- Không thay kết quả lỗi API bằng kết quả cipher tính cục bộ.

Khi tài liệu FE khác completed OpenSpec hoặc consumer guide đã ghim của Backend, tài liệu Backend
được ưu tiên và tài liệu FE phải được cập nhật.

## Tài liệu liên quan

| Tài liệu                                                           | Nội dung                                   |
| ------------------------------------------------------------------ | ------------------------------------------ |
| [`docs/BACKEND_CONTRACT.md`](docs/BACKEND_CONTRACT.md)             | Contract và revision Backend có thẩm quyền |
| [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)                     | Spec nền tảng của Caesar Week 1            |
| [`docs/PLAYFAIR_VIGENERE_SPEC.md`](docs/PLAYFAIR_VIGENERE_SPEC.md) | Phạm vi mở rộng Playfair và Vigenère       |
| [`docs/AFFINE_SPEC.md`](docs/AFFINE_SPEC.md)                       | Spec FE của Affine                         |
| [`docs/HILL_SPEC.md`](docs/HILL_SPEC.md)                           | Khóa ma trận và tích hợp Hill              |
| [`docs/DES_SPEC.md`](docs/DES_SPEC.md)                             | ECB/CBC, IV và tích hợp DES                |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)                         | Hướng dẫn production deployment            |
| [`docs/RSA_SPEC.md`](docs/RSA_SPEC.md)                             | Sinh/nhập khóa, API và giao diện RSA       |
| [`docs/SQLITE_COMPOSE.md`](docs/SQLITE_COMPOSE.md)                 | Runtime SQLite, image pin và backup        |
| [`docs/FE_RELEASE_20261008.md`](docs/FE_RELEASE_20261008.md)       | Bản FE đã kiểm thử và rollback             |
| [`AGENTS.md`](AGENTS.md)                                           | Quy ước làm việc dành cho coding agent     |

## Giới hạn hiện tại

- Lịch sử chỉ có metadata chung toàn instance; chưa có tài khoản hay xem lại nội dung cũ.
- Chưa hỗ trợ brute-force, tự động tìm khóa hoặc alphabet tùy chỉnh.
