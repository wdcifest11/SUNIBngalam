"use client";

import { useStreakData } from "../streak/use-streak-data";
import StreakMonth from "../streak/streak-month";
import { useStreakMonthData } from "../streak/use-streak-month";

export default function QSStreakPane() {
  const year = useStreakData(365);
  const month = useStreakMonthData();

  return (
    <div className="qsStreakPane" aria-label="Streak summary">
      <div className="qsStreakHead">
        <div className="qsStreakTitle">Streak shower • {month.label}</div>
        <div className="qsStreakSub">
          Done {month.totalDone.toLocaleString()} • Current {Math.max(0, year.streakCurrent)} days • Best {Math.max(0, year.streakBest)}
        </div>
      </div>

      <StreakMonth data={month} className="streakMonth--qs" />
    </div>
  );
}

