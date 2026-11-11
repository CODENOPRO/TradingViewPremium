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
- Indicators có My scripts / Favorites / On chart, lưu code và nhiều instance độc lập trên mỗi chart. Pine v6 thử nghiệm (PineTS) hoặc JavaScript chạy trong Worker; không tự thêm indicator mẫu. Xem [INDICATORS.md](INDICATORS.md).
- Backend lấy mã/timeframe từ `symbolInfo` của nguồn có nến; không đoán theo `sds_N` hoặc tên indicator. Không tự đổi timeframe của TradingView.
- Reconnect có backoff; snapshot dữ liệu đang được TradingView tải mỗi 20 giây, tail poll mỗi giây; sửa nến đến trễ/volume-only, atomic persistence và backup.

## Bản thử v5

Mở `/?engine=v5` để thử pane native trên Lightweight Charts 5.3.0; `/line-tools-lab.html` để thử bộ vẽ plugin riêng. Bản chính vẫn v4.2.2. Vùng thử đọc bản sao và ghi storage có prefix riêng, không ghi đè hình/script/account gốc. Xem [checklist và giới hạn](V5_PREVIEW.md).

## Giới hạn cần biết

- **Đã có QS Stacks+ JavaScript và QT+ test port để nhập thủ công. QT+ chưa tương đương Pine hoàn chỉnh.** Xem [cách test và giới hạn](frontend/indicators/README.md). Có thể dán Pine v6 vào runtime thử nghiệm; chưa tương thích đầy đủ mọi script/import.
- Worker hỗ trợ series line/histogram/area, overlay drawings, pane ribbon riêng, tables và màu thân nến. Tín hiệu/alert Pine chưa được xác nhận parity.
- Chỉ lấy các mã/timeframe hiện có trong chart nguồn và cache. Chưa có dịch vụ tải lịch sử độc lập, warmup HTF chủ động hoặc xác nhận đủ 5.000 nến cho QT+.
- Chưa hoàn thiện toàn bộ công cụ TradingView: các công cụ hiện có là rectangle, trendline, text, fib, position box và measure. Visibility lưu cả các nhóm thời gian ngoài UI nhưng hiện UI chỉ có phút/giờ/D/W.
- Paper engine khớp theo các mẫu giá nhận được khi backend/trình duyệt hoạt động; chưa có mô phỏng tick-by-tick, phí/slippage, margin liquidation, amend/drag lệnh hoặc giao dịch trong replay. Không coi là parity broker/TradingView đầy đủ.
- Dữ liệu và workspace nằm trên máy. Thêm người xem repo không đồng nghĩa cấp họ quyền truy cập nguồn giá TradingView của bạn.
- CDP dùng API nội bộ của TradingView, có thể đổi khi ứng dụng cập nhật; trạng thái mất nguồn/stale được hiển thị thay vì tiếp tục giả là live.

## Indicator JavaScript

File nhập định nghĩa `function calculate(bars, context)` hoặc `const indicator = { name, defaults, calculate }`. Kết quả là `{ series, drawings, tables, pane?, candleColors?, events?, warnings? }`.

- `series`: danh sách `{ type: 'line' | 'histogram', data: [{ time, value }], color, width, title }`, time giây Unix tăng dần.
- `drawings`: `{ type, p1: {time,price}, p2?: {time,price}, ...style }`; các loại theo `DrawingModel`.
- `tables`: `{ title, rows: [[value, ...], ...], position?, pane? }`; ô có thể là `{text,color}`.
- `pane`: `{title, min, max, drawings}`; cùng time axis, thang dọc riêng, không đổi ba chart độc lập.
- `candleColors`: `[{time,color}]` cho màu thân nến; `warnings` hiện trên status. `events` chỉ là kết quả tính, chưa có notification dispatcher.
- `context`: `symbol`, `timeframe`, `metadata`, `settings`, `markets` chứa dữ liệu đa mã/khung và `viewport`.

Code lưu trong thư viện local, mỗi lần Add tạo instance riêng theo chart. Worker giữ UI đáp ứng; chỉ chạy code bạn tin cậy. Pine v6 dùng PineTS vendored và provider local; external import thiếu source sẽ báo lỗi, không tải từ tài khoản TradingView.

## Kiểm tra

```text
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
```

Biến môi trường cho kiểm thử/preview: `TERMINAL_HTTP_PORT`, `TERMINAL_WS_PORT`, `TERMINAL_CDP_PORT`, `TERMINAL_DATA_DIR`, `TERMINAL_OFFLINE=1`. Dùng data dir riêng để không sửa cache thật.

`AGENTS.md` là nguồn yêu cầu và nhật ký chính. `TRADINGVIEW_DATA_EXTRACTION_SPEC.md`, nếu có, là tài liệu mô tả cơ chế cũ; không coi resolution cycling/anti-sleep trong đó là hành vi bản backend mới.

## Repo và quyền truy cập

Repo đích: https://github.com/CODENOPRO/TradingViewPremium . Sau mỗi đợt sửa đã kiểm tra: ghi tiếp `AGENTS.md`, commit, push; không force-push. Cache thị trường, metadata, backup, file tạm và secrets không được commit.

Mời người khác: mở repo → **Settings → Collaborators & teams → Add people**, nhập username GitHub và gửi lời mời. Sau khi họ chấp nhận, họ có thể chọn **Code → Download ZIP** hoặc `git clone` bằng tài khoản được cấp quyền.

Repo cá nhân private không có vai trò collaborator chỉ đọc: collaborator có cả quyền push. Nếu chỉ muốn chia sẻ quyền xem/tải, dùng repo Organization với vai trò **Read**, hoặc public để mọi người đọc/tải mà không cần mời. Không tự đổi visibility hoặc gửi lời mời thay người dùng. Tham khảo [GitHub repository permissions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository).

PineTS 0.13.1 giữ LICENSE AGPL-3.0-only và provenance trong frontend/vendor/pinets-0.13.1. Lightweight Charts vendored giữ thông báo giấy phép và attribution của TradingView. Các bản JavaScript chuyển từ attachment giữ notice MPL-2.0/attribution; không upload attachment Pine gốc hoặc thư viện ENIGMA.
## Chart Settings

Nút ⚙ mở bảy mục cài đặt theo TradingView Desktop, có preview/Cancel và lưu riêng từng chart. Xem [CHART_SETTINGS.md](CHART_SETTINGS.md) để biết các mục đã nối hành vi và phần còn thiếu dữ liệu/chức năng.

Bốn cụm nổi trên trái/phải, dưới trái/phải và thanh vẽ trái nằm trên chart phủ kín cửa sổ. Trong Settings → Cụm công cụ trên chart có bật/tắt từng cụm và độ trong suốt nền; các tùy chọn này lưu ngay, riêng với preview/Cancel của chart. `Ctrl + ,` mở lại Settings kể cả khi đã ẩn hết. Watchlist/Objects/Data/Alerts/Editor nằm trong menu Layout thay cho dải đen cố định bên phải.

Header tên mã/OHLC và BUY/SELL trên từng chart đã ẩn theo yêu cầu giao diện gọn; lệnh demo dùng nút Paper Trading. Góc dưới dùng biểu tượng NQ/ES/YM, tự tránh thanh vẽ/cụm dưới và đổi theo mã; CL chưa có asset nên không gán logo của mã khác. Thanh trên thiếu chỗ sẽ đưa các thao tác phụ vào `…`. Logo attribution trên chart tắt bằng tùy chọn chính thức; notice được giữ trong vendor và link TradingView nằm trong Settings. Nguồn: [LayoutOptions.attributionLogo](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/LayoutOptions#attributionlogo).

Crosshair đồng bộ dùng cùng thời điểm và độ cao chuột tương đối theo từng vùng giá, không ghim vào close/OHLC của chart đích. Nếu đích thiếu nến đúng thời điểm thì xóa crosshair đồng bộ thay vì nhảy về cây cũ; khung lớn hơn dùng nến thực chứa thời điểm đó. Ra khỏi vùng giá hoặc vào pane indicator thì xóa crosshair ở các chart khác. Vùng chart mặc định dùng con trỏ dấu cộng; hành vi đồng bộ kéo/zoom không đổi.

Đối chiếu toàn màn hình và panel desktop: [DESKTOP_PARITY.md](DESKTOP_PARITY.md).

Nếu web báo backend cũ: đóng server Python cũ rồi chạy lại `start_terminal.bat`. `/health` của bản hiện tại có `service: trading-terminal`, `protocol_version: 2` và cổng WS. Dữ liệu chỉ live cho mã đang được tải trong TradingView; mã thiếu nguồn giữ cache và hiện trạng thái dữ liệu đã lưu.

## Bộ vẽ được yêu cầu khảo sát

Đã đọc lightweight-charts-drawing của deepentropy; chưa thay renderer v4 hoặc migrate hình cũ. Quyết định và khác biệt tại [DRAWING_REPO_REVIEW.md](DRAWING_REPO_REVIEW.md).
