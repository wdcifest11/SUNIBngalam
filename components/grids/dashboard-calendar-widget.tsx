"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import cal from "./schedules-grid.module.css";
import styles from "./dashboard-calendar-widget.module.css";
import type { PlannerEvent } from "./planner-storage";
import { loadEvents, onPlannerUpdated } from "./planner-storage";

function dateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventDayKey(e: PlannerEvent) {
  const d = new Date(e.startAt);
  if (Number.isNaN(d.getTime())) return "";
  return dateKey(d);
}

function scrollNearest(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    // ignore
  }
}

export default function DashboardCalendarWidget() {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => dateKey(new Date()));

  useEffect(() => {
    const sync = () => setEvents(loadEvents());
    sync();
    return onPlannerUpdated(sync);
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const k = eventDayKey(e);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const monthDays = useMemo(() => {
    const first = startOfMonth(month);
    const startDow = (first.getDay() + 6) % 7; // Monday=0
    const gridStart = addDays(first, -startDow);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [month]);

  return (
    <div className={styles.root} aria-label="Calendar widget">
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            <div className={`${cal.cardTitle} ${styles.monthTitle}`}>{formatMonth(month)}</div>
          </div>

          <div className={styles.controls}>
          <div className={styles.monthBtns}>
            <button
              className={`${cal.iconBtn} ${styles.iconBtnSmall}`}
              type="button"
              onClick={() => setMonth((m) => startOfMonth(addDays(m, -1)))}
              aria-label="Previous month"
              data-focus="dashboard.widget.prevMonth"
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button
              className={`${cal.iconBtn} ${styles.iconBtnSmall}`}
              type="button"
              onClick={() => {
                const now = new Date();
                setMonth(startOfMonth(now));
                setSelected(dateKey(now));
              }}
              aria-label="Today"
              title="Today"
              data-focus="dashboard.widget.today"
            >
              <i className="fa-solid fa-calendar-day" aria-hidden="true"></i>
            </button>
            <button
              className={`${cal.iconBtn} ${styles.iconBtnSmall}`}
              type="button"
              onClick={() => setMonth((m) => startOfMonth(addDays(m, 32)))}
              aria-label="Next month"
              data-focus="dashboard.widget.nextMonth"
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <Link
            href="/schedules"
            className={`${cal.iconBtn} ${styles.openBtn}`}
            aria-label="Open full schedule"
            data-focus="dashboard.widget.open"
            title="Open"
          >
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
          </Link>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={`${cal.calendar} ${styles.calendar}`} aria-label="Month calendar" style={{ flex: 1 }}>
          <div className={cal.calGrid} aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className={cal.dow}>
                {d}
              </div>
            ))}
          </div>
          <div className={cal.calGrid}>
            {monthDays.map((d) => {
              const inMonth = d.getMonth() === month.getMonth();
              const key = dateKey(d);
              const count = eventsByDay.get(key) ?? 0;
              const active = key === selected;
              const isToday = sameDay(d, new Date());
              return (
                <button
                  key={key}
                  className={[cal.day, !inMonth ? cal.dayMuted : "", active ? cal.dayActive : "", isToday ? cal.dayToday : ""].join(" ")}
                  type="button"
                  onClick={() => setSelected(key)}
                  onFocus={(e) => {
                    setSelected(key);
                    scrollNearest(e.currentTarget);
                  }}
                  aria-label={`Select ${d.toDateString()}`}
                  data-focus={`dashboard.widget.day.${key}`}
                >
                  <div className={cal.dayTop}>
                    <div className={cal.dayNum}>{d.getDate()}</div>
                    <div className={`${cal.dots} ${styles.widgetDots}`} aria-hidden="true">
                      {count > 0 ? <span className={`${cal.dot} ${styles.widgetDot}`} /> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

