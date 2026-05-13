import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { OverviewTrendChart } from "../components/overview-trend-chart";
import { fetchOverview, fetchOverviewTrend, type OverviewTrendRange } from "../lib/api";

export function OverviewPage() {
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
        <section className="rounded-3xl border border-amber-400/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-100">
          `WHOOING_API_KEY`가 설정되지 않았습니다. 현재 화면은 스캐폴드
          상태이며, `.env`에 키를 넣으면 후잉 기본 섹션과 이번 달 요약을 바로
          읽어옵니다.
        </section>
      ) : null}

      {overviewQuery.isError ? (
        <section className="rounded-3xl border border-rose-400/20 bg-rose-300/10 p-5 text-sm leading-6 text-rose-100">
          후잉 데이터를 읽는 중 오류가 발생했습니다.
        </section>
      ) : null}

      <OverviewTrendChart
        activeRange={activeRange}
        data={trendQuery.data}
        isLoading={trendQuery.isLoading}
        onChangeRange={setActiveRange}
      />
    </>
  );
}
