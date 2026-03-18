"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./notification-island.module.css";
import { notifyIsland, type IslandNotificationInput, type IslandNotificationKind } from "./notify";

type Queued = IslandNotificationInput & {
  id: string;
  createdAt: number;
  durationMs: number;
  kind: IslandNotificationKind;
};

function kindDefaultIcon(kind: IslandNotificationKind) {
  if (kind === "success") return "fa-solid fa-circle-check";
  if (kind === "warning") return "fa-solid fa-triangle-exclamation";
  if (kind === "danger") return "fa-solid fa-circle-xmark";
  return "fa-solid fa-circle-info";
}

function normalizeInput(input: IslandNotificationInput): Queued | null {
  const title = String(input?.title ?? "").trim();
  if (!title) return null;

  const rawMessage = input.message ? String(input.message) : "";
  const autoMs = 2600 + (title.length + rawMessage.length) * 38;
  const fallbackMs = Math.max(3500, Math.min(10000, autoMs));
  const durationMs = Number.isFinite(Number(input.durationMs))
    ? Math.max(1200, Math.min(12000, Number(input.durationMs)))
    : fallbackMs;
  const kind = (input.kind ?? "info") as IslandNotificationKind;

  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    title,
    message: rawMessage ? rawMessage : undefined,
    iconClass: input.iconClass ? String(input.iconClass) : undefined,
    href: input.href ? String(input.href) : undefined,
    durationMs,
    kind,
  };
}

export default function NotificationIsland() {
  const router = useRouter();
  const [queue, setQueue] = useState<Queued[]>([]);
  const [current, setCurrent] = useState<Queued | null>(null);
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const timerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const ringClass = useMemo(() => {
    if (!current) return styles.ringPathKindInfo;
    if (current.kind === "success") return styles.ringPathKindSuccess;
    if (current.kind === "warning") return styles.ringPathKindWarning;
    if (current.kind === "danger") return styles.ringPathKindDanger;
    return styles.ringPathKindInfo;
  }, [current]);

  const closeNow = () => {
    if (!current) return;
    setState("closing");

    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    closeTimerRef.current = window.setTimeout(() => {
      setCurrent(null);
      setState("closed");
    }, 220);
  };

  useEffect(() => {
    if (!current) return;

    try {
      const sfx = (window as any).SFX;
      if (sfx && typeof sfx.playNotif === "function") sfx.playNotif();
    } catch {
      // ignore
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(closeNow, current.durationMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (current) return;
    if (state !== "closed") return;
    if (queue.length === 0) return;

    setQueue((q) => {
      if (q.length === 0) return q;
      const [next, ...rest] = q;
      setCurrent(next);
      setState("open");
      return rest;
    });
  }, [current, state, queue.length]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<IslandNotificationInput>;
      const next = normalizeInput(ce.detail);
      if (!next) return;
      setQueue((q) => [...q, next]);
    };

    window.addEventListener("studium:notify", handler as EventListener);

    // Convenience for console testing:
    // window.studiumNotify({ title: "Hello", message: "..." })
    (window as any).studiumNotify = notifyIsland;

    try {
      const w = window as any;
      const pending = w.__studiumNotifyQueue;
      if (Array.isArray(pending) && pending.length) {
        w.__studiumNotifyQueue = [];
        pending.forEach((item: any) => {
          try {
            notifyIsland(item);
          } catch {
            // ignore
          }
        });
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("studium:notify", handler as EventListener);
      if ((window as any).studiumNotify === notifyIsland) delete (window as any).studiumNotify;
    };
  }, []);

  if (!current) return null;

  const iconClass = current.iconClass || kindDefaultIcon(current.kind);

  const onClick = () => {
    if (current.href) router.push(current.href);
    closeNow();
  };

  return (
    <div className={styles.host} role="status" aria-live="polite" aria-atomic="true">
      <div
        className={styles.pill}
        data-state={state}
        style={{ ["--island-duration" as any]: `${current.durationMs}ms` }}
        onClick={onClick}
      >
        <svg
          key={current.id}
          className={styles.ring}
          viewBox="0 0 360 64"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            className={[styles.ringPath, ringClass].join(" ")}
            pathLength={100}
            x="2"
            y="2"
            width="356"
            height="60"
            rx="30"
            ry="30"
          />
        </svg>

        <span
          className={[
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/85",
          ].join(" ")}
          aria-hidden="true"
        >
          <i className={iconClass}></i>
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-[900] text-white">{current.title}</div>
          {current.message ? <div className="truncate text-xs font-[800] text-white/90">{current.message}</div> : null}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeNow();
          }}
          onKeyDown={(e) => {
            if (e.defaultPrevented) return;
            const k = e.key;
            if (k === "Escape" || k === "Esc" || k.toLowerCase() === "x") {
              e.preventDefault();
              e.stopPropagation();
              closeNow();
            }
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/35"
          aria-label="Dismiss notification"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
