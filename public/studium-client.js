function readViewMarker() {
  const marker = document.querySelector('[data-view-marker="1"]');
  if (!marker) return null;
  const view = marker.getAttribute("data-view");
  const label = marker.getAttribute("data-label");
  const desc = marker.getAttribute("data-desc");
  return { view, label, desc };
}

function setView(view) {
  if (!view) return;
  document.body.dataset.view = view;
}

function getView() {
  return document.body.dataset.view || "dashboard";
}

(function initViewTint() {
  const safeLocalGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };

  function applyStudiumDensity() {
    const mode = safeLocalGet("studium:ui_density");
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

  function applyViewTint(view) {
    const v = view || getView();
    const key = `studium:view_tint:${v}`;
    const tint = safeLocalGet(key);
    if (tint) document.body.style.setProperty("--glass-tint", String(tint));
    else document.body.style.removeProperty("--glass-tint");
  }

  window.applyStudiumDensity = applyStudiumDensity;
  window.applyViewTint = applyViewTint;
  applyStudiumDensity();
  applyViewTint(getView());
})();

(function syncInitialView() {
  const m = readViewMarker();
  if (m?.view) setView(m.view);
})();

function isTypingTarget(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "textarea" || el.isContentEditable) return true;
  if (tag === "input") {
    const t = String(el.getAttribute("type") || "text").toLowerCase();
    // Range/checkbox should still allow arrow-key navigation handling in our router.
    if (t === "range" || t === "checkbox" || t === "radio") return false;
    return true;
  }
  return tag === "select";
}

function setMode(mode) {
  document.body.classList.toggle("nav-mode", mode === "nav");
  document.body.classList.toggle("grid-mode", mode === "grid");
}

const NAV_LOCK_KEY = "studium:nav_lock_until";
function setNavLock(ms) {
  try {
    sessionStorage.setItem(NAV_LOCK_KEY, String(Date.now() + Math.max(0, ms || 0)));
  } catch {
    // ignore
  }
}
function clearNavLock() {
  try {
    sessionStorage.removeItem(NAV_LOCK_KEY);
  } catch {
    // ignore
  }
}
function navLockActive() {
  try {
    return Date.now() < Number(sessionStorage.getItem(NAV_LOCK_KEY) || 0);
  } catch {
    return false;
  }
}

function navSwitchLocked() {
  try {
    const p = window.location && window.location.pathname ? String(window.location.pathname) : "";
    if (p.startsWith("/notes/new")) return true;
    if (document.body && document.body.dataset && document.body.dataset.subview === "battle-arena") return true;
    if (p.startsWith("/study-room")) {
      // Only lock nav switching when strict mode is enabled (Study Room should still be navigable otherwise).
      return document.body && document.body.classList ? document.body.classList.contains("study-strict") : false;
    }
    return document.body && document.body.dataset && document.body.dataset.subview === "notes-editor";
  } catch {
    return false;
  }
}

(function initWallpapers() {
  const videoA = document.getElementById("bgVideoA");
  const videoB = document.getElementById("bgVideoB");
  if (!videoA || !videoB) return;

  const LOOP_SECONDS = 22;
  const USE_HUE_ROTATE = false;

  const wallpaperByView = {
    dashboard: "/bg/blue - dashboard.mp4",
    routine: "/bg/brown -.mp4",
    quest: "/bg/green - .mp4",
    schedules: "/bg/aqua - .mp4",
    notes: "/bg/white - notes.mp4",
    study: "/bg/orange -.mp4",
    pomodoro: "/bg/purple - focus.mp4",
    battle: "/bg/red - Battle.mp4",
    guild: "/bg/yellow - guild.mp4",
    match: "/bg/black - settings.mp4",
  };

  const hueByView = {
    dashboard: "0deg",
    routine: "0deg",
    quest: "0deg",
    schedules: "0deg",
    notes: "0deg",
    study: "0deg",
    pomodoro: "0deg",
    battle: "0deg",
    guild: "0deg",
    match: "0deg",
  };

  const fallbackSrcs = [
    "/bg/blue - dashboard.mp4",
    "/bg/purple - focus.mp4",
    "/bg/red - Battle.mp4",
    "/bg.mp4",
    "/bg2.mp4",
    "/bg3.mp4",
  ].filter(Boolean);

  let active = videoA;
  let standby = videoB;
  let currentView = null;
  let latestToken = 0;

  const showVideo = () => document.body.classList.remove("no-video");
  const hideVideo = () => document.body.classList.add("no-video");

  const safePlay = (video) => {
    try {
      const p = video.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    } catch {
      // ignore autoplay errors
    }
  };

  const setHue = (view) => {
    const hue = USE_HUE_ROTATE ? hueByView[view] ?? "0deg" : "0deg";
    document.body.style.setProperty("--bg-hue", hue);
  };

  const getOffsetSeconds = () => {
    if (!active || Number.isNaN(active.currentTime) || active.readyState < 1) {
      return (Date.now() / 1000) % LOOP_SECONDS;
    }
    return active.currentTime % LOOP_SECONDS;
  };

  function loadSyncPlay(video, src, offsetSeconds) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("error", onError);
      };

      const finish = (ok, err) => {
        if (settled) return;
        settled = true;
        cleanup();
        ok ? resolve() : reject(err);
      };

      const onMeta = () => {
        try {
          video.currentTime = offsetSeconds;
        } catch {
          // ignore
        }
      };

      const onCanPlay = () => {
        showVideo();
        safePlay(video);
        finish(true);
      };

      const onError = () => {
        hideVideo();
        finish(false, new Error(`Failed to load wallpaper: ${src}`));
      };

      video.addEventListener("loadedmetadata", onMeta, { once: true });
      video.addEventListener("canplay", onCanPlay, { once: true });
      video.addEventListener("error", onError, { once: true });

      video.src = encodeURI(src);
      try {
        video.load();
      } catch {
        // ignore
      }
    });
  }

  async function primeWallpaper(view) {
    if (!view) return;
    currentView = view;
    const token = ++latestToken;

    const offset = getOffsetSeconds();
    const preferredSrc = wallpaperByView[view] || fallbackSrcs[0] || "";

    setHue(view);

    const srcCandidates = [preferredSrc, ...fallbackSrcs].filter(Boolean);
    for (const src of srcCandidates) {
      try {
        await loadSyncPlay(active, src, offset);
        if (token !== latestToken) return;
        break;
      } catch {
        // try next
      }
    }

    if (token !== latestToken) return;
    active.classList.add("bg__video--active");
    standby.classList.remove("bg__video--active");
  }

  async function switchWallpaper(view) {
    if (!view) return;
    if (view === currentView) {
      setHue(view);
      return;
    }

    currentView = view;
    const token = ++latestToken;

    const offset = getOffsetSeconds();
    const preferredSrc = wallpaperByView[view] || fallbackSrcs[0] || "";

    setHue(view);

    const srcCandidates = [preferredSrc, ...fallbackSrcs].filter(Boolean);
    for (const src of srcCandidates) {
      try {
        await loadSyncPlay(standby, src, offset);
        if (token !== latestToken) return;
        break;
      } catch {
        // try next
      }
    }

    if (token !== latestToken) return;

    standby.classList.add("bg__video--active");
    active.classList.remove("bg__video--active");

    const prev = active;
    active = standby;
    standby = prev;
  }

  window.setWallpaperForView = (view) => switchWallpaper(view);

  const initialView = document.body.dataset.view || "dashboard";
  primeWallpaper(initialView);
})();

const SFX = (() => {
  const boot = new Audio("/sound/boot.mp3");
  const sw = new Audio("/sound/switch.mp3");
  const grid = new Audio("/sound/switch.mp3");
  const header = new Audio("/sound/switch.mp3");
  const notif = new Audio("/sound/notification.mp3");

  const BOOT_VOL = 0.7;
  const SW_VOL = 0.55;
  const GRID_VOL = 0.55;
  const HEADER_VOL = 0.55;
  const NOTIF_VOL = 0.62;
  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  boot.preload = "auto";
  sw.preload = "auto";
  grid.preload = "auto";
  header.preload = "auto";
  notif.preload = "auto";

  notif.addEventListener(
    "error",
    () => {
      try {
        notif.src = "/sound/switch.mp3";
        notif.load();
      } catch {
        // ignore
      }
    },
    { once: true }
  );
  try {
    notif.load();
  } catch {
    // ignore
  }

  grid.playbackRate = 0.82;
  header.playbackRate = 0.66;
  try {
    grid.preservesPitch = false;
    grid.mozPreservesPitch = false;
    grid.webkitPreservesPitch = false;
    header.preservesPitch = false;
    header.mozPreservesPitch = false;
    header.webkitPreservesPitch = false;
  } catch {
    // ignore
  }

  let unlocked = false;
  let lastBootAt = 0;
  let muted = false;
  let vol = 1;
  let pendingFullscreen = false;
  let lastFsAt = 0;

  const wantFullscreen = () => {
    try {
      return window.localStorage?.getItem?.("studium:pref_fullscreen") === "1";
    } catch {
      return false;
    }
  };

  const requestFullscreen = () => {
    if (!wantFullscreen()) return;
    if (document.fullscreenElement) return;
    const now = Date.now();
    if (now - lastFsAt < 900) return;
    lastFsAt = now;

    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (typeof fn === "function") {
        const p = fn.call(el);
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const exitFullscreen = () => {
    try {
      if (!document.fullscreenElement) return;
      const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (typeof fn === "function") {
        const p = fn.call(document);
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const applyMute = () => {
    const m = muted ? 0 : 1;
    boot.volume = BOOT_VOL * m;
    sw.volume = SW_VOL * vol * m;
    grid.volume = GRID_VOL * vol * m;
    header.volume = HEADER_VOL * vol * m;
    notif.volume = NOTIF_VOL * vol * m;
  };
  applyMute();

  const tryPlay = (audio) => {
    try {
      audio.currentTime = 0;
    } catch {
      // ignore
    }

    try {
      const p = audio.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    } catch {
      // ignore
    }
  };

  const unlock = () => {
    unlocked = true;
    if (pendingFullscreen) {
      pendingFullscreen = false;
      requestFullscreen();
    } else {
      requestFullscreen();
    }
  };

  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
  document.addEventListener("keydown", unlock, { once: true, capture: true });

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) return;
    if (!wantFullscreen()) return;
    // Can't re-enter without a user gesture. Queue and it will trigger on next gesture via ensureFullscreen().
    pendingFullscreen = true;
  });

  return {
    isMuted: () => muted,
    setMuted: (next) => {
      muted = !!next;
      applyMute();
    },
    getVolume: () => vol,
    setVolume: (next) => {
      vol = clamp01(Number(next));
      applyMute();
    },
    playBoot: () => {
      lastBootAt = Date.now();
      tryPlay(boot);
    },
    playSwitch: () => {
      if (!unlocked) return;
      tryPlay(sw);
    },
    playGridMove: () => {
      if (!unlocked) return;
      tryPlay(grid);
    },
    playHeaderMove: () => {
      if (!unlocked) return;
      tryPlay(header);
    },
    playNotif: () => {
      tryPlay(notif);
    },
    ensureFullscreen: () => {
      if (!wantFullscreen()) return;
      if (!unlocked) {
        pendingFullscreen = true;
        return;
      }
      requestFullscreen();
    },
    exitFullscreen: () => {
      pendingFullscreen = false;
      exitFullscreen();
    },
  };
})();

try {
  window.SFX = SFX;
} catch {
  // ignore
}

(function initProfileOverrides() {
  const LS_PROFILE = "studium:profile_override";
  const safeLocalGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };

  const apply = () => {
    let parsed = null;
    try {
      const raw = safeLocalGet(LS_PROFILE);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    const displayName = parsed && typeof parsed.displayName === "string" ? parsed.displayName.trim() : "";
    const avatarUrl = parsed && typeof parsed.avatarUrl === "string" ? parsed.avatarUrl.trim() : "";

    const headerName = document.querySelector("#userMenuBtn .userName");
    if (headerName) {
      if (!headerName.dataset.defaultText) headerName.dataset.defaultText = headerName.textContent || "";
      headerName.textContent = displayName || headerName.dataset.defaultText || "";
    }

    const headerAvatar = document.querySelector("#userMenuBtn .userAvatar__img");
    if (headerAvatar) {
      if (!headerAvatar.dataset.defaultSrc) headerAvatar.dataset.defaultSrc = headerAvatar.getAttribute("src") || "";
      headerAvatar.setAttribute("src", avatarUrl || headerAvatar.dataset.defaultSrc || "");
    }

    const drawerName = document.querySelector("#profileDrawer .drawerUserName");
    if (drawerName) {
      if (!drawerName.dataset.defaultText) drawerName.dataset.defaultText = drawerName.textContent || "";
      drawerName.textContent = displayName || drawerName.dataset.defaultText || "";
    }

    const drawerAvatar = document.querySelector("#profileDrawer .drawerAvatar__img");
    if (drawerAvatar) {
      if (!drawerAvatar.dataset.defaultSrc) drawerAvatar.dataset.defaultSrc = drawerAvatar.getAttribute("src") || "";
      drawerAvatar.setAttribute("src", avatarUrl || drawerAvatar.dataset.defaultSrc || "");
    }
  };

  window.applyStudiumProfileOverride = apply;
  apply();

  window.addEventListener("storage", (e) => {
    if (e && e.key === LS_PROFILE) apply();
  });
})();

(function initBootSequence() {
  const overlay = document.getElementById("bootOverlay");
  const logo = document.getElementById("bootLogo");
  if (!overlay || !logo) return;

  function notifyIslandWhenReady(detail, maxWaitMs) {
    const start = Date.now();
    const limit = Math.max(300, Number(maxWaitMs || 2500));

    const enqueue = () => {
      try {
        if (!Array.isArray(window.__studiumNotifyQueue)) window.__studiumNotifyQueue = [];
        window.__studiumNotifyQueue.push(detail);
      } catch {
        // ignore
      }
    };

    const tick = () => {
      try {
        const fn = window.studiumNotify;
        if (typeof fn === "function") {
          fn(detail);
          return;
        }
      } catch {
        // ignore
      }

      if (Date.now() - start > limit) {
        enqueue();
        return;
      }

      setTimeout(tick, 120);
    };

    tick();
  }

  let bootTimer = null;
  let logoTimer = null;
  let hideTimer = null;

  const cleanup = ({ showWelcome = false } = {}) => {
    try {
      overlay.classList.add("bootOverlay--hide");
    } catch {
      // ignore
    }
    try {
      document.body.classList.remove("booting");
      document.documentElement.classList.remove("booting");
    } catch {
      // ignore
    }

    if (showWelcome) {
      setTimeout(() => {
        notifyIslandWhenReady(
          {
            title: "Hello! Welcome to Studium Focus Mode",
            message: "Your routine is ready. Press Enter anytime to dive in.",
            kind: "success",
          },
          3500
        );
      }, 220);
    }

    // Default highlight/focus starts on the active nav item.
    setTimeout(() => {
      if (document.body.classList.contains("drawer-open")) return;
      const ae = document.activeElement;
      const isBlank = ae === document.body || ae === document.documentElement;
      if (isBlank && typeof window.focusNavMenu === "function") window.focusNavMenu();
    }, 60);
  };

  function runBootSequence(opts) {
    const mode = (opts && opts.mode) || "enter"; // enter | nav
    const showWelcome = !!(opts && opts.showWelcome);
    const playSound = !!(opts && opts.playSound);

    const fadeMs = Math.max(240, Number((opts && opts.fadeMs) || (mode === "nav" ? 680 : 5000)));
    const logoMs = Math.max(160, Number((opts && opts.logoMs) || (mode === "nav" ? 320 : 1000)));
    const hideMs = Math.max(160, Number((opts && opts.hideMs) || 520));
    const showLogo = opts && typeof opts.showLogo === "boolean" ? opts.showLogo : mode === "enter";

    try {
      overlay.style.setProperty("--boot-fade-ms", `${fadeMs}ms`);
      overlay.style.setProperty("--boot-hide-ms", `${hideMs}ms`);
      logo.style.setProperty("--boot-logo-ms", `${logoMs}ms`);
    } catch {
      // ignore
    }

    if (bootTimer) clearTimeout(bootTimer);
    if (logoTimer) clearTimeout(logoTimer);
    if (hideTimer) clearTimeout(hideTimer);
    bootTimer = null;
    logoTimer = null;
    hideTimer = null;

    try {
      overlay.classList.remove("bootOverlay--hide");
      overlay.classList.remove("bootOverlay--reveal");
      logo.classList.remove("bootLogo--show");
      overlay.style.background = "rgba(0,0,0,1)";
    } catch {
      // ignore
    }

    try {
      document.body.classList.add("booting");
      document.documentElement.classList.add("booting");
    } catch {
      // ignore
    }

    if (playSound) {
      try {
        const api = window.SFX;
        const muted = typeof api?.isMuted === "function" ? api.isMuted() : false;
        if (!muted && typeof api?.playBoot === "function") api.playBoot();
      } catch {
        // ignore
      }
    }

    requestAnimationFrame(() => {
      try {
        overlay.style.background = "transparent";
      } catch {
        // ignore
      }
      try {
        overlay.classList.add("bootOverlay--reveal");
      } catch {
        // ignore
      }
    });

    if (showLogo) {
      logoTimer = setTimeout(() => {
        try {
          logo.classList.add("bootLogo--show");
        } catch {
          // ignore
        }
      }, mode === "nav" ? 140 : 1000);
    }

    const totalMs = Math.max(520, Number((opts && opts.totalMs) || (mode === "nav" ? 880 : 6000)));
    bootTimer = setTimeout(() => cleanup({ showWelcome }), totalMs);

    hideTimer = setTimeout(() => {
      try {
        overlay.classList.add("bootOverlay--hide");
      } catch {
        // ignore
      }
    }, Math.max(0, totalMs - hideMs));
  }

  try {
    window.studiumBoot = runBootSequence;
  } catch {
    // ignore
  }

  try {
    const q = window.__studiumBootQueue;
    if (Array.isArray(q) && q.length) {
      window.__studiumBootQueue = [];
      q.forEach((item) => {
        try {
          runBootSequence(item);
        } catch {
          // ignore
        }
      });
    }
  } catch (err) {
    console.error("[Studium] Boot sequence failed:", err);
    cleanup({ showWelcome: false });
  }
})();

(function initClock() {
  const el = document.getElementById("clock");
  if (!el) return;

  const tick = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    el.textContent = `${h}:${m}`;
  };

  tick();
  setInterval(tick, 1000);
})();

(function initHeaderInteractions() {
  const viewBtn = document.getElementById("viewLabel");
  const viewInfo = document.getElementById("viewInfo");
  const viewInfoTitle = document.getElementById("viewInfoTitle");
  const viewInfoDesc = document.getElementById("viewInfoDesc");

  const userBtn = document.getElementById("userMenuBtn");
  const dashboardTopCard = () => document.getElementById("grid-leftTop");
  const overlay = document.getElementById("profileOverlay");
  const drawer = document.getElementById("profileDrawer");
  const closeBtn = document.getElementById("profileCloseBtn");
  const qsProfileBtn = document.getElementById("qsProfileBtn");
  const qsProfilePanel = document.getElementById("qsProfilePanel");
  const qsProfileCloseBtn = document.getElementById("qsProfileCloseBtn");
  const qsProfileEditBtn = document.getElementById("qsProfileEditBtn");
  const qsProfileMoreBtn = document.getElementById("qsProfileMoreBtn");
  const qsProfileStatusToggle = document.getElementById("qsProfileStatusToggle");
  const qsNotifBtn = document.getElementById("qsNotifBtn");
  const qsNotifPanel = document.getElementById("qsNotifPanel");
  const qsNotifCloseBtn = document.getElementById("qsNotifCloseBtn");
  const qsNotifSettingsBtn = document.getElementById("qsNotifSettingsBtn");
  const qsNotifToggle = document.getElementById("qsNotifToggle");
  const qsNotifPill = document.getElementById("qsNotifPill");
  const qsQuestBtn = document.getElementById("qsQuestBtn");
  const qsScheduleShortcutBtn = document.getElementById("qsScheduleShortcutBtn");
  const qsStudyShortcutBtn = document.getElementById("qsStudyShortcutBtn");
  const qsQuestPanel = document.getElementById("qsQuestPanel");
  const qsQuestCloseBtn = document.getElementById("qsQuestCloseBtn");
  const qsQuestOpenBtn = document.getElementById("qsQuestOpenBtn");
  const qsQuestList = document.getElementById("qsQuestList");
  const qsQuestEmpty = document.getElementById("qsQuestEmpty");
  const qsQuestSummaryTitle = document.getElementById("qsQuestSummaryTitle");
  const qsQuestSummarySub = document.getElementById("qsQuestSummarySub");
  const qsSchedulePanel = document.getElementById("qsSchedulePanel");
  const qsScheduleCloseBtn = document.getElementById("qsScheduleCloseBtn");
  const qsScheduleOpenBtn = document.getElementById("qsScheduleOpenBtn");
  const qsScheduleCalendarList = document.getElementById("qsScheduleCalendarList");
  const qsScheduleList = document.getElementById("qsScheduleList");
  const qsScheduleEmpty = document.getElementById("qsScheduleEmpty");
  const qsScheduleSummaryTitle = document.getElementById("qsScheduleSummaryTitle");
  const qsScheduleSummarySub = document.getElementById("qsScheduleSummarySub");
  const qsStudyPanel = document.getElementById("qsStudyPanel");
  const qsStudyCloseBtn = document.getElementById("qsStudyCloseBtn");
  const qsStudyOpenBtn = document.getElementById("qsStudyOpenBtn");
  const qsStudyStartBtn = document.getElementById("qsStudyStartBtn");
  const qsStudyMinutesSub = document.getElementById("qsStudyMinutesSub");
  const qsBattleBtn = document.getElementById("qsBattleBtn");
  const qsBattlePanel = document.getElementById("qsBattlePanel");
  const qsBattleCloseBtn = document.getElementById("qsBattleCloseBtn");
  const qsBattleOpenBtn = document.getElementById("qsBattleOpenBtn");
  const qsBattleModeBtn = document.getElementById("qsBattleModeBtn");
  const qsBattleStatEloVal = document.getElementById("qsBattleStatEloVal");
  const qsBattleStatRankVal = document.getElementById("qsBattleStatRankVal");
  const qsBattleStatWinrateVal = document.getElementById("qsBattleStatWinrateVal");
  const qsBattleStatXpVal = document.getElementById("qsBattleStatXpVal");
  const qsBattleQuestSub = document.getElementById("qsBattleQuestSub");
  const qsBattleQuestList = document.getElementById("qsBattleQuestList");
  const qsBattleQuestEmpty = document.getElementById("qsBattleQuestEmpty");
  const qsBattleLbList = document.getElementById("qsBattleLbList");
  const qsNotesBtn = document.getElementById("qsNotesBtn");
  const qsNotesPanel = document.getElementById("qsNotesPanel");
  const qsNotesCloseBtn = document.getElementById("qsNotesCloseBtn");
  const qsNotesOpenBtn = document.getElementById("qsNotesOpenBtn");
  const qsNotesSummaryTitle = document.getElementById("qsNotesSummaryTitle");
  const qsNotesSummarySub = document.getElementById("qsNotesSummarySub");
  const qsNotesFolderList = document.getElementById("qsNotesFolderList");
  const qsNotesFolderEmpty = document.getElementById("qsNotesFolderEmpty");
  const qsNotesTagList = document.getElementById("qsNotesTagList");
  const qsNotesTagEmpty = document.getElementById("qsNotesTagEmpty");
  const qsNotesAllList = document.getElementById("qsNotesAllList");
  const qsNotesAllEmpty = document.getElementById("qsNotesAllEmpty");
  const qsNotesRecentList = document.getElementById("qsNotesRecentList");
  const qsNotesRecentEmpty = document.getElementById("qsNotesRecentEmpty");
  const qsHomeBtn = document.getElementById("qsHomeBtn");
  const qsSettingsBtn = document.getElementById("qsSettingsBtn");
  const qsAdvanced = document.getElementById("qsAdvanced");
  const toggleSfxBtn = document.getElementById("toggleSfxBtn");
  const toggleMusicBtn = document.getElementById("toggleMusicBtn");
  const qsBrightness = document.getElementById("qsBrightness");
  const qsBrightnessVal = document.getElementById("qsBrightnessVal");
  const qsSfxVolume = document.getElementById("qsSfxVolume");
  const qsSfxVolumeVal = document.getElementById("qsSfxVolumeVal");
  const qsFullscreen = document.getElementById("qsFullscreen");
  const qsWallpapers = document.getElementById("qsWallpapers");
  const qsMusicAudio = document.getElementById("qsMusicAudio");
  const qsMusicIcon = document.getElementById("qsMusicIcon");
  const qsTrackTitle = document.getElementById("qsTrackTitle");
  const qsTrackSub = document.getElementById("qsTrackSub");
  const qsMusicPrevBtn = document.getElementById("qsMusicPrevBtn");
  const qsMusicPlayBtn = document.getElementById("qsMusicPlayBtn");
  const qsMusicNextBtn = document.getElementById("qsMusicNextBtn");
  const qsMusicVolume = document.getElementById("qsMusicVolume");
  const qsMusicVolumeVal = document.getElementById("qsMusicVolumeVal");
  const qsMuteBtn = document.getElementById("qsMuteBtn");
  const qsMusicSeek = document.getElementById("qsMusicSeek");
  const backToLandingBtn = document.getElementById("backToLandingBtn");
  const signInBtn = document.getElementById("signInBtn");
  const registerBtn = document.getElementById("registerBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  if (!viewBtn && !userBtn) return;

  const defaultDesc = {
    dashboard: "Your daily snapshot: routine, quests, streaks, and widgets.",
    routine: "Now / Next / Later \u2014 turn deadlines into concrete steps.",
    quest: "Pick quests, set difficulty, earn XP & streaks.",
    schedules: "Agenda + deadlines that feed your routine.",
    notes: "Capture quick notes tied to your quests and sessions.",
    study: "Start a session: focus, review, and capture.",
    pomodoro: "Timer + co-op focus sessions linked to tasks.",
    battle: "1v1 quizzes from a question bank. Win, rank up, repeat.",
    match: "Settings, preferences, and app options.",
  };

  const enterHeaderMode = () => {
    setMode("grid");
    if (typeof window.clearNavFocus === "function") window.clearNavFocus();
  };

  const focusNav = () => {
    if (typeof window.focusNavMenu === "function") window.focusNavMenu();
  };

  const focusGridTop = () => {
    const target = document.getElementById("grid-streak") || dashboardTopCard() || document.querySelector(".gridCard");
    if (!target) return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  };

  let infoTimer = null;
  const isViewInfoOpen = () => !!viewInfo && !viewInfo.hidden && viewInfo.classList.contains("viewInfo--show");
  const hideViewInfo = () => {
    if (!viewInfo) return;
    viewInfo.classList.remove("viewInfo--show");
    if (infoTimer) clearTimeout(infoTimer);
    infoTimer = null;
    setTimeout(() => {
      if (!viewInfo.classList.contains("viewInfo--show")) viewInfo.hidden = true;
    }, 260);
  };

  const showHeaderIslandInfo = () => {
    if (!viewBtn) return;

    enterHeaderMode();
    hideViewInfo();

    const view = document.body.dataset.view || "dashboard";
    const m = readViewMarker();
    const title = viewBtn.textContent?.trim() || m?.label || "Info";
    const message = (m?.desc || defaultDesc[view] || "").trim();

    const detail = { title, message, kind: "info" };
    try {
      const fn = window.studiumNotify;
      if (typeof fn === "function") fn(detail);
      else window.dispatchEvent(new CustomEvent("studium:notify", { detail }));
    } catch {
      // ignore
    }
  };

  const syncSfxLabel = () => {
    if (!toggleSfxBtn) return;
    const on = typeof SFX?.isMuted === "function" ? !SFX.isMuted() : true;
    toggleSfxBtn.setAttribute("aria-pressed", on ? "true" : "false");
    const icon = toggleSfxBtn.querySelector("i");
    if (icon) icon.className = on ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
  };

  const safeLocalGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const safeLocalSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // ignore
    }
  };

  const readStoredNumber = (k) => {
    const raw = safeLocalGet(k);
    if (raw === null) return Number.NaN;
    const n = Number(raw);
    return Number.isFinite(n) ? n : Number.NaN;
  };

  const LS_BRIGHT = "studium:qs_brightness";
  const LS_SFXVOL = "studium:qs_sfx_volume";
  const LS_FS = "studium:pref_fullscreen";
  const LS_WALL = "studium:qs_wallpapers";
  const LS_NOTIF_BASE = "studium:qs_notifications";
  const LS_MUTE_ALL = "studium:qs_mute_all";
  const LS_MUSIC_ON = "studium:qs_music_on";
  const LS_MUSIC_VOL = "studium:qs_music_volume";
  const LS_MUSIC_IDX = "studium:qs_music_index";
  const LS_QS_ADV = "studium:qs_advanced_open";
  const LS_QS_PROFILE_STATUS = "studium:qs_profile_status_on";
  const LS_QUESTS_BASE = "studium:quests_v1";
  const LS_EVENTS_BASE = "studium:events_v1";
  const LS_NOTES_BASE = "studium:notes:v1";
  const LS_STUDY_FOCUS_STATE_BASE = "studium:study_focus_room:v1";
  const PREF_EVENT = "studium:account_prefs_updated";

  const QS_MOBILE_MAX = 900;
  const isMobileQs = () => typeof window !== "undefined" && window.innerWidth <= QS_MOBILE_MAX;

  const qsPanels = {
    profile: { panel: qsProfilePanel, btn: qsProfileBtn },
    notif: { panel: qsNotifPanel, btn: qsNotifBtn },
    quest: { panel: qsQuestPanel, btn: qsQuestBtn },
    schedule: { panel: qsSchedulePanel, btn: qsScheduleShortcutBtn },
    study: { panel: qsStudyPanel, btn: qsStudyShortcutBtn },
    battle: { panel: qsBattlePanel, btn: qsBattleBtn },
    notes: { panel: qsNotesPanel, btn: qsNotesBtn },
  };

  let activeQsPanel = null;
  const panelCloseTimers = new Map();

  const isQsPanelOpen = (name) => {
    const panel = qsPanels[name]?.panel;
    if (!panel) return false;
    if (panel.hidden) return false;
    if (!document.body.classList.contains("qs-panel-open")) return false;
    if (activeQsPanel && activeQsPanel === name) return true;
    return document.body.classList.contains(`qs-${name}-open`);
  };

  const isAnyQsPanelOpen = () => !!activeQsPanel && isQsPanelOpen(activeQsPanel);

  const syncProfileStatusToggle = () => {
    if (!qsProfileStatusToggle) return;
    const on = safeLocalGet(LS_QS_PROFILE_STATUS) !== "0";
    qsProfileStatusToggle.checked = on;
  };

  const clearPanelCloseTimer = (name) => {
    const t = panelCloseTimers.get(name);
    if (t) clearTimeout(t);
    panelCloseTimers.delete(name);
  };

  const openQsPanel = (name, { focusFirst = true } = {}) => {
    const panel = qsPanels[name]?.panel;
    if (!panel) return;

    if (activeQsPanel && activeQsPanel !== name) closeQsPanel(activeQsPanel, { focusBtn: false });
    clearPanelCloseTimer(name);

    activeQsPanel = name;
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");

    if (name === "profile") syncProfileStatusToggle();
    if (name === "notif") syncNotifUi();
    if (name === "quest") syncQuestUi();
    if (name === "schedule") syncScheduleUi();
    if (name === "study") syncStudyUi();
    if (name === "battle") syncBattleUi();
    if (name === "notes") syncNotesUi();

    if (isMobileQs()) {
      try {
        closeDrawer({ focusProfile: false, immediate: true });
      } catch {
        // ignore
      }
      if (overlay) overlay.hidden = true;
    } else if (overlay) overlay.hidden = false;

    requestAnimationFrame(() => {
      document.body.classList.add("qs-panel-open", `qs-${name}-open`);
      panel.classList.add("qsPanel--open");
      if (!focusFirst) return;
      const first = panel.querySelector("[data-tab], button, input, select, textarea, [tabindex='0']");
      if (!first) return;
      try {
        first.focus({ preventScroll: true });
      } catch {
        first.focus();
      }
    });
  };

  const closeQsPanel = (name, { focusBtn = true } = {}) => {
    const panel = qsPanels[name]?.panel;
    if (!panel) return;
    const isActive = activeQsPanel === name;
    if (isActive) activeQsPanel = null;

    document.body.classList.remove(`qs-${name}-open`);
    document.body.classList.remove("qs-panel-open");

    panel.classList.remove("qsPanel--open");
    panel.setAttribute("aria-hidden", "true");

    clearPanelCloseTimer(name);
    const t = setTimeout(() => {
      if (!document.body.classList.contains(`qs-${name}-open`)) panel.hidden = true;
    }, 340);
    panelCloseTimers.set(name, t);

    if (overlay) {
      setTimeout(() => {
        if (!document.body.classList.contains("drawer-open") && !document.body.classList.contains("qs-panel-open")) overlay.hidden = true;
      }, 340);
    }

    const btn = qsPanels[name]?.btn;
    if (focusBtn && btn) {
      requestAnimationFrame(() => {
        try {
          btn.focus({ preventScroll: true });
        } catch {
          btn.focus();
        }
      });
    }
  };

  const closeActiveQsPanel = ({ focusBtn = true } = {}) => {
    if (!activeQsPanel) return;
    closeQsPanel(activeQsPanel, { focusBtn });
  };

  const openProfilePanel = (opts) => {
    document.body.classList.add("qs-profile-open");
    openQsPanel("profile", opts);
  };

  const closeProfilePanel = (opts = {}) => {
    closeQsPanel("profile", { focusBtn: opts.focusProfileBtn !== false });
    document.body.classList.remove("qs-profile-open");
  };

  const setAdvancedOpen = (open, { persist = false, focusFirst = false } = {}) => {
    if (!qsAdvanced || !qsSettingsBtn) return;
    qsAdvanced.hidden = !open;
    qsSettingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (persist) safeLocalSet(LS_QS_ADV, open ? "1" : "0");

    if (open && focusFirst) {
      const first = qsAdvanced.querySelector("input,button,select,textarea,[tabindex='0']");
      if (first) {
        requestAnimationFrame(() => {
          try {
            first.focus({ preventScroll: true });
          } catch {
            first.focus();
          }
        });
      }
    }
  };

  const syncNotifUi = () => {
    const scoped = scopedUserKey(LS_NOTIF_BASE);
    let raw = safeLocalGet(scoped);
    if (raw == null && scoped !== LS_NOTIF_BASE) raw = safeLocalGet(LS_NOTIF_BASE);
    if (raw != null && scoped !== LS_NOTIF_BASE && safeLocalGet(scoped) == null) safeLocalSet(scoped, raw);
    const on = raw !== "0";
    if (qsNotifBtn) qsNotifBtn.setAttribute("aria-pressed", on ? "true" : "false");
    if (qsNotifToggle) qsNotifToggle.checked = on;
    if (qsNotifPill) {
      qsNotifPill.textContent = on ? "On" : "Off";
      qsNotifPill.classList.toggle("qsMenuPill--off", !on);
    }
  };

  // Ensure QS notification state matches persisted settings (and migrate legacy key).
  syncNotifUi();

  function currentUserId() {
    try {
      const root = document.querySelector(".shellRoot");
      const raw = (root && root.dataset ? root.dataset.userId : "") || (document.body && document.body.dataset ? document.body.dataset.userId : "") || "";
      const id = Number(raw);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  function scopedUserKey(base) {
    const uid = currentUserId();
    return uid ? `${base}:u${uid}` : base;
  }

  const readQuests = () => {
    const raw = safeLocalGet(scopedUserKey(LS_QUESTS_BASE));
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  const readEvents = () => {
    const raw = safeLocalGet(scopedUserKey(LS_EVENTS_BASE));
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  const isQuestDone = (q) => {
    const stages = q && Array.isArray(q.stages) ? q.stages : [];
    if (!stages.length) return false;
    return stages.every((s) => !!(s && s.done));
  };

  const formatDue = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(String(iso));
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const syncQuestUi = () => {
    if (!qsQuestList) return;
    const quests = readQuests().filter((q) => q && q.id && !isQuestDone(q));
    quests.sort((a, b) => {
      const ad = a && a.dueAt ? new Date(String(a.dueAt)).getTime() : Number.POSITIVE_INFINITY;
      const bd = b && b.dueAt ? new Date(String(b.dueAt)).getTime() : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      const au = a && a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
      const bu = b && b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
      return bu - au;
    });

    const shown = quests.slice(0, 6);
    qsQuestList.innerHTML = "";

    if (qsQuestEmpty) {
      const empty = shown.length === 0;
      qsQuestEmpty.hidden = !empty;
      qsQuestEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
    }

    if (qsQuestSummaryTitle) qsQuestSummaryTitle.textContent = `Active quests${quests.length ? ` (${quests.length})` : ""}`;
    if (qsQuestSummarySub) qsQuestSummarySub.textContent = shown.length ? "Tap a quest to open details." : "Create a quest to start earning XP and streaks.";

    shown.forEach((q, idx) => {
      const title = String(q.title || "Untitled").trim() || "Untitled";
      const context = String(q.context || "").trim();
      const stages = Array.isArray(q.stages) ? q.stages : [];
      const done = stages.filter((s) => s && s.done).length;
      const total = stages.length;
      const due = formatDue(q.dueAt);
      const metaParts = [];
      if (context) metaParts.push(context);
      if (total) metaParts.push(`${done}/${total} stages`);
      if (due) metaParts.push(`Due ${due}`);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qsQuestItem headerAction";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("data-quest-id", String(q.id));
      btn.setAttribute("aria-label", `Open quest ${title}`);
      btn.setAttribute("data-focus", `drawer.quest.${idx + 1}`);

      const main = document.createElement("span");
      main.className = "qsQuestItemMain";

      const t = document.createElement("span");
      t.className = "qsQuestItemTitle";
      t.textContent = title;

      const m = document.createElement("span");
      m.className = "qsQuestItemMeta";
      m.textContent = metaParts.join(" • ");

      const ch = document.createElement("span");
      ch.className = "qsQuestItemChevron";
      ch.setAttribute("aria-hidden", "true");
      ch.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

      main.appendChild(t);
      main.appendChild(m);
      btn.appendChild(main);
      btn.appendChild(ch);
      qsQuestList.appendChild(btn);
    });
  };

  const fmtDayKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const fmtDayLabel = (d, idx) => {
    try {
      if (idx === 0) return "Today";
      if (idx === 1) return "Tomorrow";
      const wd = d.toLocaleDateString(undefined, { weekday: "short" });
      const md = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${wd}, ${md}`;
    } catch {
      return fmtDayKey(d);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(String(iso));
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const syncScheduleUi = () => {
    if (!qsScheduleList) return;

    const events = readEvents().filter((e) => e && e.id && e.startAt);
    const bucket = new Map();

    const nowTs = Date.now();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now);
    horizon.setDate(now.getDate() + 30);
    const horizonTs = horizon.getTime();

    let upcomingTotal = 0;
    let upcomingQuest = 0;
    let upcomingPersonal = 0;
    let nextAll = null;
    let nextQuest = null;
    let nextPersonal = null;
    for (const e of events) {
      try {
        const d = new Date(String(e.startAt));
        if (Number.isNaN(d.getTime())) continue;

        const ts = d.getTime();
        if (ts >= nowTs && ts < horizonTs) {
          upcomingTotal += 1;
          const isQuest = !!e.questId;
          if (isQuest) upcomingQuest += 1;
          else upcomingPersonal += 1;

          if (!nextAll || ts < nextAll.ts) nextAll = { ts, e };
          if (isQuest) {
            if (!nextQuest || ts < nextQuest.ts) nextQuest = { ts, e };
          } else {
            if (!nextPersonal || ts < nextPersonal.ts) nextPersonal = { ts, e };
          }
        }

        const key = fmtDayKey(d);
        const list = bucket.get(key) || [];
        list.push(e);
        bucket.set(key, list);
      } catch {
        // ignore
      }
    }

    const fmtNext = (rec) => {
      if (!rec?.e?.startAt) return "";
      try {
        const d = new Date(String(rec.e.startAt));
        if (Number.isNaN(d.getTime())) return "";
        const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return `Next ${day} â€¢ ${time}`;
      } catch {
        return "";
      }
    };

    if (qsScheduleCalendarList) qsScheduleCalendarList.innerHTML = "";

    if (qsScheduleCalendarList) {
      const items = [
        { filter: "all", title: "All calendars", count: upcomingTotal, next: fmtNext(nextAll) },
        { filter: "quest", title: "Quest milestones", count: upcomingQuest, next: fmtNext(nextQuest) },
        { filter: "personal", title: "Personal", count: upcomingPersonal, next: fmtNext(nextPersonal) },
      ];
      items.forEach((it, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "qsQuestItem headerAction qsScheduleItem";
        btn.setAttribute("role", "listitem");
        btn.setAttribute("data-schedule-filter", it.filter);
        btn.setAttribute("aria-label", `Open schedule: ${it.title}`);
        btn.setAttribute("data-focus", `drawer.schedule.cal.${idx + 1}`);

        const main = document.createElement("span");
        main.className = "qsQuestItemMain";

        const t = document.createElement("span");
        t.className = "qsQuestItemTitle";
        t.textContent = it.title;

        const m = document.createElement("span");
        m.className = "qsQuestItemMeta";
        m.textContent = `${it.count} event${it.count === 1 ? "" : "s"} (30d)${it.next ? ` â€¢ ${it.next}` : ""}`;

        const ch = document.createElement("span");
        ch.className = "qsQuestItemChevron";
        ch.setAttribute("aria-hidden", "true");
        ch.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

        main.appendChild(t);
        main.appendChild(m);
        btn.appendChild(main);
        btn.appendChild(ch);
        qsScheduleCalendarList.appendChild(btn);
      });
    }

    const start = new Date(now);
    qsScheduleList.innerHTML = "";

    const daysToShow = [];
    for (let i = 0; i < 30; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = fmtDayKey(day);
      const list = bucket.get(key) || [];
      if ((i === 0 && upcomingTotal > 0) || list.length > 0) daysToShow.push({ day, key, list, idx: i });
      if (daysToShow.length >= 7) break;
    }

    for (let i = 0; i < daysToShow.length; i++) {
      const item = daysToShow[i];
      const day = item.day;
      const key = item.key;
      const list = item.list;
      const labelIdx = item.idx;
      list.sort((a, b) => {
        const at = a && a.startAt ? new Date(String(a.startAt)).getTime() : 0;
        const bt = b && b.startAt ? new Date(String(b.startAt)).getTime() : 0;
        return at - bt;
      });

      const count = list.length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qsQuestItem headerAction qsScheduleItem";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("data-schedule-day", key);
      btn.setAttribute("aria-label", `Open schedule for ${fmtDayLabel(day, labelIdx)}`);
      btn.setAttribute("data-focus", `drawer.schedule.day.${i + 1}`);

      const main = document.createElement("span");
      main.className = "qsQuestItemMain";

      const t = document.createElement("span");
      t.className = "qsQuestItemTitle";
      t.textContent = fmtDayLabel(day, labelIdx);

      const m = document.createElement("span");
      m.className = "qsQuestItemMeta";
      const nextTime = count ? fmtTime(list[0]?.startAt) : "";
      m.textContent = count ? `${count} event${count === 1 ? "" : "s"}${nextTime ? ` • Next ${nextTime}` : ""}` : "No events";

      const ch = document.createElement("span");
      ch.className = "qsQuestItemChevron";
      ch.setAttribute("aria-hidden", "true");
      ch.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

      main.appendChild(t);
      main.appendChild(m);
      btn.appendChild(main);
      btn.appendChild(ch);
      qsScheduleList.appendChild(btn);
    }

    if (qsScheduleSummaryTitle) qsScheduleSummaryTitle.textContent = `Calendar${upcomingTotal ? ` (${upcomingTotal})` : ""}`;
    if (qsScheduleSummarySub) qsScheduleSummarySub.textContent = upcomingTotal ? "Tap a day to open your schedule." : "No events scheduled for the next 30 days.";

    if (qsScheduleEmpty) {
      const empty = upcomingTotal === 0;
      qsScheduleEmpty.hidden = !empty;
      qsScheduleEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
    }
  };

  const fmtRelative = (ts) => {
    const t = Number(ts || 0);
    if (!Number.isFinite(t) || t <= 0) return "";
    const delta = Math.max(0, Date.now() - t);
    const min = Math.floor(delta / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  };

  const readScopedRaw = (base) => {
    const scoped = scopedUserKey(base);
    const scopedVal = safeLocalGet(scoped);
    if (scopedVal != null) return { scoped, raw: scopedVal };
    if (scoped !== base) {
      const legacyVal = safeLocalGet(base);
      if (legacyVal != null) return { scoped, raw: legacyVal, legacy: true };
    }
    return { scoped, raw: null };
  };

  const ensureScoped = (base) => {
    const { scoped, raw, legacy } = readScopedRaw(base);
    if (!legacy) return raw;
    if (raw == null) return null;
    safeLocalSet(scoped, raw);
    return raw;
  };

  const syncStudyUi = () => {
    if (!qsStudyMinutesSub) return;
    const raw = ensureScoped(LS_STUDY_FOCUS_STATE_BASE);
    let sec = 0;
    let sessions = 0;
    if (raw) {
      try {
        const v = JSON.parse(raw);
        sec = Number(v?.studySecondsToday ?? 0) || 0;
        sessions = Number(v?.sessionsToday ?? 0) || 0;
      } catch {
        // ignore
      }
    }
    const minutes = Math.floor(Math.max(0, sec) / 60);
    qsStudyMinutesSub.textContent = `You have studied for ${minutes} minute${minutes === 1 ? "" : "s"} today${sessions ? ` \u2022 ${sessions} session${sessions === 1 ? "" : "s"}` : ""}.`;
  };

  const readNotesStore = () => {
    const raw = ensureScoped(LS_NOTES_BASE);
    if (!raw) return { notes: [], folderCatalog: [], tagCatalog: [] };
    try {
      const v = JSON.parse(raw);
      return {
        notes: Array.isArray(v?.notes) ? v.notes : [],
        folderCatalog: Array.isArray(v?.folderCatalog) ? v.folderCatalog : [],
        tagCatalog: Array.isArray(v?.tagCatalog) ? v.tagCatalog : [],
      };
    } catch {
      return { notes: [], folderCatalog: [], tagCatalog: [] };
    }
  };

  const syncNotesUi = () => {
    const store = readNotesStore();
    const notes = Array.isArray(store.notes) ? store.notes : [];
    const folders = Array.isArray(store.folderCatalog) ? store.folderCatalog : [];
    const tags = Array.isArray(store.tagCatalog) ? store.tagCatalog : [];

    const activeNotes = notes.filter((n) => n && !n.deletedAt && !n.hiddenAt);

    if (qsNotesSummaryTitle) qsNotesSummaryTitle.textContent = `Notes${activeNotes.length ? ` (${activeNotes.length})` : ""}`;
    if (qsNotesSummarySub) qsNotesSummarySub.textContent = activeNotes.length ? "Tap an item to open Notes." : "Create a note to start capturing ideas.";

    if (qsNotesFolderList) qsNotesFolderList.innerHTML = "";
    if (qsNotesTagList) qsNotesTagList.innerHTML = "";
    if (qsNotesRecentList) qsNotesRecentList.innerHTML = "";

    const folderCounts = new Map();
    for (const n of activeNotes) {
      const fid = typeof n?.folder === "string" ? n.folder : "";
      if (!fid) continue;
      folderCounts.set(fid, (folderCounts.get(fid) || 0) + 1);
    }

    const tagCounts = new Map();
    for (const n of activeNotes) {
      const list = Array.isArray(n?.tags) ? n.tags : [];
      for (const tid of list) {
        const id = String(tid || "").trim();
        if (!id) continue;
        tagCounts.set(id, (tagCounts.get(id) || 0) + 1);
      }
    }

    const mkJumpItem = ({ title, meta, focusKey, label, noteId }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qsQuestItem headerAction qsNotesItem";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("data-notes-jump", "1");
      btn.setAttribute("aria-label", label || `Open notes for ${title}`);
      if (focusKey) btn.setAttribute("data-focus", focusKey);
      if (noteId) btn.setAttribute("data-note-id", String(noteId));

      const main = document.createElement("span");
      main.className = "qsQuestItemMain";

      const t = document.createElement("span");
      t.className = "qsQuestItemTitle";
      t.textContent = title;

      const m = document.createElement("span");
      m.className = "qsQuestItemMeta";
      m.textContent = meta || "";

      const ch = document.createElement("span");
      ch.className = "qsQuestItemChevron";
      ch.setAttribute("aria-hidden", "true");
      ch.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

      main.appendChild(t);
      main.appendChild(m);
      btn.appendChild(main);
      btn.appendChild(ch);
      return btn;
    };

    if (qsNotesFolderList) {
      const shown = folders
        .map((f) => {
          const id = String(f?.id || "").trim();
          const label = String(f?.label || id || "Folder").trim();
          const count = folderCounts.get(id) || 0;
          return { id, label, count };
        })
        .filter((x) => x.id && x.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 4);

      shown.forEach((f, idx) => {
        qsNotesFolderList.appendChild(
          mkJumpItem({
            title: f.label,
            meta: `${f.count} note${f.count === 1 ? "" : "s"}`,
            focusKey: `drawer.notes.folder.${idx + 1}`,
            label: `Open notes folder ${f.label}`,
          }),
        );
      });
      if (qsNotesFolderEmpty) {
        const empty = shown.length === 0;
        qsNotesFolderEmpty.hidden = !empty;
        qsNotesFolderEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
      }
    }

    if (qsNotesTagList) {
      const shown = tags
        .map((t) => {
          const id = String(t?.id || "").trim();
          const label = String(t?.label || id || "Tag").trim();
          const count = tagCounts.get(id) || 0;
          return { id, label, count };
        })
        .filter((x) => x.id && x.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 4);

      shown.forEach((t, idx) => {
        qsNotesTagList.appendChild(
          mkJumpItem({
            title: t.label,
            meta: `${t.count} note${t.count === 1 ? "" : "s"}`,
            focusKey: `drawer.notes.tag.${idx + 1}`,
            label: `Open notes tag ${t.label}`,
          }),
        );
      });
      if (qsNotesTagEmpty) {
        const empty = shown.length === 0;
        qsNotesTagEmpty.hidden = !empty;
        qsNotesTagEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
      }
    }

    if (qsNotesAllList) {
      const list = activeNotes
        .slice()
        .sort((a, b) => {
          const au = Number(a?.createdAt ?? 0) || 0;
          const bu = Number(b?.createdAt ?? 0) || 0;
          if (bu !== au) return bu - au;
          const au2 = Number(a?.updatedAt ?? 0) || 0;
          const bu2 = Number(b?.updatedAt ?? 0) || 0;
          return bu2 - au2;
        })
        .slice(0, 6);

      list.forEach((n, idx) => {
        const title = String(n?.title || "Untitled").trim() || "Untitled";
        const ts = Number(n?.createdAt ?? n?.updatedAt ?? 0) || 0;
        const fid = typeof n?.folder === "string" ? n.folder : "";
        const folderLabel = fid ? (folders.find((f) => String(f?.id) === fid)?.label || fid) : "";
        const meta = `${ts ? `Created ${fmtRelative(ts)}` : "Created"}${folderLabel ? ` â€¢ ${folderLabel}` : ""}`;
        qsNotesAllList.appendChild(
          mkJumpItem({
            title,
            meta,
            focusKey: `drawer.notes.note.${idx + 1}`,
            label: `Open note ${title}`,
            noteId: n?.id,
          }),
        );
      });

      if (qsNotesAllEmpty) {
        const empty = list.length === 0;
        qsNotesAllEmpty.hidden = !empty;
        qsNotesAllEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
      }
    }

    if (qsNotesRecentList) {
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      const rec = activeNotes
        .slice()
        .sort((a, b) => {
          const au = Number(a?.updatedAt ?? a?.createdAt ?? 0) || 0;
          const bu = Number(b?.updatedAt ?? b?.createdAt ?? 0) || 0;
          return bu - au;
        })
        .filter((n) => {
          const ts = Number(n?.updatedAt ?? n?.createdAt ?? 0) || 0;
          return ts >= cutoff;
        })
        .slice(0, 5);

      rec.forEach((n, idx) => {
        const title = String(n?.title || "Untitled").trim() || "Untitled";
        const ts = Number(n?.updatedAt ?? n?.createdAt ?? 0) || 0;
        qsNotesRecentList.appendChild(
          mkJumpItem({
            title,
            meta: ts ? `Updated ${fmtRelative(ts)}` : "Recently updated",
            focusKey: `drawer.notes.recent.${idx + 1}`,
            label: `Open note ${title}`,
            noteId: n?.id,
          }),
        );
      });

      if (qsNotesRecentEmpty) {
        const empty = rec.length === 0;
        qsNotesRecentEmpty.hidden = !empty;
        qsNotesRecentEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
      }
    }
  };

  const fmtNum = (n) => {
    try {
      return Number(n).toLocaleString();
    } catch {
      return String(n);
    }
  };

  const DUMMY_BATTLE_LB = [
    { id: "u1", name: "Abyss", xp: 6240, elo: 1420, tag: "B29" },
    { id: "u2", name: "Putra", xp: 5180, elo: 1350, tag: "B29" },
    { id: "u3", name: "Nara", xp: 4820, elo: 1288, tag: "B29" },
    { id: "u4", name: "Raka", xp: 4550, elo: 1210, tag: "B29" },
    { id: "u5", name: "Salsa", xp: 4390, elo: 1194, tag: "B29" },
  ];

  let battleLbCache = null;
  let battleLbCacheAt = 0;
  let battleLbInflight = null;

  const renderBattleLeaderboard = (entries) => {
    if (!qsBattleLbList) return;
    qsBattleLbList.innerHTML = "";

    const list = Array.isArray(entries) ? entries : [];
    if (list.length === 0) {
      const row = document.createElement("div");
      row.className = "qsBattleLbRow";
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", "No leaderboard data");
      row.textContent = "No leaderboard data yet.";
      qsBattleLbList.appendChild(row);
      return;
    }

    list.forEach((e, i) => {
      const row = document.createElement("div");
      row.className = "qsBattleLbRow";
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", `Rank ${i + 1} ${e.name}`);

      const r = document.createElement("div");
      r.className = "qsBattleLbRank";
      r.textContent = `#${i + 1}`;

      const main = document.createElement("div");
      main.className = "qsBattleLbMain";

      const name = document.createElement("div");
      name.className = "qsBattleLbName";
      name.textContent = e.name;

      const meta = document.createElement("div");
      meta.className = "qsBattleLbMeta";
      meta.textContent = `${fmtNum(e.xp)} XP â€¢ ${fmtNum(e.elo)} ELO`;

      const tag = document.createElement("div");
      tag.className = "qsBattleLbTag";
      tag.textContent = e.tag || "â€”";

      main.appendChild(name);
      main.appendChild(meta);
      row.appendChild(r);
      row.appendChild(main);
      row.appendChild(tag);
      qsBattleLbList.appendChild(row);
    });
  };

  const ensureBattleLeaderboard = async () => {
    const now = Date.now();
    if (battleLbCache && now - battleLbCacheAt < 60_000) return battleLbCache;
    if (battleLbInflight) return battleLbInflight;

    if (typeof fetch !== "function") {
      battleLbCache = { entries: DUMMY_BATTLE_LB };
      battleLbCacheAt = now;
      return battleLbCache;
    }

    battleLbInflight = (async () => {
      try {
        const res = await fetch("/api/battle/leaderboard?sort=xp&limit=5", { credentials: "include" });
        const json = await res.json();
        const entries = Array.isArray(json?.entries) ? json.entries : [];
        const normalized = entries.map((x) => ({
          id: String(x?.id || ""),
          name: String(x?.name || "Unknown"),
          xp: Number(x?.xp ?? 0) || 0,
          elo: Number(x?.elo ?? 0) || 0,
          tag: String(x?.tag || "â€”"),
        }));

        battleLbCache = { entries: normalized.length ? normalized : DUMMY_BATTLE_LB };
        battleLbCacheAt = Date.now();
        return battleLbCache;
      } catch {
        battleLbCache = { entries: DUMMY_BATTLE_LB };
        battleLbCacheAt = Date.now();
        return battleLbCache;
      } finally {
        battleLbInflight = null;
      }
    })();

    return battleLbInflight;
  };

  const syncBattleUi = () => {
    const elo = 1350;
    const rank = "Silver II";
    const winrate = "62%";
    const battleXp = "+240";

    if (qsBattleStatEloVal) qsBattleStatEloVal.textContent = fmtNum(elo);
    if (qsBattleStatRankVal) qsBattleStatRankVal.textContent = rank;
    if (qsBattleStatWinrateVal) qsBattleStatWinrateVal.textContent = winrate;
    if (qsBattleStatXpVal) qsBattleStatXpVal.textContent = battleXp;

    if (qsBattleLbList) {
      qsBattleLbList.innerHTML = "";
      (battleLbCache && Array.isArray(battleLbCache.entries) ? battleLbCache.entries : DUMMY_BATTLE_LB).forEach((e, i) => {
        const row = document.createElement("div");
        row.className = "qsBattleLbRow";
        row.setAttribute("role", "listitem");
        row.setAttribute("aria-label", `Rank ${i + 1} ${e.name}`);

        const r = document.createElement("div");
        r.className = "qsBattleLbRank";
        r.textContent = `#${i + 1}`;

        const main = document.createElement("div");
        main.className = "qsBattleLbMain";

        const name = document.createElement("div");
        name.className = "qsBattleLbName";
        name.textContent = e.name;

        const meta = document.createElement("div");
        meta.className = "qsBattleLbMeta";
        meta.textContent = `${fmtNum(e.xp)} XP • ${fmtNum(e.elo)} ELO`;

        const tag = document.createElement("div");
        tag.className = "qsBattleLbTag";
        tag.textContent = e.tag;

        main.appendChild(name);
        main.appendChild(meta);
        row.appendChild(r);
        row.appendChild(main);
        row.appendChild(tag);
        qsBattleLbList.appendChild(row);
      });

      ensureBattleLeaderboard().then((data) => {
        if (!isQsPanelOpen("battle")) return;
        const entries = data && Array.isArray(data.entries) ? data.entries : DUMMY_BATTLE_LB;
        renderBattleLeaderboard(entries);
      });
    }

    if (qsBattleQuestList) {
      const quests = readQuests().filter((q) => q && q.id && !isQuestDone(q));
      const shown = quests.slice(0, 2);
      qsBattleQuestList.innerHTML = "";

      if (qsBattleQuestEmpty) {
        const empty = shown.length === 0;
        qsBattleQuestEmpty.hidden = !empty;
        qsBattleQuestEmpty.setAttribute("aria-hidden", empty ? "false" : "true");
      }

      if (qsBattleQuestSub) {
        qsBattleQuestSub.textContent = quests.length
          ? `Recommendations from your active quests (${quests.length}).`
          : "Create a quest to get battle recommendations.";
      }

      shown.forEach((q, idx) => {
        const title = String(q.title || "Untitled").trim() || "Untitled";
        const dueMs = q && q.dueAt ? new Date(String(q.dueAt)).getTime() : Number.POSITIVE_INFINITY;
        const days = Number.isFinite(dueMs) ? (dueMs - Date.now()) / 86_400_000 : Number.POSITIVE_INFINITY;
        const dueSoon = Number.isFinite(days) && days <= 7;
        const recMode = dueSoon ? "Ranked" : "Practice";
        const reward = dueSoon ? "+120 XP" : "10m";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "qsBattleQuestItem headerAction";
        btn.setAttribute("role", "listitem");
        btn.setAttribute("data-quest-id", String(q.id));
        btn.setAttribute("aria-label", `Open battle based on ${title}`);
        btn.setAttribute("data-focus", `drawer.battle.quest.${idx + 1}`);

        const wrap = document.createElement("span");
        wrap.style.minWidth = "0";

        const t = document.createElement("div");
        t.className = "qsBattleQuestItemTitle";
        t.textContent = title;

        const m = document.createElement("div");
        m.className = "qsBattleQuestItemMeta";
        m.textContent = `Recommended: ${recMode} • ${reward}`;

        const ch = document.createElement("span");
        ch.className = "qsBattleQuestItemChevron";
        ch.setAttribute("aria-hidden", "true");
        ch.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

        wrap.appendChild(t);
        wrap.appendChild(m);
        btn.appendChild(wrap);
        btn.appendChild(ch);
        qsBattleQuestList.appendChild(btn);
      });
    }
  };

  const setPendingFocus = (key) => {
    if (!key) return;
    try {
      sessionStorage.setItem("studium:pending_focus", String(key));
    } catch {
      // ignore
    }
  };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  let muteAll = safeLocalGet(LS_MUTE_ALL) === "1";

  const syncMuteUi = () => {
    if (!qsMuteBtn) return;
    qsMuteBtn.setAttribute("aria-pressed", muteAll ? "true" : "false");
    const icon = qsMuteBtn.querySelector("i");
    if (icon) icon.className = muteAll ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
  };

  const syncMusicBtnUi = (on) => {
    if (!toggleMusicBtn) return;
    toggleMusicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    toggleMusicBtn.classList.toggle("qsPillBtn--off", !on);
  };

  const syncMusicVolUi = (n) => {
    if (qsMusicVolumeVal) qsMusicVolumeVal.textContent = String(Math.round(n));
  };

  const setPlayIcon = (playing) => {
    if (!qsMusicPlayBtn) return;
    const icon = qsMusicPlayBtn.querySelector("i");
    if (!icon) return;
    icon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
  };

  const music = {
    enabled: safeLocalGet(LS_MUSIC_ON) !== "0",
    volume: (() => {
      const saved = readStoredNumber(LS_MUSIC_VOL);
      return Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : 55;
    })(),
    index: Math.max(0, Number(safeLocalGet(LS_MUSIC_IDX) ?? 0) || 0),
    tracks: [],
    loaded: false,
  };

  let musicCtx = null;
  let musicAnalyser = null;
  let musicGain = null;
  let musicSource = null;
  let musicFreq = null;
  let musicRaf = null;
  let beatAvg = 0;
  let beatPulse = 0;

  const applyMusicGain = () => {
    const target = (music.enabled ? clamp01(music.volume / 100) : 0) * (muteAll ? 0 : 1);
    if (musicGain) {
      try {
        musicGain.gain.value = target;
      } catch {
        // ignore
      }
      return;
    }
    if (qsMusicAudio) qsMusicAudio.volume = target;
  };

  const startBeatLoop = () => {
    if (musicRaf) return;
    const tick = () => {
      if (musicAnalyser && musicFreq && qsMusicIcon) {
        if (qsMusicAudio && qsMusicAudio.paused) {
          beatAvg *= 0.92;
          beatPulse *= 0.86;
          qsMusicIcon.style.setProperty("--qs-beat", "0");
          musicRaf = requestAnimationFrame(tick);
          return;
        }
        try {
          musicAnalyser.getByteFrequencyData(musicFreq);
          const bassBins = Math.min(24, musicFreq.length);
          const midStart = bassBins;
          const midEnd = Math.min(midStart + 48, musicFreq.length);

          let bass = 0;
          for (let i = 0; i < bassBins; i++) bass += musicFreq[i];
          bass = (bass / Math.max(1, bassBins)) / 255;

          let mid = 0;
          for (let i = midStart; i < midEnd; i++) mid += musicFreq[i];
          mid = (mid / Math.max(1, midEnd - midStart)) / 255;

          const energy = bass * 0.72 + mid * 0.28;
          beatAvg = beatAvg * 0.94 + energy * 0.06;
          const delta = energy - beatAvg;
          const hit = clamp01(delta * 6.2);
          beatPulse = Math.max(beatPulse * 0.84, hit);
          const beat = clamp01(energy * 1.7 + beatPulse * 0.85);
          qsMusicIcon.style.setProperty("--qs-beat", beat.toFixed(3));
        } catch {
          qsMusicIcon.style.setProperty("--qs-beat", "0");
        }
      } else if (qsMusicIcon) {
        qsMusicIcon.style.setProperty("--qs-beat", "0");
      }
      musicRaf = requestAnimationFrame(tick);
    };
    musicRaf = requestAnimationFrame(tick);
  };

  const ensureMusicGraph = async () => {
    if (!qsMusicAudio) return;
    if (musicCtx && musicAnalyser && musicGain && musicSource) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const source = ctx.createMediaElementSource(qsMusicAudio);
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);

    musicCtx = ctx;
    musicAnalyser = analyser;
    musicGain = gain;
    musicSource = source;
    musicFreq = new Uint8Array(analyser.frequencyBinCount);

    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // ignore
    }

    // When using WebAudio, keep element volume at 1 so we control output via `gain`.
    try {
      qsMusicAudio.volume = 1;
    } catch {
      // ignore
    }

    applyMusicGain();
    startBeatLoop();
  };

  const applyMusicVolume = (value) => {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    music.volume = n;
    if (qsMusicVolume) qsMusicVolume.value = String(n);
    syncMusicVolUi(n);
    safeLocalSet(LS_MUSIC_VOL, String(Math.round(n)));
    applyMusicGain();
  };

  const setMusicEnabled = (on, { persist = true } = {}) => {
    music.enabled = !!on;
    if (persist) safeLocalSet(LS_MUSIC_ON, music.enabled ? "1" : "0");
    syncMusicBtnUi(music.enabled);
    applyMusicGain();
    if (!music.enabled && qsMusicAudio) {
      try {
        qsMusicAudio.pause();
      } catch {
        // ignore
      }
    }
    setPlayIcon(qsMusicAudio ? !qsMusicAudio.paused : false);
  };

  const applyMuteAll = ({ persist = true } = {}) => {
    if (typeof SFX?.setMuted === "function") SFX.setMuted(muteAll);
    if (persist) safeLocalSet(LS_MUTE_ALL, muteAll ? "1" : "0");
    applyMusicGain();
    syncMuteUi();
  };

  const prettyTitle = (filename) => {
    const base = String(filename || "").replace(/\.[a-z0-9]+$/i, "");
    const cleaned = base.replace(/^[0-9]+[ _.-]*/, "").replace(/[_-]+/g, " ").trim();
    // Insert spaces in simple camelcase: PlasticLove -> Plastic Love
    return cleaned.replace(/([a-z])([A-Z])/g, "$1 $2").trim() || "Untitled";
  };

  const setTrackUi = (track) => {
    if (!qsTrackTitle || !qsTrackSub) return;
    if (!track) {
      qsTrackTitle.textContent = "No playlist";
      qsTrackSub.textContent = "No tracks loaded";
      return;
    }
    qsTrackTitle.textContent = track.title || "Track";
    qsTrackSub.textContent = track.subtitle || track.file || "";
  };

  const applyTrack = (idx, { autoplay = false } = {}) => {
    if (!qsMusicAudio) return;
    if (!music.tracks || music.tracks.length === 0) {
      setTrackUi(null);
      try {
        qsMusicAudio.removeAttribute("src");
      } catch {
        // ignore
      }
      return;
    }

    const nextIndex = ((idx % music.tracks.length) + music.tracks.length) % music.tracks.length;
    music.index = nextIndex;
    safeLocalSet(LS_MUSIC_IDX, String(nextIndex));

    const t = music.tracks[nextIndex];
    setTrackUi(t);

    const src = t.src || t.url || "";
    if (src) {
      const wanted = String(src);
      if (qsMusicAudio.getAttribute("src") !== wanted) {
        qsMusicAudio.src = wanted;
        try {
          qsMusicAudio.load();
        } catch {
          // ignore
        }
        if (qsMusicSeek) {
          qsMusicSeek.disabled = true;
          qsMusicSeek.value = "0";
          qsMusicSeek.dataset.scrubbing = "0";
        }
      }

      if (autoplay && music.enabled) {
        try {
          const p = qsMusicAudio.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } catch {
          // ignore autoplay errors
        }
      }
    }
  };

  const loadPlaylistOnce = async () => {
    if (music.loaded) return;
    music.loaded = true;

    try {
      const res = await fetch("/sound/playlist/manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const json = await res.json();
      const tracks = Array.isArray(json?.tracks) ? json.tracks : [];
      music.tracks = tracks
        .map((t) => {
          if (!t) return null;
          if (typeof t === "string") return { src: t, title: prettyTitle(t.split("/").pop()) };
          const file = t.file || t.filename || "";
          const src = t.src || t.url || (file ? `/sound/playlist/${file}` : "");
          return {
            src,
            file,
            title: t.title || prettyTitle(file || src.split("/").pop()),
            subtitle: t.subtitle || t.artist || "",
          };
        })
        .filter(Boolean);
    } catch {
      music.tracks = [];
    }

    if (qsMusicAudio) {
      qsMusicAudio.loop = false;
    }
    applyMusicGain();

    if (music.tracks.length === 0) {
      setTrackUi(null);
      return;
    }

    applyTrack(music.index, { autoplay: false });
  };

  const applyBrightness = (value) => {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    // Background brightness factor 0.70..1.20
    const b = 0.7 + (n / 100) * 0.5;
    document.body.style.setProperty("--qs-bg-brightness", String(b.toFixed(3)));
    // Slight veil reduction when brighter.
    const veil = 1 - (n / 100) * 0.12;
    document.body.style.setProperty("--qs-veil-opacity", String(veil.toFixed(3)));
    if (qsBrightnessVal) qsBrightnessVal.textContent = String(Math.round(n));
  };

  const applySfxVolume = (value) => {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return;
    const n = Math.max(0, Math.min(100, raw));
    const v = n / 100;
    if (typeof SFX?.setVolume === "function") SFX.setVolume(v);
    if (qsSfxVolumeVal) qsSfxVolumeVal.textContent = String(Math.round(n));
  };

  const setSfxVolumeUi = (value) => {
    if (!qsSfxVolume) return;
    const raw = Number(value);
    if (!Number.isFinite(raw)) return;
    const n = Math.max(0, Math.min(100, raw));
    qsSfxVolume.value = String(n);
    if (qsSfxVolumeVal) qsSfxVolumeVal.textContent = String(Math.round(n));
  };

  const applyFullscreenPref = (on) => {
    safeLocalSet(LS_FS, on ? "1" : "0");
  };

  const applyWallpapers = (on) => {
    if (on) document.body.classList.remove("no-video");
    else document.body.classList.add("no-video");
    safeLocalSet(LS_WALL, on ? "1" : "0");
  };

  let closeTimer = null;
  const openDrawer = () => {
    if (!drawer || !overlay) return;
    try {
      closeActiveQsPanel({ focusBtn: false });
    } catch {
      // ignore
    }
    enterHeaderMode();
    if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
    hideViewInfo();
    syncSfxLabel();
    syncNotifUi();
    syncMusicBtnUi(music.enabled);
    muteAll = safeLocalGet(LS_MUTE_ALL) === "1";
    applyMuteAll({ persist: false });

    // Sync quick settings values on open.
    if (qsBrightness) {
      const saved = readStoredNumber(LS_BRIGHT);
      const val = Number.isFinite(saved) ? saved : Number(qsBrightness.value || 78);
      qsBrightness.value = String(Math.max(0, Math.min(100, val)));
      applyBrightness(qsBrightness.value);
    }

    if (qsSfxVolume) {
      const saved = readStoredNumber(LS_SFXVOL);
      const val = Number.isFinite(saved) ? saved : Math.round((typeof SFX?.getVolume === "function" ? SFX.getVolume() : 0.55) * 100);
      setSfxVolumeUi(val);
    }

    if (qsFullscreen) {
      const on = safeLocalGet(LS_FS) === "1";
      qsFullscreen.checked = on;
    }

    if (qsWallpapers) {
      const saved = safeLocalGet(LS_WALL);
      const on = saved === null ? !document.body.classList.contains("no-video") : saved === "1";
      qsWallpapers.checked = on;
      applyWallpapers(on);
    }

    if (qsSettingsBtn && qsAdvanced) {
      const open = safeLocalGet(LS_QS_ADV) === "1";
      setAdvancedOpen(open, { persist: false });
    }

    if (qsMusicVolume) {
      const saved = readStoredNumber(LS_MUSIC_VOL);
      const val = Number.isFinite(saved) ? saved : music.volume;
      applyMusicVolume(val);
    }

    if (qsMusicAudio) {
      setPlayIcon(!qsMusicAudio.paused);
      // Lazy-load playlist (fetch) only when the drawer is opened.
      loadPlaylistOnce();
    }

    if (closeTimer) clearTimeout(closeTimer);
    overlay.hidden = false;
    drawer.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");

    setTimeout(() => {
      try {
        (closeBtn || drawer).focus({ preventScroll: true });
      } catch {
        (closeBtn || drawer).focus();
      }
    }, 20);
  };

  const closeDrawer = ({ focusProfile = true, immediate = false } = {}) => {
    if (!drawer || !overlay) return;
    document.body.classList.remove("drawer-open");
    drawer.setAttribute("aria-hidden", "true");

    if (closeTimer) clearTimeout(closeTimer);
    if (immediate) {
      overlay.hidden = true;
      drawer.hidden = true;
      return;
    }

    closeTimer = setTimeout(() => {
      if (!document.body.classList.contains("drawer-open") && !document.body.classList.contains("qs-panel-open")) overlay.hidden = true;
      drawer.hidden = true;
    }, 340);

    if (focusProfile && userBtn) {
      const focusProfileBtn = () => {
        try {
          userBtn.focus({ preventScroll: true });
        } catch {
          userBtn.focus();
        }
      };

      // Some browsers keep focus on the closing drawer button; force a few times.
      focusProfileBtn();
      requestAnimationFrame(focusProfileBtn);
      setTimeout(focusProfileBtn, 60);
      setTimeout(focusProfileBtn, 380);
    }
  };

  if (viewBtn) {
    viewBtn.addEventListener("click", showHeaderIslandInfo);
    viewBtn.addEventListener("pointerdown", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
    });
    viewBtn.addEventListener("focus", () => enterHeaderMode());
  }

  if (toggleSfxBtn) {
    toggleSfxBtn.addEventListener("click", () => {
      if (typeof SFX?.isMuted !== "function" || typeof SFX?.setMuted !== "function") return;
      SFX.setMuted(!SFX.isMuted());
      syncSfxLabel();
    });
  }

  if (qsNotifBtn) {
    qsNotifBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("notif")) closeQsPanel("notif", { focusBtn: true });
      else openQsPanel("notif", { focusFirst: true });
    });
  }

  if (qsProfileBtn) {
    qsProfileBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("profile")) closeProfilePanel({ focusProfileBtn: true });
      else openProfilePanel({ focusFirst: true });
    });
  }

  if (qsProfileCloseBtn) {
    qsProfileCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeProfilePanel({ focusProfileBtn: true });
    });
  }

  if (qsNotifCloseBtn) {
    qsNotifCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeQsPanel("notif", { focusBtn: true });
    });
  }

  if (qsQuestCloseBtn) {
    qsQuestCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeQsPanel("quest", { focusBtn: true });
    });
  }

  if (qsScheduleCloseBtn) {
    qsScheduleCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeQsPanel("schedule", { focusBtn: true });
    });
  }

  if (qsStudyCloseBtn) {
    qsStudyCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeQsPanel("study", { focusBtn: true });
    });
  }

  if (qsBattleCloseBtn) {
    qsBattleCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeQsPanel("battle", { focusBtn: true });
    });
  }

  if (qsNotesCloseBtn) {
    qsNotesCloseBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      closeQsPanel("notes", { focusBtn: true });
    });
  }

  if (qsProfileStatusToggle) {
    qsProfileStatusToggle.addEventListener("change", () => {
      const on = !!qsProfileStatusToggle.checked;
      safeLocalSet(LS_QS_PROFILE_STATUS, on ? "1" : "0");
    });
  }

  if (qsNotifToggle) {
    qsNotifToggle.addEventListener("change", () => {
      const on = !!qsNotifToggle.checked;
      safeLocalSet(scopedUserKey(LS_NOTIF_BASE), on ? "1" : "0");
      syncNotifUi();
      try {
        window.dispatchEvent(new Event(PREF_EVENT));
      } catch {
        // ignore
      }
    });
  }

  const navShortcut = (href) => {
    // Study focus room must be "full screen": no shortcuts that leave the page.
    try {
      const sub = document.body && document.body.dataset ? document.body.dataset.subview : "";
      if (sub === "study-room" && document.body && document.body.classList && document.body.classList.contains("study-strict")) return;
    } catch {
      // ignore
    }
    if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
    closeActiveQsPanel({ focusBtn: false });
    closeDrawer({ focusProfile: false, immediate: isMobileQs() });
    setTimeout(() => {
      try {
        const full = String(href || "").trim();
        if (full && typeof window.studiumRoutePush === "function") {
          window.studiumRoutePush(full);
          return;
        }
      } catch {
        // ignore
      }
      window.location.href = href;
    }, 120);
  };

  if (qsQuestBtn)
    qsQuestBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("quest")) closeQsPanel("quest", { focusBtn: true });
      else openQsPanel("quest", { focusFirst: true });
    });
  if (qsScheduleShortcutBtn)
    qsScheduleShortcutBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("schedule")) closeQsPanel("schedule", { focusBtn: true });
      else openQsPanel("schedule", { focusFirst: true });
    });
  if (qsStudyShortcutBtn)
    qsStudyShortcutBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("study")) closeQsPanel("study", { focusBtn: true });
      else openQsPanel("study", { focusFirst: true });
    });
  if (qsBattleBtn)
    qsBattleBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("battle")) closeQsPanel("battle", { focusBtn: true });
      else openQsPanel("battle", { focusFirst: true });
    });
  if (qsNotesBtn)
    qsNotesBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      if (isQsPanelOpen("notes")) closeQsPanel("notes", { focusBtn: true });
      else openQsPanel("notes", { focusFirst: true });
    });
  if (qsHomeBtn) qsHomeBtn.addEventListener("click", () => navShortcut("/dashboard"));

  if (qsSettingsBtn) qsSettingsBtn.addEventListener("click", () => navShortcut("/match"));

  if (qsProfileEditBtn) {
    qsProfileEditBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      setPendingFocus("match.account.profile");
      navShortcut("/match");
    });
  }

  if (qsProfileMoreBtn) {
    qsProfileMoreBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      setPendingFocus("match.account.profile");
      navShortcut("/match");
    });
  }

  if (qsNotifSettingsBtn) {
    qsNotifSettingsBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      setPendingFocus("match.account.notifications");
      navShortcut("/match");
    });
  }

  if (qsQuestOpenBtn) qsQuestOpenBtn.addEventListener("click", () => navShortcut("/quest"));
  if (qsScheduleOpenBtn) qsScheduleOpenBtn.addEventListener("click", () => navShortcut("/schedules"));
  if (qsStudyOpenBtn) qsStudyOpenBtn.addEventListener("click", () => navShortcut("/study"));
  if (qsBattleOpenBtn) qsBattleOpenBtn.addEventListener("click", () => navShortcut("/battle"));
  if (qsNotesOpenBtn) qsNotesOpenBtn.addEventListener("click", () => navShortcut("/notes"));
  if (qsBattleModeBtn) qsBattleModeBtn.addEventListener("click", () => navShortcut("/battle"));
  if (qsStudyStartBtn)
    qsStudyStartBtn.addEventListener("click", () => {
      try {
        const items = Array.from(document.querySelectorAll(".navItem"));
        const idx = items.findIndex((el) => el && el.dataset && el.dataset.page === "study");
        if (idx >= 0 && window.navApi && typeof window.navApi.focus === "function") {
          window.navApi.focus(idx);
          return;
        }
      } catch {
        // ignore
      }

      try {
        sessionStorage.setItem("studium:pending_nav_focus", "study");
      } catch {}
      navShortcut("/study");
    });

  if (qsQuestList) {
    qsQuestList.addEventListener("click", (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("[data-quest-id]") : null;
      if (!btn) return;
      const id = btn.getAttribute("data-quest-id") || "";
      if (!id) return;
      navShortcut(`/quest?quest=${encodeURIComponent(id)}&detail=1`);
    });
  }

  if (qsScheduleList) {
    qsScheduleList.addEventListener("click", (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("[data-schedule-day]") : null;
      if (!btn) return;
      const key = btn.getAttribute("data-schedule-day") || "";
      try {
        if (key) sessionStorage.setItem("studium:schedules_pending_day", key);
        sessionStorage.removeItem("studium:schedules_pending_filter");
      } catch {}
      setPendingFocus("schedules.agenda");
      navShortcut("/schedules");
    });
  }

  if (qsScheduleCalendarList) {
    qsScheduleCalendarList.addEventListener("click", (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("[data-schedule-filter]") : null;
      if (!btn) return;
      const filter = btn.getAttribute("data-schedule-filter") || "all";
      try {
        sessionStorage.setItem("studium:schedules_pending_day", fmtDayKey(new Date()));
        sessionStorage.setItem("studium:schedules_pending_filter", filter);
      } catch {}
      setPendingFocus("schedules.agenda");
      navShortcut("/schedules");
    });
  }

  const attachNotesJump = (root) => {
    if (!root) return;
    root.addEventListener("click", (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("[data-notes-jump]") : null;
      if (!btn) return;
      const noteId = btn.getAttribute && btn.getAttribute("data-note-id");
      if (noteId) {
        navShortcut(`/notes/new?fullscreen=1&note=${encodeURIComponent(noteId)}`);
        return;
      }
      navShortcut("/notes");
    });
  };
  attachNotesJump(qsNotesFolderList);
  attachNotesJump(qsNotesTagList);
  attachNotesJump(qsNotesAllList);
  attachNotesJump(qsNotesRecentList);

  if (qsBattleQuestList) {
    qsBattleQuestList.addEventListener("click", (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("[data-quest-id]") : null;
      if (!btn) return;
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      setPendingFocus("battle.questBased");
      navShortcut("/battle");
    });
  }

  try {
    window.addEventListener("studium:planner_updated", () => {
      if (isQsPanelOpen("quest")) syncQuestUi();
      if (isQsPanelOpen("schedule")) syncScheduleUi();
      if (isQsPanelOpen("battle")) syncBattleUi();
    });
    window.addEventListener("storage", () => {
      if (isQsPanelOpen("quest")) syncQuestUi();
      if (isQsPanelOpen("schedule")) syncScheduleUi();
      if (isQsPanelOpen("battle")) syncBattleUi();
    });
    window.addEventListener(PREF_EVENT, () => {
      syncNotifUi();
    });
  } catch {
    // ignore
  }

  const setProfileTab = (tab) => {
    if (!qsProfilePanel) return;
    const btns = Array.from(qsProfilePanel.querySelectorAll("[data-tab]"));
    btns.forEach((b) => b.setAttribute("aria-selected", b.getAttribute("data-tab") === tab ? "true" : "false"));

    const panes = Array.from(qsProfilePanel.querySelectorAll("[data-pane]"));
    panes.forEach((p) => {
      const on = p.getAttribute("data-pane") === tab;
      p.hidden = !on;
      p.setAttribute("aria-hidden", on ? "false" : "true");
      if (on) {
        try {
          p.scrollTop = 0;
        } catch {
          // ignore
        }
      }
    });
  };

  if (qsProfilePanel) {
    qsProfilePanel.addEventListener("click", (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("[data-tab]") : null;
      if (!btn) return;
      const tab = btn.getAttribute("data-tab") || "";
      if (!tab) return;
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      setProfileTab(tab);
    });
  }

  if (toggleMusicBtn) {
    toggleMusicBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      setMusicEnabled(!music.enabled);
    });
  }

  if (qsMusicPrevBtn) {
    qsMusicPrevBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      loadPlaylistOnce();
      applyTrack(music.index - 1, { autoplay: !qsMusicAudio?.paused });
    });
  }

  if (qsMusicNextBtn) {
    qsMusicNextBtn.addEventListener("click", () => {
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      loadPlaylistOnce();
      applyTrack(music.index + 1, { autoplay: !qsMusicAudio?.paused });
    });
  }

  if (qsMusicPlayBtn) {
    qsMusicPlayBtn.addEventListener("click", async () => {
      if (!muteAll && typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      setMusicEnabled(true);
      loadPlaylistOnce();
      if (!qsMusicAudio) return;
      await ensureMusicGraph();
      if (!qsMusicAudio.getAttribute("src")) applyTrack(music.index, { autoplay: false });
      applyMusicGain();
      try {
        if (qsMusicAudio.paused) {
          const p = qsMusicAudio.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } else qsMusicAudio.pause();
      } catch {
        // ignore
      }
      setPlayIcon(!qsMusicAudio.paused);
    });
  }

  if (qsMuteBtn) {
    qsMuteBtn.addEventListener("click", () => {
      const wasMuted = muteAll;
      muteAll = !muteAll;
      applyMuteAll({ persist: true });
      if (wasMuted && !muteAll && typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
    });
  }

  if (qsMusicVolume) {
    qsMusicVolume.addEventListener("input", () => {
      applyMusicVolume(qsMusicVolume.value);
    });
  }

  if (qsMusicAudio) {
    qsMusicAudio.addEventListener("play", () => setPlayIcon(true));
    qsMusicAudio.addEventListener("pause", () => setPlayIcon(false));
    qsMusicAudio.addEventListener("ended", () => {
      if (!music.enabled) return;
      loadPlaylistOnce();
      applyTrack(music.index + 1, { autoplay: true });
    });

    const syncSeekUi = () => {
      if (!qsMusicSeek) return;
      const d = qsMusicAudio.duration;
      if (!Number.isFinite(d) || d <= 0) {
        qsMusicSeek.disabled = true;
        qsMusicSeek.value = "0";
        return;
      }
      if (qsMusicSeek.dataset.scrubbing === "1") return;
      qsMusicSeek.disabled = false;
      const ratio = Math.max(0, Math.min(1, (qsMusicAudio.currentTime || 0) / d));
      qsMusicSeek.value = String(Math.round(ratio * 1000));
    };

    qsMusicAudio.addEventListener("loadedmetadata", syncSeekUi);
    qsMusicAudio.addEventListener("durationchange", syncSeekUi);
    qsMusicAudio.addEventListener("timeupdate", syncSeekUi);
    qsMusicAudio.addEventListener("emptied", syncSeekUi);
  }

  if (qsMusicSeek && qsMusicAudio) {
    const seekTo = () => {
      const d = qsMusicAudio.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const ratio = Math.max(0, Math.min(1, (Number(qsMusicSeek.value) || 0) / 1000));
      try {
        qsMusicAudio.currentTime = ratio * d;
      } catch {
        // ignore
      }
    };

    qsMusicSeek.addEventListener("pointerdown", () => {
      qsMusicSeek.dataset.scrubbing = "1";
    });
    qsMusicSeek.addEventListener("pointerup", () => {
      qsMusicSeek.dataset.scrubbing = "0";
    });
    qsMusicSeek.addEventListener("input", () => seekTo());
    qsMusicSeek.addEventListener("change", () => {
      seekTo();
      qsMusicSeek.dataset.scrubbing = "0";
    });
  }

  if (qsBrightness) {
    qsBrightness.addEventListener("input", () => {
      applyBrightness(qsBrightness.value);
      safeLocalSet(LS_BRIGHT, String(Math.round(Number(qsBrightness.value) || 0)));
    });
  }

  if (qsSfxVolume) {
    qsSfxVolume.addEventListener("input", () => {
      applySfxVolume(qsSfxVolume.value);
      safeLocalSet(LS_SFXVOL, String(Math.round(Number(qsSfxVolume.value) || 0)));
    });
  }

  // Initialize SFX volume once on load. Avoid changing it again on drawer open
  // so opening Quick Settings doesn't unexpectedly mute SFX.
  (() => {
    if (!qsSfxVolume) return;
    const saved = Number(safeLocalGet(LS_SFXVOL));
    const initial = Number.isFinite(saved) ? saved : Number(qsSfxVolume.value || 55);
    setSfxVolumeUi(initial);
    applySfxVolume(initial);
  })();

  if (qsFullscreen) {
    qsFullscreen.addEventListener("change", () => {
      const on = !!qsFullscreen.checked;
      applyFullscreenPref(on);
      try {
        if (on && typeof SFX?.ensureFullscreen === "function") SFX.ensureFullscreen();
        if (!on && typeof SFX?.exitFullscreen === "function") SFX.exitFullscreen();
      } catch {
        // ignore
      }
    });
  }

  if (qsWallpapers) {
    qsWallpapers.addEventListener("change", () => {
      applyWallpapers(!!qsWallpapers.checked);
    });
  }

  if (backToLandingBtn) {
    backToLandingBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      setTimeout(() => {
        try {
          if (document.fullscreenElement) {
            const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
            if (typeof fn === "function") {
              const p = fn.call(document);
              if (p && typeof p.catch === "function") p.catch(() => {});
            }
          }
        } catch {
          // ignore
        }
        window.location.href = "/";
      }, 110);
    });
  }

  const navAfterSfx = (href) => {
    if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
    setTimeout(() => {
      window.location.href = href;
    }, 110);
  };

  if (signInBtn) signInBtn.addEventListener("click", () => navAfterSfx("/sign-in"));
  if (registerBtn) registerBtn.addEventListener("click", () => navAfterSfx("/register"));
  if (signOutBtn) signOutBtn.addEventListener("click", () => navAfterSfx("/sign-out"));

  if (userBtn) {
    userBtn.addEventListener("click", openDrawer);
    userBtn.addEventListener("focus", () => enterHeaderMode());
  }

  if (overlay)
    overlay.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      if (isAnyQsPanelOpen()) closeActiveQsPanel({ focusBtn: true });
      else closeDrawer({ focusProfile: true });
    });
  if (closeBtn)
    closeBtn.addEventListener("click", () => {
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      if (isAnyQsPanelOpen()) closeActiveQsPanel({ focusBtn: true });
      else closeDrawer({ focusProfile: true });
    });

  // Apply persisted audio mute immediately (so SFX/music match before opening the drawer).
  applyMuteAll({ persist: false });

  window.studiumViewInfoApi = {
    isOpen: isViewInfoOpen,
    close: () => hideViewInfo(),
  };

  const drawerFocusables = () => {
    const roots = [];
    if (drawer) roots.push(drawer);
    const activePanel = activeQsPanel ? qsPanels[activeQsPanel]?.panel : null;
    if (activePanel && !activePanel.hidden) roots.push(activePanel);

    const els = roots.flatMap((root) => Array.from(root.querySelectorAll("button,input,select,textarea,[tabindex='0']")));
    return els.filter((el) => {
      if (el.hasAttribute("disabled")) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.closest("[hidden]")) return false;
      if (el.closest('[aria-hidden=\"true\"]')) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
  };

  const moveDrawerFocus = (dir) => {
    const list = drawerFocusables();
    if (list.length === 0) return;

    const idx = Math.max(0, list.indexOf(document.activeElement));
    const next = (idx + dir + list.length) % list.length;
    try {
      list[next].focus({ preventScroll: true });
    } catch {
      list[next].focus();
    }
  };

  window.profileDrawerApi = {
    open: openDrawer,
    close: () => {
      if (isAnyQsPanelOpen()) {
        closeActiveQsPanel({ focusBtn: false });
        return;
      }
      closeDrawer({ focusProfile: true });
    },
    isOpen: () => document.body.classList.contains("drawer-open"),
    focusables: drawerFocusables,
  };

  window.qsPanelApi = {
    isOpen: () => document.body.classList.contains("qs-panel-open"),
    active: () => activeQsPanel,
    open: (name, opts) => openQsPanel(String(name || ""), opts),
    close: (opts) => closeActiveQsPanel(opts),
  };

  window.qsProfilePanelApi = {
    isOpen: () => isQsPanelOpen("profile"),
    open: openProfilePanel,
    close: closeProfilePanel,
  };

  window.studiumMusicApi = {
    isEnabled: () => !!music.enabled,
    toggleEnabled: () => setMusicEnabled(!music.enabled),
    playPause: async () => {
      setMusicEnabled(true);
      loadPlaylistOnce();
      if (!qsMusicAudio) return;
      await ensureMusicGraph();
      if (!qsMusicAudio.getAttribute("src")) applyTrack(music.index, { autoplay: false });
      applyMusicGain();
      try {
        if (qsMusicAudio.paused) {
          const p = qsMusicAudio.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } else qsMusicAudio.pause();
      } catch {
        // ignore
      }
      setPlayIcon(!qsMusicAudio.paused);
    },
  };
})();

(function initQuickSettingsHoldShortcut() {
  const HOLD_MS = 650;
  const host = document.getElementById("qsHoldHost");
  const pill = document.getElementById("qsHoldPill");
  const ring = document.getElementById("qsHoldRingPath");
  if (!host || !pill || !ring) return;

  const setVisible = (on) => {
    host.hidden = !on;
    try {
      document.body.classList.toggle("qs-hold-active", !!on);
      document.documentElement.style.setProperty("--qs-hold-duration", `${HOLD_MS}ms`);
    } catch {
      // ignore
    }
    if (!on) return;

    try {
      pill.style.setProperty("--qs-hold-duration", `${HOLD_MS}ms`);
    } catch {
      // ignore
    }

    // Restart ring animation.
    try {
      ring.style.animation = "none";
      ring.getBoundingClientRect();
      ring.style.animation = "";
    } catch {
      // ignore
    }
  };

  const canStart = () => {
    if (document.body.classList.contains("booting")) return false;
    if (document.body.classList.contains("drawer-open")) return false;
    if (document.body.classList.contains("qs-panel-open")) return false;
    if (typeof getZone === "function" && getZone() === "modal") return false;
    if (isTypingTarget(document.activeElement)) return false;
    return true;
  };

  const openDrawer = () => {
    try {
      if (window.profileDrawerApi?.open) return void window.profileDrawerApi.open();
    } catch {
      // ignore
    }
    try {
      const btn = document.getElementById("userMenuBtn");
      if (btn) btn.click();
    } catch {
      // ignore
    }
  };

  let holding = false;
  let t = null;

  const cancel = () => {
    holding = false;
    if (t) clearTimeout(t);
    t = null;
    setVisible(false);
  };

  const start = () => {
    if (holding) return;
    if (!canStart()) return;
    holding = true;
    setVisible(true);
    t = setTimeout(() => {
      cancel();
      openDrawer();
    }, HOLD_MS);
  };

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.repeat) return;
      const key = String(e.key || "").toLowerCase();
      if (key !== "m") return;
      start();
    },
    true
  );

  document.addEventListener(
    "keyup",
    (e) => {
      const key = String(e.key || "").toLowerCase();
      if (key !== "m") return;
      cancel();
    },
    true
  );

  window.addEventListener("blur", cancel, { passive: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) cancel();
    },
    { passive: true }
  );
})();

(function initArenaDock() {
  const dock = document.getElementById("arenaDock");
  if (!dock) return;
  const pauseBtn = document.getElementById("arenaPauseBtn");
  const musicBtn = document.getElementById("arenaMusicBtn");
  const surrenderBtn = document.getElementById("arenaSurrenderBtn");
  const quitBtn = document.getElementById("arenaQuitBtn");

  const isArena = () => document.body && document.body.dataset && document.body.dataset.subview === "battle-arena";

  const call = (fn) => {
    try {
      const api = window.arenaApi;
      if (!api || typeof api[fn] !== "function") return false;
      api[fn]();
      return true;
    } catch {
      return false;
    }
  };

  if (pauseBtn)
    pauseBtn.addEventListener("click", () => {
      if (!isArena()) return;
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      call("togglePause");
    });

  if (surrenderBtn)
    surrenderBtn.addEventListener("click", () => {
      if (!isArena()) return;
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      call("requestSurrender");
    });

  if (musicBtn)
    musicBtn.addEventListener("click", () => {
      if (!isArena()) return;
      if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
      try {
        if (window.studiumMusicApi?.playPause) window.studiumMusicApi.playPause();
        else if (window.studiumMusicApi?.toggleEnabled) window.studiumMusicApi.toggleEnabled();
      } catch {
        // ignore
      }
    });

  if (quitBtn)
    quitBtn.addEventListener("click", (e) => {
      if (!isArena()) return;
      // In arena, always confirm exit (handled by React modal).
      e.preventDefault();
      e.stopPropagation();
      if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
      call("requestExitConfirm");
    });
})();

(function initArenaEscapeConfirm() {
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key;
      if (key !== "Escape" && key !== "Esc") return;
      if (!document.body || document.body.dataset.subview !== "battle-arena") return;

      // Let modal/drawer close handlers work first.
      if (document.body.classList.contains("drawer-open")) return;
      if (document.body.classList.contains("modal-open")) return;
      if (isTypingTarget(document.activeElement)) return;

      e.preventDefault();
      e.stopPropagation();
      try {
        window.arenaApi?.requestExitConfirm?.();
      } catch {
        // ignore
      }
    },
    true
  );
})();

(function initNavbar() {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;
  let items = Array.from(carousel.querySelectorAll(".navItem"));
  if (items.length === 0) return;

  const safeLocalGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const safeLocalSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // ignore
    }
  };

  const LS_NAV_ORDER = "studium:nav_order";
  const DEFAULT_ORDER = ["dashboard", "notes", "quest", "schedules", "study", "battle", "match"];

  const refreshItems = () => {
    items = Array.from(carousel.querySelectorAll(".navItem"));
  };

  const applyNavOrder = (order, { persist = false } = {}) => {
    if (!Array.isArray(order) || order.length === 0) return;

    const byPage = new Map();
    items.forEach((el) => {
      const p = el?.dataset?.page;
      if (p) byPage.set(p, el);
    });

    const out = [];
    order.forEach((page) => {
      const el = byPage.get(page);
      if (!el) return;
      out.push(el);
      byPage.delete(page);
    });

    // Append remaining in current DOM order.
    items.forEach((el) => {
      const p = el?.dataset?.page;
      if (p && byPage.has(p)) out.push(el);
    });

    out.forEach((el) => carousel.appendChild(el));
    refreshItems();
    if (persist) safeLocalSet(LS_NAV_ORDER, JSON.stringify(items.map((x) => x.dataset.page).filter(Boolean)));
  };

  try {
    const raw = safeLocalGet(LS_NAV_ORDER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const migrated = parsed
          .map((x) => (x === "guild" ? "battle" : x))
          .filter((x, idx, arr) => arr.indexOf(x) === idx);
        applyNavOrder(migrated, { persist: false });
        if (migrated.join("|") !== parsed.join("|")) safeLocalSet(LS_NAV_ORDER, JSON.stringify(migrated));
      }
    }
  } catch {
    // ignore
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const safeFocus = (el) => {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  };

  const ensureCarouselVisible = (el, { behavior = "smooth" } = {}) => {
    if (!el || !carousel) return;
    try {
      const c = carousel.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const pad = 28;
      const isVisible = r.left >= c.left + pad && r.right <= c.right - pad;
      if (isVisible) return;
      el.scrollIntoView({ behavior, inline: "center", block: "nearest" });
    } catch {
      // ignore
    }
  };

  const initialView = document.body.dataset.view || "dashboard";
  let activeIndex = items.findIndex((i) => i.dataset.page === initialView);
  if (activeIndex < 0) activeIndex = 0;
  let focusedIndex = activeIndex;
  let lastSfxView = initialView;

  function setFocused(nextIndex, { focus = true, scroll = true } = {}) {
    focusedIndex = clamp(nextIndex, 0, items.length - 1);

    setMode("nav");

    items.forEach((i) => i.classList.remove("focused"));
    const el = items[focusedIndex];
    el.classList.add("focused");

    if (scroll) ensureCarouselVisible(el, { behavior: "smooth" });
    if (focus) safeFocus(el);
  }

  function setActive(nextIndex, { navigate = true } = {}) {
    activeIndex = clamp(nextIndex, 0, items.length - 1);

    items.forEach((i) => {
      i.classList.remove("active");
      i.setAttribute("aria-selected", "false");
    });

    const el = items[activeIndex];
    el.classList.add("active");
    el.setAttribute("aria-selected", "true");

    const pageName = el.dataset.page;
    if (pageName) setView(pageName);
    if (pageName && typeof window.applyViewTint === "function") window.applyViewTint(pageName);

    if (!document.body.classList.contains("booting") && pageName && lastSfxView && pageName !== lastSfxView) {
      SFX.playSwitch();
    }
    if (pageName) lastSfxView = pageName;

    const label = el.querySelector("span")?.textContent?.trim();
    if (label) document.title = `Studium \u2014 ${label}`;

    const viewInfo = document.getElementById("viewInfo");
    if (viewInfo) {
      viewInfo.classList.remove("viewInfo--show");
      viewInfo.hidden = true;
    }

    if (pageName && typeof window.setWallpaperForView === "function") window.setWallpaperForView(pageName);

    if (navigate && pageName) {
      if (typeof window.studiumRoutePush === "function") window.studiumRoutePush(pageName);
      else window.location.assign(`/${pageName}`);
    }
  }

  function switchRelative(dir, { preserveMode = true } = {}) {
    if (document.body.classList.contains("booting")) return;
    if (navSwitchLocked()) return;
    const nextIndex = clamp(activeIndex + dir, 0, items.length - 1);
    if (nextIndex === activeIndex) return;

    // Keep keyboard index in sync even if we don't focus the navbar.
    focusedIndex = nextIndex;

    // Update active + route.
    setActive(nextIndex, { navigate: true });

    // If user is in grid mode (nav minimized), preserve the mode and don't steal focus.
    if (preserveMode && document.body.classList.contains("grid-mode")) {
      items.forEach((i) => i.classList.remove("focused"));
      items[nextIndex].classList.add("focused");
      ensureCarouselVisible(items[nextIndex], { behavior: "smooth" });
      return;
    }

    // Default behavior: focus the navbar item.
    setMode("nav");
    setFocused(nextIndex, { focus: true, scroll: true });
  }

  window.navApi = {
    focus: (idx) => {
      if (navSwitchLocked()) return;
      setMode("nav");
      setFocused(idx, { focus: true, scroll: true });
      setActive(focusedIndex, { navigate: true });
    },
    move: (dir) => {
      if (navSwitchLocked()) return;
      setMode("nav");
      setFocused(focusedIndex + dir, { focus: true, scroll: true });
      setActive(focusedIndex, { navigate: true });
    },
    switchRelative,
    focusCurrent: () => setFocused(focusedIndex ?? activeIndex, { focus: true, scroll: true }),
    getOrder: () => items.map((x) => x?.dataset?.page).filter(Boolean),
    setOrder: (order) => {
      applyNavOrder(order, { persist: true });
      const view = getView();
      activeIndex = items.findIndex((i) => i?.dataset?.page === view);
      if (activeIndex < 0) activeIndex = 0;
      focusedIndex = activeIndex;
      setActive(activeIndex, { navigate: false });
      setFocused(activeIndex, { focus: false, scroll: true });
    },
    resetOrder: () => {
      try {
        localStorage.removeItem(LS_NAV_ORDER);
      } catch {
        // ignore
      }
      applyNavOrder(DEFAULT_ORDER, { persist: false });
      const view = getView();
      activeIndex = items.findIndex((i) => i?.dataset?.page === view);
      if (activeIndex < 0) activeIndex = 0;
      focusedIndex = activeIndex;
      setActive(activeIndex, { navigate: false });
      setFocused(activeIndex, { focus: false, scroll: true });
    },
  };

  items.forEach((item) => {
    item.addEventListener("click", () => {
      if (document.body.classList.contains("booting")) return;
      const idx = items.indexOf(item);
      if (idx < 0) return;
      const pageName = item.dataset.page || "";
      if (pageName === "quest") setNavLock(650);
      setMode("nav");
      setFocused(idx, { focus: true, scroll: true });
      setActive(idx, { navigate: true });
    });
    item.addEventListener("focus", () => {
      const idx = items.indexOf(item);
      if (idx < 0) return;
      setFocused(idx, { focus: false, scroll: true });
    });
  });

  carousel.addEventListener(
    "wheel",
    (e) => {
      if (document.body.classList.contains("booting")) return;
      if (navSwitchLocked()) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 2 && Math.abs(e.deltaX) < 2) return;
      e.preventDefault();

      const dir = e.deltaY !== 0 ? Math.sign(e.deltaY) : Math.sign(e.deltaX);
      setFocused(focusedIndex + dir, { focus: true, scroll: true });
      setActive(focusedIndex, { navigate: true });
    },
    { passive: false }
  );

  // Keyboard navigation is handled by initKeyboardRouterV2().

  window.clearNavFocus = () => items.forEach((i) => i.classList.remove("focused"));
  window.focusNavMenu = () => {
    if (document.body.classList.contains("booting")) return;
    setFocused(focusedIndex ?? activeIndex, { focus: true, scroll: true });
  };

  setActive(activeIndex, { navigate: false });
  setFocused(activeIndex, { focus: false, scroll: true });
})();

(function initContentBindings() {
  const enterContentMode = () => {
    if (getView() === "quest" && navLockActive()) return;
    setMode("grid");
    if (typeof window.clearNavFocus === "function") window.clearNavFocus();
  };

  const lastByView = Object.create(null);

  const isFocusable = (el) => {
    if (!el) return false;
    if (el.hasAttribute("disabled")) return false;
    if (el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const gridItems = () => Array.from(document.querySelectorAll("#routeOutlet [data-focus]")).filter(isFocusable);

  const focusEl = (el) => {
    if (!el) return false;
    enterContentMode();
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    return true;
  };

  const focusByKey = (key) => {
    if (!key) return false;
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/"/g, '\\"');
    return focusEl(document.querySelector(`[data-focus="${esc}"]`));
  };

  const bindGrid = () => {
    gridItems().forEach((el) => {
      if (el.dataset.studiumBound === "grid") return;
      el.dataset.studiumBound = "grid";

      el.addEventListener("focus", () => {
        const view = getView();
        const key = el.getAttribute("data-focus") || "";
        if (view === "quest" && navLockActive()) {
          requestAnimationFrame(() => {
            try {
              window.setMode?.("nav");
              window.focusNavMenu?.();
            } catch {
              // ignore
            }
          });
          return;
        }
        lastByView[view] = key;
        enterContentMode();

        // Dashboard calendar widget: focusing the container should enter the controls.
        if (key === "dashboard.widget") {
          const target = el.querySelector?.('[data-focus="dashboard.widget.today"]');
          if (target) {
            requestAnimationFrame(() => {
              try {
                target.focus({ preventScroll: true });
              } catch {
                target.focus();
              }
            });
          }
        }
      });
      el.addEventListener("pointerdown", () => {
        clearNavLock();
        if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
        enterContentMode();
      });
    });
  };

  window.studiumGridApi = {
    list: gridItems,
    lastKey: (view) => lastByView[view || getView()] || "",
    setLastKey: (view, key) => {
      lastByView[view || getView()] = key || "";
    },
    focusByKey,
    focusFirst: () => focusEl(gridItems()[0]),
  };

  window.studiumReinitContent = () => bindGrid();
  bindGrid();

  // Guard: Next.js may move focus into newly-mounted route content on navigation.
  // When entering Quest, keep the navbar open/focused unless the user explicitly clicks the content.
  document.addEventListener(
    "focusin",
    (e) => {
      if (getView() !== "quest") return;
      if (!navLockActive()) return;
      const t = e.target;
      if (!t || typeof t !== "object") return;
      if (typeof t.closest !== "function") return;
      if (!t.closest("#routeOutlet")) return;
      requestAnimationFrame(() => {
        try {
          window.setMode?.("nav");
          window.focusNavMenu?.();
        } catch {
          // ignore
        }
      });
    },
    true
  );
})();

(function initKeyboardRouterHybrid() {
  const entryByView = {
    dashboard: "dashboard.streak",
    routine: "routine.now",
    quest: "quest.slot1",
    schedules: "schedules.agenda",
    notes: "notes.tab.all",
    study: "study.launcher",
    pomodoro: "pomodoro.timer",
    battle: "battle.lobby",
    guild: "battle.lobby",
    match: "match.system.nav",
  };

  const overrideByView = {
    battle: {
      "battle.stats:down": "battle.questBased",
      "battle.questBased:up": "battle.stats",

      "battle.stats:right": "battle.lobby",
      "battle.questBased:right": "battle.casual",

      "battle.lobby:up": "battle.stats",
      "battle.lobby:left": "battle.stats",
      "battle.lobby:down": "battle.casual",
      "battle.lobby:right": "battle.leaderboard",

      "battle.casual:up": "battle.lobby",
      "battle.casual:down": "battle.practice",
      "battle.casual:left": "battle.questBased",
      "battle.casual:right": "battle.leaderboard",

      "battle.practice:up": "battle.casual",
      "battle.practice:down": "battle.leaderboard",
      "battle.practice:left": "battle.questBased",
      "battle.practice:right": "battle.leaderboard",

      "battle.leaderboard:left": "battle.lobby",
      "battle.leaderboard:down": "battle.lb.scope.global",
    },
  };

  const focusEl = (el) => {
    if (!el) return false;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    return true;
  };

  const focusById = (id) => focusEl(document.getElementById(id));

  const focusByKey = (key) => {
    if (window.studiumGridApi?.focusByKey) return window.studiumGridApi.focusByKey(key);
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/"/g, '\\"');
    const el = document.querySelector(`[data-focus="${esc}"]`);
    if (!el) return false;
    return focusEl(el);
  };

  const focusNav = () => {
    setMode("nav");
    if (typeof window.focusNavMenu === "function") return window.focusNavMenu();
    return focusEl(document.querySelector(".navItem.active"));
  };

  const focusContentEntry = () => {
    if (getView() === "quest") clearNavLock();
    const view = getView();
    const key = entryByView[view];
    if (key && focusByKey(key)) return true;
    if (window.studiumGridApi?.focusFirst) return window.studiumGridApi.focusFirst();
    return false;
  };

  const navMove = (dir) => {
    if (window.navApi?.move) return window.navApi.move(dir);

    const items = Array.from(document.querySelectorAll(".navItem"));
    if (items.length === 0) return;
    let cur = items.findIndex((i) => i.classList.contains("focused"));
    if (cur < 0) cur = items.findIndex((i) => i.classList.contains("active"));
    if (cur < 0) cur = 0;
    const next = Math.max(0, Math.min(items.length - 1, cur + dir));
    items[next].click();
  };

  const getZone = () => {
    if (document.body.classList.contains("drawer-open")) return "drawer";
    if (document.body.classList.contains("qs-panel-open")) return "drawer";
    if (document.body.classList.contains("modal-open")) return "modal";
    const ae = document.activeElement;
    if (ae?.closest?.(".studiumModal")) return "modal";
    if (ae?.closest?.("#profileDrawer")) return "drawer";
    if (ae?.closest?.(".qsPanel")) return "drawer";
    if (ae?.id === "userMenuBtn" || ae?.id === "viewLabel") return "header";
    if (ae?.closest?.("#routeOutlet") && (ae?.getAttribute?.("data-focus") || ae?.classList?.contains("gridCard") || ae?.closest?.(".gridCard")))
      return "grid";
    return "nav";
  };

  const drawerMove = (dir) => {
    const api = window.profileDrawerApi;
    const focusables = api?.focusables?.() || [];
    if (focusables.length === 0) return;
    const idx = focusables.indexOf(document.activeElement);
    const cur = idx >= 0 ? idx : 0;
    const next = (cur + dir + focusables.length) % focusables.length;
    focusEl(focusables[next]);
  };

  const modalFocusables = () => {
    const root = document.querySelector("#routeOutlet .studiumModal");
    if (!root) return [];
    const nodes = Array.from(
      root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    return nodes.filter(isVisible);
  };

  const modalMove = (dir) => {
    const focusables = modalFocusables();
    if (focusables.length === 0) return;
    const idx = focusables.indexOf(document.activeElement);
    const cur = idx >= 0 ? idx : 0;
    const next = (cur + dir + focusables.length) % focusables.length;
    focusEl(focusables[next]);
  };

  const isVisible = (el) => {
    if (!el) return false;
    if (el.hasAttribute("disabled")) return false;
    if (el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const centerOf = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

  const overlap1d = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

  const NOTES_COL_SEL =
    '[aria-label="Folders column"],[aria-label="Tags column"],[aria-label="All notes column"],[aria-label="Preview column"],[aria-label="Notes sidebar"],[aria-label="Notes list"],[aria-label="Note preview"]';

  const notesColOf = (el) => {
    if (!el || typeof el.closest !== "function") return null;
    return el.closest(NOTES_COL_SEL);
  };

  const notesColOrder = () => {
    const outlet = document.getElementById("routeOutlet");
    if (!outlet) return [];

    const editor = [
      outlet.querySelector('[aria-label="Notes sidebar"]'),
      outlet.querySelector('[aria-label="Notes list"]'),
      outlet.querySelector('[aria-label="Note preview"]'),
    ].filter(Boolean);
    if (editor.length >= 2) return editor;

    return [
      outlet.querySelector('[aria-label="Folders column"]'),
      outlet.querySelector('[aria-label="Tags column"]'),
      outlet.querySelector('[aria-label="All notes column"]'),
      outlet.querySelector('[aria-label="Preview column"]'),
    ].filter(Boolean);
  };

  const closestByY = (candidates, y) => {
    let best = null;
    let bestDist = Infinity;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const d = Math.abs(cy - y);
      if (d < bestDist) {
        bestDist = d;
        best = el;
      }
    }
    return best;
  };

  let gridRectCache = null;
  let gridCacheTimer = null;
  let lastXMemory = null;

  const invalidateGridCache = () => { gridRectCache = null; };
  window.addEventListener('resize', invalidateGridCache);

  const getCachedRects = (candidates) => {
    if (gridRectCache && gridRectCache.length === candidates.length) return gridRectCache;
    gridRectCache = candidates.map(el => ({ el, rect: el.getBoundingClientRect(), center: centerOf(el.getBoundingClientRect()) }));
    return gridRectCache;
  };

  const spatialNext = (current, dir, candidates) => {
    if (!current) return null;
    if (gridCacheTimer) clearTimeout(gridCacheTimer);
    gridCacheTimer = setTimeout(invalidateGridCache, 500);

    const curRect = current.getBoundingClientRect();
    const cur = centerOf(curRect);

    if (dir === 'up' || dir === 'down') {
      if (lastXMemory === null) lastXMemory = cur.x;
    } else {
      lastXMemory = null;
    }

    const targetX = lastXMemory !== null ? lastXMemory : cur.x;
    let best = null;
    let bestScore = Infinity;
    const items = getCachedRects(candidates);

    for (const item of items) {
      const el = item.el;
      if (!el || el === current) continue;
      const r = item.rect;
      const c = item.center;
      
      const dx = c.x - cur.x;
      const dy = c.y - cur.y;

      if (dir === 'left' && dx >= -6) continue;
      if (dir === 'right' && dx <= 6) continue;
      if (dir === 'up' && dy >= -6) continue;
      if (dir === 'down' && dy <= 6) continue;

      const primary = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
      const secondaryRaw = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(c.x - targetX);
      const secondary = secondaryRaw;

      let score = primary * primary + secondary * secondary * 2.2;

      const overlap = dir === 'left' || dir === 'right'
          ? overlap1d(curRect.top, curRect.bottom, r.top, r.bottom)
          : overlap1d(curRect.left, curRect.right, r.left, r.right);
      if (overlap > 0) score *= 0.62;

      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  };

  const gridCandidatesAll = () =>
    (window.studiumGridApi?.list ? window.studiumGridApi.list() : Array.from(document.querySelectorAll("#routeOutlet [data-focus]"))).filter(isVisible);

  const gridCandidateSets = () => {
    const all = gridCandidatesAll();
    const battleLeaderboard = document.getElementById("battle-leaderboard");
    const widget = document.getElementById("grid-widget");
    const ae = document.activeElement;

    if (battleLeaderboard && ae && battleLeaderboard.contains(ae)) {
      const scoped = all.filter((el) => battleLeaderboard.contains(el));
      return { primary: scoped.length ? scoped : all, fallback: all };
    }

    if (widget && ae && widget.contains(ae)) {
      const scoped = all.filter((el) => widget.contains(el));
      return { primary: scoped.length ? scoped : all, fallback: all };
    }
    return { primary: all, fallback: all };
  };

  const applyRovingTabindex = (activeEl) => {
    const all = gridCandidatesAll();
    for (const el of all) { if (el === activeEl) { el.setAttribute('tabindex', '0'); } else { el.setAttribute('tabindex', '-1'); } }
  };

  const ensureVisibleSmooth = (el) => {
    if (!el) return;
    try {
      if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch {
      // ignore
    }
    const r = el.getBoundingClientRect();
    const pad = 120;
    const vh = window.innerHeight;
    if (r.top < pad) { if (window.scrollBy) window.scrollBy({ top: r.top - pad, behavior: 'smooth' }); }
    else if (r.bottom > vh - pad) { if (window.scrollBy) window.scrollBy({ top: r.bottom - vh + pad, behavior: 'smooth' }); }
  };

  const moveInGrid = (dir) => {
    const view = getView();
    const curRaw = document.activeElement;
    const curHasKey = !!curRaw?.getAttribute?.("data-focus") || !!curRaw?.classList?.contains?.("gridCard");
    const cur = curHasKey ? curRaw : curRaw?.closest?.(".gridCard") || curRaw;
    const fromKey = cur?.getAttribute?.('data-focus') || curRaw?.getAttribute?.('data-focus') || '';

    // Battle leaderboard: allow exiting to the main battle grid even though we scope
    // navigation to elements inside the leaderboard card when it contains focus.
    if (view === "battle" && typeof fromKey === "string" && fromKey.startsWith("battle.lb.")) {
      if (dir === "left") {
        const moved = focusByKey("battle.lobby");
        if (moved) {
          if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
          applyRovingTabindex(document.activeElement);
          ensureVisibleSmooth(document.activeElement);
        }
        return moved;
      }
      if (dir === "up") {
        const moved = focusByKey("battle.leaderboard");
        if (moved) {
          if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
          applyRovingTabindex(document.activeElement);
          ensureVisibleSmooth(document.activeElement);
        }
        return moved;
      }
    }

    const override = overrideByView?.[view]?.[fromKey + ':' + dir];
    
    if (override) {
      const moved = focusByKey(override);
      if (moved) {
        if (typeof SFX?.playGridMove === 'function') SFX.playGridMove();
        applyRovingTabindex(document.activeElement);
        ensureVisibleSmooth(document.activeElement);
      }
      return moved;
    }

    const { primary, fallback } = gridCandidateSets();

    // Notes: constrain up/down within the current column, and make left/right switch columns.
    if (view === "notes") {
      const curEl = cur || curRaw;
      const curCol = notesColOf(curEl);
      if (curCol && (dir === "left" || dir === "right")) {
        const cols = notesColOrder();
        const idx = cols.indexOf(curCol);
        const nextCol = cols[idx + (dir === "right" ? 1 : -1)];
        if (nextCol) {
          const cy = centerOf(curEl.getBoundingClientRect()).y;
          const pool = gridCandidatesAll().filter((el) => nextCol.contains(el));
          const best = closestByY(pool, cy) || pool[0] || null;
          if (best) {
            const moved = focusEl(best);
            if (moved) {
              if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
              applyRovingTabindex(best);
              ensureVisibleSmooth(best);
            }
            return moved;
          }
        }
      }

      if (curCol && (dir === "up" || dir === "down")) {
        const scopedPrimary = primary.filter((el) => curCol.contains(el));
        const scopedFallback = fallback.filter((el) => curCol.contains(el));
        const next = spatialNext(cur, dir, scopedPrimary.length ? scopedPrimary : primary) || (fallback !== primary ? spatialNext(cur, dir, scopedFallback.length ? scopedFallback : fallback) : null);
        if (!next) {
          if (dir === "up" || dir === "down") lastXMemory = null;
          return false;
        }
        const moved = focusEl(next);
        if (moved) {
          if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
          applyRovingTabindex(next);
          ensureVisibleSmooth(next);
        }
        return moved;
      }
    }

    const next = spatialNext(cur, dir, primary) || (fallback !== primary ? spatialNext(cur, dir, fallback) : null);
    if (!next) {
       if (dir === 'up' || dir === 'down') lastXMemory = null;
       return false;
    }
    
    const moved = focusEl(next);
    if (moved) {
      if (typeof SFX?.playGridMove === 'function') SFX.playGridMove();
      applyRovingTabindex(next);
      ensureVisibleSmooth(next);
    }
    return moved;
  };

  const focusHeaderFromGrid = () => {
    const cur = document.activeElement;
    const rect = cur?.getBoundingClientRect?.();
    const useProfile = rect ? rect.left + rect.width / 2 < window.innerWidth * 0.5 : true;
    if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
    setMode("grid");
    if (typeof window.clearNavFocus === "function") window.clearNavFocus();
    if (useProfile) focusById("userMenuBtn");
    else focusById("viewLabel");
  };

  document.addEventListener(
    "keydown",
    (e) => {
      if (document.body.classList.contains("booting")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const key = e.key;
      const isArrow = key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown" || key === "Escape";
      if (!isArrow) return;

      const zone = getZone();
      const ae = document.activeElement;
      const typing = isTypingTarget(ae);

      // Notes preview: allow up/down arrows to scroll the content instead of navigating focus.
      if (!typing && (key === "ArrowUp" || key === "ArrowDown") && ae?.closest?.(".notesPreviewBody")) return;

      // Don't steal arrow keys from typing targets (let caret/value navigation work).
      // Escape is still handled for closing modals/drawers.
      if (typing && key !== "Escape") return;

      // Modal
      if (zone === "modal") {
        // Let native widgets keep their arrow-key behavior.
        if (key !== "Escape") {
          const tag = ae?.tagName ? String(ae.tagName).toLowerCase() : "";
          const type = tag === "input" ? String(ae.getAttribute?.("type") || "text").toLowerCase() : "";
          const valueControl =
            tag === "select" ||
            (tag === "input" && (type === "time" || type === "date" || type === "datetime-local" || type === "number" || type === "month" || type === "week"));

          // Keep up/down for changing values, but allow left/right to keep navigating between controls.
          if (valueControl && (key === "ArrowUp" || key === "ArrowDown")) return;
        }

        e.preventDefault();
        e.stopPropagation();

        const isRange =
          ae?.tagName &&
          String(ae.tagName).toLowerCase() === "input" &&
          String(ae.getAttribute("type") || "").toLowerCase() === "range";
        if (isRange && (key === "ArrowLeft" || key === "ArrowRight")) {
          const input = ae;
          const min = Number(input.min || 0);
          const max = Number(input.max || 100);
          const step = Number(input.step || 1);
          const cur = Number(input.value || 0);
          const next = Math.max(min, Math.min(max, cur + (key === "ArrowRight" ? step : -step)));
          input.value = String(next);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }

        if (key === "Escape") {
          if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
          window.studiumModalApi?.close?.();
          return;
        }

        if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
        if (key === "ArrowDown" || key === "ArrowRight") modalMove(1);
        else if (key === "ArrowUp" || key === "ArrowLeft") modalMove(-1);
        return;
      }

      // Drawer
      if (zone === "drawer") {
        // Let native widgets keep their arrow-key behavior.
        if (key !== "Escape") {
          const tag = ae?.tagName ? String(ae.tagName).toLowerCase() : "";
          const type = tag === "input" ? String(ae.getAttribute?.("type") || "text").toLowerCase() : "";
          const valueControl =
            tag === "select" ||
            (tag === "input" && (type === "time" || type === "date" || type === "datetime-local" || type === "number" || type === "month" || type === "week"));

          if (valueControl && (key === "ArrowUp" || key === "ArrowDown")) return;
        }

        e.preventDefault();
        e.stopPropagation();

        const isRange = ae?.tagName && String(ae.tagName).toLowerCase() === "input" && String(ae.getAttribute("type") || "").toLowerCase() === "range";
        if (isRange && (key === "ArrowLeft" || key === "ArrowRight")) {
          const input = ae;
          const min = Number(input.min || 0);
          const max = Number(input.max || 100);
          const step = Number(input.step || 1);
          const cur = Number(input.value || 0);
          const next = Math.max(min, Math.min(max, cur + (key === "ArrowRight" ? step : -step)));
          input.value = String(next);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }

        if (key === "Escape") {
          if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
          if (window.qsPanelApi?.isOpen?.()) {
            window.qsPanelApi.close?.({ focusBtn: true });
            return;
          }
          if (window.qsProfilePanelApi?.isOpen?.()) {
            window.qsProfilePanelApi.close?.({ focusProfileBtn: true });
            return;
          }
          window.profileDrawerApi?.close?.();
          focusById("userMenuBtn");
          return;
        }

        if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
        if (key === "ArrowDown" || key === "ArrowRight") drawerMove(1);
        else if (key === "ArrowUp" || key === "ArrowLeft") drawerMove(-1);
        return;
      }

      // Header
      if (zone === "header") {
        e.preventDefault();
        e.stopPropagation();

        if (key === "Escape") {
          if (document.body.classList.contains("quest-detail") && window.questDetailApi?.back) {
            if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
            try {
              window.questDetailApi.back();
            } catch {}
            return;
          }
          if (window.studiumViewInfoApi?.isOpen?.()) {
            if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
            window.studiumViewInfoApi?.close?.();
            focusById("userMenuBtn");
            return;
          }

          if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
          focusNav();
          return;
        }

        if (key === "ArrowDown") {
          if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
          focusContentEntry();
          return;
        }

        if (key === "ArrowLeft" || key === "ArrowRight") {
          if (typeof SFX?.playHeaderMove === "function") SFX.playHeaderMove();
          const cur = document.activeElement?.id;
          if (cur === "userMenuBtn") focusById("viewLabel");
          else focusById("userMenuBtn");
          return;
        }

        return;
      }

      // Grid (any view)
      if (zone === "grid") {
        // Let native widgets keep up/down arrows for changing values,
        // but keep left/right for spatial navigation.
        if (key !== "Escape") {
          const tag = ae?.tagName ? String(ae.tagName).toLowerCase() : "";
          const type = tag === "input" ? String(ae.getAttribute?.("type") || "text").toLowerCase() : "";
          const valueControl =
            tag === "select" ||
            (tag === "input" && (type === "time" || type === "date" || type === "datetime-local" || type === "number" || type === "month" || type === "week"));
          if (valueControl && (key === "ArrowUp" || key === "ArrowDown")) return;
        }

        // Activate focused grid item (Enter/Space). Our grid-mode handler
        // prevents defaults for navigation keys, which would otherwise block
        // native button/link activation.
        if ((key === "Enter" || key === " ") && !isTypingTarget(ae)) {
          e.preventDefault();
          e.stopPropagation();

          const clickTarget =
            ae?.closest?.('button, a[href], [role="button"], [role="link"], input[type="checkbox"], input[type="radio"]') || ae;
          try {
            clickTarget?.click?.();
          } catch {}
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (key === "Escape") {
          if (document.body.classList.contains("quest-detail") && window.questDetailApi?.back) {
            if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
            try {
              window.questDetailApi.back();
            } catch {}
            return;
          }
          if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
          focusNav();
          return;
        }

        if (key === "ArrowDown") {
          const moved = moveInGrid("down");
          if (!moved) {
            if (getView() === "notes") return;
            if (document.body.classList.contains("quest-detail")) return;
            if (document.body && document.body.dataset && document.body.dataset.subview === "battle-arena") return;
            if (typeof SFX?.playSwitch === "function") SFX.playSwitch();
            focusNav();
          }
          return;
        }

        if (key === "ArrowUp") {
          const moved = moveInGrid("up");
          if (!moved) {
            if (getView() === "notes") return;
            focusHeaderFromGrid();
          }
          return;
        }
        if (key === "ArrowLeft") return void moveInGrid("left");
        if (key === "ArrowRight") return void moveInGrid("right");
        return;
      }

      // Nav (default)
      if (zone === "nav") {
        if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
        } else {
          return;
        }

        if (key === "ArrowLeft") navMove(-1);
        else if (key === "ArrowRight") navMove(1);
        else if (key === "ArrowUp") {
          if (typeof SFX?.playGridMove === "function") SFX.playGridMove();
          focusContentEntry();
        }
      }
    },
    true
  );
})();

(function initSwipeNav() {
  const root = document.documentElement;
  if (!root) return;

  const shouldIgnoreTarget = (target) => {
    if (target?.isContentEditable) return true;
    const el = target?.closest?.(
      "#carousel, .navbar, #profileDrawer, #profileOverlay, .drawer, .drawerOverlay"
    );
    if (el) return true;

    const t = target?.tagName ? String(target.tagName).toLowerCase() : "";
    if (t === "input" || t === "textarea" || t === "select") return true;
    if (target?.closest?.('input[type="range"]')) return true;
    return false;
  };

  const EDGE_PX = 22;
  const EDGE_SWIPE_DX = 86;

  let tracking = false;
  let gesture = null; // "nav" | "qs_edge"
  let sx = 0;
  let sy = 0;
  let st = 0;

  const reset = () => {
    tracking = false;
    gesture = null;
    sx = 0;
    sy = 0;
    st = 0;
  };

  root.addEventListener(
    "touchstart",
    (e) => {
      if (document.body.classList.contains("booting")) return;
      if (document.body.classList.contains("drawer-open")) return;
      if (navSwitchLocked()) return;
      if (e.touches.length !== 1) return;
      if (shouldIgnoreTarget(e.target)) return;

      const t = e.touches[0];
      const isArena = document.body?.dataset?.subview === "battle-arena";
      const edge = t.clientX <= EDGE_PX;
      if (isArena && !edge) return;

      tracking = true;
      gesture = isArena ? "qs_edge" : "nav";
      sx = t.clientX;
      sy = t.clientY;
      st = Date.now();
    },
    { passive: true }
  );

  root.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      if (e.changedTouches.length !== 1) return reset();

      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const dt = Date.now() - st;
      const g = gesture;
      reset();

      // Horizontal swipe only (avoid vertical scroll).
      if (Math.abs(dx) < 60) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dt > 900) return; // too slow: likely scroll/drag

      // Battle Arena: left-edge swipe opens Quick Settings.
      if (g === "qs_edge") {
        if (dx < EDGE_SWIPE_DX) return;
        if (document.body.classList.contains("drawer-open")) return;
        try {
          if (window.profileDrawerApi?.open) window.profileDrawerApi.open();
          else document.getElementById("userMenuBtn")?.click?.();
        } catch {
          // ignore
        }
        return;
      }

      if (navSwitchLocked()) return;

      const dir = dx < 0 ? 1 : -1; // swipe left -> next
      const preserveMode = document.body.classList.contains("grid-mode");

      if (window.navApi?.switchRelative) {
        window.navApi.switchRelative(dir, { preserveMode });
        return;
      }

      if (window.navApi?.move) {
        // Fallback: this will enter nav mode.
        window.navApi.move(dir);
      }
    },
    { passive: true }
  );

  root.addEventListener("touchcancel", reset, { passive: true });
})();
