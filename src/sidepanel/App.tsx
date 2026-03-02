import { useState, useEffect, useCallback } from "react";
import {
  Container,
  Stack,
  Title,
  TextInput,
  Button,
  Group,
  Select,
  Text,
  Progress,
  Badge,
  ScrollArea,
  Card,
  FileInput,
  Alert,
  Table,
  Modal,
  Code,
  Tabs,
  Stepper,
  Loader,
  ThemeIcon,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import * as XLSX from "xlsx";
import type { JobConfig, JobState, RowData, RowResult, WorkflowStep, RoundHistory } from "../shared/types.ts";
import { WORKFLOW_STEPS, MAX_RETRY_ROUNDS } from "../shared/types.ts";
import { loadJobState } from "../shared/storage.ts";

// Map step to stepper index
function getStepIndex(step: WorkflowStep): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : -1;
}

export function App() {
  const [geminiUrl, setGeminiUrl] = useState("");
  const [geminiTabId, setGeminiTabId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [imageColumn, setImageColumn] = useState<string | null>(null);
  const [jsonColumn, setJsonColumn] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<RowResult | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  // Load saved state on mount
  useEffect(() => {
    loadJobState().then((state) => {
      if (state.config) {
        setJobState(state);
        setGeminiUrl(state.config.geminiUrl);
      }
    });
  }, []);

  // Listen for state updates from background
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === "JOB_STATE_UPDATE") {
        setJobState(message.state);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Open Gemini tab
  const handleOpenGemini = useCallback(async () => {
    if (!geminiUrl.includes("gemini.google.com")) {
      setError("URL phải là gemini.google.com");
      return;
    }
    setError(null);
    const response = await chrome.runtime.sendMessage({
      type: "OPEN_GEMINI_TAB",
      url: geminiUrl,
    });
    if (response?.tabId) {
      setGeminiTabId(response.tabId);
    }
  }, [geminiUrl]);

  // Parse uploaded file — clear old data first
  const handleFileChange = useCallback(async (f: File | null) => {
    // Clear old job data
    await chrome.runtime.sendMessage({ type: "CLEAR_JOB" });
    setJobState(null);
    setFile(f);
    setColumns([]);
    setRows([]);
    setImageColumn(null);
    setJsonColumn(null);
    setSelectedRow(null);

    if (!f) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false,
        });

        if (jsonRows.length === 0) {
          setError("File rỗng");
          return;
        }

        const cols = Object.keys(jsonRows[0]!);
        setColumns(cols);
        setRows(jsonRows);
        setError(null);
      } catch (err) {
        setError("Không đọc được file: " + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  // Start processing
  const handleStart = useCallback(async () => {
    if (!imageColumn || !jsonColumn || !geminiTabId) return;

    const config: JobConfig = {
      geminiUrl,
      geminiTabId,
      fileName: file?.name ?? "unknown",
      imageColumn,
      jsonColumn,
      totalRows: rows.length,
    };

    const rowData: RowData[] = rows.map((row, i) => ({
      rowIndex: i,
      originalData: row,
      imageUrl: row[imageColumn] ?? "",
      jsonData: row[jsonColumn] ?? "",
    }));

    await chrome.runtime.sendMessage({
      type: "START_JOB",
      config,
      rows: rowData,
    });
  }, [imageColumn, jsonColumn, geminiTabId, geminiUrl, file, rows]);

  const handlePause = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "PAUSE_JOB" });
  }, []);

  const handleResume = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "RESUME_JOB" });
  }, []);

  // Download results
  const handleDownload = useCallback(() => {
    if (!jobState?.results.length) return;

    const outputRows = jobState.results.map((r: RowResult) => {
      const row: Record<string, string> = { ...r.originalData };
      if (r.parsedResponse) {
        row["Scan Type?"] = r.parsedResponse.scanType;
        row["Result Return"] = r.parsedResponse.resultReturn;
        row["feedback correction?"] = r.parsedResponse.feedbackCorrection;
        row["label skip?"] = r.parsedResponse.skip;
        row["Reason?"] = r.parsedResponse.reason;
      }
      row["_status"] = r.status;
      row["_error"] = r.error;
      row["_rawResponse"] = r.rawResponse;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(outputRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `results-${Date.now()}.csv`);
  }, [jobState]);

  // Derived state
  const isRunning = jobState?.isRunning ?? false;
  const isPaused = jobState?.isPaused ?? false;
  const completedCount = jobState?.results.length ?? 0;
  const totalRows2 = jobState?.config?.totalRows ?? rows.length;
  const progressPct = totalRows2 > 0 ? (completedCount / totalRows2) * 100 : 0;
  const canStart = !!geminiTabId && !!imageColumn && !!jsonColumn && rows.length > 0 && !isRunning;
  const currentStep = jobState?.currentStep ?? "idle";
  const currentRowIdx = jobState?.currentRowIndex ?? 0;
  const activeStepIndex = getStepIndex(currentStep);
  const currentRound = jobState?.currentRound ?? 1;
  const roundHistory = jobState?.roundHistory ?? [];
  const retryQueue = jobState?.retryQueue ?? [];
  const errorCount = jobState?.results.filter((r) => r.status === "error").length ?? 0;
  const doneCount = jobState?.results.filter((r) => r.status === "done").length ?? 0;

  return (
    <Container size="xs" p="md">
      <Stack gap="md">
        <Title order={3}>Macro Snap Crawler</Title>

        {error && (
          <Alert color="red" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step 1: Gemini URL */}
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Text fw={600} size="sm">1. Gemini URL</Text>
            <Group gap="xs">
              <TextInput
                flex={1}
                placeholder="https://gemini.google.com/gem/..."
                value={geminiUrl}
                onChange={(e) => setGeminiUrl(e.currentTarget.value)}
                disabled={isRunning}
              />
              <Button size="sm" onClick={handleOpenGemini} disabled={!geminiUrl || isRunning}>
                Open
              </Button>
            </Group>
            {geminiTabId && <Badge color="green" size="sm">Tab opened (ID: {geminiTabId})</Badge>}
          </Stack>
        </Card>

        {/* Step 2: File Upload */}
        <Card withBorder p="sm">
          <Stack gap="xs">
            <Text fw={600} size="sm">2. Upload File</Text>
            <FileInput
              placeholder="Chọn CSV hoặc XLSX"
              accept=".csv,.xlsx,.xls"
              value={file}
              onChange={handleFileChange}
              disabled={isRunning}
            />
            {columns.length > 0 && (
              <Text size="xs" c="dimmed">{rows.length} rows, {columns.length} columns</Text>
            )}
          </Stack>
        </Card>

        {/* Step 3: Column Selection */}
        {columns.length > 0 && (
          <Card withBorder p="sm">
            <Stack gap="xs">
              <Text fw={600} size="sm">3. Chọn Cột</Text>
              <Select
                label="Cột Image URL"
                placeholder="Chọn cột chứa URL ảnh"
                data={columns}
                value={imageColumn}
                onChange={setImageColumn}
                disabled={isRunning}
              />
              <Select
                label="Cột JSON"
                placeholder="Chọn cột chứa JSON data"
                data={columns}
                value={jsonColumn}
                onChange={setJsonColumn}
                disabled={isRunning}
              />
            </Stack>
          </Card>
        )}

        {/* Controls */}
        <Group gap="xs">
          {!isRunning && !isPaused && (
            <Button onClick={handleStart} disabled={!canStart} fullWidth>
              Start Processing
            </Button>
          )}
          {isRunning && !isPaused && (
            <Button color="yellow" onClick={handlePause} fullWidth>
              Pause
            </Button>
          )}
          {isPaused && (
            <Button color="green" onClick={handleResume} fullWidth>
              Resume
            </Button>
          )}
        </Group>

        {/* Progress + Workflow Stepper */}
        {(isRunning || isPaused || completedCount > 0) && (
          <Card withBorder p="sm">
            <Stack gap="sm">
              {/* Overall progress */}
              <Group justify="space-between">
                <Text fw={600} size="sm">Progress</Text>
                <Group gap="xs">
                  <Badge size="sm" color="green" variant="light">{doneCount} done</Badge>
                  {errorCount > 0 && <Badge size="sm" color="red" variant="light">{errorCount} errors</Badge>}
                  <Text size="sm" c="dimmed">/ {totalRows2}</Text>
                </Group>
              </Group>
              <Progress value={totalRows2 > 0 ? (doneCount / totalRows2) * 100 : 0} size="lg" animated={isRunning && !isPaused} />

              {/* Current Round indicator */}
              {isRunning && (
                <Group gap="xs">
                  <Badge
                    size="sm"
                    color={currentRound === 1 ? "blue" : "orange"}
                    variant="filled"
                  >
                    Round {currentRound} / {MAX_RETRY_ROUNDS}
                  </Badge>
                  {currentRound > 1 && (
                    <Text size="xs" c="dimmed">
                      Retry {retryQueue.length} error rows — Tab mới
                    </Text>
                  )}
                </Group>
              )}

              {/* Live Workflow Stepper */}
              {isRunning && currentStep !== "idle" && currentStep !== "done" && (
                <Card withBorder p="xs" bg="dark.7">
                  <Stack gap="xs">
                    <Group gap="xs">
                      <Loader size="xs" />
                      <Text size="sm" fw={600}>
                        Row {currentRowIdx + 1}
                      </Text>
                      {currentRound > 1 && (
                        <Badge size="xs" color="orange" variant="light">retry</Badge>
                      )}
                    </Group>
                    <Stepper
                      active={activeStepIndex}
                      size="xs"
                      orientation="vertical"
                      styles={{
                        step: { padding: rem(2) },
                        stepBody: { padding: 0 },
                        stepLabel: { fontSize: rem(11) },
                      }}
                    >
                      {WORKFLOW_STEPS.map((s, i) => (
                        <Stepper.Step
                          key={s.key}
                          label={s.label}
                          loading={i === activeStepIndex}
                          color={
                            currentStep === "error" && i === activeStepIndex
                              ? "red"
                              : i < activeStepIndex
                              ? "green"
                              : undefined
                          }
                        />
                      ))}
                    </Stepper>
                  </Stack>
                </Card>
              )}

              {/* Paused indicator */}
              {isPaused && (
                <Alert color="yellow" variant="light" p="xs">
                  <Text size="xs">Paused at row {currentRowIdx + 1} (Round {currentRound})</Text>
                </Alert>
              )}

              {/* Round History */}
              {roundHistory.length > 0 && (
                <Card withBorder p="xs">
                  <Stack gap={4}>
                    <Text size="xs" fw={600} c="dimmed">Round History</Text>
                    {roundHistory.map((rh: RoundHistory) => (
                      <Group key={rh.round} gap="xs">
                        <Badge
                          size="xs"
                          color={rh.errorCount === 0 ? "green" : "orange"}
                          variant="light"
                          w={55}
                        >
                          R{rh.round}
                        </Badge>
                        <Text size="xs">
                          {rh.totalRows} rows
                        </Text>
                        <Badge size="xs" color="green" variant="dot">{rh.doneCount} done</Badge>
                        {rh.errorCount > 0 && (
                          <Badge size="xs" color="red" variant="dot">{rh.errorCount} errors</Badge>
                        )}
                      </Group>
                    ))}
                    {/* Current round if running */}
                    {isRunning && !roundHistory.find((h) => h.round === currentRound) && (
                      <Group gap="xs">
                        <Badge size="xs" color="blue" variant="light" w={55}>
                          R{currentRound}
                        </Badge>
                        <Loader size={10} />
                        <Text size="xs">
                          {currentRound === 1 ? totalRows2 : retryQueue.length} rows — đang chạy
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Card>
              )}

              {/* Final status */}
              {!isRunning && !isPaused && completedCount > 0 && errorCount > 0 && currentRound >= MAX_RETRY_ROUNDS && (
                <Alert color="orange" variant="light" p="xs">
                  <Text size="xs">{errorCount} rows vẫn lỗi sau {MAX_RETRY_ROUNDS} lượt retry</Text>
                </Alert>
              )}
              {!isRunning && !isPaused && completedCount > 0 && errorCount === 0 && (
                <Alert color="green" variant="light" p="xs">
                  <Text size="xs">Hoàn thành! {doneCount} rows xử lý thành công</Text>
                </Alert>
              )}
            </Stack>
          </Card>
        )}

        {/* Results Data Viewer */}
        {completedCount > 0 && (
          <Card withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">Results</Text>
                <Button size="xs" variant="outline" onClick={handleDownload}>
                  Download CSV ({completedCount})
                </Button>
              </Group>

              <ScrollArea h={350}>
                <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>Row</Table.Th>
                      <Table.Th w={50}>Status</Table.Th>
                      <Table.Th>Skip</Table.Th>
                      <Table.Th>Scan Type</Table.Th>
                      <Table.Th>Result Return</Table.Th>
                      <Table.Th>Feedback</Table.Th>
                      <Table.Th>Reason</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {jobState?.results.map((r: RowResult) => (
                      <Table.Tr
                        key={r.rowIndex}
                        style={{ cursor: "pointer" }}
                        onClick={() => { setSelectedRow(r); openDetail(); }}
                      >
                        <Table.Td>{r.rowIndex + 1}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={r.status === "done" ? "green" : r.status === "error" ? "red" : "blue"}
                          >
                            {r.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{r.parsedResponse?.skip ?? "-"}</Table.Td>
                        <Table.Td>{r.parsedResponse?.scanType ?? "-"}</Table.Td>
                        <Table.Td>{r.parsedResponse?.resultReturn ?? "-"}</Table.Td>
                        <Table.Td>{r.parsedResponse?.feedbackCorrection ?? "-"}</Table.Td>
                        <Table.Td>{r.parsedResponse?.reason ?? (r.error || "-")}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          </Card>
        )}

        {/* Row Detail Modal */}
        <Modal
          opened={detailOpened}
          onClose={closeDetail}
          title={`Row ${(selectedRow?.rowIndex ?? 0) + 1} Detail`}
          size="lg"
        >
          {selectedRow && (
            <Tabs defaultValue="parsed">
              <Tabs.List>
                <Tabs.Tab value="parsed">Parsed Data</Tabs.Tab>
                <Tabs.Tab value="raw">Raw Response</Tabs.Tab>
                <Tabs.Tab value="original">Original Data</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="parsed" pt="sm">
                <Stack gap="xs">
                  <Group gap="xs">
                    <Text size="sm" fw={600} w={140}>Status:</Text>
                    <Badge
                      color={selectedRow.status === "done" ? "green" : selectedRow.status === "error" ? "red" : "blue"}
                    >
                      {selectedRow.status}
                    </Badge>
                  </Group>
                  {selectedRow.error && (
                    <Group gap="xs">
                      <Text size="sm" fw={600} w={140}>Error:</Text>
                      <Text size="sm" c="red">{selectedRow.error}</Text>
                    </Group>
                  )}
                  {selectedRow.parsedResponse && (
                    <>
                      <Group gap="xs">
                        <Text size="sm" fw={600} w={140}>Skip:</Text>
                        <Text size="sm">{selectedRow.parsedResponse.skip || "-"}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" fw={600} w={140}>Scan Type:</Text>
                        <Text size="sm">{selectedRow.parsedResponse.scanType || "-"}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" fw={600} w={140}>Result Return:</Text>
                        <Text size="sm">{selectedRow.parsedResponse.resultReturn || "-"}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" fw={600} w={140}>Feedback Correction:</Text>
                        <Text size="sm">{selectedRow.parsedResponse.feedbackCorrection || "-"}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" fw={600} w={140}>Label Skip:</Text>
                        <Text size="sm">{selectedRow.parsedResponse.labelSkip || "-"}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" fw={600} w={140}>Reason:</Text>
                        <Text size="sm">{selectedRow.parsedResponse.reason || "-"}</Text>
                      </Group>
                    </>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="raw" pt="sm">
                <Code block>{selectedRow.rawResponse || "(empty)"}</Code>
              </Tabs.Panel>

              <Tabs.Panel value="original" pt="sm">
                <ScrollArea h={300}>
                  <Table striped withTableBorder fz="xs">
                    <Table.Tbody>
                      {Object.entries(selectedRow.originalData).map(([key, val]) => (
                        <Table.Tr key={key}>
                          <Table.Td fw={600} w={120}>{key}</Table.Td>
                          <Table.Td>{val}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Tabs.Panel>
            </Tabs>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}
