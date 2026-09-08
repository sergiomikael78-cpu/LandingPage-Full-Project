// ==UserScript==
// @name        LiveChat Auto Screenshot & Upload LATOTO
// @namespace   http://tampermonkey.net/
// @version     3.0.5
// @description Screenshot chat LiveChatInc otomatis, Turbo Client-Side Compression, Smart Session Isolation, Multi-layer Chat ID Resolver, Multi-Key Auto-Rotation, Cyber Aero Glassmorphism Dynamic Island HUD, Glass Toasts, Global Hotkey (Alt+S) & Synthesized Audio FX, format [Chat_ID] [Link_Gambar].
// @author      AI Assistant
// @match       https://my.livechatinc.com/*
// @require     https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @grant       GM_setValue
// @grant       GM_getValue
// @connect     api.imgbb.com
// @connect     *
// ==/UserScript==

(function() {
    'use strict';

    // ================= KONFIGURASI ENGINE =================
    // Pool Multi-Key ImgBB Auto-Rotation (Pilar 3: Anti-Limit & Auto-Failover)
    const IMGBB_API_KEYS = [
        'e8b2f32c163d8fca1f35f895ddb753ea', // Primary Key LATOTO
        'c13d8d6411f32a7fa95dbd29584d41e7', // Backup Key 1
        '94246830faadcb054238e8e788c6ee29'  // Backup Key 2
    ];

    const TARGET_SELECTOR = '[data-testid="messages-list"]';
    const POS_STORAGE_KEY = 'latoto_livechat_btn_pos_v3';
    const MODE_STORAGE_KEY = 'latoto_capture_mode_v3'; // 'session' (Sesi Terkini) atau 'full' (Full History)
    const KEY_INDEX_STORAGE_KEY = 'latoto_active_key_idx';
    
    // Konfigurasi Turbo Engine, Smart Crop & Productivity (Pilar 1 - 5)
    const ENGINE_CONFIG = {
        outputFormat: 'image/jpeg',   // 'image/jpeg' atau 'image/webp'
        quality: 0.88,                // Keseimbangan tajam 88% (mengurangi file 80-90% dengan teks super jernih)
        maxDimension: 4096,           // Batas dimensi aman untuk mencegah canvas crash
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Sharp DPI control
        captureMode: localStorage.getItem(MODE_STORAGE_KEY) || 'session', // 'session' | 'full'
        sessionPaddingTop: 20,        // Padding pixel di atas marker session
        maxRetries: 3,                // Jumlah percobaan ulang gateway otomatis (Pilar 3)
        timeoutMs: 15000,             // Timeout per request (15 detik)
        magneticThreshold: 35,        // Jarak magnetis snap ke tepi layar (pixel) (Pilar 4)
        hotkey: { altKey: true, key: 's' }, // Shortcut Keyboard Alt+S (Pilar 5)
        soundEnabled: true            // Synthesized Audio FX (Pilar 5)
    };
    // ======================================================

    // ================= CYBER AERO & GLASSMORPHISM STYLES (PILAR 4 & 5) =================
    const style = document.createElement('style');
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

        /* DYNAMIC ISLAND HUD BUTTON */
        #livechat-ss-btn {
            position: fixed;
            z-index: 999999;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px 8px 14px;
            background: rgba(15, 23, 42, 0.82);
            backdrop-filter: blur(20px) saturate(190%);
            -webkit-backdrop-filter: blur(20px) saturate(190%);
            color: #f8fafc;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.2px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 50px;
            box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.5), 
                        0 0 20px rgba(99, 102, 241, 0.22), 
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
            cursor: grab;
            user-select: none;
            touch-action: none;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), 
                        box-shadow 0.2s ease, 
                        border-color 0.3s ease, 
                        background 0.3s ease;
        }

        #livechat-ss-btn:hover {
            transform: translateY(-2px) scale(1.03);
            border-color: rgba(99, 102, 241, 0.5);
            box-shadow: 0 20px 42px -6px rgba(0, 0, 0, 0.65), 
                        0 0 28px rgba(99, 102, 241, 0.4), 
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        #livechat-ss-btn:active {
            cursor: grabbing !important;
            transform: translateY(1px) scale(0.97);
        }

        #livechat-ss-btn.is-dragging {
            cursor: grabbing !important;
            opacity: 0.92;
            transform: scale(1.06);
            box-shadow: 0 24px 50px -8px rgba(0, 0, 0, 0.7) !important;
            transition: none !important;
        }

        #livechat-ss-btn .btn-grip {
            display: inline-flex;
            opacity: 0.5;
            font-size: 13px;
            color: #94a3b8;
            margin-right: -2px;
            cursor: grab;
        }

        #livechat-ss-btn .btn-icon-wrapper {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
            box-shadow: 0 0 12px rgba(6, 182, 212, 0.4);
            transition: transform 0.3s ease, background 0.3s ease;
        }

        #livechat-ss-btn .btn-icon {
            font-size: 13px;
            color: #ffffff;
        }

        #livechat-ss-btn .btn-label {
            display: inline-block;
            white-space: nowrap;
            font-weight: 700;
            background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        #livechat-ss-btn .btn-mode-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            background: rgba(30, 41, 59, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.4px;
            color: #38bdf8;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        #livechat-ss-btn .btn-mode-tag:hover {
            background: rgba(56, 189, 248, 0.18);
            border-color: rgba(56, 189, 248, 0.4);
            color: #ffffff;
            transform: scale(1.05);
        }

        #livechat-ss-btn .btn-mode-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #38bdf8;
            box-shadow: 0 0 6px #38bdf8;
        }

        #livechat-ss-btn .btn-hotkey-badge {
            font-size: 9.5px;
            color: #64748b;
            background: rgba(255, 255, 255, 0.06);
            padding: 2px 5px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            font-weight: 700;
        }

        /* HUD STATE ANIMATIONS */
        #livechat-ss-btn.state-scanning {
            border-color: rgba(245, 158, 11, 0.6) !important;
            box-shadow: 0 0 25px rgba(245, 158, 11, 0.4) !important;
            cursor: wait !important;
        }
        #livechat-ss-btn.state-scanning .btn-icon-wrapper {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            animation: radarPulse 1.2s infinite ease-in-out;
        }

        #livechat-ss-btn.state-compressing {
            border-color: rgba(168, 85, 247, 0.6) !important;
            box-shadow: 0 0 25px rgba(168, 85, 247, 0.4) !important;
            cursor: wait !important;
        }
        #livechat-ss-btn.state-compressing .btn-icon-wrapper {
            background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%) !important;
            animation: turboSpin 1s infinite linear;
        }

        #livechat-ss-btn.state-syncing {
            border-color: rgba(14, 165, 233, 0.6) !important;
            box-shadow: 0 0 25px rgba(14, 165, 233, 0.4) !important;
            cursor: wait !important;
        }
        #livechat-ss-btn.state-syncing .btn-icon-wrapper {
            background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%) !important;
            animation: orbitalPulse 1.2s infinite alternate;
        }

        #livechat-ss-btn.state-ready {
            border-color: rgba(16, 185, 129, 0.7) !important;
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.5) !important;
        }
        #livechat-ss-btn.state-ready .btn-icon-wrapper {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            animation: successPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes radarPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.15); opacity: 0.85; }
        }
        @keyframes turboSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes orbitalPulse {
            0% { transform: scale(0.95); filter: brightness(1); }
            100% { transform: scale(1.1); filter: brightness(1.3); }
        }
        @keyframes successPop {
            0% { transform: scale(0.7); }
            50% { transform: scale(1.25); }
            100% { transform: scale(1); }
        }

        /* GLASS TOAST NOTIFICATION CONTAINER */
        #latoto-toast-container {
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        }

        .latoto-toast {
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 18px;
            min-width: 280px;
            max-width: 380px;
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 14px;
            box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0,0,0,0.2);
            color: #f8fafc;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12.5px;
            line-height: 1.4;
            transform: translateX(120%);
            opacity: 0;
            transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .latoto-toast.show {
            transform: translateX(0);
            opacity: 1;
        }

        .latoto-toast.hide {
            transform: translateX(120%);
            opacity: 0;
        }

        .latoto-toast-icon {
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .latoto-toast-content {
            flex-grow: 1;
        }

        .latoto-toast-title {
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 2px;
        }

        .latoto-toast-desc {
            color: #94a3b8;
            font-size: 11.5px;
            word-break: break-word;
        }

        .latoto-toast.toast-success {
            border-left: 4px solid #10b981;
        }
        .latoto-toast.toast-success .latoto-toast-title {
            color: #34d399;
        }

        .latoto-toast.toast-error {
            border-left: 4px solid #ef4444;
        }
        .latoto-toast.toast-error .latoto-toast-title {
            color: #f87171;
        }

        .latoto-toast.toast-warning {
            border-left: 4px solid #f59e0b;
        }
        .latoto-toast.toast-warning .latoto-toast-title {
            color: #fbbf24;
        }

        .latoto-toast.toast-info {
            border-left: 4px solid #38bdf8;
        }
        .latoto-toast.toast-info .latoto-toast-title {
            color: #38bdf8;
        }
    `;
    document.head.appendChild(style);

    // ================= SYNTHESIZED AUDIO CHIMES ENGINE (PILAR 5) =================
    const SoundFX = {
        ctx: null,

        getContext: function() {
            if (!this.ctx && typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined') {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return this.ctx;
        },

        /**
         * Nada Chime Sukses Modern (Two-Tone Pleasant Sparkle)
         */
        playSuccess: function() {
            if (!ENGINE_CONFIG.soundEnabled) return;
            try {
                const ctx = this.getContext();
                if (!ctx) return;

                const now = ctx.currentTime;
                
                // Tone 1: C6 (1046.5 Hz)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(1046.5, now);
                gain1.gain.setValueAtTime(0.08, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.25);

                // Tone 2: E6 (1318.5 Hz)
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.5, now + 0.08);
                gain2.gain.setValueAtTime(0.09, now + 0.08);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(now + 0.08);
                osc2.stop(now + 0.4);

            } catch (e) {
                // AudioContext silent fail fallback
            }
        },

        /**
         * Nada Klik / Trigger Halus (Subtle Pop)
         */
        playTrigger: function() {
            if (!ENGINE_CONFIG.soundEnabled) return;
            try {
                const ctx = this.getContext();
                if (!ctx) return;

                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } catch (e) {}
        }
    };

    // ================= GLASS TOAST NOTIFICATION SYSTEM (PILAR 4) =================
    const Toast = {
        container: null,

        init: function() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'latoto-toast-container';
                document.body.appendChild(this.container);
            }
        },

        show: function(type, title, message, duration = 3500) {
            this.init();

            const icons = {
                success: '🎯',
                error: '❌',
                warning: '⚠️',
                info: '⚡'
            };

            const toast = document.createElement('div');
            toast.className = `latoto-toast toast-${type}`;
            toast.innerHTML = `
                <div class="latoto-toast-icon">${icons[type] || '⚡'}</div>
                <div class="latoto-toast-content">
                    <div class="latoto-toast-title">${title}</div>
                    <div class="latoto-toast-desc">${message}</div>
                </div>
            `;

            this.container.appendChild(toast);

            // Animate In
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            // Auto Dismiss
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 400);
            }, duration);
        }
    };

    // ================= MULTI-CLIPBOARD SAFE WRITER (PILAR 5) =================
    const ClipboardManager = {
        copy: function(text) {
            return new Promise((resolve) => {
                try {
                    if (typeof GM_setClipboard === 'function') {
                        GM_setClipboard(text);
                        resolve(true);
                        return;
                    }
                } catch (e) {}

                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text)
                        .then(() => resolve(true))
                        .catch(() => resolve(this.fallbackCopy(text)));
                } else {
                    resolve(this.fallbackCopy(text));
                }
            });
        },

        fallbackCopy: function(text) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                return false;
            }
        }
    };

    // ================= MULTI-LAYER CHAT ID RESOLVER (PILAR 2) =================
    const ChatIdResolver = {
        resolve: function() {
            // Lapis 1: Item aktif di sidebar list
            const activeSidebarItem = document.querySelector(
                'li[data-testid^="chat-item-"][aria-selected="true"], ' +
                'li[data-testid^="chat-item-"][class*="active"], ' +
                'li[data-testid^="chat-item-"][class*="selected"], ' +
                'li.chat-item--active, li.chat-item--selected'
            );
            if (activeSidebarItem) {
                const testId = activeSidebarItem.getAttribute('data-testid') || '';
                const match = testId.match(/chat-item-([^/]+)/i);
                if (match && match[1]) {
                    return match[1];
                }
                if (activeSidebarItem.dataset && activeSidebarItem.dataset.chatId) {
                    return activeSidebarItem.dataset.chatId;
                }
            }

            // Lapis 2: URL Routing Pathname
            const pathPatterns = [
                /\/chats\/(?:[^/]+\/)?([A-Za-z0-9_-]+)/i,
                /\/thread\/([A-Za-z0-9_-]+)/i,
                /\/archives\/([A-Za-z0-9_-]+)/i
            ];
            for (const pattern of pathPatterns) {
                const match = window.location.pathname.match(pattern);
                if (match && match[1] && match[1] !== 'chats') {
                    return match[1];
                }
            }

            // Lapis 3: URL Search Query Params
            const urlParams = new URLSearchParams(window.location.search);
            const queryId = urlParams.get('chat') || urlParams.get('thread') || urlParams.get('chat_id');
            if (queryId) {
                return queryId;
            }

            // Lapis 4: DOM Header / Details Metadata
            const headerElem = document.querySelector('[data-testid="chat-header-title"], [data-testid="chat-details-thread-id"]');
            if (headerElem && headerElem.textContent) {
                const cleanHeader = headerElem.textContent.trim();
                const idMatch = cleanHeader.match(/#?([A-Za-z0-9]{6,})/);
                if (idMatch && idMatch[1]) {
                    return idMatch[1];
                }
            }

            // Fallback Cerdas
            return 'CHAT_' + Date.now().toString(36).toUpperCase();
        }
    };

    // ================= SMART SESSION SCANNER (PILAR 2) =================
    const SessionScanner = {
        findLatestSessionMarker: function(container) {
            if (!container) return null;

            const allElements = container.querySelectorAll('*');
            let latestMarker = null;
            const keywords = [
                'started -',
                'dimulai -',
                'chat started',
                'session started',
                'conversation started',
                'add tag',
                'assigned to'
            ];

            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                const text = (el.textContent || '').toLowerCase().trim();

                for (const kw of keywords) {
                    if (text.includes(kw)) {
                        if (el.children.length <= 5 && text.length < 70) {
                            latestMarker = el;
                        }
                    }
                }
            }

            return latestMarker;
        },

        calculateCropBounds: function(container, marker) {
            if (!marker || !container) {
                return { offsetY: 0, height: container.scrollHeight };
            }

            const containerRect = container.getBoundingClientRect();
            const markerRect = marker.getBoundingClientRect();

            let relativeTop = (markerRect.top - containerRect.top) + container.scrollTop;
            relativeTop = Math.max(0, relativeTop - ENGINE_CONFIG.sessionPaddingTop);

            const croppedHeight = Math.max(200, container.scrollHeight - relativeTop);

            return {
                offsetY: Math.round(relativeTop),
                height: Math.round(croppedHeight)
            };
        }
    };

    // ================= TURBO IMAGE COMPRESSOR & CROP ENGINE (PILAR 1 & 2) =================
    const TurboEngine = {
        compressAndCropDataUrl: function(dataUrl, cropBounds = null, options = {}) {
            return new Promise((resolve, reject) => {
                const startTime = performance.now();
                const format = options.outputFormat || ENGINE_CONFIG.outputFormat;
                const quality = options.quality !== undefined ? options.quality : ENGINE_CONFIG.quality;

                const img = new Image();
                img.crossOrigin = 'anonymous';

                img.onload = function() {
                    try {
                        const originalW = img.naturalWidth || img.width;
                        const originalH = img.naturalHeight || img.height;

                        let sourceX = 0;
                        let sourceY = 0;
                        let sourceW = originalW;
                        let sourceH = originalH;

                        if (cropBounds && cropBounds.offsetY > 0 && cropBounds.height > 0) {
                            const scale = originalH / (cropBounds.offsetY + cropBounds.height);
                            sourceY = Math.min(originalH - 100, Math.round(cropBounds.offsetY * scale));
                            sourceH = Math.min(originalH - sourceY, Math.round(cropBounds.height * scale));
                        }

                        let targetW = sourceW;
                        let targetH = sourceH;

                        if (targetH > ENGINE_CONFIG.maxDimension) {
                            const scaleRatio = ENGINE_CONFIG.maxDimension / targetH;
                            targetW = Math.round(targetW * scaleRatio);
                            targetH = ENGINE_CONFIG.maxDimension;
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = targetW;
                        canvas.height = targetH;

                        const ctx = canvas.getContext('2d', { alpha: false });
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, targetW, targetH);

                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';

                        ctx.drawImage(
                            img,
                            sourceX, sourceY, sourceW, sourceH,
                            0, 0, targetW, targetH
                        );

                        const compressedDataUrl = canvas.toDataURL(format, quality);
                        const cleanBase64 = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");

                        const rawBytes = Math.round((dataUrl.length * 3) / 4);
                        const compBytes = Math.round((compressedDataUrl.length * 3) / 4);
                        const reductionPct = Math.max(0, Math.round(((rawBytes - compBytes) / rawBytes) * 100));
                        const durationMs = Math.round(performance.now() - startTime);

                        console.log(
                            `%c🎯 [Smart TurboEngine v3.0]%c ${rawBytes >= 1024*1024 ? (rawBytes/(1024*1024)).toFixed(2)+'MB' : (rawBytes/1024).toFixed(1)+'KB'} ➔ ${(compBytes/1024).toFixed(1)}KB (${reductionPct}% reduksi) dalam ${durationMs}ms [${ENGINE_CONFIG.captureMode.toUpperCase()}]`,
                            'color:#8b5cf6;font-weight:bold;',
                            'color:#10b981;font-weight:bold;'
                        );

                        resolve({
                            base64: cleanBase64,
                            mimeType: format,
                            rawSizeKB: Math.round(rawBytes / 1024),
                            compressedSizeKB: Math.round(compBytes / 1024),
                            durationMs: durationMs
                        });
                    } catch (err) {
                        console.error('[TurboEngine] Gagal memproses canvas:', err);
                        const rawFallback = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
                        resolve({ base64: rawFallback, mimeType: 'image/png', rawSizeKB: 0, compressedSizeKB: 0, durationMs: 0 });
                    }
                };

                img.onerror = function(e) {
                    reject(new Error('Gagal memuat source gambar ke canvas'));
                };

                img.src = dataUrl;
            });
        }
    };

    // ================= NETWORK RESILIENCE & MULTI-KEY GATEWAY (PILAR 3) =================
    const UploadGateway = {
        currentKeyIndex: parseInt(localStorage.getItem(KEY_INDEX_STORAGE_KEY) || '0', 10) || 0,

        getActiveApiKey: function() {
            if (this.currentKeyIndex >= IMGBB_API_KEYS.length) {
                this.currentKeyIndex = 0;
            }
            return IMGBB_API_KEYS[this.currentKeyIndex];
        },

        rotateToNextKey: function() {
            this.currentKeyIndex = (this.currentKeyIndex + 1) % IMGBB_API_KEYS.length;
            try {
                localStorage.setItem(KEY_INDEX_STORAGE_KEY, this.currentKeyIndex.toString());
            } catch (e) {}
            console.warn(`[UploadGateway] 🔄 Memutar API Key ke Slot #${this.currentKeyIndex + 1}`);
            return this.getActiveApiKey();
        },

        uploadWithResilience: function(base64Image, onStatusUpdate = null) {
            return new Promise((resolve, reject) => {
                let attempt = 0;
                const maxRetries = ENGINE_CONFIG.maxRetries;

                const executeAttempt = () => {
                    attempt++;
                    const currentKey = this.getActiveApiKey();

                    if (onStatusUpdate) {
                        const label = attempt > 1 
                            ? `Syncing (${attempt}/${maxRetries})...` 
                            : 'Syncing to Cloud...';
                        onStatusUpdate(label, attempt);
                    }

                    const formData = new FormData();
                    formData.append('key', currentKey);
                    formData.append('image', base64Image);

                    GM_xmlhttpRequest({
                        method: "POST",
                        url: "https://api.imgbb.com/1/upload",
                        data: formData,
                        timeout: ENGINE_CONFIG.timeoutMs,
                        onload: (response) => {
                            try {
                                const res = JSON.parse(response.responseText);
                                if (res.success && res.data && res.data.url) {
                                    resolve({
                                        url: res.data.url,
                                        deleteUrl: res.data.delete_url,
                                        width: res.data.width,
                                        height: res.data.height,
                                        provider: 'imgbb'
                                    });
                                } else {
                                    const errMsg = res.error ? res.error.message : 'Respons server tidak valid';
                                    this.rotateToNextKey();

                                    if (attempt < maxRetries) {
                                        const delayMs = 600 * Math.pow(1.5, attempt - 1);
                                        setTimeout(executeAttempt, delayMs);
                                    } else {
                                        reject(new Error(errMsg));
                                    }
                                }
                            } catch (err) {
                                if (attempt < maxRetries) {
                                    setTimeout(executeAttempt, 800);
                                } else {
                                    reject(new Error('Gagal memproses respon server'));
                                }
                            }
                        },
                        ontimeout: () => {
                            this.rotateToNextKey();
                            if (attempt < maxRetries) {
                                setTimeout(executeAttempt, 1000);
                            } else {
                                reject(new Error('Koneksi timeout'));
                            }
                        },
                        onerror: (err) => {
                            this.rotateToNextKey();
                            if (attempt < maxRetries) {
                                setTimeout(executeAttempt, 1000);
                            } else {
                                reject(new Error('Gangguan koneksi gateway'));
                            }
                        }
                    });
                };

                executeAttempt();
            });
        }
    };

    // ================= DYNAMIC ISLAND HUD BUTTON (PILAR 4 & 5) =================
    const btn = document.createElement('button');
    btn.id = 'livechat-ss-btn';
    let isCapturing = false;

    updateButtonDisplay();

    function updateButtonDisplay() {
        const isSession = ENGINE_CONFIG.captureMode === 'session';
        const modeLabel = isSession ? 'Sesi' : 'Full';
        const modeTitle = isSession 
            ? 'Mode: Sesi Terkini (Klik untuk beralih ke Full History)' 
            : 'Mode: Full History (Klik untuk beralih ke Sesi Terkini)';

        btn.innerHTML = `
            <span class="btn-grip" title="Tahan & geser untuk memindahkan">⋮⋮</span>
            <div class="btn-icon-wrapper">
                <span class="btn-icon">⚡</span>
            </div>
            <span class="btn-label">Smart Capture</span>
            <span class="btn-hotkey-badge" title="Shortcut Keyboard">Alt+S</span>
            <div class="btn-mode-tag" id="btn-mode-toggle" title="${modeTitle}">
                <span class="btn-mode-dot"></span>
                <span>${modeLabel}</span>
            </div>
        `;
    }

    // Toggle Mode Handler (Sesi vs Full)
    btn.addEventListener('click', (e) => {
        const modeToggle = e.target.closest('#btn-mode-toggle');
        if (modeToggle) {
            e.stopPropagation();
            e.preventDefault();
            SoundFX.playTrigger();
            ENGINE_CONFIG.captureMode = ENGINE_CONFIG.captureMode === 'session' ? 'full' : 'session';
            try {
                localStorage.setItem(MODE_STORAGE_KEY, ENGINE_CONFIG.captureMode);
            } catch (err) {}
            updateButtonDisplay();
            Toast.show(
                'info', 
                'Mode Berubah', 
                `Mode capture diatur ke: <b>${ENGINE_CONFIG.captureMode === 'session' ? 'Sesi Terkini' : 'Full History'}</b>`,
                2500
            );
        }
    });

    // Ambil & Terapkan Posisi Tersimpan (localStorage)
    function applySavedPosition() {
        let pos = null;
        try {
            const raw = localStorage.getItem(POS_STORAGE_KEY);
            if (raw) pos = JSON.parse(raw);
        } catch (e) {}

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        if (pos && typeof pos.top === 'number' && typeof pos.left === 'number') {
            const safeLeft = Math.max(10, Math.min(pos.left, winW - 240));
            const safeTop = Math.max(10, Math.min(pos.top, winH - 55));
            btn.style.left = safeLeft + 'px';
            btn.style.top = safeTop + 'px';
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
        } else {
            // Posisi Default: Pojok Kanan Bawah
            btn.style.right = '80px';
            btn.style.bottom = '25px';
            btn.style.left = 'auto';
            btn.style.top = 'auto';
        }
    }

    applySavedPosition();
    document.body.appendChild(btn);

    // ================= MAGNETIC DRAGGABLE (PILAR 4) =================
    let isPointerDown = false;
    let hasDragged = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const DRAG_THRESHOLD = 5;

    function onPointerDown(e) {
        if (e.button !== 0 && e.type === 'mousedown') return;
        if (e.target.closest('#btn-mode-toggle')) return;

        isPointerDown = true;
        hasDragged = false;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        startX = clientX;
        startY = clientY;

        const rect = btn.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        btn.style.left = startLeft + 'px';
        btn.style.top = startTop + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';

        window.addEventListener('mousemove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isPointerDown) return;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        if (!hasDragged && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
            hasDragged = true;
            btn.classList.add('is-dragging');
        }

        if (hasDragged) {
            if (e.cancelable) e.preventDefault();

            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const btnW = btn.offsetWidth;
            const btnH = btn.offsetHeight;

            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;

            newLeft = Math.max(10, Math.min(newLeft, winW - btnW - 10));
            newTop = Math.max(10, Math.min(newTop, winH - btnH - 10));

            btn.style.left = newLeft + 'px';
            btn.style.top = newTop + 'px';
        }
    }

    function onPointerUp() {
        if (!isPointerDown) return;
        isPointerDown = false;

        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);

        if (hasDragged) {
            btn.classList.remove('is-dragging');
            const rect = btn.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const btnW = btn.offsetWidth;
            const btnH = btn.offsetHeight;

            let finalLeft = rect.left;
            let finalTop = rect.top;

            // Magnetic Snap ke Tepi Kiri / Kanan (Pilar 4)
            if (finalLeft < ENGINE_CONFIG.magneticThreshold) {
                finalLeft = 14;
            } else if (winW - (finalLeft + btnW) < ENGINE_CONFIG.magneticThreshold) {
                finalLeft = winW - btnW - 14;
            }

            if (finalTop < ENGINE_CONFIG.magneticThreshold) {
                finalTop = 14;
            } else if (winH - (finalTop + btnH) < ENGINE_CONFIG.magneticThreshold) {
                finalTop = winH - btnH - 14;
            }

            btn.style.left = finalLeft + 'px';
            btn.style.top = finalTop + 'px';

            try {
                localStorage.setItem(POS_STORAGE_KEY, JSON.stringify({
                    left: Math.round(finalLeft),
                    top: Math.round(finalTop)
                }));
            } catch (err) {}
        }
    }

    btn.addEventListener('mousedown', onPointerDown);
    btn.addEventListener('touchstart', onPointerDown, { passive: true });

    window.addEventListener('resize', () => {
        const rect = btn.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const btnW = btn.offsetWidth;
        const btnH = btn.offsetHeight;

        let adjustedLeft = Math.max(10, Math.min(rect.left, winW - btnW - 10));
        let adjustedTop = Math.max(10, Math.min(rect.top, winH - btnH - 10));

        btn.style.left = adjustedLeft + 'px';
        btn.style.top = adjustedTop + 'px';
    });

    // ================= CORE EXECUTION PIPELINE (PILAR 1 - 5) =================
    async function executeSmartCapture() {
        if (isCapturing) return;

        const targetElement = document.querySelector(TARGET_SELECTOR);
        if (!targetElement) {
            Toast.show('warning', 'Chat Tidak Ditemukan', 'Silakan pilih atau buka ruang chat terlebih dahulu.');
            return;
        }

        isCapturing = true;
        btn.disabled = true;
        SoundFX.playTrigger();

        // Tampilan status 1: Scanning DOM
        setBtnState('scanning', '🧬', 'Scanning Chat...');
        targetElement.scrollTop = targetElement.scrollHeight;

        // Pindai Pemisah Sesi jika Mode 'session' aktif
        let cropBounds = null;
        if (ENGINE_CONFIG.captureMode === 'session') {
            const marker = SessionScanner.findLatestSessionMarker(targetElement);
            if (marker) {
                cropBounds = SessionScanner.calculateCropBounds(targetElement, marker);
            }
        }

        try {
            const rawDataUrl = await htmlToImage.toPng(targetElement, {
                backgroundColor: '#ffffff',
                height: targetElement.scrollHeight,
                width: targetElement.scrollWidth,
                skipAutoScale: true,
                cacheBust: true,
                pixelRatio: ENGINE_CONFIG.pixelRatio,
                style: {
                    overflow: 'visible',
                    maxHeight: 'none',
                    transform: 'translateY(0)'
                }
            });

            // Tampilan status 2: Turbo Compression & Smart Crop
            setBtnState('compressing', '⚡', 'Turbo Compressing...');

            // Kompresi instan + Smart Crop via Canvas Engine
            const compressedResult = await TurboEngine.compressAndCropDataUrl(rawDataUrl, cropBounds);

            // Tampilan status 3: Resilient Gateway Upload (Pilar 3)
            setBtnState('syncing', '🛰️', 'Syncing to Cloud...');

            const uploadResult = await UploadGateway.uploadWithResilience(
                compressedResult.base64,
                (statusLabel) => {
                    setBtnState('syncing', '🛰️', statusLabel);
                }
            );

            // Ekstraksi Chat ID 4 Lapis (Pilar 2)
            const chatId = ChatIdResolver.resolve();

            // FORMAT: [Chat_ID] [Link_Gambar_ImgBB]
            const formattedText = `${chatId} ${uploadResult.url}`;
            
            // Clipboard Safe Copy (Pilar 5)
            await ClipboardManager.copy(formattedText);

            // Audio FX Success Chime (Pilar 5)
            SoundFX.playSuccess();

            // Tampilan status 4: Ready (Pilar 4)
            setBtnState('ready', '🎯', 'Ready to Paste!');
            Toast.show(
                'success',
                'Capture Berhasil!',
                `ID: <b>${chatId}</b> disalin ke clipboard beserta link gambar.`
            );

            setTimeout(resetButton, 3200);

        } catch (error) {
            console.error('Capture/Upload Error:', error);
            Toast.show('error', 'Gagal Memproses', error.message || 'Terjadi kesalahan saat upload.');
            resetButton();
        }
    }

    btn.addEventListener('click', (e) => {
        if (hasDragged || e.target.closest('#btn-mode-toggle')) {
            return;
        }
        executeSmartCapture();
    });

    // ================= GLOBAL HOTKEY LISTENER: Alt + S (PILAR 5) =================
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Hotkey] Alt+S ditekan -> Memulai Smart Capture...');
            executeSmartCapture();
        }
    }, true);

    function setBtnState(stateClass, icon, label) {
        btn.className = '';
        if (stateClass) btn.classList.add('state-' + stateClass);
        btn.innerHTML = `
            <span class="btn-grip">⋮⋮</span>
            <div class="btn-icon-wrapper">
                <span class="btn-icon">${icon}</span>
            </div>
            <span class="btn-label">${label}</span>
        `;
    }

    function resetButton() {
        btn.className = '';
        updateButtonDisplay();
        btn.disabled = false;
        isCapturing = false;
    }
})();
