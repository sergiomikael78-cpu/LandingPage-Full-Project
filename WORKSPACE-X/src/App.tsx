import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Play,
  Square,
  Plus,
  Download,
  Settings as SettingsIcon,
  Layers,
  CheckCircle2,
  Shield,
  Sparkles
} from "lucide-react";
import WorkspaceEditor from "./components/WorkspaceEditor";
import SettingsView from "./components/SettingsView";
import ImportPreviewModal from "./components/ImportPreviewModal";
import "./App.css";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  color?: string;
  behavior_mode: string;
  is_favorite: boolean;
  position: number;
  created_at: string;
  last_used_at?: string;
}

interface WorkspaceGroup {
  id: string;
  name: string;
  color: string;
}

interface WorkspaceTab {
  id: string;
  name: string;
  url: string;
  group_id?: string;
  pinned: boolean;
}

interface WorkspaceDetails {
  workspace: Workspace;
  groups: WorkspaceGroup[];
  tabs: WorkspaceTab[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "editor" | "settings">("dashboard");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDetails | null>(null);
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<{ workspaceName: string; startedAt: string } | null>(null);
  const [isEndingWorkModalOpen, setIsEndingWorkModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchWorkspaces();
    checkExtensionHealth();

    const interval = setInterval(() => {
      checkExtensionHealth();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await invoke<Workspace[]>("get_workspaces");
      setWorkspaces(data);

      if (data.length > 0) {
        loadWorkspaceDetails(data[0].id);
      }
    } catch (err) {
      console.warn("Tauri API not available or dev mode fallback:", err);
      // Fallback mock data for web preview
      const mockWs: Workspace[] = [
        {
          id: "mock-1",
          name: "CS NIGHT SHIFT",
          description: "Lingkungan kerja khusus Customer Service shift malam",
          color: "#10B981",
          behavior_mode: "static",
          is_favorite: true,
          position: 0,
          created_at: new Date().toISOString(),
          last_used_at: "Hari ini, 22:00",
        },
        {
          id: "mock-2",
          name: "ADMIN & REPORTING",
          description: "Google Spreadsheet & laporan penjualan harian",
          color: "#6366F1",
          behavior_mode: "remember_last",
          is_favorite: false,
          position: 1,
          created_at: new Date().toISOString(),
        },
      ];
      setWorkspaces(mockWs);

      setSelectedWorkspace({
        workspace: mockWs[0],
        groups: [
          { id: "g1", name: "GOOGLE TOOLS", color: "blue" },
          { id: "g2", name: "CS DASHBOARDS", color: "green" },
        ],
        tabs: [
          { id: "t1", name: "Gmail CS", url: "https://mail.google.com", group_id: "g1", pinned: true },
          { id: "t2", name: "Google Drive", url: "https://drive.google.com", group_id: "g1", pinned: false },
          { id: "t3", name: "WhatsApp Web CS", url: "https://web.whatsapp.com", group_id: "g2", pinned: false },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceDetails = async (id: string) => {
    try {
      const details = await invoke<WorkspaceDetails>("get_workspace_details", { workspaceId: id });
      setSelectedWorkspace(details);
    } catch (err) {
      console.error("Error loading workspace details:", err);
    }
  };

  const checkExtensionHealth = async () => {
    try {
      const status = await invoke<boolean>("get_extension_status");
      setIsExtensionConnected(status);
    } catch {
      setIsExtensionConnected(false);
    }
  };

  const handleStartWork = async (wsId: string, wsName: string) => {
    try {
      await invoke("launch_workspace", { workspaceId: wsId });
    } catch (err) {
      console.warn("Could not send launch_workspace via Tauri IPC:", err);
    }
    setActiveSession({
      workspaceName: wsName,
      startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleEndWork = () => {
    setIsEndingWorkModalOpen(true);
  };

  const confirmEndWork = async () => {
    setActiveSession(null);
    setIsEndingWorkModalOpen(false);
    try {
      await invoke("end_workspace_session");
    } catch (err) {
      console.warn("Could not send end_workspace_session via Tauri IPC:", err);
      // Fallback
      window.open("https://accounts.google.com/Logout", "_blank");
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          <div className="logo-text">WORKSPACE-X</div>
        </div>

        <ul className="nav-list">
          <li
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <Layers size={18} />
            <span>Dashboard</span>
          </li>
          <li
            className={`nav-item ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            <Plus size={18} />
            <span>Workspace Editor</span>
          </li>
          <li
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <SettingsIcon size={18} />
            <span>Settings</span>
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header-bar">
          <div>
            <h1 className="greeting-title">Selamat Bekerja!</h1>
            <p className="greeting-sub">Otomasi lingkungan kerja browser local-first tanpa credential storage.</p>
          </div>

          <div className="health-badge">
            <span className={`status-dot ${isExtensionConnected ? "connected" : "disconnected"}`} />
            <span>{isExtensionConnected ? "Bridge Connected (Google)" : "Bridge Disconnected"}</span>
          </div>
        </header>

        {/* Active Session Banner */}
        {activeSession && (
          <div className="active-session-banner">
            <div className="active-info">
              <div className="pulse-icon">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  Workspace Aktif: {activeSession.workspaceName}
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                  Dimulai pada {activeSession.startedAt} • Zero Credential Storage Active
                </p>
              </div>
            </div>

            <button className="btn-danger" onClick={handleEndWork}>
              <Square size={16} fill="currentColor" />
              <span>END WORK</span>
            </button>
          </div>
        )}

        {/* Dashboard View */}
        {activeTab === "dashboard" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 className="section-title">Daftar Workspace</h2>
              <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }} onClick={() => setIsImportModalOpen(true)}>
                <Download size={14} />
                <span>Import Current Browser</span>
              </button>
            </div>

            {loading ? (
              <p style={{ color: "#94A3B8" }}>Memuat daftar workspace...</p>
            ) : (
              <div className="workspace-grid">
                {workspaces.map((ws) => (
                  <div key={ws.id} className="workspace-card">
                    <div>
                      <div className="card-header">
                        <div>
                          <div className="card-title">{ws.name}</div>
                          <div className="card-desc">{ws.description}</div>
                        </div>
                        <span className="tag-badge">
                          {ws.behavior_mode === "static" ? "STATIC" : "REMEMBER"}
                        </span>
                      </div>

                      {/* Groups preview */}
                      {selectedWorkspace?.workspace.id === ws.id && (
                        <div className="groups-preview">
                          {selectedWorkspace.groups.map((g) => (
                            <div key={g.id} className="group-pill">
                              <div className="group-name-tag">
                                <span className="dot-indicator" style={{ backgroundColor: g.color === "blue" ? "#3B82F6" : "#10B981" }} />
                                <span>{g.name}</span>
                              </div>
                              <span style={{ color: "#64748B", fontSize: "0.75rem" }}>
                                {selectedWorkspace.tabs.filter((t) => t.group_id === g.id).length} Tabs
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card-actions">
                      <button
                        className="btn-primary"
                        onClick={() => handleStartWork(ws.id, ws.name)}
                      >
                        <Play size={16} fill="currentColor" />
                        <span>START WORK</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Workspace Editor View */}
        {activeTab === "editor" && (
          <WorkspaceEditor selectedWorkspace={selectedWorkspace} onRefresh={fetchWorkspaces} />
        )}

        {/* Settings View */}
        {activeTab === "settings" && (
          <SettingsView isExtensionConnected={isExtensionConnected} onRefreshHealth={checkExtensionHealth} />
        )}

        {/* Security & System Info Footer */}
        <footer style={{ marginTop: "auto", paddingTop: "24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={14} color="#10B981" />
            <span>Local-First Architecture • Zero Password/Cookie Storage</span>
          </div>
          <div>Workspace Hub v1.0 (Windows + Google Chrome Bridge)</div>
        </footer>
      </main>

      {/* End Work Modal Confirmation */}
      {isEndingWorkModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1E293B", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "16px", padding: "32px", width: "420px", maxWidth: "90%" }}>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>Akhiri Shift Kerja (END WORK)?</h3>
            <p style={{ color: "#94A3B8", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "24px" }}>
              Aplikasi akan memandu Anda menutup tab pekerjaan dan mengarahkan ke halaman logout Google resmi secara aman. Tidak ada credential yang disimpan.
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setIsEndingWorkModalOpen(false)}>
                Batal
              </button>
              <button className="btn-danger" onClick={confirmEndWork}>
                Konfirmasi & Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      <ImportPreviewModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchWorkspaces}
      />
    </div>
  );
}
