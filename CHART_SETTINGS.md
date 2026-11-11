# Chart Settings — đối chiếu TradingView Desktop

Ngày 2026-11-11, mở Settings trực tiếp trên TradingView Desktop đang kết nối CDP 9222, chart DAnnBWGE. Đọc cả bảy tab và cuộn phần dưới của Scales and lines, Canvas, Trading; mở palette màu. Đóng bằng Cancel, không áp dụng cấu hình hay đổi mã/phiên/timeframe nguồn.

Dialog cũ chỉ có tám ô màu được thay bằng sidebar Symbol / Status line / Scales and lines / Canvas / Trading / Alerts / Events, nhóm mục, palette màu/hex, Template, Cancel, Ok. Áp dụng ở cả URL chính v4 và preview v5. Không phải tuyên bố toàn bộ tính năng TradingView đã tương đương.

## Đã nối hành vi thật

- Symbol: thân/viền/râu riêng, màu tăng/giảm, tô theo close trước, precision hiển thị, timezone hiển thị; RTH/ETH dùng luồng lọc phiên hiện có khi Ok.
- Status line: logo chữ, title/name/ticker, trạng thái live/stale, OHLC, thay đổi so với nến trước, volume, nút buy/sell, tên indicator và nền legend/opacity.
- Scales and lines: tránh chồng nhãn native, last-price line/value/style, giá trị series indicator, high/low trong cửa sổ đang nhìn, countdown khung intraday khi live, định dạng ngày/giờ, giữ mép trái khi đổi interval.
- Canvas: solid/gradient, màu và kiểu hai lưới độc lập, separator pane native, crosshair, watermark tên/mã, font/thang, navigation/pane buttons, margins trên/dưới/phải.
- Trading: ẩn/hiện vị thế và pending orders; PnL money/ticks/percentage, line kéo dài, căn badge. Không đổi ledger, cách khớp lệnh, số dư hoặc margin.
- Alerts: vẽ đường giá alert đã lưu, chỉ active hoặc cả triggered, màu, tự ẩn hoặc giữ toast cảnh báo đến khi bấm bỏ.
- Events: session breaks lấy bucket phiên từ metadata exchange hiện có, màu/kiểu đường. Không suy đoán lịch rollover/news.

Preview màu và giao diện không ghi storage. Cancel, Escape hoặc bấm ngoài khôi phục bản trước mở. Ok ghi riêng theo chart trong `terminal_chart_settings_v1`, giữ `tv_candle_config` cũ làm fallback và không ghi đè bản cũ. URL v5 vẫn dùng namespace riêng. Template có Save template / Apply template / Reset; không tự đổi session khi nạp template. Profile chart khác được đọc lại trước khi ghi để tránh một tab ghi đè profile chart khác từ snapshot cũ.

Timezone ở đây chỉ đổi nhãn/clock, không thay timestamp OHLC, RTH calendar hoặc clock nội bộ QT/QS. Countdown không giả phiên ngày/tuần/tháng bằng số giây cố định; không hiện khi replay/stale/hết nến.

## Còn khác bản nguồn

Các mục sau hiển thị mờ với nút `?` giải thích, không lưu checkbox giả có vẻ hoạt động:

- ETH background riêng, B-ADJ/raw contracts, previous settlement/last-day change, bid/ask thật.
- Currency/unit header, mode A/L tại thang, lock price/bar ratio, thang giá trái, plus-price menu.
- Legend input/value riêng theo từng script.
- Chế độ xác nhận trước lệnh (hiện giữ one-click cũ), nhiều exit, execution sound/history/labels, reverse, market-order preview, bracket badge, rejection-only notifications, snapshot.
- Ideas, rollover/contract-switch markers, news và notifications nguồn tin.

Một số chi tiết giao diện/hành vi chưa pixel parity: palette dựng từ bảng màu cục bộ, dropdown dùng select trình duyệt, không có opacity cho mọi màu; watermark/visible high-low vẽ bằng overlay; logo là chữ viết tắt; dialog chưa kéo vị trí. Màu/geometry/crosshair/PnL chưa golden-image so mọi layout. Nguồn CDP chỉ mang dữ liệu đã tải; việc chỉnh UI không mở rộng độ sâu lịch sử hay tạo data feed mới.

## Kiểm chứng

- UI v5: preview màu xanh chỉ đổi NQ; Cancel trả màu cũ, ES giữ nguyên. Body unchecked rồi Cancel mở lại checked.
- Gradient + top margin 12 lưu, reload giữ; sau thử đã trả Solid/top 10.
- RTH chỉ NQ, ES/YM vẫn ETH; đã trả NQ về ETH. UTC clock hiện UTC, đã trả New York.
- Cả bảy tab mở được, palette có swatch/hex/custom. V4 preview font 14/navigation Always visible rồi Cancel khôi phục. Không thấy console error mới trong hai tab thử.
- Unit: màu theo previous close qua gap, indicator override/body off và raw OHLC bất biến; timezone qua midnight/DST; margin/timezone validation trước mutation; apply riêng chart và không reset rightOffset khi đổi màu.
- Ảnh local `chart-settings-canvas.jpg`, `chart-settings-symbol.jpg` trong thư mục visualization của chat. Kết quả toàn suite ghi ở AGENTS.md.
