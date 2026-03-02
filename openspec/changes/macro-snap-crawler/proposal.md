## Why

Quy trình phân tích dinh dưỡng từ ảnh bữa ăn hiện tại đang thủ công: mở từng ảnh, paste vô Gemini, copy kết quả ra spreadsheet. Với hàng trăm rows, việc này mất rất nhiều thời gian và dễ sai sót. Cần một Chrome Extension tự động hóa toàn bộ flow này — từ upload file, inject ảnh + JSON vô Gemini web UI, đợi response, parse kết quả, và save ngay vô file.

## What Changes

- Tạo mới Chrome Extension (Manifest V3) với Side Panel UI
- Extension đọc file CSV/XLSX chứa image URLs + JSON data
- Tự động inject ảnh (ClipboardEvent paste) và text (execCommand) vô Gemini web UI (gemini.google.com)
- Tự động click Send, đợi Gemini response, cào kết quả từ `structured-content-container`
- Parse response text thành các field cụ thể (Skip, Scan Type, Result Return, FeedBack Correction, label skip, Reason)
- Save kết quả ngay sau mỗi row (không đợi hết batch) vô file output
- Data persist qua `chrome.storage.local`, không lưu RAM

## Capabilities

### New Capabilities

- `file-import`: Đọc và parse file CSV/XLSX, cho user chọn cột Image URL và cột JSON
- `gemini-automation`: Inject ảnh + text vô Gemini web UI, click Send, đợi response, cào kết quả
- `response-parser`: Parse Gemini response text thành structured fields (Skip, Scan Type, Result Return, etc.)
- `result-export`: Save kết quả ngay sau mỗi row vô file output CSV/XLSX, persist qua chrome.storage.local
- `side-panel-ui`: Side Panel UI với Mantine components — upload file, chọn cột, paste Gemini URL, hiển thị progress

### Modified Capabilities

_(Không có — đây là project mới)_

## Impact

- **Dependencies mới**: Mantine UI, xlsx/papaparse (parse file), Chrome Extension APIs (sidePanel, storage, tabs, scripting)
- **Permissions**: `activeTab`, `sidePanel`, `storage`, `scripting`, `tabs`, host permission cho `gemini.google.com`
- **Content Script**: Inject vô `gemini.google.com` để thao tác DOM
- **Background Service Worker**: Fetch ảnh từ URL (bypass CSP của Gemini page)
