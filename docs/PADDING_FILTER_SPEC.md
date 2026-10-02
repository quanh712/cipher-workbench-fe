# Lọc ký tự đệm theo contract BE 291da33

Hill và Playfair decrypt giữ `result` thô, thêm `padding: {count, positions, filtered}`.
FE mặc định bật “Tự động lọc ký tự đệm (Playfair/Hill padding)”; hiển thị, sao chép và
file tải dùng `filtered`. Tắt lọc dùng bản thô, không gọi lại process API. FE không
suy đoán hoặc tự cắt X/Q. Backend cũ thiếu metadata thì giữ bản thô và thông báo.

Bản thô luôn có thể mở xem, đánh dấu đệm theo chỉ số chữ A–Z/a–z, giữ Unicode và
ký tự ngoài bảng chữ. Hill chỉ ra khối/ô chứa đệm; vector phân tích vẫn là bản thô.
Chữ thật trùng mẫu đệm có thể bị lọc nhầm (MAX → MA); UI giải thích và cho tắt lọc.

Hill file đọc ở FE và gọi JSON như trước. Playfair file preview lấy cả metadata;
attachment decrypt gửi `strip_padding=true/false` theo toggle. Text tải local dùng
cùng giá trị đang hiển thị. Request/download khóa toggle khi đang chạy.
