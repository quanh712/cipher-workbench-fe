# Diffie–Hellman UI QA — canonical `/api/dh/*`

Ngày kiểm: 2026-10-09. Contract authority: BE `frontend-integration.md` mục 19, main `57d5766`.

## Kết quả migration

- Toàn bộ unit/component suite trên working tree demo: **550/550 pass**, 58 files; nhóm DH riêng **204/204 pass**.
- Browser Chromium: **52/52 pass**, 41,2 giây; desktop 1280×720 / mobile 375×812, light/dark. Gồm 8 form/app, 20 resilience và 24 HTTP mock cases.
- Typecheck, ESLint, production build và Prettier trên các file DH pass.
- Đã xem ảnh practice và Caesar analysis desktop/light, mobile/dark; các khối thực hành không còn chiều cao trống cố định, bảng trace cuộn trong khung.
- API acceptance với BE thật: **43/43 pass**, DB SQLite riêng và history bật; xem [bằng chứng](DIFFIE_HELLMAN_BE_INTEGRATION.md).

## Phạm vi browser

- Form, optional private keys, kết quả A/B và bốn trace từ BE; không tràn ngang trang.
- Bàn phím, validation/focus, copy thành công/thất bại, reset và đổi cipher.
- HTTP canonical URL/DTO; random private keys qua exchange với keys omitted.
- Business/network/schema errors, retry, timeout 15 giây, abort transport và bỏ response muộn.
- Hai khu vực thực hành/Caesar luôn hiển thị và dùng chung draft; alpha suggestion cần chọn rõ ràng; random group cập nhật q/alpha và xóa khóa cũ.
- Giữ cặp khóa A/B riêng, shared-secret lấy peer public từ kết quả còn hợp lệ, khóa tác vụ chung với exchange.
- Caesar chỉ chạy với exchange snapshot hợp lệ; chọn A/B, giữ text/file khi mất hiệu lực khóa, xóa output cũ.
- Mode/input/file/output controls chung, Caesar JSON và multipart đúng parts, tab analysis bằng bàn phím và tải kết quả cục bộ.

HTTP browser tests dùng Playwright intercept; fixture gateway tests dùng static data. Chúng không thay thế acceptance BE thật. Production entry nối adapter thật khi cờ bật và không import fixture. Không persist/log keys hoặc nội dung.

## Cách chạy

```bash
npm run test -- src/features/diffieHellman src/app/DiffieHellmanApp.test.tsx src/app/DiffieHellmanHttpApp.test.tsx
DH_E2E_PORT=4181 npm run test:e2e:diffie-hellman
```

## Demo chạy với BE thật

Đã cập nhật build working tree vào container riêng `cipher-fe-demo-18084`, origin `http://localhost:18084`, nối BE `cipher-workbench-be-app-1:8000` (host 8080). Bật đủ chín thuật toán cho demo; không thay đổi demo 18081. Static assets được chép trước index; container tiếp tục chạy sau lượt chat.

Chromium trên demo thật đã kiểm params, keypair A/B, shared-secret, exchange; Caesar text encrypt/decrypt, multipart `.txt` Unicode/CRLF, tải `.txt` không gọi lại API, đổi A/B giữ file và xóa output, sửa q vô hiệu hóa Caesar. Mobile 375 px/dark không tràn ngang trang; không có browser runtime errors.

Chưa kiểm clipboard hệ điều hành, screen reader thủ công hoặc trình duyệt ngoài Chromium. Cờ release trong `.env.example` vẫn mặc định tắt; demo riêng bật tại build.

## Kiểm tra snapshot đưa vào main

Snapshot DH được kiểm thử riêng, không kèm các thay đổi RSA chữ ký/Hill đang làm tại máy: **522/522 test**, 56 files; **52/52 browser cases** (57,5 giây). ESLint, TypeScript, build production bật đủ cờ thuật toán và Prettier các file đưa vào commit đều pass. Test RSA app đã cập nhật theo hành vi chỉ điền mẫu khi người dùng yêu cầu của commit trước.

Sửa kích thước nút tạo cặp khóa/tính khóa chung và bộ chọn A/B: kiểm tra trực tiếp demo 18084 ở 1280 px và 375 px; hai nút cùng chiều rộng/chiều cao, bộ chọn chia đều, chuyển bên đồng bộ và không tràn ngang trang.
