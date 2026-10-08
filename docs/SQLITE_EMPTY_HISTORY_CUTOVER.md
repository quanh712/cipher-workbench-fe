> Vận hành hiện hành: backup hàng giờ, retention 7 ngày, xem [SQLite operation](SQLITE_COMPOSE.md#backup-tự-động). Các ghi chú chưa cấu hình lịch bên dưới là record tại thời điểm cutover.

> Cập nhật 08/10/2026: PostgreSQL local/verify đã gỡ sau backup và restore verification; các mô tả giữ DB cũ bên dưới là trạng thái tại thời điểm cutover. Xem [kết quả gỡ](POSTGRES_REMOVAL_20261008.md).

# Cutover SQLite với history rỗng, giữ nguyên UI

Phạm vi user xác nhận ngày 07/10/2026: đổi database; không transfer history cũ;
giữ nguyên UI, image frontend và feature flags, proxy `/api`, cổng `18081`.
Cutover đã thực hiện theo yêu cầu user ngày 07/10/2026 lúc khoảng 23:35 ICT.

## Kết quả cutover

- `cipher-workbench-sqlite` đang phục vụ `127.0.0.1:18081` bằng các image pin bên dưới.
- Volume mới đã kiểm tra `sqlite_0001`, integrity `ok`, 0 rows trước startup.
  API history ban đầu cũng rỗng; không import dữ liệu PostgreSQL.
- Health: database `ok`, history `enabled`; Caesar round-trip và filter/cursor đạt.
- HTML và toàn bộ JS/CSS entry assets có SHA-256 bằng UI trước cutover.
- Restart riêng backend: 3 metadata rows từ smoke còn nguyên, đúng thứ tự.
- Backup live và restore vào file riêng đạt integrity/schema/digest/sequence/rows.
  Manifest digest cả hai:
  `bd7e5749eb78b720a076775cd9699dedca1bdce62014560e9ebc09956b2ce2b7`.
- Backup đã xuất và kiểm chứng lại trên host, ngoài runtime volume:
  `test-results/sqlite-cutover-20261007/backup-restore/` (gitignored).
  Evidence UI/smoke/restart và archive backup nằm trong cùng thư mục cha.
- Frontend/backend PostgreSQL cũ đã dừng nhưng còn giữ container;
  `cipher-postgres-local-db-1` vẫn chạy, volume cũ không bị xóa.
- Stack thử `18082` giữ riêng, không dùng volume thử cho rollout.

History hiện có 3 bản ghi mới do smoke. Lịch backup định kỳ/retention của các file
backup chưa được cấu hình trong tác vụ này; backup vừa tạo là snapshot sau cutover.

## Cấu hình đã chuẩn bị

- Project đích `cipher-workbench-sqlite`, file `docker-compose.sqlite.yml`,
  env `.env.sqlite`, `APP_HTTP_PORT=18081`.
- BE pin digest `c3332dd77a66c98e6dacb28666332501b6946f6414a36283347d95dd232677ae`.
- FE giữ digest `43c9a61d51bfd88ed190b30549ec150155463ba0d8425012e5db67fc9517293f`:
  image ID đã đối chiếu bằng stack hiện tại và stack thử. Không rebuild FE từ source
  có các thay đổi khác trong workspace.
- `HISTORY_API_ENABLED=true` như health stack cũ; đây là cấu hình local hiện tại.
- Backend/migrate cùng SQLite URL và volume `/data`; migration dùng `alembic_sqlite.ini`.
- Volume đích `cipher-workbench-sqlite_history-data` mới hoàn toàn, không dùng
  `cipher-workbench-sqlite-integration_history-data` chứa 128 bản ghi thử.
- PostgreSQL và volume cũ được giữ lại. History cũ không xuất hiện trong UI mới.

Integration cipher/history/restart và backup/restore thử đã đạt, xem
[evidence](SQLITE_INTEGRATION_20261007.md).

## Runbook triển khai

1. Render config và đối chiếu image/port/history flag/volume. Kiểm tra volume đích
   chưa tồn tại; nếu đã tồn tại, kiểm tra nội dung và dừng nếu có dữ liệu thay vì xóa.
2. Trong cửa sổ cutover, dừng đúng frontend/backend cũ
   `cipher-postgres-local-frontend-1`, `cipher-postgres-local-backend-1`.
   Giữ `cipher-postgres-local-db-1`, các volume và container không liên quan.
3. Chạy riêng migrate trên project đích; xác nhận `sqlite_0001`, integrity `ok`,
   count `cipher_operations = 0` trước khi khởi động backend/cipher smoke.
4. Khởi động project đích với `--no-build --wait` trên cổng `18081`.
   Kiểm tra health database `ok`, history `enabled`, `/api/history` ban đầu rỗng
   trước request cipher đầu tiên. Sau đó chạy cipher/history/restart smoke.
5. Ghi baseline rỗng và thời điểm write SQLite đầu tiên. Tạo backup ngoài runtime
   volume bằng Online Backup API, restore vào file riêng và đối soát trước khi
   tuyên bố rollout hoàn tất. Chốt lịch backup/retention và người vận hành.

Các lệnh chuẩn bị an toàn, chạy từ thư mục FE:

```bash
docker compose -p cipher-workbench-sqlite -f docker-compose.sqlite.yml --env-file .env.sqlite config --quiet
docker volume ls --filter name=cipher-workbench-sqlite_history-data
```

Lệnh rollout dự kiến sau bước dừng stack cũ và kiểm chứng migration/history rỗng:

```bash
docker compose -p cipher-workbench-sqlite -f docker-compose.sqlite.yml --env-file .env.sqlite up -d --no-build --wait --wait-timeout 90
```

## Rollback

Trước write SQLite đầu tiên: dừng project mới, giải phóng `18081`, khởi động lại
đúng frontend/backend cũ, kiểm tra health. Không xóa volume SQLite/PostgreSQL.

Sau write SQLite mới: giữ backup và dữ liệu SQLite, xác định phần metadata mới và
phương án xử lý trước rollback; quay về PostgreSQL sẽ không có history mới đó.
Không tự ghi ngược, transfer hoặc xóa dữ liệu. Xem
[runbook BE](../../cipher-workbench-be/docs/sqlite-history-runbook.md).

Không retire PostgreSQL trong phạm vi này. Không dùng `down -v`.
