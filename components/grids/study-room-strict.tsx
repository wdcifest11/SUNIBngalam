"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./study-room-strict.module.css";
import type { PomodoroSession, PomodoroSettings } from "./study-room-pomodoro-store";
import {
  loadSession,
  loadSettings,
  pauseSession,
  resetSession,
  resumeSession,
  saveSession,
  tickSession,
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

function phaseTitle(phase: PomodoroSession["phase"]) {
  if (phase === "shortBreak") return "Short break";
  if (phase === "longBreak") return "Long break";
  return "Focus";
}

type ConfirmState =
  | null
  | {
      title: string;
      desc: string;
      confirmLabel: string;
      onConfirm: () => void;
    };

function getRemaining(session: PomodoroSession, settings: PomodoroSettings) {
  if (!session.isRunning || !session.endAtMs) return Math.min(settings.phases[session.phase].durationSec, Math.max(0, session.remainingSec));
  return Math.max(0, Math.ceil((session.endAtMs - Date.now()) / 1000));
}

export default function StudyRoomStrict() {
  const router = useRouter();
  const [settings, setSettings] = useState<PomodoroSettings>(() => loadSettings());
  const [session, setSession] = useState<PomodoroSession>(() => loadSession(loadSettings()));
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const wasRunningRef = useRef(false);

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

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setSession(loadSession(s));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSession((prev) => tickSession(prev, settings));
    }, 250);
    return () => window.clearInterval(id);
  }, [settings]);

  const remaining = useMemo(() => getRemaining(session, settings), [session, settings]);
  const total = settings.phases[session.phase].durationSec;
  const pct = Math.min(1, Math.max(0, 1 - remaining / Math.max(1, total)));

  const goalEntries = useMemo(() => {
    return settings.phases[session.phase].goals
      .map((raw, idx) => ({ idx, text: String(raw || "").trim() }))
      .filter((g) => Boolean(g.text));
  }, [settings, session.phase]);

  function toggleGoal(idx: number) {
    setSession((prev) => {
      const phase = prev.phase;
      const nextDone = [...(prev.goalDone[phase] || [])];
      nextDone[idx] = !nextDone[idx];
      const next = { ...prev, goalDone: { ...prev.goalDone, [phase]: nextDone } };
      saveSession(next);
      return next;
    });
  }

  function onBack() {
    wasRunningRef.current = session.isRunning;
    setSession(pauseSession(session));
    setConfirm({
      title: "Exit strict mode?",
      desc: "Leaving will reset this phase and the run won’t count as completed.",
      confirmLabel: "Exit & reset",
      onConfirm: () => {
        const s = loadSettings();
        resetSession(s);
        setConfirm(null);
        pushWithTransition("/study");
      },
    });
  }

  function onCancelExit() {
    setConfirm(null);
    if (!wasRunningRef.current) return;
    setSession((prev) => resumeSession(prev, settings));
  }

  function toggleRun() {
    if (session.isRunning) setSession(pauseSession(session));
    else setSession(resumeSession(session, settings));
  }

  const cycleNow = Math.min(session.completedFocus + 1, settings.cyclesBeforeLongBreak);

  return (
    <div className={styles.strictWrap} aria-label="Strict pomodoro mode">
      <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back">
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
        Back
      </button>

      <div className={styles.center}>
        <div className={styles.timerCard} aria-label="Timer">
          <div className={styles.timerHead}>
            <div className={styles.timerPhase}>{phaseTitle(session.phase)}</div>
            <div className={styles.timerMeta}>
              Focus {cycleNow}/{settings.cyclesBeforeLongBreak}
            </div>
          </div>

          <div className={styles.clockRow}>
            <div className={styles.clock}>{formatClock(remaining)}</div>
            <button type="button" className={styles.playBtn} onClick={toggleRun} aria-label={session.isRunning ? "Pause" : "Resume"}>
              <i className={session.isRunning ? "fa-solid fa-pause" : "fa-solid fa-play"} aria-hidden="true"></i>
            </button>
          </div>

          <div className={styles.progress} aria-label="Progress">
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
            <div className={styles.progressText}>{Math.round(pct * 100)}%</div>
          </div>
        </div>

        <div className={styles.detailGrid} aria-label="Details">
          <div className={styles.detailCard}>
            <div className={styles.detailTitle}>Goals</div>
            {goalEntries.length ? (
              <div className={styles.goalList}>
                {goalEntries.map((g) => (
                  <button
                    key={g.idx}
                    type="button"
                    className={styles.goalItem}
                    data-done={session.goalDone[session.phase]?.[g.idx] ? "1" : "0"}
                    onClick={() => toggleGoal(g.idx)}
                  >
                    <span className={styles.goalCheck} aria-hidden="true">
                      {session.goalDone[session.phase]?.[g.idx] ? <i className="fa-solid fa-check" aria-hidden="true" /> : <span className={styles.goalDot} />}
                    </span>
                    <span className={styles.goalText}>{g.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>No goals set for this phase.</div>
            )}
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailTitle}>Strict mode</div>
            <div className={styles.nextRow}>
              <div className={styles.nextLabel}>Tip</div>
              <div className={styles.nextValue}>Use Back to exit (resets run).</div>
            </div>
            <div className={styles.nextRow}>
              <div className={styles.nextLabel}>Auto-advance</div>
              <div className={styles.nextValue}>On</div>
            </div>
          </div>
        </div>
      </div>

      {confirm
        ? createPortal(
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={confirm.title} onClick={onCancelExit}>
              <div className={styles.confirmModal} data-tone="danger" onClick={(e) => e.stopPropagation()}>
                <div className={styles.confirmKicker}>
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                  Strict mode
                </div>
                <div className={styles.confirmTitle}>{confirm.title}</div>
                <div className={styles.confirmBody}>
                  <div className={styles.confirmHint}>{confirm.desc}</div>
                  <div className={styles.confirmDetails}>
                    <div className={styles.confirmLine}>
                      <i className="fa-solid fa-stopwatch" aria-hidden="true"></i>
                      Timer stops and the phase resets.
                    </div>
                    <div className={styles.confirmLine}>
                      <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                      You can start again anytime.
                    </div>
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.modalBtn} onClick={onCancelExit}>
                    Stay
                  </button>
                  <button type="button" className={styles.modalBtnDanger} onClick={confirm.onConfirm}>
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
