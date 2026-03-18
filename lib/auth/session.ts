import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "../sqlite";

export const SESSION_COOKIE = "studium_session";
const SESSION_DAYS = 30;

function nowIso() {
  return new Date().toISOString();
}

function expiresIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function readSessionTokenAsync(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, { days = SESSION_DAYS } = {}) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  const db = getDb();
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, nowIso(), expiresIso(SESSION_DAYS));
  return token;
}

export function deleteSession(token: string) {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
