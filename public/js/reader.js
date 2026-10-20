// Reader Controller & AI Smart Text-to-Speech Engine
const urlParams = new URLSearchParams(window.location.search);
const bookId = urlParams.get('id');

// State Buku
let currentBook = null;
let currentFormat = '';
let pdfDoc = null;
let currentPdfPage = 1;
let totalPdfPages = 1;
let pdfScale = 1.25;
let epubBook = null;
let rendition = null;
let currentEpubLocation = null;

// State Ekstraksi Teks untuk AI TTS
let parsedSentences = []; // Array kalimat { text, element/pageIndex }
let currentSentenceIndex = -1;
let isAudioPlaying = false;
let isAudioPaused = false;
let currentUtterance = null;
let voices = [];

// DOM Elements
const readerBookTitle = document.getElementById('readerBookTitle');
const readerBookAuthor = document.getElementById('readerBookAuthor');
const readerLoading = document.getElementById('readerLoading');
const loadingMessage = document.getElementById('loadingMessage');
const readerError = document.getElementById('readerError');
const readerErrorMessage = document.getElementById('readerErrorMessage');

const pdfViewerWrapper = document.getElementById('pdfViewerWrapper');
const pdfCanvas = document.getElementById('pdfCanvas');
const textViewerWrapper = document.getElementById('textViewerWrapper');
const contentPaper = document.getElementById('contentPaper');
const epubViewerWrapper = document.getElementById('epubViewerWrapper');

const paginationControls = document.getElementById('paginationControls');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const currentPageInput = document.getElementById('currentPageInput');
const totalPagesText = document.getElementById('totalPagesText');
const globalProgressBar = document.getElementById('globalProgressBar');

// Zoom DOM
const zoomControls = document.getElementById('zoomControls');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLevelText = document.getElementById('zoomLevelText');

// Appearance DOM
const appearanceBtn = document.getElementById('appearanceBtn');
const appearancePanel = document.getElementById('appearancePanel');
const themeOpts = document.querySelectorAll('.theme-opt');
const fontOpts = document.querySelectorAll('.font-opt');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontSizeDisplay = document.getElementById('fontSizeDisplay');
const decreaseFontBtn = document.getElementById('decreaseFontBtn');
const increaseFontBtn = document.getElementById('increaseFontBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// Bookmark DOM
const setBookmarkBtn = document.getElementById('setBookmarkBtn');
const bookmarkIcon = document.getElementById('bookmarkIcon');
const bookmarkText = document.getElementById('bookmarkText');

// AI Audio Bar DOM
const toggleAiTtsBtn = document.getElementById('toggleAiTtsBtn');
const aiAudioBar = document.getElementById('aiAudioBar');
const closeAiAudioBarBtn = document.getElementById('closeAiAudioBarBtn');
const ttsPlayPauseBtn = document.getElementById('ttsPlayPauseBtn');
const ttsPrevSentenceBtn = document.getElementById('ttsPrevSentenceBtn');
const ttsNextSentenceBtn = document.getElementById('ttsNextSentenceBtn');
const ttsStopBtn = document.getElementById('ttsStopBtn');
const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
const ttsPersonaSelect = document.getElementById('ttsPersonaSelect');
const ttsSpeedSelect = document.getElementById('ttsSpeedSelect');
const nowReadingPreview = document.getElementById('nowReadingPreview');
const soundWaveAnim = document.getElementById('soundWaveAnim');
const aiVoiceStatusBadge = document.getElementById('aiVoiceStatusBadge');

// Inisialisasi Suara Speech Synthesis
function populateVoiceList() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices();
  if (!ttsVoiceSelect) return;

  const currentSelected = ttsVoiceSelect.value;
  ttsVoiceSelect.innerHTML = '<option value="">Otomatis (Paling Cocok)</option>';

  // Prioritaskan Bahasa Indonesia, lalu Bahasa Inggris / bahasa lainnya
  const sortedVoices = [...voices].sort((a, b) => {
    const aIsId = a.lang.toLowerCase().startsWith('id');
    const bIsId = b.lang.toLowerCase().startsWith('id');
    if (aIsId && !bIsId) return -1;
    if (!aIsId && bIsId) return 1;
    return a.name.localeCompare(b.name);
  });

  sortedVoices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = voice.name;
    const isId = voice.lang.toLowerCase().startsWith('id') ? ' 🇮🇩 (Indonesia)' : ` (${voice.lang})`;
    option.textContent = `${voice.name}${isId}`;
    if (currentSelected && currentSelected === voice.name) {
      option.selected = true;
    }
    ttsVoiceSelect.appendChild(option);
  });
}

function initVoices() {
  if ('speechSynthesis' in window) {
    populateVoiceList();
    window.speechSynthesis.onvoiceschanged = () => {
      populateVoiceList();
    };
  }
}

// Inisialisasi awal
window.addEventListener('DOMContentLoaded', async () => {
  initVoices();
  initAppearance();
  initKeyboardNavigation();
  if (!bookId) {
    showError('Parameter ID buku tidak ditemukan di URL.');
    return;
  }
  await loadBookData();
});

// Muat metadata buku & routing viewer
async function loadBookData() {
  try {
    const res = await fetch(`/api/books/${bookId}`);
    if (!res.ok) throw new Error('Buku tidak ditemukan di server.');
    currentBook = await res.json();
    currentFormat = currentBook.format.toLowerCase();

    readerBookTitle.textContent = currentBook.title;
    readerBookAuthor.textContent = currentBook.author || 'Anonim';
    document.title = `${currentBook.title} - LuminaReader`;

    const fileUrl = `/api/books/${bookId}/file`;

    // Render berdasarkan format
    if (currentFormat === 'pdf') {
      await initPdfViewer(fileUrl);
    } else if (currentFormat === 'docx') {
      await initDocxViewer(fileUrl);
    } else if (currentFormat === 'epub') {
      await initEpubViewer(fileUrl);
    } else if (currentFormat === 'txt') {
      await initTxtViewer(fileUrl);
    } else {
      showError(`Format ${currentFormat} belum didukung untuk viewer langsung.`);
    }
  } catch (err) {
    showError(err.message);
  }
}

// ==========================================
// 1. PDF Viewer (PDF.js)
// ==========================================
async function initPdfViewer(url) {
  loadingMessage.textContent = 'Membuka dokumen PDF...';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  try {
    const loadingTask = pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;
    totalPdfPages = pdfDoc.numPages;
    totalPagesText.textContent = totalPdfPages;

    paginationControls.style.display = 'flex';
    zoomControls.style.display = 'flex';
    pdfViewerWrapper.style.display = 'flex';

    // Pulihkan halaman terakhir
    const saved = getSavedProgress();
    currentPdfPage = saved.page || 1;
    if (currentPdfPage > totalPdfPages) currentPdfPage = 1;

    await renderPdfPage(currentPdfPage);
    hideLoading();
  } catch (err) {
    showError('Gagal memuat PDF: ' + err.message);
  }
}

async function renderPdfPage(num) {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: pdfScale });
  const canvas = pdfCanvas;
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  currentPageInput.value = num;
  updateGlobalProgress(num, totalPdfPages);
  updateBookmarkButtonState();

  // Ekstrak teks halaman untuk AI TTS
  extractPdfPageText(page);
}

async function extractPdfPageText(page) {
  try {
    const textContent = await page.getTextContent();
    const rawText = textContent.items.map(item => item.str).join(' ');
    buildSentencesFromText(rawText);
  } catch (e) {
    console.warn('Gagal ekstrak teks PDF:', e);
  }
}

// Navigasi PDF
prevPageBtn.addEventListener('click', () => {
  if (currentFormat === 'pdf' && currentPdfPage > 1) {
    currentPdfPage--;
    renderPdfPage(currentPdfPage);
  } else if (currentFormat === 'epub' && rendition) {
    rendition.prev();
  }
});

nextPageBtn.addEventListener('click', () => {
  if (currentFormat === 'pdf' && currentPdfPage < totalPdfPages) {
    currentPdfPage++;
    renderPdfPage(currentPdfPage);
  } else if (currentFormat === 'epub' && rendition) {
    rendition.next();
  }
});

currentPageInput.addEventListener('change', (e) => {
  const p = parseInt(e.target.value);
  if (currentFormat === 'pdf' && p >= 1 && p <= totalPdfPages) {
    currentPdfPage = p;
    renderPdfPage(currentPdfPage);
  }
});

// Zoom PDF
zoomInBtn.addEventListener('click', () => {
  if (pdfScale < 2.5) {
    pdfScale += 0.25;
    zoomLevelText.textContent = `${Math.round(pdfScale / 1.25 * 100)}%`;
    renderPdfPage(currentPdfPage);
  }
});

zoomOutBtn.addEventListener('click', () => {
  if (pdfScale > 0.75) {
    pdfScale -= 0.25;
    zoomLevelText.textContent = `${Math.round(pdfScale / 1.25 * 100)}%`;
    renderPdfPage(currentPdfPage);
  }
});

// ==========================================
// 2. DOCX Viewer (Mammoth.js)
// ==========================================
async function initDocxViewer(url) {
  loadingMessage.textContent = 'Membaca dokumen Word (.docx)...';
  paginationControls.style.display = 'none';
  zoomControls.style.display = 'none';

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const result = await mammoth.convertToHtml({ arrayBuffer });
    contentPaper.innerHTML = result.value || '<p>Dokumen kosong.</p>';
    textViewerWrapper.style.display = 'flex';

    prepareHtmlForReadingAloud();
    setupScrollProgress();
    hideLoading();
  } catch (err) {
    showError('Gagal membaca DOCX: ' + err.message);
  }
}

// ==========================================
// 3. TXT Viewer
// ==========================================
async function initTxtViewer(url) {
  loadingMessage.textContent = 'Membaca file teks...';
  paginationControls.style.display = 'none';
  zoomControls.style.display = 'none';

  try {
    const res = await fetch(url);
    const text = await res.text();
    
    // Format paragraf TXT
    const paragraphs = text.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
    contentPaper.innerHTML = paragraphs || '<p>Dokumen kosong.</p>';
    textViewerWrapper.style.display = 'flex';

    prepareHtmlForReadingAloud();
    setupScrollProgress();
    hideLoading();
  } catch (err) {
    showError('Gagal memuat file teks: ' + err.message);
  }
}

// ==========================================
// 4. EPUB Viewer (Epub.js)
// ==========================================
async function initEpubViewer(url) {
  loadingMessage.textContent = 'Menyiapkan buku EPUB...';
  paginationControls.style.display = 'flex';
  zoomControls.style.display = 'none';
  epubViewerWrapper.style.display = 'flex';

  try {
    epubBook = ePub(url);
    rendition = epubBook.renderTo('epubArea', {
      width: '100%',
      height: '100%',
      spread: 'none'
    });

    const saved = getSavedProgress();
    if (saved && saved.cfi) {
      await rendition.display(saved.cfi);
    } else {
      await rendition.display();
    }

    rendition.on('relocated', (location) => {
      if (location && location.start) {
        const percent = Math.round(location.start.percentage * 100);
        updateGlobalProgress(percent, 100);
        currentEpubLocation = location.start;
        updateBookmarkButtonState();

        // Ekstrak teks halaman EPUB saat ini untuk AI TTS
        try {
          const contents = rendition.getContents();
          if (contents && contents.length > 0) {
            const epubDoc = contents[0].document;
            if (epubDoc && epubDoc.body) {
              const text = epubDoc.body.innerText || epubDoc.body.textContent || '';
              buildSentencesFromText(text);
            }
          }
        } catch (e) {
          console.warn('Ekstrak teks EPUB:', e);
        }
      }
    });

    hideLoading();
  } catch (err) {
    showError('Gagal merender EPUB: ' + err.message);
  }
}

// Persiapan Kalimat DOM untuk Highlight & AI TTS (DOCX & TXT)
function prepareHtmlForReadingAloud() {
  const paragraphs = contentPaper.querySelectorAll('p, h1, h2, h3, h4, li');
  parsedSentences = [];

  let sentenceId = 0;
  paragraphs.forEach(p => {
    const raw = p.textContent.trim();
    if (!raw) return;

    // Pisahkan kalimat berdasarkan titik, tanda tanya, tanda seru
    const sentences = raw.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [raw];
    let newInnerHtml = '';

    sentences.forEach(s => {
      const trimmed = s.trim();
      if (trimmed.length > 0) {
        newInnerHtml += `<span class="sentence-span" data-sid="${sentenceId}">${escapeHtml(s)} </span>`;
        parsedSentences.push({
          id: sentenceId,
          text: trimmed,
          element: null // akan diisi setelah DOM selesai di-update
        });
        sentenceId++;
      }
    });

    p.innerHTML = newInnerHtml;
  });

  // Pasang listener klik kalimat & link elemen
  document.querySelectorAll('.sentence-span').forEach(span => {
    const sid = parseInt(span.getAttribute('data-sid'));
    if (parsedSentences[sid]) {
      parsedSentences[sid].element = span;
    }

    span.addEventListener('click', () => {
      openAiAudioBar();
      speakSentence(sid);
    });
  });
}

function buildSentencesFromText(text) {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  parsedSentences = [];
  let id = 0;
  matches.forEach(m => {
    const tr = m.trim();
    if (tr.length > 1) {
      parsedSentences.push({ id: id++, text: tr, element: null });
    }
  });
}

// ==========================================
// 🎙️ AI SMART TEXT-TO-SPEECH (TTS) ENGINE
// ==========================================

function openAiAudioBar() {
  aiAudioBar.classList.add('active');
  // Pastikan daftar suara termuat
  if (voices.length === 0 && 'speechSynthesis' in window) {
    populateVoiceList();
  }

  // Jika belum ada kalimat yang dipilih, pilih kalimat pertama
  if (currentSentenceIndex === -1 && parsedSentences.length > 0) {
    currentSentenceIndex = 0;
    updateSentencePreview();
  }

  // Langsung putar suara agar tidak diam
  if (!isAudioPlaying && parsedSentences.length > 0) {
    speakSentence(currentSentenceIndex !== -1 ? currentSentenceIndex : 0);
  }
}

function closeAiAudioBar() {
  aiAudioBar.classList.remove('active');
  stopSpeech();
}

toggleAiTtsBtn.addEventListener('click', () => {
  if (aiAudioBar.classList.contains('active')) {
    closeAiAudioBar();
  } else {
    openAiAudioBar();
  }
});

closeAiAudioBarBtn.addEventListener('click', closeAiAudioBar);

// Modulasi Nada, Intonasi, dan Kecepatan berdasarkan Gaya Persona & Tanda Baca
function getTtsAcousticProfile(sentenceText) {
  const persona = ttsPersonaSelect.value;
  const userSpeed = parseFloat(ttsSpeedSelect.value) || 1.0;

  let pitch = 1.0;
  let rate = userSpeed;
  let pauseDuration = 300; // ms

  // Analisis Tanda Baca untuk Intonasi Emosional
  const trimmed = sentenceText.trim();
  const endsWithQuestion = trimmed.endsWith('?');
  const endsWithExclamation = trimmed.endsWith('!');

  // 1. Profil Persona
  if (persona === 'storyteller') {
    pitch = 1.05;
    rate = userSpeed * 0.95;
    if (endsWithQuestion) {
      pitch = 1.25;
    } else if (endsWithExclamation) {
      pitch = 1.15;
      rate = userSpeed * 1.1;
    }
  } else if (persona === 'formal') {
    pitch = 0.95;
    rate = userSpeed * 0.98;
    if (endsWithQuestion) pitch = 1.1;
  } else if (persona === 'calm') {
    pitch = 0.9;
    rate = userSpeed * 0.88;
    pauseDuration = 500;
  }

  return { pitch, rate, pauseDuration };
}

function speakSentence(index) {
  if (!('speechSynthesis' in window)) {
    showToast('Browser kamu tidak mendukung Text-to-Speech.', 'error');
    return;
  }

  // Pastikan daftar voice terisi jika sebelumnya kosong
  if (voices.length === 0) {
    voices = window.speechSynthesis.getVoices();
  }

  if (parsedSentences.length === 0) {
    showToast('Teks belum siap atau tidak ditemukan di halaman ini.', 'error');
    return;
  }

  if (index < 0 || index >= parsedSentences.length) {
    stopSpeech();
    aiVoiceStatusBadge.textContent = 'Selesai Membaca';
    showToast('Pembacaan dokumen selesai!', 'info');
    return;
  }

  // Hentikan antrian sebelumnya & resume jika browser dalam status paused
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  currentSentenceIndex = index;
  const item = parsedSentences[currentSentenceIndex];

  // Highlight kalimat visual
  document.querySelectorAll('.reading-highlight').forEach(el => el.classList.remove('reading-highlight'));
  if (item.element) {
    item.element.classList.add('reading-highlight');
    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  updateSentencePreview();

  // Setup Utterance
  const utterance = new SpeechSynthesisUtterance(item.text);
  const acoustic = getTtsAcousticProfile(item.text);

  utterance.pitch = acoustic.pitch;
  utterance.rate = acoustic.rate;

  // Pilih Voice
  const selectedVoiceName = ttsVoiceSelect ? ttsVoiceSelect.value : '';
  let chosenVoice = null;

  if (selectedVoiceName) {
    chosenVoice = voices.find(v => v.name === selectedVoiceName);
  }

  if (!chosenVoice) {
    // Cari suara Bahasa Indonesia
    chosenVoice = voices.find(v => v.lang.toLowerCase().startsWith('id') || v.lang.toLowerCase().includes('indonesia'));
    // Fallback ke suara natural/default browser
    if (!chosenVoice) {
      chosenVoice = voices.find(v => v.default || v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri'));
    }
  }

  if (chosenVoice) {
    utterance.voice = chosenVoice;
    utterance.lang = chosenVoice.lang;
  } else {
    utterance.lang = 'id-ID';
  }

  utterance.onstart = () => {
    isAudioPlaying = true;
    isAudioPaused = false;
    updateAudioControlsState();
    aiVoiceStatusBadge.textContent = `Membaca #${currentSentenceIndex + 1} / ${parsedSentences.length}`;
  };

  utterance.onend = () => {
    if (isAudioPlaying && !isAudioPaused) {
      setTimeout(() => {
        if (isAudioPlaying && !isAudioPaused) {
          speakSentence(currentSentenceIndex + 1);
        }
      }, acoustic.pauseDuration);
    }
  };

  utterance.onerror = (e) => {
    // Jangan ubah status jika error hanya karena user menekan cancel/stop
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('TTS error:', e.error);
    isAudioPlaying = false;
    updateAudioControlsState();
    showToast('Terjadi kendala pada audio browser: ' + e.error, 'error');
  };

  currentUtterance = utterance;

  // Sedikit timeout untuk mengatasi browser Safari/Chrome cancel race condition
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
    // Workaround Chrome bug: jika speech synthesis terhenti tiba-tiba
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 50);
}

function playSpeech() {
  if (isAudioPaused) {
    window.speechSynthesis.resume();
    isAudioPaused = false;
    isAudioPlaying = true;
    updateAudioControlsState();
    aiVoiceStatusBadge.textContent = `Membaca #${currentSentenceIndex + 1}`;
    return;
  }

  if (currentSentenceIndex === -1) currentSentenceIndex = 0;
  speakSentence(currentSentenceIndex);
}

function pauseSpeech() {
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
    isAudioPaused = true;
    isAudioPlaying = false;
    updateAudioControlsState();
    aiVoiceStatusBadge.textContent = 'Dijeda';
  }
}

function stopSpeech() {
  window.speechSynthesis.cancel();
  isAudioPlaying = false;
  isAudioPaused = false;
  document.querySelectorAll('.reading-highlight').forEach(el => el.classList.remove('reading-highlight'));
  updateAudioControlsState();
  aiVoiceStatusBadge.textContent = 'AI Narator Berhenti';
}

function updateAudioControlsState() {
  if (isAudioPlaying) {
    ttsPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    ttsPlayPauseBtn.title = 'Jeda';
    soundWaveAnim.classList.add('playing');
  } else {
    ttsPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    ttsPlayPauseBtn.title = 'Putar';
    soundWaveAnim.classList.remove('playing');
  }
}

function updateSentencePreview() {
  if (parsedSentences[currentSentenceIndex]) {
    nowReadingPreview.textContent = parsedSentences[currentSentenceIndex].text;
  } else {
    nowReadingPreview.textContent = 'Siap membaca buku...';
  }
}

// Playback event listeners
ttsPlayPauseBtn.addEventListener('click', () => {
  if (isAudioPlaying) {
    pauseSpeech();
  } else {
    playSpeech();
  }
});

ttsStopBtn.addEventListener('click', stopSpeech);

ttsPrevSentenceBtn.addEventListener('click', () => {
  if (currentSentenceIndex > 0) {
    speakSentence(currentSentenceIndex - 1);
  }
});

ttsNextSentenceBtn.addEventListener('click', () => {
  if (currentSentenceIndex < parsedSentences.length - 1) {
    speakSentence(currentSentenceIndex + 1);
  }
});

if (ttsVoiceSelect) {
  ttsVoiceSelect.addEventListener('change', () => {
    if (isAudioPlaying) {
      speakSentence(currentSentenceIndex);
    }
  });
}

ttsPersonaSelect.addEventListener('change', () => {
  if (isAudioPlaying) {
    speakSentence(currentSentenceIndex);
  }
});

ttsSpeedSelect.addEventListener('change', () => {
  if (isAudioPlaying) {
    speakSentence(currentSentenceIndex);
  }
});

// ==========================================
// Pengaturan Tampilan & Progress Membaca
// ==========================================
function initAppearance() {
  // Pulihkan preferensi tema reader
  const savedReaderTheme = localStorage.getItem('luminaread_reader_theme') || 'mode-sepia';
  document.body.classList.remove('mode-light', 'mode-sepia', 'mode-dark');
  document.body.classList.add(savedReaderTheme);

  themeOpts.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === savedReaderTheme);
    opt.addEventListener('click', () => {
      document.body.classList.remove('mode-light', 'mode-sepia', 'mode-dark');
      document.body.classList.add(opt.dataset.theme);
      localStorage.setItem('luminaread_reader_theme', opt.dataset.theme);
      themeOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Font Family
  fontOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      document.body.classList.remove('font-serif', 'font-sans');
      document.body.classList.add(opt.dataset.font);
      fontOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Font Size
  fontSizeSlider.addEventListener('input', (e) => {
    const size = e.target.value;
    fontSizeDisplay.textContent = `${size}px`;
    contentPaper.style.fontSize = `${size}px`;
  });

  decreaseFontBtn.addEventListener('click', () => {
    let s = parseInt(fontSizeSlider.value);
    if (s > 14) {
      s--;
      fontSizeSlider.value = s;
      fontSizeSlider.dispatchEvent(new Event('input'));
    }
  });

  increaseFontBtn.addEventListener('click', () => {
    let s = parseInt(fontSizeSlider.value);
    if (s < 28) {
      s++;
      fontSizeSlider.value = s;
      fontSizeSlider.dispatchEvent(new Event('input'));
    }
  });

  // Toggle Panel
  appearanceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    appearancePanel.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!appearancePanel.contains(e.target) && e.target !== appearanceBtn) {
      appearancePanel.classList.remove('open');
    }
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
      document.exitFullscreen().catch(() => {});
      fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
  });
}

// ==========================================
// ⌨️ KEYBOARD NAVIGATION (PANAH UNTUK SCROLL & PINDAH HALAMAN)
// ==========================================
function initKeyboardNavigation() {
  window.addEventListener('keydown', (e) => {
    // Abaikan jika fokus sedang berada pada input atau textarea (misal: input lompat halaman)
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      return;
    }

    const viewport = document.getElementById('readerViewport');
    const scrollStep = 90; // Jarak scroll vertikal (px)
    const pageScrollStep = viewport.clientHeight * 0.85;

    switch (e.key) {
      // 1. Panah Kiri (Pindah Halaman Sebelumnya / Scroll naik)
      case 'ArrowLeft':
        e.preventDefault();
        if (currentFormat === 'pdf') {
          if (currentPdfPage > 1) {
            currentPdfPage--;
            renderPdfPage(currentPdfPage);
          }
        } else if (currentFormat === 'epub' && rendition) {
          rendition.prev();
        } else {
          // DOCX & TXT: Scroll ke atas 1 blok bacaan
          viewport.scrollBy({ top: -pageScrollStep, behavior: 'smooth' });
        }
        break;

      // 2. Panah Kanan (Pindah Halaman Selanjutnya / Scroll turun)
      case 'ArrowRight':
        e.preventDefault();
        if (currentFormat === 'pdf') {
          if (currentPdfPage < totalPdfPages) {
            currentPdfPage++;
            renderPdfPage(currentPdfPage);
          }
        } else if (currentFormat === 'epub' && rendition) {
          rendition.next();
        } else {
          // DOCX & TXT: Scroll ke bawah 1 blok bacaan
          viewport.scrollBy({ top: pageScrollStep, behavior: 'smooth' });
        }
        break;

      // 3. Panah Atas (Scroll Halus ke Atas / Pindah halaman sebelumnya jika di puncak PDF)
      case 'ArrowUp':
        e.preventDefault();
        if (currentFormat === 'pdf') {
          // Jika sudah di paling atas canvas, lompat ke halaman sebelumnya
          if (viewport.scrollTop <= 5 && currentPdfPage > 1) {
            currentPdfPage--;
            renderPdfPage(currentPdfPage);
          } else {
            viewport.scrollBy({ top: -scrollStep, behavior: 'smooth' });
          }
        } else if (currentFormat === 'epub' && rendition) {
          rendition.prev();
        } else {
          viewport.scrollBy({ top: -scrollStep, behavior: 'smooth' });
        }
        break;

      // 4. Panah Bawah (Scroll Halus ke Bawah / Pindah halaman berikutnya jika di dasar PDF)
      case 'ArrowDown':
        e.preventDefault();
        if (currentFormat === 'pdf') {
          const isAtBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 10;
          if (isAtBottom && currentPdfPage < totalPdfPages) {
            currentPdfPage++;
            renderPdfPage(currentPdfPage);
            viewport.scrollTop = 0;
          } else {
            viewport.scrollBy({ top: scrollStep, behavior: 'smooth' });
          }
        } else if (currentFormat === 'epub' && rendition) {
          rendition.next();
        } else {
          viewport.scrollBy({ top: scrollStep, behavior: 'smooth' });
        }
        break;

      // 5. Shortcut Bookmark Tambahan: Tombol "B" untuk Bookmark Cepat
      case 'b':
      case 'B':
        if (!e.ctrlKey && !e.metaKey) {
          setBookmarkBtn.click();
        }
        break;

      // 6. Tombol Spasi: Bacaan berikutnya (Scroll turun atau next)
      case ' ':
        e.preventDefault();
        if (e.shiftKey) {
          if (currentFormat === 'pdf' && currentPdfPage > 1) {
            currentPdfPage--;
            renderPdfPage(currentPdfPage);
          } else {
            viewport.scrollBy({ top: -pageScrollStep, behavior: 'smooth' });
          }
        } else {
          if (currentFormat === 'pdf' && currentPdfPage < totalPdfPages) {
            currentPdfPage++;
            renderPdfPage(currentPdfPage);
          } else {
            viewport.scrollBy({ top: pageScrollStep, behavior: 'smooth' });
          }
        }
        break;

      default:
        break;
    }
  });
}

// Progress scroll untuk TXT & DOCX
function setupScrollProgress() {
  const viewport = document.getElementById('readerViewport');
  viewport.addEventListener('scroll', () => {
    const totalScroll = viewport.scrollHeight - viewport.clientHeight;
    if (totalScroll > 0) {
      const percent = Math.min(100, Math.round((viewport.scrollTop / totalScroll) * 100));
      updateGlobalProgress(percent, 100);
      updateBookmarkButtonState();
    }
  });

  // Restore scroll posisi dari bookmark terakhir yang pernah disimpan user
  const saved = getSavedProgress();
  if (saved.scrollTop) {
    viewport.scrollTop = saved.scrollTop;
  }
  updateBookmarkButtonState();
}

function updateGlobalProgress(current, total) {
  const percent = Math.min(100, Math.round((current / total) * 100));
  globalProgressBar.style.width = `${percent}%`;
}

// ==========================================
// 📌 FITUR MANUAL BOOKMARK (TETAPKAN BACA TERAKHIR)
// ==========================================
function saveReadingProgress(data) {
  if (!bookId) return;
  localStorage.setItem(`read_progress_${bookId}`, JSON.stringify(data));
  updateBookmarkButtonState();
}

function getSavedProgress() {
  if (!bookId) return {};
  try {
    return JSON.parse(localStorage.getItem(`read_progress_${bookId}`) || '{}');
  } catch (_) {
    return {};
  }
}

// Cek apakah posisi user saat ini sudah ditandai sebagai bookmark
function isCurrentPositionBookmarked() {
  const saved = getSavedProgress();
  if (!saved || !saved.percent) return false;

  if (currentFormat === 'pdf') {
    return saved.page === currentPdfPage;
  } else if (currentFormat === 'epub') {
    if (currentEpubLocation && saved.cfi) {
      return currentEpubLocation.cfi === saved.cfi;
    }
    return false;
  } else {
    // DOCX & TXT: toleransi scroll +- 80px
    const viewport = document.getElementById('readerViewport');
    if (saved.scrollTop !== undefined) {
      return Math.abs(viewport.scrollTop - saved.scrollTop) < 80;
    }
    return false;
  }
}

function updateBookmarkButtonState() {
  if (!setBookmarkBtn) return;
  const isBookmarked = isCurrentPositionBookmarked();
  const saved = getSavedProgress();

  if (isBookmarked) {
    setBookmarkBtn.classList.add('saved');
    bookmarkIcon.className = 'fa-solid fa-bookmark';
    let info = '';
    if (currentFormat === 'pdf') info = ` (Hal ${currentPdfPage})`;
    else if (saved.percent) info = ` (${saved.percent}%)`;
    bookmarkText.textContent = `Tersimpan${info}`;
    setBookmarkBtn.title = 'Halaman ini telah ditandai sebagai bacaan terakhir kamu';
  } else {
    setBookmarkBtn.classList.remove('saved');
    bookmarkIcon.className = 'fa-regular fa-bookmark';
    bookmarkText.textContent = 'Tandai Baca Terakhir';
    setBookmarkBtn.title = 'Tetapkan posisi ini sebagai bacaan terakhir';
  }
}

// Event handler saat user klik tombol "Tandai Baca Terakhir"
setBookmarkBtn.addEventListener('click', () => {
  let progressData = {};

  if (currentFormat === 'pdf') {
    const percent = Math.round((currentPdfPage / totalPdfPages) * 100);
    progressData = {
      page: currentPdfPage,
      percent: percent,
      savedAt: new Date().toISOString()
    };
    saveReadingProgress(progressData);
    showToast(`Posisi membaca berhasil ditetapkan di Halaman ${currentPdfPage} (${percent}%)!`, 'success');
  } else if (currentFormat === 'epub') {
    if (currentEpubLocation) {
      const percent = Math.round(currentEpubLocation.percentage * 100);
      progressData = {
        cfi: currentEpubLocation.cfi,
        percent: percent,
        savedAt: new Date().toISOString()
      };
      saveReadingProgress(progressData);
      showToast(`Posisi membaca berhasil ditetapkan (${percent}%)!`, 'success');
    } else {
      showToast('Posisi buku belum siap ditandai', 'error');
    }
  } else {
    // DOCX & TXT
    const viewport = document.getElementById('readerViewport');
    const totalScroll = viewport.scrollHeight - viewport.clientHeight;
    const percent = totalScroll > 0 ? Math.min(100, Math.round((viewport.scrollTop / totalScroll) * 100)) : 100;
    
    progressData = {
      scrollTop: viewport.scrollTop,
      percent: percent,
      savedAt: new Date().toISOString()
    };
    saveReadingProgress(progressData);
    showToast(`Posisi membaca berhasil ditetapkan (${percent}%)!`, 'success');
  }
});

function hideLoading() {
  readerLoading.style.display = 'none';
}

function showError(msg) {
  readerLoading.style.display = 'none';
  readerError.style.display = 'flex';
  readerErrorMessage.textContent = msg;
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
