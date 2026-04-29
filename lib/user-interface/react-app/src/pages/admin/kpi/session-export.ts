export type SessionExportRow = {
  employeeId: string;
  userId: string;
  sessionId: string;
  startTime: string;
  interactionCount: number;
  applicationSession: boolean;
  history: string;
};

export const SESSION_EXPORT_HEADERS = [
  "Employee ID",
  "User ID",
  "Session ID",
  "Start Time",
  "Interaction Count",
  "Application Session",
  "Session History",
] as const;

/** Excel worksheet cell text limit (inclusive). */
export const EXCEL_CELL_MAX_CHARS = 32767;

const SESSION_HISTORY_COLUMN_INDEX = 6;

export function sessionRowToValues(r: SessionExportRow): (string | number)[] {
  return [
    r.employeeId,
    r.userId,
    r.sessionId,
    r.startTime,
    r.interactionCount,
    r.applicationSession ? "Yes" : "No",
    r.history,
  ];
}

/**
 * Truncate a single cell for .xlsx so Excel and SheetJS stay within limits.
 */
export function truncateCellForExcel(value: string): string {
  if (value.length <= EXCEL_CELL_MAX_CHARS) {
    return value;
  }
  const note = " … [truncated: Excel cell limit]";
  const max = EXCEL_CELL_MAX_CHARS - note.length;
  return value.slice(0, Math.max(0, max)) + note;
}

function rowValuesForXlsx(
  row: (string | number | boolean)[]
): (string | number | boolean)[] {
  return row.map((cell, i) =>
    i === SESSION_HISTORY_COLUMN_INDEX
      ? truncateCellForExcel(String(cell ?? ""))
      : cell
  );
}

/**
 * Quote a field only when it contains the delimiter, double-quotes, or line breaks.
 * Delimiter is tab for TSV (JSON text rarely contains literal tabs).
 */
function escapeField(
  value: string | number | boolean,
  delimiter: "\t" | ","
): string {
  const s = String(value ?? "");
  const mustQuote =
    delimiter === "\t"
      ? /["\t\r\n\u2028\u2029]/.test(s)
      : /[",\r\n\u2028\u2029]/.test(s);
  if (mustQuote) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Tab-separated text; UTF-8 BOM for Excel. */
export function buildTsvContent(
  headers: readonly string[],
  rows: (string | number | boolean)[][]
): string {
  const d = "\t";
  const eol = "\r\n";
  const line = (cells: (string | number | boolean)[]) =>
    cells.map((c) => escapeField(c, "\t")).join(d);
  return (
    "\uFEFF" +
    [line(headers as string[]), ...rows.map((r) => line(r))].join(eol)
  );
}

/** Comma-separated with RFC 4180-style quoting when needed. */
export function buildCommaCsvContent(
  headers: readonly string[],
  rows: (string | number | boolean)[][]
): string {
  const d = ",";
  const eol = "\r\n";
  const line = (cells: (string | number | boolean)[]) =>
    cells.map((c) => escapeField(c, ",")).join(d);
  return (
    "\uFEFF" +
    [line(headers as string[]), ...rows.map((r) => line(r))].join(eol)
  );
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function buildSessionExportXlsxBlob(
  headers: readonly string[],
  rows: (string | number | boolean)[][],
  options?: { onProgress?: (percent: number) => void }
): Promise<Blob> {
  const onProgress = options?.onProgress;
  onProgress?.(82);
  await yieldToMain();

  const XLSX = await import("xlsx");

  onProgress?.(86);
  await yieldToMain();

  const safeRows = rows.map((r) => rowValuesForXlsx(r));
  const aoa: string[][] = [
    headers.map(String),
    ...safeRows.map((r) => r.map((c) => String(c ?? ""))),
  ];

  let ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>;
  try {
    ws = XLSX.utils.aoa_to_sheet(aoa);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to build spreadsheet grid.";
    throw new Error(
      `Excel export could not build the worksheet (${msg}). The dataset may be too large — try TSV or CSV, or a narrower time range.`
    );
  }

  onProgress?.(92);
  await yieldToMain();

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sessions");

  let buf: ArrayBuffer | Uint8Array;
  try {
    buf = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
      compression: true,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to serialize workbook.";
    throw new Error(
      `Excel export failed while saving (${msg}). Try exporting as TSV or CSV instead, or reduce the time range.`
    );
  }

  onProgress?.(98);
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getExportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Export failed. Try a smaller date range or use TSV/CSV if Excel keeps failing.";
}
