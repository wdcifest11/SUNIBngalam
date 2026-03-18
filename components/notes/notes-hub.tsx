"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { appData, hydrateSeedNotes } from "@/lib/app-data";

import styles from "./notes-hub.module.css";

type NotesView = "all" | "favorites" | "hidden" | "deleted";

type Note = {
  id: string;
  title: string;
  body: string;
  bodyFormat: "plain" | "html";
  tags: string[];
  folder: string | null;
  favorite: boolean;
  pinned: boolean;
  sortOrder: number;
  hiddenAt: number | null;
  reminderAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

type TagDef = { id: string; label: string; dotClass: string };
type FolderDef = { id: string; label: string };

type NotesStore = {
  notes: Note[];
  tagCatalog: TagDef[];
  folderCatalog: FolderDef[];
};

const TAG_DOT_PALETTE = ["notesDot--mint", "notesDot--aqua", "notesDot--violet", "notesDot--gold"];
const TAG_DOT_LABEL: Record<string, string> = {
  "notesDot--mint": "Mint",
  "notesDot--aqua": "Aqua",
  "notesDot--violet": "Violet",
  "notesDot--gold": "Gold",
};

const DEFAULT_TAGS: TagDef[] = appData.notes.defaults.tags as unknown as TagDef[];
const DEFAULT_FOLDERS: FolderDef[] = appData.notes.defaults.folders as unknown as FolderDef[];

function now() {
  return Date.now();
}

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `n_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
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

function storageKey() {
  return getScopedKey("studium:notes:v1");
}

function openTargetKey() {
  return getScopedKey("studium:notes:openNoteId:v1");
}

const OPEN_TARGET_KEY_FALLBACK = "studium:notes:openNoteId:v1";

function openTargetPayload(note: Note) {
  return JSON.stringify({
    id: note.id,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    title: note.title,
  });
}

function stripHtmlQuick(html: string) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeForPreview(html: string) {
  try {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((n) => n.remove());
    // Remove editor-only controls.
    doc.querySelectorAll("button, [role='button']").forEach((el) => {
      const cls = String(el.getAttribute("class") || "");
      const action = String(el.getAttribute("data-action") || "");
      if (cls.includes("notesAssetDelete") || action === "delete-asset") el.remove();
    });
    doc.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    // Strip src/href that could be unsafe; attachment src will be injected from IndexedDB via data-asset-id.
    doc.querySelectorAll("img,audio,video,source").forEach((el) => {
      el.removeAttribute("src");
    });
    doc.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((a) => {
        const name = a.name.toLowerCase();
        const value = String(a.value || "");
        if (name.startsWith("on")) el.removeAttribute(a.name);
        if (name === "href" && value.trim().toLowerCase().startsWith("javascript:")) el.removeAttribute(a.name);
      });
    });
    return doc.body.innerHTML;
  } catch {
    return String(html || "");
  }
}

type AssetKind = "image" | "audio";
type NoteAsset = {
  id: string;
  kind: AssetKind;
  mime: string;
  createdAt: number;
  blob: Blob;
};

function assetsDbName() {
  return getScopedKey("studium_notes_assets_v1");
}

function openAssetsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB not available"));
    const req = indexedDB.open(assetsDbName(), 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open DB"));
  });
}

async function getAsset(id: string) {
  const db = await openAssetsDb();
  const rec = await new Promise<NoteAsset | null>((resolve, reject) => {
    const tx = db.transaction("assets", "readonly");
    const req = tx.objectStore("assets").get(id);
    req.onsuccess = () => resolve((req.result as NoteAsset) || null);
    req.onerror = () => reject(req.error || new Error("Failed to read asset"));
  });
  db.close();
  return rec;
}

function parseAssetIds(body: string) {
  const re = /\[\[(image|audio):([a-zA-Z0-9_\-]+)\]\]/g;
  const ids = new Set<string>();
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(body))) ids.add(m[2]);
  const attrRe = /data-asset-id="([^"]+)"/g;
  while ((m = attrRe.exec(body))) ids.add(m[1]);
  return Array.from(ids);
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainBodyToPreviewHtml(body: string) {
  const re = /\[\[(image|audio):([a-zA-Z0-9_\-]+)\]\]/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(body))) {
    const idx = m.index;
    if (idx > last) out += escapeHtml(body.slice(last, idx)).replace(/\n/g, "<br/>");
    const kind = m[1];
    const id = m[2];
    if (kind === "image") {
      out += `<div class="notesAttachment notesAttachment--image"><img data-asset-id="${escapeHtml(id)}" alt="" /></div>`;
    } else {
      out += `<div class="notesAttachment notesAttachment--audio"><audio controls data-asset-id="${escapeHtml(id)}"></audio></div>`;
    }
    last = idx + m[0].length;
  }
  if (last < body.length) out += escapeHtml(body.slice(last)).replace(/\n/g, "<br/>");
  return out;
}

function loadStore(): NotesStore {
  const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey());
  const parsed = safeJsonParse<any>(raw);
  const tagCatalog: TagDef[] = Array.isArray(parsed?.tagCatalog) && parsed.tagCatalog.length ? parsed.tagCatalog : DEFAULT_TAGS;
  const folderCatalog: FolderDef[] = Array.isArray(parsed?.folderCatalog) && parsed.folderCatalog.length ? parsed.folderCatalog : DEFAULT_FOLDERS;
  let notes: Note[] = Array.isArray(parsed?.notes)
    ? parsed.notes.map((n: any) => ({
        id: String(n.id || ""),
        title: String(n.title || "Untitled"),
        body: String(n.body || ""),
        bodyFormat: n.bodyFormat === "html" ? "html" : "plain",
        tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
        folder: typeof n.folder === "string" ? n.folder : null,
        favorite: !!n.favorite,
        pinned: !!n.pinned,
        sortOrder: Number(n.sortOrder ?? n.order ?? n.updatedAt ?? now()),
        hiddenAt: n.hiddenAt ? Number(n.hiddenAt) : n.archivedAt ? Number(n.archivedAt) : null,
        reminderAt: n.reminderAt ? Number(n.reminderAt) : null,
        createdAt: Number(n.createdAt || now()),
        updatedAt: Number(n.updatedAt || now()),
        deletedAt: n.deletedAt ? Number(n.deletedAt) : null,
      }))
    : [];

  if (!notes.length) notes = hydrateSeedNotes(now()) as unknown as Note[];
  return { notes, tagCatalog, folderCatalog };
}

function formatRelative(ts: number) {
  const delta = Math.max(0, now() - ts);
  const min = Math.floor(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function NotesHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [store, setStore] = useState<NotesStore>(() => ({ notes: [], tagCatalog: DEFAULT_TAGS, folderCatalog: DEFAULT_FOLDERS }));
  const [view, setView] = useState<NotesView>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string>("");
  const [modal, setModal] = useState<
    null | "addFolder" | "addTag" | "deleteFolder" | "deleteTag" | "unlockHidden" | "restoreNote" | "permaDeleteNote"
  >(null);
  const [modalLabel, setModalLabel] = useState("");
  const [tagDotDraft, setTagDotDraft] = useState(TAG_DOT_PALETTE[0] || "notesDot--mint");
  const [deleteTarget, setDeleteTarget] = useState<null | { kind: "folder" | "tag"; id: string; label: string }>(null);
  const [hiddenPwd, setHiddenPwd] = useState("");
  const [hiddenPwdError, setHiddenPwdError] = useState("");
  const [noteActionTarget, setNoteActionTarget] = useState<null | { id: string; title: string }>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const previewRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    const qp = String(searchParams.get("view") || "").trim().toLowerCase();
    if (qp === "deleted") setView("deleted");
  }, [searchParams]);

  const persistStore = (next: NotesStore) => {
    setStore(next);
    try {
      const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey());
      const parsed = safeJsonParse<any>(raw) || {};
      const merged = { ...parsed, notes: next.notes, tagCatalog: next.tagCatalog, folderCatalog: next.folderCatalog };
      localStorage.setItem(storageKey(), JSON.stringify(merged));
    } catch {
      // ignore
    }
  };

  const sidebarItemClass = (active: boolean) =>
    ["notesSidebarItem", "gridCard", active ? "notesSidebarItem--active" : "", active ? styles.activeItem : ""].filter(Boolean).join(" ");
  const tagPillClass = (active: boolean) =>
    ["notesTagPill", "gridCard", active ? "notesTagPill--active" : "", active ? styles.activeItem : ""].filter(Boolean).join(" ");

  const tagLabelById = useMemo(() => Object.fromEntries(store.tagCatalog.map((t) => [t.id, t.label])), [store.tagCatalog]);
  const folderLabelById = useMemo(() => Object.fromEntries(store.folderCatalog.map((f) => [f.id, f.label])), [store.folderCatalog]);

  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    store.notes.forEach((n) => {
      if (n.deletedAt) return;
      if (n.hiddenAt) return;
      if (!n.folder) return;
      map[n.folder] = (map[n.folder] || 0) + 1;
    });
    return map;
  }, [store.notes]);

  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {};
    store.notes.forEach((n) => {
      if (n.deletedAt) return;
      if (n.hiddenAt) return;
      const tags = Array.isArray(n.tags) ? n.tags : [];
      tags.forEach((id) => {
        map[id] = (map[id] || 0) + 1;
      });
    });
    return map;
  }, [store.notes]);

  const tabCounts = useMemo(() => {
    const all = store.notes.filter((n) => !n.deletedAt && !n.hiddenAt).length;
    const favorites = store.notes.filter((n) => !n.deletedAt && !n.hiddenAt && n.favorite).length;
    const hidden = store.notes.filter((n) => !n.deletedAt && !!n.hiddenAt).length;
    const deleted = store.notes.filter((n) => !!n.deletedAt).length;
    return { all, favorites, hidden, deleted };
  }, [store.notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = store.notes.slice();

    if (view === "hidden") list = list.filter((n) => !n.deletedAt && !!n.hiddenAt);
    else if (view === "favorites") list = list.filter((n) => !n.deletedAt && !n.hiddenAt && n.favorite);
    else if (view === "deleted") list = list.filter((n) => !!n.deletedAt);
    else list = list.filter((n) => !n.deletedAt && !n.hiddenAt);

    // Tag/folder filters shouldn't affect Deleted.
    if (view !== "deleted") {
      if (folderFilter) list = list.filter((n) => n.folder === folderFilter);
      if (tagFilter) list = list.filter((n) => n.tags.includes(tagFilter));
    }

    if (q) {
      list = list.filter((n) => {
        const bodyText = n.bodyFormat === "html" ? stripHtmlQuick(n.body) : n.body;
        return (n.title + "\n" + bodyText).toLowerCase().includes(q);
      });
    }

    if (view === "deleted") {
      list.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
      return list;
    }

    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [folderFilter, search, store.notes, tagFilter, view]);

  const activeNote = useMemo(() => filteredNotes.find((n) => n.id === activeId) || filteredNotes[0] || null, [activeId, filteredNotes]);

  useEffect(() => {
    if (activeId) return;
    if (filteredNotes[0]) setActiveId(filteredNotes[0].id);
  }, [activeId, filteredNotes]);

  useEffect(() => {
    const inView = !!activeId && filteredNotes.some((n) => n.id === activeId);
    if (inView) return;
    if (filteredNotes[0]?.id) setActiveId(filteredNotes[0].id);
    else setActiveId("");
  }, [activeId, filteredNotes]);

  const previewHtml = useMemo(() => {
    if (!activeNote) return "";
    if (activeNote.bodyFormat === "html") return sanitizeForPreview(activeNote.body);
    const body = String(activeNote.body || "");
    if (body.includes("[[image:") || body.includes("[[audio:")) return plainBodyToPreviewHtml(body);
    return escapeHtml(body).replace(/\n/g, "<br/>");
  }, [activeNote]);

  useEffect(() => {
    const ids = activeNote ? parseAssetIds(activeNote.body || "") : [];
    if (!ids.length) {
      setAssetUrls((prev) => {
        Object.values(prev).forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {
            // ignore
          }
        });
        return {};
      });
      return;
    }

    let alive = true;
    const created: string[] = [];

    (async () => {
      const next: Record<string, string> = {};
      for (const id of ids) {
        try {
          const rec = await getAsset(id);
          if (!rec?.blob) continue;
          const url = URL.createObjectURL(rec.blob);
          created.push(url);
          next[id] = url;
        } catch {
          // ignore
        }
      }

      if (!alive) {
        created.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {
            // ignore
          }
        });
        return;
      }

      setAssetUrls((prev) => {
        Object.values(prev).forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {
            // ignore
          }
        });
        return next;
      });
    })();

    return () => {
      alive = false;
    };
  }, [activeNote?.body, activeNote?.id]);

  useEffect(() => {
    const root = previewRootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-asset-id]").forEach((el) => {
      const id = String(el.getAttribute("data-asset-id") || "").trim();
      if (!id) return;
      const url = assetUrls[id];
      if (!url) return;
      if (el.tagName === "IMG") (el as HTMLImageElement).src = url;
      if (el.tagName === "AUDIO") (el as HTMLAudioElement).src = url;
      if (el.tagName === "VIDEO") (el as HTMLVideoElement).src = url;
      if (el.tagName === "SOURCE") (el as HTMLSourceElement).src = url;
    });
  }, [assetUrls, activeNote?.id, previewHtml]);

  const addFolder = () => {
    setModalLabel("");
    setModal("addFolder");
  };

  const addTag = () => {
    setModalLabel("");
    setTagDotDraft(TAG_DOT_PALETTE[store.tagCatalog.length % TAG_DOT_PALETTE.length] || "notesDot--mint");
    setModal("addTag");
  };

  const createFolder = (rawLabel: string) => {
    const label = String(rawLabel || "").trim();
    if (!label) return false;
    const id = `f_${makeId()}`;
    const next: NotesStore = { ...store, folderCatalog: [...store.folderCatalog, { id, label }] };
    persistStore(next);
    return true;
  };

  const createTag = (rawLabel: string, dotClass: string) => {
    const label = String(rawLabel || "").trim();
    if (!label) return false;
    const id = `t_${makeId()}`;
    const safeDot = TAG_DOT_PALETTE.includes(dotClass) ? dotClass : TAG_DOT_PALETTE[0] || "notesDot--mint";
    const next: NotesStore = { ...store, tagCatalog: [...store.tagCatalog, { id, label, dotClass: safeDot }] };
    persistStore(next);
    return true;
  };

  const deleteFolder = (id: string) => {
    const found = store.folderCatalog.find((f) => f.id === id) || null;
    if (!found) return;
    setDeleteTarget({ kind: "folder", id: found.id, label: found.label });
    setModal("deleteFolder");
  };

  const confirmDeleteFolder = () => {
    if (!deleteTarget || deleteTarget.kind !== "folder") return;
    const id = deleteTarget.id;
    if (folderFilter === id) setFolderFilter(null);
    const next: NotesStore = {
      ...store,
      folderCatalog: store.folderCatalog.filter((f) => f.id !== id),
      notes: store.notes.map((n) => (n.folder === id ? { ...n, folder: null } : n)),
    };
    persistStore(next);
    setModal(null);
    setDeleteTarget(null);
  };

  const deleteTag = (id: string) => {
    const found = store.tagCatalog.find((t) => t.id === id) || null;
    if (!found) return;
    setDeleteTarget({ kind: "tag", id: found.id, label: found.label });
    setModal("deleteTag");
  };

  const confirmDeleteTag = () => {
    if (!deleteTarget || deleteTarget.kind !== "tag") return;
    const id = deleteTarget.id;
    if (tagFilter === id) setTagFilter(null);
    const next: NotesStore = {
      ...store,
      tagCatalog: store.tagCatalog.filter((t) => t.id !== id),
      notes: store.notes.map((n) => ({ ...n, tags: Array.isArray(n.tags) ? n.tags.filter((x) => x !== id) : [] })),
    };
    persistStore(next);
    setModal(null);
    setDeleteTarget(null);
  };

  const openHiddenView = () => {
    if (view === "hidden") return;
    setHiddenPwd("");
    setHiddenPwdError("");
    setModal("unlockHidden");
  };

  const confirmUnlockHidden = () => {
    const pwd = String(hiddenPwd || "");
    if (pwd !== "1111") {
      setHiddenPwdError("Wrong password. Try again.");
      return;
    }
    setModal(null);
    setHiddenPwdError("");
    setHiddenPwd("");
    setView("hidden");
  };

  const requestRestoreNote = () => {
    if (!activeNote) return;
    if (!activeNote.deletedAt) return;
    setNoteActionTarget({ id: activeNote.id, title: activeNote.title || "Untitled" });
    setModal("restoreNote");
  };

  const confirmRestoreNote = () => {
    if (!noteActionTarget) return;
    const id = noteActionTarget.id;
    const next: NotesStore = { ...store, notes: store.notes.map((n) => (n.id === id ? { ...n, deletedAt: null } : n)) };
    persistStore(next);
    if (activeId === id) setActiveId("");
    setModal(null);
    setNoteActionTarget(null);
  };

  const requestPermaDeleteNote = () => {
    if (!activeNote) return;
    if (!activeNote.deletedAt) return;
    setNoteActionTarget({ id: activeNote.id, title: activeNote.title || "Untitled" });
    setModal("permaDeleteNote");
  };

  const confirmPermaDeleteNote = () => {
    if (!noteActionTarget) return;
    const id = noteActionTarget.id;
    const next: NotesStore = { ...store, notes: store.notes.filter((n) => n.id !== id) };
    persistStore(next);
    if (activeId === id) setActiveId("");
    setModal(null);
    setNoteActionTarget(null);
  };

  return (
    <div className={styles.page} aria-label="Notes hub">
      <div className={styles.body} aria-label="Notes content">
        <div className={styles.col} aria-label="Folders column">
          <div className={styles.colHead} aria-label="Folders header">
            <div className={styles.colHeadTop}>
              <div className={styles.colTitle}>
                <div className={styles.cardTitle}>Folder</div>
              </div>
              <button
                type="button"
                data-focus="notes.folder.add"
                className={styles.outsideBtn}
                aria-label="Add folder"
                title="Add folder"
                onClick={addFolder}
              >
                Add Folder
              </button>
            </div>
          </div>

          <section className={styles.panel} aria-label="Folders">
            <div className={styles.catalog} role="list" aria-label="Folder list">
              {store.folderCatalog.map((f) => (
                <div key={f.id} className={styles.hoverRow}>
                  <button
                    type="button"
                    data-focus={`notes.folder.${f.id}`}
                    className={[sidebarItemClass(folderFilter === f.id), styles.hoverRowMain].filter(Boolean).join(" ")}
                    role="listitem"
                    data-folder-id={f.id}
                    onClick={() => setFolderFilter((prev) => (prev === f.id ? null : f.id))}
                    aria-label={`Folder ${f.label}`}
                    onFocus={(e) => {
                      try {
                        (e.currentTarget as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <i className="fa-solid fa-folder" aria-hidden="true" />
                    <span className="notesSidebarItem__label">{f.label}</span>
                    <span className="notesSidebarItem__count">{folderCounts[f.id] || 0}</span>
                  </button>
                  <div className={styles.hoverRowActions}>
                    <button
                      type="button"
                      className={["notesInlineIconBtn gridCard", styles.hoverRevealBtn].join(" ")}
                      aria-label={`Delete folder ${f.label}`}
                      title="Delete folder"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteFolder(f.id);
                      }}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.col} aria-label="Tags column">
          <div className={styles.colHead} aria-label="Tags header">
            <div className={styles.colHeadTop}>
              <div className={styles.colTitle}>
                <div className={styles.cardTitle}>Tags</div>
              </div>
              <button
                type="button"
                data-focus="notes.tag.add"
                className={styles.outsideBtn}
                aria-label="Add tag"
                title="Add tag"
                onClick={addTag}
              >
                Add tags
              </button>
            </div>
          </div>

          <section className={styles.panel} aria-label="Tags">
            <div className={styles.catalog} role="list" aria-label="Tag list">
              {store.tagCatalog.map((t) => (
                <div key={t.id} className={styles.hoverRow}>
                  <button
                    type="button"
                    data-focus={`notes.tag.${t.id}`}
                    className={[tagPillClass(tagFilter === t.id), styles.hoverRowMain].filter(Boolean).join(" ")}
                    role="listitem"
                    data-tag-id={t.id}
                    onClick={() => setTagFilter((prev) => (prev === t.id ? null : t.id))}
                    aria-label={`Tag ${t.label}`}
                    onFocus={(e) => {
                      try {
                        (e.currentTarget as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <span className={["notesDot", t.dotClass].filter(Boolean).join(" ")} aria-hidden="true" />
                    <span className="notesRowItem">{t.label}</span>
                    <span className="notesSidebarItem__count">{tagCounts[t.id] || 0}</span>
                  </button>
                  <div className={styles.hoverRowActions}>
                    <button
                      type="button"
                      className={["notesInlineIconBtn gridCard", styles.hoverRevealBtn].join(" ")}
                      aria-label={`Delete tag ${t.label}`}
                      title="Delete tag"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteTag(t.id);
                      }}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.col} aria-label="All notes column">
          <div className={styles.colHead} aria-label="All notes header">
            <div className={styles.colHeadTop}>
              <div className={styles.colTitle}>
                <div className={styles.cardTitle}>Notes</div>
              </div>
              <button
                type="button"
                data-focus="notes.note.add"
                className={styles.outsideBtn}
                aria-label="Add note"
                title="Add note"
                onClick={() => {
                  try {
                    sessionStorage.removeItem(openTargetKey());
                    sessionStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
                    localStorage.removeItem(openTargetKey());
                    localStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
                  } catch {
                    // ignore
                  }
                  router.push(`/notes/new?fullscreen=1&new=1&nonce=${Date.now()}`);
                }}
              >
                Add Note
              </button>
            </div>
          </div>

          <section className={styles.panel} aria-label="Notes list">
            <div className={styles.notesPanelHead} aria-label="Notes list header">
              <div className={styles.tabs} aria-label="All notes tabs" role="tablist">
                <button
                  type="button"
                  data-focus="notes.tab.all"
                  className={[styles.tabBtn, view === "all" ? styles.tabBtnActive : ""].filter(Boolean).join(" ")}
                  onClick={() => setView("all")}
                  role="tab"
                  aria-selected={view === "all"}
                  aria-label="All notes"
                >
                  <span className={styles.tabLabel}>
                    <i className="fa-solid fa-layer-group" aria-hidden="true" />
                    <span>All</span>
                  </span>
                  <span className={styles.tabCount} aria-label={`${tabCounts.all} note(s)`}>
                    {tabCounts.all}
                  </span>
                </button>
                <button
                  type="button"
                  data-focus="notes.tab.favorites"
                  className={[styles.tabBtn, view === "favorites" ? styles.tabBtnActive : ""].filter(Boolean).join(" ")}
                  onClick={() => setView("favorites")}
                  role="tab"
                  aria-selected={view === "favorites"}
                  aria-label="Favorite notes"
                >
                  <span className={styles.tabLabel}>
                    <i className="fa-solid fa-star" aria-hidden="true" />
                    <span>Favorite</span>
                  </span>
                  <span className={styles.tabCount} aria-label={`${tabCounts.favorites} favorite note(s)`}>
                    {tabCounts.favorites}
                  </span>
                </button>
                <button
                  type="button"
                  data-focus="notes.tab.hidden"
                  className={[styles.tabBtn, view === "hidden" ? styles.tabBtnActive : ""].filter(Boolean).join(" ")}
                  onClick={openHiddenView}
                  role="tab"
                  aria-selected={view === "hidden"}
                  aria-label="Hidden notes"
                >
                  <span className={styles.tabLabel}>
                    <i className="fa-solid fa-eye-slash" aria-hidden="true" />
                    <span>Hidden</span>
                  </span>
                  <span className={styles.tabCount} aria-label="Hidden notes count is hidden">
                    {"\u2022"}
                  </span>
                </button>
                <button
                  type="button"
                  data-focus="notes.tab.deleted"
                  className={[styles.tabBtn, view === "deleted" ? styles.tabBtnActive : ""].filter(Boolean).join(" ")}
                  onClick={() => setView("deleted")}
                  role="tab"
                  aria-selected={view === "deleted"}
                  aria-label="Recently deleted"
                >
                  <span className={styles.tabLabel}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                    <span>Recently deleted</span>
                  </span>
                  <span className={styles.tabCount} aria-label={`${tabCounts.deleted} deleted note(s)`}>
                    {tabCounts.deleted}
                  </span>
                </button>
              </div>

              <div className="notesSearchWrap">
                <i className="fa-solid fa-magnifying-glass text-white/55" aria-hidden="true" />
                <input
                  className="notesSearchInput"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes..."
                  aria-label="Search notes"
                />
              </div>
            </div>

            <div className={styles.notesPanelBody}>
              <div className={styles.list} role="list" aria-label="Notes list items">
                {filteredNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    data-focus={`notes.note.${n.id}`}
                    className={["notesListItem", "gridCard", styles.noteItem, activeNote?.id === n.id ? "notesListItem--active" : ""].filter(Boolean).join(" ")}
                    role="listitem"
                    onClick={() => setActiveId(n.id)}
                    onFocus={(e) => {
                      setActiveId(n.id);
                      try {
                        (e.currentTarget as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <div className="notesListItem__title">{n.title || "Untitled"}</div>
                    <div className="notesListItem__excerpt">
                      {(() => {
                        const bodyText = n.bodyFormat === "html" ? stripHtmlQuick(n.body) : n.body;
                        return bodyText.trim() ? bodyText.trim().slice(0, 120) : "Start typing to capture your thoughts...";
                      })()}
                    </div>
                    <div className="notesListItem__meta">
                      {n.pinned ? "Pinned | " : ""}
                      {formatRelative(n.updatedAt)}
                      {n.hiddenAt ? " | Hidden" : ""}
                      {n.favorite ? " | Favorite" : ""}
                      {n.folder ? ` | ${folderLabelById[n.folder] || n.folder}` : ""}
                      {n.tags.length ? ` | ${n.tags.map((id) => tagLabelById[id] || id).join(", ")}` : ""}
                    </div>
                  </button>
                ))}
                {filteredNotes.length === 0 ? <div className="notesEmptyState">No notes match your filters.</div> : null}
              </div>
            </div>
          </section>
        </div>

        <div className={styles.col} aria-label="Preview column">
          <div className={styles.colHead} aria-label="Preview header">
            <div className={styles.colHeadTop}>
              <div className={styles.colTitle}>
                <div className={styles.cardTitle}>Preview</div>
              </div>
              {view === "deleted" ? (
                <div className={styles.headRight} aria-label="Deleted actions">
                  <button
                    type="button"
                    className={styles.outsideBtn}
                    aria-label="Restore note"
                    title="Restore"
                    disabled={!activeNote?.id}
                    onClick={requestRestoreNote}
                  >
                    <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                    Restore
                  </button>
                  <button
                    type="button"
                    className={[styles.outsideBtn, styles.outsideBtnDanger].join(" ")}
                    aria-label="Delete note permanently"
                    title="Delete permanently"
                    disabled={!activeNote?.id}
                    onClick={requestPermaDeleteNote}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-focus="notes.preview.open"
                  className={styles.outsideBtn}
                  aria-label="Open editor"
                  title="Open editor"
                  disabled={!activeNote?.id}
                  onClick={() => {
                    if (!activeNote?.id) return;
                    const href = `/notes/new?fullscreen=1&note=${encodeURIComponent(activeNote.id)}`;
                    try {
                      const payload = openTargetPayload(activeNote);
                      sessionStorage.setItem(openTargetKey(), payload);
                      sessionStorage.setItem(OPEN_TARGET_KEY_FALLBACK, payload);
                      localStorage.setItem(openTargetKey(), payload);
                      localStorage.setItem(OPEN_TARGET_KEY_FALLBACK, payload);
                    } catch {
                      // ignore
                    }
                    router.push(href);
                  }}
                >
                  <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                  Open
                </button>
              )}
            </div>
          </div>

          <section className={styles.panel} aria-label="Selected note">
            <div className={styles.cardSub}>{activeNote ? formatRelative(activeNote.updatedAt) : "Pick a note from the list."}</div>

            <div className={styles.selected} aria-label="Selected note preview">
              {activeNote ? (
                <div className={styles.selectedInner} aria-label="Selected note details">
                  <div className={styles.selectedTitle}>{activeNote.title || "Untitled"}</div>
                  <div
                    className="notesPreviewBody notesPreviewBody--html"
                    ref={previewRootRef}
                    aria-label="Selected note content"
                    dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="notesPreviewEmpty">No content yet.</span>' }}
                  />
                </div>
              ) : (
                <div className="notesEmptyPreview">Select a note from the list.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {modal ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={(() => {
            if (modal === "addFolder") return "Add folder";
            if (modal === "addTag") return "Add tag";
            if (modal === "deleteFolder") return "Delete folder";
            if (modal === "deleteTag") return "Delete tag";
            if (modal === "unlockHidden") return "Unlock Hidden notes";
            if (modal === "restoreNote") return "Restore note";
            return "Delete note permanently";
          })()}
          onClick={() => {
            setModal(null);
            setDeleteTarget(null);
            setHiddenPwd("");
            setHiddenPwdError("");
            setNoteActionTarget(null);
          }}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {modal === "addFolder" || modal === "addTag" ? (
              <>
                <div className={styles.modalTitle}>{modal === "addFolder" ? "Add folder" : "Add tag"}</div>
                <div className={styles.modalSub}>
                  {modal === "addFolder" ? "Create a folder to organize notes." : "Create a tag to label notes."}
                </div>

                <input
                  autoFocus
                  className={styles.modalInput}
                  value={modalLabel}
                  onChange={(e) => setModalLabel(e.target.value)}
                  placeholder={modal === "addFolder" ? "Folder name" : "Tag name"}
                  aria-label={modal === "addFolder" ? "Folder name" : "Tag name"}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setModal(null);
                      return;
                    }
                    if (e.key !== "Enter") return;
                    if (modal === "addFolder") {
                      if (createFolder(modalLabel)) setModal(null);
                    } else {
                      if (createTag(modalLabel, tagDotDraft)) setModal(null);
                    }
                  }}
                />

                {modal === "addTag" ? (
                  <div className={styles.dotPicker} aria-label="Pick tag color">
                    {TAG_DOT_PALETTE.map((dot) => {
                      const label = TAG_DOT_LABEL[dot] || dot;
                      return (
                        <button
                          key={dot}
                          type="button"
                          className={[styles.dotBtn, tagDotDraft === dot ? styles.dotBtnActive : ""].filter(Boolean).join(" ")}
                          aria-label={`Pick ${label}`}
                          onClick={() => setTagDotDraft(dot)}
                        >
                          <span className={["notesDot", dot].filter(Boolean).join(" ")} aria-hidden="true" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalBtn}
                    onClick={() => {
                      setModal(null);
                      setDeleteTarget(null);
                    }}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={[styles.modalBtn, styles.modalBtnPrimary].join(" ")}
                    onClick={() => {
                      if (modal === "addFolder") {
                        if (createFolder(modalLabel)) setModal(null);
                      } else {
                        if (createTag(modalLabel, tagDotDraft)) setModal(null);
                      }
                    }}
                    aria-label={modal === "addFolder" ? "Create folder" : "Create tag"}
                    disabled={!modalLabel.trim()}
                  >
                    Create
                  </button>
                </div>
              </>
            ) : modal === "deleteFolder" || modal === "deleteTag" ? (
              <>
                <div className={styles.modalTitle}>{modal === "deleteFolder" ? "Delete folder" : "Delete tag"}</div>
                <div className={styles.modalSub}>
                  {deleteTarget
                    ? modal === "deleteFolder"
                      ? `“${deleteTarget.label}” • ${folderCounts[deleteTarget.id] || 0} note(s)`
                      : `“${deleteTarget.label}” • ${tagCounts[deleteTarget.id] || 0} note(s)`
                    : "Nothing selected."}
                </div>
                <div className={styles.modalSub}>
                  {modal === "deleteFolder"
                    ? "Notes in this folder will be moved to no folder."
                    : "This will remove the tag from all notes."}
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalBtn}
                    onClick={() => {
                      setModal(null);
                      setDeleteTarget(null);
                    }}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={[styles.modalBtn, styles.modalBtnDanger].join(" ")}
                    onClick={() => {
                      if (modal === "deleteFolder") confirmDeleteFolder();
                      else confirmDeleteTag();
                    }}
                    aria-label="Confirm delete"
                    disabled={!deleteTarget}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : modal === "unlockHidden" ? (
              <>
                <div className={styles.modalTitle}>Hidden notes</div>
                <div className={styles.modalSub}>Enter password to open Hidden notes.</div>

                <input
                  autoFocus
                  className={styles.modalInput}
                  value={hiddenPwd}
                  onChange={(e) => {
                    setHiddenPwd(e.target.value);
                    if (hiddenPwdError) setHiddenPwdError("");
                  }}
                  placeholder="Password"
                  aria-label="Hidden notes password"
                  type="password"
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setModal(null);
                      setHiddenPwd("");
                      setHiddenPwdError("");
                      return;
                    }
                    if (e.key === "Enter") confirmUnlockHidden();
                  }}
                />
                {hiddenPwdError ? <div className={styles.modalError}>{hiddenPwdError}</div> : null}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalBtn}
                    onClick={() => {
                      setModal(null);
                      setHiddenPwd("");
                      setHiddenPwdError("");
                    }}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={[styles.modalBtn, styles.modalBtnPrimary].join(" ")}
                    onClick={confirmUnlockHidden}
                    aria-label="Unlock Hidden notes"
                    disabled={!hiddenPwd.trim()}
                  >
                    Unlock
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modalTitle}>{modal === "restoreNote" ? "Restore note" : "Delete permanently"}</div>
                <div className={styles.modalSub}>
                  {noteActionTarget ? `“${noteActionTarget.title || "Untitled"}”` : "Nothing selected."}
                </div>
                <div className={styles.modalSub}>
                  {modal === "restoreNote"
                    ? "This will restore the note back to your notes list."
                    : "This will permanently delete the note. This action cannot be undone."}
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalBtn}
                    onClick={() => {
                      setModal(null);
                      setNoteActionTarget(null);
                    }}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={[styles.modalBtn, modal === "restoreNote" ? styles.modalBtnPrimary : styles.modalBtnDanger].join(" ")}
                    onClick={() => {
                      if (modal === "restoreNote") confirmRestoreNote();
                      else confirmPermaDeleteNote();
                    }}
                    aria-label="Confirm"
                    disabled={!noteActionTarget}
                  >
                    {modal === "restoreNote" ? "Restore" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
