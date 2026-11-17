/* Translate app labels while keeping setting values, market data, and scripts intact. */
const TerminalLanguage=(()=>{
  const key='terminal_ui_language_v1';
  const language=Workspace.read(key,'en')==='vi'?'vi':'en';
  const pairs=`Dismiss notification|\u0110\u00f3ng th\u00f4ng b\u00e1o
Test sound|Nghe th\u1eed
Theme|Ch\u1ee7 \u0111\u1ec1
Themes|Ch\u1ee7 \u0111\u1ec1
Choose an application theme. Chart and candle colors stay in Canvas settings.|Ch\u1ecdn giao di\u1ec7n \u1ee9ng d\u1ee5ng. M\u00e0u bi\u1ec3u \u0111\u1ed3 v\u00e0 m\u00e0u n\u1ebfn \u0111\u01b0\u1ee3c ch\u1ec9nh ri\u00eang trong m\u1ee5c Canvas.
Settings|Cài đặt
Language|Ngôn ngữ
Interface language|Ngôn ngữ giao diện
Click OK to save and reload in the selected language.|Bấm OK để lưu và tải lại bằng ngôn ngữ đã chọn.
Could not save the language preference.|Không lưu được ngôn ngữ giao diện.
Changes preview live on the chart|Xem trước thay đổi ngay trên biểu đồ
Close settings|Đóng cài đặt
Settings categories|Các mục cài đặt
Chart template|Mẫu biểu đồ
Template|Mẫu
Reset|Đặt lại
Cancel|Hủy
Ok|OK
Save as…|Lưu thành…
Apply defaults|Dùng mặc định
Symbol|Mã giao dịch
Status line|Dòng trạng thái
Scales and lines|Thang giá và đường kẻ
Canvas|Giao diện biểu đồ
Trading|Giao dịch
Alerts|Cảnh báo
Events|Sự kiện
Toolbars|Thanh công cụ
Reduce motion|Giảm chuyển động
Follow system|Theo hệ thống
On|Bật
Off|Tắt
Chart toolbars|Thanh công cụ biểu đồ
Top left|Góc trên trái
Top right|Góc trên phải
Bottom left|Góc dưới trái
Bottom right|Góc dưới phải
Left drawing tools|Công cụ vẽ bên trái
Toolbar background transparency|Độ trong suốt nền thanh công cụ
Ctrl + , opens Settings when the toolbars are hidden. Changes here save immediately.|Dùng Ctrl + , để mở Cài đặt khi thanh công cụ bị ẩn.
Candles|Nến
Color bars based on previous close|Tô màu nến theo giá đóng cửa trước
Body|Thân nến
Borders|Viền nến
Wick|Râu nến
Data modification|Điều chỉnh dữ liệu
Session|Phiên giao dịch
Electronic trading hours|Phiên giao dịch điện tử
Regular trading hours|Phiên chính
Electronic trading hours background|Nền ngoài phiên chính
Adjust for contract changes|Điều chỉnh khi đổi hợp đồng
Precision|Số chữ số thập phân
Default|Mặc định
Timezone|Múi giờ
Instrument|Sản phẩm
Title|Tiêu đề
Title display|Nội dung tiêu đề
Description|Mô tả
Symbol and description|Mã và mô tả
Open market status|Trạng thái mở cửa thị trường
Chart values|Giá trị trên biểu đồ
Bar change values|Thay đổi so với nến trước
Volume|Khối lượng
Last day change values|Thay đổi so với ngày trước
Buy/sell buttons|Nút mua và bán
Background|Nền
Opacity|Độ mờ
Custom color|Màu tùy chỉnh
Preset colors|Bảng màu
Hex color code|Mã màu HEX
Save swatch|Lưu màu
Hue|Sắc độ
Color area. Use left and right for saturation and up and down for brightness.|Vùng chọn màu. Dùng mũi tên trái phải để chỉnh độ bão hòa, lên xuống để chỉnh độ sáng.
Indicators|Chỉ báo
Titles|Tiêu đề chỉ báo
Inputs|Tham số đầu vào
Values|Giá trị
Price scale|Thang giá
Currency and Unit|Tiền tệ và đơn vị
Scale modes (A and L)|Chế độ thang giá (A và L)
Visible on mouse over|Hiện khi rê chuột
Always visible|Luôn hiện
Hidden|Ẩn
Lock price to bar ratio|Khóa tỷ lệ giá trên mỗi nến
Price units per bar|Đơn vị giá mỗi nến
Scales placement|Vị trí thang giá
Auto|Tự động
Right|Phải
Left|Trái
Price labels & lines|Nhãn và đường giá
No overlapping labels|Tránh chồng nhãn
Plus button|Nút dấu cộng
Countdown to bar close|Đếm ngược đóng nến
Name, value, line|Tên, giá trị và đường
Value and line|Giá trị và đường
Value|Giá trị
Line|Đường
Symbol value|Giá trị mã
Value according to scale|Giá trị theo thang giá
Raw price|Giá gốc
Previous day close|Giá đóng cửa ngày trước
Indicators and financials|Chỉ báo và dữ liệu tài chính
High and low|Cao nhất và thấp nhất
Bid and ask|Giá chào mua và chào bán
Time scale|Trục thời gian
Day of week on labels|Hiện thứ trong tuần
Date format|Định dạng ngày
Time hours format|Định dạng giờ
Save chart left edge position when changing interval|Giữ mép trái khi đổi khung
Allow extended zoom out|Cho phép thu nhỏ thêm
Chart basic styles|Kiểu biểu đồ
Solid|Màu đơn
Gradient|Chuyển màu
Bottom background|Màu nền phía dưới
Vertical grid lines|Đường lưới dọc
Horizontal grid lines|Đường lưới ngang
Pane separators|Đường phân cách các vùng
Crosshair|Con trỏ chữ thập
Watermark|Hình mờ
Ticker|Mã
Name|Tên
Scales|Thang giá
Scale text size|Cỡ chữ trên trục
Scale text color|Màu chữ trên trục
Text|Chữ
Lines|Đường kẻ
Buttons|Nút
Navigation|Điều hướng
Pane|Vùng biểu đồ
Margins|Lề
Top|Trên
Bottom|Dưới
General|Chung
One-click trading|Giao dịch một lần bấm
Multiple exit levels|Nhiều mức thoát lệnh
Execution sound|Âm báo khớp lệnh
Execution volume|Âm lượng khớp lệnh
Execution tone|Kiểu âm báo khớp lệnh
Show only rejection notifications|Chỉ báo khi lệnh bị từ chối
Appearance|Hiển thị
Positions and orders|Vị thế và lệnh
Reverse position button|Nút đảo vị thế
Project order for market orders|Xem trước lệnh thị trường
Profit and loss value|Giá trị lãi lỗ
Positions|Vị thế
Position units|Đơn vị vị thế
Brackets|Lệnh SL/TP
Bracket units|Đơn vị SL/TP
Money|Tiền
Ticks|Bước giá
Percentage|Phần trăm
Execution marks|Dấu khớp lệnh
Execution labels|Nhãn khớp lệnh
Extended price lines across the entire chart width|Kéo đường giá hết chiều rộng biểu đồ
Order and position alignment|Căn lệnh và vị thế
Orders, executions, and positions in chart snapshots|Hiện lệnh, khớp lệnh và vị thế trong ảnh chụp
Chart line visibility|Hiển thị đường cảnh báo
Alert lines|Đường cảnh báo
Only active alerts|Chỉ cảnh báo đang hoạt động
Notifications|Thông báo
Automatically hide toasts|Tự ẩn thông báo
Ideas|Ý tưởng
Ideas filter|Lọc ý tưởng
All ideas|Tất cả ý tưởng
People I follow|Người tôi theo dõi
Session breaks|Ngắt phiên
Continuous contract switch|Chuyển hợp đồng liên tục
Contract switch breaks|Vạch chuyển hợp đồng
Latest news|Tin mới nhất
News notification|Thông báo tin tức
Symbol search|Tìm mã giao dịch
Search by symbol, name or exchange|Tìm theo mã, tên hoặc sàn
Enter symbol, name or exchange…|Nhập mã, tên hoặc sàn…
Futures|Hợp đồng tương lai
Currently viewed|Đang xem
No matching symbols.|Không tìm thấy mã phù hợp.
Navigate|Di chuyển
Select symbol|Chọn mã
Create price alert|Tạo cảnh báo giá
Edit price alert|Chỉnh cảnh báo giá
Create alert|Đặt Cảnh Báo
Save alert|Lưu cảnh báo
Delete alert|Xóa cảnh báo
Trading symbol:|Mã giao dịch:
Condition:|Điều kiện:
Target price:|Mức giá mục tiêu:
Crossing|Cắt qua mức giá
Above or equal|Lớn hơn hoặc bằng
Below or equal|Nhỏ hơn hoặc bằng
Reactivate triggered alert|Bật lại cảnh báo đã kích hoạt
Close|Đóng
Watchlist|Danh sách theo dõi
Watchlist panel|Theo dõi
Chart|Biểu đồ
Chart panels|Panel biểu đồ
Object tree|Cây đối tượng
Data window|Cửa sổ dữ liệu
Objects & data|Lớp & dữ liệu
Last price|Giá cuối
Waiting for price data|Đang chờ dữ liệu giá
Price source · TradingView|Nguồn giá · TradingView
No price alerts yet.|Chưa có cảnh báo giá.
+ Create alert|+ Tạo cảnh báo
Searching…|Đang tìm…
Loading…|Đang tải…
Connecting…|Đang kết nối…
Waiting for source…|Chờ nguồn…
Disconnected|Mất kết nối
Source error|Lỗi nguồn
Reload chart data|Tải lại dữ liệu biểu đồ
Reconnect chart data|Kết nối lại dữ liệu biểu đồ
Chart layout|Bố cục biểu đồ
Sync in layout|Đồng bộ trong bố cục
Interval|Khung thời gian
Date range|Khoảng ngày
Updates paused|Gián đoạn
Market closed|Nghỉ phiên
No data for this symbol and timeframe|Không có dữ liệu cho mã/khung này
Change symbol|Đổi mã
Command palette|Bảng lệnh
Layout|Bố cục
Replay|Phát lại
Alert|Cảnh báo giá
Paper Trading|Giao dịch mô phỏng
Buy|Mua
Sell|Bán
Music|Nhạc
Calendar|Lịch
Economic Calendar|Lịch kinh tế
Load|Tải
File|Tệp
Open original link|Mở link gốc
Expand|Mở rộng
Hide video|Ẩn video
Show video|Hiện video
Drag popup|Kéo popup
Resize popup|Đổi kích thước popup
Close popup|Đóng popup
Nothing is playing|Chưa phát nhạc
Paste a link to load the official player.|Dán link để mở trình phát chính thức.
Paste a music link or choose an audio file.|Dán link nhạc hoặc chọn tệp âm thanh.
Paste YouTube, Spotify, SoundCloud or TikTok link|Dán link YouTube, Spotify, SoundCloud hoặc TikTok
Paste a TikTok post link. Sound pages need a post that uses the sound.|Dán link bài TikTok có dùng âm thanh này. Trang âm thanh riêng không phát được.
Search scripts…|Tìm script…
Search scripts|Tìm script
☆ Favorites|☆ Yêu thích
‹/› My scripts|‹/› Script của tôi
▤ On chart|▤ Trên biểu đồ
＋ New script|＋ Script mới
Archived scripts|Script đã lưu trữ
My scripts|Script của tôi
Untitled script|Script chưa đặt tên
Paste your Pine Script v6 here…|Dán Pine Script v6 vào đây…
Output|Kết quả
Save|Lưu
Run|Chạy
Save script|Lưu script
Add to chart|Thêm vào biểu đồ
Update on chart|Cập nhật trên biểu đồ
Draft…|Bản nháp…
Draft saved|Đã lưu bản nháp
Saved|Đã lưu
Stop|Dừng
Remove|Gỡ
No matching scripts|Không tìm thấy script
No indicators on this chart|Biểu đồ chưa có chỉ báo
Star a script in My scripts to keep it here.|Đánh dấu sao trong Script của tôi để ghim ở đây.
Your saved scripts appear here.|Script đã lưu sẽ hiện ở đây.
Ready. Paste a Pine v6 indicator to get started.|Dán chỉ báo Pine v6 để bắt đầu.
Your scripts. Your workspace.|Thư viện script của bạn.
Demo account|Tài khoản demo
Create demo account|Tạo tài khoản demo
Account name|Tên tài khoản
Create account|Tạo tài khoản
Target language|Ngôn ngữ áp dụng
Favourite drawing tools|Công cụ yêu thích
Drawing tools|Công cụ vẽ
Crosshair cursor (+)|Con trỏ Crosshair (+)
Trendline (Alt + T)|Kẻ Trendline (Alt + T)
Horizontal line|Đường ngang
Text annotation (Alt + N)|Ghi chú Text (Alt + N)
Today|Hôm nay
Tomorrow|Ngày mai
Close side panel|Đóng panel bên
Indicator settings|Cài đặt chỉ báo
Active indicator settings|Cài đặt chỉ báo đang dùng
Chart Properties & Colors|Thuộc tính và màu biểu đồ
Close symbol search|Đóng tìm mã
Back to My scripts|Quay lại Script của tôi
Expand editor|Mở rộng trình soạn thảo
Restore editor|Thu gọn trình soạn thảo
Language preference|Tùy chọn ngôn ngữ
Chart settings|Cài đặt biểu đồ
Switch theme|Đổi giao diện sáng tối
Settings shortcut|Cài đặt · Chart Settings
Bar replay mode|Bar Replay Mode
Order type|Loại lệnh
Contracts|Hợp đồng
Order price|Giá lệnh
Pending orders|Lệnh chờ
History|Lịch sử
Account|Tài khoản
Available|Khả dụng
Unrealized P&L|PnL mở
Realized P&L|PnL đã chốt
Open demo account|Tạo tài khoản demo
Waiting for live price|Chờ giá live
Favourite tools|Công cụ yêu thích
Keep drawing tools open|Ghim thanh công cụ vẽ
Keep chart panels open|Ghim thanh bên phải
Cursor|Con trỏ
Trend line|Đường xu hướng
Order Block / Range box|Hộp Order Block / Range
Note|Ghi chú
Long / Short position|Vị thế Long / Short
Measure price and bars|Đo giá và số nến
Brush|Cọ vẽ
Music link|Link nhạc
Playback position|Vị trí phát
Play|Phát
Pause|Tạm dừng
Previous track|Bài trước
Next track|Bài tiếp
Archive|Lưu trữ
Restore|Khôi phục
Added|Đã thêm
Enter a valid price|Nhập giá hợp lệ
Price alert saved|Đã lưu cảnh báo giá
Create price alert button|Tạo cảnh báo
Enable sound in the TikTok player if it is muted.|Bật tiếng trong trình phát TikTok nếu đang bị tắt tiếng.
Tap Play in the TikTok player to start playback.|Bấm Phát trong trình phát TikTok để bắt đầu.
Press Play in Music to start TikTok audio.|Bấm Phát trong Music để nghe TikTok.
If the original post plays, you can share its tab audio here.|Nếu bài gốc phát được, bạn có thể chia sẻ âm thanh tab tại đây.
Mute|Tắt tiếng
Unmute|Bật tiếng
TikTok could not find this post. Check its link and visibility.|TikTok không tìm thấy bài này. Kiểm tra link và quyền xem.
Requesting a fresh TikTok player…|Đang yêu cầu trình phát TikTok mới…
TikTok could not play this post in the embedded player.|TikTok không phát được bài này trong khung nhúng.
Open the original post, or pick an audio file or an MP4 saved with TikTok’s Save video option.|Mở bài gốc, hoặc chọn tệp âm thanh hay MP4 đã lưu bằng nút Lưu video của TikTok.
Play saved video or audio|Nghe từ video hoặc tệp nhạc đã lưu
Try Play in the video. You can also play a saved MP4 or audio file here.|Thử bấm Phát trên video. Bạn cũng có thể nghe MP4 hoặc tệp âm thanh đã lưu ngay tại đây.
Press Play to start the local file.|Bấm Phát để nghe tệp đã chọn.
Open TikTok source tab|Mở tab nguồn TikTok
Listen to TikTok tab audio|Nghe âm thanh từ tab TikTok
Open Terminal in Chrome or Edge to share tab audio.|Mở Terminal bằng Chrome hoặc Edge để chia sẻ âm thanh từ tab.
Select the TikTok tab that is playing and enable Share tab audio.|Chọn tab TikTok đang phát và bật chia sẻ âm thanh của tab.
Tab audio was not shared. Open and play TikTok, then try again.|Chưa chia sẻ được tiếng. Mở và phát bài trên TikTok rồi thử lại.
Choose a browser tab and enable Share tab audio. Window or screen sharing cannot be used here.|Chọn một tab trình duyệt và bật chia sẻ âm thanh của tab.
Stop tab audio|Dừng chia sẻ âm thanh
TikTok tab audio|Âm thanh từ tab TikTok
Live audio|Âm thanh trực tiếp
Listening to the selected tab. Play or pause the video there, or use Play in Music to mute or resume it here.|Đang nghe tab đã chọn. Dùng nút Phát trong Music để tạm dừng hoặc nghe tiếp tại đây.
Press Play in Music to listen to the shared tab.|Bấm Phát trong Music để nghe tab đã chia sẻ.
Tab audio stopped.|Đã dừng chia sẻ âm thanh.
High|Cao
Medium|Vừa
Low|Thấp`.split('\n').map(line=>line.split('|'));
  const labels=new Map();
  for(const pair of pairs)for(const label of pair)labels.set(label,pair[language==='vi'?1:0]);
  const text=value=>labels.get(value)??value;
  const replace=value=>value.trim()?value.replace(value.trim(),text(value.trim())):value;
  function markup(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode:node=>node.parentElement?.closest('script,style,pre,textarea,code')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT
    });
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      const option=node.parentElement?.closest('option');
      if(option&&!option.hasAttribute('value'))option.value=option.value;
      node.data=replace(node.data);
    }
    for(const node of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')]){
      for(const attr of ['title','aria-label','placeholder']){
        if(node.hasAttribute(attr))node.setAttribute(attr,replace(node.getAttribute(attr)));
      }
    }
  }
  document.documentElement.lang=language;
  markup(document.body);
  return {language,text,markup,save:next=>['en','vi'].includes(next)&&Workspace.write(key,next)};
})();
const ui=TerminalLanguage.text;
