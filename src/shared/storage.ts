import type { JobState, RowResult } from "./types.ts";

const STORAGE_KEY = "macroSnapJob";

const DEFAULT_STATE: JobState = {
  config: null,
  rows: [],
  results: [],
  currentRowIndex: 0,
  isPaused: false,
  isRunning: false,
  currentStep: "idle",
  currentRound: 1,
  roundHistory: [],
  retryQueue: [],
};

export async function loadJobState(): Promise<JobState> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] ?? DEFAULT_STATE;
}

export async function saveJobState(state: JobState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function appendResult(result: RowResult): Promise<void> {
  const state = await loadJobState();
  const existingIndex = state.results.findIndex(
    (r) => r.rowIndex === result.rowIndex
  );
  if (existingIndex >= 0) {
    state.results[existingIndex] = result;
  } else {
    state.results.push(result);
  }
  state.currentRowIndex = result.rowIndex + 1;
  await saveJobState(state);
}

export async function clearJobState(): Promise<void> {
  await saveJobState(DEFAULT_STATE);
}
