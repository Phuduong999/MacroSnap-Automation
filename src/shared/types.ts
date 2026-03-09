export interface JobConfig {
  geminiUrl: string;
  geminiTabId: number | null;
  fileName: string;
  imageColumn: string;
  jsonColumn: string;
  totalRows: number;
  batchSize: number; // new thread every N rows (0 = no batching)
}

export interface RowData {
  rowIndex: number;
  originalData: Record<string, string>;
  imageUrl: string;
  jsonData: string;
}

export type RowStatus = "waiting" | "processing" | "done" | "error";

export interface RowResult {
  rowIndex: number;
  status: RowStatus;
  originalData: Record<string, string>;
  parsedResponse: ParsedResponse | null;
  rawResponse: string;
  error: string;
}

export interface ParsedResponse {
  skip: string;
  scanType: string;
  resultReturn: string;
  feedbackCorrection: string;
  labelSkip: string;
  reason: string;
}

export type WorkflowStep =
  | "idle"
  | "clearing_input"
  | "fetching_image"
  | "injecting_image"
  | "waiting_preview"
  | "injecting_text"
  | "clicking_send"
  | "waiting_response"
  | "parsing"
  | "saving"
  | "new_thread"
  | "done"
  | "error";

export const WORKFLOW_STEPS: { key: WorkflowStep; label: string }[] = [
  { key: "clearing_input", label: "Clear input" },
  { key: "fetching_image", label: "Fetch ảnh" },
  { key: "injecting_image", label: "Inject ảnh" },
  { key: "waiting_preview", label: "Đợi preview" },
  { key: "injecting_text", label: "Inject text" },
  { key: "clicking_send", label: "Nhấn Send" },
  { key: "waiting_response", label: "Đợi Gemini" },
  { key: "parsing", label: "Parse response" },
  { key: "saving", label: "Save kết quả" },
];

export interface RoundHistory {
  round: number;
  totalRows: number;
  doneCount: number;
  errorCount: number;
}

export const MAX_RETRY_ROUNDS = 3;

export interface JobState {
  config: JobConfig | null;
  rows: RowData[];
  results: RowResult[];
  currentRowIndex: number;
  isPaused: boolean;
  isRunning: boolean;
  currentStep: WorkflowStep;
  currentRound: number;
  roundHistory: RoundHistory[];
  retryQueue: number[]; // rowIndex of error rows to retry
  rowsInCurrentThread: number; // track rows processed in current thread
  threadCount: number; // how many threads have been created
}

// Messages between components
export type MessageType =
  | { type: "OPEN_GEMINI_TAB"; url: string }
  | { type: "GEMINI_TAB_OPENED"; tabId: number }
  | { type: "START_JOB"; config: JobConfig; rows: RowData[] }
  | { type: "PAUSE_JOB" }
  | { type: "RESUME_JOB" }
  | { type: "CLEAR_JOB" }
  | { type: "FETCH_IMAGE"; url: string }
  | { type: "FETCH_IMAGE_RESULT"; base64: string; mimeType: string; error?: string }
  | { type: "INJECT_IMAGE"; base64: string; mimeType: string }
  | { type: "INJECT_TEXT"; text: string }
  | { type: "CLICK_SEND" }
  | { type: "WAIT_RESPONSE" }
  | { type: "RESPONSE_RESULT"; text: string; error?: string }
  | { type: "ROW_COMPLETE"; result: RowResult }
  | { type: "JOB_STATE_UPDATE"; state: JobState }
  | { type: "STEP_UPDATE"; step: WorkflowStep; rowIndex: number }
  | { type: "GET_JOB_STATE" }
  | { type: "PROCESS_ROW"; row: RowData };
