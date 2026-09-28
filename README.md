# Cipher Workbench Frontend

Giao diện web dùng để mã hóa và giải mã bằng các mật mã cổ điển. Dự án được xây dựng với React,
TypeScript và Vite. Cả năm thuật toán lấy kết quả từ Backend thật, không dùng thuật toán chạy cục
bộ làm phương án dự phòng.

## Trạng thái tính năng

| Thuật toán | Văn bản          | File `.txt`           | Trạng thái   |
| ---------- | ---------------- | --------------------- | ------------ |
| Caesar     | Mã hóa / giải mã | Preview / tải kết quả | Đang sử dụng |
| Vigenère   | Mã hóa / giải mã | Preview / tải kết quả | Đang sử dụng |
| Playfair   | Mã hóa / giải mã | Preview / tải kết quả | Đang sử dụng |
| Affine     | Mã hóa / giải mã | Preview / tải kết quả | Đang sử dụng |
| Hệ mã hàng | Mã hóa / giải mã | Preview / tải kết quả | Đang sử dụng |

Affine dùng hai khóa nguyên `a`, `b` (được thêm từ BE revision `c55278f`). Chi tiết hành vi
giao diện nằm trong [`docs/AFFINE_SPEC.md`](docs/AFFINE_SPEC.md). Hệ mã hàng dùng contract BE
`c0a1927`; quy tắc Unicode, khóa và file nằm trong [`docs/COLUMNAR_SPEC.md`](docs/COLUMNAR_SPEC.md).

## Chức năng chính

- Chuyển đổi giữa Caesar, Vigenère, Playfair, Affine và Hệ mã hàng trong cùng một workspace.
- Mã hóa hoặc giải mã nội dung nhập trực tiếp và file `.txt`.
- Preview kết quả, sao chép, dán và tải file kết quả.
- Hiển thị phân tích hoặc bảng ánh xạ phù hợp với từng thuật toán.
- Giao diện responsive, hỗ trợ bàn phím, screen reader và light/dark theme có ghi nhớ.
- Giữ Backend làm nguồn dữ liệu có thẩm quyền cho mọi kết quả runtime.
- Xem lịch sử metadata của các request cipher khi PostgreSQL và quyền đọc lịch sử đều được bật
  ở Backend; không lưu input hoặc khóa trong lịch sử của trình duyệt.

## Kiến trúc kết nối

Khi phát triển:

```text
Browser -> Vite :5173 -> /api proxy -> FastAPI Backend :8000
```

Khi chạy bằng Docker Compose:

```text
Browser -> Frontend/Nginx :8080 -> Backend :8000 -> PostgreSQL :5432
```

Frontend chỉ gọi các URL tương đối `/api/...`. Vì vậy code runtime không ghi cứng địa chỉ Backend và
không cần cấu hình CORS trong mô hình triển khai same-origin.

## Yêu cầu môi trường

- Node.js và npm.
- Backend chính thức: [`kiendt2312/cipher_workbench-be`](https://github.com/kiendt2312/cipher_workbench-be).
- Docker khi chạy browser E2E với Backend tích hợp hoặc chạy production stack cục bộ.

Theo cấu hình mặc định, repo Backend nằm cùng cấp với repo này:

```text
workspace/
├── caeser_cipher-fe/
└── caesar-cipher-be/
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

Để nghiệm thu lịch sử máy chủ theo contract mới nhất đã đối chiếu, dùng BE revision `c314fa8`, PostgreSQL,
migration Alembic và `HISTORY_API_ENABLED=true` **chỉ ở môi trường dev/nội bộ**. FE chỉ gọi
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

Mở <http://localhost:5173>. Vite sẽ chuyển tiếp mọi request `/api` đến
`http://localhost:8000`.

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

Với Playfair, quá trình chuẩn hóa có thể làm thay đổi dữ liệu đầu vào. Khi giải mã, Backend bỏ
đúng một filler ở cuối kết quả: nếu kết thúc bằng `XQ` thì bỏ `Q`, nếu không mà kết thúc bằng `X`
thì bỏ `X`; filler ở giữa vẫn được giữ. Vì không thể phân biệt chắc chắn filler với chữ thật,
kết quả có thể mất một chữ `X` cuối vốn thuộc bản rõ. Tab **Phân tích** chỉ gợi ý bỏ `X/Q` nằm
giữa hai chữ giống nhau. FE không tự xóa thêm ký tự khỏi kết quả Backend; thao tác sao chép và
tải xuống dùng nguyên kết quả đó.

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
| `npm run test:e2e`             | Chạy toàn bộ browser E2E trên desktop và mobile với Backend thật |
| `npm run test:e2e:integration` | Chạy riêng bộ kiểm tra contract tích hợp Backend                 |
| `npm run test:e2e:production`  | Kiểm tra production stack đang chạy tại `127.0.0.1:8080`         |
| `npm run check`                | Format check, lint, type-check, unit test và build               |
| `npm run check:all`            | Chạy `check` rồi chạy toàn bộ browser E2E                        |

## Kiểm thử

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

## Chạy production stack cục bộ

Tạo file cấu hình deploy từ mẫu:

```bash
cp .env.deploy.example .env.deploy
```

Cập nhật ít nhất `FRONTEND_REVISION`, `BACKEND_REVISION` và các giá trị môi trường cần thiết, sau đó
khởi động stack:

```bash
docker compose --env-file .env.deploy up -d --build
```

Mặc định ứng dụng chỉ bind tại <http://127.0.0.1:8080>; cổng Backend không được public ra host.
Kiểm tra stack đang chạy bằng:

```bash
npm run test:e2e:production
```

Quy trình VPS, HTTPS, rate limit, kiểm tra và rollback được mô tả tại
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Cấu trúc dự án

```text
src/
├── app/                 # App shell, composition và runtime wiring
├── features/
│   ├── caesar/          # Caesar workspace
│   ├── vigenere/        # Vigenère workspace
│   ├── playfair/        # Playfair workspace
│   ├── affine/          # Affine workspace và API adapter
│   └── columnar/        # Hệ mã hàng, validation, Phân tích và API adapter
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
- Success response có `success`, `result`; error response có `success`, `message`.
- FE phải kiểm tra cả HTTP status và response body, đồng thời giữ nguyên thông báo lỗi hợp lệ từ
  Backend.
- Giới hạn file là đúng `5 MiB`.
- Preview dùng `response_mode=content`; download là request riêng với `response_mode=file`.
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
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)                         | Hướng dẫn production deployment            |
| [`docs/POSTGRES_FE_ROADMAP.md`](docs/POSTGRES_FE_ROADMAP.md)       | Phạm vi lịch sử PostgreSQL của FE          |
| [`AGENTS.md`](AGENTS.md)                                           | Quy ước làm việc dành cho coding agent     |

## Giới hạn hiện tại

- Lịch sử chỉ có metadata chung toàn instance; chưa có tài khoản hay xem lại nội dung cũ.
- Chưa hỗ trợ brute-force, tự động tìm khóa hoặc alphabet tùy chỉnh.
