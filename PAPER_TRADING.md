# Paper Trading

Giao diện quản lý tài khoản, ticket Market/Limit/Stop, Positions/Orders/History, CSV và các tay kéo SL/TP/lệnh chờ trên chart. Có đóng từng phần, cộng vị thế theo giá bình quân, bù trừ lệnh ngược chiều, giải phóng margin và journal lưu cục bộ. Giữ khóa dữ liệu live terminal_paper_v1 và các lot cũ. Sao lưu mã trước sửa: .backups/paper-trading-20261115/.

## Live

Chỉ khớp với last mới từ nguồn live 1m; quote cũ quá 5 giây hoặc nguồn ngắt sẽ chặn thao tác cần giá. Lệnh Limit đã marketable khớp tại last quan sát được; Stop gap khớp tại last đến sau. SL/TP chạy theo mẫu last, không mô phỏng bid/ask, spread, phí, thanh khoản, slippage hay thanh lý margin. Không gọi broker. Kiểm tra tick size, chiều bracket và margin; lỗi lưu trữ hoàn tác thao tác ledger.

## Replay

Sau khi chọn nến Replay, Paper chuyển sang tài khoản riêng trong terminal_paper_replay_v1; khởi tạo 100.000 USD, margin5%, có thể tạo tài khoản khác. Thoát Replay trả lại tài khoản live. Ledger live vẫn nhận tick live độc lập, không được dùng giá đó trong Replay.

Có đặt, sửa, hủy, kéo bracket và đóng lệnh cả lúc Pause và Play. Nguồn giá là close của nến 1m đã đóng trước/đúng đồng hồ Replay, thuộc các mã trong phạm vi Replay. Mỗi bước khung lớn xử lý tuần tự tất cả close1m mới; không dùng high/low để suy đoán tick nội nến. Vì vậy nến chạm SL/TP rồi hồi trước close1m có thể không khớp. Nếu thiếu1m, chặn giao dịch; không dùng nến tương lai hay giá live thay thế. Journal dùng thời gian lịch sử.

Tua lùi khôi phục checkpoint ledger gần nhất <=mốc chọn; checkpoint cùng mốc gồm các thao tác đã thực hiện tại mốc đó. Nhánh tương lai cũ được giữ trong archive, phát tiếp tạo nhánh mới. Tua trước điểm đầu tạo run mới, giữ run trước. Reload/mở lại Replay tiếp tục run đã lưu khi còn phù hợp với mốc dữ liệu. Nút Lưu phiên Replay xuất JSON toàn bộ runs/branches/checkpoints; CSV chỉ chứa journal tài khoản hiện tại. Chưa có UI import/chọn nhánh đã lưu. Không tự xóa archive; localStorage đầy sẽ báo lỗi và chặn giao dịch cho tới khi lưu được.

## Kiểm chứng

111 Node tests qua (13 bài engine Paper, 5 bài Replay gồm jump, rewind, restore sau reload và tách ledger). QA trình duyệt riêng ở127.0.0.1:3109 dùng dữ liệu tổng hợp: create/switch account, Buy2, reload, kéo SL, partialclose, pending Limit/drag/cancel, resize panel; Replay Pause/step, đặt Limit marketable, sửaSL/TP, đóng, rewind về trước lệnh, thoát về live giữ nguyên tài khoản. Không sửa tài khoản người dùng ở localhost3000, không đặt lệnh TradingView. Chưa kiểm chứng tick thị trường thật trong phiên mở cửa hoặc mọi tổ hợp16chart.

Tham khảo quy trình: [One position per symbol](https://www.tradingview.com/support/solutions/43000482760-how-to-place-several-positions-per-symbol/), [Order ticket](https://www.tradingview.com/support/solutions/43000784804-what-is-an-order-ticket/), [Account manager](https://www.tradingview.com/support/solutions/43000786138-what-is-the-account-manager/). Đây là simulator riêng, không cam kết tương đương bộ khớp TradingView.
