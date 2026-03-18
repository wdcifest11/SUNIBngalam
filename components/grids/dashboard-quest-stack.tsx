"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CardChrome from "./grid-parts/card-chrome";
import type { Quest, QuestPriority, QuestType } from "./planner-storage";
import { loadQuests, onPlannerUpdated } from "./planner-storage";

function formatShort(dt?: string) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
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

function questProgress(q: Quest) {
  const total = q.stages.length || 1;
  const done = q.stages.filter((s) => s.done).length;
  return Math.round((done / total) * 100);
}

type Tile =
  | { kind: "quest"; quest: Quest }
  | { kind: "shortcut"; kicker: string; title: string; meta: string; href: string; ariaLabel: string };

function fallbackShortcuts(): Tile[] {
  return [
    {
      kind: "shortcut",
      kicker: "Shortcut",
      title: "Create mission",
      meta: "Generate objectives + deadlines",
      href: "/quest",
      ariaLabel: "Open Quests and create a mission",
    },
    {
      kind: "shortcut",
      kicker: "Shortcut",
      title: "Open schedule",
      meta: "Calendar + day plan",
      href: "/schedules",
      ariaLabel: "Open Schedule",
    },
    {
      kind: "shortcut",
      kicker: "Shortcut",
      title: "Quick notes",
      meta: "Capture ideas fast",
      href: "/notes",
      ariaLabel: "Open Notes",
    },
    {
      kind: "shortcut",
      kicker: "Shortcut",
      title: "Start sprint",
      meta: "Pomodoro focus timer",
      href: "/pomodoro",
      ariaLabel: "Open Pomodoro",
    },
  ];
}

function tileForQuest(q: Quest): { kicker: string; title: string; meta: string; ariaLabel: string; href: string } {
  const p = normalizePriority(q.priority);
  const progress = questProgress(q);
  const due = formatShort(q.dueAt);
  const type = typeLabel(q.type);
  const pr = priorityLabel(p);

  return {
    kicker: `Quest | ${type}`,
    title: q.title || "Untitled quest",
    meta: `${pr} | ${progress}% | Due ${due}`,
    ariaLabel: `Open quest ${q.title || "Untitled quest"}`,
    href: "/quest",
  };
}

const TILE_META = [
  { className: "gridContainerRightLeftOne", id: "grid-quest1", focus: "dashboard.quest1" },
  { className: "gridContainerRightLeftTwo", id: "grid-quest2", focus: "dashboard.quest2" },
  { className: "gridContainerRightLeftThree", id: "grid-quest3", focus: "dashboard.quest3" },
  { className: "gridContainerRightLeftFour", id: "grid-quest4", focus: "dashboard.quest4" },
] as const;

export default function DashboardQuestStack() {
  const [quests, setQuests] = useState<Quest[]>([]);

  useEffect(() => {
    const sync = () => setQuests(loadQuests());
    sync();
    return onPlannerUpdated(sync);
  }, []);

  const tiles = useMemo(() => {
    const questTiles: Tile[] = quests.slice(0, 4).map((quest) => ({ kind: "quest", quest }));
    const fillers = fallbackShortcuts();
    const out: Tile[] = [...questTiles];
    for (let i = out.length; i < 4; i++) out.push(fillers[i]);
    return out;
  }, [quests]);

  return (
    <div className="dashQuestWrap" aria-label="Quest stack">
      <div className="dashSectionHead" aria-label="Quest stack header">
        <div className="dashSectionTitle">Today&apos;s Quest</div>
      </div>

      <div className="gridContainerRightLeft" aria-label="Quest tiles">
        {TILE_META.map((m, idx) => {
          const tile = tiles[idx];
          if (!tile) return null;

          const content =
            tile.kind === "quest"
              ? tileForQuest(tile.quest)
              : { kicker: tile.kicker, title: tile.title, meta: tile.meta, href: tile.href, ariaLabel: tile.ariaLabel };

          return (
            <div key={m.id} className={m.className} aria-label={tile.kind === "quest" ? "Quest tile" : "Shortcut tile"}>
              <Link
                href={content.href}
                className="dashQuestCard gridCard"
                id={m.id}
                data-focus={m.focus}
                aria-label={content.ariaLabel}
                style={{ display: "block", color: "inherit", textDecoration: "none" }}
              >
                <CardChrome title={content.title} meta={content.meta} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

