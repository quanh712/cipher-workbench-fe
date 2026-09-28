# Backend Contract Reference

Frontend tích hợp theo contract chính thức của repo
[`kiendt2312/cipher_workbench-be`](https://github.com/kiendt2312/cipher_workbench-be).

## Phiên bản được ghim

- Consumer guide và Backend implementation: [`fb459dd`](https://github.com/kiendt2312/cipher_workbench-be/blob/fb459ddcf35c622250b836f75fb14702b2eb0cf4/repo_docs/frontend-integration.md)
  (`fb459ddcf35c622250b836f75fb14702b2eb0cf4`, cập nhật Playfair ngày 28/09/2026).
- Nguồn có thẩm quyền: OpenSpec `openspec/changes/add-columnar-transposition-cipher/` và
  `openspec/changes/add-affine-cipher/` đang active, cùng hai completed changes
  `caesar-cipher-week1-mvp/` và `add-playfair-vigenere-ciphers/` trong repo Backend. BE `main` đã
  chứa Columnar tại commit được ghim.

Nếu tài liệu FE khác OpenSpec Backend, OpenSpec Backend được ưu tiên và tài liệu FE phải sửa.
Container BE trên máy deploy có thể vẫn chạy image cũ `c0a1927`; phải rebuild/recreate từ checkout
mới trước khi dùng runtime đó để nghiệm thu contract Playfair mới.

## Runtime boundary

- Backend thật chạy tại `http://localhost:8000`.
- FE gọi URL tương đối `/api/...`; Vite proxy `/api` về Backend khi phát triển.
- Production là same-origin; không yêu cầu CORS.
- `/docs` và `/openapi.json` dùng để đối chiếu schema; `GET /health` không thuộc contract.

## Handoff cho bên Backend: đồng bộ runtime Columnar

Đây là việc **đồng bộ checkout và tiến trình BE đang chạy**, không phải yêu cầu thay đổi thuật toán
hoặc mở contract mới. Tại lần kiểm tra ngày 24/09/2026, BE `main` trên GitHub đã ở
`c0a1927b397926dbf89d62a4b0270d4ec0fb71d7`, nhưng clone sibling mặc định
`../caesar-cipher-be` trên máy FE vẫn ở `c55278f207e84811cf26e3a748df612cd6a9915e`
(Affine-only). `git status` báo sạch với `origin/main` **không chứng minh đã cập nhật** nếu chưa
`fetch`; remote-tracking ref cục bộ có thể cũ. FE đã gọi API Columnar thật, nên runtime BE cũ
sẽ trả `404` cho `/api/columnar/*`.

Các bước bên BE thực hiện trên đúng checkout được server/Docker build sử dụng:

```bash
cd /home/quanh-tran/Documents/Caesar-Cipher/caesar-cipher-be
git status --short
git fetch origin main
git pull --ff-only origin main
git rev-parse HEAD
```

Nếu worktree có thay đổi, dừng và xử lý chúng trước; không dùng `reset --hard` hoặc force pull.
Sau khi checkout chứa commit đã ghim, **build lại và restart BE** theo cách vận hành hiện tại.
Với Compose của FE, build context mặc định là `../caesar-cipher-be`; trong `.env.deploy`, đặt
`BACKEND_REVISION` thành SHA BE thực tế và cập nhật `BACKEND_IMAGE_TAG` khi đổi image, rồi rebuild
service `backend`. Hai biến revision/tag chỉ phục vụ xác minh và đặt tên image; chúng **không tự
kéo code mới** vào build context. Khi deploy, `deploy/verify-revisions.sh` sẽ đối chiếu chính xác
SHA FE/BE với file `.env.deploy`.

Kiểm tra runtime mới tại cổng BE `8000` (hoặc thay bằng `8080` nếu đi qua proxy FE):

```bash
curl --fail --show-error --silent \
  -X POST http://127.0.0.1:8000/api/columnar/encrypt \
  -H 'Content-Type: application/json' \
  -d '{"text":"ABCDE","key":"3 1 4 2"}'
```

Kết quả chính xác phải là `{"success":true,"result":"BDAEC"}`. BE đang chạy cũng phải công bố
`/api/columnar/encrypt`, `/api/columnar/decrypt` và `/api/columnar/file` trong `/openapi.json`.
Nếu checkout đúng mà cổng `8000` vẫn trả `404`, kiểm tra process/container đang chạy có thật sự
được rebuild từ checkout ấy và proxy `/api` có trỏ tới đúng container không. FE đã chạy 16/16
browser integration tests với BE ở commit được ghim, gồm Unicode round-trip và file có BOM.

## Điểm tích hợp phải giữ

- Success JSON chỉ có `success`, `result`; error JSON chỉ có `success`, `message`.
- FE kiểm tra HTTP status và body, hiển thị nguyên văn `message` hợp lệ từ Backend.
- Caesar text gửi key dưới dạng JSON integer thật sự. Vigenère và Playfair gửi key string.
- Affine text gửi đúng `text`, `a`, `b`; hai khóa là JSON integer token không mất precision. File
  Affine gửi đúng `file`, `a`, `b`, `action`, `response_mode`, không gửi `key`.
- Columnar text gửi chính xác `text`, `key` (cả hai string); file gửi `file`, `key`, `action`,
  `response_mode`. Khóa truyền nguyên văn; BE tự nhận dạng hoán vị số hoặc keyword. Không gửi
  `key_type`, `pad`, field thừa hoặc field trùng. BE chỉ trim khoảng trắng ASCII (`SP`, tab, CR,
  LF, FF, VT) ở hai đầu khóa, giới hạn 2048 Unicode code point sau trim và 2–256 cột; hint FE
  phải nói rõ quy tắc trim và giới hạn cột, không tự trim hoặc sửa khóa trước khi gửi.
- Khóa file Affine là signed-decimal string tối đa 32 ký tự sau khi Backend trim; FE gửi nguyên raw
  control value. Backend từ chối field thừa/trùng; thứ tự kiểm tra là `file`, `a`, `b`, `action`,
  `response_mode`.
- Vigenère key phải khớp `[A-Za-z]+` và không được trim/sửa trước khi gửi.
- Playfair là luồng normalize có mất dữ liệu; Backend bỏ đúng một filler cuối khi decrypt
  (`XQ` → bỏ `Q`, nếu không thì `X` → bỏ `X`) và giữ filler giữa chuỗi. UI phải hiển thị nguyên
  response, không tự xóa thêm `X/Q`.
- Columnar giữ nguyên Unicode code point, kể cả whitespace/CRLF/emoji; không chuẩn hóa hoặc đệm.
  File UTF-8 có BOM đầu vào: preview bỏ BOM logic, attachment giữ BOM. File BOM-only hợp lệ.
- File giới hạn chính xác 5 MiB; preview dùng `response_mode=content`.
- Download file là request thứ hai với `response_mode=file`, dùng attachment của Backend.
- Result server là nguồn có thẩm quyền; không có runtime mock hoặc local cipher result.

Không sao chép lại ma trận lỗi và toàn bộ scenario ở đây. Khi cần chi tiết, đọc handoff và
OpenSpec đã ghim ở trên.
