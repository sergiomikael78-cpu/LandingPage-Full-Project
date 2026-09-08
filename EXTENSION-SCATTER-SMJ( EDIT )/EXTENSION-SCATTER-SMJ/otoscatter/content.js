// --- FITUR AUTO-SCAN TOKEN DARI URL (UNTUK HALAMAN DETAIL) ---
(function autoScanUrlToken() {
  if (!window.location.pathname.includes('/history/')) return;

  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('t') || urlParams.get('sid') || urlParams.get('psid');
  
  if (tokenFromUrl && tokenFromUrl.length >= 20 && !tokenFromUrl.startsWith('eyJ')) {
    // 1. Kirim sinyal ke background bersama tokennya agar pusat bisa memproses (resume antrean dll) & menutup tab jika perlu
    chrome.runtime.sendMessage({ action: "TOKEN_HARVESTED", token: tokenFromUrl });
    
    // 2. Simpan secara lokal (Timpakan ke Dashboard) agar selalu segar
    chrome.storage.local.set({ 
        token: tokenFromUrl,
        lastTokenUpdate: Date.now(),
        pancinganStatus: "active" 
    }, () => {
        console.log("💎 [SUPER SNIFFER] Token UUID segar dipanen langsung dari URL Halaman Detail: " + tokenFromUrl);
    });

    // 3. Jika ada tanda pancingan di URL, coba tutup sendiri juga sebagai backup
    if (urlParams.get('isPancingan') === 'true') {
        chrome.runtime.sendMessage({ action: "closeTabSelf" });
    }
  }
})();
// -------------------------------------------------------------

// Listener untuk pesan dari background.js setelah halaman utama dimuat
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startProcess") {
    startProcess(msg.userId, msg.transactionId, msg.token, msg.mainTabId, msg.retryCount || 0, msg.isKeepAlive || false);
    sendResponse({ status: "running" });
  }
});

// Tambahkan isKeepAlive sebagai parameter
async function startProcess(userId, transactionId, tokenFromMsg, mainTabId, retryCount, isKeepAlive = false) {
  console.log("🚀 [Content] StartProcess received. isKeepAlive:", isKeepAlive);

  const benarPancingan = (isKeepAlive === true || isKeepAlive === "true");

  const userInput = document.querySelector('[name="userId"]');
  const txInput = document.querySelector('[name="transactionId"]');

  if (!userInput || !txInput) {
    console.error("❌ Input field tidak ditemukan!");
    chrome.runtime.sendMessage({
      action: "processError",
      userId: userId,
      transactionId: transactionId,
      error: "Input field tidak ditemukan",
      isKeepAlive: benarPancingan
    });
    return;
  }

  userInput.value = userId;
  const formattedTxId = `${transactionId}-${transactionId}-106-0`;
  txInput.value = formattedTxId;

  const searchBtn = document.querySelector(".success-button.langWord.jq-after-search");
  if (searchBtn) {
    searchBtn.click();
    console.log("🔍 Mengeklik tombol cari...");
  } else {
    console.error("❌ Tombol pencarian tidak ditemukan!");
    chrome.runtime.sendMessage({
      action: "processError",
      userId: userId,
      transactionId: transactionId,
      error: "Tombol pencarian tidak ditemukan (Situs mungkin sedang bermasalah)",
      isKeepAlive: benarPancingan
    });
    return;
  }

  // TUNGGU HASIL MUNCUL
  console.log("⏳ Menunggu hasil pencarian (4 detik)...");
  await delay(4000);

  const tx19 = transactionId.slice(0, 19);
  let debetValue = "0";
  let gameName = null;
  let primaryLinkElFound = false;
  let fullOnclickUrl = null;
  let targetLinkEl = null;

  const allLinkEls = document.querySelectorAll(".jq-keterangan-link");
  if (allLinkEls.length === 0) {
    chrome.runtime.sendMessage({
      action: "processError",
      userId: userId,
      transactionId: transactionId,
      error: "Data transaksi tidak ditemukan di tabel",
      isKeepAlive: benarPancingan
    });
    return;
  }

  // Iterasi mencari link detail sesuai backup
  console.log(`🔎 Mencari link yang mengandung ID: ${tx19}`);
  for (const link of allLinkEls) {
    const row = link.closest('tr');
    if (!row) continue;

    const isIdMatch = link.textContent.includes(tx19);
    const statusEl = row.querySelector("[data-changekey='status']");
    const statusText = statusEl ? statusEl.textContent.trim() : "N/A";

    if (isIdMatch && statusText === "Pertaruhan") {
      debetValue = row.querySelector("[data-changekey='debet']")?.textContent.trim() || "0";
      fullOnclickUrl = link.getAttribute("onclick");
      gameName = link.dataset.gamename;
      if (!gameName && fullOnclickUrl) {
        const gmMatch = fullOnclickUrl.match(/\/history\/(\d+)\.html/);
        if (gmMatch) gameName = gmMatch[1];
      }
      targetLinkEl = link;
      primaryLinkElFound = true;

      targetLinkEl = link;
      primaryLinkElFound = true;
      console.log(`✅ ID Cocok! Game: ${gameName}`);
      break;
    }
  }

  // JIKA PANCINGAN: JANGAN ambil token dari halaman ini (List), karena seringkali basi (stale).
  // Biarkan tab detail yang memanen token asli dari URL-nya sendiri.
  if (!primaryLinkElFound) {
    console.warn("❌ Link detail gagal dikonfirmasi. Mengecek pesan error...");
    chrome.runtime.sendMessage({
      action: "processError",
      userId: userId,
      transactionId: transactionId,
      error: "Link detail tidak ditemukan di tabel",
      isKeepAlive: benarPancingan
    });
    return;
  }

  if (benarPancingan) {
    // 🎣 KHUSUS PANCINGAN: METODE KLIK SILUMAN
    // Tetap klik fisik agar TIDAK SESSION TIMEOUT (Server Generate Token Sendiri)
    if (targetLinkEl) {
      console.log("🎣 [PANCINGAN] Memicu pancingan tanpa modal token...");

      chrome.storage.local.set({ pancinganTabOpening: true }, async () => {
        await delay(500);

        // --- TRICK: Cegat window.open agar tidak jadi Pop-Up mengganggu (NATIVE INJECTION) ---
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                const origOpen = window.open;
                window.open = function(url) {
                    window.postMessage({ type: 'SMJ_INTERCEPTED_URL', url: url }, '*');
                    return { focus: function(){}, close: function(){} }; // Cegah pop-up asli
                };
            })();
        `;
        document.documentElement.appendChild(script);
        script.remove();

        const listener = function(event) {
            if (event.source === window && event.data && event.data.type === 'SMJ_INTERCEPTED_URL') {
                window.removeEventListener('message', listener);
                console.log("🛡️ [PANCINGAN] Pop-up dicegat! Dialihkan ke Tab Latar Belakang.");
                chrome.runtime.sendMessage({ action: "openLink", url: event.data.url, isKeepAlive: true });
            }
        };
        window.addEventListener('message', listener);

        // Pancing klik tapi pastikan tab native tidak terbuka
        const oldHref = targetLinkEl.getAttribute('href');
        const oldTarget = targetLinkEl.getAttribute('target');
        if (oldHref) targetLinkEl.removeAttribute('href');
        if (oldTarget) targetLinkEl.removeAttribute('target');
        
        const preventNav = (e) => e.preventDefault();
        targetLinkEl.addEventListener('click', preventNav);

        targetLinkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetLinkEl.click();

        // Kembalikan atributnya NANTI agar event klik native benar-benar hangus
        setTimeout(() => {
            if (oldHref) targetLinkEl.setAttribute('href', oldHref);
            if (oldTarget) targetLinkEl.setAttribute('target', oldTarget);
            targetLinkEl.removeEventListener('click', preventNav);
        }, 500);
        
        setTimeout(() => { window.removeEventListener('message', listener); }, 4000);

        chrome.storage.local.set({
          lastKeepAliveRun: Date.now(),
          lastSyncStatus: `🎣 Pancingan Terpusat Berhasil (${new Date().toLocaleTimeString()})`
        });

        // Tutup admin pemanggil
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "closeTabSelf" });
        }, 3000);
      });
    }
    return;
  }

  // 🌐 KHUSUS SCANNER: METODE ANTREAN CEPAT (Tetap menggunakan manual URL construction)
  const originalUrl = extractUrlFromOnclick(fullOnclickUrl);
  
  // 🔥 AUTO-HEAL: Coba ekstrak token baru dari tombol klik di tabel hasil pencarian
  let activeToken = tokenFromMsg;
  if (fullOnclickUrl) {
    const tMatch = fullOnclickUrl.match(/[?&]t=([A-Z0-9-]{20,})/i);
    if (tMatch && tMatch[1]) {
        activeToken = tMatch[1];
        console.log("💎 [AUTO-HEAL] Token segar ditemukan langsung di tombol tabel! Menggunakannya: " + activeToken);
        // Kirim ke background agar UI Dashboard juga ikut terupdate
        chrome.runtime.sendMessage({ action: "TOKEN_HARVESTED", token: activeToken });
    }
  }


  let finalDomain = "public.u2uyu876x.com"; // Fallback default
  if (originalUrl) {
    const domainMatch = originalUrl.match(/https?:\/\/([^/]+)/);
    if (domainMatch && domainMatch[1]) finalDomain = domainMatch[1];
  }

  const apiHost = finalDomain.replace("public.", "public-api.");
  let linkUrl = `https://${finalDomain}/history/${gameName}.html?psid=${tx19}&sid=${tx19}&api=${apiHost}%252Fweb-api%252Foperator-proxy%252Fv1%252FHistory%252FGetBetHistory&lang=en&t=${activeToken || ""}`;

  // 🛡️ SUPER AUTO-HEAL: Jika token masih benar-benar kosong, kita paksa klik tombol secara native
  // dan kita cegat perintah window.open dari server untuk mendapatkan URL aslinya yang mengandung token!
  if (!activeToken || activeToken.length < 20) {
      console.log("⚠️ Token kosong! Melakukan Klik Siluman untuk mengekstrak token dari server...");
      
      const interceptedUrl = await new Promise((resolve) => {
          // Injeksi script ke dalam halaman web asli untuk mencegat window.open
          const script = document.createElement('script');
          script.textContent = `
              (function() {
                  const origOpen = window.open;
                  window.open = function(url) {
                      window.postMessage({ type: 'SMJ_INTERCEPTED_URL', url: url }, '*');
                      // DO NOT call origOpen to prevent the popup from showing
                      return { focus: function(){}, close: function(){} };
                  };
              })();
          `;
          document.documentElement.appendChild(script);
          script.remove();

          // Tunggu pesan balasan
          const listener = function(event) {
              if (event.source === window && event.data && event.data.type === 'SMJ_INTERCEPTED_URL') {
                  window.removeEventListener('message', listener);
                  resolve(event.data.url);
              }
          };
          window.addEventListener('message', listener);

          // Pancing klik tapi pastikan tab native tidak terbuka
          const oldHref = targetLinkEl.getAttribute('href');
          const oldTarget = targetLinkEl.getAttribute('target');
          if (oldHref) targetLinkEl.removeAttribute('href');
          if (oldTarget) targetLinkEl.removeAttribute('target');
          
          const preventNav = (e) => e.preventDefault();
          targetLinkEl.addEventListener('click', preventNav);

          targetLinkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetLinkEl.click();
          
          // Kembalikan atributnya NANTI agar event klik native benar-benar hangus
          setTimeout(() => {
              if (oldHref) targetLinkEl.setAttribute('href', oldHref);
              if (oldTarget) targetLinkEl.setAttribute('target', oldTarget);
              targetLinkEl.removeEventListener('click', preventNav);
          }, 500);
          
          // Timeout jika server tidak merespon (misalnya error)
          setTimeout(() => {
              window.removeEventListener('message', listener);
              resolve(null);
          }, 4000);
      });

      if (interceptedUrl) {
          console.log("💎 [SUPER AUTO-HEAL] URL Asli ditangkap langsung dari server: " + interceptedUrl);
          
          // Pastikan URL-nya absolute
          if (interceptedUrl.startsWith('/')) {
              linkUrl = window.location.origin + interceptedUrl;
          } else {
              linkUrl = interceptedUrl;
          }

          // Coba ekstrak token baru dari URL tersebut untuk disimpan
          try {
              const urlObj = new URL(linkUrl);
              const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('sid') || urlObj.searchParams.get('psid');
              if (tParam && tParam.length >= 20 && !tParam.startsWith('eyJ')) {
                  chrome.runtime.sendMessage({ action: "TOKEN_HARVESTED", token: tParam });
              }
          } catch(e) {}
      } else {
          console.error("❌ Gagal mengekstrak token dari server. Melanjutkan dengan manual (kemungkinan akan gagal).");
      }
  }

  console.log("🌐 [SCANNER] Membuka link Detail: " + linkUrl);
  await openAndProcessLink(linkUrl, userId, transactionId, debetValue, mainTabId, retryCount, false);
}

function extractUrlFromOnclick(onclickText) {
  if (!onclickText) return null;
  // Cari pola URL (HTTPS atau Path History)
  const match = onclickText.match(/(https?:\/\/[^'"]+)|\/history\/[^'"]+/);
  if (match) {
    let url = match[0];
    if (url.startsWith('/')) {
      url = window.location.origin + url;
    }
    return url;
  }
  return null;
}



async function openAndProcessLink(linkUrl, userId, transactionId, debetValue, mainTabId, retryCount, isKeepAlive = false) {
  return new Promise((resolve) => {
    // TAMBAHKAN PENANDA PANCINGAN JIKA PERLU
    let finalUrl = linkUrl;
    if (isKeepAlive) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + "isPancingan=true";
    }

    chrome.runtime.sendMessage({ action: "openLink", url: finalUrl, isKeepAlive: isKeepAlive }, async (response) => {
      if (!response || !response.tabId) {
        console.error("❌ Gagal membuka tab detail.");
        resolve(false);
        return;
      }

      // Jika bukan pancingan, baru jalankan script deteksi rounds
      if (!isKeepAlive) {
        chrome.runtime.sendMessage({
          action: "executeScriptInTab",
          tabId: response.tabId,
          transactionId, userId, debetValue, retryCount, isKeepAlive: false
        });
      }

      chrome.runtime.sendMessage({ action: "closeTab", tabId: mainTabId });
      resolve(true);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
