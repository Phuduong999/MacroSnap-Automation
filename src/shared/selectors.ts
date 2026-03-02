// Gemini DOM selectors - confirmed via testing
export const SELECTORS = {
  textEditor: ".ql-editor.textarea",
  imagePreview: 'img[data-test-id^="image-"]',
  sendButton: "button.send-button",
  stopButton: 'button[aria-label="Stop response"]',
  responseContainer: "structured-content-container",
  dropZone: "[xapfileselectordropzone]",
} as const;

// Timeouts in ms
export const TIMEOUTS = {
  imagePreviewWait: 5000,
  imagePreviewPoll: 500,
  sendRetryWait: 10000,
  responseWait: 60000,
  responsePoll: 1000,
  streamingWait: 60000,
  betweenRows: 2000,
  afterSend: 500,
} as const;
