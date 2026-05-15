import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
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
  type MonthlyReportResponse,
  type YearlyIncomeSource
} from "../lib/api";

export type ReportMode = "spending" | "income" | "monthly";
type TrendPreset = "3M" | "6M" | "1Y";
type YearPreset = "prePrevious" | "previous" | "current";

export function ReportsPage(props: { hideAmounts: boolean; initialMode: ReportMode; theme: ThemeMode }) {
  const currentMonth = currentMonthValue();
  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [activeYearPreset, setActiveYearPreset] = useState<YearPreset>("current");
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
                active={activeYearPreset === "prePrevious"}
                label="재작년"
                onClick={() => setActiveYearPreset("prePrevious")}
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
                active={activeYearPreset === "prePrevious"}
                label="재작년"
                onClick={() => setActiveYearPreset("prePrevious")}
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
          yearlyIncomeSources={Array.isArray(data?.yearlyIncomeSources) ? data.yearlyIncomeSources : []}
          hideAmounts={props.hideAmounts}
          isLoading={reportQuery.isLoading}
          monthlyIncomeTrend={monthlyIncomeTrend}
        />
      ) : props.initialMode === "spending" ? (
        <ExpenseAnalysisView
          activeYearPreset={activeYearPreset}
          anchorMonth={currentMonth}
          chartTheme={chartTheme}
          yearlyExpenseSources={Array.isArray(data?.yearlyExpenseSources) ? data.yearlyExpenseSources : []}
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
  yearlyIncomeSources: YearlyIncomeSource[];
}) {
  const yearBuckets = splitIncomeTrendByYear(props.monthlyIncomeTrend, props.anchorMonth);
  const selectedIncomeTrend =
    props.activeYearPreset === "prePrevious"
      ? yearBuckets.prePrevious.points
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.points
        : yearBuckets.current.points;
  const comparisonIncomeTrend =
    props.activeYearPreset === "prePrevious"
      ? yearBuckets.prePrevious.comparisonPoints
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.comparisonPoints
        : yearBuckets.current.comparisonPoints;
  const totalIncome = selectedIncomeTrend.reduce((sum, point) => sum + point.income, 0);
  const averageIncome = selectedIncomeTrend.length ? totalIncome / selectedIncomeTrend.length : 0;
  const cumulativeIncomeTrend = buildCumulativeIncomeTrend(selectedIncomeTrend);
  const incomeComparisonStats = summarizeMatchedIncomeComparison(
    selectedIncomeTrend,
    comparisonIncomeTrend
  );
  const selectedPeriodLabel =
    props.activeYearPreset === "prePrevious"
      ? yearBuckets.prePrevious.label
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.label
        : yearBuckets.current.label;
  const selectedYear =
    props.activeYearPreset === "prePrevious"
      ? String(Number(props.anchorMonth.slice(0, 4)) - 2)
      : props.activeYearPreset === "previous"
        ? String(Number(props.anchorMonth.slice(0, 4)) - 1)
        : props.anchorMonth.slice(0, 4);
  const selectedIncomeSource = props.yearlyIncomeSources.find((row) => row.year === selectedYear);

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
        <ReportCard
          delta={formatComparisonDeltaText(
            incomeComparisonStats.currentTotal,
            incomeComparisonStats.comparisonTotal,
            incomeComparisonStats.isPartial
          )}
          label="수입총계"
          tone="app-tone-positive"
          value={formatMoney(totalIncome, props.hideAmounts)}
        />
        <ReportCard
          delta={formatComparisonDeltaText(
            incomeComparisonStats.currentAverage,
            incomeComparisonStats.comparisonAverage,
            incomeComparisonStats.isPartial
          )}
          label="수입평균"
          tone="app-tone-neutral"
          value={formatMoney(Math.round(averageIncome), props.hideAmounts)}
        />
        <ReportCard
          delta={formatYtdInsightText(
            "수입",
            totalIncome,
            incomeComparisonStats.comparisonTotal,
            incomeComparisonStats.matchedCount,
            props.hideAmounts
          )}
          hideValue
          label="수입원"
          tone="app-tone-positive"
          value=""
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="app-card rounded-[2rem] p-6">
          <div className="app-divider space-y-2 pb-5">
            <p className="app-muted text-sm">{selectedPeriodLabel}</p>
            <h3 className="app-heading text-2xl font-semibold">수입 추이</h3>
          </div>
          <div className="mt-6 h-[360px]">
            {props.isLoading ? (
              <EmptyState text="수입 추이를 불러오는 중입니다." />
            ) : selectedIncomeTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={selectedIncomeTrend.map((point, index) => ({
                    label: point.label,
                    income: point.income,
                    cumulativeIncome: cumulativeIncomeTrend[index]?.cumulativeIncome ?? 0
                  }))}
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
                      String(name)
                    ]}
                    labelStyle={{ color: props.chartTheme.tick }}
                  />
                  <Bar
                    barSize={22}
                    dataKey="income"
                    fill={props.chartTheme.incomeBar}
                    fillOpacity={0.72}
                    name="월별 수입"
                    radius={[10, 10, 0, 0]}
                    yAxisId="monthly"
                  />
                  <Line
                    dataKey="cumulativeIncome"
                    dot={{
                      fill: props.chartTheme.incomeDotFill,
                      r: 3,
                      stroke: props.chartTheme.incomeBar,
                      strokeWidth: 2
                    }}
                    name="누적 수입"
                    stroke={props.chartTheme.incomeLine}
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

        <article className="app-card rounded-[2rem] p-6">
          <div className="app-divider space-y-2 pb-5">
            <p className="app-muted text-sm">{selectedPeriodLabel}</p>
            <h3 className="app-heading text-2xl font-semibold">Top 5 수입원</h3>
          </div>
          <div className="mt-6 space-y-3">
            {props.isLoading ? (
              <EmptyState text="수입원 구성을 불러오는 중입니다." />
            ) : selectedIncomeSource?.sources?.length ? (
              selectedIncomeSource.sources.map((source) => (
                <article
                  key={`${selectedIncomeSource.year}-${source.source}`}
                  className="app-card-subtle rounded-2xl px-4 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="app-heading text-base font-medium">{source.source}</p>
                    <p className="app-heading text-right text-base font-semibold">
                      {formatMoney(source.amount, props.hideAmounts)}
                    </p>
                  </div>
                  <p className="app-muted mt-2 text-sm">{formatShare(source.share)}</p>
                  <div className="app-progress-track mt-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="app-progress-fill-income h-full rounded-full"
                      style={{ width: `${Math.min(source.share, 100)}%` }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="표시할 수입원이 없습니다." />
            )}
          </div>
        </article>
      </section>
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
  yearlyExpenseSources: YearlyIncomeSource[];
}) {
  const yearBuckets = splitExpenseTrendByYear(props.monthlyExpenseTrend, props.anchorMonth);
  const selectedExpenseTrend =
    props.activeYearPreset === "prePrevious"
      ? yearBuckets.prePrevious.points
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.points
        : yearBuckets.current.points;
  const comparisonExpenseTrend =
    props.activeYearPreset === "prePrevious"
      ? yearBuckets.prePrevious.comparisonPoints
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.comparisonPoints
        : yearBuckets.current.comparisonPoints;
  const totalExpense = selectedExpenseTrend.reduce((sum, point) => sum + point.expense, 0);
  const averageExpense = selectedExpenseTrend.length ? totalExpense / selectedExpenseTrend.length : 0;
  const cumulativeExpenseTrend = buildYearlyCumulativeExpenseTrend(selectedExpenseTrend);
  const expenseComparisonStats = summarizeMatchedExpenseComparison(
    selectedExpenseTrend,
    comparisonExpenseTrend
  );
  const selectedPeriodLabel =
    props.activeYearPreset === "prePrevious"
      ? yearBuckets.prePrevious.label
      : props.activeYearPreset === "previous"
        ? yearBuckets.previous.label
        : yearBuckets.current.label;
  const selectedYear =
    props.activeYearPreset === "prePrevious"
      ? String(Number(props.anchorMonth.slice(0, 4)) - 2)
      : props.activeYearPreset === "previous"
        ? String(Number(props.anchorMonth.slice(0, 4)) - 1)
        : props.anchorMonth.slice(0, 4);
  const selectedExpenseSource = props.yearlyExpenseSources.find((row) => row.year === selectedYear);

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
        <ReportCard
          delta={formatComparisonDeltaText(
            expenseComparisonStats.currentTotal,
            expenseComparisonStats.comparisonTotal,
            expenseComparisonStats.isPartial
          )}
          label="지출총계"
          tone="app-tone-negative"
          value={formatMoney(totalExpense, props.hideAmounts)}
        />
        <ReportCard
          delta={formatComparisonDeltaText(
            expenseComparisonStats.currentAverage,
            expenseComparisonStats.comparisonAverage,
            expenseComparisonStats.isPartial
          )}
          label="지출평균"
          tone="app-tone-neutral"
          value={formatMoney(Math.round(averageExpense), props.hideAmounts)}
        />
        <ReportCard
          delta={formatYtdInsightText(
            "지출",
            totalExpense,
            expenseComparisonStats.comparisonTotal,
            expenseComparisonStats.matchedCount,
            props.hideAmounts
          )}
          hideValue
          label="지출원"
          tone="app-tone-negative"
          value=""
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="app-card rounded-[2rem] p-6">
          <div className="app-divider space-y-2 pb-5">
            <p className="app-muted text-sm">{selectedPeriodLabel}</p>
            <h3 className="app-heading text-2xl font-semibold">지출 추이</h3>
          </div>
          <div className="mt-6 h-[360px]">
            {props.isLoading ? (
              <EmptyState text="지출 추이를 불러오는 중입니다." />
            ) : selectedExpenseTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={selectedExpenseTrend.map((point, index) => ({
                    label: point.label,
                    expense: point.expense,
                    cumulativeExpense: cumulativeExpenseTrend[index]?.cumulativeExpense ?? 0
                  }))}
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
                      String(name)
                    ]}
                    labelStyle={{ color: props.chartTheme.tick }}
                  />
                  <Bar
                    barSize={22}
                    dataKey="expense"
                    fill={props.chartTheme.expenseBar}
                    fillOpacity={0.72}
                    name="월별 지출"
                    radius={[10, 10, 0, 0]}
                    yAxisId="monthly"
                  />
                  <Line
                    dataKey="cumulativeExpense"
                    dot={{
                      fill: props.chartTheme.expenseDotFill,
                      r: 3,
                      stroke: props.chartTheme.expenseBar,
                      strokeWidth: 2
                    }}
                    name="누적 지출"
                    stroke={props.chartTheme.expenseLine}
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

        <article className="app-card rounded-[2rem] p-6">
          <div className="app-divider space-y-2 pb-5">
            <p className="app-muted text-sm">{selectedPeriodLabel}</p>
            <h3 className="app-heading text-2xl font-semibold">Top 5 지출원</h3>
          </div>
          <div className="mt-6 space-y-3">
            {props.isLoading ? (
              <EmptyState text="지출원 구성을 불러오는 중입니다." />
            ) : selectedExpenseSource?.sources?.length ? (
              selectedExpenseSource.sources.map((source) => (
                <article
                  key={`${selectedExpenseSource.year}-${source.source}`}
                  className="app-card-subtle rounded-2xl px-4 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="app-heading text-base font-medium">{source.source}</p>
                    <p className="app-heading text-right text-base font-semibold">
                      {formatMoney(source.amount, props.hideAmounts)}
                    </p>
                  </div>
                  <p className="app-muted mt-2 text-sm">{formatShare(source.share)}</p>
                  <div className="app-progress-track mt-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="app-progress-fill-expense h-full rounded-full"
                      style={{ width: `${Math.min(source.share, 100)}%` }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="표시할 지출원이 없습니다." />
            )}
          </div>
        </article>
      </section>
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
        strokeColor={props.chartTheme.expenseBar}
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
                  const categoryBarWidth = Math.max(0, Math.min(category.share, 100));
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
                          className="app-progress-fill-expense h-full rounded-full"
                          style={{ width: `${categoryBarWidth}%` }}
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
                          className="app-progress-fill-income h-full rounded-full"
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
                    const itemBarWidth = Math.max(0, Math.min(itemShare, 100));

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
                            className="app-progress-fill-expense h-full rounded-full"
                            style={{ width: `${itemBarWidth}%` }}
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
                  fill={props.chartTheme.annotationFill}
                  ifOverflow="extendDomain"
                  label={{
                    fill: props.chartTheme.annotationLabel,
                    fontSize: 11,
                    position: "top",
                    value: annotation.note
                  }}
                  r={4}
                  stroke={props.chartTheme.annotationStroke}
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
  accent?: React.ReactNode;
  hideValue?: boolean;
  label: string;
  value: string;
  delta: string;
  tone: string;
}) {
  return (
    <article className="app-card flex min-h-[144px] flex-col justify-between rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="app-muted text-sm">{props.label}</p>
        {props.accent}
      </div>
      <div>
        {!props.hideValue ? (
          <p className={`text-3xl font-semibold leading-tight ${props.tone}`}>{props.value}</p>
        ) : null}
        <p className="app-muted-strong mt-2 whitespace-pre-line text-sm leading-5">{props.delta}</p>
      </div>
    </article>
  );
}

function DonutMetric(props: {
  color: string;
  hidden: boolean;
  label: string;
  value?: number;
}) {
  const normalizedValue = typeof props.value === "number"
    ? Math.max(0, Math.min(props.value, 100))
    : 0;
  const data = [
    { name: props.label, value: normalizedValue },
    { name: "rest", value: Math.max(0, 100 - normalizedValue) }
  ];

  return (
    <div className="relative h-16 w-16 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={data}
            dataKey="value"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={0}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={index === 0 ? props.color : "rgba(255,255,255,0.08)"}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="app-heading text-xs font-semibold">
          {props.hidden
            ? "••"
            : typeof props.value === "number"
              ? `${props.value.toFixed(0)}%`
              : "-"}
        </span>
      </div>
    </div>
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
      cumulativeExpense
    };
  });
}

function splitIncomeTrendByYear(points: MonthlyIncomePoint[], anchorMonth: string) {
  const [yearText = "0", monthText = "1"] = anchorMonth.split("-");
  const anchorYear = Number(yearText);
  const anchorMonthNumber = Number(monthText);
  const history = points.slice(-36);
  const startOffset = history.length - 1;
  const prePrevious: MonthlyIncomePoint[] = [];
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

    if (date.getFullYear() === anchorYear - 2) {
      prePrevious.push(normalizedPoint);
      return;
    }

    if (date.getFullYear() === anchorYear - 1) {
      previous.push(normalizedPoint);
    }
  });

  return {
    prePrevious: {
      label: `${anchorYear - 2}년`,
      points: prePrevious,
      comparisonLabel: `${anchorYear - 3}년`,
      comparisonPoints: []
    },
    previous: {
      label: `${anchorYear - 1}년`,
      points: previous,
      comparisonLabel: `${anchorYear - 2}년`,
      comparisonPoints: prePrevious
    },
    current: {
      label: `${anchorYear}년`,
      points: current,
      comparisonLabel: `${anchorYear - 1}년`,
      comparisonPoints: previous
    }
  };
}

function splitExpenseTrendByYear(points: MonthlyTrendPoint[], anchorMonth: string) {
  const [yearText = "0", monthText = "1"] = anchorMonth.split("-");
  const anchorYear = Number(yearText);
  const anchorMonthNumber = Number(monthText);
  const history = points.slice(-36);
  const startOffset = history.length - 1;
  const prePrevious: MonthlyTrendPoint[] = [];
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

    if (date.getFullYear() === anchorYear - 2) {
      prePrevious.push(normalizedPoint);
      return;
    }

    if (date.getFullYear() === anchorYear - 1) {
      previous.push(normalizedPoint);
    }
  });

  return {
    prePrevious: {
      label: `${anchorYear - 2}년`,
      points: prePrevious,
      comparisonLabel: `${anchorYear - 3}년`,
      comparisonPoints: []
    },
    previous: {
      label: `${anchorYear - 1}년`,
      points: previous,
      comparisonLabel: `${anchorYear - 2}년`,
      comparisonPoints: prePrevious
    },
    current: {
      label: `${anchorYear}년`,
      points: current,
      comparisonLabel: `${anchorYear - 1}년`,
      comparisonPoints: previous
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

function summarizeMatchedIncomeComparison(
  currentPoints: MonthlyIncomePoint[],
  comparisonPoints: MonthlyIncomePoint[]
) {
  let currentTotal = 0;
  let comparisonTotal = 0;
  let matchedCount = 0;

  for (const [index, point] of currentPoints.entries()) {
    const comparisonValue = comparisonPoints[index]?.income;
    if (typeof comparisonValue !== "number") {
      continue;
    }
    currentTotal += point.income;
    comparisonTotal += comparisonValue;
    matchedCount += 1;
  }

  return {
    currentTotal,
    comparisonTotal,
    currentAverage: matchedCount ? currentTotal / matchedCount : 0,
    comparisonAverage: matchedCount ? comparisonTotal / matchedCount : 0,
    matchedCount,
    isPartial: matchedCount > 0 && matchedCount < currentPoints.length
  };
}

function summarizeMatchedExpenseComparison(
  currentPoints: MonthlyTrendPoint[],
  comparisonPoints: MonthlyTrendPoint[]
) {
  let currentTotal = 0;
  let comparisonTotal = 0;
  let matchedCount = 0;

  for (const [index, point] of currentPoints.entries()) {
    const comparisonValue = comparisonPoints[index]?.expense;
    if (typeof comparisonValue !== "number") {
      continue;
    }
    currentTotal += point.expense;
    comparisonTotal += comparisonValue;
    matchedCount += 1;
  }

  return {
    currentTotal,
    comparisonTotal,
    currentAverage: matchedCount ? currentTotal / matchedCount : 0,
    comparisonAverage: matchedCount ? comparisonTotal / matchedCount : 0,
    matchedCount,
    isPartial: matchedCount > 0 && matchedCount < currentPoints.length
  };
}

function formatYtdInsightText(
  metricLabel: "수입" | "지출",
  currentTotal: number,
  previousTotal: number,
  matchedCount: number,
  hidden: boolean
) {
  const monthLabel = matchedCount > 0 ? `${matchedCount}개월` : "동일 기간";
  return `YTD 누적 ${metricLabel} ${formatMoney(currentTotal, hidden)}
전년 동기(${monthLabel}) ${formatMoney(previousTotal, hidden)}`;
}

function formatComparisonDeltaText(current?: number, previous?: number, isPartial = false) {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) {
    return "전년대비 -";
  }

  const deltaRate = ((current - previous) / previous) * 100;
  const suffix = isPartial ? "전년동기대비" : "전년대비";
  if (deltaRate === 0) {
    return `${suffix} 0.0%`;
  }

  const sign = deltaRate > 0 ? "+" : "";
  return `${sign}${deltaRate.toFixed(1)}% ${suffix}`;
}

function formatSourceConcentrationText(topSource?: string) {
  if (!topSource) {
    return "상위 수입원 -";
  }

  return `상위 수입원 ${topSource}`;
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
      tooltipText: "#0f172a",
      incomeBar: "#10b981",
      incomeLine: "#059669",
      incomeDotFill: "#ecfdf5",
      expenseBar: "#ea580c",
      expenseLine: "#c2410c",
      expenseDotFill: "#fff7ed",
      annotationFill: "#f97316",
      annotationLabel: "#9a3412",
      annotationStroke: "#ffedd5"
    };
  }

  return {
    cursorFill: "rgba(255,255,255,0.04)",
    cursorStroke: "rgba(255,255,255,0.12)",
    grid: "rgba(255,255,255,0.07)",
    tick: "#78716c",
    tooltipBackground: "#1c1917",
    tooltipBorder: "rgba(255,255,255,0.1)",
    tooltipText: "#fafaf9",
    incomeBar: "#34d399",
    incomeLine: "#86efac",
    incomeDotFill: "#dcfce7",
    expenseBar: "#f97316",
    expenseLine: "#fb923c",
    expenseDotFill: "#ffedd5",
    annotationFill: "#fb923c",
    annotationLabel: "#fdba74",
    annotationStroke: "#fff7ed"
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
