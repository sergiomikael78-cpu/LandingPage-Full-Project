// ==UserScript==
// @name         LiveChat History Background Highlighter
// @namespace    http://tampermonkey.net/
// @version      2025-01-22
// @description  Memberikan background warna kuning estetik pada history chat untuk memisahkan dari chat sesi terbaru.
// @author       You
// @match        https://my.livechatinc.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    var style = document.createElement("style");
    // Desain UI Kuning Terang Menyeluruh (Full Width Row)
    style.textContent = `
        .history-chat-bg {
            background: rgba(255, 235, 59, 0.22) !important; /* Kuning menyala transparan */
            border-left: 6px solid #FFEA00 !important; 
            border-right: 2px solid rgba(255, 235, 59, 0.3) !important;
            border-radius: 4px;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
            padding: 8px 12px !important;
            width: 100% !important; /* Memaksa warna menyeluruh dari kiri ke kanan */
            display: block !important; /* Membuang sifat flex/inline agar membentang luas */
            box-sizing: border-box !important;
            position: relative;
            transition: all 0.3s ease;
        }

        /* Teks pembeda tipis di pojok kanan agar makin jelas */
        .history-chat-bg::before {
            content: "HISTORY";
            position: absolute;
            top: 5px;
            right: 15px;
            font-size: 10px;
            font-weight: bold;
            color: rgba(255, 235, 59, 0.6);
            letter-spacing: 1px;
            pointer-events: none;
        }

        /* Hover efek makin terang */
        .history-chat-bg:hover {
            background: rgba(255, 235, 59, 0.35) !important;
        }
    `;
    document.head.appendChild(style);

    function findLastMarker(container) {
        var elements = container.querySelectorAll('*');
        var latest = null;

        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var text = (el.textContent || "").toLowerCase().trim();

            // Mencocokkan kata kunci pemisah sesi (Session Separator) utama
            if (
                text.includes("started -") ||
                text.includes("dimulai -") ||
                text.includes("add tag")
            ) {
                // Memastikan yang sedang dicek adalah tag sistem LiveChat (umumnya node kecil, bukan teks narasi panjang)
                if (el.children.length <= 5 && text.length < 50) {
                    latest = el; // Terus me-replace variabel ini sehingga kita mendapatkan elemen yang PALING BAWAH (terakhir)
                }
            }
        }
        return latest; // Mengembalikan separator sesi PALING BARU / BAWAH
    }

    function runHistoryHighlighter() {
        var container = document.querySelector('[data-testid="messages-list"]');
        if (!container) return;

        var lastMarker = findLastMarker(container);

        // Ambil elemen pesan agen, pesan Klien, dan pemisah sistem lainnya
        // Kita menggunakan wildcard CSS untuk menangkap baris-baris obrolannya
        var allBlocks = container.querySelectorAll('[data-testid="agent-message"], [data-testid="customer-message"], [class*="message__text"], div > span > div > div');

        if (allBlocks.length === 0) {
            allBlocks = container.querySelectorAll('div > div > div'); // struktur fallback 
        }

        for (var i = 0; i < allBlocks.length; i++) {
            var el = allBlocks[i];

            // JANGAN mewarnai seluruh wadah utama jika tidak sengaja didapat, cari elemen pembungkus pesan 
            if (el.children.length > 10) continue;

            // Jika node ini adalah marker itu sendiri atau bagian dari node yg mengandung marker
            if (lastMarker && (el === lastMarker || el.contains(lastMarker) || lastMarker.contains(el))) {
                el.classList.remove('history-chat-bg');
                continue;
            }

            // Jika node ini posisinya SECARA DOM (Document Object Model) ada SEBELUM marker terakhir
            if (lastMarker && (lastMarker.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) {
                // Elemen ini ada DI ATAS / SEBELUM separator
                el.classList.add('history-chat-bg');
            } else {
                // Elemen ini ada DI BAWAH separator (Chat Sesi Terbaru)
                el.classList.remove('history-chat-bg');
            }
        }
    }

    // TEKNIK ANTI-LAG (DEBOUNCE)
    // Menahan fungsi agar tidak berjalan ratusan kali per detik saat DOM sibuk merender
    var highlightTimer = null;
    function debouncedHighlighter() {
        if (highlightTimer) clearTimeout(highlightTimer);
        highlightTimer = setTimeout(runHistoryHighlighter, 150); // Cukup jalankan 1 kali setelah DOM diam 150ms
    }

    // Gunakan observer agar langsung berjalan halus tanpa lag ketika scroll/render pesan
    var observer = new MutationObserver(function () {
        debouncedHighlighter();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback interval diperlambat agar lebih ringan (CPU Friendly)
    setInterval(debouncedHighlighter, 2500);
})();
