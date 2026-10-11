#!/usr/bin/env bash
set -euo pipefail
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file="$root/.env.rsa-backend"
if [[ ! -f "$env_file" ]]; then
  echo "Missing .env.rsa-backend runtime configuration." >&2
  exit 1
fi
compose=(docker compose --project-directory "$root/../cipher-workbench-be"
  --env-file "$env_file" -f "$root/../cipher-workbench-be/docker-compose.yml"
  -f "$root/deploy/docker-compose.rsa-backend.yml")
operation=${1:-ps}
case "$operation" in
  ps) exec "${compose[@]}" ps app ;;
  up) exec "${compose[@]}" up -d --no-build --no-deps --pull never app ;;
  config) exec "${compose[@]}" config --quiet ;;
  migrate) exec "${compose[@]}" run --rm --no-deps migrate ;;
  *) echo "Usage: $0 {ps|up|config|migrate}" >&2; exit 2 ;;
esac
