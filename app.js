/**
 * SMJ LAB — Core Interactive Engine with Download Center, Cross-Landingpage & Macro Suite
 */

const MODULES_DATA = [
  {
    id: "workspace-x",
    category: "desktop",
    categoryLabel: "Desktop App",
    name: "WORKSPACE-X",
    badge: "Tauri v2 Native • 100% Siap Pakai",
    icon: "🖥️",
    tagline: "Local-First Workspace & Shift Browser Automation Hub",
    description: "Aplikasi desktop eksekutif berbasis Tauri v2 untuk otomatisasi lingkungan kerja browser (Opera/Chrome). Memulihkan puluhan tab kerja dan grup tab dalam 1-klik (START WORK), dilengkapi Shift Control Center (Live Timer & Eye Break 20m), Buku Catatan Operan Shift, dan SOP Checklist, serta penutupan sesi bersih (END WORK) tanpa pernah menyimpan credential/cookie akun.",
    features: [
      "Dual-Mode Distribusi: Installer Windows (.exe, ~2.9 MB) & Portable Suite (.zip, ~3.7 MB)",
      "Bebas Compiler: Tanpa perlu install Node.js, Rustup, ataupun Visual Studio C++",
      "One-Click Tab Restoration & Tab Groups Sync via Chrome/Opera Bridge",
      "Shift Control Center: Live Timer Durasi Shift & Pengingat Eye Break 20 Menit",
      "Buku Catatan Handover & SOP Checklist: Dokumentasi operan shift terintegrasi",
      "Multi-Shift Safe: 1-Klik END WORK menutup tab dan logout Google resmi",
      "Local-First SQLite: Database lokal mandiri, aman dari kebocoran cloud"
    ],
    fileCount: "Paket Mandiri Lengkap",
    keyFiles: [
      { name: "Workspace-Hub-Setup.exe", desc: "Installer resmi Windows (Desktop & Start Menu shortcut, ~2.9 MB)" },
      { name: "Workspace-Hub.exe", desc: "Aplikasi desktop native terkompilasi (mode portable, ~11.3 MB)" },
      { name: "1-KLIK-PASANG-EKSTENSI.bat", desc: "Helper 1-klik salin path ke clipboard & buka halaman extensions" },
      { name: "1-KLIK-JALANKAN.bat", desc: "Launcher instan portable tanpa instalasi" },
      { name: "extension/", desc: "Manifest V3 Browser Bridge Extension untuk Opera & Chrome" },
      { name: "data/", desc: "Penyimpanan database SQLite lokal portabel (workspace_hub.db)" }
    ],
    downloads: [
      { name: "Download Windows Installer (.exe)", file: "Workspace-Hub-Setup.exe", size: "~2.9 MB (Setup Wizard)", isPrimary: true },
      { name: "Download Portable Suite (.zip)", file: "WORKSPACE-X.zip", size: "~3.7 MB (Tanpa Install)", isPrimary: false }
    ],
    installTab: "tab-workspace"
  },
  {
    id: "extension-admin",
    category: "extension",
    categoryLabel: "Chrome Extension",
    name: "EXTENSION ADMIN",
    badge: "Manifest V3 Customizer",
    icon: "🛹",
    tagline: "Street Art Admin Panel Customizer & Quick Tools",
    description: "Ekstensi browser custom untuk menyuntikkan estetika modern bertema street-art/dark mode pada panel admin (seperti portal ag-latoto), dilengkapi floating sticky notes, dynamic quick highlights, dan quick action tools.",
    features: [
      "Street Art Dark Theme Injection untuk panel admin",
      "Dynamic Keyword Highlighting & Status Indicators",
      "Quick Floating Notes dengan Local Storage Sync",
      "Zero Permission Latency (Content Script Injection)"
    ],
    fileCount: "4 Core Files + Assets",
    keyFiles: [
      { name: "manifest.json", desc: "Konfigurasi ekstensi Chrome Manifest V3" },
      { name: "scripts/content.js", desc: "DOM Injector, Event Listener & Logic" },
      { name: "scripts/content.css", desc: "Styling Glassmorphism & Street-Art UI" },
      { name: "popup/popup.html", desc: "Control Panel Popup & Quick Settings" },
      { name: "assets/icons/", desc: "Icon asset pack (16px, 48px, 128px)" }
    ],
    downloads: [
      { name: "Download Extension Admin (.zip)", file: "EXTENSION-ADMIN.zip", size: "~2.4 MB", isPrimary: true }
    ],
    installTab: "tab-admin"
  },
  {
    id: "extension-chat",
    category: "userscript",
    categoryLabel: "LiveChat Suite",
    name: "EXTENSION CHAT-SMJ",
    badge: "Highlighter Pro Suite",
    icon: "💬",
    tagline: "Executive Command Center & Tampermonkey Scripts",
    description: "Paket lengkap otomatisasi dan akselerasi respons agen LiveChat. Dilengkapi landing page bawaan mandiri, 5 user scripts modular (LATOTO1 s/d LATOTO5) untuk highlighting otomatis, dan sound alert alerts custom.",
    features: [
      "Memiliki Dedicated Landing Page & Live Executive Dashboard",
      "5 Modular User Scripts (LATOTO1 s/d LATOTO5)",
      "Sound Alerts Real-time (Defuse & Instant Alerts)",
      "High-Contrast Customer Intent Highlighting"
    ],
    fileCount: "9 Files (Scripts, Sound, Dashboard)",
    keyFiles: [
      { name: "index.html", desc: "Dedicated Landingpage & Command Center UI" },
      { name: "LATOTO1.user.js s/d LATOTO5.user.js", desc: "5x Script Otomasi Tampermonkey/Violentmonkey" },
      { name: "style.css", desc: "Smoked Glass UI Stylesheet" },
      { name: "pb-bom-defuse_HORy4kEd.mp3", desc: "Audio Alert: Bomb Defusal Sound" },
      { name: "myinstants.mp3", desc: "Audio Alert: Instant Ping Effect" }
    ],
    directLandingUrl: "EXTENSION CHAT-SMJ/index.html",
    downloads: [
      { name: "Download Chat Suite (.zip)", file: "EXTENSION-CHAT-SMJ.zip", size: "~600 KB", isPrimary: true }
    ],
    installTab: "tab-chat"
  },
  {
    id: "perfect-keyboard",
    category: "macro",
    categoryLabel: "Macro Vault",
    name: "PERFECT KEYBOARD SUITE",
    badge: "v9.4.6 Macro Files (.4pk)",
    icon: "⌨️",
    tagline: "Enterprise Auto-Text & CS Macro Response Database",
    description: "Koleksi 4 database makro dan shortcut auto-text Perfect Keyboard 9.4.6 untuk mempercepat respon pesan pelanggan (Event Khusus, Anti Audit 2025, Pendamping CS, dan Pihak Ketiga).",
    features: [
      "4x Database Makro .4pk Siap Import (Event, Anti Audit, Pendamping, Vendor)",
      "Template Promosi Event & Fast Response Canned Answers",
      "Kompatibel Penuh dengan Software Perfect Keyboard 9.4.6",
      "Tersedia Download Bundle (.zip) & File Individual (.4pk)"
    ],
    fileCount: "4 Macro Files (.4pk) + Guide",
    keyFiles: [
      { name: "1_KHUSUS_EVENT.4pk", desc: "Database Makro Template Promosi Event Khusus (~6.1 MB)" },
      { name: "2_PK_ANTI_AUDIT_2025.4pk", desc: "Database Makro Respon Cepat Anti Audit 2025 (~758 KB)" },
      { name: "3_PK_PENDAMPING_2025.4pk", desc: "Database Makro Pendamping Alur CS (~103 KB)" },
      { name: "4_PK_PIHAK_KETIGA.4pk", desc: "Database Makro Pihak Ketiga & Payment Gateway (~16 KB)" },
      { name: "PANDUAN_IMPORT_MACRO.md", desc: "Panduan Langkah Import ke Perfect Keyboard" }
    ],
    downloads: [
      { name: "Download All Macros Bundle (.zip)", file: "PERFECT-KEYBOARD-SUITE.zip", size: "~7.0 MB", isPrimary: true },
      { name: "1_KHUSUS_EVENT (.4pk)", file: "PERFECT-KEYBOARD-SUITE/macros/1_KHUSUS_EVENT.4pk", size: "~6.1 MB", isPrimary: false },
      { name: "2_PK_ANTI_AUDIT (.4pk)", file: "PERFECT-KEYBOARD-SUITE/macros/2_PK_ANTI_AUDIT_2025.4pk", size: "~758 KB", isPrimary: false },
      { name: "3_PK_PENDAMPING (.4pk)", file: "PERFECT-KEYBOARD-SUITE/macros/3_PK_PENDAMPING_2025.4pk", size: "~103 KB", isPrimary: false },
      { name: "4_PK_PIHAK_KETIGA (.4pk)", file: "PERFECT-KEYBOARD-SUITE/macros/4_PK_PIHAK_KETIGA.4pk", size: "~16 KB", isPrimary: false }
    ],
    installTab: "tab-pk"
  },
  {
    id: "extension-scatter",
    category: "extension",
    categoryLabel: "OCR / Extension",
    name: "EXTENSION-SCATTER-SMJ",
    badge: "Tesseract WASM OCR • v2.7 (Sheets Sync & Safety Lock)",
    icon: "🎰",
    tagline: "Local OCR Extraction, 4-Column Queue, Instant Sheets Sync & Safety Lock 100%",
    description: "Ekstensi browser cerdas bertenaga Tesseract.js WebAssembly (WASM). Dilengkapi parser antrean multi-kolom (UserID, Tiket, Livechat, Screenshot), sinkronisasi instan Google Sheets anti-data loss (auto-retry 3x), verifikasi ganda Safety Lock 100%, dan dashboard 8-kolom interaktif.",
    features: [
      "100% Client-Side OCR bertenaga Tesseract WASM & SIMD",
      "Antrean Cerdas 4-Kolom (UserID, Kode Tiket, Link Livechat, Bukti SS)",
      "Instant Google Sheets Sync dengan Auto-Retry 3x (Anti Data Loss)",
      "Kunci Pengaman Scatter (Safety Lock 100% Verifikasi Ganda)",
      "Dashboard Monitor 8 Kolom dengan Tautan Cepat Livechat & SS",
      "Auto-Spacing Pintar saat Paste Antrean & Auto-Format HTTPS"
    ],
    fileCount: "19 Files (WASM Engine + Dashboard + Auto Sync)",
    keyFiles: [
      { name: "background.js", desc: "Service Worker Antrean Multi-Batch, Instant Sheets Sync & Auto-Retry" },
      { name: "dashboard.html / .js", desc: "Dashboard Monitor 8 Kolom, Auto-Spacing Paste & Akses Cepat Livechat/SS" },
      { name: "bonussmb-content.js", desc: "Content Script Automasi Bonus & Verifikasi Ganda (Safety Lock 100%)" },
      { name: "tesseract-core-simd.wasm", desc: "SIMD Accelerated WebAssembly Binary untuk Ekstraksi Cepat" },
      { name: "popup.js / .html", desc: "Control Panel Popup dengan Fitur Auto-Spacing saat Paste Antrean" }
    ],
    downloads: [
      { name: "Download OCR Extension (.zip)", file: "EXTENSION-SCATTER-SMJ.zip", size: "~20.7 MB", isPrimary: true }
    ],
    installTab: "tab-scatter"
  },
  {
    id: "auto-ss",
    category: "automation",
    categoryLabel: "Automation Tool",
    name: "AUTO-SCREENSHOT-LOGGER",
    badge: "1-Click Launch & Discord Sync",
    icon: "📸",
    tagline: "Ultra Modern Auto Screenshot Logger & Discord Webhook Uploader",
    description: "Aplikasi desktop otomatisasi tangkapan layar berkecepatan tinggi dengan peluncur 1-klik (1-KLIK-JALANKAN.bat). Dilengkapi menu dropdown pemilihan nama agen CS untuk auto-fill link Discord Webhook, deteksi ALT+TAB otomatis, dan monitoring real-time.",
    features: [
      "1-Click Launcher Instan (1-KLIK-JALANKAN.bat)",
      "Dropdown Pemilih Nama Agen CS (Auto-Fill Webhook Discord)",
      "Deteksi Tombol ALT+TAB & Screenshot Berkala Terjadwal",
      "Background Service Tersembunyi tanpa Jendela Terminal"
    ],
    fileCount: "Paket Rapi (Launcher, App, Webhooks, Python)",
    keyFiles: [
      { name: "1-KLIK-JALANKAN.bat", desc: "Launcher Utama Sekali Klik Langsung Buka" },
      { name: "DAFTAR_WEBHOOK_CS.txt", desc: "Database Webhook Discord Tiap Agen CS" },
      { name: "app/core.py & main.py", desc: "Mesin Screenshot, GUI & Discord Dispatcher" },
      { name: "PANDUAN_PENGGUNAAN.md", desc: "Panduan Pemakaian Cepat Bahasa Indonesia" },
      { name: "python-3.13.2-amd64.exe", desc: "Installer Python Offline Bawaan" }
    ],
    downloads: [
      { name: "Download Auto Screenshot Logger (.zip)", file: "AUTO-SCREENSHOT-LOGGER.zip", size: "~27 MB", isPrimary: true }
    ],
    installTab: "tab-autoss"
  }
];

// Soundboard Assets
const AUDIO_ASSETS = {
  defuse: "EXTENSION CHAT-SMJ/pb-bom-defuse_HORy4kEd.mp3",
  instant: "EXTENSION CHAT-SMJ/myinstants.mp3"
};

let currentAudio = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  renderModulesGrid(MODULES_DATA);
  renderDownloadCenter(MODULES_DATA);
  setupFilterAndSearch();
  setupInstallationTabs();
  setupSoundboard();
  setupModal();
  setupCopyButtons();
  setupSmoothScroll();
});

// Render Cards
function renderModulesGrid(modules) {
  const grid = document.getElementById("modules-grid");
  if (!grid) return;

  if (modules.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <p style="font-size: 1.2rem; font-weight: 700;">Modul tidak ditemukan</p>
        <p style="font-size: 0.9rem; margin-top: 6px;">Coba gunakan kata kunci pencarian lain.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = modules.map(mod => {
    // Special Landing Page Button for EXTENSION CHAT-SMJ
    const liveLandingBtn = mod.directLandingUrl ? `
      <a href="${mod.directLandingUrl}" target="_blank" class="btn btn-accent btn-sm" style="width: 100%; margin-bottom: 8px;">
        <span>🌐 Buka Landingpage CHAT-SMJ</span>
        <span>↗</span>
      </a>
    ` : '';

    const primaryDl = mod.downloads.find(d => d.isPrimary) || mod.downloads[0];
    const downloadButton = `
      <a href="${primaryDl.file}" download class="btn btn-primary btn-sm" style="flex: 1;">
        <span>⬇</span>
        <span>${primaryDl.name}</span>
      </a>
    `;

    return `
      <div class="module-card" data-category="${mod.category}">
        <div>
          <div class="card-top">
            <div class="card-icon-badge">${mod.icon}</div>
            <span class="card-category-tag">${mod.categoryLabel}</span>
          </div>
          <h3 class="card-title">${mod.name}</h3>
          <p class="card-description">${mod.description}</p>
          
          <ul class="card-features-list">
            ${mod.features.slice(0, 3).map(f => `
              <li class="card-feature-item">
                <span class="feature-bullet"></span>
                <span>${f}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        <div>
          <div class="card-file-summary">
            <span>📦</span>
            <span>${mod.fileCount}</span>
          </div>

          <!-- Special Landingpage Button if applicable -->
          ${liveLandingBtn}

          <!-- Quick Action Buttons -->
          <div class="card-action-row" style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            ${downloadButton}
          </div>

          <div class="card-footer-actions" style="margin-top: 8px;">
            <button class="btn btn-secondary btn-sm open-detail-btn" data-id="${mod.id}" style="width: 100%;">
              <span>🔍 Detail File & Semua Download</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Re-bind click handlers for modal
  document.querySelectorAll(".open-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      openModuleModal(id);
    });
  });
}

// Render Download Center Hub
function renderDownloadCenter(modules) {
  const downloadGrid = document.getElementById("download-center-grid");
  if (!downloadGrid) return;

  downloadGrid.innerHTML = modules.map(mod => {
    const downloadLinks = mod.downloads.map(dl => `
      <a href="${dl.file}" download class="download-item-btn">
        <div class="download-item-left">
          <span class="dl-icon">⬇</span>
          <div>
            <div class="dl-name">${dl.name}</div>
            <div class="dl-meta">Ukuran: ${dl.size} • Format: ${dl.file.endsWith('.zip') ? 'ZIP' : '4PK'}</div>
          </div>
        </div>
        <span class="dl-badge">${dl.isPrimary ? 'Download' : 'Get .4pk'}</span>
      </a>
    `).join("");

    const chatLandingLink = mod.directLandingUrl ? `
      <a href="${mod.directLandingUrl}" target="_blank" class="download-item-btn direct-link-btn" style="border-color: rgba(157, 78, 221, 0.5); background: rgba(157, 78, 221, 0.1);">
        <div class="download-item-left">
          <span class="dl-icon" style="color: #c084fc;">🌐</span>
          <div>
            <div class="dl-name" style="color: #f3e8ff;">Buka Landing Page Interaktif</div>
            <div class="dl-meta">Executive Command Center Live UI</div>
          </div>
        </div>
        <span class="dl-badge" style="background: #9d4edd; color: #fff;">Buka ↗</span>
      </a>
    ` : '';

    return `
      <div class="download-card">
        <div class="download-card-header">
          <div class="download-card-icon">${mod.icon}</div>
          <div>
            <h4>${mod.name}</h4>
            <span class="download-card-badge">${mod.badge}</span>
          </div>
        </div>
        <p class="download-card-desc">${mod.tagline}</p>
        <div class="download-links-list">
          ${chatLandingLink}
          ${downloadLinks}
        </div>
      </div>
    `;
  }).join("");
}

// Filter and Search
function setupFilterAndSearch() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const searchInput = document.getElementById("module-search");

  let currentCategory = "all";
  let currentSearch = "";

  function applyFilters() {
    const filtered = MODULES_DATA.filter(mod => {
      const matchesCategory = currentCategory === "all" || mod.category === currentCategory;
      const matchesSearch = !currentSearch || 
        mod.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
        mod.description.toLowerCase().includes(currentSearch.toLowerCase()) ||
        mod.tagline.toLowerCase().includes(currentSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
    renderModulesGrid(filtered);
  }

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-filter");
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.trim();
      applyFilters();
    });
  }
}

// Installation Tabs
function setupInstallationTabs() {
  const tabs = document.querySelectorAll(".install-tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      activateInstallTab(target);
    });
  });
}

function activateInstallTab(tabId) {
  const tabs = document.querySelectorAll(".install-tab-btn");
  const panes = document.querySelectorAll(".tab-pane");

  tabs.forEach(t => {
    if (t.getAttribute("data-tab") === tabId) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  panes.forEach(p => {
    if (p.id === tabId) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
}

// Soundboard Logic
function setupSoundboard() {
  const playButtons = document.querySelectorAll(".play-sound-btn");

  playButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const soundKey = btn.getAttribute("data-sound");
      const soundSrc = AUDIO_ASSETS[soundKey];

      if (!soundSrc) return;

      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        document.querySelectorAll(".play-sound-btn").forEach(b => b.classList.remove("playing"));
      }

      currentAudio = new Audio(soundSrc);
      btn.classList.add("playing");

      currentAudio.play().catch(e => {
        console.warn("Audio playback issue:", e);
      });

      currentAudio.onended = () => {
        btn.classList.remove("playing");
      };
    });
  });
}

// Modal Dialog
function setupModal() {
  const backdrop = document.getElementById("modal-backdrop");
  const closeBtn = document.getElementById("modal-close-btn");

  if (!backdrop || !closeBtn) return;

  closeBtn.addEventListener("click", () => {
    backdrop.classList.remove("active");
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      backdrop.classList.remove("active");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("active")) {
      backdrop.classList.remove("active");
    }
  });
}

function openModuleModal(moduleId) {
  const module = MODULES_DATA.find(m => m.id === moduleId);
  if (!module) return;

  const backdrop = document.getElementById("modal-backdrop");
  const iconEl = document.getElementById("modal-module-icon");
  const titleEl = document.getElementById("modal-module-title");
  const badgeEl = document.getElementById("modal-module-badge");
  const descEl = document.getElementById("modal-module-desc");
  const featuresEl = document.getElementById("modal-module-features");
  const filesEl = document.getElementById("modal-module-files");
  const modalActionsEl = document.getElementById("modal-actions-container");

  if (iconEl) iconEl.textContent = module.icon;
  if (titleEl) titleEl.textContent = module.name;
  if (badgeEl) badgeEl.textContent = module.badge;
  if (descEl) descEl.textContent = module.description;

  if (featuresEl) {
    featuresEl.innerHTML = module.features.map(f => `
      <li class="card-feature-item" style="margin-bottom: 8px;">
        <span class="feature-bullet"></span>
        <span style="font-size: 0.9rem;">${f}</span>
      </li>
    `).join("");
  }

  if (filesEl) {
    filesEl.innerHTML = module.keyFiles.map(kf => `
      <div class="file-tree-item">
        <span style="color: #38bdf8; font-weight: 600;">📄 ${kf.name}</span>
        <span style="font-size: 0.78rem; color: var(--text-dim);">${kf.desc}</span>
      </div>
    `).join("");
  }

  if (modalActionsEl) {
    const landingBtn = module.directLandingUrl ? `
      <a href="${module.directLandingUrl}" target="_blank" class="btn btn-accent">
        <span>🌐 Buka Landing Page Modul</span>
        <span>↗</span>
      </a>
    ` : '';

    const downloadBtns = module.downloads.map(dl => `
      <a href="${dl.file}" download class="btn ${dl.isPrimary ? 'btn-primary' : 'btn-secondary'} btn-sm">
        <span>⬇</span>
        <span>${dl.name}</span>
      </a>
    `).join("");

    modalActionsEl.innerHTML = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; width: 100%;">
        ${landingBtn}
        ${downloadBtns}
        <button class="btn btn-secondary btn-sm" id="modal-guide-action-btn">
          <span>Panduan Pemasangan</span>
          <span>→</span>
        </button>
      </div>
    `;

    const guideBtn = document.getElementById("modal-guide-action-btn");
    if (guideBtn) {
      guideBtn.onclick = () => {
        backdrop.classList.remove("active");
        activateInstallTab(module.installTab);
        const guideSection = document.getElementById("guides");
        if (guideSection) {
          guideSection.scrollIntoView({ behavior: "smooth" });
        }
      };
    }
  }

  backdrop.classList.add("active");
}

// Copy Code Snippets
function setupCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const codeBlock = btn.parentElement.querySelector(".code-block");
      if (!codeBlock) return;

      const text = codeBlock.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = "Tersalin! ✓";
        btn.style.background = "#10b981";
        btn.style.color = "#030a16";

        setTimeout(() => {
          btn.textContent = original;
          btn.style.background = "";
          btn.style.color = "";
        }, 2000);
      });
    });
  });
}

// Smooth Scrolling for Nav Links
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElem = document.querySelector(targetId);
      if (targetElem) {
        e.preventDefault();
        targetElem.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}
