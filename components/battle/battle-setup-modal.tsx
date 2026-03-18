/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { notifyIsland } from "../notifications/notify";

import cfg from "./battle-setup.json";

type ModeKey = "ranked" | "casual" | "practice" | "room_make" | "room_join";
type DifficultyId = "easy" | "medium" | "hard";
type OpponentId = "bot" | "random" | "friend";

type SetupState = {
  materialId: string;
  difficultyId: DifficultyId;
  opponentId: OpponentId;
  questionCount: number;
  timePerQuestionSec: number;
  hints: boolean;
  reviewAfter: boolean;
  roomAction: "make" | "join";
  roomCode: string;
};

function randCode(prefix: string, n: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = prefix;
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function normalizeCfg() {
  const anyCfg: any = cfg;
  return {
    materials: Array.isArray(anyCfg.materials) ? anyCfg.materials : [],
    difficulties: Array.isArray(anyCfg.difficulties) ? anyCfg.difficulties : [],
    opponents: Array.isArray(anyCfg.opponents) ? anyCfg.opponents : [],
    rules: anyCfg.rules || {},
    modes: anyCfg.modes || {},
    room: anyCfg.room || { idPrefix: "RM", idLength: 6 },
  };
}

function difficultyFromElo(elo: number, difficulties: any[]): DifficultyId {
  const n = Number.isFinite(Number(elo)) ? Number(elo) : 0;
  const hit = difficulties.find((d) => n >= Number(d.eloMin ?? 0) && n <= Number(d.eloMax ?? 9999));
  const id = String(hit?.id || "medium") as DifficultyId;
  if (id === "easy" || id === "hard") return id;
  return "medium";
}

function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = String((el as any).tagName || "").toLowerCase();
  if (tag === "textarea" || (el as any).isContentEditable) return true;
  if (tag === "input") {
    const t = String((el as any).getAttribute?.("type") || "text").toLowerCase();
    if (t === "range" || t === "checkbox" || t === "radio") return false;
    return true;
  }
  return tag === "select";
}

export default function BattleSetupModal({
  open,
  mode,
  elo,
  onClose,
}: {
  open: boolean;
  mode: ModeKey | null;
  elo: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const config = useMemo(() => normalizeCfg(), []);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<SetupState | null>(null);

  const modeCfg = mode ? (config.modes?.[mode] as any) : null;
  const locks = (modeCfg?.locks || {}) as Record<string, any>;
  const allowedOpponentIds = (Array.isArray(modeCfg?.allowedOpponentIds) && modeCfg.allowedOpponentIds.length
    ? modeCfg.allowedOpponentIds
    : config.opponents.map((o: any) => o?.id)) as string[];

  const computedDifficulty = useMemo(() => {
    return difficultyFromElo(elo, config.difficulties);
  }, [elo, config.difficulties]);

  useEffect(() => {
    if (!open || !mode || !modeCfg) return;
    const def = modeCfg.defaults || {};
    const next: SetupState = {
      materialId: String(def.materialId || "quests"),
      difficultyId: (String(def.difficultyId || computedDifficulty) as DifficultyId) || "medium",
      opponentId: (String(def.opponentId || "bot") as OpponentId) || "bot",
      questionCount: Number(def.questionCount || 10),
      timePerQuestionSec: Number(def.timePerQuestionSec || 30),
      hints: !!def.hints,
      reviewAfter: !!def.reviewAfter,
      roomAction: mode === "room_join" ? "join" : "make",
      roomCode: "",
    };
    setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove("modal-open");
      try {
        delete (window as any).studiumModalApi;
      } catch {
        // ignore
      }
      const prev = lastActiveRef.current;
      if (prev) {
        lastActiveRef.current = null;
        try {
          prev.focus({ preventScroll: true } as any);
        } catch {
          prev.focus();
        }
      }
      return;
    }

    lastActiveRef.current = (document.activeElement as HTMLElement | null) ?? null;
    document.body.classList.add("modal-open");
    (window as any).studiumModalApi = { isOpen: () => true, close: onClose };

    window.setTimeout(() => {
      const root = document.querySelector(".studiumModalPanel") as HTMLElement | null;
      if (!root) return;
      const target =
        (root.querySelector('[data-autofocus="1"]') as HTMLElement | null) ||
        (root.querySelector("button, input, [href], [tabindex]:not([tabindex='-1'])") as HTMLElement | null);
      if (!target) return;
      try {
        target.focus({ preventScroll: true } as any);
      } catch {
        target.focus();
      }
    }, 20);

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key;

      const root = document.querySelector(".studiumModalPanel") as HTMLElement | null;
      if (!root) return;

      const focusables = () => {
        const nodes = Array.from(
          root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ) as HTMLElement[];
        return nodes.filter((el) => {
          if (!el) return false;
          if ((el as any).disabled) return false;
          if ((el as any).hidden) return false;
          if (el.getAttribute("aria-hidden") === "true") return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      };

      const cycle = (dir: 1 | -1) => {
        const list = focusables();
        if (list.length === 0) return;
        const idx = list.indexOf(document.activeElement as any);
        const cur = idx >= 0 ? idx : 0;
        const next = (cur + dir + list.length) % list.length;
        try {
          list[next].focus({ preventScroll: true } as any);
        } catch {
          list[next].focus();
        }
      };

      if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        cycle(e.shiftKey ? -1 : 1);
        return;
      }

      const isArrow = key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
      if (!isArrow) return;

      const ae = document.activeElement as HTMLElement | null;
      const isRange =
        ae?.tagName &&
        String(ae.tagName).toLowerCase() === "input" &&
        String(ae.getAttribute("type") || "").toLowerCase() === "range";
      if (isRange && (key === "ArrowLeft" || key === "ArrowRight")) return;
      if (isTypingTarget(ae)) return;

      e.preventDefault();
      e.stopPropagation();
      if (key === "ArrowDown" || key === "ArrowRight") cycle(1);
      else cycle(-1);
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!state) return;
    if (state.opponentId !== "friend") return;
    if (state.roomAction !== "make") return;
    if (state.roomCode) return;
    const prefix = String(config.room?.idPrefix || "RM");
    const len = Math.max(4, Number(config.room?.idLength || 6));
    setState((s) => (s ? { ...s, roomCode: randCode(prefix, len) } : s));
  }, [open, state, config.room]);

  if (!open || !mode || !modeCfg || !state) return null;

  const title = String(modeCfg.label || "Battle setup");
  const subtitle = String(modeCfg.subtitle || "");

  const lockDifficulty = locks?.difficultyId === "elo";
  const lockOpponent = !!locks?.opponentId;
  const lockCount = !!locks?.questionCount;
  const lockTime = !!locks?.timePerQuestionSec;
  const lockHints = !!locks?.hints;
  const lockReview = !!locks?.reviewAfter;

  const effectiveDifficulty: DifficultyId = lockDifficulty ? computedDifficulty : state.difficultyId;

  const startLabel =
    mode === "ranked"
      ? "Start ranked (mock)"
      : mode === "practice"
        ? "Start training (mock)"
        : mode === "room_make"
          ? "Create room (mock)"
          : mode === "room_join"
            ? "Join room (mock)"
            : "Start match (mock)";

  const roomLockedAction: "make" | "join" | null = mode === "room_make" ? "make" : mode === "room_join" ? "join" : null;
  const timeLabel = state.timePerQuestionSec === 0 ? "Untimed" : `${state.timePerQuestionSec}s`;

  const materialLabel = String(
    config.materials.find((m: any) => String(m?.id) === String(state.materialId))?.label || state.materialId
  );
  const difficultyLabel = String(
    config.difficulties.find((d: any) => String(d?.id) === String(effectiveDifficulty))?.label || effectiveDifficulty
  );
  const opponentLabel = String(
    config.opponents.find((o: any) => String(o?.id) === String(state.opponentId))?.label || state.opponentId
  );
  const summary = `${materialLabel} • ${difficultyLabel} • ${opponentLabel} • ${state.questionCount}Q • ${timeLabel}${
    state.hints ? " • Hints" : ""
  }${state.reviewAfter ? " • Review" : ""}${state.opponentId === "friend" ? ` • Room:${state.roomAction}` : ""}`;

  const start = () => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("material", state.materialId);
    params.set("difficulty", effectiveDifficulty);
    params.set("opponent", state.opponentId);
    params.set("questionCount", String(state.questionCount));
    params.set("timePerQuestionSec", String(state.timePerQuestionSec));
    params.set("hints", state.hints ? "1" : "0");
    params.set("reviewAfter", state.reviewAfter ? "1" : "0");
    params.set("elo", String(elo));
    if (state.opponentId === "friend") {
      params.set("roomAction", state.roomAction);
      if (state.roomCode) params.set("roomCode", state.roomCode);
    }

    notifyIsland({
      title: "Entering arena",
      message: summary,
      kind: "info",
      durationMs: 2400,
    });

    onClose();
    window.setTimeout(() => router.push(`/battle/arena?${params.toString()}`), 0);
  };

  return (
    <div className="studiumModal" role="dialog" aria-modal="true" aria-label="Battle setup">
      <div className="studiumModalOverlay" onPointerDown={onClose} aria-hidden="true" />

      <div className="studiumModalPanel" onPointerDown={(e) => e.stopPropagation()}>
        <div className="studiumModalTop">
          <div className="studiumModalTitleWrap">
            <div className="studiumModalKicker">BATTLE SETUP</div>
            <div className="studiumModalTitle">{title}</div>
            {subtitle ? <div className="studiumModalSubtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="studiumModalClose" onClick={onClose} aria-label="Close popup">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="studiumModalBody">
          <div className="grid gap-3">
            <div className="text-xs font-[900] text-white/60">Material</div>
            <div className="grid grid-cols-1 gap-2">
              {config.materials.map((m: any, idx: number) => {
                const active = state.materialId === String(m.id);
                return (
                  <button
                    key={String(m.id)}
                    type="button"
                    data-autofocus={idx === 0 ? "1" : undefined}
                    className={[
                      "rounded-2xl border px-3 py-3 text-left",
                      active ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/80 hover:bg-black/35",
                    ].join(" ")}
                    onClick={() => setState((s) => (s ? { ...s, materialId: String(m.id) } : s))}
                    aria-pressed={active}
                    aria-label={`Select material ${String(m.label)}`}
                  >
                    <div className="text-sm font-[900]">{String(m.label)}</div>
                    <div className="text-xs font-[800] text-white/60">{String(m.description || "")}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="text-xs font-[900] text-white/60">Hardness</div>
            <div className="flex flex-wrap items-center gap-2">
              {(["easy", "medium", "hard"] as DifficultyId[]).map((d) => {
                const active = effectiveDifficulty === d;
                const disabled = lockDifficulty;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    className={[
                      "rounded-xl border px-3 py-2 text-xs font-[900]",
                      active ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                      disabled ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                    onClick={() => setState((s) => (s ? { ...s, difficultyId: d } : s))}
                    aria-pressed={active}
                    aria-label={`Select difficulty ${d}`}
                  >
                    {d.toUpperCase()}
                  </button>
                );
              })}
              {lockDifficulty ? <div className="text-xs font-[900] text-white/55">Auto from ELO: {elo}</div> : null}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="text-xs font-[900] text-white/60">Match with</div>
            <div className="flex flex-wrap items-center gap-2">
              {(allowedOpponentIds.filter((id) => id === "bot" || id === "random" || id === "friend") as OpponentId[]).map((o) => {
                const active = state.opponentId === o;
                const disabled = lockOpponent && o !== (String(modeCfg.defaults?.opponentId || "random") as OpponentId);
                const meta = config.opponents.find((x: any) => String(x?.id) === String(o));
                const label = String(meta?.label || o);
                const desc = String(meta?.description || "");
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={disabled}
                    className={[
                      "rounded-xl border px-3 py-2 text-xs font-[900]",
                      active ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                      disabled ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                    onClick={() => setState((s) => (s ? { ...s, opponentId: o } : s))}
                    aria-pressed={active}
                    aria-label={`Select opponent ${label}`}
                    title={desc}
                  >
                    {o === "bot" ? "BOT" : o === "random" ? "REAL" : "ROOM"}
                  </button>
                );
              })}
              {mode === "ranked" ? <div className="text-xs font-[900] text-white/55">Mock: fights a bot</div> : null}
            </div>

            {state.opponentId === "friend" ? (
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {roomLockedAction === null ? (
                    <>
                      <button
                        type="button"
                        className={[
                          "rounded-xl border px-3 py-2 text-xs font-[900]",
                          state.roomAction === "make" ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                        ].join(" ")}
                        onClick={() => setState((s) => (s ? { ...s, roomAction: "make" } : s))}
                        aria-pressed={state.roomAction === "make"}
                        aria-label="Make a room (mock)"
                      >
                        Make room
                      </button>
                      <button
                        type="button"
                        className={[
                          "rounded-xl border px-3 py-2 text-xs font-[900]",
                          state.roomAction === "join" ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                        ].join(" ")}
                        onClick={() => setState((s) => (s ? { ...s, roomAction: "join" } : s))}
                        aria-pressed={state.roomAction === "join"}
                        aria-label="Join a room (mock)"
                      >
                        Join room
                      </button>
                    </>
                  ) : (
                    <div className="text-xs font-[900] text-white/70">
                      {roomLockedAction === "make" ? "Create a room ID" : "Enter a room ID"}
                    </div>
                  )}
                  <div className="text-xs font-[900] text-white/55">Mock only (no networking)</div>
                </div>

                {state.roomAction === "make" ? (
                  <div className="grid gap-1">
                    <div className="text-xs font-[900] text-white/60">Room ID</div>
                    <input className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm font-[900] text-white/90" value={state.roomCode} readOnly />
                  </div>
                ) : (
                  <div className="grid gap-1">
                    <div className="text-xs font-[900] text-white/60">Enter room ID</div>
                    <input
                      className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm font-[900] text-white/90"
                      value={state.roomCode}
                      onChange={(e) => setState((s) => (s ? { ...s, roomCode: e.target.value } : s))}
                      placeholder="RMXXXXXX"
                      aria-label="Room ID"
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            <div className="text-xs font-[900] text-white/60">Rules</div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-[900] text-white/60">Questions</div>
                <div className="flex flex-wrap gap-2">
                  {(config.rules.questionCounts || [5, 10, 15]).map((n: number) => {
                    const active = state.questionCount === Number(n);
                    return (
                      <button
                        key={String(n)}
                        type="button"
                        disabled={lockCount}
                        className={[
                          "rounded-xl border px-3 py-2 text-xs font-[900]",
                          active ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                          lockCount ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                        onClick={() => setState((s) => (s ? { ...s, questionCount: Number(n) } : s))}
                        aria-pressed={active}
                        aria-label={`Set question count to ${n}`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-[900] text-white/60">Time / question</div>
                <div className="flex flex-wrap gap-2">
                  {(config.rules.timePerQuestionSec || [0, 30, 60]).map((n: number) => {
                    const active = state.timePerQuestionSec === Number(n);
                    const label = Number(n) === 0 ? "Untimed" : `${n}s`;
                    return (
                      <button
                        key={String(n)}
                        type="button"
                        disabled={lockTime}
                        className={[
                          "rounded-xl border px-3 py-2 text-xs font-[900]",
                          active ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                          lockTime ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                        onClick={() => setState((s) => (s ? { ...s, timePerQuestionSec: Number(n) } : s))}
                        aria-pressed={active}
                        aria-label={`Set time per question to ${label}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={lockHints}
                className={[
                  "rounded-2xl border px-3 py-3 text-left",
                  state.hints ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                  lockHints ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                onClick={() => setState((s) => (s ? { ...s, hints: !s.hints } : s))}
                aria-pressed={state.hints}
                aria-label="Toggle hints"
              >
                <div className="text-sm font-[900]">Hints</div>
                <div className="text-xs font-[800] text-white/60">{state.hints ? "On" : "Off"}</div>
              </button>

              <button
                type="button"
                disabled={lockReview}
                className={[
                  "rounded-2xl border px-3 py-3 text-left",
                  state.reviewAfter ? "border-white/18 bg-white/10 text-white/90" : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                  lockReview ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                onClick={() => setState((s) => (s ? { ...s, reviewAfter: !s.reviewAfter } : s))}
                aria-pressed={state.reviewAfter}
                aria-label="Toggle review after"
              >
                <div className="text-sm font-[900]">Review after</div>
                <div className="text-xs font-[800] text-white/60">{state.reviewAfter ? "On" : "Off"}</div>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0">
              <div className="text-xs font-[900] text-white/60">Summary</div>
              <div className="truncate text-sm font-[900] text-white/90">{summary}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/40"
                onClick={onClose}
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/18 bg-white/10 px-3 py-2 text-xs font-[900] text-white/90 hover:bg-white/15"
                onClick={start}
                aria-label={startLabel}
              >
                {startLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
