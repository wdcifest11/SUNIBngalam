"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BattleSetupModal from "../battle/battle-setup-modal";
import BattleLeaderboard from "./battle-leaderboard";
import styles from "./battle-grid.module.css";
import { appData } from "@/lib/app-data";

export default function BattleGrid() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [setupMode, setSetupMode] = useState<"ranked" | "casual" | "practice" | "room_make" | "room_join" | null>(null);
  const { elo, rank, winratePct, battleXpDelta } = appData.profile.battle;
  const recs = appData.battle.questRecommendations;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const focusId = (id: string) => {
      const el = document.getElementById(id) as HTMLElement | null;
      if (!el) return false;
      try {
        el.focus({ preventScroll: true } as any);
      } catch {
        el.focus();
      }
      return true;
    };

    const overlayOpen = () => {
      try {
        return !!(
          document.body &&
          (document.body.classList.contains("modal-open") || document.body.classList.contains("drawer-open"))
        );
      } catch {
        return false;
      }
    };

    const isTypingTarget = (el: Element | null) => {
      if (!el) return false;
      const tag = String((el as any).tagName || "").toLowerCase();
      if (tag === "textarea" || (el as any).isContentEditable) return true;
      if (tag === "input") {
        const t = String((el as any).getAttribute?.("type") || "text").toLowerCase();
        if (t === "range" || t === "checkbox" || t === "radio") return false;
        return true;
      }
      return tag === "select";
    };

    const layout = () => {
      try {
        if (window.matchMedia("(max-width: 700px)").matches) return "mobile" as const;
        if (window.matchMedia("(max-width: 1024px)").matches) return "tablet" as const;
      } catch {
        // ignore
      }
      return "desktop" as const;
    };

    const ordered = ["battle-stats", "battle-ranked", "battle-quests", "battle-casual", "battle-practice", "battle-leaderboard"] as const;
    const isNavId = (id: string) => (ordered as readonly string[]).includes(id);

    const mapDesktop: Record<string, Partial<Record<string, string>>> = {
      "battle-stats": { ArrowRight: "battle-ranked", ArrowDown: "battle-quests" },
      "battle-quests": { ArrowUp: "battle-stats", ArrowRight: "battle-casual" },
      "battle-ranked": { ArrowLeft: "battle-stats", ArrowDown: "battle-casual", ArrowRight: "battle-leaderboard" },
      "battle-casual": { ArrowUp: "battle-ranked", ArrowDown: "battle-practice", ArrowLeft: "battle-quests", ArrowRight: "battle-leaderboard" },
      "battle-practice": { ArrowUp: "battle-casual", ArrowLeft: "battle-quests", ArrowRight: "battle-leaderboard" },
      "battle-leaderboard": { ArrowLeft: "battle-ranked", ArrowUp: "battle-ranked", ArrowDown: "battle-practice" },
    };

    const mapTablet: Record<string, Partial<Record<string, string>>> = {
      "battle-stats": { ArrowRight: "battle-ranked", ArrowDown: "battle-quests" },
      "battle-ranked": { ArrowLeft: "battle-stats", ArrowDown: "battle-casual" },
      "battle-quests": { ArrowUp: "battle-stats", ArrowRight: "battle-casual", ArrowDown: "battle-leaderboard" },
      "battle-casual": { ArrowUp: "battle-ranked", ArrowLeft: "battle-quests", ArrowDown: "battle-practice" },
      "battle-practice": { ArrowUp: "battle-casual", ArrowLeft: "battle-quests", ArrowDown: "battle-leaderboard" },
      "battle-leaderboard": { ArrowUp: "battle-practice", ArrowLeft: "battle-quests" },
    };

    const nextFrom = (curId: string, key: string) => {
      const kind = layout();
      if (kind === "mobile") {
        const idx = ordered.indexOf(curId as any);
        if (idx === -1) return null;
        if (key === "ArrowDown" || key === "ArrowRight") return ordered[Math.min(ordered.length - 1, idx + 1)] as string;
        if (key === "ArrowUp" || key === "ArrowLeft") return ordered[Math.max(0, idx - 1)] as string;
        return null;
      }
      const table = kind === "tablet" ? mapTablet : mapDesktop;
      return table[curId]?.[key] ?? null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (overlayOpen()) return;

      const ae = document.activeElement as HTMLElement | null;
      if (isTypingTarget(ae)) return;

      // Only handle keys when focus is inside the Battle page content (or nowhere).
      const inContent = !ae || ae === document.body || ae === document.documentElement || !!ae.closest?.("#routeOutlet");
      if (!inContent) return;

      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        try {
          (e as any).stopImmediatePropagation?.();
        } catch {
          // ignore
        }
        router.push("/dashboard");
        return;
      }

      // If focus is nowhere (body/html), seed focus so arrows immediately work.
      if (ae && (ae === document.body || ae === document.documentElement)) {
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          e.stopPropagation();
          try {
            (e as any).stopImmediatePropagation?.();
          } catch {
            // ignore
          }
          focusId("battle-ranked");
        }
        return;
      }

      if (!ae || !root.contains(ae)) return;

      // When focus is inside leaderboard controls, let the global grid router
      // handle navigation among those controls.
      const lb = document.getElementById("battle-leaderboard");
      if (lb && lb.contains(ae) && ae !== lb) return;

      if (e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        try {
          (e as any).stopImmediatePropagation?.();
        } catch {
          // ignore
        }
        focusId("battle-ranked");
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        e.stopPropagation();
        try {
          (e as any).stopImmediatePropagation?.();
        } catch {
          // ignore
        }
        focusId("battle-leaderboard");
        return;
      }

      const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!isArrow) return;

      const cur = (ae.closest<HTMLElement>("[id^='battle-']")?.id || ae.id || "").trim();
      if (!cur || !isNavId(cur)) return;

      const next = nextFrom(cur, e.key);
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        (e as any).stopImmediatePropagation?.();
      } catch {
        // ignore
      }
      focusId(next);
    };

    // Use window capture to run before the global shell key handler (public/studium-client.js),
    // otherwise it can consume arrow keys for non-battle grids.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div ref={rootRef} className={styles.page} aria-label="Battle grid">
      <div className={styles.grid}>
        <div className={`${styles.block} ${styles.leftTop}`}>
          <div className={styles.label}>Your Stats</div>
          <button
            className={`gridCard ${styles.card}`}
            id="battle-stats"
            data-focus="battle.stats"
            type="button"
            aria-label="Your battle stats (jump to leaderboard)"
            onClick={() => {
              const el = document.getElementById("battle-leaderboard");
              if (el) {
                try {
                  el.scrollIntoView({ block: "start", behavior: "smooth" });
                } catch {
                  el.scrollIntoView();
                }
              }
              const first = el?.querySelector<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])") || (el as any as HTMLElement | null);
              if (first) {
                try {
                  first.focus({ preventScroll: true } as any);
                } catch {
                  first.focus();
                }
              }
            }}
          >
            <div className={styles.content} aria-hidden="true">
              <div className={styles.statsGrid}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>ELO</div>
                  <div className={styles.statValue}>{elo.toLocaleString()}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Rank</div>
                  <div className={styles.statValue}>{rank}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Winrate</div>
                  <div className={styles.statValue}>{winratePct}%</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Battle XP</div>
                  <div className={styles.statValue}>{battleXpDelta > 0 ? `+${battleXpDelta}` : String(battleXpDelta)}</div>
                </div>
              </div>

            </div>
          </button>
        </div>

        <div className={`${styles.block} ${styles.leftBottom}`}>
          <div className={styles.label}>Based on Your Quest</div>
          <button
            className={`gridCard ${styles.card}`}
            id="battle-quests"
            data-focus="battle.questBased"
            type="button"
            aria-label="Recommended battles from your quests (open Quest)"
            onClick={() => router.push("/quest")}
          >
            <div className={styles.content} aria-hidden="true">
              <div className={styles.questList}>
                {recs.map((q) => (
                  <div key={q.title} className={styles.questItem}>
                    <div className={styles.questTitle}>{q.title}</div>
                    <div className={styles.questMeta}>{q.meta}</div>
                  </div>
                ))}
              </div>
              <div className={styles.contentBottom}>
                <div className={styles.meta}>Win battles to earn XP + boost quest progress.</div>
              </div>
            </div>
          </button>
        </div>

        <div className={`${styles.block} ${styles.midTop}`}>
          <div className={styles.label}>Battle Mode</div>
          <button
            className={`gridCard ${styles.card} ${styles.rankedCard}`}
            id="battle-ranked"
            data-focus="battle.lobby"
            type="button"
            aria-label="Ranked battle mode"
            onClick={() => setSetupMode("ranked")}
          >
            <div className={styles.content} aria-hidden="true">
              <div className={styles.kicker}>Ranked</div>
              <div className={styles.titleRow}>
                <div className={styles.title}>Ranked 1v1</div>
              </div>
              <div className={styles.meta}>ELO ranked • +XP rewards • vs Bot</div>

              <div className={styles.ctaRow}>
                <span className={styles.pill}>
                  <i className="fa-solid fa-trophy" aria-hidden="true"></i> Win to climb
                </span>
                <span className={styles.pill}>
                  <i className="fa-solid fa-bolt" aria-hidden="true"></i> Quest XP boost
                </span>
              </div>

              <img className={styles.rankedMascot} src="/blockyPng/battle.png" alt="" aria-hidden="true" />
            </div>
          </button>
        </div>

        <div className={styles.midStack}>
          <button
            className={`gridCard ${styles.card}`}
            id="battle-casual"
            data-focus="battle.casual"
            type="button"
            aria-label="Casual battle mode"
            onClick={() => setSetupMode("casual")}
          >
            <div className={styles.content} aria-hidden="true">
              <div className={styles.kicker}>Casual</div>
              <div className={styles.title}>Quick Match</div>
              <div className={styles.meta}>No rank loss • Fast warm-up</div>
            </div>
          </button>

          <button
            className={`gridCard ${styles.card}`}
            id="battle-practice"
            data-focus="battle.practice"
            type="button"
            aria-label="Practice battle mode"
            onClick={() => setSetupMode("practice")}
          >
            <div className={styles.content} aria-hidden="true">
              <div className={styles.kicker}>Practice</div>
              <div className={styles.title}>Training</div>
              <div className={styles.meta}>Pick topic • Difficulty • Drills</div>
            </div>
          </button>
        </div>

        <div className={`${styles.block} ${styles.right}`}>
          <div className={styles.label}>Leaderboard</div>
          <div className={`gridCard ${styles.card} ${styles.leaderboardCard}`} id="battle-leaderboard" data-focus="battle.leaderboard" tabIndex={0} role="region" aria-label="Leaderboard">
            <div className={styles.content}>
              <BattleLeaderboard kicker={null} />
            </div>
          </div>
        </div>
      </div>

      <BattleSetupModal open={setupMode !== null} mode={setupMode} elo={elo} onClose={() => setSetupMode(null)} />
    </div>
  );
}
