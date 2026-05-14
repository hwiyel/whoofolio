import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ThemeMode } from "../app/App";

export type AppView =
  | "overview"
  | "report-monthly"
  | "report-income"
  | "report-expense"
  | "transactions";

interface AppShellProps {
  activeView: AppView;
  children: ReactNode;
  hideAmounts: boolean;
  onChangeView: (view: AppView) => void;
  onChangeTheme: (theme: ThemeMode) => void;
  onToggleHideAmounts: () => void;
  theme: ThemeMode;
}

const navigationItems: Array<{ id: AppView; label: string }> = [
  { id: "overview", label: "대시보드" },
  { id: "report-monthly", label: "월간분석" },
  { id: "report-income", label: "수입분석" },
  { id: "report-expense", label: "지출분석" },
  { id: "transactions", label: "거래내역" }
];

export function AppShell({
  activeView,
  children,
  hideAmounts,
  onChangeView,
  onChangeTheme,
  onToggleHideAmounts,
  theme
}: AppShellProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }

    if (!isSettingsOpen) {
      return;
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isSettingsOpen]);

  return (
    <main className="flex min-h-screen flex-col gap-10 py-8">
      <header className="app-header flex flex-col gap-6 pb-8">
        <div className="mx-auto flex w-full max-w-[1600px] items-start justify-between gap-4 px-6 md:px-10 2xl:max-w-[1760px]">
          <nav className="flex flex-wrap gap-3">
          {navigationItems.map((item) => {
            const isActive = item.id === activeView;

            return (
              <button
                key={item.id}
                className={`app-nav-button cursor-pointer rounded-full px-4 py-2 text-sm transition ${
                  isActive
                    ? "app-nav-button-active"
                    : ""
                }`}
                onClick={() => onChangeView(item.id)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              aria-label={hideAmounts ? "금액 보기" : "금액 숨기기"}
              className="app-icon-button inline-flex items-center rounded-full p-2 transition"
              onClick={onToggleHideAmounts}
              type="button"
            >
              <VisibilityIcon crossed={hideAmounts} />
            </button>
            <div className="relative" ref={settingsRef}>
              <button
                aria-expanded={isSettingsOpen}
                aria-label="설정"
                className="app-icon-button inline-flex items-center rounded-full p-2 transition"
                onClick={() => setIsSettingsOpen((current) => !current)}
                type="button"
              >
                <SettingsIcon />
              </button>
              {isSettingsOpen ? (
                <div className="app-settings-panel absolute right-0 top-12 z-20 w-44 rounded-2xl p-3">
                  <p className="app-muted mb-2 text-xs">색상 모드</p>
                  <div className="flex gap-2">
                    <button
                      className={`app-nav-button flex-1 rounded-xl px-3 py-2 text-sm transition ${
                        theme === "dark" ? "app-nav-button-active" : ""
                      }`}
                      onClick={() => onChangeTheme("dark")}
                      type="button"
                    >
                      다크
                    </button>
                    <button
                      className={`app-nav-button flex-1 rounded-xl px-3 py-2 text-sm transition ${
                        theme === "light" ? "app-nav-button-active" : ""
                      }`}
                      onClick={() => onChangeTheme("light")}
                      type="button"
                    >
                      라이트
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div
        className={
          activeView === "overview"
            ? "w-full"
            : "mx-auto w-full max-w-[1600px] px-6 md:px-10 2xl:max-w-[1760px]"
        }
      >
        {children}
      </div>
    </main>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0l.182.792a1.724 1.724 0 0 0 2.573 1.066l.701-.41a1.724 1.724 0 0 1 2.29.632 1.724 1.724 0 0 1-.632 2.29l-.7.41a1.724 1.724 0 0 0 0 2.974l.7.41a1.724 1.724 0 0 1 .632 2.29 1.724 1.724 0 0 1-2.29.632l-.7-.41a1.724 1.724 0 0 0-2.573 1.066l-.182.792a1.724 1.724 0 0 1-3.35 0l-.182-.792a1.724 1.724 0 0 0-2.573-1.066l-.701.41a1.724 1.724 0 0 1-2.29-.632 1.724 1.724 0 0 1 .632-2.29l.7-.41a1.724 1.724 0 0 0 0-2.974l-.7-.41a1.724 1.724 0 0 1-.632-2.29 1.724 1.724 0 0 1 2.29-.632l.7.41a1.724 1.724 0 0 0 2.573-1.066l.182-.792Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function VisibilityIcon(props: { crossed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {props.crossed ? (
        <path
          d="M4 20 20 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
}
