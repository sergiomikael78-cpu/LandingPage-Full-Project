/* Background service worker for Street Art Admin Customizer */

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    const defaultSettings = {
      targetUrl: '',
      isEnabled: true,
      bankHighlights: true,
      backgroundImage: null,
      backgroundOpacity: 0.15,
      themeColors: {
        sidebarBg: '',
        sidebarText: '',
        headerBg: '',
        headerText: '',
        tableRowOdd: '',
        tableRowEven: '',
        tableText: '',
        buttonPrimary: '',
        buttonSecondary: ''
      },
      quickNotes: {},
      skaterCombos: {
        enabled: true
      },
      watchedUsers: {
        vip: [],
        wanted: []
      },
      autoCopyEnabled: true
    };

    chrome.storage.local.set({ streetArtSettings: defaultSettings }, () => {
      console.log('🛹 Street Art Admin Customizer installed with default settings!');
    });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('streetArtSettings', (data) => {
      sendResponse(data.streetArtSettings || {});
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ streetArtSettings: message.settings }, () => {
      sendResponse({ success: true });
      // Notify all tabs to refresh their styles
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: message.settings }).catch(() => {});
        });
      });
    });
    return true;
  }
});
