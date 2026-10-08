#!/usr/bin/env python3
"""Back up SQLite history, rehearse restore, then retain verified snapshots."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import shutil
import sys
import tempfile
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlsplit

SNAPSHOT_NAME = re.compile(r"snapshot-(\d{8}T\d{6}Z)-[0-9a-f]{8}")


def atomic_json(path: Path, value: dict) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("x", encoding="utf-8") as handle:
            json.dump(value, handle, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def expire_snapshots(directory: Path, *, now: datetime, retention_days: int) -> int:
    """Remove only completed snapshots older than retention; always keep newest."""
    snapshots = []
    for path in directory.iterdir():
        match = SNAPSHOT_NAME.fullmatch(path.name)
        if not match or path.is_symlink() or not path.is_dir():
            continue
        try:
            timestamp = datetime.strptime(match[1], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
            evidence = json.loads((path / "evidence.json").read_text())
        except (ValueError, OSError):
            continue
        if (
            isinstance(evidence, dict)
            and evidence.get("verified") is True
            and evidence.get("restore_verified") is True
            and (path / "history.sqlite3").is_file()
        ):
            snapshots.append((timestamp, path))
    snapshots.sort()
    cutoff = now - timedelta(days=retention_days)
    removed = 0
    for timestamp, path in snapshots[:-1]:
        if timestamp < cutoff:
            shutil.rmtree(path)
            removed += 1
    return removed


def backup_once(source: Path, directory: Path, retention_days: int) -> dict:
    # Imports stay here so retention/status checks need only the standard library.
    from app.history.continuity import (
        backup_sqlite_live,
        restore_sqlite_backup,
        verify_staging,
    )

    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if source.resolve().is_relative_to(directory.resolve()):
        raise ValueError("backup directory must be separate from runtime")
    with (directory / ".backup.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        now = datetime.now(UTC)
        name = f"snapshot-{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}"
        with tempfile.TemporaryDirectory(prefix=".pending-", dir=directory) as temporary:
            staging = Path(temporary)
            snapshot = staging / "history.sqlite3"
            restored = staging / "restore.sqlite3"
            result = backup_sqlite_live(source, snapshot)
            report = verify_staging(
                snapshot,
                expected_manifest_digest=result.backup_digest,
                expected_schema_revision="sqlite_0001",
            )
            rehearsal = restore_sqlite_backup(
                snapshot,
                restored,
                expected_manifest_digest=result.backup_digest,
                expected_schema_revision="sqlite_0001",
                runtime_path=source,
            )
            if not result.verified or not rehearsal.verified:
                raise RuntimeError("backup or restore verification failed")
            restored.unlink()
            evidence = {
                "verified": True,
                "created_at": now.isoformat(),
                "manifest_digest": result.backup_digest,
                "rows": report.manifest.count,
                "schema_revision": report.manifest.schema_revision,
                "sequence": report.sequence,
                "restore_verified": True,
            }
            atomic_json(staging / "evidence.json", evidence)
            for path in [snapshot, staging / "evidence.json"]:
                path.chmod(0o600)
                with path.open("rb") as handle:
                    os.fsync(handle.fileno())
            descriptor = os.open(staging, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            staging.rename(directory / name)
        descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        removed = expire_snapshots(directory, now=now, retention_days=retention_days)
        status = {**evidence, "snapshot": name, "pruned": removed, "ok": True}
        atomic_json(directory / "status.json", status)
        return status


def healthy(directory: Path, interval_seconds: int) -> bool:
    try:
        status = json.loads((directory / "status.json").read_text())
        created = datetime.fromisoformat(status["created_at"])
        age = (datetime.now(UTC) - created).total_seconds()
        return (
            status.get("ok") is True
            and status.get("restore_verified") is True
            and 0 <= age <= interval_seconds + 300
            and (directory / status["snapshot"] / "history.sqlite3").is_file()
        )
    except (ValueError, KeyError, OSError, TypeError):
        return False


def positive_int(raw: str) -> int:
    value = int(raw)
    if value < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return value


def main() -> int:
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--directory", type=Path, default=Path("/backups"))
    parser.add_argument("--retention-days", type=positive_int, default=os.environ.get("SQLITE_BACKUP_RETENTION_DAYS", "7"))
    parser.add_argument("--interval-seconds", type=positive_int, default=os.environ.get("SQLITE_BACKUP_INTERVAL_SECONDS", "3600"))
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--health-check", action="store_true")
    args = parser.parse_args()
    if args.health_check:
        return 0 if healthy(args.directory, args.interval_seconds) else 1
    if args.source is None:
        url = urlsplit(os.environ.get("DATABASE_URL", ""))
        path = Path(unquote(url.path[1:]))
        if (
            url.scheme != "sqlite+aiosqlite"
            or url.netloc or url.query or url.fragment
            or not path.is_absolute()
            or not path.is_relative_to(Path("/data"))
        ):
            parser.error("DATABASE_URL must identify an absolute SQLite file under /data")
        args.source = path
    while True:
        success = False
        try:
            status = backup_once(args.source, args.directory, args.retention_days)
            print(json.dumps(status, sort_keys=True), flush=True)
            success = True
        except BlockingIOError:
            # A manually requested backup may overlap the scheduled one.
            print(json.dumps({"ok": False, "error": "backup_already_running"}), flush=True)
        except Exception as error:
            status = {
                "ok": False,
                "created_at": datetime.now(UTC).isoformat(),
                "error": type(error).__name__,
            }
            if args.directory.is_dir():
                atomic_json(args.directory / "status.json", status)
            print(json.dumps(status), flush=True)
        if args.once:
            return 0 if success else 1
        time.sleep(args.interval_seconds if success else min(300, args.interval_seconds))


if __name__ == "__main__":
    sys.exit(main())
