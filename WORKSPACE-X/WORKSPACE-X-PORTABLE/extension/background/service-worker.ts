import {
  BridgeMessage,
  PROTOCOL_VERSION,
  LaunchWorkspacePayload,
} from "../shared/message-schema";
import { TabController } from "./tab-controller";

class ServiceWorkerBridge {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private wsUrl = "ws://127.0.0.1:9001/ws";

  constructor() {
    this.init();
  }

  private init() {
    console.log("[WorkspaceHub Bridge] Initializing Service Worker Bridge...");
    this.connect();

    // Listen for chrome alarms or lifecycle events to ensure bridge stays alive
    chrome.runtime.onStartup.addListener(() => this.connect());
    chrome.runtime.onInstalled.addListener(() => this.connect());
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      console.log(`[WorkspaceHub Bridge] Connecting to Desktop App at ${this.wsUrl}...`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log("[WorkspaceHub Bridge] WebSocket connected successfully.");
        this.isConnected = true;
        this.reconnectDelay = 1000;
        this.sendHandshake();
        this.updateBadge("ON", "#10B981"); // Green badge
      };

      this.ws.onmessage = async (event) => {
        try {
          const message: BridgeMessage = JSON.parse(event.data);
          await this.handleMessage(message);
        } catch (err) {
          console.error("[WorkspaceHub Bridge] Error parsing message:", err);
        }
      };

      this.ws.onclose = () => {
        console.warn("[WorkspaceHub Bridge] WebSocket closed.");
        this.isConnected = false;
        this.updateBadge("OFF", "#6B7280"); // Gray badge
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error("[WorkspaceHub Bridge] WebSocket error:", err);
        this.updateBadge("ERR", "#EF4444"); // Red badge
      };
    } catch (e) {
      console.error("[WorkspaceHub Bridge] Connection error:", e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  private sendHandshake() {
    this.sendMessage({
      id: crypto.randomUUID(),
      type: "HANDSHAKE",
      protocolVersion: PROTOCOL_VERSION,
      payload: { token: "LOCAL_DEV_TOKEN", extensionId: chrome.runtime.id },
      timestamp: Date.now(),
    });
  }

  private sendMessage(msg: BridgeMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleMessage(msg: BridgeMessage) {
    console.log("[WorkspaceHub Bridge] Received command:", msg.type);

    switch (msg.type) {
      case "PING":
        this.sendMessage({
          id: msg.id,
          type: "PONG",
          protocolVersion: PROTOCOL_VERSION,
          payload: { status: "ALIVE" },
          timestamp: Date.now(),
        });
        break;

      case "GET_BROWSER_STATE": {
        const state = await TabController.getCurrentBrowserState();
        this.sendMessage({
          id: msg.id,
          type: "BROWSER_STATE_RESPONSE",
          protocolVersion: PROTOCOL_VERSION,
          payload: state,
          timestamp: Date.now(),
        });
        break;
      }

      case "CREATE_TAB_GROUP":
      case "OPEN_TABS": {
        const payload = msg.payload as LaunchWorkspacePayload;
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
                status: "IN_PROGRESS",
              },
              timestamp: Date.now(),
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
            errorDetails: result.errors,
          },
          timestamp: Date.now(),
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

  private updateBadge(text: string, color: string) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

// Instantiate Service Worker Bridge
new ServiceWorkerBridge();
