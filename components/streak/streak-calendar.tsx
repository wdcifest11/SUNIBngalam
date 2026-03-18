"use client";

import type { StreakData } from "./use-streak-data";

type StreakCalendarProps = {
  data: StreakData;
  className?: string;
  ariaLabel?: string;
};

export default function StreakCalendar({ data, className, ariaLabel }: StreakCalendarProps) {
  const monthsStyle = { gridTemplateColumns: `repeat(${Math.max(1, data.weeks)}, var(--streak-cell))` } as const;
  const gridStyle = { gridTemplateRows: "repeat(7, var(--streak-cell))" } as const;
  const label = ariaLabel || `${data.totalDone} contributions in the last year`;

  return (
    <div className={`streakCal ${className || ""}`} aria-label={label}>
      <div className="streakCalMain">
        <div className="streakCalDows" aria-hidden="true">
          <span style={{ gridRowStart: 1 }}>Mon</span>
          <span style={{ gridRowStart: 3 }}>Wed</span>
          <span style={{ gridRowStart: 5 }}>Fri</span>
        </div>

        <div className="streakCalScroll" role="group" aria-label="Streak calendar">
          <div className="streakCalMonths" style={monthsStyle} aria-hidden="true">
            {data.monthLabels.map((m) => (
              <span key={`${m.col}:${m.label}`} className="streakCalMonth" style={{ gridColumnStart: m.col + 1 }}>
                {m.label}
              </span>
            ))}
          </div>

          <div className="streakCalGrid" style={gridStyle} aria-hidden="true">
            {data.days.map((d) => {
              const title = d.inRange ? `${d.dayKey}: ${d.done} done / ${d.due} due` : "";
              const pad = d.inRange ? "" : " streakCalCell--pad";
              return <span key={d.dayKey + (d.inRange ? "" : ":pad")} className={`streakCalCell streakCalCell--${d.level}${pad}`} title={title} />;
            })}
          </div>
        </div>
      </div>

      <div className="streakCalLegend" aria-hidden="true">
        <span>Less</span>
        <div className="streakCalLegendSwatches" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span key={lvl} className={`streakCalCell streakCalCell--${lvl}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

