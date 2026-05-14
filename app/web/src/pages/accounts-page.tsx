import { useQuery } from "@tanstack/react-query";

import { fetchAccounts, fetchTransactions, type AccountOption, type TransactionRow } from "../lib/api";

interface AccountsPageProps {
  onOpenTransactions: (accountId: string) => void;
}

const currentDate = new Date();
const monthStartDate = `${currentDate.getFullYear()}-${String(
  currentDate.getMonth() + 1
).padStart(2, "0")}-01`;
const monthEndDate = `${currentDate.getFullYear()}-${String(
  currentDate.getMonth() + 1
).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

export function AccountsPage({ onOpenTransactions }: AccountsPageProps) {
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });
  const transactionsQuery = useQuery({
    queryKey: ["account-activity", monthStartDate, monthEndDate],
    queryFn: () =>
      fetchTransactions({
        endDate: toCompactDate(monthEndDate),
        limit: 100,
        startDate: toCompactDate(monthStartDate)
      })
  });

  const accounts = accountsQuery.data?.rows ?? [];
  const recentActivityByAccount = createRecentActivityMap(transactionsQuery.data?.rows ?? []);
  const groupedAccounts = groupAccounts(accounts.filter((account) => !hasClosedDate(account.closeDate)));

  return (
    <section className="flex flex-col gap-6">
      {accountsQuery.isError || transactionsQuery.isError ? (
        <section className="app-error rounded-3xl p-5 text-sm leading-6">
          계정 화면 데이터를 읽는 중 오류가 발생했습니다.
        </section>
      ) : null}

      {accountsQuery.isLoading ? (
        <section className="app-card app-muted rounded-3xl p-10 text-center text-sm">
          계정 목록을 불러오는 중입니다.
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {groupedAccounts.map((group) => (
            <section
              key={group.group}
              className="app-card rounded-3xl p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="app-muted text-sm">{group.label}</p>
                  <h3 className="app-heading mt-1 text-xl font-semibold">
                    {group.accounts.length}개 계정
                  </h3>
                </div>
                <p className="app-muted text-sm">총 {accounts.length}개</p>
              </div>

              <div className="mt-5 space-y-3">
                {group.accounts.map((account) => {
                  const activity = recentActivityByAccount[account.accountId];

                  return (
                    <button
                      key={account.accountId}
                      className="app-card-subtle app-focus-ring flex w-full flex-col gap-4 rounded-2xl p-4 text-left transition md:flex-row md:items-center md:justify-between"
                      onClick={() => onOpenTransactions(account.accountId)}
                      type="button"
                    >
                      <div className="space-y-1">
                        <p className="app-heading font-medium">{account.title}</p>
                        <p className="app-muted text-sm">
                          {formatAccountMeta(account, activity)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function createRecentActivityMap(rows: TransactionRow[]) {
  const map: Record<string, TransactionRow> = {};

  for (const row of rows) {
    if (row.lAccountId && !map[row.lAccountId]) {
      map[row.lAccountId] = row;
    }
    if (row.rAccountId && !map[row.rAccountId]) {
      map[row.rAccountId] = row;
    }
  }

  return map;
}

function groupAccounts(accounts: AccountOption[]) {
  const orderedGroups: Array<{ group: string; label: string }> = [
    { group: "assets", label: "자산" },
    { group: "liabilities", label: "부채" },
    { group: "expenses", label: "지출" },
    { group: "income", label: "수입" }
  ];

  return orderedGroups
    .map((group) => ({
      ...group,
      accounts: accounts.filter((account) => account.group === group.group)
    }))
    .filter((group) => group.accounts.length > 0);
}

function formatEntryDate(value: string) {
  const [date] = value.split(".");
  if (date.length !== 8) {
    return value;
  }

  return `${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}`;
}

function toCompactDate(value: string) {
  return value.split("-").join("");
}

function formatAccountMeta(account: AccountOption, activity?: TransactionRow) {
  if (activity) {
    return `${formatEntryDate(activity.entryDate)} · ${activity.item || "항목 없음"}`;
  }

  return "이번 달 활동 없음";
}

function hasClosedDate(value?: string) {
  if (!value) {
    return false;
  }

  return value.length === 8 && value !== "29991231";
}
