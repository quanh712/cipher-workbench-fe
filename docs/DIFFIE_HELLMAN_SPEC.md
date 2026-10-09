# Diffie–Hellman — contract tích hợp FE

Cập nhật 2026-10-08. Nguồn canonical: [BE frontend-integration.md, mục 19](https://github.com/kiendt2312/cipher_workbench-be/blob/main/repo_docs/frontend-integration.md#19-exact-dh-wire-contract-và-migration-từ-fe-cũ-canonical). Tài liệu này thay thế spec FE cũ; implementation BE đã merge không chứng minh môi trường đang chạy đã deploy. Bộ API integration migration đã qua **43/43 tests** với BE thật source `main` `57d5766` trong Docker/SQLite cô lập; xem [bằng chứng](DIFFIE_HELLMAN_BE_INTEGRATION.md). Điều này không chứng minh một deployment khác đã cập nhật.

## Request và response

Tất cả endpoint là POST tương đối qua proxy `/api`. Mọi số mật mã và `shift` là decimal string ASCII canonical (`0` hoặc `[1-9][0-9]*`); không gửi number, khoảng trắng, dấu hay số 0 đầu. Chỉ bits/index/bit là number. Request strict: chỉ gửi field của variant; optional field được bỏ hẳn, không gửi null.

| Endpoint                | Request                                                       | Response HTTP 200                                                                                 |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/api/dh/params`        | `q, alpha?`                                                   | `success,q,alpha,factors,primitiveRootChecks,suggestedAlpha`                                      |
| `/api/dh/params/random` | `bits:16\|32\|64\|128`                                        | Như params, thêm `p`, alpha string, suggestedAlpha null                                           |
| `/api/dh/keypair`       | `q,alpha,privateKey?`                                         | `success,privateKey,publicKey,steps`                                                              |
| `/api/dh/shared-secret` | `q,privateKey,otherPublicKey`                                 | `success,sharedKey,steps`                                                                         |
| `/api/dh/exchange`      | `q,alpha,privateKeyA?,privateKeyB?`                           | `success,privateKeyA,privateKeyB,publicKeyA,publicKeyB,sharedKeyA,sharedKeyB,match,steps,warning` |
| `/api/dh/caesar`        | JSON `q,privateKey,otherPublicKey,action,data` hoặc multipart | `success,sharedKey,shift,result,warning?`                                                         |

Không có endpoint sinh hai số mũ riêng biệt. Omit private key trong keypair/exchange để BE sinh. Exchange không nhận cờ trace và không trả q/alpha. FE giữ snapshot request để trình bày công thức; private keys được BE trả lại là nguồn chính xác khi request bỏ chúng.

Manual params có `5 ≤ q ≤ 10^12`; downstream tự validate tới `2^128−1`, không yêu cầu request params trước. Random trả safe prime `q=2p+1`. Private key thuộc `2..q−2`; keypair/exchange từ chối key sinh public bằng `1` hoặc `q−1`. Shared-secret nhận peer public trong `2..q−2` và không nhận alpha. FE giữ string, dùng BigInt cho so sánh khi cần, không Number/parseInt.

Params thiếu alpha trả `alpha:null`, checks rỗng và suggestedAlpha; đây chỉ là gợi ý, không được trình bày như alpha đã chọn. Alpha explicit hợp lệ có checks và suggestedAlpha null.

## Trace và warning

Trace square-and-multiply đọc bit **trái sang phải**, tối đa 128 rows/phép, mỗi row đúng `{index,bit,exponentPrefix,squared,multiplied,result}`. `multiplied` luôn có mặt, null khi bit 0. `exponentPrefix`, `squared`, `multiplied` khác null, `result` là decimal strings. Exchange steps chứa bốn arrays `publicKeyA,publicKeyB,sharedKeyA,sharedKeyB`; tổng tối đa 512 rows. Không có metadata base/exponent/modulus trong wire trace.

Primitive-root check có `{factor,exponent,result,passes}`. FE kiểm schema và liên kết kết quả; không tính DH hoặc trace local. Oracle số học chỉ tồn tại trong tests.

DH là feature độc lập: năm endpoint tham số/khóa/exchange trả kết quả số học thật từ đầu vào. `/api/dh/caesar` là tích hợp bổ sung, không thay đổi Caesar standalone.

Exchange luôn có warning `EDUCATIONAL_PRIVATE_KEYS` với message từ BE. UI hiển thị warning cạnh kết quả vì response chứa cả hai private keys để đối chiếu phép tính. Warning nhắc khóa riêng không rời bên sở hữu và khóa công khai phải được xác thực để chống MITM trong hệ thống thực tế. Caesar shift 0 vẫn thành công, text không đổi, warning `SHIFT_ZERO`; khi shift khác 0 field warning bị bỏ, không null.

## Caesar text/file

JSON dùng action encrypt/decrypt và data nguyên văn. Rỗng bị từ chối; whitespace hợp lệ. Caesar chỉ đổi ASCII A–Z/a–z, giữ Unicode/dấu câu/line endings.

Multipart đúng năm parts `file,q,privateKey,otherPublicKey,action`; không thêm data hoặc response_mode, không tự đặt Content-Type. File `.txt` không phân biệt hoa thường, UTF-8 strict, không rỗng; đúng 5.242.880 raw bytes được nhận, lớn hơn bị 413. BOM đầu file được nhận và bỏ khỏi result. Response luôn JSON, không attachment, filename hay Content-Disposition.

## Lỗi, vòng đời và privacy

Error exact `{success:false,code,message,field}` với status 413/415/422/500. Giữ message dạng text; field đã biết focus vào control, field lạ chỉ hiện chung. Code gồm NOT_INTEGER, Q_OUT_OF_RANGE, NOT_PRIME, ALPHA_OUT_OF_RANGE, NOT_PRIMITIVE_ROOT, BITS_INVALID, PRIVATE_KEY_OUT_OF_RANGE, PRIVATE_KEY_WEAK, PUBLIC_KEY_INVALID và các lỗi request/file/action. Resource errors FACTORIZATION_FAILED, PRIMITIVE_ROOT_NOT_FOUND, GENERATION_FAILED là 422; cho thử lại/sinh nhóm khác. Xem nguồn canonical cho exact status/message/precedence.

Thứ tự validation: declared Content-Length >64 MiB → media/parse/duplicate → exact fields/control → q → alpha → private key → public key → action/data → computation. Không áp giới hạn body 4 KiB/response 64 KiB của spec cũ; canonical không hứa Cache-Control response.

Một tác vụ mỗi thời điểm. Sửa đầu vào, preset/reset, đổi workspace hoặc unmount abort và tăng revision; response/error/finally cũ không được áp state. Request mới xóa kết quả/trace cũ. Timeout 15 giây, không auto retry. Khởi tạo trống; Tạo ví dụ điền 23/5/6/15 mà không gửi request. Header Làm mới xóa draft và về Caesar. Không tự gọi khi mount/mở trace.

Giữ draft/snapshot/result trong bộ nhớ; không log, persist hoặc đưa parameters/keys/input/output/file/trace/warning vào URL, analytics hay browser history. Chỉ `/api/dh/caesar` ghi metadata server history best-effort: source text/file, operation theo action, responseMode null. Năm endpoint còn lại không ghi row. History tắt/lỗi không làm DH thất bại.

Contract hiện tại không có ECDH, KDF, xác thực MITM hay key storage. Không quảng bá cho bảo mật production.

## Kiểm chứng

Preset 23/5/6/15 cho public 8/19, shared 2/2; hoán đổi hai phía vẫn shared 2. Keypair private 11 với q23/alpha5 phải bị PRIVATE_KEY_WEAK. Shared-secret 353/97/248 cho 160; Caesar Hello World cho Lipps Asvph với shift 4.

Chạy unit/component và HTTP mock theo README feature. Bộ API thật kiểm sáu endpoints, arithmetic traces, strict DTO/errors, JSON/multipart và safe metadata history: [hướng dẫn nghiệm thu](DIFFIE_HELLMAN_BE_INTEGRATION.md). Fixture/mock pass không thay thế nghiệm thu BE thật. Cờ deployment chỉ bật sau khi kiểm đúng BE revision của môi trường.

## UI thực hành đã chốt — 2026-10-09

Hai khu vực Thực hành DH và Caesar bằng khóa chung luôn hiển thị. Dùng chung draft q/alpha/private A/B với form exchange. Params kiểm tra riêng; alpha gợi ý cần bấm Dùng α gợi ý. Random cập nhật q/alpha đồng thời xóa hai private keys và mọi kết quả phụ thuộc. Keypair cập nhật private key bên được chọn; giữ riêng public key và trace A/B. Shared-secret dùng private bên chọn/public bên kia từ hai keypair còn hợp lệ hoặc exchange snapshot. Không nhập public key rời.

Caesar dùng snapshot exchange thành công, kể cả private key BE sinh khi draft bỏ trống. Chọn A mặc định hoặc B; đổi bên xóa output Caesar, giữ text/file. Hai cột nhập liệu/kết quả, mode encrypt/decrypt, text/file source, paste/copy/clear, file drag/drop/preview/remove, output copy/download/clear và tab phân tích theo control chung. Phân tích dùng response K/shift, chế độ, nguồn, số ký tự; không có ô nhập shift. Tải kết quả tạo `.txt` cục bộ từ JSON, không gọi lại BE hay tạo thêm history. Response Caesar phải khớp shared key của exchange và shift `K mod 26`.

Một request lock cho exchange, random private và toàn bộ thao tác thực hành/Caesar. Không auto-run; sửa input hủy request đang chạy. Sửa q/alpha xóa kết quả tham số/khóa/khóa chung phụ thuộc; sửa private A hoặc B chỉ giữ keypair bên không đổi, xóa shared-secret và exchange/Caesar output. Text/file Caesar được giữ khi khóa DH mất hiệu lực. Xóa kết quả bước không xóa draft; xóa kiểm tra tham số/cặp khóa cũng xóa kết quả phụ thuộc. Đặt lại Caesar chỉ xóa Caesar; Đặt lại DH xóa toàn bộ qua resetVersion.
