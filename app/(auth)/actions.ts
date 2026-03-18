"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, createSession, deleteSession, readSessionTokenAsync, setSessionCookie } from "../../lib/auth/session";
import { authenticate, completeOnboarding, createUser, getUserByEmail, getUserById, skipOnboarding } from "../../lib/auth/user";
import { hashPassword } from "../../lib/auth/password";
import { getCurrentUser } from "../../lib/auth/current-user";
import { clearUserCookie, setUserCookie } from "../../lib/auth/user-cookie";

function cleanEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function cleanName(v: unknown) {
  return String(v ?? "").trim();
}

export async function registerAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));
  const displayName = cleanName(formData.get("displayName"));
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) redirect(`/register?error=invalid_email`);
  if (!displayName || displayName.length < 2) redirect(`/register?error=invalid_name`);
  if (!password || password.length < 6) redirect(`/register?error=weak_password`);

  const existing = getUserByEmail(email);
  if (existing) redirect(`/register?error=exists`);

  const user = createUser({ email, displayName, passwordHash: hashPassword(password) });
  const token = createSession(user.id);
  await setSessionCookie(token);
  await setUserCookie(user);
  redirect("/onboarding");
}

export async function signInAction(formData: FormData) {
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect(`/sign-in?error=missing`);

  const user = authenticate(email, password);
  if (!user) redirect(`/sign-in?error=invalid`);

  const token = createSession(user.id);
  await setSessionCookie(token);
  await setUserCookie(user);
  redirect(user.onboardingCompletedAt ? "/dashboard" : "/onboarding");
}

export async function signOutAction() {
  const token = await readSessionTokenAsync();
  if (token) {
    try {
      deleteSession(token);
    } catch {
      // ignore
    }
  }
  await clearSessionCookie();
  await clearUserCookie();
  redirect("/");
}

function cleanOptionalText(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function cleanOptionalNumber(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function requireUserId(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user.id;
}

export async function completeOnboardingAction(formData: FormData) {
  const userId = await requireUserId();

  const university = cleanOptionalText(formData.get("university"));
  const major = cleanOptionalText(formData.get("major"));
  const cohort = cleanOptionalText(formData.get("cohort"));
  const focusGoal = cleanOptionalText(formData.get("focusGoal"));
  const focusSessionMins = cleanOptionalNumber(formData.get("focusSessionMins"));

  const prefersBattles = formData.get("prefersBattles") ? true : false;
  const prefersGuild = formData.get("prefersGuild") ? true : false;

  completeOnboarding(userId, {
    university,
    major,
    cohort,
    focusGoal,
    focusSessionMins,
    prefersBattles,
    prefersGuild,
  });

  try {
    const updated = getUserById(userId);
    if (updated) await setUserCookie(updated);
  } catch {
    // ignore
  }
  redirect("/dashboard");
}

export async function skipOnboardingAction(_formData?: FormData) {
  const userId = await requireUserId();
  skipOnboarding(userId);
  try {
    const updated = getUserById(userId);
    if (updated) await setUserCookie(updated);
  } catch {
    // ignore
  }
  redirect("/dashboard");
}
