# Cipher Workbench — Scope Frontend RSA minh họa

## 1. Nguồn và mục tiêu

Nguồn yêu cầu: file `rsa-giai-thich.html` do người dùng cung cấp. Đây là prototype giáo dục chạy phép tính RSA trực tiếp trong trình duyệt, không phải contract API hay thiết kế cho mã hóa dữ liệu thật.

Thêm một workspace **RSA minh họa** vào Cipher Workbench để người học tự nhập tham số, theo dõi quá trình sinh khóa, mã hóa và giải mã, rồi hiểu điều kiện giới hạn của bản rõ. Giao diện dùng ngôn ngữ, theme, điều hướng bằng bàn phím và bố cục responsive của Workbench hiện tại.

**Quy tắc tích hợp:** kết quả runtime của Workbench lấy từ Backend. Việc đưa RSA vào ứng dụng chính chỉ được phát hành khi Backend có contract tương ứng và đã kiểm thử tích hợp. Mã JavaScript trong prototype là tài liệu tham chiếu hành vi, không đưa nguyên vào FE production hoặc dùng làm fallback khi API lỗi.

## 2. Phạm vi chức năng

| Nhóm                 | Yêu cầu trong đợt đầu                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tổng quan            | Giải thích luồng Bob sinh khóa → Alice dùng khóa công khai của Bob để mã hóa → gửi bản mã → Bob dùng khóa riêng để giải mã. Phân biệt mục đích bảo mật với chữ ký số.                                |
| Sinh khóa            | Nhập `p`, `q`, `e`; chọn ba preset `(17,11,7)`, `(61,53,17)`, `(101,113,3533)`; bấm **Sinh khóa** để xem `n`, `φ(n)`, cặp khóa công khai `{e,n}`, khóa riêng `{d,n}` và kiểm tra `e·d mod φ(n) = 1`. |
| Giải thích sinh khóa | Có phần mở rộng hiển thị từng dòng thuật toán Euclid mở rộng để tìm `d`. Chỉ hiển thị trace do Backend trả về.                                                                                       |
| Một khối số          | Nhập `P` không âm; bấm **Mã hóa rồi giải mã**; xem `C = P^e mod n`, `P' = C^d mod n`, trạng thái khớp và bảng bình phương–nhân cho cả hai chiều.                                                     |
| Văn bản              | Nhập thông điệp; mỗi Unicode code point là một khối số; hiển thị ký tự, mã `P`, bản mã `C`, số giải mã và ký tự kết quả theo từng dòng. Hiển thị dãy số bản mã có thể truyền đi.                     |
| Kiến thức            | Giải thích vì sao cần `P < n`, vì sao giải mã khôi phục được `P`, và cảnh báo RSA số nhỏ/RSA không padding chỉ dùng để học.                                                                          |
| Giao diện            | Có trạng thái loading, lỗi, thành công; bảng dài cuộn trong khung; dùng được ở desktop và màn hình 375 px; hỗ trợ sáng/tối theo theme chung.                                                         |

Trang RSA là một workspace trong selector hiện có, không mở route riêng. Tên và mô tả cần thể hiện rõ đây là **minh họa**, tránh nhầm với công cụ mã hóa an toàn cho dữ liệu thật.

## 3. Luồng và trạng thái

1. Khi mở RSA lần đầu, để trống p/q/e, bản rõ số và thông điệp. Chỉ bấm **Tạo ví dụ** mới điền `(17,11,7)`, `P=88`, thông điệp `Xin chao`; không tự gửi API. **Đặt lại** đưa các ô về trống.
2. Đổi preset chỉ thay `p`, `q`, `e`, rồi sinh lại khóa. Đổi `p`, `q` hoặc `e` thủ công làm khóa và mọi kết quả phụ thuộc khóa hết hiệu lực cho tới khi sinh khóa lại.
3. Sau khi sinh khóa thành công, có thể xử lý một khối số hoặc văn bản độc lập. Sửa `P` chỉ xóa kết quả số; sửa thông điệp chỉ xóa kết quả văn bản.
4. Khi chưa có khóa hợp lệ, các thao tác phụ thuộc khóa báo cần sinh khóa trước hoặc ở trạng thái disabled có giải thích.
5. Đổi sang thuật toán khác giữ bản nháp RSA theo quy ước Workbench, nhưng xóa kết quả/trace cũ nếu quy ước chung yêu cầu. Nút **Làm mới** ở header đưa ứng dụng về Caesar và reset RSA.
6. Request cũ không được ghi đè kết quả mới sau khi người dùng sửa tham số, đổi workspace hoặc reset.

## 4. Quy tắc dữ liệu và validation

- `p`, `q`, `e`, `P` nhập dưới dạng số nguyên thập phân, không chấp nhận dấu, phần lẻ hoặc ký tự khác. Dùng kiểu dữ liệu chính xác cho số lớn ở ranh giới API; không ép qua `Number` làm mất độ chính xác.
- `p` và `q` là hai số nguyên tố **khác nhau**; theo giới hạn của prototype, mỗi số không vượt `10^12`. Backend phải xác nhận tính nguyên tố và giới hạn cuối cùng.
- `φ(n) = (p−1)(q−1)`; `1 < e < φ(n)` và `gcd(e,φ(n)) = 1`. Nếu không có nghịch đảo, hiển thị lỗi và có thể gợi ý `e` hợp lệ do Backend cung cấp.
- `P` phải thỏa `0 ≤ P < n` để khôi phục đúng. Nếu `P ≥ n`, hiển thị rõ kết quả chỉ là `P mod n`, không gọi đó là giải mã thành công.
- Văn bản được tách theo Unicode code point như prototype. Mỗi code point cần có mã nhỏ hơn `n`; nếu có ký tự vượt giới hạn, chỉ rõ số ký tự không khôi phục được và hướng dẫn dùng `n` lớn hơn. Preset thứ ba cần chạy được ví dụ tiếng Việt có dấu phổ biến.
- Văn bản rỗng báo lỗi. Giới hạn độ dài thông điệp, số dòng trace và kích thước phản hồi cần chốt trong contract Backend để tránh bảng quá lớn hoặc request quá chậm.
- Dữ liệu ký tự người dùng nhập và thông báo từ Backend phải được render như text; không chèn vào HTML thô.

## 5. Ranh giới Frontend / Backend

Frontend quản lý form, validation hỗ trợ người dùng, trạng thái request, bảng trình bày và nội dung giải thích. Backend là nguồn có thẩm quyền cho kiểm tra nguyên tố, sinh khóa toán học, phép lũy thừa modulo, mã hóa/giải mã và các trace. FE không tự sửa kết quả Backend trả về.

Contract Backend cần được thống nhất trước khi triển khai API adapter:

| Tác vụ      | Dữ liệu gửi tối thiểu      | Dữ liệu cần nhận                                                                        |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Sinh khóa   | `p`, `q`, `e`              | `n`, `φ(n)`, `d`, cặp khóa, kiểm tra nghịch đảo, các dòng Euclid mở rộng                |
| Một khối số | Khóa đã sinh và `P`        | `C`, số giải mã, trạng thái `P < n`, trace bình phương–nhân ở hai chiều                 |
| Văn bản     | Khóa đã sinh và thông điệp | Danh sách code point, `P`, `C`, số giải mã, ký tự kết quả hoặc trạng thái lỗi từng khối |

Contract cần quy định cách truyền số nguyên lớn (đề xuất chuỗi thập phân), validation precedence, giới hạn input/trace, schema lỗi, trạng thái key giữa các request và khả năng hủy request. FE chỉ gọi URL tương đối `/api/...`; endpoint và DTO cụ thể sẽ được ghi vào spec tích hợp sau khi Backend xác nhận. Không tự giả định endpoint từ file HTML.

Khóa riêng, `p`, `q` và `φ(n)` trong màn hình này được cố ý hiển thị để dạy thuật toán. Không gửi chúng vào telemetry hoặc lịch sử thao tác. Nếu Backend có ghi lịch sử, phạm vi metadata và việc loại bỏ giá trị khóa phải được xác nhận trước khi bật RSA.

## 6. Ngoài phạm vi đợt đầu

- Mã hóa file `.txt`, tải file kết quả, chia thông điệp thành các khối byte thực sự hoặc tự động tìm kích thước khối.
- Nhập riêng bản mã để giải mã độc lập, nhập/xuất khóa, sinh cặp số nguyên tố ngẫu nhiên.
- RSA-OAEP, chữ ký số, quản lý khóa, AES/mã hóa lai, TLS hoặc tính năng bảo mật production.
- Lưu lịch sử chứa bản rõ, bản mã, `p`, `q`, `d` hay khóa riêng.
- Tự tính RSA trong FE production hoặc chuyển sang phép tính local khi Backend lỗi.

## 7. Tiêu chí nghiệm thu

| ID     | Kịch bản                                                                     | Kết quả mong đợi                                                                                   |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| RSA-01 | Chọn preset `(17,11,7)` và sinh khóa                                         | `n=187`, `φ(n)=160`, `d=23`, `7·23 mod 160=1`; trace Euclid khớp.                                  |
| RSA-02 | Với khóa trên, xử lý `P=88`                                                  | `C=11`, giải mã ra `88`; bảng bình phương–nhân ở cả hai chiều hiển thị đúng thứ tự bit.            |
| RSA-03 | Nhập `P=187`                                                                 | UI cho thấy điều kiện `P<n` bị vi phạm và kết quả giải mã là `0`, không báo round trip thành công. |
| RSA-04 | Nhập `p=q`, số không nguyên tố hoặc `e` không nguyên tố cùng nhau với `φ(n)` | Có lỗi tại vùng sinh khóa; không giữ khóa/result cũ như thể còn hợp lệ.                            |
| RSA-05 | Dùng preset `(17,11,7)` với văn bản có ký tự mã ≥187                         | Chỉ rõ ký tự không khôi phục được và lý do.                                                        |
| RSA-06 | Dùng preset `(101,113,3533)` với một câu tiếng Việt có dấu                   | Mỗi code point hợp lệ được khôi phục đúng; dấu và khoảng trắng được giữ.                           |
| RSA-07 | Sửa tham số khi request đang chạy, đổi tab, reset                            | Không hiển thị response cũ; draft và kết quả tuân theo mục 3.                                      |
| RSA-08 | Nhập ký tự đặc biệt như `<`, `&` trong thông điệp                            | Hiển thị đúng ký tự, không tạo markup/script.                                                      |
| RSA-09 | Dùng bàn phím, screen reader, theme tối và viewport 375 px                   | Các control có nhãn, thông báo đọc được, bảng không gây cuộn ngang toàn trang.                     |
| RSA-10 | Backend lỗi hoặc trả response sai schema                                     | Hiển thị lỗi và cho thử lại; không dùng kết quả tính local.                                        |

Các vector trong file HTML chỉ là oracle để kiểm thử. Bộ kiểm thử tích hợp phải xác nhận response từ Backend thật trước khi bật RSA trong bản phát hành.

## 8. Công việc đề xuất và điều kiện phát hành

1. Chốt Backend contract cho ba tác vụ, giới hạn dữ liệu và chính sách không ghi khóa riêng vào lịch sử.
2. Xây adapter API, kiểu dữ liệu và validation FE theo contract đã chốt.
3. Tạo workspace RSA, bảng trace và nội dung giải thích; ghép vào selector bằng cờ cấu hình cho đến khi Backend sẵn sàng.
4. Kiểm thử vector, lỗi nhập liệu, request lỗi/stale, Unicode, accessibility và responsive; chạy integration với Backend thật.
5. Bật cờ ở môi trường triển khai chỉ sau khi Backend tương ứng đã có và các tiêu chí nghiệm thu đạt.

Nội dung giải thích về bảo mật cần được rà soát riêng trước phát hành. Prototype mô tả RSA giáo trình và nêu ví dụ ứng dụng thực tế ở mức khái quát; UI cần tránh tạo ấn tượng rằng cách mã hóa từng ký tự ở đây dùng an toàn cho thông tin nhạy cảm.
