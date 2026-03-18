"use client";

import { useEffect, useState } from "react";

import FloatingLines from "./FloatingLines";
import Threads from "./Threads";
import Waves from "./reactbits/Waves";

function readGlassTint() {
  if (typeof window === "undefined") return "255 255 255";
  const value = window.getComputedStyle(document.body).getPropertyValue("--glass-tint").trim();
  return value || "255 255 255";
}

function clampByte(n: number) {
  if (!Number.isFinite(n)) return 255;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number) {
  const rr = clampByte(r).toString(16).padStart(2, "0");
  const gg = clampByte(g).toString(16).padStart(2, "0");
  const bb = clampByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function tintToThreadsColor(tint: string) {
  const parts = tint.split(/\s+/).map((x) => Number(x));
  if (parts.length < 3) return "#b19eef";
  const [r, g, b] = parts;

  // Match page tint, but keep it subtle so the threads aren't distracting.
  const mixWithWhite = 0.76;
  const dim = 0.62;
  const rr = (r * (1 - mixWithWhite) + 255 * mixWithWhite) * dim;
  const gg = (g * (1 - mixWithWhite) + 255 * mixWithWhite) * dim;
  const bb = (b * (1 - mixWithWhite) + 255 * mixWithWhite) * dim;
  return rgbToHex(rr, gg, bb);
}

function readGlassAlphaStrong() {
  if (typeof window === "undefined") return 0.36;
  const raw = window.getComputedStyle(document.body).getPropertyValue("--glass-alpha-strong").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0.36;
}

function readView() {
  if (typeof document === "undefined") return "dashboard";
  return document.body?.dataset?.view || "dashboard";
}

function readSubview() {
  if (typeof document === "undefined") return "";
  return document.body?.dataset?.subview || "";
}

function readQuestDetail() {
  if (typeof document === "undefined") return false;
  return document.body?.classList?.contains("quest-detail") ?? false;
}

function tintToRgba(tint: string, alpha: number) {
  const parts = tint.split(/\s+/).map((x) => Number(x));
  const [r, g, b] = parts.length >= 3 ? parts : [255, 255, 255];
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${Math.min(1, Math.max(0, alpha))})`;
}

export default function ShellBackground() {
  // Important: keep the initial render deterministic to avoid hydration mismatches.
  const [glassTint, setGlassTint] = useState("255 255 255");
  const [glassAlphaStrong, setGlassAlphaStrong] = useState(0.36);
  const [view, setView] = useState("dashboard");
  const [subview, setSubview] = useState("");
  const [questDetail, setQuestDetail] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      setGlassTint(readGlassTint());
      setGlassAlphaStrong(readGlassAlphaStrong());
      setView(readView());
      setSubview(readSubview());
      setQuestDetail(readQuestDetail());
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-view", "class", "style"],
    });

    return () => observer.disconnect();
  }, []);

  const backgroundStrength = Math.min(0.32, Math.max(0.16, glassAlphaStrong * 0.9));
  const threadsColor = tintToThreadsColor(glassTint);
  const matchDetail = view === "match" || subview === "match-detail";
  const studyStrict = subview === "study-room-strict";

  if (!mounted) return null;

  return (
    <>
      {studyStrict ? (
        <div className="bg__waves" aria-hidden="true">
          <Waves
            backgroundColor={tintToRgba(glassTint, 0.2)}
            lineColor={tintToRgba(glassTint, 0.22)}
            waveSpeedX={0.009}
            waveSpeedY={0.004}
            waveAmpX={22}
            waveAmpY={12}
            xGap={12}
            yGap={34}
            friction={0.92}
            tension={0.005}
            maxCursorMove={80}
          />
        </div>
      ) : questDetail || matchDetail ? (
        <div className="bg__threads" aria-hidden="true">
          <Threads backgroundColor={glassTint} lineColor={threadsColor} lineAlpha={0.12} warpAlpha={0.16} interactive />
        </div>
      ) : (
        <div className="bg__floating-lines" aria-hidden="true">
          <FloatingLines
            key={view}
            linesGradient={["#ffffff", "#ffffff"]}
            topWavePosition={undefined}
            middleWavePosition={undefined}
            animationSpeed={1}
            interactive
            bendRadius={5}
            bendStrength={-0.5}
            mouseDamping={0.05}
            parallax
            parallaxStrength={0.2}
            mixBlendMode="normal"
            backgroundColor={glassTint}
            backgroundStrength={backgroundStrength}
            lineBrightness={0.1}
          />
        </div>
      )}
    </>
  );
}
