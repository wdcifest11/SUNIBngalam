"use client";

import type { CSSProperties } from "react";

import "./Threads.css";

type ThreadsProps = {
  className?: string;
  style?: CSSProperties;
  backgroundColor?: string; // "r g b"
  lineColor?: string; // "#rrggbb" or "r g b"
  lineAlpha?: number;
  warpAlpha?: number;
  interactive?: boolean;
};

function clampByte(n: number) {
  if (!Number.isFinite(n)) return 255;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseRgbParts(rgbString: string) {
  const parts = rgbString
    .trim()
    .split(/\s+/)
    .map((x) => Number(x));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { r: clampByte(parts[0]), g: clampByte(parts[1]), b: clampByte(parts[2]) };
}

function parseHex(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
}

function parseColor(input?: string) {
  const raw = String(input || "").trim();
  if (!raw) return { r: 255, g: 255, b: 255 };
  if (raw.startsWith("#")) return parseHex(raw) ?? { r: 255, g: 255, b: 255 };
  return parseRgbParts(raw) ?? { r: 255, g: 255, b: 255 };
}

function rgba({ r, g, b }: { r: number; g: number; b: number }, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function Threads({
  className = "",
  style,
  backgroundColor = "255 255 255",
  lineColor,
  lineAlpha = 0.12,
  warpAlpha = 0.16,
  interactive = true,
}: ThreadsProps) {
  const bg = parseColor(backgroundColor);
  const baseLine = lineColor ? parseColor(lineColor) : bg;

  const cssVars: CSSProperties = {
    ["--threads-bg" as any]: rgba(bg, 0.18),
    ["--threads-line" as any]: rgba(baseLine, lineAlpha),
    ["--threads-warp" as any]: rgba(baseLine, warpAlpha),
  };

  return (
    <div
      className={["reactbits-threads", className].filter(Boolean).join(" ")}
      style={{ ...cssVars, ...(style || {}) }}
      onPointerMove={
        interactive
          ? (e) => {
              try {
                const el = e.currentTarget as HTMLElement;
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                el.style.setProperty("--threads-x", `${x}px`);
                el.style.setProperty("--threads-y", `${y}px`);
              } catch {
                // ignore
              }
            }
          : undefined
      }
      aria-hidden="true"
    />
  );
}

