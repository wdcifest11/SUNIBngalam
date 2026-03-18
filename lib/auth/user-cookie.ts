import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "./user";

export const USER_COOKIE = "studium_user";
const SESSION_DAYS = 30;

type CookiePayload = {
  v: 1;
  exp: number; // epoch ms
  user: User;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64").toString("utf8");
}

function timingSafeEqualStr(a: string, b: string) {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function secret() {
  // Demo-friendly fallback: in real production, set `STUDIUM_SESSION_SECRET` in Vercel env.
  return process.env.STUDIUM_SESSION_SECRET || "studium-demo-secret";
}

function sign(payloadB64: string) {
  return crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

function nowMs() {
  return Date.now();
}

function expMs(days: number) {
  return nowMs() + Math.max(1, days) * 24 * 60 * 60 * 1000;
}

export async function setUserCookie(user: User, { days = SESSION_DAYS } = {}) {
  const store = await cookies();
  const payload: CookiePayload = { v: 1, exp: expMs(days), user };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64);
  const value = `${payloadB64}.${sig}`;

  store.set({
    name: USER_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function clearUserCookie() {
  const store = await cookies();
  store.set({
    name: USER_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function readUserCookieAsync(): Promise<User | null> {
  try {
    const store = await cookies();
    const raw = store.get(USER_COOKIE)?.value ?? "";
    if (!raw) return null;
    const [payloadB64, sig] = raw.split(".");
    if (!payloadB64 || !sig) return null;

    const expected = sign(payloadB64);
    if (!timingSafeEqualStr(sig, expected)) return null;

    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as CookiePayload;
    if (!parsed || parsed.v !== 1) return null;
    if (!parsed.exp || !Number.isFinite(parsed.exp) || parsed.exp < nowMs()) return null;
    if (!parsed.user || !Number.isFinite(parsed.user.id)) return null;
    return parsed.user;
  } catch {
    return null;
  }
}
