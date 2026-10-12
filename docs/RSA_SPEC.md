# Cipher Workbench — Frontend RSA Specification

## Trạng thái và phạm vi

RSA nối API BE `229c69d7c9af8413a780002b266bdb7651e79cb4`, bật bằng `VITE_ENABLE_RSA=true`. Đợt đồng bộ giao diện ngày 08/10/2026 chỉ sửa FE. Nguồn contract: [routes](../../cipher-workbench-be/app/api/routes_rsa.py), [schema](../../cipher-workbench-be/app/api/rsa_schemas.py). Contract BE được ưu tiên so với prototype và phạm vi cũ trong [RSA_SCOPE.md](RSA_SCOPE.md).

Workspace có hai tab **Mã hóa / Chữ ký số** và phần khóa dùng chung. Tab Mã hóa giữ bố cục dọc: luồng Alice/Bob có thể thu gọn → khóa RSA → một khối số → văn bản → giải thích có thể thu gọn. Tab Chữ ký số ký và kiểm tra một số qua API thật, theo [contract chữ ký BE](../../cipher-workbench-be/docs/rsa-signatures-private-history.md). Dùng theme, panel, nút và `CipherModeSelector` chung với các thuật toán khác; không chuyển sang bố cục hai cột toàn trang. Các bảng cuộn trong khung, không làm trang cuộn ngang ở 375 px.

## Khóa và thao tác

- **Sinh khóa**: nhập p/q/e hoặc chọn preset, rồi bấm **Tạo khóa**. Kết quả gồm n, phi, khóa công khai/riêng và trace Euclid có thể thu gọn.
- **Nhập khóa**: dùng n/e để mã hóa hoặc n/d để giải mã. Không yêu cầu cả hai số mũ. Khóa nhập tay và khóa sinh được lưu riêng trong state bộ nhớ.
- Nhãn khóa dùng **Khóa công khai / Khóa riêng**, không gắn cố định với vai trò Alice/Bob. Chuyển giữa tab Mã hóa và Chữ ký số giữ bộ khóa; ký cần n/d/e (BE trả khóa công khai), kiểm tra cần n/e.
- Khu số và khu văn bản có chế độ **Mã hóa / Giải mã độc lập**, mỗi chế độ giữ đầu vào riêng. Mỗi lần submit gửi đúng một API transform.
- Đầu vào có Dán / Sao chép / Xóa. Kết quả có Sao chép / Tải kết quả / Xóa. Clipboard thất bại có hướng dẫn thao tác thủ công.
- Lần đầu mở RSA, các ô p/q/e, bản rõ số và văn bản đều trống. **Tạo ví dụ** mới điền p=17, q=11, e=7, P=88, text="Xin chao"; không gửi API. Preset chỉ điền p/q/e, không gửi API. Hai preset còn lại là (61,53,17) và (101,113,3533).
- **Đặt lại** giữ tab Mã hóa / Chữ ký số đang mở, xóa dữ liệu đầu vào, khóa nhập tay, snapshot khóa, kết quả và lỗi; đưa chế độ số/văn bản về Mã hóa và chế độ chữ ký về Ký. Header **Làm mới** reset mọi cipher và trở về Caesar.

## Chữ ký số qua BE

- Hai chế độ **Ký / Kiểm tra** cho thông điệp số `m`, chữ ký số `s`, với khóa dùng chung. Các nút **Ký / Kiểm tra** gửi một request khi bấm, bao gồm dữ liệu tự nhập hợp lệ.
- **Tạo ví dụ** và tình huống chữ ký sai chỉ điền dữ liệu. Không có kết quả fixture runtime hoặc phép tính RSA local.
- `POST /api/rsa/sign/raw`: `{m,d,e,n}`. `POST /api/rsa/verify/raw`: `{m,signature,e,n}`. Mọi operand là chuỗi thập phân chính xác. Gửi credentials để giữ cookie profile lịch sử.
- Response `{success:true,result,history}`. `result` có `mode:"raw-integer"`, `warning`, `m`, `signature`, `publicKey`, `trace`; kiểm tra thêm `recoveredMessage`, `valid`. Adapter kiểm schema, khóa và trace khớp request. `valid:false` là kết quả chữ ký không hợp lệ, khác lỗi dịch vụ.
- `history` gồm `saved,id,reason`. Khi không lưu được lịch sử, kết quả ký/kiểm tra vẫn có hiệu lực và UI thông báo riêng. BE quản lý lịch sử theo cookie profile; không lưu khóa riêng hoặc trace.
- Giới hạn hỗ trợ FE: decimal tối đa 128 chữ số, n≥2, e/d≥1, 0≤m,s<n. BE xác nhận miền 128-bit và giới hạn cuối cùng.
- Sửa dữ liệu/khóa, reset, đổi cipher hoặc unmount hủy request và bỏ response cũ. Chuyển tab nội bộ giữ khóa và kết quả đã hoàn thành nhưng hủy request đang chạy. Không gửi request đôi trong lúc loading.
- Trace bình phương–nhân từ BE hiển thị trong bảng có thể thu gọn. Giải thích `s=mᵈ mod n`, `m′=sᵉ mod n`; RSA học thuật không băm/padding, không xác lập danh tính.
- Ký văn bản/file bằng PEM và RSASSA-PSS nằm ngoài phạm vi giao diện số hiện tại.

## Lịch sử ký và kiểm tra chữ ký

- Gộp bản ghi riêng vào **Lịch sử thao tác**, mới nhất trước; bộ lọc **Ký / Kiểm tra chữ ký** chỉ đọc nguồn lịch sử RSA theo cookie hồ sơ trình duyệt. Lịch sử mã hóa/giải mã chung vẫn dùng nguồn riêng.
- Cả kiểm tra hợp lệ và không hợp lệ đều được lưu khi BE báo `history.saved:true`. `valid:false` hiển thị **Chữ ký không hợp lệ**, còn trạng thái request vẫn **Thành công**; không đổi thành lỗi dịch vụ.
- **Xem chi tiết** mở popup; **Dùng lại để kiểm tra chữ ký** chỉ điền thông điệp, chữ ký và khóa công khai, không tự gửi request hoặc khôi phục khóa riêng/trace. **Xóa bản ghi** cần xác nhận, không có xóa toàn bộ.
- Popup chi tiết hiển thị kết quả, thông điệp/chữ ký, khóa công khai và thông tin thao tác theo nhóm có nhãn, không hiển thị JSON. Dữ liệu thiếu ghi rõ **Không có dữ liệu**. Hai nút dùng lại/xóa có cùng chiều cao 44 px; desktop đặt cạnh nhau, mobile xếp dọc và rộng hết nội dung.
- Tải lại khi mở lịch sử; hỗ trợ làm mới, tải thêm và thử lại từng nguồn. Một nguồn lỗi không chặn dữ liệu từ nguồn còn lại. Bản ghi lưu tối đa 5 giờ, có thể mất sớm do hạn mức; đọc không gia hạn.
- FE gọi `/api/rsa/history` và `/{id}`; proxy chuyển sang API lịch sử riêng của BE RSA. Không lưu payload vào localStorage. Integration E2E kiểm cả hai kết quả kiểm tra sau reload, xem chi tiết, dùng lại, xóa và cách ly hồ sơ trên desktop/375 px.

## Định dạng dữ liệu

Mọi số lớn giữ nguyên dạng chuỗi thập phân, không chuyển qua `Number`. Bản rõ số là một chuỗi số; bản mã cho cả số và văn bản là **JSON array of decimal strings**, ví dụ `["11"]` hoặc `["11","76"]`. Kết quả hiển thị, sao chép và tải xuống dùng cùng định dạng đó. Giải mã số yêu cầu đúng một phần tử; JSON numeric values bị từ chối để tránh mất chính xác.

Văn bản chỉ dùng `mode:"char"`: mỗi Unicode code point là một khối. Không chuẩn hóa dấu, khoảng trắng hoặc xuống dòng. Dùng `Array.from` để ánh xạ ký tự theo vị trí. BE từ chối cả yêu cầu nếu bất kỳ code point nào ≥ n. FE không tạo kết quả một phần và không chọn khóa mới tự động.

Đầu ra giải mã giữ plaintext BE trả về. Download mã hóa là `.json`, giải mã là `.txt`. Không hỗ trợ input file, import/export khóa, block byte, RSA-OAEP trong đợt này. Các số nhỏ và RSA không padding chỉ phục vụ minh họa, không dùng để bảo vệ dữ liệu thật.

## API và validation

`RsaGateway` gồm `generateKey`, `transform`, `signature`; adapter `rsaApi` là nơi duy nhất đọc DTO. Không có RSA core hoặc fallback local trong runtime; fake gateway chỉ dùng trong test.

- `POST /api/rsa/keys`: `{p,q,e}` là decimal strings. Map n/phi/e/d và `egcdSteps` (hệ số có thể âm); giữ p/q từ request. Không tự tạo verification.
- `POST /api/rsa/encrypt`: `{e,n,inputType,data,traceBlockIndex:0}`, thêm `mode:"char"` cho text.
- `POST /api/rsa/decrypt`: `{d,n,inputType,cipher,traceBlockIndex:0}`, thêm `mode:"char"` cho text. Không cần p/q/e.
- Response transform phẳng, không có `result` envelope. Số có `blockSize:null`; text có `blockSize:1`. FE kiểm kiểu decimal strings, độ dài mảng và loại response trước khi hiển thị.
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
- `npm run test:e2e:rsa:integration`: BE thật qua stack SQLite integration cổng 18082 chạy sẵn; có thể đổi `BACKEND_DEV_URL`. Kiểm request shape/count, vector 88→11→88, ký 65→588, kiểm tra đúng/sai, zero/range, lỗi và retry, Unicode, download và reset.
- `PLAYWRIGHT_BASE_URL` cho phép kiểm FE production mà không khởi động dev server. Integration chỉ thêm metadata cipher history, không build/cập nhật BE.
- Chạy typecheck, lint, build và format các file sửa. Cờ test baseline được cố định trong Vitest; feature tests bật cờ riêng.
- Kiểm tra tab chữ ký: API thật cho dữ liệu tự nhập, trace BE, giữ khóa khi đổi tab, reset, hủy phản hồi cũ, chữ ký không hợp lệ khác lỗi dịch vụ; dùng được ở 375 px.
