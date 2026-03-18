import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/auth/current-user";
import { getDb } from "../../../../lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sort = (url.searchParams.get("sort") || "xp").trim().toLowerCase();
  const scope = (url.searchParams.get("scope") || "global").trim().toLowerCase();
  const limit = clampInt(Number(url.searchParams.get("limit") || 8), 3, 20);

  const sortCol = sort === "elo" ? "elo" : "xp";

  const db = getDb();

  const campus =
    scope === "campus" && user.university && user.major && user.cohort
      ? { university: user.university, major: user.major, cohort: user.cohort }
      : null;

  const rows = campus
    ? (db
        .prepare(
          `
          SELECT id,
                 display_name,
                 xp,
                 elo,
                 university,
                 major,
                 cohort
          FROM users
          WHERE university = ?
            AND major = ?
            AND cohort = ?
          ORDER BY ${sortCol} DESC, xp DESC, id ASC
          LIMIT ?
          `
        )
        .all(campus.university, campus.major, campus.cohort, limit) as any[])
    : (db
        .prepare(
          `
          SELECT id,
                 display_name,
                 xp,
                 elo,
                 university,
                 major,
                 cohort
          FROM users
          ORDER BY ${sortCol} DESC, xp DESC, id ASC
          LIMIT ?
          `
        )
        .all(limit) as any[]);

  const entries = (rows || []).map((r) => ({
    id: String(r.id),
    name: String(r.display_name || "Unknown"),
    xp: Number(r.xp ?? 0) || 0,
    elo: Number(r.elo ?? 0) || 0,
    tag: String(r.cohort || r.major || "—"),
  }));

  return NextResponse.json({
    scope: campus ? "campus" : "global",
    sortBy: sortCol,
    entries,
    self: { id: user.id, name: user.displayName, xp: user.xp, elo: user.elo, tag: user.cohort || user.major || "—" },
  });
}

