# Short-Link 🚀

Aplikasi pemendek tautan *(URL shortener)* berbasis **Node.js + Express + SQLite** dengan dashboard admin, bookmark bertingkat, QR code, catatan WYSIWYG, dan editor/reader dokumen Markdown.

---

## ✨ Fitur

### 🌐 Publik
| Fitur | Keterangan |
|-------|-----------|
| Pemendek Tautan | Masukkan URL panjang, dapatkan tautan pendek yang bisa dibagikan |
| QR Code | Setiap tautan pendek otomatis bisa ditampilkan sebagai QR code |
| Redirect Otomatis | Akses tautan pendek → langsung dialihkan ke URL asli |
| Click Counter | Statistik jumlah klik tiap tautan |

### 🔐 Admin Dashboard
| Fitur | Keterangan |
|-------|-----------|
| Autentikasi JWT | Login admin dengan token 24 jam |
| Kelola Tautan | CRUD tautan pendek + statistik klik |
| Kelola Bookmark | Bookmark dengan folder bertingkat *(nested folders)* |
| QR Code | Generate QR code untuk tiap tautan & bookmark |
| Catatan (Notes) | Editor WYSIWYG dengan Quill.js |
| Markdown Docs | Editor & reader dokumen Markdown + drag & drop upload file `.md` |

---

## 📋 Prasyarat

- **Node.js** v18 atau lebih baru
- **npm** (otomatis terinstal bersama Node.js)

---

## ⚙️ Cara Setup & Menjalankan

### 1. Clone / masuk ke direktori proyek
```bash
cd /www/wwwroot/short-link
```

### 2. Install dependencies
```bash
npm install
```

### 3. Konfigurasi (opsional)
Variabel lingkungan bisa diatur sebelum menjalankan:

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `4000` | Port server |
| `JWT_SECRET` | `your-secret-key-change-this-in-production` | Secret key JWT |

Contoh:
```bash
export PORT=3000
export JWT_SECRET=secret-key-super-aman
```

### 4. Jalankan server
```bash
npm start
```

Server akan berjalan di **http://localhost:4000** (atau port yang dikonfigurasi).

Database SQLite (`shortlink.db`) dibuat otomatis saat pertama kali server dijalankan, beserta seluruh tabel yang dibutuhkan.

### 5. Akses Admin Dashboard
Buka **http://localhost:4000/admin/login** dan login dengan kredensial default.

---

## 🔑 Kredensial Admin Default

| Username | Password |
|----------|----------|
| `admin` | `admin123` |

> ⚠️ **Ubah password admin** segera setelah login pertama untuk keamanan.

---

## 🗂️ Struktur Proyek

```
short-link/
├── index.js              # Entry point (backward-compat) -> require('./src/server')
├── src/                  # Kode aplikasi (modular)
│   ├── server.js         # Entry server: inisialisasi DB + listen
│   ├── app.js            # Assembly Express (middleware + mount semua route)
│   ├── config.js         # Konfigurasi (PORT, JWT_SECRET, path)
│   ├── db/
│   │   ├── connection.js # Koneksi SQLite
│   │   ├── queries.js    # Helper query promisified (async/await)
│   │   └── init.js       # Skema tabel + seed admin
│   ├── middleware/
│   │   └── auth.js       # Autentikasi JWT (authenticateToken)
│   ├── utils/
│   │   ├── asyncHandler.js  # Wrapper route async
│   │   └── validators.js    # Util validasi URL
│   └── routes/           # 8 router terpisah per domain
│       ├── public.routes.js    # GET /, POST /api/shorten, GET /:shortCode
│       ├── auth.routes.js      # GET /admin/* + POST /api/admin/login
│       ├── link.routes.js      # CRUD tautan  (/api/admin/links)
│       ├── folder.routes.js    # CRUD folder  (/api/admin/folders)
│       ├── bookmark.routes.js  # CRUD bookmark (/api/admin/bookmarks)
│       ├── bookmarkTree.routes.js # Tree folder+bookmark (/api/admin/bookmarks-tree)
│       ├── note.routes.js      # CRUD catatan  (/api/admin/notes)
│       └── markdown.routes.js  # CRUD markdown (/api/admin/markdown)
├── package.json
├── shortlink.db          # File database SQLite (dibuat otomatis)
└── public/
    ├── index.html        # Halaman publik pemendek tautan
    └── admin/
        ├── login.html    # Halaman login admin
        └── dashboard.html # Dashboard admin (SPA dengan tab navigasi)
```

---

## 🛢️ Skema Database

| Tabel | Kolom Utama | Keterangan |
|-------|-------------|------------|
| `users` | `id`, `username`, `password` | Akun admin |
| `links` | `id`, `short_code`, `original_url`, `click_count`, `user_id` | Tautan pendek |
| `folders` | `id`, `name`, `user_id`, `parent_id` | Folder bookmark bertingkat |
| `bookmarks` | `id`, `title`, `original_url`, `folder_id`, `user_id` | Bookmark dalam folder |
| `notes` | `id`, `title`, `content_html`, `user_id`, `created_at`, `updated_at` | Catatan WYSIWYG |
| `markdown_docs` | `id`, `title`, `content_md`, `content_html`, `user_id`, `created_at`, `updated_at` | Dokumen Markdown |

---

## 📡 API Reference

> ⚠️ Endpoint admin membutuhkan header: `Authorization: Bearer <token>`

### Publik

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/` | Halaman utama pemendek tautan |
| `POST` | `/api/shorten` | Membuat tautan pendek |
| `GET` | `/:shortCode` | Redirect ke URL asli |

**POST /api/shorten**
```json
{ "original_url": "https://example.com/artikel-sangat-panjang" }
```

### Auth

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `POST` | `/api/admin/login` | Login, menghasilkan token JWT |

**POST /api/admin/login**
```json
{ "username": "admin", "password": "admin123" }
```
**Response:**
```json
{ "token": "eyJhbG...", "user": { "id": 1, "username": "admin" } }
```

### Links (Tautan)

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/admin/links` | Ambil semua tautan + statistik |
| `POST` | `/api/admin/links` | Buat tautan pendek baru |
| `PUT` | `/api/admin/links/:id` | Update URL asli tautan |
| `DELETE` | `/api/admin/links/:id` | Hapus tautan |

### Folders

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/admin/folders` | Ambil semua folder |
| `POST` | `/api/admin/folders` | Buat folder baru |
| `PUT` | `/api/admin/folders/:id` | Update nama / parent folder |
| `DELETE` | `/api/admin/folders/:id` | Hapus folder + isinya |

**POST /api/admin/folders**
```json
{ "name": "Folder Baru", "parent_id": null }
```

### Bookmarks

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/admin/bookmarks?folder_id=1` | Ambil bookmark per folder |
| `GET` | `/api/admin/bookmarks-tree` | Ambil struktur folder + bookmark (tree) |
| `POST` | `/api/admin/bookmarks` | Buat bookmark |
| `PUT` | `/api/admin/bookmarks/:id` | Update bookmark |
| `DELETE` | `/api/admin/bookmarks/:id` | Hapus bookmark |

**POST /api/admin/bookmarks**
```json
{ "title": "Judul Bookmark", "original_url": "https://example.com", "folder_id": 1 }
```

### Notes (Catatan)

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/admin/notes` | Ambil semua catatan |
| `POST` | `/api/admin/notes` | Buat catatan baru |
| `PUT` | `/api/admin/notes/:id` | Update catatan |
| `DELETE` | `/api/admin/notes/:id` | Hapus catatan |

**POST /api/admin/notes**
```json
{ "title": "Judul Catatan", "content_html": "<p>Isi catatan <strong>WYSIWYG</strong></p>" }
```

### Markdown Docs

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/admin/markdown` | Ambil semua dokumen |
| `GET` | `/api/admin/markdown/:id` | Ambil satu dokumen lengkap |
| `POST` | `/api/admin/markdown` | Buat dokumen baru |
| `PUT` | `/api/admin/markdown/:id` | Update dokumen |
| `DELETE` | `/api/admin/markdown/:id` | Hapus dokumen |

**POST /api/admin/markdown**
```json
{ "title": "Dokumentasi API", "content_md": "## Halo\nIni **markdown**." }
```

---

## 🖥️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | SQLite (`sqlite3`) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Validasi | `express-validator` |
| Short Code | `nanoid` |
| UI | Tailwind CSS CDN + Font Awesome 6 |
| WYSIWYG | Quill.js 1.3.7 (CDN) |
| QR Code | qrcodejs 1.0.0 (CDN) |
| Markdown | marked.js (CDN) |

---

## ⚡ Tips

- Server otomatis membuat database `shortlink.db` di folder proyek saat pertama kali dijalankan
- Folder proyek ada di `/www/wwwroot/short-link`
- Semua library frontend di-load dari CDN — tidak perlu build step
- Token JWT berlaku 24 jam, setelah itu harus login ulang
- Backup file `shortlink.db` secara berkala untuk menjaga data
