"use client";

import { useEffect, useMemo, useState } from "react";

import { loadQuests, onPlannerUpdated } from "../grids/planner-storage";

export type StreakMonthCell = {
  date: Date;
  dayKey: string;
  due: number;
  done: number;
  level: number;
  inMonth: boolean;
};

export type StreakMonthData = {
  label: string;
  cells: StreakMonthCell[];
  totalDone: number;
  totalDue: number;
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

function weekdayIndexMonStart(d: Date) {
  const js = d.getDay(); // 0..6 (Sun..Sat)
  return (js + 6) % 7; // Mon=0 .. Sun=6
}

function levelFromDone(done: number) {
  if (done <= 0) return 0;
  if (done === 1) return 1;
  if (done === 2) return 2;
  if (done <= 4) return 3;
  return 4;
}

function monthLabel(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
}

function buildByDay() {
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

  return byDay;
}

function computeMonthData(): StreakMonthData {
  const now = startOfDayLocal(new Date());
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const byDay = buildByDay();

  let totalDone = 0;
  let totalDue = 0;
  for (let d = startOfDayLocal(start); d <= end; d = addDaysLocal(d, 1)) {
    const key = dayKeyLocal(d);
    const v = byDay.get(key) || { due: 0, done: 0 };
    totalDone += v.done;
    totalDue += v.due;
  }

  const gridStart = addDaysLocal(start, -weekdayIndexMonStart(start));

  const cells: StreakMonthCell[] = [];
  for (let i = 0; i < 28; i++) {
    const d = addDaysLocal(gridStart, i);
    const key = dayKeyLocal(d);
    const v = byDay.get(key) || { due: 0, done: 0 };
    const inMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const level = inMonth ? levelFromDone(v.done) : 0;
    cells.push({ date: d, dayKey: key, due: v.due, done: v.done, level, inMonth });
  }

  return { label: monthLabel(now), cells, totalDone, totalDue };
}

export function useStreakMonthData(): StreakMonthData {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return onPlannerUpdated(() => setTick((v) => v + 1));
  }, []);

  return useMemo(() => {
    void tick;
    return computeMonthData();
  }, [tick]);
}

