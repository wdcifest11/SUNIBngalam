import { getDb } from "../sqlite";
import { verifyPassword } from "./password";

export type User = {
  id: number;
  email: string | null;
  displayName: string;
  xp: number;
  level: number;
  elo: number;
  university: string | null;
  major: string | null;
  cohort: string | null;
  onboardingCompletedAt: string | null;
  focusGoal: string | null;
  focusSessionMins: number | null;
  prefersBattles: boolean;
  prefersGuild: boolean;
  avatarUrl: string;
};

const DEFAULT_AVATAR_URL = "/blockyPng/profilePicture.png";

function mapUser(row: any): User {
  return {
    id: Number(row.id),
    email: row.email ?? null,
    displayName: row.display_name,
    xp: Number(row.xp ?? 0),
    level: Number(row.level ?? 1),
    elo: Number(row.elo ?? 1000),
    university: row.university ?? null,
    major: row.major ?? null,
    cohort: row.cohort ?? null,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    focusGoal: row.focus_goal ?? null,
    focusSessionMins: row.focus_session_mins == null ? null : Number(row.focus_session_mins),
    prefersBattles: Number(row.prefers_battles ?? 1) !== 0,
    prefersGuild: Number(row.prefers_guild ?? 1) !== 0,
    avatarUrl: row.avatar_url || DEFAULT_AVATAR_URL,
  };
}

export function getUserById(id: number): User | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, email, display_name, xp, level, elo, university, major, cohort, onboarding_completed_at, focus_goal, focus_session_mins, prefers_battles, prefers_guild, avatar_url FROM users WHERE id = ?"
    )
    .get(id) as any;
  if (!row) return null;
  return mapUser(row);
}

export function getUserByEmail(email: string): (User & { passwordHash: string | null }) | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, email, display_name, password_hash, xp, level, elo, university, major, cohort, onboarding_completed_at, focus_goal, focus_session_mins, prefers_battles, prefers_guild, avatar_url FROM users WHERE email = ?"
    )
    .get(email) as any;
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.password_hash ?? null };
}

export function createUser(input: { email: string; displayName: string; passwordHash: string }): User {
  const db = getDb();
  const res = db
    .prepare("INSERT INTO users (email, display_name, password_hash, xp, level, avatar_url) VALUES (?, ?, ?, 0, 1, ?)")
    .run(input.email, input.displayName, input.passwordHash, DEFAULT_AVATAR_URL);

  const id = Number(res.lastInsertRowid);
  return (
    getUserById(id) ?? {
      id,
      email: input.email,
      displayName: input.displayName,
      xp: 0,
      level: 1,
      elo: 1000,
      university: null,
      major: null,
      cohort: null,
      onboardingCompletedAt: null,
      focusGoal: null,
      focusSessionMins: null,
      prefersBattles: true,
      prefersGuild: true,
      avatarUrl: DEFAULT_AVATAR_URL,
    }
  );
}

export function authenticate(email: string, password: string): User | null {
  const u = getUserByEmail(email);
  if (!u?.passwordHash) return null;
  if (!verifyPassword(password, u.passwordHash)) return null;
  const { passwordHash: _ph, ...user } = u;
  return user;
}

export function completeOnboarding(
  userId: number,
  input: {
    university?: string | null;
    major?: string | null;
    cohort?: string | null;
    focusGoal?: string | null;
    focusSessionMins?: number | null;
    prefersBattles?: boolean | null;
    prefersGuild?: boolean | null;
  }
): void {
  const db = getDb();

  db.prepare(
    `
    UPDATE users
    SET university = COALESCE(?, university),
        major = COALESCE(?, major),
        cohort = COALESCE(?, cohort),
        focus_goal = COALESCE(?, focus_goal),
        focus_session_mins = COALESCE(?, focus_session_mins),
        prefers_battles = COALESCE(?, prefers_battles),
        prefers_guild = COALESCE(?, prefers_guild),
        onboarding_completed_at = datetime('now')
    WHERE id = ?
    `
  ).run(
    input.university ?? null,
    input.major ?? null,
    input.cohort ?? null,
    input.focusGoal ?? null,
    input.focusSessionMins ?? null,
    input.prefersBattles == null ? null : input.prefersBattles ? 1 : 0,
    input.prefersGuild == null ? null : input.prefersGuild ? 1 : 0,
    userId
  );
}

export function skipOnboarding(userId: number): void {
  const db = getDb();
  db.prepare("UPDATE users SET onboarding_completed_at = datetime('now') WHERE id = ?").run(userId);
}

