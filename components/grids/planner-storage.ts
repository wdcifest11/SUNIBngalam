"use client";

import { plannerStageTemplates } from "@/lib/app-data";

export type QuestType = "exam" | "assignment" | "routine";
export type QuestPriority = "low" | "medium" | "high";

export type QuestStage = {
  id: string;
  title: string;
  done: boolean;
  dueAt?: string;
};

export type Quest = {
  id: string;
  type: QuestType;
  priority?: QuestPriority;
  title: string;
  context: string;
  createdAt: string;
  dueAt?: string;
  stages: QuestStage[];
};

export type PlannerEvent = {
  id: string;
  title: string;
  startAt: string;
  durationMin?: number;
  notes?: string;
  questId?: string;
  stageId?: string;
  priority?: QuestPriority;
};

const LS_QUESTS_BASE = "studium:quests_v1";
const LS_EVENTS_BASE = "studium:events_v1";
const UPDATED_EVENT = "studium:planner_updated";

let bootstrapPromise: Promise<void> | null = null;
let syncTimer: any = null;

function currentUserId(): number | null {
  if (typeof document === "undefined") return null;
  const root = document.querySelector<HTMLElement>(".shellRoot");
  const raw = root?.dataset?.userId || document.body?.dataset?.userId || "";
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function scopedKey(base: string) {
  const uid = currentUserId();
  return uid ? `${base}:u${uid}` : base;
}

function canUseRemote() {
  return typeof window !== "undefined" && typeof fetch === "function";
}

function safeLocalGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeLocalRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function migrateLegacy(base: string) {
  const scoped = scopedKey(base);
  if (scoped === base) return;
  const scopedVal = safeLocalGet(scoped);
  if (scopedVal != null) return;
  const legacyVal = safeLocalGet(base);
  if (legacyVal == null) return;
  safeLocalSet(scoped, legacyVal);
  safeLocalRemove(base);
}

function readLocalPlanner() {
  migrateLegacy(LS_QUESTS_BASE);
  migrateLegacy(LS_EVENTS_BASE);
  const quests = safeJsonParse<Quest[]>(safeLocalGet(scopedKey(LS_QUESTS_BASE)), []);
  const events = safeJsonParse<PlannerEvent[]>(safeLocalGet(scopedKey(LS_EVENTS_BASE)), []);
  return { quests, events };
}

function writeLocalPlanner(quests: Quest[], events: PlannerEvent[]) {
  safeLocalSet(scopedKey(LS_QUESTS_BASE), JSON.stringify(quests));
  safeLocalSet(scopedKey(LS_EVENTS_BASE), JSON.stringify(events));
}

async function fetchRemotePlanner() {
  const res = await fetch("/api/planner", { method: "GET", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`planner GET failed: ${res.status}`);
  const data = (await res.json()) as any;
  return { quests: (Array.isArray(data?.quests) ? data.quests : []) as Quest[], events: (Array.isArray(data?.events) ? data.events : []) as PlannerEvent[] };
}

async function putRemotePlanner(quests: Quest[], events: PlannerEvent[]) {
  const res = await fetch("/api/planner", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quests, events }),
  });
  if (!res.ok) throw new Error(`planner PUT failed: ${res.status}`);
}

export async function bootstrapPlannerFromServer() {
  if (!canUseRemote()) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const remote = await fetchRemotePlanner();
      const local = readLocalPlanner();

      const remoteEmpty = remote.quests.length === 0 && remote.events.length === 0;
      const localHas = local.quests.length > 0 || local.events.length > 0;

      if (remoteEmpty && localHas) {
        await putRemotePlanner(local.quests, local.events);
        return;
      }

      writeLocalPlanner(remote.quests, remote.events);
      emitPlannerUpdated();
    } catch {
      // ignore (offline / unauthorized / etc)
    }
  })();

  return bootstrapPromise;
}

function queueRemoteSync() {
  if (!canUseRemote()) return;
  if (syncTimer) return;
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    try {
      const { quests, events } = readLocalPlanner();
      await putRemotePlanner(quests, events);
    } catch {
      // ignore
    }
  }, 450);
}

export function emitPlannerUpdated() {
  try {
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function onPlannerUpdated(handler: () => void) {
  const on = () => handler();
  window.addEventListener(UPDATED_EVENT, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(UPDATED_EVENT, on);
    window.removeEventListener("storage", on);
  };
}

export function loadQuests(): Quest[] {
  return readLocalPlanner().quests;
}

export function saveQuests(quests: Quest[]) {
  writeLocalPlanner(quests, loadEvents());
  emitPlannerUpdated();
  queueRemoteSync();
}

export function loadEvents(): PlannerEvent[] {
  return readLocalPlanner().events;
}

export function saveEvents(events: PlannerEvent[]) {
  writeLocalPlanner(loadQuests(), events);
  emitPlannerUpdated();
  queueRemoteSync();
}

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function clampDate(date: Date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function lerpDate(a: Date, b: Date, t: number) {
  const tt = Math.max(0, Math.min(1, t));
  return new Date(a.getTime() + (b.getTime() - a.getTime()) * tt);
}

function makeStage(title: string, dueAt?: string): QuestStage {
  return { id: uuid(), title, done: false, dueAt };
}

function buildStages(type: QuestType) {
  const titles = plannerStageTemplates(type);
  if (titles.length) return titles.map((title) => ({ title }));
  return [{ title: "Start session" }, { title: "Deep work" }, { title: "Quick recap" }];
}

export function createQuest(input: { type: QuestType; title: string; context: string; dueAt?: string; priority?: QuestPriority }) {
  const now = new Date();
  const due = input.dueAt ? clampDate(new Date(input.dueAt)) : addMinutes(now, 7 * 24 * 60);
  const priority: QuestPriority = input.priority ?? "medium";

  const template = buildStages(input.type);
  const stages: QuestStage[] = template.map((s, idx) => {
    const t = template.length <= 1 ? 1 : idx / (template.length - 1);
    const stageDue = lerpDate(now, due, t);
    return makeStage(s.title, stageDue.toISOString());
  });

  const quest: Quest = {
    id: uuid(),
    type: input.type,
    priority,
    title: input.title.trim() || "Untitled quest",
    context: input.context.trim(),
    createdAt: now.toISOString(),
    dueAt: due.toISOString(),
    stages,
  };

  const events: PlannerEvent[] = stages.map((s) => ({
    id: uuid(),
    title: `${quest.title} - ${s.title}`,
    startAt: s.dueAt || due.toISOString(),
    durationMin: 45,
    questId: quest.id,
    stageId: s.id,
    priority: quest.priority,
  }));

  return { quest, events };
}

export function addQuest(quest: Quest, events: PlannerEvent[]) {
  const quests = loadQuests();
  const nextQuests = [quest, ...quests].slice(0, 50);
  saveQuests(nextQuests);

  const existingEvents = loadEvents();
  const nextEvents = [...events, ...existingEvents].slice(0, 300);
  saveEvents(nextEvents);
}

export function toggleStageDone(questId: string, stageId: string) {
  const quests = loadQuests();
  const next = quests.map((q) => {
    if (q.id !== questId) return q;
    return {
      ...q,
      stages: q.stages.map((s) => (s.id === stageId ? { ...s, done: !s.done } : s)),
    };
  });
  saveQuests(next);

  const updated = next.find((q) => q.id === questId);
  const isCompleted = updated ? updated.stages.length > 0 && updated.stages.every((s) => s.done) : false;
  if (isCompleted) {
    saveEvents(loadEvents().filter((e) => e.questId !== questId));
  }
}

export function deleteQuest(questId: string) {
  saveQuests(loadQuests().filter((q) => q.id !== questId));
  saveEvents(loadEvents().filter((e) => e.questId !== questId));
}

export function addEvent(event: Omit<PlannerEvent, "id">) {
  const next: PlannerEvent = { id: uuid(), ...event };
  saveEvents([next, ...loadEvents()].slice(0, 300));
  return next;
}

export function deleteEvent(eventId: string) {
  saveEvents(loadEvents().filter((e) => e.id !== eventId));
}
