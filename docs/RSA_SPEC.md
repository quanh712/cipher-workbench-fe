# Cipher Workbench — Frontend RSA Specification

## 1. Trạng thái và nguồn yêu cầu

Đặc tả này triển khai [RSA_SCOPE.md](RSA_SCOPE.md) dựa trên `rsa-giai-thich.html` do người dùng cung cấp. Prototype là tài liệu về hành vi và vector toán học. Nó chạy RSA trực tiếp trong browser; mã JavaScript của prototype không phải code runtime cho Cipher Workbench.

**Trạng thái: đặc tả FE trước khi có contract RSA chính thức của Backend.** Tại thời điểm viết, [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md) chưa ghim endpoint, DTO hoặc revision RSA. Mục 8 mô tả dữ liệu FE cần và một phương án contract để trao đổi với Backend, không tuyên bố các endpoint ấy đã tồn tại. Khi có OpenSpec/consumer guide chính thức, contract Backend được ưu tiên; cập nhật tài liệu này trước khi nối API thật.

Frontend đã dựng workspace, state và gateway nội bộ để xem UI sau cờ `VITE_ENABLE_RSA=true`. App hiện truyền gateway `null`, vì vậy các nút tính toán bị khóa; fake gateway chỉ dùng trong test. Đây chưa phải bằng chứng tích hợp Backend RSA.

RSA chỉ xuất hiện trong selector của bản phát hành khi Backend tương thích đã được triển khai và các kịch bản ở mục 11 đạt với Backend thật. Không dùng phép tính local hoặc mock để thay thế response lỗi của API production.

## 2. Mục tiêu và ranh giới

Workspace **RSA minh họa** giúp người học quan sát một chu trình: Bob sinh `{e,n}` và `{d,n}`, Alice dùng khóa công khai của Bob để mã hóa, Bob dùng khóa riêng để giải mã. Người dùng có thể thay `p`, `q`, `e`, `P` và thông điệp để xem kết quả cùng các bước tính.

Đây là công cụ học thuật toán với số nhỏ, mỗi ký tự là một khối riêng và không có padding bảo mật. Nhãn và phần giải thích phải nói rõ kết quả **không dùng để bảo vệ dữ liệu thật**. Không mô tả tính năng này như RSA-OAEP hoặc mã hóa file an toàn.

Trong đợt đầu, có ba tác vụ: sinh khóa, mã hóa rồi giải mã một khối số, và mã hóa rồi giải mã văn bản theo từng Unicode code point. Không có chế độ giải mã bản mã nhập riêng. Các phần “vì sao đúng” và “giới hạn bảo mật” là nội dung giải thích tĩnh; các số trong trace lấy từ Backend.

## 3. Vị trí và bố cục giao diện

- Thêm `RSA minh họa` vào selector thuật toán, sau các thuật toán đang có. Dùng tab/panel hiện tại, không tạo route mới. Tab ẩn bởi cờ phát hành, mặc định tắt cho tới khi Backend tương thích.
- Header của workspace nêu luồng Bob → Alice → kênh truyền → Bob. Có mô tả khóa công khai của **người nhận** được dùng để mã hóa.
- Bố cục theo thứ tự đọc: **Sinh khóa** → **Một khối số** → **Văn bản** → **Vì sao giải mã đúng** → **Giới hạn bảo mật**. Trên desktop có thể chia cột trong từng phần; ở 375 px xếp dọc theo đúng thứ tự ấy.
- Khu sinh khóa gồm ba preset, ba ô `p`, `q`, `e`, nút **Sinh khóa**, thông báo, các giá trị `n`, `φ(n)`, khóa công khai/riêng và bảng Euclid mở rộng trong `<details>` mặc định đóng.
- Khu số gồm ô `P`, nút **Mã hóa rồi giải mã**, `P`, `C`, `P'`, thông báo khớp hoặc vượt miền, bảng bình phương–nhân mã hóa mặc định mở và bảng giải mã mặc định đóng.
- Khu văn bản gồm textarea, nút **Mã hóa văn bản**, thông báo và bảng cột `Ký tự`, `P`, `C`, `C^d mod n`, `Giải ra`. Khoảng trắng hiện bằng `␣` trong bảng; thông điệp gốc và kết quả không bị sửa.
- Bảng dài cuộn ngang trong chính khung; trang không cuộn ngang. Dùng theme Workbench hiện có. Mọi input, nút, bảng, trạng thái lỗi và phần mở rộng có nhãn/heading rõ cho bàn phím và screen reader. Không nhúng `style`/DOM/script nguyên từ HTML nguồn.

## 4. Giá trị mặc định và state

Draft ban đầu: `p="17"`, `q="11"`, `e="7"`, `P="88"`, `text="Xin chao"`. Ba preset đúng như nguồn: `(17,11,7)`, `(61,53,17)`, `(101,113,3533)`.

FE giữ riêng:

- Draft chuỗi thô của `p`, `q`, `e`, `P`, `text`.
- Snapshot khóa thành công `{p,q,e,n,phi,d}` kèm trace Euclid; chỉ hợp lệ đối với đúng bộ `p,q,e` đã submit.
- Kết quả số và trace mã hóa/giải mã gắn với snapshot khóa và `P` đã submit.
- Kết quả văn bản gắn với snapshot khóa và `text` đã submit.
- Trạng thái `idle/loading/success/error` và lỗi riêng cho ba tác vụ; request id/AbortController để loại response cũ.

Lần đầu mở workspace, hiện các giá trị mặc định và tự sinh khóa như prototype. Sau khi sinh khóa mặc định thành công, tự chạy ví dụ số và văn bản mặc định. Việc tự chạy chỉ diễn ra một lần cho một lần khởi tạo workspace; khi người dùng đổi preset hoặc sửa form, không tự gửi các tác vụ phụ thuộc nếu chưa bấm nút tương ứng.

| Tương tác            | Hành vi bắt buộc                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sửa `p`, `q`, `e`    | Hủy/loại kết quả của mọi request RSA đang chạy; xóa snapshot khóa, kết quả số/văn bản và trace. Giữ nguyên `P` và `text`.  |
| Chọn preset          | Điền ba tham số, xóa dữ liệu phụ thuộc rồi gửi sinh khóa cho preset mới. Nếu đang tải, kết quả preset cũ không được hiện.  |
| Sinh khóa thất bại   | Không còn khóa hợp lệ; báo lỗi tại khu sinh khóa; giữ draft để sửa và thử lại.                                             |
| Sinh khóa thành công | Hiển thị khóa và trace mới; kết quả số/văn bản cũ vẫn rỗng.                                                                |
| Sửa `P`              | Hủy/loại request số cũ; chỉ xóa kết quả số.                                                                                |
| Sửa `text`           | Hủy/loại request văn bản cũ; chỉ xóa kết quả văn bản.                                                                      |
| Đổi sang cipher khác | Giữ draft RSA; hủy request và xóa kết quả/notice/trace phụ thuộc theo quy ước Workbench. Quay lại không tự chạy lại ví dụ. |
| Header **Làm mới**   | Reset RSA cùng các cipher khác và trở về Caesar.                                                                           |

Nếu người dùng sửa form trong khi request đang chạy, request đó bị hủy hoặc response bị loại bằng version token. Không khóa toàn bộ form chỉ vì một tác vụ đang tải; khóa nút submit của chính tác vụ để tránh gửi đôi. Nếu contract Backend không hỗ trợ hủy tính toán phía server, FE vẫn phải bỏ response lỗi thời.

## 5. Semantics RSA của bản minh họa

```text
n = p × q
φ(n) = (p−1) × (q−1)
gcd(e, φ(n)) = 1
d = e⁻¹ mod φ(n)
C = P^e mod n
P' = C^d mod n
```

Mọi giá trị số nguyên được biểu diễn chính xác, không làm tròn qua `Number`. `p` và `q` là hai số nguyên tố khác nhau. `e` thỏa `1 < e < φ(n)` và nguyên tố cùng nhau với `φ(n)`. `d` là đại diện không âm nhỏ hơn `φ(n)` của nghịch đảo modulo. Bảng Euclid mở rộng hiển thị thương `q`, số dư `r`, hệ số `t`; dòng có `r=1` được đánh dấu.

Bảng bình phương–nhân duyệt bit của số mũ từ thấp lên cao như prototype. Mỗi dòng có chỉ số bit, bit `0/1`, cơ số sau modulo, kết quả trước bước và kết quả sau bước. Nếu bit là `0`, kết quả giữ nguyên. Phần mô tả nêu số mũ dạng nhị phân và số vòng. FE trình bày trace từ Backend, không tự tính trace để tạo/correct result.

Với `0 ≤ P < n`, hiển thị round trip thành công khi `P'=P`. Với `P ≥ n`, vẫn cho phép chạy để dạy hiện tượng modulo: hiển thị `P'=P mod n` và thông báo không khôi phục được `P`. Không dùng dấu thành công cho trường hợp này. `P=0` hợp lệ.

Văn bản dùng `Array.from(text)` semantics: tách theo Unicode code point, không theo UTF-16 code unit, không theo grapheme cluster hay byte UTF-8. Mỗi code point có `P=codePointAt(0)` và được xử lý độc lập. Nếu `P≥n`, dòng đó đánh dấu không khôi phục được; giữ các dòng khác và thông báo tổng số dòng lỗi. Chỉ hiển thị dãy ciphertext như thông điệp gửi đi khi **mọi** dòng khôi phục được, đúng hành vi prototype. Không tự động ghép ký tự thành khối hoặc chọn `n` mới.

## 6. Validation và lỗi

FE kiểm tra định dạng để báo lỗi sớm; Backend kiểm tra và quyết định cuối cùng.

| Trường hợp                                                                               | Hành vi FE                                                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `p`, `q`, `e`, `P` rỗng hoặc khác `[0-9]+` sau khi bỏ khoảng trắng hai đầu như prototype | Báo lỗi tại ô liên quan; không gửi request. Giá trị gửi cần được chuẩn hóa theo contract BE, không âm thầm đổi nghĩa input. |
| `p` hoặc `q` nhỏ hơn 2, lớn hơn `10^12`, bằng nhau                                       | Báo lỗi tại khu sinh khóa. Kiểm tra nguyên tố cuối cùng do BE thực hiện.                                                    |
| `e` ngoài `(1,φ(n))` hoặc `gcd(e,φ(n))≠1`                                                | BE trả lỗi, FE hiển thị nguyên message hợp lệ; nếu response có gợi ý `e`, hiển thị như gợi ý, không tự thay input.          |
| `P` không âm nhưng `P≥n`                                                                 | Gửi request và hiển thị cảnh báo cùng `P mod n` như mục 5.                                                                  |
| Văn bản rỗng                                                                             | Báo nhập thông điệp; whitespace-only là dữ liệu hợp lệ vì dấu cách cũng là code point.                                      |
| Một hoặc nhiều code point `≥n`                                                           | Vẫn hiển thị toàn bộ bảng, đánh dấu từng dòng không khôi phục được và tổng số dòng lỗi.                                     |
| API/network/schema sai                                                                   | Xóa kết quả của tác vụ đó, hiển thị thông báo hệ thống và nút thử lại; không tính local.                                    |

`10^12` là giới hạn của prototype cho **mỗi** số nguyên tố, chưa phải cam kết của Backend. Giới hạn độ dài văn bản, số dòng trace, kích thước payload/response và timeout phải được ghim trong contract BE trước khi phát hành. FE phải xử lý lỗi giới hạn từ BE và không treo trình duyệt khi hiển thị bảng lớn.

Thông báo BE hợp lệ được hiển thị nguyên văn dưới dạng text. Không dùng `innerHTML` hoặc render HTML từ ký tự người dùng nhập; các ký tự `<`, `>`, `&`, dấu nháy và emoji phải hiển thị an toàn. Không đưa `p`, `q`, `d`, plaintext hoặc ciphertext vào URL, log, telemetry hay localStorage.

## 7. Nội dung giải thích

- Trình bày công thức và ý nghĩa của `p`, `q`, `n`, `φ(n)`, `e`, `d` theo HTML nguồn; phân biệt khóa công khai và khóa riêng bằng nhãn, không chỉ bằng màu.
- Nêu điều kiện `P<n` trước phần số và phần văn bản. Tiêu đề phần văn bản cần nói rõ **mỗi ký tự là một khối**; “chia khối” nhiều byte chưa được triển khai.
- Giải thích vì sao `P' = P` bằng quan hệ `ed ≡ 1 (mod φ(n))`; với trường hợp `gcd(P,n)≠1`, chỉ nêu rằng cần xét riêng theo `p`, `q`, không trình bày phép biến đổi Euler như thể áp dụng trực tiếp.
- Cảnh báo `p,q` nhỏ, textbook RSA và mã hóa từng ký tự không an toàn. Tránh câu khẳng định về mức bảo mật hoặc cơ chế TLS hiện hành nếu chưa rà soát với tài liệu chuẩn trước phát hành.

## 8. Contract Backend cần chốt

Các tác vụ dưới đây là **đề xuất năng lực**, không phải endpoint đã xác nhận. FE sẽ dùng service/gateway riêng và URL tương đối `/api/...` sau khi Backend công bố OpenSpec. Mọi số nguyên lớn trong JSON nên truyền bằng **chuỗi thập phân** để không mất precision.

| Tác vụ            | Request tối thiểu đề xuất | Response FE cần                                                                                       |
| ----------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Keygen            | `{p,q,e}`                 | `n`, `phi`, `e`, `d`, phép kiểm tra nghịch đảo, các dòng Euclid mở rộng                               |
| Number round trip | `{p,q,e,plaintext}`       | `ciphertext`, `decrypted`, cờ `plaintextInRange`, trace bình phương–nhân cho encrypt/decrypt          |
| Text round trip   | `{p,q,e,text}`            | Mảng theo đúng thứ tự code point: ký tự, giá trị `P`, `C`, giá trị giải mã, cờ khôi phục; số dòng lỗi |

Backend cần xác nhận:

1. Tên endpoint, field, envelope thành công/lỗi, HTTP status và mã lỗi; có hay không metadata `warnings`.
2. Request number/text gửi lại `p,q,e` để Backend xác thực stateless, hay dùng key handle ngắn hạn. Không gửi `d` do FE tự tính.
3. Trace shape, giới hạn số dòng và liệu text response có trả cả dãy ciphertext hay FE chỉ nối các `C` đã xác nhận.
4. Giới hạn `p,q`, độ dài text, thuật toán kiểm tra nguyên tố, thời gian xử lý và validation precedence.
5. Chính sách history: request RSA không lưu `p`, `q`, `d`, plaintext, ciphertext hoặc thông điệp; chỉ bật nếu metadata an toàn đã được đối chiếu.

Adapter FE kiểm HTTP status **và** body, parse JSON như `unknown`, chỉ nhận shape đã xác nhận. Business error hiển thị `message` hợp lệ; response sai schema hoặc network error dùng thông báo chung. Không thêm route RSA vào selector history cho tới khi Backend có contract history tương ứng.

## 9. Thành phần triển khai dự kiến

- `src/features/rsa/types/`: draft, key snapshot, kết quả và trace theo DTO đã chốt.
- `src/features/rsa/services/`: gateway và adapter API; một nơi duy nhất map request/response/lỗi.
- `src/features/rsa/utils/validation.ts`: kiểm tra cú pháp số nguyên, ràng buộc có thể xác nhận local và text rỗng; không chứa RSA core production.
- `src/features/rsa/hooks/useRsaCipher.ts`: draft, key snapshot, ba tác vụ, cancellation, request version và reset.
- `src/features/rsa/components/RsaWorkspace.tsx`: các form, bảng trace và nội dung giáo dục.
- `src/shared/config/cipherAlgorithms.ts` và `src/app/App.tsx`: cờ `VITE_ENABLE_RSA=true`, nhãn “RSA minh họa”, reset và global busy theo pattern hiện có. Cờ mặc định tắt và chỉ bật khi BE tương thích.

Không mở rộng component chung chỉ để phục vụ một màn hình RSA nếu API của component đó sẽ phải mang khái niệm riêng của RSA.

## 10. Ngoài phạm vi

File `.txt`, download, import/export khóa, tự sinh số nguyên tố, nhập ciphertext để giải mã độc lập, chữ ký số, RSA-OAEP, padding bảo mật, chia khối byte thực, AES/mã hóa lai, lưu khóa hoặc lịch sử nội dung, chạy offline và fallback local đều ngoài phạm vi đợt đầu.

## 11. Nghiệm thu và release gate

| ID     | Kịch bản                                                | Kết quả phải kiểm tra                                                            |
| ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| RSA-01 | `(17,11,7)`                                             | `n=187`, `phi=160`, `d=23`, `e·d mod phi=1`; bảng Euclid đánh dấu dòng `r=1`.    |
| RSA-02 | Khóa trên, `P=88`                                       | `C=11`, `P'=88`; trace có số vòng đúng với biểu diễn nhị phân của `e` và `d`.    |
| RSA-03 | Khóa trên, `P=187` và `P=0`                             | Lần lượt ra `P'=0` với cảnh báo và `P'=0` thành công.                            |
| RSA-04 | `p=q`, composite, `e` không khả nghịch, số thập phân/âm | Lỗi đúng vị trí; khóa cũ không còn hiệu lực sau khi sửa tham số.                 |
| RSA-05 | Preset đầu, thông điệp có `à` (`P=224`)                 | Dòng `à` báo không khôi phục được; bảng vẫn giữ các dòng khác.                   |
| RSA-06 | Preset `(101,113,3533)`, câu tiếng Việt có dấu          | Unicode code point theo thứ tự, tất cả dòng hợp lệ khôi phục đúng.               |
| RSA-07 | `<`, `&`, emoji và xuống dòng                           | Dữ liệu hiển thị như text, không chạy HTML/script; ký tự vượt `n` được đánh dấu. |
| RSA-08 | Sửa tham số trong lúc request chạy, đổi cipher, reset   | Không có response cũ ghi đè state mới; draft/reset đúng mục 4.                   |
| RSA-09 | API 4xx/5xx/network/sai schema                          | Lỗi rõ ràng, retry được, không có kết quả local thay thế.                        |
| RSA-10 | Bàn phím, screen reader, dark theme, 375 px             | Nhãn, focus, trạng thái đọc được; không có cuộn ngang trang.                     |

Unit/component tests dùng gateway fake để kiểm state và renderer. Integration tests dùng Backend thật, đối chiếu vector với oracle độc lập từ prototype, kiểm request shape và lỗi. `npm run check` phải đạt; kiểm browser desktop/375 px và dark theme. Chỉ bật `VITE_ENABLE_RSA=true` sau khi contract BE được ghim, các giới hạn/history được chốt và integration tests đạt trên đúng revision BE sẽ triển khai.
