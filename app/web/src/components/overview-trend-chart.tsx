import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type {
  OverviewTrendPoint,
  OverviewTrendRange,
  OverviewTrendResponse
} from "../lib/api";

interface OverviewTrendChartProps {
  activeRange: OverviewTrendRange;
  data?: OverviewTrendResponse;
  isLoading: boolean;
  onChangeRange: (range: OverviewTrendRange) => void;
}

const ranges: OverviewTrendRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y"];

export function OverviewTrendChart({
  activeRange,
  data,
  isLoading,
  onChangeRange
}: OverviewTrendChartProps) {
  const points = data?.points ?? [];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] xl:p-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Net Worth</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            {formatMoney(data?.currentValue)}
          </h2>
          <p className={`${changeTone(data?.changeValue)} text-sm`}>
            {formatSignedMoney(data?.changeValue)} | {formatChangeRate(data?.currentValue, data?.changeValue)} · 지난{" "}
            {formatRangeLabel(activeRange)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((range) => (
            <button
              key={range}
              className={`rounded-full border px-3 py-2 text-xs tracking-[0.18em] transition ${
                range === activeRange
                  ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-50 shadow-[0_10px_30px_rgba(52,211,153,0.18)]"
                  : "border-white/10 bg-white/5 text-stone-400 hover:border-white/20 hover:bg-white/10"
              }`}
              onClick={() => onChangeRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-[400px] xl:h-[460px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            차트 데이터를 불러오는 중입니다.
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            표시할 추이 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="capitalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                tick={{ fill: "#78716c", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "#78716c", fontSize: 12 }}
                tickFormatter={formatAxisMoney}
                tickLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "#1c1917",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  color: "#fafaf9"
                }}
                cursor={{ stroke: "rgba(255,255,255,0.12)", strokeDasharray: "4 4" }}
                formatter={(value) => [formatMoney(Number(value)), "순자산"]}
                labelFormatter={(label) => `${label}`}
                labelStyle={{ color: "#a8a29e" }}
              />
              <Area
                dataKey="capital"
                fill="url(#capitalFill)"
                fillOpacity={1}
                stroke="#2dd4bf"
                strokeWidth={2.75}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function formatMoney(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  return (
    new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0
    }).format(value) + "원"
  );
}

function formatSignedMoney(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
}

function formatAxisMoney(value: number) {
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
    return "text-stone-400";
  }
  if (value > 0) {
    return "text-emerald-300";
  }
  if (value < 0) {
    return "text-rose-300";
  }

  return "text-stone-400";
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
