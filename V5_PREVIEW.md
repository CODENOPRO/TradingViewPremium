# V5 preview và thử Line Tools

Bản chính giữ Lightweight Charts 4.2.2. Mở `/?engine=v5` để thử bản chính chủ **5.3.0** với native pane; `/line-tools-lab.html` để thử riêng Rectangle/Fib/Position. Không đổi framework, backend, nguồn giá hoặc sync_controller.js.

## Bảo toàn dữ liệu

`Workspace` trên v5 dùng prefix `terminal_v5_preview:`. Nếu chưa có key thử, chỉ đọc fallback từ bản gốc; mọi lần lưu sau đó ghi key thử. Drawings, script/settings, workspace và paper account gốc không được ghi đè. Định dạng hình cũ giữ nguyên; bản v5 vẫn dùng DrawingModel/DrawingEditor hiện có cho hình chính, chưa thay bằng Line Tools. Quay về URL không có `engine=v5` để dùng bản chính.

Native pane dùng transparent anchor series trên đúng timestamp của nến đang hiển thị và một series primitive để render ribbon. Separator, trục giá, crosshair và time axis do Lightweight Charts quản lý; không tự thêm nến tương lai. Giá trị indicator, thuật toán QT+/QS và các giới hạn Pine chưa thay đổi.

## Line Tools: chỉ lab

Plugin core 1.1.2 + Rectangle/Fib/Position 1.1.0, source được cố định theo `frontend/vendor/line-tools/sources.json`. Lab dùng dữ liệu 1m thật từ bridge, không đặt lệnh. Các hình kiểm thử chỉ xuất hiện khi bấm nút tạo; không có indicator/EMA tự bật.

- Export/import và bản lưu lab tách khỏi drawings gốc.
- Import hình cũ là một chiều; bản gốc được giữ nguyên ở sidecar riêng, không export ngược vào store chính.
- Fib plugin tính mức 0 tại anchor thứ hai; adapter đảo hai anchor để bảo toàn giá của từng hệ số.
- Position cũ dùng entry/target/R:R; adapter tính stop theo đúng công thức của DrawingModel rồi truyền ba anchor. Đây là hình vẽ, không tạo/sửa lệnh paper.
- Rectangle plugin chưa có middle line. Loại hình chưa đăng ký, text ngoài box và style position chưa khớp đều được báo, không bỏ mất âm thầm.

Chưa đủ điều kiện thay bộ vẽ chính bằng plugin.

## Checklist trước khi chuyển mặc định

- [x] Giữ đường chạy v4 và vùng lưu thử riêng.
- [x] Native pane thực sự render QS/QT+ trên dữ liệu thật, không phải canvas pane cũ.
- [x] Native pane đổi chiều cao và reload giữ nguyên (header top 94 px trước/sau); đã sửa race lưu chiều cao cũ bằng ResizeObserver sau layout.
- [x] Đổi 1m/5m, RTH/ETH, tháo/gắn native pane qua Style không có lỗi trong lần thử.
- [x] URL v4 mới không có native pane và không có console error; hai legacy panes vẫn hiện.
- [x] Kéo separator bằng chuột thật: UI Edge dịch vách từ y250 lên y190 trong lần thử; không đổi dữ liệu nguồn.
- [x] Rectangle/Fib/Position tạo được và export/import giữ ID/points/options; reload lab khôi phục bản lưu.
- [x] Import lặp snapshot cũ không nhân bản ID; 4 hình trong lab roundtrip qua.
- [x] Unit test namespace isolation, factory v4/v5, bất biến bản gốc, Fib levels/position prices qua session gap, native pane lifecycle khi HTMLElement ban đầu chưa có.
- [ ] Đối chiếu mọi thuộc tính Rectangle, đặc biệt middle line, trước khi đổi drawing engine.
- [ ] Settings dialog đầy đủ cho Line Tools, undo/redo, templates, khóa/ẩn, chuyển mã, z-order và lựa chọn nhiều hình.
- [ ] Benchmark cold/render/transport với cùng dataset, không lấy thời gian Worker làm tốc độ engine chart.
- [ ] So từng tín hiệu QT+/QS với Pine trên cùng OHLC/settings/session/timezone. Vẫn thiếu source AssetCorrelationUtils/8 cho toàn bộ Auto.
- [ ] Kiểm chứng đủ mọi thao tác pan/axis/wheel/touch và mọi layout. Những thao tác chưa có bằng chứng UI không được ghi là đã đạt TradingView parity.

## Nguồn và build

- Lightweight Charts: https://github.com/tradingview/lightweight-charts ; npm `lightweight-charts@5.3.0`, giữ LICENSE Apache-2.0, header và attribution chart.
- Line Tools: các repository/commit đầy đủ trong sources.json; giữ LICENSE MPL-2.0 cạnh bundle. Source từng bundle truy cập bằng repository `/tree/<commit>`. Bản minified build từ source bằng Rollup; chỉ bỏ comment sourceMappingURL vì không phân phối sourcemap.
- Build tools/node_modules/source checkout ở `.backups/v5-probe`, không đưa vào repo hay runtime. Mỗi plugin dùng dependency build chung để tránh cài lặp. Bộ vẽ plugin chỉ được tải trong trang lab.
