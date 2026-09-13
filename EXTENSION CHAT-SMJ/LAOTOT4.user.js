// ==UserScript==
// @name         LiveChat Pengecekan Duration Timer
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  Melacak durasi pengecekan agent. Timer dimulai saat agent mengirim pesan trigger (mohon ditunggu/cek), tetap jalan jika pesan berikutnya mengandung cek/pengecekan, berhenti jika pesan agent tidak mengandung kata tersebut. Auto-stop saat archived.
// @author       LAOTOT4
// @match        https://my.livechatinc.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ╔═══════════════════════════════════════════════╗
    // ║            KONFIGURASI UTAMA                  ║
    // ╚═══════════════════════════════════════════════╝

    const PHASE_2_THRESHOLD = 120000;  // 2 menit
    const PHASE_3_THRESHOLD = 180000;  // 3 menit
    const PHASE_4_THRESHOLD = 300000;  // 5 menit
    const TOAST_LIFETIME_MS = 300000;
    const CHECK_INTERVAL_MS = 500;
    const TIMER_MAX_AGE_MS = 3600000;

    const ACCENT_PHASE_2 = '#ff8c00';
    const ACCENT_PHASE_3 = '#9b59b6';
    const ACCENT_PHASE_4 = '#ff0000';

    const TRIGGER_KEYWORDS = [
        // Kalimat 1: "Baik, untuk perihal tersebut akan kami cek terlebih dahulu ya bosku."
        'akan kami cek terlebih dahulu',
        // Kalimat 2: "mohon ditunggu ya bos ku kami akan melakukan pengecekan terlebih dahulu"
        'kami akan melakukan pengecekan terlebih dahulu',
        'mohon ditunggu ya bos ku kami akan melakukan pengecekan',
        // Kalimat 3: "Untuk kendala anda saat ini masih dalam pengecekkan ya bosku"
        'masih dalam pengecekan',
        'masih dalam pengecekkan',
        // Kalimat 4: "Untuk kendala tersebut mohon di tunggu ya bosku, karena kami sedang dalam proses pengecekkan"
        'sedang dalam proses pengecekan',
        'sedang dalam proses pengecekkan'
    ];

    const CONTINUE_KEYWORDS = [
        'cek', 'pengecekan', 'dicek', 'mengecek',
        'periksa', 'diperiksa', 'memeriksa', 'pemeriksaan'
    ];

    // Tag-tag yang menandakan chat sudah archived/selesai
    const ARCHIVE_TAGS = [
        'archived', 'customer left', 'inactivity', 'meninggalkan',
        'closed', 'this chat has been archived'
    ];

    const STORAGE_KEY = 'checkDurationTimers';
    const lastEvaluatedText = new Map();

    // ╔═══════════════════════════════════════════════╗
    // ║            HELPER FUNCTIONS                   ║
    // ╚═══════════════════════════════════════════════╝

    const getActiveChatId = () => {
        const selectedLi = document.querySelector(
            'li[data-testid^="chat-item-"][aria-selected="true"], ' +
            'li[class*="selected"], li[class*="active"]'
        );
        if (selectedLi) {
            const tid = selectedLi.getAttribute('data-testid') || '';
            const m = tid.match(/chat-item-([^/]+)/i);
            if (m) return m[1];
        }
        const m = location.pathname.match(/\/chats\/(?:[^/]+\/)?([^/]+)/i);
        return m ? m[1] : null;
    };

    const findItemByChatId = (chatId) => {
        if (!chatId) return null;
        const li = document.querySelector(`li[data-testid="chat-item-${chatId}"]`);
        return li ? (li.querySelector('.chat-item') || li) : null;
    };

    const getChatIdFromItem = (item) => {
        if (!item) return null;
        if (item.dataset.chatId) return item.dataset.chatId;
        const holder = item.closest('li[data-testid^="chat-item-"]') || item;
        const tid = holder.getAttribute('data-testid') || '';
        const m = tid.match(/chat-item-([^/]+)/i);
        if (m) { item.dataset.chatId = m[1]; return m[1]; }
        const a = item.querySelector('a[href*="/chats/"]');
        if (a) {
            const m2 = (a.getAttribute('href') || '').match(/\/chats\/(?:[^/]+\/)?([^/]+)/i);
            if (m2) { item.dataset.chatId = m2[1]; return m2[1]; }
        }
        return null;
    };

    // ====== Helper Deteksi Bagian Chat (My chats vs Supervised) ======
    const isSupervisedChatItem = (item) => {
        if (!item) return false;

        const sidebarRoot = document.querySelector('.css-1cmlcj3') || document.body;

        // 1. Layer Kontainer Induk (Ancestor Search)
        let curr = item.parentElement;
        while (curr && curr !== sidebarRoot && curr !== document.body) {
            const testId = (curr.getAttribute('data-testid') || '').toLowerCase();
            const aria = (curr.getAttribute('aria-label') || '').toLowerCase();
            const cls = (curr.className || '').toString().toLowerCase();
            if (testId.includes('supervised') || aria.includes('supervised') || cls.includes('supervised')) {
                return true;
            }
            if (testId.includes('my-chat') || aria.includes('my chat') || cls.includes('my-chat')) {
                return false;
            }

            const text = (curr.innerText || curr.textContent || '');
            const hasSupervised = /supervised/i.test(text);
            const hasMyChats = /my\s*chats/i.test(text);
            if (hasSupervised && !hasMyChats) {
                return true;
            }
            if (hasMyChats && !hasSupervised) {
                return false;
            }
            curr = curr.parentElement;
        }

        // 2. Layer Preceding Header (Document Position)
        try {
            const allSectionNodes = Array.from(sidebarRoot.querySelectorAll('*')).filter(el => {
                if (el.closest('.chat-item') || el.closest('li[data-testid^="chat-item-"]')) return false;
                const t = (el.innerText || el.textContent || '').trim();
                if (!t || t.length > 60) return false;
                const hasSup = /supervised/i.test(t);
                const hasMy = /my\s*chats/i.test(t);
                return (hasSup && !hasMy) || (hasMy && !hasSup);
            });

            let closestHeader = null;
            for (const h of allSectionNodes) {
                const pos = h.compareDocumentPosition(item);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
                    closestHeader = h;
                }
            }

            if (closestHeader) {
                const t = (closestHeader.innerText || closestHeader.textContent || '').trim();
                if (/supervised/i.test(t)) return true;
                if (/my\s*chats/i.test(t)) return false;
            }
        } catch (e) {}

        // 3. Layer Sibling Traversal (Mengecek elemen sebelumnya dalam satu list)
        try {
            let targetEl = item.closest('li[data-testid^="chat-item-"]') || item;
            let p = targetEl.previousElementSibling;
            while (p) {
                const pt = (p.innerText || p.textContent || '').trim();
                if (/supervised/i.test(pt) && !/my\s*chats/i.test(pt)) return true;
                if (/my\s*chats/i.test(pt) && !/supervised/i.test(pt)) return false;
                p = p.previousElementSibling;
            }
        } catch (e) {}

        // 4. Fallback Karakteristik Teks LiveChat untuk Supervised / Transferred
        const itemText = (item.innerText || item.textContent || '');
        if (/transferred\s*[-–]\s*by/i.test(itemText)) {
            return true;
        }

        // 5. Fallback: Atribut eksplisit pada container terdekat
        if (item.closest('[data-testid*="supervised" i], [aria-label*="supervised" i], [class*="supervised" i]')) {
            return true;
        }

        return false;
    };

    // Cek apakah chat sudah archived — HANYA di sesi terbaru (setelah marker "Started")
    // Pattern dari LATOTO2: membaca chat yang paling terbaru saja
    const isChatArchived = (chatId) => {
        // 1. Quick check: cek sidebar item text
        const item = findItemByChatId(chatId);
        if (item) {
            const text = (item.textContent || '').toLowerCase();
            if (ARCHIVE_TAGS.some(tag => text.includes(tag))) return true;
        }

        // 2. Deep check: cek chat window, tapi HANYA setelah marker sesi terbaru
        if (chatId !== getActiveChatId()) return false;

        const container = document.querySelector('[data-testid="messages-list"]') || document.body;
        const marker = findLastMarker();

        // Ambil semua elemen teks di chat window
        const allElements = container.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];

            // Jika ada marker, hanya cek elemen yang SETELAH marker
            if (marker) {
                if (!(marker.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    continue; // Skip elemen sebelum marker (sesi lama)
                }
            }

            const txt = (el.textContent || '').toLowerCase().trim();
            // Cek hanya elemen kecil (bukan container besar)
            if (el.children.length > 3) continue;

            if (txt === 'this chat has been archived' ||
                txt.includes('archived - customer left') ||
                (txt.includes('archived -') && txt.includes('inactivity'))) {
                return true;
            }
        }

        return false;
    };

    // Dapatkan nomor urut chat di sidebar (1-based, hanya My chats)
    const getChatRowNumber = (chatId) => {
        const allItems = document.querySelectorAll('.chat-item');
        let idx = 0;
        for (const item of allItems) {
            if (isSupervisedChatItem(item)) continue;
            idx++;
            const id = getChatIdFromItem(item);
            if (id === chatId) return idx;
        }
        return '?';
    };

    const normalizeText = (text) => {
        if (!text) return '';
        return text.toLowerCase().replace(/\s+/g, ' ').trim();
    };

    const containsTrigger = (text) => {
        const norm = normalizeText(text);
        return TRIGGER_KEYWORDS.some(kw => norm.includes(kw));
    };

    const containsContinue = (text) => {
        const norm = normalizeText(text);
        return CONTINUE_KEYWORDS.some(kw => norm.includes(kw));
    };

    const formatDuration = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // ╔═══════════════════════════════════════════════╗
    // ║         TIMER MANAGER (PERSISTENT)             ║
    // ╚═══════════════════════════════════════════════╝

    const initTimerMap = () => {
        let saved = GM_getValue(STORAGE_KEY);
        if (saved === undefined) {
            const ls = localStorage.getItem(STORAGE_KEY);
            if (ls) {
                try {
                    const obj = JSON.parse(ls);
                    GM_setValue(STORAGE_KEY, obj);
                    return new Map(Object.entries(obj).map(([id, time]) => [id, Number(time)]));
                } catch (e) { return new Map(); }
            }
            return new Map();
        }
        return new Map(Object.entries(saved).map(([id, time]) => [id, Number(time)]));
    };

    const checkStartTimes = initTimerMap();

    const saveTimers = () => {
        const obj = {};
        checkStartTimes.forEach((v, k) => obj[k] = v);
        GM_setValue(STORAGE_KEY, obj);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) { }
    };

    const startCheckTimer = (chatId) => {
        if (checkStartTimes.has(chatId)) return;
        // Jangan mulai timer jika chat sudah archived
        if (isChatArchived(chatId)) return;

        console.log(`🔍 [${chatId}] Timer Pengecekan DIMULAI`);
        checkStartTimes.set(chatId, Date.now());
        saveTimers();
        const item = findItemByChatId(chatId);
        if (item) addCheckBadge(item);
    };

    const stopCheckTimer = (chatId) => {
        if (!checkStartTimes.has(chatId)) return;
        console.log(`✅ [${chatId}] Timer Pengecekan SELESAI`);
        checkStartTimes.delete(chatId);
        saveTimers();

        const item = findItemByChatId(chatId);
        if (item) {
            removeCheckBadge(item);
            item.classList.remove('check-glow-2m', 'check-glow-3m', 'check-glow-5m');
            delete item.dataset.checkToast2m;
            delete item.dataset.checkToast3m;
            delete item.dataset.checkToast5m;
        }
        removeCheckToast(chatId);
        // TIDAK ada toast "selesai"
    };

    // ╔═══════════════════════════════════════════════╗
    // ║           BADGE VISUAL 🔍                      ║
    // ╚═══════════════════════════════════════════════╝

    const addCheckBadge = (item) => {
        if (item.querySelector('.check-badge')) return;
        const badge = document.createElement('div');
        badge.className = 'check-badge';
        badge.innerHTML = '🔍';
        item.style.position = 'relative';
        item.appendChild(badge);
    };

    const removeCheckBadge = (item) => {
        const badge = item.querySelector('.check-badge');
        if (badge) badge.remove();
    };

    // ╔═══════════════════════════════════════════════╗
    // ║    TOAST NOTIFICATION (COMPACT, KANAN-BAWAH)   ║
    // ╚═══════════════════════════════════════════════╝

    const ensureCheckToastHost = () => {
        let host = document.querySelector('.check-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'check-toast-host';
            document.body.appendChild(host);
        }
        return host;
    };

    const showCheckToast = (message, accent, chatId = null, duration = TOAST_LIFETIME_MS) => {
        const host = ensureCheckToastHost();
        const rowNum = chatId ? getChatRowNumber(chatId) : '?';

        // Anti-spam: Update existing
        if (chatId) {
            const existing = host.querySelector(`.check-toast[data-chat-id="${chatId}"]`);
            if (existing) {
                const msgEl = existing.querySelector('.check-toast-msg');
                if (msgEl) msgEl.textContent = message;
                const rowEl = existing.querySelector('.check-toast-row');
                if (rowEl) rowEl.textContent = `#${rowNum}`;
                existing.style.setProperty('--check-toast-accent', accent);
                return;
            }
        }

        const toast = document.createElement('div');
        toast.className = 'check-toast';
        if (chatId) {
            toast.dataset.chatId = chatId;
            toast.style.cursor = 'pointer';
        }
        toast.style.setProperty('--check-toast-accent', accent);

        // Compact layout: [ROW] [MSG] [TIMER] [X]
        toast.innerHTML = `
            <span class="check-toast-row">#${rowNum}</span>
            <span class="check-toast-msg">${message}</span>
            <span class="check-toast-timer">00:00</span>
            <button class="check-toast-close" type="button" aria-label="Close">×</button>
        `;

        host.appendChild(toast);

        // Quick-jump
        toast.addEventListener('click', (e) => {
            if (e.target.classList.contains('check-toast-close')) return;
            if (chatId) {
                const item = findItemByChatId(chatId);
                if (item) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    item.click();
                }
            }
        });

        // Close button
        toast.querySelector('.check-toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 200);
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.add('hide');
                    setTimeout(() => toast.remove(), 200);
                }
            }, duration);
        }
    };

    const removeCheckToast = (chatId) => {
        const host = document.querySelector('.check-toast-host');
        if (!host) return;
        const toast = host.querySelector(`.check-toast[data-chat-id="${chatId}"]`);
        if (toast) {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 200);
        }
    };

    // ╔═══════════════════════════════════════════════╗
    // ║  SESSION MARKER — HANYA PESAN SESI TERBARU    ║
    // ╚═══════════════════════════════════════════════╝

    // Cari marker "Started today" / "Dimulai hari ini" terakhir di chat window.
    // Semua pesan SEBELUM marker ini adalah sesi lama dan harus DIABAIKAN.
    const findLastMarker = () => {
        const container = document.querySelector('[data-testid="messages-list"]') || document.body;
        const elements = container.querySelectorAll('*');
        let latest = null;
        const keys = ['started', 'today', 'dimulai', 'hari ini'];

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const txt = (el.textContent || '').toLowerCase();
            for (let j = 0; j < keys.length; j++) {
                if (txt.indexOf(keys[j]) !== -1 && el.children.length <= 4) {
                    const inner = (el.innerText || '').toLowerCase().trim();
                    if (inner.indexOf('started') === 0 ||
                        inner.indexOf('dimulai') === 0 ||
                        (txt.indexOf('started') !== -1 && txt.indexOf('today') !== -1)) {
                        latest = el;
                    }
                }
            }
        }
        return latest;
    };

    // Ambil pesan agent HANYA yang muncul SETELAH marker sesi terbaru
    const getAgentMsgsAfterMarker = () => {
        const container = document.querySelector('[data-testid="messages-list"]') || document.body;
        const marker = findLastMarker();
        const allBlocks = container.querySelectorAll('[data-testid="agent-message"]');
        const results = [];

        for (let i = 0; i < allBlocks.length; i++) {
            const block = allBlocks[i];
            const msgEl = block.querySelector('[data-testid="message-text"]') ||
                block.querySelector('div[class^="css-"]') ||
                block.querySelector('.message__text');
            if (!msgEl) continue;

            // Jika ada marker, hanya ambil pesan SETELAH marker
            if (marker) {
                if (marker.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    results.push(msgEl);
                }
            } else {
                // Tidak ada marker — ambil 5 pesan terakhir saja (safety)
                results.push(msgEl);
            }
        }

        // Jika tidak ada marker, batasi ke 5 terakhir
        if (!marker && results.length > 5) {
            return results.slice(-5);
        }
        return results;
    };

    // ╔═══════════════════════════════════════════════╗
    // ║   DETEKSI PESAN AGENT — SESI TERBARU SAJA     ║
    // ╚═══════════════════════════════════════════════╝

    const evaluateLatestAgentMessage = () => {
        const chatId = getActiveChatId();
        if (!chatId) return;

        // PENGECUALIAN SUPERVISED: Jangan lacak durasi pengecekan pada chat Supervised
        const activeItem = findItemByChatId(chatId);
        if (activeItem && isSupervisedChatItem(activeItem)) {
            if (checkStartTimes.has(chatId)) {
                console.log(`🛡️ [${chatId}] Chat Supervised — Timer pengecekan dihentikan/dikecualikan`);
                stopCheckTimer(chatId);
            }
            return;
        }

        // Cek archived terlebih dahulu
        if (isChatArchived(chatId)) {
            if (checkStartTimes.has(chatId)) {
                console.log(`📦 [${chatId}] Chat Archived — Timer dihentikan`);
                stopCheckTimer(chatId);
            }
            return;
        }

        // KRITIS: Hanya ambil pesan agent dari SESI TERBARU (setelah marker "Started")
        const currentSessionMsgs = getAgentMsgsAfterMarker();
        if (currentSessionMsgs.length === 0) {
            // Tidak ada pesan agent di sesi ini — jika ada timer aktif, itu dari sesi lama
            if (checkStartTimes.has(chatId)) {
                console.log(`🧹 [${chatId}] Tidak ada pesan agent di sesi ini — Hapus timer lama`);
                stopCheckTimer(chatId);
            }
            return;
        }

        // Ambil pesan agent TERAKHIR dari sesi terbaru
        const lastMsgEl = currentSessionMsgs[currentSessionMsgs.length - 1];
        const text = lastMsgEl.textContent || lastMsgEl.innerText || '';
        if (!text.trim()) return;

        const normText = normalizeText(text);

        // Cek apakah pesan ini sudah pernah dievaluasi
        if (lastEvaluatedText.get(chatId) === normText) return;
        lastEvaluatedText.set(chatId, normText);

        const hasTimer = checkStartTimes.has(chatId);

        if (!hasTimer) {
            if (containsTrigger(text)) {
                startCheckTimer(chatId);
                console.log(`🔍 [${chatId}] Trigger di sesi baru: "${text.substring(0, 50)}..."`);
            }
        } else {
            if (containsContinue(text)) {
                console.log(`🔍 [${chatId}] Masih cek — Timer lanjut`);
            } else {
                stopCheckTimer(chatId);
            }
        }
    };

    // ╔═══════════════════════════════════════════════╗
    // ║     EVALUASI PERIODIK (TIMER + VISUAL)         ║
    // ╚═══════════════════════════════════════════════╝

    const bootTime = Date.now();

    const runPeriodicEvaluation = () => {
        if (document.hidden) return;

        // PENTING: Selalu cek pesan agent terakhir setiap siklus.
        // MutationObserver bisa miss saat agent sendiri yang mengirim pesan.
        evaluateLatestAgentMessage();

        const now = Date.now();
        const activeIds = new Set();
        const allItems = document.querySelectorAll('.chat-item');

        allItems.forEach(item => {
            const id = getChatIdFromItem(item);
            if (id) activeIds.add(id);

            // PENGECUALIAN SUPERVISED: Bersihkan badge & glow jika chat di Supervised
            if (isSupervisedChatItem(item)) {
                removeCheckBadge(item);
                item.classList.remove('check-glow-2m', 'check-glow-3m', 'check-glow-5m');
                delete item.dataset.checkToast2m;
                delete item.dataset.checkToast3m;
                delete item.dataset.checkToast5m;
                if (id && checkStartTimes.has(id)) {
                    checkStartTimes.delete(id);
                    removeCheckToast(id);
                }
            }
        });

        // Evaluasi setiap timer aktif
        const toDelete = [];
        checkStartTimes.forEach((startTime, chatId) => {
            const elapsed = now - startTime;
            const item = findItemByChatId(chatId);

            // PENGECUALIAN SUPERVISED
            if (item && isSupervisedChatItem(item)) {
                toDelete.push(chatId);
                removeCheckBadge(item);
                item.classList.remove('check-glow-2m', 'check-glow-3m', 'check-glow-5m');
                removeCheckToast(chatId);
                return;
            }

            // --- ARCHIVE CHECK: Hapus timer jika chat sudah archived ---
            if (item) {
                const itemText = (item.textContent || '').toLowerCase();
                const isArchived = ARCHIVE_TAGS.some(tag => itemText.includes(tag));
                if (isArchived) {
                    console.log(`📦 [${chatId}] Archived terdeteksi — Hapus timer & toast`);
                    toDelete.push(chatId);
                    removeCheckBadge(item);
                    item.classList.remove('check-glow-2m', 'check-glow-3m', 'check-glow-5m');
                    delete item.dataset.checkToast2m;
                    delete item.dataset.checkToast3m;
                    delete item.dataset.checkToast5m;
                    removeCheckToast(chatId);
                    return;
                }
            }

            // Auto-cleanup timer > 1 jam
            if (elapsed > TIMER_MAX_AGE_MS) {
                toDelete.push(chatId);
                if (item) {
                    removeCheckBadge(item);
                    item.classList.remove('check-glow-2m', 'check-glow-3m', 'check-glow-5m');
                }
                removeCheckToast(chatId);
                return;
            }

            // Pastikan badge ada
            if (item) addCheckBadge(item);

            const rowNum = getChatRowNumber(chatId);

            // --- FASE 4: > 5 Menit ---
            if (elapsed >= PHASE_4_THRESHOLD) {
                if (item) {
                    item.classList.remove('check-glow-2m', 'check-glow-3m');
                    item.classList.add('check-glow-5m');
                    const badge = item.querySelector('.check-badge');
                    if (badge && badge.innerHTML !== '⚠️🔍') badge.innerHTML = '⚠️🔍';
                }
                if (item && !item.dataset.checkToast5m) {
                    showCheckToast(`⛔ 5M FOLLOW UP!`, ACCENT_PHASE_4, chatId);
                    item.dataset.checkToast5m = '1';
                }
            }
            // --- FASE 3: 3 - 5 Menit ---
            else if (elapsed >= PHASE_3_THRESHOLD) {
                if (item) {
                    item.classList.remove('check-glow-2m', 'check-glow-5m');
                    item.classList.add('check-glow-3m');
                }
                if (item && !item.dataset.checkToast3m) {
                    showCheckToast(`🚨 3M Cek terlalu lama`, ACCENT_PHASE_3, chatId);
                    item.dataset.checkToast3m = '1';
                }
            }
            // --- FASE 2: 2 - 3 Menit ---
            else if (elapsed >= PHASE_2_THRESHOLD) {
                if (item) {
                    item.classList.remove('check-glow-3m', 'check-glow-5m');
                    item.classList.add('check-glow-2m');
                }
                if (item && !item.dataset.checkToast2m) {
                    showCheckToast(`🔍 2M Cek berjalan`, ACCENT_PHASE_2, chatId);
                    item.dataset.checkToast2m = '1';
                }
            }
            else {
                if (item) item.classList.remove('check-glow-2m', 'check-glow-3m', 'check-glow-5m');
            }
        });

        // Hapus timer yang archived/expired
        if (toDelete.length > 0) {
            toDelete.forEach(id => checkStartTimes.delete(id));
            saveTimers();
        }

        // Update live timer + row number di semua toast
        updateToastTimers();

        // Cleanup timer untuk chat yang sudah hilang dari sidebar
        const isBooting = (now - bootTime < 10000);
        if (!isBooting && activeIds.size > 0) {
            let changed = false;
            checkStartTimes.forEach((v, k) => {
                if (!activeIds.has(k)) {
                    checkStartTimes.delete(k);
                    removeCheckToast(k);
                    changed = true;
                }
            });
            if (changed) saveTimers();
        }
    };

    const updateToastTimers = () => {
        const host = document.querySelector('.check-toast-host');
        if (!host) return;

        const toasts = host.querySelectorAll('.check-toast[data-chat-id]');
        toasts.forEach(toast => {
            const chatId = toast.dataset.chatId;

            // Update timer
            const timerEl = toast.querySelector('.check-toast-timer');
            const startTime = checkStartTimes.get(chatId);
            if (timerEl && startTime) {
                timerEl.textContent = formatDuration(Date.now() - startTime);
            }

            // Update row number (bisa berubah jika urutan chat berubah)
            const rowEl = toast.querySelector('.check-toast-row');
            if (rowEl) {
                rowEl.textContent = `#${getChatRowNumber(chatId)}`;
            }
        });
    };

    // ╔═══════════════════════════════════════════════╗
    // ║              CSS STYLES                        ║
    // ╚═══════════════════════════════════════════════╝

    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
/* ═══ TOAST HOST — KANAN BAWAH, DI ATAS TOMBOL LIVECHAT ═══ */
.check-toast-host {
    position: fixed;
    bottom: 70px;
    right: 60px;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    z-index: 99999;
    pointer-events: none;
    max-width: 320px;
}

/* ═══ TOAST CARD ═══ */
.check-toast {
    position: relative;
    pointer-events: auto;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 34px 10px 14px;
    border-radius: 10px;
    background: rgba(12, 12, 18, 0.96);
    color: #ffffff;
    border: 1.5px solid var(--check-toast-accent, #ff8c00);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 10px color-mix(in srgb, var(--check-toast-accent, #ff8c00) 25%, transparent);
    overflow: hidden;
    animation: checkToastIn 180ms ease-out both;
    font-family: 'Lexend', 'Inter', -apple-system, sans-serif;
    backdrop-filter: blur(10px);
    transition: border-color 0.3s, box-shadow 0.3s;
    white-space: nowrap;
}

.check-toast:hover {
    border-color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(0,0,0,0.6), 0 0 14px color-mix(in srgb, var(--check-toast-accent, #ff8c00) 45%, transparent);
}

/* Aksen garis kiri */
.check-toast::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: var(--check-toast-accent, #ff8c00);
    border-radius: 4px 0 0 4px;
}

/* Row number badge */
.check-toast-row {
    font-size: 11px;
    font-weight: 800;
    color: var(--check-toast-accent, #ff8c00);
    background: rgba(255,255,255,0.1);
    padding: 3px 7px;
    border-radius: 5px;
    letter-spacing: 0.5px;
    flex-shrink: 0;
    min-width: 24px;
    text-align: center;
}

/* Message text */
.check-toast-msg {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(255,255,255,0.95);
    flex: 1;
    min-width: 0;
}

/* Live timer */
.check-toast-timer {
    font-size: 14px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--check-toast-accent, #ff8c00);
    text-shadow: 0 0 8px color-mix(in srgb, var(--check-toast-accent, #ff8c00) 30%, transparent);
    letter-spacing: 1.5px;
    flex-shrink: 0;
}

/* Close button */
.check-toast-close {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.2);
    background: transparent;
    color: rgba(255,255,255,0.5);
    font-size: 13px;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.15s;
    z-index: 2;
    padding: 0;
    line-height: 1;
}

.check-toast-close:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
}

.check-toast.hide {
    animation: checkToastOut 140ms ease-in both;
}

@keyframes checkToastIn {
    from { opacity: 0; transform: translateY(10px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes checkToastOut {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(10px) scale(0.95); }
}

/* ═══ BADGE 🔍 PADA CHAT ITEM ═══ */
.check-badge {
    position: absolute;
    left: 8px;
    bottom: 6px;
    font-size: 14px;
    z-index: 100;
    user-select: none;
    pointer-events: none;
    filter: drop-shadow(0 0 3px rgba(255, 140, 0, 0.5)) drop-shadow(0 1px 3px rgba(0,0,0,0.4));
    transition: all 0.3s ease;
}

/* Fase 2: Glow Oranye */
.chat-item.check-glow-2m .check-badge {
    animation: badgePulseOrange 2s ease-in-out infinite;
}
@keyframes badgePulseOrange {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 3px rgba(255,140,0,0.5)) drop-shadow(0 1px 3px rgba(0,0,0,0.4)); }
    50% { transform: scale(1.2); filter: drop-shadow(0 0 10px rgba(255,140,0,1)) drop-shadow(0 3px 6px rgba(0,0,0,0.6)); }
}

/* Fase 3: Glow Ungu */
.chat-item.check-glow-3m .check-badge {
    animation: badgePulsePurple 1.2s ease-in-out infinite;
}
@keyframes badgePulsePurple {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(155,89,182,0.6)) drop-shadow(0 1px 3px rgba(0,0,0,0.4)); }
    50% { transform: scale(1.3); filter: drop-shadow(0 0 14px rgba(155,89,182,1)) drop-shadow(0 3px 6px rgba(0,0,0,0.7)); }
}

/* Fase 4: Glow Merah */
.chat-item.check-glow-5m .check-badge {
    animation: badgePulseRed 0.6s ease-in-out infinite;
    font-size: 16px;
}
@keyframes badgePulseRed {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(255,0,0,0.7)) drop-shadow(0 1px 3px rgba(0,0,0,0.4)); }
    50% { transform: scale(1.4); filter: drop-shadow(0 0 18px rgba(255,0,0,1)) drop-shadow(0 4px 8px rgba(0,0,0,0.8)); }
}

@media (prefers-reduced-motion: reduce) {
    .check-badge, .check-toast, .check-toast.hide { animation: none !important; }
}

/* ═══ APOLOGY TOAST & TARGET MODE ═══ */
.apology-toast-host {
    position: fixed;
    top: 120px; /* Aman di bawah search bar, di area paling atas history chat */
    left: 50%;
    transform: translateX(-50%);
    z-index: 100000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
}

.apology-toast {
    pointer-events: auto;
    padding: 12px 24px 12px 20px;
    border-radius: 8px;
    background: rgba(15, 15, 20, 0.95);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    font-family: 'Lexend', 'Inter', -apple-system, sans-serif;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    gap: 12px;
    border-left: 4px solid #fff;
    animation: apologySlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.apology-toast.type-instruction { border-left-color: #3498db; }
.apology-toast.type-safe { border-left-color: #2ecc71; }
.apology-toast.type-warn { border-left-color: #e74c3c; animation: apologyShake 0.4s ease-in-out; }

.apology-toast-close {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.6);
    font-size: 16px;
    cursor: pointer;
    margin-left: 10px;
    padding: 0;
    line-height: 1;
}
.apology-toast-close:hover { color: #fff; }

@keyframes apologySlideIn {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes apologyShake {
    0%, 100% { transform: translate(-50%, 0); }
    25% { transform: translate(calc(-50% - 5px), 0); }
    75% { transform: translate(calc(-50% + 5px), 0); }
}

body.apology-target-mode [data-testid="agent-message"] {
    cursor: crosshair !important;
    outline: 2px dashed #3498db !important;
    outline-offset: 2px;
    transition: outline 0.2s;
}
body.apology-target-mode [data-testid="agent-message"]:hover {
    outline-style: solid !important;
    background-color: rgba(52, 152, 219, 0.1) !important;
}
`;
        document.head.appendChild(style);
    };

    // ╔═══════════════════════════════════════════════╗
    // ║       MUTATION OBSERVER                        ║
    // ╚═══════════════════════════════════════════════╝

    const setupMessageObserver = () => {
        const observer = new MutationObserver((mutations) => {
            if (document.hidden) return;

            let hasNewAgentMessage = false;
            let hasArchiveChange = false;

            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;

                    const agentMsg = node.matches?.('[data-testid="agent-message"]')
                        ? node : node.querySelector?.('[data-testid="agent-message"]');
                    if (agentMsg) hasNewAgentMessage = true;

                    // Deteksi teks archive yang muncul
                    const text = (node.textContent || '').toLowerCase();
                    if (text.includes('archived') || text.includes('customer left') || text.includes('inactivity')) {
                        hasArchiveChange = true;
                    }
                });
            });

            if (hasNewAgentMessage) {
                setTimeout(() => evaluateLatestAgentMessage(), 100);
            }

            // Jika ada perubahan archive, cek dan bersihkan timer
            if (hasArchiveChange) {
                setTimeout(() => {
                    const chatId = getActiveChatId();
                    if (chatId && checkStartTimes.has(chatId) && isChatArchived(chatId)) {
                        console.log(`📦 [${chatId}] Archive event terdeteksi → Stop timer`);
                        stopCheckTimer(chatId);
                    }
                }, 200);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('🔍 Pengecekan Duration Observer: AKTIF');
    };

    // ╔═══════════════════════════════════════════════╗
    // ║       ROUTE CHANGE (SPA)                       ║
    // ╚═══════════════════════════════════════════════╝

    const onRouteChange = (cb) => {
        const _ps = history.pushState, _rs = history.replaceState;
        history.pushState = function () { const r = _ps.apply(this, arguments); setTimeout(cb, 100); return r; };
        history.replaceState = function () { const r = _rs.apply(this, arguments); setTimeout(cb, 100); return r; };
        window.addEventListener('popstate', () => setTimeout(cb, 100));
    };

    onRouteChange(() => {
        setTimeout(() => {
            const chatId = getActiveChatId();
            if (chatId) {
                lastEvaluatedText.delete(chatId);
                evaluateLatestAgentMessage();
            }
        }, 500);
    });

    // ╔═══════════════════════════════════════════════╗
    // ║       APOLOGY DURATION TRACKER                 ║
    // ╚═══════════════════════════════════════════════╝

    const APOLOGY_KEYWORDS = ['salah respon', 'kurang sesuai'];
    let apologyState = {
        active: false,
        chatId: null,
        toastEl: null,
        targetTime: null
    };

    const normalizeApologyText = (text) => {
        if (!text) return '';
        return text.toLowerCase().replace(/\s+/g, ' ').trim();
    };

    const isApologyText = (text) => {
        const norm = normalizeApologyText(text);
        return APOLOGY_KEYWORDS.some(kw => norm.includes(kw));
    };

    const parseTooltipTime = (timeStr) => {
        const match = timeStr.trim().toLowerCase().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/);
        if (!match) return null;
        let [_, h, m, s, ampm] = match;
        h = parseInt(h, 10);
        m = parseInt(m, 10);
        s = s ? parseInt(s, 10) : 0;

        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;

        const now = new Date();
        const msgTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);

        if (msgTime.getTime() > now.getTime() + 60000) {
            msgTime.setDate(msgTime.getDate() - 1);
        }
        return msgTime.getTime();
    };

    const showApologyToast = (message, stateType) => {
        let host = document.querySelector('.apology-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'apology-toast-host';
            document.body.appendChild(host);
        }

        const existing = document.querySelector('.apology-toast');
        if (existing) {
            // Keep existing toast and just add animation if safe/warn
            existing.className = `apology-toast type-${stateType}`;
            existing.querySelector('span').textContent = message;
            return;
        }

        const toast = document.createElement('div');
        toast.className = `apology-toast type-${stateType}`;
        toast.innerHTML = `<span>${message}</span><button class="apology-toast-close" type="button" aria-label="Close">×</button>`;
        toast.querySelector('.apology-toast-close').onclick = () => toast.remove();
        host.appendChild(toast);
        apologyState.toastEl = toast;
    };

    const removeApologyToast = () => {
        const existing = document.querySelector('.apology-toast');
        if (existing) existing.remove();
        apologyState.toastEl = null;
    };

    const resetApologyState = () => {
        apologyState.active = false;
        apologyState.chatId = null;
        apologyState.targetTime = null;
        document.body.classList.remove('apology-target-mode');
        removeApologyToast();
    };

    const extractTooltipTime = (agentMsgEl) => {
        let timeStr = null;
        // Search in all visible tooltips dynamically created in DOM
        const tooltips = document.querySelectorAll('div[data-no-focus-trap=""], div[role="tooltip"], div[class*="tooltip"], div[style*="z-index"][style*="absolute"]');
        for (let el of tooltips) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const t = el.innerText || el.textContent || '';
                const match = t.trim().match(/^\d{1,2}:\d{2}(?::\d{2})?\s*(am|pm)$/i);
                if (match) {
                    timeStr = t.trim();
                    break;
                }
            }
        }

        if (!timeStr) {
            const match = agentMsgEl.innerText.match(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/i);
            if (match) timeStr = match[0];
        }

        if (timeStr) return parseTooltipTime(timeStr);
        return null;
    };

    const setupApologyListeners = () => {
        // Menggunakan interval karena Macro/Perfect Keyboard sering memutar jalur event React
        setInterval(() => {
            let text = '';

            // Loop semua kandidat input untuk menghindari tabrakan dengan kolom Search di atas layar
            const editables = document.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"], textarea, input[type="text"]');

            for (let el of editables) {
                // Abaikan input search di top bar
                if (el.getAttribute('type') === 'search' || (el.placeholder && el.placeholder.toLowerCase().includes('search'))) continue;

                const t = el.value || el.innerText || el.textContent || '';

                // Jika isinya mengandung trigger kita, sudah pasti ini input chat!
                if (isApologyText(t)) {
                    text = t;
                    break;
                }

                // Jika tidak, kita cari input yang letaknya di area bawah layar (chat box area)
                const rect = el.getBoundingClientRect();
                if (rect.bottom > window.innerHeight / 2 && rect.height > 15) {
                    text = t;
                }
            }

            const chatId = getActiveChatId();

            if (text.trim() === '') {
                if (apologyState.active) resetApologyState();
                return;
            }

            if (isApologyText(text) && !apologyState.active) {
                apologyState.active = true;
                apologyState.chatId = chatId;
                document.body.classList.add('apology-target-mode');
                showApologyToast('💡 Klik pesan agent yang salah di atas (Tunggu sampai muncul jam hover lalu Klik)!', 'instruction');
            } else if (!isApologyText(text) && apologyState.active) {
                // Di-reset jika agent menghapus keyword dari kolom pengetikan 
                resetApologyState();
            }

            // Live Update Durasi di Toast (Stopwatch Mode)
            if (apologyState.active && apologyState.targetTime) {
                let elapsedMs = Date.now() - apologyState.targetTime;
                if (elapsedMs < 0) elapsedMs = 0;
                const elapsedSec = Math.floor(elapsedMs / 1000);
                const min = Math.floor(elapsedSec / 60);
                const sec = elapsedSec % 60;
                const formatStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

                // Ubah status ke Merah (Pelanggaran) secara real-time jika menembus 2 menit
                if (elapsedSec > 120 && apologyState.toastEl && apologyState.toastEl.classList.contains('type-safe')) {
                    apologyState.toastEl.className = 'apology-toast type-warn';
                }

                const textSpan = apologyState.toastEl ? apologyState.toastEl.querySelector('span') : null;
                if (textSpan) {
                    if (elapsedSec <= 120) {
                        textSpan.textContent = `✅ Aman [${formatStr}] - Durasi minta maaf sesuai SOP.`;
                    } else {
                        textSpan.textContent = `🚨 Pelanggaran SOP [${formatStr}] - Minta maaf telat!`;
                    }
                }
            }
        }, 500);

        document.body.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && apologyState.active) {
                setTimeout(() => resetApologyState(), 200);
            }
        });

        document.body.addEventListener('click', (e) => {
            const sendBtn = e.target.closest('button[data-testid="send-button"], [aria-label="Send"]');
            if (sendBtn && apologyState.active) {
                setTimeout(() => resetApologyState(), 200);
                return;
            }

            if (!apologyState.active) return;
            const isCloseToast = e.target.closest('.apology-toast-close');
            if (isCloseToast) return;

            const agentMsg = e.target.closest('[data-testid="agent-message"]');
            if (agentMsg) {
                e.preventDefault();
                e.stopPropagation();

                const timeMs = extractTooltipTime(agentMsg);
                if (timeMs) {
                    apologyState.targetTime = timeMs; // Menyimpan waktu target untuk live update

                    let elapsedMs = Date.now() - timeMs;
                    // Negative check just in case browser time sync is off by a few seconds
                    if (elapsedMs < 0) elapsedMs = 0;
                    const elapsedSec = Math.floor(elapsedMs / 1000);
                    const min = Math.floor(elapsedSec / 60);
                    const sec = elapsedSec % 60;
                    const formatStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

                    if (elapsedSec <= 120) {
                        showApologyToast(`✅ Aman [${formatStr}] - Durasi minta maaf sesuai SOP.`, 'safe');
                    } else {
                        showApologyToast(`🚨 Pelanggaran SOP [${formatStr}] - Minta maaf telat!`, 'warn');
                    }

                    document.body.classList.remove('apology-target-mode');
                } else {
                    showApologyToast('⚠️ Gagal baca detik! HARUS arahkan kursor (hover) sampai muncul tooltip jam/detik, lalu klik pesannya!', 'instruction');
                }
            }
        }, true);
    };

    // ╔═══════════════════════════════════════════════╗
    // ║              INISIALISASI                      ║
    // ╚═══════════════════════════════════════════════╝

    const init = () => {
        injectStyles();
        setupMessageObserver();
        setupApologyListeners();

        setTimeout(() => evaluateLatestAgentMessage(), 1000);

        setInterval(runPeriodicEvaluation, CHECK_INTERVAL_MS);

        checkStartTimes.forEach((startTime, chatId) => {
            const item = findItemByChatId(chatId);
            if (item) addCheckBadge(item);
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                runPeriodicEvaluation();
                const chatId = getActiveChatId();
                if (chatId) {
                    lastEvaluatedText.delete(chatId);
                    evaluateLatestAgentMessage();
                }
            }
        });

        console.log('✅ LAOTOT4 v1.2.0 — Pengecekan Timer READY');
        console.log('   ├─ Toast: Kanan-bawah, compact');
        console.log('   ├─ Archive auto-stop: ON');
        console.log('   └─ Active Timers:', checkStartTimes.size);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 500);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
    }

})();
