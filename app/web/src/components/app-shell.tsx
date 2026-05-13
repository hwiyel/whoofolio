import type { ReactNode } from "react";

export type AppView = "overview" | "transactions" | "accounts" | "reports";

interface AppShellProps {
  activeView: AppView;
  children: ReactNode;
  onChangeView: (view: AppView) => void;
}

const navigationItems: Array<{ id: AppView; label: string }> = [
  { id: "overview", label: "개요" },
  { id: "transactions", label: "거래" },
  { id: "reports", label: "분석" },
  { id: "accounts", label: "계정" }
];

export function AppShell({
  activeView,
  children,
  onChangeView
}: AppShellProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-10 px-6 py-8 md:px-10 2xl:max-w-[1760px]">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
              whoofolio
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              후잉 뷰어
            </h1>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            v0.1.0 scaffold
          </div>
        </div>

        <nav className="flex flex-wrap gap-3">
          {navigationItems.map((item) => {
            const isActive = item.id === activeView;

            return (
              <button
                key={item.id}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-stone-300 hover:border-white/20 hover:bg-white/10"
                }`}
                onClick={() => onChangeView(item.id)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {children}
    </main>
  );
}
