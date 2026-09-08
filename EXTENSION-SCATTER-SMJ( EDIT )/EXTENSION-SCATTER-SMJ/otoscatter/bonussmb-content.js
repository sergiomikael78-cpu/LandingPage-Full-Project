// bonussmb-content.js
// Content script untuk auto-fill Form Tiket di bonussmb.com/tickets
// Diadaptasi dari CekBonus untuk SMJ AUTO

function setNativeValue(el, value) {
  const v = String(value ?? '');
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && typeof desc.set === 'function') {
    desc.set.call(el, v);
  } else {
    el.value = v;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function isVisible(el) {
  if (!el) return false;
  const cs = window.getComputedStyle(el);
  if (!cs) return false;
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function x1(path) {
  try {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  } catch {
    return null;
  }
}

function parseNumberLike(input) {
  const s = String(input ?? '').replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clampBettingValue(n) {
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v < 0) return 0;
  return Math.min(v, 9999999);
}

function findInputByPlaceholder(placeholder) {
  return document.querySelector(`input[data-slot="input"][placeholder="${placeholder}"]`) ||
    document.querySelector(`input[placeholder="${placeholder}"]`);
}

function findTextareaByPlaceholder(placeholder) {
  return document.querySelector(`textarea[data-slot="textarea"][placeholder="${placeholder}"]`) ||
    document.querySelector(`textarea[placeholder="${placeholder}"]`);
}

function findTambahDataTrigger() {
  const triggers = Array.from(document.querySelectorAll('button[data-slot="dialog-trigger"], [data-slot="dialog-trigger"]'));
  const bySlot = triggers.find((el) => isVisible(el));
  if (bySlot) return bySlot;

  const keywords = ['tambah data', 'tambah', 'add', 'create', 'new', 'buat'];
  const buttons = Array.from(document.querySelectorAll('button'));
  const matchBtn = buttons.find((el) => {
    const t = String(el.textContent || '').trim().toLowerCase();
    if (!t) return false;
    if (!isVisible(el)) return false;
    return keywords.some((k) => t.includes(k));
  });
  if (matchBtn) return matchBtn;
  return null;
}

async function ensureFormOpen() {
  const hasFormTitle = () => {
    const title = Array.from(document.querySelectorAll('div')).find((d) => String(d.textContent || '').trim() === 'Form Tiket');
    return !!title;
  };

  if (hasFormTitle()) return true;

  const started = Date.now();
  let clicked = false;
  while (Date.now() - started < 20000) {
    if (hasFormTitle()) return true;
    
    // Fallback deteksi form via input
    const userInput = findInputByPlaceholder('User ID');
    const kodeInput = findInputByPlaceholder('Kode Tiket');
    if (userInput && kodeInput && isVisible(userInput) && isVisible(kodeInput)) return true;

    // Coba buka form via trigger jika belum diklik
    if (!clicked) {
      const trigger = findTambahDataTrigger();
      if (trigger && isVisible(trigger)) {
        try { trigger.scrollIntoView({ block: 'center' }); } catch {}
        try { trigger.click(); } catch {}
        clicked = true;
      }
    }
    
    // Gaya CekBonus: Jika sudah lama tidak terbuka, coba scroll ke atas
    if (!clicked && Date.now() - started > 4000) {
      try { window.scrollTo(0, 0); } catch {}
    }

    await sleep(400);
  }
  return false;
}

function getFormElement() {
  const titleEl = Array.from(document.querySelectorAll('div')).find((d) => String(d.textContent || '').trim() === 'Form Tiket');
  if (titleEl) {
    const root = titleEl.closest('[role="dialog"]') || titleEl.closest('div');
    const form = root ? root.querySelector('form') : null;
    if (form) return form;
  }
  return document.querySelector('[role="dialog"]') || document.querySelector('form') || document.body;
}

function getControlsFromForm(formEl) {
  if (!formEl) return { situs: null, tipe: null, scatter: null };
  const containers = Array.from(formEl.querySelectorAll('.css-b62m3t-container'));
  const situs = containers[0] || null;
  const tipe = containers[1] || null;
  const scatter = findScatterSelectRoot() || containers[2] || null;
  return { situs, tipe, scatter };
}

function findScatterSelectRoot() {
  const labels = Array.from(document.querySelectorAll('div'));
  const label = labels.find((d) => String(d.textContent || '').trim() === 'Jumlah Scatter');
  if (!label) return null;
  const row = label.closest('.flex') || label.parentElement;
  if (!row) return null;
  const container = row.querySelector('.css-b62m3t-container') || row.querySelector('[class*="css-"]');
  return container;
}

function findSelectContainerByLabel(labelText) {
  const labels = Array.from(document.querySelectorAll('div'));
  const label = labels.find((d) => String(d.textContent || '').trim() === labelText);
  if (!label) return null;
  const row = label.closest('.flex') || label.parentElement;
  if (!row) return null;
  const container = row.querySelector('.css-b62m3t-container');
  return container || null;
}

function sleep(ms) {
  const n = Number(ms || 0);
  const scaled = Math.max(5, Math.round(n * 0.65));
  
  return new Promise((resolve) => {
    // Gunakan MessageChannel untuk bypass background tab throttling
    const channel = new MessageChannel();
    const start = performance.now();
    
    channel.port1.onmessage = () => {
      if (performance.now() - start >= scaled) {
        resolve();
      } else {
        channel.port2.postMessage(null);
      }
    };
    channel.port2.postMessage(null);
  });
}

function findSaveButton(formEl) {
  const root = (formEl && (formEl.closest('[role="dialog"]') || formEl.closest('div'))) || document;
  const buttons = Array.from(root.querySelectorAll('button'));
  const isClickable = (b) => {
    if (!b) return false;
    if (b.disabled) return false;
    const ariaDisabled = b.getAttribute('aria-disabled');
    if (ariaDisabled === 'true') return false;
    return isVisible(b);
  };
  const byText = buttons.find((b) => isClickable(b) && String(b.textContent || '').trim().toLowerCase() === 'simpan');
  if (byText) return byText;
  const bySlot = buttons.find((b) => isClickable(b) && b.getAttribute('data-slot') === 'button');
  if (bySlot) return bySlot;
  const byType = buttons.find((b) => isClickable(b) && b.getAttribute('type') === 'submit');
  return byType || null;
}

async function waitForTicketSaveResponse(timeoutMs = 3000) {
  const start = Date.now();
  console.log('[STEALTH STABIL] ⏳ Menunggu respon dari server BonusSMB...');
  
  while (Date.now() - start < timeoutMs) {
    const text = String(document.body && document.body.innerText ? document.body.innerText : '').toLowerCase();
    
    // Deteksi Berhasil
    if (text.includes('berhasil') || text.includes('success')) {
      console.log('[STEALTH STABIL] ✅ Konfirmasi: Tiket berhasil disimpan.');
      return { ok: true };
    }
    
    // Deteksi Duplikat/Sudah Terambil
    if (text.includes('already been taken') || text.includes('sudah ada')) {
      console.log('[STEALTH STABIL] ⚠️ Konfirmasi: Tiket sudah ada di sistem.');
      return { ok: false, error: 'The ticket code has already been taken.' };
    }

    // Deteksi Error Umum (Eligible, dsb)
    if (text.includes('tidak memenuhi kriteria') || text.includes('not eligible')) {
      return { ok: false, error: 'Ineligible ticket' };
    }
    
    // Deteksi Limit Maksimal Klaim
    if (text.includes('maksimal total klaim') || text.includes('sudah klaim') || text.search(/sudah klaim [0-9]+x/) !== -1) {
       console.log('[STEALTH STABIL] ❌ Error Terdeteksi: Limit Maksimal Klaim.');
       return { ok: false, error: 'User ini sudah claim 2x' };
    }

    await sleep(200);
  }
  
  // Jika timeout, anggap sukses jika tidak ada error mencolok (Gaya CekBonus)
  console.warn('[STEALTH STABIL] ⚠️ Timeout menunggu respon, melanjutkan...');
  return { ok: true }; 
}

function verifyScatterValue(target) {
  const container = findScatterSelectRoot();
  if (!container) return false;
  
  // Baca teks yang terpilih saat ini
  const displayed = container.querySelector('.select2__single-value') || 
                    container.querySelector('[class*="-singleValue"]') ||
                    container.querySelector('.select2__placeholder') || // Terkadang angka masuk ke placeholder jika statis
                    container;
  
  if (!displayed) return false;
  
  const currentText = String(displayed.textContent || '').trim();
  const targetText = String(target).trim();
  
  // Sangat akurat: Teks harus mengandung angka target secara eksplisit
  const isCorrect = currentText === targetText || currentText.includes('Scatter ' + targetText) || (currentText === '3' && targetText === '3');
  
  if (!isCorrect) {
    console.warn(`[SMJ AUTO] ❌ MISMATCH DETECTED: Target=${targetText}, Terbaca di Web=${currentText}`);
  } else {
    console.log(`[SMJ AUTO] ✅ VERIFIED: Scatter ${targetText} terpasang dengan benar.`);
  }
  
  return isCorrect;
}

async function fillScatterByVisualIndex(container, scatterValue) {
  if (!container) return false;
  
  const val = String(scatterValue).trim();
  console.log(`[SCATTER AUTO] 🎯 Mencari pilihan secara Cerdas & Akurat: ${val}`);

  const control = container.querySelector('.select2__control') || container;
  
  // 1. OPEN DROPDOWN
  try { control.scrollIntoView({ block: 'center' }); } catch {}
  control.click();
  await sleep(50);

  // 2. TUNGGU OPSI PADA REACT SELECT
  let attempts = 0;
  while (attempts < 15) {
    // Cari elemen opsi, react-select menggunakan id berawalan react-select- dan berakhiran -option-
    const allOptions = Array.from(document.querySelectorAll('div[id^="react-select-"][id*="-option-"], .select2-results__option, .select2__option, [role="option"]'));
    
    // Cari yang isinya tepat angka target
    const targetEl = allOptions.find(opt => {
      const txt = (opt.textContent || '').trim().toLowerCase();
      const valLower = val.toLowerCase();
      return txt === valLower || txt === `scatter ${valLower}` || txt === `jumlah scatter ${valLower}`;
    });

    if (targetEl) {
      console.log(`[SCATTER AUTO] ✅ Menemukan opsi "${targetEl.textContent.trim()}", mengeklik...`);
      try {
        targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      } catch {}
      targetEl.click();
      await sleep(100);
      
      // Jika berhasil memverifikasi bahwa opsinya berubah
      if (verifyScatterValue(val)) {
         return true;
      }
      break; // Jika verifikasi masih gagal, kita akan keluar dari loop untuk mencoba metode fallback keyboard
    }
    
    await sleep(50);
    attempts++;
  }

  console.warn('[SCATTER AUTO] ⚠️ Gagal menemukan opsi secara visual, melanjutkan ke mode Fallback Keyboard...');
  return false;
}

function dispatchKey(target, key) {
  if (!target) return;
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, code: key }));
  target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key, code: key }));
}

async function typeValue(el, value) {
  const text = String(value ?? '');
  try { el.focus(); } catch {}
  try {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
  } catch {}
  try {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', bubbles: true }));
  } catch {}
  setNativeValue(el, '');
  await sleep(50);

  for (const ch of text) {
    try {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: ch, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: ch, code: ch, bubbles: true }));
    } catch {}

    const next = String(el.value || '') + ch;
    setNativeValue(el, next);
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
    } catch {}

    try {
      el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, code: ch, bubbles: true }));
    } catch {}
    await sleep(60);
  }

  try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
  await sleep(80);
  try { el.blur(); } catch {}
}

function getComboboxTarget(container) {
  if (!container) return null;
  return (
    container.querySelector('input[id^="react-select-"][id$="-input"]') ||
    container.querySelector('input.select2__input') ||
    container.querySelector('[role="combobox"]') ||
    container.querySelector('input')
  );
}

async function openReactSelect(container) {
  if (!container) return false;
  const control = container.querySelector('.select2__control');
  if (!control) return false;
  const ariaDisabled = control.getAttribute('aria-disabled');
  if (ariaDisabled === 'true' || control.className.includes('--is-disabled')) return false;
  control.click();
  await sleep(80);
  const target = getComboboxTarget(container);
  if (target) {
    try { target.focus(); } catch {}
  }
  return true;
}

async function selectByKeyboard(container, { down = 1, up = 0 } = {}) {
  const opened = await openReactSelect(container);
  if (!opened) return false;
  const target = getComboboxTarget(container) || container;
  for (let i = 0; i < down; i++) {
    dispatchKey(target, 'ArrowDown');
    await sleep(60);
  }
  for (let i = 0; i < up; i++) {
    dispatchKey(target, 'ArrowUp');
    await sleep(60);
  }
  dispatchKey(target, 'Enter');
  await sleep(80);
  return true;
}

function findTambahDataTrigger() {
  const triggers = Array.from(document.querySelectorAll('button[data-slot="dialog-trigger"], [data-slot="dialog-trigger"]'));
  const bySlot = triggers.find((el) => isVisible(el));
  if (bySlot) return bySlot;

  const keywords = ['tambah data', 'tambah', 'add', 'create', 'new', 'buat'];

  const buttons = Array.from(document.querySelectorAll('button'));
  const matchBtn = buttons.find((el) => {
    const t = String(el.textContent || '').trim().toLowerCase();
    if (!t) return false;
    if (!isVisible(el)) return false;
    return keywords.some((k) => t.includes(k));
  });
  if (matchBtn) return matchBtn;

  const labelled = buttons.find((el) => {
    const aria = String(el.getAttribute('aria-label') || '').trim().toLowerCase();
    const title = String(el.getAttribute('title') || '').trim().toLowerCase();
    if (!isVisible(el)) return false;
    return keywords.some((k) => aria.includes(k) || title.includes(k));
  });
  if (labelled) return labelled;

  const divs = Array.from(document.querySelectorAll('div'));
  const matchDiv = divs.find((el) => {
    const t = String(el.textContent || '').trim().toLowerCase();
    if (!t) return false;
    if (!isVisible(el)) return false;
    return keywords.some((k) => t.includes(k));
  });
  if (matchDiv) return matchDiv.closest('button') || matchDiv;
  return null;
}

async function ensureFormOpen() {
  const bodyText = String(document.body && document.body.innerText ? document.body.innerText : '');
  const looksLikeLanding = bodyText.includes('Setiap hari adalah peluang baru') || bodyText.includes('SMBGROUP');
  if (looksLikeLanding) return false;

  const hasFormTitle = () => {
    const title = Array.from(document.querySelectorAll('div')).find((d) => String(d.textContent || '').trim() === 'Form Tiket');
    return !!title;
  };

  if (hasFormTitle()) return true;

  const started = Date.now();
  let clicked = false;
  while (Date.now() - started < 20000) {
    if (hasFormTitle()) return true;
    const userInput = findInputByPlaceholder('User ID');
    const kodeInput = findInputByPlaceholder('Kode Tiket');
    if (userInput && kodeInput && isVisible(userInput) && isVisible(kodeInput)) return true;

    const trigger = findTambahDataTrigger();
    if (trigger && isVisible(trigger)) {
      try { trigger.scrollIntoView({ block: 'center' }); } catch {}
      try { trigger.click(); } catch {}
      clicked = true;
    }

    if (!clicked && Date.now() - started > 4000) {
      try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch {
        try { window.scrollTo(0, 0); } catch {}
      }
    }

    await sleep(250);
  }
  return false;
}

function getFormElement() {
  const titleEl = Array.from(document.querySelectorAll('div')).find((d) => String(d.textContent || '').trim() === 'Form Tiket');
  if (titleEl) {
    const root = titleEl.closest('[role="dialog"]') || titleEl.closest('div');
    const form = root ? root.querySelector('form') : null;
    if (form) return form;
  }
  const formFallback = Array.from(document.querySelectorAll('form')).find((f) => {
    const t = String(f.textContent || '');
    return t.includes('User ID') && t.includes('Kode Tiket');
  });
  return formFallback || null;
}

function getControlsFromForm(formEl) {
  if (!formEl) return { situs: null, tipe: null, scatter: null, saveBtn: null };
  const containers = Array.from(formEl.querySelectorAll('.css-b62m3t-container'));
  const situs = containers[0] || null;
  const tipe = containers[1] || null;

  const scatterLabel = Array.from(formEl.querySelectorAll('div')).find((d) => String(d.textContent || '').trim() === 'Jumlah Scatter');
  const scatterRow = scatterLabel ? (scatterLabel.closest('.flex') || scatterLabel.parentElement) : null;
  const scatter = scatterRow ? scatterRow.querySelector('.css-b62m3t-container') : null;

  const btns = Array.from(formEl.querySelectorAll('button'));
  const saveBtn = btns.find((b) => String(b.textContent || '').trim().toLowerCase() === 'simpan') ||
    btns.find((b) => b.getAttribute('data-slot') === 'button') ||
    null;

  return { situs, tipe, scatter, saveBtn };
}

function findSaveButton(formEl) {
  const root = (formEl && (formEl.closest('[role="dialog"]') || formEl.closest('div'))) || document;
  const buttons = Array.from(root.querySelectorAll('button'));
  const isClickable = (b) => {
    if (!b) return false;
    if (b.disabled) return false;
    const ariaDisabled = b.getAttribute('aria-disabled');
    if (ariaDisabled === 'true') return false;
    return isVisible(b);
  };
  const byText = buttons.find((b) => isClickable(b) && String(b.textContent || '').trim().toLowerCase() === 'simpan');
  if (byText) return byText;
  const bySlot = buttons.find((b) => isClickable(b) && b.getAttribute('data-slot') === 'button');
  if (bySlot) return bySlot;
  const byType = buttons.find((b) => isClickable(b) && b.getAttribute('type') === 'submit');
  if (byType) return byType;
  return null;
}

async function waitForTicketSaveResponse(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = String(document.body && document.body.innerText ? document.body.innerText : '');
    const lowerText = text.toLowerCase();
    
    if (text.includes('The ticket code has already been taken.') || lowerText.includes('already been taken') || lowerText.includes('sudah ada')) {
      return { ok: false, code: 'ticket_taken', error: 'The ticket code has already been taken.' };
    }
    
    if (lowerText.includes('tidak memenuhi kriteria') || lowerText.includes('not eligible')) {
      return { ok: false, error: 'Ineligible ticket' };
    }
    
    if (lowerText.includes('maksimal total klaim') || lowerText.includes('sudah klaim') || lowerText.search(/sudah klaim [0-9]+x/) !== -1) {
       return { ok: false, error: 'User ini sudah claim 2x' };
    }

    await sleep(150);
  }
  return { ok: true };
}

async function waitForOptions(timeout = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const opts = Array.from(document.querySelectorAll('[role="option"], .select2__option'))
      .filter((o) => o && o.offsetParent !== null);
    if (opts.length > 0) return opts;
    await sleep(5);
  }
  return [];
}

async function clickArrowDownAndSelect(ctrl) {
  try {
    if (!ctrl) return false;
    const control = ctrl.querySelector('.select2__control') || ctrl;
    const ariaDisabled = control.getAttribute('aria-disabled');
    if (ariaDisabled === 'true' || String(control.className || '').includes('--is-disabled')) return false;
    control.click();
    await sleep(15);

    const inner = control.querySelector('input, [role="combobox"]');
    const target = inner || control;
    if (inner) {
      try { inner.focus(); } catch {}
    }
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await sleep(25);

    const opts = await waitForOptions(800);
    if (opts.length) {
      opts[0].click();
      return true;
    }
  } catch {}
  return false;
}

async function waitForActive(el, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (el && el.offsetParent !== null) {
      const control = el.querySelector('.select2__control') || el;
      const ariaDisabled = control.getAttribute('aria-disabled');
      if (ariaDisabled !== 'true' && !String(control.className || '').includes('--is-disabled')) return true;
    }
    await sleep(20);
  }
  return false;
}

// Menunggu dropdown React Select menjadi enabled (tidak disabled/loading)
// Digunakan setelah memilih Situs, karena Tipe Games sekarang dependent pada Situs
async function waitForSelectEnabled(container, timeoutMs = 10000) {
  if (!container) return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // Re-query control di setiap iterasi karena React bisa re-render elemen
    const control = container.querySelector('.select2__control') || container;
    const ariaDisabled = control.getAttribute('aria-disabled');
    const classDisabled = String(control.className || '').includes('--is-disabled');
    if (!ariaDisabled || ariaDisabled !== 'true') {
      if (!classDisabled && isVisible(control)) {
        console.log('[SMJ AUTO] ✅ Dropdown aktif setelah ' + (Date.now() - started) + 'ms');
        return true;
      }
    }
    await sleep(100);
  }
  console.warn('[SMJ AUTO] ⚠️ Timeout menunggu dropdown aktif (' + timeoutMs + 'ms)');
  return false;
}

// Fallback: Buka dropdown React Select, cari opsi berdasarkan teks, klik opsi tsb
async function selectReactSelectValue(container, searchText) {
  if (!container) return false;
  const control = container.querySelector('.select2__control') || container;
  const ariaDisabled = control.getAttribute('aria-disabled');
  if (ariaDisabled === 'true' || String(control.className || '').includes('--is-disabled')) {
    console.warn('[SMJ AUTO] ⚠️ selectReactSelectValue: Dropdown masih disabled, skip.');
    return false;
  }

  // 1. Buka dropdown
  control.click();
  await sleep(100);

  // 2. Coba ketik teks pencarian jika ada input
  const input = getComboboxTarget(container);
  if (input) {
    try { input.focus(); } catch {}
    setNativeValue(input, searchText);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
  }

  // 3. Tunggu opsi muncul
  const opts = await waitForOptions(2000);
  if (opts.length === 0) {
    console.warn('[SMJ AUTO] ⚠️ selectReactSelectValue: Tidak ada opsi ditemukan untuk "' + searchText + '"');
    // Coba tutup dropdown
    try { dispatchKey(input || control, 'Escape'); } catch {}
    return false;
  }

  // 4. Cari opsi yang cocok
  const searchLower = String(searchText).toLowerCase();
  const target = opts.find(opt => {
    const txt = String(opt.textContent || '').trim().toLowerCase();
    return txt === searchLower || txt.includes(searchLower);
  });

  if (target) {
    try {
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    } catch {}
    target.click();
    await sleep(150);
    console.log('[SMJ AUTO] ✅ selectReactSelectValue: "' + target.textContent.trim() + '" dipilih.');
    return true;
  }

  // 5. Fallback: klik opsi pertama
  if (opts[0]) {
    try {
      opts[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      opts[0].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    } catch {}
    opts[0].click();
    await sleep(150);
    console.log('[SMJ AUTO] ⚠️ selectReactSelectValue: Fallback - klik opsi pertama "' + opts[0].textContent.trim() + '"');
    return true;
  }

  return false;
}

async function fillScatterByKeyboard(container, scatterValue) {
  if (!container) return false;
  if (!await waitForActive(container, 7000)) return false;

  const control = container.querySelector('.select2__control') || container;
  control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  control.click();
  await sleep(50); // super fast open

  const input = container.querySelector('input, [role="combobox"]');
  if (input) {
    try { input.focus(); } catch {}
  }
  const target = input || control;
  const val = parseInt(scatterValue, 10);
  
  console.log(`[SCATTER ACCURATE] ⌨️ Menjalankan Keyboard fallback ala CekBonus untuk angka ${val}...`);

  if (val === 3) {
    dispatchKey(target, 'ArrowUp'); await sleep(80);
    dispatchKey(target, 'ArrowUp'); await sleep(80);
    dispatchKey(target, 'ArrowUp'); await sleep(80);
    dispatchKey(target, 'Enter'); await sleep(80);
  } else if (val === 4) {
    dispatchKey(target, 'ArrowUp'); await sleep(80);
    dispatchKey(target, 'ArrowUp'); await sleep(80);
    dispatchKey(target, 'Enter'); await sleep(80);
  } else if (val === 5) {
    dispatchKey(target, 'ArrowUp'); await sleep(80);
    dispatchKey(target, 'Enter'); await sleep(80);
  } else {
    // Pendekatan untuk nilai 6 ke atas
    const arrowDownTimes = Math.max(0, val - 3);
    for (let i = 0; i < arrowDownTimes; i++) {
      dispatchKey(target, 'ArrowDown');
      await sleep(120);
    }
    dispatchKey(target, 'Enter');
    await sleep(80);
  }

  // VERIFIKASI AKURASI
  return verifyScatterValue(val);
}

function getFieldStateSnapshot() {
  const siteText = (() => {
    const el = Array.from(document.querySelectorAll('.select2__single-value')).find((x) => {
      const t = String(x.textContent || '').trim().toLowerCase();
      return t === 'wdbos' || t === 'mahjong' || t.length > 0;
    });
    return el ? String(el.textContent || '').trim() : '';
  })();

  const claimRow = Array.from(document.querySelectorAll('div')).find((d) => String(d.textContent || '').trim() === 'Klaim melalui');
  const claimText = claimRow ? String((claimRow.closest('.flex') || claimRow.parentElement)?.textContent || '').trim() : '';

  const scatterRoot = findScatterSelectRoot();
  const scatterDisabled = scatterRoot ? isScatterDisabled() : true;

  return { siteText, claimText, scatterDisabled };
}

async function selectScatterValue(scatter) {
  const container = findScatterSelectRoot();
  if (!container) return false;
  const val = parseInt(scatter, 10);
  return fillScatterByKeyboard(container, val);
}

function isScatterDisabled() {
  const root = findScatterSelectRoot();
  if (!root) return true;
  const control = root.querySelector('.select2__control');
  if (!control) return true;
  const ariaDisabled = control.getAttribute('aria-disabled');
  return ariaDisabled === 'true' || control.className.includes('--is-disabled') || root.className.includes('select2--is-disabled');
}

async function waitScatterEnabled(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isScatterDisabled()) return true;
    await sleep(50);
  }
  return false;
}

// FUNGSI UTAMA: fillTicket (Synced with CekBonus Standar)
async function fillTicket(payload) {
  const userId = String(payload.userIdRaw || payload.userId || '').trim();
  const kodeTiket = String(payload.transactionId || '').trim();
  const scatterCount = typeof payload.scatterCount === 'number' ? payload.scatterCount : parseNumberLike(payload.scatterCount);
  const debet = clampBettingValue(parseNumberLike(payload.debetValue));

  // 1. PASTIKAN FORM TERBUKA (Gaya CekBonus - 20 Detik)
  const opened = await ensureFormOpen();
  if (!opened) {
    return { ok: false, error: 'Dialog Form Tiket tidak bisa dibuka / tidak ditemukan' };
  }

  const formEl = getFormElement();
  const { situs, tipe, scatter } = getControlsFromForm(formEl);

  const userInput = (formEl && formEl.querySelector('input[placeholder="User ID"]')) || findInputByPlaceholder('User ID');
  const kodeInput = (formEl && formEl.querySelector('input[placeholder="Kode Tiket"]')) || findInputByPlaceholder('Kode Tiket');
  
  if (!userInput || !kodeInput) {
    return { ok: false, error: 'Form Tiket tidak ditemukan / selector berubah' };
  }

  // 2. SELECT SITUS
  if (situs) {
    console.log('[SMJ AUTO] 📋 Step 2: Memilih Situs...');
    const ok = await clickArrowDownAndSelect(situs);
    if (!ok) {
       const desiredSite = String(payload.site || 'wdbos');
       await selectReactSelectValue(situs, desiredSite);
    }
    console.log('[SMJ AUTO] ✅ Situs dipilih. Menunggu Tipe Games siap...');
    await sleep(500); // Beri waktu React untuk re-render setelah Situs berubah
  }

  // 2.5. RE-DISCOVER TIPE GAMES (DOM berubah setelah Situs dipilih karena React re-render)
  let tipeNow = null;
  {
    const formElNow = getFormElement() || formEl;
    const refreshed = getControlsFromForm(formElNow);
    tipeNow = refreshed.tipe || tipe;

    if (tipeNow) {
      console.log('[SMJ AUTO] ⏳ Menunggu dropdown Tipe Games aktif (loading/spinner)...');
      let tipeReady = await waitForSelectEnabled(tipeNow, 10000);
      if (!tipeReady) {
        // Re-discover sekali lagi jika element berubah total
        console.log('[SMJ AUTO] 🔄 Re-discovering Tipe Games (element mungkin berubah)...');
        const formEl2 = getFormElement() || formEl;
        const ctrl2 = getControlsFromForm(formEl2);
        if (ctrl2.tipe) {
          tipeNow = ctrl2.tipe;
          tipeReady = await waitForSelectEnabled(tipeNow, 5000);
        }
        if (!tipeReady) {
          console.warn('[SMJ AUTO] ⚠️ Tipe Games masih disabled setelah 15 detik timeout.');
        }
      }
    } else {
      console.warn('[SMJ AUTO] ⚠️ Dropdown Tipe Games tidak ditemukan setelah re-discover.');
    }
  }

  // 3. SELECT TIPE GAMES
  if (tipeNow) {
    console.log('[SMJ AUTO] 📋 Step 3: Memilih Tipe Games...');
    const ok = await clickArrowDownAndSelect(tipeNow);
    if (!ok) {
        const desiredType = String(payload.gameType || 'mahjong').trim();
        await selectReactSelectValue(tipeNow, desiredType);
    }
    console.log('[SMJ AUTO] ✅ Tipe Games dipilih.');
    await sleep(500); // Beri waktu untuk load konfigurasi klaim
  }

  // 4. WAIT FOR CLAIM CONFIGURATION (Gaya CekBonus - 12 Detik)
  const claimWaitStart = Date.now();
  while (Date.now() - claimWaitStart < 12000) {
    const t = String(document.body && document.body.innerText ? document.body.innerText : '');
    if (!t.includes('Loading konfigurasi klaim')) break;
    await sleep(300);
  }

  const bettingInput = (formEl && formEl.querySelector('input[placeholder="#######"]')) ||
    document.querySelector('input[placeholder="#######"]') ||
    Array.from(document.querySelectorAll('input')).find((i) => i.getAttribute('placeholder') === '#######');
  
  const scatterRootNow = scatter || findScatterSelectRoot();
  if (!bettingInput || !scatterRootNow) {
    const missing = [!bettingInput ? 'Bettingan' : null, !scatterRootNow ? 'Jumlah Scatter' : null].filter(Boolean);
    return { ok: false, error: `Field belum muncul: ${missing.join(', ')}` };
  }

  // 5. ISI DATA UTAMA
  setNativeValue(userInput, userId);
  setNativeValue(kodeInput, kodeTiket);
  
  const buktiInput = (formEl && formEl.querySelector('textarea[placeholder="Link Bukti Screenshot"]')) || findTextareaByPlaceholder('Link Bukti Screenshot');
  if (buktiInput) {
    setNativeValue(buktiInput, kodeTiket);
  }

  if (debet !== null) {
    await typeValue(bettingInput, String(debet));
  }

  // 6. ISI SCATTER (Metode Indeks Akurat - 0=3, 1=4, 2=5)
  if (scatterCount !== null) {
    const enabled = await waitScatterEnabled(12000);
    if (!enabled) {
      return { ok: false, error: 'Jumlah Scatter masih terkunci (bettingan mungkin tidak valid)' };
    }
    await sleep(200);
    const ok = await fillScatterByVisualIndex(scatterRootNow, scatterCount);
    if (!ok) {
        // Emergency Fallback: Cari opsi secara fisik berdasarkan teks
        await selectScatterValue(scatterCount);
    }
  }

  // 7. VERIFIKASI AKHIR & KLIK SIMPAN (Safety Lock AKTIF)
  await sleep(40);
  
  // Baca angka yang tertera saat ini di kotak scatter
  const isCorrect = verifyScatterValue(scatterCount);
  if (!isCorrect) {
    console.error('[SAFETY LOCK] ❌ Angka scatter salah terinput. PROSES DIBATALKAN.');
    return { ok: false, error: `SAFETY LOCK: Input Scatter Salah (Target=${scatterCount})` };
  }

  const saveBtn = findSaveButton(formEl);
  if (saveBtn) {
    try { saveBtn.scrollIntoView({ block: 'center' }); } catch {}
    try {
      console.log('[SMJ AUTO] 💾 Angka terverifikasi, mengirim data ke BonusSMB...');
      saveBtn.click(); 
    } catch {}
    
    const resp = await waitForTicketSaveResponse(4000);
    if (!resp.ok) return resp;
    return { ok: true, saved: true };
  }

  return { ok: false, error: 'Tombol Simpan tidak ditemukan / tidak aktif' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'BONUSSMB_PING') {
    sendResponse({ ok: true });
    return;
  }
  if (msg.type !== 'BONUSSMB_FILL_TICKET') return;
  Promise.resolve(fillTicket(msg.payload || {}))
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
  return true;
});

// ========================================================
// HISTORY MONITOR MODE — Real-Time Status Tracking
// Hanya aktif di halaman bonussmb.com/history
// ========================================================
(async function initHistoryMonitor() {
  const href = window.location.href || '';
  if (!href.includes('bonussmb.com/history')) return;

  // Hanya auto-monitor jika tab dibuka oleh sistem (flag hash)
  const isMonitorTab = href.includes('#smjmonitor');

  console.log('[SMJ HISTORY] ========================================');
  console.log('[SMJ HISTORY] Halaman History terdeteksi.' + (isMonitorTab ? ' (Monitor Mode AKTIF)' : ' (Bukan monitor tab)'));

  function cleanIdNumeric(id) {
    return String(id || '').replace(/[^0-9]/g, '');
  }

  // --- Helpers ---
  function hSleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function expandHistoryRange() {
    console.log('[SMJ HISTORY] Mencoba menambah tampilan baris ke 100...');
    try {
      // 1. Cari tombol dropdown "Show"
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"], a'));
      const showBtn = allBtns.find(b => {
        const txt = (b.textContent || '').trim();
        return txt.startsWith('Show') || txt.includes('Show 10');
      });

      if (!showBtn) {
        console.log('[SMJ HISTORY] ⚠️ Tombol "Show" tidak ditemukan.');
        return;
      }

      // Jika sudah 100, tidak perlu lagi
      if (showBtn.textContent.includes('100')) {
        console.log('[SMJ HISTORY] ✅ Sudah menampilkan 100 baris.');
        return;
      }

      showBtn.click();
      await hSleep(1000); // Tunggu dropdown muncul secara visual

      // 2. Cari opsi "100" dalam dropdown yang terbuka
      // Kita cari elemen yang mengandung teks exactly "100"
      const allElements = Array.from(document.querySelectorAll('*'));
      const option100 = allElements.find(el => {
         if (el.children.length > 0) return false; // Cari leaf node agar klik akurat
         return (el.textContent || '').trim() === '100';
      });

      if (option100) {
        option100.click();
        console.log('[SMJ HISTORY] ✅ Aksis klik opsi 100 baris dikirim.');
        await hSleep(2000); // Tunggu tabel reload
      } else {
        console.log('[SMJ HISTORY] ❌ Opsi "100" tidak ditemukan dalam dropdown.');
      }
    } catch (e) {
      console.error('[SMJ HISTORY] Error saat expandHistoryRange:', e);
    }
  }

  async function waitForHistoryTable(timeout) {
    const t = typeof timeout === 'number' ? timeout : 15000;
    const start = Date.now();
    console.log('[SMJ HISTORY] Menunggu tabel history muncul...');
    while (Date.now() - start < t) {
      const tbl = document.querySelector('table');
      if (tbl) {
        const rows = tbl.querySelectorAll('tbody tr');
        if (rows.length > 0) {
          // CEK SELURUH BARIS (bukan hanya cell pertama yang mungkin checkbox/icon)
          const rowText = (rows[0].textContent || '').replace(/\s+/g, ' ').trim();
          if (rowText.length > 10) {
            console.log('[SMJ HISTORY] ✅ Tabel ditemukan! ' + rows.length + ' baris. Teks baris pertama: "' + rowText.substring(0, 80) + '..."');
            return true;
          }
        }
      }
      await hSleep(400);
    }
    console.log('[SMJ HISTORY] ❌ Tabel TIDAK ditemukan setelah ' + (t/1000) + ' detik!');
    return false;
  }

  function getColumnMap() {
    const ths = Array.from(document.querySelectorAll('table thead th'));
    const headers = ths.map(th => (th.textContent || '').trim().toLowerCase());
    
    console.log('[SMJ HISTORY] Header kolom terdeteksi:', headers);
    
    // Cari kolom dengan multiple keyword variants
    const findCol = (keywords) => {
      return headers.findIndex(h => keywords.some(k => h.includes(k)));
    };
    
    const map = {
      userId:     findCol(['user id', 'userid', 'user']),
      kodeTiket:  findCol(['kode tiket', 'kode_tiket', 'tiket', 'ticket']),
      status:     findCol(['status']),
      keterangan: findCol(['keterangan', 'detail', 'note', 'catatan']),
    };
    
    console.log('[SMJ HISTORY] Column map:', JSON.stringify(map));
    return map;
  }

  function cleanCellText(cell) {
    if (!cell) return '';
    // Clone, remove buttons/svgs/icons, get clean text
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('button, svg, [role="button"], .copy-btn, i, span.icon').forEach(el => el.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function scrapeAllRows() {
    const cols = getColumnMap();
    if (cols.kodeTiket < 0 || cols.status < 0) {
      console.warn('[SMJ HISTORY] ⚠️ Kolom kode tiket atau status TIDAK DITEMUKAN! Coba scrape alternatif...');
      return scrapeAllRowsFallback();
    }
    const rows = document.querySelectorAll('table tbody tr');
    const results = [];
    rows.forEach((row, rowIdx) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;
      
      const kodeTiket  = cleanCellText(cells[cols.kodeTiket]);
      const userId     = cols.userId >= 0 ? cleanCellText(cells[cols.userId]) : '';
      const rawStatus  = cleanCellText(cells[cols.status]);
      const status     = rawStatus.toUpperCase();
      const keterangan = cols.keterangan >= 0 ? cleanCellText(cells[cols.keterangan]) : '';
      
      if (kodeTiket && status) {
        results.push({ kodeTiket, userId, status, keterangan });
      }
    });
    return results;
  }

  // FALLBACK: Jika column map gagal, coba scan setiap row mencari angka panjang & status keyword
  function scrapeAllRowsFallback() {
    const rows = document.querySelectorAll('table tbody tr');
    const results = [];
    const statusKeywords = ['APPROVED', 'REJECTED', 'PROCESSING', 'FAILED', 'MANUAL', 'PENDING'];
    
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      let kodeTiket = '';
      let status = '';
      let userId = '';
      let keterangan = '';
      
      cells.forEach(cell => {
        const text = cleanCellText(cell);
        const upper = text.toUpperCase();
        
        // Deteksi kode tiket (angka panjang >= 15 digit)
        const digits = text.replace(/[^0-9]/g, '');
        if (digits.length >= 15 && !kodeTiket) {
          kodeTiket = text;
        }
        
        // Deteksi status
        if (statusKeywords.includes(upper) && !status) {
          status = upper;
        }
      });
      
      if (kodeTiket && status) {
        results.push({ kodeTiket, userId, status, keterangan });
      }
    });
    
    console.log('[SMJ HISTORY] Fallback scraper menemukan ' + results.length + ' baris');
    return results;
  }

  function getStatusWeight(status) {
    const s = String(status || '').toUpperCase();
    if (s.includes('APPROVED')) return 100;
    if (s.includes('PROCESSING') || s.includes('PENDING')) return 50;
    if (s.includes('REJECTED') || s.includes('FAILED') || s.includes('MANUAL')) return 10;
    return 0;
  }

  function matchTickets(scraped, watched) {
    const watchMap = new Map();
    watched.forEach(t => {
      const key = String(t.transactionId || '').trim();
      if (key) watchMap.set(key, { ticket: t, matches: [] });
    });

    console.log('[SMJ HISTORY] Mencari kecocokan cerdas: ' + scraped.length + ' baris history vs ' + watchMap.size + ' tiket dipantau');

    // 1. Kumpulkan semua baris yang cocok untuk setiap tiket
    scraped.forEach((row, rowIdx) => {
      const cleanScraped = cleanIdNumeric(row.kodeTiket);
      if (!cleanScraped || cleanScraped.length < 10) return;

      for (const [txId, entry] of watchMap.entries()) {
        const cleanTx = cleanIdNumeric(txId);
        if (!cleanTx || cleanTx.length < 10) continue;
        
        // Match methods: exact, contains, atau overlap signifikan (min 15 digit shared)
        const isMatch = 
          cleanScraped === cleanTx || 
          cleanScraped.includes(cleanTx) || 
          cleanTx.includes(cleanScraped) ||
          (cleanScraped.length >= 15 && cleanTx.length >= 15 && 
           (cleanScraped.substring(0, 15) === cleanTx.substring(0, 15)));
        
        if (isMatch) {
          entry.matches.push({ ...row, index: rowIdx });
        }
      }
    });

    // 2. Tentukan status terbaik untuk setiap tiket yang dipantau
    const finalMatched = [];
    for (const [txId, entry] of watchMap.entries()) {
      if (entry.matches.length > 0) {
        // Logika Prioritas: Status Sukses/Aktif lebih tinggi dari Rejek lama
        // Jika bobot sama, ambil yang urutan index lebih kecil (paling atas di tabel = paling baru)
        entry.matches.sort((a, b) => {
          const wa = getStatusWeight(a.status);
          const wb = getStatusWeight(b.status);
          if (wa !== wb) return wb - wa; // Bobot lebih besar menang
          return a.index - b.index;      // Index lebih kecil (atas) menang
        });

        const best = entry.matches[0];
        console.log('[SMJ HISTORY]   ✅ MATCH TERBAIK: ' + txId + ' → ' + best.status + ' (' + entry.matches.length + ' entri ditemukan)');
        
        finalMatched.push({
          transactionId: entry.ticket.transactionId,
          userId: entry.ticket.userId,
          smbStatus: best.status,
          smbKeterangan: best.keterangan
        });
      } else {
        console.log('[SMJ HISTORY]   ❌ TIDAK DITEMUKAN: ' + txId);
      }
    }
    
    return finalMatched;
  }

  // --- Main Monitor Cycle ---
  async function runCycle() {
    const stored = await new Promise(r =>
      chrome.storage.local.get(['bonussmbMonitorTickets'], r)
    );
    const tickets = Array.isArray(stored.bonussmbMonitorTickets) ? stored.bonussmbMonitorTickets : [];

    if (tickets.length === 0) {
      console.log('[SMJ HISTORY] Tidak ada tiket untuk dipantau. Menutup tab...');
      if (isMonitorTab) {
        try {
          chrome.runtime.sendMessage({ type: 'BONUSSMB_HISTORY_CLOSE' });
        } catch (e) {
          console.warn('[SMJ HISTORY] Gagal kirim close signal:', e);
        }
      }
      return;
    }

    console.log('[SMJ HISTORY] ▶ Memantau ' + tickets.length + ' tiket...');
    
    // Auto-expand row count ke 100 jika di monitor tab agar data lama terlihat
    if (isMonitorTab) {
      await expandHistoryRange();
    }

    tickets.forEach(t => {
      console.log('[SMJ HISTORY]   → ' + (t.userId || '?') + ' / ' + t.transactionId);
    });

    const tableOk = await waitForHistoryTable(20000);
    if (!tableOk) {
      console.log('[SMJ HISTORY] ⚠️ Tabel belum siap. Reload...');
      if (isMonitorTab) setTimeout(() => window.location.reload(), 3000);
      return;
    }

    const scraped = scrapeAllRows();
    console.log('[SMJ HISTORY] Baris terbaca dari tabel: ' + scraped.length);
    
    // Log beberapa baris pertama untuk debugging
    scraped.slice(0, 5).forEach((row, i) => {
      console.log(`[SMJ HISTORY]   Baris[${i}]: kode=${row.kodeTiket}, status=${row.status}, user=${row.userId}`);
    });

    const matched = matchTickets(scraped, tickets);

    if (matched.length > 0) {
      console.log('[SMJ HISTORY] 🎉 Status update ditemukan: ' + matched.length);
      matched.forEach(m => {
        console.log('[SMJ HISTORY]   📤 Kirim: ' + m.transactionId + ' → ' + m.smbStatus);
      });
      try {
        chrome.runtime.sendMessage({
          type: 'BONUSSMB_HISTORY_UPDATE',
          results: matched
        });
      } catch (e) {
        console.error('[SMJ HISTORY] Gagal kirim update:', e);
      }
    } else {
      console.log('[SMJ HISTORY] ⏳ Belum ada kecocokan ditemukan. Akan cek ulang...');
    }

    // Schedule next refresh (only for monitor tab) — 8 DETIK untuk respons cepat
    if (isMonitorTab) {
      setTimeout(() => {
        chrome.storage.local.get(['bonussmbMonitorTickets'], (res) => {
          const remain = Array.isArray(res.bonussmbMonitorTickets) ? res.bonussmbMonitorTickets : [];
          if (remain.length > 0) {
            console.log('[SMJ HISTORY] 🔄 Reload halaman untuk cek ulang (' + remain.length + ' tiket masih dipantau)...');
            window.location.reload();
          } else {
            console.log('[SMJ HISTORY] ✅ Semua tiket resolved. Menutup tab monitor...');
            try {
              chrome.runtime.sendMessage({ type: 'BONUSSMB_HISTORY_CLOSE' });
            } catch (e) {
              console.warn('[SMJ HISTORY] Gagal kirim close signal:', e);
            }
          }
        });
      }, 8000); // LEBIH CEPAT: 8 detik Reload Cycle
    }
  }

  // --- MutationObserver for instant detection ---
  function setupObserver() {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;
    
    let observerDebounce = null;
    const observer = new MutationObserver(() => {
      // Debounce agar tidak terpicu berkali-kali
      if (observerDebounce) clearTimeout(observerDebounce);
      observerDebounce = setTimeout(() => {
        // Table content changed, re-scrape
        chrome.storage.local.get(['bonussmbMonitorTickets'], (res) => {
          const tickets = Array.isArray(res.bonussmbMonitorTickets) ? res.bonussmbMonitorTickets : [];
          if (tickets.length === 0) return;
          const scraped = scrapeAllRows();
          const matched = matchTickets(scraped, tickets);
          if (matched.length > 0) {
            console.log('[SMJ HISTORY] 🎯 MutationObserver mendeteksi perubahan! ' + matched.length + ' match ditemukan.');
            try {
              chrome.runtime.sendMessage({ type: 'BONUSSMB_HISTORY_UPDATE', results: matched });
            } catch {}
          }
        });
      }, 500);
    });
    observer.observe(tbody, { childList: true, subtree: true, characterData: true });
    console.log('[SMJ HISTORY] MutationObserver aktif pada tabel.');
  }

  // Start
  await hSleep(1000); // Let page render (dipercepat dari 1500)
  await runCycle();
  setupObserver();
})();
