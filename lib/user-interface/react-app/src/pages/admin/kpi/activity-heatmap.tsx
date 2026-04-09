import { useMemo, useState, useCallback } from "react";
import { Box } from "@cloudscape-design/components";
import { HeatmapDataPoint } from "../../../API";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const CELL_SIZE = 14;
const GAP = 3;
const COL_WIDTH = CELL_SIZE + GAP;

const COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

function formatHour(hour: number): string {
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return `12 PM`;
  return `${hour - 12} PM`;
}

function formatHourRange(hour: number): string {
  return `${formatHour(hour)} – ${formatHour(hour + 1)}`;
}

function getColor(value: number, max: number): string {
  if (value === 0 || max === 0) return COLORS[0];
  const ratio = value / max;
  if (ratio <= 0.25) return COLORS[1];
  if (ratio <= 0.5) return COLORS[2];
  if (ratio <= 0.75) return COLORS[3];
  return COLORS[4];
}

function getWorkDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (current <= endDate) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

interface CellData {
  date: string;
  hour: number;
  value: number;
  formattedDate: string;
  hourRange: string;
}

interface PopupState {
  x: number;
  y: number;
  cell: CellData;
}

interface ActivityHeatmapProps {
  data: HeatmapDataPoint[];
  mode: "sessions" | "interactions";
}

export default function ActivityHeatmap({ data, mode }: ActivityHeatmapProps) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const { cells, monthSpans, maxVal } = useMemo(() => {
    if (!data || data.length === 0) {
      return { cells: [], monthSpans: [], maxVal: 0 };
    }

    const dataMap = new Map<string, { sessions: number; interactions: number }>();
    for (const point of data) {
      dataMap.set(`${point.date}-${point.hour}`, {
        sessions: point.sessions,
        interactions: point.interactions,
      });
    }

    const dates = data.map((d) => d.date).sort();
    const allWorkDays = getWorkDaysBetween(dates[0], dates[dates.length - 1]);
    allWorkDays.reverse();

    let computedMax = 0;
    for (const point of data) {
      const val = mode === "sessions" ? point.sessions : point.interactions;
      if (val > computedMax) computedMax = val;
    }

    const spans: { label: string; cols: number }[] = [];
    let currentMonth = "";
    for (const date of allWorkDays) {
      const month = date.substring(0, 7);
      if (month !== currentMonth) {
        const d = new Date(date + "T00:00:00");
        spans.push({
          label: d.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
          cols: 1,
        });
        currentMonth = month;
      } else {
        spans[spans.length - 1].cols++;
      }
    }

    const builtCells: CellData[] = [];
    for (const date of allWorkDays) {
      for (const hour of HOURS) {
        const point = dataMap.get(`${date}-${hour}`);
        const value = point
          ? mode === "sessions"
            ? point.sessions
            : point.interactions
          : 0;
        builtCells.push({
          date,
          hour,
          value,
          formattedDate: new Date(date + "T00:00:00").toLocaleDateString(
            "en-US",
            { weekday: "short", month: "short", day: "numeric", year: "numeric" }
          ),
          hourRange: formatHourRange(hour),
        });
      }
    }

    return { cells: builtCells, monthSpans: spans, maxVal: computedMax };
  }, [data, mode]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, cell: CellData) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopup({
        x: rect.left + rect.width / 2,
        y: rect.top,
        cell,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => setPopup(null), []);

  if (cells.length === 0) {
    return (
      <Box textAlign="center" color="text-body-secondary" padding="l">
        No activity data available
      </Box>
    );
  }

  const modeLabel = mode === "sessions" ? "session" : "interaction";

  return (
    <div>
      <div style={{ display: "flex" }}>
        {/* Fixed hour labels */}
        <div style={{ paddingTop: 22, marginRight: 8, flexShrink: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${HOURS.length}, ${CELL_SIZE}px)`,
              gap: GAP,
            }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{
                  fontSize: 11,
                  lineHeight: `${CELL_SIZE}px`,
                  textAlign: "right",
                  color: "#586069",
                  whiteSpace: "nowrap",
                }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable heatmap area */}
        <div style={{ overflowX: "auto", flex: 1, paddingBottom: 4 }}>
          {/* Month labels */}
          <div style={{ display: "flex", height: 20 }}>
            {monthSpans.map((m, i) => (
              <div
                key={i}
                style={{
                  width: m.cols * COL_WIDTH,
                  fontSize: 11,
                  color: "#586069",
                  flexShrink: 0,
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Cell grid */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${HOURS.length}, ${CELL_SIZE}px)`,
              gridAutoFlow: "column",
              gridAutoColumns: `${CELL_SIZE}px`,
              gap: GAP,
            }}
          >
            {cells.map((cell, i) => (
              <div
                key={i}
                onMouseEnter={(e) => handleMouseEnter(e, cell)}
                onMouseLeave={handleMouseLeave}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: getColor(cell.value, maxVal),
                  borderRadius: 2,
                  cursor: "default",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Fixed-position popup rendered outside the scroll container */}
      {popup && (
        <div
          style={{
            position: "fixed",
            left: popup.x,
            top: popup.y - 8,
            transform: "translate(-50%, -100%)",
            background: "#1b2733",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          <strong>
            {popup.cell.value} {modeLabel}
            {popup.cell.value !== 1 ? "s" : ""}
          </strong>
          <br />
          {popup.cell.hourRange}
          <br />
          {popup.cell.formattedDate}
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #1b2733",
            }}
          />
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 12,
          justifyContent: "flex-end",
        }}
      >
        <span style={{ fontSize: 11, color: "#586069" }}>Less</span>
        {COLORS.map((color, i) => (
          <div
            key={i}
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: color,
              borderRadius: 2,
            }}
          />
        ))}
        <span style={{ fontSize: 11, color: "#586069" }}>More</span>
      </div>
    </div>
  );
}
