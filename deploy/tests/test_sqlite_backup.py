"""Verify recovery and retention boundaries using disposable databases."""
import importlib.util
import json
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "sqlite_backup", Path(__file__).resolve().parents[1] / "sqlite-backup.py"
)
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.now = datetime.now(UTC)

    def snapshot(self, days, suffix="deadbeef", verified=True):
        timestamp = self.now - timedelta(days=days)
        path = self.root / f"snapshot-{timestamp:%Y%m%dT%H%M%SZ}-{suffix}"
        path.mkdir()
        (path / "history.sqlite3").write_bytes(b"test-only")
        (path / "evidence.json").write_text(json.dumps({
            "verified": verified, "restore_verified": verified,
        }))
        return path

    def test_retention_keeps_newest_and_recent_snapshots(self):
        old = self.snapshot(10)
        recent = self.snapshot(2)
        newest = self.snapshot(0)
        count = backup.expire_snapshots(self.root, now=self.now, retention_days=7)
        self.assertEqual(count, 1)
        self.assertFalse(old.exists())
        self.assertTrue(recent.exists())
        self.assertTrue(newest.exists())

    def test_retention_keeps_last_good_even_if_expired(self):
        last = self.snapshot(20)
        self.assertEqual(backup.expire_snapshots(self.root, now=self.now, retention_days=7), 0)
        self.assertTrue(last.exists())

    def test_retention_ignores_unverified_unknown_and_symlinked_paths(self):
        unverified = self.snapshot(20, verified=False)
        unknown = self.root / "user-backup"
        unknown.mkdir()
        link = self.root / "snapshot-20000101T000000Z-cafebabe"
        link.symlink_to(unknown, target_is_directory=True)
        malformed = self.snapshot(30, "cafebabe")
        (malformed / "evidence.json").write_text("[]")
        self.snapshot(0)
        self.assertEqual(backup.expire_snapshots(self.root, now=self.now, retention_days=7), 0)
        for path in [unverified, unknown, link, malformed]:
            self.assertTrue(path.exists())

    def test_health_requires_recent_success_and_existing_snapshot(self):
        path = self.snapshot(0)
        status = {"ok": True, "restore_verified": True,
                  "created_at": self.now.isoformat(), "snapshot": path.name}
        backup.atomic_json(self.root / "status.json", status)
        self.assertTrue(backup.healthy(self.root, 3600))
        status["created_at"] = (self.now - timedelta(hours=2)).isoformat()
        backup.atomic_json(self.root / "status.json", status)
        self.assertFalse(backup.healthy(self.root, 3600))
        status["created_at"] = self.now.isoformat()
        status["ok"] = False
        backup.atomic_json(self.root / "status.json", status)
        self.assertFalse(backup.healthy(self.root, 3600))

    def source(self):
        from app.history.continuity import IdentityState, import_staging
        source = self.root / "source.sqlite3"
        import_staging(source, [], IdentityState(1, False, 1),
                       source_revision="sqlite_0001", schema_revision="sqlite_0001")
        return source

    def test_live_backup_is_published_only_after_verified_restore(self):
        status = backup.backup_once(self.source(), self.root / "backups", 7)
        self.assertTrue(status["restore_verified"])
        self.assertEqual(status["rows"], 0)
        self.assertTrue(backup.healthy(self.root / "backups", 3600))
        self.assertFalse(list((self.root / "backups").glob(".pending-*")))

    def test_restore_failure_preserves_previous_backup_and_skips_retention(self):
        source = self.source()
        self.root = self.root / "backups"
        self.root.mkdir()
        previous = self.snapshot(20)
        with patch("app.history.continuity.restore_sqlite_backup", side_effect=RuntimeError("test")):
            with self.assertRaises(RuntimeError):
                backup.backup_once(source, self.root, 7)
        self.assertTrue(previous.exists())
        self.assertFalse((self.root / "status.json").exists())
        self.assertFalse(list(self.root.glob(".pending-*")))


if __name__ == "__main__":
    unittest.main()
