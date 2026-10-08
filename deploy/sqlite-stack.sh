#!/usr/bin/env bash
set -euo pipefail
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
project=cipher-workbench-sqlite
env_file="$root/.env.sqlite"
if [[ ${1:-} == --integration ]]; then
  project=cipher-workbench-sqlite-integration
  env_file="$root/.env.sqlite.integration"
  shift
fi
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file; create it from .env.sqlite.example before setup." >&2
  exit 1
fi
compose=(docker compose -p "$project" -f "$root/docker-compose.yml" --env-file "$env_file")
operation=${1:-ps}
if (($#)); then shift; fi
case "$operation" in
  config|ps|logs) exec "${compose[@]}" "$operation" "$@" ;;
  prepare-backups)
    "${compose[@]}" config --format json | python3 -c '
import json, os, pathlib, sys
config=json.load(sys.stdin)
service=config["services"]["backup"]
uid, gid = map(int, service["user"].split(":"))
if (uid, gid) != (os.getuid(), os.getgid()):
    sys.exit("Set SQLITE_BACKUP_UID/GID to the current host user before preparing backups")
mount=next(m for m in service["volumes"] if m["target"]=="/backups")
path=pathlib.Path(mount["source"])
path.mkdir(parents=True, exist_ok=True, mode=0o700)
if path.is_symlink() or path.stat().st_uid != os.getuid():
    sys.exit("Backup directory must be owned by the current user and cannot be a symlink")
path.chmod(0o700)
print("Backup directory ready:", path)
' ;;
  up) exec "${compose[@]}" up -d --no-build --wait "$@" ;;
  stop) exec "${compose[@]}" stop "$@" ;;
  backup) exec "${compose[@]}" exec -T backup python /opt/sqlite-backup.py --once "$@" ;;
  *) echo "Usage: $0 [--integration] {config|ps|logs|prepare-backups|up|stop|backup}" >&2; exit 2 ;;
esac
