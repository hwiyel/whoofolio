import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { ThemeMode } from "../app/App";
import { OverviewTrendChart } from "../components/overview-trend-chart";
import { fetchOverview, fetchOverviewTrend, type OverviewTrendRange } from "../lib/api";

interface OverviewPageProps {
  hideAmounts: boolean;
  theme: ThemeMode;
}

export function OverviewPage({ hideAmounts, theme }: OverviewPageProps) {
  const [activeRange, setActiveRange] = useState<OverviewTrendRange>("1Y");
  const overviewQuery = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview
  });
  const trendQuery = useQuery({
    queryKey: ["overview-trend", activeRange],
    queryFn: () => fetchOverviewTrend(activeRange)
  });

  const data = overviewQuery.data;

  return (
    <>
      {!data?.isConfigured ? (
        <section className="app-warning rounded-3xl p-5 text-sm leading-6">
          `WHOOING_API_KEY`가 설정되지 않았습니다. 현재 화면은 스캐폴드
          상태이며, `.env`에 키를 넣으면 후잉 기본 섹션과 이번 달 요약을 바로
          읽어옵니다.
        </section>
      ) : null}

      {overviewQuery.isError ? (
        <section className="app-error rounded-3xl p-5 text-sm leading-6">
          후잉 데이터를 읽는 중 오류가 발생했습니다.
        </section>
      ) : null}

      <OverviewTrendChart
        activeRange={activeRange}
        data={trendQuery.data}
        hideAmounts={hideAmounts}
        isLoading={trendQuery.isLoading}
        onChangeRange={setActiveRange}
        theme={theme}
      />
    </>
  );
}
