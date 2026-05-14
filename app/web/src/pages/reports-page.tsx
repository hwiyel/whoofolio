import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { ThemeMode } from "../app/App";
import {
  fetchMonthlyReport,
  type DailyCashflowPoint,
  type ExpenseCategoryRow,
  type MonthlyIncomePoint,
  type MonthlyTrendPoint,
  type MonthlyReportResponse
} from "../lib/api";

export type ReportMode = "spending" | "income" | "monthly";
type TrendPreset = "3M" | "6M" | "1Y";
type YearPreset = "rolling" | "previous" | "current";

export function ReportsPage(props: { hideAmounts: boolean; initialMode: ReportMode; theme: ThemeMode }) {
  const currentMonth = currentMonthValue();
  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [activeYearPreset, setActiveYearPreset] = useState<YearPreset>("rolling");
  const reportMonth = props.initialMode === "monthly" ? activeMonth : currentMonth;
  const reportQuery = useQuery({
    queryKey: ["monthly-report", props.initialMode, reportMonth],
    queryFn: () => fetchMonthlyReport(reportMonth)
  });
  const monthPresets = createRecentMonthPresets();

  const data = reportQuery.data;
  const dailyCashflowTrend = Array.isArray(data?.dailyCashflowTrend) ? data.dailyCashflowTrend : [];
  const monthlyExpenseTrend = Array.isArray(data?.monthlyExpenseTrend)
    ? data.monthlyExpenseTrend
    : [];
  const monthlyIncomeTrend = Array.isArray(data?.monthlyIncomeTrend)
    ? data.monthlyIncomeTrend
    : [];
  const expenseCategories = Array.isArray(data?.expenseCategories) ? data.expenseCategories : [];
  const incomeCategories = Array.isArray(data?.incomeCategories) ? data.incomeCategories : [];
  const chartTheme = getChartTheme(props.theme);
  const pageTitle =
    props.initialMode === "monthly"
      ? "월간분석"
      : props.initialMode === "spending"
        ? "지출분석"
        : "수입분석";

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-2">
        <p className="app-muted text-sm">분석</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="app-heading text-2xl font-semibold">{pageTitle}</h2>
          {props.initialMode === "monthly" ? (
            <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
              {monthPresets.map((preset) => (
                <button
                  key={preset.value}
                  className={`app-pill rounded-full px-3 py-2 text-xs tracking-[0.18em] transition ${
                    preset.value === activeMonth
                      ? "app-pill-active-income"
                      : ""
                  }`}
                  onClick={() => setActiveMonth(preset.value)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : props.initialMode === "income" ? (
            <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
              <YearPresetButton
                active={activeYearPreset === "rolling"}
                label="최근 1년"
                onClick={() => setActiveYearPreset("rolling")}
                tone="income"
              />
              <YearPresetButton
                active={activeYearPreset === "previous"}
                label="작년"
                onClick={() => setActiveYearPreset("previous")}
                tone="income"
              />
              <YearPresetButton
                active={activeYearPreset === "current"}
                label="올해"
                onClick={() => setActiveYearPreset("current")}
                tone="income"
              />
            </div>
          ) : props.initialMode === "spending" ? (
            <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
              <YearPresetButton
                active={activeYearPreset === "rolling"}
                label="최근 1년"
                onClick={() => setActiveYearPreset("rolling")}
                tone="expense"
              />
              <YearPresetButton
                active={activeYearPreset === "previous"}
                label="작년"
                onClick={() => setActiveYearPreset("previous")}
                tone="expense"
              />
              <YearPresetButton
                active={activeYearPreset === "current"}
                label="올해"
                onClick={() => setActiveYearPreset("current")}
                tone="expense"
              />
            </div>
          ) : null}
        </div>
      </div>

      {reportQuery.isError ? (
        <section className="app-error rounded-3xl p-5 text-sm leading-6">
          월간 리포트를 읽는 중 오류가 발생했습니다.
        </section>
      ) : null}

      {props.initialMode === "monthly" ? (
        <MonthlyAnalysisView
          chartTheme={chartTheme}
          data={data}
          dailyCashflowTrend={dailyCashflowTrend}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          hideAmounts={props.hideAmounts}
          isLoading={reportQuery.isLoading}
        />
      ) : props.initialMode === "income" ? (
        <IncomeAnalysisView
          activeYearPreset={activeYearPreset}
          anchorMonth={currentMonth}
          chartTheme={chartTheme}
          hideAmounts={props.hideAmounts}
          isLoading={reportQuery.isLoading}
          monthlyIncomeTrend={monthlyIncomeTrend}
        />
      ) : props.initialMode === "spending" ? (
        <ExpenseAnalysisView
          activeYearPreset={activeYearPreset}
          anchorMonth={currentMonth}
          chartTheme={chartTheme}
          hideAmounts={props.hideAmounts}
          isLoading={reportQuery.isLoading}
          monthlyExpenseTrend={monthlyExpenseTrend}
        />
      ) : (
        null
      )}
    </section>
  );
}

function IncomeAnalysisView(props: {
  activeYearPreset: YearPreset;
  anchorMonth: string;
  chartTheme: ReturnType<typeof getChartTheme>;
  hideAmounts: boolean;
  isLoading: boolean;
  monthlyIncomeTrend: MonthlyIncomePoint[];
}) {
  const yearBuckets = splitIncomeTrendByYear(props.monthlyIncomeTrend, props.anchorMonth);
  const selectedIncomeTrend =
    props.activeYearPreset === "rolling"
      ? yearBuckets.rolling.points
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.points
        : yearBuckets.current.points;
  const totalIncome = selectedIncomeTrend.reduce((sum, point) => sum + point.income, 0);
  const averageIncome = selectedIncomeTrend.length ? totalIncome / selectedIncomeTrend.length : 0;
  const cumulativeIncomeTrend = buildCumulativeIncomeTrend(selectedIncomeTrend);
  const selectedPeriodLabel =
    props.activeYearPreset === "rolling"
      ? yearBuckets.rolling.label
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.label
        : yearBuckets.current.label;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <ReportCard
          delta={`${selectedPeriodLabel} 기준`}
          label="수입총계"
          tone="app-tone-positive"
          value={formatMoney(totalIncome, props.hideAmounts)}
        />
        <ReportCard
          delta={`${selectedPeriodLabel} 월평균`}
          label="수입평균"
          tone="app-tone-neutral"
          value={formatMoney(Math.round(averageIncome), props.hideAmounts)}
        />
      </section>

      <article className="app-card rounded-[2rem] p-6">
        <div className="app-divider space-y-2 pb-5">
          <p className="app-muted text-sm">{selectedPeriodLabel}</p>
          <h3 className="app-heading text-2xl font-semibold">수입 추이</h3>
        </div>
        <div className="mt-6 h-[360px]">
          {props.isLoading ? (
            <EmptyState text="수입 추이를 불러오는 중입니다." />
          ) : cumulativeIncomeTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cumulativeIncomeTrend}
                margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={props.chartTheme.grid} vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                  tickFormatter={(value) => formatAxisMoney(value, props.hideAmounts)}
                  tickLine={false}
                  width={72}
                  yAxisId="monthly"
                />
                <YAxis
                  axisLine={false}
                  orientation="right"
                  tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                  tickFormatter={(value) => formatAxisMoney(value, props.hideAmounts)}
                  tickLine={false}
                  width={72}
                  yAxisId="cumulative"
                />
                <Tooltip
                  contentStyle={{
                    background: props.chartTheme.tooltipBackground,
                    border: `1px solid ${props.chartTheme.tooltipBorder}`,
                    borderRadius: "16px",
                    color: props.chartTheme.tooltipText
                  }}
                  cursor={{ fill: props.chartTheme.cursorFill }}
                  formatter={(value, name) => [
                    formatMoney(Number(value), props.hideAmounts),
                    name === "cumulativeIncome" ? "누적 수입" : "월별 수입"
                  ]}
                  labelStyle={{ color: props.chartTheme.tick }}
                />
                <Bar
                  barSize={22}
                  dataKey="income"
                  fill="#34d399"
                  fillOpacity={0.72}
                  radius={[10, 10, 0, 0]}
                  yAxisId="monthly"
                />
                <Line
                  dataKey="cumulativeIncome"
                  dot={{ fill: "#f0fdf4", r: 3, stroke: "#34d399", strokeWidth: 2 }}
                  stroke="#bbf7d0"
                  strokeWidth={2.5}
                  type="monotone"
                  yAxisId="cumulative"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="표시할 수입 추이가 없습니다." />
          )}
        </div>
      </article>
    </>
  );
}

function ExpenseAnalysisView(props: {
  activeYearPreset: YearPreset;
  anchorMonth: string;
  chartTheme: ReturnType<typeof getChartTheme>;
  hideAmounts: boolean;
  isLoading: boolean;
  monthlyExpenseTrend: MonthlyTrendPoint[];
}) {
  const yearBuckets = splitExpenseTrendByYear(props.monthlyExpenseTrend, props.anchorMonth);
  const selectedExpenseTrend =
    props.activeYearPreset === "rolling"
      ? yearBuckets.rolling.points
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.points
        : yearBuckets.current.points;
  const totalExpense = selectedExpenseTrend.reduce((sum, point) => sum + point.expense, 0);
  const averageExpense = selectedExpenseTrend.length ? totalExpense / selectedExpenseTrend.length : 0;
  const cumulativeExpenseTrend = buildYearlyCumulativeExpenseTrend(selectedExpenseTrend);
  const selectedPeriodLabel =
    props.activeYearPreset === "rolling"
      ? yearBuckets.rolling.label
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.label
        : yearBuckets.current.label;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2">
        <ReportCard
          delta={`${selectedPeriodLabel} 기준`}
          label="지출총계"
          tone="app-tone-negative"
          value={formatMoney(totalExpense, props.hideAmounts)}
        />
        <ReportCard
          delta={`${selectedPeriodLabel} 월평균`}
          label="지출평균"
          tone="app-tone-neutral"
          value={formatMoney(Math.round(averageExpense), props.hideAmounts)}
        />
      </section>

      <article className="app-card rounded-[2rem] p-6">
        <div className="app-divider space-y-2 pb-5">
          <p className="app-muted text-sm">{selectedPeriodLabel}</p>
          <h3 className="app-heading text-2xl font-semibold">지출 추이</h3>
        </div>
        <div className="mt-6 h-[360px]">
          {props.isLoading ? (
            <EmptyState text="지출 추이를 불러오는 중입니다." />
          ) : cumulativeExpenseTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cumulativeExpenseTrend}
                margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={props.chartTheme.grid} vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                  tickFormatter={(value) => formatAxisMoney(value, props.hideAmounts)}
                  tickLine={false}
                  width={72}
                  yAxisId="monthly"
                />
                <YAxis
                  axisLine={false}
                  orientation="right"
                  tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                  tickFormatter={(value) => formatAxisMoney(value, props.hideAmounts)}
                  tickLine={false}
                  width={72}
                  yAxisId="cumulative"
                />
                <Tooltip
                  contentStyle={{
                    background: props.chartTheme.tooltipBackground,
                    border: `1px solid ${props.chartTheme.tooltipBorder}`,
                    borderRadius: "16px",
                    color: props.chartTheme.tooltipText
                  }}
                  cursor={{ fill: props.chartTheme.cursorFill }}
                  formatter={(value, name) => [
                    formatMoney(Number(value), props.hideAmounts),
                    name === "cumulativeExpense" ? "누적 지출" : "월별 지출"
                  ]}
                  labelStyle={{ color: props.chartTheme.tick }}
                />
                <Bar
                  barSize={22}
                  dataKey="expense"
                  fill="#f97316"
                  fillOpacity={0.72}
                  radius={[10, 10, 0, 0]}
                  yAxisId="monthly"
                />
                <Line
                  dataKey="cumulativeExpense"
                  dot={{ fill: "#fff7ed", r: 3, stroke: "#f97316", strokeWidth: 2 }}
                  stroke="#fdba74"
                  strokeWidth={2.5}
                  type="monotone"
                  yAxisId="cumulative"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="표시할 지출 추이가 없습니다." />
          )}
        </div>
      </article>
    </>
  );
}

function MonthlyAnalysisView(props: {
  chartTheme: ReturnType<typeof getChartTheme>;
  data?: MonthlyReportResponse;
  dailyCashflowTrend: DailyCashflowPoint[];
  expenseCategories: ExpenseCategoryRow[];
  incomeCategories: ExpenseCategoryRow[];
  hideAmounts: boolean;
  isLoading: boolean;
}) {
  const [showAllItems, setShowAllItems] = useState(false);
  const cumulativeExpenseTrend = buildCumulativeExpenseTrend(props.dailyCashflowTrend);
  const totalDailyExpense = props.dailyCashflowTrend.reduce((sum, point) => sum + point.expense, 0);
  const monthlyExpense = props.data?.expense ?? 0;
  const expenseGap = monthlyExpense - totalDailyExpense;
  const hasExpenseGap = Math.abs(expenseGap) >= 1;
  const monthlyItems = flattenMonthlyItems(props.expenseCategories);
  const visibleMonthlyItems = showAllItems ? monthlyItems : monthlyItems.slice(0, 5);
  const expenseEvents = buildExpenseEvents(
    props.dailyCashflowTrend,
    cumulativeExpenseTrend,
    props.hideAmounts
  );

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          delta={formatDeltaText(props.data?.incomeDelta, props.hideAmounts)}
          label="수입"
          tone="app-tone-positive"
          value={formatMoney(props.data?.income, props.hideAmounts)}
        />
        <ReportCard
          delta={formatDeltaText(props.data?.expenseDelta, props.hideAmounts)}
          label="지출"
          tone="app-tone-negative"
          value={formatMoney(props.data?.expense, props.hideAmounts)}
        />
        <ReportCard
          delta={formatDeltaText(props.data?.netCashflowDelta, props.hideAmounts)}
          label="남은돈"
          tone={cashflowTone(props.data?.netCashflow)}
          value={formatMoney(props.data?.netCashflow, props.hideAmounts)}
        />
        <ReportCard
          delta={formatRateDelta(
            props.data?.netCashflow,
            props.data?.income,
            props.data?.prevNetCashflow,
            props.data?.prevIncome
          )}
          label="남는비율"
          tone="app-tone-neutral"
          value={formatRate(props.data?.netCashflow, props.data?.income)}
        />
      </section>

      <TrendReportPanel
        annotations={expenseEvents}
        chartTheme={props.chartTheme}
        data={cumulativeExpenseTrend}
        dataKey="cumulativeExpense"
        emptyText="표시할 누적 지출 추이가 없습니다."
        gradientId="dailyExpenseFill"
        hideAmounts={props.hideAmounts}
        isLoading={props.isLoading}
        loadingText="누적 지출 추이를 불러오는 중입니다."
        sectionLabel="월간 지출 트렌드"
        strokeColor="#f97316"
        title="월 누적 지출 추이"
        tooltipLabel="누적 지출"
      />

      {hasExpenseGap ? (
        <section className="app-warning rounded-3xl p-4 text-sm">
          월간 지출 합계와 일별 지출 합계가 {formatMoney(Math.abs(expenseGap), props.hideAmounts)} 차이납니다.
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="app-card rounded-[2rem] p-6">
          <div className="app-divider pb-5">
            <div className="space-y-2">
              <p className="app-muted text-sm">카테고리별 지출</p>
              <h3 className="app-heading text-2xl font-semibold">월 지출 구성</h3>
            </div>
          </div>
          <div className="mt-6">
            {props.isLoading ? (
              <EmptyState text="카테고리별 지출을 불러오는 중입니다." />
            ) : props.expenseCategories.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {props.expenseCategories.map((category) => {
                  return (
                    <article
                      key={category.category}
                      className="app-card-subtle rounded-3xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="app-heading text-base font-medium">{category.category}</p>
                        <p className="app-heading text-right text-base font-semibold">
                          {formatMoney(category.amount, props.hideAmounts)}
                        </p>
                      </div>
                      <p className="app-muted mt-3 text-sm">{formatShare(category.share)}</p>
                      <div className="app-progress-track mt-3 h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-orange-400"
                          style={{ width: `${Math.min(category.share, 100)}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="표시할 카테고리별 지출이 없습니다." />
            )}
          </div>
        </article>

        <article className="app-card rounded-[2rem] p-6">
          <div className="app-divider pb-5">
            <div className="space-y-2">
              <p className="app-muted text-sm">카테고리별 수입</p>
              <h3 className="app-heading text-2xl font-semibold">월 수입 구성</h3>
            </div>
          </div>
          <div className="mt-6">
            {props.isLoading ? (
              <EmptyState text="카테고리별 수입을 불러오는 중입니다." />
            ) : props.incomeCategories.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {props.incomeCategories.map((category) => {
                  return (
                    <article
                      key={category.category}
                      className="app-card-subtle rounded-3xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="app-heading text-base font-medium">{category.category}</p>
                        <p className="app-heading text-right text-base font-semibold">
                          {formatMoney(category.amount, props.hideAmounts)}
                        </p>
                      </div>
                      <p className="app-muted mt-3 text-sm">{formatShare(category.share)}</p>
                      <div className="app-progress-track mt-3 h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-emerald-300/80"
                          style={{ width: `${Math.min(category.share, 100)}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="표시할 카테고리별 수입이 없습니다." />
            )}
          </div>
        </article>
      </div>

      <article className="app-card rounded-[2rem] p-6">
        <div className="app-divider pb-5">
          <div className="space-y-2">
            <p className="app-muted text-sm">아이템별 지출</p>
            <h3 className="app-heading text-2xl font-semibold">월 아이템 목록</h3>
          </div>
        </div>
        <div className="mt-6">
          {props.isLoading ? (
            <EmptyState text="아이템 목록을 불러오는 중입니다." />
          ) : monthlyItems.length ? (
            <div className="space-y-2">
              {visibleMonthlyItems.map((item) => (
                <article
                  key={`monthly-item-${item.item}`}
                  className="app-card-subtle rounded-2xl px-4 py-3"
                >
                  {(() => {
                    const itemShare = calculateShare(item.amount, monthlyExpense);

                    return (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <p className="app-heading truncate text-base font-medium">{item.item}</p>
                          <p className="app-heading text-right text-base font-semibold">
                            {formatMoney(item.amount, props.hideAmounts)}
                          </p>
                        </div>
                        <p className="app-muted mt-3 text-sm">{formatShare(itemShare)}</p>
                        <div className="app-progress-track mt-3 h-2 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-emerald-300/80"
                            style={{ width: `${Math.min(itemShare, 100)}%` }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
              {!showAllItems && monthlyItems.length > visibleMonthlyItems.length ? (
                <button
                  className="app-more-button w-full rounded-2xl px-4 py-3 text-sm transition"
                  onClick={() => setShowAllItems(true)}
                  type="button"
                >
                  더보기
                </button>
              ) : null}
            </div>
          ) : (
            <EmptyState text="표시할 아이템이 없습니다." />
          )}
        </div>
      </article>
    </>
  );
}

function TrendReportPanel<T extends { label: string }>(props: {
  annotations?: Array<{ label: string; note: string; value: number }>;
  activePreset?: TrendPreset;
  chartTheme: ReturnType<typeof getChartTheme>;
  data: T[];
  dataKey: keyof T & string;
  emptyText: string;
  gradientId: string;
  hideAmounts: boolean;
  isLoading: boolean;
  loadingText: string;
  onChangePreset?: (preset: TrendPreset) => void;
  presets?: TrendPreset[];
  sectionLabel: string;
  strokeColor: string;
  title: string;
  tooltipLabel: string;
}) {
  return (
    <article className="app-card rounded-[2rem] p-6">
      <div className="app-divider space-y-2 pb-5">
        <p className="app-muted text-sm">{props.sectionLabel}</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="app-heading text-2xl font-semibold">{props.title}</h3>
          {props.presets?.length ? (
            <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
              {props.presets.map((preset) => (
                <button
                  key={preset}
                  className={`app-pill rounded-full px-3 py-2 text-xs tracking-[0.18em] transition ${
                    preset === props.activePreset
                      ? "app-pill-active-income"
                      : ""
                  }`}
                  onClick={() => props.onChangePreset?.(preset)}
                  type="button"
                >
                  {preset}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
              <CartesianGrid stroke={props.chartTheme.grid} vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: props.chartTheme.tick, fontSize: 12 }}
                tickFormatter={(value) => formatAxisMoney(value, props.hideAmounts)}
                tickLine={false}
                width={72}
              />
              <Tooltip
                contentStyle={{
                  background: props.chartTheme.tooltipBackground,
                  border: `1px solid ${props.chartTheme.tooltipBorder}`,
                  borderRadius: "16px",
                  color: props.chartTheme.tooltipText
                }}
                cursor={{ stroke: props.chartTheme.cursorStroke, strokeDasharray: "4 4" }}
                formatter={(value) => [formatMoney(Number(value), props.hideAmounts), props.tooltipLabel]}
                labelStyle={{ color: props.chartTheme.tick }}
              />
              {props.annotations?.map((annotation) => (
                <ReferenceDot
                  key={`${annotation.label}-${annotation.note}`}
                  fill="#fb923c"
                  ifOverflow="extendDomain"
                  label={{
                    fill: "#fdba74",
                    fontSize: 11,
                    position: "top",
                    value: annotation.note
                  }}
                  r={4}
                  stroke="#fff7ed"
                  strokeWidth={1.5}
                  x={annotation.label}
                  y={annotation.value}
                />
              ))}
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

function YearPresetButton(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone: "expense" | "income";
}) {
  const activeClass =
    props.tone === "income"
      ? "app-pill-active-income"
      : "app-pill-active-expense";

  return (
    <button
      className={`app-pill rounded-full px-3 py-2 text-xs tracking-[0.18em] transition ${
        props.active
          ? activeClass
          : ""
      }`}
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}

function ReportCard(props: {
  label: string;
  value: string;
  delta: string;
  tone: string;
}) {
  return (
    <article className="app-card flex min-h-[144px] flex-col justify-between rounded-3xl p-5">
      <p className="app-muted text-sm">{props.label}</p>
      <div>
        <p className={`text-3xl font-semibold leading-tight ${props.tone}`}>{props.value}</p>
        <p className="app-muted-strong mt-2 text-sm">{props.delta}</p>
      </div>
    </article>
  );
}

function EmptyState(props: { text: string }) {
  return (
    <div className="app-empty rounded-2xl p-10 text-center text-sm">
      {props.text}
    </div>
  );
}

function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function createRecentMonthPresets() {
  const today = new Date();

  return Array.from({ length: 5 }, (_, index) => {
    const month = new Date(today.getFullYear(), today.getMonth() - (4 - index), 1);
    return {
      value: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      label: `${month.getMonth() + 1}월`
    };
  });
}

function buildCumulativeExpenseTrend(points: DailyCashflowPoint[]) {
  let cumulativeExpense = 0;

  return points.map((point) => {
    cumulativeExpense += point.expense;
    return {
      label: point.label,
      cumulativeExpense
    };
  });
}

function buildCumulativeIncomeTrend(points: MonthlyIncomePoint[]) {
  let cumulativeIncome = 0;

  return points.map((point) => {
    cumulativeIncome += point.income;
    return {
      label: point.label,
      income: point.income,
      cumulativeIncome
    };
  });
}

function buildYearlyCumulativeExpenseTrend(points: MonthlyTrendPoint[]) {
  let cumulativeExpense = 0;

  return points.map((point) => {
    cumulativeExpense += point.expense;
    return {
      label: point.label,
      expense: point.expense,
      cumulativeExpense
    };
  });
}

function splitIncomeTrendByYear(points: MonthlyIncomePoint[], anchorMonth: string) {
  const [yearText = "0", monthText = "1"] = anchorMonth.split("-");
  const anchorYear = Number(yearText);
  const anchorMonthNumber = Number(monthText);
  const history = points.slice(-24);
  const startOffset = history.length - 1;
  const previous: MonthlyIncomePoint[] = [];
  const current: MonthlyIncomePoint[] = [];

  history.forEach((point, index) => {
    const date = new Date(anchorYear, anchorMonthNumber - 1 - (startOffset - index), 1);
    const normalizedPoint = {
      ...point,
      label: `${date.getMonth() + 1}월`
    };

    if (date.getFullYear() === anchorYear) {
      current.push(normalizedPoint);
      return;
    }

    if (date.getFullYear() === anchorYear - 1) {
      previous.push(normalizedPoint);
    }
  });

  return {
    rolling: {
      label: "최근 1년",
      points: history.slice(-12)
    },
    previous: {
      label: `${anchorYear - 1}년`,
      points: previous
    },
    current: {
      label: `${anchorYear}년`,
      points: current
    }
  };
}

function splitExpenseTrendByYear(points: MonthlyTrendPoint[], anchorMonth: string) {
  const [yearText = "0", monthText = "1"] = anchorMonth.split("-");
  const anchorYear = Number(yearText);
  const anchorMonthNumber = Number(monthText);
  const history = points.slice(-24);
  const startOffset = history.length - 1;
  const previous: MonthlyTrendPoint[] = [];
  const current: MonthlyTrendPoint[] = [];

  history.forEach((point, index) => {
    const date = new Date(anchorYear, anchorMonthNumber - 1 - (startOffset - index), 1);
    const normalizedPoint = {
      ...point,
      label: `${date.getMonth() + 1}월`
    };

    if (date.getFullYear() === anchorYear) {
      current.push(normalizedPoint);
      return;
    }

    if (date.getFullYear() === anchorYear - 1) {
      previous.push(normalizedPoint);
    }
  });

  return {
    rolling: {
      label: "최근 1년",
      points: history.slice(-12)
    },
    previous: {
      label: `${anchorYear - 1}년`,
      points: previous
    },
    current: {
      label: `${anchorYear}년`,
      points: current
    }
  };
}

function buildExpenseEvents(
  dailyPoints: DailyCashflowPoint[],
  cumulativePoints: Array<{ label: string; cumulativeExpense: number }>,
  hideAmounts: boolean
) {
  const cumulativeByLabel = new Map(
    cumulativePoints.map((point) => [point.label, point.cumulativeExpense] as const)
  );

  return dailyPoints
    .filter((point) => point.expense > 0)
    .sort((left, right) => right.expense - left.expense)
    .slice(0, 3)
    .map((point) => ({
      label: point.label,
      note: `${point.label} ${hideAmounts ? "•••" : formatShortMoney(point.expense)}`,
      value: cumulativeByLabel.get(point.label) ?? point.expense
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "ko-KR"));
}

function flattenMonthlyItems(categories: ExpenseCategoryRow[]) {
  const aggregated = new Map<string, number>();

  for (const category of categories) {
    const items = Array.isArray(category.items) ? category.items : [];
    for (const item of items) {
      aggregated.set(item.item, (aggregated.get(item.item) ?? 0) + item.amount);
    }
  }

  return Array.from(aggregated.entries())
    .map(([item, amount]) => ({ item, amount }))
    .sort((left, right) => {
      if (left.amount === right.amount) {
        return left.item.localeCompare(right.item, "ko-KR");
      }
      return right.amount - left.amount;
    });
}

function calculateShare(amount: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (amount / total) * 100;
}

function formatMoney(value?: number, hidden = false) {
  if (hidden) {
    return "••••••";
  }

  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0
  }).format(value) + "원";
}

function formatDeltaText(value?: number, hidden = false) {
  if (typeof value !== "number") {
    return "전월대비 -";
  }

  if (value === 0) {
    return "전월대비 변동 없음";
  }

  const direction = value > 0 ? "증가" : "감소";
  return `전월대비 ${formatMoney(Math.abs(value), hidden)} ${direction}`;
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
    return "app-tone-neutral";
  }
  if (value > 0) {
    return "app-tone-positive";
  }
  if (value < 0) {
    return "app-tone-negative";
  }

  return "app-tone-neutral";
}

function getChartTheme(theme: ThemeMode) {
  if (theme === "light") {
    return {
      cursorFill: "rgba(15,23,42,0.05)",
      cursorStroke: "rgba(15,23,42,0.12)",
      grid: "rgba(15,23,42,0.08)",
      tick: "#64748b",
      tooltipBackground: "#ffffff",
      tooltipBorder: "rgba(148,163,184,0.35)",
      tooltipText: "#0f172a"
    };
  }

  return {
    cursorFill: "rgba(255,255,255,0.04)",
    cursorStroke: "rgba(255,255,255,0.12)",
    grid: "rgba(255,255,255,0.07)",
    tick: "#78716c",
    tooltipBackground: "#1c1917",
    tooltipBorder: "rgba(255,255,255,0.1)",
    tooltipText: "#fafaf9"
  };
}

function formatAxisMoney(value: number, hidden = false) {
  if (hidden) {
    return "•••";
  }

  const abs = Math.abs(value);
  if (abs >= 100000000) {
    return `${trimTrailingZero((value / 100000000).toFixed(1))}억`;
  }
  if (abs >= 10000) {
    return `${trimTrailingZero((value / 10000).toFixed(1))}만`;
  }

  return `${Math.round(value)}`;
}

function formatShortMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100000000) {
    return `${trimTrailingZero((value / 100000000).toFixed(1))}억`;
  }
  if (abs >= 10000) {
    return `${trimTrailingZero((value / 10000).toFixed(1))}만`;
  }

  return formatMoney(value);
}

function trimTrailingZero(value: string) {
  return value.replace(/\.0$/, "");
}
