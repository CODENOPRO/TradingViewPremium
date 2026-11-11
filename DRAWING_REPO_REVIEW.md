# Đối chiếu bộ vẽ deepentropy

Yêu cầu ngày 2026-11-11: xem lại web hiện tại và TradingView đang mở; đọc https://github.com/deepentropy/lightweight-charts-drawing ; không tự thêm công cụ vẽ tùy ý. Đợt này khảo sát repo và hoàn thiện lưu indicator, chưa thay renderer drawing production.

Đã đọc source tại commit **1c0caad8630e48f2e906662c9d52baf03c7d3ca4**, package **0.9.0**, license **MIT**, peer dependency Lightweight Charts **^5.0.0**. Checkout chỉ nằm ở `.backups/deepentropy-drawing`, chưa cài dependency/build hoặc đưa bundle vào runtime.

Đã xem README, package.json, skill đi kèm, references/code-api.md, references/drawing-model.md, docs/TOOLS.md và các kiểu/spec/manager liên quan. Repo có 86 tool, model tọa độ time/price, default style và logic đặt/kéo/chọn hình. `DrawingManager` có event change/gestureEnd, export/import qua parser, weak/strong magnet, lock/hide và visibility. Rectangle có middle line, fill và style riêng; phù hợp hơn lab Line Tools cũ đang thiếu middle line. Không coi mô tả repository là bằng chứng UI đạt 100% TradingView.

## Khác biệt hiện thấy

| Phần | TradingView được quan sát | Web hiện tại / việc cần làm |
| --- | --- | --- |
| Indicator | Nhiều legend, hide/settings/source/remove riêng; pane QS riêng dưới chart | Đã đổi từ một script sang collection, library và pane mỗi instance; chưa đối chiếu UI cuối sau Esc |
| Drawing toolbar | Các nhóm Lines/Fib/Patterns/Forecast/Shapes/Annotation, favorites riêng | Web còn nhóm tool hạn chế; chưa có catalogue 86 tool |
| Drawing geometry | Handles, snapping, dragging, labels theo tool | Production vẫn dùng DrawingModel/Editor cũ; chưa thay bằng repo này |
| Settings | Host dialog, toolbar và template | Repo cung cấp lõi, không cung cấp toàn bộ dialog/toolbar/bộ nhớ của ứng dụng; phải nối UI hiện có |
| Lưu | Layout giữ indicator và objects | Web giữ local source/instances, drawings theo chart+mã. Repo có export/import để dùng khi migrate; không nên lấy đổi renderer làm lý do mất dữ liệu |
| Engine | TradingView chart riêng | Web mặc định LWC4.2.2; v5.3.0 chỉ opt-in, cần kiểm chứng trước khi dùng repo ở bản chính |

Quan sát cửa sổ source sau đó cho thấy một chart NQ và pane QS; không tự đổi ba chart độc lập của web thành một chart. Cổng nguồn 9222 đang không nhận kết nối trong lần kiểm tra web này, nên web hiển thị cache/stale. Không restart TradingView để ép kết nối. Một số input Windows không mở đúng mục dự kiến; không dùng chúng làm bằng chứng đã xem được Settings mới. Người dùng bấm Esc dừng Computer Use; không tiếp tục input/UI check.

## Cách dùng repo khi chuyển drawing

Giữ một manager theo series/chart; dùng kind/style/point model chính thức. Nối toolbar hiện có và event lưu, không viết thêm renderer hoặc tool cạnh tranh. Giữ undo, dialog, context menu và persistence ở host đúng như API repo.

Trước khi bật mặc định cần bản chuyển đổi có backup, kiểm tra import/export giữ ID/time/price/style/text/lock/hide/visibility và thứ tự lớp. Fib của repo đặt level 0 ở điểm thứ hai, khác model cũ, nên không được copy hai điểm nguyên trạng rồi gọi là tương đương. Long/short position cũng phải kiểm chứng đúng model entry/stop/target, không đổi sang lệnh thật. Những thuộc tính chưa ánh xạ được phải được báo và giữ bản cũ; không âm thầm bỏ.

Chưa chạy demo hoặc thực thi các tool trong repo; chưa có test golden hay UI pass cho bộ này. Không tuyên bố đã thay bộ vẽ trên localhost:3000.
