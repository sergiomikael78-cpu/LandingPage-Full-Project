import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Play,
  Plus,
  Download,
  Upload,
  Settings as SettingsIcon,
  Layers,
  Shield,
  Sparkles,
  FileText,
  CheckSquare,
  Search,
  Globe,
  Share2,
  Edit3,
  Clock,
  Radio,
  HardDrive
} from "lucide-react";
import WorkspaceEditor from "./components/WorkspaceEditor";
import SettingsView from "./components/SettingsView";
import ImportPreviewModal from "./components/ImportPreviewModal";
import ShiftControlCenter from "./components/ShiftControlCenter";
import HandoverNotesModal from "./components/HandoverNotesModal";
import ShiftChecklistModal from "./components/ShiftChecklistModal";
import TemplatesModal from "./components/TemplatesModal";
import BackupRestoreModal from "./components/BackupRestoreModal";
import { getFaviconUrl } from "./utils/favicon";
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

interface ActiveSessionInfo {
  id: string;
  workspace_id: string;
  workspace_name: string;
  started_at: string;
  state: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "editor" | "settings">("dashboard");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDetails | null>(null);
  const [workspaceDetailsMap, setWorkspaceDetailsMap] = useState<Record<string, WorkspaceDetails>>({});
  const [isExtensionConnected, setIsExtensionConnected] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<{ workspaceId: string; workspaceName: string; startedAt: Date } | null>(null);
  
  // Modals state
  const [isEndingWorkModalOpen, setIsEndingWorkModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [isHandoverOpen, setIsHandoverOpen] = useState<boolean>(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "static" | "remember_last">("all");
  
  const [loading, setLoading] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchWorkspaces();
    checkExtensionHealth();
    restoreActiveSession();

    const interval = setInterval(() => {
      checkExtensionHealth();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const restoreActiveSession = async () => {
    try {
      const session = await invoke<ActiveSessionInfo | null>("get_active_session");
      if (session && session.state === "active") {
        console.log("[WorkspaceHub] Restored active session from SQLite:", session);
        setActiveSession({
          workspaceId: session.workspace_id,
          workspaceName: session.workspace_name,
          startedAt: new Date(session.started_at),
        });
        localStorage.setItem(
          "workspace_hub_active_session",
          JSON.stringify({
            workspaceId: session.workspace_id,
            workspaceName: session.workspace_name,
            startedAt: session.started_at,
          })
        );
        return;
      }
    } catch (e) {
      console.warn("Could not fetch active session from Tauri IPC, checking fallback:", e);
    }

    // LocalStorage fallback for preview modes
    const cached = localStorage.getItem("workspace_hub_active_session");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.workspaceName && parsed.startedAt) {
          setActiveSession({
            workspaceId: parsed.workspaceId || "",
            workspaceName: parsed.workspaceName,
            startedAt: new Date(parsed.startedAt),
          });
        }
      } catch {
        localStorage.removeItem("workspace_hub_active_session");
      }
    }
  };

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await invoke<Workspace[]>("get_workspaces");
      setWorkspaces(data);

      // Load details for all workspaces to populate tab counts and favicons
      const map: Record<string, WorkspaceDetails> = {};
      for (const ws of data) {
        try {
          const det = await invoke<WorkspaceDetails>("get_workspace_details", { workspaceId: ws.id });
          map[ws.id] = det;
        } catch (e) {
          console.warn("Could not load details for workspace:", ws.id, e);
        }
      }
      setWorkspaceDetailsMap(map);

      if (data.length > 0) {
        if (!selectedWorkspace || !data.some(w => w.id === selectedWorkspace.workspace.id)) {
          setSelectedWorkspace(map[data[0].id] || null);
        } else {
          setSelectedWorkspace(map[selectedWorkspace.workspace.id] || null);
        }
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

      const mockDetails: WorkspaceDetails = {
        workspace: mockWs[0],
        groups: [
          { id: "g1", name: "GOOGLE TOOLS", color: "blue" },
          { id: "g2", name: "CS DASHBOARDS", color: "green" },
        ],
        tabs: [
          { id: "t1", name: "Gmail CS", url: "https://mail.google.com", group_id: "g1", pinned: true },
          { id: "t2", name: "Google Drive", url: "https://drive.google.com", group_id: "g1", pinned: false },
          { id: "t3", name: "WhatsApp Web CS", url: "https://web.whatsapp.com", group_id: "g2", pinned: false },
          { id: "t4", name: "Zendesk", url: "https://zendesk.com", group_id: "g2", pinned: false },
        ],
      };

      setSelectedWorkspace(mockDetails);
      setWorkspaceDetailsMap({
        "mock-1": mockDetails,
        "mock-2": {
          workspace: mockWs[1],
          groups: [{ id: "g3", name: "LAPORAN", color: "purple" }],
          tabs: [
            { id: "t5", name: "Excel Online", url: "https://office.live.com", group_id: "g3", pinned: true },
            { id: "t6", name: "BCA Bisnis", url: "https://klikbca.com", group_id: "g3", pinned: false },
          ],
        },
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
      // Fetch the newly recorded active session from SQLite
      const session = await invoke<ActiveSessionInfo | null>("get_active_session");
      if (session) {
        setActiveSession({
          workspaceId: session.workspace_id,
          workspaceName: session.workspace_name,
          startedAt: new Date(session.started_at),
        });
        localStorage.setItem(
          "workspace_hub_active_session",
          JSON.stringify({
            workspaceId: session.workspace_id,
            workspaceName: session.workspace_name,
            startedAt: session.started_at,
          })
        );
      } else {
        const now = new Date();
        setActiveSession({ workspaceId: wsId, workspaceName: wsName, startedAt: now });
        localStorage.setItem(
          "workspace_hub_active_session",
          JSON.stringify({ workspaceId: wsId, workspaceName: wsName, startedAt: now.toISOString() })
        );
      }
    } catch (err) {
      console.warn("Could not send launch_workspace via Tauri IPC:", err);
      const now = new Date();
      setActiveSession({ workspaceId: wsId, workspaceName: wsName, startedAt: now });
      localStorage.setItem(
        "workspace_hub_active_session",
        JSON.stringify({ workspaceId: wsId, workspaceName: wsName, startedAt: now.toISOString() })
      );
    }
  };

  const handleEndWork = () => {
    setIsEndingWorkModalOpen(true);
  };

  const confirmEndWork = async () => {
    setActiveSession(null);
    setIsEndingWorkModalOpen(false);
    localStorage.removeItem("workspace_hub_active_session");
    try {
      await invoke("end_workspace_session");
    } catch (err) {
      console.warn("Could not send end_workspace_session via Tauri IPC:", err);
      // Fallback redirect to Google Logout
      window.open("https://accounts.google.com/Logout", "_blank");
    }
  };

  const handleReopenActiveWorkspaceTabs = async () => {
    if (!activeSession?.workspaceId) return;
    try {
      await invoke("launch_workspace", { workspaceId: activeSession.workspaceId });
    } catch (e) {
      console.warn("Could not re-launch workspace tabs:", e);
    }
  };

  const handleExportJson = async (wsId: string, wsName: string) => {
    try {
      const jsonStr = await invoke<string>("export_workspace_json", { workspaceId: wsId });
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workspace-${wsName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal mengekspor workspace: " + e);
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await invoke("import_workspace_json", { jsonStr: text });
      await fetchWorkspaces();
      alert("Workspace berhasil diimpor dari file JSON!");
    } catch (err) {
      alert("Gagal mengimpor file JSON: " + err);
    } finally {
      e.target.value = "";
    }
  };

  // Filtered workspaces list
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter((ws) => {
      const matchesSearch =
        ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ws.description && ws.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMode =
        filterMode === "all" || ws.behavior_mode === filterMode;

      return matchesSearch && matchesMode;
    });
  }, [workspaces, searchQuery, filterMode]);

  // Total tabs across all loaded workspaces
  const totalTabsCount = useMemo(() => {
    return Object.values(workspaceDetailsMap).reduce((acc, curr) => acc + (curr.tabs?.length || 0), 0);
  }, [workspaceDetailsMap]);

  return (
    <div className="app-container">
      {/* Hidden input for JSON restore */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        style={{ display: "none" }}
        onChange={handleImportJsonFile}
      />

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Sparkles size={22} color="#FFFFFF" />
          </div>
          <div>
            <div className="logo-text">WORKSPACE-X</div>
            <div style={{ fontSize: "0.68rem", color: "#94A3B8", letterSpacing: "0.5px" }}>SHIFT AUTOMATION</div>
          </div>
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
            <Edit3 size={18} />
            <span>Workspace Editor</span>
          </li>
          <li
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <SettingsIcon size={18} />
            <span>Pengaturan Bridge</span>
          </li>
        </ul>

        {/* Quick Shift Tools Sidebar Widget */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700, textTransform: "uppercase", paddingLeft: "8px" }}>
            Peralatan Shift
          </div>
          <button
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start", fontSize: "0.82rem", padding: "8px 12px" }}
            onClick={() => setIsHandoverOpen(true)}
          >
            <FileText size={16} color="#06B6D4" />
            <span>Operan Shift</span>
          </button>
          <button
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start", fontSize: "0.82rem", padding: "8px 12px" }}
            onClick={() => setIsChecklistOpen(true)}
          >
            <CheckSquare size={16} color="#10B981" />
            <span>SOP Checklist</span>
          </button>
          <button
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start", fontSize: "0.82rem", padding: "8px 12px" }}
            onClick={() => setIsTemplatesOpen(true)}
          >
            <Sparkles size={16} color="#818CF8" />
            <span>Template Hub</span>
          </button>
          <button
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start", fontSize: "0.82rem", padding: "8px 12px", borderColor: "rgba(245, 158, 11, 0.3)" }}
            onClick={() => setIsBackupModalOpen(true)}
            title="Cadangkan seluruh data atau pulihkan data di PC baru"
          >
            <HardDrive size={16} color="#F59E0B" />
            <span>Backup & Migrasi PC</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="header-bar">
          <div>
            <h1 className="greeting-title">Pusat Kendali Lingkungan Kerja</h1>
            <p className="greeting-sub">Otomasi tab browser & keamanan sesi untuk komputer bersama.</p>
          </div>

          <div className="health-badge">
            <span className={`status-dot ${isExtensionConnected ? "connected" : "disconnected"}`} />
            <span>{isExtensionConnected ? "Bridge Connected (Ready)" : "Bridge Disconnected"}</span>
          </div>
        </header>

        {/* Shift Control Center when session is active */}
        {activeSession && (
          <ShiftControlCenter
            workspaceName={activeSession.workspaceName}
            startedAt={activeSession.startedAt}
            onEndWork={handleEndWork}
            onOpenHandover={() => setIsHandoverOpen(true)}
            onOpenChecklist={() => setIsChecklistOpen(true)}
            onReopenTabs={activeSession.workspaceId ? handleReopenActiveWorkspaceTabs : undefined}
          />
        )}

        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <>
            {/* KPI Stat Cards */}
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818CF8" }}>
                  <Layers size={22} />
                </div>
                <div>
                  <div className="kpi-title">Total Workspace</div>
                  <div className="kpi-value">{workspaces.length}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34D399" }}>
                  <Globe size={22} />
                </div>
                <div>
                  <div className="kpi-title">Tab Terdaftar</div>
                  <div className="kpi-value">{totalTabsCount}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ background: "rgba(6, 182, 212, 0.15)", color: "#22D3EE" }}>
                  <Clock size={22} />
                </div>
                <div>
                  <div className="kpi-title">Status Shift</div>
                  <div className="kpi-value" style={{ fontSize: "1.1rem" }}>
                    {activeSession ? "Bertugas" : "Standby"}
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#FBBF24" }}>
                  <Radio size={22} />
                </div>
                <div>
                  <div className="kpi-title">Browser Bridge</div>
                  <div className="kpi-value" style={{ fontSize: "1.1rem" }}>
                    {isExtensionConnected ? "Online" : "Offline"}
                  </div>
                </div>
              </div>
            </div>

            {/* Toolbar: Search, Filters, Actions */}
            <div className="toolbar-row">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div className="search-box-container">
                  <Search size={16} color="#94A3B8" />
                  <input
                    type="text"
                    placeholder="Cari workspace atau situs..."
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-pills">
                  <button
                    className={`pill-filter-btn ${filterMode === "all" ? "active" : ""}`}
                    onClick={() => setFilterMode("all")}
                  >
                    Semua ({workspaces.length})
                  </button>
                  <button
                    className={`pill-filter-btn ${filterMode === "static" ? "active" : ""}`}
                    onClick={() => setFilterMode("static")}
                  >
                    Static Mode
                  </button>
                  <button
                    className={`pill-filter-btn ${filterMode === "remember_last" ? "active" : ""}`}
                    onClick={() => setFilterMode("remember_last")}
                  >
                    Remember Mode
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="toolbar-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setIsTemplatesOpen(true)}
                  title="Gunakan template workspace terkurasi"
                >
                  <Sparkles size={15} color="#818CF8" />
                  <span>Template Hub</span>
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => setIsImportModalOpen(true)}
                  title="Import tab yang sedang terbuka di browser"
                >
                  <Download size={15} />
                  <span>Import Browser</span>
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => setIsBackupModalOpen(true)}
                  title="Pusat pencadangan dan pemulihan data lengkap untuk pindah PC"
                  style={{ borderColor: "rgba(99, 102, 241, 0.5)", background: "rgba(99, 102, 241, 0.12)" }}
                >
                  <HardDrive size={15} color="#818CF8" />
                  <span>Backup & Restore</span>
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  title="Pulihkan workspace dari file JSON cadangan"
                >
                  <Upload size={15} />
                  <span>Restore JSON</span>
                </button>

                <button
                  className="btn-primary"
                  onClick={() => {
                    setSelectedWorkspace(null);
                    setActiveTab("editor");
                  }}
                >
                  <Plus size={16} />
                  <span>Buat Workspace</span>
                </button>
              </div>
            </div>

            {/* Workspace Grid */}
            {loading ? (
              <p style={{ color: "#94A3B8", textAlign: "center", padding: "40px 0" }}>
                Memuat daftar workspace...
              </p>
            ) : filteredWorkspaces.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", background: "rgba(17, 24, 39, 0.5)", borderRadius: "16px", border: "1px dashed var(--border-color)" }}>
                <Sparkles size={36} color="#6366F1" style={{ margin: "0 auto 12px auto", opacity: 0.7 }} />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>Tidak Ada Workspace Ditemukan</h3>
                <p style={{ color: "#94A3B8", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Mulai dengan membuat workspace baru atau gunakan template siap pakai.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button className="btn-primary" onClick={() => setIsTemplatesOpen(true)}>
                    <Sparkles size={16} />
                    <span>Jelajahi Template Hub</span>
                  </button>
                  <button className="btn-secondary" onClick={() => setActiveTab("editor")}>
                    <Plus size={16} />
                    <span>Buat Dari Nol</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="workspace-grid">
                {filteredWorkspaces.map((ws) => {
                  const details = workspaceDetailsMap[ws.id];
                  const tabs = details?.tabs || [];
                  const groups = details?.groups || [];

                  return (
                    <div key={ws.id} className="workspace-card">
                      <div>
                        <div className="card-header">
                          <div>
                            <div className="card-title">{ws.name}</div>
                            <div className="card-desc">
                              {ws.description || "Workspace efisiensi tanpa deskripsi"}
                            </div>
                          </div>
                          <span className="tag-badge">
                            {ws.behavior_mode === "static" ? "STATIC" : "REMEMBER"}
                          </span>
                        </div>

                        {/* Visual Favicon Row of tabs */}
                        {tabs.length > 0 && (
                          <div className="favicons-row">
                            <span style={{ fontSize: "0.72rem", color: "#64748B", marginRight: "4px" }}>Situs:</span>
                            {tabs.slice(0, 6).map((t, idx) => (
                              <img
                                key={idx}
                                src={getFaviconUrl(t.url)}
                                alt={t.name}
                                title={`${t.name} (${t.url})`}
                                className="tab-favicon"
                                onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                              />
                            ))}
                            {tabs.length > 6 && (
                              <span style={{ fontSize: "0.72rem", color: "#94A3B8", marginLeft: "4px" }}>
                                +{tabs.length - 6}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Groups Breakdown */}
                        {groups.length > 0 && (
                          <div className="groups-preview">
                            {groups.map((g) => {
                              const groupTabsCount = tabs.filter((t) => t.group_id === g.id).length;
                              return (
                                <div key={g.id} className="group-pill">
                                  <div className="group-name-tag">
                                    <span
                                      className="dot-indicator"
                                      style={{
                                        backgroundColor:
                                          g.color === "blue"
                                            ? "#3B82F6"
                                            : g.color === "green"
                                            ? "#10B981"
                                            : g.color === "red"
                                            ? "#EF4444"
                                            : g.color === "purple"
                                            ? "#8B5CF6"
                                            : "#F59E0B",
                                      }}
                                    />
                                    <span>{g.name}</span>
                                  </div>
                                  <span style={{ color: "#64748B", fontSize: "0.75rem" }}>
                                    {groupTabsCount} Tabs
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="card-actions">
                        <button
                          className="btn-primary"
                          style={{ flex: 1 }}
                          onClick={() => handleStartWork(ws.id, ws.name)}
                        >
                          <Play size={16} fill="currentColor" />
                          <span>START WORK</span>
                        </button>

                        <button
                          className="btn-secondary"
                          title="Buka di Workspace Editor"
                          onClick={() => {
                            setSelectedWorkspace(details || null);
                            setActiveTab("editor");
                          }}
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          className="btn-secondary"
                          title="Cadangkan workspace ke file JSON"
                          onClick={() => handleExportJson(ws.id, ws.name)}
                        >
                          <Share2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* WORKSPACE EDITOR TAB */}
        {activeTab === "editor" && (
          <WorkspaceEditor
            selectedWorkspace={selectedWorkspace}
            allWorkspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
            onSelectWorkspaceId={loadWorkspaceDetails}
            onRefresh={fetchWorkspaces}
          />
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <SettingsView
            isExtensionConnected={isExtensionConnected}
            onRefreshHealth={checkExtensionHealth}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
          />
        )}

        {/* Footer */}
        <footer style={{ marginTop: "auto", paddingTop: "24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={14} color="#10B981" />
            <span>Local-First Architecture • Zero Password/Cookie Storage</span>
          </div>
          <div>Workspace Hub v1.0 (Windows + Chromium Bridge)</div>
        </footer>
      </main>

      {/* End Work Confirmation Modal */}
      {isEndingWorkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card modal-large">
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>
              Akhiri Shift Kerja (END WORK)?
            </h3>
            <p style={{ color: "#94A3B8", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "20px" }}>
              Aplikasi akan memandu menutup tab pekerjaan secara aman dan mengarahkan ke halaman logout Google resmi.
            </p>

            <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
              <FileText size={18} color="#06B6D4" />
              <div style={{ fontSize: "0.83rem", color: "#A5F3FC" }}>
                Pastikan Anda telah mengisi <strong>Catatan Operan Shift</strong> sebelum mengakhiri sesi jika ada pesan penting untuk rekan kerja shift berikutnya.
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setIsEndingWorkModalOpen(false)}>
                Batal
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsEndingWorkModalOpen(false);
                  setIsHandoverOpen(true);
                }}
              >
                <FileText size={15} />
                <span>Buka Catatan Operan</span>
              </button>
              <button className="btn-danger-glow" onClick={confirmEndWork}>
                Konfirmasi & Logout Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ImportPreviewModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchWorkspaces}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSuccess={fetchWorkspaces}
      />

      <HandoverNotesModal
        isOpen={isHandoverOpen}
        onClose={() => setIsHandoverOpen(false)}
        activeWorkspaceName={activeSession?.workspaceName}
      />

      <ShiftChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
      />

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        workspaces={workspaces}
        workspaceDetailsMap={workspaceDetailsMap}
        onSuccess={fetchWorkspaces}
      />
    </div>
  );
}
