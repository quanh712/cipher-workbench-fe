# Cipher Workbench Frontend

Ứng dụng web phục vụ học tập và thực hành mật mã: mã hóa, giải mã, trao đổi khóa,
ký số và xem các bước xử lý. Frontend dùng React, TypeScript và Vite, kết nối
Backend thật qua API cùng origin.

## Tính năng

- Thực hành chín thuật toán trong cùng một workspace.
- Nhập văn bản hoặc file `.txt`, xem trước, sao chép và tải kết quả.
- Xem phân tích và các bước tính theo khả năng của từng thuật toán.
- Sinh hoặc nhập khóa RSA, mã hóa/giải mã số và văn bản, ký/kiểm tra chữ ký số nguyên.
- Kiểm tra hoặc sinh tham số Diffie–Hellman, tạo cặp khóa, tính bí mật chung,
  trao đổi khóa A/B và thực hành Caesar bằng khóa chung.
- Xem lịch sử thao tác, lọc theo thuật toán và thao tác tương ứng, tải thêm và làm mới.
  Lịch sử chữ ký RSA hỗ trợ xem chi tiết, dùng lại để kiểm tra và xóa bản ghi.
- Giao diện responsive, hỗ trợ bàn phím, screen reader và giao diện sáng/tối.

| Thuật toán     | Khả năng chính                                                | File `.txt` |
| -------------- | ------------------------------------------------------------- | ----------- |
| Caesar         | Mã hóa / giải mã                                              | Có          |
| Vigenère       | Mã hóa / giải mã                                              | Có          |
| Playfair       | Mã hóa / giải mã, đối chiếu ký tự đệm                         | Có          |
| Affine         | Mã hóa / giải mã với hai khóa `a`, `b`                        | Có          |
| Hệ mã hàng     | Mã hóa / giải mã bằng khóa hoán vị                            | Có          |
| Hill           | Khóa ma trận hoặc từ khóa, mã hóa / giải mã                   | Có          |
| DES            | Text/HEX, ECB/CBC, IV và phân tích vòng xử lý                 | Có          |
| RSA            | Sinh/nhập khóa, mã hóa / giải mã số và văn bản, ký / kiểm tra | Chưa hỗ trợ |
| Diffie–Hellman | Trao đổi khóa, tính bí mật chung, Caesar bằng khóa chung      | Qua Caesar  |

Hill, DES, RSA và Diffie–Hellman được bật bằng cờ cấu hình khi Backend đã hỗ trợ
API tương ứng. Kết quả xử lý runtime lấy từ Backend; dữ liệu mẫu chỉ giúp điền
đầu vào, không thay thế kết quả API.

## Yêu cầu môi trường

- Node.js và npm; Dockerfile dùng Node.js 22 để build.
- Backend tương thích với [contract API](docs/BACKEND_CONTRACT.md).
- Docker và Docker Compose nếu chạy stack cục bộ hoặc kiểm thử tích hợp bằng container.

Theo cấu hình mặc định, checkout Backend nằm cùng cấp với Frontend:

```text
Cipher-workbench/
├── cipher-workbench-fe/
└── cipher-workbench-be/
```

Có thể dùng `BACKEND_CONTEXT` để chọn checkout Backend khác cho các script integration
có hỗ trợ biến này. Hướng dẫn Backend nằm tại
[repo Backend](https://github.com/kiendt2312/cipher_workbench-be).

## Chạy để phát triển

Khởi động Backend theo hướng dẫn của repo Backend, sau đó cài dependencies Frontend:

```bash
npm ci
cp .env.example .env.local
```

Chỉnh `.env.local` theo Backend đang sử dụng. Ví dụ khi một Backend ở cổng `8000`
hỗ trợ toàn bộ tính năng:

```dotenv
BACKEND_DEV_URL=http://127.0.0.1:8000
BACKEND_SIGNATURE_URL=http://127.0.0.1:8000
VITE_ENABLE_HILL=true
VITE_ENABLE_DES=true
VITE_ENABLE_RSA=true
VITE_ENABLE_DIFFIE_HELLMAN=true
```

Chỉ bật các thuật toán mà Backend đã hỗ trợ. `BACKEND_DEV_URL` là target cho API
chung; `BACKEND_SIGNATURE_URL` là target riêng cho lịch sử DH và chữ ký RSA,
mặc định `http://127.0.0.1:8080`. Khi dùng một Backend thống nhất, đặt hai biến
về cùng địa chỉ. Khởi động lại Vite sau khi đổi cấu hình.

```bash
npm run dev
```

Mở <http://localhost:5173>. Frontend gửi yêu cầu tới `/api/...`; Vite chuyển tiếp
đến Backend. Có thể kiểm tra Backend qua `/api/health`, `/docs` và `/openapi.json`.

## Sử dụng

1. Chọn thuật toán và thao tác cần thực hiện.
2. Nhập dữ liệu và khóa, hoặc chọn file `.txt` với thuật toán có hỗ trợ.
3. Gửi xử lý, xem kết quả và mở tab **Phân tích** để đối chiếu các bước.
4. Sao chép, tải kết quả hoặc mở **Lịch sử thao tác** để xem các lần xử lý đã lưu.

Với RSA, dùng phần thiết lập khóa trước khi mã hóa, giải mã hoặc ký số.
Với Diffie–Hellman, thiết lập tham số và khóa hai bên để tính bí mật chung;
kết quả có thể dùng cho bài thực hành Caesar.

Lịch sử cần Backend bật lưu trữ và API đọc lịch sử. Lịch sử cipher thông thường
và DH lưu metadata thao tác; lịch sử chữ ký RSA lưu dữ liệu riêng theo hồ sơ
trình duyệt để xem chi tiết và dùng lại khóa công khai. Bộ lọc thao tác chỉ hiển thị
các lựa chọn phù hợp với thuật toán đang chọn.

## Kiến trúc

```text
Browser → Frontend → /api reverse proxy → Backend → SQLite history
```

- `src/app/` ghép các feature và cấu hình runtime.
- Mỗi feature giữ component, hook, type và API adapter của mình.
- Backend chịu trách nhiệm xác thực dữ liệu và trả kết quả xử lý.
- Vite cung cấp proxy khi phát triển; Nginx cung cấp proxy khi triển khai.

Cấu hình local cổng `18081` dùng Backend SQLite cho API chung và Backend RSA/DH
riêng cho DH, chữ ký RSA và lịch sử tương ứng. `/api/dh/history` và
`/api/rsa/history` được chuyển đến `/api/history` của Backend RSA/DH để đọc đúng
nguồn dữ liệu. Xem cấu hình và hướng dẫn chi tiết trong tài liệu triển khai.

```text
src/
├── app/                 # App shell và kết nối các feature
├── features/
│   ├── caesar/
│   ├── vigenere/
│   ├── playfair/
│   ├── affine/
│   ├── columnar/
│   ├── hill/
│   ├── des/
│   ├── rsa/
│   ├── diffieHellman/
│   └── history/
├── shared/              # UI, hook, service và utility dùng chung
└── test/                # Thiết lập và helper kiểm thử
e2e/                     # Các kịch bản Playwright
docs/                    # Spec, contract và hướng dẫn vận hành
scripts/                 # Script integration và deployment
deploy/ và nginx/        # Cấu hình container và reverse proxy
```

## Kiểm thử và build

| Lệnh                          | Mục đích                                       |
| ----------------------------- | ---------------------------------------------- |
| `npm run dev`                 | Chạy Vite dev server                           |
| `npm run build`               | Kiểm tra TypeScript và build vào `dist/`       |
| `npm run preview`             | Xem trước bản build                            |
| `npm run typecheck`           | Kiểm tra TypeScript                            |
| `npm run lint`                | Kiểm tra ESLint                                |
| `npm run format:check`        | Kiểm tra định dạng                             |
| `npm test`                    | Chạy unit/component test                       |
| `npm run test:watch`          | Chạy test ở watch mode                         |
| `npm run check`               | Format, lint, TypeScript, unit test và build   |
| `npm run test:e2e`            | Kiểm thử luồng người dùng với Backend tích hợp |
| `npm run test:e2e:production` | Kiểm thử stack đã triển khai                   |

Chạy `npm run check` trước khi commit thay đổi mã nguồn. Khi sửa luồng người dùng
hoặc tích hợp API, chạy thêm bộ E2E phù hợp. Hill, DES, RSA và Diffie–Hellman có
các bộ kiểm thử riêng trong `package.json`; cấu hình và yêu cầu Backend nằm trong
spec và tài liệu integration của từng thuật toán.

E2E mặc định khởi động Backend sibling bằng Docker trên cổng riêng và dọn container
khi kết thúc. Các bộ kiểm thử trên stack đã triển khai yêu cầu stack có sẵn:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18081 npm run test:e2e:production
```

Build cần các cờ `VITE_ENABLE_*` tương ứng với tính năng muốn triển khai.
Cờ được đọc lúc build; thay env sau khi build không bật thêm thuật toán.

## Triển khai

Stack local dùng Docker Compose, Nginx và SQLite. Frontend local mặc định mở tại
<http://127.0.0.1:18081>; stack integration dùng cổng và dữ liệu riêng.

Với stack đã được chuẩn bị và image đã build, cập nhật riêng Frontend bằng:

```bash
./deploy/frontend.sh local config
./deploy/frontend.sh local up
./deploy/frontend.sh local ps
```

Wrapper dùng image được ghim trong cấu hình và giữ Backend hiện tại. Khi cài mới,
chuẩn bị image, env, network và backup theo [hướng dẫn SQLite](docs/SQLITE_COMPOSE.md).
Backend RSA/DH được quản lý riêng bằng `deploy/rsa-backend.sh`.
Sao lưu dữ liệu trước khi migration; giữ nguyên signing key của hồ sơ lịch sử
qua các lần khởi động. Không commit file env riêng tư hoặc snapshot SQLite.

Xem [hướng dẫn deployment](docs/DEPLOYMENT.md) cho HTTPS và triển khai trên máy chủ.
Thông tin nghiệm thu, image và rollback theo từng đợt nằm trong các báo cáo ở `docs/`.

## Giới hạn

- RSA và Diffie–Hellman trong ứng dụng phục vụ học tập. Chữ ký RSA hiện dùng
  số nguyên, chưa hỗ trợ ký văn bản/file, băm hoặc padding chữ ký.
- File đầu vào tối đa `5 MiB`; khả năng xử lý tùy thuật toán.
- Playfair có chuẩn hóa ký tự; lọc ký tự đệm Playfair/Hill có thể không khôi phục
  nguyên văn. Có thể đối chiếu bản thô trong phần phân tích.
- Lịch sử cipher dùng chung trong instance; lịch sử chữ ký RSA thuộc cookie hồ sơ
  trình duyệt, lưu tối đa 5 giờ và có thể bị loại sớm theo hạn mức. Chưa có tài khoản.
- Chưa hỗ trợ brute-force, tự động tìm khóa hoặc alphabet tùy chỉnh.

## Tài liệu liên quan

| Tài liệu                                               | Nội dung                                         |
| ------------------------------------------------------ | ------------------------------------------------ |
| [Backend contract](docs/BACKEND_CONTRACT.md)           | API và quy tắc tích hợp                          |
| [Spec nền tảng](docs/PROJECT_SPEC.md)                  | Phạm vi và luồng sử dụng cơ bản                  |
| [Playfair và Vigenère](docs/PLAYFAIR_VIGENERE_SPEC.md) | Quy tắc và phạm vi hỗ trợ                        |
| [Affine](docs/AFFINE_SPEC.md)                          | Khóa và tích hợp Affine                          |
| [Hệ mã hàng](docs/COLUMNAR_SPEC.md)                    | Khóa, Unicode và file                            |
| [Hill](docs/HILL_SPEC.md)                              | Khóa ma trận và xử lý khối                       |
| [DES](docs/DES_SPEC.md)                                | ECB/CBC, IV và trace                             |
| [RSA](docs/RSA_SPEC.md)                                | Khóa, mã hóa và chữ ký                           |
| [Diffie–Hellman](src/features/diffieHellman/README.md) | Tham số, trao đổi khóa và Caesar bằng khóa chung |
| [Tích hợp DH](docs/DIFFIE_HELLMAN_BE_INTEGRATION.md)   | Contract và bằng chứng kiểm thử Backend thật     |
| [SQLite và backup](docs/SQLITE_COMPOSE.md)             | Stack, dữ liệu và vận hành                       |
| [Deployment](docs/DEPLOYMENT.md)                       | Triển khai production                            |
| [AGENTS.md](AGENTS.md)                                 | Quy ước dành cho coding agent                    |
