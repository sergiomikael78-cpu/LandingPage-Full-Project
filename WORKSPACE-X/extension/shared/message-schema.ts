export const PROTOCOL_VERSION = "1.0.0";

export type MessageType =
  | "HANDSHAKE"
  | "HANDSHAKE_ACK"
  | "PING"
  | "PONG"
  | "GET_BROWSER_STATE"
  | "BROWSER_STATE_RESPONSE"
  | "CREATE_TAB_GROUP"
  | "OPEN_TABS"
  | "CLOSE_TABS"
  | "NAVIGATE_LOGOUT"
  | "LAUNCH_PROGRESS"
  | "ERROR";

export interface TabGroupDefinition {
  name: string;
  color: "grey" | "blue" | "red" | "yellow" | "green" | "pink" | "purple" | "cyan" | "orange";
  collapsed?: boolean;
}

export interface TabDefinition {
  id?: string;
  name: string;
  url: string;
  groupName?: string;
  pinned?: boolean;
  position?: number;
}

export interface BrowserTabState {
  id: number;
  windowId: number;
  title: string;
  url: string;
  pinned: boolean;
  groupId: number;
  index: number;
}

export interface BrowserGroupState {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
}

export interface BridgeMessage<T = unknown> {
  id: string;
  type: MessageType;
  protocolVersion: string;
  payload: T;
  timestamp: number;
}

export interface HandshakePayload {
  token: string;
  extensionId?: string;
}

export interface HandshakeAckPayload {
  success: boolean;
  appVersion: string;
  error?: string;
}

export interface BrowserStatePayload {
  tabs: BrowserTabState[];
  groups: BrowserGroupState[];
}

export interface LaunchWorkspacePayload {
  workspaceId: string;
  workspaceName: string;
  groups: TabGroupDefinition[];
  tabs: TabDefinition[];
}

export interface LaunchProgressPayload {
  workspaceId: string;
  totalTabs: number;
  openedTabs: number;
  currentTabUrl?: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  errorDetails?: string[];
}
