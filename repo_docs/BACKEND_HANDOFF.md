# Cipher Workbench — Backend Handoff

## API contract

Tài liệu contract do FE tự đề xuất trước đây đã được ngừng sử dụng vì không còn khớp
Backend contract cho Caesar, Vigenère và Playfair đã accepted.

Nguồn tích hợp hiện tại:

- Tóm tắt và phiên bản ghim phía FE: [`../docs/BACKEND_CONTRACT.md`](../docs/BACKEND_CONTRACT.md)
- Handoff Backend tại guide commit `82c09f4`:
  <https://github.com/kiendt2312/caesar-cipher-be/blob/82c09f45c9c9c860850556de94c822554062dfc9/repo_docs/frontend-integration.md>
- OpenSpec trong repo Backend là nguồn có thẩm quyền cao nhất.

Không bổ sung API contract mới vào file này. Mọi behavior/API change phải được accepted ở
OpenSpec Backend trước, sau đó mới cập nhật reference phía FE.

## Runtime/deployment handoff

Cập nhật ngày `2026-10-08`: cấu hình runtime hiện hành nằm ở
[SQLite operation](../docs/SQLITE_COMPOSE.md) và [deployment](../docs/DEPLOYMENT.md).
Handoff LAN ngày 18/09/2026 đã được thay thế; không chạy lại Compose với `.env.deploy`
hoặc build BE chỉ để cập nhật FE.

- `docker-compose.yml` trỏ tới cấu hình SQLite; wrapper `deploy/sqlite-stack.sh` chọn
  project và `.env.sqlite` cố định. Stack integration dùng `--integration`.
- FE local bind `127.0.0.1:18081`, integration `127.0.0.1:18082`. BE chỉ expose
  `8000` nội bộ; FE gọi `/api` same-origin qua Nginx. Không cần đổi API/CORS.
- SQLite nằm trong volume `/data` của BE; frontend không mount DB. Backup đã kiểm
  phục hồi nằm ngoài volume runtime. Giữ nguyên image/source BE khi chỉ cập nhật FE.
- Health ứng dụng là `GET /api/health`; Compose xác nhận `result.database="ok"`.
  `/openapi.json` dùng đối chiếu contract; không có `GET /health`.
- `.env.deploy` chỉ dành cho Nginx host/HTTPS; không truyền cho Docker Compose.
- Cập nhật FE bằng digest đã kiểm thử, rồi `./deploy/sqlite-stack.sh up --no-deps frontend`.
  Không `down -v` hoặc rebuild toàn stack khi thay giao diện.

Nếu BE đổi cổng, health endpoint, prefix `/api`, giới hạn upload hay response contract,
cập nhật reference và kiểm regression trước khi thay image.
