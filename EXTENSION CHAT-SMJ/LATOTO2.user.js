// ==UserScript==
// @name         LiveChat Duplicate Message Highlighter - DANGER ALERT
// @namespace    http://tampermonkey.net/
// @version      2025-01-21
// @description  Highlight duplikat yang Jelas, Tegas, dan Berwibawa
// @author       You
// @match        https://my.livechatinc.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=livechatinc.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    var style = document.createElement("style");
    style.textContent = ".css-1cmlcj3, .css-1orfco2 { flex: 0 0 350px !important; max-width: 350px !important; min-width: 350px !important; background: transparent !important; }" +
        ".spam-parent-active { position: relative !important; overflow: visible !important; }" +

        /* PRE-SEND INPUT: BOLD RED GUARD */
        ".spam-glow-alert { " +
        "border: 3px solid #ff0000 !important; " +
        "background: rgba(255, 0, 0, 0.08) !important; " +
        "box-shadow: 0 0 20px rgba(255, 0, 0, 0.4), 0 0 5px rgba(0,0,0,0.3) !important; " +
        "border-radius: 12px !important; " +
        "}" +

        /* HUD PERINGATAN: MODERN FLOATING HUD */
        ".spam-info-box { " +
        "position: absolute; bottom: calc(100% + 20px); left: 0; " +
        "width: 340px; background: #1a0000; " +
        "border: 2px solid #ff0000; border-radius: 14px; " +
        "padding: 18px; color: #ffffff; font-size: 12px; z-index: 9999999; " +
        "box-shadow: 0 15px 45px rgba(0,0,0,0.7), 0 0 10px rgba(255,0,0,0.2); " +
        "border-left: 10px solid #ff0000; " +
        "animation: slideUpHUD 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); " +
        "pointer-events: none; " +
        "}" +
        ".spam-info-box b { color: #ff1111; display: block; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; }" +
        "@keyframes slideUpHUD { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }" +

        /* FINAL FORM: THE SPAM ALERT BUBBLE */
        ".spam-detected-highlight { " +
        "background: #800000 !important; " +
        "background: linear-gradient(180deg, #bb0000 0%, #660000 100%) !important; " +
        "border: 2px solid #ff0000 !important; " +
        "border-left: 12px solid #ff0000 !important; " +
        "border-radius: 12px !important; " +
        "position: relative; overflow: visible !important; z-index: 100; " +
        "margin: 20px 0 20px 0 !important; " +
        "box-shadow: 0 12px 35px rgba(0,0,0,0.6), inset 0 0 20px rgba(255,0,0,0.4), 0 0 0 2px rgba(0,0,0,0.2) !important; " +
        "animation: alertPulse 2s infinite ease-in-out; " +
        "}" +

        /* FORCE WHITE TEXT ON EVERYTHING INSIDE */
        ".spam-detected-highlight, .spam-detected-highlight *, .spam-detected-highlight span, .spam-detected-highlight div { " +
        "color: #ffffff !important; " +
        "background-color: transparent !important; " +
        "text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important; " +
        "}" +

        /* SYSTEM ALERT HEADER RIBBON */
        ".spam-detected-highlight::before { " +
        "content: '⚠️ SYSTEM ALERT: DUPLICATE MESSAGE DETECTED'; " +
        "position: absolute; top: -14px; left: -10px; right: 0; " +
        "background: #ff0000; color: #ffffff !important; " +
        "font-size: 9px; font-weight: 900; padding: 2px 12px; " +
        "border-radius: 4px 4px 0 0; box-shadow: 0 -2px 10px rgba(255,0,0,0.4); " +
        "letter-spacing: 1.5px; z-index: 11; width: fit-content; " +
        "}" +

        "@keyframes alertPulse { 0% { border-color: #ff0000; } 50% { border-color: #ff6666; } 100% { border-color: #ff0000; } }" +
        "@keyframes shakeAlert { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-10px); } 40%, 80% { transform: translateX(10px); } }" +
        "body.spam-block-send [aria-label*='end'], body.spam-block-send [aria-label*='irim'], body.spam-block-send [data-testid*='send'] { pointer-events: none !important; opacity: 0.3 !important; cursor: not-allowed !important; filter: grayscale(100%) !important; }";
    document.head.appendChild(style);

    function normalizeText(text) {
        if (!text) return "";
        return text.replace(/[\s\n\r\t\u00a0.,!?;:-]/g, "").toLowerCase();
    }

    function findLastMarker(container) {
        var elements = container.querySelectorAll("*");
        var latest = null;
        var keys = ["started", "today", "dimulai", "hari ini"];
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var txt = (el.textContent || "").toLowerCase();
            for (var j = 0; j < keys.length; j++) {
                if (txt.indexOf(keys[j]) !== -1 && el.children.length <= 4) {
                    var inner = (el.innerText || "").toLowerCase().trim();
                    if (inner.indexOf("started") === 0 || inner.indexOf("dimulai") === 0 || (txt.indexOf("started") !== -1 && txt.indexOf("today") !== -1)) {
                        latest = el;
                    }
                }
            }
        }
        return latest;
    }

    function getBubbles(container) {
        var blocks = container.querySelectorAll('[data-testid="agent-message"]');
        var results = [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i].querySelector('[data-testid="message-text"]') || blocks[i].querySelector('div[class^="css-"]') || blocks[i].querySelector(".message__text");
            if (b) results.push(b);
        }
        return results;
    }

    function getMsgsAfter(container) {
        var marker = findLastMarker(container);
        var bubbles = getBubbles(container);
        if (!marker) return bubbles.slice(-5);
        var filtered = [];
        for (var i = 0; i < bubbles.length; i++) {
            if (marker.compareDocumentPosition(bubbles[i]) & Node.DOCUMENT_POSITION_FOLLOWING) filtered.push(bubbles[i]);
        }
        return filtered;
    }

    function runHighlight() {
        if (document.hidden) return;
        var list = document.querySelector('[data-testid="messages-list"]');
        if (!list) return;
        var all = getBubbles(list);
        for (var i = 0; i < all.length; i++) all[i].classList.remove("spam-detected-highlight");
        var active = getMsgsAfter(list);
        if (active.length < 2) return;
        var counts = {};
        for (var j = 0; j < active.length; j++) {
            var n = normalizeText(active[j].innerText || active[j].textContent);
            if (n.length >= 5) counts[n] = (counts[n] || 0) + 1;
        }
        for (var k = 0; k < active.length; k++) {
            var n2 = normalizeText(active[k].innerText || active[k].textContent);
            if (counts[n2] > 1) active[k].classList.add("spam-detected-highlight");
        }
    }

    function removeAlerts(input) {
        if (input.dataset.isSpam === "true") {
            input.dataset.isSpam = "false";
            document.body.classList.remove("spam-block-send");
        }
        input.classList.remove("spam-glow-alert");
        var p = input.parentElement;
        if (p) {
            p.classList.remove("spam-parent-active");
            var f = p.querySelector(".spam-info-box"); if (f) f.remove();
        }
    }

    function applyAlerts(input) {
        input.dataset.isSpam = "true";
        document.body.classList.add("spam-block-send");
        input.classList.add("spam-glow-alert");
        var p = input.parentElement; if (!p) return;
        p.classList.add("spam-parent-active");
        if (!p.querySelector(".spam-info-box")) {
            var i = document.createElement("div"); i.className = "spam-info-box";
            i.innerHTML = "<b>🛡️ NEURAL SHIELD: SPAM ALERT</b>" +
                "Pesan yang Anda ketik terdeteksi 100% duplikat dengan riwayat chat hari ini. Mohon lakukan variasi kata agar tidak terblokir sistem.<br><br><span style='color:#ff5555; background:rgba(255,0,0,0.2); padding:4px 8px; border-radius:4px; display:inline-block; font-weight:bold; border:1px solid #ff0000; font-size:11px; letter-spacing:1px;'>[ ⛔ AKSES KIRIM DIBLOKIR SEMENTARA ]</span>";
            p.appendChild(i);
        }
    }

    function triggerShakeAlert() {
        var input = document.querySelector('[contenteditable="true"]') || document.querySelector("textarea");
        if (!input) return;
        var p = input.parentElement;
        if (p) {
            var hud = p.querySelector(".spam-info-box");
            if (hud) {
                hud.style.animation = "none";
                void hud.offsetWidth; // trigger reflow
                hud.style.animation = "shakeAlert 0.4s cubic-bezier(.36,.07,.19,.97) both";
            }
        }
    }

    function isCurrentInputSpam(input) {
        var raw = input.innerText || input.value || "";
        if (raw.trim().indexOf("#") === 0) return false;
        var norm = normalizeText(raw);
        if (norm.length < 5) return false;
        var list = document.querySelector('[data-testid="messages-list"]') || document.body;
        var active = getMsgsAfter(list);
        for (var i = 0; i < active.length; i++) {
            if (normalizeText(active[i].innerText || active[i].textContent) === norm) {
                return true;
            }
        }
        return false;
    }

    function checkPre() {
        var input = document.querySelector('[contenteditable="true"]') || document.querySelector("textarea");
        if (!input) return;
        if (isCurrentInputSpam(input)) {
            applyAlerts(input);
        } else {
            removeAlerts(input);
        }
    }

    // Global lock for Enter key and specific mouse clicks when spam is active
    window.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            var input = document.querySelector('[contenteditable="true"]') || document.querySelector("textarea");
            // Check synchronously if spam right at the moment of 'Enter'
            if (input && (input.dataset.isSpam === "true" || isCurrentInputSpam(input))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                applyAlerts(input);
                triggerShakeAlert();
            }
        }
    }, true); // use capture phase

    window.addEventListener("click", function (e) {
        var el = e.target;
        var isSendClick = false;
        while (el && el !== document) {
            var label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("data-testid") || "").toLowerCase();
            var cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
            if (label.indexOf("send") !== -1 || label.indexOf("kirim") !== -1 || cls.indexOf("send") !== -1) {
                isSendClick = true;
                break;
            }
            el = el.parentNode;
        }
        if (isSendClick) {
            var input = document.querySelector('[contenteditable="true"]') || document.querySelector("textarea");
            // Check synchronously if spam right at the moment of 'Click'
            if (input && (input.dataset.isSpam === "true" || isCurrentInputSpam(input))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                applyAlerts(input);
                triggerShakeAlert();
            }
        }
    }, true); // use capture phase

    var observer = new MutationObserver(function () {
        runHighlight();
        var input = document.querySelector('[contenteditable="true"]') || document.querySelector("textarea");
        if (input && !input.dataset.spamListener) {
            input.addEventListener("input", checkPre);
            input.addEventListener("keyup", checkPre); // Tambahan listener agar respon UI mengetik lebih cepat
            input.dataset.spamListener = "true";
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(runHighlight, 1000); // 1 Detik
    setInterval(checkPre, 200);      // 0.2 Detik (Sekarang 5x Lebih Cepat)
})();
