# Terminal Studio — thay đổi local

Giao diện graphite/xanh ngọc, controls, thư viện indicator và panel Music dùng chung màu, viền, trạng thái hover/focus. Chart engine, bảng màu nến, timestamp, drawings store và paper account hiện có được giữ. Không chuyển framework hoặc thêm thư viện animation chạy nền.

Tham khảo đã đọc: [React Bits Dock](https://reactbits.dev/components/dock), [Magic UI Shine Border](https://magicui.design/docs/components/shine-border), [Uiverse](https://uiverse.io/buttons), [Inspora](https://www.inspora.design/). Đây là implementation CSS/JS local lấy cảm hứng từ các mẫu, không phải cài bốn thư viện React.

## Nguồn một tab

Backend chọn một tab chart thật, ưu tiên tab không có marker của launcher và có đủ peer symbols. Main series cộng native `Overlay@tv-basicstudies` ES/YM (hoặc hai mã còn thiếu) dùng một CDP reader. Nếu thiếu pane, backend gọi `addOverlayStudy(symbol, false, true)` theo API đã kiểm tra trên phiên đang chạy; chỉ pane mới được đặt candle style. Không gọi `window.open`, không đổi symbol/timeframe gốc hoặc giới hạn tài khoản.

Snapshot đọc trực tiếp PlotList OHLCV của Overlay và metadata đã resolve của chính symbol; không dùng tên pane hoặc chỉ số sds để đoán mã. Bỏ qua metadata khác symbol, series đang loading và Overlay chưa completed/đang sửa. Health có `source_mode`, `source_target`, `native_timeframes`, lỗi thiếu nguồn theo pair. Các pane native dùng chung timeframe của tab. Khi cần native khung khác, đổi timeframe trong TradingView; web giữ cache hiện có, không tự ghép ETH hoặc giả là live đa khung.

Hai tab nguồn cũ có marker do app tạo đã được xác minh symbol/timeframe rồi đóng sau khi một tab trả đủ NQ/ES/YM; URL phục hồi lưu local trong `.backups/redesign-20261115/retired-source-tabs.json`. Các tab không có marker được giữ.

## Indicator và hình vẽ

Editor dock, syntax coloring, số dòng, phím tắt và console theo instance. Worker giữ UI đáp ứng; sửa source không reset Inputs. Thời gian hiển thị là calculate và synchronous render submission, không phải thời gian GPU hoàn tất.

Canvas hình vẽ được repaint trong native series primitive draw frame, nên giá/thời gian của hình theo biến đổi scale ngay trong frame chart; không chờ pointerup, không chạy vòng RAF khi idle, không chạy lại Pine chỉ do scale giá. Dùng API [Series Primitives 4.2](https://tradingview.github.io/lightweight-charts/docs/4.2/plugins/series-primitives), dùng được với v4/v5 hiện có. Chưa chuyển toàn bộ renderer vào canvas native hoặc thay bộ vẽ.

PineTS 0.13.1 là runtime bên thứ ba. Script QA đơn giản plot/label đã chạy trên 9.681 nến và khôi phục sau reload; không phải bằng chứng mọi Pine hoặc QT/QT+ tương đương TradingView. Import thiếu source và request thiếu native data phải lỗi rõ.

## Backend nghe nhạc

Chuẩn hóa mobile/locale/embed URL, giữ token SoundCloud private, cache metadata thành công, tôn trọng Retry-After khi bị HTTP429. Provider timeout trả504, JSON hỏng/quá lớn trả502; URL không hỗ trợ trả400. Giới hạn redirect link rút gọn vẫn trong provider, sửa trường hợp redirect cuối tới link đầy đủ. Frontend có timeout/abort khi đổi bài, thông báo lỗi metadata riêng.

Đã gọi ba endpoint metadata local với SoundCloud/Spotify/YouTube công khai, HTTP200 và đúng title; URL không hỗ trợ HTTP400. SoundCloud player thật chuyển Play→Pause, tiến tới 0:05/3:33 rồi được tạm dừng. Spotify chỉ xác nhận metadata; chưa xác nhận phát trong khu vực/tài khoản hiện tại. YouTube tiếp tục chỉ metadata theo lựa chọn audio-only trước đây, không có backend tách audio; TikTok chưa kiểm tra phát lại trong đợt này.

Backup trước sửa: `.backups/redesign-20261115/`. Chỉ thay local, không publish hoặc push.
