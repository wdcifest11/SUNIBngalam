"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Resource = {
  id: string;
  title: string;
  url: string;
  tags: string[];
  createdAt: number;
};

type Store = {
  v: 1;
  resources: Resource[];
};

const LS_KEY = "studium:study_resources:v1";

function now() {
  return Date.now();
}

function makeId() {
  return Math.random().toString(16).slice(2) + "-" + now().toString(16);
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getScopedKey(base: string) {
  if (typeof document === "undefined") return base;
  const fromBody = document.body?.dataset?.userId || "";
  const fromRoot = document.querySelector<HTMLElement>(".shellRoot")?.dataset?.userId || "";
  const userId = String(fromBody || fromRoot || "").trim();
  return userId ? `${base}:u${userId}` : base;
}

function loadStore(): Store {
  const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(getScopedKey(LS_KEY));
  const parsed = safeJsonParse<Store>(raw);
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.resources)) return { v: 1, resources: [] };
  return {
    v: 1,
    resources: parsed.resources
      .map((r: any) => ({
        id: String(r?.id ?? ""),
        title: String(r?.title ?? "").trim(),
        url: String(r?.url ?? "").trim(),
        tags: Array.isArray(r?.tags) ? r.tags.map((t: any) => String(t ?? "").trim()).filter(Boolean).slice(0, 6) : [],
        createdAt: Number(r?.createdAt ?? 0) || 0,
      }))
      .filter((r) => r.id && r.url),
  };
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(getScopedKey(LS_KEY), JSON.stringify(store));
  } catch {
    // ignore
  }
}

function normalizeUrl(input: string) {
  const s = String(input || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`);
    return u.toString();
  } catch {
    return "";
  }
}

function splitTags(input: string) {
  return String(input || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export default function StudyResources() {
  const router = useRouter();
  const [store, setStore] = useState<Store>(() => loadStore());
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const list = useMemo(() => [...store.resources].sort((a, b) => b.createdAt - a.createdAt), [store.resources]);

  const isDirty = Boolean(title.trim() || url.trim() || tags.trim());

  function back() {
    if (isDirty) {
      setConfirmLeave(true);
      return;
    }
    router.push("/study");
  }

  function add() {
    setError(null);
    const cleanUrl = normalizeUrl(url);
    if (!cleanUrl) {
      setError("Please enter a valid URL.");
      return;
    }
    const cleanTitle = String(title || "").trim() || new URL(cleanUrl).hostname;
    const rec: Resource = { id: makeId(), title: cleanTitle, url: cleanUrl, tags: splitTags(tags), createdAt: now() };
    const next: Store = { v: 1, resources: [rec, ...store.resources].slice(0, 200) };
    setStore(next);
    saveStore(next);
    setTitle("");
    setUrl("");
    setTags("");
  }

  function remove(id: string) {
    const next: Store = { v: 1, resources: store.resources.filter((r) => r.id !== id) };
    setStore(next);
    saveStore(next);
  }

  return (
    <section className="studySupportShell" aria-label="Resource board">
      <div className="studySupportShell__top">
        <div>
          <div className="studySupportShell__title">Resource Board</div>
          <div className="studySupportShell__sub">Local-only links, files, and references for your study sessions.</div>
        </div>
        <button type="button" className="studySupportBack" onClick={back} aria-label="Back to Study Room">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back
        </button>
      </div>

      <div className="studySupportShell__panel" aria-label="Add resource">
        <div className="studySupportForm">
          <input className="studySupportInput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Title" />
          <input className="studySupportInput" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (required)" aria-label="URL" />
          <input className="studySupportInput" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" aria-label="Tags" />
          <button type="button" className="studySupportBtn" onClick={add} aria-label="Add resource">
            <i className="fa-solid fa-plus" aria-hidden="true" /> Add
          </button>
        </div>
        {error ? <div className="studySupportError">{error}</div> : null}
      </div>

      <div className="studySupportShell__panel" aria-label="Resources list">
        {list.length ? (
          <div className="studySupportList">
            {list.map((r) => (
              <div key={r.id} className="studySupportItem">
                <div className="studySupportItem__main">
                  <div className="studySupportItem__title">{r.title}</div>
                  <a className="studySupportItem__url" href={r.url} target="_blank" rel="noreferrer">
                    {r.url}
                  </a>
                  {r.tags.length ? (
                    <div className="studySupportTags" aria-label="Tags">
                      {r.tags.map((t) => (
                        <span key={t} className="studySupportTag">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button" className="studySupportIconBtn" onClick={() => remove(r.id)} aria-label="Remove resource" title="Remove">
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="studySupportEmpty">No resources yet. Add your first link above.</div>
        )}
      </div>

      {confirmLeave ? (
        <div className="studiumModal" role="dialog" aria-modal="true" aria-label="Leave Resource Board">
          <div className="studiumModalOverlay" onPointerDown={() => setConfirmLeave(false)} aria-hidden="true" />
          <div className="studiumModalPanel studiumModalPanel--danger" onPointerDown={(e) => e.stopPropagation()}>
            <div className="studiumModalTop">
              <div className="studiumModalTitleWrap">
                <div className="studiumModalKicker">DANGER ZONE</div>
                <div className="studiumModalTitle studiumModalTitle--danger">Leave this page?</div>
                <div className="studiumModalSubtitle">You have unsaved input. Are you sure you want to go back?</div>
              </div>
              <button type="button" className="studiumModalClose" onClick={() => setConfirmLeave(false)} aria-label="Close popup">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="studiumModalBody">
              <div className="studyFocusRoom__modalActions" aria-label="Modal actions">
                <button type="button" className="studyFocusRoom__modalBtn" onClick={() => setConfirmLeave(false)}>
                  Stay
                </button>
                <button
                  type="button"
                  className="studyFocusRoom__modalBtn studyFocusRoom__modalBtn--danger"
                  onClick={() => router.push("/study")}
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
