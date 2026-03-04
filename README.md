# MacroSnap Crawler

Chrome Extension tự động gửi ảnh bữa ăn + JSON data lên Gemini web UI và cào kết quả phân tích dinh dưỡng.

## Tính năng

- Upload file **CSV/XLSX** chứa danh sách ảnh và dữ liệu dinh dưỡng
- Tự động gửi từng hình ảnh + JSON prompt lên **Gemini Gem thread**
- Cào kết quả phân tích từ Gemini response theo thứ tự gửi
- Theo dõi tiến trình realtime trên Side Panel
- Export kết quả ra file **CSV**

## Yêu cầu

- [Bun](https://bun.sh/) >= 1.0
- Google Chrome (hoặc Chromium-based browser)
- Tài khoản Google có quyền truy cập [Gemini](https://gemini.google.com/)

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

Build output nằm trong folder `dist/`.

Trong quá trình dev, dùng watch mode để tự động rebuild khi code thay đổi:

```bash
bun run dev
```

## Load Extension vô Chrome

1. Mở `chrome://extensions/`
2. Bật **Developer mode** (toggle góc phải trên)
3. Click **Load unpacked** → chọn folder `dist/`
4. Extension icon **Macro Snap Crawler** xuất hiện trên toolbar

> Mỗi lần rebuild, vào lại `chrome://extensions/` và nhấn nút reload (🔄) trên extension card để cập nhật.

## Sử dụng

1. Mở [Gemini](https://gemini.google.com/) và tạo/mở một **Gem thread** sẵn có
2. Click icon extension trên toolbar → **Side Panel** mở ra bên phải
3. Paste URL của Gemini Gem thread vào ô input → nhấn **Open**
4. Upload file **CSV/XLSX** chứa data (file cần có cột URL ảnh và cột JSON)
5. Chọn cột **Image URL** (chứa link ảnh bữa ăn) và cột **JSON** (chứa prompt/data gửi kèm)
6. Nhấn **Start Processing** — extension sẽ tự động:
   - Fetch từng ảnh từ URL
   - Inject ảnh + JSON vào input Gemini
   - Gửi và chờ Gemini phản hồi
   - Cào kết quả từ response
7. Theo dõi tiến trình realtime trên Side Panel
8. Khi xong, nhấn **Download CSV** để tải kết quả

## Cấu trúc project

```
src/
├── background/    # Service worker - quản lý lifecycle extension
├── content/       # Content script - inject vào trang Gemini, tương tác DOM
│   ├── parser.ts  # Parse response từ Gemini
│   └── selectors.ts # CSS selectors cho các element trên trang Gemini
├── shared/        # Code dùng chung
│   ├── storage.ts # Chrome storage helpers
│   └── types.ts   # TypeScript types
└── sidepanel/     # React UI - Side Panel
    ├── App.tsx    # Main app component
    └── index.html # Entry HTML
public/
└── manifest.json  # Chrome Extension manifest (MV3)
build.ts           # Build script (Bun)
```

## Tech Stack

- **Runtime/Bundler:** Bun + TypeScript
- **Extension:** Chrome Extension Manifest V3 (Side Panel API)
- **UI:** React 19 + Mantine UI 8
- **File parsing:** SheetJS (xlsx) — đọc CSV/XLSX

## Troubleshooting

| Vấn đề | Cách fix |
|---------|----------|
| Extension không load được | Kiểm tra `dist/` có đủ file: `background.js`, `content.js`, `sidepanel.js`, `sidepanel.html`, `manifest.json` |
| Không inject được vào Gemini | Đảm bảo đang ở tab `gemini.google.com` và đã đăng nhập |
| Gemini không phản hồi | Kiểm tra Gem thread URL có đúng không, thử refresh trang Gemini |
| File CSV/XLSX không đọc được | Đảm bảo file có header row và cột URL/JSON hợp lệ |
