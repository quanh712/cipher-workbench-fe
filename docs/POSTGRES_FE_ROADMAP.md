# Lộ trình FE cho nhánh PostgreSQL của BE

> Tài liệu lưu lại kế hoạch theo BE `9b75d576`. Contract hiện hành ở
> [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md) và BE `c314fa8`: `/api/health` có thêm
> `history: enabled|disabled`; khi cờ tắt, `/api/history` trả 404 trước khi xét DB.

Ngày cập nhật: 28/09/2026. Đối chiếu nhánh
[`feature/add-postgres-persistence`](https://github.com/kiendt2312/cipher_workbench-be/tree/feature/add-postgres-persistence)
tại commit `9b75d576f201f9df3c219fdc4f8f70834bd807ff`. Scope FE và cấu hình Compose
trong tài liệu này đã được triển khai trong working tree; chưa chuyển stack đang phục vụ trên
cổng 8080 sang revision mới.

## BE đã có gì

- PostgreSQL là tùy chọn qua `DATABASE_URL`. Khi không cấu hình hoặc DB lỗi, 15 API cipher vẫn
  xử lý như cũ. BE ghi metadata theo kiểu best effort, không để lỗi ghi DB đổi kết quả cipher.
- Mỗi **request** cipher, kể cả request lỗi, có thể sinh một bản ghi. Luồng file FE gọi preview
  rồi download là hai request và có thể có hai dòng lịch sử, phân biệt bằng `responseMode`.
- Chỉ lưu `id`, thời gian, thuật toán, thao tác, nguồn text/file, response mode, độ dài input/output,
  HTTP status, thành công/thất bại và thời lượng. Không lưu input, output, key, tên hay nội dung file.
- `GET /api/history` trả danh sách metadata mới nhất trước, mặc định 20 dòng, `limit` từ 1–100,
  cursor opaque, bộ lọc `cipher` và `operation`. Không có API detail, delete hoặc tạo lịch sử từ FE.
- `GET /api/health` cho biết DB `ok`, `disabled` hoặc `unavailable`. History trả 503 khi không có
  DB hoặc DB lỗi. API cipher hiện tại giữ nguyên request/response.
- Lịch sử hiện là **dữ liệu chung toàn instance, không có xác thực/phân quyền**. Ai truy cập được
  `/api/history` đều đọc được metadata của mọi request. Đây là quyết định sản phẩm và triển khai
  phải biết trước khi bật UI lịch sử trên môi trường công khai.
- BE có migration Alembic và Compose `db` + `migrate` + `app` cho chạy độc lập. Repo FE đang có
  Compose khác, hiện chỉ gồm frontend + backend; chưa có DB hay bước migration.

Nguồn chi tiết: [hướng dẫn FE của BE](https://github.com/kiendt2312/cipher_workbench-be/blob/9b75d576f201f9df3c219fdc4f8f70834bd807ff/repo_docs/frontend-integration.md),
[OpenSpec lịch sử](https://github.com/kiendt2312/cipher_workbench-be/blob/9b75d576f201f9df3c219fdc4f8f70834bd807ff/openspec/changes/add-postgres-persistence/specs/history-api/spec.md),
[middleware ghi lịch sử](https://github.com/kiendt2312/cipher_workbench-be/blob/9b75d576f201f9df3c219fdc4f8f70834bd807ff/app/api/history_recorder.py).

## Scope FE phù hợp nhánh BE

1. Tạo client/type cho `GET /api/health` và `GET /api/history`, kiểm tra HTTP status và envelope.
   Cursor lấy từ `nextCursor`, gửi lại nguyên văn; không tự tính trang.
2. Tạo một màn hình/khu vực **Lịch sử thao tác** với bảng metadata: thời gian địa phương,
   thuật toán, mã hóa/giải mã hoặc chưa xác định, text/file, preview/download, trạng thái, độ dài
   và thời lượng. Gọi đây là lịch sử **request**, không hứa mỗi lượt người dùng chỉ có một dòng.
3. Bộ lọc thuật toán và thao tác; nút `Tải thêm`; khi đổi bộ lọc thì bỏ cursor cũ và tải trang đầu.
   Xử lý loading, danh sách rỗng, 503, lỗi mạng và thử lại. Health `disabled` hiển thị chưa bật;
   `unavailable` hiển thị tạm thời lỗi, không chặn workspace cipher.
4. Làm mới danh sách khi mở lại khu vực lịch sử hoặc sau request cipher theo cách không gây gọi
   lặp. Phần cipher vẫn dùng API hiện có và luôn hiển thị kết quả do BE trả về.
5. Viết test service/UI và integration E2E với BE + DB cho phân trang, lọc, cả dòng thành công/lỗi,
   preview/download hai dòng, trạng thái DB mất kết nối và dữ liệu tồn tại sau restart.

Không có UI xem lại nội dung, dùng lại input/key, tải lại file, xóa bản ghi hoặc lịch sử riêng theo
user vì nhánh BE chưa có dữ liệu/API/quyền tương ứng. Các tính năng đó cần một change BE khác.

## Triển khai và dependency

- Dev FE có thể chạy Compose trong repo BE (BE ra cổng host `8080`) rồi trỏ Vite proxy `/api`
  về `8080`; hoặc chạy uvicorn ở `8000` với `DATABASE_URL` phù hợp. Chốt một cách trước khi viết
  hướng dẫn chạy tích hợp.
- Production hiện do Compose repo FE quản lý, chỉ có `frontend` và `backend`. Cần thống nhất với
  BE việc thêm `db`/`migrate` vào Compose FE hoặc dùng PostgreSQL bên ngoài, cùng volume, secret,
  backup và thứ tự khởi động. Không chạy đồng thời hai Compose cùng chiếm cổng host `8080`.
- Healthcheck BE hiện gọi `/openapi.json`, chỉ chứng minh app trả HTTP. Khi cần xác nhận DB,
  dùng contract mới `GET /api/health` và kiểm tra `result.database === "ok"`; trạng thái `disabled`
  trả HTTP 200 nên chỉ nhìn status code là chưa đủ.
- Không đưa `DATABASE_URL` hay mật khẩu DB vào `VITE_*`, browser hoặc repository. FE tiếp tục gọi
  URL tương đối `/api/...` qua same-origin proxy.
- Vì history đang mở cho toàn instance, quyết định về phạm vi truy cập phải được chủ sản phẩm chốt
  trước khi hiển thị trên môi trường có nhiều người dùng. Nếu muốn riêng tư theo người dùng,
  BE cần bổ sung auth/authorization trước khi FE bật màn hình đó.

## Thứ tự và ước lượng FE

Ước lượng ngày công một FE, sau khi BE contract/triển khai được chốt; không gồm công BE/ops.

| Mốc | Kết quả                                                                  | Ngày công FE |
| --- | ------------------------------------------------------------------------ | ------------ |
| P0  | Chốt phạm vi truy cập lịch sử và topology dev/production; ghim commit BE | 0,5–1        |
| P1  | Client/type health + history, test API contract                          | 0,5–1        |
| P2  | UI lịch sử metadata, lọc, tải thêm và các trạng thái                     | 1,5–2,5      |
| P3  | Integration E2E, regression cipher và hướng dẫn chạy FE + BE + DB        | 1–1,5        |

**Ước lượng ban đầu: 3,5–6 ngày công FE.** FE đã có UI và Compose DB/migration; phần cấu hình
secret và backup theo môi trường vẫn thuộc lúc triển khai. Lịch sử không có auth là quyết định
sản phẩm đã được người dùng xác nhận.

## Tiêu chí nghiệm thu

- FE chỉ đọc lịch sử qua `GET /api/history`, không tự gửi request ghi lịch sử.
- Bảng hiện đủ metadata và cả request lỗi; không hiển thị input/key/result không tồn tại trong DB.
- Cursor phân trang không lặp bản ghi; đổi filter tải lại trang đầu; timestamp UTC hiển thị theo
  giờ địa phương; `operation` và độ dài `null` có nhãn hợp lý.
- Khi history 503 hoặc health báo `disabled`/`unavailable`, các thao tác cipher vẫn dùng được.
- File preview và download được thể hiện đúng là hai request nếu BE ghi cả hai.
- Test với DB thật xác nhận record tồn tại sau restart; kiểm tra riêng migration và backup/restore
  trong quy trình triển khai.

## Kết quả kiểm thử trong workspace

- Compose project riêng `cipher-postgres-verify` đã build FE + BE commit `9b75d576` + PostgreSQL 17.
  Migration Alembic thành công; smoke test qua Nginx FE ở cổng thử `18080` đọc được health/history.
- 19/19 browser integration tests đạt với BE + PostgreSQL thật; 177 unit/component tests, lint,
  typecheck và production build đạt. Kiểm tra giao diện 390 px không có tràn ngang.
- Bản ghi `id=6` vẫn còn sau khi restart riêng BE. Khi tạm dừng DB, health/history trả 503,
  Caesar encrypt vẫn trả 200; UI báo lịch sử lỗi và vẫn xử lý cipher. Khởi động lại DB trả `ok`.
- `npm run check` bị chặn ở format check bởi `affine-cipher.html` chưa được format từ trước và
  không thuộc thay đổi này. Prettier trên các file được sửa đều đạt.
- Stack đang phục vụ trên cổng `8080` dùng BE image cũ; chưa được chuyển sang cấu hình DB mới.
