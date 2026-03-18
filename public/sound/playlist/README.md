Put your audio files here (e.g. `.mp3` / `.wav`).

This folder is scanned at runtime to build the in-app playlist.

Deploy note (Vercel): your songs must be present in the deployed build. If you keep the default `.gitignore` here, your audio files won't be pushed to GitHub and Vercel won't have anything to play. Options:
- Remove `public/sound/playlist/.gitignore` and commit your audio files (not recommended for copyrighted content).
- Host the audio elsewhere and list URLs in `public/sound/playlist/manifest.json`.
- Use a storage service (e.g. Vercel Blob) and populate `manifest.json` with those URLs.
