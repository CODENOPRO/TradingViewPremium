# Trading Terminal

Terminal cá nhân dùng dữ liệu từ TradingView Desktop qua CDP `9222`. Frontend JavaScript thuần + Lightweight Charts; backend Python, chạy cục bộ.

## Chạy trên Windows

1. Cài Python 3.12+ và Git nếu cần lấy code.
2. Chạy `python -m pip install -r requirements.txt`.
3. Mở TradingView Desktop với remote debugging `9222`, tải các mã NQ/ES/YM cần dùng.
4. Chạy `start_terminal.bat`, mở http://localhost:3000.

Launcher có thể mở TradingView nếu chưa chạy; không force-close workspace đang mở. Nếu cổng 3000 do server cũ chiếm, đóng server cũ trước khi khởi động bản này.

## Có trong bản refactor đầu

- Ba chart độc lập, 9 layout; giữ controller đồng bộ hiện có.
- Đổi mã dùng đúng dataset, không lấy nến của mã khác đổi tên.
- ETH và RTH theo metadata session/DST/early close từ TradingView. RTH dựng từ nến 1m đang có; lịch sử RTH không sâu hơn nguồn phút đã tải.
- Hình vẽ lưu theo chart và mã. Chọn để mở toolbar, kéo điểm/hình, double-click mở setting; Style, Text, Coordinates, Visibility, template, khóa, clone, thứ tự lớp, undo/redo.
- Demo account có balance/margin tùy chọn; Market/Limit/Stop, SL/TP, vị thế và sổ lệnh được lưu cục bộ. Giá mô phỏng là last quan sát được, không có bid/ask giả.
- Indicator JavaScript người dùng nhập/lưu/import `.js`, chạy trong Worker có timeout 4 giây; không có indicator dựng sẵn hoặc EMA mẫu.
- Backend lấy mã/timeframe từ `symbolInfo` của nguồn có nến; không đoán theo `sds_N` hoặc tên indicator. Không tự đổi timeframe của TradingView.
- Reconnect có backoff; snapshot dữ liệu đang được TradingView tải mỗi 20 giây, tail poll mỗi giây; sửa nến đến trễ/volume-only, atomic persistence và backup.

## Giới hạn cần biết

- **QT+ chưa được chuyển thành indicator JavaScript hoàn chỉnh. Không hỗ trợ dán Pine nguyên bản.** Worker/editor là nền để thêm bản chuyển đổi, không phải Pine runtime đầy đủ.
- Worker hiện hỗ trợ series line/histogram, drawing và table trên main chart; pane riêng của QT+ chưa triển khai.
- Chỉ lấy các mã/timeframe hiện có trong chart nguồn và cache. Chưa có dịch vụ tải lịch sử độc lập, warmup HTF chủ động hoặc xác nhận đủ 5.000 nến cho QT+.
- Chưa hoàn thiện toàn bộ công cụ TradingView: các công cụ hiện có là rectangle, trendline, text, fib, position box và measure. Visibility lưu cả các nhóm thời gian ngoài UI nhưng hiện UI chỉ có phút/giờ/D/W.
- Paper engine khớp theo các mẫu giá nhận được khi backend/trình duyệt hoạt động; chưa có mô phỏng tick-by-tick, phí/slippage, margin liquidation, amend/drag lệnh hoặc giao dịch trong replay. Không coi là parity broker/TradingView đầy đủ.
- Dữ liệu và workspace nằm trên máy. Thêm người xem repo không đồng nghĩa cấp họ quyền truy cập nguồn giá TradingView của bạn.
- CDP dùng API nội bộ của TradingView, có thể đổi khi ứng dụng cập nhật; trạng thái mất nguồn/stale được hiển thị thay vì tiếp tục giả là live.

## Indicator JavaScript

File nhập định nghĩa `function calculate(bars, context)` hoặc `const indicator = { name, defaults, calculate }`. Kết quả là `{ series, drawings, tables }`.

- `series`: danh sách `{ type: 'line' | 'histogram', data: [{ time, value }], color, width, title }`, time giây Unix tăng dần.
- `drawings`: `{ type, p1: {time,price}, p2?: {time,price}, ...style }`; các loại theo `DrawingModel`.
- `tables`: `{ title, rows: [[value, ...], ...] }`.
- `context`: `symbol`, `timeframe`, `metadata`, `settings`, `markets` chứa dữ liệu đa mã/khung và `viewport`.

Script được lưu theo chart. Worker là cơ chế giữ UI đáp ứng, không phải sandbox bảo mật cho code không tin cậy. Không có module import/Pine transpilation tự động.

## Kiểm tra

```text
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
```

Biến môi trường cho kiểm thử/preview: `TERMINAL_HTTP_PORT`, `TERMINAL_WS_PORT`, `TERMINAL_CDP_PORT`, `TERMINAL_DATA_DIR`, `TERMINAL_OFFLINE=1`. Dùng data dir riêng để không sửa cache thật.

`AGENTS.md` là nguồn yêu cầu và nhật ký chính. `TRADINGVIEW_DATA_EXTRACTION_SPEC.md`, nếu có, là tài liệu mô tả cơ chế cũ; không coi resolution cycling/anti-sleep trong đó là hành vi bản backend mới.

## Repo và quyền truy cập

Repo đích: https://github.com/CODENOPRO/TradingViewPremium . Sau mỗi đợt sửa đã kiểm tra: ghi tiếp `AGENTS.md`, commit, push; không force-push. Cache thị trường, metadata, backup, file tạm và secrets không được commit.

Lightweight Charts vendored giữ thông báo giấy phép và attribution của TradingView. Chưa đưa source Pine người dùng đính kèm hoặc thư viện ENIGMA vào repo.
