## Context

Chrome Extension (Manifest V3) tự động hóa việc gửi ảnh bữa ăn + JSON data lên Gemini web UI và cào kết quả phân tích dinh dưỡng. User đã setup sẵn Gem thread (gemini.google.com/gem/...) với prompt. Extension chạy trên Side Panel, đọc file CSV/XLSX, xử lý từng row một.

### Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    SIDE PANEL (Mantine UI)            │
│  ┌────────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ URL Input  │ │ File     │ │ Progress Tracker   │ │
│  │ + Open Tab │ │ Upload   │ │ Row 1: ✅ Done     │ │
│  │            │ │ + Column │ │ Row 2: 🔄 Running  │ │
│  │            │ │   Select │ │ Row 3: ⏳ Waiting  │ │
│  └────────────┘ └──────────┘ └────────────────────┘ │
└──────────────┬───────────────────────────────────────┘
               │ chrome.runtime.sendMessage
               ▼
┌──────────────────────────────────────────────────────┐
│              BACKGROUND SERVICE WORKER                │
│  - Fetch ảnh từ URL (bypass CSP)                     │
│  - Quản lý state trong chrome.storage.local          │
│  - Điều phối content script                          │
└──────────────┬───────────────────────────────────────┘
               │ chrome.scripting.executeScript / messaging
               ▼
┌──────────────────────────────────────────────────────┐
│          CONTENT SCRIPT (gemini.google.com)           │
│  - Paste ảnh (ClipboardEvent)                        │
│  - Insert text (execCommand)                         │
│  - Click Send (button.send-button)                   │
│  - Poll response (structured-content-container)      │
│  - Detect completion (Stop btn gone)                 │
└──────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Tự động xử lý hàng trăm rows từ CSV/XLSX qua Gemini web UI
- Save kết quả ngay sau mỗi row (không mất data khi crash/reset)
- UI đơn giản, dễ dùng qua Side Panel
- Parse Gemini response thành structured fields

**Non-Goals:**
- Không dùng Gemini API (không có budget)
- Không xử lý song song (1 row tại 1 thời điểm)
- Không hỗ trợ multi-tab Gemini
- Không auto-retry khi Gemini lỗi (v1)

## Decisions

### 1. Side Panel vs Popup

**Chọn: Side Panel**
- Side Panel luôn hiện khi user làm việc, không bị đóng khi click ngoài
- Phù hợp cho long-running task (xử lý hàng trăm rows)
- Popup sẽ đóng khi user click sang tab Gemini → mất UI

### 2. Content Script injection method

**Chọn: chrome.scripting.executeScript (dynamic)**
- Không dùng static content_scripts trong manifest
- Inject khi cần, cho phép re-inject nếu page reload
- Background service worker gọi `chrome.scripting.executeScript` để inject code vô Gemini tab

### 3. Image fetch strategy

**Chọn: Background Service Worker fetch**
- Content script trên gemini.google.com bị CSP chặn fetch tới domain ngoài
- Background SW không bị CSP → fetch ảnh → convert Blob → gửi qua messaging cho content script
- Content script nhận Blob → tạo File → dispatch ClipboardEvent paste

### 4. Data persistence

**Chọn: chrome.storage.local**
- Persist qua extension restart/update
- Mỗi row xong → update storage ngay
- State lưu: job config, processed rows, results
- Khi user muốn download → đọc từ storage → generate file

### 5. File parsing

**Chọn: SheetJS (xlsx) cho cả CSV và XLSX**
- Một library handle cả 2 format
- Đọc file trong Side Panel (FileReader API)
- Parse ra array of objects → cho user chọn cột

### 6. Output strategy

**Chọn: Incremental save + Download on demand**
- Mỗi row xong → save result vô chrome.storage.local ngay
- User có thể download file kết quả bất cứ lúc nào
- File output giữ nguyên data gốc + thêm các cột kết quả parsed

### 7. Gemini DOM Selectors

**Đã test confirm trên gemini.google.com:**

| Element | Selector | Method |
|---------|----------|--------|
| Text editor | `.ql-editor.textarea` | `execCommand('insertText')` |
| Image inject | editor element | `ClipboardEvent('paste')` với `DataTransfer` |
| Image preview | `img[data-test-id^="image-"]` | Poll đợi xuất hiện |
| Send button | `button.send-button` | `.click()` |
| Response | `structured-content-container` | Đếm count, lấy cuối cùng |
| Streaming check | `button[aria-label="Stop response"]` | Poll đợi biến mất |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Google thay đổi DOM selectors | Selectors define trong 1 file config, dễ update. Dùng aria-label/data-test-id (ổn định hơn class names) |
| Gemini rate limit / throttle | Delay giữa các rows (configurable). Pause/Resume support |
| Page reload mất content script | Background SW detect tab update → re-inject content script |
| Large file (>1000 rows) | chrome.storage.local có limit 10MB → dùng `unlimitedStorage` permission. Chunked save |
| ClipboardEvent paste bị block trong tương lai | Fallback: thử hidden file input trigger. Log warning |
