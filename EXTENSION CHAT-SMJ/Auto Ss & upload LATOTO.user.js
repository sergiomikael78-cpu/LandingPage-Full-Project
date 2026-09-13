// ==UserScript==
// @name        LiveChat Auto Screenshot & Upload LATOTO
// @namespace   http://tampermonkey.net/
// @version     3.1.0
// @description Screenshot chat LiveChatInc otomatis, Turbo Client-Side Compression, Smart Session Isolation, Multi-layer Chat ID Resolver, Multi-Key Auto-Rotation, Dual Engine (ImgBB + Catbox) Smart Circuit-Breaker, Cyber Aero Dynamic Island HUD, Glass Toasts, Global Hotkey (Alt+S) & Synthesized Audio FX, format [Chat_ID] [Link_Gambar].
// @author      AI Assistant
// @match       https://my.livechatinc.com/*
// @require     https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @grant       GM_setValue
// @grant       GM_getValue
// @connect     api.imgbb.com
// @connect     catbox.moe
// @connect     *
// ==/UserScript==

(function() {
    'use strict';

    // ================= KONFIGURASI ENGINE & STORAGE MANAGER (PILAR 3 & TAHAP 1) =================
    const DEFAULT_IMGBB_KEYS = [
        'e8a519176219fd884b7fd29a86ff47ed', // Primary Key LATOTO
        '5ffd1659f713a244dbd132d851e0325c', // Backup Key 1
        '501c30af8a70e1a18c153a34c136801a'  // Backup Key 2
    ];

    const TARGET_SELECTOR = '[data-testid="messages-list"]';
    const POS_STORAGE_KEY = 'latoto_livechat_btn_pos_v3';
    const MODE_STORAGE_KEY = 'latoto_capture_mode_v3'; // 'session' (Sesi Terkini) atau 'full' (Full History)
    const KEY_INDEX_STORAGE_KEY = 'latoto_active_key_idx';

    const STORAGE_KEYS = {
        imgbbKeys: 'latoto_imgbb_keys_v3',
        catboxUserhash: 'latoto_catbox_userhash_v3',
        activeProvider: 'latoto_active_provider_v3', // 'auto' | 'imgbb' | 'catbox'
        circuitCooldown: 'latoto_circuit_cooldown_v3'
    };

    // Dynamic Configuration & Storage Manager
    const SettingsManager = {
        getStoredValue: function(key, fallback) {
            try {
                if (typeof GM_getValue === 'function') {
                    const val = GM_getValue(key, null);
                    if (val !== null && val !== undefined) return val;
                }
            } catch (e) {}
            try {
                const localVal = localStorage.getItem(key);
                if (localVal !== null && localVal !== undefined) return JSON.parse(localVal);
            } catch (e) {}
            return fallback;
        },

        setStoredValue: function(key, value) {
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(key, value);
                }
            } catch (e) {}
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {}
        },

        getImgBBKeys: function() {
            const saved = this.getStoredValue(STORAGE_KEYS.imgbbKeys, null);
            if (Array.isArray(saved) && saved.length > 0) {
                return saved;
            }
            return DEFAULT_IMGBB_KEYS;
        },

        saveImgBBKeys: function(keys) {
            let cleanKeys = [];
            if (Array.isArray(keys)) {
                cleanKeys = keys.map(k => (k || '').trim()).filter(k => k.length > 0);
            } else if (typeof keys === 'string') {
                cleanKeys = keys.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
            }
            if (cleanKeys.length === 0) {
                cleanKeys = [...DEFAULT_IMGBB_KEYS];
            }
            this.setStoredValue(STORAGE_KEYS.imgbbKeys, cleanKeys);
            return cleanKeys;
        },

        getCatboxUserhash: function() {
            return (this.getStoredValue(STORAGE_KEYS.catboxUserhash, '') || '').trim();
        },

        saveCatboxUserhash: function(hash) {
            const cleanHash = (hash || '').trim();
            this.setStoredValue(STORAGE_KEYS.catboxUserhash, cleanHash);
            return cleanHash;
        },

        getActiveProvider: function() {
            return this.getStoredValue(STORAGE_KEYS.activeProvider, 'auto');
        },

        saveActiveProvider: function(provider) {
            const valid = ['auto', 'imgbb', 'catbox'].includes(provider) ? provider : 'auto';
            this.setStoredValue(STORAGE_KEYS.activeProvider, valid);
            return valid;
        },

        getCircuitState: function() {
            const raw = this.getStoredValue(STORAGE_KEYS.circuitCooldown, null);
            if (!raw || typeof raw !== 'object') {
                return { state: 'CLOSED', cooldownUntil: 0, reason: '' };
            }
            const now = Date.now();
            if (raw.cooldownUntil && now < raw.cooldownUntil) {
                return { state: 'OPEN', cooldownUntil: raw.cooldownUntil, reason: raw.reason || 'Cooldown ImgBB Aktif' };
            }
            return { state: 'CLOSED', cooldownUntil: 0, reason: '' };
        },

        tripCircuit: function(reason, durationMs = 5 * 60 * 1000) {
            const cooldownUntil = Date.now() + durationMs;
            this.setStoredValue(STORAGE_KEYS.circuitCooldown, {
                state: 'OPEN',
                cooldownUntil: cooldownUntil,
                reason: reason || 'Gangguan Server ImgBB'
            });
            console.warn(`[CircuitBreaker] ⚡ Circuit TRIP: ${reason}. Cooldown hingga ${new Date(cooldownUntil).toLocaleTimeString()}`);
        },

        resetCircuit: function() {
            this.setStoredValue(STORAGE_KEYS.circuitCooldown, {
                state: 'CLOSED',
                cooldownUntil: 0,
                reason: ''
            });
            console.log('[CircuitBreaker] 🟢 Circuit RESET: ImgBB kembali normal.');
        },

        resetAllToDefault: function() {
            this.setStoredValue(STORAGE_KEYS.imgbbKeys, DEFAULT_IMGBB_KEYS);
            this.setStoredValue(STORAGE_KEYS.catboxUserhash, '');
            this.setStoredValue(STORAGE_KEYS.activeProvider, 'auto');
            this.resetCircuit();
        }
    };
    
    // Konfigurasi Turbo Engine, Smart Crop & Productivity (Pilar 1 - 5)
    const ENGINE_CONFIG = {
        outputFormat: 'image/jpeg',   // 'image/jpeg' atau 'image/webp'
        quality: 0.88,                // Keseimbangan tajam 88% (mengurangi file 80-90% dengan teks super jernih)
        maxDimension: 4096,           // Batas dimensi aman untuk mencegah canvas crash
        pixelRatio: 1.3,              // Optimal Turbo DPI (sangat tajam, memangkas 55% beban render GPU/CPU)
        captureMode: localStorage.getItem(MODE_STORAGE_KEY) || 'session', // 'session' | 'full'
        sessionPaddingTop: 35,        // Jarak padding pixel elegan di atas marker session
        sessionPaddingBottom: 35,     // Jarak padding pixel di bawah chat terakhir agar tidak terpotong
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

        /* SETTINGS BUTTON IN HUD */
        #livechat-ss-btn .btn-settings-tag {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(30, 41, 59, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        #livechat-ss-btn .btn-settings-tag:hover {
            background: rgba(99, 102, 241, 0.35);
            border-color: rgba(99, 102, 241, 0.6);
            transform: rotate(90deg) scale(1.18);
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
        }

        /* CYBER AERO SETTINGS MODAL (TAHAP 1) */
        #latoto-settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(5, 7, 15, 0.78);
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            z-index: 1000005;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #latoto-settings-overlay.is-active {
            opacity: 1;
            pointer-events: auto;
        }

        #latoto-settings-dialog {
            width: 100%;
            max-width: 520px;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 24px;
            box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.85),
                        0 0 35px rgba(99, 102, 241, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
            color: #f8fafc;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
            transform: scale(0.92) translateY(20px);
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        #latoto-settings-overlay.is-active #latoto-settings-dialog {
            transform: scale(1) translateY(0);
        }

        .settings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(30, 41, 59, 0.4);
        }

        .settings-title-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .settings-header-icon {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 17px;
            box-shadow: 0 0 15px rgba(6, 182, 212, 0.35);
        }

        .settings-title {
            font-size: 15px;
            font-weight: 800;
            color: #ffffff;
            margin: 0;
            letter-spacing: -0.2px;
        }

        .settings-subtitle {
            font-size: 11px;
            color: #94a3b8;
            margin: 2px 0 0 0;
        }

        .settings-close-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .settings-close-btn:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.4);
            color: #ef4444;
            transform: scale(1.1);
        }

        .settings-body {
            padding: 20px 24px;
            max-height: 65vh;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .settings-body::-webkit-scrollbar {
            width: 6px;
        }
        .settings-body::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
        }
        .settings-body::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 10px;
        }

        /* LIVE STATUS CARD */
        .gateway-status-card {
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .status-badge-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 600;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }

        .status-dot.dot-online {
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
        }

        .status-dot.dot-warning {
            background: #f59e0b;
            box-shadow: 0 0 8px #f59e0b;
            animation: radarPulse 1.2s infinite ease-in-out;
        }

        .status-dot.dot-offline {
            background: #ef4444;
            box-shadow: 0 0 8px #ef4444;
        }

        .btn-status-reset {
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.35);
            color: #818cf8;
            font-size: 11px;
            font-weight: 700;
            padding: 5px 11px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-status-reset:hover {
            background: rgba(99, 102, 241, 0.3);
            color: #ffffff;
            transform: translateY(-1px);
        }

        /* FORM CONTROLS */
        .settings-field-group {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }

        .settings-label {
            font-size: 12px;
            font-weight: 700;
            color: #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .settings-label-hint {
            font-size: 11px;
            font-weight: 500;
            color: #94a3b8;
        }

        .settings-input-text, .settings-textarea {
            width: 100%;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 9px 13px;
            color: #f8fafc;
            font-family: inherit;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            box-sizing: border-box;
        }

        .settings-textarea {
            min-height: 80px;
            resize: vertical;
            line-height: 1.45;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11.5px;
        }

        .settings-input-text:focus, .settings-textarea:focus {
            border-color: #6366f1;
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
        }

        /* PROVIDER SELECTOR GRID */
        .provider-selector-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }

        .provider-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 9px 6px;
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            user-select: none;
        }

        .provider-option:hover {
            background: rgba(51, 65, 85, 0.6);
            border-color: rgba(255, 255, 255, 0.18);
        }

        .provider-option.is-selected {
            background: rgba(99, 102, 241, 0.22);
            border-color: #6366f1;
            box-shadow: 0 0 14px rgba(99, 102, 241, 0.25);
        }

        .provider-option-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #ffffff;
        }

        .provider-option-desc {
            font-size: 9.5px;
            color: #94a3b8;
        }

        /* MODAL FOOTER */
        .settings-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(30, 41, 59, 0.4);
        }

        .btn-action-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .btn-settings-save {
            padding: 7px 16px;
            background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            color: #ffffff;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .btn-settings-save:hover {
            transform: translateY(-1px) scale(1.02);
            box-shadow: 0 6px 18px rgba(6, 182, 212, 0.5);
        }

        .btn-settings-reset {
            padding: 7px 12px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            color: #94a3b8;
            font-weight: 600;
            font-size: 11.5px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-settings-reset:hover {
            background: rgba(255, 255, 255, 0.12);
            color: #ffffff;
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
         * Pre-warm AudioContext on hover / initial interaction (0ms cold start lag)
         */
        warmup: function() {
            try {
                this.getContext();
            } catch (e) {}
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

    // ================= CYBER AERO SETTINGS MODAL (TAHAP 1) =================
    const SettingsModal = {
        overlay: null,

        init: function() {
            if (this.overlay) return;

            this.overlay = document.createElement('div');
            this.overlay.id = 'latoto-settings-overlay';
            this.overlay.innerHTML = `
                <div id="latoto-settings-dialog" role="dialog" aria-modal="true">
                    <!-- HEADER -->
                    <div class="settings-header">
                        <div class="settings-title-wrapper">
                            <div class="settings-header-icon">⚙️</div>
                            <div>
                                <h3 class="settings-title">Executive Cloud Control</h3>
                                <p class="settings-subtitle">Pengaturan API Key & Multi-Provider Gateway LATOTO</p>
                            </div>
                        </div>
                        <button class="settings-close-btn" id="modal-close-x" title="Tutup">✕</button>
                    </div>

                    <!-- BODY -->
                    <div class="settings-body">
                        <!-- STATUS MONITOR CARD -->
                        <div class="gateway-status-card">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div class="status-badge-item">
                                    <span class="status-dot" id="status-imgbb-dot"></span>
                                    <span>ImgBB Gateway: <b id="status-imgbb-text">Checking...</b></span>
                                </div>
                                <div class="status-badge-item" style="color: #94a3b8; font-size: 11px;">
                                    <span class="status-dot dot-online"></span>
                                    <span>Catbox Cloud: <b style="color: #38bdf8;">Ready (High-Speed)</b></span>
                                </div>
                            </div>
                            <button class="btn-status-reset" id="btn-force-reset-circuit" title="Reset status cooldown ImgBB">⚡ Reset Circuit</button>
                        </div>

                        <!-- PROVIDER ROUTING MODE -->
                        <div class="settings-field-group">
                            <label class="settings-label">
                                <span>Mode Routing Gateway</span>
                                <span class="settings-label-hint">Pilih alur upload</span>
                            </label>
                            <div class="provider-selector-grid">
                                <div class="provider-option" data-provider="auto">
                                    <span style="font-size: 16px;">⚡</span>
                                    <span class="provider-option-title">Auto Smart</span>
                                    <span class="provider-option-desc">ImgBB ➔ Catbox Failover</span>
                                </div>
                                <div class="provider-option" data-provider="imgbb">
                                    <span style="font-size: 16px;">🖼️</span>
                                    <span class="provider-option-title">ImgBB Only</span>
                                    <span class="provider-option-desc">Hanya gunakan ImgBB</span>
                                </div>
                                <div class="provider-option" data-provider="catbox">
                                    <span style="font-size: 16px;">🐱</span>
                                    <span class="provider-option-title">Catbox Only</span>
                                    <span class="provider-option-desc">Langsung ke Catbox</span>
                                </div>
                            </div>
                        </div>

                        <!-- IMGBB API KEYS -->
                        <div class="settings-field-group">
                            <label class="settings-label">
                                <span>ImgBB API Key List</span>
                                <span class="settings-label-hint" id="imgbb-key-count">3 Key Aktif</span>
                            </label>
                            <textarea 
                                class="settings-textarea" 
                                id="input-imgbb-keys" 
                                placeholder="Masukkan satu API Key per baris...&#10;Contoh:&#10;e8a519176219fd884b7fd29a86ff47ed&#10;5ffd1659f713a244dbd132d851e0325c"
                                spellcheck="false"
                            ></textarea>
                            <div style="font-size: 10.5px; color: #64748b; line-height: 1.3;">
                                💡 Tip: Masukkan beberapa API Key (1 baris per key). Sistem memutar key otomatis jika salah satu limit.
                            </div>
                        </div>

                        <!-- CATBOX USERHASH -->
                        <div class="settings-field-group">
                            <label class="settings-label">
                                <span>Catbox Userhash (Opsional)</span>
                                <a href="https://catbox.moe/user/manage.php" target="_blank" style="color: #38bdf8; font-size: 11px; text-decoration: none;">Dapatkan Userhash ↗</a>
                            </label>
                            <input 
                                type="text" 
                                class="settings-input-text" 
                                id="input-catbox-userhash" 
                                placeholder="Kosongkan untuk mode Anonymous (100% Gratis & Langsung Pakai)"
                                autocomplete="off"
                            />
                        </div>
                    </div>

                    <!-- FOOTER ACTIONS -->
                    <div class="settings-footer">
                        <button class="btn-settings-reset" id="btn-modal-reset-default">🔄 Reset Default</button>
                        <div class="btn-action-group">
                            <button class="btn-settings-reset" id="btn-modal-cancel">Batal</button>
                            <button class="btn-settings-save" id="btn-modal-save">💾 Simpan Perubahan</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.overlay);
            this.bindEvents();
        },

        bindEvents: function() {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });

            this.overlay.querySelector('#modal-close-x').addEventListener('click', () => this.close());
            this.overlay.querySelector('#btn-modal-cancel').addEventListener('click', () => this.close());

            // Provider selection
            const providerOptions = this.overlay.querySelectorAll('.provider-option');
            providerOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    providerOptions.forEach(o => o.classList.remove('is-selected'));
                    opt.classList.add('is-selected');
                });
            });

            // Force reset circuit button
            this.overlay.querySelector('#btn-force-reset-circuit').addEventListener('click', () => {
                SettingsManager.resetCircuit();
                SoundFX.playTrigger();
                this.updateLiveStatusDisplay();
                Toast.show('success', 'Circuit Direset', 'Status gateway ImgBB telah dikembalikan ke Normal.');
            });

            // Reset Default button
            this.overlay.querySelector('#btn-modal-reset-default').addEventListener('click', () => {
                if (confirm('Kembalikan semua pengaturan API Key ke bawaan sistem?')) {
                    SettingsManager.resetAllToDefault();
                    this.populateForm();
                    SoundFX.playTrigger();
                    Toast.show('info', 'Reset Berhasil', 'Pengaturan telah dikembalikan ke default.');
                }
            });

            // Save button
            this.overlay.querySelector('#btn-modal-save').addEventListener('click', () => {
                const keysRaw = this.overlay.querySelector('#input-imgbb-keys').value;
                const catboxHash = this.overlay.querySelector('#input-catbox-userhash').value;
                const selectedProvider = this.overlay.querySelector('.provider-option.is-selected')?.dataset.provider || 'auto';

                const savedKeys = SettingsManager.saveImgBBKeys(keysRaw);
                SettingsManager.saveCatboxUserhash(catboxHash);
                SettingsManager.saveActiveProvider(selectedProvider);

                SoundFX.playSuccess();
                Toast.show(
                    'success', 
                    'Pengaturan Tersimpan!', 
                    `Berhasil menyimpan <b>${savedKeys.length} API Key</b> & Mode <b>${selectedProvider.toUpperCase()}</b>.`,
                    3000
                );
                this.close();
            });
        },

        updateLiveStatusDisplay: function() {
            const circuit = SettingsManager.getCircuitState();
            const dot = this.overlay.querySelector('#status-imgbb-dot');
            const text = this.overlay.querySelector('#status-imgbb-text');

            if (circuit.state === 'OPEN') {
                dot.className = 'status-dot dot-warning';
                const remainingSec = Math.max(0, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
                text.innerHTML = `<span style="color: #fbbf24;">Cooldown (${remainingSec}s)</span> - ${circuit.reason}`;
            } else {
                dot.className = 'status-dot dot-online';
                text.innerHTML = '<span style="color: #34d399;">Normal & Siap</span>';
            }
        },

        populateForm: function() {
            const keys = SettingsManager.getImgBBKeys();
            this.overlay.querySelector('#input-imgbb-keys').value = keys.join('\n');
            this.overlay.querySelector('#imgbb-key-count').textContent = `${keys.length} Key Terdaftar`;
            this.overlay.querySelector('#input-catbox-userhash').value = SettingsManager.getCatboxUserhash();

            const activeProvider = SettingsManager.getActiveProvider();
            const providerOptions = this.overlay.querySelectorAll('.provider-option');
            providerOptions.forEach(opt => {
                if (opt.dataset.provider === activeProvider) {
                    opt.classList.add('is-selected');
                } else {
                    opt.classList.remove('is-selected');
                }
            });

            this.updateLiveStatusDisplay();
        },

        open: function() {
            this.init();
            this.populateForm();
            this.overlay.classList.add('is-active');
            SoundFX.playTrigger();
        },

        close: function() {
            if (this.overlay) {
                this.overlay.classList.remove('is-active');
            }
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
            const totalScrollHeight = Math.max(container ? container.scrollHeight : 0, container ? container.offsetHeight : 0, 200);
            
            if (!marker || !container) {
                return { 
                    offsetY: 0, 
                    height: totalScrollHeight,
                    totalHeight: totalScrollHeight
                };
            }

            const containerRect = container.getBoundingClientRect();
            const markerRect = marker.getBoundingClientRect();

            const paddingTop = ENGINE_CONFIG.sessionPaddingTop || 35;

            let relativeTop = (markerRect.top - containerRect.top) + container.scrollTop;
            relativeTop = Math.max(0, relativeTop - paddingTop);

            const croppedHeight = Math.max(150, totalScrollHeight - relativeTop);

            return {
                offsetY: Math.round(relativeTop),
                height: Math.round(croppedHeight),
                totalHeight: totalScrollHeight
            };
        }
    };

    // ================= TURBO IMAGE COMPRESSOR & CANVAS ENGINE (PILAR 1 & 2) =================
    const TurboEngine = {
        /**
         * Direct Canvas Slicing & Turbo Compression (Zero Intermediate PNG Overhead)
         * Menerima HTMLCanvasElement langsung dari htmlToImage.toCanvas,
         * melakukan crop & kompresi dalam 1 draw call tanpa decode DataURL perantara.
         */
        compressAndCropCanvas: function(sourceCanvas, cropBounds = null, options = {}) {
            return new Promise((resolve) => {
                const startTime = performance.now();
                const format = options.outputFormat || ENGINE_CONFIG.outputFormat;
                const quality = options.quality !== undefined ? options.quality : ENGINE_CONFIG.quality;

                try {
                    const originalW = sourceCanvas.width;
                    const originalH = sourceCanvas.height;

                    let sourceX = 0;
                    let sourceY = 0;
                    let sourceW = originalW;
                    let sourceH = originalH;

                    if (cropBounds && cropBounds.offsetY >= 0 && cropBounds.height > 0) {
                        const totalH = cropBounds.totalHeight || (cropBounds.offsetY + cropBounds.height);
                        const scaleY = originalH / totalH;
                        sourceY = Math.max(0, Math.round(cropBounds.offsetY * scaleY));
                        sourceH = Math.min(originalH - sourceY, Math.round(cropBounds.height * scaleY));
                    }

                    let targetW = sourceW;
                    let targetH = sourceH;

                    if (targetH > ENGINE_CONFIG.maxDimension) {
                        const scaleRatio = ENGINE_CONFIG.maxDimension / targetH;
                        targetW = Math.round(targetW * scaleRatio);
                        targetH = ENGINE_CONFIG.maxDimension;
                    }

                    const targetCanvas = document.createElement('canvas');
                    targetCanvas.width = targetW;
                    targetCanvas.height = targetH;

                    const ctx = targetCanvas.getContext('2d', { alpha: false, desynchronized: true });
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, targetW, targetH);

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // Direct single-pass canvas copy (Blazing Fast)
                    ctx.drawImage(
                        sourceCanvas,
                        sourceX, sourceY, sourceW, sourceH,
                        0, 0, targetW, targetH
                    );

                    const compressedDataUrl = targetCanvas.toDataURL(format, quality);
                    const cleanBase64 = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");

                    const compBytes = Math.round((cleanBase64.length * 3) / 4);
                    const durationMs = Math.round(performance.now() - startTime);

                    console.log(
                        `%c⚡ [TurboCanvas Engine]%c ${(compBytes/1024).toFixed(1)}KB dalam ${durationMs}ms [${ENGINE_CONFIG.captureMode.toUpperCase()}]`,
                        'color:#8b5cf6;font-weight:bold;',
                        'color:#10b981;font-weight:bold;'
                    );

                    resolve({
                        base64: cleanBase64,
                        mimeType: format,
                        compressedSizeKB: Math.round(compBytes / 1024),
                        durationMs: durationMs
                    });
                } catch (err) {
                    console.error('[TurboEngine] Gagal memproses canvas langsung:', err);
                    const fallbackDataUrl = sourceCanvas.toDataURL('image/png');
                    const cleanFallback = fallbackDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
                    resolve({ base64: cleanFallback, mimeType: 'image/png', compressedSizeKB: 0, durationMs: 0 });
                }
            });
        }
    };

    // ================= NETWORK RESILIENCE & MULTI-PROVIDER GATEWAY (PILAR 3 & TAHAP 2) =================
    const UploadGateway = {
        currentKeyIndex: parseInt(localStorage.getItem(KEY_INDEX_STORAGE_KEY) || '0', 10) || 0,

        getActiveApiKey: function() {
            const keys = SettingsManager.getImgBBKeys();
            if (this.currentKeyIndex >= keys.length) {
                this.currentKeyIndex = 0;
            }
            return keys[this.currentKeyIndex] || DEFAULT_IMGBB_KEYS[0];
        },

        rotateToNextKey: function() {
            const keys = SettingsManager.getImgBBKeys();
            this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
            try {
                localStorage.setItem(KEY_INDEX_STORAGE_KEY, this.currentKeyIndex.toString());
            } catch (e) {}
            console.warn(`[UploadGateway] 🔄 Memutar API Key ke Slot #${this.currentKeyIndex + 1} (${(keys[this.currentKeyIndex] || '').slice(0, 6)}...)`);
            return this.getActiveApiKey();
        },

        base64ToBlob: function(base64, mimeType = 'image/jpeg') {
            const byteCharacters = atob(base64);
            const byteArrays = [];
            const sliceSize = 512;
            for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                const slice = byteCharacters.slice(offset, offset + sliceSize);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                byteArrays.push(new Uint8Array(byteNumbers));
            }
            return new Blob(byteArrays, { type: mimeType });
        },

        /**
         * Engine Upload Catbox (https://catbox.moe/user/api.php)
         * Mendukung Anonymous (100% Gratis & Instan) maupun dengan Userhash akun pribadi.
         */
        uploadToCatbox: function(base64Image, onStatusUpdate = null) {
            return new Promise((resolve, reject) => {
                if (onStatusUpdate) onStatusUpdate('🐱 Syncing to Catbox Cloud...');

                try {
                    const blob = this.base64ToBlob(base64Image, ENGINE_CONFIG.outputFormat || 'image/jpeg');
                    const formData = new FormData();
                    formData.append('reqtype', 'fileupload');
                    
                    const userhash = SettingsManager.getCatboxUserhash();
                    if (userhash) {
                        formData.append('userhash', userhash);
                    }
                    
                    formData.append('fileToUpload', blob, `livechat_${Date.now()}.jpg`);

                    GM_xmlhttpRequest({
                        method: "POST",
                        url: "https://catbox.moe/user/api.php",
                        data: formData,
                        timeout: ENGINE_CONFIG.timeoutMs,
                        onload: (response) => {
                            try {
                                const resText = (response.responseText || '').trim();
                                if (response.status === 200 && resText.startsWith('http')) {
                                    console.log(`%c[UploadGateway] 🐱 Catbox Upload Sukses: ${resText}`, 'color:#06b6d4;font-weight:bold;');
                                    resolve({
                                        url: resText,
                                        provider: 'catbox'
                                    });
                                } else {
                                    reject(new Error(resText || `Gagal upload ke Catbox (HTTP ${response.status})`));
                                }
                            } catch (e) {
                                reject(new Error('Gagal memproses respons Catbox: ' + e.message));
                            }
                        },
                        ontimeout: () => {
                            reject(new Error('Koneksi ke Catbox timeout (15s)'));
                        },
                        onerror: (err) => {
                            reject(new Error('Gangguan koneksi ke Catbox'));
                        }
                    });
                } catch (err) {
                    reject(new Error('Gagal memformat payload gambar Catbox: ' + err.message));
                }
            });
        },

        /**
         * Engine Upload ImgBB dengan Multi-Key Auto-Rotation & Diagnostic Status Detection
         */
        uploadToImgBB: function(base64Image, onStatusUpdate = null) {
            return new Promise((resolve, reject) => {
                let attempt = 0;
                const keys = SettingsManager.getImgBBKeys();
                const maxRetries = Math.min(ENGINE_CONFIG.maxRetries, keys.length * 2);

                const executeAttempt = () => {
                    attempt++;
                    const currentKey = this.getActiveApiKey();

                    if (onStatusUpdate) {
                        const label = attempt > 1 
                            ? `🖼️ ImgBB Sync (${attempt}/${maxRetries})...` 
                            : '🖼️ Syncing to ImgBB...';
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
                                const status = response.status;
                                if (status >= 500) {
                                    // Server ImgBB Down / Maintenance
                                    const errDiag = `Server ImgBB Maintenance / Error (HTTP ${status})`;
                                    reject({ diagnostic: errDiag, isServerDown: true });
                                    return;
                                }

                                const res = JSON.parse(response.responseText);
                                if (res.success && res.data && res.data.url) {
                                    console.log(`%c[UploadGateway] 🖼️ ImgBB Upload Sukses: ${res.data.url}`, 'color:#10b981;font-weight:bold;');
                                    resolve({
                                        url: res.data.url,
                                        deleteUrl: res.data.delete_url,
                                        width: res.data.width,
                                        height: res.data.height,
                                        provider: 'imgbb'
                                    });
                                } else {
                                    const errMsg = res.error ? res.error.message : 'Respons ImgBB tidak valid';
                                    const statusCode = res.status_code || res.status || status;
                                    
                                    this.rotateToNextKey();

                                    if (attempt < maxRetries) {
                                        const delayMs = 500 * Math.pow(1.4, attempt - 1);
                                        setTimeout(executeAttempt, delayMs);
                                    } else {
                                        let diagReason = `ImgBB Error: ${errMsg}`;
                                        if (statusCode === 429) diagReason = 'ImgBB Rate Limit Terlampaui (429)';
                                        if (statusCode === 400) diagReason = 'API Key ImgBB Tidak Valid / Banned (400)';
                                        reject({ diagnostic: diagReason, isServerDown: false });
                                    }
                                }
                            } catch (err) {
                                if (attempt < maxRetries) {
                                    this.rotateToNextKey();
                                    setTimeout(executeAttempt, 700);
                                } else {
                                    reject({ diagnostic: 'Gagal memproses respon server ImgBB', isServerDown: false });
                                }
                            }
                        },
                        ontimeout: () => {
                            this.rotateToNextKey();
                            if (attempt < maxRetries) {
                                setTimeout(executeAttempt, 800);
                            } else {
                                reject({ diagnostic: 'Koneksi ke ImgBB Timeout (15s)', isServerDown: false });
                            }
                        },
                        onerror: () => {
                            this.rotateToNextKey();
                            if (attempt < maxRetries) {
                                setTimeout(executeAttempt, 800);
                            } else {
                                reject({ diagnostic: 'Gangguan Jaringan / ImgBB Terblokir', isServerDown: true });
                            }
                        }
                    });
                };

                executeAttempt();
            });
        },

        /**
         * Multi-Provider Resilient Router dengan Smart Circuit-Breaker Auto-Failover
         */
        uploadWithResilience: async function(base64Image, onStatusUpdate = null) {
            const providerPref = SettingsManager.getActiveProvider(); // 'auto' | 'imgbb' | 'catbox'
            
            // Case 1: Paksa Catbox Only
            if (providerPref === 'catbox') {
                return await this.uploadToCatbox(base64Image, onStatusUpdate);
            }

            // Case 2: Paksa ImgBB Only
            if (providerPref === 'imgbb') {
                try {
                    return await this.uploadToImgBB(base64Image, onStatusUpdate);
                } catch (errObj) {
                    const reason = errObj.diagnostic || errObj.message || 'Gagal upload ke ImgBB';
                    throw new Error(reason);
                }
            }

            // Case 3: Mode Auto (Smart Circuit Breaker Dual Engine)
            const circuit = SettingsManager.getCircuitState();

            // Jika Circuit Breaker sedang OPEN (ImgBB dalam masa Cooldown 5 Menit):
            if (circuit.state === 'OPEN') {
                const remainingSec = Math.max(0, Math.round((circuit.cooldownUntil - Date.now()) / 1000));
                console.warn(`[CircuitBreaker] ⚡ Fast-Bypass ImgBB (Cooldown ${remainingSec}s: ${circuit.reason}) -> Langsung ke Catbox!`);
                if (onStatusUpdate) {
                    onStatusUpdate(`⚡ Fast-Route Catbox (${remainingSec}s)...`);
                }
                return await this.uploadToCatbox(base64Image, onStatusUpdate);
            }

            // Jika Circuit CLOSED (ImgBB Normal): Coba ImgBB terlebih dahulu
            try {
                const imgbbRes = await this.uploadToImgBB(base64Image, onStatusUpdate);
                return imgbbRes;
            } catch (errObj) {
                const reason = errObj.diagnostic || errObj.message || 'Kendala Gateway ImgBB';
                
                // Trip Circuit Breaker selama 5 Menit (300.000 ms)
                SettingsManager.tripCircuit(reason, 5 * 60 * 1000);
                
                // Notifikasi Transparan kepada CS/Operator
                Toast.show(
                    'warning',
                    'ImgBB Terkendala',
                    `${reason}. Mengalihkan upload instan ke Catbox!`,
                    4000
                );

                console.warn(`[CircuitBreaker] ⚠️ ImgBB Gagal (${reason}) -> Failover instan ke Catbox Cloud...`);
                
                // Failover seketika ke Catbox
                return await this.uploadToCatbox(base64Image, onStatusUpdate);
            }
        }
    };

    // ╔═══════════════════════════════════════════════╗
    // ║   DETEKSI SECTION: MY CHATS vs SUPERVISED     ║
    // ╚═══════════════════════════════════════════════╝
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
            if (hasSupervised && !hasMyChats) return true;
            if (hasMyChats && !hasSupervised) return false;
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

        // 3. Layer Sibling Traversal
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

        // 4. Fallback Karakteristik Teks LiveChat
        const itemText = (item.innerText || item.textContent || '');
        if (/transferred\s*[-–]\s*by/i.test(itemText)) return true;

        // 5. Fallback Atribut
        if (item.closest('[data-testid*="supervised" i], [aria-label*="supervised" i], [class*="supervised" i]')) {
            return true;
        }

        return false;
    };

    const isActiveChatSupervised = () => {
        const selectedLi = document.querySelector('li[data-testid^="chat-item-"][aria-selected="true"], li[class*="selected"], li[class*="active"]');
        if (selectedLi) {
            const item = selectedLi.querySelector('.chat-item') || selectedLi;
            return isSupervisedChatItem(item);
        }
        const activeItem = document.querySelector('.chat-item.active, .chat-item.selected, .chat-item[aria-selected="true"]');
        if (activeItem) {
            return isSupervisedChatItem(activeItem);
        }
        const m = location.pathname.match(/\/chats\/(?:[^/]+\/)?([^/]+)/i);
        if (m && m[1]) {
            const itemById = document.querySelector(`li[data-testid="chat-item-${m[1]}"]`);
            if (itemById) {
                return isSupervisedChatItem(itemById.querySelector('.chat-item') || itemById);
            }
        }
        return false;
    };

    function updateButtonVisibility() {
        if (isActiveChatSupervised()) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'inline-flex';
        }
    }

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
            <div class="btn-settings-tag" id="btn-settings-toggle" title="Pengaturan Gateway & API Key">⚙️</div>
        `;
    }

    // Unified HUD Click Handler (Mode Toggle, Settings Toggle, & Capture)
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
            return;
        }

        const settingsToggle = e.target.closest('#btn-settings-toggle');
        if (settingsToggle) {
            e.stopPropagation();
            e.preventDefault();
            SettingsModal.open();
            return;
        }

        if (hasDragged) {
            return;
        }
        executeSmartCapture();
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
    updateButtonVisibility();

    // Observasi perubahan tab/chat untuk sembunyikan atau tampilkan tombol HUD
    const supervisedObserver = new MutationObserver(() => {
        updateButtonVisibility();
    });
    supervisedObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class'] });
    setInterval(updateButtonVisibility, 500);

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
        if (e.target.closest('#btn-mode-toggle') || e.target.closest('#btn-settings-toggle')) return;

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

        // PENGECUALIAN SUPERVISED: Jangan jalankan capture di chat Supervised
        if (isActiveChatSupervised()) {
            Toast.show('warning', 'Fitur Dinonaktifkan', 'Fitur Smart Capture tidak aktif pada chat Supervised.');
            return;
        }

        const targetElement = document.querySelector(TARGET_SELECTOR);
        if (!targetElement) {
            Toast.show('warning', 'Chat Tidak Ditemukan', 'Silakan pilih atau buka ruang chat terlebih dahulu.');
            return;
        }

        isCapturing = true;
        btn.disabled = true;
        SoundFX.playTrigger();

        // 0ms Instant UI feedback via requestAnimationFrame
        setBtnState('scanning', '🧬', 'Scanning Chat...');

        // Yield to browser to render the button state immediately
        await new Promise(r => requestAnimationFrame(r));

        targetElement.scrollTop = targetElement.scrollHeight;

        const totalScrollH = Math.max(targetElement.scrollHeight, targetElement.offsetHeight, targetElement.clientHeight);
        const totalScrollW = Math.max(targetElement.scrollWidth, targetElement.offsetWidth, targetElement.clientWidth);

        // Pindai Pemisah Sesi jika Mode 'session' aktif
        let cropBounds = null;
        if (ENGINE_CONFIG.captureMode === 'session') {
            const marker = SessionScanner.findLatestSessionMarker(targetElement);
            if (marker) {
                cropBounds = SessionScanner.calculateCropBounds(targetElement, marker);
            }
        }

        try {
            // Tampilan status 2: Rendering DOM to Canvas (Zero font-parsing delay)
            setBtnState('compressing', '⚡', 'Turbo Capturing...');

            // Direct toCanvas dengan height & width eksplisit penuh (Mencakup seluruh chat tanpa terpotong)
            const rawCanvas = await htmlToImage.toCanvas(targetElement, {
                backgroundColor: '#ffffff',
                height: totalScrollH,
                width: totalScrollW,
                skipAutoScale: true,
                skipFonts: true,          // Hapus pemindaian font berulang (Turbo instant)
                cacheBust: false,         // Gunakan cache browser internal
                pixelRatio: ENGINE_CONFIG.pixelRatio,
                style: {
                    overflow: 'visible',
                    maxHeight: 'none',
                    height: totalScrollH + 'px',
                    width: totalScrollW + 'px',
                    transform: 'translateY(0)'
                }
            });

            // Single-pass direct Canvas slicing & compression (<25ms)
            const compressedResult = await TurboEngine.compressAndCropCanvas(rawCanvas, cropBounds);

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
            const providerTag = uploadResult.provider === 'catbox' ? ' [Catbox Cloud]' : ' [ImgBB]';
            setBtnState('ready', '🎯', 'Ready to Paste!');
            Toast.show(
                'success',
                `Capture Berhasil!${providerTag}`,
                `ID: <b>${chatId}</b> disalin ke clipboard beserta link gambar.`
            );

            setTimeout(resetButton, 3200);

        } catch (error) {
            console.error('Capture/Upload Error:', error);
            Toast.show('error', 'Gagal Memproses', error.message || 'Terjadi kesalahan saat upload.');
            resetButton();
        }
    }

    // ================= GLOBAL HOTKEY LISTENER: Alt + S (PILAR 5) =================
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            // PENGECUALIAN SUPERVISED: Abaikan shortcut Alt+S jika di chat Supervised
            if (isActiveChatSupervised()) {
                console.log('[Hotkey] Alt+S diabaikan karena chat Supervised aktif.');
                return;
            }
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

    // Pre-warm audio on initial user interaction so click doesn't lag (0ms Audio Cold Start)
    btn.addEventListener('pointerenter', () => SoundFX.warmup(), { passive: true });
    window.addEventListener('pointerdown', () => SoundFX.warmup(), { passive: true, once: true });
    window.addEventListener('keydown', () => SoundFX.warmup(), { passive: true, once: true });
})();
