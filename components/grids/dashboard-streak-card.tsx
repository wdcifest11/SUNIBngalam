"use client";

import CardChrome from "./grid-parts/card-chrome";
import { useStreakData } from "../streak/use-streak-data";
import StreakMonth from "../streak/streak-month";
import { useStreakMonthData } from "../streak/use-streak-month";

export default function DashboardStreakCard() {
  const year = useStreakData(365);
  const month = useStreakMonthData();

  return (
    <div className="dashStreakCard" aria-label="Streak info">
      <StreakMonth data={month} className="streakMonth--dash" ariaLabel={`Streak shower for ${month.label}`} />
      <CardChrome
        kicker={`${month.totalDone.toLocaleString()} done this month`}
        title={`${Math.max(0, year.streakCurrent)} days`}
        meta={`Best ${Math.max(0, year.streakBest)} | Freeze 1`}
      />
    </div>
  );
}
