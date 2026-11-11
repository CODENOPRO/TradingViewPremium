# Indicator JavaScript để test

Hai bản port JavaScript để nhập thủ công, không thêm indicator mặc định. Host hiện có runtime Pine v6 thử nghiệm riêng; xem [INDICATORS.md](../../INDICATORS.md).

- `qs-stacks-plus.js`: bản **Quarter Sequence Stacks+ | @arleay** từ attachment ngày 2026-11-11 (475 dòng Pine, © arleay).
- `qt-plus.js`: bản **QT+ by 4XS** từ attachment trước đó (3.300 dòng Pine, © Enigma; QS © Danielliuks / @Crypto_MM_). Đây là **test port có giới hạn**, chưa phải bản Pine tương đương hoàn chỉnh.

Mở web → chọn chart → **Indicators → New script → Nhập file .js → Save & add to chart**. Sau khi nạp, bấm **⚙ cạnh tên indicator**, ⚙ cạnh nút Indicators hoặc ⚙ trên header cycle để mở **Inputs / Style / Visibility**. Inputs có checkbox/ô số/menu/màu và tìm kiếm; Cancel bỏ draft, Ok lưu. Một số tùy chọn QT+ chưa port được khóa rõ. Hoặc dán toàn bộ nội dung một file. Thông số JSON `{}` dùng mặc định; tên input giữ theo Pine. Có thể add cả hai trên cùng chart thành hai instance và pane riêng. Reload sẽ nạp lại tất cả instance/settings đã lưu. Không dán hai file chung một editor.

Ví dụ QS: `{"showLiquidity":true,"smtNano":true}`. QT+: `{"show_qcisd":true}`. Sửa xong file trên đĩa phải nhập/lưu lại; bản đã lưu trong localStorage không tự cập nhật theo file.

## QS Stacks+

Đã chuyển clock Monthly/Weekly/Daily/90m/Micro/Nano, sequence/root 3-6-9, adjacent-quarter SSMT, stage swing tolerance, True 90m Open, prior-quarter liquidity và Sequence Of Sequences. Ribbon nằm trong pane dưới mỗi chart. Chỉ tính nến đã đóng như `barstate.isconfirmed` của nguồn; intraday tiêu chuẩn, timezone New York có DST, giữ mốc 337,5 giây của nano. Chu kỳ đầu bị cắt giữa chừng chưa được dùng làm previous quarter đã hoàn tất.

Peer auto theo ES/NQ/YM hoặc micro tương ứng; có manualA/manualB. Chỉ dùng peer đúng timestamp (`gaps_on` của nguồn). Thiếu dữ liệu thì báo, không tự lấy nến tương lai hoặc gán mã khác. Chưa so từng tín hiệu với TradingView; font, vị trí tag và border có thể khác. Alert conditions được trả dưới dạng `events`, chưa phát âm thanh/notification hoặc nối vào alert service.

## QT+ — phạm vi test và khác biệt còn lại

Đã có tính native cho Normal/Hidden SSMT 7 cấp, QCISD level/confirm/3-body invalidation/retest, PSP body/icon, session/90m/micro boxes, divider, opening slots, True Opens từ history đã tải, Quarter Sequences/filter/369/chain/projection. SSMT dùng input `UTC-4` cố định mặc định, còn QT boxes/True Opens/QS dùng timezone của từng module như nguồn; không đồng nhất chúng thành một timezone.

Những phần **chưa tương đương Pine**, cần đối chiếu trước khi dùng tín hiệu:

- Không có source `ENIGMA_001/AssetCorrelationUtils/8`. Auto JS dùng mapping riêng NQ/ES/YM và MNQ/MES/MYM; Manual/Dyad, mã khác và B-ADJ báo lỗi rõ, không giả lập library.
- Peer QT+ chỉ tính khi có nến đúng timestamp. Pine QT+ dùng `request.security` gaps mặc định và `lookahead_on`; việc carry-forward, HTF/lower-TF sampling và realtime rollback đầy đủ của Pine chưa được tái tạo. Khi có gap hoặc ở HTF, kết quả có thể khác.
- True Opens là mức đã quan sát trong W/D/4h/1h/1m hiện có. Không có deep backfill, không dựng giá cho mốc bị thiếu. Request.security/lookahead của nguồn chưa được đối chiếu từng khung; bảng ghi rõ observed history, không phải xác nhận đủ các mức của TradingView.
- Các điều kiện SSMT alert phối hợp 4 hàng chưa chuyển; QCISD/sequence events chưa nối notification. Tránh coi các input alert trong danh sách default chép từ Pine là alert đang hoạt động.
- Default input được chép từ nguồn để tham chiếu; một số font, size, width, tooltip, label merging và global garbage collection 500-object của TradingView chưa tương đương. Host hiện chặn 2.000 hình overlay / 2.000 hình pane; lịch sử dài hoặc bật nhiều lớp có thể chạm giới hạn và báo lỗi.
- Cả hai bản tính lại từ history được cung cấp trong Worker, không giữ state bị lẫn giữa mã. Cache clock được chặn kích thước; chưa benchmark đủ 5.000 nến hoặc dữ liệu thiếu nhiều phiên. Không hứa chạy mọi Pine.

RTH: host lọc peer từ minute history và dựng lại HTF theo session metadata, không đem nến ETH so với nến RTH. Độ sâu RTH vẫn giới hạn bởi cache 1m. Replay không cho plugin đọc giá sau nến đang hiển thị; projection QS chỉ dựa vào clock.

## Kiểm chứng

`node --test tests/*.test.cjs`: kiểm tra DST/mốc fractional, Friday Q4, divergence seed/invalidation, missing peers, confirmed bars, QCISD confirm/invalidation, Worker, RTH và lỗi renderer với hình indicator không có ID. Đây là test theo logic đọc từ source, chưa phải golden-output so với Pine runtime.

Đo Node trên 388 nến NQ cache thật tại máy: QS cold ~28 ms, warm 5–11 ms; QT+ cold ~90 ms, warm 62–77 ms (5 lần warm). Chỉ đo calculate, không gồm truyền dữ liệu/render và không phải cam kết tốc độ trên máy khác. Không commit dữ liệu giá.

Giữ MPL-2.0 và attribution tác giả trong từng file. Không sửa attachment gốc, không chứa source thư viện ENIGMA.

## Điều khiển pane cycle

- Kéo vách trên pane để tăng/giảm chiều cao; có thể focus vách và dùng phím ↑/↓.
- Kéo bên trong pane để trượt thời gian và thang dọc; kéo trục bên phải để zoom dọc. Cuộn trên pane zoom thời gian; Shift + cuộn hoặc cuộn trên trục phải zoom dọc.
- Header có ⚙, reset thang dọc, thu gọn và phóng to/khôi phục. Kích thước/thang dọc được lưu riêng theo chart qua reload; time axis dùng chung với chart chủ. Không thay controller đồng bộ hiện có.
- Style bật/tắt overlay, pane, tables, candle colors; Visibility chọn các timeframe hiện có của web. Đây là điều khiển hiển thị của host, không thay thuật toán hoặc bổ sung độ sâu dữ liệu.
