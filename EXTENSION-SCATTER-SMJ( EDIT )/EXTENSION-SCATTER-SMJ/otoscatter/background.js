// background.js

// --- CONFIGURATION ---
const INITIAL_LOAD_DELAY = 5000;
const HEADER_RULE_ID_BASE = 1000;
const HEADER_RULE_ID_COUNT = 20;

// --- AGENT HEADERS SYSTEM (AUTO-CAPTURE) ---
const AUTH_HEADER_KEYWORDS = [
    'X-Access-Token',
    'X-Agent-Pkid',
    'X-Agent-Role',
    'X-Agent-Suid',
    'X-Agent-User',
    'X-Agent-UserId',
    'Authorization'
];

function getHostFromUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        return u.hostname;
    } catch {
        return '';
    }
}

function sanitizeHeaderValue(v) {
    return String(v || '').trim().replace(/[\r\n]+/g, ' ');
}

function getHeaderRuleIds() {
    const ids = [];
    for (let i = 0; i < HEADER_RULE_ID_COUNT; i++) {
        ids.push(HEADER_RULE_ID_BASE + i);
    }
    return ids;
}

function updateAuthHeaderRules() {
    chrome.storage.local.get(["agentHeaders", "adminUrl"], (res) => {
        const agentHeaders = res.agentHeaders || null;
        const adminHost = getHostFromUrl(res.adminUrl);

        const removeRuleIds = getHeaderRuleIds();

        // Cek apakah ada setidaknya satu header valid yang ditangkap
        const hasValidHeader = agentHeaders && AUTH_HEADER_KEYWORDS.some(k => agentHeaders[k]);
        if (!hasValidHeader) {
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
            console.log("🚫 [AUTH] No valid Agent Headers found, rules cleared.");
            return;
        }

        const requestHeaders = Object.entries(agentHeaders)
            .filter(([k, v]) => typeof k === 'string' && k.length > 0 && typeof v !== 'undefined' && v !== null)
            .map(([k, v]) => ({ header: k, operation: 'set', value: sanitizeHeaderValue(v) }))
            .filter((h) => h.value.length > 0);

        if (requestHeaders.length === 0) {
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
            return;
        }

        const domains = [
            adminHost,
            'agent.png777.com',
            'public.u2uyu876x.com',
            'public-api.u2uyu876x.com',
            'script.google.com',
            'smbabsen.site',
            'masuk.fun',
            'wbteam.cloud',
            'iyakah.fun',
            'new.glanters.site'
        ].filter(Boolean);

        const uniqueDomains = Array.from(new Set(domains));

        const addRules = uniqueDomains.slice(0, HEADER_RULE_ID_COUNT).map((domain, idx) => ({
            id: HEADER_RULE_ID_BASE + idx,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders,
            },
            condition: {
                urlFilter: `||${domain}^`,
                resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'fetch'],
            },
        }));

        chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules }, () => {
            if (chrome.runtime.lastError) {
                console.error("❌ [AUTH] DNR Error:", chrome.runtime.lastError.message);
            } else {
                console.log(`✅ [AUTH] Injected headers for ${uniqueDomains.length} domains.`);
            }
        });
    });
}

// Listener untuk menangkap header secara otomatis saat user browsing admin
chrome.webRequest.onSendHeaders.addListener(
    (details) => {
        if (!details.requestHeaders) return;

        let captured = {};
        let foundAny = false;
        const lowerKeywords = AUTH_HEADER_KEYWORDS.map(k => k.toLowerCase());

        for (const header of details.requestHeaders) {
            const lowerName = header.name.toLowerCase();
            const index = lowerKeywords.indexOf(lowerName);
            if (index !== -1) {
                captured[AUTH_HEADER_KEYWORDS[index]] = header.value;
                foundAny = true;
            }
        }

        // Tentukan key token utama (Prioritaskan yang ada, misal X-Access-Token atau Authorization)
        let primaryTokenKey = null;
        for (const key of AUTH_HEADER_KEYWORDS) {
            if (captured[key]) {
                primaryTokenKey = key;
                break;
            }
        }

        if (foundAny && primaryTokenKey) {
            chrome.storage.local.get(['agentHeaders', 'adminUrl'], (res) => {
                const adminUrl = res.adminUrl || "";
                const adminHost = getHostFromUrl(adminUrl);
                const requestHost = getHostFromUrl(details.url);

                // Pastikan token HANYA ditangkap dari request yang menuju ke server admin kita (jangan dari Google Sheets dll)
                if (adminHost && requestHost && !requestHost.includes(adminHost) && !requestHost.includes('u2uyu876x.com')) {
                    return; // Abaikan header dari web lain
                }

                let newToken = captured[primaryTokenKey];
                
                // Murni pencegahan ekstra untuk Google Auth
                if (newToken.includes("SAPISIDHASH")) return;

                const prev = res.agentHeaders || {};
                // Hanya simpan jika token berbeda atau ada update
                if (prev[primaryTokenKey] !== captured[primaryTokenKey]) {
                    // Bersihkan prefix "Bearer " jika menggunakan Authorization Header
                    if (newToken.toLowerCase().startsWith('bearer ')) {
                        newToken = newToken.substring(7).trim();
                    }

                    // --- PISAHKAN JWT DAN UUID ---
                    let uuidToken = null;
                    const isJwt = newToken.startsWith('eyJ');

                    // Jika bukan JWT dan panjangnya cukup, anggap itu UUID
                    if (!isJwt && newToken.length >= 20 && !newToken.includes("SAPISIDHASH")) {
                        uuidToken = newToken;
                    }

                    // [BONUS] Coba ekstrak UUID dari parameter URL jika ada (t=UUID)
                    try {
                        const urlObj = new URL(details.url);
                        const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('sid') || urlObj.searchParams.get('psid');
                        if (tParam && tParam.length >= 20 && !tParam.startsWith('eyJ')) {
                            uuidToken = tParam;
                        }
                    } catch (e) {}

                    const storageUpdate = {
                        agentHeaders: captured // Selalu simpan header asli untuk DNR (NetRequest)
                    };

                    // HANYA update Token Utama (UI) jika kita menemukan UUID yang valid
                    if (uuidToken) {
                        storageUpdate.token = uuidToken;
                        storageUpdate.lastTokenUpdate = Date.now();
                        storageUpdate.pancinganStatus = "active";
                    }

                    chrome.storage.local.set(storageUpdate, () => {
                        console.log("🎯 [AUTH] Agent Headers captured. isUUID?:", !!uuidToken);
                        
                        // Jika menemukan UUID baru dan sedang nyangkut, lanjutkan proses
                        if (uuidToken && typeof isRefreshingToken !== 'undefined' && isRefreshingToken) {
                            console.log("🔓 [RESUME] UUID Token baru dipanen. Melanjutkan antrean...");
                            isRefreshingToken = false;
                            pancinganInProgress = false;
                            pancinganFailed = false;
                            pancinganErrorReason = '';
                            setTimeout(() => {
                                if (typeof startNextProcess === 'function') startNextProcess();
                            }, 500);
                        }

                        // Hanya munculkan notifikasi jika benar-benar berhasil mendapatkan UUID
                        if (uuidToken) {
                            chrome.notifications.create('auth_captured', {
                                type: 'basic',
                                iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
                                title: 'SMJ AUTO: Token Tertangkap',
                                message: 'Sistem berhasil menyadap UUID token baru dari aktivitas browsing Anda.',
                                priority: 2
                            });
                        }
                    });
                }
            });
        }
    },
    { urls: ["https://*/*", "http://*/*"] },
    ["requestHeaders"]
);

// --- PELACAK BATCH ---
let activeBatchCount = 0;
let isRefreshingToken = false; // Flag status pancingan sedang berjalan
let pancinganInProgress = false; // LOCK: Mencegah tab pancingan ganda
let pancinganFailed = false; // Flag jika pancingan gagal (ID/Tiket invalid)
let pancinganErrorReason = ''; // Menyimpan pesan error pancingan terakhir

// Set Pelacak Tab Pancingan (Multi-Tab Support)
let pancinganTabIds = new Set();

// --- BONUSSMB AUTO FILL SYSTEM ---
const MAX_BONUSSMB_CONCURRENT = 3;
const BONUSSMB_TICKETS_URL = 'https://bonussmb.com/tickets';
const BONUSSMB_HISTORY_URL = 'https://bonussmb.com/history#smjmonitor';
const BONUSSMB_HISTORY_ALARM = 'SMJ_BONUSSMB_HISTORY_CHECK';
const HISTORY_MONITOR_MAX_AGE = 60 * 60 * 1000; // 60 menit timeout per tiket (lebih lama agar tidak prematur)
let bonussmbFillQueue = [];
let bonussmbQueuedKeys = new Set();
let bonussmbActiveKeys = new Set();
let bonussmbActiveCount = 0;
let bonusStatusQueue = [];
let isBonusStatusSaving = false;
let historyMonitorTabId = null;

// --- STORAGE SAVE QUEUE (Mencegah Race Condition) ---
let resultSaveQueue = [];
let isSaving = false;
const BONUSSMB_AUTO_ALARM = 'SMJ_BONUSSMB_TICK';

// --- PROTEKSI DASHBOARD: Jangan pernah menutup tab dashboard secara otomatis ---
function safeRemoveTab(tabId) {
    if (!tabId) return;
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;
        const url = tab.url || tab.pendingUrl || "";
        if (url.includes("dashboard.html")) {
            console.log("🛡️ [PROTECTION] Menolak menutup tab Dashboard (ID: " + tabId + ")");
            return;
        }
        chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) { /* Tab mungkin sudah tertutup manual */ }
        });
    });
}

// Konstanta untuk kontrol loop
const DELAY_TIME = 500; // 0.5 detik untuk klik cepat
const NEXT_BTN_SELECTOR = ".detail-navigation.right";

// ----------------- FUNGSI BANTU ASINKRON -----------------

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanIdNumeric(id) {
    return String(id || '').replace(/[^0-9]/g, '');
}

function ensureBonussmbAlarm() {
    chrome.alarms.get(BONUSSMB_AUTO_ALARM, (alarm) => {
        if (!alarm) chrome.alarms.create(BONUSSMB_AUTO_ALARM, { periodInMinutes: 1 });
    });
}

let autoBackgroundInitDone = false;

function initAutoBackground() {
    if (autoBackgroundInitDone) return; 
    autoBackgroundInitDone = true;

    ensureBonussmbAlarm();
    updateAuthHeaderRules(); // Inisialisasi header agent saat startup
}

// ----------------- BONUSSMB HELPER FUNCTIONS -----------------

function parseNumberLikeBg(value) {
    if (typeof value === 'number') return value;
    let s = String(value ?? '').trim();
    if (!s) return null;

    // Handle format 2,000.00 -> delete thousand commas
    s = s.replace(/,/g, '');

    // Delete everything except numbers and decimal point
    s = s.replace(/[^\d.]/g, '');

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

function deriveScatterCount(result) {
    const n = parseNumberLikeBg(result?.scatterCount);
    // Jika sudah ada angka > 0, gunakan itu. 
    // Tapi jika 0 atau null, kita WAJIB cek scatterTitle-nya.
    if (n !== null && n > 0) return n;

    // Parse dari scatterTitle (misal: "3", "4", "Scatter: 3")
    const title = String(result?.scatterTitle || '');
    if (!title || title.toLowerCase().includes('tidak ditemukan')) return null;

    // Bersihkan title dari kata-kata pengganggu
    const cleanTitle = title.replace(/scatter/gi, '').trim();
    const m = cleanTitle.match(/(\d{1,2})/);
    if (m && m[1]) {
        const rawVal = parseInt(m[1], 10);
        if (!isNaN(rawVal)) return rawVal;
    }

    // Final fallback: check for words "tiga", "empat", "lima"
    const t = title.toLowerCase();
    if (t.includes('tiga') || t.includes(' 3 ') || t === '3') return 3;
    if (t.includes('empat') || t.includes(' 4 ') || t === '4') return 4;
    if (t.includes('lima') || t.includes(' 5 ') || t === '5') return 5;
    return null;
}

function deriveStatusCek(result) {
    const title = String(result?.scatterTitle || '').toLowerCase();
    if (title.includes('error') || title.includes('gagal') || title.includes('tidak ditemukan')) return 'Cek gagal';

    const scatter = deriveScatterCount(result);
    // Hanya anggap sukses jika ada 3 scatter atau lebih (Syarat BonusSMB)
    if (scatter !== null && scatter >= 3) return 'Sukses cek';

    // Jika ada scatter tapi 1-2, tetap dianggap gagal untuk BonusSMB
    return 'Cek gagal';
}

function isBonussmbFinalStatus(status) {
    const s = String(status || '').trim();
    return s === 'Sudah input' || s === 'Ticket sudah ada' || isBonussmbHistoryFinal(s);
}

function isBonussmbHistoryFinal(status) {
    const s = String(status || '').trim().toUpperCase();
    return ['APPROVED', 'REJECTED', 'FAILED', 'MANUAL'].includes(s);
}

// ========================================================
// HISTORY MONITOR — Lifecycle Management
// ========================================================

// Queue untuk registrasi tiket monitor (mencegah race condition)
let monitorRegQueue = [];
let isMonitorRegProcessing = false;

function registerTicketForMonitor(userId, transactionId) {
    monitorRegQueue.push({ userId, transactionId, registeredAt: Date.now() });
    console.log(`📡 [MONITOR] Tiket ${transactionId} ditambah ke antrian registrasi (queue: ${monitorRegQueue.length}).`);
    processMonitorRegQueue();
}

function processMonitorRegQueue() {
    if (isMonitorRegProcessing || monitorRegQueue.length === 0) return;
    isMonitorRegProcessing = true;

    // Ambil semua item sekaligus dari queue
    const batch = [...monitorRegQueue];
    monitorRegQueue = [];

    chrome.storage.local.get(['bonussmbMonitorTickets'], (res) => {
        const tickets = Array.isArray(res.bonussmbMonitorTickets) ? res.bonussmbMonitorTickets : [];

        batch.forEach(item => {
            const key = `${item.userId}|${item.transactionId}`;
            const exists = tickets.some(t => `${t.userId}|${t.transactionId}` === key);
            if (!exists) {
                tickets.push(item);
                console.log(`📡 [MONITOR] ✓ Tiket ${item.transactionId} terdaftar. Total monitor: ${tickets.length}`);
            }
        });

        chrome.storage.local.set({ bonussmbMonitorTickets: tickets }, () => {
            isMonitorRegProcessing = false;
            ensureHistoryMonitorTab();
            ensureHistoryAlarm();
            // TRIGGER IMMEDIATE CHECK — reload history tab agar langsung scrape
            triggerImmediateHistoryCheck();
            // Proses sisa queue jika ada item baru masuk saat processing
            if (monitorRegQueue.length > 0) {
                processMonitorRegQueue();
            }
        });
    });
}

function ensureHistoryAlarm() {
    chrome.alarms.get(BONUSSMB_HISTORY_ALARM, (alarm) => {
        if (!alarm) {
            chrome.alarms.create(BONUSSMB_HISTORY_ALARM, { periodInMinutes: 1 });
            console.log('📡 [MONITOR] History alarm dibuat (1 mnt fallback).');
        }
    });
}

// TRIGGER IMMEDIATE: Reload tab history agar langsung cek status terbaru
function triggerImmediateHistoryCheck() {
    if (historyMonitorTabId === null) return;
    chrome.tabs.get(historyMonitorTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
            historyMonitorTabId = null;
            return;
        }
        console.log('📡 [MONITOR] Trigger immediate history reload...');
        chrome.tabs.reload(historyMonitorTabId, {}, () => {
            void chrome.runtime.lastError;
        });
    });
}

function ensureHistoryMonitorTab() {
    if (historyMonitorTabId !== null) {
        chrome.tabs.get(historyMonitorTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                historyMonitorTabId = null;
                openHistoryMonitorTab();
            }
            // Tab masih ada, content script akan scrape pada cycle berikutnya
        });
        return;
    }
    openHistoryMonitorTab();
}

function openHistoryMonitorTab() {
    getBestNormalWindowId((windowId) => {
        const opts = { url: BONUSSMB_HISTORY_URL, active: false };
        if (windowId) opts.windowId = windowId;
        chrome.tabs.create(opts, (tab) => {
            if (tab && tab.id) {
                historyMonitorTabId = tab.id;
                setTabAutoDiscardable(tab.id, false);
                chrome.storage.local.set({ bonussmbMonitorTabId: tab.id });
                console.log(`📡 [MONITOR] History tab dibuka (ID: ${tab.id})`);
            }
        });
    });
}

function closeHistoryMonitorTab() {
    if (historyMonitorTabId !== null) {
        safeRemoveTab(historyMonitorTabId);
        historyMonitorTabId = null;
        chrome.storage.local.remove('bonussmbMonitorTabId');
        chrome.alarms.clear(BONUSSMB_HISTORY_ALARM);
        console.log('📡 [MONITOR] History tab ditutup & alarm dihentikan.');
    }
}

function cleanupStaleMonitorTickets() {
    chrome.storage.local.get(['bonussmbMonitorTickets'], (res) => {
        const tickets = Array.isArray(res.bonussmbMonitorTickets) ? res.bonussmbMonitorTickets : [];
        const now = Date.now();
        const active = tickets.filter(t => now - (t.registeredAt || 0) <= HISTORY_MONITOR_MAX_AGE);
        const staleCount = tickets.length - active.length;
        if (staleCount > 0) {
            console.log(`📡 [MONITOR] ${staleCount} tiket expired dihapus dari monitor.`);
            chrome.storage.local.set({ bonussmbMonitorTickets: active });
            if (active.length === 0) closeHistoryMonitorTab();
        }
    });
}

function handleHistoryStatusUpdate(updates) {
    if (!Array.isArray(updates) || updates.length === 0) return;

    console.log(`📡 [MONITOR] Menerima ${updates.length} update dari history page...`);

    chrome.storage.local.get(['bonussmbMonitorTickets', 'jutawanResults'], (res) => {
        let monitorTickets = Array.isArray(res.bonussmbMonitorTickets) ? [...res.bonussmbMonitorTickets] : [];
        const results = Array.isArray(res.jutawanResults) ? [...res.jutawanResults] : [];
        let changed = false;

        updates.forEach(update => {
            const smbStatus = String(update.smbStatus || '').trim().toUpperCase();
            if (!smbStatus) return;

            const validStatuses = ['APPROVED', 'REJECTED', 'PROCESSING', 'FAILED', 'MANUAL'];
            if (!validStatuses.includes(smbStatus)) return;

            const updateTxClean = cleanIdNumeric(update.transactionId);

            // Cari di jutawanResults dengan MULTIPLE METHODS matching
            let idx = results.findIndex(r =>
                cleanIdNumeric(r.transactionId) === updateTxClean
            );

            // Fallback: partial match (satu mengandung yang lain)
            if (idx < 0) {
                idx = results.findIndex(r => {
                    const rClean = cleanIdNumeric(r.transactionId);
                    return rClean.length > 10 && updateTxClean.length > 10 &&
                        (rClean.includes(updateTxClean) || updateTxClean.includes(rClean));
                });
            }

            if (idx < 0) {
                console.warn(`📡 [MONITOR] ✗ Tiket ${update.transactionId} (clean: ${updateTxClean}) tidak ditemukan di jutawanResults.`);
                return;
            }

            const currentStatus = String(results[idx].bonussmbStatus || '').trim().toUpperCase();
            console.log(`📡 [MONITOR] Match! ${update.transactionId}: Site=${smbStatus}, Ext=${currentStatus}`);

            // SKIP hanya jika sudah sama DAN status sudah final
            if (currentStatus === smbStatus && isBonussmbHistoryFinal(currentStatus)) return;

            // UPDATE STATUS — baik dari 'Sudah input' ke 'APPROVED', atau status apapun
            results[idx] = {
                ...results[idx],
                bonussmbStatus: smbStatus,
                bonussmbDetail: update.smbKeterangan || ''
            };
            changed = true;
            console.log(`📡 [MONITOR] ✓ UPDATE: ${results[idx].userId}/${update.transactionId} → ${smbStatus}`);

            // Sync ke Google Sheets
            syncBonusUpdateToSheets(
                results[idx].userId,
                update.transactionId,
                smbStatus,
                results[idx].debetValue,
                results[idx].scatterTitle
            );

            // Hapus dari monitor jika final
            if (isBonussmbHistoryFinal(smbStatus)) {
                monitorTickets = monitorTickets.filter(t =>
                    cleanIdNumeric(t.transactionId) !== updateTxClean
                );
            }
        });

        // SELALU simpan monitorTickets yang sudah diupdate (agar tiket resolved dihapus)
        chrome.storage.local.set({
            jutawanResults: results,
            bonussmbMonitorTickets: monitorTickets
        }, () => {
            if (changed) {
                chrome.runtime.sendMessage({ type: 'RESULTS_PUSH', results }).catch(() => { });
                console.log(`📡 [MONITOR] ✅ ${updates.length} update diproses. Changed=${changed}. Sisa monitor: ${monitorTickets.length}`);
            }

            // Hanya tutup tab jika BENAR-BENAR tidak ada tiket tersisa
            if (monitorTickets.length === 0) {
                // Delay 5 detik sebelum tutup — beri waktu kalau ada registrasi baru masuk
                setTimeout(() => {
                    chrome.storage.local.get(['bonussmbMonitorTickets'], (res2) => {
                        const remaining = Array.isArray(res2.bonussmbMonitorTickets) ? res2.bonussmbMonitorTickets : [];
                        if (remaining.length === 0) {
                            closeHistoryMonitorTab();
                        } else {
                            console.log(`📡 [MONITOR] Ada ${remaining.length} tiket baru masuk. Tab tetap terbuka.`);
                        }
                    });
                }, 5000);
            }
        });
    });
}

function getBestNormalWindowId(callback) {
    chrome.windows.getLastFocused({}, (win) => {
        if (win && win.type === 'normal') {
            callback(win.id);
            return;
        }
        chrome.windows.getAll({}, (wins) => {
            const normal = (wins || []).find((w) => w && w.type === 'normal');
            callback(normal ? normal.id : null);
        });
    });
}

function setTabAutoDiscardable(tabId, value) {
    try {
        chrome.tabs.update(tabId, { autoDiscardable: !!value }, () => {
            void chrome.runtime.lastError;
        });
    } catch { }
}

function ensureTabLoaded(tabId, timeoutMs) {
    const maxWait = typeof timeoutMs === 'number' ? timeoutMs : 15000;
    return new Promise((resolve) => {
        const startedAt = Date.now();
        let resolved = false;
        let timer = null;

        const finish = (ok) => {
            if (resolved) return;
            resolved = true;
            try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch { }
            try { if (timer) clearInterval(timer); } catch { }
            resolve(!!ok);
        };

        const onUpdated = (updatedTabId, info) => {
            if (updatedTabId !== tabId) return;
            if (info && info.status === 'complete') finish(true);
        };

        chrome.tabs.get(tabId, (t) => {
            const err0 = chrome.runtime.lastError;
            if (!t || err0) { finish(false); return; }
            if (t.status === 'complete' && !t.discarded) { finish(true); return; }
            try {
                if (t.discarded) {
                    chrome.tabs.reload(tabId, {}, () => { void chrome.runtime.lastError; });
                }
            } catch { }
            chrome.tabs.onUpdated.addListener(onUpdated);
            timer = setInterval(() => {
                if (Date.now() - startedAt > maxWait) { finish(false); return; }
                chrome.tabs.get(tabId, (t2) => {
                    const err2 = chrome.runtime.lastError;
                    if (!t2 || err2) { finish(false); return; }
                    if (t2.status === 'complete' && !t2.discarded) finish(true);
                });
            }, 600);
        });
    });
}

function ensureBonussmbReceiver(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab || !tab.url || !String(tab.url).startsWith('https://bonussmb.com/')) {
                resolve({ ok: false, error: 'tab_invalid' });
                return;
            }
            chrome.tabs.sendMessage(tabId, { type: 'BONUSSMB_PING' }, (resp) => {
                void chrome.runtime.lastError;
                if (resp && resp.ok) { resolve({ ok: true }); return; }
                chrome.scripting.executeScript(
                    { target: { tabId }, files: ['bonussmb-content.js'] },
                    () => {
                        if (chrome.runtime.lastError) {
                            resolve({ ok: false, error: chrome.runtime.lastError.message });
                            return;
                        }
                        chrome.tabs.sendMessage(tabId, { type: 'BONUSSMB_PING' }, (resp2) => {
                            void chrome.runtime.lastError;
                            if (resp2 && resp2.ok) resolve({ ok: true });
                            else resolve({ ok: false, error: 'no_receiver' });
                        });
                    }
                );
            });
        });
    });
}

// ----------------- BONUSSMB QUEUE MANAGEMENT -----------------

function enqueueBonussmbFill(finalResult) {
    const r = finalResult && typeof finalResult === 'object' ? finalResult : {};
    const statusCek = String(r.statusCek || '').trim();
    if (statusCek !== 'Sukses cek') return;
    if (isBonussmbFinalStatus(r.bonussmbStatus)) return;

    const key = `${String(r.userId)}|${String(r.transactionId)}`;
    if (!key.includes('|') || key === '|') return;
    if (bonussmbActiveKeys.has(key)) return;
    if (bonussmbQueuedKeys.has(key)) return;
    bonussmbQueuedKeys.add(key);
    bonussmbFillQueue.push(r);
    processBonussmbFillQueue();
}

function processBonussmbFillQueue() {
    while (bonussmbActiveCount < MAX_BONUSSMB_CONCURRENT && bonussmbFillQueue.length > 0) {
        const nextItem = bonussmbFillQueue.shift();
        if (!nextItem) break;

        const key = `${String(nextItem.userId)}|${String(nextItem.transactionId)}`;
        bonussmbQueuedKeys.delete(key);
        if (bonussmbActiveKeys.has(key)) continue;

        bonussmbActiveKeys.add(key);
        bonussmbActiveCount++;
        enqueueBonussmbStatus(nextItem.userId, nextItem.transactionId, 'Sedang input', '');

        performBonussmbFill(nextItem)
            .catch(() => { })
            .finally(() => {
                bonussmbActiveKeys.delete(key);
                if (bonussmbActiveCount > 0) bonussmbActiveCount--;
                setTimeout(() => processBonussmbFillQueue(), 120);
            });
    }
}

function performBonussmbFill(finalResult) {
    return new Promise((resolve) => {
        const done = () => { try { resolve(true); } catch { resolve(true); } };

        const currentStatus = String(finalResult?.bonussmbStatus || '').trim();
        if (isBonussmbFinalStatus(currentStatus)) { done(); return; }

        const payload = {
            userId: finalResult.userId,
            userIdRaw: finalResult.userIdRaw || finalResult.userId,
            transactionId: finalResult.transactionId,
            debetValue: finalResult.debetValue,
            scatterTitle: finalResult.scatterTitle,
            scatterCount: finalResult.scatterCount,
            site: 'wdbos',
            gameType: 'mahjong',
        };

        const closeTab = (tabId) => {
            try {
                chrome.tabs.remove(tabId, () => { void chrome.runtime.lastError; });
            } catch { }
        };

        const openNewTab = () => {
            return new Promise((resolveOpen) => {
                getBestNormalWindowId((targetWindowId) => {
                    const createOpts = { url: BONUSSMB_TICKETS_URL, active: false };
                    if (targetWindowId) createOpts.windowId = targetWindowId;
                    chrome.tabs.create(createOpts, (tab) => {
                        if (!tab || !tab.id) {
                            resolveOpen({ ok: false, error: 'Gagal membuka tab bonussmb' });
                            return;
                        }
                        const tabId = tab.id;
                        setTabAutoDiscardable(tabId, false);
                        ensureTabLoaded(tabId, 20000)
                            .then(() => resolveOpen({ ok: true, tabId }))
                            .catch(() => resolveOpen({ ok: true, tabId }));
                    });
                });
            });
        };

        const maxAttempts = 3;
        const attemptFill = (attempt) => {
            const statusLabel = attempt > 1 ? `Mengulang (Attempt ${attempt})...` : 'Sedang input';
            enqueueBonussmbStatus(finalResult.userId, finalResult.transactionId, statusLabel, '');

            openNewTab().then((opened) => {
                if (!opened.ok) {
                    enqueueBonussmbStatus(finalResult.userId, finalResult.transactionId, 'Gagal input', opened.error || 'open_tab_failed');
                    done();
                    return;
                }

                const tabId = opened.tabId;

                const finish = (status, detail, retryable) => {
                    enqueueBonussmbStatus(finalResult.userId, finalResult.transactionId, status, detail);

                    // JEDA PENGAMAN (3 Detik) sebelum tutup untuk menjamin data tersimpan di server
                    const isSuccess = status === 'Sudah input' || status === 'Ticket sudah ada';
                    const delayMs = isSuccess ? 3000 : 0;

                    setTimeout(() => {
                        closeTab(tabId);
                    }, delayMs);

                    if (retryable && attempt < maxAttempts) {
                        const backoff = 400 + attempt * 350;
                        setTimeout(() => attemptFill(attempt + 1), backoff);
                        return;
                    }
                    done();
                };

                ensureBonussmbReceiver(tabId).then((ready) => {
                    if (!ready.ok) {
                        finish('Gagal input', ready.error || 'receiver_not_ready', true);
                        return;
                    }

                    chrome.tabs.sendMessage(tabId, { type: 'BONUSSMB_FILL_TICKET', payload }, (resp) => {
                        const lastErr = chrome.runtime.lastError;
                        if (lastErr) {
                            finish('Gagal input', lastErr.message || 'send_failed', true);
                            return;
                        }

                        if (resp && resp.ok) {
                            finish('Sudah input', '', false);
                            // Daftarkan untuk monitoring status history — SEGERA
                            console.log(`📡 [BONUSSMB] Tiket ${finalResult.transactionId} berhasil input. Mendaftarkan monitor...`);
                            registerTicketForMonitor(finalResult.userId, finalResult.transactionId);
                            return;
                        }

                        const errText = resp && resp.error ? String(resp.error) : 'unknown';
                        const errCode = resp && resp.code ? String(resp.code) : '';

                        const isTaken = errCode === 'ticket_taken' || errText.includes('The ticket code has already been taken.') || errText.toLowerCase().includes('already been taken');
                        const isLimit = errCode === 'claim_limit';
                        const isDynamic = errCode === 'dynamic_site_error';
                        const isTransient = errText.includes('Dialog Form Tiket') || errText.includes('Form Tiket') || errText.includes('Field belum muncul');

                        let finalStatus = 'Gagal input';
                        if (isTaken) {
                            finalStatus = 'Ticket sudah ada';
                            // Ticket sudah ada berarti sudah pernah diinput — TETAP monitor untuk dapat status APPROVED
                            registerTicketForMonitor(finalResult.userId, finalResult.transactionId);
                        } else if (isLimit) {
                            finalStatus = 'Limit Klaim';
                        } else if (isDynamic && errText.length > 5) {
                            // Ambil max 25 char agar tidak merusak UI tabel
                            const cleanText = errText.replace(/[\n\r]/g, ' ').trim();
                            finalStatus = cleanText.length > 25 ? cleanText.substring(0, 22) + '...' : cleanText;
                        }

                        const retryable = !isTaken && !isLimit && !isDynamic && isTransient;
                        finish(finalStatus, errText, retryable);
                    });
                });
            });
        };

        attemptFill(1);
    });
}

function processPendingBonussmbInputs() {
    chrome.storage.local.get(['jutawanResults', 'bonussmbAutoEnabled'], (res) => {
        const enabled = res.bonussmbAutoEnabled !== false;
        if (!enabled) return;

        const rows = Array.isArray(res.jutawanResults) ? res.jutawanResults : [];
        const candidates = rows.filter((r) => {
            const statusCek = String(r?.statusCek || '').trim();
            const b = String(r?.bonussmbStatus || '').trim();
            // Ambil yang sukses tapi statusnya masih pending atau mengulang (karena tersendat)
            return statusCek === 'Sukses cek' && (b === 'Pending input' || b === 'Mengulang...');
        });

        if (candidates.length > 0) {
            console.log(`🔍 [BONUSSMB] Periodic scan found ${candidates.length} pending inputs.`);
            // Masukkan ke antrean satu per satu (diproses oleh MAX_CONCURRENT)
            candidates.slice(0, 5).forEach(r => enqueueBonussmbFill(r));
        }
    });
}

function processSaveQueue() {
    if (isSaving || resultSaveQueue.length === 0) return;
    if (isBonusStatusSaving) {
        setTimeout(() => processSaveQueue(), 250);
        return;
    }

    isSaving = true;
    const itemsToSave = [...resultSaveQueue];
    resultSaveQueue = [];

    chrome.storage.local.get(["jutawanResults", "bonussmbAutoEnabled"], (res) => {
        const data = Array.isArray(res.jutawanResults) ? res.jutawanResults : [];
        const next = [...data];
        const bonussmbEnabled = res.bonussmbAutoEnabled !== false;

        const indexByKey = new Map();
        for (let i = 0; i < next.length; i++) {
            const r = next[i];
            const key = `${String(r.userId)}|${String(r.transactionId)}`;
            if (!indexByKey.has(key)) indexByKey.set(key, i);
        }

        itemsToSave.forEach(item => {
            const key = `${String(item.userId)}|${String(item.transactionId)}`;
            const idx = indexByKey.get(key);
            if (idx === undefined) {
                next.push(item);
                indexByKey.set(key, next.length - 1);
            } else {
                next[idx] = { ...next[idx], ...item };
            }
        });

        let finalNext = next;
        if (finalNext.length > 1500) {
            finalNext = finalNext.slice(finalNext.length - 1500);
        }

        chrome.storage.local.set({ jutawanResults: finalNext }, () => {
            isSaving = false;
            const err = chrome.runtime.lastError;
            if (err) {
                console.error("❌ Gagal simpan jutawanResults:", err.message);
                resultSaveQueue.unshift(...itemsToSave);
                setTimeout(() => processSaveQueue(), 1000);
                return;
            }

            // SEGERA PICU BONUS SMB
            itemsToSave.forEach(item => {
                if (bonussmbEnabled && String(item.statusCek || '').toLowerCase() === 'sukses cek') {
                    enqueueBonussmbFill(item);
                } else if (bonussmbEnabled && (item.scatterCount !== null && item.scatterCount > 0)) {
                    enqueueBonussmbStatus(item.userId, item.transactionId, 'Tidak memenuhi syarat', `Scatter: ${item.scatterCount}`);
                }
            });

            // BROADCAST HASIL KE DASHBOARD (Agar instan)
            chrome.runtime.sendMessage({ type: 'RESULTS_PUSH', results: finalNext }).catch(() => { });

            if (resultSaveQueue.length > 0) processSaveQueue();
        });
    });
}

// ----------------- BONUSSMB STATUS TRACKING -----------------

function enqueueBonussmbStatus(userId, transactionId, status, detail) {
    chrome.storage.local.get(["jutawanResults"], (res) => {
        const results = Array.isArray(res.jutawanResults) ? res.jutawanResults : [];
        const item = results.find(r => String(r?.userId) === String(userId) && String(r?.transactionId) === String(transactionId));

        bonusStatusQueue.push({
            userId,
            transactionId,
            status: String(status || ''),
            detail: String(detail || ''),
            debetValue: item ? item.debetValue : null,
            scatterTitle: item ? item.scatterTitle : null
        });
        processBonussmbStatusQueue();
    });
}

function processBonussmbStatusQueue() {
    if (isBonusStatusSaving || bonusStatusQueue.length === 0) return;
    isBonusStatusSaving = true;
    const items = [...bonusStatusQueue];
    bonusStatusQueue = [];

    chrome.storage.local.get(["jutawanResults"], (res) => {
        const data = Array.isArray(res.jutawanResults) ? res.jutawanResults : [];
        const indexByKey = new Map();
        for (let i = 0; i < data.length; i++) {
            const r = data[i] && typeof data[i] === 'object' ? data[i] : {};
            const key = `${String(r.userId)}|${String(r.transactionId)}`;
            if (!indexByKey.has(key)) indexByKey.set(key, i);
        }

        const pending = [];
        const next = data.map((row) => (row && typeof row === 'object' ? row : {}));

        for (const it of items) {
            const key = `${String(it.userId)}|${String(it.transactionId)}`;
            const idx = indexByKey.get(key);
            if (typeof idx !== 'number') {
                pending.push(it);
                continue;
            }
            const r = next[idx] && typeof next[idx] === 'object' ? next[idx] : {};
            next[idx] = { ...r, bonussmbStatus: it.status, bonussmbDetail: it.detail };
        }

        chrome.storage.local.set({ jutawanResults: next }, () => {
            isBonusStatusSaving = false;
            // BROADCAST HASIL KE DASHBOARD
            chrome.runtime.sendMessage({ type: 'RESULTS_PUSH', results: next }).catch(() => { });

            // SINKRONISASI UPDATE KE GOOGLE SHEETS
            items.forEach(item => {
                let statusToSync = item.status;
                // Jika error adalah limit, kirimkan teks cantiknya ke Sheets
                if (statusToSync === 'Gagal input' && String(item.detail).includes('claim 2x')) {
                    statusToSync = 'User ini sudah claim 2x';
                }
                syncBonusUpdateToSheets(item.userId, item.transactionId, statusToSync, item.debetValue, item.scatterTitle);
            });

            const err = chrome.runtime.lastError;
            if (err) {
                console.error('[SMJ] Gagal menyimpan status BONUSSMB:', err.message);
                bonusStatusQueue.unshift(...items);
                setTimeout(() => processBonussmbStatusQueue(), 900);
                return;
            }

            if (pending.length > 0) {
                bonusStatusQueue.unshift(...pending);
                setTimeout(() => processBonussmbStatusQueue(), 700);
            }

            if (bonusStatusQueue.length > 0) processBonussmbStatusQueue();
        });
    });
}


// ----------------- MANAJEMEN ANTRIAN -----------------

const googleSyncQueue = [];
let isGoogleSyncing = false;

async function syncBonusUpdateToSheets(userId, transactionId, status, debetValue, scatterTitle) {
    const txIdStr = String(transactionId).trim();
    const statusStr = String(status || '').trim();
    const statusUpper = statusStr.toUpperCase();
    const isFinalStatus = ['APPROVED', 'REJECTED', 'FAILED', 'MANUAL'].includes(statusUpper) || statusStr.includes('claim 2x');

    // ⚡ INSTANT DISPATCH UNTUK STATUS FINAL (APPROVED, REJECTED, DLL)
    if (isFinalStatus) {
        // Hapus update lama untuk tiket ini dari antrean karena status sudah final
        for (let i = googleSyncQueue.length - 1; i >= 0; i--) {
            if (String(googleSyncQueue[i].transactionId).trim() === txIdStr) {
                googleSyncQueue.splice(i, 1);
            }
        }

        // Kirim LANGSUNG seketika tanpa menunggu antrean
        chrome.storage.local.get(["sheetApiUrl"], async (res) => {
            let apiUrl = res.sheetApiUrl ? res.sheetApiUrl.trim() : "";
            if (!apiUrl || !apiUrl.startsWith("http")) return;

            const payload = {
                "action": "bonus_update",
                "userId": userId,
                "transactionId": txIdStr,
                "status": statusStr,
                "debetValue": debetValue || "",
                "scatterTitle": scatterTitle || ""
            };

            try {
                const queryParams = new URLSearchParams(payload).toString();
                const finalUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${queryParams}`;
                console.log(`⚡ [INSTANT SYNC] Mengirim ${statusStr} (${userId}/${txIdStr}) langsung ke Sheets...`);
                await fetch(finalUrl, { method: "GET", mode: "no-cors", cache: "no-cache" });
                console.log(`✅ [INSTANT SYNC] Berhasil terkirim ke Sheets: ${statusStr} (${userId})`);
            } catch (e) {
                console.error("❌ Gagal instant sync bonus update:", e);
            }
        });
        return;
    }

    // Untuk status bertahap (Sedang input / Sudah input):
    // Cek jika sudah ada antrean untuk tiket ini, cukup perbarui statusnya agar tidak menumpuk
    const existingIdx = googleSyncQueue.findIndex(item => String(item.transactionId).trim() === txIdStr);
    if (existingIdx >= 0) {
        googleSyncQueue[existingIdx].status = statusStr;
    } else {
        googleSyncQueue.push({ userId, transactionId: txIdStr, status: statusStr, debetValue, scatterTitle });
    }

    processGoogleSyncQueue();
}

async function processGoogleSyncQueue() {
    if (isGoogleSyncing || googleSyncQueue.length === 0) return;
    isGoogleSyncing = true;

    while (googleSyncQueue.length > 0) {
        const item = googleSyncQueue.shift();

        await new Promise(resolve => {
            chrome.storage.local.get(["sheetApiUrl"], async (res) => {
                let apiUrl = res.sheetApiUrl ? res.sheetApiUrl.trim() : "";
                if (!apiUrl || !apiUrl.startsWith("http")) {
                    resolve();
                    return;
                }

                const payload = {
                    "action": "bonus_update",
                    "userId": item.userId,
                    "transactionId": item.transactionId,
                    "status": item.status,
                    "debetValue": item.debetValue || "",
                    "scatterTitle": item.scatterTitle || ""
                };

                try {
                    const queryParams = new URLSearchParams(payload).toString();
                    const finalUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${queryParams}`;
                    await fetch(finalUrl, { method: "GET", mode: "no-cors", cache: "no-cache" });
                } catch (e) {
                    console.error("❌ Gagal sync bonus update:", e);
                }

                // Jeda minimum (150ms) agar pengiriman lebih gesit
                setTimeout(resolve, 150);
            });
        });
    }

    isGoogleSyncing = false;
}

const activeSyncTickets = new Set();
const activeTxMeta = new Map();

/**
 * Sinkronisasi data awal ke Google Sheets (DILENGKAPI RETRY OTOMATIS & ANTI DATA HILANG).
 */
async function syncToGoogleSheets(result) {
    if (!result.transactionId) return;
    const txIdStr = String(result.transactionId).trim();

    // Cegah pemanggilan paralel ganda dalam rentang waktu singkat (15 detik)
    if (activeSyncTickets.has(txIdStr)) {
        console.log("⏳ [SMJ] Sync sedang berlangsung untuk tiket:", txIdStr);
        return;
    }
    activeSyncTickets.add(txIdStr);
    // Hapus kunci setelah 15 detik agar bisa disinkronkan ulang jika diperlukan
    setTimeout(() => activeSyncTickets.delete(txIdStr), 15000);

    chrome.storage.local.get(["sheetApiUrl"], async (res) => {
        let apiUrl = res.sheetApiUrl ? res.sheetApiUrl.trim() : "";
        if (!apiUrl || !apiUrl.startsWith("http")) {
            chrome.storage.local.set({ lastSyncStatus: "⚠️ URL Sheets tidak valid" });
            return;
        }

        // Siapkan data dengan kunci yang persis dengan header di spreadsheet
        const payload = {
            "action": "insert",
            "USER ID": result.userId,
            "KODE TIKET": result.transactionId,
            "LINK LIVECHAT": result.livechatUrl || "",
            "LINK BUKTI SCREENSHOT": result.screenshotUrl || "",
            "nominal scatter": result.debetValue,
            "JUMLAH SCAT": result.scatterTitle,
            "bonussmbStatus": result.bonussmbStatus || "Pending input"
        };

        const queryParams = new URLSearchParams(payload).toString();
        const finalUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${queryParams}`;

        // 🔄 RETRY OTOMATIS HINGGA 3 KALI
        let isSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`📡 [SHEETS SYNC] Mengirim ${result.userId}/${txIdStr} (Percobaan ${attempt})...`);
                
                const fetchPromise = fetch(finalUrl, { method: "GET", cache: "no-cache" });
                // Timeout 12 detik per request
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000));
                const response = await Promise.race([fetchPromise, timeoutPromise]);

                const text = await response.text();
                if (text.includes("success") || text.includes("already_exists") || text.includes("updated") || text.includes("OK")) {
                    isSuccess = true;
                    console.log(`✅ [SHEETS SYNC SUCCESS] Sukses masuk ke Sheets: ${result.userId}/${txIdStr}`);
                    chrome.storage.local.set({
                        lastSyncStatus: `✅ Berhasil ke Sheets: ${result.userId} (${new Date().toLocaleTimeString()})`
                    });
                    break;
                } else {
                    console.warn(`⚠️ [SHEETS SYNC] Respons bukan success (Percobaan ${attempt}):`, text);
                }
            } catch (err) {
                console.warn(`⚠️ [SHEETS SYNC GAGAL] (Percobaan ${attempt}):`, err.message);
                // Fallback no-cors
                try {
                    await fetch(finalUrl, { method: "GET", mode: "no-cors", cache: "no-cache" });
                    isSuccess = true;
                    break;
                } catch (e2) {}
            }

            // Jeda antar retry
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }

        if (!isSuccess) {
            chrome.storage.local.set({
                lastSyncStatus: `❌ Gagal Kirim: ${result.userId} (${txIdStr})`
            });
        }
    });
}

/**
 * Menyimpan hasil (lokal dan ke spreadsheet) dan memicu proses berikutnya.
 */
function saveResult(result, tabIdToClose, isKeepAlive = false) {
    if (!isKeepAlive) {
        // Ambil metadata tambahan (Link Livechat & Screenshot) dari antrean aktif
        const meta = activeTxMeta.get(String(result.transactionId)) || {};
        const livechatUrl = result.livechatUrl || meta.livechatUrl || "";
        const screenshotUrl = result.screenshotUrl || meta.screenshotUrl || "";

        // Hitung statusCek dan scatterCount secara akurat
        const scatterCount = deriveScatterCount(result);
        const statusCek = deriveStatusCek(result);

        const finalResult = {
            ...result,
            livechatUrl,
            screenshotUrl,
            // Jika deriveScatterCount berhasil mendapatkan angka (3,4,5), kita gunakan itu.
            // Jangan gunakan result.scatterCount jika nilainya 0 padahal judulnya 3.
            scatterCount: (scatterCount !== null ? scatterCount : (result.scatterCount || 0)),
            statusCek,
            bonussmbStatus: statusCek === 'Sukses cek' ? 'Pending input' : '',
        };

        if (result.transactionId) {
            activeTxMeta.delete(String(result.transactionId));
        }

        resultSaveQueue.push(finalResult);
        processSaveQueue();

        console.log("🎯 [DEBUG] Hasil Akhir Simpan:", {
            userId: finalResult.userId,
            statusCek: finalResult.statusCek,
            scatterCount: finalResult.scatterCount,
            bonussmbStatus: finalResult.bonussmbStatus
        });

        console.log("✅ Data diantrekan untuk simpan:", finalResult);
        // Sinkronisasi ke Google Sheets secara otomatis (async)
        syncToGoogleSheets(finalResult);

    } else {
        console.log("🎣 Pancingan Selesai. Token seharusnya sudah terupdate.");
    }

    if (tabIdToClose) {
        safeRemoveTab(tabIdToClose);
    }

    // PENTING: Hanya mulai proses berikutnya jika BUKAN pancingan
    if (!isKeepAlive) {
        activeBatchCount--;
        if (activeBatchCount < 0) activeBatchCount = 0;

        console.log(`📦 Batch Progress: ${activeBatchCount} transaksi tersisa dalam batch.`);

        // LANJUT KE BATCH BERIKUTNYA (TANPA JEDA LAMA)
        if (activeBatchCount === 0) {
            console.log("🏁 Batch selesai. Memulai batch berikutnya...");
            setTimeout(() => {
                startNextProcess();
            }, 100);
        }
    }
}

/**
 * Membuka halaman utama transaksi untuk sebuah item.
 */
function openMainPageForProcess(userId, transactionId, token, adminUrl, retryCount = 0) { // adminUrl & retryCount DITAMBAHKAN
    let cleanAdmin = String(adminUrl || "").trim();
    if (cleanAdmin && !cleanAdmin.startsWith("http://") && !cleanAdmin.startsWith("https://")) {
        cleanAdmin = "https://" + cleanAdmin;
    }
    const targetUrl = `${cleanAdmin.replace(/\/$/, "")}/transaction-record.html`;
    chrome.tabs.create(
        {
            url: targetUrl, // Menggunakan URL dinamis
            active: false // Dibuka di latar belakang
        },
        (tab) => {
            if (!tab || !tab.id) {
                console.error("Gagal membuka halaman utama.");
                // Catat error dan coba item berikutnya
                saveResult({
                    userId,
                    transactionId,
                    debetValue: "N/A",
                    scatterTitle: "Error: Gagal membuka tab utama"
                }, null);
                return;
            }

            const mainTabId = tab.id; // SIMPAN ID TAB UTAMA DI SINI

            // Tunggu sampai halaman loaded, lalu kirim pesan ke content.js
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === mainTabId && info.status === "complete") { // Gunakan mainTabId di sini
                    chrome.tabs.sendMessage(mainTabId, {
                        action: "startProcess",
                        userId: userId,
                        transactionId: transactionId,
                        token: token,
                        retryCount: retryCount, // <<< KIRIM retryCount
                        mainTabId: mainTabId // <<< KIRIM ID TAB UTAMA KE CONTENT.JS
                    });
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        }
    );
}
/**
 * Mengambil item berikutnya dari antrian dan memulai proses.
 */
function startNextProcess() {
    chrome.storage.local.get(["txQueue", "token", "adminUrl"], (res) => {
        let txQueue = res.txQueue || [];
        const token = res.token;
        const adminUrl = res.adminUrl;

        if (isRefreshingToken) {
            console.log("⏳ [QUEUE] Antrean dihentikan sementara (Menunggu Token Pancingan)...");
            return;
        }

        if (pancinganFailed) {
            console.log("🛑 [QUEUE] Antrean dihentikan (Pancingan Gagal): " + pancinganErrorReason);
            return;
        }

        if (txQueue.length === 0) {
            activeBatchCount = 0;
            console.log("📭 Antrean kosong.");
            return;
        }

        // AMBIL MAKSIMAL 2 DATA DARI ANTREAN UNTUK DIPROSES SEKALIGUS
        const maxBatchSize = 2;
        const toProcess = txQueue.splice(0, maxBatchSize);

        // Update antrean yang tersisa di storage
        chrome.storage.local.set({ txQueue: txQueue }, () => {
            activeBatchCount = toProcess.length;
            console.log(`🚀 Memulai BATCH baru dengan ${activeBatchCount} transaksi.`);

            toProcess.forEach((item, index) => {
                // Simpan metadata (Livechat & Screenshot) di memory background
                activeTxMeta.set(String(item.transactionId), {
                    livechatUrl: item.livechatUrl || "",
                    screenshotUrl: item.screenshotUrl || ""
                });

                // Beri sedikit delay antar pembukaan tab agar tidak tabrakan (misal 1 detik)
                setTimeout(() => {
                    console.log(`📑 Memproses Item [${index + 1}/${activeBatchCount}]: ${item.userId}/${item.transactionId}`);
                    openMainPageForProcess(item.userId, item.transactionId, token, adminUrl, item.retryCount || 0);
                }, index * 1500);
            });
        });
    });
}

/**
 * Memunculkan notifikasi desktop
 */
function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564619.png', // Icon peringatan generic
        title: title,
        message: message,
        priority: 2
    });
}

/**
 * Script untuk mengecek apakah halaman detail menunjukkan token expired
 */
const scriptToCheckTokenValidity = () => {
    const bodyText = document.body.textContent || "";
    // Daftar kata kunci yang biasanya muncul saat token salah atau sesi habis
    const errorKeywords = ["Unauthorized", "Expired", "login", "invalid token", "Session Timeout"];
    const isError = errorKeywords.some(keyword => bodyText.includes(keyword)) ||
        document.title.toLowerCase().includes("error");

    // Jika elemen utama game tidak ada sama sekali setelah loading, anggap token bermasalah
    const roundTitleEl = document.querySelector(".result-detail-item.round-title");
    if (!roundTitleEl && isError) return false;

    return true; // Token dianggap masih valid
};

// ----------------- FUNGSI SKRIP INJEKSI -----------------

const scriptToGetRoundCount = () => {
    const roundTitleEl = document.querySelector(".result-detail-item.round-title");

    if (!roundTitleEl) {
        return { totalRounds: 1, currentRound: 1 };
    }

    const text = roundTitleEl.textContent.trim();
    const match = text.match(/\/(\d+)/);
    const totalRounds = match ? parseInt(match[1], 10) : 1;

    const currentMatch = text.match(/Round (\d+)/);
    const currentRound = currentMatch ? parseInt(currentMatch[1], 10) : 1;

    return {
        totalRounds: totalRounds,
        currentRound: currentRound
    };
};

const scriptToVerifyInitialTxId = (transactionId) => {
    const headerEls = document.querySelectorAll(".header-item-value");
    let currentTx = "";
    headerEls.forEach((el) => {
        if (el.textContent.trim().length >= 19) {
            currentTx = el.textContent.trim().slice(0, 19);
        }
    });
    return currentTx === transactionId.slice(0, 19);
};

const scriptToClickNext = (selector) => {
    const nextBtn = document.querySelector(selector);
    if (nextBtn) nextBtn.click();
    return nextBtn ? true : false;
};

const scriptToGetRoundResults = (transactionId, userId, debetValue) => {

    const scatterEl = document.querySelector(".sprite-symbol.payout_scatter");
    if (!scatterEl) {
        return { status: "notFound" };
    }

    const payoutContainer = scatterEl.closest('.payout-item-container');
    let scatterTitle = "Ditemukan (Gagal ambil jumlah)";

    if (payoutContainer) {
        const payoutTitleEl = payoutContainer.querySelector(".payout-item-label .payout-item-title");

        if (payoutTitleEl) {
            scatterTitle = payoutTitleEl.textContent.trim();

            // LOGIKA MODIFIKASI: Hapus karakter 'x' (case insensitive)
            if (scatterTitle.length > 0) {
                // Menghapus 'x' atau 'X' secara global (g) dan case insensitive (i)
                scatterTitle = scatterTitle.replace(/x/gi, '').trim();
            }

            if (scatterTitle === "") {
                scatterTitle = "Ditemukan (Judul Kosong)";
            }
        } else {
            scatterTitle = "Ditemukan (Judul tidak spesifik)";
        }
    } else {
        scatterTitle = "Scatter Ditemukan (Container tidak dikenal)";
    }

    return {
        status: "foundAndSaved",
        result: { userId, transactionId, debetValue, scatterTitle }
    };
};

// ----------------- FUNGSI KONTROL ASINKRON -----------------

const executeFinalScatterCheck = (tabId, transactionId, userId, debetValue, isKeepAlive = false) => {
    console.log("🎯 Round terakhir tercapai. Menjalankan cek Scatter.");

    chrome.scripting.executeScript(
        {
            target: { tabId: tabId },
            func: scriptToGetRoundResults,
            args: [transactionId, userId, debetValue]
        },
        (results) => {
            const resultData = results[0] ? results[0].result : { status: "error" };

            if (resultData.status === "foundAndSaved" && resultData.result) {
                // PENYIMPANAN DATA BERHASIL
                saveResult(resultData.result, tabId, isKeepAlive); // tabId di sini adalah tab detail
            } else {
                console.log("❌ Scatter tidak ditemukan. Menutup tab.");
                // Catat transaksi tidak ditemukan 
                saveResult({
                    userId,
                    transactionId,
                    debetValue,
                    scatterTitle: "Scatter tidak ditemukan"
                }, tabId, isKeepAlive); // tabId di sini adalah tab detail
            }
        }
    );
}

const runNextClickLoop = (tabId, transactionId, userId, debetValue, currentRound, totalRounds, isKeepAlive = false) => {

    if (currentRound >= totalRounds) {
        return executeFinalScatterCheck(tabId, transactionId, userId, debetValue, isKeepAlive);
    }

    console.log(`🔄 Mengklik Next (Iterasi ${currentRound}/${totalRounds - 1})...`);

    chrome.scripting.executeScript(
        {
            target: { tabId: tabId },
            func: scriptToClickNext,
            args: [NEXT_BTN_SELECTOR]
        },
        (clickResult) => {
            const clicked = clickResult[0] ? clickResult[0].result : false;
            if (clicked) {
                const nextRound = currentRound + 1;
                const nextDelay = (nextRound >= totalRounds) ? 3000 : DELAY_TIME;

                setTimeout(() => {
                    runNextClickLoop(tabId, transactionId, userId, debetValue, nextRound, totalRounds, isKeepAlive);
                }, nextDelay);
            } else {
                console.log("🛑 Tombol Next hilang prematur. Menghentikan loop dan cek Scatter.");
                executeFinalScatterCheck(tabId, transactionId, userId, debetValue, isKeepAlive);
            }
        }
    );
};


const startRoundBasedProcess = async (tabId, transactionId, userId, debetValue, retryCount = 0, isKeepAlive = false) => {

    // JIKA INI PANCINGAN, KITA HANYA BUTUH HALAMAN TERBUKA UNTUK HARVEST TOKEN DARI URL
    if (isKeepAlive) {
        console.log("🎣 [PANCINGAN] Tab detail terbuka. Menunggu 8 detik agar token terpanen...");
        await delay(8000);
        console.log("🏁 [PANCINGAN] Selesai. Menutup tab detail secara otomatis.");
        safeRemoveTab(tabId);
        return;
    }

    console.log(`⏳ Menunggu ${INITIAL_LOAD_DELAY / 1000} detik agar konten tab detail termuat...`);
    await delay(INITIAL_LOAD_DELAY);

    // CEK VALIDITAS TOKEN TERLEBIH DAHULU
    chrome.scripting.executeScript(
        {
            target: { tabId: tabId },
            func: scriptToCheckTokenValidity
        },
        async (validityResults) => {
            const isValid = validityResults[0] ? validityResults[0].result : true;

            if (!isValid) {
                console.error("🛑 Token API Expired atau Tidak Valid!");

                // JIKA PANCINGAN GAGAL, TIDAK PERLU RETRY ANTRIAN
                if (isKeepAlive) {
                    console.error("❌ Pancingan Gagal karena Token Expired.");
                    chrome.tabs.remove(tabId);
                    return;
                }

                // BATASI RETRY (MAX 3 KALI) UNTUK TRANSAKSI NORMAL
                const MAX_RETRY = 3;
                if (retryCount < MAX_RETRY) {
                    // JIKA PERCOBAAN PERTAMA GAGAL, MICU PANCINGAN OTOMATIS (SENYAP)
                    if (retryCount === 0 || !isRefreshingToken) {
                        console.log("🔄 [REFRESH] Memicu pancingan otomatis karena token expired...");
                        isRefreshingToken = true;
                        runKeepAliveProcess(true, true); // force=true, silent=true
                    }

                    // MEKANISME DAUR ULANG CERDAS: Kembalikan ke antrean PALING DEPAN (Priority)
                    chrome.storage.local.get(["txQueue"], (res) => {
                        let txQueue = res.txQueue || [];
                        const meta = activeTxMeta.get(String(transactionId)) || {};
                        // Masukkan kembali ke URUTAN PERTAMA agar langsung diproses saat token aktif
                        txQueue.unshift({ 
                            userId, 
                            transactionId, 
                            livechatUrl: meta.livechatUrl || "",
                            screenshotUrl: meta.screenshotUrl || "",
                            retryCount: retryCount + 1 
                        });

                        chrome.storage.local.set({ txQueue: txQueue }, () => {
                            console.log(`♻️ [PRIORITY] Transaksi ${transactionId} dikembalikan ke posisi awal (Retry ke-${retryCount + 1}).`);
                            safeRemoveTab(tabId);

                            activeBatchCount--;
                            if (activeBatchCount < 0) activeBatchCount = 0;

                            // JANGAN panggil startNextProcess segera jika sedang refreshing
                        });
                    });
                } else {
                    // JIKA SUDAH 3 KALI TETAP GAGAL, BERHENTI (Mungkin situs bermasalah)
                    showNotification("Batas Retry Tercapai!", "Situs mungkin sedang bermasalah. Transaksi dicatat sebagai Gagal.");
                    saveResult({
                        userId,
                        transactionId,
                        debetValue: "N/A",
                        scatterTitle: "❌ Gagal: Batas Retry (Masalah Situs)"
                    }, tabId, false);
                }
                return;
            }

            // LANJUTKAN PROSES JIKA VALID
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabId },
                    func: scriptToGetRoundCount
                },
                (results) => {
                    if (chrome.runtime.lastError) {
                        console.error("Kesalahan saat mengambil Round Count:", chrome.runtime.lastError.message);
                        chrome.tabs.remove(tabId);
                        if (!isKeepAlive) startNextProcess();
                        return;
                    }

                    const roundData = results[0] ? results[0].result : { totalRounds: 1, currentRound: 1 };
                    const totalRounds = roundData.totalRounds;
                    const currentRound = roundData.currentRound;

                    // VERIFIKASI ID DENGAN RETRY (3X JEDA 2 DETIK)
                    let verifyAttempt = 0;
                    const maxVerifyAttempt = 3;

                    const doVerify = () => {
                        verifyAttempt++;
                        chrome.scripting.executeScript(
                            {
                                target: { tabId: tabId },
                                func: scriptToVerifyInitialTxId,
                                args: [transactionId]
                            },
                            (idResults) => {
                                if (chrome.runtime.lastError) {
                                    console.error("Kesalahan verifikasi ID:", chrome.runtime.lastError.message);
                                    chrome.tabs.remove(tabId);
                                    if (!isKeepAlive) startNextProcess();
                                    return;
                                }

                                const idMatch = idResults[0] ? idResults[0].result : false;

                                if (idMatch) {
                                    console.log(`✅ ID Transaksi terverifikasi (Attempt ${verifyAttempt}).`);
                                    runNextClickLoop(tabId, transactionId, userId, debetValue, currentRound, totalRounds, isKeepAlive);
                                } else if (verifyAttempt < maxVerifyAttempt) {
                                    console.warn(`⚠️ ID belum ditemukan (Attempt ${verifyAttempt}). Mencoba ulang dalam 2 detik...`);
                                    setTimeout(doVerify, 2000);
                                } else {
                                    console.error("🛑 Gagal verifikasi Transaction ID setelah 3 percobaan. Menutup tab.");
                                    saveResult({
                                        userId,
                                        transactionId,
                                        debetValue,
                                        scatterTitle: "Gagal verifikasi ID di detail"
                                    }, tabId, isKeepAlive);
                                }
                            }
                        );
                    };

                    doVerify();
                }
            );
        }
    );
};


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // ====== 1. Handler Baru: Mulai Proses Batch ======
    if (msg.action === "startBatchProcess") {
        startNextProcess();
        sendResponse({ status: "started" });
        return true;
    }

    // ====== 2. Buka tab link detail ======
    if (msg.action === "openLink") {
        if (msg.isKeepAlive) {
            chrome.storage.local.set({ pancinganTabOpening: true });
        }
        chrome.tabs.create({ url: msg.url, active: false }, (tab) => {
            if (tab && tab.id) {
                // DAFTARKAN ID TAB PANCINGAN
                if (msg.isKeepAlive) {
                    pancinganTabIds.add(tab.id);
                }

                sendResponse({ tabId: tab.id });
                // Safety: Tutup paksa jika pancingan macet
                if (msg.isKeepAlive) {
                    setTimeout(() => {
                        chrome.tabs.get(tab.id, (t) => {
                            if (t) chrome.tabs.remove(t.id, () => {
                                if (chrome.runtime.lastError) { /* Tab sudah tertutup, abaikan */ }
                            });
                        });
                    }, 10000); // Safety closer dikurangi ke 10 detik
                }
            } else {
                sendResponse({ error: "Tab tidak dapat dibuat" });
            }
        });
        return true;
    }

    // ====== 3. Tutup tab diri sendiri (dari content.js) ======
    if (msg.action === "closeTabSelf") {
        if (sender.tab && sender.tab.id) {
            safeRemoveTab(sender.tab.id);
        }
        sendResponse({ status: "closed" });
        return true;
    }

    // ====== 4. Eksekusi Script di Tab Detail (Titik Awal Proses Loop) ======
    if (msg.action === "executeScriptInTab") {
        const { tabId, transactionId, userId, debetValue, retryCount, isKeepAlive } = msg;
        startRoundBasedProcess(tabId, transactionId, userId, debetValue, retryCount || 0, isKeepAlive || false);
        sendResponse({ status: "processStarted" });
        return true;
    }

    // ====== 5. Handler Error dari content.js ======
    if (msg.action === "processError") {
        const errorText = String(msg.error || 'Unknown error');
        const isPancinganError = (msg.isKeepAlive === true || msg.isKeepAlive === 'true');
        console.error(`Error pada ${msg.userId}/${msg.transactionId}: ${errorText} (Pancingan: ${isPancinganError})`);

        if (isPancinganError) {
            // === PANCINGAN GAGAL: Hentikan antrean dan beri notifikasi ===
            handlePancinganFailure(errorText);
            // Tutup tab pengirim
            if (sender.tab && sender.tab.id) {
                safeRemoveTab(sender.tab.id);
            }
        } else {
            saveResult({
                userId: msg.userId,
                transactionId: msg.transactionId,
                debetValue: "N/A",
                scatterTitle: `Error: ${errorText}`
            }, sender.tab ? sender.tab.id : null, false);
        }
        return true;
    }

    // ====== 6. Handler BARU: Keep-Alive (Pancingan Token) ======
    if (msg.action === "updateKeepAlive") {
        manageKeepAlive(msg.enabled);
        sendResponse({ status: "keepAliveUpdated" });
        return true;
    }

    // ====== 7. Sinyal Token Sukses Harvested dari content.js ======
    if (msg.action === "TOKEN_HARVESTED") {
        console.log("🎯 [PANCINGAN] Sinyal TOKEN_HARVESTED diterima.");

        // --- UPDATE TOKEN DI STORAGE (UNTUK DASHBOARD) ---
        if (msg.token) {
            const now = Date.now();
            chrome.storage.local.set({
                token: msg.token,
                lastTokenUpdate: now, // Simpan waktu update terakhir
                pancinganStatus: "active"
            });

            // RESET FAILURE STATE PADA SUKSES
            pancinganFailed = false;
            pancinganErrorReason = '';

            // LANJUTKAN ANTREAN SECARA OTOMATIS
            if (isRefreshingToken) {
                console.log("🔓 [RESUME] Token baru diterima. Melanjutkan antrean sekarang...");
                isRefreshingToken = false;
                pancinganInProgress = false; // Buka kunci pancingan
                setTimeout(() => {
                    startNextProcess();
                }, 500); // Beri jeda sedikit agar storage stabil
            }
        }

        if (sender.tab && sender.tab.id && pancinganTabIds.has(sender.tab.id)) {
            console.log("🏁 Menutup tab pancingan sesuai daftar ID.");
            safeRemoveTab(sender.tab.id);
            pancinganTabIds.delete(sender.tab.id);
        }
        return true;
    }

    // Handler Tutup Tab Umum
    if (msg.action === "closeTab") {
        if (msg.tabId) {
            safeRemoveTab(msg.tabId);
        }
        sendResponse({ status: "closed" });
        return true;
    }

    // ====== 8. BONUSSMB: Retry Manual dari Dashboard ======
    if (msg.action === "retryBonussmbInput") {
        const userId = String(msg.userId || '').trim();
        const transactionId = String(msg.transactionId || '').trim();
        if (!userId || !transactionId) {
            sendResponse({ ok: false, error: 'userId/transactionId missing' });
            return false;
        }

        chrome.storage.local.get(['jutawanResults', 'txQueue'], (res) => {
            const rows = Array.isArray(res.jutawanResults) ? res.jutawanResults : [];
            const idx = rows.findIndex((r) => String(r?.userId || '') === userId && String(r?.transactionId || '') === transactionId);
            if (idx === -1) {
                enqueueBonussmbStatus(userId, transactionId, 'Gagal input', 'Data hasil tidak ditemukan');
                sendResponse({ ok: false, error: 'result_not_found' });
                return;
            }

            const found = rows[idx];
            const b = String(found?.bonussmbStatus || '').trim();
            if (b === 'Sudah input' || b === 'Ticket sudah ada' || b === 'APPROVED') {
                sendResponse({ ok: false, error: 'bonussmb_already_done' });
                return;
            }

            const statusCek = deriveStatusCek(found);
            if (statusCek === 'Sukses cek') {
                // JALUR 1: Scatter sudah sukses terdeteksi (>=3), ulangi submit ke bonussmb.com saja
                enqueueBonussmbStatus(userId, transactionId, 'Mengulang...', '');
                enqueueBonussmbFill({ ...found, bonussmbStatus: 'Mengulang...' });
                sendResponse({ ok: true, mode: 'fill_bonussmb' });
            } else {
                // JALUR 2: Gagal sebelum bonussmb (scatter tidak ditemukan, data tidak ditemukan, error cek)
                // Kembalikan ke antrean utama untuk dicek ulang di portal admin
                let txQueue = Array.isArray(res.txQueue) ? res.txQueue : [];

                // Filter keluar agar tidak duplikat jika ID sudah ada di antrean
                txQueue = txQueue.filter(t => String(t.transactionId).trim() !== transactionId);

                // Sisipkan di posisi paling awal (Priority Retry)
                txQueue.unshift({
                    userId: found.userId,
                    transactionId: found.transactionId,
                    livechatUrl: found.livechatUrl || '',
                    screenshotUrl: found.screenshotUrl || '',
                    retryCount: 0
                });

                // Perbarui tampilan status di baris tabel agar user langsung tahu sedang dicek ulang
                rows[idx] = {
                    ...found,
                    scatterTitle: '🔄 Mengulang pengecekan...',
                    statusCek: '',
                    bonussmbStatus: 'Mengulang cek...',
                    bonussmbDetail: 'Mengulang cek di portal admin'
                };

                chrome.storage.local.set({ txQueue, jutawanResults: rows }, () => {
                    console.log(`♻️ [MANUAL RETRY RE-CHECK] Transaksi ${transactionId} dikembalikan ke antrean utama.`);
                    startNextProcess();
                    sendResponse({ ok: true, mode: 'recheck_admin' });
                });
            }
        });

        return true;
    }


    // ====== 9. BONUSSMB HISTORY: Status Update dari Content Script ======
    if (msg.type === 'BONUSSMB_HISTORY_UPDATE') {
        handleHistoryStatusUpdate(msg.results || []);
        return true;
    }

    // ====== 10. BONUSSMB HISTORY: Close Signal dari Content Script ======
    if (msg.type === 'BONUSSMB_HISTORY_CLOSE') {
        console.log('📡 [MONITOR] Close signal diterima dari content script. Menutup tab history...');
        closeHistoryMonitorTab();
        return true;
    }
});

// ====== PROTEKSI ANTI POP-UP (Mencegat Jendela Baru Pancingan) ======
chrome.tabs.onCreated.addListener((tab) => {
    chrome.storage.local.get(["pancinganTabOpening"], (res) => {
        if (res.pancinganTabOpening === true) {
            // --- DAFTARKAN TAB INI UNTUK PENUTUPAN OTOMATIS ---
            pancinganTabIds.add(tab.id);
            console.log("🛡️ [GUARD] Mendeteksi tab baru (ID: " + tab.id + ") selama pancingan. Terdaftar.");

            // Reset tanda pembukaan setelah 5 detik agar tidak memengaruhi tab lain ke depannya
            setTimeout(() => {
                chrome.storage.local.set({ pancinganTabOpening: false });
            }, 5000);

            const targetUrl = tab.url || tab.pendingUrl || "";
            if (targetUrl.includes("/history/")) {
                console.log("🛡️ [GUARD] Memastikan tab detail tetap di latar belakang...");
                chrome.tabs.update(tab.id, { active: false });

                // Tutup otomatis tab ini setelah 20 detik jika macet
                setTimeout(() => {
                    chrome.tabs.get(tab.id, (exist) => { if (exist) safeRemoveTab(tab.id); });
                }, 20000);
            }
        }
    });
});

// ----------------- FITUR PANCINGAN TOKEN (KEEP-ALIVE) -----------------
// Menggunakan chrome.alarms (Persisten di MV3) daripada setInterval

function manageKeepAlive(enabled) {
    if (!enabled) {
        chrome.alarms.clear("pancinganAlarm");
        console.log("⏹️ Alarm Pancingan Token DIMATI-KAN.");
    } else {
        console.log("▶️ Alarm Pancingan Token DIAKTIF-KAN (Setiap 10 Menit).");
        // Reset status error jika user mengaktifkan kembali
        pancinganFailed = false;
        pancinganErrorReason = '';
        chrome.storage.local.set({ pancinganStatus: "active" });

        // Gunakan alarm agar persisten meski Service Worker mati/bangun
        chrome.alarms.create("pancinganAlarm", { periodInMinutes: 10 });
        // Jalankan sekali saat diaktifkan manual (bukan inisialisasi SW)
        runKeepAliveProcess(true);
    }
}

function handlePancinganFailure(reason) {
    pancinganFailed = true;
    pancinganErrorReason = reason;
    isRefreshingToken = false; // Hentikan status refreshing tapi biarkan pancinganFailed yang pegang kendali queue
    pancinganInProgress = false;

    console.error("🛑 [PANCINGAN] GAGAL: " + reason);

    // Kirim notifikasi desktop agar user sadar
    showNotification(
        "Pancingan Gagal!",
        `Penyebab: ${reason}. Antrean transaksi dihentikan sementara.`
    );

    // Update status di storage agar dashboard bisa menampilkan error
    chrome.storage.local.set({
        pancinganStatus: "error",
        pancinganError: reason
    });
}

// Handler untuk Alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "pancinganAlarm") {
        console.log("⏰ Alarm pancingan berbunyi...");
        runKeepAliveProcess();
    }
    if (alarm.name === BONUSSMB_AUTO_ALARM) {
        console.log("⏰ Alarm BonusSMB Auto Check berbunyi...");
        processPendingBonussmbInputs();
    }
    if (alarm.name === BONUSSMB_HISTORY_ALARM) {
        console.log('📡 [MONITOR] Alarm history check...');
        cleanupStaleMonitorTickets();
        chrome.storage.local.get(['bonussmbMonitorTickets'], (res) => {
            const tickets = Array.isArray(res.bonussmbMonitorTickets) ? res.bonussmbMonitorTickets : [];
            if (tickets.length > 0) {
                ensureHistoryMonitorTab();
            }
        });
    }
});

function runKeepAliveProcess(force = false, silent = false) {
    if (pancinganInProgress && force) {
        console.log("🛡️ [LOCK] Pancingan sudah berjalan. Mengabaikan pemicu ganda.");
        return;
    }

    const now = Date.now();

    chrome.storage.local.get(["keepAliveUserId", "keepAliveTicketId", "adminUrl", "token", "autoKeepAlive", "lastTokenUpdate"], (res) => {
        if (!res.autoKeepAlive && !force) return;

        // SMART SCHEDULER: Jangan jalan jika token baru saja di-update (kurang dari 9 menit)
        const lastUpdate = res.lastTokenUpdate || 0;
        if (!force && (now - lastUpdate < 9 * 60 * 1000)) {
            console.log("⏭️ [SMART] Antrean dilewati karena token masih segar (" + Math.round((now - lastUpdate) / 60000) + " mnt lalu).");
            return;
        }

        const userId = res.keepAliveUserId;
        const ticketId = res.keepAliveTicketId;
        const adminUrl = res.adminUrl;
        const token = res.token;

        if (!userId || !ticketId || !adminUrl) {
            console.warn("⚠️ Data Pancingan tidak lengkap.");
            return;
        }

        console.log(`🎣 [${new Date().toLocaleTimeString()}] Memulai Pancingan Token: ${userId}/${ticketId}`);
        pancinganInProgress = true; // Kunci pancingan aktif

        // RESET FAILURE STATE SAAT START (Mungkin baru saja diperbaiki user)
        pancinganFailed = false;
        pancinganErrorReason = '';
        chrome.storage.local.set({ pancinganStatus: "refreshing", pancinganError: '' });

        if (!silent) {
            showNotification("Pancingan Berjalan", `Sedang mengambil token baru menggunakan ID: ${userId}`);
        }

        const targetUrl = `${adminUrl.replace(/\/$/, "")}/transaction-record.html`;

        chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
            if (!tab || !tab.id) return;
            const mainTabId = tab.id;

            // SAFETY: Tutup tab setelah 2 menit (120 detik) jika benar-benar stuck/situs tidak merespons
            setTimeout(() => {
                pancinganInProgress = false; // Reset lock jika stuck
                chrome.tabs.get(mainTabId, (existTab) => {
                    if (existTab) {
                        console.log("🛑 Tab pancingan mencapai batas maksimal waktu (120 detik). Menutup paksa.");
                        chrome.tabs.remove(mainTabId);
                    }
                });
            }, 120000);

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === mainTabId && info.status === "complete") {
                    const msgObject = {
                        action: "startProcess",
                        userId: userId,
                        transactionId: ticketId,
                        token: token,
                        retryCount: 0,
                        mainTabId: mainTabId,
                        isKeepAlive: true
                    };
                    chrome.tabs.sendMessage(mainTabId, msgObject);
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        });
    });
}

// Inisialisasi saat Service Worker bangun (Wake Up)
chrome.storage.local.get(["autoKeepAlive", "bonussmbAutoEnabled"], (res) => {
    // 1. Pancingan Alarm
    if (res.autoKeepAlive) {
        chrome.alarms.get("pancinganAlarm", (alarm) => {
            if (!alarm) {
                chrome.alarms.create("pancinganAlarm", { periodInMinutes: 10 });
            }
        });
    }

    // 2. BonusSMB Auto Alarm (Selalu aktifkan jika fitur ON)
    if (res.bonussmbAutoEnabled !== false) {
        chrome.alarms.get(BONUSSMB_AUTO_ALARM, (alarm) => {
            if (!alarm) {
                chrome.alarms.create(BONUSSMB_AUTO_ALARM, { periodInMinutes: 1 });
                console.log("🚀 [INIT] BonusSMB Auto Alarm Terdaftar (1 mnt).");
            }
        });
    }
});

// --- DETEKSI TOKEN BARU: TUTUP SEMUA TAB PANCINGAN AKTIF & RESUME ---
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.token) {
        if (pancinganTabIds.size > 0) {
            console.log(`💎 [PANCINGAN] Token terdeteksi. Menyapu bersih ${pancinganTabIds.size} tab pancingan.`);
            pancinganTabIds.forEach(id => {
                safeRemoveTab(id);
            });
            pancinganTabIds.clear();
        }
        
        if (typeof isRefreshingToken !== 'undefined' && isRefreshingToken) {
            console.log("🔓 [RESUME] Token baru diupdate. Melanjutkan antrean...");
            isRefreshingToken = false;
            pancinganInProgress = false;
            pancinganFailed = false;
            pancinganErrorReason = '';
            setTimeout(() => {
                if (typeof startNextProcess === 'function') startNextProcess();
            }, 500);
        }
    }
});

// --- DETEKSI TAB MONITOR DITUTUP MANUAL ---
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === historyMonitorTabId) {
        console.log('📡 [MONITOR] History tab ditutup manual. Alarm fallback akan membuka ulang jika perlu.');
        historyMonitorTabId = null;
    }
});

// --- RESTORE MONITOR TAB ID SAAT STARTUP ---
chrome.storage.local.get(['bonussmbMonitorTabId', 'bonussmbMonitorTickets'], (res) => {
    const tickets = Array.isArray(res.bonussmbMonitorTickets) ? res.bonussmbMonitorTickets : [];
    if (tickets.length > 0) {
        if (res.bonussmbMonitorTabId) {
            chrome.tabs.get(res.bonussmbMonitorTabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    historyMonitorTabId = null;
                    ensureHistoryAlarm();
                } else {
                    historyMonitorTabId = tab.id;
                }
            });
        } else {
            ensureHistoryAlarm();
        }
    }
});

// --- INITIALIZATION ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("🚀 [SYSTEM] Extension Installed/Updated.");
    initAutoBackground();
    // updateAuthHeaderRules() sudah dipanggil di initAutoBackground
});

chrome.runtime.onStartup.addListener(() => {
    console.log("🔌 [SYSTEM] Browser Started.");
    initAutoBackground();
});

// Listener untuk perubahan storage (sinkronisasi adminUrl atau manual headers)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.agentHeaders || changes.adminUrl) {
            console.log("♻️ [AUTH] Storage changed, updating header rules...");
            updateAuthHeaderRules();
        }
    }
});
