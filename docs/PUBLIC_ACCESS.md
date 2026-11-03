# Public Access — Tailscale Funnel (không VPS, không trả phí)

Tài liệu này đề xuất phương án để **mọi máy tính đều truy cập được** Cipher
Workbench mà không cần VPS hay mua domain, dựa trên máy deploy hiện tại
(Inspiron của Quanh, stack SQLite + overlay DH theo
[TAILSCALE_RSA_RECOVERY_20261011.md](TAILSCALE_RSA_RECOVERY_20261011.md)).

**Kết luận: bật Tailscale Funnel trỏ vào cổng funnel riêng `127.0.0.1:18085`.**
URL giữ nguyên `https://quanh-tran-inspiron-14-plus-7430.tail3c83f1.ts.net`,
không đổi mã BE/FE — FE vẫn gọi `/api` relative cùng origin, cookie profile
`SameSite=Lax` (xem BE `app/api/history_profile.py`) nguyên vẹn.

## 1. Vì sao phải cùng một origin

FE không có absolute API URL; BE đặt cookie `cw_history_profile` với
`SameSite=Lax`. Tách FE sang static hosting khác domain sẽ buộc cookie thành
cross-site — Safari chặn, lịch sử phân mảnh theo trình duyệt. Mọi phương án
public dưới đây đều giữ nguyên tắc: **một hostname duy nhất phục vụ cả FE lẫn
BE**, nên mới cần ingress trung gian (Funnel/Tunnel) thay vì port forwarding.

## 2. Phương án đề xuất: Tailscale Funnel

Theo tài liệu chính thức (validate 01/2026, CLI 1.52+): Funnel có trên mọi
plan kể cả free, TLS cert tự động cho hostname `*.ts.net`, relay của
Tailscale không đọc được nội dung, nhưng **chỉ public qua port 443/8443/10000**
và có giới hạn băng thông không cấu hình được (đủ cho demo lớp học, không phải
production).

```text
Internet :443
   │  https://quanh-tran-inspiron-14-plus-7430.tail3c83f1.ts.net
   ▼
Tailscale relay + tailscaled (máy deploy)
   │  127.0.0.1:18085 + PROXY protocol v2 (giữ IP thật của khách)
   ▼
Nginx FE container :8081 (listen ... proxy_protocol)
   ├── /, /assets/*, /docs, /openapi.json  → React dist
   ├── /api/*  → backend:8000 (cipher thường, history)
   └── /api/rsa/sign|verify|history, /api/dh/*  → cipher-workbench-be-app-1
   (listen 8080 không PROXY protocol giữ nguyên cho curl/smoke/healthcheck local)
```

### 2.1 Điều kiện tiên quyết

- Tailscale ≥ v1.38.3 (khuyến nghị 1.52+ cho cú pháp flag hiện hành),
  MagicDNS + HTTPS đã bật trên tailnet — máy deploy đã có sẵn (đang có cert
  `ts.net`).
- Funnel được bật trong admin console; lần chạy `tailscale funnel` CLI sẽ mở
  trình duyệt yêu cầu approve và tự thêm node attribute `funnel`.
- Máy deploy bật 24/7 khi cần phục vụ; Docker Desktop phải chạy
  (`TAILSCALE_RSA_RECOVERY_20261011.md` đã ghi nhận một sự cố OOMKilled).

### 2.2 Các bước

1. **Áp patch deploy (đã có trong repo sau commit này)**, tái tạo container FE:

   ```bash
   git pull
   ./deploy/frontend.sh local config   # phải pass validation
   ./deploy/frontend.sh local up
   ```

   Patch gồm: listener `8081 proxy_protocol` + `set_real_ip_from` trong
   `deploy/nginx.18081-dh.conf`; mapping `127.0.0.1:${APP_FUNNEL_PORT:-18085}:8081`
   trong `deploy/docker-compose.18081-dh.yml`; `HISTORY_PROFILE_SIGNING_KEY` +
   `HISTORY_COOKIE_SECURE` trong `docker-compose.yml` backend env
   (`.env.sqlite` phải có key 64-hex — sinh bằng
   `python3 -c 'import secrets; print(secrets.token_hex(32))'`).

2. **Chốt signing key chung cho hai backend.** Vì cookie profile được set từ
   cùng một hostname cho cả BE chính lẫn BE DH/signature, hai container PHẢI
   dùng chung `HISTORY_PROFILE_SIGNING_KEY`, nếu không cookie sẽ ping-pong và
   owner id lật liên tục giữa hai trang history:

   ```bash
   docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' \
     cipher-workbench-sqlite-backend-1 | grep HISTORY_PROFILE
   docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' \
     cipher-workbench-be-app-1 | grep HISTORY_PROFILE
   # hai dòng key phải GIỐNG HỆT; thiếu key ở BE chính là lỗi cấu hình
   # (image QA 9d22937 trở lên yêu cầu key khi có DATABASE_URL).
   ```

3. **Bật Funnel vào cổng funnel mới:**

   ```bash
   tailscale funnel --bg --proxy-protocol=2 18085
   tailscale funnel status --json   # xác nhận https 443 → 127.0.0.1:18085
   ```

   Cùng port public 443 không tồn tại song song Serve và Funnel — lệnh chạy
   sau quyết định chế độ. Sau bước này hostname `ts.net` là **public**.

   *Fallback:* nếu client Tailscale trên máy deploy từ chối
   `--proxy-protocol` ở chế độ HTTPS reverse proxy (cú pháp đổi theo phiên
   bản), chạy `tailscale funnel --bg 18085` không flag. Khi đó mọi khách
   public chung một bucket `limit_req` (nginx chỉ thấy IP của tailscaled) →
   phải nới rate trong `deploy/nginx.18081-dh.conf` (ví dụ text `50r/s`,
   file `10r/s`) và chấp nhận bot có thể làm nghẽn — chỉ dùng khi demo nhanh.

4. **Nghiệm thu (chạy từ máy NGOÀI tailnet):**

   ```bash
   curl -fsS https://quanh-tran-inspiron-14-plus-7430.tail3c83f1.ts.net/api/health
   # kỳ vọng: "database":"ok" (200 không thôi là chưa đủ, xem DEPLOYMENT.md §7)
   curl -sSI https://quanh-tran-inspiron-14-plus-7430.tail3c83f1.ts.net/api/caesar/encrypt \
     -X POST | grep -i set-cookie
   # kỳ vọng: cw_history_profile=...; Secure; HttpOnly; SameSite=Lax
   docker logs --tail=20 cipher-workbench-sqlite-frontend-1
   # kỳ vọng (bước 3 thành công): access log hiện IP thật của máy test,
   # không phải 172.17.x.x / 127.0.0.1
   ```

   Mở FE bằng browser người lạ, encrypt một chuỗi, kiểm tra trang lịch sử chỉ
   thấy đúng thao tác của profile đó.

### 2.3 Tắt / quay về nội bộ

```bash
tailscale funnel --bg --proxy-protocol=2 18085 off   # lặp lại đúng flag cũ
tailscale serve 18081                                # nếu muốn phục hồi Serve tailnet-only
```

## 3. Rủi ro khi public và cách chấp nhận

| Rủi ro | Mức độ | Giảm nhẹ đã có / nên làm |
| --- | --- | --- |
| Bot quét URL công khai | Chắc chắn xảy ra | `limit_req` per-IP (bước 3 bản PPv2), 429 tiếng Việt, Funnel bandwidth cap |
| Đọc lịch sử người khác | Thấp | `GET /api/history` owner-scoped theo cookie; khách lạ nhận profile mới, rỗng |
| Ghi history rác làm FIFO eviction quota 500 MiB | Thấp–TB | rate limit file 2r/s; theo dõi `docker logs` backend |
| `DEPLOYMENT.md` §2 khuyến nghị `HISTORY_API_ENABLED=false` cho instance public | Quyết định của owner | Demo lớp học cần tab lịch sử → giữ `true` với lập luận owner-scoping ở trên; nếu phát hành rộng hơn thì tắt |
| Laptop tắt / Docker OOM | Cao về mặt uptime | Chấp nhận với phạm vi báo cáo; muốn 24/7 xem mục 4 |
| `/docs` + `/openapi.json` lộ công khai | thấp | Có thể thêm `deny all` tại nginx nếu muốn |

## 4. Phương án thay thế (đã đối chiếu tài liệu 11/2026)

- **Cloudflare Tunnel named**: hostname cố định đẹp hơn, CDN/WAF miễn phí,
  nhưng **bắt buộc có domain riêng** đã thêm vào Cloudflare (docs ghi rõ
  "A domain on Cloudflare — required to publish applications"); muốn per-IP
  limit còn cần `real_ip_header CF-Connecting-IP` với dải IP Cloudflare.
  Quick Tunnel (`cloudflared tunnel --url http://127.0.0.1:18081`) không cần
  account nhưng **đổi URL random mỗi lần chạy**, 200 in-flight requests —
  chỉ hợp demo nhất thời.
- **VPS + `DEPLOYMENT.md` hiện hành** (ví dụ Oracle Always Free): đúng flow
  nginx host + certbot đã viết, uptime thật, nhưng phải đăng ký cloud và giữ
  máy chủ; cân nhắc khi cần "bật 24/7 không phụ thuộc laptop".
- **Port forwarding router + DDNS**: các ISP VN thường CGNAT, gần như không
  khả thi và lộ IP nhà — không đề xuất.

## 5. Tài liệu tham chiếu

- Tailscale Funnel KB (validate 20/01/2026): khả dụng mọi plan, port
  443/8443/10000, TLS tự động, bandwidth limit, `--proxy-protocol`.
- `tailscale funnel` CLI reference (validate 26/01/2026): flags `--bg`,
  `--proxy-protocol=<1|2>`, quy tắc `off`, Funnel tự nối lại sau reboot khi
  dùng `--bg`.
- Cloudflare Tunnel docs (30/09/2026): named tunnel cần domain trên Cloudflare;
  Quick Tunnel ephemeral, 200 in-flight requests, không uptime guarantee.
- Render free plan docs: spin-down 15 phút + filesystem ephemeral → loại cho
  app SQLite có history.
