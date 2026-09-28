# Cipher Workbench — Production Deployment

Tài liệu này triển khai React và FastAPI cùng origin trên một VPS. Docker Compose
chỉ bind ứng dụng vào loopback; Nginx cài trên VPS là cổng Internet duy nhất và
quản lý HTTPS.

## 1. Topology

```text
Internet :80/:443
        │
        ▼
Nginx host + Let's Encrypt
        │ 127.0.0.1:8080
        ▼
Nginx FE container :8080
        ├── /, /assets/*          → React dist
        └── /api, /docs, OpenAPI  → FastAPI container :8000
                                      │
                                      ▼
                                  PostgreSQL :5432
```

FastAPI và PostgreSQL chỉ ở trong Docker network; không publish cổng `8000` hoặc
`5432`. Compose chạy migration Alembic trước khi Backend khởi động. Lịch sử là
metadata chung của toàn instance, không có tài khoản hay session.

## 2. Chuẩn bị VPS

Yêu cầu Docker Engine, Docker Compose plugin, Nginx, Certbot, `envsubst` (gói
`gettext-base`) và Git. Chỉ mở SSH, HTTP và HTTPS trên firewall; không mở `8000`
hoặc `8080` ra Internet.

Ví dụ với UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Tạo thư mục triển khai và clone hai repo cạnh nhau:

```text
/opt/cipher-workbench/
├── caesar-cipher-fe/
└── caesar-cipher-be/
```

Backend revision đã đối chiếu cho contract DB/history hiện tại:

```text
c314fa87bb87ad42ea10cd4fd96889ca176bfe26
```

`GET /api/history` không có xác thực, nên trên instance public giữ
`HISTORY_API_ENABLED=false` (giá trị mặc định trong Compose và `.env.deploy.example`). Backend mới cũng mặc định tắt
API đọc lịch sử; PostgreSQL vẫn ghi metadata và tự xóa bản ghi quá 30 ngày.
Chỉ bật API đọc trên stack dev/nội bộ được giới hạn truy cập.

Để nghiệm thu lịch sử ở stack **nội bộ** với BE revision đã ghim, đặt
`HISTORY_API_ENABLED=true` trong env file riêng của stack đó, recreate riêng `backend`,
rồi chạy `PLAYWRIGHT_BASE_URL=http://127.0.0.1:18081 REQUIRE_SERVER_HISTORY=1 npm run test:e2e:integration`
(đổi cổng nếu stack dùng cổng khác).
Không dùng env file nội bộ này cho stack public; biến `REQUIRE_SERVER_HISTORY=1` khiến test
thất bại nếu history chưa bật thay vì âm thầm skip.

Checkout SHA đã duyệt ở từng repo. Không deploy trực tiếp một nhánh đang di chuyển
như `main`. Trước khi build, cả hai lệnh sau phải không in ra nội dung:

```bash
git status --short
git diff --check
```

## 3. Cấu hình và chạy Compose

Trong repo FE:

```bash
cp .env.deploy.example .env.deploy
```

Điền domain thật, SHA FE/BE, đường dẫn `BACKEND_CONTEXT`, `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB` và `DATABASE_URL`. Mật khẩu trong URL phải
khớp `POSTGRES_PASSWORD` và được URL-encode nếu có ký tự đặc biệt. Dùng secret
riêng của môi trường, không commit `.env.deploy`. Domain phải thuộc
quyền quản lý DNS của người triển khai. Không dùng giá trị mẫu
`cipher.example.com` ngoài tài liệu.

Kiểm tra và khởi động:

```bash
./deploy/verify-revisions.sh .env.deploy
docker compose --env-file .env.deploy config
docker compose --env-file .env.deploy build --pull
docker compose --env-file .env.deploy up -d
docker compose --env-file .env.deploy ps
```

`frontend` chỉ bind `${APP_BIND_ADDRESS}:${APP_HTTP_PORT}`, mặc định là
`127.0.0.1:8080`. Backend chỉ tồn tại trong Docker network. Hai container dùng
`restart: unless-stopped`, log rotation `10 MiB × 3` và health check riêng.
`db` dùng volume `postgres_data`; `migrate` chạy `alembic upgrade head` sau khi
DB healthy, Backend chỉ chạy sau khi migration thành công. Không dùng
`docker compose down -v` trên môi trường có dữ liệu cần giữ.

## 4. Kiểm tra local production stack

```bash
./deploy/smoke-test.sh http://127.0.0.1:8080
curl --fail --show-error http://127.0.0.1:8080/api/health
```

Script kiểm tra UI, OpenAPI, Caesar/Affine/Columnar text transform, file preview, file download và
filename attachment. Nếu `health.result.history` là `enabled`, script kiểm tra thêm một bản ghi
Caesar; nếu là `disabled`, script xác nhận `/api/history` trả 404. Sau đó kiểm thử thủ công trên
trình duyệt nếu cần.

Có thể chạy toàn bộ browser integration test trực tiếp vào production stack:

```bash
npm run test:e2e:production
```

## 5. DNS và HTTPS

Tạo bản ghi DNS `A`/`AAAA` của `${APP_DOMAIN}` trỏ tới VPS. Trên VPS, export hai
biến đã điền trong `.env.deploy`:

```bash
set -a
. ./.env.deploy
set +a
```

Tạo ACME webroot và render cấu hình bootstrap:

```bash
sudo mkdir -p /var/www/certbot
envsubst '${APP_DOMAIN} ${APP_HTTP_PORT}' \
  < deploy/nginx/bootstrap.conf.template \
  | sudo tee /etc/nginx/sites-available/cipher-workbench.conf > /dev/null
sudo ln -sfn /etc/nginx/sites-available/cipher-workbench.conf \
  /etc/nginx/sites-enabled/cipher-workbench.conf
sudo unlink /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Xin chứng chỉ:

```bash
sudo certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --domain "$APP_DOMAIN"
```

Sau khi có chứng chỉ, render cấu hình HTTPS production đè lên file bootstrap:

```bash
envsubst '${APP_DOMAIN} ${APP_HTTP_PORT}' \
  < deploy/nginx/production.conf.template \
  | sudo tee /etc/nginx/sites-available/cipher-workbench.conf > /dev/null
sudo nginx -t
sudo systemctl reload nginx
```

Copy `deploy/certbot/reload-nginx.sh` vào
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`, cấp quyền execute và kiểm
tra renewal:

```bash
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

Chỉ cấu hình HTTPS mới bật HSTS. Không bật HSTS trong bước bootstrap.

## 6. Giới hạn và bảo vệ

- Nginx nhận request tối đa `65m`, để Backend giữ quyền trả lỗi nghiệp vụ 5 MiB
  và trần request 64 MiB.
- Text API giới hạn `10 request/giây/IP`, burst `20`.
- File API giới hạn `2 request/giây/IP`, burst `4`.
- Swagger/OpenAPI giới hạn `5 request/giây/IP`, burst `10`.
- Vượt giới hạn trả JSON HTTP `429` bằng tiếng Việt.
- Chỉ Nginx host được tin là reverse proxy. Nếu thêm Cloudflare, phải cấu hình
  riêng danh sách IP được tin cậy trước khi dùng địa chỉ forwarded để rate-limit.

## 7. Logs và chẩn đoán

```bash
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy logs --tail=200 frontend
docker compose --env-file .env.deploy logs --tail=200 backend
sudo journalctl -u nginx --since '30 minutes ago'
```

Backend health check dùng `/api/health` và xác nhận `result.database` là `ok`.
`database: disabled` cũng trả HTTP 200 nên chỉ kiểm tra HTTP status là không đủ.
Khi DB tạm lỗi, cipher vẫn xử lý nhưng lịch sử có thể thiếu bản ghi.

## 8. Update và rollback

Week 1 chấp nhận gián đoạn ngắn khi thay container. Quy trình update:

1. Xác nhận working tree hai repo sạch.
2. Fetch và checkout đúng SHA đã duyệt cho FE và BE.
3. Cập nhật `FRONTEND_REVISION`, `BACKEND_REVISION` và image tag trong
   `.env.deploy`.
4. Chạy lại `build --pull`, `up -d` và toàn bộ smoke test.
5. Ghi lại hai SHA đang chạy trong nhật ký release.

Rollback ứng dụng bằng cách checkout lại cặp SHA release trước, phục hồi các giá
trị trong `.env.deploy`, rebuild và chạy `up -d`. Không chạy Alembic downgrade
tự động khi rollback: kiểm tra schema tương thích với BE cũ trước. Sao lưu volume
PostgreSQL theo lịch và thử phục hồi định kỳ; restart container không thay thế backup.

## 9. Ngoài phạm vi

- Zero-downtime nhiều replica và load balancer.
- CI/CD hoặc publish image lên registry.
- Tài khoản, session, lịch sử riêng theo người dùng, xem lại nội dung cipher.
- Tự động triển khai theo `main`.
- Thêm thuật toán khi chưa có contract Backend được chấp nhận.
