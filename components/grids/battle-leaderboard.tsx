"use client";

import { useMemo, useState } from "react";

import styles from "./battle-leaderboard.module.css";
import { appData } from "@/lib/app-data";

type Campus = {
  university: string;
  major: string;
  cohort: string;
};

type Entry = {
  id: string;
  name: string;
  xp: number;
  elo: number;
  campus: Campus;
};

function fmt(n: number) {
  return n.toLocaleString();
}

function campusKey(c: Campus) {
  return `${c.university}__${c.major}__${c.cohort}`;
}

function scrollIntoViewNearest(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    // ignore
  }
}

export default function BattleLeaderboard({ kicker = "Leaderboard" }: { kicker?: string | null } = {}) {
  const [scope, setScope] = useState<"global" | "campus">("global");
  const [sortBy, setSortBy] = useState<"xp" | "elo">("xp");

  const lb = (appData as any)?.battle?.leaderboard as { selectedCampus?: Campus; entries?: Entry[] } | undefined;
  const selectedCampus: Campus = lb?.selectedCampus ?? { university: "", major: "", cohort: "" };
  const entries: Entry[] = Array.isArray(lb?.entries) ? (lb!.entries as Entry[]) : [];

  const rows = useMemo(() => {
    const filtered = scope === "campus" ? entries.filter((e) => campusKey(e.campus) === campusKey(selectedCampus)) : entries.slice();
    filtered.sort((a, b) => (sortBy === "xp" ? b.xp - a.xp : b.elo - a.elo));
    return filtered;
  }, [entries, scope, selectedCampus, sortBy]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 12);

  const campusLabel = [selectedCampus.university, selectedCampus.major, selectedCampus.cohort].filter(Boolean).join(" \u2022 ");

  return (
    <div className={styles.root}>
      <div className={styles.topRow}>
        {kicker ? <div className="cardKicker">{kicker}</div> : null}

        <div className={styles.actions}>
          <div className={styles.segment} aria-label="Leaderboard scope">
            <button
              type="button"
              className={`gridCard ${styles.toggle}`}
              data-focus="battle.lb.scope.global"
              onClick={() => setScope("global")}
              aria-pressed={scope === "global"}
              aria-label="Global leaderboard"
            >
              Global
            </button>
            <button
              type="button"
              className={`gridCard ${styles.toggle}`}
              data-focus="battle.lb.scope.campus"
              onClick={() => setScope("campus")}
              aria-pressed={scope === "campus"}
              aria-label="Campus leaderboard"
            >
              Campus
            </button>
          </div>

          <div className={styles.segment} aria-label="Leaderboard sort">
            <button
              type="button"
              className={`gridCard ${styles.toggle} ${styles.sortToggle}`}
              data-focus="battle.lb.sort.xp"
              onClick={() => setSortBy("xp")}
              aria-pressed={sortBy === "xp"}
              aria-label="Sort by XP"
            >
              XP
            </button>
            <button
              type="button"
              className={`gridCard ${styles.toggle} ${styles.sortToggle}`}
              data-focus="battle.lb.sort.elo"
              onClick={() => setSortBy("elo")}
              aria-pressed={sortBy === "elo"}
              aria-label="Sort by ELO"
            >
              ELO
            </button>
          </div>
        </div>
      </div>

      {scope === "campus" ? <div className={["cardMeta", styles.campusLabel].join(" ")}>{campusLabel}</div> : null}

      <div className={styles.podiumGrid} aria-label="Top 3 players">
        {[1, 0, 2].map((pos) => {
          const p = podium[pos];
          const rank = pos === 0 ? 1 : pos === 1 ? 2 : 3;
          return (
            <div
              key={rank}
              className={`gridCard ${styles.podiumCard}`}
              data-rank={rank}
              data-focus={`battle.lb.podium.${rank}`}
              tabIndex={-1}
              role="group"
              aria-label={`Rank ${rank}`}
            >
              <div className={styles.podiumTop}>
                <div className={styles.podiumRank}>#{rank}</div>
                <div className={styles.podiumMetric}>{sortBy.toUpperCase()}</div>
              </div>
              <div className={styles.podiumName}>{p?.name ?? "—"}</div>
              <div className={styles.podiumValue}>{p ? (sortBy === "xp" ? `${fmt(p.xp)} XP` : `${fmt(p.elo)} ELO`) : " "}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.list} role="list" aria-label="Leaderboard list">
        {rest.map((e, i) => {
          const rank = i + 4;
          return (
            <div
              key={e.id}
              className={`gridCard ${styles.row}`}
              data-focus={`battle.lb.row.${e.id}`}
              tabIndex={-1}
              role="listitem"
              aria-label={`Rank ${rank} ${e.name}`}
              onFocus={(ev) => scrollIntoViewNearest(ev.currentTarget)}
            >
              <div className={styles.rowRank}>#{rank}</div>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>{e.name}</div>
                <div className={styles.rowMeta}>
                  {fmt(e.xp)} XP • {fmt(e.elo)} ELO
                </div>
              </div>
              <div className={styles.rowTag}>{scope === "campus" ? e.campus.cohort : e.campus.major}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
