// dashboard.js

let latestResults = [];

// Inisialisasi Data dari Storage
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(["jutawanResults", "token", "adminUrl", "sheetApiUrl", "txDataRaw", "lastTokenUpdate", "agentHeaders"], (res) => {
        if (res.jutawanResults) renderTable(res.jutawanResults);
        if (res.token) document.getElementById("token").value = res.token;
        if (res.adminUrl) document.getElementById("adminUrl").value = res.adminUrl;
        if (res.sheetApiUrl) {
            document.getElementById("sheetApiUrl").value = res.sheetApiUrl;
            updateSyncIndicator(true);
        }
        if (res.txDataRaw) document.getElementById("txData").value = res.txDataRaw;
        
        // Inisialisasi riwayat awal Undo/Redo untuk Data Antrean Transaksi
        const initialTxVal = document.getElementById("txData").value || "";
        pushTxHistory(initialTxVal, initialTxVal.length);
        
        // Update waktu terakhir
        if (res.lastTokenUpdate) {
            updateLastTokenTimeUI(res.lastTokenUpdate);
        }

        // Update Status Header
        updateHeaderStatusUI(res.agentHeaders);

        // Update Pancingan Status
        updatePancinganStatusUI(res.pancinganStatus, res.pancinganError);
    });
});

// Update Indikator Sync
function updateSyncIndicator(active, text = "Sheets Sync: Ready") {
    const indicator = document.getElementById("syncIndicator");
    const syncText = document.getElementById("syncText");
    if (active) {
        indicator.classList.add("active");
        syncText.textContent = text;
    } else {
        indicator.classList.remove("active");
        syncText.textContent = "Sheets Sync: Off";
    }
}

// Handler Tombol Start
document.getElementById("startBtn").addEventListener("click", async () => {
    let adminUrl = document.getElementById("adminUrl").value.trim();
    if (adminUrl && !adminUrl.startsWith("http://") && !adminUrl.startsWith("https://")) {
        adminUrl = "https://" + adminUrl;
        document.getElementById("adminUrl").value = adminUrl;
    }
    const sheetApiUrl = document.getElementById("sheetApiUrl").value.trim();
    const txDataRaw = document.getElementById("txData").value.trim();
    const token = document.getElementById("token").value.trim();
    const statusMsg = document.getElementById("statusMessage");

    if (!txDataRaw || !adminUrl) {
        statusMsg.style.color = "#ff4466";
        statusMsg.textContent = "⚠️ Data tidak lengkap! (Data Antrean dan URL Admin wajib diisi)";
        return;
    }

    const lines = txDataRaw.split('\n').map(line => line.trim()).filter(line => line);
    const txQueue = [];
    lines.forEach((line) => {
        // Cerdas memisahkan kolom: jika ada TAB (\t) prioritaskan TAB, jika tidak gunakan spasi ganda/spasi (\s+)
        let parts = line.includes('\t') 
            ? line.split('\t').map(p => p.trim()) 
            : line.split(/\s+/).map(p => p.trim());
        parts = parts.filter(p => p.length > 0);

        if (parts.length >= 2) {
            // Sesuai Opsi A: parts[0] = User ID, parts[1] = Kode Tiket, parts[2] = Link Livechat, parts[3] = Screenshot
            const userId = parts[0];
            const transactionId = parts[1];
            const livechatUrl = parts[2] || "";
            const screenshotUrl = parts[3] || "";

            txQueue.push({ 
                userId, 
                transactionId, 
                livechatUrl, 
                screenshotUrl, 
                retryCount: 0 
            });
        }
    });

    // Simpan Konfigurasi dan data mentah antrean
    chrome.storage.local.set({ token, txQueue, adminUrl, sheetApiUrl, txDataRaw });

    statusMsg.style.color = "var(--secondary)";
    statusMsg.textContent = `🚀 Memproses ${txQueue.length} transaksi...`;

    // Kirim sinyal ke background
    chrome.runtime.sendMessage({ action: "startBatchProcess" }, (response) => {
        // Jangan hapus isi txData agar user bisa hapus sendiri atau simpan
        // if (response && response.status === "started") {
        //     document.getElementById("txData").value = "";
        // }
    });
});

// Render Tabel di Dashboard
function renderTable(data) {
    const tbody = document.getElementById("resultBody");
    tbody.innerHTML = "";
    latestResults = data || [];

    if (!data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; color:#555;'>Menunggu data masuk...</td></tr>";
        return;
    }

    // Tampilkan 20 data terbaru saja agar tidak berat
    const displayData = [...data].reverse().slice(0, 20);

    displayData.forEach((item) => {
        if (!item || typeof item !== 'object') return; // Protective check
        try {
            const row = document.createElement("tr");
            const scatterTitleStr = String(item.scatterTitle || '');
            const isScatter = scatterTitleStr && !scatterTitleStr.includes("tidak ditemukan") && !scatterTitleStr.includes("Error") && !scatterTitleStr.includes("Gagal");

        // BonusSMB Status Badge
        const bonusStatus = item.bonussmbStatus || '';
        let bonusBadgeClass = '';
        let bonusBadgeText = bonusStatus || '-';
        let bonusRetryBtn = '';

        switch (bonusStatus) {
            case 'Pending input':
                bonusBadgeClass = 'badge-pending';
                break;
            case 'Sedang input':
            case 'Mengulang...':
            case 'Mengulang cek...':
                bonusBadgeClass = 'badge-processing';
                break;
            case 'Sudah input':
                bonusBadgeClass = 'badge-success badge-monitoring';
                bonusBadgeText = '⟳ Sudah input';
                break;
            case 'APPROVED':
                bonusBadgeClass = 'badge-approved';
                bonusBadgeText = '✓ APPROVED';
                break;
            case 'REJECTED':
                bonusBadgeClass = 'badge-rejected';
                const rejectDetail = String(item.bonussmbDetail || 'Ditolak oleh sistem').replace(/"/g, '&quot;');
                bonusBadgeText = `<span title="${rejectDetail}">✗ REJECTED</span>`;
                break;
            case 'PROCESSING':
                bonusBadgeClass = 'badge-smb-processing';
                bonusBadgeText = '⏳ PROCESSING';
                break;
            case 'FAILED':
                bonusBadgeClass = 'badge-failed';
                const failDetail = String(item.bonussmbDetail || 'Gagal diproses').replace(/"/g, '&quot;');
                bonusBadgeText = `<span title="${failDetail}">✗ FAILED</span>`;
                break;
            case 'MANUAL':
                bonusBadgeClass = 'badge-manual';
                bonusBadgeText = '🔧 MANUAL';
                break;
            case 'Ticket sudah ada':
                bonusBadgeClass = 'badge-exists';
                break;
            case 'Limit Klaim':
                bonusBadgeClass = 'badge-error';
                const limitDetail = String(item.bonussmbDetail || 'Batas klaim tercapai').replace(/"/g, '&quot;');
                bonusBadgeText = `<span title="${limitDetail}">Limit Klaim</span>`;
                break;
            case 'Tidak memenuhi syarat':
                bonusBadgeClass = 'badge-unqualified';
                bonusBadgeText = item.bonussmbStatus;
                bonusRetryBtn = `<button class="btn-retry-bonus" data-userid="${item.userId}" data-txid="${item.transactionId}" title="Ulangi Cek Transaksi">↻</button>`;
                break;
            case 'Gagal input':
                const detailStr = String(item.bonussmbDetail || 'Unknown error').replace(/"/g, '&quot;');
                if (detailStr.includes('claim 2x')) {
                    bonusBadgeClass = 'badge-claim-limit';
                    bonusBadgeText = `User ini sudah claim 2x`;
                    bonusRetryBtn = ''; // Sembunyikan retry karena limit tidak bisa diulang
                } else {
                    bonusBadgeClass = 'badge-error';
                    bonusBadgeText = `<span title="${detailStr}">Gagal input</span>`;
                    bonusRetryBtn = `<button class="btn-retry-bonus" data-userid="${item.userId}" data-txid="${item.transactionId}" title="Ulangi Input">↻</button>`;
                }
                break;
            default:
                // JIKA STATUS TIDAK DIKENALI TAPI ADA ISINYAL (Dinamis dari situs)
                if (bonusStatus && bonusStatus !== '-') {
                    bonusBadgeClass = 'badge-error'; // Default untuk pesan error dinamis
                    const dynamicDetail = String(item.bonussmbDetail || bonusStatus).replace(/"/g, '&quot;');
                    bonusBadgeText = `<span title="${dynamicDetail}">${bonusStatus}</span>`;
                    if (!bonusStatus.includes('claim 2x') && !bonusStatus.includes('Limit')) {
                        bonusRetryBtn = `<button class="btn-retry-bonus" data-userid="${item.userId}" data-txid="${item.transactionId}" title="Ulangi">↻</button>`;
                    }
                } else {
                    // bonusStatus kosong atau '-' (artinya belum/tidak terinput ke BonusSMB)
                    const isCheckFailed = !isScatter || item.statusCek === 'Cek gagal' || scatterTitleStr.includes('tidak ditemukan') || scatterTitleStr.includes('Gagal') || scatterTitleStr.includes('Error');
                    if (isCheckFailed && scatterTitleStr) {
                        bonusBadgeClass = 'badge-unqualified';
                        bonusBadgeText = `<span title="${scatterTitleStr || 'Belum terinput ke BonusSMB'}">Belum terinput</span>`;
                        bonusRetryBtn = `<button class="btn-retry-bonus" data-userid="${item.userId}" data-txid="${item.transactionId}" title="Ulangi Cek Transaksi">↻</button>`;
                    } else {
                        bonusBadgeClass = '';
                    }
                }
                break;
        }

        const bonusBadgeHtml = (bonusStatus || bonusRetryBtn)
            ? `<span class="bonus-badge ${bonusBadgeClass}">${bonusBadgeText}</span>${bonusRetryBtn}`
            : '<span style="color:#555;">-</span>';

        // Status Kolom Terakhir — menampilkan status tracking dari BonusSMB History
        let statusColHtml = '<span class="status-done">OK</span>';
        const historyStatuses = ['APPROVED', 'REJECTED', 'PROCESSING', 'FAILED', 'MANUAL'];
        if (historyStatuses.includes(bonusStatus)) {
            let statusClass = '';
            let statusIcon = '';
            let keteranganLine = '';
            const keterangan = String(item.bonussmbDetail || '').trim();

            switch (bonusStatus) {
                case 'APPROVED':
                    statusClass = 'badge-approved';
                    statusIcon = '✓';
                    break;
                case 'REJECTED':
                    statusClass = 'badge-rejected';
                    statusIcon = '✗';
                    if (keterangan) {
                        keteranganLine = `<div class="status-keterangan">${keterangan}</div>`;
                    }
                    break;
                case 'PROCESSING':
                    statusClass = 'badge-smb-processing';
                    statusIcon = '⏳';
                    break;
                case 'FAILED':
                    statusClass = 'badge-failed';
                    statusIcon = '✗';
                    if (keterangan) {
                        keteranganLine = `<div class="status-keterangan">${keterangan}</div>`;
                    }
                    break;
                case 'MANUAL':
                    statusClass = 'badge-manual';
                    statusIcon = '🔧';
                    break;
            }
            statusColHtml = `<div class="status-history-wrap">
                <span class="bonus-badge ${statusClass}">${statusIcon} ${bonusStatus}</span>
                ${keteranganLine}
            </div>`;
        } else if (bonusStatus === 'Sudah input') {
            statusColHtml = `<div class="status-history-wrap">
                <span class="bonus-badge badge-success badge-monitoring">⟳ Menunggu proses</span>
            </div>`;
        } else if (bonusStatus === 'Ticket sudah ada') {
            statusColHtml = `<div class="status-history-wrap">
                <span class="bonus-badge badge-exists">Ticket sudah ada</span>
            </div>`;
        } else if (bonusStatus === 'Gagal input' && String(item.bonussmbDetail).includes('claim 2x')) {
            statusColHtml = `<div class="status-history-wrap">
                <span class="bonus-badge badge-claim-limit">🚫 User ini sudah claim 2x</span>
            </div>`;
        }

        // Link Livechat & Bukti Screenshot
        const livechatVal = String(item.livechatUrl || '').trim();
        const livechatHtml = livechatVal && (livechatVal.startsWith('http://') || livechatVal.startsWith('https://'))
            ? `<a href="${livechatVal}" target="_blank" rel="noopener noreferrer" class="table-link link-livechat" title="${livechatVal}">💬 Buka</a>`
            : (livechatVal ? `<span class="text-truncate" title="${livechatVal}">${livechatVal}</span>` : '<span style="color:#555;">-</span>');

        const ssVal = String(item.screenshotUrl || '').trim();
        const ssHtml = ssVal && (ssVal.startsWith('http://') || ssVal.startsWith('https://'))
            ? `<a href="${ssVal}" target="_blank" rel="noopener noreferrer" class="table-link link-ss" title="${ssVal}">📸 Lihat</a>`
            : (ssVal ? `<span class="text-truncate" title="${ssVal}">${ssVal}</span>` : '<span style="color:#555;">-</span>');

        row.innerHTML = `
            <td>${item.userId}</td>
            <td>${item.transactionId}</td>
            <td class="col-center">${livechatHtml}</td>
            <td class="col-center">${ssHtml}</td>
            <td style="color:var(--primary)">${item.debetValue}</td>
            <td style="${isScatter ? 'color:var(--secondary); font-weight:bold;' : ''}">${scatterTitleStr}</td>
            <td class="bonus-cell">${bonusBadgeHtml}</td>
            <td class="status-col">${statusColHtml}</td>
        `;
        tbody.appendChild(row);
        } catch (e) {
            console.error("Error rendering row:", e, item);
        }
    });

    // Attach retry handlers
    document.querySelectorAll('.btn-retry-bonus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.dataset.userid;
            const txId = e.target.dataset.txid;
            if (!userId || !txId) return;
            e.target.disabled = true;
            e.target.textContent = '...';
            chrome.runtime.sendMessage({
                action: 'retryBonussmbInput',
                userId: userId,
                transactionId: txId
            }, (resp) => {
                if (resp && resp.ok) {
                    e.target.textContent = '✓';
                } else {
                    e.target.textContent = '✗';
                    e.target.disabled = false;
                }
            });
        });
    });
}


// Listener Perubahan Storage (Data Baru dari Background)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.jutawanResults) {
        const newData = changes.jutawanResults.newValue;
        renderTable(newData);
    }

    if (namespace === 'local' && changes.txQueue) {
        const newQueue = changes.txQueue.newValue || [];
        const statusMsg = document.getElementById("statusMessage");
        if (newQueue.length > 0) {
            statusMsg.style.color = "var(--secondary)";
            statusMsg.textContent = `🚀 Memproses ${newQueue.length} transaksi tersisa...`;
        } else {
            statusMsg.style.color = "var(--secondary)";
            statusMsg.textContent = "🏁 Semua transaksi telah selesai!";
        }
    }

    if (namespace === 'local' && changes.lastSyncStatus) {
        let syncLabel = document.getElementById("syncStatusLabel");
        if (!syncLabel) {
            const statusMsg = document.getElementById("statusMessage");
            syncLabel = document.createElement("div");
            syncLabel.id = "syncStatusLabel";
            syncLabel.style.fontSize = "0.85em";
            syncLabel.style.marginTop = "8px";
            syncLabel.style.color = "#4ade80";
            statusMsg.parentNode.appendChild(syncLabel);
        }
        syncLabel.textContent = changes.lastSyncStatus.newValue;
    }

    if (namespace === 'local' && changes.token) {
        const tokenInput = document.getElementById("token");
        if (tokenInput) {
            tokenInput.value = changes.token.newValue;
            // Efek Visual: Kedipan Hijau saat token terupdate
            tokenInput.classList.add("flash-update");
            setTimeout(() => tokenInput.classList.remove("flash-update"), 1000);
        }
    }
    if (namespace === 'local' && (changes.pancinganStatus || changes.pancinganError)) {
        chrome.storage.local.get(["pancinganStatus", "pancinganError"], (res) => {
            updatePancinganStatusUI(res.pancinganStatus, res.pancinganError);
        });
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'RESULTS_PUSH') {
        renderTable(msg.results);
    }
});

// Helper: Update Status Tag Header di Dashboard
function updateHeaderStatusUI(headers) {
    const headerStatus = document.getElementById("headerStatus");
    if (!headerStatus) return;
    
    if (headers && headers['X-Access-Token']) {
        headerStatus.classList.remove("hidden");
    } else {
        headerStatus.classList.add("hidden");
    }
}

// Helper: Update UI Waktu Token
function updateLastTokenTimeUI(timestamp, withFlash = false) {
    const statusEl = document.getElementById("lastUpdateStatus");
    if (!statusEl) return;

    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-GB', { hour12: false });
    statusEl.textContent = `Update: ${timeStr}`;

    if (withFlash) {
        statusEl.classList.add("token-updated-flash");
        setTimeout(() => statusEl.classList.remove("token-updated-flash"), 1500);
    }
}

// Helper: Update UI Pancingan Status
function updatePancinganStatusUI(status, errorReason) {
    const msgEl = document.getElementById("pancinganStatusMsg");
    if (!msgEl) return;

    msgEl.classList.remove("hidden", "error", "active", "refreshing");

    if (!status || status === "inactive") {
        msgEl.classList.add("hidden");
        return;
    }

    if (status === "error") {
        msgEl.classList.add("error");
        msgEl.textContent = `❌ Gagal: ${errorReason || 'ID/Tiket tidak valid'}`;
    } else if (status === "refreshing") {
        msgEl.classList.add("refreshing");
        msgEl.textContent = `⏳ Sedang mengambil token baru...`;
    } else if (status === "active") {
        msgEl.classList.add("active");
        msgEl.textContent = `✅ Pancingan Ready (ID aktif)`;
    }
}

// --- Custom Modal Logic ---
const resetModal = document.getElementById("resetModal");
const cancelResetBtn = document.getElementById("cancelResetBtn");
const confirmResetBtn = document.getElementById("confirmResetBtn");

function showModal() {
    if (resetModal) resetModal.style.display = "flex";
}

function hideModal() {
    if (resetModal) resetModal.style.display = "none";
}

if (cancelResetBtn) cancelResetBtn.addEventListener("click", hideModal);

if (resetModal) {
    resetModal.addEventListener("click", (e) => {
        if (e.target === resetModal) hideModal();
    });
}

// Reset Data (Hasil Tabel)
document.getElementById("clearBtn").addEventListener("click", () => {
    showModal();
});

if (confirmResetBtn) {
    confirmResetBtn.addEventListener("click", () => {
        hideModal();
        chrome.storage.local.get(['jutawanResults'], (res) => {
            const results = Array.isArray(res.jutawanResults) ? res.jutawanResults : [];
            // Filter: Simpan yang 'Sudah input' (Menunggu proses), 'Gagal input' (kecuali limit 2x), ATAU 'Sedang input'
            const keptResults = results.filter(item => {
                if (!item || typeof item !== 'object') return false;
                if (item.bonussmbStatus === 'Gagal input' && String(item.bonussmbDetail || '').includes('claim 2x')) {
                    return false; // Hapus data tiket yang sudah kena limit 2x
                }
                return item.bonussmbStatus === 'Sudah input' || 
                       item.bonussmbStatus === 'Gagal input' ||
                       item.bonussmbStatus === 'Sedang input';
            });
            
            chrome.storage.local.set({ 
                jutawanResults: keptResults, 
                txQueue: [], 
                syncedTicketIds: [],
                agentHeaders: null 
            }, () => {
                renderTable(keptResults);
                document.getElementById("statusMessage").textContent = "Data hasil dibersihkan (Status Aktif & Gagal dipertahankan).";
            });
        });
    });
}


// --- SISTEM UNDO / REDO KHUSUS DATA ANTREAN TRANSAKSI (TXDATA) ---
const txHistoryStack = [];
let txHistoryIndex = -1;
let txHistoryDebounceTimer = null;
const MAX_TX_HISTORY = 100;

function pushTxHistory(value, cursorPos = null) {
    if (typeof value !== 'string') value = String(value || '');

    // Jika snapshot sama persis dengan snapshot aktif saat ini, cukup perbarui posisi kursor
    if (txHistoryIndex >= 0 && txHistoryIndex < txHistoryStack.length) {
        if (txHistoryStack[txHistoryIndex].value === value) {
            if (cursorPos !== null) {
                txHistoryStack[txHistoryIndex].cursor = cursorPos;
            }
            return;
        }
    }

    // Jika sedang di tengah riwayat (setelah beberapa kali Undo) lalu ada aksi baru,
    // hapus semua riwayat Redo di depannya (branching baru)
    if (txHistoryIndex < txHistoryStack.length - 1) {
        txHistoryStack.splice(txHistoryIndex + 1);
    }

    txHistoryStack.push({
        value: value,
        cursor: cursorPos !== null ? cursorPos : value.length
    });

    if (txHistoryStack.length > MAX_TX_HISTORY) {
        txHistoryStack.shift();
    }

    txHistoryIndex = txHistoryStack.length - 1;
}

function applyTxHistoryState(state) {
    const textarea = document.getElementById("txData");
    if (!textarea || !state) return;

    textarea.value = state.value;
    const pos = typeof state.cursor === 'number' ? Math.min(state.cursor, state.value.length) : state.value.length;
    try {
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos;
        textarea.focus();
    } catch {}

    chrome.storage.local.set({ txDataRaw: state.value });
}

function undoTx() {
    if (txHistoryIndex > 0) {
        txHistoryIndex--;
        applyTxHistoryState(txHistoryStack[txHistoryIndex]);
        return true;
    }
    return false;
}

function redoTx() {
    if (txHistoryIndex < txHistoryStack.length - 1) {
        txHistoryIndex++;
        applyTxHistoryState(txHistoryStack[txHistoryIndex]);
        return true;
    }
    return false;
}

// Fitur Hapus Manual Data Antrean (Textarea)
document.getElementById("clearTxBtn").addEventListener("click", () => {
    const tx = document.getElementById("txData");
    if (tx && tx.value) {
        pushTxHistory(tx.value, tx.selectionStart);
    }
    document.getElementById("txData").value = "";
    chrome.storage.local.set({ txDataRaw: "" });
    pushTxHistory("", 0);
});

// Fitur Simpan Otomatis & Catat Riwayat Input Data Antrean (Textarea)
document.getElementById("txData").addEventListener("input", (e) => {
    const textarea = e.target;
    const val = textarea.value;
    const cursor = textarea.selectionEnd;

    chrome.storage.local.set({ txDataRaw: val });

    if (txHistoryDebounceTimer) clearTimeout(txHistoryDebounceTimer);
    txHistoryDebounceTimer = setTimeout(() => {
        pushTxHistory(val, cursor);
    }, 250);
});

// Shortcut Keyboard Khusus Textarea (CTRL+Z untuk Undo, CTRL+Y / CTRL+SHIFT+Z untuk Redo)
document.getElementById("txData").addEventListener("keydown", (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    const key = e.key.toLowerCase();

    // UNDO: Ctrl + Z (tanpa Shift)
    if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (txHistoryDebounceTimer) {
            clearTimeout(txHistoryDebounceTimer);
            txHistoryDebounceTimer = null;
            // Rekam kondisi saat ini sebelum melompat ke undo
            pushTxHistory(e.target.value, e.target.selectionStart);
        }
        undoTx();
    }
    // REDO: Ctrl + Y ATAU Ctrl + Shift + Z
    else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (txHistoryDebounceTimer) {
            clearTimeout(txHistoryDebounceTimer);
            txHistoryDebounceTimer = null;
        }
        redoTx();
    }
});

// Fitur Otomatis Tambah Spasi Setelah Paste di Data Antrean Transaksi
document.getElementById("txData").addEventListener("paste", (e) => {
    // Batalkan timer debounce input yang tertunda
    if (txHistoryDebounceTimer) {
        clearTimeout(txHistoryDebounceTimer);
        txHistoryDebounceTimer = null;
    }
    // Pastikan kondisi tepat sebelum paste tersimpan di history stack
    pushTxHistory(e.target.value, e.target.selectionStart);

    const pastedText = (e.clipboardData || window.clipboardData)?.getData("text");
    if (!pastedText) return;

    // Jika yang di-paste adalah multi-baris (misal blok data dari file/excel), biarkan paste normal bawaan
    if (pastedText.includes("\n")) {
        setTimeout(() => {
            pushTxHistory(e.target.value, e.target.selectionEnd);
        }, 10);
        return;
    }

    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    const trimmedText = pastedText.trim();
    if (!trimmedText) return;

    // Cek apakah karakter sebelum kursor butuh spasi (jika sebelumnya belum ada spasi/pemisah)
    const needsLeadingSpace = start > 0 && !/\s/.test(currentValue.charAt(start - 1));

    // Selalu tambahkan spasi di akhir teks yang di-paste agar langsung siap untuk paste berikutnya
    const textToInsert = (needsLeadingSpace ? " " : "") + trimmedText + " ";

    // Sisipkan ke posisi kursor saat ini
    textarea.value = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);

    // Tempatkan kursor tepat setelah spasi
    const newCursorPos = start + textToInsert.length;
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;

    // Simpan otomatis ke storage
    chrome.storage.local.set({ txDataRaw: textarea.value });

    // Catat kondisi baru setelah paste ke history stack
    pushTxHistory(textarea.value, newCursorPos);
});

// Fitur Simpan Otomatis URL Admin
document.getElementById("adminUrl").addEventListener("input", (e) => {
    chrome.storage.local.set({ adminUrl: e.target.value.trim() });
});

// Fitur Simpan Otomatis URL Google Sheets
document.getElementById("sheetApiUrl").addEventListener("input", (e) => {
    const val = e.target.value.trim();
    chrome.storage.local.set({ sheetApiUrl: val });
    updateSyncIndicator(!!val);
});

// --- DUAL-ENGINE OCR SCANNER ---
function setupOCR(suffix = "") {
    const pasteArea = document.getElementById("ocrPasteArea" + suffix);
    const resultInput = document.getElementById("ocrResult" + suffix);
    const copyBtn = document.getElementById("copyOcrResultBtn" + suffix);
    const loading = document.getElementById("ocrLoading" + suffix);
    const statusText = document.getElementById("ocrStatusText" + suffix);
    const engineInfo = document.getElementById("ocrEngineInfo" + suffix);
    const prompt = pasteArea.querySelector(".ocr-prompt");
    const apiKeyInput = document.getElementById("ocrApiKey");

    // Muat API key dari storage (hanya perlu sekali karena shared)
    if (suffix === "") {
        chrome.storage.local.get(["ocrApiKey"], (res) => {
            if (res.ocrApiKey) apiKeyInput.value = res.ocrApiKey;
        });

        // Simpan API key saat diubah
        apiKeyInput.addEventListener("input", (e) => {
            chrome.storage.local.set({ ocrApiKey: e.target.value.trim() });
        });
    }

    pasteArea.addEventListener("paste", async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const blob = item.getAsFile();
                processOCR(blob);
            }
        }
    });

    copyBtn.addEventListener("click", () => {
        const val = resultInput.value;
        if (val) {
            navigator.clipboard.writeText(val).then(() => {
                alert(`📋 Hasil OCR ${suffix ? suffix : '1'} berhasil disalin!`);
            });
        }
    });

    // ========================================================
    // HELPER: Konversi Blob ke Base64 Data URL
    // ========================================================
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ========================================================
    // ENGINE 1 (PRIMARY): OCR.space API — Engine 2
    // ========================================================
    async function ocrWithAPI(blob, engine = "2") {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            throw new Error("NO_API_KEY");
        }

        statusText.textContent = `🌐 Scanning via API (Engine ${engine})...`;

        const base64data = await blobToBase64(blob);

        const formData = new FormData();
        formData.append("base64Image", base64data);
        formData.append("OCREngine", engine);
        formData.append("scale", "true");
        formData.append("isTable", "false");
        formData.append("language", "eng");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // Batas waktu 12 detik

        let response;
        try {
            response = await fetch("https://api.ocr.space/parse/image", {
                method: "POST",
                headers: {
                    "apikey": apiKey
                },
                body: formData,
                signal: controller.signal
            });
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            if (fetchErr.name === "AbortError") {
                throw new Error("TIMEOUT");
            }
            throw fetchErr;
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 429) throw new Error("RATE_LIMITED");
            if (response.status === 403) throw new Error("API_KEY_INVALID");
            throw new Error(`API_HTTP_${response.status}`);
        }

        const result = await response.json();

        if (result.IsErroredOnProcessing) {
            const errMsg = result.ErrorMessage && result.ErrorMessage.length > 0
                ? result.ErrorMessage.join(", ")
                : "Unknown API processing error";
            
            // Deteksi pesan limit dari OCR.space
            if (errMsg.includes("hourly limit") || errMsg.includes("daily limit")) {
                throw new Error("RATE_LIMITED");
            }
            throw new Error(errMsg);
        }

        if (!result.ParsedResults || result.ParsedResults.length === 0) {
            throw new Error("API_EMPTY_RESULT");
        }

        let rawText = result.ParsedResults.map(r => r.ParsedText || "").join(" ");
        const digits = rawText.replace(/[^0-9]/g, "");
        
        if (!digits || digits.length === 0) {
             throw new Error("API_EMPTY_RESULT");
        }
        
        return digits;
    }

    // ========================================================
    // ENGINE 2 (FALLBACK): Tesseract.js Local
    // ========================================================
    async function ocrWithTesseract(blob) {
        statusText.textContent = "🔧 Scanning via Tesseract Lokal...";

        const img = new Image();
        const imgUrl = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const scale = 4;
        const padding = 40;
        const sw = img.width * scale;
        const sh = img.height * scale;

        canvas.width = sw + (padding * 2);
        canvas.height = sh + (padding * 2);

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.filter = "grayscale(100%) contrast(250%)";
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, padding, padding, sw, sh);
        URL.revokeObjectURL(imgUrl);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        const histogram = new Array(256).fill(0);
        for (let i = 0; i < pixels.length; i += 4) {
            histogram[pixels[i]]++;
        }

        const totalPixels = pixels.length / 4;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];

        let sumB = 0, wB = 0, wF = 0;
        let maxVariance = 0, threshold = 128;

        for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;
            wF = totalPixels - wB;
            if (wF === 0) break;
            sumB += t * histogram[t];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const variance = wB * wF * (mB - mF) * (mB - mF);
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = t;
            }
        }

        for (let i = 0; i < pixels.length; i += 4) {
            const val = pixels[i] < threshold ? 0 : 255;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = val;
            pixels[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        const worker = await Tesseract.createWorker('eng', 1, {
            workerPath: chrome.runtime.getURL('worker.min.js'),
            corePath: chrome.runtime.getURL('tesseract-core.wasm.js'),
            langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
            workerBlobURL: false
        });

        await worker.setParameters({
            tessedit_char_whitelist: '0123456789',
            tessedit_pageseg_mode: '6'
        });

        const res = await worker.recognize(canvas);
        await worker.terminate();

        const digits = res.data.text.replace(/[^0-9]/g, "");
        return digits;
    }

    // ========================================================
    // MAIN PIPELINE: Try API first → Fallback to Tesseract
    // ========================================================
    async function processOCR(blob) {
        prompt.classList.add("hidden");
        loading.classList.remove("hidden");
        resultInput.value = "";
        engineInfo.textContent = "Engine: Memproses...";
        engineInfo.style.color = "var(--primary)";

        let finalResult = "";
        let usedEngine = "";
        let apiErrorReason = "";

        try {
            try {
                try {
                    // LANGKAH 1: Coba Engine 2 (Prioritas Utama)
                    const apiResult = await ocrWithAPI(blob, "2");
                    if (apiResult && apiResult.length > 0) {
                        finalResult = apiResult;
                        usedEngine = "☁️ OCR.space API (Engine 2)";
                    } else {
                        throw new Error("API_EMPTY_RESULT");
                    }
                } catch (apiErr) {
                    const reason = apiErr.message || String(apiErr);
                    
                    // JIKA ERROR ADALAH MASALAH SISTEM (E500/TIMEOUT), COBA ENGINE 1 (STEP 2)
                    if (reason === "TIMEOUT" || reason.includes("500") || reason.includes("Unknown API")) {
                        console.log("⚠️ Engine 2 Bermasalah, mencoba Engine 1...");
                        try {
                            const apiResult1 = await ocrWithAPI(blob, "1");
                            if (apiResult1 && apiResult1.length > 0) {
                                finalResult = apiResult1;
                                usedEngine = "☁️ OCR.space API (Engine 1 - Retry)";
                            } else {
                                throw new Error("API_EMPTY_RESULT");
                            }
                        } catch (apiErr1) {
                            throw apiErr1; // Throw to be caught by apiErrFinal
                        }
                    } else {
                        throw apiErr; // Throw to be caught by apiErrFinal
                    }
                }
            } catch (apiErrFinal) {
                const reason = apiErrFinal.message || String(apiErrFinal);
                
                if (reason === "NO_API_KEY") {
                    apiErrorReason = "Key Kosong";
                } else if (reason === "TIMEOUT") {
                    apiErrorReason = "API Timeout (12s)";
                } else if (reason === "RATE_LIMITED") {
                    apiErrorReason = "Limit Habis";
                } else if (reason === "API_KEY_INVALID") {
                    apiErrorReason = "Key Expired";
                } else if (reason === "API_EMPTY_RESULT") {
                    apiErrorReason = "Gagal Baca Angka";
                } else {
                    apiErrorReason = reason.slice(0, 15);
                }

                statusText.textContent = `⚠️ API Gagal (${apiErrorReason}), pakai Lokal...`;
                
                const tesseractResult = await ocrWithTesseract(blob);
                if (tesseractResult && tesseractResult.length > 0) {
                    finalResult = tesseractResult;
                    usedEngine = `🔧 Lokal (API: ${apiErrorReason})`;
                } else {
                    finalResult = "";
                    usedEngine = `❌ Gagal (API: ${apiErrorReason})`;
                }
            }

            if (finalResult && finalResult.length > 0) {
                resultInput.value = finalResult;
                engineInfo.textContent = `Engine: ${usedEngine}`;
                engineInfo.style.color = "var(--secondary)";
            } else {
                resultInput.value = "Gagal scan, coba screenshot area angka saja.";
                engineInfo.textContent = "Engine: Semua Metode Gagal";
                engineInfo.style.color = "#ff4466";
            }

        } catch (err) {
            console.error(`Fatal Error:`, err);
            const errorMsg = err && err.message ? err.message : String(err);
            resultInput.value = "Error: " + errorMsg;
            engineInfo.textContent = "Engine: Error - " + errorMsg;
            engineInfo.style.color = "#ff4466";
        } finally {
            loading.classList.add("hidden");
            prompt.classList.remove("hidden");
            statusText.textContent = "Scanning...";
        }
    }
}

// Inisialisasi kedua scanner
setupOCR("");  // Scanner 1
setupOCR("2"); // Scanner 2


// --- FITUR BARU: PANCINGAN TOKEN ---
// Muat data pancingan saat awal
chrome.storage.local.get(["keepAliveUserId", "keepAliveTicketId", "autoKeepAlive"], (res) => {
    if (res.keepAliveUserId) document.getElementById("keepAliveUserId").value = res.keepAliveUserId;
    if (res.keepAliveTicketId) document.getElementById("keepAliveTicketId").value = res.keepAliveTicketId;
    if (res.autoKeepAlive !== undefined) document.getElementById("autoKeepAlive").checked = res.autoKeepAlive;
});

// Listener untuk simpan & update pancingan
document.getElementById("keepAliveUserId").addEventListener("input", (e) => {
    chrome.storage.local.set({ keepAliveUserId: e.target.value.trim() });
});

document.getElementById("keepAliveTicketId").addEventListener("input", (e) => {
    chrome.storage.local.set({ keepAliveTicketId: e.target.value.trim() });
});

document.getElementById("autoKeepAlive").addEventListener("change", (e) => {
    const active = e.target.checked;
    chrome.storage.local.set({ autoKeepAlive: active });

    // Kirim sinyal ke background untuk mulai/henti timer
    chrome.runtime.sendMessage({
        action: "updateKeepAlive",
        enabled: active,
        userId: document.getElementById("keepAliveUserId").value.trim(),
        ticketId: document.getElementById("keepAliveTicketId").value.trim()
    });
});

// --- FITUR BARU: BONUSSMB AUTO FILL TOGGLE ---
chrome.storage.local.get(["bonussmbAutoEnabled"], (res) => {
    const toggle = document.getElementById("bonussmbAutoToggle");
    if (toggle) {
        // Default ON jika belum pernah di-set
        toggle.checked = res.bonussmbAutoEnabled !== false;
    }
});

document.getElementById("bonussmbAutoToggle").addEventListener("change", (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ bonussmbAutoEnabled: enabled });
    console.log("[BONUSSMB] Auto fill " + (enabled ? "AKTIF" : "NONAKTIF"));
});

