# Nền có hiệu ứng cho Cipher Workbench

Ngày nghiên cứu: 2026-10-01. Phạm vi: tham khảo thiết kế, chưa triển khai.

## Ví dụ từ nguồn chính thức

| Ví dụ / demo                                                                           | Hành vi được xác minh                                                                                                                                                                                            | Nhận định thiết kế cho Cipher Workbench                                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [React Bits — Dot Grid](https://reactbits.dev/backgrounds/dot-grid)                    | Lưới chấm đổi màu gần chuột, bị đẩy khi rê nhanh hoặc click rồi trở về vị trí. Dùng Canvas 2D và GSAP. [Source](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/DotGrid/DotGrid.jsx)   | Phù hợp nhất để nâng cấp nền lưới: tương tác rõ nhưng giữ được cấu trúc kỹ thuật. Dùng chấm nhỏ, màu xám xanh và điểm nhấn hồng. |
| [Aceternity — Background Beams](https://ui.aceternity.com/components/background-beams) | Các tia sáng chuyển động theo đường SVG; tài liệu đề xuất làm nền hero.                                                                                                                                          | Gợi luồng dữ liệu mã hóa. Dùng một số đường thưa ở hai mép và sau tiêu đề, tránh chạy dưới chữ nhập liệu.                        |
| [React Bits — Threads](https://reactbits.dev/backgrounds/threads)                      | Các đường sóng chuyển động bằng shader OGL; có thể bật phản ứng theo chuột qua `enableMouseInteraction`. [Source](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Threads/Threads.jsx) | Hợp hướng mềm và tinh tế hơn. Có thể gợi phép hoán vị, nhưng nên giới hạn sau header để bố cục form giữ sự ổn định.              |
| [React Bits — Letter Glitch](https://reactbits.dev/backgrounds/letter-glitch)          | Canvas 2D thay ngẫu nhiên ký tự và màu; có tùy chọn bộ ký tự `characters`, tốc độ và vignette. [Source](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/LetterGlitch/LetterGlitch.jsx) | Đúng chủ đề mật mã nhất: dùng bộ ký tự HEX, nhịp chậm và mờ tại viền. Phủ kín màn hình dễ làm nền quá bận.                       |
| [Vanta — NET](https://www.vantajs.com/?effect=net)                                     | Hiệu ứng mạng 3D; Vanta cho phép tương tác chuột/chạm và tùy chỉnh màu. Chính tác giả lưu ý khác biệt hiệu năng và hỗ trợ mobile. [Source NET](https://github.com/tengbao/vanta/blob/master/src/vanta.net.js)    | Nổi bật, hợp giao diện tối thiên về mạng lưới. Cần thử trên thiết bị thực tế trước khi chọn cho trang công cụ dùng lâu.          |

Tham khảo thêm: [Aceternity Background Boxes](https://ui.aceternity.com/components/background-boxes) là lưới ô sáng khi hover. Có thể chọn thay Dot Grid nếu muốn liên tưởng rõ hơn đến ma trận Hill.

## Đề xuất riêng cho sản phẩm

Ưu tiên **Dot Grid tương tác + vài tia sáng kiểu Background Beams**. Đây là đề xuất phối hợp, không phải một preset có sẵn trong các thư viện trên.

- Nền xám xanh nhạt; chấm đổi sang hồng nhạt gần con trỏ.
- Tia sáng chậm, tập trung quanh header và khoảng trống hai bên.
- Card nhập liệu và kết quả có nền đặc để không bị hiệu ứng xuyên qua chữ.
- Chỉ một hiệu ứng chủ đạo; nếu thử Letter Glitch thì dùng thay lớp beam ở header.
- Khi triển khai: có chế độ giảm chuyển động, giảm chi tiết trên mobile và đo hiệu năng trên trang thật. Chưa có benchmark cho repo này.

Các nhận định “phù hợp”, vị trí, màu sắc và mức độ chuyển động trong tài liệu là đánh giá thiết kế cho Cipher Workbench, không phải tuyên bố của tác giả thư viện. Hành vi React Bits được kiểm tra qua source chính thức vì trang demo dựng nội dung phía client.
