# Cipher Workbench — Frontend RSA Specification

## Trạng thái và phạm vi

RSA nối API BE `229c69d7c9af8413a780002b266bdb7651e79cb4`, bật bằng `VITE_ENABLE_RSA=true`. Đợt đồng bộ giao diện ngày 08/10/2026 chỉ sửa FE. Nguồn contract: [routes](../../cipher-workbench-be/app/api/routes_rsa.py), [schema](../../cipher-workbench-be/app/api/rsa_schemas.py). Contract BE được ưu tiên so với prototype và phạm vi cũ trong [RSA_SCOPE.md](RSA_SCOPE.md).

Workspace có hai tab **Mã hóa / Chữ ký số** và phần khóa dùng chung. Tab Mã hóa giữ bố cục dọc: luồng Alice/Bob có thể thu gọn → khóa RSA → một khối số → văn bản → giải thích có thể thu gọn. Tab Chữ ký số bổ sung giao diện ký và kiểm tra một số, đang chờ contract BE; các kết quả trong tab này chỉ là ví dụ cố định có nhãn **Dữ liệu minh họa**. Dùng theme, panel, nút và `CipherModeSelector` chung với các thuật toán khác; không chuyển sang bố cục hai cột toàn trang. Các bảng cuộn trong khung, không làm trang cuộn ngang ở 375 px.

## Khóa và thao tác

- **Sinh khóa**: nhập p/q/e hoặc chọn preset, rồi bấm **Tạo khóa**. Kết quả gồm n, phi, khóa công khai/riêng và trace Euclid có thể thu gọn.
- **Nhập khóa**: dùng n/e để mã hóa hoặc n/d để giải mã. Không yêu cầu cả hai số mũ. Khóa nhập tay và khóa sinh được lưu riêng trong state bộ nhớ.
- Nhãn khóa dùng **Khóa công khai / Khóa riêng**, không gắn cố định với vai trò Alice/Bob. Chuyển giữa tab Mã hóa và Chữ ký số giữ bộ khóa; ký cần n/d, kiểm tra cần n/e.
- Khu số và khu văn bản có chế độ **Mã hóa / Giải mã độc lập**, mỗi chế độ giữ đầu vào riêng. Mỗi lần submit gửi đúng một API transform.
- Đầu vào có Dán / Sao chép / Xóa. Kết quả có Sao chép / Tải kết quả / Xóa. Clipboard thất bại có hướng dẫn thao tác thủ công.
- Lần đầu mở RSA, các ô p/q/e, bản rõ số và văn bản đều trống. **Tạo ví dụ** mới điền p=17, q=11, e=7, P=88, text="Xin chao"; không gửi API. Preset chỉ điền p/q/e, không gửi API. Hai preset còn lại là (61,53,17) và (101,113,3533).
- **Đặt lại** giữ tab Mã hóa / Chữ ký số đang mở, xóa dữ liệu đầu vào, khóa nhập tay, snapshot khóa, kết quả và lỗi; đưa chế độ số/văn bản về Mã hóa và chế độ chữ ký về Ký. Header **Làm mới** reset mọi cipher và trở về Caesar.

## Chữ ký số trong lúc chờ BE

- Hai chế độ **Ký / Kiểm tra**. Ký nhận thông điệp số `m`; kiểm tra nhận riêng thông điệp gốc `m` và chữ ký `s`. Đợt này không hỗ trợ ký văn bản, băm, padding hay lịch sử ký/kiểm tra.
- Giải thích có thể thu gọn: ký `s = mᵈ mod n`; kiểm tra `m′ = sᵉ mod n`, rồi so sánh `m′` với `m`. Kết quả hợp lệ chỉ minh họa sự khớp với khóa và thông điệp đã nhập, không xác lập danh tính ngoài đời. Đây là RSA giáo trình với số nhỏ, không phải chữ ký an toàn cho dữ liệu thật.
- Bộ ví dụ cố định cho bốn kịch bản: ký thành công, chữ ký hợp lệ, chữ ký không hợp lệ và lỗi dịch vụ minh họa. Chọn kịch bản chỉ điền đầu vào/khóa; bấm **Ký minh họa / Kiểm tra minh họa** mới hiển thị kết quả đã chuẩn bị tương ứng, có nhãn **Dữ liệu minh họa**. Không gửi request ký/kiểm tra hoặc tự tính RSA trên FE.
- Người dùng vẫn sửa được dữ liệu. Khi sửa khóa hoặc đầu vào, xóa kết quả phụ thuộc và trạng thái kịch bản; thao tác ký/kiểm tra ở trạng thái **Chờ backend**. Không suy diễn kết quả cho dữ liệu tự nhập dù tình cờ trùng ví dụ; chọn lại kịch bản để xem demo.
- Thông điệp và chữ ký nhập dạng số nguyên thập phân không âm, giữ dạng chuỗi chính xác. UI giải thích điều kiện `0 ≤ m < n`, `0 ≤ s < n`; lỗi nhập liệu được phân biệt với kết quả **Chữ ký không hợp lệ** và lỗi dịch vụ. BE sẽ xác nhận validation và giới hạn cuối cùng trước khi nối API.
- Chuyển tab giữ bộ khóa. Sửa p/q/e, đổi nguồn khóa hoặc sửa khóa nhập tay xóa kết quả chữ ký phụ thuộc; reset xóa đầu vào, kết quả và kịch bản demo cùng dữ liệu RSA khác. Kết quả cũ không được xuất hiện lại sau khi dữ liệu thay đổi.

Contract ký/kiểm tra chưa được chốt. Cần thống nhất endpoint, request/response, cách truyền số lớn, schema lỗi, giới hạn đầu vào/trace, cách BE biểu diễn tính hợp lệ, cancellation và chính sách không ghi khóa/nội dung vào lịch sử. Không giả định endpoint hoặc mở rộng `RsaGateway` trước khi có contract; không dùng local gateway làm fallback.

## Định dạng dữ liệu

Mọi số lớn giữ nguyên dạng chuỗi thập phân, không chuyển qua `Number`. Bản rõ số là một chuỗi số; bản mã cho cả số và văn bản là **JSON array of decimal strings**, ví dụ `["11"]` hoặc `["11","76"]`. Kết quả hiển thị, sao chép và tải xuống dùng cùng định dạng đó. Giải mã số yêu cầu đúng một phần tử; JSON numeric values bị từ chối để tránh mất chính xác.

Văn bản chỉ dùng `mode:"char"`: mỗi Unicode code point là một khối. Không chuẩn hóa dấu, khoảng trắng hoặc xuống dòng. Dùng `Array.from` để ánh xạ ký tự theo vị trí. BE từ chối cả yêu cầu nếu bất kỳ code point nào ≥ n. FE không tạo kết quả một phần và không chọn khóa mới tự động.

Đầu ra giải mã giữ plaintext BE trả về. Download mã hóa là `.json`, giải mã là `.txt`. Không hỗ trợ input file, import/export khóa, block byte, thực thi ký/kiểm tra qua BE hay RSA-OAEP trong đợt này. Ngoại lệ giao diện chữ ký minh họa được mô tả ở trên. Các số nhỏ và RSA không padding chỉ phục vụ minh họa, không dùng để bảo vệ dữ liệu thật.

## API và validation

`RsaGateway` gồm `generateKey` và `transform`; adapter `rsaApi` là nơi duy nhất đọc DTO. Không có RSA core hoặc fallback local trong runtime; fake gateway chỉ dùng trong test. Ngoại lệ hẹp: tab Chữ ký số được hiển thị các fixture cố định đã chuẩn bị, có nhãn Dữ liệu minh họa, để duyệt UI trong lúc chờ BE. Fixture thuộc lớp trình bày demo, không phải fake gateway runtime; không thay thế kết quả hoặc lỗi API thật.

- `POST /api/rsa/keys`: `{p,q,e}` là decimal strings. Map n/phi/e/d và `egcdSteps` (hệ số có thể âm); giữ p/q từ request. Không tự tạo verification.
- `POST /api/rsa/encrypt`: `{e,n,inputType,data,traceBlockIndex:0}`, thêm `mode:"char"` cho text.
- `POST /api/rsa/decrypt`: `{d,n,inputType,cipher,traceBlockIndex:0}`, thêm `mode:"char"` cho text. Không cần p/q/e.
- Response phẳng, không có `result` envelope. Số có `blockSize:null`; text có `blockSize:1`. FE kiểm kiểu decimal strings, độ dài mảng và loại response trước khi hiển thị.
- Trace lấy từ `trace.steps[].i/bit/base/before/result`. Số hiển thị từng bước cho khối duy nhất; text hiển thị trace khối đầu và bảng từng khối ký tự. Trace mặc định thu gọn.
- Lỗi `{success:false,code,message,field}` hiển thị message hợp lệ dưới dạng text. Network/schema lỗi có thông báo hệ thống; bấm lại lệnh để thử lại.
- p/q thuộc [2,10^12], khác nhau; e thuộc (1,phi). BE kiểm nguyên tố và tính khả nghịch. Khóa nhập tay kiểm cú pháp n≥2 và số mũ≥1. Operand tối đa 128 chữ số; BE quyết định các giới hạn miền cuối cùng. Text tối đa 10.000 code point theo BE.
- `P=0` hợp lệ; `P≥n` nhận `P_TOO_LARGE`. Không tính modulo hoặc decrypt tự động để thay thế lỗi.
- Keygen không ghi history; mỗi transform ghi metadata chung. Không ghi khóa/nội dung vào URL, log, telemetry hoặc localStorage.

## State và cancellation

Ba tác vụ key/number/text có trạng thái idle/loading/success/error, lỗi và AbortController/version riêng. Nút submit của tác vụ đang chạy bị khóa để tránh gửi đôi; vẫn có thể sửa dữ liệu hoặc đổi chế độ để hủy.

- Sửa p/q/e hoặc chọn preset: hủy tác vụ, xóa khóa sinh và mọi kết quả; giữ đầu vào số/text.
- Đổi nguồn khóa hoặc sửa khóa nhập tay: hủy/xóa hai kết quả transform.
- Sửa đầu vào hoặc đổi chế độ số/text: hủy/xóa riêng tác vụ đó.
- Xóa kết quả: giữ đầu vào, hủy tác vụ tương ứng.
- Đổi cipher: giữ draft và khóa nhập tay, hủy tác vụ và xóa snapshot khóa sinh/kết quả/lỗi. Quay lại không tự chạy.
- Reset/unmount: mọi response cũ phải bị bỏ kể cả khi gateway không tuân theo abort.

## Kiểm chứng

- `npm test`: unit/component tests, bao gồm no-auto-run, half-key, JSON chính xác, clipboard, reset, retry và response đến muộn.
- `npm run test:e2e:rsa`: UI fixture desktop/375 px, light/dark theme, trace, bàn phím và lỗi render an toàn.
- `npm run test:e2e:rsa:integration`: BE thật qua stack SQLite integration cổng 18082 chạy sẵn; có thể đổi `BACKEND_DEV_URL`. Kiểm request shape/count, vector 88→11→88, zero/range, Unicode, download và reset.
- `PLAYWRIGHT_BASE_URL` cho phép kiểm FE production mà không khởi động dev server. Integration chỉ thêm metadata cipher history, không build/cập nhật BE.
- Chạy typecheck, lint, build và format các file sửa. Cờ test baseline được cố định trong Vitest; feature tests bật cờ riêng.
- Kiểm tra tab chữ ký: đủ bốn demo có nhãn, sửa dữ liệu/khóa xóa kết quả và chuyển Chờ backend, chuyển tab giữ khóa, reset xóa demo, không phát request ký/kiểm tra hay ghi history; có thể phân biệt chữ ký không hợp lệ với lỗi nhập liệu/lỗi dịch vụ bằng text và dùng được ở 375 px.
