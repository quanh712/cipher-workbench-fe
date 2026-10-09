# Diffie–Hellman — phạm vi hiện tại

Cập nhật 2026-10-08. Đề xuất MVP cũ đã được thay bằng [spec tích hợp](DIFFIE_HELLMAN_SPEC.md) theo BE frontend-integration.md mục 19. Không dùng URL, DTO, giới hạn hoặc trace của đề xuất cũ để triển khai.

DH thỏa thuận bí mật chung: Y_A=α^X_A mod q, Y_B=α^X_B mod q; K_A=Y_B^X_A mod q=K_B=Y_A^X_B mod q. Preset 23/5/6/15 cho public 8/19 và shared 2. BE tính toán/trace/sinh khóa; FE quản lý form, lifecycle và hiển thị.

Contract bao gồm kiểm/gợi ý alpha, safe-prime random 16/32/64/128 bit, keypair, shared-secret, exchange A/B và Caesar text/file bằng K mod 26. Manual params tới 10^12, downstream tới 128 bit. Trace trái→phải tối đa 128 rows/phép. Exchange cố ý trả private keys và warning giáo dục.

Không gồm kết nối hai người dùng thật, xác thực MITM, chữ ký, KDF, ECDH, quản lý/lưu/xuất khóa hoặc bảo mật production. Caesar chỉ là minh họa dùng khóa chung; upload luôn trả JSON.

FE không persist/log parameters, keys, content hoặc trace. Chỉ Caesar ghi metadata server history best-effort. Nghiệm thu đúng version BE và kiểm UI desktop/mobile, sáng/tối, bàn phím, request cancellation và response muộn trước khi bật cờ deployment. Xem [integration](DIFFIE_HELLMAN_BE_INTEGRATION.md) để phân biệt fixture/mock với live acceptance.
