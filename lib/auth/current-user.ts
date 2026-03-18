import { getDb } from "../sqlite";
import { readSessionTokenAsync } from "./session";
import type { User } from "./user";
import { readUserCookieAsync } from "./user-cookie";

export type CurrentUser = User | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const cookieUser = await readUserCookieAsync();

    const token = await readSessionTokenAsync();
    if (!token) return cookieUser;

    const db = getDb();
    const row = db
      .prepare(
        `
        SELECT u.id,
               u.email,
               u.display_name,
               u.xp,
               u.level,
               u.elo,
               u.university,
               u.major,
               u.cohort,
               u.onboarding_completed_at,
               u.focus_goal,
               u.focus_session_mins,
               u.prefers_battles,
               u.prefers_guild,
               u.avatar_url
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
          AND datetime(s.expires_at) > datetime('now')
        `
      )
      .get(token) as any;

    if (!row) return cookieUser;
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
      avatarUrl: row.avatar_url || "/blockyPng/profilePicture.png",
    };
  } catch {
    return null;
  }
}
