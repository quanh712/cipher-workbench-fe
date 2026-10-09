# Diffie–Hellman workspace

Contract canonical: [BE frontend-integration.md mục 19](https://github.com/kiendt2312/cipher_workbench-be/blob/main/repo_docs/frontend-integration.md#19-exact-dh-wire-contract-và-migration-từ-fe-cũ-canonical). [Spec FE](../../../docs/DIFFIE_HELLMAN_SPEC.md) ghi request/response, limits, warning và privacy mới. Contract này thay thế DTO/trace cũ.

HTTP adapter gọi URL tương đối `/api/dh/*` bằng camelCase, giữ mọi crypto integer dưới dạng decimal string. Optional request fields được bỏ hẳn, không gửi null. Sáu endpoints: params, params/random, keypair, shared-secret, exchange, caesar. Omit private key khi cần BE sinh; không có endpoint sinh private-values riêng. Exchange luôn có grouped steps và warning giáo dục, không nhận cờ trace hay trả q/alpha.

`types/` mô hình draft/request/result. `services/diffieHellmanGateway.ts` là ranh giới được inject; `services/diffieHellmanApi.ts` gửi HTTP và validate schema/status/error envelope. `hooks/useDiffieHellman.ts` quản lý draft/snapshot, một request mỗi thời điểm, AbortSignal, timeout 15 giây và revision để bỏ response/error/finally cũ. Components trình bày form A/B, kết quả và trace từ BE; không tính DH/RNG local. `DhOperationsPanel` có hai khu vực luôn hiển thị, dùng chung draft DH. `useDhPractice` giữ riêng kết quả tham số/cặp khóa/khóa chung A và B; sinh nhóm cập nhật q/alpha và xóa khóa cũ, keypair cập nhật private key bên chọn. Alpha gợi ý cần chọn rõ ràng. Shared-secret dùng cặp khóa A/B đã tạo hoặc snapshot exchange. `useDhCaesar` chỉ nhận khóa từ exchange thành công, giữ input khi sửa tham số/đổi A/B và xóa output phụ thuộc. Mọi thao tác dùng chung request lock qua `runSupplemental`; sửa/reset/đổi workspace hủy và bỏ response cũ.

Trace trái→phải gồm index, bit, exponentPrefix, squared, multiplied, result; multiplied null ở bit 0. Tối đa 128 rows/phép, exchange bốn arrays. Private/public/shared keys và trace được BE tính từ request để đối chiếu phép tính; render warning EDUCATIONAL_PRIVATE_KEYS cạnh kết quả. Params thiếu alpha chỉ là suggestion, không tự coi alpha đã chọn. Caesar luôn JSON, kể cả multipart .txt, warning SHIFT_ZERO là thành công.

Draft ban đầu trống; Tạo ví dụ điền 23/5/6/15 không gọi API. Sửa/reset/đổi workspace abort và bỏ kết quả/trace. Header Làm mới xóa draft DH và về Caesar. Loading khóa hành động API; sửa/reset vẫn hủy được. Form có nhãn, field errors/focus và aria-live; trace details mặc định đóng, bảng cuộn trong khung trên mobile. Clipboard sao chép khóa hoặc nội dung theo thao tác người dùng. Caesar dùng chung mode/input/file/layout; kết quả có tab Văn bản/Phân tích, copy và tải `.txt` từ JSON hiện có mà không gọi lại API.

Không lưu parameters, keys, file/content, result, trace hoặc warning vào storage/log/analytics/URL. Chỉ Caesar có safe metadata server history; năm endpoint tham số/khóa không ghi history. DH là feature độc lập; Caesar là tích hợp bổ sung. Contract không có xác thực MITM, KDF hay nhóm production.

`VITE_ENABLE_DIFFIE_HELLMAN=true` bật workspace tại build; mặc định false. Entry đã inject adapter thật khi cờ bật. Dùng dev proxy BACKEND_DEV_URL tới BE phù hợp. Không import fixture test vào entry production. Bật cờ deployment sau nghiệm thu đúng BE version.

```bash
npm run test -- src/features/diffieHellman src/app/DiffieHellmanApp.test.tsx src/app/DiffieHellmanHttpApp.test.tsx
npm run test:e2e:diffie-hellman
npm run test:integration:diffie-hellman -- --list
DH_BACKEND_URL=http://127.0.0.1:18082 npm run test:integration:diffie-hellman
```

Gateway fixtures chỉ dùng unit/component và E2E test; HTTP app tests dùng adapter thật với mock transport; không nhóm nào chứng minh BE thật tương thích. Trạng thái/bằng chứng live acceptance: [hướng dẫn integration](../../../docs/DIFFIE_HELLMAN_BE_INTEGRATION.md). Không suy ra kết quả migration từ các số test pass của bản contract cũ.

Migration đã qua 43/43 API integration tests với BE thật trong môi trường cô lập; bằng chứng version/lệnh nằm tại tài liệu integration. HTTP browser mock đã qua 24/24 ca trong ma trận desktop/375 px và light/dark.
