"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../../lib/auth/demo";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    try {
      if (localStorage.getItem("studium:demo:signed_in") === "1") {
        router.replace("/dashboard");
      }
    } catch {
      // ignore
    }
  }, [router]);

  const signIn = () => {
    setErrorText("");
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedPassword = password;
    if (!cleanedEmail || !cleanedPassword) {
      setErrorText("Masukkan email dan password.");
      return;
    }
    if (cleanedEmail !== DEMO_EMAIL || cleanedPassword !== DEMO_PASSWORD) {
      setErrorText("Email atau password salah.");
      return;
    }

    try {
      localStorage.setItem("studium:demo:signed_in", "1");
    } catch {
      // ignore
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-[900] tracking-[0.22em] text-white/60">STUDIUM</div>
          <h1 className="mt-3 text-3xl font-[900] tracking-[-0.02em]">Sign in</h1>
          <p className="mt-2 text-sm font-[700] text-white/65">Masuk pakai akun demo.</p>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-white/12 bg-white/10 px-4 py-2 text-xs font-[900] text-white/80 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/45"
        >
          Back
        </Link>
      </div>

      {errorText ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-[800] text-red-100/90">{errorText}</div>
      ) : null}

      <form
        className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl"
        onSubmit={(e) => {
          e.preventDefault();
          signIn();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs font-[900] tracking-wide text-white/70">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
            placeholder="demo@studium.local"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-[900] tracking-wide text-white/70">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
            placeholder="demo1234"
          />
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-[800] text-white/60">
            <div>
              Demo email: <span className="text-white/85">{DEMO_EMAIL}</span>
            </div>
            <div className="mt-1">
              Demo password: <span className="text-white/85">{DEMO_PASSWORD}</span>
            </div>
          </div>
        </label>

        <button
          type="submit"
          className="mt-2 inline-flex h-11 items-center justify-center rounded-2xl bg-white text-sm font-[900] text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          Sign in
        </button>

        <div className="mt-2 text-sm font-[800] text-white/65">
          Mau onboarding demo?{" "}
          <Link href="/register" className="text-white/90 underline underline-offset-4 hover:text-white">
            Isi data dulu
          </Link>
          .
        </div>
      </form>
    </div>
  );
}

