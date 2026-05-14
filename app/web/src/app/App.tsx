import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppShell, type AppView } from "../components/app-shell";
import { OverviewPage } from "../pages/overview-page";
import { ReportsPage, type ReportMode } from "../pages/reports-page";
import { TransactionsPage } from "../pages/transactions-page";

const queryClient = new QueryClient();
export type ThemeMode = "dark" | "light";

export function App() {
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showIntroOverlay, setShowIntroOverlay] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("whoofolio-intro-dismissed") !== "true";
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const savedTheme = window.localStorage.getItem("whoofolio-theme");
    return savedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    window.localStorage.setItem("whoofolio-theme", theme);
  }, [theme]);

  function dismissIntroOverlay() {
    window.localStorage.setItem("whoofolio-intro-dismissed", "true");
    setShowIntroOverlay(false);
  }

  function renderActiveView() {
    if (activeView === "overview") {
      return <OverviewPage hideAmounts={hideAmounts} theme={theme} />;
    }

    if (activeView === "transactions") {
      return <TransactionsPage />;
    }

    const modeByView: Record<Exclude<AppView, "overview" | "transactions">, ReportMode> = {
      "report-monthly": "monthly",
      "report-income": "income",
      "report-expense": "spending"
    };

    return <ReportsPage hideAmounts={hideAmounts} initialMode={modeByView[activeView]} theme={theme} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-theme min-h-screen" data-theme={theme}>
        <AppShell
          activeView={activeView}
          hideAmounts={hideAmounts}
          onChangeView={setActiveView}
          onChangeTheme={setTheme}
          onToggleHideAmounts={() => setHideAmounts((current) => !current)}
          theme={theme}
        >
          {renderActiveView()}
        </AppShell>
        {showIntroOverlay ? (
          <IntroOverlay onStart={dismissIntroOverlay} />
        ) : null}
      </div>
    </QueryClientProvider>
  );
}

function IntroOverlay(props: { onStart: () => void }) {
  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center px-6 py-10">
      <div className="app-overlay-card w-full max-w-2xl rounded-[2rem] p-8 md:p-10">
        <div className="space-y-4">
          <p className="app-muted text-sm uppercase tracking-[0.28em]">Whoofolio</p>
          <h1 className="app-heading text-4xl font-semibold tracking-tight md:text-5xl">
            가계 흐름을
            <br />
            한 화면에서
          </h1>
          <p className="app-muted-strong max-w-xl text-base leading-7 md:text-lg">
            후잉 데이터를 바탕으로 수입, 지출, 순자산 흐름을 한눈에 정리하고
            월간 분석까지 바로 이어서 볼 수 있습니다.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            className="app-hero-button rounded-full px-6 py-3 text-sm font-medium transition"
            onClick={props.onStart}
            type="button"
          >
            시작하기
          </button>
          <p className="app-muted text-sm">첫 방문에만 표시됩니다.</p>
        </div>
      </div>
    </div>
  );
}
