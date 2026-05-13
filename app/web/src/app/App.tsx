import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppShell, type AppView } from "../components/app-shell";
import { AccountsPage } from "../pages/accounts-page";
import { OverviewPage } from "../pages/overview-page";
import { ReportsPage } from "../pages/reports-page";
import { TransactionsPage } from "../pages/transactions-page";

const queryClient = new QueryClient();

export function App() {
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [transactionFocus, setTransactionFocus] = useState({
    accountId: "",
    nonce: 0
  });

  function handleOpenTransactions(accountId: string) {
    setTransactionFocus((current) => ({
      accountId,
      nonce: current.nonce + 1
    }));
    setActiveView("transactions");
  }

  function renderActiveView() {
    if (activeView === "overview") {
      return <OverviewPage />;
    }

    if (activeView === "accounts") {
      return <AccountsPage onOpenTransactions={handleOpenTransactions} />;
    }

    if (activeView === "reports") {
      return <ReportsPage />;
    }

    return <TransactionsPage focusAccount={transactionFocus} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <AppShell activeView={activeView} onChangeView={setActiveView}>
          {renderActiveView()}
        </AppShell>
      </div>
    </QueryClientProvider>
  );
}
