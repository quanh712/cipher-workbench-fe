# Tailscale RSA recovery — 11/10/2026

URL: https://quanh-tran-inspiron-14-plus-7430.tail3c83f1.ts.net

Tailscale Serve/Funnel forwards HTTPS to `127.0.0.1:18081`. The initial RSA request
returned HTTP 502, and Docker Desktop's API did not respond. After restarting Docker
Desktop, Nginx failed to start because `cipher-workbench-be-app-1` was stopped.
Docker reported `OOMKilled=true` and restart policy `no` for that backend.

The backend was restarted. Both deployed images were also older than the RSA
signature implementation: `/api/rsa/sign/raw` returned 404 even on the new backend's
host port. The current BE source is `da77d54`; its image now uses Python 3.12 and the
frozen dependency lock.

## Current runtime

- FE: `cipher-workbench-frontend:local-rsa-20261011`, selected by
  `deploy/docker-compose.18081-dh.yml`. Hill, DES, RSA and DH remain enabled.
- Signature/DH BE: `cipher-workbench-be-app:rsa-da77d54`, selected by
  `deploy/docker-compose.rsa-backend.yml`. Restart policy `unless-stopped`,
  memory limit 512 MiB and CPU limit 1.
- `/api/rsa/sign*` and `/api/rsa/verify*` now proxy to this BE in
  `deploy/nginx.18081-dh.conf`; existing DH routing remains. Other APIs retain
  the previous backend.
- Runtime settings live in ignored `.env.rsa-backend` (mode 0600), including a
  persistent signing key and secure cookie configuration. Keep this file private;
  do not regenerate its signing key during routine restarts.
- Tailscale configuration and existing SQLite volumes remain in place.

```bash
./deploy/rsa-backend.sh config
./deploy/rsa-backend.sh ps
./deploy/rsa-backend.sh up
./deploy/frontend.sh local up
```

`./deploy/rsa-backend.sh migrate` is explicit and uses the pinned backend image.
The rollout applied `sqlite_0002 → sqlite_0003`, adding the private-history table.

## Retention and backup

The updated BE has a fixed five-hour retention policy. On startup it expired all
58 previous metadata records, whose timestamps were already beyond that cutoff.
A consistent pre-upgrade SQLite snapshot was taken before migration and preserved
at `backups/rsa-update-20261011/pre-rsa.sqlite3` (ignored by Git, mode 0600).
No restore or downgrade was performed. Signature requests now save owner-scoped
history successfully over HTTPS.

## Verification

Nginx syntax and Compose configuration passed. The Tailscale health endpoint
returned 200 with `database:ok`. Direct HTTPS requests signed `65 → 588`, verified
`m=65` as valid and `m=66` as invalid, and saved history with the same cookie profile.

All 10 browser integration tests passed on the actual deployed URL, covering
desktop and 375 px:

```bash
PLAYWRIGHT_BASE_URL=https://quanh-tran-inspiron-14-plus-7430.tail3c83f1.ts.net \
  npm run test:e2e:rsa:integration -- --output=/tmp/rsa-tailscale-results
```

## DH history update — 13/10/2026

Current FE image is `cipher-workbench-frontend:history-operation-filters-20261013`; current signature/DH BE image is `cipher-workbench-be-app:dh-history-9d22937`. The deploy overlays now select these images. The BE history volume and profile signing key were retained. SQLite was upgraded from `sqlite_0003` to `sqlite_0004` after writer freeze, verified backup/restore, and migration rehearsal; row data, indexes, and sequence were verified unchanged before startup.

The dedicated FE alias `/api/dh/history` rewrites to `/api/history` on the same BE as `/api/dh/*`. Common history retains its previous backend. New DH operation filters return 200 through 18081; real desktop/mobile exchange/history/reload checks and RSA signature/history smoke pass. The isolated DH API acceptance suite passes 43/43. Detailed evidence is in [DH integration](DIFFIE_HELLMAN_BE_INTEGRATION.md).
