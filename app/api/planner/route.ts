import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/auth/current-user";
import { getDb } from "../../../lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlannerPayload = { quests: unknown; events: unknown };

function asArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const row = db
    .prepare("SELECT quests_json, events_json, updated_at FROM planner_state WHERE user_id = ?")
    .get(user.id) as { quests_json: string; events_json: string; updated_at: string } | undefined;

  if (!row) {
    return NextResponse.json({ quests: [], events: [], updatedAt: null });
  }

  let quests: unknown[] = [];
  let events: unknown[] = [];
  try {
    quests = JSON.parse(row.quests_json || "[]");
  } catch {
    quests = [];
  }
  try {
    events = JSON.parse(row.events_json || "[]");
  } catch {
    events = [];
  }

  return NextResponse.json({ quests: Array.isArray(quests) ? quests : [], events: Array.isArray(events) ? events : [], updatedAt: row.updated_at || null });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let payload: PlannerPayload;
  try {
    payload = (await req.json()) as PlannerPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const quests = asArray(payload?.quests);
  const events = asArray(payload?.events);
  if (!quests || !events) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  if (quests.length > 50) return NextResponse.json({ error: "too_many_quests" }, { status: 400 });
  if (events.length > 300) return NextResponse.json({ error: "too_many_events" }, { status: 400 });

  const questsJson = JSON.stringify(quests);
  const eventsJson = JSON.stringify(events);

  const db = getDb();
  db.prepare(
    `
    INSERT INTO planner_state (user_id, quests_json, events_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      quests_json = excluded.quests_json,
      events_json = excluded.events_json,
      updated_at = excluded.updated_at
    `
  ).run(user.id, questsJson, eventsJson);

  return NextResponse.json({ ok: true });
}

