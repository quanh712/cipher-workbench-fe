# SQLite integration — 07/10/2026

## Stack được kiểm tra

- Project riêng: `cipher-workbench-sqlite-integration`, Compose `docker-compose.sqlite.yml`,
  env local `.env.sqlite.integration` (gitignored).
- Frontend: `127.0.0.1:18082`; proxy same-origin `/api` tới `backend:8000`.
- Volume mới: `cipher-workbench-sqlite-integration_history-data`, mount `/data`
  cho migrate/backend, không import history cũ.
- `DATABASE_URL=sqlite+aiosqlite:////data/cipher-history.sqlite3`,
  `HISTORY_API_ENABLED=true`, retention 30 ngày.
- BE digest `c3332dd77a66c98e6dacb28666332501b6946f6414a36283347d95dd232677ae`,
  build từ source sạch `229c69d7c9af8413a780002b266bdb7651e79cb4`.
- FE digest `43c9a61d51bfd88ed190b30549ec150155463ba0d8425012e5db67fc9517293f`,
  dùng đúng image cũ để giữ feature flags. Thay đổi history ở FE source vừa sửa
  chưa được build vào image này; kiểm chứng source đó là bộ unit/component 52 tests
  đã chạy ở bước trước, không phải bằng chứng browser của image mới.

## Kết quả

| Kiểm tra                                               | Kết quả                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Migration `alembic -c alembic_sqlite.ini upgrade head` | Exit 0; backend/frontend healthy                                                 |
| Browser cipher cơ bản và history                       | 28/28 đạt, history bắt buộc bật (`REQUIRE_SERVER_HISTORY=1`)                     |
| Browser Hill, desktop và 375px                         | 19/20 lượt đầu; ca còn lại đạt khi chạy lại riêng                                |
| Browser DES, desktop và 375px                          | 20/20 đạt                                                                        |
| Caesar API round-trip                                  | `ABC -> DEF -> ABC`                                                              |
| RSA API round-trip                                     | Number `88 -> 11 -> 88`; có metadata history `cipher=rsa`                        |
| History filter/cursor                                  | `cipher=caesar&operation=encrypt&limit=1`; cursor trang sau hợp lệ, ID khác nhau |
| Metadata history                                       | 128 rows, không trùng ID, đúng 11 field contract, không payload/key              |
| Backend restart                                        | 128 rows còn nguyên; toàn bộ metadata và thứ tự trước/sau bằng nhau              |
| Health stack cũ `18081` sau thử                        | HTTP 200, database `ok`, history `enabled`                                       |

Snapshot metadata trước restart được giữ tại
`test-results/sqlite-integration/history-before-restart.json` (gitignored).
SHA-256 của snapshot:
`e084087b42947431422d9ca201f738644afdaaec2b40659b4ba5792d7e9fee5f`.
Phép kiểm sau restart đọc tất cả trang history và so sánh exact JSON metadata
với snapshot, không chỉ kiểm count/health.

Lỗi Hill ban đầu là ENOENT khi đóng browser context/ghi trace: hai suite dùng chung
output Playwright. Ca desktop `matrix m=3` được chạy lại với output riêng
`/tmp/cipher-sqlite-hill-recheck` và đạt. Không sửa cipher để ép test qua.
Đọc snapshot với trang nhỏ ban đầu chạm Nginx HTTP 429; sau đó dùng `limit=100`
trong contract, không đổi rate limit.

## Lệnh chính đã chạy

Từ thư mục FE, tất cả dùng project/env thử riêng:

```bash
docker compose -p cipher-workbench-sqlite-integration -f docker-compose.sqlite.yml --env-file .env.sqlite.integration up -d --no-build --wait --wait-timeout 90
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18082 REQUIRE_SERVER_HISTORY=1 npm run test:e2e:integration -- --workers=1
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18082 npm run test:e2e:hill:integration -- --workers=1
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18082 npm run test:e2e:des:integration -- --workers=1
PLAYWRIGHT_BASE_URL=http://127.0.0.1:18082 npm run test:e2e:hill:integration -- --workers=1 --project=desktop --grep 'matrix m=3' --output=/tmp/cipher-sqlite-hill-recheck
docker compose -p cipher-workbench-sqlite-integration -f docker-compose.sqlite.yml --env-file .env.sqlite.integration restart backend
```

Nếu chạy lại nhiều suite cùng lúc, cấp `--output` riêng cho mỗi suite.
Lượt chạy mới tạo thêm rows; 128 là kết quả của lượt này, không phải baseline cố định.

## Trạng thái sau thử và điều kiện rollout

Stack thử còn chạy ở `18082` để review; volume dữ liệu thử được giữ nguyên. Stack
PostgreSQL/FE cũ ở `18081` vẫn chạy cùng image/cổng như trước, không transfer,
restart hoặc retire tài nguyên cũ.

Muốn giữ history cũ khi rollout: BE cần freeze writer nguồn, backup/restore thử,
transfer vào SQLite staging, đối soát ID/count/sequence/UTC/digest và publish theo
[runbook](../../cipher-workbench-be/docs/sqlite-history-runbook.md) trước cutover.
Kết quả integration trên volume mới không thay thế bước transfer hoặc đối soát
PostgreSQL thực tế. Backup/restore production và rollout cổng `18081` chưa thực hiện.

## Backup/restore rehearsal và quyết định cuối

User đã xác nhận **history mới bắt đầu rỗng**, không transfer PostgreSQL, giữ nguyên
UI/image FE/feature flags/proxy `/api`/port `18081`. Đoạn transfer phía trên chỉ áp
dụng nếu sau này thay đổi quyết định này. Rollout `18081` chưa thực hiện.

Backup live trên stack thử dùng `app.history.continuity.backup_sqlite_live`
(SQLite Online Backup API). Restore dùng `restore_sqlite_backup` vào file khác,
không replace runtime; schema `sqlite_0001` được kiểm tra qua `verify_staging`.

| Kiểm tra thêm                                       | Kết quả                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| SQLite runtime                                      | 3.46.1                                                                           |
| Backup và restore                                   | Đạt; 128 rows, sequence 128                                                      |
| Quick/integrity/schema/constraints/index check      | Đạt                                                                              |
| Đối soát                                            | Toàn bộ rows và thứ tự bằng nhau; sequence bằng nhau                             |
| Đọc filter/cursor trên bản restore                  | Hai trang Caesar encrypt trả ID khác nhau                                        |
| Migration trên container mới không mount dữ liệu cũ | `sqlite_0001`, 0 rows, integrity `ok`                                            |
| UI image cũ so với stack thử                        | Cùng image ID `43c9a61d51bfd88ed190b30549ec150155463ba0d8425012e5db67fc9517293f` |
| Health sau rehearsal                                | `18081` và `18082`: database `ok`, history `enabled`                             |

Manifest digest backup và restore cùng là
`6d148e33fdb4af91777855a3635bb9f80402b814bea2f8f2ff7f3c23c21a4bb6`.
Backup, bản phục hồi và `evidence.json` đã xuất ra ngoài runtime volume tại
`test-results/sqlite-integration/backup-restore-20261007/` (gitignored, quyền riêng tư).
Đã giữ archive `test-results/sqlite-integration/backup-restore-20261007.tar.gz`.
File SHA-256 có thể khác nhau do bố trí trang SQLite; đối soát dùng canonical
manifest và rows/sequence, không dùng binary file digest thay cho data digest.

Rehearsal dùng dữ liệu thử, không phải backup production PostgreSQL. Volume đích
`cipher-workbench-sqlite_history-data` chưa tồn tại tại thời điểm kiểm tra;
volume integration không được dùng cho cutover history rỗng.

Xem [kế hoạch cutover history rỗng](SQLITE_EMPTY_HISTORY_CUTOVER.md).

## Cập nhật sau yêu cầu cutover

Đã chuyển runtime `18081` sang project `cipher-workbench-sqlite`, dùng đúng image
BE SQLite đã ghim và image FE cũ. History khởi tạo rỗng; cipher/history/restart và
backup/restore trên runtime mới đã đạt. UI assets hash không đổi. Frontend/backend
PostgreSQL cũ dừng nhưng được giữ; PostgreSQL vẫn chạy. Xem trạng thái và evidence
chi tiết tại [cutover](SQLITE_EMPTY_HISTORY_CUTOVER.md).
