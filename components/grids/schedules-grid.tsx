"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import styles from "./schedules-grid.module.css";
import type { PlannerEvent, QuestPriority } from "./planner-storage";
import { addEvent, deleteEvent, loadEvents, onPlannerUpdated } from "./planner-storage";

type FancyOption = { value: string; label: string; hint?: string };
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "neutral";
  details?: string[];
  hint?: string;
  onConfirm: () => void;
};

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseTimeParts(value: string) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec((value || "").trim());
  if (!m) return { hour: "09", minute: "00" };
  const h = clampInt(Number(m[1]), 0, 23);
  const mm = clampInt(Number(m[2]), 0, 59);
  return { hour: String(h).padStart(2, "0"), minute: String(mm).padStart(2, "0") };
}

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
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  const syncPos = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ left: rect.left, top: rect.bottom + 10, width: rect.width });
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

  const selectIdx = (idx: number) => {
    const next = options[Math.max(0, Math.min(options.length - 1, idx))];
    if (!next) return;
    onChange(next.value);
  };

  return (
    <div ref={wrapRef} className={styles.fancySelect} data-open={open ? "1" : "0"}>
      <button
        ref={btnRef}
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

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.fancyMenu}
              role="listbox"
              aria-label={ariaLabel}
              style={{ left: pos.left, top: pos.top, width: pos.width }}
            >
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function icsEscape(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function icsUtcStamp(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function priorityToIcs(p?: QuestPriority) {
  const v = p || "medium";
  if (v === "high") return 1;
  if (v === "low") return 9;
  return 5;
}

function makeDayIcs(dayKeyIso: string, events: PlannerEvent[]) {
  const now = icsUtcStamp(new Date());
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("PRODID:-//Studium//Schedule//EN");
  lines.push("METHOD:PUBLISH");

  for (const e of events) {
    const start = new Date(e.startAt);
    if (Number.isNaN(start.getTime())) continue;
    const dur = typeof e.durationMin === "number" && Number.isFinite(e.durationMin) && e.durationMin > 0 ? e.durationMin : 60;
    const end = new Date(start.getTime() + dur * 60_000);
    const uid = `${e.id || Math.random().toString(16).slice(2)}@studium`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${icsUtcStamp(start)}`);
    lines.push(`DTEND:${icsUtcStamp(end)}`);
    lines.push(`SUMMARY:${icsEscape(e.title || "Event")}`);
    if (e.notes) lines.push(`DESCRIPTION:${icsEscape(e.notes)}`);
    if (e.questId) lines.push("CATEGORIES:Quest");
    lines.push(`PRIORITY:${priorityToIcs(e.priority)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function base64EncodeUtf8(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin);
}

function downloadIcsViaApi(ics: string, fileName: string) {
  const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/calendar";
  form.target = isMobile ? "_self" : "_blank";
  form.style.display = "none";

  const icsBase64 = document.createElement("input");
  icsBase64.type = "hidden";
  icsBase64.name = "icsBase64";
  icsBase64.value = base64EncodeUtf8(ics);

  const name = document.createElement("input");
  name.type = "hidden";
  name.name = "fileName";
  name.value = fileName;

  form.appendChild(icsBase64);
  form.appendChild(name);
  document.body.appendChild(form);
  form.submit();
  window.setTimeout(() => form.remove(), 2_000);
}

function dateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventDayKey(e: PlannerEvent) {
  const d = new Date(e.startAt);
  if (Number.isNaN(d.getTime())) return "";
  return dateKey(d);
}

function formatTime(dt: string) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function scrollNearest(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    // ignore
  }
}

export default function SchedulesGrid() {
  const router = useRouter();
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [filter, setFilter] = useState<"all" | "quest" | "personal" | "high" | "medium" | "low">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<QuestPriority>("medium");
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => {
    const sync = () => setEvents(loadEvents());
    sync();
    return onPlannerUpdated(sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pendingDay = sessionStorage.getItem("studium:schedules_pending_day") || "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(pendingDay)) {
        setSelected(pendingDay);
        const d = new Date(`${pendingDay}T00:00:00`);
        if (!Number.isNaN(d.getTime())) setMonth(startOfMonth(d));
      }
      sessionStorage.removeItem("studium:schedules_pending_day");
    } catch {
      // ignore
    }

    try {
      const raw = sessionStorage.getItem("studium:schedules_pending_filter") || "";
      const allowed = raw === "all" || raw === "quest" || raw === "personal" || raw === "high" || raw === "medium" || raw === "low";
      if (allowed) setFilter(raw as any);
      sessionStorage.removeItem("studium:schedules_pending_filter");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!addOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addOpen]);

  useEffect(() => {
    if (!confirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirm(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm]);

  useEffect(() => {
    if (!addOpen) return;
    document.body.classList.add("modal-open");
    const api = { close: () => setAddOpen(false) };
    (window as any).studiumModalApi = api;

    const raf = requestAnimationFrame(() => titleRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("modal-open");
      if ((window as any).studiumModalApi === api) delete (window as any).studiumModalApi;
    };
  }, [addOpen]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    for (const e of events) {
      const k = eventDayKey(e);
      if (!k) continue;
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    for (const [k, list] of map) {
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      map.set(k, list);
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDay.get(selected) ?? [];
  const filteredSelectedEvents = useMemo(() => {
    if (filter === "all") return selectedEvents;
    if (filter === "quest") return selectedEvents.filter((e) => Boolean(e.questId));
    if (filter === "personal") return selectedEvents.filter((e) => !e.questId);
    return selectedEvents.filter((e) => (e.priority || "medium") === filter);
  }, [filter, selectedEvents]);

  const openQuest = useCallback(
    (questId: string) => {
      const url = `/quest?quest=${encodeURIComponent(questId)}&detail=1`;
      router.push(url);
    },
    [router]
  );

  const filterOptions = useMemo<FancyOption[]>(
    () => [
      { value: "all", label: "All", hint: "Everything for this day" },
      { value: "quest", label: "Quest", hint: "Milestones from missions" },
      { value: "personal", label: "Personal", hint: "Events you added manually" },
      { value: "high", label: "High", hint: "Priority: high" },
      { value: "medium", label: "Medium", hint: "Priority: medium" },
      { value: "low", label: "Low", hint: "Priority: low" },
    ],
    []
  );

  const priorityOptions = useMemo<FancyOption[]>(
    () => [
      { value: "low", label: "Low", hint: "Chill / optional" },
      { value: "medium", label: "Medium", hint: "Normal priority" },
      { value: "high", label: "High", hint: "Important / urgent" },
    ],
    []
  );

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

  const timeParts = useMemo(() => parseTimeParts(time), [time]);

  const monthDays = useMemo(() => {
    const first = startOfMonth(month);
    const startDow = (first.getDay() + 6) % 7; // Monday=0
    const gridStart = addDays(first, -startDow);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [month]);

  const submitEvent = () => {
    if (!title.trim()) return;
    const start = new Date(`${selected}T${time || "09:00"}:00`);
    const startAt = Number.isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString();
    addEvent({ title: title.trim(), startAt, notes: notes.trim() || undefined, durationMin: 60, priority });
    setTitle("");
    setNotes("");
    setPriority("medium");
    setAddOpen(false);
  };

  const exportToCalendar = async () => {
    const list = filteredSelectedEvents;
    if (!list.length) {
      (window as any).studiumNotify?.({ title: "Calendar", message: "No events to export for this day." });
      return;
    }
    const ics = makeDayIcs(selected, list);
    const fileName = `studium-${selected}.ics`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });

    try {
      const nav: any = navigator as any;
      const canMakeFile = typeof (window as any).File === "function";
      const file = canMakeFile ? new File([blob], fileName, { type: "text/calendar" }) : null;

      // Best UX on mobile: share the .ics so the OS can hand it to Calendar directly.
      if (file && typeof nav?.canShare === "function" && nav.canShare({ files: [file] }) && typeof nav?.share === "function") {
        await nav.share({ files: [file], title: `Schedule ${selected}` });
        (window as any).studiumNotify?.({ title: "Calendar", message: "Choose your Calendar app to import this day." });
        return;
      }

      // Most reliable cross-platform fallback: download an .ics from a real HTTP response with proper headers + filename.
      downloadIcsViaApi(ics, fileName);
      (window as any).studiumNotify?.({ title: "Calendar", message: "Downloaded .ics — open it to add to your calendar." });
    } catch (err: any) {
      if (err?.name === "AbortError") return; // user canceled share

      try {
        // Last resort: open a blob URL (some browsers can still import).
        const url = URL.createObjectURL(blob);
        const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isiOS) window.location.assign(url);
        else window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        (window as any).studiumNotify?.({ title: "Calendar", message: "Opened .ics — if it downloads, open it to import." });
      } catch {
        (window as any).studiumNotify?.({ title: "Calendar", message: "Export failed in this browser. Try Safari or use Share." });
      }
    }
  };

  return (
    <div className={styles.page} aria-label="Schedule page">
      <div className={styles.topBar}>
        <div>
          <div className={styles.title}>
            Schedule
          </div>
          <div className={styles.sub}>Calendar + day plan. Quest milestones appear here automatically.</div>
        </div>
        <button className={styles.actionBtn} type="button" onClick={() => setAddOpen(true)} aria-label="Add event" data-focus="schedules.add">
          <i className="fa-solid fa-plus" aria-hidden="true"></i>
          Add event
        </button>
      </div>

      <div className={styles.body}>
        <section className={styles.left} aria-label="Calendar">
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <i className="fa-regular fa-calendar" aria-hidden="true"></i>
              {formatMonth(month)}
            </div>
            <div className={styles.monthBtns}>
              <button
                className={styles.iconBtn}
                type="button"
                onClick={() => setMonth((m) => startOfMonth(addDays(m, -1)))}
                aria-label="Previous month"
                data-focus="schedules.prevMonth"
              >
                <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
              </button>
              <button className={styles.ghostBtn} type="button" onClick={() => setMonth(startOfMonth(new Date()))} aria-label="Today" data-focus="schedules.today">
                Today
              </button>
              <button
                className={styles.iconBtn}
                type="button"
                onClick={() => setMonth((m) => startOfMonth(addDays(m, 32)))}
                aria-label="Next month"
                data-focus="schedules.nextMonth"
              >
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div className={styles.calendar} aria-label="Month calendar">
            <div className={styles.calGrid} aria-hidden="true">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className={styles.dow}>
                  {d}
                </div>
              ))}
            </div>
            <div className={styles.calGrid}>
              {monthDays.map((d) => {
                const inMonth = d.getMonth() === month.getMonth();
                const key = dateKey(d);
                const count = (eventsByDay.get(key) ?? []).length;
                const active = key === selected;
                const isToday = sameDay(d, new Date());
                const focusKey = active ? "schedules.agenda" : `schedules.day.${key}`;
                return (
                  <button
                    key={key}
                    className={[styles.day, !inMonth ? styles.dayMuted : "", active ? styles.dayActive : "", isToday ? styles.dayToday : ""].join(" ")}
                    type="button"
                    onClick={() => setSelected(key)}
                    onFocus={(e) => {
                      setSelected(key);
                      scrollNearest(e.currentTarget);
                    }}
                    aria-label={`Select ${d.toDateString()}`}
                    data-focus={focusKey}
                  >
                    <div className={styles.dayTop}>
                      <div className={styles.dayNum}>{d.getDate()}</div>
                      <div className={styles.dots} aria-hidden="true">
                        {count > 0 ? Array.from({ length: Math.min(3, count) }).map((_, i) => <span key={i} className={styles.dot} />) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.right} aria-label="Day details">
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>
                <i className="fa-regular fa-calendar-check" aria-hidden="true"></i>
                {selected}
              </div>
              <div className={styles.cardSub}>
                {filteredSelectedEvents.length ? `${filteredSelectedEvents.length} event(s)` : "No events yet."}
                {filter !== "all" ? " | filtered" : ""}
              </div>
            </div>
            <div className={styles.headActions} aria-label="Day actions">
              <button
                className={styles.calendarBtn}
                type="button"
                onClick={exportToCalendar}
                disabled={filteredSelectedEvents.length === 0}
                aria-label="Add this day to device calendar"
                data-focus="schedules.export"
              >
                <i className="fa-solid fa-calendar-plus" aria-hidden="true"></i>
                Add to calendar
              </button>
              <div className={styles.filterWrap} aria-label="Event category filter">
                <FancySelect
                  value={filter}
                  options={filterOptions}
                  onChange={(v) => setFilter(v as any)}
                  ariaLabel="Filter events"
                  focusKey="schedules.filter"
                />
              </div>
            </div>
          </div>

          <div className={styles.events} aria-label="Events list">
            {filteredSelectedEvents.length === 0 ? <div className={styles.empty}>No events for this day.</div> : null}
            {filteredSelectedEvents.map((e) => (
              <div
                key={e.id}
                className={styles.event}
                data-priority={e.priority || "medium"}
                data-quest={e.questId ? "1" : "0"}
                tabIndex={0}
                data-focus={`schedules.event.${e.id}`}
                onFocus={(ev) => scrollNearest(ev.currentTarget)}
                onClick={() => {
                  if (!e.questId) return;
                  openQuest(e.questId);
                }}
                onKeyDown={(ev) => {
                  if (!e.questId) return;
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    openQuest(e.questId);
                  }
                }}
              >
                <div className={styles.eventMain}>
                  <div className={styles.eventTitle}>{e.title}</div>
                  <div className={styles.eventMeta}>
                    {formatTime(e.startAt)}
                    {e.durationMin ? ` | ${e.durationMin}m` : ""}
                    {e.questId ? " | Quest" : ""}
                  </div>
                  {e.notes ? <div className={styles.eventNotes}>{e.notes}</div> : null}
                </div>
                <button
                  className={styles.iconBtn}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setConfirm({
                      title: "Delete event?",
                      message: `Remove “${e.title}” from your schedule.`,
                      confirmLabel: "Delete",
                      tone: "danger",
                      details: [
                        "This event will be removed from the selected day.",
                        e.questId ? "This is a quest milestone — it may return if the mission regenerates milestones." : "Quest missions are not affected.",
                        "This action can’t be undone.",
                      ],
                      hint: "Tip: Use Add to calendar if you want it in your device calendar too.",
                      onConfirm: () => deleteEvent(e.id),
                    });
                  }}
                  aria-label="Delete event"
                  data-focus={`schedules.event.delete.${e.id}`}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {addOpen
        ? createPortal(
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Add event" onClick={() => setAddOpen(false)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <div>
                    <div className={styles.modalTitle}>Add event</div>
                    <div className={styles.modalSub}>Saved events appear on the selected date.</div>
                  </div>
                  <button className={styles.iconBtn} type="button" onClick={() => setAddOpen(false)} aria-label="Close add event">
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>

                <div className={styles.form}>
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
                          submitEvent();
                        }
                      }}
                      placeholder="e.g. Review chapter 3"
                      aria-label="Event title"
                    />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <div className={styles.label}>Time</div>
                      <div className={styles.timePicker} aria-label="Event time">
                        <div className={styles.timePart}>
                          <FancySelect
                            value={timeParts.hour}
                            options={hourOptions}
                            onChange={(h) => setTime(`${h}:${timeParts.minute}`)}
                            ariaLabel="Event hour"
                          />
                        </div>
                        <div className={styles.timeSep} aria-hidden="true">
                          :
                        </div>
                        <div className={styles.timePart}>
                          <FancySelect
                            value={timeParts.minute}
                            options={minuteOptions}
                            onChange={(m) => setTime(`${timeParts.hour}:${m}`)}
                            ariaLabel="Event minute"
                          />
                        </div>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <div className={styles.label}>Priority</div>
                      <FancySelect
                        value={priority}
                        options={priorityOptions}
                        onChange={(v) => setPriority(v as QuestPriority)}
                        ariaLabel="Event priority"
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <div className={styles.label}>Notes</div>
                    <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
                  </div>
                  <div className={styles.modalActions}>
                    <button className={styles.actionBtn} type="button" onClick={submitEvent} aria-label="Save event">
                      Save
                    </button>
                    <button className={styles.ghostBtn} type="button" onClick={() => setAddOpen(false)} aria-label="Cancel add event">
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
