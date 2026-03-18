import fs from "node:fs";
import path from "node:path";

export type PlaylistTrack = {
  src: string;
  title: string;
};

const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);

function titleFromFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  // Strip common leading ordering like "01_", "1-", "02. "
  return base.replace(/^\s*\d+\s*([._-]\s*)?/, "").trim() || base;
}

export function getPlaylistTracks(): PlaylistTrack[] {
  try {
    const dir = path.join(process.cwd(), "public", "sound", "playlist");
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => AUDIO_EXT.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    return files.map((name) => ({
      src: `/sound/playlist/${encodeURIComponent(name)}`,
      title: titleFromFilename(name),
    }));
  } catch {
    return [];
  }
}
