import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import {
  fetchMonthlyReport,
  type DailyTrendPoint,
  type ExpenseCategoryRow,
  type MonthlyIncomePoint,
  type MonthlyReportResponse,
  type MonthlyTrendPoint
} from "../lib/api";

const monthOptions = createMonthOptions();
type ReportMode = "spending" | "income" | "monthly";

export function ReportsPage() {
  const [activeMonth, setActiveMonth] = useState(monthOptions[0] ?? currentMonthValue());
  const [activeMode, setActiveMode] = useState<ReportMode>("monthly");
  const reportQuery = useQuery({
    queryKey: ["monthly-report", activeMonth],
    queryFn: () => fetchMonthlyReport(activeMonth)
  });

  const data = reportQuery.data;
  const dailyExpenseTrend = Array.isArray(data?.dailyExpenseTrend) ? data.dailyExpenseTrend : [];
  const monthlyExpenseTrend = Array.isArray(data?.monthlyExpenseTrend)
    ? data.monthlyExpenseTrend
    : [];
  const monthlyIncomeTrend = Array.isArray(data?.monthlyIncomeTrend)
    ? data.monthlyIncomeTrend
    : [];
  const expenseCategories = Array.isArray(data?.expenseCategories) ? data.expenseCategories : [];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex-1 space-y-2">
          <p className="text-sm text-stone-400">분석</p>
          <h2 className="text-2xl font-semibold text-white">{data?.month ?? activeMonth} 분석</h2>
        </div>
        <label className="w-full space-y-2 md:w-[180px]">
          <span className="text-sm text-stone-400">기준 월</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
            onChange={(event) => setActiveMonth(event.target.value)}
            value={activeMonth}
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reportQuery.isError ? (
        <section className="rounded-3xl border border-rose-400/20 bg-rose-300/10 p-5 text-sm leading-6 text-rose-100">
          월간 리포트를 읽는 중 오류가 발생했습니다.
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "spending", label: "비용" },
          { id: "income", label: "수익" },
          { id: "monthly", label: "월간 분석" }
        ].map((item) => {
          const isActive = item.id === activeMode;
          return (
            <button
              key={item.id}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                isActive
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 bg-white/5 text-stone-300 hover:border-white/20 hover:bg-white/10"
              }`}
              onClick={() => setActiveMode(item.id as ReportMode)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {activeMode === "monthly" ? (
        <MonthlyAnalysisView
          data={data}
          dailyExpenseTrend={dailyExpenseTrend}
          expenseCategories={expenseCategories}
          isLoading={reportQuery.isLoading}
        />
      ) : activeMode === "spending" ? (
        <TrendReportPanel
          data={monthlyExpenseTrend}
          dataKey="expense"
          emptyText="표시할 월별 비용 추이가 없습니다."
          gradientId="expenseFill"
          isLoading={reportQuery.isLoading}
          loadingText="월별 비용 추이를 불러오는 중입니다."
          sectionLabel="비용 보고서"
          strokeColor="#f97316"
          title="최근 6개월 월별 비용 추이"
          tooltipLabel="지출"
        />
      ) : (
        <TrendReportPanel
          data={monthlyIncomeTrend}
          dataKey="income"
          emptyText="표시할 월별 수익 추이가 없습니다."
          gradientId="incomeFill"
          isLoading={reportQuery.isLoading}
          loadingText="월별 수익 추이를 불러오는 중입니다."
          sectionLabel="수익 보고서"
          strokeColor="#34d399"
          title="최근 6개월 월별 수익 추이"
          tooltipLabel="수익"
        />
      )}
    </section>
  );
}

function MonthlyAnalysisView(props: {
  data?: MonthlyReportResponse;
  dailyExpenseTrend: DailyTrendPoint[];
  expenseCategories: ExpenseCategoryRow[];
  isLoading: boolean;
}) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          delta={formatDeltaText(props.data?.incomeDelta)}
          label="수익"
          tone="text-emerald-200"
          value={formatMoney(props.data?.income)}
        />
        <ReportCard
          delta={formatDeltaText(props.data?.expenseDelta)}
          label="비용"
          tone="text-rose-200"
          value={formatMoney(props.data?.expense)}
        />
        <ReportCard
          delta={formatDeltaText(props.data?.netCashflowDelta)}
          label="남은돈"
          tone={cashflowTone(props.data?.netCashflow)}
          value={formatMoney(props.data?.netCashflow)}
        />
        <ReportCard
          delta={formatRateDelta(
            props.data?.netCashflow,
            props.data?.income,
            props.data?.prevNetCashflow,
            props.data?.prevIncome
          )}
          label="남는비율"
          tone="text-white"
          value={formatRate(props.data?.netCashflow, props.data?.income)}
        />
      </section>

      <TrendReportPanel
        data={props.dailyExpenseTrend}
        dataKey="cumulativeExpense"
        emptyText="표시할 월간 비용 추이가 없습니다."
        gradientId="dailyExpenseFill"
        isLoading={props.isLoading}
        loadingText="월간 비용 추이를 불러오는 중입니다."
        sectionLabel="월간 비용 트렌드"
        strokeColor="#f97316"
        title="기준 월 누적 비용 추이"
        tooltipLabel="누적 비용"
      />

      <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="space-y-2 border-b border-white/10 pb-5">
          <p className="text-sm text-stone-400">카테고리별 비용</p>
          <h3 className="text-2xl font-semibold text-white">기준 월 비용 구성</h3>
        </div>
        <div className="mt-6">
          {props.isLoading ? (
            <EmptyState text="카테고리별 비용을 불러오는 중입니다." />
          ) : props.expenseCategories.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {props.expenseCategories.map((category) => (
                <article
                  key={category.category}
                  className="rounded-3xl border border-white/8 bg-stone-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-base font-medium text-white">{category.category}</p>
                      <p className="text-sm text-stone-400">
                        {category.count}건 · {formatShare(category.share)}
                      </p>
                    </div>
                    <p className="text-right text-base font-semibold text-white">
                      {formatMoney(category.amount)}
                    </p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-orange-400"
                      style={{ width: `${Math.min(category.share, 100)}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="표시할 카테고리별 비용이 없습니다." />
          )}
        </div>
      </article>
    </>
  );
}

function TrendReportPanel<T extends { label: string }>(props: {
  data: T[];
  dataKey: keyof T & string;
  emptyText: string;
  gradientId: string;
  isLoading: boolean;
  loadingText: string;
  sectionLabel: string;
  strokeColor: string;
  title: string;
  tooltipLabel: string;
}) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="space-y-2 border-b border-white/10 pb-5">
        <p className="text-sm text-stone-400">{props.sectionLabel}</p>
        <h3 className="text-2xl font-semibold text-white">{props.title}</h3>
      </div>
      <div className="mt-6 h-[320px]">
        {props.isLoading ? (
          <EmptyState text={props.loadingText} />
        ) : props.data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={props.data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={props.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={props.strokeColor} stopOpacity={0.42} />
                  <stop offset="100%" stopColor={props.strokeColor} stopOpacity={0.04} />
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
                width={72}
              />
              <Tooltip
                contentStyle={{
                  background: "#1c1917",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  color: "#fafaf9"
                }}
                cursor={{ stroke: "rgba(255,255,255,0.12)", strokeDasharray: "4 4" }}
                formatter={(value) => [formatMoney(Number(value)), props.tooltipLabel]}
                labelStyle={{ color: "#a8a29e" }}
              />
              <Area
                dataKey={props.dataKey as string}
                fill={`url(#${props.gradientId})`}
                fillOpacity={1}
                stroke={props.strokeColor}
                strokeWidth={2.75}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text={props.emptyText} />
        )}
      </div>
    </article>
  );
}

function ReportCard(props: {
  label: string;
  value: string;
  delta: string;
  tone: string;
}) {
  return (
    <article className="flex min-h-[144px] flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <p className="text-sm text-stone-400">{props.label}</p>
      <div>
        <p className={`text-3xl font-semibold leading-tight ${props.tone}`}>{props.value}</p>
        <p className="mt-2 text-sm text-stone-300">{props.delta}</p>
      </div>
    </article>
  );
}

function EmptyState(props: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-stone-950/60 p-10 text-center text-sm text-stone-400">
      {props.text}
    </div>
  );
}

function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function createMonthOptions() {
  const today = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(today.getFullYear(), today.getMonth() - index, 1);
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  });
}

function formatMoney(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0
  }).format(value) + "원";
}

function formatDeltaText(value?: number) {
  if (typeof value !== "number") {
    return "전월대비 -";
  }

  if (value === 0) {
    return "전월대비 변동 없음";
  }

  const direction = value > 0 ? "증가" : "감소";
  return `전월대비 ${formatMoney(Math.abs(value))} ${direction}`;
}

function formatRate(netCashflow?: number, income?: number) {
  if (typeof netCashflow !== "number" || typeof income !== "number" || income === 0) {
    return "-";
  }

  return `${((netCashflow / income) * 100).toFixed(1)}%`;
}

function formatRateDelta(
  netCashflow?: number,
  income?: number,
  prevNetCashflow?: number,
  prevIncome?: number
) {
  const currentRate = calculateRate(netCashflow, income);
  const previousRate = calculateRate(prevNetCashflow, prevIncome);

  if (currentRate === null || previousRate === null) {
    return "전월 대비 -";
  }

  const delta = currentRate - previousRate;
  if (delta === 0) {
    return "전월 대비 변동 없음";
  }

  const direction = delta > 0 ? "상승" : "하락";
  return `전월 대비 ${Math.abs(delta).toFixed(1)}%p ${direction}`;
}

function formatShare(value: number) {
  return `${value.toFixed(1)}%`;
}

function calculateRate(netCashflow?: number, income?: number) {
  if (typeof netCashflow !== "number" || typeof income !== "number" || income === 0) {
    return null;
  }

  return (netCashflow / income) * 100;
}

function cashflowTone(value?: number) {
  if (typeof value !== "number") {
    return "text-white";
  }
  if (value > 0) {
    return "text-emerald-200";
  }
  if (value < 0) {
    return "text-rose-200";
  }

  return "text-white";
}

function formatAxisMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100000000) {
    return `${trimTrailingZero((value / 100000000).toFixed(1))}억`;
  }
  if (abs >= 10000) {
    return `${trimTrailingZero((value / 10000).toFixed(1))}만`;
  }

  return `${Math.round(value)}`;
}

function trimTrailingZero(value: string) {
  return value.replace(/\.0$/, "");
}
