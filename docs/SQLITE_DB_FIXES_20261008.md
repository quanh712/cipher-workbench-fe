# Sửa các điểm DB review — 08/10/2026

Phạm vi implementation chỉ nằm ở FE; BE working tree và image ứng dụng giữ nguyên.

- `docker-compose.yml` symlink tới cấu hình SQLite hiện hành; default và standalone
  render cùng project `cipher-workbench-sqlite` và volume `cipher-workbench-sqlite_history-data`.
- README/deployment dùng `deploy/sqlite-stack.sh`, runtime env `.env.sqlite`.
  `.env.deploy` chỉ dành cho proxy host/HTTPS.
- Backup service local và integration đã bật: chạy ngay khi start, mỗi 3600 giây,
  giữ 7 ngày; restart policy `unless-stopped`.
- Backup đọc nguồn read-only, không có network; ghi ra host `backups/sqlite/local/`
  và `backups/sqlite/integration/`. Snapshot/evidence riêng tư và không vào Git/build context.
- Snapshot đầu tiên đã restore-verified: local 9 rows, integration 129 rows.
- 6 unit tests backup/restore/retention đạt. Test lịch rút ngắn tạo 4 snapshot
  verified trong container tạm, không thay lịch thật 3600 giây.
- Volume không dùng `cipher-postgres-local_sqlite_data` có 0 rows, schema `0003`: đã
  lưu archive `backups/sqlite/legacy/history-schema-0003.sqlite3`, kiểm integrity và xóa volume.
- Evidence: `test-results/sqlite-db-fixes-20261008/evidence.json`.

Vận hành, trạng thái và phục hồi xem [SQLite operation](SQLITE_COMPOSE.md).
