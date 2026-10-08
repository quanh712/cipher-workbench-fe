# Gỡ PostgreSQL — 08/10/2026

User yêu cầu gỡ cả trên máy và trong mã nguồn. Máy không có gói PostgreSQL host
cài trực tiếp. Hai stack Docker cũ local/verify đã retire.

- Gỡ 7 container cũ của `cipher-postgres-local` / `cipher-postgres-verify`.
- Gỡ `cipher-postgres-local_postgres_data` và `cipher-postgres-verify_postgres_data`.
- Gỡ image `postgres:17`; SQLite volumes giữ nguyên.
- Backup globals và custom dumps của tất cả DB nằm trong
  `test-results/postgres-removal-20261008/` (gitignored, quyền riêng tư).
- Restore rehearsal đã đối soát row JSON digest, row count và sequence cho mọi
  user table: local history 961 rows, verify history 36 rows.
- User chỉnh lại phạm vi: chỉ cleanup FE. Toàn bộ thay đổi BE source đã hoàn tác;
  hai stack SQLite được đưa về image trước cleanup.
- Compose mặc định, env deploy/stage và smoke script dùng SQLite.
- BE giữ nguyên tooling và dependency ban đầu; FE không có dịch vụ PostgreSQL.
- User xác nhận giữ máy dùng SQLite, không phục hồi PostgreSQL Docker đã gỡ.

Không import history cũ vào SQLite; đây là quyết định đã ghi trong
[cutover](SQLITE_EMPTY_HISTORY_CUTOVER.md).

## Xác minh sau khi chỉnh phạm vi

- BE working tree sạch, tất cả thay đổi cleanup BE đã hoàn tác.
- Hai stack dùng lại image `c3332dd77a66c98e6dacb28666332501b6946f6414a36283347d95dd232677ae`.
- Sao lưu và đối soát SQLite trước/sau đổi image; frontend container và HTML hash giữ nguyên.
- Evidence hoàn tác: `test-results/postgres-removal-20261008/backend-revert/`.
- Log 1511 test ở thư mục cha thuộc lần cleanup BE đã hoàn tác, không phải thay đổi FE cuối cùng.

Backup định kỳ và cleanup volume SQLite cũ đã thực hiện riêng trong
[DB fixes](SQLITE_DB_FIXES_20261008.md).
