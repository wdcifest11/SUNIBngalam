"use client";

import { useEffect, useMemo, useState } from "react";
import BattleLeaderboard from "./battle-leaderboard";
import DashboardCalendarWidget from "./dashboard-calendar-widget";
import styles from "./dashboard-widgets-slider.module.css";

const LS_KEY = "studium:dashboard_widget_slide:v1";

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

export default function DashboardWidgetsSlider() {
  const slides = useMemo(
    () => [
      { key: "calendar", label: "Calendar", node: <DashboardCalendarWidget /> },
      { key: "leaderboard", label: "Leaderboard", node: <div className={styles.slidePad}><BattleLeaderboard kicker={null} /></div> },
    ],
    [],
  );

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const saved = safeLocalGet(LS_KEY);
    if (!saved) return;
    const at = slides.findIndex((s) => s.key === saved);
    if (at >= 0) setIdx(at);
  }, [slides]);

  useEffect(() => {
    const key = slides[idx]?.key;
    if (key) safeLocalSet(LS_KEY, key);
  }, [idx, slides]);

  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx((i) => (i + 1) % slides.length);

  return (
    <div className={`${styles.wrap} dashWidgetsWrap`} id="grid-widget" aria-label="Widgets">
      <div className={styles.headerRow}>
        <div className={styles.headerLabel}>Widgets</div>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={prev}
            data-focus="dashboard.widget.nav.prev"
            aria-label="Previous widget"
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={next}
            data-focus="dashboard.widget.nav.next"
            aria-label="Next widget"
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section
        className={`gridContainerRightRight gridCard ${styles.card}`}
        data-focus="dashboard.widget"
        tabIndex={0}
        role="region"
        aria-label="Widgets panel"
      >
        <div className={styles.viewport}>
          <div className={styles.track} style={{ transform: `translateX(-${idx * 100}%)` }}>
            {slides.map((s) => (
              <div key={s.key} className={styles.slide} aria-label={s.label}>
                {s.node}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
