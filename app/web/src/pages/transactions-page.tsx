import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { fetchAccounts, fetchTransactions } from "../lib/api";

const currentDate = new Date();
const defaultStartDate = `${currentDate.getFullYear()}-${String(
  currentDate.getMonth() + 1
).padStart(2, "0")}-01`;
const defaultEndDate = `${currentDate.getFullYear()}-${String(
  currentDate.getMonth() + 1
).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

interface TransactionsPageProps {
  focusAccount?: {
    accountId: string;
    nonce: number;
  };
}

type FiltersState = {
  accountId: string;
  endDate: string;
  keyword: string;
  startDate: string;
};

const defaultFilters = {
  accountId: "",
  endDate: defaultEndDate,
  keyword: "",
  startDate: defaultStartDate
};

const datePresets = [
  { id: "1m", label: "1M", range: { startDate: defaultStartDate, endDate: defaultEndDate } },
  { id: "3m", label: "3M", range: getRecentMonthsRange(3) },
  { id: "6m", label: "6M", range: getRecentMonthsRange(6) },
  { id: "1y", label: "1Y", range: getRecentMonthsRange(12) }
] as const;

export function TransactionsPage({ focusAccount }: TransactionsPageProps) {
  const [filters, setFilters] = useState({
    ...defaultFilters
  });

  useEffect(() => {
    if (!focusAccount?.accountId) {
      return;
    }

    setFilters((current) => ({
      ...current,
      accountId: focusAccount.accountId
    }));
  }, [focusAccount]);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () =>
      fetchTransactions({
        accountId: filters.accountId || undefined,
        endDate: toCompactDate(filters.endDate),
        keyword: filters.keyword || undefined,
        limit: 100,
        startDate: toCompactDate(filters.startDate)
      })
  });

  const accountOptions = accountsQuery.data?.rows ?? [];
  const rows = transactionsQuery.data?.rows ?? [];
  const activePreset = findActivePreset(filters);

  return (
    <section className="flex flex-col gap-6">
      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap gap-2">
          {datePresets.map((preset) => {
            const isActive = activePreset?.id === preset.id;

            return (
              <button
                key={preset.id}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-stone-300 hover:border-white/20 hover:bg-white/10"
                }`}
                onClick={() => {
                  setFilters((current) => ({
                    ...current,
                    ...preset.range
                  }));
                }}
                type="button"
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,0.85fr))_minmax(0,1.2fr)]">
        <label className="space-y-2">
          <span className="text-sm text-stone-400">시작일</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                startDate: event.target.value
              }));
            }}
            type="date"
            value={filters.startDate}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-stone-400">종료일</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                endDate: event.target.value
              }));
            }}
            type="date"
            value={filters.endDate}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-stone-400">계정</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                accountId: event.target.value
              }));
            }}
            value={filters.accountId}
          >
            <option value="">전체</option>
            {accountOptions.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                [{formatAccountGroup(account.group)}] {account.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm text-stone-400">키워드</span>
          <div className="relative">
            <input
              className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 pr-12 text-sm text-white outline-none transition focus:border-emerald-400/40"
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  keyword: event.target.value
                }));
              }}
              placeholder="항목명 / 메모 검색"
              type="text"
              value={filters.keyword}
            />
            {filters.keyword ? (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-stone-400 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setFilters((current) => ({
                    ...current,
                    keyword: ""
                  }));
                }}
                type="button"
              >
                지우기
              </button>
            ) : null}
          </div>
        </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-sm text-stone-400">
            기본값은 이번 달 전체 거래입니다. 계정 이동은 `출발 계정 → 도착 계정` 순서로 보여줍니다.
          </p>
          <button
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
            onClick={() => {
              setFilters({ ...defaultFilters });
            }}
            type="button"
          >
            필터 초기화
          </button>
        </div>
      </section>

      {transactionsQuery.isError ? (
        <section className="rounded-3xl border border-rose-400/20 bg-rose-300/10 p-5 text-sm leading-6 text-rose-100">
          거래 데이터를 읽는 중 오류가 발생했습니다.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.18em] text-stone-500">
              <tr>
                <th className="px-5 py-4 font-medium">일자</th>
                <th className="px-5 py-4 font-medium">항목</th>
                <th className="px-5 py-4 font-medium">계정 이동</th>
                <th className="px-5 py-4 font-medium text-right">금액</th>
                <th className="px-5 py-4 font-medium text-right">잔액</th>
              </tr>
            </thead>
            <tbody>
              {transactionsQuery.isLoading ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-sm text-stone-400"
                    colSpan={5}
                  >
                    거래 데이터를 불러오는 중입니다.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-sm text-stone-400"
                    colSpan={5}
                  >
                    표시할 거래가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.entryId}
                    className="border-t border-white/6 text-sm text-stone-200"
                  >
                    <td className="px-5 py-4 align-top text-stone-400">
                      {formatEntryDate(row.entryDate)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-white">{row.item || "-"}</p>
                        <p className="min-h-4 text-xs text-stone-500">{row.memo}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-white">{formatAccountFlow(row)}</p>
                    </td>
                    <td className="px-5 py-4 text-right align-top font-medium text-white">
                      {formatMoney(row.money)}
                    </td>
                    <td className="px-5 py-4 text-right align-top text-stone-300">
                      {formatMoney(row.runningTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function formatEntryDate(value: string) {
  const [date] = value.split(".");
  if (date.length !== 8) {
    return value;
  }

  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`;
}

function formatMoney(value: number) {
  return (
    new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0
    }).format(value) + "원"
  );
}

function toCompactDate(value: string) {
  return value.split("-").join("");
}

function formatAccountGroup(value: string) {
  switch (value) {
    case "assets":
      return "자산";
    case "liabilities":
      return "부채";
    case "capital":
      return "자본";
    case "expenses":
      return "비용";
    case "income":
      return "수익";
    default:
      return value;
  }
}

function findActivePreset(filters: FiltersState) {
  return datePresets.find(
    (preset) =>
      preset.range.startDate === filters.startDate &&
      preset.range.endDate === filters.endDate
  );
}

function formatAccountFlow(row: { lAccountTitle: string; rAccountTitle: string }) {
  return `${row.rAccountTitle} → ${row.lAccountTitle}`;
}

function getRecentMonthsRange(months: number) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);

  return {
    endDate: formatDateInput(today),
    startDate: formatDateInput(startDate)
  };
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
}
