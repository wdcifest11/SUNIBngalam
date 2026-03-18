"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const CONFIG_KEY = "studium:study_focus_config:v1";
const FOCUS_STATE_KEY = "studium:study_focus_room:v1";
const LOCAL_XP_KEY = "studium:local_xp:v1";
const NOTES_TEMPLATE_KEY = "studium:notes:template_draft:v1";

type PresetId = "classic" | "deep";

type FocusConfig = {
  v: 1;
  preset: PresetId;
  focusDurationSec: number;
  breakDurationSec: number;
  strictMode: boolean;
  goals: string[];
};

type FocusStateLite = {
  v: 1;
  day?: string;
  sessionsToday?: number;
  studySecondsToday?: number;
  lastRecap?: {
    endedAt: number;
    focusSeconds: number;
    goals: string[];
    goalsDone: boolean[];
    strictMode: boolean;
    claimedXp: number;
    claimedAt: number | null;
  } | null;
};

const PRESETS: Record<PresetId, { label: string; focus: number; brk: number; meta: string }> = {
  classic: { label: "Focus 25", focus: 25 * 60, brk: 5 * 60, meta: "Pomodoro (25/5) - Auto break" },
  deep: { label: "Deep Focus", focus: 50 * 60, brk: 10 * 60, meta: "Long sprint (50/10) - Fewer resets" },
};

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeLocalGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getScopedKey(base: string) {
  if (typeof document === "undefined") return base;
  const fromBody = document.body?.dataset?.userId || "";
  const fromRoot = document.querySelector<HTMLElement>(".shellRoot")?.dataset?.userId || "";
  const userId = String(fromBody || fromRoot || "").trim();
  return userId ? `${base}:u${userId}` : base;
}

function normalizeGoals(goals: Array<string | null | undefined>) {
  return goals
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fmtMinutes(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  return `${m}m`;
}

export default function StudyGrid() {
  const router = useRouter();
  const [preset, setPreset] = useState<PresetId>("classic");
  const [strictMode, setStrictMode] = useState(false);
  const [goal1, setGoal1] = useState("");
  const [goal2, setGoal2] = useState("");
  const [goal3, setGoal3] = useState("");
  const [modal, setModal] = useState<null | "templates" | "recap">(null);
  const [lite, setLite] = useState<{ sessionsToday: number; studySecondsToday: number; localXp: number; lastRecap: FocusStateLite["lastRecap"] }>({
    sessionsToday: 0,
    studySecondsToday: 0,
    localXp: 0,
    lastRecap: null,
  });

  useEffect(() => {
    const raw = safeLocalGet(getScopedKey(CONFIG_KEY));
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw) as Partial<FocusConfig>;
      if (cfg?.v !== 1) return;
      if (cfg.preset === "classic" || cfg.preset === "deep") setPreset(cfg.preset);
      setStrictMode(Boolean(cfg.strictMode));
      const goals = Array.isArray(cfg.goals) ? cfg.goals.map((x) => String(x ?? "")) : [];
      setGoal1(goals[0] ?? "");
      setGoal2(goals[1] ?? "");
      setGoal3(goals[2] ?? "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    reloadLite();
  }, []);

  function reloadLite() {
    const focus = safeJsonParse<FocusStateLite>(safeLocalGet(getScopedKey(FOCUS_STATE_KEY)));
    const sessionsToday = Number(focus?.sessionsToday ?? 0) || 0;
    const studySecondsToday = Number(focus?.studySecondsToday ?? 0) || 0;
    const localXp = Number(safeLocalGet(getScopedKey(LOCAL_XP_KEY)) || "0") || 0;
    setLite({
      sessionsToday,
      studySecondsToday,
      localXp,
      lastRecap: focus?.lastRecap ?? null,
    });
  }

  const goals = useMemo(() => normalizeGoals([goal1, goal2, goal3]), [goal1, goal2, goal3]);

  function start() {
    const p = PRESETS[preset];
    const cfg: FocusConfig = {
      v: 1,
      preset,
      focusDurationSec: p.focus,
      breakDurationSec: p.brk,
      strictMode,
      goals,
    };
    safeLocalSet(getScopedKey(CONFIG_KEY), JSON.stringify(cfg));
    router.push(`/study-room?setup=1&autostart=1&preset=${preset}`);
  }

  function openNotes() {
    router.push("/notes");
  }

  function openResources() {
    router.push("/study/resources");
  }

  function openTemplates() {
    setModal("templates");
  }

  function openRecap() {
    reloadLite();
    setModal("recap");
  }

  function applyTemplate(t: { title: string; bodyHtml: string }) {
    try {
      const payload = JSON.stringify({ v: 1, title: t.title, body: t.bodyHtml, bodyFormat: "html", createdAt: Date.now() });
      localStorage.setItem(getScopedKey(NOTES_TEMPLATE_KEY), payload);
    } catch {
      // ignore
    }
    setModal(null);
    router.push("/notes/new");
  }

  const templates = useMemo(
    () => [
      {
        id: "lecture",
        title: "Lecture Notes",
        bodyHtml:
          "<h1>Lecture</h1><p><b>Topic:</b> </p><p><b>Date:</b> </p><h2>Key ideas</h2><ul><li></li></ul><h2>Examples</h2><ul><li></li></ul><h2>Questions</h2><ul><li></li></ul><p><br/></p>",
      },
      {
        id: "problem",
        title: "Problem Set",
        bodyHtml:
          "<h1>Problem Set</h1><p><b>Course:</b> </p><p><b>Due:</b> </p><h2>Plan</h2><ul><li></li></ul><h2>Work</h2><ol><li><b>Q1</b> — </li><li><b>Q2</b> — </li><li><b>Q3</b> — </li></ol><h2>Checks</h2><ul><li>Re-read steps</li><li>Units / signs</li><li>Edge cases</li></ul><p><br/></p>",
      },
      {
        id: "review",
        title: "Weekly Review",
        bodyHtml:
          "<h1>Weekly Review</h1><h2>Wins</h2><ul><li></li></ul><h2>Stuck points</h2><ul><li></li></ul><h2>Next week goals</h2><ul><li></li></ul><h2>Resources</h2><ul><li></li></ul><p><br/></p>",
      },
      {
        id: "recall",
        title: "Active Recall Cards",
        bodyHtml:
          "<h1>Active Recall</h1><p>Write Q/A pairs.</p><ul><li><b>Q:</b> <i>...</i><br/><b>A:</b> <i>...</i></li><li><b>Q:</b> <i>...</i><br/><b>A:</b> <i>...</i></li><li><b>Q:</b> <i>...</i><br/><b>A:</b> <i>...</i></li></ul><p><br/></p>",
      },
    ],
    [],
  );

  function onKeyActivate(e: KeyboardEvent<HTMLElement>, fn: () => void) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  }

  return (
    <div className="studyHub" aria-label="Study room hub">
      <div className="studyHub__card gridCard" tabIndex={0} data-focus="study.launcher" aria-label="Focus setup">
        <div className="studyHub__kicker">Setup</div>
        <div className="studyHub__title">Start a focus session</div>
        <div className="studyHub__meta">Pick a preset, set up to 3 goals, then start.</div>

        <div className="studyHub__row" aria-label="Preset">
          {(["classic", "deep"] as PresetId[]).map((id) => {
            const isActive = preset === id;
            return (
              <button
                key={id}
                type="button"
                className={`studyHub__chip ${isActive ? "studyHub__chip--active" : ""}`}
                onClick={() => setPreset(id)}
                aria-pressed={isActive}
              >
                <div className="studyHub__chipLabel">{PRESETS[id].label}</div>
                <div className="studyHub__chipMeta">{PRESETS[id].meta}</div>
              </button>
            );
          })}
        </div>

        <label className="studyHub__toggle" aria-label="Strict mode">
          <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
          <span className="studyHub__toggleUi" aria-hidden="true" />
          <span className="studyHub__toggleText">
            <span className="studyHub__toggleTitle">Strict mode</span>
            <span className="studyHub__toggleDesc">Hide navigation while focusing (reduces distractions).</span>
          </span>
        </label>

        <div className="studyHub__goals" aria-label="Session goals">
          <div className="studyHub__goalsTitle">Goals (max 3)</div>
          <input className="studyHub__input" value={goal1} onChange={(e) => setGoal1(e.target.value)} placeholder="Goal 1 (e.g. finish lecture 3 notes)" />
          <input className="studyHub__input" value={goal2} onChange={(e) => setGoal2(e.target.value)} placeholder="Goal 2 (optional)" />
          <input className="studyHub__input" value={goal3} onChange={(e) => setGoal3(e.target.value)} placeholder="Goal 3 (optional)" />
        </div>

        <div className="studyHub__actions">
          <button type="button" className="studyHub__start" onClick={start} onKeyDown={(e) => onKeyActivate(e, start)} data-focus="study.quick">
            <i className="fa-solid fa-play" aria-hidden="true" /> Start Focus
          </button>
        </div>
      </div>

      <div className="studyHub__card studyHub__card--soft gridCard" tabIndex={0} data-focus="study.capture" aria-label="Notes and resources">
        <div className="studyHub__kicker">Support</div>
        <div className="studyHub__title">Notes & resources (local)</div>
        <div className="studyHub__meta">Local-only helpers: notes, templates, and resource board (no backend).</div>
        <div className="studyHub__miniGrid" aria-label="Support actions">
          <button type="button" className="studyHub__miniBtn" onClick={openNotes} data-focus="study.support.notes" aria-label="Open Notes">
            <i className="fa-solid fa-note-sticky" aria-hidden="true" /> Notes
          </button>
          <button type="button" className="studyHub__miniBtn" onClick={openTemplates} data-focus="study.support.templates" aria-label="Open Templates">
            <i className="fa-solid fa-layer-group" aria-hidden="true" /> Templates
          </button>
          <button type="button" className="studyHub__miniBtn" onClick={openResources} data-focus="study.support.resources" aria-label="Open Resource Board">
            <i className="fa-solid fa-link" aria-hidden="true" /> Resource Board
          </button>
          <button
            type="button"
            className="studyHub__miniBtn"
            onClick={openRecap}
            data-focus="study.support.recap"
            aria-label="Open Session Recap"
          >
            <i className="fa-solid fa-clipboard-check" aria-hidden="true" /> Session recap
          </button>
        </div>
      </div>

      <div className="studyHub__card studyHub__card--soft gridCard" tabIndex={0} data-focus="study.stats" aria-label="Progress and quick actions">
        <div className="studyHub__kicker">Progress</div>
        <div className="studyHub__title">Today</div>
        <div className="studyHub__meta">
          {lite.sessionsToday} session(s) · {fmtMinutes(lite.studySecondsToday)} focused · {lite.localXp.toLocaleString()} local XP
        </div>

        <div className="studyHub__quickRow" aria-label="Quick actions">
          <button type="button" className="studyHub__quickBtn" onClick={() => router.push("/study-room")} aria-label="Continue focus">
            <i className="fa-solid fa-forward" aria-hidden="true" /> Continue focus
          </button>
          <button type="button" className="studyHub__quickBtn" onClick={() => router.push("/notes/new")} aria-label="Quick note">
            <i className="fa-solid fa-pen-to-square" aria-hidden="true" /> Quick note
          </button>
        </div>

        <div className="studyHub__quickRow" aria-label="More actions">
          <button type="button" className="studyHub__quickBtn" onClick={openResources} aria-label="Open resources">
            <i className="fa-solid fa-link" aria-hidden="true" /> Resources
          </button>
          <button type="button" className="studyHub__quickBtn" onClick={openRecap} aria-label="Open recap">
            <i className="fa-solid fa-clipboard-check" aria-hidden="true" /> Recap
          </button>
        </div>
      </div>

      {modal ? (
        <div className="studiumModal" role="dialog" aria-modal="true" aria-label={modal === "templates" ? "Templates" : "Session recap"}>
          <div className="studiumModalOverlay" onPointerDown={() => setModal(null)} aria-hidden="true" />
          <div className="studiumModalPanel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="studiumModalTop">
              <div className="studiumModalTitleWrap">
                <div className="studiumModalKicker">{modal === "templates" ? "SUPPORT" : "SUMMARY"}</div>
                <div className="studiumModalTitle">{modal === "templates" ? "Templates" : "Last session recap"}</div>
                <div className="studiumModalSubtitle">
                  {modal === "templates" ? "Pick a template and start writing." : lite.lastRecap ? "Local-only recap (this device)." : "No recap yet. Finish a focus run first."}
                </div>
              </div>
              <button type="button" className="studiumModalClose" onClick={() => setModal(null)} aria-label="Close popup">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="studiumModalBody">
              {modal === "templates" ? (
                <div className="studyHub__templateGrid" aria-label="Template list">
                  {templates.map((t) => (
                    <button key={t.id} type="button" className="studyHub__templateBtn" onClick={() => applyTemplate(t)}>
                      <div className="studyHub__templateTitle">{t.title}</div>
                      <div className="studyHub__templateMeta">Opens Notes editor with a prefilled layout.</div>
                    </button>
                  ))}
                </div>
              ) : lite.lastRecap ? (
                <div className="studyHub__recap" aria-label="Recap details">
                  <div className="studyHub__recapRow">
                    <span>Focus time</span>
                    <b>{fmtMinutes(lite.lastRecap.focusSeconds)}</b>
                  </div>
                  <div className="studyHub__recapRow">
                    <span>Strict mode</span>
                    <b>{lite.lastRecap.strictMode ? "On" : "Off"}</b>
                  </div>
                  <div className="studyHub__recapRow">
                    <span>XP claimed</span>
                    <b>{lite.lastRecap.claimedXp ? `+${lite.lastRecap.claimedXp}` : "-"}</b>
                  </div>
                  <div className="studyHub__recapGoals">
                    <div className="studyHub__recapGoalsTitle">Goals</div>
                    {lite.lastRecap.goals.map((g, idx) => (
                      <div key={`${idx}:${g}`} className="studyHub__recapGoal">
                        <i className={`fa-solid ${Boolean(lite.lastRecap?.goalsDone?.[idx]) ? "fa-circle-check" : "fa-circle"}`} aria-hidden="true" />
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="studyFocusRoom__modalActions" aria-label="Modal actions">
                <button type="button" className="studyFocusRoom__modalBtn" onClick={() => setModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
