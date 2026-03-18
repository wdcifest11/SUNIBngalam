"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../../lib/auth/demo";

export default function Page() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gmail, setGmail] = useState("");
  const [prefBattles, setPrefBattles] = useState(true);
  const [prefGuild, setPrefGuild] = useState(true);
  const [errorText, setErrorText] = useState("");

  const submit = () => {
    setErrorText("");
    const cleanedName = fullName.trim();
    const cleanedGmail = gmail.trim().toLowerCase();
    const cleanedBirth = String(birthDate || "").trim();
    const nAge = Number(String(age || "").trim());

    const invalid =
      !cleanedName ||
      cleanedName.length < 2 ||
      !cleanedGmail ||
      !cleanedGmail.includes("@") ||
      !Number.isFinite(nAge) ||
      nAge < 5 ||
      nAge > 120 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cleanedBirth);

    if (invalid) {
      if (!cleanedName || cleanedName.length < 2) setErrorText("Nama lengkap minimal 2 karakter.");
      else if (!cleanedGmail || !cleanedGmail.includes("@")) setErrorText("Gmail tidak valid.");
      else if (!Number.isFinite(nAge) || nAge < 5 || nAge > 120) setErrorText("Umur tidak valid.");
      else setErrorText("Tanggal lahir tidak valid.");
      return;
    }

    try {
      localStorage.setItem("studium:demo:signed_in", "1");
      localStorage.setItem(
        "studium:demo:profile:v1",
        JSON.stringify({
          fullName: cleanedName,
          gmail: cleanedGmail,
          age: nAge,
          birthDate: cleanedBirth,
          prefersBattles: prefBattles,
          prefersGuild: prefGuild,
          updatedAt: Date.now(),
        })
      );
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
          <h1 className="mt-3 text-3xl font-[900] tracking-[-0.02em]">Onboarding (Demo)</h1>
          <p className="mt-2 text-sm font-[700] text-white/65">Isi data singkat, lalu masuk Focus Mode dengan akun demo.</p>
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
        className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-xs font-[900] tracking-[0.18em] text-white/60">DEMO ONBOARDING</div>
          <div className="mt-2 text-xl font-[900] tracking-[-0.02em] text-white/90">
            Halo, <span className="bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">Demo</span>.
          </div>
          <div className="mt-2 text-sm font-[800] leading-relaxed text-white/70">
            Kamu tetap pakai akun demo, tapi isi profil dulu biar Focus Mode terasa personal.
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-[900] tracking-wide text-white/70">Nama lengkap</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            name="fullName"
            type="text"
            required
            autoComplete="name"
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
            placeholder="Nama lengkap kamu"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-[900] tracking-wide text-white/70">Umur</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              name="age"
              type="number"
              required
              min={5}
              max={120}
              inputMode="numeric"
              className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
              placeholder="17"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-[900] tracking-wide text-white/70">Tanggal lahir</span>
            <input
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              name="birthDate"
              type="date"
              required
              className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-[900] tracking-wide text-white/70">Gmail</span>
          <input
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            name="gmail"
            type="email"
            required
            autoComplete="email"
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
            placeholder="nama@gmail.com"
          />
        </label>

        <div className="rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="text-xs font-[900] tracking-[0.18em] text-white/60">PREFERENSI</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-[900] text-white/90">Battle</div>
                <div className="text-xs font-[800] text-white/60">Mode 1v1 buat nambah semangat.</div>
              </div>
              <input
                type="checkbox"
                name="prefersBattles"
                checked={prefBattles}
                onChange={(e) => setPrefBattles(e.target.checked)}
                className="h-5 w-5 accent-cyan-200"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-[900] text-white/90">Study room</div>
                <div className="text-xs font-[800] text-white/60">Co-focus bareng teman/guild.</div>
              </div>
              <input
                type="checkbox"
                name="prefersGuild"
                checked={prefGuild}
                onChange={(e) => setPrefGuild(e.target.checked)}
                className="h-5 w-5 accent-violet-200"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 inline-flex h-11 items-center justify-center rounded-2xl bg-white text-sm font-[900] text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          Lanjutkan pakai akun demo
        </button>

        <div className="mt-2 text-sm font-[800] text-white/65">
          Sudah mau sign in?{" "}
          <Link href="/sign-in" className="text-white/90 underline underline-offset-4 hover:text-white">
            Sign in
          </Link>
          .
        </div>

        <div className="text-xs font-[800] text-white/55">
          Demo login: <span className="text-white/80">{DEMO_EMAIL}</span> / <span className="text-white/80">{DEMO_PASSWORD}</span>
        </div>
      </form>
    </div>
  );
}

