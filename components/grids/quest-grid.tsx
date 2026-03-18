"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import styles from "./quest-grid.module.css";
import type { Quest, QuestPriority, QuestStage, QuestType } from "./planner-storage";
import type { PlannerEvent } from "./planner-storage";
import { addQuest, createQuest, deleteQuest, loadEvents, loadQuests, onPlannerUpdated, toggleStageDone } from "./planner-storage";

function formatShort(dt?: string) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { month: "short", day: "2-digit" });
}

function normalizePriority(p?: QuestPriority): QuestPriority {
  return p ?? "medium";
}

function priorityLabel(p: QuestPriority) {
  if (p === "high") return "High";
  if (p === "low") return "Low";
  return "Medium";
}

function typeLabel(t: QuestType) {
  if (t === "assignment") return "Assignment";
  if (t === "exam") return "Exam";
  return "Routine";
}

function rankFrom(type: QuestType, priority: QuestPriority) {
  const base = type === "exam" ? 2 : type === "assignment" ? 1 : 0; // C,B,A,S -> 0..3
  const delta = priority === "high" ? 1 : priority === "low" ? -1 : 0;
  const idx = Math.max(0, Math.min(3, base + delta));
  return (["C", "B", "A", "S"] as const)[idx];
}

function xpPotential(type: QuestType, priority: QuestPriority, stagesCount: number) {
  const base = type === "exam" ? 220 : type === "assignment" ? 180 : 120;
  const mult = priority === "high" ? 1.2 : priority === "low" ? 0.9 : 1.0;
  const raw = base * mult + Math.max(0, stagesCount) * 10;
  return Math.round(raw / 5) * 5;
}

function questProgress(q: Quest) {
  const total = q.stages.length || 1;
  const done = q.stages.filter((s) => s.done).length;
  return Math.round((done / total) * 100);
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseLocalDateTime(value: string) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec((value || "").trim());
  if (!m) return { date: "", hour: "09", minute: "00" };
  const hour = clampInt(Number(m[2]), 0, 23);
  const minute = clampInt(Number(m[3]), 0, 59);
  return { date: m[1] as string, hour: String(hour).padStart(2, "0"), minute: String(minute).padStart(2, "0") };
}

function formatDateLabel(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Pick date";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

type FancyOption = { value: string; label: string; hint?: string };

function FancySelect({
  value,
  options,
  onChange,
  ariaLabel,
  focusKey,
}: {
  value: string;
  options: FancyOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
  focusKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectIdx = (idx: number) => {
    const next = options[Math.max(0, Math.min(options.length - 1, idx))];
    if (!next) return;
    onChange(next.value);
  };

  return (
    <div ref={wrapRef} className={styles.fancySelect} data-open={open ? "1" : "0"}>
      <button
        type="button"
        className={styles.fancyBtn}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const idx = Math.max(0, options.findIndex((o) => o.value === value));
            selectIdx(idx + 1);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            const idx = Math.max(0, options.findIndex((o) => o.value === value));
            selectIdx(idx - 1);
            return;
          }
        }}
        data-focus={focusKey}
      >
        <span className={styles.fancyValue}>{selected?.label ?? "Select"}</span>
        <i className={["fa-solid fa-chevron-down", styles.fancyChevron].join(" ")} aria-hidden="true"></i>
      </button>

      {open ? (
        <div className={styles.fancyMenu} role="listbox" aria-label={ariaLabel}>
          {options.map((o) => {
            const isSel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={styles.fancyOpt}
                role="option"
                aria-selected={isSel}
                data-selected={isSel ? "1" : "0"}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className={styles.fancyOptMain}>
                  <span className={styles.fancyOptLabel}>{o.label}</span>
                  {o.hint ? <span className={styles.fancyOptHint}>{o.hint}</span> : null}
                </span>
                {isSel ? <i className={["fa-solid fa-check", styles.fancyCheck].join(" ")} aria-hidden="true"></i> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function DatePicker({
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(value ? new Date(`${value}T00:00:00`) : new Date()));
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const syncPos = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const desiredW = Math.max(320, rect.width);
    const maxLeft = Math.max(16, window.innerWidth - desiredW - 16);
    const left = Math.max(16, Math.min(rect.left, maxLeft));
    const top = rect.bottom + 10;
    setPos({ left, top, width: desiredW });
  }, []);

  useEffect(() => {
    if (!open) return;
    syncPos();
  }, [open, syncPos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (wrapRef.current?.contains(t) || menuRef.current?.contains(t))) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => syncPos();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, syncPos]);

  useEffect(() => {
    if (!open) return;
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    if (Number.isNaN(base.getTime())) return;
    setMonth(monthStart(base));
  }, [open, value]);

  const selected = value;
  const first = monthStart(month);
  const startDow = (first.getDay() + 6) % 7; // Monday=0
  const gridStart = addDays(first, -startDow);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div ref={wrapRef} className={styles.datePicker} data-open={open ? "1" : "0"}>
      <button
        ref={btnRef}
        type="button"
        className={styles.dateBtn}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        disabled={disabled}
      >
        <span className={styles.dateValue}>{value ? formatDateLabel(value) : "Pick date"}</span>
        <i className={["fa-solid fa-calendar-days", styles.dateIcon].join(" ")} aria-hidden="true"></i>
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.dateMenu}
              role="dialog"
              aria-label="Choose date"
              style={{ left: pos.left, top: pos.top, width: pos.width }}
            >
              <div className={styles.dateQuick} aria-label="Quick dates">
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => {
                    onChange(isoDateKey(new Date()));
                    setOpen(false);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => {
                    onChange(isoDateKey(addDays(new Date(), 1)));
                    setOpen(false);
                  }}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => {
                    onChange(isoDateKey(addDays(new Date(), 7)));
                    setOpen(false);
                  }}
                >
                  +7 days
                </button>
              </div>

              <div className={styles.calHead} aria-label="Month selector">
                <button
                  type="button"
                  className={styles.iconBtnMini}
                  onClick={() => setMonth((m) => monthStart(addDays(m, -1)))}
                  aria-label="Previous month"
                >
                  <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
                </button>
                <div className={styles.calTitle}>{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                <button type="button" className={styles.iconBtnMini} onClick={() => setMonth((m) => monthStart(addDays(m, 32)))} aria-label="Next month">
                  <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
              </div>

              <div className={styles.calDow} aria-hidden="true">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className={styles.calDowCell}>
                    {d}
                  </div>
                ))}
              </div>

              <div className={styles.calGrid} aria-label="Calendar grid">
                {days.map((d) => {
                  const key = isoDateKey(d);
                  const inMonth = d.getMonth() === first.getMonth();
                  const isSel = selected && key === selected;
                  const isToday = key === isoDateKey(new Date());
                  return (
                    <button
                      key={key}
                      type="button"
                      className={styles.calDay}
                      data-muted={!inMonth ? "1" : "0"}
                      data-selected={isSel ? "1" : "0"}
                      data-today={isToday ? "1" : "0"}
                      onClick={() => {
                        onChange(key);
                        setOpen(false);
                      }}
                      aria-label={`Select ${d.toDateString()}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function scrollNearest(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    // ignore
  }
}

type QuestView = "hub" | "detail";
type DetailMode = "board" | "table" | "list";
type DetailFilter = "all" | "remaining" | "done" | "dueSoon" | "overdue";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "neutral";
  details?: string[];
  hint?: string;
  onConfirm: () => void;
};

export default function QuestGrid() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<QuestView>("hub");

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [type, setType] = useState<QuestType>("assignment");
  const [priority, setPriority] = useState<QuestPriority>("medium");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [duePreset, setDuePreset] = useState<"none" | "custom">("none");
  const titleRef = useRef<HTMLInputElement | null>(null);
  const didViewAutofocus = useRef(false);

  const [detailMode, setDetailMode] = useState<DetailMode>("board");
  const [detailFilter, setDetailFilter] = useState<DetailFilter>("all");
  const [detailQuery, setDetailQuery] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const [toasts, setToasts] = useState<Array<{ id: string; title: string; body?: string }>>([]);
  const [drag, setDrag] = useState<{
    stageId: string;
    title: string;
    done: boolean;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [dropCol, setDropCol] = useState<"todo" | "done" | null>(null);
  const suppressClickRef = useRef<{ id: string; until: number } | null>(null);
  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const q = loadQuests();
      const e = loadEvents();
      setQuests(q);
      setEvents(e);
      setSelectedId((prev) => {
        if (!prev && q[0]) return q[0].id;
        if (prev && !q.some((x) => x.id === prev)) return q[0]?.id ?? null;
        return prev;
      });
    };
    sync();
    return onPlannerUpdated(sync);
  }, []);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const questId = params.get("quest");
      const detail = params.get("detail");
      if (questId) setSelectedId(questId);
      if (questId && detail === "1") setView("detail");
    } catch {
      // ignore
    }
  }, []);

  const selected = useMemo(() => quests.find((q) => q.id === selectedId) ?? null, [quests, selectedId]);

  const selectedMeta = useMemo(() => {
    if (!selected) return null;
    const p = normalizePriority(selected.priority);
    const progress = questProgress(selected);
    const potential = xpPotential(selected.type, p, selected.stages.length);
    const earned = Math.round((potential * progress) / 100);
    return { p, progress, rank: rankFrom(selected.type, p), potential, earned };
  }, [selected]);

  useLayoutEffect(() => {
    if (view === "detail") document.body.classList.add("quest-detail");
    else document.body.classList.remove("quest-detail");
    return () => document.body.classList.remove("quest-detail");
  }, [view]);

  useEffect(() => {
    if (view !== "detail") return;
    const prefersCompact = window.matchMedia?.("(max-width: 640px)")?.matches ?? false;
    setDetailMode(prefersCompact ? "list" : "board");
    setDetailFilter("all");
    setDetailQuery("");
  }, [view, selectedId]);

  const notify = useCallback((title: string, body?: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [{ id, title, body }, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  useEffect(() => {
    if (view !== "detail") return;
    try {
      const k = "studium.quest.detail.tip.v1";
      if (window.localStorage.getItem(k) !== "1") {
        notify("Tip", "Drag objectives between To do ↔ Done");
        window.localStorage.setItem(k, "1");
      }
    } catch {
      // ignore
    }
  }, [view, notify]);

  useEffect(() => {
    if (!didViewAutofocus.current) {
      didViewAutofocus.current = true;
      return;
    }

    const raf = requestAnimationFrame(() => {
      const root = document.getElementById("routeOutlet");
      const selector = view === "detail" ? '[data-focus="quest.back"]' : '[data-focus="quest.slot1"], [data-focus="quest.generate"]';
      const el = root?.querySelector?.(selector) as HTMLElement | null;
      el?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [view]);

  useEffect(() => {
    (window as any).questDetailApi = (window as any).questDetailApi || {};
    if (view === "detail") {
      (window as any).questDetailApi.back = () => setView("hub");
    } else if ((window as any).questDetailApi?.back) {
      delete (window as any).questDetailApi.back;
    }
    return () => {
      if ((window as any).questDetailApi?.back) delete (window as any).questDetailApi.back;
    };
  }, [view]);

  useEffect(() => {
    if (!generatorOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGeneratorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generatorOpen]);

  useEffect(() => {
    if (!confirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirm(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm]);

  useEffect(() => {
    if (!generatorOpen) return;
    document.body.classList.add("modal-open");
    const api = { close: () => setGeneratorOpen(false) };
    (window as any).studiumModalApi = api;

    const raf = requestAnimationFrame(() => titleRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("modal-open");
      if ((window as any).studiumModalApi === api) delete (window as any).studiumModalApi;
    };
  }, [generatorOpen]);

  useEffect(() => {
    if (!generatorOpen) return;
    setDuePreset(dueAt ? "custom" : "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatorOpen]);

  const submit = () => {
    const { quest, events } = createQuest({ type, priority, title, context, dueAt: dueAt || undefined });
    addQuest(quest, events);
    setSelectedId(quest.id);
    setTitle("");
    setContext("");
    setDueAt("");
    setDuePreset("none");
    setPriority("medium");
    setGeneratorOpen(false);
  };

  const hourOptions = useMemo<FancyOption[]>(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const v = String(i).padStart(2, "0");
        return { value: v, label: v, hint: i < 12 ? "AM" : "PM" };
      }),
    []
  );

  const minuteOptions = useMemo<FancyOption[]>(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const v = String(i).padStart(2, "0");
        return { value: v, label: v };
      }),
    []
  );

  const detailFilterOptions = useMemo<FancyOption[]>(
    () => [
      { value: "all", label: "All", hint: "Everything" },
      { value: "remaining", label: "Remaining", hint: "Not done yet" },
      { value: "done", label: "Done", hint: "Completed only" },
      { value: "dueSoon", label: "Due soon", hint: "Next 3 days" },
      { value: "overdue", label: "Overdue", hint: "Past due date" },
    ],
    []
  );

  const dueParts = useMemo(() => parseLocalDateTime(dueAt), [dueAt]);

  const openDetail = () => {
    if (!selected) return;
    const anyDoc = document as any;
    if (typeof anyDoc?.startViewTransition === "function") anyDoc.startViewTransition(() => setView("detail"));
    else setView("detail");
  };

  const completed = selected ? selected.stages.every((s) => s.done) : false;
  const questEvents = useMemo(() => {
    if (!selected) return [];
    return events
      .filter((e) => e.questId === selected.id)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [events, selected]);

  const stageXp = selected && selectedMeta ? Math.max(10, Math.round(selectedMeta.potential / Math.max(1, selected.stages.length))) : 10;

  const filteredStages = useMemo(() => {
    const q = detailQuery.trim().toLowerCase();
    const now = Date.now();
    const soonCutoff = now + 3 * 24 * 60 * 60 * 1000;

    const matchesQuery = (s: QuestStage) => (q ? s.title.toLowerCase().includes(q) : true);
    const dueTs = (s: QuestStage) => (s.dueAt ? new Date(s.dueAt).getTime() : Number.POSITIVE_INFINITY);
    const isOverdue = (s: QuestStage) => !s.done && Number.isFinite(dueTs(s)) && dueTs(s) < now;
    const isDueSoon = (s: QuestStage) => !s.done && Number.isFinite(dueTs(s)) && dueTs(s) >= now && dueTs(s) <= soonCutoff;

    const base = selected?.stages ?? [];
    const afterQuery = base.filter(matchesQuery);

    const applyFilter = (s: QuestStage) => {
      if (detailFilter === "remaining") return !s.done;
      if (detailFilter === "done") return s.done;
      if (detailFilter === "overdue") return isOverdue(s);
      if (detailFilter === "dueSoon") return isDueSoon(s);
      return true;
    };

    const list = afterQuery.filter(applyFilter);
    const remaining = list.filter((s) => !s.done).sort((a, b) => dueTs(a) - dueTs(b));
    const done = list.filter((s) => s.done).sort((a, b) => dueTs(a) - dueTs(b));

    const nextUp = remaining.slice(0, 4).map((s) => s.id);
    const next = remaining.filter((s) => nextUp.includes(s.id));
    const todo = remaining.filter((s) => !nextUp.includes(s.id));

    return { list, remaining, done, next, todo };
  }, [selected, detailFilter, detailQuery]);

  useEffect(() => {
    if (view !== "detail") return;
    // Keep the ambient background static (no cursor-follow blur), to avoid distraction and performance issues.
    return;
  }, [view]);

  const beginDrag = (e: ReactPointerEvent, s: QuestStage) => {
    if (view !== "detail" || detailMode !== "board") return;
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement | null;
    if (!target) return;

    let startTimer = 0;
    let dragging = false;
    let currentDrop: "todo" | "done" | null = null;
    const pointerType = e.pointerType;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = target.getBoundingClientRect();
    const dx = startX - rect.left;
    const dy = startY - rect.top;

    const cleanup = () => {
      if (startTimer) window.clearTimeout(startTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    };

    const startDragging = (x: number, y: number) => {
      dragging = true;
      suppressClickRef.current = { id: s.id, until: performance.now() + 900 };
      setDrag({ stageId: s.id, title: s.title, done: s.done, x, y, dx, dy });
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        const dxm = ev.clientX - startX;
        const dym = ev.clientY - startY;
        const dist = Math.hypot(dxm, dym);
        // Mouse/pen: drag should start immediately on a small movement.
        if (pointerType !== "touch" && dist > 4) {
          startDragging(ev.clientX, ev.clientY);
        } else if (pointerType === "touch" && dist > 10) {
          // Touch: if the user moves before long-press, treat it as a scroll/gesture and cancel.
          cleanup();
        }
        return;
      }

      if (ev.cancelable) ev.preventDefault();
      setDrag((prev) => (prev ? { ...prev, x: ev.clientX, y: ev.clientY } : prev));

      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const col = el?.closest?.("[data-drop-col]")?.getAttribute?.("data-drop-col") as "todo" | "done" | null;
      currentDrop = col;
      setDropCol(col);
    };

    const onUp = () => {
      cleanup();
      if (dragging && selected) {
        if (currentDrop === "done" && !s.done) {
          toggleStageDone(selected.id, s.id);
          notify("Objective completed", `+${stageXp} XP`);
        } else if (currentDrop === "todo" && s.done) {
          toggleStageDone(selected.id, s.id);
          notify("Moved back to To do");
        } else if (currentDrop) {
          notify("Dropped");
        }
      }
      setDropCol(null);
      setDrag(null);
    };

    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      // ignore
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });

    if (pointerType === "touch") {
      startTimer = window.setTimeout(() => startDragging(startX, startY), 180);
    }
  };

  const onTaskClick = (s: QuestStage) => {
    if (!selected) return;
    const sup = suppressClickRef.current;
    if (sup && sup.id === s.id && performance.now() < sup.until) {
      suppressClickRef.current = null;
      return;
    }
    toggleStageDone(selected.id, s.id);
    notify(s.done ? "Moved back to To do" : "Objective completed", s.done ? undefined : `+${stageXp} XP`);
  };

  return (
    <div className={[styles.page, view === "detail" ? styles.pageDetail : ""].join(" ")} aria-label="Quest page">
      {view === "hub" ? (
        <div className={styles.hub} aria-label="Quest hub">
          <div className={styles.topBar}>
            <div className={styles.brand}>
              <div className={styles.brandTitle}>Quest</div>
              <div className={styles.brandSub}>Pick a mission, set priority, then execute.</div>
            </div>
            <button
              className={styles.actionBtn}
              type="button"
              onClick={() => setGeneratorOpen(true)}
              aria-label="Generate quest"
              data-focus="quest.generate"
            >
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
              Generate quest
            </button>
          </div>

          <div className={styles.hubBody}>
            <section className={styles.left} aria-label="Mission list">
              <div className={styles.sectionHead}>
                <div className={styles.sectionTitle}>
                  <i className="fa-solid fa-list-check" aria-hidden="true"></i>
                  Missions
                </div>
                <div className={styles.sectionMeta}>{quests.length} total</div>
              </div>
              <div className={styles.missionList}>
                {quests.length === 0 ? (
                  <div className={styles.emptyCard}>
                    <div className={styles.emptyTitle}>No missions yet</div>
                    <div className={styles.emptySub}>Generate a quest to get auto objectives + schedule milestones.</div>
                    <button className={styles.actionBtn} type="button" onClick={() => setGeneratorOpen(true)} data-focus="quest.generate">
                      Generate quest
                    </button>
                  </div>
                ) : null}

                {quests.map((q, idx) => {
                  const p = normalizePriority(q.priority);
                  const progress = questProgress(q);
                  const rank = rankFrom(q.type, p);
                  const isSelected = q.id === selectedId;
                  const isDone = q.stages.every((s) => s.done);
                  const focusKey = idx === 0 ? "quest.slot1" : `quest.mission${idx + 1}`;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={styles.mission}
                      data-type={q.type}
                      data-selected={isSelected ? "1" : "0"}
                      data-done={isDone ? "1" : "0"}
                      onClick={() => setSelectedId(q.id)}
                      onFocus={(e) => {
                        setSelectedId(q.id);
                        scrollNearest(e.currentTarget);
                      }}
                      data-focus={focusKey}
                      aria-label={`Select mission ${q.title}`}
                    >
                      <div className={styles.missionMain}>
                        <div className={styles.missionTitle}>{q.title}</div>
                        <div className={styles.missionMeta}>
                          <span className={styles.pill} data-rank={rank}>
                            Rank {rank}
                          </span>
                          <span className={styles.pill} data-priority={p}>
                            {priorityLabel(p)}
                          </span>
                          <span className={styles.pill}>Due {formatShort(q.dueAt)}</span>
                          {isDone ? <span className={styles.pill} data-done="1">Completed</span> : null}
                        </div>
                      </div>
                      <div className={styles.missionProgress} aria-hidden="true">
                        <div className={styles.rail}>
                          <div className={styles.fill} style={{ width: `${progress}%` }} />
                        </div>
                        <div className={styles.pct}>{progress}%</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.right} aria-label="Selected mission">
              {selected && selectedMeta ? (
                <div className={styles.focusCard} data-type={selected.type} data-priority={selectedMeta.p}>
                  <div className={styles.focusTop}>
                    <div>
                      <div className={styles.focusKicker}>
                        <i className="fa-solid fa-crosshairs" aria-hidden="true"></i>
                        Selected mission
                      </div>
                      <div className={styles.focusTitle}>{selected.title}</div>
                      <div className={styles.focusSub}>
                        {typeLabel(selected.type)} | Rank {selectedMeta.rank} | {priorityLabel(selectedMeta.p)} priority
                      </div>
                    </div>
                    <button
                      className={styles.primaryBtn}
                      type="button"
                      onClick={openDetail}
                      aria-label="Open mission details"
                      data-focus="quest.open"
                    >
                      Open
                      <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                    </button>
                  </div>

                  <div className={styles.focusStats} aria-hidden="true">
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>Progress</div>
                      <div className={styles.statValue}>{selectedMeta.progress}%</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>XP</div>
                      <div className={styles.statValue}>
                        {selectedMeta.earned}/{selectedMeta.potential}
                      </div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>Due</div>
                      <div className={styles.statValue}>{formatShort(selected.dueAt)}</div>
                    </div>
                  </div>

                  <div className={styles.focusBar} aria-hidden="true">
                    <div className={styles.rail}>
                      <div className={styles.fill} style={{ width: `${selectedMeta.progress}%` }} />
                    </div>
                  </div>

                  <div className={styles.peek}>
                    <div className={styles.peekHead}>
                      <div className={styles.peekTitle}>Objectives</div>
                      <div className={styles.peekMeta}>{selected.stages.filter((s) => s.done).length}/{selected.stages.length}</div>
                    </div>
                    <div className={styles.peekList}>
                      {selected.stages.slice(0, 5).map((s) => (
                        <div key={s.id} className={styles.peekItem} data-done={s.done ? "1" : "0"}>
                          <span className={styles.peekDot} aria-hidden="true" />
                          <span className={styles.peekText}>{s.title}</span>
                        </div>
                      ))}
                      {selected.stages.length > 5 ? <div className={styles.peekMore}>+{selected.stages.length - 5} more…</div> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyCard}>
                  <div className={styles.emptyTitle}>Select a mission</div>
                  <div className={styles.emptySub}>Choose a mission on the left to see details.</div>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className={styles.detail} aria-label="Mission details page">
          {selected && selectedMeta ? (
            <div className={styles.detailLayout} aria-label="Quest detail workspace">
              <header className={styles.detailHeader} aria-label="Quest detail toolbar">
                <div className={styles.headerLeft}>
                  <div className={styles.detailTitleRow}>
                    <button
                      className={styles.fabBack}
                      type="button"
                      onClick={() => {
                        const anyDoc = document as any;
                        if (typeof anyDoc?.startViewTransition === "function") anyDoc.startViewTransition(() => setView("hub"));
                        else setView("hub");
                      }}
                      aria-label="Back to quest hub"
                      data-focus="quest.back"
                    >
                      <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                      <span className={styles.backText}>Back</span>
                    </button>

                    <div className={styles.kanbanTitle}>{selected.title}</div>
                  </div>
                  <div className={styles.kanbanMeta}>
                    <span className={styles.pill} data-rank={selectedMeta.rank}>
                      Rank {selectedMeta.rank}
                    </span>
                    <span className={styles.pill} data-priority={selectedMeta.p}>
                      {priorityLabel(selectedMeta.p)}
                    </span>
                    <span className={styles.pill}>Due {formatShort(selected.dueAt)}</span>
                    <span className={styles.pill}>
                      XP {selectedMeta.earned}/{selectedMeta.potential}
                    </span>
                    {completed ? (
                      <span className={styles.pill} data-done="1">
                        Completed
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className={styles.headerRight}>
                  <div className={styles.segmented} role="tablist" aria-label="Detail view mode">
                    <button
                      type="button"
                      className={styles.segBtn}
                      data-active={detailMode === "board" ? "1" : "0"}
                      onClick={() => setDetailMode("board")}
                      aria-label="Board view"
                      data-focus="quest.view.board"
                    >
                      <i className="fa-solid fa-columns" aria-hidden="true"></i>
                      Board
                    </button>
                    <button
                      type="button"
                      className={styles.segBtn}
                      data-active={detailMode === "table" ? "1" : "0"}
                      onClick={() => setDetailMode("table")}
                      aria-label="Table view"
                      data-focus="quest.view.table"
                    >
                      <i className="fa-solid fa-table" aria-hidden="true"></i>
                      Table
                    </button>
                    <button
                      type="button"
                      className={styles.segBtn}
                      data-active={detailMode === "list" ? "1" : "0"}
                      onClick={() => setDetailMode("list")}
                      aria-label="List view"
                      data-focus="quest.view.list"
                    >
                      <i className="fa-solid fa-list-check" aria-hidden="true"></i>
                      List
                    </button>
                  </div>

                  <div className={styles.detailFilter} aria-label="Filter control">
                    <FancySelect
                      value={detailFilter}
                      options={detailFilterOptions}
                      onChange={(v) => setDetailFilter(v as DetailFilter)}
                      ariaLabel="Filter objectives"
                      focusKey="quest.filter"
                    />
                  </div>

                  <div className={styles.search}>
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    <input
                      className={styles.searchInput}
                      value={detailQuery}
                      onChange={(e) => setDetailQuery(e.target.value)}
                      placeholder="Search objectives…"
                      aria-label="Search objectives"
                      data-focus="quest.search"
                    />
                  </div>
                </div>
              </header>

              <main className={styles.detailMain} aria-label="Quest detail content">
                {detailMode === "board" ? (
                  <div className={styles.board} aria-label="Kanban board">
                    {detailFilter === "done" ? null : (
                      <>
                        <section className={styles.col} aria-label="Next up" data-drop-col="todo" data-drop-active={dropCol === "todo" ? "1" : "0"}>
                          <div className={styles.colHead}>
                            <div className={styles.colTitle}>Next up</div>
                            <div className={styles.colCount}>{filteredStages.next.length}</div>
                          </div>
                          <div className={styles.colBody}>
                            {filteredStages.next.length === 0 ? <div className={styles.colEmpty}>Nothing due soon.</div> : null}
                            {filteredStages.next.map((s, idx) => (
                              <button
                                key={s.id}
                                type="button"
                                className={styles.taskCard}
                                data-state="todo"
                                onClick={() => onTaskClick(s)}
                                aria-label={`Mark ${s.title} as done`}
                                data-focus={`quest.next.${idx + 1}`}
                                onFocus={(e) => scrollNearest(e.currentTarget)}
                                onPointerDown={(e) => beginDrag(e, s)}
                                data-dragging={drag?.stageId === s.id ? "1" : "0"}
                              >
                                <div className={styles.taskTop}>
                                  <span className={styles.taskCheck} aria-hidden="true" data-state="todo" />
                                  <div className={styles.taskTitle}>{s.title}</div>
                                  <div className={styles.taskXp}>+{stageXp}</div>
                                </div>
                                <div className={styles.taskMeta}>Target {formatShort(s.dueAt)}</div>
                              </button>
                            ))}
                          </div>
                        </section>

                        <section className={styles.col} aria-label="To do" data-drop-col="todo" data-drop-active={dropCol === "todo" ? "1" : "0"}>
                          <div className={styles.colHead}>
                            <div className={styles.colTitle}>To do</div>
                            <div className={styles.colCount}>{filteredStages.todo.length}</div>
                          </div>
                          <div className={styles.colBody}>
                            {filteredStages.todo.length === 0 ? <div className={styles.colEmpty}>All clear.</div> : null}
                            {filteredStages.todo.map((s, idx) => (
                              <button
                                key={s.id}
                                type="button"
                                className={styles.taskCard}
                                data-state="todo"
                                onClick={() => onTaskClick(s)}
                                aria-label={`Mark ${s.title} as done`}
                                data-focus={`quest.todo.${idx + 1}`}
                                onFocus={(e) => scrollNearest(e.currentTarget)}
                                onPointerDown={(e) => beginDrag(e, s)}
                                data-dragging={drag?.stageId === s.id ? "1" : "0"}
                              >
                                <div className={styles.taskTop}>
                                  <span className={styles.taskCheck} aria-hidden="true" data-state="todo" />
                                  <div className={styles.taskTitle}>{s.title}</div>
                                  <div className={styles.taskXp}>+{stageXp}</div>
                                </div>
                                <div className={styles.taskMeta}>Target {formatShort(s.dueAt)}</div>
                              </button>
                            ))}
                          </div>
                        </section>
                      </>
                    )}

                    {detailFilter === "remaining" || detailFilter === "dueSoon" || detailFilter === "overdue" ? null : (
                      <section className={styles.col} aria-label="Done" data-drop-col="done" data-drop-active={dropCol === "done" ? "1" : "0"}>
                        <div className={styles.colHead}>
                          <div className={styles.colTitle}>Done</div>
                          <div className={styles.colCount}>{filteredStages.done.length}</div>
                        </div>
                        <div className={styles.colBody}>
                          {filteredStages.done.length === 0 ? <div className={styles.colEmpty}>No completed items yet.</div> : null}
                          {filteredStages.done.map((s, idx) => (
                            <button
                              key={s.id}
                              type="button"
                              className={styles.taskCard}
                              data-state="done"
                              onClick={() => onTaskClick(s)}
                              aria-label={`Mark ${s.title} as not done`}
                              data-focus={`quest.done.${idx + 1}`}
                              onFocus={(e) => scrollNearest(e.currentTarget)}
                              onPointerDown={(e) => beginDrag(e, s)}
                              data-dragging={drag?.stageId === s.id ? "1" : "0"}
                            >
                              <div className={styles.taskTop}>
                                <span className={styles.taskCheck} aria-hidden="true" data-state="done" />
                                <div className={styles.taskTitle}>{s.title}</div>
                                <div className={styles.taskXp}>+{stageXp}</div>
                              </div>
                              <div className={styles.taskMeta}>Completed</div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                ) : null}

                {detailMode === "table" ? (
                  <div className={styles.table} aria-label="Objectives table">
                    <div className={styles.tableHead} aria-hidden="true">
                      <div>Status</div>
                      <div>Objective</div>
                      <div>Due</div>
                      <div>XP</div>
                    </div>
                    {filteredStages.list.length === 0 ? <div className={styles.tableEmpty}>No objectives found.</div> : null}
                    {filteredStages.list.map((s, idx) => {
                      const status = s.done ? "Done" : filteredStages.next.some((x) => x.id === s.id) ? "Next" : "Todo";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={styles.tableRow}
                          onClick={() => toggleStageDone(selected.id, s.id)}
                          aria-label={`${s.done ? "Mark not done" : "Mark done"}: ${s.title}`}
                          data-focus={`quest.table.${idx + 1}`}
                          onFocus={(e) => scrollNearest(e.currentTarget)}
                          data-state={s.done ? "done" : "todo"}
                        >
                          <div className={styles.tableCell}>
                            <span className={styles.badge} data-badge={status.toLowerCase()}>
                              {status}
                            </span>
                          </div>
                          <div className={styles.tableCell}>
                            <span className={styles.rowCheck} aria-hidden="true" data-state={s.done ? "done" : "todo"} />
                            <span className={styles.rowTitle}>{s.title}</span>
                          </div>
                          <div className={styles.tableCell}>{s.done ? "—" : formatShort(s.dueAt)}</div>
                          <div className={styles.tableCell}>+{stageXp}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {detailMode === "list" ? (
                  <div className={styles.list} aria-label="Objectives list">
                    {filteredStages.list.length === 0 ? <div className={styles.listEmpty}>No objectives found.</div> : null}
                    {filteredStages.list.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        className={styles.listItem}
                        data-state={s.done ? "done" : "todo"}
                        onClick={() => toggleStageDone(selected.id, s.id)}
                        aria-label={`${s.done ? "Mark not done" : "Mark done"}: ${s.title}`}
                        data-focus={`quest.list.${idx + 1}`}
                        onFocus={(e) => scrollNearest(e.currentTarget)}
                      >
                        <span className={styles.rowCheck} aria-hidden="true" data-state={s.done ? "done" : "todo"} />
                        <span className={styles.rowTitle}>{s.title}</span>
                        <span className={styles.rowMeta}>{s.done ? "Done" : `Due ${formatShort(s.dueAt)}`}</span>
                        <span className={styles.rowXp}>+{stageXp}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </main>

              <aside className={styles.detailSide} aria-label="Mission info">
                {selected.context ? <div className={styles.noteCard}>{selected.context}</div> : null}
                <div className={styles.progressCard} aria-hidden="true">
                  <div className={styles.progressTop}>
                    <div className={styles.progressPct}>{selectedMeta.progress}%</div>
                    <div className={styles.progressHint}>Progress</div>
                  </div>
                  <div className={styles.rail}>
                    <div className={styles.fill} style={{ width: `${selectedMeta.progress}%` }} />
                  </div>
                </div>
                <div className={styles.sideCard}>
                  <div className={styles.sideTitle}>Schedule sync</div>
                  <div className={styles.sideHint}>Quest milestones are added to Schedule automatically. Completing the mission removes them.</div>
                  <div className={styles.sideRows}>
                    <div className={styles.sideRow}>
                      <span className={styles.sideLabel}>Planned</span>
                      <span className={styles.sideValue}>{questEvents.length} item(s)</span>
                    </div>
                    <div className={styles.sideRow}>
                      <span className={styles.sideLabel}>Next</span>
                      <span className={styles.sideValue}>{questEvents[0] ? formatShort(questEvents[0].startAt) : "-"}</span>
                    </div>
                  </div>
                </div>
                <button
                  className={styles.dangerBtn}
                  type="button"
                  onClick={() =>
                    setConfirm({
                      title: "Delete mission?",
                      message: `This removes “${selected.title}” and all its schedule milestones.`,
                      confirmLabel: "Delete",
                      tone: "danger",
                      details: [
                        "Objective progress will be removed.",
                        `Schedule will remove ${questEvents.length} milestone(s) tied to this mission.`,
                        "This action can’t be undone.",
                      ],
                      hint: "Tip: If you delete by accident, you can generate a new mission anytime.",
                      onConfirm: () => deleteQuest(selected.id),
                    })
                  }
                  aria-label="Delete mission"
                  data-focus="quest.delete"
                >
                  <i className="fa-solid fa-trash" aria-hidden="true"></i>
                  Delete mission
                </button>
              </aside>
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <div className={styles.emptyTitle}>No mission selected</div>
              <div className={styles.emptySub}>Go back and select a mission.</div>
            </div>
          )}

          {drag ? (
            <div className={styles.dragOverlay} aria-hidden="true">
              <div
                className={styles.dragGhost}
                style={{ left: `${drag.x - drag.dx}px`, top: `${drag.y - drag.dy}px` }}
                data-drop={dropCol || ""}
              >
                <div className={styles.dragTitle}>{drag.title}</div>
                <div className={styles.dragMeta}>{drag.done ? "Done" : "To do"}</div>
              </div>
            </div>
          ) : null}

          {toasts.length ? (
            <div className={styles.toastWrap} aria-live="polite" aria-label="Notifications">
              {toasts.map((t) => (
                <div key={t.id} className={styles.toast}>
                  <div className={styles.toastTitle}>{t.title}</div>
                  {t.body ? <div className={styles.toastBody}>{t.body}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {generatorOpen
        ? createPortal(
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Generate quest" onClick={() => setGeneratorOpen(false)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <div>
                    <div className={styles.modalTitle}>Generate quest</div>
                    <div className={styles.modalSub}>Auto creates objectives and schedule milestones.</div>
                  </div>
                  <button className={styles.iconBtn} type="button" onClick={() => setGeneratorOpen(false)} aria-label="Close generator">
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>

                <div className={styles.form}>
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <div className={styles.label}>Type</div>
                      <FancySelect
                        value={type}
                        ariaLabel="Quest type"
                        focusKey="quest.type"
                        options={[
                          { value: "assignment", label: "Assignment", hint: "Steps + milestones" },
                          { value: "exam", label: "Exam", hint: "High stakes" },
                          { value: "routine", label: "Daily routine", hint: "Repeatable" },
                        ]}
                        onChange={(v) => setType(v as QuestType)}
                      />
                    </div>
                    <div className={styles.field}>
                      <div className={styles.label}>Priority</div>
                      <FancySelect
                        value={priority}
                        ariaLabel="Quest priority"
                        focusKey="quest.priority"
                        options={[
                          { value: "low", label: "Low", hint: "Chill pace" },
                          { value: "medium", label: "Medium", hint: "Balanced" },
                          { value: "high", label: "High", hint: "Focus now" },
                        ]}
                        onChange={(v) => setPriority(v as QuestPriority)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.label}>Deadline</div>
                    <div className={styles.deadlineRow} aria-label="Deadline selector">
                      <FancySelect
                        value={duePreset}
                        ariaLabel="Deadline preset"
                        focusKey="quest.deadline"
                        options={[
                          { value: "none", label: "No deadline", hint: "Flexible" },
                          { value: "custom", label: "Pick date", hint: "Set a target" },
                        ]}
                        onChange={(v) => {
                          const next = v as typeof duePreset;
                          setDuePreset(next);
                          if (next === "none") setDueAt("");
                          else if (next === "custom" && !dueAt) setDueAt(toLocalInputValue(new Date()));
                        }}
                      />
                      {duePreset === "custom" ? (
                        <div className={styles.deadlineControls} aria-label="Custom deadline controls">
                          <DatePicker
                            value={dueParts.date}
                            onChange={(d) => {
                              setDueAt(`${d}T${dueParts.hour}:${dueParts.minute}`);
                              setDuePreset("custom");
                            }}
                            ariaLabel="Deadline date"
                          />
                          <div className={styles.timePicker} aria-label="Deadline time">
                            <div className={styles.timePart}>
                              <FancySelect
                                value={dueParts.hour}
                                options={hourOptions}
                                onChange={(h) => {
                                  const d = dueParts.date || isoDateKey(new Date());
                                  setDueAt(`${d}T${h}:${dueParts.minute}`);
                                  setDuePreset("custom");
                                }}
                                ariaLabel="Deadline hour"
                              />
                            </div>
                            <div className={styles.timeSep} aria-hidden="true">
                              :
                            </div>
                            <div className={styles.timePart}>
                              <FancySelect
                                value={dueParts.minute}
                                options={minuteOptions}
                                onChange={(m) => {
                                  const d = dueParts.date || isoDateKey(new Date());
                                  setDueAt(`${d}T${dueParts.hour}:${m}`);
                                  setDuePreset("custom");
                                }}
                                ariaLabel="Deadline minute"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.deadlineDisabled} aria-label="No deadline selected">
                          No deadline
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.label}>Title</div>
                    <input
                      ref={titleRef}
                      className={styles.control}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      placeholder="e.g. Database assignment"
                      aria-label="Quest title"
                    />
                  </div>

                  <div className={styles.field}>
                    <div className={styles.label}>Notes</div>
                    <textarea className={styles.textarea} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Course, scope, target grade, constraints…" aria-label="Quest notes" />
                  </div>

                  <div className={styles.modalActions}>
                    <button className={styles.primaryBtn} type="button" onClick={submit} aria-label="Create mission">
                      Create mission
                    </button>
                    <button className={styles.ghostBtn} type="button" onClick={() => setGeneratorOpen(false)} aria-label="Cancel generate quest">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {confirm
        ? createPortal(
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={confirm.title} onClick={() => setConfirm(null)}>
              <div className={styles.confirmModal} data-tone={confirm.tone || "neutral"} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <div>
                    <div className={styles.modalTitle}>{confirm.title}</div>
                    <div className={styles.modalSub}>{confirm.message}</div>
                  </div>
                  <button className={styles.iconBtn} type="button" onClick={() => setConfirm(null)} aria-label="Close confirmation">
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>

                <div className={styles.confirmBody}>
                  <div className={styles.confirmKicker}>
                    <i className={confirm.tone === "danger" ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-info"} aria-hidden="true"></i>
                    Please confirm
                  </div>
                  {confirm.details?.length ? (
                    <div className={styles.confirmDetails} aria-label="Confirmation details">
                      {confirm.details.map((line) => (
                        <div key={line} className={styles.confirmLine}>
                          <i className="fa-solid fa-check" aria-hidden="true"></i>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {confirm.hint ? <div className={styles.confirmHint}>{confirm.hint}</div> : null}
                </div>

                <div className={styles.modalActions}>
                  <button
                    className={styles.dangerBtn}
                    type="button"
                    onClick={() => {
                      const fn = confirm.onConfirm;
                      setConfirm(null);
                      fn();
                    }}
                    aria-label={confirm.confirmLabel || "Confirm"}
                  >
                    {confirm.confirmLabel || "Confirm"}
                  </button>
                  <button className={styles.ghostBtn} type="button" onClick={() => setConfirm(null)} aria-label="Cancel confirmation">
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
