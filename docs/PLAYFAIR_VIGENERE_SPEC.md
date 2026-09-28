# Cipher Workbench — Tích hợp Vigenère và Playfair

## 1. Quyền ưu tiên

Tài liệu này mô tả kế hoạch và trạng thái Frontend. Nó không định nghĩa lại API.
Contract có thẩm quyền được ghim tại [`BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md);
nếu có khác biệt, completed OpenSpec và runtime Backend được ưu tiên.

Backend implementation `1792a29a8925dc7122ebbe62fe55caef14a00a18` cung cấp đủ 9 endpoint
cho Caesar, Vigenère và Playfair. Consumer guide tương ứng là commit `82c09f4`.

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

> Playfair chuẩn hóa thành chữ hoa ASCII, gộp J/I, loại định dạng; khi giải mã giữ filler X
> giữa chuỗi và bỏ filler cuối; kết quả không khôi phục nguyên văn đầu vào.

Luồng Playfair tuân theo:

- endpoint text/file tương ứng dưới `/api/playfair/...`;
- key và input normalize ASCII, `J→I`, matrix 5×5 bỏ `J`;
- encrypt dùng filler `X`, fallback `Q` khi va chạm với `X`;
- decrypt không pad, giữ filler ở giữa chuỗi và bỏ đúng một filler cuối theo quy tắc Backend
  (`XQ` → bỏ `Q`, nếu không thì `X` → bỏ `X`); từ chối ciphertext lẻ hoặc digraph trùng;
- vì không phân biệt được filler với chữ thật, plaintext có số chữ chẵn kết thúc bằng `X` có thể
  mất `X` cuối khi giải mã (`AX` → `A`); FE không tự phục hồi ký tự này;
- response chỉ có `success,result`; không chờ `matrix`, `digraphs` hoặc `normalizedInput` từ API;
- analysis matrix/digraph nếu có phải được tính như visualization, không thay result server.
- khi giải mã, analysis chỉ có thể gợi ý bỏ `X/Q` nằm giữa hai chữ giống nhau nếu tái chuẩn bị bản
  rõ gợi ý tạo lại đúng chuỗi digraph; không bỏ thêm ký tự cuối trên FE. Gợi ý không chắc chắn và
  không thay kết quả/copy/download từ BE.

## 5. File và lỗi dùng chung

- Giới hạn file: `5 * 1024 * 1024 = 5.242.880` byte.
- Chỉ `.txt`, UTF-8 thường hoặc có BOM; attachment giữ BOM iff input có BOM.
- Filename do server tạo: `.encrypted.txt` hoặc `.decrypted.txt`.
- Success JSON đúng hai trường `success,result`; error JSON đúng hai trường `success,message`.
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
- Sau checkpoint, dừng để review trước khi bật action Playfair.
