import raw from "@/data/app-data.json";

export type UiDensity = "comfort" | "compact";

export type ViewMeta = { label: string; desc: string };

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  page: string;
  href: string;
  focusKey: string;
};

export type TintPreset = { label: string; rgb: string };

export type BattleCampus = { university: string; major: string; cohort: string };
export type BattleLeaderboardEntry = {
  id: string;
  name: string;
  xp: number;
  elo: number;
  campus: BattleCampus;
};

export type NotesTagDef = { id: string; label: string; dotClass: string };
export type NotesFolderDef = { id: string; label: string };
export type NotesSeedTemplate = {
  id: string;
  title: string;
  body: string;
  bodyFormat: "plain" | "html";
  tags: string[];
  folder: string | null;
  favorite: boolean;
  pinned: boolean;
  sortOffsetMin: number;
  createdOffsetMin: number;
  updatedOffsetMin: number;
};

export type NotesSeedHydrated = {
  id: string;
  title: string;
  body: string;
  bodyFormat: "plain" | "html";
  tags: string[];
  folder: string | null;
  favorite: boolean;
  pinned: boolean;
  sortOrder: number;
  hiddenAt: number | null;
  reminderAt: number | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  deletedAt: number | null;
};

export type AppData = {
  profile: {
    displayName: string;
    email: string;
    avatarUrl: string;
    xp: number;
    level: number;
    battle: { elo: number; rank: string; winratePct: number; battleXpDelta: number };
    streak: { freezeCount: number; strikesCount: number };
  };
  views: Record<string, ViewMeta>;
  navigation: { items: NavItem[]; defaultOrder: string[] };
  ui: { densityDefault: UiDensity; notificationsDefaultEnabled: boolean; tintPresets: TintPreset[] };
  battle: {
    questRecommendations: Array<{ title: string; meta: string }>;
    leaderboard: { selectedCampus: BattleCampus; entries: BattleLeaderboardEntry[] };
  };
  notes: {
    defaults: { tags: NotesTagDef[]; folders: NotesFolderDef[]; seedNotes: NotesSeedTemplate[] };
    grid: {
      cards: {
        leftTop: { kicker: string; title: string; meta: string };
        tags: { kicker: string; title: string; meta: string };
        new: { kicker: string; title: string; meta: string; href: string };
        recent: Array<{ kicker: string; title: string; meta: string }>;
        preview: { kicker: string; title: string; meta: string };
      };
    };
  };
  guild: {
    grid: {
      cards: {
        leftTop: { kicker: string; title: string; meta: string };
        accountability: { kicker: string; title: string; meta: string };
        startRoom: { kicker: string; title: string; meta: string };
        rooms: Array<{ kicker: string; title: string; meta: string }>;
        chat: { kicker: string; title: string; meta: string };
      };
    };
  };
  planner: { questStageTemplates: Record<string, string[]> };
};

export const appData = raw as unknown as AppData;

export function viewMeta(view: string): ViewMeta | null {
  const v = appData.views?.[String(view || "").trim()];
  if (!v) return null;
  if (typeof v.label !== "string" || typeof v.desc !== "string") return null;
  return v;
}

export function plannerStageTemplates(type: string): string[] {
  const tmpl = appData.planner?.questStageTemplates?.[type];
  if (!Array.isArray(tmpl)) return [];
  return tmpl.map((x) => String(x ?? "")).map((s) => s.trim()).filter(Boolean);
}

function minutesToMs(min: number) {
  return Math.round(min * 60_000);
}

export function hydrateSeedNotes(nowMs: number = Date.now()): NotesSeedHydrated[] {
  const base = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const seed = appData.notes.defaults.seedNotes;

  return seed.map((t) => {
    const createdAt = base + minutesToMs(Number(t.createdOffsetMin ?? 0));
    const updatedAt = base + minutesToMs(Number(t.updatedOffsetMin ?? 0));
    const sortOrder = base + minutesToMs(Number(t.sortOffsetMin ?? 0));
    return {
      id: String(t.id || ""),
      title: String(t.title || "Untitled"),
      body: String(t.body || ""),
      bodyFormat: t.bodyFormat === "html" ? "html" : "plain",
      tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
      folder: typeof t.folder === "string" ? t.folder : null,
      favorite: !!t.favorite,
      pinned: !!t.pinned,
      sortOrder,
      hiddenAt: null,
      reminderAt: null,
      createdAt,
      updatedAt,
      archivedAt: null,
      deletedAt: null,
    };
  });
}

