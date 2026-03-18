import fs from "node:fs";
import path from "node:path";

const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);

function titleFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/^\s*\d+\s*([._-]\s*)?/, "").replace(/[_-]+/g, " ").trim() || base;
  return cleaned.replace(/([a-z])([A-Z])/g, "$1 $2").trim() || cleaned;
}

function main() {
  const playlistDir = path.join(process.cwd(), "public", "sound", "playlist");
  const manifestPath = path.join(playlistDir, "manifest.json");

  fs.mkdirSync(playlistDir, { recursive: true });

  const entries = fs.readdirSync(playlistDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => AUDIO_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  const tracks = files.map((name) => ({
    src: `/sound/playlist/${encodeURIComponent(name)}`,
    title: titleFromFilename(name),
  }));

  const json = JSON.stringify({ tracks }, null, 2) + "\n";
  fs.writeFileSync(manifestPath, json, "utf8");
  console.log(`[playlist] wrote ${tracks.length} track(s) -> public/sound/playlist/manifest.json`);
}

main();
