import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis
} from "recharts";

import type { ThemeMode } from "../app/App";
import type {
  OverviewTrendPoint,
  OverviewTrendRange,
  OverviewTrendResponse
} from "../lib/api";

interface OverviewTrendChartProps {
  activeRange: OverviewTrendRange;
  data?: OverviewTrendResponse;
  hideAmounts: boolean;
  isLoading: boolean;
  onChangeRange: (range: OverviewTrendRange) => void;
  theme: ThemeMode;
}

const ranges: OverviewTrendRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y"];

export function OverviewTrendChart({
  activeRange,
  data,
  hideAmounts,
  isLoading,
  onChangeRange,
  theme
}: OverviewTrendChartProps) {
  const points = data?.points ?? [];
  const chartTheme = getChartTheme(theme);

  return (
    <section>
      <div className="max-w-[420px] space-y-1 pl-10">
        <p className="app-muted text-sm">순자산</p>
        <h2 className="app-heading text-4xl font-semibold tracking-tight md:text-5xl">
          {formatMoney(data?.currentValue, hideAmounts)}
        </h2>
        <p className={`${changeTone(data?.changeValue)} text-sm`}>
          {formatSignedMoney(data?.changeValue, hideAmounts)} | {formatChangeRate(data?.currentValue, data?.changeValue)} · 지난{" "}
          {formatRangeLabel(activeRange)}
        </p>
      </div>

      <div className="mt-2 h-[300px] pb-2">
        {isLoading ? (
          <div className="app-muted flex h-full items-center justify-center text-sm">
            차트 데이터를 불러오는 중입니다.
          </div>
        ) : points.length === 0 ? (
          <div className="app-muted flex h-full items-center justify-center text-sm">
            표시할 추이 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="capitalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBackground,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  borderRadius: "16px",
                  color: chartTheme.tooltipText
                }}
                cursor={{ stroke: chartTheme.cursor, strokeDasharray: "4 4" }}
                formatter={(value) => [formatMoney(Number(value), hideAmounts), "순자산"]}
                labelFormatter={(label) => `${label}`}
                labelStyle={{ color: chartTheme.tick }}
              />
              <Area
                dataKey="capital"
                fill="url(#capitalFill)"
                fillOpacity={1}
                stroke="#2dd4bf"
                strokeWidth={2.4}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {ranges.map((range) => (
          <button
            key={range}
            className={`app-pill rounded-full px-2.5 py-1.5 text-[11px] tracking-[0.12em] transition ${
              range === activeRange
                ? "app-pill-active-income"
                : ""
            }`}
            onClick={() => onChangeRange(range)}
            type="button"
          >
            {range}
          </button>
        ))}
      </div>
    </section>
  );
}

function formatMoney(value?: number, hidden = false) {
  if (hidden) {
    return "••••••";
  }

  if (typeof value !== "number") {
    return "-";
  }

  return (
    new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0
    }).format(value) + "원"
  );
}

function formatSignedMoney(value?: number, hidden = false) {
  if (hidden) {
    return "••••••";
  }

  if (typeof value !== "number") {
    return "-";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
}

function formatAxisMoney(value: number, hidden = false) {
  if (hidden) {
    return "•••";
  }

  const abs = Math.abs(value);
  if (abs >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억`;
  }
  if (abs >= 10000) {
    return `${Math.round(value / 10000)}만`;
  }

  return `${Math.round(value)}`;
}

function changeTone(value?: number) {
  if (typeof value !== "number") {
    return "app-muted";
  }
  if (value > 0) {
    return "app-tone-positive";
  }
  if (value < 0) {
    return "app-tone-negative";
  }

  return "app-muted";
}

function formatChangeRate(currentValue?: number, changeValue?: number) {
  if (typeof currentValue !== "number" || typeof changeValue !== "number") {
    return "-";
  }

  const baseValue = currentValue - changeValue;
  if (baseValue === 0) {
    return "-";
  }

  const rate = (changeValue / baseValue) * 100;
  const prefix = rate > 0 ? "+" : "";
  return `${prefix}${rate.toFixed(2)}%`;
}

function formatRangeLabel(value: OverviewTrendRange) {
  switch (value) {
    case "1W":
      return "1주";
    case "1M":
      return "1개월";
    case "3M":
      return "3개월";
    case "6M":
      return "6개월";
    case "1Y":
      return "1년";
    case "3Y":
      return "3년";
    case "5Y":
      return "5년";
    default:
      return value;
  }
}

function getChartTheme(theme: ThemeMode) {
  if (theme === "light") {
    return {
      cursor: "rgba(15,23,42,0.12)",
      grid: "rgba(15,23,42,0.08)",
      tick: "#64748b",
      tooltipBackground: "#ffffff",
      tooltipBorder: "rgba(148,163,184,0.35)",
      tooltipText: "#0f172a"
    };
  }

  return {
    cursor: "rgba(255,255,255,0.12)",
    grid: "rgba(255,255,255,0.07)",
    tick: "#78716c",
    tooltipBackground: "#1c1917",
    tooltipBorder: "rgba(255,255,255,0.1)",
    tooltipText: "#fafaf9"
  };
}
