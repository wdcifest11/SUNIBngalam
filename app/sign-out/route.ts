import { NextResponse } from "next/server";
import { deleteSession, readSessionTokenAsync, SESSION_COOKIE } from "../../lib/auth/session";
import { USER_COOKIE } from "../../lib/auth/user-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = await readSessionTokenAsync();
  if (token) {
    try {
      deleteSession(token);
    } catch {
      // ignore
    }
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set({
    name: USER_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
