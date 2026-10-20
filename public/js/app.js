// State Manajemen Dashboard
let allBooks = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const bookGrid = document.getElementById('bookGrid');
const emptyState = document.getElementById('emptyState');
const totalBooksCount = document.getElementById('totalBooksCount');
const recentReadCount = document.getElementById('recentReadCount');
const searchInput = document.getElementById('searchInput');
const filterChips = document.querySelectorAll('.filter-chip');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Upload Modal Elements
const uploadModal = document.getElementById('uploadModal');
const openUploadModalBtn = document.getElementById('openUploadModalBtn');
const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const dropzoneContent = document.querySelector('.dropzone-content');
const filePreview = document.getElementById('filePreview');
const previewFileName = document.getElementById('previewFileName');
const previewFileSize = document.getElementById('previewFileSize');
const removeFileBtn = document.getElementById('removeFileBtn');
const uploadProgressContainer = document.getElementById('uploadProgressContainer');
const progressBarFill = document.getElementById('progressBarFill');
const uploadPercent = document.getElementById('uploadPercent');
const submitUploadBtn = document.getElementById('submitUploadBtn');
const toastContainer = document.getElementById('toastContainer');

// --- Inisialisasi Tema ---
function initTheme() {
  const savedTheme = localStorage.getItem('luminaread_theme') || 'light';
  document.body.className = `theme-${savedTheme}`;
  updateThemeIcon(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'light' : 'dark';
    document.body.className = `theme-${newTheme}`;
    localStorage.setItem('luminaread_theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  themeToggleBtn.innerHTML = theme === 'dark' 
    ? '<i class="fa-regular fa-sun"></i>' 
    : '<i class="fa-regular fa-moon"></i>';
}

// --- Fetch & Render Buku ---
async function fetchBooks() {
  try {
    const res = await fetch('/api/books');
    if (!res.ok) throw new Error('Gagal mengambil data buku');
    allBooks = await res.json();
    renderBooks();
    updateStats();
  } catch (error) {
    showToast('Gagal memuat daftar buku: ' + error.message, 'error');
  }
}

function renderBooks() {
  let filtered = allBooks.filter(book => {
    const matchFilter = currentFilter === 'all' || book.format === currentFilter;
    const matchSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        book.format.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    bookGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  bookGrid.innerHTML = filtered.map(book => {
    // Ambil reading progress dari localStorage jika ada
    const progressKey = `read_progress_${book.id}`;
    const progressData = JSON.parse(localStorage.getItem(progressKey) || '{}');
    const percent = progressData.percent || 0;

    let iconClass = 'fa-file-lines';
    if (book.format === 'pdf') iconClass = 'fa-file-pdf';
    else if (book.format === 'docx') iconClass = 'fa-file-word';
    else if (book.format === 'epub') iconClass = 'fa-book';

    return `
      <div class="book-card" data-id="${book.id}">
        <div class="card-top format-${book.format}">
          <i class="fa-solid ${iconClass} card-icon"></i>
          <span class="format-badge-card">${book.format.toUpperCase()}</span>
        </div>
        <div class="card-body">
          <h4 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h4>
          <div class="book-meta">
            <span><i class="fa-solid fa-user-pen"></i> ${escapeHtml(book.author || 'Anonim')}</span>
            <span>•</span>
            <span>${formatBytes(book.size)}</span>
          </div>

          <!-- Reading Progress -->
          <div class="reading-progress-bar" title="Progress: ${percent}%">
            <div class="progress-inner" style="width: ${percent}%;"></div>
          </div>

          <div class="card-actions">
            <a href="/reader.html?id=${book.id}" class="btn btn-read">
              <i class="fa-solid fa-book-open"></i> ${percent > 0 ? (progressData.page ? `Lanjut (Hal ${progressData.page})` : `Lanjut (${percent}%)`) : 'Mulai Baca'}
            </a>
            <button class="btn btn-delete" onclick="deleteBook('${book.id}', '${escapeHtml(book.title)}')" title="Hapus Buku">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateStats() {
  totalBooksCount.textContent = allBooks.length;
  
  // Hitung buku yang memiliki reading progress > 0
  let readingCount = 0;
  allBooks.forEach(b => {
    const p = JSON.parse(localStorage.getItem(`read_progress_${b.id}`) || '{}');
    if (p.percent && p.percent > 0) readingCount++;
  });
  recentReadCount.textContent = readingCount;
}

// --- Hapus Buku ---
async function deleteBook(id, title) {
  if (!confirm(`Apakah kamu yakin ingin menghapus buku "${title}" dari perpustakaan?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus');
    
    // Hapus progress lokal
    localStorage.removeItem(`read_progress_${id}`);
    
    showToast(`Buku "${title}" berhasil dihapus`, 'success');
    fetchBooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- Handler Filter & Pencarian ---
filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.getAttribute('data-filter');
    renderBooks();
  });
});

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  renderBooks();
});

// --- Modal Upload & Drag-Drop Logic ---
function openModal() {
  uploadModal.classList.add('open');
  resetUploadForm();
}

function closeModal() {
  uploadModal.classList.remove('open');
  resetUploadForm();
}

openUploadModalBtn.addEventListener('click', openModal);
closeUploadModalBtn.addEventListener('click', closeModal);
cancelUploadBtn.addEventListener('click', closeModal);

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) closeModal();
});

function resetUploadForm() {
  uploadForm.reset();
  dropzoneContent.style.display = 'block';
  filePreview.style.display = 'none';
  uploadProgressContainer.style.display = 'none';
  progressBarFill.style.width = '0%';
  uploadPercent.textContent = '0%';
  submitUploadBtn.disabled = false;
  dropzone.classList.remove('dragover');
}

// Drag & drop highlight
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelected();
  }
});

fileInput.addEventListener('change', handleFileSelected);

function handleFileSelected() {
  const file = fileInput.files[0];
  if (!file) return;

  const validExts = ['.pdf', '.docx', '.epub', '.txt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  
  if (!validExts.includes(ext)) {
    showToast('Format file tidak didukung! Pilih PDF, DOCX, EPUB, atau TXT.', 'error');
    fileInput.value = '';
    return;
  }

  // Tampilkan preview file
  previewFileName.textContent = file.name;
  previewFileSize.textContent = formatBytes(file.size);
  dropzoneContent.style.display = 'none';
  filePreview.style.display = 'flex';

  // Otomatis isi judul jika input judul masih kosong
  const titleInput = document.getElementById('bookTitleInput');
  if (!titleInput.value) {
    const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    titleInput.value = rawName.replace(/[-_]/g, ' ');
  }
}

removeFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.value = '';
  dropzoneContent.style.display = 'block';
  filePreview.style.display = 'none';
});

// --- Upload Form Submission with AJAX XMLHttpRequest Progress ---
uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (!fileInput.files.length) {
    showToast('Silakan pilih berkas buku terlebih dahulu!', 'error');
    return;
  }

  const formData = new FormData(uploadForm);
  const xhr = new XMLHttpRequest();

  uploadProgressContainer.style.display = 'block';
  submitUploadBtn.disabled = true;

  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      progressBarFill.style.width = `${percent}%`;
      uploadPercent.textContent = `${percent}%`;
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const response = JSON.parse(xhr.responseText);
      showToast('Buku berhasil ditambahkan ke perpustakaan!', 'success');
      closeModal();
      fetchBooks();
    } else {
      let err = 'Upload gagal';
      try {
        const res = JSON.parse(xhr.responseText);
        if (res.error) err = res.error;
      } catch (_) {}
      showToast(err, 'error');
      submitUploadBtn.disabled = false;
    }
  });

  xhr.addEventListener('error', () => {
    showToast('Terjadi kesalahan jaringan saat mengunggah', 'error');
    submitUploadBtn.disabled = false;
  });

  xhr.open('POST', '/api/books/upload');
  xhr.send(formData);
});

// --- Toast Helper ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Utility: Format Ukuran Berkas
function formatBytes(bytes, decimals = 1) {
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Utility: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Bootstrapping
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchBooks();
});
