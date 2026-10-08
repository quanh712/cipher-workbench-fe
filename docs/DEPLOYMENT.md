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
        │ 127.0.0.1:18081
        ▼
Nginx FE container :8080
        ├── /, /assets/*          → React dist
        └── /api, /docs, OpenAPI  → FastAPI container :8000
                                      │
                                      ▼
                                  SQLite /data/cipher-history.sqlite3
```

FastAPI chỉ ở trong Docker network; không publish cổng `8000`.
SQLite là file local trong volume của Backend, không mở cổng database. Compose chạy migration Alembic trước khi Backend khởi động. Lịch sử là
metadata chung của toàn instance, không có tài khoản hay session.

## 2. Chuẩn bị VPS

Yêu cầu Docker Engine, Docker Compose plugin, Nginx, Certbot, `envsubst` (gói
`gettext-base`) và Git. Chỉ mở SSH, HTTP và HTTPS trên firewall; không mở `8000`
hoặc `18081` ra Internet.

Ví dụ với UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Tạo thư mục triển khai và clone hai repo cạnh nhau:

```text
/opt/Cipher-workbench/
├── cipher-workbench-fe/
└── cipher-workbench-be/
```

Backend revision đã đối chiếu cho contract DB/history hiện tại:

```text
229c69d7c9af8413a780002b266bdb7651e79cb4
```

`GET /api/history` không có xác thực, nên trên instance public giữ
`HISTORY_API_ENABLED=false` (giá trị mặc định trong Compose; cấu hình public đặt flag trong `.env.sqlite`). Backend mới cũng mặc định tắt
API đọc lịch sử; SQLite vẫn ghi metadata và tự xóa bản ghi quá 30 ngày.
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

Runtime chỉ dùng `.env.sqlite`, project `cipher-workbench-sqlite` và volume
`cipher-workbench-sqlite_history-data`. `docker-compose.yml` là symlink tới
`docker-compose.sqlite.yml`; không còn đường Compose riêng dùng `.env.deploy`.

Máy mới cần load image FE/BE đã pin và tạo `.env.sqlite` từ mẫu. Stack hiện tại
giữ env sẵn có. Instance public đặt `HISTORY_API_ENABLED=false` trong `.env.sqlite`.

```bash
./deploy/sqlite-stack.sh prepare-backups
./deploy/sqlite-stack.sh config --quiet
./deploy/sqlite-stack.sh up
./deploy/sqlite-stack.sh ps
```

Không build/restart BE khi chỉ cập nhật cấu hình FE. Migrate và Backend cùng mount
`history-data:/data`; migration là `alembic -c alembic_sqlite.ini upgrade head`.
Chạy đúng một Backend process. Backup service đọc DB và lưu mỗi giờ ngoài volume,
restore-verify từng snapshot và giữ 7 ngày; chi tiết ở
[SQLite operation](SQLITE_COMPOSE.md#backup-tự-động).

`.env.deploy` chỉ chứa `APP_DOMAIN` và `APP_HTTP_PORT` cho Nginx host/HTTPS.
Tạo từ `.env.deploy.example`, đặt domain thật và port bằng port runtime trong
`.env.sqlite`; không truyền file này cho Docker Compose.

## 4. Kiểm tra local production stack

```bash
./deploy/smoke-test.sh http://127.0.0.1:18081
curl --fail --show-error http://127.0.0.1:18081/api/health
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
./deploy/sqlite-stack.sh ps
./deploy/sqlite-stack.sh logs --tail=200 frontend
./deploy/sqlite-stack.sh logs --tail=200 backend
sudo journalctl -u nginx --since '30 minutes ago'
```

Backend health check dùng `/api/health` và xác nhận `result.database` là `ok`.
`database: disabled` cũng trả HTTP 200 nên chỉ kiểm tra HTTP status là không đủ.
Khi DB tạm lỗi, cipher vẫn xử lý nhưng lịch sử có thể thiếu bản ghi.

## 8. Update và rollback

Cập nhật riêng image digest đã kiểm chứng trong `.env.sqlite`, giữ project và
volume hiện hành, rồi chạy `./deploy/sqlite-stack.sh up`. Chỉ thay image BE nếu
đó là phạm vi đã được yêu cầu. Không dùng `build --pull` khi vận hành stack đã pin.

Rollback image bằng digest trước đó trong cùng env/project, sau khi kiểm tra
schema tương thích; giữ nguyên dữ liệu mới. Snapshot nằm ngoài runtime volume
và đã restore-verified, xem [hướng dẫn recovery](SQLITE_COMPOSE.md#phục-hồi).
Không tự chạy Alembic downgrade hoặc `down -v`.

## 9. Ngoài phạm vi

- Zero-downtime nhiều replica và load balancer.
- CI/CD hoặc publish image lên registry.
- Tài khoản, session, lịch sử riêng theo người dùng, xem lại nội dung cipher.
- Tự động triển khai theo `main`.
- Thêm thuật toán khi chưa có contract Backend được chấp nhận.
