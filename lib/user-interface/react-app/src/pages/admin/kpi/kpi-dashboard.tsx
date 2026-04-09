import {
  ContentLayout,
  Header,
  Container,
  SpaceBetween,
  ColumnLayout,
  Box,
  BreadcrumbGroup,
  Alert,
  Spinner,
  Select,
  SelectProps,
  DateRangePicker,
  DateRangePickerProps,
  FormField,
  Button,
} from "@cloudscape-design/components";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import BaseAppLayout from "../../../components/base-app-layout";
import useOnFollow from "../../../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../../../common/constants";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { HeatmapDataPoint, KpiMetrics } from "../../../API";
import { Utils } from "../../../common/utils";
import ActivityHeatmap from "./activity-heatmap";

type ExportDatePreset =
  | "all"
  | "7days"
  | "30days"
  | "90days"
  | "182days"
  | "365days";

const EXPORT_DATE_PRESET_OPTIONS: SelectProps.Option[] = [
  { value: "7days", label: "7 days" },
  { value: "30days", label: "Past month" },
  { value: "90days", label: "Past 3 months" },
  { value: "182days", label: "Past half year" },
  { value: "365days", label: "Past year" },
  { value: "all", label: "All time" },
];

function getExportDateRange(preset: ExportDatePreset): {
  startDate?: string;
  endDate?: string;
} {
  if (preset === "all") return {};
  const now = new Date();
  const endDate = now.toISOString();
  const start = new Date(now);
  switch (preset) {
    case "7days":
      start.setDate(start.getDate() - 7);
      break;
    case "30days":
      start.setDate(start.getDate() - 30);
      break;
    case "90days":
      start.setDate(start.getDate() - 90);
      break;
    case "182days":
      start.setDate(start.getDate() - 182);
      break;
    case "365days":
      start.setDate(start.getDate() - 365);
      break;
    default:
      return {};
  }
  return { startDate: start.toISOString(), endDate };
}

type DatePreset = "all" | "7days" | "30days" | "custom";

const DATE_PRESET_OPTIONS: SelectProps.Option[] = [
  { value: "all", label: "All time" },
  { value: "7days", label: "Last 7 days" },
  { value: "30days", label: "Last 30 days" },
  { value: "custom", label: "Custom date range" },
];

function getDateRange(preset: DatePreset): {
  startDate?: string;
  endDate?: string;
} {
  if (preset === "all") return {};
  const now = new Date();
  const endDate = now.toISOString();
  if (preset === "7days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { startDate: start.toISOString(), endDate };
  }
  if (preset === "30days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { startDate: start.toISOString(), endDate };
  }
  return {};
}

interface MetricTileProps {
  label: string;
  value: string | number | undefined;
  description?: string;
}

function MetricTile({ label, value, description }: MetricTileProps) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div style={{ padding: "0.6rem 0", fontSize: "2.2rem", fontWeight: 700 }}>
        {value ?? "-"}
      </div>
      {description && (
        <Box variant="small" color="text-body-secondary">
          {description}
        </Box>
      )}
    </div>
  );
}

export default function KpiDashboard() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | undefined>(
    undefined
  );
  const [exportError, setExportError] = useState<string | undefined>(
    undefined
  );
  const [metrics, setMetrics] = useState<KpiMetrics | null>(null);

  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const heatmapLoaded = useRef(false);
  const [heatmapMode, setHeatmapMode] = useState<SelectProps.Option>({
    value: "sessions",
    label: "Sessions",
  });

  const [datePreset, setDatePreset] = useState<SelectProps.Option>(
    DATE_PRESET_OPTIONS[0]
  );
  const [customRange, setCustomRange] =
    useState<DateRangePickerProps.Value | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportDatePreset, setExportDatePreset] = useState<SelectProps.Option>(
    EXPORT_DATE_PRESET_OPTIONS[1]
  );

  const isCustom = datePreset.value === "custom";

  const handleExport = useCallback(async () => {
    if (!appContext) return;
    setExporting(true);
    setExportError(undefined);
    try {
      const apiClient = new ApiClient(appContext);
      const exportRange = getExportDateRange(
        exportDatePreset.value as ExportDatePreset
      );
      const startDate = exportRange.startDate ?? null;
      const endDate = exportRange.endDate ?? null;
      type ExportRow = {
        employeeId: string;
        userId: string;
        sessionId: string;
        startTime: string;
        interactionCount: number;
        applicationSession: boolean;
        history: string;
      };
      const rows: ExportRow[] = [];
      let cursor: string | null | undefined = undefined;
      for (;;) {
        const result = await apiClient.kpi.exportSessionDataPage(
          cursor,
          undefined,
          startDate,
          endDate
        );
        const page = result.data?.exportSessionDataPage;
        if (!page?.rowsJson) throw new Error("No data returned");
        const chunk: ExportRow[] = JSON.parse(page.rowsJson);
        rows.push(...chunk);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }

      const csvHeaders = [
        "Employee ID",
        "User ID",
        "Session ID",
        "Start Time",
        "Interaction Count",
        "Application Session",
        "Session History",
      ];
      rows.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      const csvRows = rows.map((r) => [
        r.employeeId,
        r.userId,
        r.sessionId,
        r.startTime,
        String(r.interactionCount),
        r.applicationSession ? "Yes" : "No",
        r.history,
      ]);

      // RFC 4180: always quote fields so Excel keeps each value in one cell (JSON
      // in Session History can contain \r, \n, Unicode line breaks, commas, etc.).
      const escapeCsvField = (value: string | number | boolean) => {
        const s = String(value ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      };

      const lineEnding = "\r\n";
      const csvContent =
        "\uFEFF" +
        [
          csvHeaders.map(escapeCsvField).join(","),
          ...csvRows.map((row) => row.map(escapeCsvField).join(",")),
        ].join(lineEnding);

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `session-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(Utils.getErrorMessage(e));
      setExportError(Utils.getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  }, [appContext, exportDatePreset]);

  const fetchMetrics = useCallback(async () => {
    if (!appContext) return;
    setLoading(true);
    setMetricsError(undefined);

    try {
      const apiClient = new ApiClient(appContext);
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (isCustom && customRange) {
        if (customRange.type === "absolute") {
          startDate = new Date(customRange.startDate).toISOString();
          endDate = new Date(customRange.endDate).toISOString();
        } else if (customRange.type === "relative") {
          const now = new Date();
          endDate = now.toISOString();
          const start = new Date(now);
          const amount = customRange.amount;
          switch (customRange.unit) {
            case "day":
              start.setDate(start.getDate() - amount);
              break;
            case "week":
              start.setDate(start.getDate() - amount * 7);
              break;
            case "month":
              start.setMonth(start.getMonth() - amount);
              break;
            case "year":
              start.setFullYear(start.getFullYear() - amount);
              break;
          }
          startDate = start.toISOString();
        }
      } else if (!isCustom) {
        const range = getDateRange(datePreset.value as DatePreset);
        startDate = range.startDate;
        endDate = range.endDate;
      }

      const result = await apiClient.kpi.getKpiMetrics(startDate, endDate);
      if (result.data?.getKpiMetrics) {
        setMetrics(result.data.getKpiMetrics);
        if (!heatmapLoaded.current && result.data.getKpiMetrics.heatmapData) {
          setHeatmapData(result.data.getKpiMetrics.heatmapData);
          heatmapLoaded.current = true;
        }
      }
    } catch (e) {
      console.error(Utils.getErrorMessage(e));
      setMetricsError(Utils.getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [appContext, datePreset, customRange, isCustom]);

  useEffect(() => {
    if (isCustom && !customRange) return;
    fetchMetrics();
  }, [fetchMetrics, isCustom, customRange]);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatFloat = (n: number) => n.toFixed(2);
  const formatPercent = (n: number) => `${n.toFixed(1)}%`;

  const dateRangeControls = (
    <SpaceBetween direction="horizontal" size="m">
      <FormField>
        <Select
          selectedOption={datePreset}
          onChange={({ detail }) => {
            setDatePreset(detail.selectedOption);
            if (detail.selectedOption.value !== "custom") {
              setCustomRange(null);
            }
          }}
          options={DATE_PRESET_OPTIONS}
        />
      </FormField>
      {isCustom && (
        <FormField label="Custom range">
          <DateRangePicker
            value={customRange}
            onChange={({ detail }) => setCustomRange(detail.value)}
            relativeOptions={[
              { key: "1-day", amount: 1, unit: "day", type: "relative" },
              { key: "1-week", amount: 1, unit: "week", type: "relative" },
              { key: "1-month", amount: 1, unit: "month", type: "relative" },
              { key: "3-months", amount: 3, unit: "month", type: "relative" },
              { key: "6-months", amount: 6, unit: "month", type: "relative" },
              { key: "1-year", amount: 1, unit: "year", type: "relative" },
            ]}
            isValidRange={(range) => {
              if (range?.type === "absolute") {
                if (!range.startDate || !range.endDate) {
                  return {
                    valid: false,
                    errorMessage: "Select a complete range",
                  };
                }
                if (new Date(range.startDate) > new Date(range.endDate)) {
                  return {
                    valid: false,
                    errorMessage: "Start date must be before end date",
                  };
                }
              }
              return { valid: true };
            }}
            i18nStrings={{
              todayAriaLabel: "Today",
              nextMonthAriaLabel: "Next month",
              previousMonthAriaLabel: "Previous month",
              customRelativeRangeDurationLabel: "Duration",
              customRelativeRangeDurationPlaceholder: "Enter duration",
              customRelativeRangeOptionLabel: "Custom range",
              customRelativeRangeOptionDescription:
                "Set a custom range in the past",
              customRelativeRangeUnitLabel: "Unit of time",
              formatRelativeRange: (e) => {
                const unit = e.amount === 1 ? e.unit : `${e.unit}s`;
                return `Last ${e.amount} ${unit}`;
              },
              formatUnit: (unit, value) =>
                value === 1 ? unit : `${unit}s`,
              dateTimeConstraintText:
                "Range must be between 6 and 30 days. Use 24-hour format.",
              relativeModeTitle: "Relative range",
              absoluteModeTitle: "Absolute range",
              relativeRangeSelectionHeading: "Choose a range",
              startDateLabel: "Start date",
              endDateLabel: "End date",
              startTimeLabel: "Start time",
              endTimeLabel: "End time",
              clearButtonLabel: "Clear and dismiss",
              cancelButtonLabel: "Cancel",
              applyButtonLabel: "Apply",
            }}
            placeholder="Select a date range"
          />
        </FormField>
      )}
    </SpaceBetween>
  );

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            { text: CHATBOT_NAME, href: "/" },
            { text: "KPI Dashboard", href: "/admin/kpi" },
          ]}
        />
      }
      content={
        <>
          {metricsError && (
            <Alert
              statusIconAriaLabel="Error"
              type="error"
              header="Unable to load KPI metrics."
            >
              {metricsError}
            </Alert>
          )}
          {exportError && (
            <Alert
              statusIconAriaLabel="Error"
              type="error"
              header="Export failed."
            >
              {exportError}
            </Alert>
          )}
          <ContentLayout
            header={
              <Header
                variant="h1"
                description="Platform usage metrics and statistics"
              >
                KPI Dashboard
              </Header>
            }
          >
            {loading ? (
              <Container>
                <Box textAlign="center" padding="xxl">
                  <Spinner size="large" />
                  <Box variant="p" margin={{ top: "s" }}>
                    Loading metrics...
                  </Box>
                </Box>
              </Container>
            ) : (
              <SpaceBetween size="l">
                <Container
                  header={
                    <Header
                      variant="h2"
                      description="Metrics are filtered by the selected date range"
                      actions={dateRangeControls}
                    >
                      Metrics
                    </Header>
                  }
                >
                  <SpaceBetween size="l">
                    <SpaceBetween size="xs">
                      <Header variant="h3">Users</Header>
                      <ColumnLayout columns={3} variant="text-grid">
                        <MetricTile
                          label="Total Users"
                          value={
                            metrics
                              ? formatNumber(metrics.totalUsers)
                              : undefined
                          }
                          description="Unique users with at least one session"
                        />
                        <MetricTile
                          label="New Users"
                          value={
                            metrics
                              ? formatNumber(metrics.newUsers)
                              : undefined
                          }
                          description="Users whose first session is in the selected period"
                        />
                        <MetricTile
                          label="Application Sessions"
                          value={
                            metrics
                              ? formatPercent(
                                  metrics.applicationSessionsPercentage
                                )
                              : undefined
                          }
                          description="Percentage of sessions using application presets"
                        />
                      </ColumnLayout>
                    </SpaceBetween>

                    <SpaceBetween size="xs">
                      <Header variant="h3">Volume</Header>
                      <ColumnLayout columns={3} variant="text-grid">
                        <MetricTile
                          label="Total Sessions"
                          value={
                            metrics
                              ? formatNumber(metrics.totalSessions)
                              : undefined
                          }
                        />
                        <MetricTile
                          label="Total Interactions"
                          value={
                            metrics
                              ? formatNumber(metrics.totalInteractions)
                              : undefined
                          }
                          description="Individual request-response pairs across all sessions"
                        />
                        <MetricTile
                          label="Avg Sessions per User"
                          value={
                            metrics
                              ? formatFloat(metrics.avgSessionsPerUser)
                              : undefined
                          }
                        />
                      </ColumnLayout>
                    </SpaceBetween>

                    <SpaceBetween size="xs">
                      <Header variant="h3">Per-User Distribution</Header>
                      <ColumnLayout columns={3} variant="text-grid">
                        <MetricTile
                          label="Avg Interactions per User"
                          value={
                            metrics
                              ? formatFloat(metrics.avgInteractionsPerUser)
                              : undefined
                          }
                        />
                        <MetricTile
                          label="Median Sessions per User"
                          value={
                            metrics
                              ? formatFloat(metrics.medianSessionsPerUser)
                              : undefined
                          }
                          description="Ordered by session count"
                        />
                        <MetricTile
                          label="Median Interactions per User"
                          value={
                            metrics
                              ? formatFloat(metrics.medianInteractionsPerUser)
                              : undefined
                          }
                          description="Ordered by interaction count"
                        />
                      </ColumnLayout>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>

                <Container
                  header={
                    <Header
                      variant="h2"
                      description="Work hours (9 AM – 4 PM) on work days (Mon–Fri), Eastern Time. Not affected by the date range filter."
                      actions={
                        <Select
                          selectedOption={heatmapMode}
                          onChange={({ detail }) =>
                            setHeatmapMode(detail.selectedOption)
                          }
                          options={[
                            { value: "sessions", label: "Sessions" },
                            { value: "interactions", label: "Interactions" },
                          ]}
                        />
                      }
                    >
                      Activity
                    </Header>
                  }
                >
                  <ActivityHeatmap
                    data={heatmapData}
                    mode={heatmapMode.value as "sessions" | "interactions"}
                  />
                </Container>

                <Container
                  header={
                    <Header
                      variant="h2"
                      description="Download session data as a CSV file. Includes Employee ID, session details, and interaction counts."
                    >
                      Data Export
                    </Header>
                  }
                >
                  <SpaceBetween size="m">
                    <Box variant="p">
                      Export session records for the selected time range (by
                      session start time). The export maps each user to their
                      Employee ID and includes session metadata such as start
                      time, interaction count, and whether the session used an
                      application preset.
                    </Box>
                    <SpaceBetween size="m">
                      <FormField label="Time range">
                        <Select
                          disabled={exporting}
                          selectedOption={exportDatePreset}
                          onChange={({ detail }) =>
                            setExportDatePreset(detail.selectedOption)
                          }
                          options={EXPORT_DATE_PRESET_OPTIONS}
                        />
                      </FormField>
                      <Button
                        variant="primary"
                        loading={exporting}
                        onClick={handleExport}
                        iconName="download"
                      >
                        {exporting ? "Exporting..." : "Export to CSV"}
                      </Button>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            )}
          </ContentLayout>
        </>
      }
    />
  );
}
