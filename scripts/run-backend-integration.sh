#!/usr/bin/env bash
set -euo pipefail

backend_context="${BACKEND_CONTEXT:-../cipher-workbench-be}"
image_name="cipher-workbench-backend:integration"
container_name="cipher-workbench-backend-integration"
backend_port="${BACKEND_INTEGRATION_PORT:-18000}"

if [[ ! -f "${backend_context}/Dockerfile" ]]; then
  echo "Không tìm thấy Backend Dockerfile tại ${backend_context}." >&2
  exit 1
fi

if docker container inspect "${container_name}" >/dev/null 2>&1; then
  echo "Container ${container_name} đã tồn tại; hãy dừng nó trước khi chạy integration test." >&2
  exit 1
fi

cleanup() {
  docker stop --time 2 "${container_name}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --tag "${image_name}" "${backend_context}"
docker run --detach --rm \
  --name "${container_name}" \
  --publish "127.0.0.1:${backend_port}:8000" \
  "${image_name}" >/dev/null

docker wait "${container_name}" >/dev/null
