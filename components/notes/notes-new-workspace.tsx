"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { appData, hydrateSeedNotes } from "@/lib/app-data";

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
  archivedAt: number | null; // legacy: migrated into hiddenAt
  deletedAt: number | null;
};

type TagDef = { id: string; label: string; dotClass: string };
type FolderDef = { id: string; label: string };

type NotesStore = {
  notes: Note[];
  lastDraftId: string | null;
  tagCatalog: TagDef[];
  folderCatalog: FolderDef[];
};

type AssetKind = "image" | "audio";
type NoteAsset = {
  id: string;
  kind: AssetKind;
  mime: string;
  createdAt: number;
  blob: Blob;
};

const DEFAULT_TAGS: TagDef[] = appData.notes.defaults.tags as unknown as TagDef[];
const DEFAULT_FOLDERS: FolderDef[] = appData.notes.defaults.folders as unknown as FolderDef[];

const TAG_DOT_PALETTE = ["notesDot--mint", "notesDot--aqua", "notesDot--violet", "notesDot--gold"];

function now() {
  return Date.now();
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
const TEMPLATE_DRAFT_KEY = "studium:notes:template_draft:v1";

function hiddenUnlockKey() {
  return getScopedKey("studium:notes:hiddenUnlocked:v1");
}

function autoSaveKey() {
  return getScopedKey("studium:notes:autoSave:v1");
}

function templateDraftKey() {
  return getScopedKey(TEMPLATE_DRAFT_KEY);
}

function isNotesNewPathname(pathname: string) {
  return /\/notes\/new\/?$/.test(String(pathname || ""));
}

type OpenTarget = {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  title?: string;
};

function parseOpenTarget(raw: string): OpenTarget {
  const s = String(raw || "").trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s) as any;
    if (v && typeof v === "object") {
      return {
        id: typeof v.id === "string" ? v.id : undefined,
        createdAt: Number.isFinite(Number(v.createdAt)) ? Number(v.createdAt) : undefined,
        updatedAt: Number.isFinite(Number(v.updatedAt)) ? Number(v.updatedAt) : undefined,
        title: typeof v.title === "string" ? v.title : undefined,
      };
    }
  } catch {
    // ignore
  }
  // Back-compat: previously stored as a plain note id string.
  return { id: s };
}

function noteMatchesOpenTarget(n: Note, t: OpenTarget): boolean {
  if (!t) return false;
  if (t.id && n.id === t.id) return true;
  if (typeof t.createdAt === "number" && n.createdAt === t.createdAt) return true;
  if (typeof t.updatedAt === "number" && t.title && n.updatedAt === t.updatedAt && (n.title || "") === t.title) return true;
  return false;
}

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

async function putAsset(kind: AssetKind, blob: Blob, mime: string) {
  const id = makeId();
  const rec: NoteAsset = { id, kind, blob, mime: mime || blob.type || "application/octet-stream", createdAt: now() };
  const db = await openAssetsDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to write asset"));
    tx.objectStore("assets").put(rec);
  });
  db.close();
  return id;
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

async function deleteAsset(id: string) {
  const db = await openAssetsDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to delete asset"));
    tx.objectStore("assets").delete(id);
  });
  db.close();
}

function normalizeNotesRefs(tagCatalog: TagDef[], folderCatalog: FolderDef[], notes: Note[]) {
  const safeTags = Array.isArray(tagCatalog) ? tagCatalog : [];
  const safeFolders = Array.isArray(folderCatalog) ? folderCatalog : [];

  const tagIdSet = new Set(safeTags.map((t) => String(t.id)));
  const tagIdByLabel = new Map(safeTags.map((t) => [String(t.label || "").trim().toLowerCase(), String(t.id)]));
  const folderIdSet = new Set(safeFolders.map((f) => String(f.id)));
  const folderIdByLabel = new Map(safeFolders.map((f) => [String(f.label || "").trim().toLowerCase(), String(f.id)]));

  return notes.map((n) => {
    const nextSortOrder =
      typeof (n as any).sortOrder === "number"
        ? (n as any).sortOrder
        : typeof (n as any).order === "number"
          ? (n as any).order
          : typeof n.updatedAt === "number"
            ? n.updatedAt
            : now();

    const nextTags = Array.from(
      new Set(
        (n.tags || [])
          .map((x) => String(x || "").trim())
          .map((x) => (tagIdSet.has(x) ? x : tagIdByLabel.get(x.toLowerCase()) || ""))
          .filter(Boolean)
      )
    );

    const folderRaw = typeof n.folder === "string" ? n.folder.trim() : "";
    const nextFolder = folderRaw ? (folderIdSet.has(folderRaw) ? folderRaw : folderIdByLabel.get(folderRaw.toLowerCase()) || null) : null;

    const sameTags = Array.isArray(n.tags) && n.tags.length === nextTags.length && n.tags.every((t, i) => t === nextTags[i]);
    const sameFolder = (n.folder || null) === nextFolder;
    const sameOrder = typeof (n as any).sortOrder === "number" && (n as any).sortOrder === nextSortOrder;
    return sameTags && sameFolder && sameOrder ? n : { ...n, tags: nextTags, folder: nextFolder, sortOrder: nextSortOrder };
  });
}

function loadStore(): NotesStore {
  const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey());
  const parsed = safeJsonParse<any>(raw);
  if (parsed?.notes?.length) {
    const tagCatalog: TagDef[] = Array.isArray(parsed.tagCatalog) && parsed.tagCatalog.length ? parsed.tagCatalog : DEFAULT_TAGS;
    const folderCatalog: FolderDef[] = Array.isArray(parsed.folderCatalog) && parsed.folderCatalog.length ? parsed.folderCatalog : DEFAULT_FOLDERS;
    const notes: Note[] = (parsed.notes as any[]).map((n) => ({
      id: String(n.id || makeId()),
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
      archivedAt: n.archivedAt ? Number(n.archivedAt) : null,
      deletedAt: n.deletedAt ? Number(n.deletedAt) : null,
    }));

    return {
      notes: normalizeNotesRefs(tagCatalog, folderCatalog, notes),
      lastDraftId: typeof parsed.lastDraftId === "string" ? parsed.lastDraftId : null,
      tagCatalog,
      folderCatalog,
    };
  }

  const t = now();
  const seed = hydrateSeedNotes(t) as unknown as Note[];
  return { notes: seed, lastDraftId: null, tagCatalog: DEFAULT_TAGS, folderCatalog: DEFAULT_FOLDERS };
}

function tryLoadStoreFromKey(key: string): NotesStore | null {
  if (typeof localStorage === "undefined") return null;
  const parsed = safeJsonParse<any>(localStorage.getItem(key));
  if (!parsed?.notes?.length) return null;

  const tagCatalog: TagDef[] = Array.isArray(parsed.tagCatalog) && parsed.tagCatalog.length ? parsed.tagCatalog : DEFAULT_TAGS;
  const folderCatalog: FolderDef[] = Array.isArray(parsed.folderCatalog) && parsed.folderCatalog.length ? parsed.folderCatalog : DEFAULT_FOLDERS;
  const notes: Note[] = Array.isArray(parsed.notes)
    ? (parsed.notes as any[]).map((n) => ({
        id: String(n.id || makeId()),
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
        archivedAt: n.archivedAt ? Number(n.archivedAt) : null,
        deletedAt: n.deletedAt ? Number(n.deletedAt) : null,
      }))
    : [];
  if (!notes.length) return null;

  return {
    notes: normalizeNotesRefs(tagCatalog, folderCatalog, notes),
    lastDraftId: typeof parsed.lastDraftId === "string" ? parsed.lastDraftId : null,
    tagCatalog,
    folderCatalog,
  };
}

function findStoreContainingOpenTarget(target: OpenTarget): { store: NotesStore; target: Note } | null {
  if (!target?.id && typeof target?.createdAt !== "number" && !target?.title) return null;
  if (typeof localStorage === "undefined") return null;
  const keys = new Set<string>();
  keys.add(storageKey());
  keys.add("studium:notes:v1");
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith("studium:notes:v1")) keys.add(k);
    }
  } catch {
    // ignore
  }
  for (const k of keys) {
    const s = tryLoadStoreFromKey(k);
    const found = s?.notes.find((n) => noteMatchesOpenTarget(n, target)) || null;
    if (s && found) return { store: s, target: found };
  }
  return null;
}

function saveStore(store: NotesStore) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(store));
  } catch {
    // ignore
  }
}

function makeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `n_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
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

function yearFrom(ts: number) {
  try {
    return new Date(ts).getFullYear();
  } catch {
    return 0;
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toPreviewHtml(s: string) {
  let h = escapeHtml(s || "");
  h = h.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>");
  h = h.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  h = h.replace(/\n/g, "<br/>");
  return h;
}

function stripHtmlQuick(html: string) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function splitBodyForPreview(body: string) {
  const re = /\[\[(image|audio):([a-zA-Z0-9_\-]+)\]\]/g;
  const parts: Array<{ t: "text"; v: string } | { t: "image" | "audio"; id: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(body))) {
    const idx = m.index;
    if (idx > last) parts.push({ t: "text", v: body.slice(last, idx) });
    parts.push({ t: m[1] as "image" | "audio", id: m[2] });
    last = idx + m[0].length;
  }
  if (last < body.length) parts.push({ t: "text", v: body.slice(last) });
  return parts;
}

function isWrapped(text: string, start: number, end: number, prefix: string, suffix: string) {
  const s = Math.max(0, Math.min(text.length, start));
  const e = Math.max(0, Math.min(text.length, end));
  if (s === e) {
    return s >= prefix.length && s + suffix.length <= text.length && text.slice(s - prefix.length, s) === prefix && text.slice(s, s + suffix.length) === suffix;
  }
  return s >= prefix.length && e + suffix.length <= text.length && text.slice(s - prefix.length, s) === prefix && text.slice(e, e + suffix.length) === suffix;
}

function isItalicWrapped(text: string, start: number, end: number) {
  const s = Math.max(0, Math.min(text.length, start));
  const e = Math.max(0, Math.min(text.length, end));
  const left = (pos: number) => text.slice(Math.max(0, pos - 2), pos);
  const right = (pos: number) => text.slice(pos, Math.min(text.length, pos + 2));

  if (s === e) {
    if (s < 1 || s + 1 > text.length) return false;
    const pre = left(s);
    const post = right(s);
    const preOk = pre.endsWith("*") && !pre.endsWith("**");
    const postOk = post.startsWith("*") && !post.startsWith("**");
    return preOk && postOk;
  }

  if (s < 1 || e + 1 > text.length) return false;
  const pre = left(s);
  const post = right(e);
  const preOk = pre.endsWith("*") && !pre.endsWith("**");
  const postOk = post.startsWith("*") && !post.startsWith("**");
  return preOk && postOk;
}

function isBetweenSameMarker(text: string, pos: number, marker: string) {
  const p = Math.max(0, Math.min(text.length, pos));
  const left = text.lastIndexOf(marker, Math.max(0, p - 1));
  const right = text.indexOf(marker, p);
  return left !== -1 && right !== -1 && left < p && right >= p;
}

function findPrevSingleStar(text: string, pos: number) {
  for (let i = Math.min(text.length - 1, pos - 1); i >= 0; i--) {
    if (text[i] !== "*") continue;
    const prev = text[i - 1] || "";
    const next = text[i + 1] || "";
    if (prev === "*" || next === "*") continue;
    return i;
  }
  return -1;
}

function findNextSingleStar(text: string, pos: number) {
  for (let i = Math.max(0, pos); i < text.length; i++) {
    if (text[i] !== "*") continue;
    const prev = text[i - 1] || "";
    const next = text[i + 1] || "";
    if (prev === "*" || next === "*") continue;
    return i;
  }
  return -1;
}

function isBetweenSingleStars(text: string, pos: number) {
  const p = Math.max(0, Math.min(text.length, pos));
  const left = findPrevSingleStar(text, p);
  const right = findNextSingleStar(text, p);
  return left !== -1 && right !== -1 && left < p && right >= p;
}

function isBetweenOpenClose(text: string, pos: number, open: string, close: string) {
  const p = Math.max(0, Math.min(text.length, pos));
  const left = text.lastIndexOf(open, Math.max(0, p - 1));
  const right = text.indexOf(close, p);
  return left !== -1 && right !== -1 && left < p && right >= p && left < right;
}

function isBoldActive(text: string, start: number, end: number) {
  const s = Math.max(0, Math.min(text.length, start));
  const e = Math.max(0, Math.min(text.length, end));
  if (s === e) return isWrapped(text, s, e, "**", "**") || isBetweenSameMarker(text, s, "**");
  return isWrapped(text, s, e, "**", "**") || (isBetweenSameMarker(text, s, "**") && isBetweenSameMarker(text, e, "**"));
}

function isItalicActive(text: string, start: number, end: number) {
  const s = Math.max(0, Math.min(text.length, start));
  const e = Math.max(0, Math.min(text.length, end));
  if (s === e) return isItalicWrapped(text, s, e) || isBetweenSingleStars(text, s);
  return isItalicWrapped(text, s, e) || (isBetweenSingleStars(text, s) && isBetweenSingleStars(text, e));
}

function isUnderlineActive(text: string, start: number, end: number) {
  const s = Math.max(0, Math.min(text.length, start));
  const e = Math.max(0, Math.min(text.length, end));
  if (s === e) return isWrapped(text, s, e, "<u>", "</u>") || isBetweenOpenClose(text, s, "<u>", "</u>");
  return isWrapped(text, s, e, "<u>", "</u>") || (isBetweenOpenClose(text, s, "<u>", "</u>") && isBetweenOpenClose(text, e, "<u>", "</u>"));
}

export default function NotesNewWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkNoteId = (searchParams.get("note") || "").trim();
  const fullscreen = ["1", "true", "yes"].includes(String(searchParams.get("fullscreen") || "").trim().toLowerCase());
  const forceNew = ["1", "true", "yes"].includes(String(searchParams.get("new") || "").trim().toLowerCase());
  const searchToken = (() => {
    try {
      const raw = searchParams?.toString?.() || "";
      return raw ? `?${raw}` : "?";
    } catch {
      return "?";
    }
  })();

  const [store, setStore] = useState<NotesStore>(() => loadStore());
  const [view, setView] = useState<NotesView>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string>("");
  const [editing, setEditing] = useState(true);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState<{ state: "idle" | "recording" | "saving"; seconds: number }>({ state: "idle", seconds: 0 });
  const [formatState, setFormatState] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    ul: boolean;
    ol: boolean;
    align: "left" | "center" | "right" | "justify";
    block: "p" | "h1" | "h2";
    canUndo: boolean;
    canRedo: boolean;
  }>({ bold: false, italic: false, underline: false, ul: false, ol: false, align: "left", block: "p", canUndo: true, canRedo: true });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | null
    | "tags"
    | "folder"
    | "deleteNote"
    | "permanentDeleteNote"
    | "hideNote"
    | "unlockHidden"
    | "reminder"
    | "textColor"
    | "insertLink"
    | "leaveUnsaved"
    | "createTag"
    | "createFolder"
    | "deleteTag"
    | "deleteFolder"
  >(null);
  const [modalTags, setModalTags] = useState<Record<string, boolean>>({});
  const [modalFolder, setModalFolder] = useState<string | null>(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagDotClass, setNewTagDotClass] = useState(TAG_DOT_PALETTE[0] || "notesDot--mint");
  const [newFolderLabel, setNewFolderLabel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<null | { kind: "tag" | "folder"; id: string; label: string }>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState<string>("");
  const [textColorDraft, setTextColorDraft] = useState<{ hex: string; r: number; g: number; b: number }>({ hex: "#ffffff", r: 255, g: 255, b: 255 });
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    try {
      const raw = String(localStorage.getItem(autoSaveKey()) ?? "").trim().toLowerCase();
      if (!raw) return true;
      if (["1", "true", "yes", "on"].includes(raw)) return true;
      if (["0", "false", "no", "off"].includes(raw)) return false;
      return true;
    } catch {
      return true;
    }
  });

  const editorRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const didInitForNewRoute = useRef(false);
  const didNormalizeRefs = useRef(false);
  const uncommittedIdsRef = useRef<Set<string>>(new Set());
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const didApplyDeepLink = useRef(false);
  const pendingOpenTargetRef = useRef<string>("");
  const swappedStoreForOpenTargetRef = useRef<string>("");
  const didInitForceNewRef = useRef<string>("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTickRef = useRef<number | null>(null);
  const suppressSidebarClickRef = useRef(false);

  useEffect(() => {
    // Ensure sidebar clicks don't get permanently suppressed if a drag gesture doesn't end cleanly (touch/OS quirks).
    const resetSuppress = () => {
      suppressSidebarClickRef.current = false;
    };
    window.addEventListener("dragend", resetSuppress);
    window.addEventListener("drop", resetSuppress);
    window.addEventListener("mouseup", resetSuppress);
    window.addEventListener("touchend", resetSuppress);
    return () => {
      window.removeEventListener("dragend", resetSuppress);
      window.removeEventListener("drop", resetSuppress);
      window.removeEventListener("mouseup", resetSuppress);
      window.removeEventListener("touchend", resetSuppress);
    };
  }, []);

  useEffect(() => {
    if (didApplyDeepLink.current) return;
    const forceNewNow = (() => {
      if (forceNew) return true;
      try {
        if (typeof window === "undefined") return false;
        const v = String(new URLSearchParams(window.location.search).get("new") || "")
          .trim()
          .toLowerCase();
        return ["1", "true", "yes"].includes(v);
      } catch {
        return false;
      }
    })();
    if (forceNewNow) {
      try {
        sessionStorage.removeItem(openTargetKey());
        sessionStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
        localStorage.removeItem(openTargetKey());
        localStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
      } catch {
        // ignore
      }
      didApplyDeepLink.current = true;
      return;
    }
    const fromUrl = deepLinkNoteId || (() => {
      try {
        if (typeof window === "undefined") return "";
        return (new URLSearchParams(window.location.search).get("note") || "").trim();
      } catch {
        return "";
      }
    })();
    const fromSession = (() => {
      try {
        return (sessionStorage.getItem(openTargetKey()) || sessionStorage.getItem(OPEN_TARGET_KEY_FALLBACK) || "").trim();
      } catch {
        return "";
      }
    })();
    const fromLocal = (() => {
      try {
        return (localStorage.getItem(openTargetKey()) || localStorage.getItem(OPEN_TARGET_KEY_FALLBACK) || "").trim();
      } catch {
        return "";
      }
    })();
    const urlTarget: OpenTarget = fromUrl ? { id: fromUrl } : {};
    const sessionTarget: OpenTarget = fromSession ? parseOpenTarget(fromSession) : {};
    const localTarget: OpenTarget = fromLocal ? parseOpenTarget(fromLocal) : {};
    const requestedTarget: OpenTarget = urlTarget.id ? urlTarget : sessionTarget.id || sessionTarget.createdAt || sessionTarget.title ? sessionTarget : localTarget;
    if (!requestedTarget.id && typeof requestedTarget.createdAt !== "number" && !requestedTarget.title) return;

    const inCurrent = store.notes.find((n) => noteMatchesOpenTarget(n, requestedTarget)) || null;
    const fromOther = inCurrent ? null : findStoreContainingOpenTarget(requestedTarget);
    const target = inCurrent || fromOther?.target || null;
    const storeForTarget = fromOther?.store || null;
    pendingOpenTargetRef.current = requestedTarget.id || String(requestedTarget.createdAt || requestedTarget.title || "");
    if (!target) {
      try {
        sessionStorage.removeItem(openTargetKey());
        sessionStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
        localStorage.removeItem(openTargetKey());
        localStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
      } catch {
        // ignore
      }
      pendingOpenTargetRef.current = "";
      swappedStoreForOpenTargetRef.current = "";
      return;
    }

    // If the note exists but only in another storage key, swap the store first.
    // We'll apply selection on the next render when `store` contains the target note,
    // preventing selection-sync effects from overriding the activeId.
    if (!inCurrent && storeForTarget && swappedStoreForOpenTargetRef.current !== pendingOpenTargetRef.current) {
      swappedStoreForOpenTargetRef.current = pendingOpenTargetRef.current;
      setStore(storeForTarget);
      return;
    }

    didApplyDeepLink.current = true;
    didInitForNewRoute.current = true;

    // Keep the selection-sync effect from overriding the open target in the same commit.
    pendingOpenTargetRef.current = target.id;
    setActiveId(target.id);
    setTagFilter(null);
    setFolderFilter(null);
    setSearch("");
    try {
      sessionStorage.removeItem(openTargetKey());
      sessionStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
      localStorage.removeItem(openTargetKey());
      localStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
    } catch {
      // ignore
    }

    if (target.deletedAt) {
      setView("deleted");
      return;
    }

    if (target.hiddenAt) {
      // Always require password before showing hidden notes.
      setUnlockPassword("");
      setUnlockError(null);
      setModal("unlockHidden");
      return;
    }

    setView("all");
  }, [deepLinkNoteId, forceNew, store.notes]);

  useEffect(() => {
    // Clear the open-target guard only after React applies the activeId state,
    // preventing other effects in the same commit from overriding selection.
    const pending = pendingOpenTargetRef.current;
    if (!pending) return;
    if (modal === "unlockHidden") return;
    if (activeId && activeId === pending) {
      pendingOpenTargetRef.current = "";
      swappedStoreForOpenTargetRef.current = "";
    }
  }, [activeId, modal]);

  useEffect(() => {
    if (didNormalizeRefs.current) return;
    if (!store.notes.length) return;
    didNormalizeRefs.current = true;
    const normalized = normalizeNotesRefs(store.tagCatalog, store.folderCatalog, store.notes);
    const changed = normalized.some((n, i) => n !== store.notes[i]);
    if (changed) setStore((prev) => ({ ...prev, notes: normalized }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.notes.length]);

  useEffect(() => {
    if (didInitForNewRoute.current) return;
    if (typeof window === "undefined") return;
    if (!isNotesNewPathname(window.location.pathname)) return;
    const forceNewNow = (() => {
      if (forceNew) return true;
      try {
        const v = String(new URLSearchParams(window.location.search).get("new") || "")
          .trim()
          .toLowerCase();
        return ["1", "true", "yes"].includes(v);
      } catch {
        return false;
      }
    })();
    const openTarget = (() => {
      if (forceNewNow) return "";
      const fromUrl = deepLinkNoteId || (() => {
        try {
          return (new URLSearchParams(window.location.search).get("note") || "").trim();
        } catch {
          return "";
        }
      })();
      if (fromUrl) return fromUrl;
      try {
        const fromSession = (sessionStorage.getItem(openTargetKey()) || sessionStorage.getItem(OPEN_TARGET_KEY_FALLBACK) || "").trim();
        if (fromSession) return fromSession;
        return (localStorage.getItem(openTargetKey()) || localStorage.getItem(OPEN_TARGET_KEY_FALLBACK) || "").trim();
      } catch {
        return "";
      }
    })();
    if (!forceNewNow && openTarget) return;

    didInitForNewRoute.current = true;

    if (forceNewNow) {
      try {
        sessionStorage.removeItem(openTargetKey());
        sessionStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
        localStorage.removeItem(openTargetKey());
        localStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
      } catch {
        // ignore
      }
      return;
    }

    const draft = store.lastDraftId ? store.notes.find((n) => n.id === store.lastDraftId) : null;
    const draftOk =
      !!draft &&
      !draft.deletedAt &&
      !draft.hiddenAt &&
      (draft.title || "").trim() === "Untitled" &&
      (draft.body || "").trim() === "";

    if (draftOk) {
      setActiveId(draft.id);
      setView("all");
      setTagFilter(null);
      setFolderFilter(null);
      setSearch("");
      setEditing(true);
      return;
    }

    // Prevent the selection-sync effect from overriding draft selection in this same commit.
    pendingOpenTargetRef.current = "__draft__";
    pendingOpenTargetRef.current = createDraft() || "__draft__";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkNoteId, forceNew, store.notes.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isNotesNewPathname(window.location.pathname)) return;
    const forceNewNow = (() => {
      if (forceNew) return true;
      try {
        const v = String(new URLSearchParams(window.location.search).get("new") || "")
          .trim()
          .toLowerCase();
        return ["1", "true", "yes"].includes(v);
      } catch {
        return false;
      }
    })();
    if (!forceNewNow) return;

    // Re-run draft creation when the query changes (e.g. nonce) while staying on this route.
    const token = window.location.search || searchToken || "?";
    if (didInitForceNewRef.current === token) return;
    didInitForceNewRef.current = token;

    try {
      sessionStorage.removeItem(openTargetKey());
      sessionStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
      localStorage.removeItem(openTargetKey());
      localStorage.removeItem(OPEN_TARGET_KEY_FALLBACK);
    } catch {
      // ignore
    }

    // Prevent the selection-sync effect from overriding draft selection in this same commit.
    pendingOpenTargetRef.current = "__forceNew__";
    pendingOpenTargetRef.current = createDraft({ useTemplate: false }) || "__forceNew__";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceNew, searchToken]);

  useEffect(() => {
    if (!store.notes.length) return;
    if (!autoSaveEnabled) {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const persisted = (() => {
      const exclude = uncommittedIdsRef.current;
      if (!exclude.size) return store;
      const notes = store.notes.filter((n) => !exclude.has(n.id));
      const lastDraftId = store.lastDraftId && exclude.has(store.lastDraftId) ? null : store.lastDraftId;
      return notes.length === store.notes.length && lastDraftId === store.lastDraftId ? store : { ...store, notes, lastDraftId };
    })();
    saveTimer.current = window.setTimeout(() => saveStore(persisted), 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [autoSaveEnabled, store]);

  const counts = useMemo(() => {
    const all = store.notes.filter((n) => !n.deletedAt && !n.hiddenAt).length;
    const favorites = store.notes.filter((n) => !n.deletedAt && !n.hiddenAt && n.favorite).length;
    const hidden = store.notes.filter((n) => !n.deletedAt && !!n.hiddenAt).length;
    const deleted = store.notes.filter((n) => !!n.deletedAt).length;
    return { all, favorites, hidden, deleted };
  }, [store.notes]);

  const tagLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    store.tagCatalog.forEach((t) => (map[t.id] = t.label));
    return map;
  }, [store.tagCatalog]);

  const folderLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    store.folderCatalog.forEach((f) => (map[f.id] = f.label));
    return map;
  }, [store.folderCatalog]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = store.notes.slice();

    if (view === "deleted") list = list.filter((n) => !!n.deletedAt);
    else if (view === "hidden") list = list.filter((n) => !n.deletedAt && !!n.hiddenAt);
    else if (view === "favorites") list = list.filter((n) => !n.deletedAt && !n.hiddenAt && n.favorite);
    else list = list.filter((n) => !n.deletedAt && !n.hiddenAt);

    // Tag/folder filters shouldn't affect Recently deleted.
    if (view !== "deleted") {
      if (tagFilter) list = list.filter((n) => n.tags.includes(tagFilter));
      if (folderFilter) list = list.filter((n) => n.folder === folderFilter);
    }
    if (q)
      list = list.filter((n) => {
        const bodyText = n.bodyFormat === "html" ? stripHtmlQuick(n.body) : n.body;
        return (n.title + "\n" + bodyText).toLowerCase().includes(q);
      });

    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
      return b.updatedAt - a.updatedAt;
    });

    return list;
  }, [search, store.notes, tagFilter, view, folderFilter]);

  const activeNote = useMemo(() => filteredNotes.find((n) => n.id === activeId) || filteredNotes[0] || null, [activeId, filteredNotes]);

  useEffect(() => {
    // Keep selection in-sync with the current view (e.g. entering "Recently deleted").
    if (pendingOpenTargetRef.current) return;
    const inView = !!activeId && filteredNotes.some((n) => n.id === activeId);
    if (inView) return;
    let nextId = "";
    if (filteredNotes.length) {
      if (!activeId && store.lastDraftId) {
        const draft = filteredNotes.find((n) => n.id === store.lastDraftId) || null;
        if (draft) {
          nextId = draft.id;
          setEditing(true);
        }
      }
      if (!nextId) nextId = filteredNotes[0]!.id;
    }
    if (nextId !== activeId) setActiveId(nextId);
  }, [activeId, filteredNotes, store.lastDraftId]);

  const tagsSummaryLabel = useMemo(() => {
    if (!activeNote) return "No Tags";
    const ids = Array.isArray(activeNote.tags) ? activeNote.tags : [];
    if (!ids.length) return "No Tags";
    const labels = ids.map((id) => tagLabelById[id] || id).filter(Boolean);
    if (!labels.length) return "No Tags";
    if (labels.length === 1) return labels[0]!;
    return `${labels[0]} +${labels.length - 1}`;
  }, [activeNote, tagLabelById]);

  const reorderVisibleNotes = (fromId: string, toId: string) => {
    if (!fromId || !toId) return;
    if (fromId === toId) return;
    if (view === "deleted") return;

    const from = filteredNotes.find((n) => n.id === fromId) || null;
    const to = filteredNotes.find((n) => n.id === toId) || null;
    if (!from || !to) return;
    if (from.pinned !== to.pinned) return;

    const group = filteredNotes.filter((n) => n.pinned === from.pinned).map((n) => n.id);
    const fromIndex = group.indexOf(fromId);
    const toIndex = group.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = group.slice();
    next.splice(fromIndex, 1);
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    next.splice(insertAt, 0, fromId);

    const base = now();
    const nextOrder: Record<string, number> = {};
    next.forEach((id, idx) => {
      nextOrder[id] = base - idx;
    });

    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (typeof nextOrder[n.id] === "number" ? { ...n, sortOrder: nextOrder[n.id] } : n)),
    }));
  };

  const reorderCatalog = (kind: "tag" | "folder", fromId: string, toId: string) => {
    if (!fromId || !toId) return;
    if (fromId === toId) return;
    setStore((prev) => {
      const list = kind === "tag" ? prev.tagCatalog.slice() : prev.folderCatalog.slice();
      const fromIndex = list.findIndex((x) => x.id === fromId);
      const toIndex = list.findIndex((x) => x.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = list.slice();
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
      next.splice(insertAt, 0, moved as any);
      return kind === "tag" ? { ...prev, tagCatalog: next as any } : { ...prev, folderCatalog: next as any };
    });
  };

  useEffect(() => {
    if (!activeNote) return;
    const becameDeleted = !!activeNote.deletedAt && view !== "deleted";
    const becameHidden = !!activeNote.hiddenAt && view !== "hidden";
    if (!becameDeleted && !becameHidden) return;
    if (filteredNotes.length > 0 && filteredNotes[0]?.id !== activeNote.id) setActiveId(filteredNotes[0].id);
    else if (filteredNotes.length === 0) setActiveId("");
  }, [activeNote?.deletedAt, activeNote?.hiddenAt, activeNote?.id, filteredNotes, view]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", !!modal);
    return () => document.body.classList.remove("modal-open");
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  useEffect(() => {
    if (!activeNote) return;
    const ids = parseAssetIds(activeNote.body || "");
    if (ids.length === 0) {
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
      created.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    };
  }, [activeNote?.body, activeNote?.id]);

  const updateNote = (id: string, patch: Partial<Note>) => {
    const changedKeys = Object.keys(patch).filter((k) => k !== "updatedAt");
    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, ...patch, updatedAt: patch.updatedAt ?? now() };
        if (autoSaveEnabled && changedKeys.length > 0 && uncommittedIdsRef.current.has(id)) {
          uncommittedIdsRef.current.delete(id);
        }
        return next;
      }),
    }));
  };

  const createDraft = (opts?: { useTemplate?: boolean }) => {
    const useTemplate = opts?.useTemplate !== false;
    const template = useTemplate
      ? (() => {
          try {
            const raw = localStorage.getItem(templateDraftKey());
            if (!raw) return null;
            localStorage.removeItem(templateDraftKey());
            const v = JSON.parse(raw) as any;
            if (!v || typeof v !== "object" || v.v !== 1) return null;
            const title = String(v.title ?? "").trim();
            const body = String(v.body ?? "");
            const bodyFormat = v.bodyFormat === "html" ? "html" : "plain";
            return { title, body, bodyFormat } as { title: string; body: string; bodyFormat: "plain" | "html" };
          } catch {
            return null;
          }
        })()
      : null;

    const id = makeId();
    const t = now();
    const draft: Note = {
      id,
      title: (template?.title || "").trim() || "Untitled",
      body: template?.body ?? "",
      bodyFormat: template?.bodyFormat ?? "plain",
      tags: [],
      folder: folderFilter || store.folderCatalog[0]?.id || null,
      favorite: false,
      pinned: false,
      sortOrder: t,
      hiddenAt: null,
      reminderAt: null,
      createdAt: t,
      updatedAt: t,
      archivedAt: null,
      deletedAt: null,
    };

    uncommittedIdsRef.current.add(id);

    setStore((prev) => ({ ...prev, notes: [draft, ...prev.notes], lastDraftId: id }));
    setActiveId(id);
    setView("all");
    setTagFilter(null);
    setFolderFilter(null);
    setSearch("");
    setEditing(true);
    requestAnimationFrame(() => {
      try {
        document.querySelector<HTMLInputElement>('[data-focus="notes.preview.title"]')?.focus();
      } catch {
        // ignore
      }
    });

    return id;
  };

  const toggleFavorite = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { favorite: !activeNote.favorite });
  };

  const togglePinned = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { pinned: !activeNote.pinned, sortOrder: now() });
  };

  const persistNotePatchNow = (noteId: string, patch: Partial<Note>) => {
    if (!noteId) return;

    // Treat explicit actions (hide/unhide/etc.) as an immediate save, even when autosave is off,
    // and include any in-flight editor/preview DOM changes to avoid data loss on navigation.
    const t = now();
    const note = store.notes.find((n) => n.id === noteId) || null;
    const bodyPatch = (() => {
      if (!note) return null;
      // Avoid converting plain-text notes to HTML just because we toggled a flag (hide/favorite/etc.).
      // Only capture DOM when we're in the rich editor, or the note is already HTML-backed.
      if (!editing && note.bodyFormat !== "html") return null;
      try {
        const el = editing ? editorRef.current : previewRef.current;
        if (!el) return null;
        const html = sanitizeNoteHtml(el.innerHTML || "");
        return { body: html, bodyFormat: "html" as const };
      } catch {
        return null;
      }
    })();

    // Commit this note so it is included in persisted storage.
    uncommittedIdsRef.current.delete(noteId);
    if (saveTimer.current) {
      try {
        window.clearTimeout(saveTimer.current);
      } catch {
        // ignore
      }
      saveTimer.current = null;
    }

    const next: NotesStore = {
      ...store,
      notes: store.notes.map((n) => {
        if (n.id !== noteId) return n;
        return {
          ...n,
          ...bodyPatch,
          ...patch,
          updatedAt: patch.updatedAt ?? t,
        };
      }),
    };

    const exclude = uncommittedIdsRef.current;
    const persisted =
      exclude.size === 0
        ? next
        : {
            ...next,
            notes: next.notes.filter((n) => !exclude.has(n.id)),
            lastDraftId: next.lastDraftId && exclude.has(next.lastDraftId) ? null : next.lastDraftId,
          };

    saveStore(persisted);
    setStore(next);
  };

  const requestHideNote = () => {
    if (!activeNote) return;
    if (activeNote.deletedAt) return;
    if (activeNote.hiddenAt) {
      // Unhide stays in current view for better UX.
      persistNotePatchNow(activeNote.id, { hiddenAt: null, archivedAt: null });
      return;
    }
    setModal("hideNote");
  };

  const confirmHideNote = () => {
    if (!activeNote) return;
    if (activeNote.deletedAt) return;
    const t = now();
    persistNotePatchNow(activeNote.id, { hiddenAt: t, archivedAt: null, updatedAt: t });
    setModal(null);
    router.push("/notes");
  };

  const moveToTrash = () => {
    if (!activeNote) return;
    setModal("deleteNote");
  };

  const requestPermanentDelete = () => {
    if (!activeNote) return;
    if (!activeNote.deletedAt) return;
    setModal("permanentDeleteNote");
  };

  const confirmMoveToTrash = () => {
    if (!activeNote) return;
    const deleteId = activeNote.id;
    const t = now();
    setStore((prev) => {
      const next: NotesStore = {
        ...prev,
        notes: prev.notes.map((n) => (n.id === deleteId ? { ...n, deletedAt: t, hiddenAt: null, archivedAt: null, updatedAt: now() } : n)),
      };
      const exclude = uncommittedIdsRef.current;
      const persisted =
        exclude.size === 0
          ? next
          : { ...next, notes: next.notes.filter((n) => !exclude.has(n.id)), lastDraftId: next.lastDraftId && exclude.has(next.lastDraftId) ? null : next.lastDraftId };
      saveStore(persisted);
      return next;
    });
    setModal(null);
    router.push("/notes?view=deleted");
  };

  const confirmPermanentDelete = async () => {
    if (!activeNote) return;
    if (!activeNote.deletedAt) return;

    const deleteId = activeNote.id;
    const html = htmlForNote(activeNote);
    const assetIds = parseAssetIds(html);

    // best-effort cleanup of stored blobs
    await Promise.all(
      assetIds.map(async (id) => {
        try {
          await deleteAsset(id);
        } catch {
          // ignore
        }
      })
    );

    // pick next active in current deleted list
    const nextActive =
      filteredNotes.find((n) => n.id !== deleteId)?.id ||
      store.notes.find((n) => n.id !== deleteId && !!n.deletedAt)?.id ||
      "";

    setStore((prev) => {
      const next: NotesStore = { ...prev, notes: prev.notes.filter((n) => n.id !== deleteId) };
      const exclude = uncommittedIdsRef.current;
      const persisted =
        exclude.size === 0
          ? next
          : { ...next, notes: next.notes.filter((n) => !exclude.has(n.id)), lastDraftId: next.lastDraftId && exclude.has(next.lastDraftId) ? null : next.lastDraftId };
      saveStore(persisted);
      return next;
    });
    setActiveId(nextActive);
    setModal(null);
    router.push("/notes?view=deleted");
  };

  const restoreFromTrash = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { deletedAt: null });
  };

  const slugify = (s: string) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "");

  const makeUniqueId = (base: string, used: Set<string>) => {
    const safeBase = base || "item";
    let id = safeBase;
    let i = 2;
    while (used.has(id)) {
      id = `${safeBase}-${i}`;
      i += 1;
    }
    return id;
  };

  const openCreateTagModal = () => {
    setNewTagLabel("");
    setNewTagDotClass(TAG_DOT_PALETTE[0] || "notesDot--mint");
    setModal("createTag");
  };

  const createTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;
    setStore((prev) => {
      const used = new Set(prev.tagCatalog.map((t) => t.id));
      const base = slugify(label);
      const id = makeUniqueId(base || `tag-${String(now())}`, used);
      const dotClass = TAG_DOT_PALETTE.includes(newTagDotClass) ? newTagDotClass : TAG_DOT_PALETTE[0] || "notesDot--mint";
      return { ...prev, tagCatalog: [...prev.tagCatalog, { id, label, dotClass }] };
    });
    setModal(null);
  };

  const openCreateFolderModal = () => {
    setNewFolderLabel("");
    setModal("createFolder");
  };

  const createFolder = () => {
    const label = newFolderLabel.trim();
    if (!label) return;
    setStore((prev) => {
      const used = new Set(prev.folderCatalog.map((f) => f.id));
      const base = slugify(label);
      const id = makeUniqueId(base || `folder-${String(now())}`, used);
      return { ...prev, folderCatalog: [...prev.folderCatalog, { id, label }] };
    });
    setModal(null);
  };

  const openDeleteTagModal = (tagId: string) => {
    const t = store.tagCatalog.find((x) => x.id === tagId);
    if (!t) return;
    setDeleteTarget({ kind: "tag", id: t.id, label: t.label });
    setModal("deleteTag");
  };

  const confirmDeleteTag = () => {
    if (!deleteTarget || deleteTarget.kind !== "tag") return;
    const id = deleteTarget.id;
    setTagFilter((cur) => (cur === id ? null : cur));
    setStore((prev) => {
      const t = now();
      const nextCatalog = prev.tagCatalog.filter((x) => x.id !== id);
      const nextNotes = prev.notes.map((n) => {
        if (!n.tags.includes(id)) return n;
        return { ...n, tags: n.tags.filter((tag) => tag !== id), updatedAt: t };
      });
      return { ...prev, tagCatalog: nextCatalog, notes: nextNotes };
    });
    setDeleteTarget(null);
    setModal(null);
  };

  const openDeleteFolderModal = (folderId: string) => {
    const f = store.folderCatalog.find((x) => x.id === folderId);
    if (!f) return;
    setDeleteTarget({ kind: "folder", id: f.id, label: f.label });
    setModal("deleteFolder");
  };

  const confirmDeleteFolder = () => {
    if (!deleteTarget || deleteTarget.kind !== "folder") return;
    const id = deleteTarget.id;
    setFolderFilter((cur) => (cur === id ? null : cur));
    setStore((prev) => {
      const t = now();
      const nextCatalog = prev.folderCatalog.filter((x) => x.id !== id);
      const nextNotes = prev.notes.map((n) => {
        if (n.folder !== id) return n;
        return { ...n, folder: null, updatedAt: t };
      });
      return { ...prev, folderCatalog: nextCatalog, notes: nextNotes };
    });
    setDeleteTarget(null);
    setModal(null);
  };

  const openTagsModal = () => {
    if (!activeNote) return;
    const next: Record<string, boolean> = {};
    store.tagCatalog.forEach((t) => (next[t.id] = activeNote.tags.includes(t.id)));
    setModalTags(next);
    setModal("tags");
  };

  const saveTagsModal = () => {
    if (!activeNote) return;
    const nextIds = Object.entries(modalTags)
      .filter(([, v]) => v)
      .map(([id]) => id);
    setStore((prev) => {
      const t = now();
      const nextNotes = prev.notes.map((n) => (n.id === activeNote.id ? { ...n, tags: nextIds, updatedAt: t } : n));
      return { ...prev, notes: nextNotes };
    });
    setModal(null);
  };

  const openFolderModal = () => {
    if (!activeNote) return;
    setModalFolder(activeNote.folder);
    setModal("folder");
  };

  const saveFolderModal = () => {
    if (!activeNote) return;
    setStore((prev) => {
      const t = now();
      const nextNotes = prev.notes.map((n) => (n.id === activeNote.id ? { ...n, folder: modalFolder, updatedAt: t } : n));
      return { ...prev, notes: nextNotes };
    });
    setModal(null);
  };

  const openReminderModal = () => {
    if (!activeNote) return;
    const current = activeNote.reminderAt ? new Date(activeNote.reminderAt) : null;
    const toLocalInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setReminderDraft(current ? toLocalInput(current) : "");
    setModal("reminder");
  };

  const saveReminder = () => {
    if (!activeNote) return;
    const v = reminderDraft.trim();
    if (!v) {
      updateNote(activeNote.id, { reminderAt: null });
      setModal(null);
      return;
    }
    const ms = new Date(v).getTime();
    if (!Number.isFinite(ms)) return;
    updateNote(activeNote.id, { reminderAt: ms });
    setModal(null);
  };

  const clearReminder = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { reminderAt: null });
    setReminderDraft("");
    setModal(null);
  };

  const confirmUnlockHidden = () => {
    const pwd = unlockPassword.trim();
    if (pwd !== "1111") {
      setUnlockError("Wrong password.");
      return;
    }
    setUnlockError(null);
    setModal(null);
    setView("hidden");
  };

  function sanitizeNoteHtml(html: string) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((n) => n.remove());
      doc.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((a) => {
          const name = a.name.toLowerCase();
          const value = String(a.value || "");
          if (name.startsWith("on")) el.removeAttribute(a.name);
          if (name === "href" && value.trim().toLowerCase().startsWith("javascript:")) el.removeAttribute(a.name);
          if (name === "src" && value.trim().toLowerCase().startsWith("javascript:")) el.removeAttribute(a.name);
        });
      });
      return doc.body.innerHTML;
    } catch {
      return String(html || "");
    }
  }

  const htmlForNote = (n: Note) => {
    if (n.bodyFormat === "html") return n.body || "";
    return toPreviewHtml(n.body || "");
  };

  const saveEditorToStore = () => {
    if (!activeNote) return;
    const el = editorRef.current;
    if (!el) return;
    const html = sanitizeNoteHtml(el.innerHTML);
    updateNote(activeNote.id, { body: html, bodyFormat: "html" });
  };

  const savePreviewToStore = () => {
    if (!activeNote) return;
    const el = previewRef.current;
    if (!el) return;
    const html = sanitizeNoteHtml(el.innerHTML);
    updateNote(activeNote.id, { body: html, bodyFormat: "html" });
  };

  const refreshFormat = () => {
    if (!editing) return;
    const el = editorRef.current;
    if (!el) return;
    const sel = document.getSelection();
    if (!sel?.anchorNode || !el.contains(sel.anchorNode)) return;
    try {
      const align: "left" | "center" | "right" | "justify" =
        document.queryCommandState?.("justifyCenter")
          ? "center"
          : document.queryCommandState?.("justifyRight")
            ? "right"
            : document.queryCommandState?.("justifyFull")
              ? "justify"
              : "left";

      let block: "p" | "h1" | "h2" = "p";
      try {
        const fb = String(document.queryCommandValue?.("formatBlock") || "").toLowerCase();
        if (fb.includes("h1")) block = "h1";
        else if (fb.includes("h2")) block = "h2";
      } catch {
        // ignore
      }

      setFormatState({
        bold: !!document.queryCommandState?.("bold"),
        italic: !!document.queryCommandState?.("italic"),
        underline: !!document.queryCommandState?.("underline"),
        ul: !!document.queryCommandState?.("insertUnorderedList"),
        ol: !!document.queryCommandState?.("insertOrderedList"),
        align,
        block,
        canUndo: document.queryCommandEnabled ? !!document.queryCommandEnabled("undo") : true,
        canRedo: document.queryCommandEnabled ? !!document.queryCommandEnabled("redo") : true,
      });
    } catch {
      // ignore
    }
  };

  const exec = (cmd: string, value?: string) => {
    const el = editorRef.current;
    if (!el || !activeNote || !editing) return;
    try {
      el.focus();
      if (typeof value === "string") document.execCommand(cmd, false, value);
      else document.execCommand(cmd);
    } catch {
      // ignore
    }
    refreshFormat();
    saveEditorToStore();
  };

  const setBlock = (block: "p" | "h1" | "h2") => {
    if (!activeNote || !editing) return;
    const el = editorRef.current;
    if (!el) return;
    try {
      el.focus();
      const ok = document.execCommand("formatBlock", false, block);
      if (!ok) document.execCommand("formatBlock", false, `<${block}>`);
    } catch {
      // ignore
    }
    refreshFormat();
    saveEditorToStore();
  };

  const pickTextColor = () => {
    if (!activeNote || !editing) return;
    colorInputRef.current?.click();
  };

  const onPickTextColor = (hex: string) => {
    const v = String(hex || "").trim();
    if (!v) return;
    exec("foreColor", v);
    if (modal === "textColor") setModal(null);
  };

  const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));

  const rgbToHex = (r: number, g: number, b: number) => {
    const to2 = (x: number) => clamp255(x).toString(16).padStart(2, "0");
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  };

  const hexToRgb = (hex: string) => {
    const raw = String(hex || "").trim().replace("#", "");
    if (raw.length === 3) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
    }
    if (raw.length !== 6) return { r: 255, g: 255, b: 255 };
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  };

  const openTextColorModal = () => {
    const base = textColorDraft.hex || "#ffffff";
    const rgb = hexToRgb(base);
    setTextColorDraft({ hex: rgbToHex(rgb.r, rgb.g, rgb.b), r: rgb.r, g: rgb.g, b: rgb.b });
    setModal("textColor");
  };

  const applyTextColor = (hex: string) => {
    const v = String(hex || "").trim();
    if (!v) return;
    exec("foreColor", v);
    setModal(null);
  };

  const insertChecklist = () => {
    if (!activeNote || !editing) return;
    insertHtml(`<ul class="notesChecklist"><li><label class="notesChecklistLabel"><input type="checkbox" class="notesChecklistBox" /> <span data-notes-check-text="1">Task</span></label></li></ul><p><br/></p>`);
    requestAnimationFrame(() => {
      try {
        const root = editorRef.current;
        if (!root) return;
        const target = root.querySelector<HTMLElement>('[data-notes-check-text="1"]');
        if (!target) return;
        target.removeAttribute("data-notes-check-text");
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        root.focus();
      } catch {
        // ignore
      }
    });
  };

  const insertHtml = (html: string) => {
    const el = editorRef.current;
    if (!el || !activeNote || !editing) return;
    try {
      el.focus();
      document.execCommand("insertHTML", false, html);
    } catch {
      // ignore
    }
    saveEditorToStore();
  };

  const removeAssetFromHtmlString = (html: string, assetId: string) => {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      const hits = Array.from(doc.querySelectorAll(`[data-asset-id="${assetId}"]`));
      hits.forEach((el) => {
        const fig = (el as HTMLElement).closest?.("figure");
        if (fig) fig.remove();
        else el.remove();
      });
      return doc.body.innerHTML;
    } catch {
      return String(html || "");
    }
  };

  const deleteAttachment = async (assetId: string) => {
    if (!activeNote) return;
    try {
      await deleteAsset(assetId);
    } catch {
      // ignore
    }

    if (editing && editorRef.current) {
      const root = editorRef.current;
      const hits = Array.from(root.querySelectorAll(`[data-asset-id="${assetId}"]`));
      hits.forEach((el) => {
        const fig = (el as HTMLElement).closest?.("figure");
        if (fig) fig.remove();
        else (el as HTMLElement).remove();
      });
      saveEditorToStore();
      return;
    }

    const nextHtml = removeAssetFromHtmlString(htmlForNote(activeNote), assetId);
    updateNote(activeNote.id, { body: nextHtml, bodyFormat: "html" });
  };

  const insertLink = () => {
    if (!editing) return;
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    let prefill = "";
    try {
      const root = editorRef.current;
      if (root && sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const inEditor = root.contains(range.commonAncestorContainer);
        if (inEditor) {
          let node: Node | null = range.commonAncestorContainer;
          if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
          let el = node instanceof HTMLElement ? node : (node as any as Element | null);
          while (el && el instanceof HTMLElement && el !== root) {
            if (el.tagName === "A") {
              prefill = String((el as HTMLAnchorElement).getAttribute("href") || "").trim();
              break;
            }
            el = el.parentElement;
          }
        }
      }
    } catch {
      // ignore
    }

    setLinkUrlDraft(prefill);
    setLinkError(null);
    setModal("insertLink");
  };

  const normalizeUrl = (raw: string) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:") || lower.startsWith("tel:")) return s;
    if (lower.startsWith("javascript:")) return s;
    // If user typed a domain/path without scheme, assume https.
    return `https://${s.replace(/^\/+/, "")}`;
  };

  const confirmInsertLink = () => {
    const raw = linkUrlDraft.trim();
    if (!raw) return;
    const safe = normalizeUrl(raw);
    if (!safe.trim()) return;
    if (safe.trim().toLowerCase().startsWith("javascript:")) {
      setLinkError("Invalid URL.");
      return;
    }
    exec("createLink", safe.trim());
    setModal(null);
    setLinkError(null);
    try {
      saveEditorToStore();
    } catch {
      // ignore
    }
    try {
      editorRef.current?.focus();
    } catch {
      // ignore
    }
  };

  const persistCurrentStore = (opts?: { includeUncommitted?: boolean }) => {
    const includeUncommitted = !!opts?.includeUncommitted;
    setStore((prev) => {
      const patch = (() => {
        if (!editing) return null;
        if (!activeNote?.id) return null;
        const el = editorRef.current;
        if (!el) return null;
        const html = sanitizeNoteHtml(el.innerHTML);
        return { id: activeNote.id, html };
      })();

      const next: NotesStore = patch
        ? {
            ...prev,
            notes: prev.notes.map((n) => (n.id === patch.id ? { ...n, body: patch.html, bodyFormat: "html", updatedAt: now() } : n)),
          }
        : prev;

      const exclude = includeUncommitted ? new Set<string>() : uncommittedIdsRef.current;
      const persisted =
        exclude.size === 0
          ? next
          : {
              ...next,
              notes: next.notes.filter((n) => !exclude.has(n.id)),
              lastDraftId: next.lastDraftId && exclude.has(next.lastDraftId) ? null : next.lastDraftId,
            };
      saveStore(persisted);
      return next;
    });
  };

  const requestLeave = (href: string) => {
    const note = activeNote;
    if (!note?.id) {
      router.push(href);
      return;
    }
    const uncommitted = uncommittedIdsRef.current.has(note.id);
    if (!autoSaveEnabled) {
      const snapshot = (() => {
        let body = note.body || "";
        let bodyFormat: "plain" | "html" = note.bodyFormat;
        try {
          if (editing) {
            const el = editorRef.current;
            if (el) {
              body = sanitizeNoteHtml(el.innerHTML || "");
              bodyFormat = "html";
            }
          } else {
            const el = previewRef.current;
            if (el) {
              body = sanitizeNoteHtml(el.innerHTML || "");
              bodyFormat = "html";
            }
          }
        } catch {
          // ignore
        }
        return { ...note, body, bodyFormat };
      })();
      const persisted = loadStore();
      const saved = persisted.notes.find((n) => n.id === snapshot.id) || null;
      const same =
        !!saved &&
        String(saved.title || "") === String(snapshot.title || "") &&
        String(saved.body || "") === String(snapshot.body || "") &&
        saved.bodyFormat === snapshot.bodyFormat &&
        String(saved.folder || "") === String(snapshot.folder || "") &&
        !!saved.favorite === !!snapshot.favorite &&
        !!saved.pinned === !!snapshot.pinned &&
        Number(saved.hiddenAt || 0) === Number(snapshot.hiddenAt || 0) &&
        Number(saved.reminderAt || 0) === Number(snapshot.reminderAt || 0) &&
        Number(saved.deletedAt || 0) === Number(snapshot.deletedAt || 0) &&
        JSON.stringify([...(saved.tags || [])].slice().sort()) === JSON.stringify([...(snapshot.tags || [])].slice().sort());

      if (!same) {
        setPendingLeaveHref(href);
        setModal("leaveUnsaved");
        return;
      }

      router.push(href);
      return;
    }
    if (uncommitted && autoSaveEnabled) {
      // Auto-save ON: never show the leave prompt.
      // Commit + persist immediately, just like pressing Save.
      uncommittedIdsRef.current.delete(note.id);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      persistCurrentStore({ includeUncommitted: true });
      router.push(href);
      return;
    }
    if (!uncommitted) {
      if (autoSaveEnabled) {
        // best-effort flush pending autosave before leaving
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        persistCurrentStore({ includeUncommitted: false });
      }
      router.push(href);
      return;
    }
    setPendingLeaveHref(href);
    setModal("leaveUnsaved");
  };

  const confirmLeaveWithoutSaving = () => {
    const href = pendingLeaveHref || "/notes";
    const note = activeNote;
    if (note?.id && uncommittedIdsRef.current.has(note.id)) {
      uncommittedIdsRef.current.delete(note.id);
      setStore((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== note.id),
        lastDraftId: prev.lastDraftId === note.id ? null : prev.lastDraftId,
      }));
    }
    setModal(null);
    setPendingLeaveHref(null);
    router.push(href);
  };

  const confirmSaveAndLeave = () => {
    const href = pendingLeaveHref || "/notes";
    const note = activeNote;
    if (note?.id) uncommittedIdsRef.current.delete(note.id);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    persistCurrentStore({ includeUncommitted: true });
    setModal(null);
    setPendingLeaveHref(null);
    router.push(href);
  };

  const saveNow = () => {
    const note = activeNote;
    if (!note?.id) return;
    uncommittedIdsRef.current.delete(note.id);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    persistCurrentStore({ includeUncommitted: true });
  };

  const toggleAutoSave = () => {
    setAutoSaveEnabled((cur) => {
      const next = !cur;
      try {
        localStorage.setItem(autoSaveKey(), next ? "1" : "0");
      } catch {
        // ignore
      }
      if (next) {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        persistCurrentStore({ includeUncommitted: false });
      }
      return next;
    });
  };

  const pickImage = () => {
    if (!editing) return;
    imageInputRef.current?.click();
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    if (!activeNote) return;
    const maxBytes = 2_000_000;
    if (file.size > maxBytes) {
      window.alert("Image too large. Please pick an image under ~2MB for now.");
      return;
    }
    try {
      const id = await putAsset("image", file, file.type || "image/*");
      insertHtml(
        `<figure class="notesAsset notesAsset--image" contenteditable="false" data-asset-id="${id}"><img data-asset-id="${id}" alt="" /><button type="button" class="notesAssetDelete" data-action="delete-asset" data-asset-id="${id}" aria-label="Delete attachment"><i class="fa-solid fa-trash"></i></button></figure><p><br/></p>`
      );
    } catch {
      window.alert("Failed to attach image.");
    }
  };

  const startRecording = async () => {
    if (!editing) return;
    if (!activeNote) return;
    if (recording.state !== "idle") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      window.alert("Voice recording is not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      window.alert("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      recChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setRecording((r) => ({ ...r, state: "saving" }));
        try {
          const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const maxBytes = 4_000_000;
          if (blob.size > maxBytes) {
            window.alert("Recording too large. Try a shorter recording.");
            return;
          }
          const id = await putAsset("audio", blob, blob.type || "audio/webm");
          insertHtml(
            `<figure class="notesAsset notesAsset--audio" contenteditable="false" data-asset-id="${id}"><div class="notesAssetRow"><audio controls data-asset-id="${id}"></audio><button type="button" class="notesAssetDelete notesAssetDelete--inline" data-action="delete-asset" data-asset-id="${id}" aria-label="Delete recording"><i class="fa-solid fa-trash"></i></button></div></figure><p><br/></p>`
          );
        } catch {
          window.alert("Failed to save recording.");
        } finally {
          try {
            recStreamRef.current?.getTracks()?.forEach((t) => t.stop());
          } catch {
            // ignore
          }
          recStreamRef.current = null;
          recorderRef.current = null;
          recChunksRef.current = [];
          setRecording({ state: "idle", seconds: 0 });
        }
      };

      recorder.start();
      setRecording({ state: "recording", seconds: 0 });
      if (recTickRef.current) window.clearInterval(recTickRef.current);
      recTickRef.current = window.setInterval(() => {
        setRecording((r) => (r.state === "recording" ? { ...r, seconds: r.seconds + 1 } : r));
      }, 1000);
    } catch {
      window.alert("Microphone permission denied.");
    }
  };

  const stopRecording = () => {
    if (recording.state !== "recording") return;
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    if (recTickRef.current) {
      window.clearInterval(recTickRef.current);
      recTickRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recTickRef.current) window.clearInterval(recTickRef.current);
      try {
        recStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!editing) return;
    if (!activeNote) return;
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = htmlForNote(activeNote) || "";
    refreshFormat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, editing]);

  useEffect(() => {
    if (!editing) return;
    const handler = () => refreshFormat();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, activeId]);

  useEffect(() => {
    const apply = (root: HTMLElement | null) => {
      if (!root) return;
      root.querySelectorAll<HTMLElement>("[data-asset-id]").forEach((el) => {
        const id = el.getAttribute("data-asset-id") || "";
        if (!id) return;
        const url = assetUrls[id];
        if (!url) return;
        const tag = String(el.tagName || "").toLowerCase();
        if (tag === "img") (el as HTMLImageElement).setAttribute("src", url);
        if (tag === "audio") (el as HTMLAudioElement).setAttribute("src", url);
      });
    };
    apply(editorRef.current);
    apply(previewRef.current);
  }, [assetUrls, activeId, editing]);

  const sidebarItemClass = (active: boolean) => ["notesSidebarItem", "gridCard", active ? "notesSidebarItem--active" : ""].filter(Boolean).join(" ");
  const tagPillClass = (active: boolean) => ["notesTagPill", "gridCard", active ? "notesTagPill--active" : ""].filter(Boolean).join(" ");

  const formatActive = formatState;
  const closeModal = () => {
    if (modal === "unlockHidden") {
      pendingOpenTargetRef.current = "";
      swappedStoreForOpenTargetRef.current = "";
    }
    setModal(null);
    setDeleteTarget(null);
    setUnlockError(null);
    setLinkError(null);
    if (modal === "leaveUnsaved") setPendingLeaveHref(null);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-[var(--shell-gap)] overflow-hidden" aria-label="Notes workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="notesBackBtn gridCard"
          data-focus="notes.back"
          aria-label="Back to Notes"
          onClick={() => requestLeave("/notes")}
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Back
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className={["notesPrimaryBtn", "gridCard", "notesAutoSaveToggle", autoSaveEnabled ? "notesAutoSaveToggle--on" : ""].join(" ")}
            aria-label="Toggle auto-save"
            title="Toggle auto-save"
            aria-pressed={autoSaveEnabled}
            onClick={toggleAutoSave}
          >
            <i className={["fa-solid", autoSaveEnabled ? "fa-square-check" : "fa-square"].join(" ")} aria-hidden="true" />
            Auto-save
          </button>
          <button type="button" className="notesPrimaryBtn gridCard" onClick={saveNow} disabled={!activeNote || !!activeNote?.deletedAt}>
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save
          </button>
        </div>
      </div>

      <div
        className={[
          "grid min-h-0 w-full flex-1 grid-cols-1 gap-[var(--shell-gap)] overflow-y-auto overscroll-contain",
          fullscreen ? "min-[901px]:grid-cols-1" : "min-[901px]:grid-cols-[240px_340px_1fr]",
        ].join(" ")}
      >
        {!fullscreen ? (
          <aside className="panelItem min-h-0 overflow-hidden rounded-[18px]" aria-label="Notes sidebar">
          <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <div className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/15 bg-white/10" aria-hidden="true">
              <i className="fa-solid fa-note-sticky text-white/85" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold tracking-[0.22em] text-white/55">QUICK LINKS</div>
              <div className="mt-1 truncate font-extrabold text-white/90">QuickQuill</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto pb-4" aria-label="Sidebar content">
            <nav className="px-3 pb-3" aria-label="Sidebar navigation">
              <button
                type="button"
                className={sidebarItemClass(view === "all")}
                data-focus="notes.inbox"
                onClick={() => {
                  setView("all");
                  setTagFilter(null);
                  setFolderFilter(null);
                }}
              >
                <i className="fa-solid fa-folder-open" aria-hidden="true" />
                <span className="notesSidebarItem__label">All notes</span>
                <span className="notesSidebarItem__count" aria-label="Notes count">
                  {counts.all}
                </span>
              </button>
              <button
                type="button"
                className={sidebarItemClass(view === "favorites")}
                data-focus="notes.sidebar.favorites"
                onClick={() => {
                  setView("favorites");
                  setTagFilter(null);
                  setFolderFilter(null);
                }}
              >
                <i className="fa-solid fa-star" aria-hidden="true" />
                <span className="notesSidebarItem__label">Favorites</span>
                <span className="notesSidebarItem__count">{counts.favorites}</span>
              </button>
              <button
                type="button"
                className={sidebarItemClass(view === "hidden")}
                data-focus="notes.sidebar.hidden"
                onClick={() => {
                  setUnlockPassword("");
                  setUnlockError(null);
                  setModal("unlockHidden");
                  setTagFilter(null);
                  setFolderFilter(null);
                }}
              >
                <i className="fa-solid fa-eye" aria-hidden="true" />
                <span className="notesSidebarItem__label">Hidden notes</span>
                <span className="notesSidebarItem__count" aria-label="Hidden notes count">•</span>
              </button>
              <button
                type="button"
                className={sidebarItemClass(view === "deleted")}
                data-focus="notes.sidebar.deleted"
                onClick={() => {
                  setView("deleted");
                  setTagFilter(null);
                  setFolderFilter(null);
                }}
              >
                <i className="fa-solid fa-trash-can" aria-hidden="true" />
                <span className="notesSidebarItem__label">Recently deleted</span>
                <span className="notesSidebarItem__count">{counts.deleted}</span>
              </button>
            </nav>

            <div className="flex items-center justify-between px-4 pb-2 pt-1">
              <div className="text-[11px] font-extrabold tracking-[0.22em] text-white/55">TAGS</div>
              <button type="button" className="notesMiniIconBtn gridCard" data-focus="notes.tag.add" aria-label="Create new tag" onClick={openCreateTagModal}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-2 px-3 pb-3">
              {store.tagCatalog.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={[
                      tagPillClass(tagFilter === t.id),
                      "notesRowItem",
                      "notesSidebarRow--draggable",
                      draggingTagId === t.id ? "notesSidebarRow--dragging" : "",
                      dragOverTagId === t.id && draggingTagId && draggingTagId !== t.id ? "notesSidebarRow--dragOver" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-focus={`notes.tag.${t.id}`}
                    onClick={() => {
                      if (suppressSidebarClickRef.current) return;
                      if (view === "deleted") setView("all");
                      setFolderFilter(null);
                      setTagFilter((cur) => (cur === t.id ? cur : t.id));
                    }}
                    draggable={view !== "deleted"}
                    onDragStart={(e) => {
                      if (view === "deleted") return;
                      suppressSidebarClickRef.current = true;
                      setDraggingTagId(t.id);
                      setDragOverTagId(null);
                      try {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", `tag:${t.id}`);
                      } catch {
                        // ignore
                      }
                    }}
                    onDragOver={(e) => {
                      if (view === "deleted") return;
                      if (!draggingTagId) return;
                      if (draggingTagId === t.id) return;
                      e.preventDefault();
                      setDragOverTagId(t.id);
                    }}
                    onDrop={(e) => {
                      if (view === "deleted") return;
                      e.preventDefault();
                      const from = draggingTagId || (() => {
                        try {
                          const raw = e.dataTransfer.getData("text/plain") || "";
                          return raw.startsWith("tag:") ? raw.slice(4) : "";
                        } catch {
                          return "";
                        }
                      })();
                      if (!from) return;
                      reorderCatalog("tag", from, t.id);
                      setDraggingTagId(null);
                      setDragOverTagId(null);
                      window.setTimeout(() => {
                        suppressSidebarClickRef.current = false;
                      }, 0);
                    }}
                    onDragEnd={() => {
                      setDraggingTagId(null);
                      setDragOverTagId(null);
                      window.setTimeout(() => {
                        suppressSidebarClickRef.current = false;
                      }, 0);
                    }}
                  >
                    <span className={["notesDot", t.dotClass].join(" ")} aria-hidden="true" />
                    <span className="flex-1 truncate">{t.label}</span>
                  </button>
                  <button
                    type="button"
                    className="notesInlineIconBtn gridCard"
                    aria-label={`Delete tag ${t.label}`}
                    onClick={() => openDeleteTagModal(t.id)}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 pb-2 pt-2">
              <div className="text-[11px] font-extrabold tracking-[0.22em] text-white/55">FOLDERS</div>
              <button type="button" className="notesMiniIconBtn gridCard" data-focus="notes.folder.add" aria-label="Create new folder" onClick={openCreateFolderModal}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
              </button>
            </div>
            <div className="px-3">
              <div className="grid gap-2">
                {store.folderCatalog.map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={[
                        sidebarItemClass(folderFilter === f.id),
                        "notesRowItem",
                        "notesSidebarRow--draggable",
                        draggingFolderId === f.id ? "notesSidebarRow--dragging" : "",
                        dragOverFolderId === f.id && draggingFolderId && draggingFolderId !== f.id ? "notesSidebarRow--dragOver" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-focus={`notes.folder.${f.id}`}
                      onClick={() => {
                        if (suppressSidebarClickRef.current) return;
                        if (view === "deleted") setView("all");
                        setTagFilter(null);
                        setFolderFilter((cur) => (cur === f.id ? cur : f.id));
                      }}
                      draggable={view !== "deleted"}
                      onDragStart={(e) => {
                        if (view === "deleted") return;
                        suppressSidebarClickRef.current = true;
                        setDraggingFolderId(f.id);
                        setDragOverFolderId(null);
                        try {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", `folder:${f.id}`);
                        } catch {
                          // ignore
                        }
                      }}
                      onDragOver={(e) => {
                        if (view === "deleted") return;
                        if (!draggingFolderId) return;
                        if (draggingFolderId === f.id) return;
                        e.preventDefault();
                        setDragOverFolderId(f.id);
                      }}
                      onDrop={(e) => {
                        if (view === "deleted") return;
                        e.preventDefault();
                        const from = draggingFolderId || (() => {
                          try {
                            const raw = e.dataTransfer.getData("text/plain") || "";
                            return raw.startsWith("folder:") ? raw.slice(7) : "";
                          } catch {
                            return "";
                          }
                        })();
                        if (!from) return;
                        reorderCatalog("folder", from, f.id);
                        setDraggingFolderId(null);
                        setDragOverFolderId(null);
                        window.setTimeout(() => {
                          suppressSidebarClickRef.current = false;
                        }, 0);
                      }}
                      onDragEnd={() => {
                        setDraggingFolderId(null);
                        setDragOverFolderId(null);
                        window.setTimeout(() => {
                          suppressSidebarClickRef.current = false;
                        }, 0);
                      }}
                    >
                      <i className="fa-solid fa-folder" aria-hidden="true" />
                      <span className="notesSidebarItem__label">{f.label}</span>
                    </button>
                    <button
                      type="button"
                      className="notesInlineIconBtn gridCard"
                      aria-label={`Delete folder ${f.label}`}
                      onClick={() => openDeleteFolderModal(f.id)}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </aside>
        ) : null}

        {!fullscreen ? (
          <section className="panelItem min-h-0 overflow-hidden rounded-[18px]" aria-label="Notes list">
          <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold tracking-[0.22em] text-white/55">NOTES</div>
              <div className="mt-1 truncate text-[18px] font-extrabold text-white/90">
                {view === "favorites"
                  ? "Favorites"
                  : view === "hidden"
                    ? "Hidden notes"
                    : view === "deleted"
                      ? "Recently deleted"
                      : folderFilter
                        ? folderLabelById[folderFilter] || folderFilter
                        : tagFilter
                          ? tagLabelById[tagFilter] || tagFilter
                           : "All notes"}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {view === "deleted" ? (
                <>
                  <button
                    type="button"
                    className="notesIconBtn gridCard"
                    data-focus="notes.list.restore"
                    aria-label="Restore note"
                    title="Restore"
                    onClick={restoreFromTrash}
                    disabled={!activeNote || !activeNote.deletedAt}
                  >
                    <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="notesIconBtn gridCard"
                    data-focus="notes.list.permanentDelete"
                    aria-label="Delete permanently"
                    title="Delete permanently"
                    onClick={requestPermanentDelete}
                    disabled={!activeNote || !activeNote.deletedAt}
                  >
                    <i className="fa-solid fa-trash-can" aria-hidden="true" />
                  </button>
                </>
              ) : null}
              {view !== "deleted" ? (
                <button
                  type="button"
                  className="notesIconBtn gridCard"
                  data-focus="notes.list.new"
                  aria-label="Create new note"
                  onClick={() => createDraft({ useTemplate: false })}
                >
                  <i className="fa-solid fa-plus" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-4 pb-3">
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

          <div className="flex-1 min-h-0 overflow-auto px-3 pb-3">
            <div className="grid gap-2" role="list" aria-label="Notes list items">
              {filteredNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={[
                    "notesListItem",
                    "gridCard",
                    view !== "deleted" ? "notesListItem--draggable" : "",
                    draggingId === n.id ? "notesListItem--dragging" : "",
                    dragOverId === n.id && draggingId && draggingId !== n.id ? "notesListItem--dragOver" : "",
                    n.id === activeId ? "notesListItem--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-focus={`notes.list.${n.id}`}
                  role="listitem"
                  onClick={() => setActiveId(n.id)}
                  draggable={view !== "deleted"}
                  onDragStart={(e) => {
                    if (view === "deleted") return;
                    setDraggingId(n.id);
                    setDragOverId(null);
                    try {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", n.id);
                    } catch {
                      // ignore
                    }
                  }}
                  onDragOver={(e) => {
                    if (view === "deleted") return;
                    if (!draggingId) return;
                    if (draggingId === n.id) return;
                    e.preventDefault();
                    setDragOverId(n.id);
                  }}
                  onDrop={(e) => {
                    if (view === "deleted") return;
                    e.preventDefault();
                    const from = draggingId || (() => {
                      try {
                        return e.dataTransfer.getData("text/plain") || "";
                      } catch {
                        return "";
                      }
                    })();
                    if (!from) return;
                    reorderVisibleNotes(from, n.id);
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
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
                    {n.folder ? ` | ${folderLabelById[n.folder] || n.folder}` : ""}
                    {n.tags.length
                      ? ` | ${n.tags
                          .map((id) => tagLabelById[id] || id)
                          .filter(Boolean)
                          .join(", ")}`
                      : ""}
                  </div>
                </button>
              ))}

              {filteredNotes.length === 0 ? (
                <div className="notesEmptyState" aria-label="No notes">
                  No notes match your filters.
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </section>
        ) : null}

        <article className="panelItem min-h-0 overflow-hidden rounded-[18px]" aria-label="Note preview">
          <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold tracking-[0.22em] text-white/55">PREVIEW</div>
              <div className="mt-1 truncate text-[18px] font-extrabold text-white/90">{activeNote?.title || "Select a note"}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {view === "deleted" || !!activeNote?.deletedAt ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="notesPrimaryBtn gridCard"
                    data-focus="notes.preview.restore"
                    aria-label="Restore note"
                    title="Restore"
                    onClick={restoreFromTrash}
                    disabled={!activeNote || !activeNote.deletedAt}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="notesPrimaryBtn notesPrimaryBtn--danger gridCard"
                    data-focus="notes.preview.permanentDelete"
                    aria-label="Delete permanently"
                    title="Delete permanently"
                    onClick={requestPermanentDelete}
                    disabled={!activeNote || !activeNote.deletedAt}
                  >
                    Delete permanently
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={["notesIconBtn", "gridCard", activeNote?.favorite ? "notesIconBtn--active" : ""].join(" ")}
                    data-focus="notes.preview.favorite"
                    aria-label="Favorite"
                    title="Favorite"
                    onClick={toggleFavorite}
                    disabled={!activeNote}
                  >
                    <i className={activeNote?.favorite ? "fa-solid fa-heart" : "fa-regular fa-heart"} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={["notesIconBtn", "gridCard", activeNote?.pinned ? "notesIconBtn--active" : ""].join(" ")}
                    data-focus="notes.preview.pin"
                    aria-label="Pin"
                    title="Pin"
                    onClick={togglePinned}
                    disabled={!activeNote}
                  >
                    <i className="fa-solid fa-thumbtack" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={["notesIconBtn", "gridCard", activeNote?.reminderAt ? "notesIconBtn--active" : ""].join(" ")}
                    data-focus="notes.preview.reminder"
                    aria-label="Reminder"
                    title="Reminder"
                    onClick={openReminderModal}
                    disabled={!activeNote}
                  >
                    <i className={activeNote?.reminderAt ? "fa-solid fa-bell" : "fa-regular fa-bell"} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={["notesIconBtn", "gridCard", activeNote?.hiddenAt ? "notesIconBtn--active" : ""].join(" ")}
                    data-focus="notes.preview.hide"
                    aria-label={activeNote?.hiddenAt ? "Unhide note" : "Hide note"}
                    title={activeNote?.hiddenAt ? "Unhide note" : "Hide note"}
                    onClick={requestHideNote}
                    disabled={!activeNote || !!activeNote?.deletedAt}
                  >
                    <i className={activeNote?.hiddenAt ? "fa-solid fa-eye" : "fa-solid fa-eye-slash"} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="notesTagsBtn gridCard"
                    data-focus="notes.preview.tagsPill"
                    aria-label="Tags"
                    title="Tags"
                    onClick={openTagsModal}
                    disabled={!activeNote}
                  >
                    <span className="notesFolderBtn__label">{tagsSummaryLabel}</span>
                    <i className="fa-solid fa-chevron-down notesFolderBtn__chev" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="notesFolderBtn gridCard"
                    data-focus="notes.preview.folder"
                    aria-label="Folder"
                    title="Folder"
                    onClick={openFolderModal}
                    disabled={!activeNote}
                  >
                    <span className="notesFolderBtn__label">{activeNote?.folder ? folderLabelById[activeNote.folder] || activeNote.folder : "No Folder"}</span>
                    <i className="fa-solid fa-chevron-down notesFolderBtn__chev" aria-hidden="true" />
                  </button>
                  <button type="button" className="notesIconBtn gridCard" data-focus="notes.preview.trash" aria-label="Move to trash" title="Delete" onClick={moveToTrash} disabled={!activeNote || !!activeNote?.deletedAt}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="notesPrimaryBtn gridCard"
                    data-focus="notes.preview.edit"
                    aria-label={editing ? "Preview note" : "Edit note"}
                    onClick={() => setEditing((v) => !v)}
                    disabled={!activeNote}
                  >
                    {editing ? "Preview" : "Edit note"}
                  </button>
                </>
              )}
            </div>
          </div>

          {view === "deleted" || !!activeNote?.deletedAt ? null : (
          <div className="notesToolbar" aria-label="Editor toolbar">
            <button
              type="button"
              className={["notesToolBtn", "notesToolBtn--text", "gridCard", formatActive.block === "h1" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.h1"
              aria-label="Heading 1"
              title="Heading 1 (H1)"
              aria-pressed={formatActive.block === "h1"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBlock("h1")}
              disabled={!activeNote || !editing}
            >
              H1
            </button>
            <button
              type="button"
              className={["notesToolBtn", "notesToolBtn--text", "gridCard", formatActive.block === "h2" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.h2"
              aria-label="Heading 2"
              title="Heading 2 (H2)"
              aria-pressed={formatActive.block === "h2"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBlock("h2")}
              disabled={!activeNote || !editing}
            >
              H2
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.block === "p" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.p"
              aria-label="Paragraph"
              title="Paragraph"
              aria-pressed={formatActive.block === "p"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBlock("p")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-paragraph" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.bold ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.bold"
              aria-label="Bold"
              title="Bold"
              aria-pressed={formatActive.bold}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("bold")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.italic ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.italic"
              aria-label="Italic"
              title="Italic"
              aria-pressed={formatActive.italic}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("italic")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-italic" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.underline ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.underline"
              aria-label="Underline"
              title="Underline"
              aria-pressed={formatActive.underline}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("underline")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-underline" aria-hidden="true" />
            </button>
            <span className="notesToolbar__sep" aria-hidden="true" />
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.ul ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.ul"
              aria-label="Bulleted list"
              title="Bulleted list"
              aria-pressed={formatActive.ul}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertUnorderedList")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-list-ul" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.ol ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.ol"
              aria-label="Numbered list"
              title="Numbered list"
              aria-pressed={formatActive.ol}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertOrderedList")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-list-ol" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="notesToolBtn gridCard"
              data-focus="notes.tool.checklist"
              aria-label="Checklist"
              title="Checklist"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertChecklist}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-list-check" aria-hidden="true" />
            </button>
            <span className="notesToolbar__sep" aria-hidden="true" />
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.align === "left" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.align.left"
              aria-label="Align left"
              title="Align left"
              aria-pressed={formatActive.align === "left"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyLeft")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-align-left" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.align === "center" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.align.center"
              aria-label="Align center"
              title="Align center"
              aria-pressed={formatActive.align === "center"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyCenter")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-align-center" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.align === "right" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.align.right"
              aria-label="Align right"
              title="Align right"
              aria-pressed={formatActive.align === "right"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyRight")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-align-right" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={["notesToolBtn", "gridCard", formatActive.align === "justify" ? "notesToolBtn--active" : ""].join(" ")}
              data-focus="notes.tool.align.justify"
              aria-label="Justify"
              title="Justify"
              aria-pressed={formatActive.align === "justify"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("justifyFull")}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-align-justify" aria-hidden="true" />
            </button>
            <span className="notesToolbar__sep" aria-hidden="true" />
            <button
              type="button"
              className="notesToolBtn gridCard"
              data-focus="notes.tool.image"
              aria-label="Insert image"
              title="Insert image"
              onMouseDown={(e) => e.preventDefault()}
              onClick={pickImage}
              disabled={!activeNote || !editing}
            >
              <i className="fa-regular fa-image" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="notesToolBtn gridCard"
              data-focus="notes.tool.link"
              aria-label="Insert link"
              title="Insert link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertLink}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-link" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="notesToolBtn gridCard"
              data-focus="notes.tool.color"
              aria-label="Text color"
              title="Text color"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openTextColorModal}
              disabled={!activeNote || !editing}
            >
              <i className="fa-solid fa-palette" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="notesToolBtn gridCard"
              data-focus="notes.tool.undo"
              aria-label="Undo"
              title="Undo"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("undo")}
              disabled={!activeNote || !editing || !formatActive.canUndo}
            >
              <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="notesToolBtn gridCard"
              data-focus="notes.tool.redo"
              aria-label="Redo"
              title="Redo"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("redo")}
              disabled={!activeNote || !editing || !formatActive.canRedo}
            >
              <i className="fa-solid fa-arrow-rotate-right" aria-hidden="true" />
            </button>
            <span className="notesToolbar__sep" aria-hidden="true" />
            <button
              type="button"
              className={["notesToolBtn", "gridCard", recording.state === "recording" ? "notesToolBtn--rec" : ""].join(" ")}
              data-focus="notes.tool.voice"
              aria-label={recording.state === "recording" ? "Stop recording" : "Start voice recording"}
              title={recording.state === "recording" ? "Stop recording" : "Start voice recording"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (recording.state === "recording" ? stopRecording() : startRecording())}
              disabled={!activeNote || !editing || recording.state === "saving"}
            >
              <i className="fa-solid fa-microphone" aria-hidden="true" />
            </button>
            {recording.state === "recording" ? (
              <div className="notesRecPill" aria-label="Recording indicator">
                <span className="notesRecDot" aria-hidden="true" />
                REC {String(Math.floor(recording.seconds / 60)).padStart(2, "0")}:{String(recording.seconds % 60).padStart(2, "0")}
              </div>
            ) : null}
          </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto px-5 pb-5">
            {activeNote ? (
              <>
                <input
                  className="notesEditorTitle"
                  value={activeNote.title}
                  onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                  aria-label="Note title"
                  data-focus="notes.preview.title"
                  readOnly={!editing || !!activeNote.deletedAt}
                />

                {editing ? (
                  <div
                    ref={editorRef}
                    className="notesEditorBodyRich"
                    contentEditable={!activeNote.deletedAt}
                    suppressContentEditableWarning
                    data-placeholder="Write something..."
                    aria-label="Note content"
                    data-focus="notes.preview.body"
                    tabIndex={0}
                    onInput={() => {
                      saveEditorToStore();
                      refreshFormat();
                    }}
                    onKeyUp={refreshFormat}
                    onMouseUp={refreshFormat}
                    onFocus={refreshFormat}
                    onPaste={(e) => {
                      try {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text/plain");
                        document.execCommand("insertText", false, text);
                      } catch {
                        // ignore
                      }
                    }}
                    onClick={(e) => {
                      const t = e.target as HTMLElement | null;
                      const cb = t?.closest?.(".notesChecklistBox") as HTMLInputElement | null;
                      if (cb) {
                        // Checkbox toggles don't trigger onInput; persist explicitly.
                        window.setTimeout(() => {
                          try {
                            if (cb.checked) cb.setAttribute("checked", "");
                            else cb.removeAttribute("checked");
                            saveEditorToStore();
                          } catch {
                            // ignore
                          }
                        }, 0);
                        return;
                      }
                      const btn = t?.closest?.('[data-action="delete-asset"]') as HTMLElement | null;
                      if (!btn) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const id = btn.getAttribute("data-asset-id") || "";
                      if (!id) return;
                      void deleteAttachment(id);
                    }}
                  />
                ) : (
                  <div
                    ref={previewRef}
                    className="notesPreviewBody notesPreviewBody--html"
                    data-focus="notes.preview"
                    tabIndex={0}
                    aria-label="Note preview content"
                    onClick={(e) => {
                      const t = e.target as HTMLElement | null;
                      const cb = t?.closest?.(".notesChecklistBox") as HTMLInputElement | null;
                      if (cb) {
                        window.setTimeout(() => {
                          try {
                            if (cb.checked) cb.setAttribute("checked", "");
                            else cb.removeAttribute("checked");
                            savePreviewToStore();
                          } catch {
                            // ignore
                          }
                        }, 0);
                        return;
                      }
                      const btn = t?.closest?.('[data-action="delete-asset"]') as HTMLElement | null;
                      if (!btn) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const id = btn.getAttribute("data-asset-id") || "";
                      if (!id) return;
                      void deleteAttachment(id);
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        sanitizeNoteHtml(htmlForNote(activeNote)) ||
                        '<span class="notesPreviewEmpty">No content yet.</span>',
                    }}
                  />
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0] || null;
                    e.currentTarget.value = "";
                    void onPickImage(f);
                  }}
                />

                <input
                  ref={colorInputRef}
                  type="color"
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => {
                    const v = e.currentTarget.value || "";
                    e.currentTarget.value = "";
                    onPickTextColor(v);
                  }}
                />
              </>
            ) : (
              <div className="notesEmptyPreview" aria-label="No note selected">
                Select a note from the list, or create a new one.
              </div>
            )}
          </div>
          </div>
        </article>
      </div>

      {modal ? (
        <div className="studiumModal" role="dialog" aria-modal="true" aria-label="Notes modal">
          <button type="button" className="studiumModalOverlay" aria-label="Close modal" onClick={closeModal} />
          <div
            className={[
              "studiumModalPanel",
              modal === "deleteNote" || modal === "permanentDeleteNote" || modal === "deleteTag" || modal === "deleteFolder" ? "studiumModalPanel--danger" : "",
            ].join(" ")}
          >
            <div className="studiumModalTop">
              <div className="studiumModalTitleWrap">
                <div className="studiumModalKicker">NOTES</div>
                {modal === "deleteNote" ? <div className="studiumModalTitle studiumModalTitle--danger">Delete note</div> : null}
                {modal === "permanentDeleteNote" ? (
                  <div className="studiumModalTitle studiumModalTitle--danger">Delete permanently</div>
                ) : null}
                {modal === "deleteTag" ? <div className="studiumModalTitle studiumModalTitle--danger">Delete tag</div> : null}
                {modal === "deleteFolder" ? <div className="studiumModalTitle studiumModalTitle--danger">Delete folder</div> : null}
                {modal === "hideNote" ? <div className="studiumModalTitle">Hide note</div> : null}
                {modal === "unlockHidden" ? <div className="studiumModalTitle">Unlock hidden notes</div> : null}
                {modal === "reminder" ? <div className="studiumModalTitle">Reminder</div> : null}
                {modal === "textColor" ? <div className="studiumModalTitle">Text color</div> : null}
                {modal === "insertLink" ? <div className="studiumModalTitle">Insert link</div> : null}
                {modal === "leaveUnsaved" ? <div className="studiumModalTitle">Unsaved note</div> : null}
                {modal === "createTag" ? <div className="studiumModalTitle">Create tag</div> : null}
                {modal === "createFolder" ? <div className="studiumModalTitle">Create folder</div> : null}
                {modal === "tags" ? <div className="studiumModalTitle">Add tags to note</div> : null}
                {modal === "folder" ? <div className="studiumModalTitle">Add folder to note</div> : null}

                {modal === "deleteNote" ? <div className="studiumModalSubtitle">Are you sure you want to delete this note?</div> : null}
                {modal === "permanentDeleteNote" ? (
                  <div className="studiumModalSubtitle">This cannot be undone. Delete this note permanently?</div>
                ) : null}
                {modal === "deleteTag" ? <div className="studiumModalSubtitle">Are you sure you want to delete this tag?</div> : null}
                {modal === "deleteFolder" ? <div className="studiumModalSubtitle">Are you sure you want to delete this folder?</div> : null}
                {modal === "hideNote" ? <div className="studiumModalSubtitle">Do you want to hide this note?</div> : null}
                {modal === "unlockHidden" ? <div className="studiumModalSubtitle">Enter password to view hidden notes.</div> : null}
                {modal === "reminder" ? <div className="studiumModalSubtitle">Set a reminder time for this note.</div> : null}
                {modal === "textColor" ? <div className="studiumModalSubtitle">Pick a color, or enter RGB values.</div> : null}
                {modal === "insertLink" ? <div className="studiumModalSubtitle">Paste a URL to create a link from your selection.</div> : null}
                {modal === "leaveUnsaved" ? <div className="studiumModalSubtitle">You haven’t saved this note yet. Leave without saving?</div> : null}
                {modal === "createTag" ? <div className="studiumModalSubtitle">Create a new tag for your sidebar.</div> : null}
                {modal === "createFolder" ? <div className="studiumModalSubtitle">Create a new folder for your sidebar.</div> : null}
                {modal === "tags" ? <div className="studiumModalSubtitle">Choose one or more tags for this note.</div> : null}
                {modal === "folder" ? <div className="studiumModalSubtitle">Click a folder to assign. Click it again to unassign.</div> : null}
              </div>
              <button type="button" className="studiumModalClose gridCard" aria-label="Close" onClick={closeModal}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="studiumModalBody" aria-label="Modal content">
              {modal === "deleteNote" ? (
                <div className="panelItem rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-white/80">
                  <div className="truncate text-white/90">{activeNote?.title || "Untitled"}</div>
                  <div className="mt-1 text-[12px] font-extrabold text-white/55">This note will be moved to Recently deleted.</div>
                </div>
              ) : null}

              {modal === "permanentDeleteNote" ? (
                <div className="panelItem rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-white/80">
                  <div className="truncate text-white/90">{activeNote?.title || "Untitled"}</div>
                  <div className="mt-1 text-[12px] font-extrabold text-white/55">Attachments (images/recordings) will also be removed.</div>
                </div>
              ) : null}

              {modal === "hideNote" ? (
                <div className="panelItem rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-white/80">
                  <div className="truncate text-white/90">{activeNote?.title || "Untitled"}</div>
                  <div className="mt-1 text-[12px] font-extrabold text-white/55">Hidden notes are protected with a password.</div>
                </div>
              ) : null}

              {modal === "unlockHidden" ? (
                <div className="grid gap-2" aria-label="Unlock hidden notes">
                  <div className="notesSearchWrap">
                    <i className="fa-solid fa-lock text-white/55" aria-hidden="true" />
                    <input
                      className="notesSearchInput"
                      type="password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      placeholder="Password..."
                      aria-label="Hidden notes password"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmUnlockHidden();
                      }}
                    />
                  </div>
                  {unlockError ? <div className="text-[12px] font-extrabold text-red-200/90">{unlockError}</div> : null}
                </div>
              ) : null}

              {modal === "reminder" ? (
                <div className="grid gap-3" aria-label="Reminder settings">
                  <div className="notesSearchWrap">
                    <i className="fa-regular fa-clock text-white/55" aria-hidden="true" />
                    <input
                      className="notesSearchInput"
                      type="datetime-local"
                      value={reminderDraft}
                      onChange={(e) => setReminderDraft(e.target.value)}
                      aria-label="Reminder time"
                    />
                  </div>
                  <div className="text-[12px] font-extrabold text-white/55">Leave empty to remove the reminder.</div>
                </div>
              ) : null}

              {modal === "textColor" ? (
                <div className="grid gap-3" aria-label="Text color settings">
                  <div className="flex flex-wrap items-center gap-2" aria-label="Quick colors">
                    {["#ffffff", "#cbe6ff", "#b8ffd5", "#ffe2a6", "#ffd1f0", "#d9c7ff", "#ffb4b4", "#9bd3ff", "#7cf0b5", "#f2f2f2"].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className="notesColorSwatch gridCard"
                        aria-label={`Pick ${hex}`}
                        title={hex}
                        style={{ background: hex }}
                        onClick={() => applyTextColor(hex)}
                      />
                    ))}
                  </div>

                  <div className="grid gap-2" aria-label="Advanced color">
                    <div className="notesSearchWrap">
                      <i className="fa-solid fa-hashtag text-white/55" aria-hidden="true" />
                      <input
                        className="notesSearchInput"
                        value={textColorDraft.hex}
                        onChange={(e) => {
                          const v = e.target.value || "";
                          const rgb = hexToRgb(v);
                          setTextColorDraft({ hex: v, r: rgb.r, g: rgb.g, b: rgb.b });
                        }}
                        placeholder="#rrggbb"
                        aria-label="Hex color"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(["r", "g", "b"] as const).map((k) => (
                        <div key={k} className="notesSearchWrap">
                          <span className="text-[12px] font-extrabold text-white/55">{k.toUpperCase()}</span>
                          <input
                            className="notesSearchInput"
                            type="number"
                            min={0}
                            max={255}
                            value={textColorDraft[k]}
                            onChange={(e) => {
                              const next = clamp255(Number(e.target.value));
                              setTextColorDraft((prev) => {
                                const r = k === "r" ? next : prev.r;
                                const g = k === "g" ? next : prev.g;
                                const b = k === "b" ? next : prev.b;
                                return { hex: rgbToHex(r, g, b), r, g, b };
                              });
                            }}
                            aria-label={`RGB ${k}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {modal === "insertLink" ? (
                <div className="grid gap-3" aria-label="Insert link form">
                  <div className="notesSearchWrap">
                    <i className="fa-solid fa-link text-white/55" aria-hidden="true" />
                    <input
                      autoFocus
                      className="notesSearchInput"
                      value={linkUrlDraft}
                      onChange={(e) => {
                        setLinkUrlDraft(e.target.value);
                        if (linkError) setLinkError(null);
                      }}
                      placeholder="https://example.com"
                      aria-label="Link URL"
                      inputMode="url"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmInsertLink();
                      }}
                    />
                  </div>
                  {linkError ? <div className="text-[12px] font-extrabold text-red-200/90">{linkError}</div> : null}
                  <div className="text-[12px] font-extrabold text-white/55">Tip: if you omit the scheme, it will assume https://</div>
                </div>
              ) : null}

              {modal === "leaveUnsaved" ? (
                <div className="panelItem rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-white/80">
                  <div className="truncate text-white/90">{activeNote?.title || "Untitled"}</div>
                  <div className="mt-1 text-[12px] font-extrabold text-white/55">Choose “Save first” to keep it, or “Leave” to discard it.</div>
                </div>
              ) : null}

              {modal === "deleteTag" || modal === "deleteFolder" ? (
                <div className="panelItem rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-white/80">
                  <div className="truncate text-white/90">{deleteTarget?.label || "Untitled"}</div>
                  <div className="mt-1 text-[12px] font-extrabold text-white/55">
                    {modal === "deleteTag" ? "This tag will be removed from all notes." : "Notes in this folder will be unassigned from any folder."}
                  </div>
                </div>
              ) : null}

              {modal === "createTag" ? (
                <div className="grid gap-3" aria-label="Create tag form">
                  <div className="notesSearchWrap">
                    <i className="fa-solid fa-tag text-white/55" aria-hidden="true" />
                    <input
                      className="notesSearchInput"
                      value={newTagLabel}
                      onChange={(e) => setNewTagLabel(e.target.value)}
                      placeholder="Tag name..."
                      aria-label="Tag name"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2" aria-label="Tag color">
                    {TAG_DOT_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={["notesMiniIconBtn", "gridCard", newTagDotClass === c ? "ring-2 ring-white/50" : ""].join(" ")}
                        aria-label={`Pick color ${c}`}
                        onClick={() => setNewTagDotClass(c)}
                      >
                        <span className={["notesDot", c].join(" ")} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {modal === "createFolder" ? (
                <div className="grid gap-3" aria-label="Create folder form">
                  <div className="notesSearchWrap">
                    <i className="fa-solid fa-folder text-white/55" aria-hidden="true" />
                    <input
                      className="notesSearchInput"
                      value={newFolderLabel}
                      onChange={(e) => setNewFolderLabel(e.target.value)}
                      placeholder="Folder name..."
                      aria-label="Folder name"
                    />
                  </div>
                </div>
              ) : null}

              {modal === "tags" ? (
                <div className="grid gap-2" aria-label="Tag selection">
                  {store.tagCatalog.map((t) => (
                    <label
                      key={t.id}
                      className="panelItem flex cursor-pointer items-center justify-between gap-3 rounded-[18px] px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={["notesDot", t.dotClass].join(" ")} aria-hidden="true" />
                        <span className="truncate text-[13px] font-extrabold text-white/90">{t.label}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={!!modalTags[t.id]}
                        onChange={() => setModalTags((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                        aria-label={`Toggle tag ${t.label}`}
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {modal === "folder" ? (
                <div className="grid gap-2" aria-label="Folder selection">
                  {store.folderCatalog.map((f) => {
                    const active = modalFolder === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={[
                          "panelItem",
                          "flex items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-left",
                          active ? "ring-2 ring-white/35" : "",
                        ].join(" ")}
                        aria-pressed={active}
                        onClick={() => setModalFolder((cur) => (cur === f.id ? null : f.id))}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <i className="fa-solid fa-folder text-white/70" aria-hidden="true" />
                          <span className="truncate text-[13px] font-extrabold text-white/90">{f.label}</span>
                        </span>
                        {active ? <i className="fa-solid fa-check text-white/85" aria-hidden="true" /> : <span aria-hidden="true" />}
                      </button>
                    );
                  })}
                  {store.folderCatalog.length === 0 ? (
                    <div className="panelItem rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-white/70">No folders yet. Create one from the left sidebar.</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              {modal !== "leaveUnsaved" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={closeModal}>
                  Cancel
                </button>
              ) : null}
              {modal === "deleteNote" ? (
                <button
                  type="button"
                  className="notesPrimaryBtn notesPrimaryBtn--danger gridCard"
                  onClick={confirmMoveToTrash}
                  disabled={!activeNote || !!activeNote.deletedAt}
                >
                  Delete
                </button>
              ) : null}
              {modal === "permanentDeleteNote" ? (
                <button
                  type="button"
                  className="notesPrimaryBtn notesPrimaryBtn--danger gridCard"
                  onClick={() => void confirmPermanentDelete()}
                  disabled={!activeNote || !activeNote.deletedAt}
                >
                  Delete permanently
                </button>
              ) : null}
              {modal === "deleteTag" ? (
                <button type="button" className="notesPrimaryBtn notesPrimaryBtn--danger gridCard" onClick={confirmDeleteTag} disabled={!deleteTarget}>
                  Delete
                </button>
              ) : null}
              {modal === "deleteFolder" ? (
                <button type="button" className="notesPrimaryBtn notesPrimaryBtn--danger gridCard" onClick={confirmDeleteFolder} disabled={!deleteTarget}>
                  Delete
                </button>
              ) : null}
              {modal === "hideNote" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={confirmHideNote} disabled={!activeNote || !!activeNote.deletedAt}>
                  Hide
                </button>
              ) : null}
              {modal === "unlockHidden" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={confirmUnlockHidden} disabled={!unlockPassword.trim()}>
                  Unlock
                </button>
              ) : null}
              {modal === "tags" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={saveTagsModal} disabled={!activeNote}>
                  Save
                </button>
              ) : null}
              {modal === "folder" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={saveFolderModal} disabled={!activeNote}>
                  Save
                </button>
              ) : null}
              {modal === "reminder" ? (
                <>
                  <button type="button" className="notesPrimaryBtn notesPrimaryBtn--danger gridCard" onClick={clearReminder} disabled={!activeNote || !activeNote.reminderAt}>
                    Clear
                  </button>
                  <button type="button" className="notesPrimaryBtn gridCard" onClick={saveReminder} disabled={!activeNote}>
                    Save
                  </button>
                </>
              ) : null}
              {modal === "textColor" ? (
                <>
                  <button type="button" className="notesPrimaryBtn gridCard" onClick={pickTextColor} disabled={!activeNote || !editing}>
                    More…
                  </button>
                  <button type="button" className="notesPrimaryBtn gridCard" onClick={() => applyTextColor(textColorDraft.hex)} disabled={!activeNote || !editing}>
                    Apply
                  </button>
                </>
              ) : null}
              {modal === "insertLink" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={confirmInsertLink} disabled={!editing || !linkUrlDraft.trim()}>
                  Insert
                </button>
              ) : null}
              {modal === "leaveUnsaved" ? (
                <>
                  <button type="button" className="notesPrimaryBtn notesPrimaryBtn--danger gridCard" onClick={confirmLeaveWithoutSaving}>
                    Leave
                  </button>
                  <button type="button" className="notesPrimaryBtn gridCard" onClick={confirmSaveAndLeave} disabled={!activeNote}>
                    Save first
                  </button>
                </>
              ) : null}
              {modal === "createTag" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={createTag} disabled={!newTagLabel.trim()}>
                  Create
                </button>
              ) : null}
              {modal === "createFolder" ? (
                <button type="button" className="notesPrimaryBtn gridCard" onClick={createFolder} disabled={!newFolderLabel.trim()}>
                  Create
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
