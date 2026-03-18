# Studium

Studium (gabungan dari kata *Study* dan *Podium*) adalah aplikasi web yang dirancang untuk menciptakan lingkungan belajar yang bebas distraksi bagi mahasiswa dan pelajar.

Ide pengembangan Studium terinspirasi dari tren perangkat *portable gaming console* modern (Steam Deck, ROG Ally, dan sejenisnya) yang memakai sistem operasi khusus agar pemain dapat masuk dan fokus sepenuhnya ke dalam “dunia permainan”. Konsep ini kami adaptasi ke ranah edukasi: saat belajar menggunakan laptop/PC, pelajar sering terdistraksi oleh tab browser lain, notifikasi, maupun aplikasi hiburan.

Studium menghadirkan **Focus Mode** (fullscreen) sebagai antarmuka “konsol belajar” yang imersif. Dengan UI/UX yang *beautiful*, intuitif, dan *fun to use*, pengguna tidak hanya “dipaksa” fokus, melainkan didorong untuk benar-benar menikmati sesi belajar mereka. Didukung konsep gamifikasi, Studium hadir tidak sekadar sebagai alat manajemen tugas, tetapi juga sebagai ruang di mana belajar terasa semenarik bermain game, sehingga produktivitas meningkat secara alami.

Maskot Studium adalah **Blocky** (karakter pemandu di berbagai layar dan aset UI).

## Informasi

- Nama Website: **Studium**
- Nama Tim: **SUNIBngalam**
- Backend: **Tidak ada backend terpisah**. Aplikasi fokus pada prototyping UI/UX dan menggunakan data mock/seed + penyimpanan lokal.

## Fitur Utama

- **Notes**: catatan interaktif untuk membuat, menyimpan, dan merangkum materi dalam satu tempat yang terorganisasi.
- **Quest**: sistem gamifikasi berbasis misi/tantangan (tugas harian/mingguan) untuk memotivasi dan menjaga konsistensi belajar.
- **Schedule**: manajemen waktu untuk mengatur jadwal aktivitas, merencanakan sesi belajar, dan memantau *deadline*.
- **Study Room**: ruang belajar fokus yang membantu pengguna meminimalkan distraksi.
- **Battle**: fitur kompetitif untuk menantang teman/pengguna lain dan membandingkan progres belajar.
- **Dashboard**: ringkasan harian (quests, streak, widgets) agar pengguna tahu apa yang perlu dikerjakan sekarang.
- **Pomodoro** dan **Routine**: mendukung ritme belajar (timer, langkah next action, dan kebiasaan).

## Konsep: Focus Mode

Focus Mode didesain seperti *launcher* console:

- Navigasi yang ramah keyboard (dan tetap nyaman di touch).
- Visual “glass” dan *tint* per halaman untuk suasana yang konsisten.
- *Fullscreen-first layout* untuk membantu pengguna tetap fokus.

## Teknologi

- **Next.js 16 (App Router)** + **React 18** + **TypeScript**
- Styling: kombinasi **CSS Modules** (komponen) dan CSS global (shell/legacy styling)
- Data & prototyping:
  - Seed UI dan konten demo: `data/app-data.json`
  - Persistensi ringan: LocalStorage (misalnya state planner/quests dan preferensi UI)
  - SQLite lokal (opsional untuk mock auth/session): `lib/sqlite.ts` (menggunakan `node:sqlite`)

Catatan: endpoint `app/api/*` yang ada ditujukan untuk mendukung interaksi UI (mock), bukan sebagai backend produksi terpisah.

## Menjalankan Secara Lokal

Prasyarat:

- Node.js **22+** (dibutuhkan untuk modul bawaan `node:sqlite`)

Install dependencies:

```bash
npm install
```

Jalankan mode development:

```bash
npm run dev
```

Buka:

- `http://localhost:3000`

Jika PowerShell memblokir `npm` (misalnya `npm.ps1` tidak diizinkan), gunakan:

```bash
npm.cmd install
npm.cmd run dev
```

Build produksi:

```bash
npm run build
npm run start
```

## Struktur Project (Ringkas)

- `app/` — routing Next.js (App Router)
  - `app/(shell)/` — halaman utama setelah login/onboarding (Dashboard, Quest, Notes, Battle, dll.)
  - `app/(auth)/` — halaman autentikasi/onboarding
  - `app/api/` — endpoint mock untuk kebutuhan UI
  - `app/styles/` — styling global (legacy + shell responsive)
- `components/` — komponen UI (grids, battle, quick settings, dan lain-lain)
- `lib/` — utilitas, data layer prototyping, auth mock, dan helper SQLite
- `data/` — data seed (`app-data.json`) dan file DB lokal (jika digunakan)
- `public/` — aset (wallpaper, audio, dan maskot Blocky). Favicon tab menggunakan PFP Blocky.

## Akun Demo (jika SQLite aktif)

Saat dijalankan lokal, database SQLite dapat men-seed akun demo untuk memudahkan testing.

- Email: `demo@studium.local`
- Password: `demo1234`

## Catatan Pengembangan

- Banyak data bersifat demo/mock untuk mempercepat iterasi UI/UX.
- Fokus utama repo ini adalah pengalaman “konsol belajar” dengan maskot **Blocky** sebagai identitas visual.
