// Variabel global untuk menyimpan data hasil terbaru agar bisa disalin
let latestResults = [];

document.getElementById("startBtn").addEventListener("click", async () => {
    // Baca dari textarea
    const adminUrl = document.getElementById("adminUrl").value.trim(); // DITAMBAHKAN
    const txDataRaw = document.getElementById("txData").value.trim();
    const token = document.getElementById("token").value.trim();
    const status = document.getElementById("status");


    if (!txDataRaw || !adminUrl) { // Diperbarui
        status.textContent = "⚠️ Harap isi Data Transaksi dan URL Admin.";
        return;
    }

    const lines = txDataRaw.split('\n').map(line => line.trim()).filter(line => line);

    if (lines.length === 0) {
        status.textContent = "⚠️ Tidak ada data transaksi yang valid ditemukan.";
        return;
    }

    // 1. Buat Antrian Proses (txQueue) dari semua baris data
    // Format baru: TransactionID [TAB/Space] UserID
    const txQueue = [];
    lines.forEach((line) => {
        // Pisahkan Transaction ID dan User ID berdasarkan spasi atau tab
        const parts = line.split(/\s+/).map(p => p.trim());
        if (parts.length >= 2) {
            txQueue.push({
                transactionId: parts[0],
                userId: parts[1],
                retryCount: 0
            });
        }
    });

    if (txQueue.length === 0) {
        status.textContent = "⚠️ Tidak ada data transaksi yang valid ditemukan setelah parsing.";
        return;
    }

    // 2. Simpan token dan seluruh antrian ke storage
    chrome.storage.local.set({ token, txQueue, adminUrl });
    status.textContent = `🚀 Memulai proses otomatis untuk ${txQueue.length} transaksi...`;

    // 3. Mulai proses batch di background.js
    chrome.runtime.sendMessage({ action: "startBatchProcess" }, (response) => {
        if (response && response.status === "started") {
            // Bersihkan textarea setelah antrian dikirim
            document.getElementById("txData").value = "";
            status.textContent = `✅ Proses otomatis dimulai. ${txQueue.length} transaksi dalam antrian.`;
        } else {
            status.textContent = "❌ Gagal memulai proses otomatis di background.";
        }
    });
});

document.getElementById("openDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: 'dashboard.html' });
});

// Listener untuk menyimpan input saat berubah
document.getElementById("token").addEventListener("input", () => {
    chrome.storage.local.set({ token: document.getElementById("token").value.trim() });
});

document.getElementById("adminUrl").addEventListener("input", () => {
    chrome.storage.local.set({ adminUrl: document.getElementById("adminUrl").value.trim() });
});

// Fungsi untuk menyalin hasil ke clipboard
async function copyResultsToClipboard() {
    if (!latestResults || latestResults.length === 0) {
        document.getElementById("status").textContent = "⚠️ Tidak ada data hasil untuk disalin.";
        return;
    }

    // Format: UserID | TransactionID | TransactionID | DebetValue | ScatterTitle | Status
    const text = latestResults.map(item =>
        `${item.userId}\t${item.transactionId}\t${item.transactionId}\t${item.debetValue}\t${item.scatterTitle}\tOK`
    ).join('\n');

    try {
        await navigator.clipboard.writeText(text);
        document.getElementById("status").textContent = "✅ Data hasil berhasil disalin ke clipboard!";
        // Bersihkan pesan setelah beberapa saat
        chrome.storage.local.get(["txQueue"], (res) => {
            if (res.txQueue && res.txQueue.length === 0) {
                status.textContent = "🏁 Antrian proses selesai. Siap.";
            }
        });
    } catch (err) {
        console.error('Gagal menyalin:', err);
        document.getElementById("status").textContent = "❌ Gagal menyalin data ke clipboard.";
    }
}

// ====== TABEL HASIL ======
function renderTable(data) {
    const tbody = document.getElementById("resultBody");
    tbody.innerHTML = "";
    latestResults = data || []; // Update data hasil terbaru

    if (!data || data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6'>Belum ada data</td></tr>";
        return;
    }

    data.forEach((item) => {
        const row = document.createElement("tr");
        // Tambahkan class atau style untuk scatter yang ditemukan
        const scatterClass = item.scatterTitle.includes("tidak ditemukan") ? '' : 'style="background-color: #d4edda; font-weight: bold;"';
        row.innerHTML = `
      <td>${item.userId}</td>
      <td>${item.transactionId}</td>
      <td>${item.transactionId}</td>
      <td>${item.debetValue}</td>
      <td ${scatterClass}>${item.scatterTitle}</td>
      <td>OK</td>
    `;
        tbody.appendChild(row);
    });
}

// Listener untuk update storage (saat background.js atau content.js menyimpan hasil/token baru)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.jutawanResults) {
            renderTable(changes.jutawanResults.newValue);
        }
        if (changes.token) {
            document.getElementById("token").value = changes.token.newValue;
        }
        if (changes.adminUrl) {
            document.getElementById("adminUrl").value = changes.adminUrl.newValue;
        }
    }
});

document.getElementById("clearBtn").addEventListener("click", () => {
    chrome.storage.local.set({ jutawanResults: [], txQueue: [] }, () => {
        renderTable([]);
        document.getElementById("status").textContent = "Data hasil dan antrian telah dihapus.";
    });
});

// Listener untuk tombol Salin
document.getElementById("copyBtn").addEventListener("click", copyResultsToClipboard);

// Muat hasil awal saat popup dibuka
chrome.storage.local.get(["jutawanResults", "token", "adminUrl"], (res) => {
    renderTable(res.jutawanResults);
    if (res.token) {
        document.getElementById("token").value = res.token;
    }
    // DITAMBAHKAN: Memuat URL Admin
    if (res.adminUrl) {
        document.getElementById("adminUrl").value = res.adminUrl;
    }
});

// Fitur Undo/Redo & Otomatis Tambah Spasi Setelah Paste di Data Antrean Transaksi (Popup)
const txDataPopup = document.getElementById("txData");
if (txDataPopup) {
    const popupHistoryStack = [];
    let popupHistoryIndex = -1;
    let popupDebounceTimer = null;

    function pushPopupHistory(value, cursorPos = null) {
        if (typeof value !== 'string') value = String(value || '');
        if (popupHistoryIndex >= 0 && popupHistoryIndex < popupHistoryStack.length) {
            if (popupHistoryStack[popupHistoryIndex].value === value) {
                if (cursorPos !== null) popupHistoryStack[popupHistoryIndex].cursor = cursorPos;
                return;
            }
        }
        if (popupHistoryIndex < popupHistoryStack.length - 1) {
            popupHistoryStack.splice(popupHistoryIndex + 1);
        }
        popupHistoryStack.push({
            value: value,
            cursor: cursorPos !== null ? cursorPos : value.length
        });
        if (popupHistoryStack.length > 100) popupHistoryStack.shift();
        popupHistoryIndex = popupHistoryStack.length - 1;
    }

    function applyPopupHistoryState(state) {
        if (!txDataPopup || !state) return;
        txDataPopup.value = state.value;
        const pos = typeof state.cursor === 'number' ? Math.min(state.cursor, state.value.length) : state.value.length;
        try {
            txDataPopup.selectionStart = pos;
            txDataPopup.selectionEnd = pos;
            txDataPopup.focus();
        } catch {}
    }

    // Inisialisasi awal
    pushPopupHistory(txDataPopup.value || "", (txDataPopup.value || "").length);

    txDataPopup.addEventListener("input", (e) => {
        const val = e.target.value;
        const cursor = e.target.selectionEnd;
        if (popupDebounceTimer) clearTimeout(popupDebounceTimer);
        popupDebounceTimer = setTimeout(() => {
            pushPopupHistory(val, cursor);
        }, 250);
    });

    txDataPopup.addEventListener("keydown", (e) => {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        if (!isCtrlOrCmd) return;
        const key = e.key.toLowerCase();

        if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (popupDebounceTimer) {
                clearTimeout(popupDebounceTimer);
                popupDebounceTimer = null;
                pushPopupHistory(e.target.value, e.target.selectionStart);
            }
            if (popupHistoryIndex > 0) {
                popupHistoryIndex--;
                applyPopupHistoryState(popupHistoryStack[popupHistoryIndex]);
            }
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            if (popupDebounceTimer) {
                clearTimeout(popupDebounceTimer);
                popupDebounceTimer = null;
            }
            if (popupHistoryIndex < popupHistoryStack.length - 1) {
                popupHistoryIndex++;
                applyPopupHistoryState(popupHistoryStack[popupHistoryIndex]);
            }
        }
    });

    txDataPopup.addEventListener("paste", (e) => {
        if (popupDebounceTimer) {
            clearTimeout(popupDebounceTimer);
            popupDebounceTimer = null;
        }
        pushPopupHistory(e.target.value, e.target.selectionStart);

        const pastedText = (e.clipboardData || window.clipboardData)?.getData("text");
        if (!pastedText) return;
        if (pastedText.includes("\n")) {
            setTimeout(() => {
                pushPopupHistory(e.target.value, e.target.selectionEnd);
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

        const needsLeadingSpace = start > 0 && !/\s/.test(currentValue.charAt(start - 1));
        const textToInsert = (needsLeadingSpace ? " " : "") + trimmedText + " ";

        textarea.value = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
        const newCursorPos = start + textToInsert.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;

        pushPopupHistory(textarea.value, newCursorPos);
    });
}
