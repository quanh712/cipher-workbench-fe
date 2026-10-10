#!/usr/bin/env bash
set -euo pipefail
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source "$root/deploy/frontend-ports.env"

declare -A used_ports=()
for port in "$FRONTEND_LOCAL_PORT" "$FRONTEND_INTEGRATION_PORT" "$FRONTEND_DEMO_PORT"; do
  if [[ ! $port =~ ^[1-9][0-9]{0,4}$ ]] || ((port > 65535)); then
    echo "Invalid frontend port: $port" >&2
    exit 1
  fi
  if [[ -n ${used_ports[$port]:-} ]]; then
    echo "Duplicate frontend port: $port" >&2
    exit 1
  fi
  used_ports[$port]=1
done

target=${1:-local}
operation=${2:-ps}
export APP_BIND_ADDRESS="$FRONTEND_BIND_ADDRESS"
case "$target" in
  local)
    export APP_HTTP_PORT="$FRONTEND_LOCAL_PORT"
    compose=(docker compose -p cipher-workbench-sqlite --env-file "$root/.env.sqlite"
      -f "$root/docker-compose.yml" -f "$root/deploy/docker-compose.18081-dh.yml")
    ;;
  integration)
    export APP_HTTP_PORT="$FRONTEND_INTEGRATION_PORT"
    compose=(docker compose -p cipher-workbench-sqlite-integration --env-file "$root/.env.sqlite.integration"
      -f "$root/docker-compose.yml")
    ;;
  demo)
    export APP_HTTP_PORT="$FRONTEND_DEMO_PORT"
    compose=(docker compose -p cipher-workbench-demo -f "$root/deploy/docker-compose.demo.yml")
    ;;
  *) echo "Unknown frontend: $target (local|integration|demo)" >&2; exit 2 ;;
esac
case "$operation" in
  up) exec "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 60 frontend ;;
  ps) exec "${compose[@]}" ps frontend ;;
  stop) exec "${compose[@]}" stop frontend ;;
  config) exec "${compose[@]}" config --quiet ;;
  url) printf 'http://%s:%s\n' "$APP_BIND_ADDRESS" "$APP_HTTP_PORT" ;;
  *) echo "Usage: $0 {local|integration|demo} {up|ps|stop|config|url}" >&2; exit 2 ;;
esac
