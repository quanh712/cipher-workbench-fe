# Cipher Workbench — Frontend RSA Specification

## Contract và phạm vi

Đối chiếu Backend `9d22937682434bc8847ae53449f612716e0ef6b8`, schema SQLite
`sqlite_0004`; bật UI bằng `VITE_ENABLE_RSA=true` sau kiểm chứng release. Authority:
[contract RSA BE](../../cipher-workbench-be/repo_docs/rsa-frontend-contract.md),
[routes](../../cipher-workbench-be/app/api/routes_rsa.py),
[signature schema](../../cipher-workbench-be/app/api/rsa_signature_schemas.py).
[RSA_SCOPE.md](RSA_SCOPE.md) giữ phạm vi thiết kế cũ; contract hiện hành ở đây được ưu tiên.

RSA có tab **Mã hóa / Chữ ký số**. Kết quả và trace luôn lấy từ Backend; chọn ví dụ
chỉ điền đầu vào, không tự gửi request. Không có RSA core hoặc fallback local runtime.

## Khóa và mã hóa

- Sinh thủ công qua `POST /api/rsa/keys` với `{p,q,e}` là chuỗi decimal; hoặc
  ngẫu nhiên qua `POST /api/rsa/keys/random` với `{bits:16|32|64|128}`.
  Random response có p/q; kết quả giữ n/phi/e/d và trace Euclid từ BE.
- Nhập khóa dùng n/e để mã hóa, n/d để giải mã. Không bắt nhập số mũ không cần thiết.
  Toàn bộ số lớn được giữ dạng chuỗi, không chuyển qua `Number`.
- Số: `POST /api/rsa/encrypt` dùng `e,n,inputType:"number",data`;
  decrypt dùng `d,n,inputType:"number",cipher`. Bản mã là mảng JSON chuỗi decimal.
  Số chỉ nhận một phần tử; JSON number không thay thế decimal string.
- Text: `inputType:"text"`, `mode:"char"|"block"`. Char ánh xạ Unicode code point;
  block đóng gói UTF-8 và yêu cầu n>256. Không chuẩn hóa dấu, khoảng trắng hoặc newline.
- Block ciphertext package giữ nguyên `cipher`, `mode`, `originalUtf8ByteLength`;
  khi decrypt phải gửi đủ metadata này. Char decrypt không gửi length metadata.
- `traceBlockIndex` chọn khối phân tích; FE hiển thị trace BE thay vì tự tính.
  Sửa đầu vào, khóa hoặc tùy chọn hủy response cũ và xóa kết quả không còn phù hợp.
- Mã hóa file `.txt` UTF-8 gửi multipart tới `/api/rsa/encrypt` gồm `file,e,n,mode`
  và `traceBlockIndex` tùy chọn. Không gửi `inputType`, `action` hoặc `response_mode`.
  File tối đa 1.000.000 raw byte; text/file tối đa 10.000 code point.
  Decrypt luôn dùng JSON; không có upload ciphertext hay `/api/rsa/file`.
- Download ciphertext giữ package cần cho giải mã; plaintext tải `.txt` từ kết quả BE.
  Không có import/export private key trong luồng số học. RSA không padding với khóa
  nhỏ phục vụ học tập; không phải luồng RSA-OAEP.

## Chữ ký số

- Số nguyên dùng khóa n/d/e chung và `/api/rsa/sign/raw` (`m,d,e,n`),
  `/api/rsa/verify/raw` (`m,signature,e,n`). Decimal strings chính xác;
  trace bình phương–nhân do BE trả. Luồng học thuật này không băm/padding.
- Chữ ký chuẩn dùng khóa PEM riêng, không tái dùng khóa số nhỏ. `POST /api/rsa/sign`
  và `/api/rsa/verify` dùng RSASSA-PSS/SHA-256, chữ ký base64.
- Text ký JSON `{source:"text",text,privateKeyPem,passphrase?}`;
  kiểm tra `{source:"text",text,signature,publicKeyPem}`.
- File dùng multipart `file,privateKeyPem,passphrase?` để ký hoặc
  `file,signature,publicKeyPem` để kiểm tra. Không gửi `source` trong multipart.
  `.txt` UTF-8 tối đa 5 MiB. Text/file ký đúng dữ liệu gửi lên; FE không băm trước.
- Response `{success:true,result,history}`; chữ ký chuẩn có SHA-256/contentBytes,
  thuật toán và khóa công khai trong kết quả ký. `valid:false` là chữ ký không hợp lệ,
  còn request vẫn thành công; phân biệt với lỗi mạng/schema/dịch vụ.
- Lỗi lưu lịch sử không làm mất kết quả chữ ký. Không lưu private PEM, passphrase,
  private exponent hoặc trace trong history/localStorage/URL/log/telemetry.
- Thay dữ liệu/reset/chuyển cipher/unmount hủy request và bỏ response cũ, kể cả khi
  gateway không tuân theo AbortSignal. Submit đang chạy không gửi request đôi.

## Lịch sử

Mọi thao tác gọi chung `/api/history` bằng cùng cookie owner, không ghép nguồn RSA
riêng. Keygen không ghi history. Ký và kiểm tra (kể cả `valid:false`) được ghi khi
`history.saved:true`; transform ghi metadata best-effort. Metadata cipher/DH khác
có thể không chứa payload. Xem chi tiết, xóa một bản ghi, xóa toàn bộ hồ sơ và tải
nội dung chỉ khi `contentAvailable=true`. Xóa toàn bộ không bị giới hạn bởi bộ lọc
đang chọn. Dùng lại chữ ký số nguyên chỉ điền m/signature/public key, không tự gửi.

TTL tối đa 5 giờ; đọc không gia hạn; hạn mức có thể loại sớm. Cookie là hồ sơ ẩn danh,
không có tài khoản. Xem [Backend contract](BACKEND_CONTRACT.md) cho route và cấu hình.

## Kiểm chứng

Chạy `npm run typecheck`, `npm run lint`, unit/component tests và `npm run build`.
Fixture browser dùng `npm run test:e2e:rsa`; kiểm Backend thật bằng
`npm run test:e2e:rsa:integration` với database kiểm thử riêng. Kiểm vector số,
Unicode/char/block round-trip, giữ length metadata, random keygen, file limits,
chữ ký text/file đúng/sai, history owner/cursor/delete/download và response đến muộn.
Bằng chứng kiểm thử cho đợt đồng bộ được ghi sau khi chạy; tài liệu này không chứng
minh image production đã được build hoặc triển khai.
