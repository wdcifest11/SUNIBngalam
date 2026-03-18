/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./battle-arena.module.css";

import cfg from "./battle-setup.json";
import { QUESTION_BANK, type BattleQuestion } from "./question-bank";
import { notifyIsland } from "../notifications/notify";

type DifficultyId = "easy" | "medium" | "hard";
type OpponentId = "bot" | "random" | "friend";
type ArenaPhase = "prelude" | "playing" | "finished";

type ArenaQuestion = BattleQuestion & {
  keyOptions: { key: "A" | "B" | "C" | "D"; text: string; index: number }[];
};

type ArenaState = {
  phase: ArenaPhase;
  countdown: number;
  questionIndex: number;
  questions: ArenaQuestion[];
  status: "answering" | "bot_thinking" | "reveal";
  pickedIndex: number | null;
  botIndex: number | null;
  correctIndex: number;
  playerHp: number;
  enemyHp: number;
  xpEarned: number;
  streak: number;
  result: "win" | "lose" | "draw" | null;
};

function modeTitle(mode: string) {
  if (mode === "ranked") return "Ranked Arena Duel";
  if (mode === "practice") return "Training Duel";
  if (mode === "room_make" || mode === "room_join") return "Room Duel";
  return "Quick Match Duel";
}

function readCfg() {
  const anyCfg: any = cfg;
  return {
    materials: Array.isArray(anyCfg.materials) ? anyCfg.materials : [],
    difficulties: Array.isArray(anyCfg.difficulties) ? anyCfg.difficulties : [],
    opponents: Array.isArray(anyCfg.opponents) ? anyCfg.opponents : [],
  };
}

function formatTimer(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "∞";
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function shuffle<T>(arr: T[], rng: () => number) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildQuestions(materialId: string, count: number, seed: number): ArenaQuestion[] {
  const pool =
    String(materialId) === "quests" ? QUESTION_BANK : QUESTION_BANK.filter((q) => String(q.materialId) === String(materialId));
  const rng = mulberry32(seed);
  const shuffled = pool.length ? shuffle(pool, rng) : [];
  const wanted = Math.max(1, Math.min(30, Number.isFinite(count) ? Math.floor(count) : 10));

  const picked: BattleQuestion[] = [];
  for (let i = 0; i < wanted; i++) {
    if (shuffled.length) picked.push(shuffled[i % shuffled.length]);
    else
      picked.push({
        id: `fallback_${i}`,
        materialId: "calculus",
        prompt: "No questions found for this material yet.",
        options: ["OK", "OK", "OK", "OK"],
        correctIndex: 0,
      });
  }

  const keys = ["A", "B", "C", "D"] as const;
  return picked.map((q, idx) => {
    const options = q.options.slice(0, 4);
    while (options.length < 4) options.push("—");
    return {
      ...q,
      id: `${q.id}_${idx}`,
      keyOptions: options.map((text, i) => ({ key: keys[i], text, index: i })),
    };
  });
}

function baseDamage(difficulty: DifficultyId) {
  if (difficulty === "easy") return 120;
  if (difficulty === "hard") return 210;
  return 160;
}

function botAccuracy(difficulty: DifficultyId) {
  if (difficulty === "easy") return 0.58;
  if (difficulty === "hard") return 0.80;
  return 0.70;
}

function pickBotAnswer(q: ArenaQuestion, difficulty: DifficultyId, rng: () => number) {
  const p = botAccuracy(difficulty);
  if (rng() < p) return q.correctIndex;
  const wrong = [0, 1, 2, 3].filter((i) => i !== q.correctIndex);
  return wrong[Math.floor(rng() * wrong.length)];
}

export default function BattleArena() {
  const sp = useSearchParams();
  const mode = sp.get("mode") || "ranked";
  const config = useMemo(() => readCfg(), []);

  const materialId = sp.get("material") || "quests";
  const difficultyId = (sp.get("difficulty") || "medium") as DifficultyId;
  const opponentId = (sp.get("opponent") || (mode === "ranked" ? "random" : "bot")) as OpponentId;
  const questionCount = Number(sp.get("questionCount") || 10);
  const timePerQuestionSec = Number(sp.get("timePerQuestionSec") || 30);
  const hints = sp.get("hints") === "1";
  const reviewAfter = sp.get("reviewAfter") === "1";
  const roomAction = sp.get("roomAction") || "";
  const roomCode = sp.get("roomCode") || "";

  const materialLabel = String(config.materials.find((m: any) => String(m?.id) === String(materialId))?.label || materialId);
  const difficultyLabel = String(
    config.difficulties.find((d: any) => String(d?.id) === String(difficultyId))?.label || difficultyId
  );
  const opponentLabel = String(config.opponents.find((o: any) => String(o?.id) === String(opponentId))?.label || opponentId);

  const xpReward = useMemo(() => {
    if (mode === "ranked") return 240;
    if (mode === "practice") return 80;
    if (mode === "room_make" || mode === "room_join") return 120;
    return 120;
  }, [mode]);

  const matchId = useMemo(() => {
    const raw = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    return `#${raw.slice(-6).toUpperCase()}`;
  }, []);

  const leftName = "You";
  const rightName = mode === "ranked" ? "Rival" : mode === "practice" ? "Training Bot" : "Opponent";

  const [pulsing, setPulsing] = useState(false);
  const startFocusRef = useRef(false);
  const seed = useMemo(() => {
    const s = `${mode}|${materialId}|${difficultyId}|${opponentId}|${questionCount}|${timePerQuestionSec}|${roomCode}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }, [mode, materialId, difficultyId, opponentId, questionCount, timePerQuestionSec, roomCode]);

  const initialQuestions = useMemo(() => buildQuestions(materialId, questionCount, seed), [materialId, questionCount, seed]);
  const rng = useMemo(() => mulberry32(seed ^ 0x9e3779b9), [seed]);

  const [arena, setArena] = useState<ArenaState>(() => ({
    phase: "prelude",
    countdown: 3,
    questionIndex: 0,
    questions: initialQuestions,
    status: "answering",
    pickedIndex: null,
    botIndex: null,
    correctIndex: initialQuestions[0]?.correctIndex ?? 0,
    playerHp: 1000,
    enemyHp: 1000,
    xpEarned: 0,
    streak: 0,
    result: null,
  }));

  const [timerSec, setTimerSec] = useState<number>(() => (Number.isFinite(timePerQuestionSec) && timePerQuestionSec > 0 ? timePerQuestionSec : -1));
  const lastQuestionRef = useRef<number>(-1);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [surrenderConfirmOpen, setSurrenderConfirmOpen] = useState(false);
  const modalOpen = pauseOpen || exitConfirmOpen || surrenderConfirmOpen;
  const finishedNotifiedRef = useRef(false);

  useEffect(() => {
    setPulsing(false);
    startFocusRef.current = false;
    const qs = buildQuestions(materialId, questionCount, seed);
    setArena({
      phase: "prelude",
      countdown: 3,
      questionIndex: 0,
      questions: qs,
      status: "answering",
      pickedIndex: null,
      botIndex: null,
      correctIndex: qs[0]?.correctIndex ?? 0,
      playerHp: 1000,
      enemyHp: 1000,
      xpEarned: 0,
      streak: 0,
      result: null,
    });
    setTimerSec(Number.isFinite(timePerQuestionSec) && timePerQuestionSec > 0 ? timePerQuestionSec : -1);
    lastQuestionRef.current = -1;
    setEliminated([]);
    setHintUsed(false);
    setPauseOpen(false);
    setExitConfirmOpen(false);
    setSurrenderConfirmOpen(false);
    finishedNotifiedRef.current = false;
  }, [mode, materialId, difficultyId, opponentId, questionCount, timePerQuestionSec, hints, reviewAfter, roomAction, roomCode, seed]);

  useEffect(() => {
    if (arena.phase !== "playing") return;
    if (arena.status !== "answering") return;
    if (modalOpen) return;
    if (lastQuestionRef.current === arena.questionIndex) return;
    lastQuestionRef.current = arena.questionIndex;
    setTimerSec(Number.isFinite(timePerQuestionSec) && timePerQuestionSec > 0 ? timePerQuestionSec : -1);
    setEliminated([]);
    setHintUsed(false);
  }, [arena.phase, arena.status, arena.questionIndex, timePerQuestionSec, modalOpen]);

  useEffect(() => {
    if (arena.phase !== "prelude") return;
    let cancelled = false;
    let t: number | null = null;
    let tick: number | null = null;

    const pulse = () => {
      setPulsing(true);
      window.setTimeout(() => setPulsing(false), 420);
    };

    t = window.setTimeout(() => {
      if (cancelled) return;
      pulse();
      tick = window.setInterval(() => {
        setArena((s) => {
          if (s.phase !== "prelude") return s;
          const next = s.countdown - 1;
          pulse();
          if (next <= 0) {
            if (tick) window.clearInterval(tick);
            window.setTimeout(() => {
              setArena((x) => (x.phase === "prelude" ? { ...x, phase: "playing", countdown: 0 } : x));
            }, 220);
            return { ...s, countdown: 0 };
          }
          return { ...s, countdown: next };
        });
      }, 1000);
    }, 550);

    return () => {
      cancelled = true;
      if (t) window.clearTimeout(t);
      if (tick) window.clearInterval(tick);
    };
  }, [arena.phase]);

  const closeTopModal = useCallback(() => {
    if (exitConfirmOpen) return setExitConfirmOpen(false);
    if (surrenderConfirmOpen) return setSurrenderConfirmOpen(false);
    if (pauseOpen) return setPauseOpen(false);
  }, [exitConfirmOpen, surrenderConfirmOpen, pauseOpen]);

  // Keyboard: Escape / Backspace / P / M / S / X for pause + actions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      const tag = String(target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || (target as any)?.isContentEditable;
      if (typing) return;

      const k = String(e.key || "").toLowerCase();
      const supported = k === "escape" || k === "backspace" || k === "p" || k === "s" || k === "x";
      if (!supported) return;

      e.preventDefault();
      e.stopPropagation();

      if (modalOpen) {
        if (k === "escape" || k === "backspace") return closeTopModal();
        return;
      }

      if (arena.phase === "playing") {
        if (k === "escape" || k === "p") return setPauseOpen((v) => !v);
        if (k === "x" || k === "backspace") return setExitConfirmOpen(true);
        if (k === "s") return setSurrenderConfirmOpen(true);
        return;
      }

      if (arena.phase === "finished") return void (window.location.href = "/battle");

      return setExitConfirmOpen(true);
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [arena.phase, modalOpen, closeTopModal]);

  useEffect(() => {
    if (!modalOpen) {
      document.body.classList.remove("modal-open");
      try {
        delete (window as any).studiumModalApi;
      } catch {
        // ignore
      }
      return;
    }

    document.body.classList.add("modal-open");
    (window as any).studiumModalApi = { isOpen: () => true, close: closeTopModal };
    return () => {
      document.body.classList.remove("modal-open");
      try {
        delete (window as any).studiumModalApi;
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, exitConfirmOpen, surrenderConfirmOpen, pauseOpen]);

  useEffect(() => {
    (window as any).arenaApi = {
      requestExitConfirm: () => setExitConfirmOpen(true),
      requestSurrender: () => setSurrenderConfirmOpen(true),
      togglePause: () => setPauseOpen((v: boolean) => !v),
    };
    return () => {
      try {
        if ((window as any).arenaApi) delete (window as any).arenaApi;
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (arena.phase !== "playing") return;

    // Focus the first answer for keyboard play.
    if (!startFocusRef.current) {
      startFocusRef.current = true;
      window.setTimeout(() => {
        const first = document.querySelector<HTMLElement>('[data-focus="arena.answer.a"]');
        if (!first) return;
        try {
          first.focus({ preventScroll: true } as any);
        } catch {
          first.focus();
        }
      }, 60);
    }

    if (modalOpen) return;
    if (!Number.isFinite(timePerQuestionSec) || timePerQuestionSec <= 0) return;
    if (arena.status !== "answering") return;

    const id = window.setInterval(() => {
      setTimerSec((s) => (Number.isFinite(s) && s > 0 ? s - 1 : s));
    }, 1000);
    return () => window.clearInterval(id);
  }, [arena.phase, arena.status, timePerQuestionSec, arena.questionIndex, modalOpen]);

  useEffect(() => {
    if (arena.phase !== "playing") return;
    if (modalOpen) return;
    if (!Number.isFinite(timePerQuestionSec) || timePerQuestionSec <= 0) return;
    if (arena.status !== "answering") return;
    if (!Number.isFinite(timerSec) || timerSec < 0) return;
    if (timerSec > 0) return;

    const timeout = window.setTimeout(() => {
      setArena((s) => {
        if (s.phase !== "playing") return s;
        if (s.status !== "answering") return s;
        return { ...s, status: "bot_thinking", pickedIndex: null, botIndex: null, correctIndex: s.questions[s.questionIndex]?.correctIndex ?? 0 };
      });
    }, 10);
    return () => window.clearTimeout(timeout);
  }, [arena.phase, arena.status, timerSec, timePerQuestionSec, modalOpen]);

  // Resolve when entering bot_thinking.
  useEffect(() => {
    if (arena.phase !== "playing") return;
    if (arena.status !== "bot_thinking") return;
    if (modalOpen) return;
    const q = arena.questions[arena.questionIndex];
    if (!q) return;

    const botDelay = 420 + Math.floor(rng() * 380);
    const botPick = pickBotAnswer(q, difficultyId, rng);

    const id = window.setTimeout(() => {
      setArena((s) => {
        if (s.phase !== "playing") return s;
        if (s.status !== "bot_thinking") return s;
        return { ...s, botIndex: botPick, status: "reveal" };
      });
    }, botDelay);

    return () => window.clearTimeout(id);
  }, [arena.phase, arena.status, arena.questionIndex, arena.questions, difficultyId, rng, modalOpen]);

  // Apply damage + progress when reveal happens.
  useEffect(() => {
    if (arena.phase !== "playing") return;
    if (arena.status !== "reveal") return;
    if (modalOpen) return;
    const q = arena.questions[arena.questionIndex];
    if (!q) return;

    const id = window.setTimeout(() => {
      setArena((s) => {
        if (s.phase !== "playing" || s.status !== "reveal") return s;
        const qq = s.questions[s.questionIndex];
        if (!qq) return s;

        const picked = s.pickedIndex;
        const botPicked = s.botIndex;
        const correct = qq.correctIndex;

        const bd = baseDamage(difficultyId);
        const speed =
          Number.isFinite(timePerQuestionSec) && timePerQuestionSec > 0 && Number.isFinite(timerSec) && timerSec >= 0
            ? clamp01(timerSec / timePerQuestionSec)
            : 0.5;

        const userCorrect = picked !== null && picked === correct;
        const botCorrect = botPicked !== null && botPicked === correct;

        const userDmg = userCorrect ? Math.round(bd * (0.75 + 0.55 * speed)) : Math.round(bd * 0.55);
        const botDmg = botCorrect ? Math.round(bd * 0.62) : Math.round(bd * 0.30);

        let playerHp = s.playerHp;
        let enemyHp = s.enemyHp;
        let xp = s.xpEarned;
        let streak = s.streak;

        if (userCorrect) {
          enemyHp -= userDmg;
          xp += Math.max(0, Math.round(xpReward / Math.max(1, s.questions.length)));
          streak += 1;
        } else {
          playerHp -= userDmg;
          streak = 0;
        }

        // Bot "answers" too. If wrong, you get a small advantage.
        if (botCorrect) playerHp -= botDmg;
        else enemyHp -= botDmg;

        playerHp = Math.max(0, playerHp);
        enemyHp = Math.max(0, enemyHp);

        const last = s.questionIndex >= s.questions.length - 1;
        const ended = playerHp <= 0 || enemyHp <= 0 || last;

        if (ended) {
          const result = playerHp === enemyHp ? "draw" : playerHp > enemyHp ? "win" : "lose";
          return { ...s, playerHp, enemyHp, xpEarned: xp, streak, phase: "finished", result };
        }

        const nextIndex = s.questionIndex + 1;
        return {
          ...s,
          playerHp,
          enemyHp,
          xpEarned: xp,
          streak,
          questionIndex: nextIndex,
          status: "answering",
          pickedIndex: null,
          botIndex: null,
          correctIndex: s.questions[nextIndex]?.correctIndex ?? 0,
        };
      });
    }, 980);

    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.phase, arena.status, modalOpen]);

  // Keyboard: 1-4 / A-D to answer.
  useEffect(() => {
    if (arena.phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (arena.phase !== "playing") return;
      if (arena.status !== "answering") return;
      if (modalOpen) return;

      const k = String(e.key || "").toLowerCase();
      if (k === "h") {
        if (!hints) return;
        if (hintUsed) return;
        const q = arena.questions[arena.questionIndex];
        if (!q) return;
        const wrong = [0, 1, 2, 3].filter((i) => i !== q.correctIndex && !eliminated.includes(i));
        if (wrong.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const pick = wrong[Math.floor(rng() * wrong.length)];
        setEliminated((x) => (x.includes(pick) ? x : [...x, pick]));
        setHintUsed(true);
        return;
      }

      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
      if (!(k in map)) return;
      const idx = map[k];
      if (eliminated.includes(idx)) return;
      e.preventDefault();
      e.stopPropagation();
      setArena((s) => {
        if (s.phase !== "playing") return s;
        if (s.status !== "answering") return s;
        return { ...s, status: "bot_thinking", pickedIndex: idx, botIndex: null, correctIndex: s.questions[s.questionIndex]?.correctIndex ?? 0 };
      });
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [arena.phase, arena.status, arena.questionIndex, hints, hintUsed, eliminated, rng, arena.questions, modalOpen]);

  useEffect(() => {
    const meta = document.getElementById("arenaDockMeta");
    if (!meta) return;
    if (pauseOpen) {
      meta.textContent = "PAUSED • Press Pause to resume";
      return;
    }
    if (exitConfirmOpen) {
      meta.textContent = "Exit confirmation";
      return;
    }
    if (arena.phase === "prelude") {
      meta.textContent = `Starting…`;
      return;
    }
    if (arena.phase === "finished") {
      const r = arena.result ? arena.result.toUpperCase() : "DONE";
      meta.textContent = `${r} • XP ${arena.xpEarned}/${xpReward}`;
      return;
    }
    const q = Math.min(arena.questionIndex + 1, arena.questions.length);
    meta.textContent = `Q ${q}/${arena.questions.length} • ${formatTimer(timerSec)} • XP ${arena.xpEarned}/${xpReward}`;
  }, [pauseOpen, exitConfirmOpen, arena.phase, arena.result, arena.questionIndex, arena.questions.length, timerSec, arena.xpEarned, xpReward]);

  useEffect(() => {
    if (arena.phase !== "finished") return;
    if (finishedNotifiedRef.current) return;
    finishedNotifiedRef.current = true;
    const title = arena.result === "win" ? "Victory!" : arena.result === "lose" ? "Defeat" : "Draw";
    notifyIsland({
      title,
      message: `XP +${arena.xpEarned} • HP ${arena.playerHp}/${1000}`,
      kind: arena.result === "win" ? "success" : arena.result === "lose" ? "danger" : "info",
      durationMs: 5200,
    });
  }, [arena.phase, arena.result, arena.xpEarned, arena.playerHp]);

  return (
    <div className={styles.page} aria-label="Battle arena">
      {arena.phase === "prelude" ? (
        <div className={styles.preludeOverlay} aria-label="Match prelude">
          <div className={styles.preludePanel}>
            <div className={styles.preludeInner}>
              <div className={styles.preludeTop}>
                <div className={styles.titleBlock}>
                  <div className={styles.preludeTitle}>MATCH SETTINGS</div>
                  <div className={styles.preludeMode}>{modeTitle(mode)}</div>
                  <div className={styles.preludeSubtitle}>Quick recap before you start.</div>
                </div>

                <div className={styles.preludeMascot} data-pulse={pulsing ? "1" : "0"} aria-hidden="true">
                  <img src="/blockyPng/idle.png" alt="" />
                </div>
              </div>

              <div className={styles.preludeChips} aria-label="Selected options">
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Material</span>
                  <span className={styles.chipVal}>{materialLabel}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Hardness</span>
                  <span className={styles.chipVal}>{difficultyLabel}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Match</span>
                  <span className={styles.chipVal}>{opponentLabel}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Questions</span>
                  <span className={styles.chipVal}>{Number.isFinite(questionCount) ? questionCount : 10}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Timer</span>
                  <span className={styles.chipVal}>{Number.isFinite(timePerQuestionSec) && timePerQuestionSec > 0 ? `${timePerQuestionSec}s / Q` : "Untimed"}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>XP</span>
                  <span className={styles.chipVal}>+{xpReward}</span>
                </div>
                {hints ? (
                  <div className={styles.chip}>
                    <span className={styles.chipKey}>Hints</span>
                    <span className={styles.chipVal}>On</span>
                  </div>
                ) : null}
                {reviewAfter ? (
                  <div className={styles.chip}>
                    <span className={styles.chipKey}>Review</span>
                    <span className={styles.chipVal}>On</span>
                  </div>
                ) : null}
                {roomCode ? (
                  <div className={styles.chip}>
                    <span className={styles.chipKey}>Room</span>
                    <span className={styles.chipVal}>
                      {roomAction ? `${roomAction.toUpperCase()}: ` : ""}
                      {roomCode}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className={styles.preludeBottom}>
                <div className={styles.preludeHint}>Get ready…</div>
                <div className={styles.countdownWrap} aria-live="polite" aria-atomic="true">
                  <div className={styles.countdownRing} aria-hidden="true">
                    <div className={styles.countdownNum}>{arena.countdown > 0 ? arena.countdown : "GO"}</div>
                  </div>
                  <div className={styles.preludeHint}>Starting in {arena.countdown > 0 ? arena.countdown : 0}s</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {arena.phase === "finished" ? (
        <div className={styles.preludeOverlay} aria-label="Match result">
          <div className={styles.preludePanel}>
            <div className={styles.preludeInner}>
              <div className={styles.preludeTop}>
                <div className={styles.titleBlock}>
                  <div className={styles.preludeTitle}>RESULT</div>
                  <div className={styles.preludeMode}>
                    {arena.result === "win" ? "Victory!" : arena.result === "lose" ? "Defeat" : "Draw"}
                  </div>
                  <div className={styles.preludeSubtitle}>
                    XP earned: +{arena.xpEarned} • Remaining HP: {arena.playerHp}/{1000}
                  </div>
                </div>

                <div className={styles.preludeMascot} aria-hidden="true">
                  <img src={arena.result === "win" ? "/blockyPng/battle.png" : arena.result === "lose" ? "/blockyPng/bad.png" : "/blockyPng/idle.png"} alt="" />
                </div>
              </div>

              <div className={styles.preludeChips} aria-label="Match recap">
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Material</span>
                  <span className={styles.chipVal}>{materialLabel}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Hardness</span>
                  <span className={styles.chipVal}>{difficultyLabel}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Match</span>
                  <span className={styles.chipVal}>{opponentLabel}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipKey}>Score</span>
                  <span className={styles.chipVal}>
                    You {arena.playerHp} • {rightName} {arena.enemyHp}
                  </span>
                </div>
              </div>

              <div className={styles.preludeBottom}>
                <div className={styles.preludeHint}>Press Exit to go back, or rematch.</div>
                <div className={styles.resultActions}>
                  <button
                    type="button"
                    className={styles.resultBtn}
                    onClick={() => (window.location.href = "/battle")}
                    aria-label="Back to battle"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={`${styles.resultBtn} ${styles.resultBtnPrimary}`}
                    onClick={() => window.location.reload()}
                    aria-label="Rematch"
                  >
                    Rematch
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pauseOpen ? (
        <div className="studiumModal" role="dialog" aria-modal="true" aria-label="Pause menu">
          <div className="studiumModalOverlay" onPointerDown={closeTopModal} aria-hidden="true" />
          <div className="studiumModalPanel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="studiumModalTop">
              <div className="studiumModalTitleWrap">
                <div className="studiumModalKicker">PAUSED</div>
                <div className="studiumModalTitle">Take a breath</div>
                <div className="studiumModalSubtitle">Resume when ready.</div>
              </div>
              <button type="button" className="studiumModalClose" onClick={closeTopModal} aria-label="Close popup">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div className="studiumModalBody">
              <div className="grid gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-[900] text-white/90 hover:bg-black/35"
                  onClick={() => setPauseOpen(false)}
                >
                  Resume
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-[900] text-white/90 hover:bg-black/35"
                  onClick={() => {
                    setPauseOpen(false);
                    setExitConfirmOpen(true);
                  }}
                >
                  Exit arena
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-[rgba(255,86,86,0.25)] px-4 py-3 text-sm font-[900] text-white/92 hover:bg-[rgba(255,86,86,0.32)]"
                  onClick={() => {
                    setPauseOpen(false);
                    setSurrenderConfirmOpen(true);
                  }}
                >
                  Surrender
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {exitConfirmOpen ? (
        <div className="studiumModal" role="dialog" aria-modal="true" aria-label="Confirm exit">
          <div className="studiumModalOverlay" onPointerDown={closeTopModal} aria-hidden="true" />
          <div className="studiumModalPanel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="studiumModalTop">
              <div className="studiumModalTitleWrap">
                <div className="studiumModalKicker">CONFIRM</div>
                <div className="studiumModalTitle">Exit arena?</div>
                <div className="studiumModalSubtitle">This will end your match.</div>
              </div>
              <button type="button" className="studiumModalClose" onClick={closeTopModal} aria-label="Close popup">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div className="studiumModalBody">
              <div className="grid gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-[900] text-white/90 hover:bg-black/35"
                  onClick={() => setExitConfirmOpen(false)}
                >
                  Keep playing
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-[900] text-white/90 hover:bg-black/35"
                  onClick={() => {
                    window.location.href = "/battle";
                  }}
                >
                  Exit to Battle
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-[rgba(255,86,86,0.25)] px-4 py-3 text-sm font-[900] text-white/92 hover:bg-[rgba(255,86,86,0.32)]"
                  onClick={() => {
                    setExitConfirmOpen(false);
                    setSurrenderConfirmOpen(true);
                  }}
                >
                  Surrender
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {surrenderConfirmOpen ? (
        <div className="studiumModal" role="dialog" aria-modal="true" aria-label="Confirm surrender">
          <div className="studiumModalOverlay" onPointerDown={closeTopModal} aria-hidden="true" />
          <div className="studiumModalPanel" onPointerDown={(e) => e.stopPropagation()}>
            <div className="studiumModalTop">
              <div className="studiumModalTitleWrap">
                <div className="studiumModalKicker">CONFIRM</div>
                <div className="studiumModalTitle">Surrender?</div>
                <div className="studiumModalSubtitle">You will lose this match.</div>
              </div>
              <button type="button" className="studiumModalClose" onClick={closeTopModal} aria-label="Close popup">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <div className="studiumModalBody">
              <div className="grid gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-[900] text-white/90 hover:bg-black/35"
                  onClick={() => setSurrenderConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/12 bg-[rgba(255,86,86,0.25)] px-4 py-3 text-sm font-[900] text-white/92 hover:bg-[rgba(255,86,86,0.32)]"
                  onClick={() => {
                    setSurrenderConfirmOpen(false);
                    setArena((s) => ({ ...s, phase: "finished", result: "lose" }));
                  }}
                >
                  Surrender
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.top}>
        <div className={styles.titleBlock}>
          <div className={styles.kicker}>{modeTitle(mode)}</div>
          <div className={styles.sub}>
            Season 5 • Crystal League • Match ID {matchId}
          </div>
        </div>

        <div className={styles.topPills} aria-label="Arena stats">
          <div className={styles.pill}>
            <div className={styles.pillLabel}>Current streak</div>
            <div className={styles.pillValue}>{arena.streak}x Combo</div>
          </div>
          <div className={styles.pill}>
            <div className={styles.pillLabel}>Duel points</div>
            <div className={styles.pillValue}>{(1250 + arena.xpEarned).toLocaleString()} DP</div>
          </div>
        </div>
      </div>

      <div className={styles.arena}>
        <section className={`gridCard ${styles.sideCard}`} data-focus="arena.you" tabIndex={0} aria-label="Your card">
          <div className={styles.sideInner}>
            <div className={styles.portrait} aria-hidden="true">
              <img
                src={
                  arena.phase === "playing" && arena.status === "reveal" && arena.pickedIndex !== null && arena.pickedIndex === arena.correctIndex
                    ? "/blockyPng/battle.png"
                    : arena.phase === "playing" && arena.status === "reveal"
                      ? "/blockyPng/bad.png"
                      : "/blockyPng/idle.png"
                }
                alt=""
              />
            </div>

            <div>
              <div className={styles.sideNameRow}>
                <div>
                  <div className={styles.sideName}>{leftName}</div>
                  <div className={styles.sideRole}>Battle Mage</div>
                </div>
                <div className={styles.lvlPill}>Lvl 24</div>
              </div>
            </div>

            <div>
              <div className={styles.barLabelRow}>
                <span>HP</span>
                <span>
                  {arena.playerHp}/{1000}
                </span>
              </div>
              <div className={styles.hpTrack} aria-hidden="true">
                <div className={styles.hpFill} style={{ ["--hp" as any]: `${Math.round((arena.playerHp / 1000) * 100)}%` }} />
              </div>
            </div>

            <div className={styles.badgeRow} aria-label="Skills">
              <div className={styles.badge} aria-hidden="true">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <div className={styles.badge} aria-hidden="true">
                <i className="fa-solid fa-shield"></i>
              </div>
            </div>
          </div>
        </section>

        <section className={`gridCard ${styles.centerCard}`} data-focus="arena.question" tabIndex={0} aria-label="Question card">
          <div className={styles.centerInner}>
            <div className={styles.timerRow} aria-label="Timer">
              <div className={styles.timer}>{formatTimer(timerSec)}</div>
            </div>
            <div className={styles.rewardRow} aria-label="XP reward">
              <div className={styles.rewardPill}>
                <i className="fa-solid fa-bolt" aria-hidden="true"></i> XP {arena.xpEarned} / {xpReward}
              </div>
            </div>

            <div className={styles.questionKicker}>
              Question {Math.min(arena.questionIndex + 1, arena.questions.length)} of {arena.questions.length}
            </div>
            <div className={styles.question}>{arena.questions[arena.questionIndex]?.prompt || "…"}</div>
            <div className={styles.statusLine} aria-live="polite">
              {arena.phase !== "playing"
                ? "—"
                : arena.status === "answering"
                  ? "Pick an answer (A–D or 1–4)."
                  : arena.status === "bot_thinking"
                    ? `${rightName} is thinking…`
                    : "Revealing…"}
            </div>
            {hints ? (
              <div className={styles.statusLine}>
                <button
                  type="button"
                  className="rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-xs font-[900] text-white/85 hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={modalOpen || arena.phase !== "playing" || arena.status !== "answering" || hintUsed}
                  onClick={() => {
                    if (arena.phase !== "playing") return;
                    if (arena.status !== "answering") return;
                    if (modalOpen) return;
                    if (hintUsed) return;
                    const q = arena.questions[arena.questionIndex];
                    if (!q) return;
                    const wrong = [0, 1, 2, 3].filter((i) => i !== q.correctIndex && !eliminated.includes(i));
                    if (wrong.length === 0) return;
                    const pick = wrong[Math.floor(rng() * wrong.length)];
                    setEliminated((x) => (x.includes(pick) ? x : [...x, pick]));
                    setHintUsed(true);
                  }}
                  aria-label="Use hint"
                >
                  Hint (H)
                </button>
              </div>
            ) : null}

            <div className={styles.answers} aria-label="Answers">
              {(arena.questions[arena.questionIndex]?.keyOptions || []).map((a) => {
                const reveal = arena.status === "reveal" || arena.phase === "finished";
                const picked = arena.pickedIndex === a.index;
                const correct = a.index === arena.correctIndex;
                const botPicked = arena.botIndex === a.index;
                const removed = eliminated.includes(a.index);

                let stateAttr = "";
                if (reveal && correct) stateAttr = "correct";
                else if (reveal && picked && !correct) stateAttr = "wrong";
                else if (picked) stateAttr = "picked";
                else if (reveal && botPicked && !correct) stateAttr = "bot";

                return (
                  <button
                    key={a.key}
                    type="button"
                    className={`gridCard ${styles.answerBtn}`}
                    data-focus={`arena.answer.${a.key.toLowerCase()}`}
                    aria-label={`Answer ${a.key}: ${a.text}`}
                    data-state={stateAttr}
                  disabled={removed || modalOpen || arena.phase !== "playing" || arena.status !== "answering"}
                  onClick={() => {
                    if (arena.phase !== "playing") return;
                    if (arena.status !== "answering") return;
                    if (modalOpen) return;
                    if (removed) return;
                    setArena((s) => ({ ...s, status: "bot_thinking", pickedIndex: a.index, botIndex: null, correctIndex: s.questions[s.questionIndex]?.correctIndex ?? 0 }));
                  }}
                >
                  <span className={styles.answerKey} aria-hidden="true">
                    {a.key}
                  </span>
                  <span className={styles.answerText}>{a.text}</span>
                </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`gridCard ${styles.sideCard}`} data-focus="arena.enemy" tabIndex={0} aria-label="Opponent card">
          <div className={styles.sideInner}>
            <div className={styles.portrait} aria-hidden="true" style={{ borderColor: "rgba(248, 113, 113, 0.95)" }}>
              <img
                src={
                  arena.phase === "playing" && arena.status === "reveal" && arena.botIndex !== null && arena.botIndex === arena.correctIndex
                    ? "/blockyPng/battle.png"
                    : arena.phase === "playing" && arena.status === "reveal"
                      ? "/blockyPng/bad.png"
                      : "/blockyPng/battle.png"
                }
                alt=""
              />
            </div>

            <div>
              <div className={styles.sideNameRow}>
                <div>
                  <div className={styles.sideName}>{rightName}</div>
                  <div className={styles.sideRole}>Rogue Academic</div>
                </div>
                <div className={styles.lvlPill} style={{ background: "rgba(248, 113, 113, 0.16)", borderColor: "rgba(255,255,255,0.14)" }}>
                  Lvl 26
                </div>
              </div>
            </div>

            <div>
              <div className={styles.barLabelRow}>
                <span>HP</span>
                <span>
                  {arena.enemyHp}/{1000}
                </span>
              </div>
              <div className={styles.hpTrack} aria-hidden="true">
                <div
                  className={`${styles.hpFill} ${styles.hpFillEnemy}`}
                  style={{ ["--hp" as any]: `${Math.round((arena.enemyHp / 1000) * 100)}%` }}
                />
              </div>
            </div>

            <div className={styles.badgeRow} aria-label="Skills">
              <div className={styles.badge} aria-hidden="true">
                <i className="fa-solid fa-book"></i>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
