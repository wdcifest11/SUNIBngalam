"use client";

import type { StreakMonthData } from "./use-streak-month";

type StreakMonthProps = {
  data: StreakMonthData;
  className?: string;
  ariaLabel?: string;
};

export default function StreakMonth({ data, className, ariaLabel }: StreakMonthProps) {
  const label = ariaLabel || `Streak shower for ${data.label}`;

  return (
    <div className={`streakMonth ${className || ""}`} aria-label={label}>
      <div className="streakMonthGrid" aria-hidden="true">
        {data.cells.map((c) => {
          const title = c.inMonth ? `${c.dayKey}: ${c.done} done / ${c.due} due` : "";
          const pad = c.inMonth ? "" : " streakCalCell--pad";
          return <span key={c.dayKey} className={`streakCalCell streakCalCell--${c.level}${pad}`} title={title} />;
        })}
      </div>
    </div>
  );
}

