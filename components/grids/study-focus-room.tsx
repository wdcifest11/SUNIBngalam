"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./study-focus-room.module.css";
import type { PhaseId, PomodoroSession, PomodoroSettings } from "./study-room-pomodoro-store";
import {
  defaultSettings,
  loadSession,
  loadSettings,
  pauseSession,
  resetSession,
  saveSession,
  saveSettings,
  startSession,
} from "./study-room-pomodoro-store";

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function phaseName(phase: PhaseId) {
  if (phase === "shortBreak") return "Short break";
  if (phase === "longBreak") return "Long break";
  return "Focus";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type ConfirmState =
  | null
  | {
      title: string;
      desc: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    };

function getRemaining(session: PomodoroSession, settings: PomodoroSettings) {
  if (!session.isRunning || !session.endAtMs) return Math.min(settings.phases[session.phase].durationSec, Math.max(0, session.remainingSec));
  return Math.max(0, Math.ceil((session.endAtMs - Date.now()) / 1000));
}

export default function StudyFocusRoom() {
  const router = useRouter();
  const [settings, setSettings] = useState<PomodoroSettings>(() => defaultSettings());
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<PhaseId>("focus");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    const loaded = loadSession(s);
    setSession(loaded);
    setSelectedPhase(loaded?.phase || "focus");
  }, []);

  function pushWithTransition(href: string) {
    try {
      const anyDoc = document as any;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (!reduce && typeof anyDoc?.startViewTransition === "function") {
        document.documentElement.classList.add("vt-study");
        const vt = anyDoc.startViewTransition(() => router.push(href));
        const cleanup = () => document.documentElement.classList.remove("vt-study");
        try {
          vt.finished.then(cleanup, cleanup);
        } catch {
          cleanup();
        }
        return;
      }
    } catch {
      // ignore
    }
    router.push(href);
  }

  const summary = useMemo(() => {
    if (!session) return null;
    const phase = session.phase;
    const total = settings.phases[phase].durationSec;
    const remainingSec = getRemaining(session, settings);
    const pct = clamp(1 - remainingSec / Math.max(1, total), 0, 1);
    return {
      phase,
      remainingSec,
      pct,
      cycles: settings.cyclesBeforeLongBreak,
      completedFocus: session.completedFocus,
      isRunning: session.isRunning,
    };
  }, [session, settings]);

  function scheduleSave(next: PomodoroSettings) {
    setSettings(next);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveSettings(next), 220);
  }

  function setPhaseDuration(phase: PhaseId, minutes: number) {
    const next = { ...settings, phases: { ...settings.phases } };
    const max = phase === "focus" ? 180 : 90;
    const m = clamp(minutes, 1, max);
    next.phases[phase] = { ...next.phases[phase], durationSec: Math.floor(m * 60) };
    scheduleSave(next);

    if (session && !session.isRunning && session.phase === phase) {
      const patched = { ...session, remainingSec: next.phases[phase].durationSec };
      setSession(patched);
      saveSession(patched);
    }
  }

  function setGoal(phase: PhaseId, idx: number, value: string) {
    const next = { ...settings, phases: { ...settings.phases } };
    const goals = [...next.phases[phase].goals];
    goals[idx] = value;
    next.phases[phase] = { ...next.phases[phase], goals };
    scheduleSave(next);
  }

  function addGoal(phase: PhaseId) {
    const limits: Record<PhaseId, number> = { focus: 6, shortBreak: 4, longBreak: 4 };
    const next = { ...settings, phases: { ...settings.phases } };
    const goals = [...next.phases[phase].goals];
    if (goals.length >= limits[phase]) return;
    goals.push("");
    next.phases[phase] = { ...next.phases[phase], goals };
    scheduleSave(next);
  }

  function deleteGoal(phase: PhaseId, idx: number) {
    const next = { ...settings, phases: { ...settings.phases } };
    const goals = [...next.phases[phase].goals];
    goals.splice(idx, 1);
    next.phases[phase] = { ...next.phases[phase], goals };
    scheduleSave(next);
  }

  function onStart(phase: PhaseId) {
    const next = startSession(phase, settings);
    setSession(next);
    pushWithTransition("/study-room/strict");
  }

  function onResume() {
    pushWithTransition("/study-room/strict");
  }

  function onReset() {
    setConfirm({
      title: "Reset session?",
      desc: "This will stop the current timer and clear progress for this run.",
      confirmLabel: "Reset",
      danger: true,
      onConfirm: () => {
        const s = loadSettings();
        resetSession(s);
        setSession(loadSession(s));
        setConfirm(null);
      },
    });
  }

  function onPause() {
    if (!session) return;
    setSession(pauseSession(session));
  }

  const editingConfig = settings.phases[selectedPhase];
  const canAddEditing = editingConfig.goals.length < (selectedPhase === "focus" ? 6 : 4);
  const selectedTotalSec = settings.phases[selectedPhase].durationSec;
  const isSelectedCurrent = Boolean(summary && summary.phase === selectedPhase);
  const selectedClock = isSelectedCurrent ? formatClock(summary!.remainingSec) : formatClock(selectedTotalSec);
  const selectedPct = isSelectedCurrent ? summary!.pct : 0;

  const ringSize = 220;
  const ringStroke = 10;
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringDash = circumference * (1 - selectedPct);

  return (
    <div className={styles.page} aria-label="Study room pomodoro">
      <div className={styles.topBar} aria-label="Study room header">
        <div className={styles.brand}>
          <div className={styles.brandTitle}>Study Room</div>
          <div className={styles.brandSub}>Pomodoro grid + strict focus mode.</div>
        </div>
        <div className={styles.topActions} aria-label="Session actions">
          {summary ? (
            <button type="button" className={styles.dangerBtn} onClick={onReset}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.hubBody} aria-label="Study room body">
        <section className={styles.left} aria-label="Goal settings">
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Goal Setting</div>
            <div className={styles.sectionMeta}>{phaseName(selectedPhase)}</div>
          </div>

          <div className={styles.detail} aria-label="Goal editor">
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Minutes</span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  type="number"
                  min={1}
                  max={selectedPhase === "focus" ? 180 : 90}
                  value={Math.round(settings.phases[selectedPhase].durationSec / 60)}
                  onChange={(e) => setPhaseDuration(selectedPhase, Number(e.target.value || "0"))}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Cycle</span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  type="number"
                  min={2}
                  max={8}
                  value={settings.cyclesBeforeLongBreak}
                  onChange={(e) => scheduleSave({ ...settings, cyclesBeforeLongBreak: clamp(Number(e.target.value || "0"), 2, 8) })}
                />
              </label>
            </div>

            <div className={styles.goals} aria-label="Goals">
              <div className={styles.goalsHead}>
                <div className={styles.sectionTitle}>Goals</div>
                <div className={styles.sectionMeta}>{selectedPhase === "focus" ? "Max 6" : "Max 4"}</div>
              </div>
              <div className={styles.goalList}>
                {editingConfig.goals.length ? (
                  editingConfig.goals.map((g, idx) => (
                    <div key={idx} className={styles.goalRow}>
                      <input
                        className={styles.input}
                        value={g}
                        placeholder={idx === 0 ? "e.g. Finish outline" : "Goal"}
                        onChange={(e) => setGoal(selectedPhase, idx, e.target.value)}
                      />
                      <button type="button" className={styles.iconBtnMini} onClick={() => deleteGoal(selectedPhase, idx)} aria-label="Delete goal">
                        <i className="fa-solid fa-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.muted}>No goals yet.</div>
                )}
              </div>
              <div className={styles.goalFooter}>
                <button type="button" className={styles.addBtn} onClick={() => addGoal(selectedPhase)} disabled={!canAddEditing}>
                  <i className="fa-solid fa-plus" aria-hidden="true"></i>
                  Add goal
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.middle} aria-label="Phase options">
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Options</div>
            <div className={styles.sectionMeta}>{summary ? (summary.isRunning ? "Running" : "Paused") : "Idle"}</div>
          </div>

          <div className={styles.list} aria-label="Phase list">
            {([
              { id: "focus" as const, label: "Focus", meta: "Deep work" },
              { id: "shortBreak" as const, label: "Short break", meta: "Reset" },
              { id: "longBreak" as const, label: "Long break", meta: "Recharge" },
            ] as const).map((p) => {
              const minutes = Math.round(settings.phases[p.id].durationSec / 60);
              const goalsCount = settings.phases[p.id].goals.length;
              const isActive = selectedPhase === p.id;
              const isCurrent = summary?.phase === p.id;
              const pct = isCurrent ? summary?.pct ?? 0 : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={styles.item}
                  data-active={isActive ? "1" : "0"}
                  data-current={isCurrent ? "1" : "0"}
                  data-phase={p.id}
                  onClick={() => setSelectedPhase(p.id)}
                  aria-label={`Select ${p.label}`}
                >
                  <div className={styles.itemTop}>
                    <div className={styles.itemTitle}>{p.label}</div>
                    <div className={styles.badges}>
                      <span className={styles.badge}>{minutes}m</span>
                      <span className={styles.badge}>{goalsCount} goals</span>
                    </div>
                  </div>
                  <div className={styles.itemMeta}>{p.meta}</div>
                  <div className={styles.itemBar} aria-hidden="true">
                    <div className={styles.itemBarFill} style={{ width: `${Math.round(pct * 100)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.right} aria-label="Timer preview">
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Start</div>
            <div className={styles.sectionMeta}>{phaseName(selectedPhase)}</div>
          </div>

          <div className={styles.preview} aria-label="Timer preview">
            <div className={styles.ringWrap} aria-label="Timer ring">
              <svg className={styles.ring} width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} aria-hidden="true">
                <circle
                  className={styles.ringTrack}
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  strokeWidth={ringStroke}
                  fill="none"
                />
                <circle
                  className={styles.ringProg}
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  strokeWidth={ringStroke}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={ringDash}
                />
              </svg>
              <div className={styles.ringCenter}>
                <div className={styles.ringLabel}>{phaseName(selectedPhase)}</div>
                <div className={styles.ringClock}>{selectedClock}</div>
                <div className={styles.ringMeta}>{isSelectedCurrent ? `${Math.round(selectedPct * 100)}%` : "Preview"}</div>
              </div>
            </div>

            <div className={styles.previewActions} aria-label="Preview actions">
              {isSelectedCurrent ? (
                summary?.isRunning ? (
                  <button type="button" className={styles.actionBtn} onClick={onPause}>
                    <i className="fa-solid fa-pause" aria-hidden="true"></i>
                    Pause
                  </button>
                ) : (
                  <button type="button" className={styles.primaryBtn} onClick={onResume}>
                    <i className="fa-solid fa-play" aria-hidden="true"></i>
                    Resume
                  </button>
                )
              ) : (
                <button type="button" className={styles.primaryBtn} onClick={() => onStart(selectedPhase)}>
                  Start strict mode
                  <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>
              )}
              <button type="button" className={styles.dangerBtn} onClick={onReset} disabled={!summary}>
                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                Reset
              </button>
            </div>

            <div className={styles.previewHint}>
              Enter strict mode to lock in. Back asks confirmation and resets the run.
            </div>
          </div>
        </section>
      </div>

      {confirm
        ? createPortal(
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={confirm.title} onClick={() => setConfirm(null)}>
              <div
                className={styles.confirmModal}
                data-tone={confirm.danger ? "danger" : "default"}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.confirmKicker}>
                  <i className={confirm.danger ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-info"} aria-hidden="true"></i>
                  Confirmation
                </div>
                <div className={styles.confirmTitle}>{confirm.title}</div>
                <div className={styles.confirmBody}>
                  <div className={styles.confirmHint}>{confirm.desc}</div>
                  <div className={styles.confirmDetails}>
                    <div className={styles.confirmLine}>
                      <i className="fa-solid fa-stopwatch" aria-hidden="true"></i>
                      Timer will stop immediately.
                    </div>
                    <div className={styles.confirmLine}>
                      <i className="fa-solid fa-broom" aria-hidden="true"></i>
                      Current run progress will be cleared.
                    </div>
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalBtn} onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button type="button" className={confirm.danger ? styles.modalBtnDanger : styles.modalBtn} onClick={() => confirm.onConfirm()}>
                    {confirm.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
            ,
            document.body,
          )
        : null}
    </div>
  );
}
