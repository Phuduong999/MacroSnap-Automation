## 1. Project Setup

- [x] 1.1 Init project với Bun, cấu hình TypeScript, tạo folder structure cho Chrome Extension Manifest V3
- [x] 1.2 Setup Manifest V3 (manifest.json) với permissions: sidePanel, storage, activeTab, scripting, tabs, unlimitedStorage, host permission gemini.google.com
- [x] 1.3 Setup build pipeline Bun cho extension (background SW, content script, side panel page)
- [x] 1.4 Install dependencies: Mantine UI, @mantine/core, @mantine/hooks, xlsx (SheetJS), React

## 2. Side Panel UI

- [x] 2.1 Tạo side panel HTML entry point + React root với Mantine Provider
- [x] 2.2 Build component Gemini URL input + nút "Open" → mở tab mới
- [x] 2.3 Build component File Upload (accept .csv, .xlsx) → parse file bằng SheetJS → hiện danh sách cột
- [x] 2.4 Build component Column Selector (2 dropdown: chọn cột Image URL, chọn cột JSON)
- [x] 2.5 Build component Progress Tracker (hiện row đang xử lý, status mỗi row, progress bar)
- [x] 2.6 Build nút Start / Pause / Resume / Download Results

## 3. Background Service Worker

- [x] 3.1 Tạo background service worker, setup message listener
- [x] 3.2 Implement handler fetch ảnh từ URL → convert sang base64 → trả về cho content script qua messaging
- [x] 3.3 Implement state management với chrome.storage.local (save/load job config, results, progress)
- [x] 3.4 Implement job orchestrator: nhận lệnh start/pause/resume từ side panel, điều phối content script xử lý từng row

## 4. Content Script (Gemini Automation)

- [x] 4.1 Tạo content script inject vô gemini.google.com
- [x] 4.2 Implement injectImage: nhận base64 từ background → tạo File → dispatch ClipboardEvent paste lên .ql-editor.textarea → poll đợi img[data-test-id^="image-"] xuất hiện
- [x] 4.3 Implement injectText: focus editor → execCommand('insertText') để chèn JSON text
- [x] 4.4 Implement clickSend: click button.send-button, handle trường hợp aria-disabled
- [x] 4.5 Implement waitForResponse: đếm structured-content-container trước send, poll đợi count tăng, đợi button[aria-label="Stop response"] biến mất, extract innerText từ container cuối

## 5. Response Parser

- [x] 5.1 Implement parseResponse: parse text "Key: Value" format thành object {skip, scanType, resultReturn, feedbackCorrection, reason}
- [x] 5.2 Handle edge cases: skip-only response, unparseable response (lưu raw text)
- [x] 5.3 Map parsed fields vô đúng output column names (skip→label skip?, scanType→Scan Type?, etc.)

## 6. Result Export

- [x] 6.1 Implement save result ngay sau mỗi row vô chrome.storage.local (append vô results array)
- [x] 6.2 Implement generate CSV output: merge original data + parsed result columns
- [x] 6.3 Implement download trigger: tạo Blob CSV → URL.createObjectURL → click download link
- [x] 6.4 Implement resume logic: khi extension restart, đọc state từ storage, cho phép tiếp tục từ row chưa xử lý

## 7. Integration & Test

- [x] 7.1 Wire up full flow: Side Panel → Background SW → Content Script → Response → Parse → Save
- [ ] 7.2 Test với file CSV nhỏ (3-5 rows) trên gemini.google.com thật
- [ ] 7.3 Test pause/resume flow
- [ ] 7.4 Test extension restart recovery
