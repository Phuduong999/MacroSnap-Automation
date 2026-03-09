import type { JobConfig, JobState, RowData, RowResult, WorkflowStep, RoundHistory } from "../shared/types.ts";
import { MAX_RETRY_ROUNDS } from "../shared/types.ts";
import { loadJobState, saveJobState, appendResult, clearJobState } from "../shared/storage.ts";
import { parseResponse } from "../shared/parser.ts";

let isProcessing = false;

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(message: any): Promise<any> {
  switch (message.type) {
    case "OPEN_GEMINI_TAB":
      return handleOpenTab(message.url);
    case "START_JOB":
      return handleStartJob(message.config, message.rows);
    case "PAUSE_JOB":
      return handlePause();
    case "RESUME_JOB":
      return handleResume();
    case "CLEAR_JOB":
      return handleClearJob();
    case "GET_JOB_STATE":
      return loadJobState();
    case "FETCH_IMAGE":
      return handleFetchImage(message.url);
    default:
      return { error: "Unknown message type" };
  }
}

async function handleOpenTab(url: string) {
  const tab = await chrome.tabs.create({ url, active: true });
  const state = await loadJobState();
  if (state.config) {
    state.config.geminiTabId = tab.id!;
  }
  await saveJobState(state);
  return { tabId: tab.id };
}

async function handleFetchImage(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    return { base64, mimeType: blob.type || "image/jpeg" };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function handleStartJob(config: JobConfig, rows: RowData[]) {
  const state: JobState = {
    config,
    rows,
    results: [],
    currentRowIndex: 0,
    isPaused: false,
    isRunning: true,
    currentStep: "idle",
    currentRound: 1,
    roundHistory: [],
    retryQueue: [],
    rowsInCurrentThread: 0,
    threadCount: 1,
  };
  await saveJobState(state);
  broadcastState(state);
  processAllRounds();
  return { ok: true };
}

async function handlePause() {
  const state = await loadJobState();
  state.isPaused = true;
  state.currentStep = "idle";
  await saveJobState(state);
  broadcastState(state);
  return { ok: true };
}

async function handleResume() {
  const state = await loadJobState();
  state.isPaused = false;
  state.isRunning = true;
  await saveJobState(state);
  broadcastState(state);
  processAllRounds();
  return { ok: true };
}

async function handleClearJob() {
  isProcessing = false;
  await clearJobState();
  const state = await loadJobState();
  broadcastState(state);
  return { ok: true };
}

// ========== MAIN LOOP WITH RETRY ROUNDS ==========

async function processAllRounds() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    let state = await loadJobState();
    if (!state.config) return;

    // Determine which rows to process this round
    let rowsToProcess: RowData[];

    if (state.currentRound === 1 && state.retryQueue.length === 0) {
      // Round 1: all rows, starting from currentRowIndex
      rowsToProcess = state.rows.slice(state.currentRowIndex);
    } else {
      // Retry round: only error rows
      rowsToProcess = state.retryQueue
        .map((idx) => state.rows[idx])
        .filter((r): r is RowData => !!r);
    }

    // Process rows in this round
    for (let i = 0; i < rowsToProcess.length; i++) {
      state = await loadJobState();
      if (!state.isRunning || state.isPaused || !state.config) break;

      const row = rowsToProcess[i]!;
      state.currentRowIndex = row.rowIndex;
      await saveJobState(state);
      broadcastState(state);

      // Check if we need a new thread (batch rotation)
      const batchSize = state.config.batchSize;
      if (batchSize > 0 && state.rowsInCurrentThread >= batchSize) {
        await broadcastStep("new_thread", row.rowIndex);
        console.log(`[MacroSnap] Batch limit ${batchSize} reached. Opening new thread...`);
        await navigateToNewThread(state);
        state = await loadJobState();
        state.rowsInCurrentThread = 0;
        state.threadCount = (state.threadCount ?? 1) + 1;
        await saveJobState(state);
        await sleep(5000); // wait for page load
      }

      const result = await processOneRow(row, state.config);

      // On error: new thread to prevent cascade (clear input doesn't work reliably)
      if (result.status === "error" && state.config) {
        await broadcastStep("new_thread", row.rowIndex);
        console.log(`[MacroSnap] Error on row ${row.rowIndex + 1}. Opening new thread to prevent cascade...`);
        await navigateToNewThread(state);
        state = await loadJobState();
        state.rowsInCurrentThread = 0;
        state.threadCount = (state.threadCount ?? 1) + 1;
        await saveJobState(state);
        await sleep(5000); // wait for page load
      }

      await broadcastStep("saving", row.rowIndex);
      await appendResult(result);

      state = await loadJobState();
      state.currentStep = "idle";
      state.rowsInCurrentThread = (state.rowsInCurrentThread ?? 0) + 1;
      await saveJobState(state);
      broadcastState(state);

      await sleep(2000);
    }

    // Round finished — check for errors
    state = await loadJobState();
    if (!state.isRunning || state.isPaused) {
      isProcessing = false;
      return;
    }

    const errorRows = state.results
      .filter((r) => r.status === "error")
      .map((r) => r.rowIndex);

    const doneRows = state.results.filter((r) => r.status === "done").length;

    // Save round history
    const roundInfo: RoundHistory = {
      round: state.currentRound,
      totalRows: state.currentRound === 1 ? state.rows.length : state.retryQueue.length,
      doneCount: doneRows,
      errorCount: errorRows.length,
    };

    // Avoid duplicating history for same round (resume case)
    const existingIdx = state.roundHistory.findIndex((h) => h.round === state.currentRound);
    if (existingIdx >= 0) {
      state.roundHistory[existingIdx] = roundInfo;
    } else {
      state.roundHistory.push(roundInfo);
    }

    if (errorRows.length > 0 && state.currentRound < MAX_RETRY_ROUNDS) {
      // Start next retry round — open new tab
      console.log(`[MacroSnap] Round ${state.currentRound} done. ${errorRows.length} errors. Starting retry round ${state.currentRound + 1}...`);

      state.currentRound++;
      state.retryQueue = errorRows;
      state.currentStep = "idle";

      // Clear error results so they can be retried
      state.results = state.results.filter((r) => r.status !== "error");

      await saveJobState(state);
      broadcastState(state);

      // Open new Gemini tab
      isProcessing = false;
      await openFreshGeminiTab(state);

      // Wait for page to load
      await sleep(5000);

      // Continue processing
      processAllRounds();
      return;
    }

    // All done (no errors, or max rounds reached)
    state.isRunning = false;
    state.currentStep = "done";
    state.retryQueue = [];
    await saveJobState(state);
    broadcastState(state);

    if (errorRows.length > 0) {
      console.log(`[MacroSnap] Max ${MAX_RETRY_ROUNDS} rounds reached. ${errorRows.length} rows still have errors.`);
    } else {
      console.log("[MacroSnap] All rows completed successfully!");
    }
  } catch (err) {
    console.error("processAllRounds error:", err);
  } finally {
    isProcessing = false;
  }
}

async function openFreshGeminiTab(state: JobState) {
  if (!state.config) return;

  const geminiUrl = state.config.geminiUrl;

  // Close old tab (best effort)
  if (state.config.geminiTabId) {
    try {
      await chrome.tabs.remove(state.config.geminiTabId);
    } catch {
      // Tab might already be closed
    }
  }

  // Open new tab
  const tab = await chrome.tabs.create({ url: geminiUrl, active: true });
  state.config.geminiTabId = tab.id!;
  await saveJobState(state);
  broadcastState(state);

  console.log(`[MacroSnap] Opened fresh Gemini tab (ID: ${tab.id})`);
}

async function broadcastStep(step: WorkflowStep, rowIndex: number) {
  const state = await loadJobState();
  state.currentStep = step;
  await saveJobState(state);
  chrome.runtime.sendMessage({ type: "STEP_UPDATE", step, rowIndex }).catch(() => {});
  broadcastState(state);
}

async function navigateToNewThread(state: JobState) {
  if (!state.config) return;
  const tabId = state.config.geminiTabId;
  if (!tabId) return;

  // Navigate same tab to geminiUrl (creates a new thread)
  await chrome.tabs.update(tabId, { url: state.config.geminiUrl });

  console.log(`[MacroSnap] Navigated to new thread in tab ${tabId}`);
}

async function processOneRow(row: RowData, config: JobConfig): Promise<RowResult> {
  const tabId = config.geminiTabId;
  if (!tabId) {
    return makeErrorResult(row, "No Gemini tab");
  }

  try {
    await broadcastStep("fetching_image", row.rowIndex);
    const imageResult = await handleFetchImage(row.imageUrl);
    if (imageResult.error) {
      await broadcastStep("error", row.rowIndex);
      return makeErrorResult(row, `Image fetch failed: ${imageResult.error}`);
    }

    await broadcastStep("injecting_image", row.rowIndex);
    const injectImgResult = await executeOnTab(tabId, injectImageScript, [
      imageResult.base64,
      imageResult.mimeType,
    ]);
    if (injectImgResult?.error) {
      await broadcastStep("error", row.rowIndex);
      return makeErrorResult(row, `Image inject failed: ${injectImgResult.error}`);
    }

    await broadcastStep("waiting_preview", row.rowIndex);
    await sleep(2000);

    await broadcastStep("injecting_text", row.rowIndex);
    const injectTextResult = await executeOnTab(tabId, injectTextScript, [row.jsonData]);
    if (injectTextResult?.error) {
      await broadcastStep("error", row.rowIndex);
      return makeErrorResult(row, `Text inject failed: ${injectTextResult.error}`);
    }

    await broadcastStep("clicking_send", row.rowIndex);
    await sleep(1000);
    const sendResult = await executeOnTab(tabId, clickSendScript, []);
    if (sendResult?.error) {
      await broadcastStep("error", row.rowIndex);
      return makeErrorResult(row, `Send failed: ${sendResult.error}`);
    }

    await broadcastStep("waiting_response", row.rowIndex);
    const responseResult = await executeOnTab(tabId, waitForResponseScript, []);
    if (responseResult?.error) {
      await broadcastStep("error", row.rowIndex);
      return makeErrorResult(row, `Response wait failed: ${responseResult.error}`);
    }

    await broadcastStep("parsing", row.rowIndex);
    const rawText = responseResult?.text ?? "";
    const { parsed, isParseError } = parseResponse(rawText);

    return {
      rowIndex: row.rowIndex,
      status: isParseError ? "error" : "done",
      originalData: row.originalData,
      parsedResponse: parsed,
      rawResponse: rawText,
      error: isParseError ? "parse_error" : "",
    };
  } catch (err) {
    await broadcastStep("error", row.rowIndex);
    return makeErrorResult(row, (err as Error).message);
  }
}

function makeErrorResult(row: RowData, error: string): RowResult {
  return {
    rowIndex: row.rowIndex,
    status: "error",
    originalData: row.originalData,
    parsedResponse: null,
    rawResponse: "",
    error,
  };
}

async function executeOnTab(tabId: number, func: (...args: any[]) => any, args: any[]) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return results[0]?.result;
}

// --- Content scripts ---

function injectImageScript(base64: string, mimeType: string) {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], "image.jpg", { type: mimeType });

    const editor = document.querySelector(".ql-editor.textarea") as HTMLElement;
    if (!editor) return { error: "Editor not found" };

    editor.focus();
    const dt = new DataTransfer();
    dt.items.add(file);

    editor.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      })
    );

    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

function injectTextScript(text: string) {
  try {
    const editor = document.querySelector(".ql-editor.textarea") as HTMLElement;
    if (!editor) return { error: "Editor not found" };

    editor.focus();
    document.execCommand("insertText", false, text);
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

function clickSendScript() {
  return new Promise((resolve) => {
    let elapsed = 0;
    const maxWait = 10000; // wait up to 10s for button to be ready
    const pollInterval = 500;

    const poll = setInterval(() => {
      const btn = document.querySelector("button.send-button") as HTMLButtonElement;
      if (!btn) {
        elapsed += pollInterval;
        if (elapsed >= maxWait) {
          clearInterval(poll);
          resolve({ error: "Send button not found after 10s" });
        }
        return;
      }

      if (btn.getAttribute("aria-disabled") === "true") {
        elapsed += pollInterval;
        if (elapsed >= maxWait) {
          clearInterval(poll);
          resolve({ error: "Send button still disabled after 10s" });
        }
        return;
      }

      // Button is ready — click it
      clearInterval(poll);
      btn.click();
      resolve({ ok: true });
    }, pollInterval);
  });
}

function waitForResponseScript() {
  return new Promise((resolve) => {
    const containers = document.querySelectorAll("structured-content-container");
    const countBefore = containers.length;
    let elapsed = 0;
    const maxWait = 90000;
    const pollInterval = 1000;
    let sawStopButton = false;

    const poll = setInterval(() => {
      elapsed += pollInterval;

      const stopBtn = document.querySelector('button[aria-label="Stop response"]');
      const currentContainers = document.querySelectorAll("structured-content-container");
      const hasNewContainer = currentContainers.length > countBefore;

      // Track if stop button ever appeared (means Gemini is streaming)
      if (stopBtn) {
        sawStopButton = true;
      }

      // Response done: stop button was visible but now gone, and we have a new container
      // OR: new container appeared and no stop button (fast response)
      if (hasNewContainer && !stopBtn && (sawStopButton || elapsed > 3000)) {
        clearInterval(poll);
        const all = document.querySelectorAll("structured-content-container");
        const latest = all[all.length - 1];
        resolve({ text: latest?.innerText ?? "", ok: true });
        return;
      }

      // Also handle: stop button gone + container count same but last container updated
      // (Gemini sometimes reuses containers)
      if (sawStopButton && !stopBtn && !hasNewContainer) {
        clearInterval(poll);
        const all = document.querySelectorAll("structured-content-container");
        const latest = all[all.length - 1];
        resolve({ text: latest?.innerText ?? "", ok: true });
        return;
      }

      if (elapsed >= maxWait) {
        clearInterval(poll);
        // If we have a new container, grab it even on timeout
        if (hasNewContainer) {
          const all = document.querySelectorAll("structured-content-container");
          const latest = all[all.length - 1];
          resolve({ text: latest?.innerText ?? "", ok: true });
        } else {
          resolve({ error: "Response timeout" });
        }
      }
    }, pollInterval);
  });
}

function clearInputScript() {
  try {
    const editor = document.querySelector(".ql-editor.textarea") as HTMLElement;
    if (!editor) return { ok: true }; // nothing to clear

    // Clear text content
    editor.innerHTML = "";

    // Remove any pending image previews
    const previews = document.querySelectorAll('img[data-test-id^="image-"]');
    previews.forEach((img) => {
      // Walk up to find the removable container
      const container = img.closest("[data-test-id]") || img.parentElement;
      if (container && container !== editor) {
        container.remove();
      }
    });

    // Also try clicking any "remove" buttons on attached files
    const removeButtons = document.querySelectorAll(
      'button[aria-label="Remove file"], button[aria-label="Remove image"]'
    );
    removeButtons.forEach((btn) => (btn as HTMLButtonElement).click());

    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

function broadcastState(state: JobState) {
  chrome.runtime.sendMessage({ type: "JOB_STATE_UPDATE", state }).catch(() => {});
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
