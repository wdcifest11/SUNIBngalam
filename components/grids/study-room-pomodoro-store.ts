"use client";

export type PhaseId = "focus" | "shortBreak" | "longBreak";

export type PhaseConfig = {
  durationSec: number;
  goals: string[];
};

export type PomodoroSettings = {
  v: 1;
  cyclesBeforeLongBreak: number;
  phases: Record<PhaseId, PhaseConfig>;
};

export type PomodoroSession = {
  v: 1;
  phase: PhaseId;
  isRunning: boolean;
  remainingSec: number;
  endAtMs: number | null;
  completedFocus: number;
  goalDone: Record<PhaseId, boolean[]>;
};

const SETTINGS_KEY = "studium:study_room_pomodoro_settings:v1";
const SESSION_KEY = "studium:study_room_pomodoro_session:v1";

export function getScopedKey(base: string) {
  if (typeof document === "undefined") return base;
  const fromBody = document.body?.dataset?.userId || "";
  const fromRoot = document.querySelector<HTMLElement>(".shellRoot")?.dataset?.userId || "";
  const userId = String(fromBody || fromRoot || "").trim();
  return userId ? `${base}:u${userId}` : base;
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

function normalizeGoals(raw: unknown, max: number) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? ""))
    .map((x) => x.replace(/\s+/g, " ").trim())
    .slice(0, max);
}

export function defaultSettings(): PomodoroSettings {
  return {
    v: 1,
    cyclesBeforeLongBreak: 4,
    phases: {
      focus: { durationSec: 25 * 60, goals: [""] },
      shortBreak: { durationSec: 5 * 60, goals: [""] },
      longBreak: { durationSec: 15 * 60, goals: [""] },
    },
  };
}

export function defaultSession(settings: PomodoroSettings): PomodoroSession {
  return {
    v: 1,
    phase: "focus",
    isRunning: false,
    remainingSec: settings.phases.focus.durationSec,
    endAtMs: null,
    completedFocus: 0,
    goalDone: {
      focus: new Array(settings.phases.focus.goals.length).fill(false),
      shortBreak: new Array(settings.phases.shortBreak.goals.length).fill(false),
      longBreak: new Array(settings.phases.longBreak.goals.length).fill(false),
    },
  };
}

export function loadSettings(): PomodoroSettings {
  const raw = safeLocalGet(getScopedKey(SETTINGS_KEY));
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as Partial<PomodoroSettings>;
    if (parsed?.v !== 1) return defaultSettings();
    const base = defaultSettings();
    const cyclesBeforeLongBreak = Number(parsed.cyclesBeforeLongBreak ?? base.cyclesBeforeLongBreak) || base.cyclesBeforeLongBreak;
    const focus = parsed.phases?.focus;
    const shortBreak = parsed.phases?.shortBreak;
    const longBreak = parsed.phases?.longBreak;

    const next: PomodoroSettings = {
      v: 1,
      cyclesBeforeLongBreak: Math.min(8, Math.max(2, Math.floor(cyclesBeforeLongBreak))),
      phases: {
        focus: {
          durationSec: Math.min(180 * 60, Math.max(60, Math.floor(Number(focus?.durationSec ?? base.phases.focus.durationSec)))),
          goals: normalizeGoals(focus?.goals ?? base.phases.focus.goals, 6),
        },
        shortBreak: {
          durationSec: Math.min(90 * 60, Math.max(30, Math.floor(Number(shortBreak?.durationSec ?? base.phases.shortBreak.durationSec)))),
          goals: normalizeGoals(shortBreak?.goals ?? base.phases.shortBreak.goals, 4),
        },
        longBreak: {
          durationSec: Math.min(90 * 60, Math.max(60, Math.floor(Number(longBreak?.durationSec ?? base.phases.longBreak.durationSec)))),
          goals: normalizeGoals(longBreak?.goals ?? base.phases.longBreak.goals, 4),
        },
      },
    };
    return next;
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: PomodoroSettings) {
  safeLocalSet(getScopedKey(SETTINGS_KEY), JSON.stringify(settings));
}

export function loadSession(settings: PomodoroSettings): PomodoroSession {
  const raw = safeLocalGet(getScopedKey(SESSION_KEY));
  if (!raw) return defaultSession(settings);
  try {
    const parsed = JSON.parse(raw) as Partial<PomodoroSession>;
    if (parsed?.v !== 1) return defaultSession(settings);
    const phase: PhaseId = parsed.phase === "shortBreak" || parsed.phase === "longBreak" ? parsed.phase : "focus";
    const isRunning = Boolean(parsed.isRunning);
    const endAtMs = parsed.endAtMs === null || typeof parsed.endAtMs === "number" ? parsed.endAtMs : null;
    const remainingSec = typeof parsed.remainingSec === "number" ? Math.max(0, Math.floor(parsed.remainingSec)) : settings.phases[phase].durationSec;
    const completedFocus = typeof parsed.completedFocus === "number" ? Math.max(0, Math.floor(parsed.completedFocus)) : 0;
    const goalDoneRaw = (parsed as any).goalDone as Partial<Record<PhaseId, unknown>> | undefined;
    const mk = (p: PhaseId) => {
      const arr = Array.isArray(goalDoneRaw?.[p]) ? (goalDoneRaw?.[p] as unknown[]).map((x) => Boolean(x)) : [];
      const len = settings.phases[p].goals.length;
      return new Array(len).fill(false).map((_, i) => Boolean(arr[i]));
    };

    return {
      v: 1,
      phase,
      isRunning,
      endAtMs,
      remainingSec,
      completedFocus,
      goalDone: {
        focus: mk("focus"),
        shortBreak: mk("shortBreak"),
        longBreak: mk("longBreak"),
      },
    };
  } catch {
    return defaultSession(settings);
  }
}

export function saveSession(session: PomodoroSession) {
  safeLocalSet(getScopedKey(SESSION_KEY), JSON.stringify(session));
}

export function resetSession(settings: PomodoroSettings) {
  saveSession(defaultSession(settings));
}

export function startSession(phase: PhaseId, settings: PomodoroSettings): PomodoroSession {
  const durationSec = settings.phases[phase].durationSec;
  const now = Date.now();
  const next: PomodoroSession = {
    v: 1,
    phase,
    isRunning: true,
    remainingSec: durationSec,
    endAtMs: now + durationSec * 1000,
    completedFocus: 0,
    goalDone: {
      focus: new Array(settings.phases.focus.goals.length).fill(false),
      shortBreak: new Array(settings.phases.shortBreak.goals.length).fill(false),
      longBreak: new Array(settings.phases.longBreak.goals.length).fill(false),
    },
  };
  saveSession(next);
  return next;
}

export function pauseSession(session: PomodoroSession): PomodoroSession {
  if (!session.isRunning) return session;
  const remaining = session.endAtMs ? Math.max(0, Math.ceil((session.endAtMs - Date.now()) / 1000)) : session.remainingSec;
  const next = { ...session, isRunning: false, endAtMs: null, remainingSec: remaining };
  saveSession(next);
  return next;
}

export function resumeSession(session: PomodoroSession, settings: PomodoroSettings): PomodoroSession {
  if (session.isRunning) return session;
  const duration = settings.phases[session.phase].durationSec;
  const remaining = Math.min(duration, Math.max(0, Math.floor(session.remainingSec)));
  const next = { ...session, isRunning: true, endAtMs: Date.now() + remaining * 1000, remainingSec: remaining };
  saveSession(next);
  return next;
}

export function tickSession(session: PomodoroSession, settings: PomodoroSettings): PomodoroSession {
  if (!session.isRunning || !session.endAtMs) return session;
  const remaining = Math.max(0, Math.ceil((session.endAtMs - Date.now()) / 1000));
  if (remaining > 0) {
    if (remaining !== session.remainingSec) {
      const next = { ...session, remainingSec: remaining };
      saveSession(next);
      return next;
    }
    return session;
  }

  const cycles = Math.min(8, Math.max(2, settings.cyclesBeforeLongBreak));
  let nextPhase: PhaseId = "focus";
  let completedFocus = session.completedFocus;

  if (session.phase === "focus") {
    completedFocus += 1;
    nextPhase = completedFocus % cycles === 0 ? "longBreak" : "shortBreak";
  } else {
    nextPhase = "focus";
  }

  const durationSec = settings.phases[nextPhase].durationSec;
  const next: PomodoroSession = {
    ...session,
    phase: nextPhase,
    completedFocus,
    isRunning: true,
    remainingSec: durationSec,
    endAtMs: Date.now() + durationSec * 1000,
    goalDone: {
      ...session.goalDone,
      [nextPhase]: new Array(settings.phases[nextPhase].goals.length).fill(false),
    },
  };
  saveSession(next);
  return next;
}
