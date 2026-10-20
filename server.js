const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Direktori penyimpanan
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'books.json');

// Pastikan folder tersedia
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));

// Helper Database JSON
function getBooks() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    return [];
  }
}

function saveBooks(books) {
  fs.writeFileSync(DB_FILE, JSON.stringify(books, null, 2));
}

// Konfigurasi Multer untuk Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const allowedExtensions = ['.pdf', '.docx', '.epub', '.txt'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Format tidak didukung. Harap upload file: ${allowedExtensions.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // Max 100MB
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// 1. Ambil daftar semua buku
app.get('/api/books', (req, res) => {
  const books = getBooks();
  // Urutkan dari yang terbaru
  books.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  res.json(books);
});

// 2. Ambil detail buku berdasarkan ID
app.get('/api/books/:id', (req, res) => {
  const books = getBooks();
  const book = books.find(b => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Buku tidak ditemukan' });
  }
  res.json(book);
});

// 3. Upload buku baru
app.post('/api/books/upload', upload.single('bookFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const titleInput = req.body.title ? req.body.title.trim() : '';
    const cleanTitle = titleInput || path.basename(req.file.originalname, path.extname(req.file.originalname));
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    const newBook = {
      id: uuidv4(),
      title: cleanTitle,
      originalName: req.file.originalname,
      filename: req.file.filename,
      format: ext,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      category: req.body.category || 'Umum',
      author: req.body.author || 'Anonim'
    };

    const books = getBooks();
    books.push(newBook);
    saveBooks(books);

    res.status(201).json({ success: true, book: newBook });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Gagal menyimpan buku' });
  }
});

// 4. Stream / Download file buku
app.get('/api/books/:id/file', (req, res) => {
  const books = getBooks();
  const book = books.find(b => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Buku tidak ditemukan' });
  }

  const filePath = path.join(UPLOADS_DIR, book.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File fisik buku tidak ditemukan di server' });
  }

  // Tentukan content-type
  let contentType = 'application/octet-stream';
  if (book.format === 'pdf') contentType = 'application/pdf';
  else if (book.format === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (book.format === 'epub') contentType = 'application/epub+zip';
  else if (book.format === 'txt') contentType = 'text/plain; charset=utf-8';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.originalName)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// 5. Hapus buku
app.delete('/api/books/:id', (req, res) => {
  let books = getBooks();
  const bookIndex = books.findIndex(b => b.id === req.params.id);
  
  if (bookIndex === -1) {
    return res.status(404).json({ error: 'Buku tidak ditemukan' });
  }

  const book = books[bookIndex];
  const filePath = path.join(UPLOADS_DIR, book.filename);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('Gagal menghapus file fisik:', e.message);
    }
  }

  books.splice(bookIndex, 1);
  saveBooks(books);

  res.json({ success: true, message: 'Buku berhasil dihapus' });
});

// Error handling upload middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Ukuran file melebihi batas maksimum (100MB)' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`📚 eReader System berjalan di http://localhost:${PORT}`);
  console.log(`⚡ Siap menerima upload PDF, DOCX, EPUB, TXT`);
  console.log(`🎙️ Dilengkapi fitur AI Read-Aloud Smart TTS`);
  console.log(`===============================================`);
});
