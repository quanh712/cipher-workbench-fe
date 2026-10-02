# Cipher Workbench — Frontend DES Specification

## 1. Trạng thái và nguồn có thẩm quyền

Cập nhật 01/10/2026: FE đã chuyển từ mốc A demo sang **mốc B tích hợp API DES thật**.
Contract được ghim tại BE revision
[`31438eb49c94cdef570b3ca5afd2c2fff9e73501`](https://github.com/kiendt2312/cipher_workbench-be/blob/31438eb49c94cdef570b3ca5afd2c2fff9e73501/repo_docs/frontend-integration.md),
nhánh `docs/des-fe-guide`, mục 4.7, 8, 9.2. Đã đối chiếu `des-text-cipher-api`,
`des-file-cipher-api` và implementation trong cùng checkout BE. Nguồn FE là
[DES_Frontend_Scope.html](../DES_Frontend_Scope.html) và
[tài liệu thuật toán](<../Hệ mã hóa DES_ thuật toán và logic.html>).

Contract này thay thế các endpoint/DTO dự thảo và quyết định validation/file tạm thời của
mốc A. Backend là nguồn kết quả và validation cuối cùng. GitHub Issues vẫn là issue tracker
chính thức; tài liệu này chưa gắn số issue.

## 2. Phạm vi và cấu hình

- DES là workspace/tab trong App theo state, không thêm router. Reuse selector, mode,
  input panel, theme, notification và style Workbench.
- Hỗ trợ Encrypt/Decrypt, Text/File, khóa, Text/HEX, ECB/CBC, IV, warnings, Copy/Clear/Download,
  Đặt lại DES, giữ draft khi đổi cipher, loading và cancellation.
- `VITE_ENABLE_DES=true` bật API thật và nhãn **Khả dụng**; mặc định false như cổng release
  Hill. Nếu đồng thời bật demo, API thật được ưu tiên.
- `VITE_ENABLE_DES_DEMO=true` chỉ bật demo khi cờ API thật tắt. Demo vẫn có nhãn/banner
  mô phỏng, fixture cố định, validation tạm thời và không gọi network. Không fallback từ
  API thật sang demo khi request lỗi.
- Cờ API thật được truyền ở build Docker/Compose. Chỉ bật trên môi trường deploy BE đã chứa
  revision DES; cấu hình FE không tự cập nhật Backend sibling/container.
- Không triển khai DES core tại FE. Không thêm trace/16-round visualization, sinh/brute-force
  khóa, history cá nhân, 3DES, authentication hoặc database. `/trace` đã có contract BE nhưng
  UI xem từng bước vẫn ngoài phạm vi người dùng đã chốt.

## 3. Form và semantics thuật toán

Draft ban đầu: Encrypt, Text, format `text`, block mode `ECB`, text/key/IV rỗng, file null.

- Key là 16 HEX sau khi bỏ ASCII whitespace (space, tab, CR, LF, FF, VT); cho phép chữ thường.
  FE chỉ bỏ whitespace trong bản kiểm tra, gửi nguyên giá trị người dùng nhập; không sửa parity.
- `mode` truyền chính xác `ECB` hoặc `CBC`. ECB ẩn IV và không gửi field IV; giữ draft IV để
  quay về CBC. CBC yêu cầu IV 16 HEX theo cùng quy tắc whitespace/raw input.
- Text source: một lựa chọn format dùng cho cả hai chiều: encrypt gửi `inputFormat`, decrypt
  gửi `outputFormat`. Chuyển operation giữ format để đảm bảo text ↔ text và hex ↔ hex.
- Encrypt text: BE mã UTF-8 rồi luôn đệm PKCS#7. Encrypt HEX: block bội 16 HEX, không padding.
  Output ciphertext luôn HEX in hoa. Decrypt luôn nhận HEX; text output gỡ padding rồi decode
  UTF-8; HEX output trả bytes nguyên dạng HEX, giữ cả padding nếu có.
- File source ẩn format và luôn dùng semantics text: encrypt file UTF-8 ra HEX, decrypt file
  HEX ra text. Không gửi format vào multipart.
- IV phải hiện cạnh output CBC từ snapshot đã submit. Có chú thích trước submit và ở output:
  IV sai vẫn có thể trả HTTP 200 nhưng sai 8 byte đầu. Không coi success là xác nhận IV đúng.
- Mô tả DES ngắn nêu block 64 bit, khóa 64 bit/56 bit hiệu dụng và Feistel 16 vòng.

## 4. Contract và adapter

Tất cả URL same-origin `/api`. JSON strict camelCase:

| Endpoint                      | Fields gửi                                                              | HTTP 200                                |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| POST `/api/des/encrypt`       | `text,key,inputFormat,mode`, `iv` chỉ khi CBC                           | `{success:true,result:string,warnings}` |
| POST `/api/des/decrypt`       | `text,key,outputFormat,mode`, `iv` chỉ khi CBC                          | Như encrypt                             |
| POST `/api/des/file` preview  | FormData `file,key,action,mode,response_mode=content`, `iv` chỉ khi CBC | Như encrypt                             |
| POST `/api/des/file` download | Cùng file gốc và snapshot, `response_mode=file`                         | `text/plain` Blob + Content-Disposition |

Không gửi internal fields `operation,inputMode,cipherMode,format` trực tiếp cho BE. Adapter map
`operation` → path/`action`, `cipherMode` → `mode`, `format` → field riêng cho từng operation.
Không tự đặt Content-Type cho FormData. Gateway nhận AbortSignal cho cả process/download.

Parser đọc response như unknown, kiểm tra HTTP status, media type, result string và warnings
có shape hợp lệ, đúng thứ tự, không trùng. DES business error là `{success:false,message}`;
không có error code/details. Hiển thị nguyên message BE, không phân loại lỗi bằng câu chữ.
Lỗi response/schema dùng thông báo hệ thống; lỗi network dùng thông báo thử lại. Không render
raw object, HTML hay stack trace.

File preview không tạo attachment. Chỉ khi bấm Download mới gửi request thứ hai, với file gốc,
key/mode/IV/action trong snapshot đã thành công. Không đóng preview vào Blob để giả official
file. Dùng đúng bytes và filename server trả (`filename*` ưu tiên), bao gồm BOM nếu có.
Nguồn Text cho phép tải `.txt` từ nguyên result đã nhận, không thay newline/whitespace/Unicode.

## 5. Validation và giới hạn

FE validate để hỗ trợ UX; BE vẫn kiểm UTF-8, nội dung, padding và validation precedence thật.

- Key/IV đúng HEX và độ dài. Không áp `.trim()` Unicode để bỏ qua NBSP hoặc ký tự khác mà BE
  không chấp nhận.
- Text plaintext cần ít nhất một ký tự; whitespace-only vẫn hợp lệ với text encrypt.
- Decrypt hoặc encrypt HEX: bỏ ASCII whitespace để kiểm tra không rỗng, chỉ HEX và bội 16.
  Gửi nguyên raw text; không sửa/trim ciphertext.
- Text UTF-8 tối đa **5.242.880 byte** cả hai chiều, kiểm raw text trước khi loại whitespace.
- File: chỉ `.txt` (case-insensitive), `File.size` tối đa **5.242.880 byte**, 0 byte bị từ chối.
  Metadata bao gồm tên/dung lượng, replace/remove và một file tại một thời điểm.
- Input panel DES giữ metadata, không đọc client bytes để tính DES hay ép UTF-8. Server kiểm
  encoding và trả lỗi `File phải sử dụng UTF-8.`; preview là output của request content.
- Chọn file invalid giữ text draft, hiển thị lỗi và khóa action; thay/gỡ file xóa lỗi cũ.
- Action disabled khi validation chưa đạt hoặc busy. Lỗi local hiện gần input/key/IV tương ứng;
  lỗi BE không có field code thì hiện notification chung.

Cảnh báo trước encrypt text/file khi UTF-8/raw File.size vượt **2.621.439 byte**: ciphertext
sẽ vượt 5 MiB nên API không nhận để decrypt lại. Đây là warning, không chặn encrypt dưới giới
hạn input 5 MiB. Với file BOM, File.size có thể làm warning thận trọng thêm 3 byte.
Không cảnh báo này cho raw HEX vì không có phép tăng gấp đôi do encode từ text.

Không đặt timeout ngắn; guide BE đo khoảng 6 giây với 5 MiB encrypt. Loading phải giữ controls
khóa trong cả process và download request thứ hai.

## 6. Warnings và output

Warnings không chặn success và hiển thị nguyên message theo thứ tự server:

| Code | Ý nghĩa                  | Details                   |
| ---- | ------------------------ | ------------------------- |
| W01  | Khóa yếu                 | `{}`                      |
| W02  | Khóa nửa yếu             | `{}`                      |
| W03  | ECB encrypt có block lặp | `{repeatedBlocks:number}` |

File warnings lấy từ preview JSON; attachment không mang warnings. Đổi draft xóa warnings
và result cũ. Kết quả readonly, Copy dùng nguyên result, không tự normalize. Response text rỗng
hiện empty state; download file vẫn khả dụng nếu preview thành công và có gateway download.
Utility copy/download thất bại hiện lỗi, giữ preview để thử lại; không tự tải file khi API lỗi.
Blob URL được revoke sau download, kể cả click thất bại.

## 7. State, snapshot và reset

Hook giữ draft riêng: operation/source/text/file/key/format/block mode/IV; derived state gồm
result, warnings, request snapshot, status, field errors và notice.

| Event                                                   | Hành vi                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| Lần đầu mở DES                                          | Draft trống; không copy text từ cipher khác                           |
| Đổi operation/source/format/block mode/IV/key/text/file | Giữ các draft phù hợp; xóa result/snapshot/errors/notices             |
| Đổi Text/File                                           | Chỉ submit source active; giữ draft còn lại                           |
| Xóa input                                               | Xóa nguồn active; giữ key/options và nguồn còn lại; xóa derived state |
| Xóa output                                              | Chỉ xóa result/snapshot/notices; giữ draft và validation              |
| Đặt lại DES                                             | Xóa toàn bộ DES, về Encrypt/Text/text-format/ECB                      |
| Đổi cipher rồi quay lại                                 | Giữ draft; xóa result/errors/notices                                  |
| Header Làm mới                                          | Reset mọi cipher và trở về Caesar                                     |
| Rời workspace/history hoặc unmount                      | Abort request, bỏ qua completion cũ                                   |

Process/download snapshot và request id bảo đảm completion cũ không cập nhật draft mới. Ref
khóa in-flight chặn double click và mutation cùng tick; busy khóa input/options/reset/selector.
Theme vẫn đổi được. Các control keyboard/focus/live-region theo Workbench; desktop hai cột,
375 px xếp chồng không cuộn ngang trang.

## 8. Thành phần và cấu hình triển khai

- `services/desGateway.ts`: seam process/download và lỗi user-facing.
- `services/desApi.ts`: JSON/multipart builder, schema/warning parser, attachment reader.
- `hooks/useDesCipher.ts`: validation, draft, snapshot, cancellation, output utilities.
- `utils/validation.ts`: raw-value validation, UTF-8 limit và round-trip threshold.
- `components/DesWorkspace`, `DesKeyInput`, `DesResultPanel`: form/options/output/info.
- `demo/`: fixture local chỉ dùng khi bật demo; test fixture riêng trong `test/`.
- App và selector: ưu tiên API thật, nhãn tương ứng, global busy/reset. History union đã có
  DES qua `CipherAlgorithm`; khi bật thật selector history có thể lọc `cipher=des`.
- Dockerfile/Compose: build arg `VITE_ENABLE_DES=false` mặc định.

Chạy dev với BE tương thích ở cổng 8000:

```bash
VITE_ENABLE_HILL=true VITE_ENABLE_DES=true npm run dev
```

Chạy integration từ checkout BE ghim (script build container riêng):

```bash
BACKEND_CONTEXT=/path/to/backend-at-31438eb npm run test:e2e:des:integration
```

PostgreSQL deploy phải chạy `alembic upgrade head` gồm migration `0003` cho DES history.
Build BE mới trước khi bật flag thật. Checkout sibling đã fast-forward tới `main`
`80b61b6` ngày 01/10/2026; stack local 18081 đã build lại với cả Hill và DES bật.

## 9. Acceptance và validation

Bắt buộc: vector HEX slide round trip, UTF-8/tiếng Việt round trip, CBC/IV, W01/W02/W03,
strict payload, file preview/download hai request, filename/BOM, invalid UTF-8/padding,
network retry, boundary bytes/key/IV/HEX, double submit/stale response/download cancellation,
draft/reset, desktop và 375 px. Demo vẫn phải qua bộ fixture và default flag off.

Nguồn oracle: guide/OpenSpec tại revision ghim; FE không tính DES để dựng expected result.
Vector `Hello World` + key `133457799BBCDFF1`: ECB → `B1CA74BB3514268701A9ACC3E4E69FAA`;
CBC IV `0000000000000000` → `B1CA74BB351426875F9A5BCA734D9EF4`. Raw HEX
`0123456789ABCDEF` → `85E813540F0AB405` với format HEX cả hai chiều.

Bằng chứng ngày 01/10/2026:

- **259/259** unit/component tests toàn repo đạt, gồm adapter DES strict payload/response,
  validation byte/key/IV/HEX và hook process/download/cancellation.
- **16/16** integration browser với BE thật `31438eb` trên desktop/375 px đạt: các vector
  Text/HEX/Unicode, CBC/IV, W01/W02/W03, file preview/download/BOM/filename, lỗi UTF-8/padding,
  network retry, local validation và theme tối. Backend chạy từ clone riêng trong `/tmp`;
  đây không phải bằng chứng Backend đang deploy hoặc checkout sibling đã được cập nhật.
- Regression demo: **7/7** ca áp dụng đạt; 5 project/test combination không áp dụng được skip.
- Lint, TypeScript/build, format các file triển khai và `git diff --check` đạt. Format toàn
  repo vẫn có bốn HTML tham chiếu chưa format từ trước; không chỉnh nội dung tài liệu nguồn.
- Đã xem ảnh DES thật desktop/375 px và dark theme; không có cuộn ngang trang.
- Integration chạy không PostgreSQL; chưa kiểm migration/history DES trên DB deploy.
  UI trace/16 vòng vẫn ngoài phạm vi đã chốt.

## 10. Xác nhận stack local 18081 sau cập nhật main

Ngày 01/10/2026: checkout sibling fast-forward `4505ef7` → `80b61b6`, build lại project
Compose `cipher-postgres-local` từ `.env.stage`, chạy migration `0003` thành công và bật cả
`VITE_ENABLE_HILL=true`, `VITE_ENABLE_DES=true`. Kiểm tra trực tiếp trên
`http://127.0.0.1:18081`: **20/20 Hill** và **16/16 DES** integration đạt ở desktop/375 px.
Hai suite chạy tuần tự với `--workers=1` và output riêng trong `/tmp` để tránh xung đột
artifact và rate limit Nginx. Cổng 8080 là stack khác; không được cập nhật trong thao tác này.

## 11. Phân tích thuật toán DES (02/10/2026)

Output có tab Văn bản / Phân tích, hỗ trợ phím mũi tên/Home/End. Bỏ bảng so sánh
ECB/CBC và ví dụ hai khối; giữ chọn chế độ để mã hóa/giải mã bình thường.

Phân tích gọi `POST /api/des/trace` khi mở tab sau một kết quả thật. Minh họa khối đầu:
text mã UTF-8 và PKCS#7; HEX lấy 16 ký tự đầu; file UTF-8 fatal decode và bỏ BOM đầu.
Encrypt CBC XOR khối bản rõ đầu với IV trước khi gọi trace. Decrypt gửi khối bản mã
đầu trực tiếp; đầu ra DES thô còn cần XOR IV khi CBC. Không tính DES ở FE.

Hiển thị 16 khóa con (PC-1, dịch trái C/D, PC-2), IP và L0/R0, bảng 16 vòng,
hàm f của vòng chọn (E, XOR khóa, 8 S-box, P), R16L16 và IP nghịch đảo. Giá trị
trung gian lấy từ BE; encrypt kiểm đầu ra trace khớp khối bản mã đầu đã xử lý.
Request trace bị hủy khi rời tab/thay kết quả; lỗi riêng có nút thử lại và không xóa
kết quả chính. Demo không gọi trace. Copy/download vẫn dùng toàn bộ kết quả chính.

Giữ thông tin số khối/dung lượng/padding từ snapshot, tối đa 16 khối bản mã hiển thị.
