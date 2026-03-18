"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Waves from "../reactbits/Waves";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Landing() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoError, setDemoError] = useState<string>("");
  const [demoFullName, setDemoFullName] = useState("");
  const [demoAge, setDemoAge] = useState("");
  const [demoBirthDate, setDemoBirthDate] = useState("");
  const [demoGmail, setDemoGmail] = useState("");
  const [demoPrefBattles, setDemoPrefBattles] = useState(true);
  const [demoPrefGuild, setDemoPrefGuild] = useState(true);

  useEffect(() => {
    document.body.classList.add("nav-mode");
    document.body.classList.remove("grid-mode");
    document.body.dataset.view = "dashboard";
    document.body.classList.remove("drawer-open");
  }, []);

  const enterTo = async (to: string) => {
    if (entering) return;
    setEntering(true);

     try {
      const muteAll = localStorage.getItem("studium:qs_mute_all") === "1";
      if (!muteAll) {
        const savedVol = Number(localStorage.getItem("studium:qs_sfx_volume"));
        const v = Number.isFinite(savedVol) ? Math.max(0, Math.min(100, savedVol)) / 100 : 0.55;
        const a = new Audio("/sound/boot.mp3");
        a.volume = 0.7 * v;
        a.preload = "auto";
        const p = a.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch {
      // ignore
    }

    try {
      localStorage.setItem("studium:pref_fullscreen", "1");
    } catch {
      // ignore
    }

    try {
      const el = document.documentElement as any;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (!document.fullscreenElement && typeof fn === "function") {
        const p = fn.call(el);
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch {
      // ignore
    }

    window.setTimeout(() => router.push(to), 380);
  };

  const enter = async () => enterTo("/sign-in");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.repeat) return;
      if (demoModalOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setDemoModalOpen(false);
        }
        return;
      }

      if (e.key === "Enter" || e.key.toLowerCase() === "e") {
        e.preventDefault();
        void enter();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering, demoModalOpen]);

  const submitDemoOnboarding = async () => {
    if (demoSubmitting) return;
    setDemoError("");

    const fullName = demoFullName.trim();
    const gmail = demoGmail.trim().toLowerCase();
    const age = Number(String(demoAge || "").trim());
    const birthDate = String(demoBirthDate || "").trim();

    const invalid =
      !fullName ||
      fullName.length < 2 ||
      !gmail ||
      !gmail.includes("@") ||
      !Number.isFinite(age) ||
      age < 5 ||
      age > 120 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate);

    if (invalid) {
      if (!fullName || fullName.length < 2) setDemoError("Nama lengkap minimal 2 karakter.");
      else if (!gmail || !gmail.includes("@")) setDemoError("Gmail tidak valid.");
      else if (!Number.isFinite(age) || age < 5 || age > 120) setDemoError("Umur tidak valid.");
      else setDemoError("Tanggal lahir tidak valid.");
      return;
    }

    setDemoSubmitting(true);
    try {
      localStorage.setItem("studium:demo:signed_in", "1");
      localStorage.setItem(
        "studium:demo:profile:v1",
        JSON.stringify({
          fullName,
          gmail,
          age,
          birthDate,
          prefersBattles: demoPrefBattles,
          prefersGuild: demoPrefGuild,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // ignore
    }

    setDemoModalOpen(false);
    setDemoSubmitting(false);
    void enterTo("/dashboard");
  };

  const featureCards = useMemo(
    () => [
      {
        kicker: "NOTE TAKING",
        desc: "Capture what you learned right after a Focus session — quick, lightweight, and easy to review later.",
        img: "/blockyPng/takeNote.png",
        tone: "from-cyan-200/18 via-violet-200/12 to-transparent",
      },
      {
        kicker: "BATTLE",
        desc: "Turn revision into a quick 1v1. Answer fast, win XP, and build momentum when motivation dips.",
        img: "/blockyPng/battle.png",
        tone: "from-amber-200/18 via-fuchsia-200/10 to-transparent",
      },
      {
        kicker: "STUDY ROOM",
        desc: "Co-focus with friends (or your guild). Stay accountable and make studying feel less lonely.",
        img: "/blockyPng/study.png",
        tone: "from-emerald-200/16 via-cyan-200/10 to-transparent",
      },
      {
        kicker: "QUEST",
        desc: "Small, clear objectives that guide your day. Finish quests to keep your streak alive and your brain calm.",
        img: "/blockyPng/tasks.png",
        tone: "from-violet-200/18 via-cyan-200/10 to-transparent",
      },
      {
        kicker: "SCHEDULE",
        desc: "Your agenda + deadlines become a simple plan you can actually follow inside Focus Mode.",
        img: "/blockyPng/schedule.png",
        tone: "from-cyan-200/18 via-amber-200/12 to-transparent",
      },
    ],
    []
  );

  return (
    <div className="relative min-h-screen text-white">
      <Waves
        className="opacity-55"
        backgroundColor="transparent"
        lineColor="rgba(255,255,255,0.08)"
        waveAmpX={28}
        waveAmpY={14}
        xGap={12}
        yGap={34}
        waveSpeedX={0.0105}
        waveSpeedY={0.0045}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1020]/55 via-black/60 to-black/85" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(1100px_650px_at_18%_18%,rgba(34,211,238,0.22),transparent_60%),radial-gradient(900px_700px_at_80%_24%,rgba(168,85,247,0.22),transparent_60%),radial-gradient(900px_700px_at_50%_85%,rgba(251,191,36,0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background:radial-gradient(1px_1px_at_20%_30%,rgba(255,255,255,0.45),transparent_40%),radial-gradient(1px_1px_at_40%_60%,rgba(255,255,255,0.35),transparent_40%),radial-gradient(1px_1px_at_65%_25%,rgba(255,255,255,0.40),transparent_40%),radial-gradient(1px_1px_at_80%_65%,rgba(255,255,255,0.35),transparent_40%)]" />

      <div
        className={clsx(
          "relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-8 transition-all duration-500",
          entering && "opacity-0 blur-sm translate-y-2"
        )}
      >
        <header className="flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="group inline-flex items-baseline gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Back to top"
          >
            <span className="bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 bg-clip-text font-[900] tracking-[0.22em] text-transparent">
              STUDIUM
            </span>
            <span className="text-xs font-[700] text-white/55">v1</span>
          </button>

          <nav className="hidden items-center gap-2 md:flex" aria-label="Landing navigation">
            <a
              href="#about"
              className="rounded-lg px-3 py-2 text-sm font-[700] text-white/70 transition hover:bg-white/5 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-white/35"
            >
              About
            </a>
            <a
              href="#features"
              className="rounded-lg px-3 py-2 text-sm font-[700] text-white/70 transition hover:bg-white/5 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-white/35"
            >
              Features
            </a>
            <a
              href="#faq"
              className="rounded-lg px-3 py-2 text-sm font-[700] text-white/70 transition hover:bg-white/5 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-white/35"
            >
              FAQ
            </a>
            <Link
              href="/sign-in"
              onClick={(e) => {
                e.preventDefault();
                void enterTo("/sign-in");
              }}
              className="rounded-lg px-3 py-2 text-sm font-[800] text-white/70 transition hover:bg-white/5 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-white/35"
            >
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/register"
              onClick={(e) => {
                e.preventDefault();
                setDemoError("");
                setDemoModalOpen(true);
              }}
              className="inline-flex rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-[900] text-white/85 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/45"
            >
              Register
            </Link>
            <button
              type="button"
              onClick={enter}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 px-4 py-2 text-sm font-[900] text-black shadow-[0_20px_80px_rgba(168,85,247,0.25)] transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <span>Enter Studium Focus Mode</span>
              <span className="rounded-md bg-black/10 px-2 py-1 text-[11px] font-[900] tracking-wide">Enter</span>
            </button>
          </div>
        </header>

        {demoModalOpen ? (
          <div
            className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Demo onboarding"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDemoModalOpen(false);
            }}
          >
            <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-gradient-to-b from-[#0b1020]/95 via-black/92 to-black/88 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-[900] tracking-[0.22em] text-white/60">DEMO ONBOARDING</div>
                  <div className="mt-2 text-2xl font-[900] tracking-[-0.02em] text-white/90">
                    Halo,{" "}
                    <span className="bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">Demo</span>.
                  </div>
                  <div className="mt-2 text-sm font-[800] text-white/70">
                    Isi profil singkat dulu, tetap masuk pakai akun demo.
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/80 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/45"
                  aria-label="Close"
                  onClick={() => setDemoModalOpen(false)}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>

              {demoError ? (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-[800] text-red-100/90">
                  {demoError}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-[900] tracking-wide text-white/70">Nama lengkap</span>
                  <input
                    value={demoFullName}
                    onChange={(e) => setDemoFullName(e.target.value)}
                    type="text"
                    autoComplete="name"
                    className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
                    placeholder="Nama lengkap kamu"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-[900] tracking-wide text-white/70">Umur</span>
                    <input
                      value={demoAge}
                      onChange={(e) => setDemoAge(e.target.value)}
                      type="number"
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
                      value={demoBirthDate}
                      onChange={(e) => setDemoBirthDate(e.target.value)}
                      type="date"
                      className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-[900] tracking-wide text-white/70">Gmail</span>
                  <input
                    value={demoGmail}
                    onChange={(e) => setDemoGmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
                    placeholder="nama@gmail.com"
                  />
                </label>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-[900] tracking-[0.18em] text-white/60">PREFERENSI</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDemoPrefBattles((v) => !v)}
                      className={clsx(
                        "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/45",
                        demoPrefBattles ? "border-cyan-200/25 bg-cyan-200/10" : "border-white/10 bg-black/20"
                      )}
                      aria-pressed={demoPrefBattles}
                    >
                      <div>
                        <div className="text-sm font-[900] text-white/90">Battle</div>
                        <div className="text-xs font-[800] text-white/60">Mode 1v1 buat nambah semangat.</div>
                      </div>
                      <div className={clsx("h-6 w-11 rounded-full border border-white/10 p-[3px]", demoPrefBattles ? "bg-cyan-200/25" : "bg-white/10")}>
                        <div className={clsx("h-5 w-5 rounded-full bg-white transition", demoPrefBattles ? "translate-x-5" : "translate-x-0")} />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDemoPrefGuild((v) => !v)}
                      className={clsx(
                        "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/45",
                        demoPrefGuild ? "border-violet-200/25 bg-violet-200/10" : "border-white/10 bg-black/20"
                      )}
                      aria-pressed={demoPrefGuild}
                    >
                      <div>
                        <div className="text-sm font-[900] text-white/90">Study room</div>
                        <div className="text-xs font-[800] text-white/60">Co-focus bareng teman/guild.</div>
                      </div>
                      <div className={clsx("h-6 w-11 rounded-full border border-white/10 p-[3px]", demoPrefGuild ? "bg-violet-200/25" : "bg-white/10")}>
                        <div className={clsx("h-5 w-5 rounded-full bg-white transition", demoPrefGuild ? "translate-x-5" : "translate-x-0")} />
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={demoSubmitting}
                  onClick={() => void submitDemoOnboarding()}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 px-6 text-sm font-[900] text-black transition hover:brightness-95 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  {demoSubmitting ? "Menyimpan..." : "Lanjutkan pakai akun demo"}
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-[800] text-white/65">
                  Demo login: <span className="text-white/85">{DEMO_EMAIL}</span> / <span className="text-white/85">{DEMO_PASSWORD}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <main id="top" className="grid grid-cols-1 items-start gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-12">
          <section className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-xs font-[900] text-white/80 backdrop-blur-xl">
              <i className="fa-solid fa-wand-magic-sparkles text-white/80" aria-hidden="true"></i>
              <span>Study like a game • Finish like a pro</span>
            </div>

              <h1 className="text-balance text-4xl font-[900] leading-[1.05] tracking-[-0.03em] md:text-6xl">
                Turn deadlines into a{" "}
                <span className="bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent [text-shadow:0_20px_60px_rgba(0,0,0,0.55)]">
                  daily routine
                </span>
                .
              </h1>

            <p className="max-w-xl text-pretty text-base font-[700] leading-relaxed text-white/70 md:text-lg">
              Studium auto-builds your routine from schedules + deadlines, then keeps you coming back with XP, streaks, battles, and guild
              accountability.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enter}
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 px-6 py-3 text-sm font-[900] text-black shadow-[0_22px_90px_rgba(34,211,238,0.18)] transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <i className="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
                <span>Enter Studium Focus Mode</span>
              </button>

              <a
                href="#features"
                className="inline-flex items-center gap-3 rounded-2xl border border-white/14 bg-white/10 px-6 py-3 text-sm font-[900] text-white/85 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/45"
              >
                <i className="fa-solid fa-star" aria-hidden="true"></i>
                <span>See features</span>
              </a>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs font-[900] text-white/70">
              <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-cyan-50/90">Schedule</span>
              <span className="rounded-full border border-violet-200/20 bg-violet-200/10 px-3 py-2 text-violet-50/90">Quests</span>
              <span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-emerald-50/90">Study Room</span>
              <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-amber-50/90">Battle</span>
              <span className="rounded-full border border-fuchsia-200/20 bg-fuchsia-200/10 px-3 py-2 text-fuchsia-50/90">Note Taking</span>
            </div>

            <div className="flex items-center gap-3 text-xs font-[800] text-white/55">
              <i className="fa-solid fa-wand-sparkles text-white/55" aria-hidden="true"></i>
              <span>First time? You'll get a quick onboarding to set preferences and learn Focus Mode.</span>
            </div>
          </section>

          <aside className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/10 p-0 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="absolute inset-0 opacity-75 [background:radial-gradient(700px_500px_at_20%_20%,rgba(34,211,238,0.20),transparent_60%),radial-gradient(900px_650px_at_75%_35%,rgba(168,85,247,0.20),transparent_60%),radial-gradient(900px_650px_at_60%_90%,rgba(251,191,36,0.10),transparent_60%)]" />
            <div className="relative h-[340px] w-full md:h-[420px]" aria-hidden="true">
              <div className="pointer-events-none absolute -right-12 -top-12 opacity-95">
                <div className="floaty relative h-[380px] w-[380px] md:h-[480px] md:w-[480px]">
                  <Image
                    src="/blockyPng/greetings.png"
                    alt=""
                    fill
                    className="object-contain drop-shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
                    priority
                  />
                </div>
              </div>
            </div>
          </aside>
        </main>

        <section id="about" className="grid grid-cols-1 gap-6 rounded-3xl border border-white/10 bg-black/30 p-8 backdrop-blur-xl md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="text-xs font-[900] tracking-[0.22em] text-white/60">ABOUT</div>
            <div className="text-2xl font-[900] tracking-[-0.02em] text-white/92 md:text-3xl">
              A focus-first dashboard for students who need structure.
            </div>
          </div>
          <div className="text-sm font-[700] leading-relaxed text-white/70 md:text-base">
            The core is a Daily Routine that turns tasks, schedules, and deadlines into concrete steps. Then we keep it sticky with
            gamification (XP, levels, streaks) and optional social accountability (co-focus, guild nudges).
          </div>
        </section>

        <section id="focus-mode" className="rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-[900] tracking-[0.22em] text-white/60">FOCUS MODE</div>
              <div className="mt-3 text-2xl font-[900] tracking-[-0.02em] text-white/92 md:text-3xl">What you get when you press Enter.</div>
              <div className="mt-2 text-sm font-[800] text-white/65">A routine engine + game loop that keeps you consistent.</div>
            </div>
            <a
              href="#features"
              className="mt-4 inline-flex items-center gap-2 self-start rounded-xl border border-white/14 bg-black/25 px-4 py-2 text-xs font-[900] text-white/80 transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/45 md:mt-0"
            >
              <i className="fa-solid fa-sparkles" aria-hidden="true"></i>
              <span>See full feature list</span>
            </a>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "Auto-build your day",
                desc: "Your deadlines + schedule become a concrete checklist: Focus -> Notes -> Review.",
                img: "/blockyPng/tasks.png",
                tone: "from-cyan-200/25 to-cyan-200/5",
              },
              {
                title: "Deep focus sessions",
                desc: "Pomodoro in a clean fullscreen shell. Less tab chaos, more momentum.",
                img: "/blockyPng/study.png",
                tone: "from-violet-200/25 to-violet-200/5",
              },
              {
                title: "Fun accountability",
                desc: "XP, streaks, battles, and guild nudges — optional, but motivating.",
                img: "/blockyPng/battle.png",
                tone: "from-amber-200/25 to-amber-200/5",
              },
            ].map((x) => (
              <div key={x.title} className={clsx("rounded-3xl border border-white/10 bg-gradient-to-b p-6", x.tone)}>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-base font-[900] text-white/90">{x.title}</div>
                  <div className="relative h-12 w-12 shrink-0">
                    <Image src={x.img} alt="" fill className="object-contain" />
                  </div>
                </div>
                <div className="mt-3 text-sm font-[800] leading-relaxed text-white/70">{x.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-8 backdrop-blur-xl md:p-12">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(900px_600px_at_18%_15%,rgba(34,211,238,0.12),transparent_60%),radial-gradient(850px_650px_at_82%_25%,rgba(168,85,247,0.12),transparent_60%),radial-gradient(850px_650px_at_65%_90%,rgba(251,191,36,0.08),transparent_60%)]" />

          <div className="relative flex flex-col gap-3">
            <div className="text-xs font-[900] tracking-[0.22em] text-white/60">FEATURES</div>
            <div className="text-2xl font-[900] tracking-[-0.02em] text-white/92 md:text-3xl">Five features, one simple loop.</div>
            <div className="max-w-2xl text-sm font-[800] leading-relaxed text-white/65 md:text-base">
              Everything is designed around Focus Mode: plan your day, do the work, and feel the progress.
            </div>
          </div>

          <div className="relative mt-12 flex flex-col gap-14 md:gap-20">
            {featureCards.map((f) => (
              <div key={f.kicker} className="grid items-center gap-10 md:grid-cols-[1fr_440px] md:gap-12">
                <div className="flex flex-col gap-4">
                  <div className="text-xs font-[900] tracking-[0.28em] text-white/70">{f.kicker}</div>
                  <div className="max-w-xl text-pretty text-sm font-[800] leading-relaxed text-white/72 md:text-base">{f.desc}</div>
                </div>

                <div className="relative mx-auto w-full max-w-[440px]">
                  <div
                    className={clsx(
                      "pointer-events-none absolute -inset-8 rounded-[40px] bg-gradient-to-br blur-2xl md:-inset-10",
                      f.tone
                    )}
                    aria-hidden="true"
                  />
                  <div className="relative aspect-square w-full">
                    <Image src={f.img} alt="" fill className="object-contain drop-shadow-[0_45px_120px_rgba(0,0,0,0.55)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
          <div className="text-xs font-[900] tracking-[0.22em] text-white/60">FAQ</div>
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              { q: "Do I need an account?", a: "Yes. Sign in (or register) before entering Studium Focus Mode." },
              { q: "Is it only for students?", a: "It's designed for students, but works for anyone who needs a daily routine." },
              { q: "What makes it different?", a: "Routine is the core: concrete steps every day, with game-like stickiness." },
              { q: "How do I start?", a: "Press Enter, sign in (or register), then you'll enter Studium Focus Mode." },
            ].map((x) => (
              <div key={x.q} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-sm font-[900] text-white/90">{x.q}</div>
                <div className="mt-2 text-sm font-[700] text-white/70">{x.a}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-4 pb-10 pt-4 md:flex-row">
          <div className="text-xs font-[900] tracking-wide text-white/55">Studium | Prototype</div>
          <button
            type="button"
            onClick={enter}
            className="inline-flex items-center gap-2 rounded-xl border border-white/14 bg-white/10 px-4 py-2 text-xs font-[900] text-white/85 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/45"
          >
            <i className="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
            <span>Press Enter to enter Studium Focus Mode</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
