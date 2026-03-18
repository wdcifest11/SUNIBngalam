"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaylistTrack } from "../../lib/music/playlist";

type Props = {
  tracks: PlaylistTrack[];
};

const LS_KEY_VOL = "studium:music_volume";
const LS_KEY_IDX = "studium:music_index";
const LS_KEY_ON = "studium:music_on";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeLocalGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export default function MusicPlayer({ tracks }: Props) {
  const [remoteTracks, setRemoteTracks] = useState<PlaylistTrack[] | null>(null);
  const list = useMemo(() => {
    if (tracks?.length) return tracks;
    return remoteTracks ?? [];
  }, [tracks, remoteTracks]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.55);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqRef = useRef<Uint8Array | null>(null);

  const orbRef = useRef<HTMLDivElement | null>(null);
  const beatRef = useRef({ avg: 0, pulse: 0 });

  const current = list[index] ?? null;

  useEffect(() => {
    if (tracks?.length) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/sound/playlist/manifest.json", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { tracks?: PlaylistTrack[] };
        const next = Array.isArray(json?.tracks) ? json.tracks.filter((t) => t && typeof t.src === "string") : [];
        if (!cancelled) setRemoteTracks(next);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tracks?.length]);

  useEffect(() => {
    const v = Number(safeLocalGet(LS_KEY_VOL));
    if (!Number.isNaN(v) && v >= 0 && v <= 1) setVolume(v);
    const idx = Number(safeLocalGet(LS_KEY_IDX));
    if (!Number.isNaN(idx) && idx >= 0) setIndex(Math.floor(idx));
    const on = safeLocalGet(LS_KEY_ON);
    if (on === "0") setEnabled(false);
  }, []);

  useEffect(() => {
    safeLocalSet(LS_KEY_VOL, String(volume));
  }, [volume]);

  useEffect(() => {
    if (!list.length) return;
    const next = clamp(index, 0, list.length - 1);
    if (next !== index) setIndex(next);
    safeLocalSet(LS_KEY_IDX, String(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list.length]);

  const ensureAudioGraph = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (ctxRef.current && analyserRef.current && gainRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // ignore
    }

    const gain = ctx.createGain();
    gain.gain.value = enabled ? volume : 0;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;

    const source = ctx.createMediaElementSource(audio);
    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    ctxRef.current = ctx;
    gainRef.current = gain;
    analyserRef.current = analyser;
    sourceRef.current = source;
    freqRef.current = new Uint8Array(analyser.frequencyBinCount);
  };

  const applyGain = () => {
    const g = gainRef.current;
    if (!g) return;
    g.gain.value = enabled ? volume : 0;
  };

  useEffect(() => {
    applyGain();
    safeLocalSet(LS_KEY_ON, enabled ? "1" : "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => next();
    const onError = () => {
      // Skip missing/failed tracks (common on deploy if audio files aren't included).
      if (list.length > 1) next();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list.length]);

  useEffect(() => {
    const tick = () => {
      const analyser = analyserRef.current;
      const arr = freqRef.current;
      const orb = orbRef.current;

      if (analyser && arr && orb) {
        analyser.getByteFrequencyData(arr as any);

        // Weighted energy: bass + some mid. Keep a stable baseline so the orb doesn't "die" after a second.
        const bassBins = Math.min(24, arr.length);
        const midStart = bassBins;
        const midEnd = Math.min(midStart + 48, arr.length);

        let bass = 0;
        for (let i = 0; i < bassBins; i++) bass += arr[i];
        bass = (bass / Math.max(1, bassBins)) / 255;

        let mid = 0;
        for (let i = midStart; i < midEnd; i++) mid += arr[i];
        mid = (mid / Math.max(1, midEnd - midStart)) / 255;

        const energy = bass * 0.72 + mid * 0.28; // 0..1 (usually small)

        const s = beatRef.current;
        s.avg = s.avg * 0.94 + energy * 0.06;
        const delta = energy - s.avg;
        const hit = clamp(delta * 6.2, 0, 1);
        s.pulse = Math.max(s.pulse * 0.84, hit);

        // Baseline follows energy, peaks punch via `pulse`.
        const beat = clamp(energy * 1.7 + s.pulse * 0.85, 0, 1);
        orb.style.setProperty("--beat", beat.toFixed(3));
      } else if (orb) {
        orb.style.setProperty("--beat", "0");
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const loadCurrent = async (autoplay = false) => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = current.src;
    audio.load();
    if (autoplay) {
      await play();
    }
  };

  useEffect(() => {
    void loadCurrent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.src]);

  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    await ensureAudioGraph();
    applyGain();
    try {
      const p = audio.play();
      if (p && typeof (p as any).catch === "function") (p as any).catch(() => {});
    } catch {
      // ignore
    }
  };

  const pause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
    } catch {
      // ignore
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) return;
    if (audio.paused) await play();
    else pause();
  };

  const next = () => {
    if (!list.length) return;
    setIndex((i) => (i + 1) % list.length);
  };

  const prev = () => {
    const audio = audioRef.current;
    if (!list.length) return;
    if (audio && audio.currentTime > 2.5) {
      audio.currentTime = 0;
      return;
    }
    setIndex((i) => (i - 1 + list.length) % list.length);
  };

  const label = current?.title ?? "No playlist";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const root = panelRef.current;
      if (!root) return;
      const ae = document.activeElement as HTMLElement | null;
      if (!ae || !root.contains(ae)) return;

      // Player-local keyboard mapping (only when focused inside the player).
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        void toggle();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setVolume((v) => clamp(v + 0.05, 0, 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setVolume((v) => clamp(v - 0.05, 0, 1));
        return;
      }
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setEnabled((x) => !x);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, index, enabled]);

  return (
    <div
      ref={panelRef}
      className="panelItem mx-3 flex w-[320px] max-w-[92vw] flex-col gap-2 rounded-2xl px-3 py-2"
      aria-label="Music player"
    >
      <audio ref={audioRef} preload="metadata" />

      <div className="flex items-center gap-3">
        <div
          ref={orbRef}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/25"
          aria-hidden="true"
          style={{
            transform: "scale(calc(1 + var(--beat, 0) * 0.26))",
            transition: "transform 70ms ease-out",
            boxShadow: "0 10px 45px rgba(0,0,0,0.35)",
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: "0 0 0 2px rgba(255,255,255,0.12), 0 0 40px rgba(255,255,255,0.10)",
              opacity: 0.8,
            }}
          />
          <div className="text-[11px] font-[900] tracking-[0.18em] text-white/85">S</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-[900] tracking-[0.18em] text-white/55">MUSIC</div>
          <div className="truncate text-[13px] font-[900] text-white/90" title={label}>
            {label}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prev}
            className="headerAction grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/85 transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/35"
            aria-label="Previous track"
          >
            <i className="fa-solid fa-backward-step" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            onClick={() => void toggle()}
            className="headerAction grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/85 transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/35"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <i className={isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} aria-hidden="true"></i>
          </button>
          <button
            type="button"
            onClick={next}
            className="headerAction grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/85 transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white/35"
            aria-label="Next track"
          >
            <i className="fa-solid fa-forward-step" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className="headerAction inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-[900] text-white/80 transition hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/35"
            aria-label="Toggle music output"
          >
            <i className={enabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"} aria-hidden="true"></i>
            <span>{enabled ? "On" : "Off"}</span>
          </button>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(clamp(Number(e.target.value) / 100, 0, 1))}
              className="h-2 w-28 accent-white"
              aria-label="Volume"
            />
            <div className="w-10 text-right text-xs font-[900] text-white/60">{Math.round(volume * 100)}</div>
          </div>
        </div>
      </div>

      {!list.length ? (
        <div className="text-xs font-[800] text-white/55">
          No tracks loaded.
        </div>
      ) : null}
    </div>
  );
}
