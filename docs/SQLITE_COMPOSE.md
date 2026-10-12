# Vận hành SQLite

Nguồn cấu hình duy nhất là `docker-compose.sqlite.yml`; `docker-compose.yml` là
symlink tới cùng file. Script `deploy/sqlite-stack.sh` luôn chọn đúng project và
env, kể cả khi chạy từ thư mục khác hoặc shell có `COMPOSE_PROJECT_NAME` khác.

| Môi trường  | Project                               | Env                       | Volume                                             | Cổng  | Backup host                   |
| ----------- | ------------------------------------- | ------------------------- | -------------------------------------------------- | ----- | ----------------------------- |
| Local       | `cipher-workbench-sqlite`             | `.env.sqlite`             | `cipher-workbench-sqlite_history-data`             | 18081 | `backups/sqlite/local/`       |
| Integration | `cipher-workbench-sqlite-integration` | `.env.sqlite.integration` | `cipher-workbench-sqlite-integration_history-data` | 18082 | `backups/sqlite/integration/` |

Frontend không mount DB; migrate/backend dùng cùng volume `/data`. Backend giữ
image `c3332dd77a66c98e6dacb28666332501b6946f6414a36283347d95dd232677ae`,
source `229c69d7c9af8413a780002b266bdb7651e79cb4`. FE đã cập nhật riêng ngày 08/10/2026 để nối API và đồng bộ giao diện RSA; image local `21fd5f2e9ebcc2056d9abb64957b484779831cfbc7f5aab7bd11ab3975e23dd5` bật Hill/DES/RSA. Image này build từ archive Git của commit `175219d5626414329645a8b40049c04c36ff0136`, label revision khớp commit đó; không lấy các file chưa commit trong workspace.

Ngày 10/10/2026, frontend local đã chuyển sang image
`cipher-workbench-frontend:local-dh-docker-optimized-20261010` qua override DH.
Image build từ workspace tại thời điểm tối ưu Docker; đây không phải image release
08/10 ở trên. Frontend integration và demo đã được xóa sau kiểm thử, đóng cổng
`18082` và `18084`; các backend, volume và backup vẫn được giữ nguyên.

Ngày 12/10/2026, backend/backup integration và backend legacy
`cipher-workbench-backend-1` đã được dừng để giảm RAM. Container, image và
volume vẫn được giữ; frontend local tiếp tục dùng backend SQLite cho API chung
và backend `cipher-workbench-be-app-1` cho RSA signature/DH.

## RAM khi vận hành local

Đo bằng `docker stats --no-stream` ngày 12/10/2026: tổng RAM của các container
đang chạy giảm từ khoảng 454 MiB (7 container) xuống 237–242 MiB (4 container),
giảm khoảng 47–48% (đo trước và sau kiểm thử RSA/DH). Đây là số đo tại thời điểm kiểm tra, không phải peak khi tải cao
hay tổng RAM của máy ảo Docker Desktop.

Các container đã dừng:

- `cipher-workbench-backend-1`: backend legacy, network không có frontend.
- `cipher-workbench-sqlite-integration-backend-1`: backend kiểm thử, không có frontend.
- `cipher-workbench-sqlite-integration-backup-1`: backup của DB kiểm thử đã dừng ghi.

Giữ frontend local, hai backend mà cấu hình proxy hiện tại sử dụng và backup
SQLite local. Không giảm memory limit của backend: giới hạn 512 MiB là trần,
không phải RAM được cấp phát sẵn; backend RSA/DH đã từng bị OOM theo
[recovery record](TAILSCALE_RSA_RECOVERY_20261011.md).

Các container dừng có restart policy `unless-stopped`, nên không tự bật lại
sau restart Docker. Khi cần dùng integration, bật lại các container hiện có:

```bash
docker start cipher-workbench-sqlite-integration-backend-1 cipher-workbench-sqlite-integration-backup-1
./deploy/frontend.sh integration up
```

Sau khi kiểm thử xong, dừng frontend trước rồi dừng backend/backup integration:

```bash
./deploy/frontend.sh integration stop
docker stop cipher-workbench-sqlite-integration-backend-1 cipher-workbench-sqlite-integration-backup-1
```

Chỉ bật backend legacy nếu cần kiểm tra riêng bằng
`docker start cipher-workbench-backend-1`; ứng dụng local hiện tại không dùng nó.
Các lệnh Compose `up` có thể bật lại service đã dừng; đo lại bằng
`docker stats --no-stream` sau khi vận hành các stack.

## Cài mới và cập nhật

### Quản lý cổng frontend

Cổng host của các frontend được khai báo chung tại
`deploy/frontend-ports.env`: local `18081`, integration `18082`, demo `18084`.
Mặc định tất cả bind `127.0.0.1`; Nginx trong container vẫn nghe `8080`.
`deploy/sqlite-stack.sh` cũng đọc cấu hình cổng này, thay cho các giá trị
`APP_BIND_ADDRESS`/`APP_HTTP_PORT` cũ trong env SQLite.

```bash
./deploy/frontend.sh local url
./deploy/frontend.sh integration ps
./deploy/frontend.sh demo ps
./deploy/frontend.sh local up
```

Sau khi đổi cổng, chạy `./deploy/frontend.sh <local|integration|demo> up`
cho frontend tương ứng. Script kiểm tra cổng hợp lệ và không trùng nhau,
chỉ cập nhật service frontend bằng `--no-deps`, không build/pull image.
Frontend local giữ override DH; demo dùng `deploy/docker-compose.demo.yml`
và image demo hiện có, mount cấu hình `deploy/nginx.demo.conf` để nối đúng BE DH.
Các backend, database và backup không bị cập nhật. Lệnh `integration up` hoặc
`demo up` sẽ tạo lại frontend thử nghiệm và mở lại cổng tương ứng.

Nếu dùng Nginx host/HTTPS, đồng bộ `APP_HTTP_PORT` trong `.env.deploy`
với cổng local rồi render lại cấu hình host theo `docs/DEPLOYMENT.md`.

### Vận hành stack SQLite

Chỉ copy `.env.sqlite.example` khi env chưa tồn tại. Máy khác cần load các image
đã pin trước khi khởi động. Không copy đè env của stack hiện tại.

```bash
./deploy/sqlite-stack.sh prepare-backups
./deploy/sqlite-stack.sh config --quiet
./deploy/sqlite-stack.sh up
./deploy/sqlite-stack.sh ps
```

Tương đương: `docker compose -p cipher-workbench-sqlite --env-file .env.sqlite up -d --no-build`.
Không dùng `.env.deploy` để chạy Compose. `DATABASE_URL` là SQLite local dưới
`/data`; baseline `sqlite_0001`, một Backend process.

Stack thử chọn tường minh bằng `--integration`:

```bash
./deploy/sqlite-stack.sh --integration prepare-backups
./deploy/sqlite-stack.sh --integration up
```

## Backup tự động

Service `backup` dùng image Backend hiện có, không sửa source/image ứng dụng.
Container không có network, đọc volume DB read-only; ghi snapshot vào bind mount
trên host, ngoài volume runtime. Backup dùng SQLite Online Backup API.

- Lần đầu chạy ngay khi service khởi động, sau đó mỗi 3600 giây.
- Mỗi snapshot được kiểm tra integrity/schema/count/ID digest/sequence, restore
  vào file riêng và đối soát bằng tooling BE hiện có.
- Chỉ snapshot đã restore-verified mới được publish bằng rename; retention chỉ
  chạy sau backup thành công và luôn giữ ít nhất snapshot thành công mới nhất.
- Snapshot quá 7 ngày được dọn riêng trong thư mục backup của từng môi trường.
- Quyền directory `700`, snapshot/evidence `600`; `backups/` bị gitignore và dockerignore.

Cấu hình trong env: `SQLITE_BACKUP_DIRECTORY`, `SQLITE_BACKUP_INTERVAL_SECONDS`,
`SQLITE_BACKUP_RETENTION_DAYS`, `SQLITE_BACKUP_UID/GID`. UID/GID phải khớp user
sở hữu thư mục host; mặc định trên máy này là `1000:1000`. `prepare-backups` tạo
thư mục bằng user hiện tại; không để Docker tự tạo thư mục root-owned.

```bash
./deploy/sqlite-stack.sh backup
./deploy/sqlite-stack.sh logs --tail=20 backup
./deploy/sqlite-stack.sh ps
```

`status.json` ghi snapshot cuối cùng, thời điểm, số row, digest và restore status.
Docker health của backup báo unhealthy nếu lần backup thất bại hoặc snapshot
quá hạn lịch + 300 giây. Lỗi được retry sau tối đa 300 giây.

Backup vẫn chạy khi Docker restart; lịch chỉ chạy khi Docker Desktop/Engine
đang hoạt động. Muốn chuyển backup sang máy khác, copy snapshot đã hoàn tất.

## Phục hồi

Chọn một thư mục `snapshot-*` đã có `evidence.json` verified. Giữ nguyên snapshot;
restore vào file mới bằng `app.history.continuity restore`, dùng `manifest_digest`
trong evidence và `--schema-revision sqlite_0001`. Verify trên file riêng trước
khi dừng Backend và thay runtime. Xem [runbook BE](../../cipher-workbench-be/docs/sqlite-history-runbook.md).
Không chạy destructive downgrade hoặc `down -v` trên volume có dữ liệu.

## Kiểm tra

```bash
curl --fail http://127.0.0.1:18081/api/health
./deploy/smoke-test.sh http://127.0.0.1:18081
```

Health database phải `ok`; API history chỉ bật nội bộ. Frontend pin giữ feature
flags và proxy `/api`; không cần restart ứng dụng khi chỉ thêm backup service.
History local bắt đầu rỗng theo [cutover](SQLITE_EMPTY_HISTORY_CUTOVER.md);
PostgreSQL đã retire và BE cleanup đã hoàn tác theo [record](POSTGRES_REMOVAL_20261008.md).
