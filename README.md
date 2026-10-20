# 📚 LuminaRead - Modern Web eReader & Audio Narrator

A lightweight, high-performance digital library and web eReader with built-in **AI Read-Aloud (Text-to-Speech)** narration, multi-format parsing, and distraction-free reading modes.

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%7C%20CSS3-blue?style=flat-square)
![Formats](https://img.shields.io/badge/Supports-PDF%20%7C%20DOCX%20%7C%20EPUB%20%7C%20TXT-orange?style=flat-square)
![License](https://img.shields.io/badge/License-ISC-green?style=flat-square)

---

## ✨ Features

- **📖 Multi-Format Document Reader**:
  - **PDF**: Smooth canvas rendering via PDF.js with zooming, page navigation, and text selection.
  - **DOCX**: Client-side document parsing via Mammoth.js.
  - **EPUB**: Reflowable reader layout powered by ePub.js with chapters and pagination.
  - **TXT**: Fast text parsing with custom typography settings.
- **🎙️ AI Read-Aloud (Text-to-Speech Engine)**:
  - Natural speech synthesis using Web Speech API with language detection (ID & EN).
  - Play, pause, resume, speed control (0.75x - 2.0x), and voice tone adjustment.
  - Real-time sentence/paragraph highlighting synchronized with narration.
- **🎨 Reading Customization**:
  - Themes: Light, Sepia (Warm Paper), and AMOLED Dark Mode.
  - Typography: Serif (Newsreader), Sans-Serif (Plus Jakarta Sans), and Dyslexic-friendly sizing.
  - Fullscreen mode, adjustable line spacing, and margins.
- **⚡ Lightweight Backend**:
  - Node.js & Express API with Multer for secure file uploads.
  - File streaming (`inline` streaming) for fast rendering of large documents.
  - Zero heavy external database required (lightweight JSON-backed store).

---

## 🛠️ Project Architecture

```
reader-book-system/
├── data/                  # Metadata database (books.json)
├── public/                # Web frontend assets
│   ├── css/
│   │   ├── style.css      # Library catalog & dashboard styling
│   │   └── reader.css     # Reading viewport & controls styling
│   ├── js/
│   │   ├── app.js         # Library manager & upload handler
│   │   └── reader.js      # Document parsers, TTS engine & UI state
│   ├── index.html         # Digital library homepage
│   └── reader.html        # Interactive reading interface
├── uploads/               # Uploaded book files (PDF, DOCX, EPUB, TXT)
├── sample-buku.txt        # Sample book provided for quick testing
├── server.js              # Express REST server & file streaming
├── package.json           # Node.js project manifest & dependencies
└── .gitignore             # Git ignore patterns (node_modules, uploads)
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v16 or higher) installed on your system.

### 1. Installation

Clone this repository and install the dependencies:

```bash
git clone https://github.com/FajarHadi1/reader-book-system.git
cd reader-book-system
npm install
```

### 2. Run the Application

Start the local server:

```bash
# Production start
npm start

# Or development mode with auto-reload
npm run dev
```

The application will be running at:
👉 **`http://localhost:3001`**

---

## 📖 How to Use

1. Open **`http://localhost:3001`** in your browser.
2. Click **"Upload Buku"** to add a new book (`.pdf`, `.docx`, `.epub`, or `.txt`).
3. Click on any book card to open the reader interface (`reader.html`).
4. Use the bottom toolbar to adjust font sizes, toggle dark/sepia mode, or click **"Read Aloud"** to let the AI narrate the book to you.

---

## 🔒 Best Practices & Git Handling

- **Uploads & Large Files**: Uploaded files (`uploads/`) are excluded from Git by `.gitignore` to prevent repository bloat and ensure fast cloning.
- **Self-Healing Data Directories**: The server automatically initializes `uploads/` and `data/books.json` upon startup if they do not exist.

---

## 📄 License

This project is licensed under the **ISC License**.
