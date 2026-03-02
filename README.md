# MacroSnap-Automation

Chrome Extension tự động gửi ảnh bữa ăn + JSON data lên Gemini web UI và cào kết quả phân tích dinh dưỡng.

## Setup

```bash
# 1. Clone repo
git clone https://github.com/Phuduong999/MacroSnap-Automation.git
cd MacroSnap-Automation

# 2. Install Bun (nếu chưa có)
curl -fsSL https://bun.sh/install | bash

# 3. Install dependencies
bun install

# 4. Build extension
bun run build
```

## Load Extension vô Chrome

1. Mở `chrome://extensions/`
2. Bật **Developer mode** (góc phải trên)
3. Click **Load unpacked** → chọn folder `dist/`
4. Extension icon xuất hiện trên toolbar

## Sử dụng

1. Click icon extension → **Side Panel** mở ra
2. Paste URL Gemini Gem thread → nhấn **Open**
3. Upload file **CSV/XLSX** chứa data
4. Chọn cột **Image URL** và cột **JSON**
5. Nhấn **Start Processing**
6. Xem kết quả realtime → **Download CSV** khi xong

## Tech Stack

- Bun + TypeScript
- Chrome Extension Manifest V3 (Side Panel)
- React + Mantine UI
- SheetJS (xlsx)
