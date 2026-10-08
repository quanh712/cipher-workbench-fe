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
source `229c69d7c9af8413a780002b266bdb7651e79cb4`. FE đã cập nhật riêng ngày 08/10/2026 để nối API và đồng bộ giao diện RSA; image local `2aed784d107dae506c59870fedabb4f98cf6c1482546731be6b719c6759afb2d` bật Hill/DES/RSA. Image này build từ workspace chưa commit, label `working-tree-rsa-mode-spacing-20261008`.

## Cài mới và cập nhật

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
