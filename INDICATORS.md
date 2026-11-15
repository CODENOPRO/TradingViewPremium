# Indicator và bộ nhớ local

Mở `http://localhost:3000` bằng cùng trình duyệt/profile đã dùng trước đó. Không cần bấm lưu workspace khi đóng web: code, instance và các thao tác hình vẽ được lưu lúc thay đổi. Không có script mẫu tự chạy.

## Sử dụng

- **Indicators → My scripts**: code đã lưu. Tìm kiếm hoặc đánh dấu sao để đưa vào Favorites. Archive giữ source để có thể Restore; không xóa instance đang dùng trên chart.
- **New script**: editor hiện nhận Pine `//@version=6` với `indicator()`. Đặt tên, Save script để giữ source; Add to chart tạo instance mới, Update on chart sửa instance đang chọn. Runtime vẫn giữ khả năng khôi phục JavaScript đã lưu trước đây. Draft chưa lưu được giữ.
- **On chart**: mọi instance trên chart đang chọn. Mỗi instance có Inputs / Style / Visibility, ẩn/hiện, sửa source, gỡ riêng. Sửa một instance không sửa các bản khác đã add từ cùng source. Save script giữ source; Save & update chart áp dụng vào instance đang sửa.
- Nhiều pane giữ thang dọc và trạng thái kéo/thu riêng, dùng chung time axis của chart. Mỗi chart vẫn độc lập; mode sync không đổi.
- Dừng tính giữ code/settings và lưu trạng thái dừng; bấm Resume ở legend để chạy lại. Gỡ khỏi chart vẫn giữ source trong My scripts.

## Những gì được lưu

| Dữ liệu | Khóa local |
| --- | --- |
| Source, tên, favorites, archive | `indicator_library_v1` |
| Code snapshot, settings, visibility, trạng thái dừng, thứ tự của từng instance | `indicators_<chart-id>` |
| Draft editor | `indicator_draft_v1` |
| View pane riêng | `indicator_pane_<chart-id>:<instance-id>`; v5 dùng `indicator_native_pane_...` |
| Line/box/hình người dùng vẽ, giá/thời gian, style, text, lock/hide/visibility | `drawings_<chart-id>_<symbol>` — định dạng cũ giữ nguyên |

Một indicator cũ trên mỗi chart được chuyển sang danh sách một phần tử, giữ nguyên khóa cũ để phục hồi và chép view pane cũ sang instance `legacy`. Danh sách rỗng đã lưu có nghĩa là người dùng đã gỡ hết; không tự lấy indicator cũ add lại. Nếu storage đầy/lỗi, báo lỗi và không coi thao tác quản lý instance là đã lưu thành công.

Pine/JS tự sinh line và box sẽ tính lại từ source/settings/history khi mở web. Đây là hình tính toán theo dữ liệu, có thể đổi khi nến đổi; không phải ảnh snapshot đóng băng. Hình vẽ tay lưu tọa độ thật và không bị gỡ khi xóa indicator.

LocalStorage thuộc từng browser/profile/origin. Edge, Chrome, `localhost` và `127.0.0.1`, cổng 3000 và 3001 có bộ nhớ khác nhau. Xóa site data hoặc dùng private browsing có thể mất bộ nhớ này. Chưa có backup workspace lên backend/cloud hoặc đồng bộ giữa các trình duyệt. V5 vẫn dùng namespace thử riêng như V5_PREVIEW.md.

## Pine v6 thử nghiệm

Editor dock dưới chart có tô màu cú pháp, số dòng, Tab/Shift+Tab, Ctrl+S lưu và Ctrl+Enter chạy; nút ↗ phóng to/khôi phục. Chạy giữ editor mở để xem console và thời gian tính/gửi vẽ (không phải đo hoàn tất GPU paint). Inputs của instance được giữ khi sửa source. Đây không phải editor/compiler của TradingView và chưa có autocomplete ngữ nghĩa Pine đầy đủ.

Nguồn mới dùng một tab TradingView: main series và hai native Overlay panes cho NQ/ES/YM. Các pane kế thừa timeframe của tab; khung khác trên web dùng cache native và báo thiếu live source. Pine ETH request không tự gom 1m thay thế native bị thiếu. RTH vẫn dùng phép lọc/aggregate theo metadata phiên hiện có, chưa chứng minh mọi lịch phiên tương đương nguồn.

PineTS **0.13.1**, commit `100357e4297209e4693a75b3f56005ce6a73b259`, UMD nạp khi cần trong Worker; LICENSE **AGPL-3.0-only** và hash ở `frontend/vendor/pinets-0.13.1/sources.json`. Đây là runtime độc lập, không phải runtime chính thức của TradingView. Source upstream: https://github.com/LuxAlgo/PineTS .

Adapter nhận input metadata, line/histogram/area/hline, barcolor, background/fill, line/box/text/table và pane/force_overlay. Chỉ lấy OHLC/metadata thật trong cache local. Không tự mượn dữ liệu mã khác hoặc gọi provider bên ngoài. ETH/RTH và replay được áp dụng ở provider Pine; request session rõ ràng có thể chọn khác session đang xem nếu cache đủ dữ liệu.

Giới hạn: chỉ indicator, không strategy/backtest. Import cần source thật; thiếu thì dừng với lỗi. Chưa chứng minh tương đương mọi `request.security`/nested request/gaps/lookahead/realtime, lịch tuần và nghỉ lễ. Các timeframe chỉ theo MarketData hiện có. Plot offset cho line/histogram/area dùng chỉ số nến đã tải thật (không cộng giây giả qua khoảng nghỉ); linefill/polyline và một số vị trí shape trong pane chưa render, sẽ cảnh báo. Label/shape dùng text giản lược. Events/alerts chưa nối webhook/notification. QT/QT+ nguyên bản chưa được xác nhận chạy và cho tín hiệu giống nguồn; không suy ra từ các script kiểm tra đơn giản.

## Hiệu năng và kiểm chứng

- Worker riêng từng instance, timeout JS 4 giây; Pine init 15 giây và calculate 12 giây. Stop chấm dứt Worker, giữ code. Không thực thi script trên UI thread.
- Reuse Indicator đã compile trong Worker; cache khi bars/settings/context không đổi. Khi dữ liệu đổi, chạy lại với PineTS mới để tránh state từ lần tính trước. Đây **không phải** incremental calculation cho mọi Pine.
- Coalesce tick; không hủy liên tục kết quả hợp lệ chỉ vì có tick mới. Đổi mã/session/timeframe/replay sẽ chặn kết quả của context cũ. Giới hạn số plot points/drawings/paint layers trước khi render.
- Kiểm thử dùng UMD browser thật: input và reset defaults, plot, line/box, pane, peer symbol, cache và sửa nến, thiếu import/strategy. Có regression cho khôi phục nhiều instance, storage lỗi, gỡ hết không resurrect legacy, line/box vẽ tay và scheduler.
- UI trước khi bị người dùng dừng bằng Esc: hai Pine indicator cùng chart thật sự render overlay + pane; cold khoảng 482 ms và 710 ms trên 1.500 nến cache trong lần thử này, không phải cam kết tốc độ. Reload đã thấy lại hai instance đang nạp; lượt render hoàn tất sau reload, multi-pane mới, archive và bước dọn script QA chưa kiểm tra trực tiếp sau các sửa cuối. Hai source/instance QA còn trong tab IAB thử, không được tự add cho profile khác. Chưa đóng/mở toàn bộ trình duyệt để kiểm chứng lifecycle thật.

## Bổ sung: preload và 6h

Mỗi lần mở web sẽ yêu cầu nạp lần lượt11khung native bằng một tab nguồn cho NQ/ES/YM, giữ cache cũ và trả lại timeframe trước lượt. Reload khi đã có lượt đang chạy sẽ tham gia lượt đó. Thiếu khung Pine cần sẽ chuyển trạng thái chờ và ưu tiên nạp; không phải add lại indicator sau khi có dữ liệu. Những Worker đã chết ở phiên bản cũ cần reload web để nhận cơ chế mới.

Ngoại lệ được người dùng cho phép:6h ghép từ native1h theo phiên/timezone. UI và Pine warnings ghi rõ nguồn ghép. Khung khác không tự nội suy;12h chưa được bật. Việc ghép và nạp cache không bảo đảm Pine/QT parity; RTH/phiên phức tạp và số nến lookback vẫn cần kiểm tra.

Có sẵn dữ liệu không đồng nghĩa đủ toàn bộ lịch sử. Preload giữ guard RAM2GiB, giới hạn thời gian và dừng khi nguồn không tăng history; các giới hạn ghi ở health.native_loading.warnings. Chart/indicator dùng cache được ngay, không cần chờ quét hết danh sách.
