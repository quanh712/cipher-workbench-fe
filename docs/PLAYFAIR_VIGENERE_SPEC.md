# Cipher Workbench — Tích hợp Vigenère và Playfair

## 1. Quyền ưu tiên

Tài liệu này mô tả kế hoạch và trạng thái Frontend. Nó không định nghĩa lại API.
Contract có thẩm quyền được ghim tại [`BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md);
nếu có khác biệt, completed OpenSpec và runtime Backend được ưu tiên.

Backend SQLite hiện hành được ghim tại `229c69d7c9af8413a780002b266bdb7651e79cb4`.
Đối chiếu Playfair ngày 08/10/2026 với `routes_additional_text.py`,
`routes_additional_file.py` và `app/core/playfair.py` trong checkout BE sibling.
Mốc `1792a29` / consumer guide `82c09f4` là checkpoint tích hợp cũ, không mô tả
semantics padding hiện hành.

## 2. Kiến trúc và state dùng chung

- Một workspace với selector `caesar | vigenere | playfair`, không thêm router.
- Mỗi thuật toán giữ draft text/file/key riêng trong phiên.
- Đổi thuật toán, mode, nguồn, input hoặc key xóa result, analysis và notice cũ.
- Transport JSON, multipart, envelope và attachment dùng chung; hook, validation và
  visualization theo thuật toán vẫn tách riêng.
- Result production luôn lấy từ Backend. Visualization chỉ giải thích input/result.
- File preview dùng `response_mode=content`; download gửi lại file gốc bằng request thứ hai với
  `response_mode=file`.
- Không có runtime mock, local cipher service hoặc hard-coded Backend URL.

## 3. Checkpoint Vigenère

Vigenère là vertical slice đầu tiên sau Caesar:

- Text: `POST /api/vigenere/encrypt|decrypt` với JSON `{text,key}`; cả hai field là string.
- File: `POST /api/vigenere/file` với `file`, raw `key`, `action` và `response_mode`.
- Key không rỗng và phải khớp toàn bộ `[A-Za-z]+`; FE không trim hoặc tự sửa key.
- Chỉ ASCII letter biến đổi và tiêu thụ key. Case được giữ; Unicode, số, dấu câu, whitespace và
  CRLF được giữ nguyên và không làm key tiến.
- Ví dụ chính thức: `Attack at dawn!` + `LEMON` → `Lxfopv ef rnhr!`.
- Tab Phân tích hiển thị key uppercase logic, thống kê toàn input và key stream tối đa 200 ký tự;
  ký tự không tiêu thụ key được đánh dấu `·`.
- FE validation sơ bộ: text khác rỗng; key đúng regex; file `.txt` không phân biệt hoa thường,
  khác 0 byte và tối đa đúng 5 MiB. Backend vẫn là authority cho UTF-8 và precedence.
- Unit, component test dùng mock fetch ở test boundary; Playwright integration gọi Backend thật.

## 4. Playfair

Playfair dùng Backend thật cho text và file. UI luôn giải thích semantics đã chốt:

> Playfair chuẩn hóa thành chữ hoa ASCII, gộp J/I và loại định dạng. Khi giải mã,
> Backend giữ mọi filler trong bản thô và trả thêm thông tin lọc ký tự đệm. Bộ lọc có thể
> bỏ nhầm X/Q thật; kết quả không khôi phục nguyên văn đầu vào.

Luồng Playfair tuân theo:

- Endpoint text/file tương ứng dưới `/api/playfair/...`; key và input normalize ASCII,
  `J→I`, matrix 5×5 bỏ `J`.
- Encrypt dùng filler `X`, fallback `Q` khi ký tự trước là `X`.
- Decrypt không pad hoặc tự xóa filler khỏi `result`; từ chối ciphertext lẻ hoặc digraph trùng.
- Encrypt trả `{success,result}`. Decrypt text và file preview trả
  `{success,result,padding:{count,positions,filtered}}`; `result` là bản thô đủ cặp chữ.
  `positions` là chỉ số bắt đầu từ 0 trong bản thô, không phải ciphertext.
- BE chỉ đánh dấu ký tự thứ hai của cặp: `X` (hoặc `Q` sau `X`) khi ở cuối chuỗi hoặc
  nằm giữa hai ký tự giống nhau. Đây là nhận dạng theo mẫu, không chứng minh ký tự đó
  đã được chèn khi mã hóa. Ví dụ bản thô `AX` có thể được lọc thành `A` dù `X` là chữ thật.
- FE mặc định bật **Tự động lọc ký tự đệm** và hiển thị `padding.filtered`; tắt lọc để
  hiển thị nguyên `result`. Tab Phân tích cho xem bản thô, bản đã lọc và ánh xạ digraph
  bằng bản thô. Matrix/digraph chỉ là visualization, không thay kết quả server.
- Copy và download text dùng đúng bản đang chọn hiển thị. File preview luôn nhận bản thô
  cùng `padding`; download gửi lại file gốc với `response_mode=file` và `strip_padding`
  dưới dạng chuỗi `"true"` / `"false"` theo checkbox. BE mặc định `strip_padding=false`
  nếu field bị bỏ qua. Attachment giữ BOM theo input.
- FE không tự đoán hoặc tính một bộ lọc X/Q khác, không chờ `matrix`, `digraphs` hay
  `normalizedInput` trong response.

## 5. File và lỗi dùng chung

- Giới hạn file: `5 * 1024 * 1024 = 5.242.880` byte.
- Chỉ `.txt`, UTF-8 thường hoặc có BOM; attachment giữ BOM iff input có BOM.
- Filename do server tạo: `.encrypted.txt` hoặc `.decrypted.txt`.
- Success Vigenère và Playfair encrypt có `success,result`. Playfair decrypt text/preview
  có thêm `padding` như mục 4; error JSON dùng `success,message`.
- FE hiển thị nguyên văn Backend `message` hợp lệ nhưng không branch business theo message.
- Trong loading, khóa mọi control có thể đổi/gửi request; lỗi request hoặc download xóa result cũ.

## 6. Definition of Done cho checkpoint Vigenère

- Caesar regression vẫn xanh và chỉ dùng Backend result.
- Vigenère encrypt/decrypt text đúng vector chính thức.
- Vigenère preview/download file tạo đúng hai request và dùng filename server.
- Draft riêng, stale-result clearing, loading lock, keyboard, focus và live region hoạt động.
- Format, lint, TypeScript, unit/component test và production build đạt.
- Playwright integration đạt với Backend thật được khởi động từ sibling repo bằng Docker trên cổng
  riêng, không tái sử dụng service dev không xác định ở cổng 8000.
- Checkpoint Vigenère đã hoàn tất; Playfair hiện đã bật và dùng contract padding tại mục 4.
