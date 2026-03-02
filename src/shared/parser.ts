import type { ParsedResponse } from "./types.ts";

const FIELD_MAP: Record<string, keyof ParsedResponse> = {
  "skip": "skip",
  "scan type": "scanType",
  "results return": "resultReturn",
  "result return": "resultReturn",
  "feedback correction": "feedbackCorrection",
  "label skip": "labelSkip",
  "reason": "reason",
};

export function parseResponse(rawText: string): {
  parsed: ParsedResponse | null;
  isParseError: boolean;
} {
  const lines = rawText.trim().split("\n").filter((l) => l.trim());

  const result: ParsedResponse = {
    skip: "",
    scanType: "",
    resultReturn: "",
    feedbackCorrection: "",
    labelSkip: "",
    reason: "",
  };

  let matched = 0;

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    const field = FIELD_MAP[key];
    if (field) {
      result[field] = value;
      matched++;
    }
  }

  if (matched === 0) {
    return { parsed: null, isParseError: true };
  }

  return { parsed: result, isParseError: false };
}

// Map parsed fields to output column names
export const OUTPUT_COLUMN_MAP: Record<keyof ParsedResponse, string> = {
  skip: "label skip?",
  scanType: "Scan Type?",
  resultReturn: "Result Return",
  feedbackCorrection: "feedback correction?",
  labelSkip: "label skip?",
  reason: "Reason?",
};
