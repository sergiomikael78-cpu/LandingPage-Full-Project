"use strict";
(() => {
  // extension/shared/message-schema.ts
  var PROTOCOL_VERSION = "1.0.0";

  // extension/background/tab-controller.ts
  var TabController = class {
    /**
     * Queries all open tabs and tab groups in current window or all windows.
     */
    static async getCurrentBrowserState() {
      const rawTabs = await chrome.tabs.query({});
      const tabs = rawTabs.map((t) => ({
        id: t.id ?? -1,
        windowId: t.windowId,
        title: t.title ?? "",
        url: t.url ?? "",
        pinned: t.pinned ?? false,
        groupId: t.groupId ?? -1,
        index: t.index
      }));
      let groups = [];
      if (chrome.tabGroups) {
        try {
          const rawGroups = await chrome.tabGroups.query({});
          groups = rawGroups.map((g) => ({
            id: g.id,
            title: g.title ?? "",
            color: g.color ?? "grey",
            collapsed: g.collapsed ?? false
          }));
        } catch (err) {
          console.warn("chrome.tabGroups query error or not supported:", err);
        }
      }
      return { tabs, groups };
    }
    static async launchWorkspace(groupsDef, tabsDef, onProgress) {
      const errors = [];
      const createdGroupsMap = /* @__PURE__ */ new Map();
      const groupWindowMap = /* @__PURE__ */ new Map();
      const currentWindow = await chrome.windows.getCurrent();
      const defaultWindowId = currentWindow.id;
      let openedCount = 0;
      const totalCount = tabsDef.length;
      for (const tabDef of tabsDef) {
        try {
          if (!tabDef.url || !tabDef.url.startsWith("http")) {
            errors.push(`Invalid URL skipped: ${tabDef.url}`);
            continue;
          }
          let createdTabId;
          let targetWindowId = defaultWindowId;
          if (tabDef.groupName && chrome.tabGroups) {
            let savedWindowId = groupWindowMap.get(tabDef.groupName);
            if (savedWindowId === void 0) {
              const newWin = await chrome.windows.create({
                url: tabDef.url,
                state: "maximized"
              });
              savedWindowId = newWin.id;
              if (savedWindowId) {
                groupWindowMap.set(tabDef.groupName, savedWindowId);
              }
              if (newWin.tabs && newWin.tabs.length > 0) {
                createdTabId = newWin.tabs[0].id;
                if (tabDef.pinned && createdTabId) {
                  await chrome.tabs.update(createdTabId, { pinned: true });
                }
              }
            } else {
              targetWindowId = savedWindowId;
              const createdTab = await chrome.tabs.create({
                windowId: targetWindowId,
                url: tabDef.url,
                pinned: tabDef.pinned ?? false,
                active: false
              });
              createdTabId = createdTab.id;
            }
          } else {
            const createdTab = await chrome.tabs.create({
              windowId: defaultWindowId,
              url: tabDef.url,
              pinned: tabDef.pinned ?? false,
              active: false
            });
            createdTabId = createdTab.id;
          }
          openedCount++;
          if (onProgress) {
            onProgress(totalCount, openedCount, tabDef.url);
          }
          if (tabDef.groupName && createdTabId && chrome.tabGroups) {
            try {
              let groupId = createdGroupsMap.get(tabDef.groupName);
              if (groupId === void 0) {
                const savedWindowId = groupWindowMap.get(tabDef.groupName);
                groupId = await chrome.tabs.group({
                  tabIds: [createdTabId],
                  createProperties: { windowId: savedWindowId }
                });
                createdGroupsMap.set(tabDef.groupName, groupId);
                const matchingGroupDef = groupsDef.find((g) => g.name === tabDef.groupName);
                await chrome.tabGroups.update(groupId, {
                  title: tabDef.groupName,
                  color: matchingGroupDef?.color ?? "blue",
                  collapsed: matchingGroupDef?.collapsed ?? false
                });
              } else {
                await chrome.tabs.group({
                  groupId,
                  tabIds: [createdTabId]
                });
              }
            } catch (groupError) {
              console.warn(`Fallback: Failed to group tab ${tabDef.name}:`, groupError);
              errors.push(`Failed to place "${tabDef.name}" into group "${tabDef.groupName}"`);
            }
          }
        } catch (tabError) {
          errors.push(`Failed to open tab "${tabDef.name}" (${tabDef.url}): ${tabError?.message || tabError}`);
        }
      }
      return {
        success: errors.length === 0,
        errors
      };
    }
    /**
     * Safely opens the Google logout URL and closes all other workspace tabs/windows.
     */
    static async openGoogleLogout() {
      const windows = await chrome.windows.getAll({ populate: false });
      const logoutWin = await chrome.windows.create({
        url: "https://accounts.google.com/Logout",
        state: "maximized"
      });
      for (const win of windows) {
        if (win.id && win.id !== logoutWin.id) {
          try {
            await chrome.windows.remove(win.id);
          } catch (e) {
            console.warn("Could not close window", win.id, e);
          }
        }
      }
    }
  };

  // extension/background/service-worker.ts
  var ServiceWorkerBridge = class {
    ws = null;
    isConnected = false;
    reconnectDelay = 1e3;
    maxReconnectDelay = 3e4;
    wsUrl = "ws://127.0.0.1:9001/ws";
    constructor() {
      this.init();
    }
    init() {
      console.log("[WorkspaceHub Bridge] Initializing Service Worker Bridge...");
      this.connect();
      chrome.runtime.onStartup.addListener(() => this.connect());
      chrome.runtime.onInstalled.addListener(() => this.connect());
    }
    connect() {
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        return;
      }
      try {
        console.log(`[WorkspaceHub Bridge] Connecting to Desktop App at ${this.wsUrl}...`);
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = () => {
          console.log("[WorkspaceHub Bridge] WebSocket connected successfully.");
          this.isConnected = true;
          this.reconnectDelay = 1e3;
          this.sendHandshake();
          this.updateBadge("ON", "#10B981");
        };
        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await this.handleMessage(message);
          } catch (err) {
            console.error("[WorkspaceHub Bridge] Error parsing message:", err);
          }
        };
        this.ws.onclose = () => {
          console.warn("[WorkspaceHub Bridge] WebSocket closed.");
          this.isConnected = false;
          this.updateBadge("OFF", "#6B7280");
          this.scheduleReconnect();
        };
        this.ws.onerror = (err) => {
          console.error("[WorkspaceHub Bridge] WebSocket error:", err);
          this.updateBadge("ERR", "#EF4444");
        };
      } catch (e) {
        console.error("[WorkspaceHub Bridge] Connection error:", e);
        this.scheduleReconnect();
      }
    }
    scheduleReconnect() {
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.connect();
      }, this.reconnectDelay);
    }
    sendHandshake() {
      this.sendMessage({
        id: crypto.randomUUID(),
        type: "HANDSHAKE",
        protocolVersion: PROTOCOL_VERSION,
        payload: { token: "LOCAL_DEV_TOKEN", extensionId: chrome.runtime.id },
        timestamp: Date.now()
      });
    }
    sendMessage(msg) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    }
    async handleMessage(msg) {
      console.log("[WorkspaceHub Bridge] Received command:", msg.type);
      switch (msg.type) {
        case "PING":
          this.sendMessage({
            id: msg.id,
            type: "PONG",
            protocolVersion: PROTOCOL_VERSION,
            payload: { status: "ALIVE" },
            timestamp: Date.now()
          });
          break;
        case "GET_BROWSER_STATE": {
          const state = await TabController.getCurrentBrowserState();
          this.sendMessage({
            id: msg.id,
            type: "BROWSER_STATE_RESPONSE",
            protocolVersion: PROTOCOL_VERSION,
            payload: state,
            timestamp: Date.now()
          });
          break;
        }
        case "CREATE_TAB_GROUP":
        case "OPEN_TABS": {
          const payload = msg.payload;
          const result = await TabController.launchWorkspace(
            payload.groups,
            payload.tabs,
            (total, opened, currentUrl) => {
              this.sendMessage({
                id: crypto.randomUUID(),
                type: "LAUNCH_PROGRESS",
                protocolVersion: PROTOCOL_VERSION,
                payload: {
                  workspaceId: payload.workspaceId,
                  totalTabs: total,
                  openedTabs: opened,
                  currentTabUrl: currentUrl,
                  status: "IN_PROGRESS"
                },
                timestamp: Date.now()
              });
            }
          );
          this.sendMessage({
            id: msg.id,
            type: "LAUNCH_PROGRESS",
            protocolVersion: PROTOCOL_VERSION,
            payload: {
              workspaceId: payload.workspaceId,
              totalTabs: payload.tabs.length,
              openedTabs: payload.tabs.length - result.errors.length,
              status: result.success ? "COMPLETED" : "FAILED",
              errorDetails: result.errors
            },
            timestamp: Date.now()
          });
          break;
        }
        case "NAVIGATE_LOGOUT":
          await TabController.openGoogleLogout();
          break;
        default:
          console.warn("[WorkspaceHub Bridge] Unknown message type:", msg.type);
      }
    }
    updateBadge(text, color) {
      chrome.action.setBadgeText({ text });
      chrome.action.setBadgeBackgroundColor({ color });
    }
  };
  new ServiceWorkerBridge();
})();
