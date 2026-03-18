"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type InitialValues = {
  university: string;
  major: string;
  cohort: string;
  focusGoal: string;
  focusSessionMins: number;
  prefersBattles: boolean;
  prefersGuild: boolean;
};

type Props = {
  completeAction: (formData: FormData) => void | Promise<void>;
  skipAction: (formData: FormData) => void | Promise<void>;
  initial: InitialValues;
};

function clampStep(v: number) {
  if (v < 0) return 0;
  if (v > 2) return 2;
  return v;
}

export default function OnboardingWizard({ completeAction, skipAction, initial }: Props) {
  const [step, setStep] = useState(0);
  const [university, setUniversity] = useState(initial.university);
  const [major, setMajor] = useState(initial.major);
  const [cohort, setCohort] = useState(initial.cohort);
  const [focusGoal, setFocusGoal] = useState(initial.focusGoal || "Build a habit");
  const [focusSessionMins, setFocusSessionMins] = useState<number>(initial.focusSessionMins || 25);
  const [prefersBattles, setPrefersBattles] = useState<boolean>(initial.prefersBattles);
  const [prefersGuild, setPrefersGuild] = useState<boolean>(initial.prefersGuild);

  const goals = useMemo(
    () => [
      { value: "Build a habit", desc: "Stay consistent with a simple daily routine." },
      { value: "Finish assignments", desc: "Turn deadlines into focus blocks and checklists." },
      { value: "Exam prep", desc: "Focus sessions + review loops + streak pressure." },
    ],
    []
  );

  const stepTitle = step === 0 ? "Welcome" : step === 1 ? "Your preferences" : "Studium Focus Mode";

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-[900] tracking-[0.22em] text-white/60">STUDIUM</div>
          <h1 className="mt-3 text-3xl font-[900] tracking-[-0.02em]">{stepTitle}</h1>
          <p className="mt-2 text-sm font-[800] text-white/65">A quick setup to personalize your Focus Mode.</p>
        </div>

        <div className="flex items-center gap-2">
          <form action={skipAction}>
            <button
              type="submit"
              className="rounded-xl border border-white/12 bg-white/10 px-4 py-2 text-xs font-[900] text-white/80 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/45"
            >
              Skip for now
            </button>
          </form>
          <Link
            href="/"
            className="rounded-xl border border-white/12 bg-white/10 px-4 py-2 text-xs font-[900] text-white/80 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/45"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className={[
              "h-2 w-10 rounded-full border border-white/10 transition",
              n <= step ? "bg-gradient-to-r from-cyan-200/80 via-violet-200/80 to-fuchsia-200/80" : "bg-white/10",
            ].join(" ")}
            aria-hidden="true"
          />
        ))}
        <div className="ml-2 text-xs font-[900] text-white/55">Step {step + 1} / 3</div>
      </div>

      <form action={completeAction} className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
        <input type="hidden" name="focusGoal" value={focusGoal} />
        <input type="hidden" name="focusSessionMins" value={String(focusSessionMins)} />

        <div className={step === 0 ? "" : "hidden"}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative mx-auto h-44 w-44 shrink-0 md:mx-0 md:h-52 md:w-52">
              <Image src="/blockyPng/greetings.png" alt="" fill className="object-contain" priority />
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-xl font-[900] tracking-[-0.02em] text-white/95">Hey! I'm your Studium buddy.</div>
              <div className="text-sm font-[800] leading-relaxed text-white/70">
                I'll help you convert schedules + deadlines into a daily routine - then keep it fun with XP, streaks, and optional battles + guild nudges.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-[800] text-white/75">
                Takes ~30 seconds. You can change this later.
              </div>
            </div>
          </div>
        </div>

        <div className={step === 1 ? "flex flex-col gap-5" : "hidden"}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-[900] tracking-wide text-white/70">University (optional)</span>
              <input
                name="university"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
                placeholder="e.g. BINUS"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-[900] tracking-wide text-white/70">Major (optional)</span>
              <input
                name="major"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
                placeholder="e.g. Computer Science"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-[900] tracking-wide text-white/70">Cohort (optional)</span>
              <input
                name="cohort"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-[800] text-white/90 outline-none focus:ring-2 focus:ring-white/35"
                placeholder="e.g. B29"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-[900] tracking-[0.18em] text-white/60">GOAL</div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {goals.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setFocusGoal(g.value)}
                    className={[
                      "flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/35",
                      focusGoal === g.value ? "border-cyan-200/30 bg-cyan-200/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div>
                      <div className="text-sm font-[900] text-white/90">{g.value}</div>
                      <div className="mt-1 text-xs font-[800] text-white/60">{g.desc}</div>
                    </div>
                    <div className="mt-1 text-white/70" aria-hidden="true">
                      {focusGoal === g.value ? <i className="fa-solid fa-circle-check" /> : <i className="fa-regular fa-circle" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-[900] tracking-[0.18em] text-white/60">FOCUS</div>
              <div className="mt-3 flex flex-col gap-3">
                <div className="text-sm font-[900] text-white/90">Session length</div>
                <div className="flex flex-wrap gap-2">
                  {[25, 50].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFocusSessionMins(mins)}
                      className={[
                        "rounded-2xl border px-4 py-2 text-sm font-[900] transition",
                        focusSessionMins === mins ? "border-violet-200/30 bg-violet-200/10 text-white/90" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                    <div>
                      <div className="text-sm font-[900] text-white/90">Enable Battles</div>
                      <div className="text-xs font-[800] text-white/60">Quick quizzes to warm up + win XP.</div>
                    </div>
                    <input
                      type="checkbox"
                      name="prefersBattles"
                      checked={prefersBattles}
                      onChange={(e) => setPrefersBattles(e.target.checked)}
                      className="h-5 w-5 accent-cyan-200"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                    <div>
                      <div className="text-sm font-[900] text-white/90">Enable Guild nudges</div>
                      <div className="text-xs font-[800] text-white/60">Opt-in accountability with friends.</div>
                    </div>
                    <input
                      type="checkbox"
                      name="prefersGuild"
                      checked={prefersGuild}
                      onChange={(e) => setPrefersGuild(e.target.checked)}
                      className="h-5 w-5 accent-violet-200"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={step === 2 ? "" : "hidden"}>
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-[900] tracking-[0.18em] text-white/60">YOUR SETUP</div>
                  <div className="mt-2 text-lg font-[900] text-white/90">{focusGoal}</div>
                  <div className="mt-1 text-sm font-[800] text-white/60">
                    {focusSessionMins} min sessions | Battles: {prefersBattles ? "On" : "Off"} | Guild nudges: {prefersGuild ? "On" : "Off"}
                  </div>
                </div>
                <div className="relative h-16 w-16 shrink-0">
                  <Image src="/blockyPng/idle.png" alt="" fill className="object-contain" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { title: "Daily Routine", desc: "Turns deadlines + schedules into actionable steps.", icon: "fa-solid fa-list-check", img: "/blockyPng/tasks.png" },
                { title: "Focus Sessions", desc: "Fullscreen Pomodoro that links to quests/tasks.", icon: "fa-solid fa-stopwatch", img: "/blockyPng/study.png" },
                { title: "Notes + Review", desc: "Capture quickly after focus, then review to retain.", icon: "fa-solid fa-note-sticky", img: "/blockyPng/sleep.png" },
              ].map((x) => (
                <div key={x.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-black/25">
                        <i className={x.icon} aria-hidden="true"></i>
                      </span>
                      <div className="text-sm font-[900] text-white/90">{x.title}</div>
                    </div>
                    <div className="relative h-10 w-10 shrink-0">
                      <Image src={x.img} alt="" fill className="object-contain" />
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-[800] leading-relaxed text-white/65">{x.desc}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-sm font-[800] text-cyan-50/90">
              Tip: Press <span className="rounded-md bg-black/20 px-2 py-1 font-[900]">Enter</span> anytime to jump into Focus Mode from the landing page.
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => clampStep(s - 1))}
            disabled={step === 0}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-5 text-sm font-[900] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          <div className="flex items-center gap-2">
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((s) => clampStep(s + 1))}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 px-6 text-sm font-[900] text-black transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-200 via-violet-200 to-fuchsia-200 px-6 text-sm font-[900] text-black transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                Finish & enter dashboard
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
