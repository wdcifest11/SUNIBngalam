"use client";

import { useEffect, useMemo, useState } from "react";

import { loadQuests, onPlannerUpdated } from "../grids/planner-storage";

export type StreakMonthLabel = { col: number; label: string };

export type StreakHeatDay = {
  date: Date;
  dayKey: string;
  due: number;
  done: number;
  level: number;
  inRange: boolean;
};

export type StreakData = {
  days: StreakHeatDay[];
  weeks: number;
  monthLabels: StreakMonthLabel[];
  totalDone: number;
  streakCurrent: number;
  streakBest: number;
};

function dayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnlyLocal(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDayLocal(d);
}

function addDaysLocal(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function utcDayNumber(d: Date) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

function weekdayIndex(d: Date, weekStartsOn: 0 | 1) {
  const js = d.getDay(); // 0..6 (Sun..Sat)
  if (weekStartsOn === 0) return js;
  // Monday start: Mon=0 .. Sun=6
  return (js + 6) % 7;
}

function levelFromDone(done: number) {
  if (done <= 0) return 0;
  if (done === 1) return 1;
  if (done === 2) return 2;
  if (done <= 4) return 3;
  return 4;
}

function monthShort(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short" }).format(d);
  } catch {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] || "";
  }
}

function computeStreakData(rangeDays: number): StreakData {
  const quests = loadQuests();
  const byDay = new Map<string, { due: number; done: number }>();

  for (const q of quests) {
    for (const s of q.stages || []) {
      const dueDate = parseDateOnlyLocal(s.dueAt);
      if (!dueDate) continue;
      const key = dayKeyLocal(dueDate);
      const cur = byDay.get(key) || { due: 0, done: 0 };
      cur.due += 1;
      if (s.done) cur.done += 1;
      byDay.set(key, cur);
    }
  }

  const end = startOfDayLocal(new Date());
  const start = addDaysLocal(end, -(rangeDays - 1));

  const padFront = weekdayIndex(start, 1);
  const gridStart = addDaysLocal(start, -padFront);
  const padEnd = 6 - weekdayIndex(end, 1);
  const gridEnd = addDaysLocal(end, padEnd);

  const startN = utcDayNumber(start);
  const endN = utcDayNumber(end);
  const gridStartN = utcDayNumber(gridStart);
  const gridEndN = utcDayNumber(gridEnd);

  let totalDone = 0;
  const success: boolean[] = [];
  for (let n = startN; n <= endN; n++) {
    const d = new Date(Date.UTC(1970, 0, 1 + n));
    const local = startOfDayLocal(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const key = dayKeyLocal(local);
    const v = byDay.get(key) || { due: 0, done: 0 };
    totalDone += v.done;
    success.push(v.due > 0 && v.done >= v.due);
  }

  let streakCurrent = 0;
  for (let i = success.length - 1; i >= 0; i--) {
    if (!success[i]) break;
    streakCurrent++;
  }

  let streakBest = 0;
  let run = 0;
  for (const ok of success) {
    run = ok ? run + 1 : 0;
    if (run > streakBest) streakBest = run;
  }

  const days: StreakHeatDay[] = [];
  for (let n = gridStartN; n <= gridEndN; n++) {
    const d = new Date(Date.UTC(1970, 0, 1 + n));
    const local = startOfDayLocal(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const key = dayKeyLocal(local);
    const v = byDay.get(key) || { due: 0, done: 0 };
    const inRange = n >= startN && n <= endN;
    const level = inRange ? levelFromDone(v.done) : 0;
    days.push({ date: local, dayKey: key, due: v.due, done: v.done, level, inRange });
  }

  const weeks = Math.ceil(days.length / 7);

  const monthLabels = new Map<number, string>();
  monthLabels.set(0, monthShort(start));
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d.inRange) continue;
    if (d.date.getDate() !== 1) continue;
    const col = Math.floor(i / 7);
    monthLabels.set(col, monthShort(d.date));
  }

  const labels: StreakMonthLabel[] = Array.from(monthLabels.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([col, label]) => ({ col, label }));

  return { days, weeks, monthLabels: labels, totalDone, streakCurrent, streakBest };
}

export function useStreakData(rangeDays = 365): StreakData {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return onPlannerUpdated(() => setTick((v) => v + 1));
  }, []);

  return useMemo(() => {
    void tick;
    return computeStreakData(rangeDays);
  }, [tick, rangeDays]);
}

