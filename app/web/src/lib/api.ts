export interface OverviewSnapshot {
  income: number;
  expense: number;
  netCashflow: number;
  accountCount: number;
  periodLabel: string;
  sectionId: string;
  sectionTitle: string;
  currency: string;
  totalAssets: number;
  totalLiabilities: number;
  isConfigured: boolean;
}

export interface TransactionsResponse {
  sectionId: string;
  startDate: string;
  endDate: string;
  count: number;
  rows: TransactionRow[];
}

export interface TransactionRow {
  entryId: number;
  entryDate: string;
  lAccount: string;
  lAccountId: string;
  lAccountTitle: string;
  rAccount: string;
  rAccountId: string;
  rAccountTitle: string;
  item: string;
  money: number;
  runningTotal: number;
  memo: string;
}

export interface TransactionsParams {
  accountId?: string;
  endDate?: string;
  keyword?: string;
  limit?: number;
  startDate?: string;
}

export interface AccountsResponse {
  sectionId: string;
  rows: AccountOption[];
}

export interface AccountOption {
  accountId: string;
  title: string;
  type: string;
  group: string;
  closeDate: string;
}

export interface OverviewTrendResponse {
  sectionId: string;
  range: OverviewTrendRange;
  rowsType: string;
  currentValue: number;
  changeValue: number;
  points: OverviewTrendPoint[];
}

export interface OverviewTrendPoint {
  label: string;
  assets: number;
  liabilities: number;
  capital: number;
}

export interface MonthlyReportResponse {
  sectionId: string;
  sectionTitle: string;
  month: string;
  currency: string;
  income: number;
  expense: number;
  netCashflow: number;
  prevIncome: number;
  prevExpense: number;
  prevNetCashflow: number;
  incomeDelta: number;
  expenseDelta: number;
  netCashflowDelta: number;
  dailyCashflowTrend: DailyCashflowPoint[];
  monthlyExpenseTrend: MonthlyTrendPoint[];
  monthlyIncomeTrend: MonthlyIncomePoint[];
  expenseCategories: ExpenseCategoryRow[];
  incomeCategories: ExpenseCategoryRow[];
}

export interface DailyCashflowPoint {
  label: string;
  expense: number;
  income: number;
}

export interface MonthlyTrendPoint {
  label: string;
  expense: number;
}

export interface MonthlyIncomePoint {
  label: string;
  income: number;
}

export interface ExpenseCategoryRow {
  category: string;
  amount: number;
  share: number;
  items: MonthlyExpenseItem[];
}

export interface MonthlyExpenseItem {
  item: string;
  amount: number;
}

export type OverviewTrendRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y";

export async function fetchOverview(): Promise<OverviewSnapshot> {
  const response = await fetch("/api/overview");
  if (!response.ok) {
    throw new Error("개요 데이터를 불러오지 못했습니다.");
  }

  return response.json() as Promise<OverviewSnapshot>;
}

export async function fetchTransactions(
  params: TransactionsParams = {}
): Promise<TransactionsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 50));

  if (params.accountId) {
    searchParams.set("accountId", params.accountId);
  }
  if (params.keyword) {
    searchParams.set("keyword", params.keyword);
  }
  if (params.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endDate", params.endDate);
  }

  const response = await fetch(`/api/transactions?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("거래 데이터를 불러오지 못했습니다.");
  }

  return response.json() as Promise<TransactionsResponse>;
}

export async function fetchAccounts(): Promise<AccountsResponse> {
  const response = await fetch("/api/accounts");
  if (!response.ok) {
    throw new Error("계정 목록을 불러오지 못했습니다.");
  }

  return response.json() as Promise<AccountsResponse>;
}

export async function fetchOverviewTrend(
  range: OverviewTrendRange
): Promise<OverviewTrendResponse> {
  const response = await fetch(`/api/overview/trend?range=${range}`);
  if (!response.ok) {
    throw new Error("차트 데이터를 불러오지 못했습니다.");
  }

  return response.json() as Promise<OverviewTrendResponse>;
}

export async function fetchMonthlyReport(month?: string): Promise<MonthlyReportResponse> {
  const searchParams = new URLSearchParams();
  if (month) {
    searchParams.set("month", month);
  }

  const response = await fetch(`/api/reports/monthly?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("월간 리포트를 불러오지 못했습니다.");
  }

  return response.json() as Promise<MonthlyReportResponse>;
}
