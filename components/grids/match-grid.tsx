/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { appData } from "@/lib/app-data";

type ShellUser = { id: number; displayName: string; avatarUrl: string };
type Props = { user: ShellUser };

type ViewId = "dashboard" | "notes" | "quest" | "schedules" | "study" | "battle" | "match";
type ModalId =
  | "about"
  | "navOrder"
  | "pageColor"
  | "density"
  | "accountProfile"
  | "accountSync"
  | "accountPrivacy"
  | "accountNotifications"
  | "utilityKeybinds"
  | "utilityDiagnostics"
  | "utilityExport"
  | "utilityImport"
  | "dangerSignOut"
  | "dangerExitFocus"
  | "dangerClearSettings"
  | "dangerFactoryReset";

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: string }> = appData.navigation.items.map((it) => ({
  id: it.id as ViewId,
  label: it.label,
  icon: it.icon,
}));

const TINT_PRESETS: Array<{ label: string; rgb: string }> = appData.ui.tintPresets.map((p) => ({ label: p.label, rgb: p.rgb }));

const LS_NAV_ORDER = "studium:nav_order";
const LS_DENSITY = "studium:ui_density";
const LS_NOTIF_BASE = "studium:qs_notifications";
const LS_PROFILE_BASE = "studium:profile_override";
const PREF_EVENT = "studium:account_prefs_updated";

function scopedAccountKey(base: string, userId: number) {
  return userId > 0 ? `${base}:u${userId}` : base;
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
function safeLocalRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = String((el as any).tagName || "").toLowerCase();
  if (tag === "textarea" || (el as any).isContentEditable) return true;
  if (tag === "input") {
    const t = String((el as any).getAttribute?.("type") || "text").toLowerCase();
    if (t === "range" || t === "checkbox" || t === "radio") return false;
    return true;
  }
  return tag === "select";
}

function applyDensity(mode: "comfort" | "compact") {
  const root = document.documentElement;
  if (mode === "compact") {
    root.style.setProperty("--shell-gap", "10px");
    root.style.setProperty("--shell-pad-y", "14px");
    root.style.setProperty("--shell-pad-x", "18px");
    return;
  }
  root.style.removeProperty("--shell-gap");
  root.style.removeProperty("--shell-pad-y");
  root.style.removeProperty("--shell-pad-x");
}

function setViewTint(view: string, rgb: string | null) {
  const key = `studium:view_tint:${view}`;
  if (!rgb) safeLocalRemove(key);
  else safeLocalSet(key, rgb);

  const cur = document.body?.dataset?.view || "";
  if (cur === view) {
    if (!rgb) document.body.style.removeProperty("--glass-tint");
    else document.body.style.setProperty("--glass-tint", rgb);

    if (typeof (window as any).applyViewTint === "function") {
      try {
        (window as any).applyViewTint(view);
      } catch {
        // ignore
      }
    }
  }
}

function exitToLanding() {
  const go = () => {
    window.location.href = "/";
  };
  try {
    if (document.fullscreenElement) {
      const fn: any = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen;
      if (typeof fn === "function") {
        const p = fn.call(document);
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    }
  } catch {
    // ignore
  }
  window.setTimeout(go, 80);
}

function clearKeys(predicate: (key: string) => boolean) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && predicate(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function panelButtonClass(extra?: string) {
  return ["panelItem", "gridCard", "rounded-[18px]", "text-left", extra].filter(Boolean).join(" ");
}

function ModalShell({
  title,
  subtitle,
  danger = false,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="studiumModal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="studiumModalOverlay" onPointerDown={onClose} aria-hidden="true" />
      <div
        className={["studiumModalPanel", danger ? "studiumModalPanel--danger" : ""].filter(Boolean).join(" ")}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="studiumModalTop">
          <div className="studiumModalTitleWrap">
            <div className="studiumModalKicker">{danger ? "DANGER ZONE" : "SETTINGS"}</div>
            <div className={["studiumModalTitle", danger ? "studiumModalTitle--danger" : ""].filter(Boolean).join(" ")}>{title}</div>
            {subtitle ? <div className="studiumModalSubtitle">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="studiumModalClose"
            onClick={onClose}
            data-focus="match.modal.close"
            aria-label="Close popup"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div className="studiumModalBody">{children}</div>
      </div>
    </div>
  );
}

export default function MatchGrid({ user }: Props) {
  const LS_NOTIF = scopedAccountKey(LS_NOTIF_BASE, user.id);
  const LS_PROFILE = scopedAccountKey(LS_PROFILE_BASE, user.id);
  const [modal, setModal] = useState<ModalId | null>(null);
  const [navOrder, setNavOrder] = useState<ViewId[]>((appData.navigation.defaultOrder as ViewId[]) ?? NAV_ITEMS.map((x) => x.id));
  const [tintView, setTintView] = useState<ViewId>("dashboard");
  const [density, setDensity] = useState<"comfort" | "compact">(appData.ui.densityDefault);
  const [notificationsOn, setNotificationsOn] = useState(!!appData.ui.notificationsDefaultEnabled);
  const [profileName, setProfileName] = useState(user.displayName);
  const [profileEmail, setProfileEmail] = useState(appData.profile.email || "");
  const [profileAvatar, setProfileAvatar] = useState(user.avatarUrl);

  const [draftName, setDraftName] = useState(user.displayName);
  const [draftEmail, setDraftEmail] = useState(appData.profile.email || "");
  const [draftAvatar, setDraftAvatar] = useState(user.avatarUrl);
  const [draftPass, setDraftPass] = useState("");
  const [draftPass2, setDraftPass2] = useState("");

  const navMeta = useMemo(() => new Map(NAV_ITEMS.map((x) => [x.id, x])), []);
  const currentView = (typeof document !== "undefined" && document.body?.dataset?.view) || "dashboard";
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);

  const playSfx = (kind: "switch" | "grid" | "header") => {
    try {
      const sfx = (window as any).SFX;
      if (!sfx) return;
      if (kind === "switch") sfx.playSwitch?.();
      else if (kind === "grid") sfx.playGridMove?.();
      else sfx.playHeaderMove?.();
    } catch {
      // ignore
    }
  };

  const closeModal = () => {
    playSfx("switch");
    setModal(null);
  };

  const openModal = (id: ModalId) => (e?: any) => {
    const fromPointer = !!e?.nativeEvent?.pointerType || (typeof e?.detail === "number" && e.detail > 0);
    if (!fromPointer) playSfx("switch");
    setModal(id);
  };

  useEffect(() => {
    (window as any).studiumModalApi = { isOpen: () => !!modal, close: () => closeModal() };
    return () => {
      try {
        delete (window as any).studiumModalApi;
      } catch {
        // ignore
      }
    };
  }, [modal]);

  useEffect(() => {
    if (!modal) {
      document.body.classList.remove("modal-open");
      const prev = lastActiveRef.current;
      if (prev) {
        lastActiveRef.current = null;
        try {
          prev.focus({ preventScroll: true } as any);
        } catch {
          prev.focus();
        }
      }
      return;
    }

    lastActiveRef.current = (document.activeElement as HTMLElement | null) ?? null;
    document.body.classList.add("modal-open");

    window.setTimeout(() => {
      const root = document.querySelector(".studiumModalPanel") as HTMLElement | null;
      if (!root) return;
      const target =
        (root.querySelector('[data-autofocus="1"]') as HTMLElement | null) ||
        (root.querySelector('[data-focus="match.modal.close"]') as HTMLElement | null) ||
        (root.querySelector("input, button, [href], [tabindex]:not([tabindex='-1'])") as HTMLElement | null);
      if (!target) return;
      try {
        target.focus({ preventScroll: true } as any);
      } catch {
        target.focus();
      }
    }, 20);

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key;

      const root = document.querySelector(".studiumModalPanel") as HTMLElement | null;
      if (!root) return;

      const focusables = () => {
        const nodes = Array.from(
          root.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[];
        return nodes.filter((el) => {
          if (!el) return false;
          if ((el as any).disabled) return false;
          if ((el as any).hidden) return false;
          if (el.getAttribute("aria-hidden") === "true") return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      };

      const cycle = (dir: 1 | -1) => {
        const list = focusables();
        if (list.length === 0) return;
        const idx = list.indexOf(document.activeElement as any);
        const cur = idx >= 0 ? idx : 0;
        const next = (cur + dir + list.length) % list.length;
        try {
          list[next].focus({ preventScroll: true } as any);
        } catch {
          list[next].focus();
        }
      };

      if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
        return;
      }

      if (key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        playSfx("grid");
        cycle(e.shiftKey ? -1 : 1);
        return;
      }

      const isArrow = key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
      if (!isArrow) return;

      const ae = document.activeElement as HTMLElement | null;
      const isRange =
        ae?.tagName &&
        String(ae.tagName).toLowerCase() === "input" &&
        String(ae.getAttribute("type") || "").toLowerCase() === "range";
      if (isRange && (key === "ArrowLeft" || key === "ArrowRight")) return;
      if (isTypingTarget(ae)) return;

      e.preventDefault();
      e.stopPropagation();
      playSfx("grid");
      if (key === "ArrowDown" || key === "ArrowRight") cycle(1);
      else cycle(-1);
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [modal]);

  useEffect(() => {
    const raw = safeLocalGet(LS_PROFILE);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as any;
      if (parsed && typeof parsed.displayName === "string" && parsed.displayName.trim()) setProfileName(parsed.displayName.trim());
      if (parsed && typeof parsed.email === "string") setProfileEmail(parsed.email.trim());
      if (parsed && typeof parsed.avatarUrl === "string" && parsed.avatarUrl.trim()) setProfileAvatar(parsed.avatarUrl.trim());
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (modal !== "accountProfile") return;
    setDraftName(profileName);
    setDraftEmail(profileEmail);
    setDraftAvatar(profileAvatar);
    setDraftPass("");
    setDraftPass2("");
  }, [modal, profileAvatar, profileEmail, profileName]);

  useEffect(() => {
    const saved = safeLocalGet(LS_NAV_ORDER);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((x) => (x === "guild" ? "battle" : x));
          const valid = migrated.filter((x): x is ViewId => NAV_ITEMS.some((i) => i.id === x));
          const rest = NAV_ITEMS.map((i) => i.id).filter((id) => !valid.includes(id));
          setNavOrder([...valid, ...rest]);
        }
      } catch {
        // ignore
      }
    }

    const d = safeLocalGet(LS_DENSITY);
    const mode = d === "compact" ? "compact" : "comfort";
    setDensity(mode);
    applyDensity(mode);
    setNotificationsOn(safeLocalGet(LS_NOTIF) !== "0");
    setTintView(navMeta.has(currentView as ViewId) ? (currentView as ViewId) : "dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyDensity(density);
    safeLocalSet(LS_DENSITY, density);
    if (typeof (window as any).applyStudiumDensity === "function") (window as any).applyStudiumDensity();
  }, [density]);

  useEffect(() => {
    const sync = () => setNotificationsOn(safeLocalGet(LS_NOTIF) !== "0");
    const on = () => sync();
    try {
      window.addEventListener(PREF_EVENT, on);
      window.addEventListener("storage", on);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener(PREF_EVENT, on);
        window.removeEventListener("storage", on);
      } catch {
        // ignore
      }
    };
  }, [LS_NOTIF]);

  useEffect(() => {
    safeLocalSet(LS_NOTIF, notificationsOn ? "1" : "0");
    try {
      window.dispatchEvent(new Event(PREF_EVENT));
    } catch {
      // ignore
    }
  }, [notificationsOn]);

  const persistNavOrder = (next: ViewId[]) => {
    setNavOrder(next);
    safeLocalSet(LS_NAV_ORDER, JSON.stringify(next));
    try {
      const api = (window as any).navApi;
      if (api?.setOrder) api.setOrder(next);
    } catch {
      // ignore
    }
  };

  const moveNav = (id: ViewId, dir: -1 | 1) => {
    const idx = navOrder.indexOf(id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= navOrder.length) return;
    const next = navOrder.slice();
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;
    persistNavOrder(next);
  };

  const resetNav = () => {
    const next = NAV_ITEMS.map((x) => x.id);
    setNavOrder(next);
    safeLocalRemove(LS_NAV_ORDER);
    try {
      const api = (window as any).navApi;
      if (api?.resetOrder) api.resetOrder();
      else if (api?.setOrder) api.setOrder(next);
    } catch {
      // ignore
    }
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as any;
    const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : null;
    if (!data) throw new Error("Invalid file: missing data");
    Object.entries(data).forEach(([k, v]) => {
      if (!k.startsWith("studium:")) return;
      if (typeof v !== "string") return;
      safeLocalSet(k, v);
    });
    window.location.reload();
  };

  const renderModal = () => {
    if (!modal) return null;

    if (modal === "about") {
      return (
        <ModalShell title="About Studium" subtitle="Prototype build" onClose={closeModal}>
          <div className="grid gap-3 text-sm font-[800] text-white/70">
            <div>Studium Focus Mode: routine to quests to notes to review.</div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-[900] text-white/65">
              View: {currentView}
              <br />
              Notifications: {notificationsOn ? "On" : "Off"}
              <br />
              Density: {density === "compact" ? "Compact" : "Comfort"}
            </div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "navOrder") {
      return (
        <ModalShell title="Navigation order" subtitle="Reorder the main tabs. Applies immediately." onClose={closeModal}>
          <div className="grid gap-2">
            {navOrder.map((id, idx) => {
              const meta = navMeta.get(id);
              if (!meta) return null;
              return (
                <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-[900] text-white/90">
                      <i className={`fa-solid ${meta.icon} mr-2 text-white/60`} aria-hidden="true"></i>
                      {meta.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border border-white/10 bg-black/30 text-white/80 disabled:opacity-40"
                      onClick={() => moveNav(id, -1)}
                      disabled={idx === 0}
                      aria-label={`Move ${meta.label} up`}
                    >
                      <i className="fa-solid fa-chevron-up" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border border-white/10 bg-black/30 text-white/80 disabled:opacity-40"
                      onClick={() => moveNav(id, 1)}
                      disabled={idx === navOrder.length - 1}
                      aria-label={`Move ${meta.label} down`}
                    >
                      <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/35"
                onClick={resetNav}
                aria-label="Reset navigation order"
              >
                Reset order
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-xs font-[900] text-white/85 hover:bg-white/15"
                onClick={closeModal}
                aria-label="Done"
              >
                Done
              </button>
            </div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "pageColor") {
      return (
        <ModalShell title="Page color" subtitle="Change the tint for a selected screen." onClose={closeModal}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-[900] text-white/60">Target screen</div>
              <select
                className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm font-[800] text-white/85"
                value={tintView}
                onChange={(e) => setTintView(e.target.value as ViewId)}
                aria-label="Select target screen"
              >
                {NAV_ITEMS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TINT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="rounded-xl border border-white/12 bg-black/25 px-3 py-3 text-left text-xs font-[900] text-white/80 hover:bg-black/35"
                  onClick={() => setViewTint(tintView, p.rgb)}
                  aria-label={`Set ${tintView} tint to ${p.label}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{p.label}</span>
                    <span
                      className="h-4 w-8 rounded-full border border-white/12"
                      style={{ background: `rgb(${p.rgb.replaceAll(" ", ",")})` }}
                      aria-hidden="true"
                    />
                  </div>
                </button>
              ))}
              <button
                type="button"
                className="col-span-2 rounded-xl border border-white/12 bg-black/25 px-3 py-3 text-left text-xs font-[900] text-white/75 hover:bg-black/35"
                onClick={() => setViewTint(tintView, null)}
                aria-label="Clear tint override"
              >
                Clear override
              </button>
            </div>

            <div className="text-xs font-[900] text-white/55">Current view: {currentView}</div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "density") {
      return (
        <ModalShell title="UI density" subtitle="Change spacing across the shell." onClose={closeModal}>
          <div className="grid gap-3">
            <div className="text-sm font-[800] text-white/70">Pick one:</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={[
                  "rounded-xl border px-3 py-2 text-xs font-[900]",
                  density === "comfort"
                    ? "border-white/18 bg-white/10 text-white/90"
                    : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                ].join(" ")}
                onClick={() => setDensity("comfort")}
                aria-label="Set density to comfort"
              >
                Comfort
              </button>
              <button
                type="button"
                className={[
                  "rounded-xl border px-3 py-2 text-xs font-[900]",
                  density === "compact"
                    ? "border-white/18 bg-white/10 text-white/90"
                    : "border-white/12 bg-black/25 text-white/75 hover:bg-black/35",
                ].join(" ")}
                onClick={() => setDensity("compact")}
                aria-label="Set density to compact"
              >
                Compact
              </button>
            </div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "accountProfile") {
      return (
        <ModalShell title="Account profile" subtitle="Local prototype (saved on this device)." onClose={closeModal}>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <div className="text-xs font-[900] text-white/65">Display name</div>
              <input
                data-autofocus="1"
                className="w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm font-[800] text-white/85"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                aria-label="Display name"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-[900] text-white/65">Email</div>
              <input
                className="w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm font-[800] text-white/85"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-[900] text-white/65">Profile picture</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-12 w-12 overflow-hidden rounded-[16px] border border-white/14 bg-black/25">
                  <img src={draftAvatar || profileAvatar} alt="" className="h-full w-full object-cover" />
                </div>
                <input
                  className="min-w-[240px] flex-1 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm font-[800] text-white/85"
                  value={draftAvatar}
                  onChange={(e) => setDraftAvatar(e.target.value)}
                  placeholder="Avatar URL (or pick a file)"
                  aria-label="Avatar URL"
                />
                <button
                  type="button"
                  className="rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/35"
                  onClick={() => avatarFileRef.current?.click()}
                  aria-label="Choose avatar file"
                >
                  Choose file
                </button>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-hidden="true"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const url = String(reader.result || "");
                      if (url) setDraftAvatar(url);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              <div className="text-xs font-[800] text-white/55">Tip: file pick stores a data URL in localStorage.</div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-[900] text-white/65">Change password</div>
              <div className="grid gap-2 min-[560px]:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm font-[800] text-white/85"
                  value={draftPass}
                  onChange={(e) => setDraftPass(e.target.value)}
                  placeholder="New password"
                  type="password"
                  aria-label="New password"
                />
                <input
                  className="w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm font-[800] text-white/85"
                  value={draftPass2}
                  onChange={(e) => setDraftPass2(e.target.value)}
                  placeholder="Confirm password"
                  type="password"
                  aria-label="Confirm password"
                />
              </div>
              <div className="text-xs font-[800] text-white/55">Password is not stored; this is UI-only for now.</div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/35"
                onClick={closeModal}
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/35"
                onClick={() => {
                  safeLocalRemove(LS_PROFILE);
                  setProfileName(user.displayName);
                  setProfileEmail("");
                  setProfileAvatar(user.avatarUrl);
                  setDraftName(user.displayName);
                  setDraftEmail("");
                  setDraftAvatar(user.avatarUrl);
                  setDraftPass("");
                  setDraftPass2("");
                  try {
                    (window as any).applyStudiumProfileOverride?.();
                  } catch {
                    // ignore
                  }
                  closeModal();
                }}
                aria-label="Reset profile overrides"
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-xs font-[900] text-white/90 hover:bg-white/15"
                onClick={() => {
                  const name = String(draftName || "").trim();
                  const email = String(draftEmail || "").trim();
                  const avatar = String(draftAvatar || "").trim();

                  if (draftPass || draftPass2) {
                    if (draftPass.length < 6) return alert("Password must be at least 6 characters.");
                    if (draftPass !== draftPass2) return alert("Passwords do not match.");
                  }

                  const payload = { displayName: name, email, avatarUrl: avatar };
                  safeLocalSet(LS_PROFILE, JSON.stringify(payload));
                  setProfileName(name || user.displayName);
                  setProfileEmail(email);
                  setProfileAvatar(avatar || user.avatarUrl);

                  setDraftPass("");
                  setDraftPass2("");
                  try {
                    (window as any).applyStudiumProfileOverride?.();
                  } catch {
                    // ignore
                  }
                  closeModal();
                }}
                aria-label="Save profile"
              >
                Save
              </button>
            </div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "accountNotifications") {
      return (
        <ModalShell title="Notifications" subtitle="Prototype toggle (UI only)." onClose={closeModal}>
          <div className="grid gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-between gap-4 rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-[900] text-white/85 hover:bg-black/35"
              onClick={() => setNotificationsOn((x) => !x)}
              aria-label="Toggle notifications"
            >
              <span>Notifications</span>
              <span className="text-white/65">{notificationsOn ? "On" : "Off"}</span>
            </button>
          </div>
        </ModalShell>
      );
    }

    if (modal === "accountPrivacy") {
      return (
        <ModalShell title="Privacy" subtitle="Local-only prototype flags." onClose={closeModal}>
          <div className="grid gap-3">
            <button
              type="button"
              className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-left text-sm font-[900] text-white/85 hover:bg-black/35"
              onClick={() => {
                const k = "studium:pref_local_only";
                const on = safeLocalGet(k) === "1";
                safeLocalSet(k, on ? "0" : "1");
              }}
              aria-label="Toggle local-only mode"
            >
              Toggle local-only mode
              <div className="mt-1 text-xs font-[800] text-white/55">No network calls (future).</div>
            </button>
          </div>
        </ModalShell>
      );
    }

    if (modal === "accountSync") {
      return (
        <ModalShell title="Sync" subtitle="Not wired yet." onClose={closeModal}>
          <div className="text-sm font-[800] text-white/70">Later: cloud sync, restore, and multi-device.</div>
        </ModalShell>
      );
    }

    if (modal === "utilityKeybinds") {
      return (
        <ModalShell title="Keybinds" subtitle="Keyboard-first navigation." onClose={closeModal}>
          <div className="grid gap-2 text-sm font-[800] text-white/70">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="font-[900] text-white/85">Arrows</div>
              <div className="mt-1">Move focus between tiles / controls.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="font-[900] text-white/85">Esc</div>
              <div className="mt-1">Back to navbar / close popup / close drawer.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="font-[900] text-white/85">Enter</div>
              <div className="mt-1">Activate focused button.</div>
            </div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "utilityDiagnostics") {
      return (
        <ModalShell title="Diagnostics" subtitle="Quick debug info." onClose={closeModal}>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs font-[900] text-white/65">
              View: {currentView}
              <br />
              User: {user.displayName} ({user.id === 0 ? "guest" : "signed-in"})
              <br />
              UA: {typeof navigator !== "undefined" ? navigator.userAgent : "-"}
            </div>
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-xs font-[900] text-white/85 hover:bg-white/15"
              onClick={() => {
                const text = [
                  `View: ${currentView}`,
                  `User: ${user.displayName} (${user.id === 0 ? "guest" : "signed-in"})`,
                  `UA: ${navigator.userAgent}`,
                ].join("\n");
                void navigator.clipboard?.writeText?.(text);
              }}
              aria-label="Copy diagnostics"
            >
              Copy
            </button>
          </div>
        </ModalShell>
      );
    }

    if (modal === "utilityExport") {
      return (
        <ModalShell title="Export settings" subtitle="Downloads all local `studium:*` keys." onClose={closeModal}>
          <div className="grid gap-3">
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-xs font-[900] text-white/85 hover:bg-white/15"
              onClick={() => {
                const data: Record<string, string> = {};
                try {
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k) continue;
                    if (!k.startsWith("studium:")) continue;
                    const v = localStorage.getItem(k);
                    if (typeof v === "string") data[k] = v;
                  }
                } catch {
                  // ignore
                }
                const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "studium-settings.json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              aria-label="Download settings JSON"
            >
              Download JSON
            </button>
            <div className="text-xs font-[900] text-white/55">Import works in Utility / Import.</div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "utilityImport") {
      return (
        <ModalShell title="Import settings" subtitle="Loads a previously exported settings JSON and reloads." onClose={closeModal}>
          <div className="grid gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-sm font-[800] text-white/80"
              aria-label="Choose settings JSON file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void doImport(file).catch((err) => {
                  alert(String(err?.message || err));
                });
              }}
            />
            <div className="text-xs font-[900] text-white/55">This overwrites any existing `studium:*` keys in localStorage.</div>
          </div>
        </ModalShell>
      );
    }

    if (modal === "dangerSignOut") {
      return (
        <ModalShell title="Sign out" subtitle="End the current session?" danger onClose={closeModal}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/40"
              onClick={closeModal}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-400/45 bg-red-500/20 px-3 py-2 text-xs font-[900] text-red-100 hover:bg-red-500/25"
              onClick={() => (window.location.href = "/sign-out")}
              aria-label="Confirm sign out"
            >
              Sign out
            </button>
          </div>
        </ModalShell>
      );
    }

    if (modal === "dangerExitFocus") {
      return (
        <ModalShell title="Exit Studium Focus Mode" subtitle="Returns to the landing page (and exits fullscreen)." danger onClose={closeModal}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/40"
              onClick={closeModal}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-400/60 bg-red-500/30 px-3 py-2 text-xs font-[900] text-red-50 hover:bg-red-500/35"
              onClick={exitToLanding}
              aria-label="Confirm exit to landing"
            >
              Exit to landing
            </button>
          </div>
        </ModalShell>
      );
    }

    if (modal === "dangerClearSettings") {
      return (
        <ModalShell title="Clear settings" subtitle="Wipes UI prefs (tints, nav order, quick settings) and reloads." danger onClose={closeModal}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/40"
              onClick={closeModal}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-400/45 bg-red-500/20 px-3 py-2 text-xs font-[900] text-red-100 hover:bg-red-500/25"
              onClick={() => {
                clearKeys(
                  (k) =>
                    k.startsWith("studium:nav_order") ||
                    k.startsWith("studium:view_tint:") ||
                    k.startsWith("studium:ui_density") ||
                    k.startsWith("studium:qs_") ||
                    k.startsWith("studium:music_") ||
                    k.startsWith("studium:pref_")
                );
                window.location.reload();
              }}
              aria-label="Confirm clear settings"
            >
              Clear settings
            </button>
          </div>
        </ModalShell>
      );
    }

    if (modal === "dangerFactoryReset") {
      return (
        <ModalShell title="Factory reset" subtitle="Removes ALL local `studium:*` keys and reloads." danger onClose={closeModal}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-[900] text-white/80 hover:bg-black/40"
              onClick={closeModal}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-400/45 bg-red-500/20 px-3 py-2 text-xs font-[900] text-red-100 hover:bg-red-500/25"
              onClick={() => {
                clearKeys((k) => k.startsWith("studium:"));
                try {
                  sessionStorage.clear();
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              aria-label="Confirm factory reset"
            >
              Factory reset
            </button>
          </div>
        </ModalShell>
      );
    }

    return null;
  };

  return (
    <>
      <div
        className="grid h-auto w-full min-h-[360px] grid-cols-1 gap-[var(--shell-gap)] min-[720px]:grid-cols-2 min-[1200px]:h-full min-[1200px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.82fr)_minmax(0,1fr)]"
        aria-label="Options grid"
      >
        {/* tiles (popups only) */}
        <section className="flex min-h-0 min-w-0 flex-col gap-[10px]" aria-label="System and about">
          <div className="dashSectionHead">
            <div className="dashSectionTitle">System</div>
          </div>

          <div className="grid gap-[var(--shell-gap)]" aria-label="System actions">
            <button type="button" className={panelButtonClass()} data-focus="match.system.nav" onClick={openModal("navOrder")}>
              <div className="cardInner">
                <div className="cardTitle">Navigation order</div>
                <div className="cardMeta">Reorder main tabs</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.system.tint" onClick={openModal("pageColor")}>
              <div className="cardInner">
                <div className="cardTitle">Page color</div>
                <div className="cardMeta">Tint per screen</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.system.density" onClick={openModal("density")}>
              <div className="cardInner">
                <div className="cardTitle">UI density</div>
                <div className="cardMeta">{density === "compact" ? "Compact" : "Comfort"}</div>
              </div>
            </button>
          </div>

          <div className="dashSectionHead">
            <div className="dashSectionTitle">About</div>
          </div>

          <button
            type="button"
            className={panelButtonClass("flex-1 min-h-0")}
            data-focus="match.system.about"
            onClick={openModal("about")}
          >
            <div className="cardInner justify-start gap-3">
              <div className="cardTitle">Studium</div>
              <div className="text-sm font-[800] text-white/70">Studium Focus Mode prototype.</div>
              <div className="mt-auto text-xs font-[900] text-white/55">View: {currentView}</div>
            </div>
          </button>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-[10px]" aria-label="Account">
          <div className="dashSectionHead">
            <div className="dashSectionTitle">Account</div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[1.2fr_auto_auto_auto] gap-[var(--shell-gap)]" aria-label="Account actions">
            <button
              type="button"
              className={panelButtonClass()}
              data-focus="match.account.profile"
              onClick={openModal("accountProfile")}
              aria-label="Edit account profile"
            >
              <div className="cardInner justify-start gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-[18px] border border-white/14 bg-black/25">
                    <img src={profileAvatar} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-lg font-[900] text-white/92">{profileName}</div>
                    <div className="text-xs font-[900] text-white/55">
                      {profileEmail ? profileEmail : user.id === 0 ? "Guest" : "Signed in"}
                    </div>
                  </div>
                </div>
                <div className="mt-auto text-xs font-[900] text-white/55">Edit username, email, password, avatar.</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.account.sync" onClick={openModal("accountSync")}>
              <div className="cardInner">
                <div className="cardTitle">Sync</div>
                <div className="cardMeta">Backup & restore</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.account.privacy" onClick={openModal("accountPrivacy")}>
              <div className="cardInner">
                <div className="cardTitle">Privacy</div>
                <div className="cardMeta">Local-only flags</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.account.notifications" onClick={openModal("accountNotifications")}>
              <div className="cardInner">
                <div className="cardTitle">Notifications</div>
                <div className="cardMeta">{notificationsOn ? "On" : "Off"}</div>
              </div>
            </button>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-[10px]" aria-label="Setup">
          <div className="dashSectionHead">
            <div className="dashSectionTitle">Setup</div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-4 gap-[var(--shell-gap)]" aria-label="Setup actions">
            <button type="button" className={panelButtonClass()} data-focus="match.util.import" onClick={openModal("utilityImport")}>
              <div className="cardInner">
                <div className="cardTitle">Import</div>
                <div className="cardMeta">Load settings JSON</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.util.export" onClick={openModal("utilityExport")}>
              <div className="cardInner">
                <div className="cardTitle">Export</div>
                <div className="cardMeta">Download settings JSON</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.util.keybinds" onClick={openModal("utilityKeybinds")}>
              <div className="cardInner">
                <div className="cardTitle">Keybinds</div>
                <div className="cardMeta">Arrows | Esc | Enter</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass()} data-focus="match.util.diagnostics" onClick={openModal("utilityDiagnostics")}>
              <div className="cardInner">
                <div className="cardTitle">Diagnostics</div>
                <div className="cardMeta">Env | storage | flags</div>
              </div>
            </button>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-[10px]" aria-label="Your settings and danger zone">
          <div className="dashSectionHead">
            <div className="dashSectionTitle">Your Settings</div>
          </div>

          <div className="panelItem gridCard min-h-0 flex-1 overflow-hidden rounded-[18px]" data-focus="match.context" tabIndex={0}>
            <div className="cardInner justify-start gap-3">
              <div className="cardTitle">Context</div>
              <div className="cardMeta">All changes happen via popups.</div>
            </div>
          </div>

          <div className="dashSectionHead">
            <div className="dashSectionTitle">Danger Zone</div>
          </div>

          <div
            className="grid grid-cols-1 gap-[var(--shell-gap)] min-[901px]:grid-cols-2 min-[901px]:grid-rows-2"
            aria-label="Danger zone actions"
          >
            <button type="button" className={panelButtonClass("optionsDanger")} data-focus="match.danger.signout" onClick={openModal("dangerSignOut")}>
              <div className="cardInner">
                <div className="cardTitle">Sign out</div>
                <div className="cardMeta">End session</div>
              </div>
            </button>
            <button type="button" className={panelButtonClass("optionsDangerExit")} data-focus="match.danger.exit" onClick={openModal("dangerExitFocus")}>
              <div className="cardInner">
                <div className="cardTitle">Exit Studium Focus Mode</div>
                <div className="cardMeta">Back to landing</div>
              </div>
            </button>
            <button
              type="button"
              className={panelButtonClass("optionsDanger")}
              data-focus="match.danger.clearSettings"
              onClick={openModal("dangerClearSettings")}
            >
              <div className="cardInner">
                <div className="cardTitle">Clear settings</div>
                <div className="cardMeta">Wipe UI prefs</div>
              </div>
            </button>
            <button
              type="button"
              className={panelButtonClass("optionsDanger")}
              data-focus="match.danger.factory"
              onClick={openModal("dangerFactoryReset")}
            >
              <div className="cardInner">
                <div className="cardTitle">Factory reset</div>
                <div className="cardMeta">Wipe local data</div>
              </div>
            </button>
          </div>
        </section>
      </div>

      {renderModal()}
    </>
  );
}
