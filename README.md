# Trading Terminal Pro

> High-performance, low-latency multi-chart trading terminal designed for futures and algorithmic trading (NQ, ES, YM, GC, CL, BTC). Bridges directly into TradingView Desktop via Chrome DevTools Protocol (`CDP:9222`) for real-time institutional data streaming.

[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)](#)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](#)
[![Engine](https://img.shields.io/badge/Engine-Lightweight%20Charts-2962FF)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Vanilla%20JS%20%7C%20Fast%20Bridge-success)](#)
[![Tests Passing](https://img.shields.io/badge/Tests-165%20JS%20%7C%2043%20Py%20Passing-brightgreen)](#)

---

## ⚡ Tổng quan kiến trúc

Trading Terminal Pro là nền tảng giao dịch cá nhân độc lập chạy hoàn toàn trên máy cục bộ (Local-first). Hệ thống kết nối trực tiếp với **TradingView Desktop** thông qua Chrome DevTools Protocol (`9222`) để tận dụng toàn bộ quyền dữ liệu thời gian thực hiện có của tài khoản TradingView, hoàn toàn không phụ thuộc vào API cloud trả phí hoặc giới hạn rate-limit bên ngoài.

```
┌────────────────────────────────┐
│   TradingView Desktop (CDP)    │  Port 9222
└───────────────┬────────────────┘
                │ Realtime OHLCV & Metadata
                ▼
┌────────────────────────────────┐
│      Python Bridge Server      │  HTTP :3000 / WebSocket :8080
│  - Market Store & Caching      │  RAM Snapshot + Atomic Persistence
│  - ETH / RTH Session Engine    │  Exchange Calendar & DST Rules
└───────────────┬────────────────┘
                │ Low-latency Streaming
                ▼
┌────────────────────────────────┐
│     Trading Terminal Web       │  100% Vanilla JS + HTML5 Canvas
│  - Multi-Chart Grid (1–16)     │  Lightweight Charts 60 FPS
│  - Quantaibay / QT Engine      │  True Open Cycles + Realtime SSMT
│  - Paper Trading & Replay      │  Web Worker Isolated Execution
└────────────────────────────────┘
```

---

## 🚀 Tính năng nổi bật

### 1. 📊 Hệ thống đa biểu đồ độc lập (Multi-Chart Grid)
- **Bố cục linh hoạt**: Hỗ trợ từ 1 đến 16 biểu đồ hiển thị đồng thời với nhiều kiểu chia ô (lưới, cột, hàng, bố cục tập trung).
- **Đồng bộ hóa tùy biến cao**: Bật/tắt độc lập 5 kênh đồng bộ:
  - `Symbol` (Mã giao dịch)
  - `Interval` (Khung thời gian)
  - `Crosshair` (Con trỏ chữ thập định vị theo cao độ giá tương đối và thời gian thực)
  - `Time` (Cuộn trục thời gian)
  - `Date Range` (Phạm vi ngày quan sát)
- **Khung thời gian & Phiên**: Tách biệt rõ ràng phiên **ETH (Electronic Trading Hours)** và **RTH (Regular Trading Hours)**; tự động căn chỉnh theo lịch đóng cửa sớm, ngày lễ và quy tắc DST của từng sàn.

### 2. ⚡ Thuật toán Quantaibay (QT Algorithmic Engine)
- **Chu kỳ True Open toàn diện**: Nhận diện chu kỳ Yearly, Quarterly, Monthly, Weekly, Daily và Session True Open.
- **SSMT Realtime (Smart Money Tool / Silver Bullet)**: Phát hiện phân kỳ tương quan giữa các cặp tài sản (NQ, ES, YM, GC, CL) theo thời gian thực mà không làm giật lag giao diện.
- **Bảng ma trận chu kỳ & PSP (Price Speed Profile)**: Trực quan hóa cấu trúc nhịp sóng đa khung với độ trễ cực thấp.
- **Tối ưu hóa phần cứng chuyên sâu**:
  - Warmup checkpoint cache tránh tính toán lại lịch sử nến dài trên mỗi tick.
  - Viewport culling (chỉ vẽ các đối tượng nằm trong khung nhìn).
  - Tốc độ tính toán live-tick đạt **~4.06 ms** (so với 600+ ms ở các bản chưa tối ưu).

### 3. 📐 Bộ công cụ vẽ chuyên nghiệp (Institutional Drawing Suite)
- **Vị thế Long & Short độc lập**:
  - 2 công cụ tách biệt: **Long Position** và **Short Position**.
  - Tự động tính toán Tỷ lệ Rủi ro/Lợi nhuận (R:R), Kích cỡ vị thế (Quantity), Rủi ro tài khoản và Lợi nhuận mục tiêu.
  - Bảng thống kê (Stats pills) hiển thị tinh tế khi chọn và tự động ẩn gọn gàng khi bỏ chọn để giữ biểu đồ sạch đẹp.
- **Công cụ đường & hình học**:
  - **Trend Line**: Hỗ trợ giữ `Shift` để khóa góc chính xác (0°, 45°, 90°); kéo dài 2 đầu trực quan.
  - **Horizontal Line**, **Vertical Line**, **Rectangle**, **Fibonacci Retracement**, **Text**, **Measure** (Thước đo khoảng giá và số nến).
- **Quản lý toàn diện**:
  - Hộp thoại thiết lập Style, Coordinates, Text và Visibility riêng cho từng khung thời gian.
  - Khóa hình (Lock), đổi thứ tự lớp (Layer ordering), sao chép/dán (`Ctrl+C` / `Ctrl+V`), Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).
  - Toàn bộ hình vẽ được lưu tự động theo từng mã và phiên giao dịch, không bị mất khi tải lại trang.

### 4. 🎯 Paper Trading & Âm thanh khớp lệnh sống động
- **Cơ chế mô phỏng thực chiến**:
  - Hỗ trợ lệnh Market, Limit, Stop, Stop-Limit với cơ chế gắn sẵn Stop Loss (SL) và Take Profit (TP).
  - Menu chuột phải kiểu TopstepX cho phép đặt lệnh nhanh theo giá trỏ chuột mà không cần mở form nhập.
  - Quản lý nhiều tài khoản demo, tùy biến số dư và tỷ lệ ký quỹ ban đầu.
- **Hệ thống âm thanh tùy chỉnh (Tactile Audio Cues)**:
  - 🔫 **Khớp lệnh Entry**: Tiếng súng lên nòng sắc nét.
  - 💰 **Khớp Take Profit / Chốt lời từng phần**: Tiếng máy đếm tiền leng keng.
  - ⚠️ **Dính Stop Loss**: Âm thanh cảnh báo thất bại trực quan.

### 5. ⏪ Trình phát lại thị trường đa khung (Market Replay Simulator)
- **Đồng bộ đa biểu đồ**: Phát lại từng nến lịch sử thực tế trên mọi khung thời gian cùng một lúc theo trục thời gian UTC.
- **Điều khiển tiện lợi**:
  - Tốc độ phát từ `0.5x` đến `10x`.
  - Phím tắt: `Space` (Phát/Tạm dừng), `F10` hoặc `Alt + Mũi tên phải` (Tiến 1 nến), `Alt + Mũi tên trái` (Lùi 1 nến).
  - Cho phép nhảy tới ngày/giờ cụ thể hoặc chọn nến ngẫu nhiên để luyện tập backtest.

### 6. 🧪 Bộ chạy chỉ báo trong Worker độc lập (Pine v6 / JS)
- Chạy các script JavaScript và Pine Script v6 thử nghiệm (sử dụng PineTS runtime) bên trong **Web Worker** riêng biệt.
- Hoàn toàn không chiếm dụng hoặc làm đơ Main Thread / UI Render Loop của trình duyệt.
- Hỗ trợ vẽ line series, histogram, ribbon, bảng ma trận và tô màu nến linh hoạt.

### 7. 🎧 Trình phát nhạc tích hợp (Audio Station)
- Tích hợp trình phát nhạc thư giãn (Lo-Fi / YouTube playlist) dạng thanh dock hoặc cửa sổ popup nổi.
- Phát nhạc nền liên tục khi chuyển tab hoặc giao dịch mà không làm gián đoạn luồng làm việc.

---

## 🛠️ Hướng dẫn cài đặt & Khởi động

### Yêu cầu hệ thống
- **Hệ điều hành**: Windows 10 / 11 (64-bit)
- **Python**: Phiên bản `3.12+`
- **TradingView Desktop**: Đã cài đặt và có phiên đăng nhập dữ liệu

### Khởi động nhanh (Khuyên dùng)
1. Cài đặt các thư viện cần thiết:
   ```powershell
   python -m pip install -r requirements.txt
   ```
2. Chạy file launcher duy nhất:
   ```cmd
   start_terminal.bat
   ```
   *Launcher sẽ tự động:*
   - Khởi động TradingView Desktop với cổng debug `--remote-debugging-port=9222`.
   - Dọn dẹp tiến trình backend cũ nếu có và khởi chạy `bridge_server.py`.
   - Mở giao diện Web Terminal tại địa chỉ `http://localhost:3000`.

---

## ⌨️ Bảng phím tắt & Thao tác nhanh

| Phím tắt | Chức năng |
| :--- | :--- |
| `Ctrl + ,` | Mở hộp thoại **Cài đặt biểu đồ (Chart Settings)** |
| `Ctrl + Z` / `Ctrl + Y` | Hoàn tác (Undo) / Làm lại (Redo) thao tác vẽ |
| `Shift` (khi vẽ Line) | Khóa góc thẳng hàng (ngang 0°, chéo 45°, đứng 90°) |
| `Space` | Bật / Tạm dừng chế độ **Market Replay** |
| `F10` hoặc `Alt + →` | Bước tới 1 nến tiếp theo trong Replay |
| `Alt + ←` | Lùi lại 1 nến trong Replay |
| `Esc` | Thoát chế độ toàn màn hình (Fullscreen) / Hủy công cụ vẽ |
| `Delete` / `Backspace` | Xóa hình vẽ hoặc chỉ báo đang chọn |
| Chuột phải trên biểu đồ | Mở menu thao tác nhanh: Đặt lệnh Paper, chỉnh màu, khóa/xóa đối tượng |

---

## 📂 Cấu trúc dự án

```
TradingViewPremium/
├── backend/
│   ├── bridge_server.py         # Server kết nối CDP và WebSocket streamer
│   ├── market_store.py          # Quản lý nến, cache RAM và ghi đĩa atomic
│   ├── launch_tv.ps1            # Kịch bản khởi động TradingView Desktop CDP
│   └── companion_services.py    # Dịch vụ phụ trợ lịch sàn và đồng bộ
├── frontend/
│   ├── index.html               # Trang ứng dụng chính (tích hợp script đồng bộ)
│   ├── assets/                  # Âm thanh (mp3), biểu tượng (svg), hình ảnh
│   ├── css/                     # Toàn bộ stylesheet thiết kế hiện đại
│   └── js/                      # 36 module JavaScript thuần độc lập:
│       ├── app.js               # Điểm khởi chạy ứng dụng
│       ├── chart_engine.js      # Bộ điều khiển Lightweight Charts
│       ├── drawing_model.js     # Mô hình toán học các công cụ vẽ
│       ├── drawing_tools.js     # Tương tác vẽ trên Canvas
│       ├── drawing_settings.js  # Hộp thoại cấu hình Style / Coordinates
│       ├── qt_*.js              # Bộ engine thuật toán Quantaibay
│       ├── paper_trading.js     # Engine khớp lệnh mô phỏng
│       └── ...                  # Module tiện ích khác
├── tests/                       # Hệ thống kiểm thử tự động (JS & Python)
├── start_terminal.bat           # Launcher khởi động 1 chạm trên Windows
└── AGENTS.md                    # Nhật ký kỹ thuật và lịch sử phát triển
```

---

## 🧪 Kiểm thử chất lượng (Quality Assurance)

Dự án sở hữu bộ test tự động nghiêm ngặt bảo đảm tính chính xác của dữ liệu tài chính và giao diện:

```powershell
# Chạy toàn bộ 165 bài test Frontend & Logic vẽ (Node.js test runner)
node --test tests/*.test.cjs

# Chạy toàn bộ 43 bài test Backend & Xử lý phiên (Python unittest)
python -m unittest discover -s tests -p "test_*.py"
```

---

## 📄 Tài liệu chi tiết & Liên kết

- [AGENTS.md](AGENTS.md): Nhật ký kỹ thuật chi tiết, quy tắc phát triển và lịch sử cập nhật.
- [CHART_SETTINGS.md](CHART_SETTINGS.md): Chi tiết các tùy chọn hiển thị và đối chiếu tham số biểu đồ.
- [DESKTOP_PARITY.md](DESKTOP_PARITY.md): Bảng đối chiếu giao diện thực tế giữa TradingView Desktop và Web Terminal.
- [V5_PREVIEW.md](V5_PREVIEW.md): Tài liệu hướng dẫn sử dụng và kiểm thử bộ renderer Lightweight Charts v5.

---

<p align="center">
  <b>Trading Terminal Pro</b> • Thiết kế cho tốc độ, độ chính xác và tính độc lập.
</p>
