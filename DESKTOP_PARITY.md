# Đối chiếu TradingView Desktop và web

Ngày 2026-11-11: xem trực tiếp cửa sổ TradingView CDP 9222 và web local. Mở Object tree/Data window và màu tùy chỉnh trong Settings để đọc hex; hủy dialog nguồn và đóng panel khảo sát. Không thay mã, timeframe, phiên hoặc thông số nguồn.

| Vùng | Khác biệt trước đợt này | Đã sửa |
| --- | --- | --- |
| Thanh trên/dưới | Paper/Sync/Refresh/Session dồn trên header | Paper và Editor xuống footer; Session xuống clock; Sync trong Layout; thêm undo/redo bản vẽ |
| Thanh trái | Thứ tự/icon khác, thiếu horizontal line và keep drawing | Sắp lại nhóm công cụ có thực, thêm hai thao tác bằng engine cũ |
| Thanh phải | Không có | Watchlist last-trade, Object tree, Data window, Alerts, Editor chạy thật |
| Legend/BUY/SELL | Tên indicator đè vùng giá/nút, thứ tự chữ khác | Tách vị trí, font/icon hover; badge 100/500/30; nhập số lượng liên kết ticket |
| Màu/giao diện | NQ giảm đen, lưới bật, OHLC trên legend | Đọc NQ giảm `#5e6977`, nền `#c2baae` từ source; chuyển mặc định cũ sang reference và giữ custom khác mặc định |
| Điều hướng | Khó nhận ra đang xem nến lịch sử | Nút về nến mới nhất giữ span zoom, tính theo số nến thật và right margin |
| Hình/indicator | Thiếu quản lý bên phải | Chọn Settings, khóa/ẩn từng hình; hide/show indicator không xóa script hoặc kết quả tính |
| Chart | Thiếu thao tác maximize riêng | Maximize/restore bằng CSS, không đổi layout đã lưu hoặc biến ba chart thành một |

Reference được áp dụng một lần với `desktopVersion=1`; backup appearance trước đổi nằm trong Workspace `terminal_desktop_appearance_before_v1`. Chỉ đổi giá trị trùng mặc định cũ, không thay màu/setting custom khác. ES/YM không tự gán màu nến giảm NQ vì chưa đọc hex riêng của chúng. V5 vẫn namespace riêng. Panel mở/tab Data window lưu riêng ở `terminal_desktop_panel_v1`.

UI đã thử: watchlist nhận quote thật, tree đọc Rectangle/Trendline; hide/show indicator 2→1→2 pane; ẩn hình rồi reload còn ẩn và khôi phục lại; quantity 2 đồng bộ ticket rồi trả 1; maximize còn một chart, restore về ba; mở/đóng Paper; alert thử giá 938271.25 tạo rồi xóa, không giữ alert thử. Nút về hiện tại ban đầu dùng native scrollToRealTime nhưng chưa về đúng; đã thay bằng visible range theo nến thật, UI kiểm tra historical→latest nút biến mất. Panel/Data window còn mở đúng tab sau reload. V4 và V5 không có console error mới trong lần thử; V5 vẫn hai native panes. Không đặt lệnh hoặc thay tài khoản demo.

Chưa giống hoàn toàn: TradingView nguồn đang có ba price series và QT+ trong một chart; web giữ ba chart độc lập theo quyết định đã chốt, vì vậy time axis/pane và tỷ lệ vùng giá không tự ép thành ảnh nguồn. Indicator đang nạp và settings giữa hai app cũng khác; QT+/QS chưa golden-output Pine. Chưa có toàn bộ tools (pattern/Gann/volume profile…), order management/execution và dữ liệu bid/ask/news/rollover tương đương. Native pane v5 còn opt-in. Danh sách setting thiếu chức năng ở CHART_SETTINGS.md, giới hạn indicator ở frontend/indicators/README.md. Không tuyên bố pixel parity ở mọi viewport hoặc tính năng toàn TradingView.

Ảnh local: desktop-layout-parity.jpg, desktop-data-window.jpg trong thư mục visualization của chat.
