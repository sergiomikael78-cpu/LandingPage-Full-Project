// ==UserScript==
// @name         Custom Chat Word Highlighter with Dashboard
// @namespace    http://tampermonkey.net/
// @version      2025-10-07
// @description  Highlight words in chat with custom group names and colors. Edit via floating dashboard.
// @match        https://my.livechatinc.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'chatHighlighterWords';
    const SIZE_KEY = 'chatHighlighterSize';
    const ENABLED_KEY = 'chatHighlighterEnabled';
    const CONFIG_KEY = 'MC_DASHBOARD_CONFIG';
    const RESPONSE_KEY = 'chatAutoResponses';
    const SLA_NOTIF_2MIN_KEY = 'slaNotif2minEnabled';
    const SLA_NOTIF_3MIN_KEY = 'slaNotif3minEnabled';
    const CHECK_TRIGGERS_KEY = 'MILA_CHECK_TRIGGERS';
    const APOLOGY_TRIGGERS_KEY = 'MILA_APOLOGY_TRIGGERS';

    // Helper functions for GM Storage with Local Cache Bridge
    function getStore(key, defaultValue) {
        let val = GM_getValue(key);
        if (val === undefined) {
            // Migration check: check localStorage first
            val = localStorage.getItem(key);
            if (val !== null) {
                try {
                    const parsed = JSON.parse(val);
                    GM_setValue(key, parsed);
                    return parsed;
                } catch (e) {
                    GM_setValue(key, val);
                    return val;
                }
            }
            return defaultValue;
        }
        return val;
    }

    function setStore(key, value) {
        GM_setValue(key, value);
        // Bridge to localStorage so other scripts can still read it at runtime
        try {
            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
        } catch (e) { }
    }

    function removeStore(key) {
        GM_deleteValue(key);
        localStorage.removeItem(key);
    }

    // Runtime Bridge: Sinkronisasi GM_storage ke localStorage saat startup
    // agar skrip lain (seperti script3) bisa membaca setting terbaru meskipun cache baru dihapus.
    [STORAGE_KEY, SIZE_KEY, ENABLED_KEY, CONFIG_KEY, RESPONSE_KEY, SLA_NOTIF_2MIN_KEY, SLA_NOTIF_3MIN_KEY, CHECK_TRIGGERS_KEY, APOLOGY_TRIGGERS_KEY, 'MC_ORB_POS'].forEach(key => {
        const val = GM_getValue(key);
        if (val !== undefined) {
            try {
                localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val);
            } catch (e) { }
        }
    });



    // Load SLA notification settings (default: ON)
    let slaNotif2minEnabled = getStore(SLA_NOTIF_2MIN_KEY, true);
    let slaNotif3minEnabled = getStore(SLA_NOTIF_3MIN_KEY, true);

    let checkTriggers = getStore(CHECK_TRIGGERS_KEY, [
        "akan kami cek terlebih dahulu",
        "kami akan melakukan pengecekan terlebih dahulu",
        "masih dalam pengecekan",
        "sedang dalam proses pengecekan"
    ]);

    let apologyTriggers = getStore(APOLOGY_TRIGGERS_KEY, [
        "salah respon",
        "kurang sesuai"
    ]);

    // Custom word groups (Neon Elite Aesthetic)
    const colorGroups = {
        Blue: { textColor: '#fff', grad: 'linear-gradient(135deg, #00d2ff, #3a7bd5)', shadow: '#00d2ff88', words: ['depo', 'deposit', 'dp', 'freespin', 'free spin', 'paspot', 'Topap', 'top up'] },
        Red: { textColor: '#fff', grad: 'linear-gradient(135deg, #ff0844, #ffb199)', shadow: '#ff084488', words: ['withdraw', 'buyspin', 'buy spin', 'sandi', 'pasword', 'password', 'paswod', 'wd', 'pw', 'batalkan', 'kontol', 'penarikan', 'batalin', 'keluar', 'maindikeluarin', 'main di keluarin', 'reset deposit'] },
        Green: { textColor: '#fff', grad: 'linear-gradient(135deg, #00f260, #0575e6)', shadow: '#00f26088', words: ['lupa id', 'lupa', 'sketer', 'scater', 'scatter', 'username', 'Lupa akun'] },
        Yellow: { textColor: '#000', grad: 'linear-gradient(135deg, #f9d423, #ff4e50)', shadow: '#f9d42388', words: ['situs', 'game', 'bola'] },
        Purple: { textColor: '#fff', grad: 'linear-gradient(135deg, #8e2de2, #4a00e0)', shadow: '#8e2de288', words: ['promo', 'bonus', 'event'] },
        Pink: { textColor: '#fff', grad: 'linear-gradient(135deg, #ff94c2, #ff0080)', shadow: '#ff94c2aa', words: ['mila', 'cantik', 'sayang', 'hallo', 'halo'] }
    };



    let isHighlighterEnabled = getStore(ENABLED_KEY, true);
    let globalFontSize = parseInt(getStore(SIZE_KEY, 16)) || 16;

    // Default system settings
    let dashConfig = {
        profileImg: 'https://i.imgur.com/hc1INx7.png',
        mcLabel: 'Mc',
        dashBg: 'rgba(15, 15, 20, 0.95)',
        bubbleBg: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), rgba(0,0,0,0.4))'
    };
    const storedConfig = getStore(CONFIG_KEY, null);
    if (storedConfig) dashConfig = { ...dashConfig, ...storedConfig };

    let currentDashTab = 'main'; // 'main' or 'settings'

    // --- SHARED POSITION STATE ---
    const savedPos = getStore('MC_ORB_POS', { x: 20, y: 20 });
    let xOffset = Math.max(0, Math.min(savedPos.x, window.innerWidth - 80));
    let yOffset = Math.max(0, Math.min(savedPos.y, window.innerHeight - 80));
    let isDragging = false;
    let dragMoved = false;

    function saveConfig() {
        setStore(CONFIG_KEY, dashConfig);
        updateSystemLive();
    }

    function updateSystemLive() {
        if (typeof bubble !== 'object') return;
        const bImg = bubble.querySelector('img');
        const bLabel = bubble.querySelector('.mc-label');
        if (bImg) bImg.src = dashConfig.profileImg;
        if (bLabel) bLabel.textContent = dashConfig.mcLabel;
        bubble.style.background = dashConfig.bubbleBg;

        if (typeof dash === 'object') {
            if (dashConfig.dashBg.includes('url')) {
                // Gunakan background shorthand agar posisi & ukuran gambar (cover/center) tidak hancur
                dash.style.background = `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), ${dashConfig.dashBg}`;
                dash.style.backgroundColor = '#0f0f14';
            } else {
                dash.style.background = dashConfig.dashBg;
                dash.style.backgroundImage = 'none';
            }
        }
    }

    // Load AUTO_RESPONSE_DATA from localStorage if available
    let AUTO_RESPONSE_DATA = {
        'Depo': {
            triggerWords: ['depo', 'deposit', 'dp', 'topap'],
            messages: ["Dana deposit anda sudah berhasil kami proseskan ya Bosku."]
        },
        'Withdraw': {
            triggerWords: ['withdraw', 'wd', 'penarikan'],
            messages: ["Untuk permintaan withdraw anda sedang dalam antrian."]
        }
    };
    const savedResponses = getStore(RESPONSE_KEY, null);
    if (savedResponses) AUTO_RESPONSE_DATA = savedResponses;

    function saveResponses() {
        setStore(RESPONSE_KEY, AUTO_RESPONSE_DATA);
        if (typeof rebuildRegex === 'function') rebuildRegex();
        renderDashboard();
    }

    const savedWords = getStore(STORAGE_KEY, null);
    if (savedWords) {
        Object.keys(savedWords).forEach(name => {
            if (colorGroups[name]) colorGroups[name].words = savedWords[name];
        });
    }
    function saveGroups() {
        const obj = {};
        Object.keys(colorGroups).forEach(name => obj[name] = colorGroups[name].words);
        setStore(STORAGE_KEY, obj);
        rebuildRegex();
        highlightMessages();
        renderDashboard();
    }

    // —— Modern Design System CSS ——
    const style = document.createElement('style');
    document.head.appendChild(style);
    function rebuildCSS() {
        style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;600&display=swap');

        :root {
            --glass-bg: rgba(15, 15, 20, 0.9);
            --glass-border: rgba(255, 255, 255, 0.15);
            --neon-blue: #00f2ff;
            --neon-red: #ff0000;
            --neon-green: #00ff00;
            --neon-yellow: #ffff00;
        }

        /* Cyber-Pill Highlighter Style */
        ${Object.entries(colorGroups).map(([name, group]) => `
        .hl-${name} {
            background: ${isHighlighterEnabled ? group.grad : 'transparent'} !important;
            color: ${isHighlighterEnabled ? group.textColor : 'inherit'} !important;
            font-size: ${globalFontSize}px !important;
            padding: ${isHighlighterEnabled ? '2px 12px' : '0'};
            border-radius: 50px;
            box-shadow: ${isHighlighterEnabled ? `0 4px 15px ${group.shadow}` : 'none'};
            font-weight: ${isHighlighterEnabled ? '700' : 'normal'};
            display: inline-block;
            margin: 0 ${isHighlighterEnabled ? '4' : '0'}px;
            position: relative;
            overflow: hidden;
            border: ${isHighlighterEnabled ? '1px solid rgba(255,255,255,0.2)' : 'none'};
            text-shadow: ${isHighlighterEnabled ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'};
            line-height: 1.2;
            vertical-align: middle;
            transition: all 0.3s ease;
        }
        /* Efek Kilauan Kaca di atas Pill */
        .hl-${name}::after {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0; height: 50%;
            background: ${isHighlighterEnabled ? 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)' : 'transparent'};
            pointer-events: none;
        }
        `).join('\n')}

        /* Modern Toggle Switch CSS */
        .switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider-toggle {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(255,255,255,0.1);
            transition: .4s;
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .slider-toggle:before {
            position: absolute;
            content: "";
            height: 18px; width: 18px;
            left: 3px; bottom: 2px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        input:checked + .slider-toggle { background: linear-gradient(135deg, #00d2ff, #3a7bd5); }
        input:checked + .slider-toggle:before { transform: translateX(20px); }

        /* Dashboard & Bubble Animations */
        @keyframes orbGlow {
            0%, 100% { box-shadow: 0 0 15px rgba(255,255,255,0.2), inset 0 0 5px rgba(255,255,255,0.1); }
            50% { box-shadow: 0 0 25px rgba(255,255,255,0.4), inset 0 0 10px rgba(255,255,255,0.2); }
        }

        @keyframes floaty {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
        }

        .premium-chip {
            display: flex;
            align-items: center;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            padding: 5px 10px;
            margin-bottom: 6px;
            transition: all 0.2s ease;
        }
        .premium-chip:hover {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.3);
        }

        .chip-delete {
            margin-left: auto;
            color: #ff4d4f;
            cursor: pointer;
            opacity: 0.5;
            transition: opacity 0.2s;
            font-size: 16px;
        }
        .chip-delete:hover { opacity: 1; }

        .modern-input {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--glass-border);
            color: white;
            border-radius: 8px;
            padding: 8px 12px;
            width: 100%;
            outline: none;
            font-family: 'Lexend', sans-serif;
            transition: border-color 0.3s;
        }
        .modern-input:focus { border-color: var(--neon-blue); }

        /* SLA Notification Panel Animations */
        @keyframes rotateGlow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes pulseRed {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }

        /* --- SMART AUTO SCROLL BUTTON (Sleeker & More Compact) --- */
        .smart-scroll-top {
            position: absolute;
            bottom: 18px;
            right: 18px;
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #e4739eff, #ff85aeff);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10005;
            opacity: 0;
            transform: translateY(15px) scale(0.8);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 4px 12px rgba(0, 210, 255, 0.4), inset 0 0 8px rgba(255,255,255,0.2);
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.2);
        }

        .smart-scroll-top.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }

        .smart-scroll-top:hover {
            transform: translateY(-4px) scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 210, 255, 0.6);
            filter: brightness(1.15);
        }

        .smart-scroll-top:active {
            transform: scale(0.9);
        }

        .scroll-icon {
            font-size: 16px;
            transition: transform 0.3s ease;
        }

        .smart-scroll-top:hover .scroll-icon {
            transform: translateY(-3px);
            animation: bounceSmall 1s infinite;
        }

        @keyframes bounceSmall {
            0%, 100% { transform: translateY(-3px); }
            50% { transform: translateY(1px); }
        }
    `;
    }


    rebuildCSS();

    // Regex & word map
    let regex;
    let wordMap = {};
    function rebuildRegex() {
        wordMap = {};
        const allWords = [];
        Object.entries(colorGroups).forEach(([name, group]) => {
            group.words.forEach(word => {
                allWords.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                wordMap[word.toLowerCase()] = `hl-${name}`;
            });
        });
        regex = allWords.length ? new RegExp(`\\b(${allWords.join('|')})\\b`, 'gi') : null;
    }
    rebuildRegex();

    // === PERFORMANCE OPTIMIZATION: Debounce Helper ===
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Cache untuk menghindari re-process elemen yang sama
    const processedElements = new WeakSet();

    //highlight - OPTIMIZED (ONLY CLIENT/VISITOR MESSAGES)
    // highlight - Optimized & Targeted
    function highlightMessages(targetNodes = null) {
        if (!regex) return;

        // Jika targetNodes ada (dari observer), gunakan itu. Jika tidak, cari semua.
        const containers = targetNodes || document.querySelectorAll('[data-testid="visitor-message"], [data-testid="customer-message"], .css-3dz5hy');

        containers.forEach(msgContainer => {
            if (!(msgContainer instanceof HTMLElement) || processedElements.has(msgContainer)) return;

            // Efisiensi: Jika sudah punya data-testid visitor/customer, tidak perlu cek warna lagi
            const isKnownVisitor = msgContainer.matches('[data-testid="visitor-message"], [data-testid="customer-message"]') ||
                msgContainer.closest('[data-testid="visitor-message"], [data-testid="customer-message"]');

            if (!isKnownVisitor) {
                // Hanya lakukan getComputedStyle jika class-nya generik (.css-3dz5hy)
                const bg = getComputedStyle(msgContainer).backgroundColor;
                const isClientBg = bg === 'rgb(45, 45, 51)' || bg === 'rgb(38, 38, 44)' || bg === 'rgb(50, 50, 56)';
                if (!isClientBg) {
                    processedElements.add(msgContainer);
                    return;
                }
            }

            // PENTING: Skip jika ini adalah pesan AGENT
            if (msgContainer.closest('[data-testid="agent-message"]')) {
                processedElements.add(msgContainer);
                return;
            }

            const walker = document.createTreeWalker(msgContainer, NodeFilter.SHOW_TEXT, null);
            let node;
            const nodes = [];
            while (node = walker.nextNode()) {
                if (!node.nodeValue.trim()) continue;
                if (node.parentNode.closest('[data-hl]')) continue;
                nodes.push(node);
            }

            if (nodes.length === 0) return;

            nodes.forEach(textNode => {
                const text = textNode.nodeValue;
                if (!regex.test(text)) return;
                regex.lastIndex = 0;
                const replaced = text.replace(regex, match => {
                    const cls = wordMap[match.toLowerCase()];
                    return cls ? `<span class="${cls}" data-hl="1">${match}</span>` : match;
                });
                const span = document.createElement('span');
                span.setAttribute('data-hl', '1');
                span.innerHTML = replaced;
                textNode.parentNode.replaceChild(span, textNode);
            });

            processedElements.add(msgContainer);
        });
    }

    // Debounced version - (Lama 150ms -> Baru 50ms untuk response secepat kilat)
    const debouncedHighlight = debounce(() => highlightMessages(), 50);

    const observer = new MutationObserver((mutations) => {
        let addedTargets = [];
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    // Cek jika node itu sendiri container pesan
                    if (node.matches('[data-testid="visitor-message"], [data-testid="customer-message"], .css-3dz5hy')) {
                        addedTargets.push(node);
                    } else {
                        // Cek jika di dalamnya ada container pesan
                        const sub = node.querySelectorAll('[data-testid="visitor-message"], [data-testid="customer-message"], .css-3dz5hy');
                        if (sub.length > 0) addedTargets.push(...sub);
                    }
                }
            });
        });

        if (addedTargets.length > 0) {
            // Langsung eksekusi tanpa menunggu debounce jika ada target spesifik
            highlightMessages(addedTargets);
            attachClickToHighlights();
        } else {
            // Fallback tetap gunakan debounce untuk perubahan minor/atribut
            debouncedHighlight();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });


    // —— Futuristic Orb Bubble ——
    const bubble = document.createElement('div');
    bubble.id = 'chat-hl-bubble';
    bubble.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 70px; height: 70px;
    background: ${dashConfig.bubbleBg || 'rgba(255,0,0,0.8)'};
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; z-index: 10001;
    animation: orbGlow 4s infinite ease-in-out;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
    font-family: 'Lexend', sans-serif;
    transform: translate3d(${xOffset}px, ${yOffset}px, 0);
    touch-action: none;
    user-select: none;
    -webkit-user-drag: none;
`;

    const img = document.createElement('img');
    img.src = dashConfig.profileImg;
    img.style.cssText = 'width: 35px; height: 35px; filter: drop-shadow(0 0 5px rgba(255,0,0,0.5)); pointer-events: none;';

    const label = document.createElement('div');
    label.className = 'mc-label';
    label.textContent = dashConfig.mcLabel;
    label.style.cssText = 'color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-shadow: 0 0 5px rgba(0,0,0,0.8); margin-top: 2px;';

    const orbWrapper = document.createElement('div');
    orbWrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; animation: floaty 3s infinite ease-in-out; pointer-events:none;';
    orbWrapper.appendChild(img);
    orbWrapper.appendChild(label);
    bubble.appendChild(orbWrapper);
    // —— Glassmorphism Dashboard ——
    const dash = document.createElement('div');
    dash.id = 'chat-hl-dashboard';
    dash.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 320px; height: 500px; /* Fixed height for consistent internal scroll */
    background: ${dashConfig.dashBg.includes('url') ? `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), ${dashConfig.dashBg}` : dashConfig.dashBg};
    background-color: #0f0f14;
    backdrop-filter: blur(25px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(255,255,255,0.02);
    padding: 0;
    z-index: 10000; display: none; overflow: hidden;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    font-family: 'Lexend', sans-serif;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: 0; transform: translate3d(20px, 100px, 0) scale(0.95);
`;

    // --- NEW: INTERNAL SCROLL AREA ---
    const dashBody = document.createElement('div');
    dashBody.id = 'chat-hl-dash-body';
    dashBody.style.cssText = 'width:100%; height:100%; overflow-y:auto; overflow-x:hidden; padding:20px; box-sizing:border-box; scroll-behavior: smooth; position: relative;';
    dash.appendChild(dashBody);

    // --- AUTO SCROLL TO TOP FEATURE ---
    const scrollTopBtn = document.createElement('div');
    scrollTopBtn.className = 'smart-scroll-top';
    scrollTopBtn.innerHTML = '<span class="scroll-icon">🚀</span>';
    scrollTopBtn.title = 'Terbang ke Atas';

    // Append to dash directly so it floats relative to the dashboard content
    // but we use absolute positioning in CSS
    dash.appendChild(scrollTopBtn);

    scrollTopBtn.onclick = (e) => {
        e.stopPropagation();
        dashBody.scrollTo({ top: 0, behavior: 'smooth' });
    };

    dashBody.onscroll = () => {
        if (dashBody.scrollTop > 120) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    };

    // Scrollbar styling
    const scrollStyle = document.createElement('style');
    scrollStyle.textContent = `
    #chat-hl-dash-body::-webkit-scrollbar { width: 5px; }
    #chat-hl-dash-body::-webkit-scrollbar-track { background: transparent; }
    #chat-hl-dash-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
    #chat-hl-dash-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
`;
    document.head.appendChild(scrollStyle);

    function mountElements() {
        if (document.body && !document.getElementById('chat-hl-bubble')) {
            document.body.appendChild(bubble);
            document.body.appendChild(dash);
            if (typeof updateDashPosition === 'function') updateDashPosition();
            console.log("✅ Orb & Dashboard Mounted Successfully.");
        } else if (!document.body) {
            setTimeout(mountElements, 100);
        }
    }
    mountElements();

    function renderDashboard() {
        if (!dashBody) return;
        dashBody.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; gap:10px;';

        const title = document.createElement('h3');
        title.style.cssText = 'margin:0; font-size:18px; font-weight:600; background:linear-gradient(to right, #00d2ff, #fff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; cursor:pointer;';
        title.textContent = currentDashTab === 'settings' ? 'System Settings' : 'Highlighter Pro';
        title.onclick = () => { currentDashTab = 'main'; renderDashboard(); };

        const settingsBtn = document.createElement('div');
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.style.cssText = `font-size:18px; cursor:pointer; transition:0.3s; opacity:${currentDashTab === 'settings' ? '1' : '0.4'};`;
        settingsBtn.onmouseover = () => settingsBtn.style.transform = 'rotate(45deg)';
        settingsBtn.onmouseout = () => settingsBtn.style.transform = 'rotate(0deg)';
        settingsBtn.onclick = () => {
            currentDashTab = currentDashTab === 'settings' ? 'main' : 'settings';
            renderDashboard();
        };

        const toggleWrapper = document.createElement('div');
        toggleWrapper.style.cssText = 'margin-left:auto; display:flex; align-items:center; gap:8px;';
        toggleWrapper.innerHTML = `
            <span style="font-size:10px; font-weight:600; color:rgba(255,255,255,0.5); letter-spacing:1px;">${isHighlighterEnabled ? 'ON' : 'OFF'}</span>
            <label class="switch">
                <input type="checkbox" id="masterToggle" ${isHighlighterEnabled ? 'checked' : ''}>
                <span class="slider-toggle"></span>
            </label>
        `;

        header.appendChild(title);
        header.appendChild(settingsBtn);
        header.appendChild(toggleWrapper);
        dashBody.appendChild(header);

        // Logic for Master Toggle
        setTimeout(() => {
            const masterToggle = dash.querySelector('#masterToggle');
            if (masterToggle) {
                masterToggle.onchange = (e) => {
                    isHighlighterEnabled = e.target.checked;
                    setStore(ENABLED_KEY, isHighlighterEnabled);
                    toggleWrapper.querySelector('span').textContent = isHighlighterEnabled ? 'ON' : 'OFF';
                    rebuildCSS();
                };
            }
        }, 0);

        if (currentDashTab === 'settings') {
            renderSettingsTab(dashBody);
        } else {
            renderMainTab(dashBody);
        }
    }

    function renderMainTab(container) {
        if (!container) return;
        // —— SLA NOTIFICATION CONTROL PANEL ——
        const slaPanel = document.createElement('div');
        slaPanel.className = 'sla-control-panel';
        slaPanel.style.cssText = `
            margin: 0 0 20px 0;
            background: linear-gradient(135deg, rgba(255, 59, 59, 0.15), rgba(255, 150, 0, 0.1));
            padding: 18px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        // Header Panel
        const slaHeader = document.createElement('div');
        slaHeader.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:16px; position:relative; z-index:2;';
        slaHeader.innerHTML = `
            <div style="width:36px; height:36px; background:linear-gradient(135deg, #ff3b3b, #ff9500); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 0 15px rgba(255, 59, 59, 0.4);">🔔</div>
            <div>
                <div style="font-size:14px; font-weight:800; color:#fff; letter-spacing:0.5px; text-transform:uppercase;">SLA Notifications</div>
                <div style="font-size:10px; color:rgba(255,255,255,0.5); font-weight:400;">Kontrol Tanda & Bunyi Timer</div>
            </div>
        `;
        slaPanel.appendChild(slaHeader);

        // Toggle Wrapper
        const slaToggles = document.createElement('div');
        slaToggles.style.cssText = 'display:flex; flex-direction:column; gap:12px; position:relative; z-index:2;';

        const createSlaToggle = (id, label, sub, color, isChecked, storageKey, eventType) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display:flex; align-items:center; justify-content:space-between;
                background:rgba(0,0,0,0.4); padding:12px 14px; border-radius:12px;
                border:1px solid rgba(255,255,255,0.05); transition:all 0.3s ease;
            `;
            row.onmouseenter = () => row.style.borderColor = color + '44';
            row.onmouseleave = () => row.style.borderColor = 'rgba(255,255,255,0.05)';

            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:10px; height:10px; background:${color}; border-radius:50%; box-shadow:0 0 10px ${color}"></div>
                    <div>
                        <div style="font-size:12px; font-weight:700; color:#fff;">${label}</div>
                        <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:2px;">${sub}</div>
                    </div>
                </div>
                <label class="switch">
                    <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''}>
                    <span class="slider-toggle" style="background:${isChecked ? 'linear-gradient(135deg,' + color + ',#fff)' : 'rgba(255,255,255,0.1)'}"></span>
                </label>
            `;

            const input = row.querySelector('input');
            input.onchange = (e) => {
                const enabled = e.target.checked;
                setStore(storageKey, enabled);
                row.querySelector('.slider-toggle').style.background = enabled ? `linear-gradient(135deg, ${color}, #fff)` : 'rgba(255,255,255,0.1)';

                // Update local variable if needed (not strictly required since we refresh UI or other script reads storage)
                if (id === 'slaNotif2minToggle') slaNotif2minEnabled = enabled;
                if (id === 'slaNotif3minToggle') slaNotif3minEnabled = enabled;

                // Kirim event ke script lain
                window.dispatchEvent(new CustomEvent('slaNotifSettingChanged', { detail: { type: eventType, enabled } }));
            };
            return row;
        };

        slaToggles.appendChild(createSlaToggle('slaNotif2minToggle', 'Timer 2 Menit', '⚡ Peringatan Kuning', '#f2f205', slaNotif2minEnabled, SLA_NOTIF_2MIN_KEY, '2min'));
        slaToggles.appendChild(createSlaToggle('slaNotif3minToggle', 'Timer 3 Menit', '🚨 Alert Merah Cepat', '#ff3b3b', slaNotif3minEnabled, SLA_NOTIF_3MIN_KEY, '3min'));

        slaPanel.appendChild(slaToggles);
        container.appendChild(slaPanel);

        // —— Font Size Control (Old UI) ——
        const sizeBox = document.createElement('div');
        sizeBox.style.cssText = 'margin-bottom:25px; background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);';
        sizeBox.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; color:rgba(255,255,255,0.6); font-weight:700; letter-spacing:1px;">
                <span>FONT SIZE</span>
                <span id="size-display" style="color:var(--neon-blue)">${globalFontSize}px</span>
            </div>
            <input type="range" id="sizeSlider" min="12" max="35" value="${globalFontSize}" style="width:100%; cursor:pointer; accent-color:#00d2ff;">
        `;
        container.appendChild(sizeBox);

        const slider = sizeBox.querySelector('#sizeSlider');
        const display = sizeBox.querySelector('#size-display');
        slider.oninput = (e) => {
            globalFontSize = e.target.value;
            display.textContent = globalFontSize + 'px';
            setStore(SIZE_KEY, globalFontSize);
            rebuildCSS();
        };

        Object.entries(colorGroups).forEach(([name, group]) => {
            const section = document.createElement('div');
            section.style.marginBottom = '25px';

            const colorTitle = document.createElement('div');
            colorTitle.style.cssText = `color:inherit; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px; display:flex; align-items:center;`;
            colorTitle.innerHTML = `
                <span style="width:10px; height:10px; background:${group.grad}; border-radius:50%; display:inline-block; margin-right:8px; box-shadow:0 0 10px ${group.shadow}"></span>
                <span style="color:${name.toLowerCase() === 'yellow' ? '#f9d423' : 'inherit'};">${name} Group</span>
            `;
            section.appendChild(colorTitle);

            const listContainer = document.createElement('div');
            listContainer.style.display = 'flex';
            listContainer.style.flexWrap = 'wrap';
            listContainer.style.gap = '6px';

            group.words.forEach((word, i) => {
                const chip = document.createElement('div');
                chip.className = 'premium-chip';
                chip.style.margin = '0'; // reset margin for flex gap

                const span = document.createElement('span');
                span.textContent = word;
                span.style.fontSize = '13px';

                const del = document.createElement('span');
                del.className = 'chip-delete';
                del.innerHTML = '✖';
                del.onclick = (e) => { e.stopPropagation(); group.words.splice(i, 1); saveGroups(); };

                chip.appendChild(span);
                chip.appendChild(del);
                listContainer.appendChild(chip);
            });
            section.appendChild(listContainer);

            const inputGroup = document.createElement('div');
            inputGroup.style.cssText = 'display:flex; gap:8px; margin-top:10px;';

            const input = document.createElement('input');
            input.className = 'modern-input';
            input.placeholder = `Tambah ke ${name}...`;

            const addBtn = document.createElement('button');
            addBtn.innerHTML = '＋';
            addBtn.style.cssText = `background:${group.grad}; color:${group.textColor}; border:none; border-radius:8px; width:40px; height:40px; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; transition:0.2s; box-shadow: 0 4px 10px ${group.shadow};`;
            addBtn.onmouseover = () => addBtn.style.transform = 'scale(1.1)';
            addBtn.onmouseout = () => addBtn.style.transform = 'scale(1)';

            addBtn.onclick = () => {
                const val = input.value.trim();
                if (val) { group.words.push(val); saveGroups(); input.value = ''; }
            };

            inputGroup.appendChild(input);
            inputGroup.appendChild(addBtn);
            section.appendChild(inputGroup);

            container.appendChild(section);
        });

        // —— TABS SYSTEM ——
        const hr = document.createElement('hr');
        hr.style.cssText = 'border:none; border-top:1px solid rgba(255,255,255,0.1); margin:30px 0;';
        container.appendChild(hr);

        const resHeader = document.createElement('div');
        resHeader.style.cssText = 'display:flex; align-items:center; margin-bottom:20px;';
        resHeader.innerHTML = '<h3 style="margin:0; font-size:18px; color:var(--neon-green);">Auto-Response Pro</h3>';
        container.appendChild(resHeader);

        Object.entries(AUTO_RESPONSE_DATA).forEach(([groupName, data]) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin-bottom:30px; padding:20px; background:rgba(0,0,0,0.3); border-radius:15px; border:1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: 0.3s; position:relative;';
            wrap.onmouseenter = () => wrap.style.borderColor = 'rgba(57,255,20,0.5)';
            wrap.onmouseleave = () => wrap.style.borderColor = 'rgba(255,255,255,0.1)';

            const head = document.createElement('div');
            head.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;';
            head.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:10px; height:10px; background:var(--neon-green); border-radius:50%; box-shadow: 0 0 10px var(--neon-green);"></div>
                    <span style="font-weight:700; font-size:16px; color:#fff; text-shadow: 0 0 10px rgba(57,255,20,0.2);">${groupName}</span>
                </div>
            `;

            const delGroup = document.createElement('span');
            delGroup.innerHTML = '🗑️';
            delGroup.title = 'Hapus Group';
            delGroup.style.cssText = 'cursor:pointer; opacity:0.4; transition:0.2s; font-size:16px;';
            delGroup.onmouseover = () => delGroup.style.opacity = '1';
            delGroup.onmouseout = () => delGroup.style.opacity = '0.4';
            delGroup.onclick = () => { if (confirm(`Hapus Group "${groupName}"?`)) { delete AUTO_RESPONSE_DATA[groupName]; saveResponses(); } };
            head.appendChild(delGroup);
            wrap.appendChild(head);

            // Keywords Section
            const twList = document.createElement('div');
            twList.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;';
            data.triggerWords.forEach((tw, idx) => {
                const tag = document.createElement('span');
                tag.style.cssText = 'font-size:11px; background:rgba(57,255,20,0.1); color:var(--neon-green); padding:5px 12px; border-radius:30px; border:1px solid rgba(57,255,20,0.3); cursor:pointer; font-weight:600;';
                tag.textContent = tw + ' ×';
                tag.onclick = () => { data.triggerWords.splice(idx, 1); saveResponses(); };
                twList.appendChild(tag);
            });
            wrap.appendChild(twList);

            const addTW = document.createElement('input');
            addTW.className = 'modern-input';
            addTW.placeholder = '+ Tambah keyword (Press Enter)...';
            addTW.style.cssText = 'font-size:12px; height:35px; border-radius:10px; background:rgba(0,0,0,0.2); margin-bottom:20px;';
            addTW.onkeydown = (e) => { if (e.key === 'Enter' && addTW.value.trim()) { data.triggerWords.push(addTW.value.trim()); saveResponses(); } };
            wrap.appendChild(addTW);

            // Templates Section
            const templateLabel = document.createElement('div');
            templateLabel.style.cssText = 'font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); margin-bottom:10px; letter-spacing:1px;';
            templateLabel.textContent = 'PESAN TEMPLATE';
            wrap.appendChild(templateLabel);

            const msgList = document.createElement('div');
            msgList.style.cssText = 'display:flex; flex-direction:column; gap:12px; margin-bottom:15px;';

            data.messages.forEach((msg, idx) => {
                const mWrap = document.createElement('div');
                mWrap.style.cssText = 'position:relative;';

                const mArea = document.createElement('textarea');
                mArea.className = 'modern-input';
                mArea.style.cssText = 'height:auto; min-height:80px; font-size:12px; padding:12px 35px 12px 12px; background:rgba(255,255,255,0.02); resize:none; border-color:rgba(255,255,255,0.08); line-height:1.5; color:#fff; border-radius:12px;';
                mArea.value = msg;
                mArea.oninput = () => { data.messages[idx] = mArea.value; };

                const mDel = document.createElement('span');
                mDel.innerHTML = '✖';
                mDel.style.cssText = 'position:absolute; top:12px; right:12px; color:#ff4d4f; cursor:pointer; font-size:12px; opacity:0.3; transition:0.2s;';
                mDel.onmouseover = () => mDel.style.opacity = '1';
                mDel.onmouseout = () => mDel.style.opacity = '0.3';
                mDel.onclick = () => { if (confirm('Hapus template ini?')) { data.messages.splice(idx, 1); saveResponses(); } };

                mWrap.appendChild(mArea);
                mWrap.appendChild(mDel);
                msgList.appendChild(mWrap);
            });
            wrap.appendChild(msgList);

            // Control Buttons
            const ctrlContainer = document.createElement('div');
            ctrlContainer.style.cssText = 'display:flex; gap:10px; margin-top:10px;';

            const addTempBtn = document.createElement('div');
            addTempBtn.innerHTML = '＋ Add Template';
            addTempBtn.style.cssText = 'flex:1; padding:10px; background:rgba(57,255,20,0.05); border:1px solid rgba(57,255,20,0.2); border-radius:10px; text-align:center; font-size:12px; color:var(--neon-green); cursor:pointer; font-weight:600; transition:0.2s;';
            addTempBtn.onmouseover = () => { addTempBtn.style.background = 'rgba(57,255,20,0.1)'; addTempBtn.style.borderColor = 'var(--neon-green)'; };
            addTempBtn.onmouseout = () => { addTempBtn.style.background = 'rgba(57,255,20,0.05)'; addTempBtn.style.borderColor = 'rgba(57,255,20,0.2)'; };
            addTempBtn.onclick = () => { data.messages.push(""); renderDashboard(); };

            const saveBtn = document.createElement('div');
            saveBtn.innerHTML = '💾 SIMPAN SEMUA';
            saveBtn.style.cssText = 'flex:1; padding:10px; background:var(--neon-green); color:#000; border-radius:10px; text-align:center; font-size:12px; cursor:pointer; font-weight:700; transition:0.2s; box-shadow: 0 4px 10px rgba(57,255,20,0.2);';
            saveBtn.onmouseover = () => { saveBtn.style.transform = 'translateY(-2px)'; saveBtn.style.boxShadow = '0 6px 15px rgba(57,255,20,0.4)'; };
            saveBtn.onmouseout = () => { saveBtn.style.transform = 'translateY(0)'; saveBtn.style.boxShadow = '0 4px 10px rgba(57,255,20,0.2)'; };
            saveBtn.onclick = () => { saveResponses(); alert(`Group ${groupName} berhasil disimpan!`); };

            ctrlContainer.appendChild(addTempBtn);
            ctrlContainer.appendChild(saveBtn);
            wrap.appendChild(ctrlContainer);

            container.appendChild(wrap);
        });

        // NEW CATEGORY BUILDER
        const builder = document.createElement('div');
        builder.style.cssText = 'margin-top:20px; border:2px dashed rgba(255,255,255,0.1); padding:20px; border-radius:15px; background:rgba(255,255,255,0.02); text-align:center; transition:0.3s; cursor:pointer;';
        builder.onmouseenter = () => { builder.style.borderColor = 'var(--neon-green)'; builder.style.background = 'rgba(57,255,20,0.02)'; };
        builder.onmouseleave = () => { builder.style.borderColor = 'rgba(255,255,255,0.1)'; builder.style.background = 'rgba(255,255,255,0.02)'; };
        builder.innerHTML = '<div style="font-size:12px; color:rgba(255,255,255,0.5); font-weight:700; letter-spacing:1px;">📁 TAMBAH KATEGORI BARU</div>';

        builder.onclick = () => {
            const name = prompt("Masukkan Nama Kategori Baru:");
            if (name && name.trim()) {
                const cleanName = name.trim();
                if (!AUTO_RESPONSE_DATA[cleanName]) {
                    AUTO_RESPONSE_DATA[cleanName] = { triggerWords: [], messages: ["Klik untuk mengedit..."] };
                    saveResponses();
                } else { alert('Kategori sudah ada!'); }
            }
        };
        container.appendChild(builder);
    }

    function renderSettingsTab(container) {
        if (!container) return;
        const settingsContainer = document.createElement('div');
        settingsContainer.style.cssText = 'display:flex; flex-direction:column; gap:15px; padding-bottom:30px; animation: slideIn 0.3s ease;';

        const createSettingItem = (label, currentVal, onUpdate, isFileSupport = false) => {
            const item = document.createElement('div');
            item.style.cssText = 'background:rgba(0,0,0,0.3); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);';

            const labelEl = document.createElement('div');
            labelEl.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.4); font-weight:700; margin-bottom:10px; letter-spacing:1px;';
            labelEl.textContent = label.toUpperCase();
            item.appendChild(labelEl);

            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:8px; align-items:center;';

            const valDisplay = document.createElement('div');
            valDisplay.style.cssText = 'flex:1; font-size:11px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:0.6;';
            valDisplay.textContent = currentVal.startsWith('data:') ? '[IMAGE DATA]' : currentVal;
            row.appendChild(valDisplay);

            const btnGanti = document.createElement('button');
            btnGanti.textContent = 'GANTI';
            btnGanti.style.cssText = 'padding:6px 12px; background:rgba(255,255,255,0.1); color:white; border:none; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;';
            btnGanti.onclick = () => {
                const newVal = prompt(`Ganti ${label}:`, currentVal);
                if (newVal !== null && newVal.trim()) onUpdate(newVal.trim());
            };
            row.appendChild(btnGanti);

            if (isFileSupport) {
                const btnUpload = document.createElement('button');
                btnUpload.textContent = 'UPLOAD';
                btnUpload.style.cssText = 'padding:6px 12px; background:linear-gradient(135deg, #00d2ff, #3a7bd5); color:white; border:none; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;';

                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            let result = re.target.result;
                            // Jika untuk background, bungkus dengan url()
                            if (label.toLowerCase().includes('background')) {
                                result = `url(${result}) center/cover no-repeat`;
                            }
                            onUpdate(result);
                        };
                        reader.readAsDataURL(file);
                    }
                };

                btnUpload.onclick = () => fileInput.click();
                row.appendChild(btnUpload);
                row.appendChild(fileInput);
            }

            item.appendChild(row);
            return item;
        };

        settingsContainer.appendChild(createSettingItem('Profile / Icon URL', dashConfig.profileImg, (val) => {
            dashConfig.profileImg = val; saveConfig(); renderDashboard();
        }, true));

        settingsContainer.appendChild(createSettingItem('Keterangan Label', dashConfig.mcLabel, (val) => {
            dashConfig.mcLabel = val; saveConfig(); renderDashboard();
        }));

        settingsContainer.appendChild(createSettingItem('Background Dashboard', dashConfig.dashBg, (val) => {
            dashConfig.dashBg = val; saveConfig(); renderDashboard();
        }, true));

        settingsContainer.appendChild(createSettingItem('Background Orba MC', dashConfig.bubbleBg, (val) => {
            dashConfig.bubbleBg = val; saveConfig(); renderDashboard();
        }, true));

        // —— PENGECEKAN DURATION TIMER TRIGGERS ——
        const timerTitle = document.createElement('div');
        timerTitle.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.4); font-weight:700; margin-top:10px; letter-spacing:1px; text-transform:uppercase;';
        timerTitle.textContent = 'Pengecekan Timer Triggers (4 Kalimat)';
        settingsContainer.appendChild(timerTitle);

        [0, 1, 2, 3].forEach(idx => {
            settingsContainer.appendChild(createSettingItem('Kalimat ' + (idx + 1), checkTriggers[idx] || '', (val) => {
                checkTriggers[idx] = val;
                setStore(CHECK_TRIGGERS_KEY, checkTriggers);
                renderDashboard();
            }));
        });

        // —— APOLOGY DURATION TRACKER TRIGGERS ——
        const apologyTitle = document.createElement('div');
        apologyTitle.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.4); font-weight:700; margin-top:20px; letter-spacing:1px; text-transform:uppercase;';
        apologyTitle.textContent = 'Apology Timer Triggers (2 Kalimat)';
        settingsContainer.appendChild(apologyTitle);

        [0, 1].forEach(idx => {
            settingsContainer.appendChild(createSettingItem('Kalimat Maaf ' + (idx + 1), apologyTriggers[idx] || '', (val) => {
                apologyTriggers[idx] = val;
                setStore(APOLOGY_TRIGGERS_KEY, apologyTriggers);
                renderDashboard();
            }));
        });

        // —— EXPORT / IMPORT SECTION ——
        const storageTitle = document.createElement('div');
        storageTitle.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.4); font-weight:700; margin-top:10px; letter-spacing:1px; text-transform:uppercase;';
        storageTitle.textContent = 'Backup & Data PC';
        settingsContainer.appendChild(storageTitle);

        const storageRow = document.createElement('div');
        storageRow.style.cssText = 'display:flex; gap:10px;';

        const btnExport = document.createElement('button');
        btnExport.innerHTML = '📤 EXPORT';
        btnExport.style.cssText = 'flex:1; padding:12px; background:rgba(0,242,96,0.1); border:1px solid rgba(0,242,96,0.3); color:#00f260; border-radius:10px; font-size:11px; font-weight:700; cursor:pointer; transition:0.2s;';
        btnExport.onclick = () => {
            const data = {
                highlighter: GM_getValue(STORAGE_KEY),
                autoResponse: GM_getValue(RESPONSE_KEY),
                config: GM_getValue(CONFIG_KEY),
                settings: {
                    size: GM_getValue(SIZE_KEY),
                    enabled: GM_getValue(ENABLED_KEY),
                    sla2m: GM_getValue(SLA_NOTIF_2MIN_KEY),
                    sla3m: GM_getValue(SLA_NOTIF_3MIN_KEY),
                    checkTriggers: GM_getValue(CHECK_TRIGGERS_KEY),
                    apologyTriggers: GM_getValue(APOLOGY_TRIGGERS_KEY)
                },
                exportDate: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `HighlighterPro_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        const btnImport = document.createElement('button');
        btnImport.innerHTML = '📥 IMPORT';
        btnImport.style.cssText = 'flex:1; padding:12px; background:rgba(0,210,255,0.1); border:1px solid rgba(0,210,255,0.3); color:#00d2ff; border-radius:10px; font-size:11px; font-weight:700; cursor:pointer; transition:0.2s;';

        const importFile = document.createElement('input');
        importFile.type = 'file';
        importFile.accept = '.json';
        importFile.style.display = 'none';
        importFile.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const data = JSON.parse(re.target.result);
                    if (data.highlighter) setStore(STORAGE_KEY, data.highlighter);
                    if (data.autoResponse) setStore(RESPONSE_KEY, data.autoResponse);
                    if (data.config) setStore(CONFIG_KEY, data.config);
                    if (data.settings) {
                        if (data.settings.size) setStore(SIZE_KEY, data.settings.size);
                        if (data.settings.enabled !== undefined) setStore(ENABLED_KEY, data.settings.enabled);
                        if (data.settings.sla2m !== undefined) setStore(SLA_NOTIF_2MIN_KEY, data.settings.sla2m);
                        if (data.settings.sla3m !== undefined) setStore(SLA_NOTIF_3MIN_KEY, data.settings.sla3m);
                        if (data.settings.checkTriggers !== undefined) setStore(CHECK_TRIGGERS_KEY, data.settings.checkTriggers);
                        if (data.settings.apologyTriggers !== undefined) setStore(APOLOGY_TRIGGERS_KEY, data.settings.apologyTriggers);
                    }
                    alert('✅ Data Berhasil Diimport! Me-refresh halaman...');
                    location.reload();
                } catch (err) { alert('❌ Error: Format file tidak valid!'); }
            };
            reader.readAsText(file);
        };
        btnImport.onclick = () => importFile.click();

        storageRow.appendChild(btnExport);
        storageRow.appendChild(btnImport);
        settingsContainer.appendChild(storageRow);
        settingsContainer.appendChild(importFile);

        const backBtn = document.createElement('button');
        backBtn.textContent = ' Kembali';
        backBtn.style.cssText = 'margin-top:10px; padding:12px; background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:12px; cursor:pointer; font-weight:700;';
        backBtn.onclick = () => { currentDashTab = 'main'; renderDashboard(); };
        settingsContainer.appendChild(backBtn);

        container.appendChild(settingsContainer);
    }

    renderDashboard();


    // === DASHBOARD TOGGLE & DRAGGING SYSTEM ===
    function toggleDash() {
        if (!dash) return;
        const isVisible = dash.style.display === 'block';

        if (isVisible) {
            dash.style.opacity = '0';
            const currentTransform = dash.style.transform.split('scale')[0] || `translate3d(${xOffset}px, ${yOffset + 100}px, 0)`;
            dash.style.transform = `${currentTransform} scale(0.95) translateY(20px)`;
            setTimeout(() => { dash.style.display = 'none'; }, 400);
        } else {
            dash.style.display = 'block';
            updateDashPosition(); // Snap to current bubble pos
            dash.offsetHeight; // Force reflow
            const currentTransform = dash.style.transform.split('scale')[0];
            dash.style.opacity = '1';
            dash.style.transform = `${currentTransform} scale(1)`;

            // Bubble bounce pulse
            bubble.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(0.8)`;
            setTimeout(() => { bubble.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(1)`; }, 200);
        }
    }

    let initialX, initialY;

    function dragStart(e) {
        if (e.target === bubble || bubble.contains(e.target)) {
            e.stopPropagation();
            if (e.type === "touchstart") e.preventDefault();

            const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

            isDragging = true;
            dragMoved = false;
            initialX = clientX - xOffset;
            initialY = clientY - yOffset;
            bubble.style.transition = 'none'; // Lock transition
        }
    }

    function dragEnd(e) {
        if (!isDragging) return;
        e.stopPropagation();
        isDragging = false;
        bubble.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
        setStore('MC_ORB_POS', { x: xOffset, y: yOffset });
        setTimeout(() => { dragMoved = false; }, 50);
    }

    function drag(e) {
        if (isDragging) {
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e.cancelable) e.preventDefault();
            dragMoved = true;

            const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

            let bx = clientX - initialX;
            let by = clientY - initialY;

            // Stay in viewport
            const bRect = bubble.getBoundingClientRect();
            xOffset = Math.max(0, Math.min(bx, window.innerWidth - (bRect.width || 70)));
            yOffset = Math.max(0, Math.min(by, window.innerHeight - (bRect.height || 70)));

            bubble.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
            updateDashPosition();
        }
    }

    function updateDashPosition() {
        if (!dash || !bubble) return;
        const bRect = bubble.getBoundingClientRect();
        const dRect = dash.getBoundingClientRect();

        let tx = bRect.left;
        let ty = bRect.bottom + 10;

        // Smart Re-positioning
        if (tx + dRect.width > window.innerWidth) tx = window.innerWidth - dRect.width - 20;
        if (tx < 10) tx = 10;
        if (ty + dRect.height > window.innerHeight) ty = bRect.top - dRect.height - 10;
        if (ty < 10) ty = 10;

        const isVisible = dash.style.display === 'block';
        dash.style.transform = `translate3d(${tx}px, ${ty}px, 0) ${isVisible ? 'scale(1)' : 'scale(0.95)'}`;
    }

    // Event Listeners
    bubble.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    bubble.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);

    // Prevent closing when clicking inside dashboard
    dash.onclick = (e) => e.stopPropagation();

    bubble.onclick = (e) => {
        e.stopPropagation();
        if (dragMoved) return;
        toggleDash();
    };

    // Close when clicking anywhere outside
    document.addEventListener('mousedown', (e) => {
        const isVisible = dash.style.display === 'block';
        if (isVisible && !dash.contains(e.target) && !bubble.contains(e.target)) {
            toggleDash();
        }
    });

    window.addEventListener('resize', () => {
        const bRect = bubble.getBoundingClientRect();
        xOffset = Math.min(xOffset, window.innerWidth - (bRect.width || 70));
        yOffset = Math.min(yOffset, window.innerHeight - (bRect.height || 70));
        bubble.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
        updateDashPosition();
    });

    // Shortcut removed by user request (Alt+D)
    // document.addEventListener('keydown', e => { ... });



    // === Context Menu Logic ===
    let contextMenu;
    // ... rest of logic stays same or fits below ...

    document.addEventListener('contextmenu', e => {
        const selectedText = window.getSelection().toString().trim();
        if (!selectedText) return; // nothing selected
        e.preventDefault(); // prevent normal right-click

        // remove old menu if exists
        if (contextMenu) contextMenu.remove();

        // create custom menu
        contextMenu = document.createElement('div');
        contextMenu.style.cssText = `
position: fixed;
top: ${e.clientY}px;
left: ${e.clientX}px;
background: white;
border: 2px solid #111;
border-radius: 8px;
box-shadow: 4px 4px 0 #111;
padding: 8px;
z-index: 99999;
font-family: "Bangers", "Comic Sans MS", cursive;
font-size: 14px;
`;

        const title = document.createElement('div');
        title.textContent = `Add "${selectedText}" to:`;
        title.style.marginBottom = '6px';
        contextMenu.appendChild(title);

        Object.keys(colorGroups).forEach(name => {
            const btn = document.createElement('div');
            btn.textContent = name;
            btn.style.cssText = `
color: ${colorGroups[name].textColor};
padding: 4px 8px;
cursor: pointer;
border-radius: 6px;
`;
            btn.onmouseenter = () => btn.style.background = '#eee';
            btn.onmouseleave = () => btn.style.background = 'transparent';
            btn.onclick = () => {
                colorGroups[name].words.push(selectedText);
                saveGroups();
                contextMenu.remove();
                alert(`Added "${selectedText}" to ${name}!`);
            };
            contextMenu.appendChild(btn);
        });

        document.body.appendChild(contextMenu);
    });

    // remove menu when clicking elsewhere
    document.addEventListener('click', () => {
        if (contextMenu) contextMenu.remove();
    });

    // === AUTO RESPONSE PRO INTEGRATION ===

    // Flatten AUTO_RESPONSE_DATA to wordResponses for quick lookup
    // NOW MERGING instead of overwriting
    let wordResponses = {};
    function rebuildWordResponses() {
        wordResponses = {};
        Object.entries(AUTO_RESPONSE_DATA).forEach(([groupName, data]) => {
            data.triggerWords.forEach(w => {
                const key = w.toLowerCase().trim();
                if (!wordResponses[key]) {
                    wordResponses[key] = [];
                }
                // Add messages and remove duplicates
                data.messages.forEach(msg => {
                    if (msg && msg.trim() && !wordResponses[key].includes(msg)) {
                        wordResponses[key].push(msg);
                    }
                });
            });
        });
    }
    rebuildWordResponses();

    // Modify rebuildRegex to also include Auto-Response triggers
    const originalRebuildRegex = rebuildRegex;
    rebuildRegex = function () {
        wordMap = {};
        const allWords = [];

        // Add color groups
        Object.entries(colorGroups).forEach(([name, group]) => {
            group.words.forEach(word => {
                const w = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (!allWords.includes(w)) allWords.push(w);
                wordMap[word.toLowerCase()] = `hl-${name}`;
            });
        });

        // Add Auto-Response triggers (if not already in color groups)
        Object.entries(AUTO_RESPONSE_DATA).forEach(([groupName, data]) => {
            data.triggerWords.forEach(word => {
                const w = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (!allWords.includes(w)) {
                    allWords.push(w);
                    wordMap[word.toLowerCase()] = 'hl-AutoResponse'; // Green-ish default
                }
            });
        });

        regex = allWords.length ? new RegExp(`\\b(${allWords.join('|')})\\b`, 'gi') : null;
        rebuildWordResponses(); // also update lookup map
    };

    // Add CSS for default Auto-Response highlight
    const originalRebuildCSS = rebuildCSS;
    rebuildCSS = function () {
        originalRebuildCSS();
        style.textContent += `
            .hl-AutoResponse {
                background: ${isHighlighterEnabled ? 'linear-gradient(135deg, #00f260, #0575e6)' : 'transparent'} !important;
                color: ${isHighlighterEnabled ? '#fff' : 'inherit'} !important;
                font-size: ${globalFontSize}px !important;
                padding: ${isHighlighterEnabled ? '2px 12px' : '0'};
                border-radius: 50px;
                box-shadow: ${isHighlighterEnabled ? '0 4px 15px rgba(0, 242, 96, 0.4)' : 'none'};
                font-weight: ${isHighlighterEnabled ? '700' : 'normal'};
                display: inline-block;
                margin: 0 ${isHighlighterEnabled ? '4' : '0'}px;
                cursor: pointer;
                border: ${isHighlighterEnabled ? '1px solid rgba(255,255,255,0.2)' : 'none'};
                transition: all 0.3s ease;
            }
        `;
    };

    rebuildCSS();
    rebuildRegex();

    // === Manga-style popup ===
    let popup = document.getElementById('hl-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'hl-popup';
        popup.style.cssText = `
            position:absolute; background:white; border:3px solid #111; border-radius:10px;
            box-shadow:5px 5px 0 #111; padding:12px; font-family:"Lexend",sans-serif;
            font-size:14px; color:#111; z-index:999999; display:none; flex-direction:column;
            gap:8px; animation:popupIn 0.15s ease-out; max-width:350px; border-right: 6px solid #111;
        `;
        document.body.appendChild(popup);

        const pStyle = document.createElement('style');
        pStyle.textContent = `
            @keyframes popupIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .popup-item {
                padding:10px 14px; border:2px solid #111; border-radius:8px;
                box-shadow:2px 2px 0 #111; background:white; cursor:pointer;
                text-align:left; white-space: pre-wrap; line-height: 1.4;
                transition:all 0.1s ease; font-weight: 500;
            }
            .popup-item:hover { background:#ffeb3b; transform:translate(-2px,-2px); box-shadow:4px 4px 0 #111; }
        `;
        document.head.appendChild(pStyle);

        document.addEventListener('click', () => popup.style.display = 'none');
        popup.addEventListener('click', e => e.stopPropagation());
    }

    function getMessageBox() {
        // Cari elemen yang paling mungkin menjadi input chat
        const selectors = [
            '#chat-feed-text-area-id',
            '[data-testid="chat-input"]',
            '[data-testid="message-box"]',
            '.lc-input-box [contenteditable="true"]',
            '[contenteditable="true"][role="textbox"]'
        ];

        for (let s of selectors) {
            const el = document.querySelector(s);
            if (el) return el;
        }

        const all = document.querySelectorAll('[contenteditable="true"]');
        for (let el of all) {
            if (el.closest && el.closest('#esah-dashboard')) continue;
            return el;
        }
        return document.querySelector('textarea');
    }

    let isInserting = false;
    function insertIntoMessageBox(text) {
        if (isInserting) return;
        isInserting = true;

        const box = getMessageBox();
        if (!box) {
            isInserting = false;
            return;
        }

        // AGGRESSIVE FOCUS (Seperti Perfect Keyboard mengaktifkan jendela target)
        box.focus();

        // Gunakan kursor di posisi terakhir jika kursor tidak ada
        const sel = window.getSelection();
        if (!sel.rangeCount || !box.contains(sel.anchorNode)) {
            const range = document.createRange();
            range.selectNodeContents(box);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        try {
            // TRIK "PERFECT MACRO": Gunakan format yang paling disukai LiveChat
            // Kita pecah teks dan bungkus setiap baris baru dengan <div> asli
            const lines = text.split('\n');
            const htmlFormatted = lines.map(line => `<div>${line.length > 0 ? line : '<br>'}</div>`).join('');

            // 1. Teknik Keamanan Utama: Simulasi Paste Event
            // Ini adalah cara Perfect Keyboard mengirim data agar formatnya tetap "Rich Text" (Rapi)
            const dt = new DataTransfer();
            dt.setData('text/plain', text);
            dt.setData('text/html', htmlFormatted);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dt,
                bubbles: true,
                cancelable: true
            });

            const wasHandled = box.dispatchEvent(pasteEvent);

            // 2. Jalur Kedua: Jika sistem chat menolak event "paste", suntikkan HTML secara paksa
            // Kita beri jeda 20ms untuk melihat apakah teks sudah masuk
            setTimeout(() => {
                const currentText = box.innerText || box.textContent || "";
                if (currentText.trim().length === 0) {
                    // Masukkan baris demi baris menggunakan perintah sistem pengetikan (Native Typing)
                    const success = document.execCommand('insertHTML', false, htmlFormatted);

                    if (!success) {
                        // Jika insertHTML juga gagal, paksa dengan insertText murni (Fallback terakhir)
                        document.execCommand('insertText', false, text);
                    }
                }

                // 3. SINKRONISASI: Paksa sistem LiveChat untuk menyalakan tombol "Send"
                box.dispatchEvent(new Event('input', { bubbles: true }));
                box.dispatchEvent(new Event('change', { bubbles: true }));

                isInserting = false;
            }, 30);

        } catch (e) {
            console.error("Macro System Error:", e);
            document.execCommand('insertText', false, text);
            box.dispatchEvent(new Event('input', { bubbles: true }));
            isInserting = false;
        }
    }

    function showPopupForElement(el, responses) {
        if (!responses || responses.length === 0) return;
        popup.innerHTML = '<div style="font-size:10px; font-weight:bold; color:#888; margin-bottom:4px; text-transform:uppercase; letter-spacing:1px;">Template Response:</div>';

        responses.forEach(r => {
            const item = document.createElement('div');
            item.className = 'popup-item';
            item.textContent = r; // Menggunakan textContent agar aman, tapi CSS pre-wrap menjaga format
            item.onclick = (e) => {
                e.stopPropagation();
                popup.style.display = 'none';
                insertIntoMessageBox(r);
            };
            popup.appendChild(item);
        });

        const rect = el.getBoundingClientRect();
        popup.style.display = 'flex';
        popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        popup.style.left = (rect.left + window.scrollX) + 'px';
    }

    function attachClickToHighlights() {
        const els = document.querySelectorAll('[class*="hl-"], [data-hl="1"]');
        els.forEach(el => {
            if (el.dataset.hlClickable === '1') return;
            const textLower = el.textContent.toLowerCase().trim();
            if (wordResponses[textLower]) {
                el.style.cursor = 'pointer';
                el.dataset.hlClickable = '1';
                el.addEventListener('click', e => {
                    e.stopPropagation();
                    showPopupForElement(el, wordResponses[textLower]);
                });
            }
        });
    }

    // Connect existing observer logic to click attachment
    const originalHighlightMessages = highlightMessages;
    highlightMessages = function () {
        originalHighlightMessages();
        attachClickToHighlights();
    };

    // === INISIALISASI AKHIR ===
    // Panggil highlightMessages() setelah SEMUA setup selesai (termasuk Auto-Response)
    highlightMessages();

    // Juga panggil attachClickToHighlights secara berkala untuk menangani elemen yang mungkin terlewat
    setInterval(() => {
        attachClickToHighlights();
    }, 2000);

    console.log('✅ Auto-Response Pro Harden: Newline conversion & anti-double active.');

})();