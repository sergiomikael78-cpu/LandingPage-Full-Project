/* ============================================
   STREET ART ADMIN CUSTOMIZER - POPUP LOGIC
   ============================================ */

// Bank definitions with brand colors
const BANKS = [
  { name: 'BCA', color: '#003D79', textColor: '#FFFFFF' },
  { name: 'BNI', color: '#F26522', textColor: '#FFFFFF' },
  { name: 'BRI', color: '#0060AF', textColor: '#FFFFFF' },
  { name: 'BSI', color: '#00874A', textColor: '#FFFFFF' },
  { name: 'CIMB', color: '#7B1113', textColor: '#FFFFFF' },
  { name: 'DANA', color: '#108EE9', textColor: '#FFFFFF' },
  { name: 'DANAMON', color: '#E8430A', textColor: '#FFFFFF' },
  { name: 'GOPAY', color: '#00AA13', textColor: '#FFFFFF' },
  { name: 'JAGO', color: '#FFBE00', textColor: '#1A1A1A' },
  { name: 'LINKAJA', color: '#E31E25', textColor: '#FFFFFF' },
  { name: 'MANDIRI', color: '#003878', textColor: '#F1C232' },
  { name: 'MAYBANK', color: '#FDB913', textColor: '#1A1A1A' },
  { name: 'OVO', color: '#4C2A86', textColor: '#FFFFFF' },
  { name: 'QRIS', color: '#E42313', textColor: '#FFFFFF' },
  { name: 'SEABANK', color: '#FF6600', textColor: '#FFFFFF' }
];

// Default settings
const DEFAULT_SETTINGS = {
  targetUrl: '',
  isEnabled: true,
  bankHighlights: true,
  bankColors: {},
  backgroundImage: null,
  backgroundOpacity: 15,
  themeColors: {
    sidebarBg: '#2c1810',
    sidebarText: '#ffffff',
    headerBg: '#8B6914',
    headerText: '#ffffff',
    tableRowOdd: '#f5f5f5',
    tableRowEven: '#ffffff',
    tableText: '#333333',
    buttonPrimary: '#e8860c',
    buttonSecondary: '#4a90d9'
  },
  quickNotes: {},
  skaterCombos: { enabled: true },
  watchedUsers: { vip: [], wanted: [] },
  autoCopyEnabled: true,
  customWords: []
};

let currentSettings = { ...DEFAULT_SETTINGS };
let selectedNoteColor = '#FF006E';
let selectedWatchType = 'wanted';

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initTabs();
  initBankGrid();
  initUrlTab();
  initThemeTab();
  initNotesTab();
  initCombosTab();
  initWatchTab();
  initToolsTab();
  initWordsTab();
  initMasterToggle();
});

// ============ SETTINGS LOAD/SAVE ============
function loadSettings() {
  chrome.storage.local.get('streetArtSettings', (data) => {
    if (data.streetArtSettings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...data.streetArtSettings };
    }
    applySettingsToUI();
  });
}

function saveSettings(callback) {
  chrome.storage.local.set({ streetArtSettings: currentSettings }, () => {
    // Notify content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: currentSettings
        }).catch(() => {});
      });
    });
    if (callback) callback();
  });
}

function applySettingsToUI() {
  // Master toggle
  const masterToggle = document.getElementById('masterToggle');
  if (masterToggle) masterToggle.checked = currentSettings.isEnabled;

  // URL
  const urlInput = document.getElementById('targetUrl');
  if (urlInput) urlInput.value = currentSettings.targetUrl || '';

  // Bank highlights
  const bankToggle = document.getElementById('bankHighlightsToggle');
  if (bankToggle) bankToggle.checked = currentSettings.bankHighlights;

  // Background opacity
  const opacitySlider = document.getElementById('bgOpacity');
  const opacityValue = document.getElementById('opacityValue');
  if (opacitySlider) {
    opacitySlider.value = currentSettings.backgroundOpacity || 15;
    if (opacityValue) opacityValue.textContent = `${opacitySlider.value}%`;
  }

  // Background image preview
  if (currentSettings.backgroundImage) {
    showBgPreview(currentSettings.backgroundImage);
  }

  // Theme colors
  const colorMap = {
    colorSidebarBg: 'sidebarBg',
    colorSidebarText: 'sidebarText',
    colorHeaderBg: 'headerBg',
    colorHeaderText: 'headerText',
    colorTableOdd: 'tableRowOdd',
    colorTableEven: 'tableRowEven',
    colorTableText: 'tableText',
    colorBtnPrimary: 'buttonPrimary',
    colorBtnSecondary: 'buttonSecondary'
  };
  Object.entries(colorMap).forEach(([elId, settingKey]) => {
    const el = document.getElementById(elId);
    if (el && currentSettings.themeColors && currentSettings.themeColors[settingKey]) {
      el.value = currentSettings.themeColors[settingKey];
    }
  });

  // Combos toggle
  const combosToggle = document.getElementById('combosToggle');
  if (combosToggle) combosToggle.checked = currentSettings.skaterCombos?.enabled !== false;

  // AutoCopy toggle
  const autoCopyToggle = document.getElementById('autoCopyToggle');
  if (autoCopyToggle) autoCopyToggle.checked = currentSettings.autoCopyEnabled !== false;

  // Notes
  renderNotes();

  // Watch lists
  renderWatchLists();

  // Custom Words
  renderCustomWords();
}

// ============ TABS ============
function initTabs() {
  const tabs = document.querySelectorAll('.sa-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sa-panel').forEach(p => p.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// ============ MASTER TOGGLE ============
function initMasterToggle() {
  const toggle = document.getElementById('masterToggle');
  toggle.addEventListener('change', () => {
    currentSettings.isEnabled = toggle.checked;
    saveSettings();
  });
}

// ============ URL TAB ============
function initUrlTab() {
  const saveBtn = document.getElementById('saveUrl');
  const input = document.getElementById('targetUrl');
  const status = document.getElementById('urlStatus');

  saveBtn.addEventListener('click', () => {
    const url = input.value.trim();
    if (!url) {
      showStatus(status, 'error', '⚠️ Masukkan URL domain terlebih dahulu!');
      return;
    }
    // Clean URL
    const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    currentSettings.targetUrl = cleanUrl;
    input.value = cleanUrl;
    saveSettings(() => {
      showStatus(status, 'success', `✅ URL disimpan: ${cleanUrl}`);
    });
  });
}

// ============ BANK GRID ============
function initBankGrid() {
  const grid = document.getElementById('bankGrid');
  if (!grid) return;

  grid.innerHTML = '';
  BANKS.forEach(bank => {
    const item = document.createElement('div');
    item.className = 'sa-bank-item';
    item.setAttribute('data-bank', bank.name);
    item.innerHTML = `
      <div class="sa-bank-dot"></div>
      <span class="sa-bank-name">${bank.name}</span>
    `;
    grid.appendChild(item);
  });

  // Bank highlights toggle
  const toggle = document.getElementById('bankHighlightsToggle');
  toggle.addEventListener('change', () => {
    currentSettings.bankHighlights = toggle.checked;
    saveSettings();
  });
}

// ============ THEME TAB ============
function initThemeTab() {
  // Background upload
  const uploadArea = document.getElementById('bgUploadArea');
  const fileInput = document.getElementById('bgFileInput');
  const removeBtn = document.getElementById('removeBg');
  const opacitySlider = document.getElementById('bgOpacity');
  const opacityValue = document.getElementById('opacityValue');
  const saveThemeBtn = document.getElementById('saveTheme');
  const themeStatus = document.getElementById('themeStatus');

  // Click to upload
  uploadArea.addEventListener('click', () => fileInput.click());

  // Drag & drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  });

  // File input
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file);
  });

  // Remove background
  removeBtn.addEventListener('click', () => {
    currentSettings.backgroundImage = null;
    document.getElementById('bgPreviewContainer').style.display = 'none';
    uploadArea.style.display = '';
    saveSettings();
  });

  // Opacity slider
  opacitySlider.addEventListener('input', (e) => {
    opacityValue.textContent = `${e.target.value}%`;
    currentSettings.backgroundOpacity = parseInt(e.target.value);
  });
  opacitySlider.addEventListener('change', () => {
    saveSettings();
  });

  // Save theme button
  saveThemeBtn.addEventListener('click', () => {
    const colorMap = {
      colorSidebarBg: 'sidebarBg',
      colorSidebarText: 'sidebarText',
      colorHeaderBg: 'headerBg',
      colorHeaderText: 'headerText',
      colorTableOdd: 'tableRowOdd',
      colorTableEven: 'tableRowEven',
      colorTableText: 'tableText',
      colorBtnPrimary: 'buttonPrimary',
      colorBtnSecondary: 'buttonSecondary'
    };
    if (!currentSettings.themeColors) currentSettings.themeColors = {};
    Object.entries(colorMap).forEach(([elId, settingKey]) => {
      const el = document.getElementById(elId);
      if (el) currentSettings.themeColors[settingKey] = el.value;
    });
    saveSettings(() => {
      showStatus(themeStatus, 'success', '🎨 Theme disimpan!');
    });
  });

  // Color reset buttons
  document.querySelectorAll('.sa-btn-reset').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const defaultVal = btn.getAttribute('data-default');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.value = defaultVal;
    });
  });
}

function handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // Check size - even with unlimitedStorage, too large base64 can lag the browser
    if (dataUrl.length > 15 * 1024 * 1024) {
      alert('Gambar terlalu besar! Maksimum 15MB.');
      return;
    }
    currentSettings.backgroundImage = dataUrl;
    showBgPreview(dataUrl);
    saveSettings();
  };
  reader.readAsDataURL(file);
}

function showBgPreview(dataUrl) {
  const preview = document.getElementById('bgPreview');
  const container = document.getElementById('bgPreviewContainer');
  const uploadArea = document.getElementById('bgUploadArea');
  preview.src = dataUrl;
  container.style.display = 'block';
  uploadArea.style.display = 'none';
}

// ============ NOTES TAB ============
function initNotesTab() {
  // Color selection
  document.querySelectorAll('.sa-note-color').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sa-note-color').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedNoteColor = btn.getAttribute('data-color');
    });
  });

  // Add note
  document.getElementById('addNote').addEventListener('click', () => {
    const userId = document.getElementById('noteUserId').value.trim();
    const noteText = document.getElementById('noteText').value.trim();

    if (!userId || !noteText) {
      alert('Isi UserID dan catatan!');
      return;
    }

    if (!currentSettings.quickNotes) currentSettings.quickNotes = {};
    currentSettings.quickNotes[userId] = {
      text: noteText,
      color: selectedNoteColor,
      timestamp: Date.now()
    };

    saveSettings(() => {
      renderNotes();
      document.getElementById('noteUserId').value = '';
      document.getElementById('noteText').value = '';
    });
  });
}

function renderNotes() {
  const container = document.getElementById('notesList');
  if (!container) return;

  const notes = currentSettings.quickNotes || {};
  const entries = Object.entries(notes);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="sa-empty-state">
        <span class="sa-empty-icon">🎨</span>
        <p>Belum ada catatan. Mulai spray!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([userId, note]) => `
    <div class="sa-note-entry" style="border-left-color: ${note.color}">
      <span class="sa-note-user" style="color: ${note.color}">${userId}</span>
      <span class="sa-note-text">${note.text}</span>
      <button class="sa-note-delete" data-user="${userId}" title="Hapus">✕</button>
    </div>
  `).join('');

  // Delete handlers
  container.querySelectorAll('.sa-note-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-user');
      delete currentSettings.quickNotes[userId];
      saveSettings(() => renderNotes());
    });
  });
}

// ============ COMBOS TAB ============
function initCombosTab() {
  const toggle = document.getElementById('combosToggle');
  toggle.addEventListener('change', () => {
    if (!currentSettings.skaterCombos) currentSettings.skaterCombos = {};
    currentSettings.skaterCombos.enabled = toggle.checked;
    saveSettings();
  });
}

// ============ WATCH TAB ============
function initWatchTab() {
  // Watch type toggle
  const wantedBtn = document.getElementById('typeWanted');
  const vipBtn = document.getElementById('typeVip');

  wantedBtn.addEventListener('click', () => {
    wantedBtn.classList.add('active');
    vipBtn.classList.remove('active');
    selectedWatchType = 'wanted';
  });

  vipBtn.addEventListener('click', () => {
    vipBtn.classList.add('active');
    wantedBtn.classList.remove('active');
    selectedWatchType = 'vip';
  });

  // Add watch
  document.getElementById('addWatch').addEventListener('click', () => {
    const userId = document.getElementById('watchUserId').value.trim();
    if (!userId) {
      alert('Masukkan UserID!');
      return;
    }

    if (!currentSettings.watchedUsers) {
      currentSettings.watchedUsers = { vip: [], wanted: [] };
    }

    const list = selectedWatchType === 'vip' ? currentSettings.watchedUsers.vip : currentSettings.watchedUsers.wanted;

    // Prevent duplicates
    if (!list.includes(userId)) {
      list.push(userId);
      // Remove from opposite list if exists
      const otherList = selectedWatchType === 'vip' ? currentSettings.watchedUsers.wanted : currentSettings.watchedUsers.vip;
      const idx = otherList.indexOf(userId);
      if (idx > -1) otherList.splice(idx, 1);

      saveSettings(() => {
        renderWatchLists();
        document.getElementById('watchUserId').value = '';
      });
    }
  });
}

function renderWatchLists() {
  const wantedContainer = document.getElementById('wantedList');
  const vipContainer = document.getElementById('vipList');

  if (!wantedContainer || !vipContainer) return;

  const wanted = currentSettings.watchedUsers?.wanted || [];
  const vip = currentSettings.watchedUsers?.vip || [];

  // Render wanted
  if (wanted.length === 0) {
    wantedContainer.innerHTML = `<div class="sa-empty-state"><span class="sa-empty-icon">👮</span><p>Belum ada target.</p></div>`;
  } else {
    wantedContainer.innerHTML = wanted.map(userId => `
      <div class="sa-watch-entry wanted">
        <span>🚨 ${userId}</span>
        <button class="sa-note-delete" data-user="${userId}" data-type="wanted" title="Hapus">✕</button>
      </div>
    `).join('');
  }

  // Render VIP
  if (vip.length === 0) {
    vipContainer.innerHTML = `<div class="sa-empty-state"><span class="sa-empty-icon">🏆</span><p>Belum ada VIP.</p></div>`;
  } else {
    vipContainer.innerHTML = vip.map(userId => `
      <div class="sa-watch-entry vip">
        <span>👑 ${userId}</span>
        <button class="sa-note-delete" data-user="${userId}" data-type="vip" title="Hapus">✕</button>
      </div>
    `).join('');
  }

  // Delete handlers
  document.querySelectorAll('#wantedList .sa-note-delete, #vipList .sa-note-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-user');
      const type = btn.getAttribute('data-type');
      const list = type === 'vip' ? currentSettings.watchedUsers.vip : currentSettings.watchedUsers.wanted;
      const idx = list.indexOf(userId);
      if (idx > -1) {
        list.splice(idx, 1);
        saveSettings(() => renderWatchLists());
      }
    });
  });
}

// ============ TOOLS TAB ============
function initToolsTab() {
  // Auto-copy toggle
  const autoCopyToggle = document.getElementById('autoCopyToggle');
  autoCopyToggle.addEventListener('change', () => {
    currentSettings.autoCopyEnabled = autoCopyToggle.checked;
    saveSettings();
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => {
    const exportData = { ...currentSettings };
    // Don't export the background image in file (too large)
    const bgImage = exportData.backgroundImage;
    exportData.backgroundImage = null;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `street-art-config-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus(document.getElementById('toolsStatus'), 'success', '📤 Config exported!');
  });

  // Import
  const importArea = document.getElementById('importArea');
  const importInput = document.getElementById('importFileInput');

  importArea.addEventListener('click', () => importInput.click());
  importArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    importArea.classList.add('dragover');
  });
  importArea.addEventListener('dragleave', () => importArea.classList.remove('dragover'));
  importArea.addEventListener('drop', (e) => {
    e.preventDefault();
    importArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImport(file);
  });
  importInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleImport(e.target.files[0]);
  });
}

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      // Merge with defaults to ensure all keys exist
      currentSettings = { ...DEFAULT_SETTINGS, ...imported };
      // Keep existing background image if imported doesn't have one
      saveSettings(() => {
        applySettingsToUI();
        showStatus(document.getElementById('toolsStatus'), 'success', '📥 Config imported! Refresh halaman admin untuk melihat perubahan.');
      });
    } catch (err) {
      showStatus(document.getElementById('toolsStatus'), 'error', '⚠️ File JSON tidak valid!');
    }
  };
  reader.readAsText(file);
}

// ============ HELPERS ============
function showStatus(el, type, message) {
  if (!el) return;
  el.className = `sa-status ${type}`;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 4000);
}

// ============ WORDS TAB (Custom Highlights) ============
function initWordsTab() {
  const addCwBtn = document.getElementById('addCwBtn');
  if (addCwBtn) {
    addCwBtn.addEventListener('click', () => {
      const cwInput = document.getElementById('cwText');
      const text = (cwInput.value || '').trim();
      const bg = document.getElementById('cwBg').value;
      const color = document.getElementById('cwTextCol').value;

      if (!text) {
        // Find the status element in tab-words
        let status = document.getElementById('cwStatus');
        if(!status) {
            status = document.createElement('div');
            status.id = 'cwStatus';
            addCwBtn.parentElement.appendChild(status);
        }
        showStatus(status, 'error', 'Masukkan kata dulu, bro!');
        return;
      }

      if (!currentSettings.customWords) currentSettings.customWords = [];
      
      // Check if exists
      const existsIndex = currentSettings.customWords.findIndex(w => w.text.toLowerCase() === text.toLowerCase());
      if (existsIndex >= 0) {
        currentSettings.customWords[existsIndex] = { text, bg, color };
      } else {
        currentSettings.customWords.push({ text, bg, color });
      }

      saveSettings(() => {
        cwInput.value = '';
        renderCustomWords();
        
        let status = document.getElementById('cwStatus');
        if(!status) {
            status = document.createElement('div');
            status.id = 'cwStatus';
            addCwBtn.parentElement.appendChild(status);
        }
        showStatus(status, 'success', 'Kata disimpan! 💥');
      });
    });
  }
}

function renderCustomWords() {
  const list = document.getElementById('cwList');
  if (!list) return;

  list.innerHTML = '';
  const words = currentSettings.customWords || [];

  if (words.length === 0) {
    list.innerHTML = '<div class="sa-empty-state"><span class="sa-empty-icon">🔤</span><p>Belum ada kata khusus.</p></div>';
    return;
  }

  words.forEach((w, index) => {
    const item = document.createElement('div');
    item.className = 'sa-note-item';
    
    // Style the word like it will look on the page
    const badgeStyle = `background: ${w.bg}; color: ${w.color}; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-shadow: 1px 1px 0 rgba(0,0,0,0.5); font-family: 'Outfit', sans-serif;`;

    item.innerHTML = `
      <div style="flex-grow: 1;">
        <span style="${badgeStyle}"></span>
      </div>
      <button class="sa-btn-del" data-index="${index}">✕</button>
    `;
    item.querySelector('span').textContent = w.text; // Safer than innerHTML for user input

    const delBtn = item.querySelector('.sa-btn-del');
    delBtn.addEventListener('click', () => {
      currentSettings.customWords.splice(index, 1);
      saveSettings(() => {
        renderCustomWords();
      });
    });

    list.appendChild(item);
  });
}
