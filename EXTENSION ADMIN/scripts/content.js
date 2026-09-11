/* ============================================
   STREET ART ADMIN CUSTOMIZER - CONTENT SCRIPT
   Injected into target admin pages
   ============================================ */

// ============ ZERO-FOUC SYNCHRONOUS INJECTION ============
try {
  const isEnabled = window.localStorage.getItem('sa_is_enabled') === 'true';
  const targetUrl = window.localStorage.getItem('sa_target_url') || '';
  
  const currentHost = window.location.hostname;
  if (isEnabled && (!targetUrl || currentHost.includes(targetUrl.replace(/^https?:\/\//, '').split('/')[0]))) {
    
    const injectedStyles = [];

    // 1. If a background exists, instantly hide the default map to prevent FOUC
    if (window.localStorage.getItem('sa_has_bg') === 'true') {
      const foucStyle = document.createElement('style');
      foucStyle.id = 'sa-hide-map-fouc';
      foucStyle.textContent = `
        html, body, .main-outer, #wrapper, html.new-setting body {
          background-image: none !important;
          background-color: #121212 !important;
        }
      `;
      document.documentElement.appendChild(foucStyle);
      injectedStyles.push(foucStyle);
    }

    // 2. Inject core theme CSS
    const syncCss = window.localStorage.getItem('sa_sync_css');
    if (syncCss) {
      const style = document.createElement('style');
      style.id = 'sa-sync-styles';
      style.textContent = syncCss;
      document.documentElement.appendChild(style);
      injectedStyles.push(style);
    }

    // 3. Inject background CSS if it fits in localStorage
    const bgCss = window.localStorage.getItem('sa_bg_css');
    if (bgCss) {
      const bgStyle = document.createElement('style');
      bgStyle.id = 'sa-bg-sync-styles';
      bgStyle.textContent = bgCss;
      document.documentElement.appendChild(bgStyle);
      injectedStyles.push(bgStyle);
    }

    // Keep styles at the end of head for maximum priority
    if (injectedStyles.length > 0) {
      const headObserver = new MutationObserver(() => {
        if (document.head) {
          let needsMove = false;
          for (const s of injectedStyles) {
            if (s.parentElement !== document.head || document.head.lastElementChild !== injectedStyles[injectedStyles.length - 1]) {
              needsMove = true;
              break;
            }
          }
          if (needsMove) {
            for (const s of injectedStyles) document.head.appendChild(s);
          }
        }
      });
      const docObserver = new MutationObserver(() => {
        if (document.head) {
          for (const s of injectedStyles) document.head.appendChild(s);
          headObserver.observe(document.head, { childList: true });
          docObserver.disconnect();
        }
      });
      if (document.head) {
        for (const s of injectedStyles) document.head.appendChild(s);
        headObserver.observe(document.head, { childList: true });
      } else {
        docObserver.observe(document.documentElement, { childList: true });
      }
      document.addEventListener('DOMContentLoaded', () => headObserver.disconnect());
    }
  }
} catch (e) {}

// Bank color definitions (must match popup)
const BANK_COLORS = {
  'BCA':      { bg: '#003D79', text: '#FFFFFF', glow: 'rgba(0, 61, 121, 0.5)' },
  'BNI':      { bg: '#F26522', text: '#FFFFFF', glow: 'rgba(242, 101, 34, 0.5)' },
  'BRI':      { bg: '#0060AF', text: '#FFFFFF', glow: 'rgba(0, 96, 175, 0.5)' },
  'BSI':      { bg: '#00874A', text: '#FFFFFF', glow: 'rgba(0, 135, 74, 0.5)' },
  'CIMB':     { bg: '#7B1113', text: '#FFFFFF', glow: 'rgba(123, 17, 19, 0.5)' },
  'DANA':     { bg: '#108EE9', text: '#FFFFFF', glow: 'rgba(16, 142, 233, 0.5)' },
  'DANAMON':  { bg: '#E8430A', text: '#FFFFFF', glow: 'rgba(232, 67, 10, 0.5)' },
  'GOPAY':    { bg: '#00AA13', text: '#FFFFFF', glow: 'rgba(0, 170, 19, 0.5)' },
  'JAGO':     { bg: '#FFBE00', text: '#1A1A1A', glow: 'rgba(255, 190, 0, 0.5)' },
  'LINKAJA':  { bg: '#E31E25', text: '#FFFFFF', glow: 'rgba(227, 30, 37, 0.5)' },
  'MANDIRI':  { bg: '#003878', text: '#F1C232', glow: 'rgba(0, 56, 120, 0.5)' },
  'MAYBANK':  { bg: '#FDB913', text: '#1A1A1A', glow: 'rgba(253, 185, 19, 0.5)' },
  'OVO':      { bg: '#4C2A86', text: '#FFFFFF', glow: 'rgba(76, 42, 134, 0.5)' },
  'QRIS':     { bg: '#E42313', text: '#FFFFFF', glow: 'rgba(228, 35, 19, 0.5)' },
  'SEABANK':  { bg: '#FF6600', text: '#FFFFFF', glow: 'rgba(255, 102, 0, 0.5)' }
};

let settings = null;
let isInitialized = false;

// ============ ALERTS & TOASTS OVERRIDE ============
function setupAlertOverride() {
  if (document._saAlertSetup) return;
  document._saAlertSetup = true;

  const script = document.createElement('script');
  script.textContent = `
    window._originalSaAlert = window.alert;
    window.alert = function(msg) {
      window.postMessage({ type: 'SA_ALERT', message: msg }, '*');
    };
  `;
  try {
    document.documentElement.appendChild(script);
    script.remove();
  } catch (e) {
    console.warn('Street Art Customizer: Could not override window.alert due to CSP rules on this site.');
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SA_ALERT') {
      const msg = (e.data.message || '').toString();
      const lower = msg.toLowerCase();
      const isSuccess = !lower.includes('gagal') && !lower.includes('error') && !lower.includes('salah');
      showStreetArtAlert(msg, isSuccess ? 'success' : 'error');
    }
  });
}

function showStreetArtAlert(message, type = 'success') {
  const existing = document.getElementById('sa-custom-alert');
  if (existing) existing.remove();

  const alertBox = document.createElement('div');
  alertBox.id = 'sa-custom-alert';
  
  const isSuccess = type === 'success';
  const bgColor = isSuccess ? '#00AA13' : '#E31E25';
  const icon = isSuccess ? '💥 BOOYAH! 💥' : '💀 WASTED! 💀';

  alertBox.innerHTML = `
    <div class="sa-alert-modal" style="border-color: ${bgColor}; box-shadow: 0 0 30px ${bgColor}, inset 0 0 20px rgba(0,0,0,0.8);">
      <h2 style="color: ${bgColor};">${icon}</h2>
      <p>${message}</p>
      <button style="background: ${bgColor};">OKE, SIKAT!</button>
    </div>
  `;

  document.body.appendChild(alertBox);

  const btn = alertBox.querySelector('button');
  btn.addEventListener('click', () => {
    alertBox.firstElementChild.style.animation = 'sa-alert-hide 0.3s ease forwards';
    setTimeout(() => alertBox.remove(), 300);
  });

  setTimeout(() => {
    if (document.body.contains(alertBox)) {
      alertBox.firstElementChild.style.animation = 'sa-alert-hide 0.3s ease forwards';
      setTimeout(() => alertBox.remove(), 300);
    }
  }, isSuccess ? 3500 : 5000);
}

// ============ INIT ============
function init() {
  chrome.storage.local.get('streetArtSettings', (data) => {
    settings = data.streetArtSettings;
    if (!settings || !settings.isEnabled) return;

    // Check if we're on the target URL
    const currentHost = window.location.hostname;
    if (settings.targetUrl && !currentHost.includes(settings.targetUrl.replace(/^https?:\/\//, '').split('/')[0])) {
      return;
    }

    isInitialized = true;
    applyAllMods();
  });
}

// Listen for settings updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_UPDATED') {
    settings = message.settings;
    if (settings.isEnabled && isInitialized) {
      applyAllMods();
    } else if (settings.isEnabled && !isInitialized) {
      const currentHost = window.location.hostname;
      if (settings.targetUrl && currentHost.includes(settings.targetUrl.replace(/^https?:\/\//, '').split('/')[0])) {
        isInitialized = true;
        applyAllMods();
      }
    } else {
      removeAllMods();
    }
  }
});

// ============ SENSITIVE REFERRAL PROTECTION ============
function checkProfileEditPage() {
  if (!window.location.href.includes('player-edit')) return;

  // Poll until elements exist, since they might be loaded via AJAX
  const checkInterval = setInterval(() => {
    const selects = document.querySelectorAll('select');
    let isOrange = false;
    for (const select of selects) {
      if (select.value === 'COLOR_ORANGE' || select.value === 'orange') {
        isOrange = true;
        break;
      }
    }
    
    if (!isOrange) {
       const options = document.querySelectorAll('option:checked');
       for(const opt of options) {
          if (opt.textContent.includes('COLOR_ORANGE')) {
             isOrange = true; break;
          }
       }
    }

    if (isOrange && !document.getElementById('sa-referral-warning')) {
      clearInterval(checkInterval);
      showReferralWarningAndDisable();
    }
    
    // Safety timeout to stop polling after 5 seconds if not found
    setTimeout(() => clearInterval(checkInterval), 5000);
  }, 300);
}

function showReferralWarningAndDisable() {
  const warning = document.createElement('div');
  warning.id = 'sa-referral-warning';
  warning.innerHTML = '⚠️ AKUN REFERRAL ⚠️<br><small>DATA SENSITIF - EDIT DINONAKTIFKAN</small>';
  
  warning.style.background = 'repeating-linear-gradient(45deg, #FFEA00, #FFEA00 10px, #000 10px, #000 20px)';
  warning.style.color = '#FFF';
  warning.style.textShadow = '1px 1px 2px #000, -1px -1px 2px #000';
  warning.style.textAlign = 'center';
  warning.style.padding = '15px';
  warning.style.fontWeight = '900';
  warning.style.fontSize = '24px';
  warning.style.letterSpacing = '2px';
  warning.style.fontFamily = "'Bangers', 'Impact', sans-serif";
  warning.style.borderBottom = '4px solid #FF3300';
  warning.style.position = 'sticky';
  warning.style.top = '0';
  warning.style.zIndex = '99999';

  document.body.insertBefore(warning, document.body.firstChild);

  // Disable inputs inside forms or tables
  document.querySelectorAll('input, select, textarea, button').forEach(el => {
    // Leave back/keluar buttons alone if possible, disable everything else
    if (el.textContent.toLowerCase().includes('keluar') || el.value.toLowerCase().includes('keluar')) return;
    
    el.disabled = true;
    el.style.opacity = '0.5';
    el.style.cursor = 'not-allowed';
  });
}

function applySensitiveRows() {
  document.querySelectorAll('tr[style*="orange"]').forEach(row => {
    // Find the Profil button
    const profilBtn = Array.from(row.querySelectorAll('a, button')).find(el => 
      (el.textContent || '').trim().toLowerCase() === 'profil' || 
      (el.value || '').trim().toLowerCase() === 'profil'
    );
    
    if (profilBtn && !profilBtn.classList.contains('sa-referral-btn')) {
      profilBtn.setAttribute('data-sa-tooltip', 'AKUN REFERRAL');
      profilBtn.classList.add('sa-referral-btn');
    }
  });
}

// ============ APPLY ALL MODIFICATIONS ============
function applyAllMods() {
  if (!settings) return;

  injectStreetArtStylesheet();
  applyThemeColors();
  applyBackgroundImage();

  // Cache styles for zero-FOUC next reload
  try {
    let coreCss = '';
    const baseStyle = document.getElementById('sa-injected-styles');
    if (baseStyle) coreCss += baseStyle.textContent;
    const themeStyle = document.getElementById('sa-theme-styles');
    if (themeStyle) coreCss += themeStyle.textContent;

    window.localStorage.setItem('sa_sync_css', coreCss);
    window.localStorage.setItem('sa_is_enabled', settings.isEnabled ? 'true' : 'false');
    window.localStorage.setItem('sa_target_url', settings.targetUrl || '');
    
    const bgStyle = document.getElementById('sa-bg-style');
    if (bgStyle && settings.backgroundImage) {
      window.localStorage.setItem('sa_has_bg', 'true');
      try {
        window.localStorage.setItem('sa_bg_css', bgStyle.textContent);
      } catch (e) {
        // Quota exceeded for large images, but we have the flag
        window.localStorage.removeItem('sa_bg_css'); 
      }
    } else {
      window.localStorage.setItem('sa_has_bg', 'false');
      window.localStorage.removeItem('sa_bg_css');
    }
    
    const syncStyle = document.getElementById('sa-sync-styles');
    if (syncStyle) syncStyle.remove();
  } catch(e) {}

  const applyDomMods = () => {
    applyBankHighlights();
    applyQuickNotes();
    applyWatchList();
    applySensitiveRows();
    applyDateHighlights();
    
    // Apply transaction status colors to top document and all iframes
    applyTransactionStatusColors(document);
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
          // Inject or update styles in iframe
          let styleElement = iframeDoc.getElementById('sa-injected-styles');
          if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'sa-injected-styles';
            iframeDoc.head.appendChild(styleElement);
          }
          const topStyle = document.getElementById('sa-injected-styles');
          if (topStyle && styleElement.textContent !== topStyle.textContent) {
            styleElement.textContent = topStyle.textContent;
          }
          applyTransactionStatusColors(iframeDoc);
        }
      } catch (e) {
        // Cross-origin iframe, ignore
      }
    });
    
    // Check and apply player log password reset alert uniformly
    checkAndApplyPlayerLogAlert();
    
    applyCustomWords();
    applySpiderWebLocks();
    setupAutoCopy();
    setupSkaterCombos();
    setupAlertOverride();
    checkProfileEditPage();
    setupPlayerEditValidationWatcher();
    checkAndApplyScreenshotReminder();
  };

  if (document.body) {
    applyDomMods();
  } else {
    document.addEventListener('DOMContentLoaded', applyDomMods);
  }
  
  // FAILSAFE & FOUC PREVENTION: 
  // Intelligently observe iframes to instantly catch AJAX loads without annoying delay
  setInterval(() => {
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body && !iframe.dataset.saObserved) {
          iframe.dataset.saObserved = "true";
          
          const iframeObserver = new MutationObserver(() => {
            clearTimeout(iframe.saTimeout);
            iframe.saTimeout = setTimeout(() => {
              applyDomMods();
            }, 15); // Instant apply on AJAX load
          });
          
          iframeObserver.observe(iframeDoc.body, { childList: true, subtree: true });
          
          // Force apply initially
          applyDomMods();
        }
      } catch (e) {
        // Cross-origin, ignore
      }
    });
  }, 250);

  console.log('🛹 Street Art Admin Customizer: All mods applied!');
}

// ============ REMOVE ALL MODIFICATIONS ============
function removeAllMods() {
  const injected = document.getElementById('sa-injected-styles');
  if (injected) injected.remove();
  const bgOverlay = document.getElementById('sa-bg-style');
  if (bgOverlay) bgOverlay.remove();
  const themeStyle = document.getElementById('sa-theme-styles');
  if (themeStyle) themeStyle.remove();
  
  // Remove all sticker notes
  document.querySelectorAll('.sa-sticker-note').forEach(el => el.remove());
  // Remove watch badges
  document.querySelectorAll('.sa-watch-badge').forEach(el => el.remove());
  // Remove player log alerts and reset states
  document.querySelectorAll('#sa-playerlog-pw-alert, #sa-playerlog-alert-row, .sa-input-alert-tag').forEach(el => el.remove());
  document.querySelectorAll('.sa-affected-user-danger').forEach(el => {
    el.classList.remove('sa-affected-user-danger');
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('border');
    el.style.removeProperty('box-shadow');
    el.style.removeProperty('color');
    el.style.removeProperty('font-weight');
    el.style.removeProperty('outline');
  });
  document.querySelectorAll('.sa-pw-reset-row').forEach(el => el.classList.remove('sa-pw-reset-row'));
  document.querySelectorAll('.sa-pw-reset-badge').forEach(el => el.remove());
  
  // Remove screenshot validation reminder elements
  document.querySelectorAll('#sa-keterangan-badge, #sa-status-sop-alert, #sa-paste-link-btn, #sa-editplayer-pre-alert').forEach(el => el.remove());
  document.querySelectorAll('.sa-keterangan-danger').forEach(el => {
    el.classList.remove('sa-keterangan-danger');
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('border');
    el.style.removeProperty('box-shadow');
    el.style.removeProperty('color');
    el.style.removeProperty('font-weight');
    el.style.removeProperty('outline');
  });
}

// ============ INJECT BASE STYLESHEET ============
function injectStreetArtStylesheet() {
  let style = document.getElementById('sa-injected-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'sa-injected-styles';
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  style.textContent = `
    /* Street Art Injected Styles */

    /* ===== TRANSACTION STATUS ===== */
    .sa-tx-status {
      display: inline-block;
      padding: 4px 8px;
      margin: 0;
      border-radius: 4px;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-shadow: 1px 1px 0 rgba(0,0,0,0.8);
      font-family: 'Outfit', sans-serif;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.3);
      white-space: nowrap;
    }
    
    .sa-tx-status.success {
      background: linear-gradient(135deg, #27ae60, #2ecc71);
      color: #FFFFFF;
      border-bottom: 2px solid #1e8449;
    }
    
    .sa-tx-status.reject {
      background: linear-gradient(135deg, #c0392b, #e74c3c);
      color: #FFFFFF;
      border-bottom: 2px solid #922b21;
    }
    
    .sa-tx-status.wrong {
      background: linear-gradient(135deg, #d35400, #e67e22);
      color: #FFFFFF;
      border-bottom: 2px solid #a04000;
    }
    
    .sa-tx-status.info-incorrect {
      background: linear-gradient(135deg, #8e44ad, #9b59b6);
      color: #FFFFFF;
      border-bottom: 2px solid #6c3483;
    }
    
    .sa-tx-status.wait {
      background: linear-gradient(135deg, #2980b9, #3498db);
      color: #FFFFFF;
      border-bottom: 2px solid #1f618d;
    }

    /* TRANSACTION ROWS OVERRIDE (SOLID COLORS) */
    tr.sa-tx-row-success > td { background: #2ecc71 !important; color: #000 !important; border-bottom: 1px solid #27ae60 !important; }
    tr.sa-tx-row-reject > td { background: #e74c3c !important; color: #fff !important; border-bottom: 1px solid #c0392b !important; }
    tr.sa-tx-row-wrong > td { background: #e67e22 !important; color: #fff !important; border-bottom: 1px solid #d35400 !important; }
    tr.sa-tx-row-info-incorrect > td { background: #9b59b6 !important; color: #fff !important; border-bottom: 1px solid #8e44ad !important; }
    tr.sa-tx-row-wait > td { background: #f1c40f !important; color: #000 !important; border-bottom: 1px solid #f39c12 !important; }

    /* ===== BANK HIGHLIGHT BADGES ===== */
    .sa-bank-badge {
      display: inline-block;
      padding: 0 2px;
      margin: 0;
      border-radius: 3px;
      font-weight: 700;
      font-size: inherit;
      text-transform: uppercase;
      position: relative;
      transition: all 0.3s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.2);
      animation: sa-badge-pop 0.4s ease;
    }

    .sa-bank-badge:hover {
      transform: scale(1.08) rotate(-2deg);
      z-index: 10;
    }

    /* Doodle underline effect */
    .sa-bank-badge::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 10%;
      right: 10%;
      height: 3px;
      background: currentColor;
      border-radius: 2px;
      opacity: 0.5;
      transform: skewX(-12deg);
    }

    @keyframes sa-badge-pop {
      0% { transform: scale(0.7); opacity: 0; }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* ===== STICKER NOTES (Spray Paint) ===== */
    .sa-sticker-note {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 4px;
      padding: 0 4px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      font-family: 'Segoe UI', Arial, sans-serif;
      animation: sa-sticker-appear 0.5s ease;
      cursor: default;
      position: relative;
      vertical-align: middle;
      text-shadow: 0 1px 2px rgba(0,0,0,0.4);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
    }

    .sa-sticker-note::before {
      content: '🏷️';
      font-size: 10px;
    }

    .sa-sticker-note:hover {
      transform: rotate(-3deg) scale(1.05);
    }

    @keyframes sa-sticker-appear {
      0% { transform: scale(0) rotate(-20deg); opacity: 0; }
      60% { transform: scale(1.15) rotate(3deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    /* ===== WATCH LIST BADGES ===== */
    .sa-watch-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 4px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      animation: sa-badge-pop 0.5s ease;
      vertical-align: middle;
      border: 1px solid rgba(255,255,255,0.2);
    }

    .sa-watch-badge.wanted {
      background: linear-gradient(135deg, #FF3B30, #C0392B);
      color: #FFFFFF;
      box-shadow: 0 2px 5px rgba(192, 57, 43, 0.4);
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    .sa-watch-badge.wanted::before {
      content: '🚨';
      font-size: 11px;
    }

    .sa-watch-badge.vip {
      background: linear-gradient(135deg, #F1C40F, #F39C12);
      color: #1A1A1A;
      box-shadow: 0 2px 5px rgba(241, 196, 15, 0.4);
      border-color: rgba(0,0,0,0.1);
    }

    .sa-watch-badge.vip::before {
      content: '👑';
      font-size: 11px;
    }

    /* Wanted row highlight */
    tr.sa-wanted-row {
      background: linear-gradient(90deg, rgba(50, 10, 10, 0.9) 0%, rgba(20, 5, 5, 0.75) 100%) !important;
    }
    
    tr.sa-wanted-row > td {
      color: #FFFFFF !important;
      text-shadow: 1px 1px 2px #000000 !important;
      border-bottom: 1px solid rgba(231, 76, 60, 0.4) !important;
      background: transparent !important;
    }
    
    tr.sa-wanted-row > td a {
      color: #FFB3B3 !important;
      text-shadow: none !important;
    }

    /* VIP row highlight */
    tr.sa-vip-row {
      background: linear-gradient(90deg, rgba(50, 45, 10, 0.9) 0%, rgba(20, 18, 5, 0.75) 100%) !important;
    }
    
    tr.sa-vip-row > td {
      color: #FFFFFF !important;
      text-shadow: 1px 1px 2px #000000 !important;
      border-bottom: 1px solid rgba(241, 196, 15, 0.4) !important;
      background: transparent !important;
    }
    
    tr.sa-vip-row > td a {
      color: #FFECA1 !important;
      text-shadow: none !important;
    }

    /* ===== SENSITIVE PLAYER ROW (ORANGE) OVERRIDE ===== */
    table tr[style*="background: orange"] > td,
    table tr[style*="background:orange"] > td,
    table tr[style*="background-color: orange"] > td,
    table tr[style*="background-color:orange"] > td {
      background-color: rgba(255, 119, 0, 0.15) !important;
      color: #FFFFFF !important;
      font-weight: bold !important;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
      border-bottom: 1px solid rgba(255,119,0,0.3) !important;
    }
    
    table tr[style*="background: orange"] > td:first-child,
    table tr[style*="background:orange"] > td:first-child,
    table tr[style*="background-color: orange"] > td:first-child,
    table tr[style*="background-color:orange"] > td:first-child {
      box-shadow: inset 4px 0 0 #FF7700 !important;
    }

    /* ===== REFERRAL BUTTON TOOLTIP ===== */
    .sa-referral-btn {
      position: relative !important;
      overflow: visible !important;
    }
    
    .sa-referral-btn:hover::after {
      content: attr(data-sa-tooltip);
      position: absolute;
      bottom: 120%;
      left: 50%;
      transform: translateX(-50%);
      background: repeating-linear-gradient(45deg, #FFEA00 0, #FFEA00 5px, #000 5px, #000 10px);
      color: #FFF;
      text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 900;
      font-size: 14px;
      white-space: nowrap;
      z-index: 99999;
      pointer-events: none;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      animation: sa-badge-pop 0.3s ease forwards;
    }
    
    .sa-referral-btn:hover::before {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #000;
      z-index: 99999;
      pointer-events: none;
    }

    /* ===== AUTO-COPY POW EFFECT ===== */
    .sa-pow-effect {
      position: fixed;
      pointer-events: none;
      z-index: 99999;
      font-family: 'Bangers', 'Impact', cursive;
      font-size: 28px;
      font-weight: 900;
      color: #FFD60A;
      text-shadow: 
        -2px -2px 0 #FF006E,
        2px -2px 0 #FF006E,
        -2px 2px 0 #FF006E,
        2px 2px 0 #FF006E,
        0 0 20px rgba(255,0,110,0.6);
      animation: sa-pow 0.8s ease-out forwards;
      letter-spacing: 3px;
    }

    /* ===== DATE HIGHLIGHT ===== */
    .sa-date-highlight {
      background: linear-gradient(90deg, #FF006E, #8338EC);
      color: #FFF !important;
      padding: 0 2px;
      margin: 0;
      border-radius: 3px;
      font-weight: 900;
      text-shadow: 1px 1px 2px #000;
      box-shadow: 0 0 10px rgba(255,0,110,0.6), inset 0 -2px 0 #FFEA00;
      animation: sa-pulse 2s infinite;
      font-family: 'Outfit', sans-serif;
    }
    
    @keyframes sa-pulse {
      0% { box-shadow: 0 0 5px rgba(255,0,110,0.4); }
      50% { box-shadow: 0 0 15px rgba(255,0,110,0.8); }
      100% { box-shadow: 0 0 5px rgba(255,0,110,0.4); }
    }

    /* ===== CUSTOM ALERTS ===== */
    #sa-custom-alert {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .sa-alert-modal {
      background: #1A1A1A url('data:image/svg+xml;utf8,<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="2" fill="rgba(255,255,255,0.05)"/></svg>');
      border: 4px solid;
      border-radius: 12px;
      padding: 30px 40px;
      text-align: center;
      min-width: 350px;
      max-width: 80%;
      font-family: 'Outfit', sans-serif;
      animation: sa-alert-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    
    .sa-alert-modal h2 {
      font-family: 'Bangers', 'Impact', cursive;
      font-size: 42px;
      margin: 0 0 15px 0;
      letter-spacing: 3px;
      text-shadow: 2px 2px 0px #000;
    }
    
    .sa-alert-modal p {
      color: #FFF;
      font-size: 20px;
      margin: 0 0 25px 0;
      font-weight: 600;
    }
    
    .sa-alert-modal button {
      color: #FFF;
      border: none;
      padding: 12px 35px;
      font-size: 18px;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 0 5px 0 #000;
      transition: all 0.2s;
    }
    
    .sa-alert-modal button:hover {
      transform: translateY(2px);
      box-shadow: 0 3px 0 #000;
    }
    
    @keyframes sa-alert-pop {
      from { transform: scale(0) rotate(-10deg); opacity: 0; }
      to { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes sa-alert-hide {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(0.5); opacity: 0; }
    }

    @keyframes sa-pow {
      0% {
        transform: scale(0.3) rotate(-15deg);
        opacity: 1;
      }
      40% {
        transform: scale(1.3) rotate(5deg);
        opacity: 1;
      }
      100% {
        transform: scale(1.6) rotate(0deg) translateY(-40px);
        opacity: 0;
      }
    }

    /* ===== COMBO TOAST ===== */
    .sa-combo-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      padding: 12px 24px;
      background: linear-gradient(135deg, #1A1A2E, #16213E);
      border: 2px solid #7B2FF7;
      border-radius: 12px;
      color: #00F5D4;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      box-shadow: 0 0 30px rgba(123, 47, 247, 0.4);
      animation: sa-toast-in 0.4s ease, sa-toast-out 0.4s ease 1.5s forwards;
    }

    .sa-combo-toast::before {
      content: '⚡ ';
    }

    @keyframes sa-toast-in {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes sa-toast-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100px); opacity: 0; }
    }

    }

    /* ===== SPIDER-WEB LOCK ANIMATION ===== */
    .sa-lock-wrapper {
      position: relative !important;
      display: inline !important;
    }

    /* Hide original image */
    .sa-lock-wrapper img {
      display: none !important;
    }

    /* Combined Lock SVG */
    .sa-combined-lock {
      width: 24px !important;
      height: 24px !important;
      vertical-align: middle !important;
      margin-left: 6px !important;
      margin-right: 2px !important;
      cursor: pointer !important;
    }

    .sa-lock-fg {
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
      transform-origin: 12px 12px !important;
    }

    .sa-combined-lock:hover .sa-lock-fg {
      transform: scale(1.3) rotate(-5deg) !important;
      filter: drop-shadow(0 0 6px rgba(255, 0, 0, 0.8)) !important;
    }

    .sa-web-bg {
      transform-origin: 12px 12px !important;
      animation: sa-static-web-pulse 3s ease-in-out infinite alternate;
    }

    @keyframes sa-static-web-pulse {
      0% { transform: scale(0.95); opacity: 0.6; }
      100% { transform: scale(1.05); opacity: 0.9; }
    }

    /* Premium Spidey Style for Default Tooltip */
    @keyframes sa-tooltip-glow {
      0% { box-shadow: 0 8px 25px rgba(226, 54, 54, 0.4), inset 0 0 20px rgba(4, 69, 121, 0.8), inset 0 0 0 1px #ff6b81; }
      50% { box-shadow: 0 8px 35px rgba(226, 54, 54, 0.7), inset 0 0 30px rgba(4, 69, 121, 1), inset 0 0 0 2px #ff4757; }
      100% { box-shadow: 0 8px 25px rgba(226, 54, 54, 0.4), inset 0 0 20px rgba(4, 69, 121, 0.8), inset 0 0 0 1px #ff6b81; }
    }

    /* Reset outer container to preserve default positioning */
    .sa-spidey-default-tooltip {
      opacity: 1 !important; /* Ensure vibrant colors */
    }

    /* Apply Premium Spidey Style to ALL Bootstrap Tooltips */
    .tooltip-inner, .sa-spidey-default-tooltip .tooltip-inner {
      background-color: #061121 !important;
      background-image: 
        /* Spidey Logo Watermark on the right */
        url("data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M40%2035%20Q50%2030%2060%2035%20Q65%2050%2055%2065%20Q50%2070%2045%2065%20Q35%2050%2040%2035%20Z%22%20fill%3D%22%23e23636%22%20opacity%3D%220.35%22%2F%3E%3Cpath%20d%3D%22M42%2025%20Q50%2015%2058%2025%20Q60%2035%2050%2038%20Q40%2035%2042%2025%20Z%22%20fill%3D%22%23e23636%22%20opacity%3D%220.35%22%2F%3E%3Cpath%20d%3D%22M45%2040%20Q30%2020%2015%2025%20M55%2040%20Q70%2020%2085%2025%20M43%2045%20Q25%2035%2010%2045%20M57%2045%20Q75%2035%2090%2045%20M43%2055%20Q25%2065%2015%2080%20M57%2055%20Q75%2065%2085%2080%20M45%2060%20Q40%2080%2035%2095%20M55%2060%20Q60%2080%2065%2095%22%20stroke%3D%22%23e23636%22%20stroke-width%3D%224%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.35%22%2F%3E%3C%2Fsvg%3E"),
        /* Web Pattern Background */
        url("data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200%20L60%2060%20M60%200%20L0%2060%20M30%200%20L30%2060%20M0%2030%20L60%2030%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%220.8%22%20opacity%3D%220.04%22%2F%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%2215%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%220.8%22%20opacity%3D%220.04%22%20fill%3D%22none%22%2F%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%2230%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%220.8%22%20opacity%3D%220.04%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E"),
        /* Deep Blue/Black Gradient */
        linear-gradient(135deg, #0b1a2f 0%, #030811 100%) !important;
      background-position: right 10px center, 0 0, 0 0 !important;
      background-size: 55px 55px, 40px 40px, auto !important;
      background-repeat: no-repeat, repeat, no-repeat !important;
      color: #f1f2f6 !important;
      border: 2px solid #e23636 !important;
      border-radius: 10px !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-weight: bold !important;
      padding: 12px 16px !important;
      padding-right: 70px !important; /* Leave space for the logo */
      text-shadow: 1px 1px 3px rgba(0,0,0,0.9) !important;
      animation: sa-tooltip-glow 2.5s ease-in-out infinite !important;
      max-width: 400px !important;
      text-align: left !important;
    }

    /* Style the arrow to match the red border */
    .tooltip.top .tooltip-arrow, .sa-spidey-default-tooltip.top .tooltip-arrow { border-top-color: #e23636 !important; }
    .tooltip.bottom .tooltip-arrow, .sa-spidey-default-tooltip.bottom .tooltip-arrow { border-bottom-color: #e23636 !important; }
    .tooltip.right .tooltip-arrow, .sa-spidey-default-tooltip.right .tooltip-arrow { border-right-color: #e23636 !important; }
    .tooltip.left .tooltip-arrow, .sa-spidey-default-tooltip.left .tooltip-arrow { border-left-color: #e23636 !important; }

    /* Add a spider emoji before the text */
    .tooltip-inner::before, .sa-spidey-default-tooltip .tooltip-inner::before {
      content: '🕷️ ';
      font-size: 15px;
      margin-right: 6px;
      filter: drop-shadow(0 0 5px rgba(226, 54, 54, 0.8));
    }
    
    /* Make the inner magenta highlight look cooler against the dark background */
    .tooltip-inner .sa-date-highlight, .sa-spidey-default-tooltip .tooltip-inner .sa-date-highlight {
      box-shadow: 0 0 10px rgba(255, 71, 87, 0.9) !important;
      border: 1px solid rgba(255,255,255,0.3) !important;
      text-shadow: none !important;
      position: relative;
      z-index: 2;
    }

    /* ===== PLAYER LOG PASSWORD RESET DETECTOR ===== */
    .sa-affected-user-danger {
      background: #ffccd5 !important;
      background-color: #ffccd5 !important;
      border: 3px solid #ff0055 !important;
      box-shadow: 0 0 16px rgba(255, 0, 85, 0.95), inset 0 0 8px rgba(255, 0, 85, 0.35) !important;
      color: #990022 !important;
      font-weight: 900 !important;
      outline: 2px solid #ff0055 !important;
      animation: sa-input-pulse 1.2s infinite alternate ease-in-out !important;
    }

    @keyframes sa-input-pulse {
      0% {
        box-shadow: 0 0 8px rgba(255, 0, 85, 0.5);
        border-color: #ff3377;
      }
      100% {
        box-shadow: 0 0 20px rgba(255, 0, 85, 1);
        border-color: #ff0055;
      }
    }

    .sa-input-alert-tag {
      display: inline-block;
      margin-left: 8px;
      padding: 3px 8px;
      background: linear-gradient(135deg, #ff0055, #c0003c);
      color: #ffffff !important;
      font-size: 11px;
      font-weight: 800;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(255, 0, 85, 0.5);
      animation: sa-badge-blink 1s infinite alternate;
      vertical-align: middle;
      font-family: 'Outfit', sans-serif;
    }

    .sa-playerlog-alert-card {
      margin: 8px auto;
      width: 100%;
      max-width: 480px;
      background: #1a0509;
      border: 2px solid #ff0055;
      border-radius: 8px;
      box-shadow: 0 4px 25px rgba(255, 0, 85, 0.45), inset 0 0 20px rgba(0, 0, 0, 0.85);
      overflow: hidden;
      font-family: 'Outfit', sans-serif;
      animation: sa-alert-slide-down 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-sizing: border-box;
      text-align: left;
    }

    @keyframes sa-alert-slide-down {
      0% { opacity: 0; transform: translateY(-10px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .sa-alert-hazard-header {
      background: repeating-linear-gradient(45deg, #ff0055, #ff0055 12px, #80002b 12px, #80002b 24px);
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-shadow: 1px 1px 2px #000;
    }

    .sa-alert-hazard-header .sa-alert-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-family: 'Bangers', 'Outfit', sans-serif;
      text-align: center;
    }

    .sa-alert-hazard-header .sa-alert-icon {
      font-size: 20px;
    }

    .sa-alert-body {
      padding: 14px 18px;
      color: #ffffff;
      background: rgba(20, 5, 8, 0.95);
    }

    .sa-alert-info-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 12px;
      align-items: center;
    }

    .sa-info-chip {
      background: #2b0b14;
      border: 1px solid #ff0055;
      padding: 5px 12px;
      border-radius: 5px;
      font-size: 12px;
      color: #ffb3c6;
    }

    .sa-info-chip b {
      color: #ffffff;
    }

    .sa-info-chip.count {
      background: #ff0055;
      color: #ffffff;
      border-color: #ffffff;
      font-weight: 900;
      box-shadow: 0 0 10px rgba(255, 0, 85, 0.6);
    }

    .sa-alert-instruction {
      background: rgba(255, 0, 85, 0.15);
      border-left: 4px solid #ff0055;
      padding: 10px 14px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
      color: #ffe6eb;
    }

    .sa-alert-instruction strong {
      color: #ff3377;
    }

    .sa-alert-instruction u {
      text-decoration-color: #ff0055;
      font-weight: 700;
    }

    /* Highlight table row */
    tr.sa-pw-reset-row > td {
      background: linear-gradient(90deg, rgba(255, 0, 85, 0.35) 0%, rgba(128, 0, 43, 0.25) 100%) !important;
      border-top: 2px solid #ff0055 !important;
      border-bottom: 2px solid #ff0055 !important;
      color: #ffffff !important;
    }

    .sa-pw-reset-badge {
      display: inline-block;
      background: linear-gradient(135deg, #ff0055, #c0003c);
      color: #ffffff !important;
      font-size: 11px;
      font-weight: 900;
      padding: 2px 7px;
      border-radius: 4px;
      margin-left: 8px;
      border: 1px solid #ff80a6;
      box-shadow: 0 2px 6px rgba(255, 0, 85, 0.5);
      animation: sa-badge-blink 1s infinite alternate;
      vertical-align: middle;
      white-space: nowrap;
    }

    @keyframes sa-badge-blink {
      0% { opacity: 0.85; transform: scale(0.97); }
      100% { opacity: 1; transform: scale(1.03); }
    }

    /* ===== PENGINGAT LINK SCREENSHOT VALIDASI REKENING ===== */
    .sa-keterangan-danger {
      background: #fff0f3 !important;
      background-color: #fff0f3 !important;
      border: 3px solid #ff0055 !important;
      box-shadow: 0 0 16px rgba(255, 0, 85, 0.95), inset 0 0 8px rgba(255, 0, 85, 0.25) !important;
      color: #990022 !important;
      font-weight: 700 !important;
      outline: 2px solid #ff0055 !important;
      animation: sa-input-pulse 1.2s infinite alternate ease-in-out !important;
    }

    .sa-keterangan-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 3px 8px;
      background: linear-gradient(135deg, #ff0055, #c0003c);
      color: #ffffff !important;
      font-size: 11px;
      font-weight: 800;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(255, 0, 85, 0.5);
      animation: sa-badge-blink 1s infinite alternate;
      vertical-align: middle;
      font-family: 'Outfit', sans-serif;
    }

    .sa-status-sop-alert {
      margin: 12px 0;
      width: 100%;
      background: #1a0509;
      border: 2px solid #ff0055;
      border-radius: 8px;
      box-shadow: 0 4px 25px rgba(255, 0, 85, 0.45), inset 0 0 20px rgba(0, 0, 0, 0.85);
      overflow: hidden;
      font-family: 'Outfit', sans-serif;
      animation: sa-alert-slide-down 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-sizing: border-box;
      text-align: left;
    }

    .sa-paste-clipboard-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      padding: 6px 14px;
      background: linear-gradient(135deg, #00aa13, #00770d);
      color: #ffffff !important;
      font-size: 12px;
      font-weight: 800;
      border: 1px solid #33cc44;
      border-radius: 5px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 170, 19, 0.4);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      font-family: 'Outfit', sans-serif;
    }

    .sa-paste-clipboard-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 170, 19, 0.7);
      background: linear-gradient(135deg, #00c917, #00880e);
    }

    .sa-editplayer-pre-submit-alert {
      margin: 10px 0;
      padding: 10px 14px;
      background: linear-gradient(135deg, #380813, #1f0309);
      border: 2px solid #ff0055;
      border-radius: 6px;
      color: #ffccd5;
      font-size: 13px;
      font-family: 'Outfit', sans-serif;
      box-shadow: 0 0 14px rgba(255, 0, 85, 0.4);
      animation: sa-alert-slide-down 0.3s ease;
    }
  `;
}

// ============ BACKGROUND IMAGE ============
function applyBackgroundImage() {
  let style = document.getElementById('sa-bg-style');

  if (!settings.backgroundImage) {
    if (style) style.remove();
    return;
  }

  if (!style) {
    style = document.createElement('style');
    style.id = 'sa-bg-style';
    const target = document.head || document.documentElement;
    target.appendChild(style);
  }

  const opacity = (settings.backgroundOpacity || 15) / 100;
  
  style.textContent = `
    html::before {
      content: '';
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background-image: url('${settings.backgroundImage}');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      opacity: ${opacity};
      pointer-events: none;
      z-index: -9999;
    }
    html, html.new-setting {
      background-color: #121212 !important;
      background-image: none !important;
    }
    body, .main-outer, #wrapper, html.new-setting body {
      background-color: transparent !important;
      background-image: none !important;
    }
  `;
}

// ============ THEME COLORS ============
function applyThemeColors() {
  if (!settings.themeColors) return;

  let themeStyle = document.getElementById('sa-theme-styles');
  if (!themeStyle) {
    themeStyle = document.createElement('style');
    themeStyle.id = 'sa-theme-styles';
    const target = document.head || document.documentElement;
    target.appendChild(themeStyle);
  }

  const tc = settings.themeColors;
  let css = '';

  // Sidebar — try common selectors
  if (tc.sidebarBg && tc.sidebarBg !== '#2c1810') {
    css += `
      .sidebar, .left-menu, .menu-left, [class*="sidebar"], [class*="menu-left"],
      .nav-left, .panel-left, td[class*="menu"], td[width="130"] {
        background-color: ${tc.sidebarBg} !important;
        background: ${tc.sidebarBg} !important;
      }
    `;
  }

  if (tc.sidebarText && tc.sidebarText !== '#ffffff') {
    css += `
      .sidebar a, .left-menu a, [class*="sidebar"] a, [class*="menu-left"] a,
      td[class*="menu"] a, td[width="130"] a {
        color: ${tc.sidebarText} !important;
      }
    `;
  }

  // Header
  if (tc.headerBg && tc.headerBg !== '#8B6914') {
    css += `
      .header, .top-bar, .navbar, [class*="header"], [class*="navbar"],
      .top-menu, tr:first-child td[colspan] {
        background-color: ${tc.headerBg} !important;
        background: ${tc.headerBg} !important;
      }
    `;
  }

  if (tc.headerText && tc.headerText !== '#ffffff') {
    css += `
      .header *, .top-bar *, .navbar *, [class*="header"] *, [class*="navbar"] * {
        color: ${tc.headerText} !important;
      }
    `;
  }

  // Table rows
  if (tc.tableRowOdd && tc.tableRowOdd !== '#f5f5f5') {
    css += `
      table tr:nth-child(odd) td {
        background-color: ${tc.tableRowOdd} !important;
      }
    `;
  }

  if (tc.tableRowEven && tc.tableRowEven !== '#ffffff') {
    css += `
      table tr:nth-child(even) td {
        background-color: ${tc.tableRowEven} !important;
      }
    `;
  }

  if (tc.tableText && tc.tableText !== '#333333') {
    css += `
      table td, table th {
        color: ${tc.tableText} !important;
      }
    `;
  }

  // Buttons
  if (tc.buttonPrimary && tc.buttonPrimary !== '#e8860c') {
    css += `
      input[type="button"], input[type="submit"], button.btn-primary,
      .btn-primary, a.btn {
        background-color: ${tc.buttonPrimary} !important;
        border-color: ${tc.buttonPrimary} !important;
      }
    `;
  }

  if (tc.buttonSecondary && tc.buttonSecondary !== '#4a90d9') {
    css += `
      .btn-secondary, .btn-info, button.btn-info {
        background-color: ${tc.buttonSecondary} !important;
        border-color: ${tc.buttonSecondary} !important;
      }
    `;
  }

  themeStyle.textContent = css;
}

// ============ HELPERS FOR COLUMN EXCLUSION ============
const tableExcludedIndexes = new WeakMap();

function isExcludedColumn(el) {
  const td = el.closest('td');
  if (!td) return false;

  const table = td.closest('table');
  if (!table) return false;

  let excludedIndexes = tableExcludedIndexes.get(table);
  if (!excludedIndexes) {
    excludedIndexes = [];
    const headerRow = table.querySelector('tr');
    if (headerRow) {
      const ths = headerRow.querySelectorAll('th, td');
      ths.forEach((th, index) => {
        const text = (th.textContent || '').trim().toLowerCase();
        if (text === 'userid' || text === 'user id' || text.includes('nama') || text === 'name') {
          excludedIndexes.push(index);
        }
      });
    }
    tableExcludedIndexes.set(table, excludedIndexes);
  }

  return excludedIndexes.includes(td.cellIndex);
}

// ============ BANK HIGHLIGHTS ============
function applyBankHighlights() {
  if (!settings.bankHighlights) return;

  // Find all text nodes in the page that contain bank names
  const bankNames = Object.keys(BANK_COLORS);

  // Process checkboxes/labels near bank names (common in the admin UI based on screenshots)
  processTextNodes(document.body, bankNames);

  // Also process table cells
  document.querySelectorAll('td, th, label, span, a, div, input[type="button"], input[type="checkbox"]').forEach(el => {
    if (isExcludedColumn(el)) return;
    
    bankNames.forEach(bankName => {
      const text = el.textContent || el.value || '';
      // Check if this element's direct text contains a bank name
      if (el.children.length === 0 || el.tagName === 'LABEL' || el.tagName === 'TD') {
        const regex = new RegExp(`\\b${bankName}\\b`, 'gi');
        if (regex.test(text) && !el.classList.contains('sa-bank-highlighted')) {
          const colors = BANK_COLORS[bankName];
          if (colors && !el.querySelector('.sa-bank-badge')) {
            // For checkbox labels, highlight the label
            if (el.tagName === 'LABEL' || (el.tagName === 'TD' && text.trim().toUpperCase().includes(bankName))) {
              highlightBankElement(el, bankName, colors);
            }
          }
        }
      }
    });
  });
}

function processTextNodes(root, bankNames) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

    textNodes.forEach(node => {
    const text = node.textContent;
    bankNames.forEach(bankName => {
      const regex = new RegExp(`\\b(${bankName}\\b\\s*\\[?\\d*\\]?)`, 'gi');
      if (regex.test(text) && node.parentElement && !node.parentElement.classList.contains('sa-bank-badge')) {
        const parent = node.parentElement;
        
        // Don't highlight inside excluded columns (UserId, Nama, dll)
        if (isExcludedColumn(parent)) return;

        // Don't process if already highlighted or if it's our own UI
        if (parent.closest('.sa-bank-badge, .sa-sticker-note, .sa-watch-badge, .sa-pow-effect, .sa-combo-toast')) return;

        const colors = BANK_COLORS[bankName];
        if (!colors) return;

        // Replace text with highlighted version
        const newHtml = text.replace(regex, (match) => {
          return `<span class="sa-bank-badge" style="background:${colors.bg};color:${colors.text};box-shadow:0 0 12px ${colors.glow}">${match}</span>`;
        });

        if (newHtml !== text) {
          const wrapper = document.createElement('span');
          wrapper.innerHTML = newHtml;
          parent.replaceChild(wrapper, node);
        }
      }
    });
  });
}

function highlightBankElement(el, bankName, colors) {
  el.classList.add('sa-bank-highlighted');
  el.style.cssText += `
    background-color: ${colors.bg} !important;
    color: ${colors.text} !important;
    padding: 0 3px !important;
    margin: 0 !important;
    border-radius: 3px !important;
    box-shadow: 0 0 10px ${colors.glow} !important;
    display: inline-block !important;
    transition: all 0.3s ease !important;
  `;
}

// ============ QUICK NOTES (Spray Paint) ============
function applyQuickNotes() {
  if (!settings.quickNotes) return;

  // Remove old notes
  document.querySelectorAll('.sa-sticker-note').forEach(el => el.remove());

  const notes = settings.quickNotes;
  const userIds = Object.keys(notes);
  if (userIds.length === 0) return;

  // Search for UserIDs in the page
  document.querySelectorAll('td, span, a, div').forEach(el => {
    if (el.children.length > 2) return; // Skip complex elements
    const text = (el.textContent || '').trim();

    userIds.forEach(userId => {
      if (text === userId || text.includes(userId)) {
        // Don't double-add
        if (el.querySelector('.sa-sticker-note') || el.closest('.sa-sticker-note')) return;

        const note = notes[userId];
        const sticker = document.createElement('span');
        sticker.className = 'sa-sticker-note';
        sticker.style.cssText = `background: ${note.color}; color: ${getContrastColor(note.color)};`;
        sticker.textContent = note.text;
        sticker.title = `Note: ${note.text}`;
        el.appendChild(sticker);
      }
    });
  });
}

// ============ WATCH LIST (Wanted / VIP) ============
function applyWatchList() {
  if (!settings.watchedUsers) return;

  // Remove old badges
  document.querySelectorAll('.sa-watch-badge').forEach(el => el.remove());
  document.querySelectorAll('.sa-wanted-row, .sa-vip-row').forEach(el => {
    el.classList.remove('sa-wanted-row', 'sa-vip-row');
  });

  const wanted = settings.watchedUsers.wanted || [];
  const vip = settings.watchedUsers.vip || [];

  const allWatched = [
    ...wanted.map(u => ({ userId: u, type: 'wanted' })),
    ...vip.map(u => ({ userId: u, type: 'vip' }))
  ];

  if (allWatched.length === 0) return;

  document.querySelectorAll('td, span, a').forEach(el => {
    if (el.children.length > 2) return;
    
    // Skip hidden elements to prevent layout shifts on tracking cells
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return;
    
    const text = (el.textContent || '').trim();

    allWatched.forEach(({ userId, type }) => {
      if (text === userId || text.includes(userId)) {
        if (el.querySelector('.sa-watch-badge') || el.closest('.sa-watch-badge')) return;

        const badge = document.createElement('span');
        badge.className = `sa-watch-badge ${type}`;
        badge.textContent = type === 'wanted' ? 'WANTED' : 'VIP';
        el.appendChild(badge);

        // Highlight the row
        const row = el.closest('tr');
        if (row) {
          row.classList.add(type === 'wanted' ? 'sa-wanted-row' : 'sa-vip-row');
        }
      }
    });
  });
}

// ============ CUSTOM HIGHLIGHTS & DATES ============
function applyDateHighlights() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(today - offset)).toISOString().split('T')[0];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  const nodesToProcess = [];

  while (node = walker.nextNode()) {
    if (node.parentElement && 
        (node.parentElement.classList.contains('sa-date-highlight') || 
         node.parentElement.tagName === 'SCRIPT' || 
         node.parentElement.tagName === 'STYLE')) {
      continue;
    }
    
    if (node.nodeValue.includes(localISOTime)) {
      if (node.parentElement.closest('td')) {
        nodesToProcess.push(node);
      }
    }
  }

  nodesToProcess.forEach(node => {
    const span = document.createElement('span');
    span.innerHTML = escapeHtml(node.nodeValue).replace(
      new RegExp(localISOTime, 'g'), 
      `<span class="sa-date-highlight" title="HARI INI! 🔥">${localISOTime}</span>`
    );
    node.parentNode.replaceChild(span, node);
  });
}

// ============ SPIDER-WEB LOCK ANIMATION ============
function applySpiderWebLocks() {
  const lockImages = document.querySelectorAll('img[alt="Locked"]');
  
  lockImages.forEach(img => {
    if (img.closest('.sa-lock-wrapper')) return;
    
    // Create wrapper
    const wrapper = document.createElement('span');
    wrapper.className = 'sa-lock-wrapper';
    
    // Wrap the original image (and hide it in CSS)
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    
    // Create Combined SVG (Web + Spidey Lock)
    const combinedSVG = document.createElement('span');
    combinedSVG.innerHTML = `<svg viewBox="0 0 24 24" class="sa-combined-lock" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Lock body gradient (Spidey Red) -->
        <linearGradient id="lockGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff4757" />
          <stop offset="100%" stop-color="#ff6b81" />
        </linearGradient>
        <!-- Shackle gradient (Metallic Silver) -->
        <linearGradient id="shackleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f1f2f6" />
          <stop offset="100%" stop-color="#a4b0be" />
        </linearGradient>
      </defs>
      <!-- Static Web Group (Cooler Black/Dark Grey) -->
      <g stroke="#1e272e" stroke-width="0.8" opacity="0.85" fill="none" class="sa-web-bg">
        <path d="M12 12l-10-10 M12 12l0-12 M12 12l10-10 M12 12l12 0 M12 12l10 10 M12 12l0 12 M12 12l-10 10 M12 12l-12 0" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="12" />
      </g>
      <!-- Spidey Lock Group -->
      <g class="sa-lock-fg" style="filter: drop-shadow(0 0 3px rgba(255,0,0,0.6));">
        <g transform="translate(3, 3) scale(0.75)">
          <!-- Shackle -->
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="url(#shackleGrad)" stroke-width="2.5" fill="none" />
          <!-- Red Body -->
          <rect x="3" y="11" width="18" height="11" rx="2" fill="url(#lockGrad)" stroke="#2f3542" stroke-width="1.5" />
          <!-- Web Pattern on Body -->
          <path d="M12 11 v11 M3 16.5 h18 M6 11 l6 11 M18 11 l-6 11 M3 13 l18 6 M3 19 l18 -6" stroke="#2f3542" stroke-width="0.5" opacity="0.4" fill="none"/>
          <!-- Spider Keyhole -->
          <circle cx="12" cy="15.5" r="1.5" fill="#2f3542" />
          <path d="M12 17v2" stroke="#2f3542" stroke-width="1.5" stroke-linecap="round" fill="none" />
          <path d="M10.5 15 l-1.5 -1.5 M10.5 16 l-2 0.5 M13.5 15 l1.5 -1.5 M13.5 16 l2 0.5" stroke="#2f3542" stroke-width="0.8" stroke-linecap="round" fill="none" />
        </g>
      </g>
    </svg>`;
    const svgEl = combinedSVG.firstElementChild;
    wrapper.appendChild(svgEl);
    
    // Create an observer ONCE per page to style the default tooltip
    if (!document._saTooltipObserver) {
      document._saTooltipObserver = true;
      
      const applySpideyTooltip = () => {
        document.querySelectorAll('.tooltip').forEach(node => {
          if (!node.classList.contains('sa-spidey-default-tooltip')) {
            const text = node.textContent || node.innerText || '';
            if (text.includes('Lock Remark:')) {
              node.classList.add('sa-spidey-default-tooltip');
            }
          }
        });
      };

      const tooltipObserver = new MutationObserver(applySpideyTooltip);
      tooltipObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'display'] });
      
      // Foolproof fallback to ensure it NEVER fails
      setInterval(applySpideyTooltip, 300);
    }
  });
}

// ============ TRANSACTION STATUS COLORS ============
function applyTransactionStatusColors(doc = document) {
  const statuses = [
    { text: 'wait for payment', class: 'wait', label: 'Wait For Payment' },
    { text: 'success', class: 'success', label: 'Success' },
    { text: 'reject', class: 'reject', label: 'Reject' },
    { text: 'wrong', class: 'wrong', label: 'Wrong' },
    { text: 'info incorrect', class: 'info-incorrect', label: 'Info Incorrect' }
  ];

  doc.querySelectorAll('tr').forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    let matchedStatus = null;
    let targetTd = null;

    for (const td of cells) {
      // Skip cells that contain buttons, inputs, or links (action columns)
      if (td.querySelector('button, input, a')) continue;

      const cellText = td.textContent.toLowerCase().replace(/\s+/g, ''); // strip ALL spaces
      
      let match = null;
      if (cellText.includes('waitforpayment')) match = statuses[0];
      else if (cellText.includes('success')) match = statuses[1];
      else if (cellText.includes('reject')) match = statuses[2];
      else if (cellText.includes('wrong')) match = statuses[3];
      else if (cellText.includes('infoincorrect')) match = statuses[4];

      if (match) {
        matchedStatus = match;
        targetTd = td;
        break;
      }
    }

    if (matchedStatus) {
      // Style the row
      const rowClass = `sa-tx-row-${matchedStatus.class}`;
      if (!row.classList.contains(rowClass)) {
        row.classList.remove('sa-tx-row-wait', 'sa-tx-row-success', 'sa-tx-row-reject', 'sa-tx-row-wrong', 'sa-tx-row-info-incorrect');
        row.classList.add(rowClass);
        // Force remove ugly default inline background
        row.style.setProperty('background', 'transparent', 'important');
        row.style.setProperty('background-color', 'transparent', 'important');
        row.removeAttribute('bgcolor');
      }
      
      // Badge the text if not already badged
      if (targetTd && !targetTd.querySelector('.sa-tx-status')) {
        targetTd.innerHTML = `<span class="sa-tx-status ${matchedStatus.class}">${matchedStatus.label}</span>`;
      }
    }
  });
}

// ============ PLAYER LOG PASSWORD RESET DETECTOR ============
function cleanUpPlayerLogAlerts(docs) {
  const targetDocs = Array.isArray(docs) ? docs : [docs || document];
  for (const d of targetDocs) {
    if (!d) continue;
    // Clean up any inputs that might have gotten the warning styles
    d.querySelectorAll('.sa-affected-user-danger, input').forEach(el => {
      if (el.classList.contains('sa-affected-user-danger') || el.style.border?.includes('#ff0055') || (el.style.borderColor && el.style.borderColor.includes('255, 0, 85'))) {
        el.classList.remove('sa-affected-user-danger');
        el.style.removeProperty('background');
        el.style.removeProperty('background-color');
        el.style.removeProperty('border');
        el.style.removeProperty('box-shadow');
        el.style.removeProperty('color');
        el.style.removeProperty('font-weight');
        el.style.removeProperty('outline');
      }
    });
    d.querySelectorAll('#sa-input-alert-tag, #sa-playerlog-pw-alert, #sa-playerlog-alert-row, .sa-pw-reset-badge').forEach(el => el.remove());
    d.querySelectorAll('tr.sa-pw-reset-row').forEach(r => r.classList.remove('sa-pw-reset-row'));
  }
}

function findAffectedUserInput(d) {
  if (!d) return null;

  // Strategy 1: Find <tr> whose text specifically has 'affected' and EXPLICITLY NOT 'operator'
  const rows = Array.from(d.querySelectorAll('tr'));
  for (const tr of rows) {
    const text = (tr.textContent || '').replace(/[\u00a0\s]+/g, ' ').toLowerCase();
    if (text.includes('affected') && !text.includes('operator')) {
      const inp = tr.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"])');
      if (inp) return inp;
    }
  }

  // Strategy 2: Find td, th, label, span, or div containing 'affected' and NOT 'operator'
  const cells = Array.from(d.querySelectorAll('td, th, label, span, div'));
  for (const el of cells) {
    const text = (el.textContent || '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
    if ((text === 'affected user' || text.startsWith('affected user') || text.includes('affected')) && !text.includes('operator')) {
      if (el.nextElementSibling) {
        const inp = el.nextElementSibling.tagName === 'INPUT' ? el.nextElementSibling : el.nextElementSibling.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        if (inp) {
          const rowText = (inp.closest('tr')?.textContent || inp.name || inp.id || '').toLowerCase();
          if (!rowText.includes('operator')) return inp;
        }
      }
      const tr = el.closest('tr, .form-group, div');
      if (tr) {
        const inp = tr.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        if (inp) {
          const rowText = (inp.closest('tr')?.textContent || inp.name || inp.id || '').toLowerCase();
          if (!rowText.includes('operator')) return inp;
        }
      }
    }
  }

  // Strategy 3: Check attribute name/id specifically having 'affected'
  const direct = d.querySelector('input[name*="affected" i], input[id*="affected" i], input[placeholder*="affected" i]');
  if (direct) {
    const directText = (direct.name || direct.id || '').toLowerCase();
    if (!directText.includes('operator')) return direct;
  }

  // Strategy 4: In filter form, the row immediately following 'Operator'
  for (const tr of rows) {
    const text = (tr.textContent || '').replace(/[\u00a0\s]+/g, ' ').toLowerCase();
    if (text.includes('operator') && !text.includes('affected')) {
      const nextTr = tr.nextElementSibling;
      if (nextTr) {
        const inp = nextTr.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        if (inp) {
          const checkText = (inp.closest('tr')?.textContent || inp.name || inp.id || '').toLowerCase();
          if (!checkText.includes('operator')) return inp;
        }
      }
    }
  }

  return null;
}

function checkAndApplyPlayerLogAlert() {
  if (!settings || !settings.isEnabled) return;

  // 1. Gather all accessible documents (top document + any accessible iframes)
  const allDocs = [document];
  try {
    if (window.top && window.top.document && !allDocs.includes(window.top.document)) {
      allDocs.push(window.top.document);
    }
  } catch (e) {}

  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc && iframeDoc.body && !allDocs.includes(iframeDoc)) {
        allDocs.push(iframeDoc);
      }
    } catch (e) {}
  });

  // 2. Find the Affected User input across all docs
  let affectedInput = null;
  let formDoc = null;
  for (const doc of allDocs) {
    const inp = findAffectedUserInput(doc);
    if (inp) {
      affectedInput = inp;
      formDoc = doc;
      break;
    }
  }

  // If no Affected User input exists on page: clean up and exit
  if (!affectedInput) {
    cleanUpPlayerLogAlerts(allDocs);
    return;
  }

  // Bind reactive listeners to input so changes instantly trigger check
  if (!affectedInput._saPwAlertBound) {
    affectedInput._saPwAlertBound = true;
    const triggerUpdate = () => {
      clearTimeout(affectedInput._saTimer);
      affectedInput._saTimer = setTimeout(checkAndApplyPlayerLogAlert, 100);
    };
    affectedInput.addEventListener('input', triggerUpdate);
    affectedInput.addEventListener('change', triggerUpdate);
    affectedInput.addEventListener('keyup', triggerUpdate);
    affectedInput.addEventListener('paste', triggerUpdate);
  }

  // 3. User constraint: MUST ONLY FUNCTION FOR AFFECTED USER
  // If Affected User input is empty, feature MUST NOT function at all!
  const userValue = (affectedInput.value || '').trim();
  if (!userValue) {
    cleanUpPlayerLogAlerts(allDocs);
    return;
  }

  // 4. Compute date matching criteria
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayISO = `${yyyy}-${mm}-${dd}`;
  const todayVariants = [
    todayISO,
    `${dd}-${mm}-${yyyy}`,
    `${yyyy}/${mm}/${dd}`,
    `${dd}/${mm}/${yyyy}`,
    `${mm}-${dd}`,
    `${dd}-${mm}`
  ];

  // Also include date from Tanggal Awal / Tanggal akhir if filled in the form
  for (const doc of allDocs) {
    doc.querySelectorAll('input').forEach(inp => {
      const val = (inp.value || '').trim();
      if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(val) && !todayVariants.includes(val)) {
        todayVariants.push(val);
      }
    });
  }

  // 5. Scan all rows across allDocs for password reset of this specific user on today
  const cleanUserVal = userValue.toLowerCase();
  const matchingRows = [];
  let detectedPlayerLogTable = null;

  for (const doc of allDocs) {
    const rows = doc.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 4) return;

      const rowText = row.textContent.toLowerCase();

      // Check if row matches this user
      let matchesUser = rowText.includes(cleanUserVal);
      if (!matchesUser && cells.length > 5) {
        matchesUser = cells[5].textContent.trim().toLowerCase() === cleanUserVal;
      }
      if (!matchesUser) return;

      // Check if row records password reset (ID or EN)
      const isPwReset = /perbarui\s*pemain\s*:\s*password/i.test(rowText) ||
                        /update\s*player\s*:\s*password/i.test(rowText) ||
                        (rowText.includes('password') && (rowText.includes('perbarui') || rowText.includes('update') || rowText.includes('reset') || rowText.includes('ganti') || rowText.includes('pemain') || rowText.includes('player')));
      if (!isPwReset) return;

      // Check if date is today
      const isToday = todayVariants.some(variant => rowText.includes(variant));
      if (!isToday) return;

      detectedPlayerLogTable = row.closest('table');

      let timeStr = '';
      let dateStr = '';
      let operatorStr = '';
      let affectedUserStr = '';
      let detailCell = null;

      cells.forEach(cell => {
        const cellText = (cell.textContent || '').trim();
        if (/perbarui\s*pemain/i.test(cellText) || /update\s*player/i.test(cellText) || /password/i.test(cellText)) {
          detailCell = cell;
        }
        if (/\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2}/.test(cellText)) {
          timeStr = cellText;
        } else if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(cellText) && !dateStr) {
          dateStr = cellText;
        }
      });

      if (cells.length >= 6) {
        if (!timeStr && cells[2]) timeStr = cells[2].textContent.trim();
        if (!operatorStr && cells[3]) operatorStr = cells[3].textContent.trim();
        if (!detailCell && cells[4]) detailCell = cells[4];
        if (!affectedUserStr && cells[5]) affectedUserStr = cells[5].textContent.trim();
      }

      matchingRows.push({
        doc: doc,
        row: row,
        time: timeStr || dateStr || todayISO,
        operator: operatorStr || 'OPERATOR',
        affectedUser: affectedUserStr || userValue,
        detailCell: detailCell
      });
    });
  }

  // 6. If matching rows exist, show alert; otherwise clean up
  const targetDoc = formDoc || affectedInput.ownerDocument || document;
  const existingAlert = targetDoc.getElementById('sa-playerlog-pw-alert');
  const existingInputTag = targetDoc.getElementById('sa-input-alert-tag');

  if (matchingRows.length > 0) {
    const latest = matchingRows[0];
    const userDisplay = latest.affectedUser || userValue;

    // 1. Highlight ONLY Affected User input
    affectedInput.classList.add('sa-affected-user-danger');
    affectedInput.style.setProperty('background', '#ffccd5', 'important');
    affectedInput.style.setProperty('background-color', '#ffccd5', 'important');
    affectedInput.style.setProperty('border', '3px solid #ff0055', 'important');
    affectedInput.style.setProperty('box-shadow', '0 0 16px rgba(255, 0, 85, 0.95), inset 0 0 8px rgba(255, 0, 85, 0.35)', 'important');
    affectedInput.style.setProperty('color', '#990022', 'important');
    affectedInput.style.setProperty('font-weight', '900', 'important');
    affectedInput.style.setProperty('outline', '2px solid #ff0055', 'important');

    // Add badge tag beside Affected User input
    if (!existingInputTag && affectedInput.parentNode) {
      const tag = targetDoc.createElement('span');
      tag.id = 'sa-input-alert-tag';
      tag.className = 'sa-input-alert-tag';
      tag.innerHTML = '🚨 PERNAH RESET HARI INI!';
      if (affectedInput.nextSibling) {
        affectedInput.parentNode.insertBefore(tag, affectedInput.nextSibling);
      } else {
        affectedInput.parentNode.appendChild(tag);
      }
    }

    // 2. Highlight matching rows in the table
    matchingRows.forEach(item => {
      item.row.classList.add('sa-pw-reset-row');
      if (item.detailCell && !item.detailCell.querySelector('.sa-pw-reset-badge')) {
        const badge = item.doc.createElement('span');
        badge.className = 'sa-pw-reset-badge';
        badge.innerHTML = '⚠️ RESET HARI INI';
        item.detailCell.appendChild(badge);
      }
    });

    // 3. Render or update the Warning Banner directly below Submit button
    let alertCard = existingAlert;
    if (!alertCard) {
      alertCard = targetDoc.createElement('div');
      alertCard.id = 'sa-playerlog-pw-alert';
      alertCard.className = 'sa-playerlog-alert-card';
    }

    alertCard.innerHTML = `
      <div class="sa-alert-hazard-header">
        <span class="sa-alert-icon">🚨</span>
        <span class="sa-alert-title">PERINGATAN: SUDAH ADA RIWAYAT RESET PASSWORD HARI INI!</span>
        <span class="sa-alert-icon">⚠️</span>
      </div>
      <div class="sa-alert-body">
        <div class="sa-alert-info-row">
          <span class="sa-info-chip"><b>👤 User:</b> <span class="sa-chip-val">${escapeHtml(userDisplay)}</span></span>
          <span class="sa-info-chip"><b>🕒 Jam Terakhir:</b> <span class="sa-chip-val">${escapeHtml(latest.time)}</span></span>
          <span class="sa-info-chip"><b>👨‍💻 Operator:</b> <span class="sa-chip-val">${escapeHtml(latest.operator)}</span></span>
          <span class="sa-info-chip count"><b>⚡ Total Hari Ini:</b> ${matchingRows.length}x</span>
        </div>
        <div class="sa-alert-instruction">
          🛑 <strong>SOP WAJIB OPERATOR:</strong> Akun ini <u>sudah pernah di-reset password pada hari ini (${todayISO})</u>.<br>
          <strong>WAJIB MINTA DATA PENDUKUNG LENGKAP</strong> (bukti deposit terakhir, mutasi rekening terdaftar, nomor WhatsApp aktif) sebelum memproses permintaan baru!
        </div>
      </div>
    `;

    if (!alertCard.isConnected) {
      const allButtons = Array.from(targetDoc.querySelectorAll('input[type="submit"], button, input[type="button"]'));
      const submitBtn = allButtons.find(b => {
        const v = (b.value || b.textContent || '').trim().toLowerCase();
        return v === 'submit' || v === 'cari' || v === 'filter';
      }) || (affectedInput ? affectedInput.closest('form')?.querySelector('input[type="submit"], button') : null);

      let inserted = false;
      if (submitBtn) {
        const submitRow = submitBtn.closest('tr');
        if (submitRow && submitRow.parentElement) {
          let alertRow = targetDoc.getElementById('sa-playerlog-alert-row');
          if (!alertRow) {
            alertRow = targetDoc.createElement('tr');
            alertRow.id = 'sa-playerlog-alert-row';
            const alertTd = targetDoc.createElement('td');
            alertTd.colSpan = 10;
            alertTd.style.textAlign = 'center';
            alertTd.style.padding = '10px 0 5px 0';
            alertTd.appendChild(alertCard);
            alertRow.appendChild(alertTd);
          }
          submitRow.parentNode.insertBefore(alertRow, submitRow.nextSibling);
          inserted = true;
        } else if (submitBtn.parentElement) {
          submitBtn.parentElement.appendChild(alertCard);
          inserted = true;
        }
      }

      if (!inserted && affectedInput) {
        const filterForm = affectedInput.closest('form') || affectedInput.closest('table');
        if (filterForm && filterForm.parentNode) {
          filterForm.parentNode.insertBefore(alertCard, filterForm.nextSibling);
          inserted = true;
        }
      }

      if (!inserted && detectedPlayerLogTable && detectedPlayerLogTable.parentNode) {
        detectedPlayerLogTable.parentNode.insertBefore(alertCard, detectedPlayerLogTable);
        inserted = true;
      }
    }

    // Bind submit button / form listener for subsequent clicks
    if (!targetDoc._saSubmitBound) {
      targetDoc._saSubmitBound = true;
      targetDoc.addEventListener('click', (e) => {
        const btn = e.target.closest('input[type="submit"], button, input[type="button"]');
        if (btn) {
          const v = (btn.value || btn.textContent || '').trim().toLowerCase();
          if (v === 'submit' || v === 'cari' || v === 'filter') {
            [150, 400, 800, 1500, 2500].forEach(delay => {
              setTimeout(checkAndApplyPlayerLogAlert, delay);
            });
          }
        }
      }, true);
    }
  } else {
    // No matching reset today for this user -> clean up all alert states
    cleanUpPlayerLogAlerts(allDocs);
  }
}

// Ensure periodic checks for Player Log page so dynamic AJAX or table changes are immediately caught
if (!window._saPlayerLogInterval) {
  window._saPlayerLogInterval = setInterval(() => {
    try {
      if (document.body && (location.href.includes('log-comments') || findAffectedUserInput(document))) {
        checkAndApplyPlayerLogAlert();
      }
    } catch (e) {}
  }, 600);
}

// ============ PENGINGAT LINK SCREENSHOT VALIDASI REKENING (EDIT PLAYER LIST & STATUS) ============
function setupPlayerEditValidationWatcher() {
  if (!window.location.href.includes('player-edit')) return;
  if (window._saEditPlayerWatcherInit) return;
  window._saEditPlayerWatcherInit = true;

  const initTimer = setInterval(() => {
    // 1. Get UserId
    let userId = '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      userId = urlParams.get('userKey') || urlParams.get('userId') || urlParams.get('user') || '';
    } catch(e) {}

    const rows = Array.from(document.querySelectorAll('tr'));
    
    let bankField = null;
    let namaRekField = null;
    let noRekField = null;
    let submitBtn = null;

    rows.forEach(tr => {
      const text = (tr.textContent || '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
      
      if (!userId && (text.includes('userid') || text.includes('user id'))) {
        const inp = tr.querySelector('input');
        if (inp && inp.value) userId = inp.value.trim();
        else {
          const tds = tr.querySelectorAll('td');
          if (tds.length > 1) userId = tds[1].textContent.trim();
        }
      }

      if (text.includes('bank') && (text.includes('nama') || text.includes('rekening'))) {
        bankField = tr.querySelector('select, input:not([type="hidden"])');
      } else if (text.includes('nama rekening') && !text.includes('bank')) {
        namaRekField = tr.querySelector('input:not([type="hidden"])');
      } else if (text.includes('nomor rekening') || text.includes('no rekening') || text.includes('no rek')) {
        noRekField = tr.querySelector('input:not([type="hidden"])');
      }
    });

    if (!bankField) bankField = document.querySelector('select[name*="bank" i], input[name*="bank" i]');
    if (!namaRekField) namaRekField = document.querySelector('input[name*="acc_name" i], input[name*="holder" i], input[name*="nama_rek" i]');
    if (!noRekField) noRekField = document.querySelector('input[name*="acc_no" i], input[name*="rekening" i], input[name*="no_rek" i]');

    submitBtn = document.querySelector('input[type="submit"], button[type="submit"]') || 
                Array.from(document.querySelectorAll('button, input[type="button"]')).find(b => {
                  const val = (b.value || b.textContent || '').trim().toLowerCase();
                  return val === 'submit' || val.includes('simpan');
                });

    if (!bankField || !namaRekField || !noRekField || !submitBtn) {
      return; // Still loading
    }

    clearInterval(initTimer);

    // Initial values
    const initialBank = (bankField.value || '').trim();
    const initialNama = (namaRekField.value || '').trim();
    const initialNoRek = (noRekField.value || '').trim();

    const isChanged = () => {
      const curBank = (bankField.value || '').trim();
      const curNama = (namaRekField.value || '').trim();
      const curNoRek = (noRekField.value || '').trim();
      return (initialBank && curBank !== initialBank) || 
             (initialNama && curNama !== initialNama) || 
             (initialNoRek && curNoRek !== initialNoRek);
    };

    const updatePreSubmitAlert = () => {
      let alertBox = document.getElementById('sa-editplayer-pre-alert');
      if (isChanged()) {
        if (!alertBox) {
          alertBox = document.createElement('div');
          alertBox.id = 'sa-editplayer-pre-alert';
          alertBox.className = 'sa-editplayer-pre-submit-alert';
          const submitRow = submitBtn.closest('tr') || submitBtn.parentElement;
          if (submitRow && submitRow.parentElement) {
            submitRow.parentElement.insertBefore(alertBox, submitRow);
          } else {
            submitBtn.insertAdjacentElement('beforebegin', alertBox);
          }
        }
        alertBox.innerHTML = `
          <div style="font-weight: 900; color: #ff0055; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; font-size: 14px;">
            <span>🚨</span> PERUBAHAN DATA REKENING TERDETEKSI!
          </div>
          <div style="font-size: 12px; line-height: 1.4; color: #ffe6eb;">
            <strong>SOP WAJIB OPERATOR:</strong> Anda mengubah data rekening pemain (${escapeHtml(userId || 'Pemain')}).<br>
            Setelah menekan tombol <strong>Submit</strong>, Anda <u>WAJIB</u> melampirkan <strong>LINK SCREENSHOT VALIDASI</strong> (seperti <code>https://prnt.sc/...</code>) pada kolom <u>Keterangan</u> di Status Pemain!
          </div>
        `;
      } else {
        if (alertBox) alertBox.remove();
      }
    };

    [bankField, namaRekField, noRekField].forEach(field => {
      field.addEventListener('input', updatePreSubmitAlert);
      field.addEventListener('change', updatePreSubmitAlert);
    });

    const handleSavePending = () => {
      if (isChanged()) {
        const reminderData = {
          userId: userId || 'Pemain',
          oldData: { bank: initialBank, nama: initialNama, noRek: initialNoRek },
          newData: { bank: (bankField.value || '').trim(), nama: (namaRekField.value || '').trim(), noRek: (noRekField.value || '').trim() },
          changedAt: Date.now(),
          completed: false
        };
        window.localStorage.setItem('sa_pending_screenshot', JSON.stringify(reminderData));
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'SA_SCREENSHOT_PENDING', data: reminderData }, '*');
          }
        } catch(e) {}
      }
    };

    submitBtn.addEventListener('click', handleSavePending);
    const form = submitBtn.closest('form');
    if (form) form.addEventListener('submit', handleSavePending);

  }, 300);

  setTimeout(() => clearInterval(initTimer), 10000);
}

function findStatusSection(doc = document) {
  if (!doc || !doc.body) return null;

  const textareas = Array.from(doc.querySelectorAll('textarea'));
  for (const ta of textareas) {
    const tr = ta.closest('tr');
    const trText = (tr?.textContent || '').toLowerCase();
    const isKeteranganRow = trText.includes('keterangan') || trText.includes('remark') || trText.includes('catatan');
    
    const table = ta.closest('table');
    const form = ta.closest('form') || table || ta.parentElement;
    const formText = (form?.textContent || '').toLowerCase();
    const isStatusForm = formText.includes('status') || formText.includes('change status') || formText.includes('validasi');

    if (isKeteranganRow || isStatusForm) {
      let changeBtn = null;
      if (form) {
        changeBtn = Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]')).find(b => {
          const val = (b.value || b.textContent || '').trim().toLowerCase();
          return val.includes('status') || val.includes('change');
        });
      }
      if (!changeBtn && table && table.parentElement) {
        changeBtn = Array.from(table.parentElement.querySelectorAll('button, input[type="submit"], input[type="button"]')).find(b => {
          const val = (b.value || b.textContent || '').trim().toLowerCase();
          return val.includes('status') || val.includes('change');
        });
      }
      return {
        textarea: ta,
        tr: tr || ta.parentElement,
        table: table || form,
        form: form,
        changeStatusBtn: changeBtn
      };
    }
  }

  // Fallback check: find by label or adjacent cell containing 'keterangan'
  const labels = Array.from(doc.querySelectorAll('td, th, label, div, span'));
  for (const el of labels) {
    const text = (el.textContent || '').trim().toLowerCase();
    if (text === 'keterangan' || text.startsWith('keterangan')) {
      const container = el.closest('tr') || el.parentElement;
      if (container) {
        const ta = container.querySelector('textarea');
        if (ta) {
          const table = ta.closest('table');
          const form = ta.closest('form') || table;
          const changeBtn = form ? Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]')).find(b => {
            const val = (b.value || b.textContent || '').trim().toLowerCase();
            return val.includes('status') || val.includes('change');
          }) : null;
          return { textarea: ta, tr: container, table: table || form, form: form, changeStatusBtn: changeBtn };
        }
      }
    }
  }

  return null;
}

function cleanUpScreenshotReminder(doc = document) {
  if (!doc) return;
  doc.querySelectorAll('#sa-keterangan-badge, #sa-status-sop-alert, #sa-paste-link-btn, #sa-editplayer-pre-alert').forEach(el => el.remove());
  doc.querySelectorAll('.sa-keterangan-danger').forEach(el => {
    el.classList.remove('sa-keterangan-danger');
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('border');
    el.style.removeProperty('box-shadow');
    el.style.removeProperty('color');
    el.style.removeProperty('font-weight');
    el.style.removeProperty('outline');
  });
}

function containsScreenshotUrl(text) {
  if (!text) return false;
  return /(?:https?:\/\/|prnt\.sc\/|imgur\.com\/|drive\.google\.com\/|ibb\.co\/|gyazo\.com\/|snipboard\.io\/)[^\s]+/i.test(text);
}

function checkAndApplyScreenshotReminder() {
  if (!settings || !settings.isEnabled) return;

  let reminder = null;
  try {
    const raw = window.localStorage.getItem('sa_pending_screenshot');
    if (raw) reminder = JSON.parse(raw);
  } catch(e) {}

  if (!reminder || reminder.completed || (Date.now() - reminder.changedAt > 24 * 60 * 60 * 1000)) {
    cleanUpScreenshotReminder(document);
    return;
  }

  const statusInfo = findStatusSection(document);
  if (!statusInfo || !statusInfo.textarea) return;

  const ta = statusInfo.textarea;
  const currentVal = (ta.value || '').trim();
  const hasUrl = containsScreenshotUrl(currentVal);

  // 1. Highlight textarea
  if (!ta.classList.contains('sa-keterangan-danger')) {
    ta.classList.add('sa-keterangan-danger');
  }

  // 2. Badge on Keterangan
  let badge = document.getElementById('sa-keterangan-badge');
  if (!badge && statusInfo.tr) {
    badge = document.createElement('span');
    badge.id = 'sa-keterangan-badge';
    badge.className = 'sa-keterangan-badge';
    badge.innerHTML = '🚨 WAJIB INPUT LINK SCREENSHOT VALIDASI!';
    const labelCell = statusInfo.tr.querySelector('td, th, label') || statusInfo.tr;
    if (labelCell) labelCell.appendChild(badge);
  }

  // If user already pasted a URL, update visual feedback
  if (hasUrl) {
    ta.style.setProperty('border', '3px solid #00aa13', 'important');
    ta.style.setProperty('box-shadow', '0 0 16px rgba(0, 170, 19, 0.8)', 'important');
    if (badge) {
      badge.style.background = 'linear-gradient(135deg, #00aa13, #00770d)';
      badge.innerHTML = '✅ LINK TERDETEKSI! KLIK CHANGE STATUS UNTUK MENYIMPAN';
    }
  } else {
    ta.style.removeProperty('border');
    ta.style.removeProperty('box-shadow');
    if (badge) {
      badge.style.removeProperty('background');
      badge.innerHTML = '🚨 WAJIB INPUT LINK SCREENSHOT VALIDASI!';
    }
  }

  // 3. Render SOP Alert Banner above status table/form
  let alertBox = document.getElementById('sa-status-sop-alert');
  if (!alertBox) {
    alertBox = document.createElement('div');
    alertBox.id = 'sa-status-sop-alert';
    alertBox.className = 'sa-status-sop-alert';
    const insertTarget = statusInfo.table || statusInfo.form;
    if (insertTarget && insertTarget.parentElement) {
      insertTarget.parentElement.insertBefore(alertBox, insertTarget);
    }
  }

  const userDisplay = reminder.userId || 'Pemain';
  const newRekText = [reminder.newData?.bank, reminder.newData?.nama, reminder.newData?.noRek].filter(Boolean).join(' - ');

  alertBox.innerHTML = `
    <div class="sa-alert-hazard-header">
      <span class="sa-alert-icon">🚨</span>
      <span class="sa-alert-title">PENGINGAT SOP: PERUBAHAN DATA REKENING PEMAIN (${escapeHtml(userDisplay)})</span>
      <span class="sa-alert-icon">⚠️</span>
    </div>
    <div class="sa-alert-body">
      <div class="sa-alert-info-row">
        <span class="sa-info-chip"><b>👤 User:</b> <span class="sa-chip-val">${escapeHtml(userDisplay)}</span></span>
        ${newRekText ? `<span class="sa-info-chip"><b>🏦 Rekening Baru:</b> <span class="sa-chip-val">${escapeHtml(newRekText)}</span></span>` : ''}
        <span class="sa-info-chip count">⚠️ Belum Ada Link Validasi</span>
      </div>
      <div class="sa-alert-instruction">
        🛑 <strong>SOP WAJIB OPERATOR:</strong> Data rekening pemain baru saja diperbarui di <em>Edit Player List</em>.<br>
        <strong>WAJIB MELAMPIRKAN LINK SCREENSHOT HASIL VALIDASI</strong> (contoh: <code>https://prnt.sc/...</code>, <code>https://imgur.com/...</code>, atau link Google Drive) pada kolom <u>Keterangan</u> di bawah ini lalu klik <strong>Change Status</strong>!
      </div>
    </div>
  `;

  // 4. Button [ 📋 Tempel Link dari Clipboard ]
  if (!document.getElementById('sa-paste-link-btn')) {
    const pasteBtn = document.createElement('button');
    pasteBtn.id = 'sa-paste-link-btn';
    pasteBtn.type = 'button';
    pasteBtn.className = 'sa-paste-clipboard-btn';
    pasteBtn.innerHTML = '📋 Tempel Link dari Clipboard';
    pasteBtn.title = 'Klik untuk otomatis menempelkan link screenshot dari clipboard';
    pasteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          const clean = clipText.trim();
          if (ta.value.trim()) {
            ta.value += '\n' + clean;
          } else {
            ta.value = clean;
          }
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          showStreetArtAlert('Link berhasil ditempel dari clipboard!', 'success');
        } else {
          showStreetArtAlert('Clipboard kosong atau tidak berisi teks URL!', 'error');
        }
      } catch(err) {
        ta.focus();
        showStreetArtAlert('Gunakan Ctrl+V untuk menempelkan link langsung.', 'error');
      }
    });

    if (ta.nextSibling) {
      ta.parentNode.insertBefore(pasteBtn, ta.nextSibling);
    } else {
      ta.parentNode.appendChild(pasteBtn);
    }
  }

  // 5. Auto-scroll to status section
  if (!ta._saAutoScrolled) {
    ta._saAutoScrolled = true;
    setTimeout(() => {
      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ta.focus();
    }, 400);
  }

  // 6. Reactive input check on textarea
  if (!ta._saWatcherBound) {
    ta._saWatcherBound = true;
    ta.addEventListener('input', () => {
      clearTimeout(ta._saWatchTimer);
      ta._saWatchTimer = setTimeout(checkAndApplyScreenshotReminder, 150);
    });
  }

  // 7. Intercept Change Status button click
  const changeBtn = statusInfo.changeStatusBtn;
  if (changeBtn && !changeBtn._saSopBound) {
    changeBtn._saSopBound = true;
    changeBtn.addEventListener('click', (e) => {
      const val = (ta.value || '').trim();
      const validUrl = containsScreenshotUrl(val);
      if (validUrl) {
        // Link exists! Clear reminder
        window.localStorage.removeItem('sa_pending_screenshot');
        cleanUpScreenshotReminder(document);
        showStreetArtAlert('💥 BOOYAH! Link validasi berhasil disimpan!', 'success');
      } else {
        // Warning: Link not present
        const proceed = window.confirm(
          '🚨 PERINGATAN SOP:\n\n' +
          'Anda belum melampirkan LINK SCREENSHOT VALIDASI di kolom Keterangan!\n' +
          '(Contoh link yang wajib dilampirkan: https://prnt.sc/...)\n\n' +
          'Apakah Anda yakin ingin tetap menyimpan status tanpa link validasi?'
        );
        if (!proceed) {
          e.preventDefault();
          e.stopPropagation();
          ta.focus();
          return false;
        } else {
          window.localStorage.removeItem('sa_pending_screenshot');
          cleanUpScreenshotReminder(document);
        }
      }
    }, true);
  }
}

// Cross-window and periodic listeners
window.addEventListener('storage', (e) => {
  if (e.key === 'sa_pending_screenshot') {
    checkAndApplyScreenshotReminder();
  }
});

window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SA_SCREENSHOT_PENDING') {
    checkAndApplyScreenshotReminder();
  }
});

if (!window._saStatusReminderInterval) {
  window._saStatusReminderInterval = setInterval(() => {
    try {
      if (document.body && (window.location.href.includes('player-name') || window.localStorage.getItem('sa_pending_screenshot'))) {
        checkAndApplyScreenshotReminder();
      }
    } catch(e) {}
  }, 800);
}

function applyCustomWords() {
  if (!settings.customWords || settings.customWords.length === 0) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  const nodesToProcess = [];

  while (node = walker.nextNode()) {
    if (node.parentElement && 
        (node.parentElement.classList.contains('sa-custom-word') || 
         node.parentElement.tagName === 'SCRIPT' || 
         node.parentElement.tagName === 'STYLE' ||
         node.parentElement.tagName === 'TEXTAREA' ||
         node.parentElement.tagName === 'INPUT')) {
      continue;
    }
    
    if (!node.parentElement.closest('td') && !node.parentElement.closest('.table-list')) continue;

    const text = node.nodeValue.toLowerCase();
    const hasWord = settings.customWords.some(w => text.includes(w.text.toLowerCase()));
    
    if (hasWord) {
      nodesToProcess.push(node);
    }
  }

  nodesToProcess.forEach(node => {
    let html = escapeHtml(node.nodeValue);
    let matched = false;

    // Sort descending by length
    const words = [...settings.customWords].sort((a, b) => b.text.length - a.text.length);

    words.forEach(w => {
      const regex = new RegExp("(?![^<]*>)(" + escapeRegExp(w.text) + ")", "gi");
      if (regex.test(html)) {
        matched = true;
        html = html.replace(regex, `<span class="sa-custom-word" style="background:${w.bg}; color:${w.color}; padding:0 2px; margin:0; border-radius:3px; font-weight:900; text-shadow:1px 1px 0 rgba(0,0,0,0.8); font-family: 'Outfit', sans-serif; box-shadow: 0 2px 10px ${w.bg}80, inset 0 -2px 0 rgba(255,255,255,0.4); display: inline-block; text-transform: uppercase;">$1</span>`);
      }
    });

    if (matched) {
      const span = document.createElement('span');
      span.innerHTML = html;
      node.parentNode.replaceChild(span, node);
    }
  });
}

// ============ AUTO-COPY POW ===================
function setupAutoCopy() {
  if (!settings.autoCopyEnabled) return;

  // Avoid duplicate listeners
  if (document._saAutoCopySetup) return;
  document._saAutoCopySetup = true;

  document.addEventListener('click', (e) => {
    if (!settings.autoCopyEnabled) return;

    const target = e.target;
    // Only for table cells
    if (target.tagName !== 'TD' && !target.closest('td')) return;
    // Skip if it's an input, button, or link
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'SELECT') return;
    if (target.closest('a') || target.closest('button') || target.closest('input')) return;

    const cell = target.tagName === 'TD' ? target : target.closest('td');
    if (!cell) return;

    let textToCopy = '';

    if (target.tagName === 'SPAN' && (target.classList.contains('sa-bank-badge') || target.classList.contains('sa-sticker-note') || target.classList.contains('sa-watch-badge'))) {
      textToCopy = target.textContent.trim();
    } else {
      let range;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      }
      
      if (range && range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const offset = range.startOffset;
        const fullText = textNode.textContent;

        let start = fullText.lastIndexOf(',', offset - 1);
        start = start === -1 ? 0 : start + 1;

        let end = fullText.indexOf(',', offset);
        end = end === -1 ? fullText.length : end;

        textToCopy = fullText.substring(start, end).trim();
      }

      if (!textToCopy) {
        textToCopy = cell.textContent.trim();
        if (textToCopy.includes(',') && target !== cell) {
          textToCopy = target.textContent.trim();
        }
      }
    }

    if (!textToCopy || textToCopy.length > 200) return;

    // Copy to clipboard
    navigator.clipboard.writeText(textToCopy).then(() => {
      showPowEffect(e.clientX, e.clientY, textToCopy);
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showPowEffect(e.clientX, e.clientY, textToCopy);
    });
  });
}

function showPowEffect(x, y, copiedText) {
  const pow = document.createElement('div');
  pow.className = 'sa-pow-effect';
  const words = ['POW!', 'COPIED!', 'BOOM!', 'YEAH!', 'GOT IT!'];
  const word = words[Math.floor(Math.random() * words.length)];
  const preview = copiedText ? (copiedText.length > 15 ? copiedText.substring(0, 15) + '...' : copiedText) : '';
  
  if (preview) {
    pow.innerHTML = `${word}<br><span style="font-size:12px;color:white;text-shadow:none;font-family:sans-serif;letter-spacing:0px;">${preview}</span>`;
  } else {
    pow.textContent = word;
  }
  pow.style.left = `${x - 40}px`;
  pow.style.top = `${y - 30}px`;
  document.body.appendChild(pow);

  setTimeout(() => pow.remove(), 900);
}

// ============ SKATER COMBOS (Keyboard Shortcuts) ============
function setupSkaterCombos() {
  if (!settings.skaterCombos?.enabled) return;

  // Avoid duplicate listeners
  if (document._saCombosSetup) return;
  document._saCombosSetup = true;

  document.addEventListener('keydown', (e) => {
    if (!settings.skaterCombos?.enabled) return;
    if (!e.altKey) return;

    const key = e.key.toLowerCase();

    switch (key) {
      case 'd': // Filter Deposit
        e.preventDefault();
        filterTable('deposit');
        showComboToast('COMBO! Filter: Deposit 💰');
        break;

      case 'w': // Filter Withdraw
        e.preventDefault();
        filterTable('withdraw');
        showComboToast('COMBO! Filter: Withdraw 💸');
        break;

      case 'a': // Show All
        e.preventDefault();
        filterTable(null);
        showComboToast('COMBO! Show All 🔄');
        break;

      case 's': // Focus search
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]:not([type="hidden"])');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          showComboToast('COMBO! Search Focus 🔍');
        }
        break;

      case 'r': // Refresh
        e.preventDefault();
        const refreshBtn = findButtonByText('Refresh');
        if (refreshBtn) {
          refreshBtn.click();
          showComboToast('COMBO! Refresh 🔄');
        } else {
          window.location.reload();
          showComboToast('COMBO! Page Reload 🔄');
        }
        break;

      case 'n': // Next page
        e.preventDefault();
        const nextBtn = findButtonByText('Next');
        if (nextBtn) {
          nextBtn.click();
          showComboToast('COMBO! Next Page ➡️');
        }
        break;
    }
  });
}

function filterTable(type) {
  const rows = document.querySelectorAll('table tr');
  rows.forEach((row, index) => {
    if (index === 0) return; // Skip header
    if (type === null) {
      row.style.display = '';
      return;
    }
    const text = row.textContent.toLowerCase();
    if (text.includes(type.toLowerCase())) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function findButtonByText(text) {
  const buttons = document.querySelectorAll('input[type="button"], input[type="submit"], button, a');
  for (const btn of buttons) {
    const btnText = (btn.textContent || btn.value || '').trim().toLowerCase();
    if (btnText.includes(text.toLowerCase())) {
      return btn;
    }
  }
  return null;
}

function showComboToast(message) {
  // Remove existing toast
  document.querySelectorAll('.sa-combo-toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'sa-combo-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

// ============ HELPERS ============
function escapeHtml(unsafe) {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getContrastColor(hexcolor) {
  const hex = hexcolor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1A1A1A' : '#FFFFFF';
}

// ============ OBSERVER (Watch for dynamic content) ============
const observer = new MutationObserver((mutations) => {
  if (!settings || !settings.isEnabled) return;

  let shouldReapply = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          // Toast detection
          if (node.tagName === 'DIV' && node.id !== 'sa-custom-alert') {
            const text = (node.textContent || '').trim();
            const lowerText = text.toLowerCase();
            if ((lowerText.includes('sukses') || lowerText.includes('berhasil') || lowerText.includes('gagal') || lowerText.includes('update kesuksesan')) && text.length > 5 && text.length < 150) {
              const pos = window.getComputedStyle(node).position;
              if (pos === 'fixed' || pos === 'absolute') {
                node.style.opacity = '0';
                node.style.pointerEvents = 'none';
                node.style.zIndex = '-999';
                const isSuccess = !lowerText.includes('gagal') && !lowerText.includes('error');
                setTimeout(() => showStreetArtAlert(text, isSuccess ? 'success' : 'error'), 100);
              }
            }
          }

          if (!node.classList?.contains('sa-bank-badge') &&
              !node.classList?.contains('sa-sticker-note') &&
              !node.classList?.contains('sa-watch-badge') &&
              !node.classList?.contains('sa-pow-effect') &&
              !node.classList?.contains('sa-combo-toast') &&
              node.id !== 'sa-custom-alert') {
            shouldReapply = true;
          }
        }
      }
    }
  }

  if (shouldReapply) {
    // Debounce
    clearTimeout(observer._debounceTimer);
    observer._debounceTimer = setTimeout(() => {
      applyBankHighlights();
      applyQuickNotes();
      applyWatchList();
      applySensitiveRows();
      applyDateHighlights();
      applyTransactionStatusColors(document);
      checkAndApplyPlayerLogAlert();
      checkAndApplyScreenshotReminder();
      applyCustomWords();
      applySpiderWebLocks();
    }, 30);
  }
});

// Start observing
function startObserver() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    const rootObserver = new MutationObserver(() => {
      if (document.body) {
        rootObserver.disconnect();
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
    rootObserver.observe(document.documentElement, { childList: true });
  }
}
startObserver();

// ============ START ============
init();
