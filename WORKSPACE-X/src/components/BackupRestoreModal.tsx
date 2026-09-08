import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Download,
  Upload,
  Database,
  Check,
  AlertCircle,
  FolderOpen,
  Layers,
  Globe,
  CheckSquare,
  RefreshCw,
  Sparkles,
  X,
  HardDriveDownload,
  HardDriveUpload,
  Info
} from "lucide-react";

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

interface FullBackupWorkspace {
  workspace: Workspace;
  groups: WorkspaceGroup[];
  tabs: WorkspaceTab[];
}

interface FullBackupPayload {
  app: string;
  version: string;
  exported_at: string;
  workspaces: FullBackupWorkspace[];
  extra_data?: {
    shift_checklist?: any[];
    handover_notes?: string;
    operator_name?: string;
    browser_pref?: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  workspaceDetailsMap: Record<string, WorkspaceDetails>;
  onSuccess: () => void;
}

export default function BackupRestoreModal({
  isOpen,
  onClose,
  workspaces,
  workspaceDetailsMap,
  onSuccess,
}: Props) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // File import state
  const [parsedBackup, setParsedBackup] = useState<FullBackupPayload | null>(null);
  const [importFileName, setImportFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const totalTabsCount = Object.values(workspaceDetailsMap).reduce(
    (acc, curr) => acc + (curr.tabs?.length || 0),
    0
  );

  // Handle Full Export
  const handleDownloadFullBackup = async () => {
    try {
      setLoading(true);
      setStatusMsg(null);

      // 1. Get complete workspaces with groups & tabs from SQLite via Tauri IPC
      let backupData: FullBackupPayload;
      try {
        backupData = await invoke<FullBackupPayload>("export_full_backup");
      } catch (ipcErr) {
        console.warn("Tauri IPC export_full_backup not available, falling back to state:", ipcErr);
        // Fallback using loaded state
        const fallbackWorkspaces: FullBackupWorkspace[] = workspaces.map((ws) => {
          const det = workspaceDetailsMap[ws.id] || { workspace: ws, groups: [], tabs: [] };
          return {
            workspace: ws,
            groups: det.groups || [],
            tabs: det.tabs || [],
          };
        });

        backupData = {
          app: "WORKSPACE-X",
          version: "2.0.0",
          exported_at: new Date().toISOString(),
          workspaces: fallbackWorkspaces,
        };
      }

      // 2. Gather localStorage extra data (Checklist, Notes, Operator)
      const checklistRaw = localStorage.getItem("workspace_hub_shift_checklist");
      const handoverRaw = localStorage.getItem("workspace_hub_handover_notes");
      const operatorRaw = localStorage.getItem("workspace_hub_operator_name");
      const browserRaw = localStorage.getItem("workspace_hub_browser_pref");

      let parsedChecklist: any[] = [];
      if (checklistRaw) {
        try {
          parsedChecklist = JSON.parse(checklistRaw);
        } catch {}
      }

      backupData.extra_data = {
        shift_checklist: parsedChecklist,
        handover_notes: handoverRaw || "",
        operator_name: operatorRaw || "Agent Shift",
        browser_pref: browserRaw || "Google Chrome",
      };

      // 3. Trigger JSON file download
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `workspace-x-full-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: "success",
        text: `Cadangan berhasil diunduh (${backupData.workspaces.length} Workspace, ${totalTabsCount} Tab)! Simpan file ini di flashdisk atau cloud untuk dipulihkan di PC baru.`,
      });
    } catch (err: any) {
      console.error("Export error:", err);
      setStatusMsg({
        type: "error",
        text: `Gagal mengekspor data: ${err?.message || err}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Open Database Folder in Windows Explorer
  const handleOpenDatabaseFolder = async () => {
    try {
      const path = await invoke<string>("open_database_folder");
      setStatusMsg({
        type: "info",
        text: `Membuka folder database di Windows Explorer: ${path}`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: `Gagal membuka folder: ${err?.message || err}`,
      });
    }
  };

  // Handle File Selection for Restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatusMsg(null);
      setImportFileName(file.name);
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Verify format (Full backup vs Single workspace)
      if (parsed.workspaces && Array.isArray(parsed.workspaces)) {
        // Full Backup schema
        setParsedBackup(parsed);
      } else if (parsed.workspace && parsed.tabs) {
        // Single workspace schema: convert to full backup payload for unified handling
        setParsedBackup({
          app: "WORKSPACE-X",
          version: "1.0.0",
          exported_at: new Date().toISOString(),
          workspaces: [
            {
              workspace: parsed.workspace,
              groups: parsed.groups || [],
              tabs: parsed.tabs || [],
            },
          ],
        });
      } else {
        throw new Error("Format file JSON tidak dikenali sebagai cadangan WORKSPACE-X yang valid.");
      }
    } catch (err: any) {
      setParsedBackup(null);
      setImportFileName("");
      setStatusMsg({
        type: "error",
        text: `Gagal membaca file: ${err?.message || "Format JSON tidak valid"}`,
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    try {
      setLoading(true);
      setStatusMsg(null);

      // Call Rust backend to import with SQLite transaction
      try {
        await invoke("import_full_backup", {
          backupData: parsedBackup,
          mode: restoreMode,
        });
      } catch (ipcErr: any) {
        console.warn("Tauri IPC import_full_backup error or running in dev fallback:", ipcErr);
        throw new Error(`Gagal memulihkan database SQLite: ${ipcErr}`);
      }

      // Restore extra data if present
      if (parsedBackup.extra_data) {
        if (parsedBackup.extra_data.shift_checklist) {
          localStorage.setItem(
            "workspace_hub_shift_checklist",
            JSON.stringify(parsedBackup.extra_data.shift_checklist)
          );
        }
        if (parsedBackup.extra_data.handover_notes) {
          localStorage.setItem(
            "workspace_hub_handover_notes",
            parsedBackup.extra_data.handover_notes
          );
        }
        if (parsedBackup.extra_data.operator_name) {
          localStorage.setItem(
            "workspace_hub_operator_name",
            parsedBackup.extra_data.operator_name
          );
        }
        if (parsedBackup.extra_data.browser_pref) {
          localStorage.setItem(
            "workspace_hub_browser_pref",
            parsedBackup.extra_data.browser_pref
          );
        }
      }

      // Refresh workspaces in App.tsx
      onSuccess();

      const totalImportedTabs = parsedBackup.workspaces.reduce(
        (acc, curr) => acc + (curr.tabs?.length || 0),
        0
      );

      setStatusMsg({
        type: "success",
        text: `Pemulihan selesai! Sebanyak ${parsedBackup.workspaces.length} Workspace dan ${totalImportedTabs} Tab berhasil dimuat. Data Anda sudah aktif dan siap digunakan!`,
      });

      // Clear preview after success
      setParsedBackup(null);
      setImportFileName("");
    } catch (err: any) {
      console.error("Restore error:", err);
      setStatusMsg({
        type: "error",
        text: `Gagal memulihkan cadangan: ${err?.message || err}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-large"
        style={{ width: "680px", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="modal-icon-badge" style={{ background: "rgba(99, 102, 241, 0.15)", borderColor: "rgba(99, 102, 241, 0.3)" }}>
              <Database size={20} color="#818CF8" />
            </div>
            <div>
              <h2 className="modal-title">Pencadangan & Migrasi Data Antar PC</h2>
              <p className="modal-subtitle">
                Ekspor seluruh data kerja Anda ke file JSON atau pulihkan di PC baru dalam 1 klik.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: "flex",
            background: "rgba(15, 23, 42, 0.6)",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid var(--border-color)",
            marginBottom: "20px",
            gap: "6px",
          }}
        >
          <button
            onClick={() => {
              setActiveTab("export");
              setStatusMsg(null);
            }}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "export" ? "#2563EB" : "transparent",
              color: activeTab === "export" ? "white" : "#94A3B8",
              fontWeight: 600,
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <HardDriveDownload size={16} />
            <span>1. Ekspor Cadangan (Pindah ke PC Lain)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("import");
              setStatusMsg(null);
            }}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "import" ? "#10B981" : "transparent",
              color: activeTab === "import" ? "white" : "#94A3B8",
              fontWeight: 600,
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <HardDriveUpload size={16} />
            <span>2. Impor & Pulihkan (Di PC Baru)</span>
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMsg && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "16px",
              background:
                statusMsg.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : statusMsg.type === "error"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(59, 130, 246, 0.15)",
              border:
                statusMsg.type === "success"
                  ? "1px solid rgba(16, 185, 129, 0.4)"
                  : statusMsg.type === "error"
                  ? "1px solid rgba(239, 68, 68, 0.4)"
                  : "1px solid rgba(59, 130, 246, 0.4)",
              color:
                statusMsg.type === "success"
                  ? "#A7F3D0"
                  : statusMsg.type === "error"
                  ? "#FCA5A5"
                  : "#BFDBFE",
            }}
          >
            {statusMsg.type === "success" && <Check size={18} style={{ flexShrink: 0, marginTop: "2px" }} />}
            {statusMsg.type === "error" && <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />}
            {statusMsg.type === "info" && <Info size={18} style={{ flexShrink: 0, marginTop: "2px" }} />}
            <span style={{ lineHeight: 1.5 }}>{statusMsg.text}</span>
          </div>
        )}

        {/* TAB 1: EKSPOR CADANGAN */}
        {activeTab === "export" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto" }}>
            {/* Overview Card */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles size={20} color="#F59E0B" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#F8FAFC" }}>
                  Ringkasan Data Siap Dipindahkan
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                <div style={{ background: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94A3B8", fontSize: "0.75rem", marginBottom: "4px" }}>
                    <Layers size={14} color="#818CF8" />
                    <span>Workspace</span>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "white" }}>
                    {workspaces.length}
                  </div>
                </div>

                <div style={{ background: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94A3B8", fontSize: "0.75rem", marginBottom: "4px" }}>
                    <Globe size={14} color="#34D399" />
                    <span>Tab Terdaftar</span>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "white" }}>
                    {totalTabsCount}
                  </div>
                </div>

                <div style={{ background: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94A3B8", fontSize: "0.75rem", marginBottom: "4px" }}>
                    <CheckSquare size={14} color="#06B6D4" />
                    <span>Checklist & Notes</span>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "white" }}>
                    Aktif
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "0.83rem", color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
                File cadangan akan memaketkan seluruh daftar workspace, tautan URL, status pin, grup tab, checklist shift SOP, catatan operan, dan preferensi Anda menjadi satu file <code>.json</code> tunggal.
              </p>

              <button
                onClick={handleDownloadFullBackup}
                disabled={loading}
                style={{
                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                  border: "none",
                  padding: "12px 20px",
                  borderRadius: "10px",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  cursor: "pointer",
                  boxShadow: "0 6px 16px rgba(37, 99, 235, 0.35)",
                  transition: "all 0.2s ease",
                }}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <Download size={18} />}
                <span>Download Cadangan Lengkap (.json)</span>
              </button>
            </div>

            {/* Direct Database Location Card */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.4)",
                border: "1px dashed var(--border-color)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#E2E8F0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FolderOpen size={16} color="#6366F1" />
                  <span>Folder Database Langsung (SQLite)</span>
                </div>
                <div style={{ color: "#64748B", fontSize: "0.78rem", marginTop: "4px" }}>
                  Tersimpan di: <code>%APPDATA%\WorkspaceHub\workspace_hub.db</code>
                </div>
              </div>

              <button
                className="btn-secondary"
                onClick={handleOpenDatabaseFolder}
                style={{ fontSize: "0.82rem", padding: "8px 14px" }}
              >
                <FolderOpen size={14} />
                <span>Buka di Explorer</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IMPOR & PULIHKAN */}
        {activeTab === "import" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto" }}>
            {/* Upload Dropzone */}
            {!parsedBackup ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #3B82F6",
                  background: "rgba(59, 130, 246, 0.05)",
                  borderRadius: "14px",
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "rgba(59, 130, 246, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#60A5FA",
                  }}
                >
                  <Upload size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#F8FAFC", marginBottom: "4px" }}>
                    Klik untuk Memilih File Cadangan (.json)
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#94A3B8" }}>
                    Pilih file <code>workspace-x-full-backup-*.json</code> yang telah diekspor dari PC lama Anda.
                  </div>
                </div>
              </div>
            ) : (
              /* Preview of Loaded Backup */
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.7)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "12px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span
                      style={{
                        background: "rgba(16, 185, 129, 0.2)",
                        color: "#34D399",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      File Terverifikasi
                    </span>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "6px 0 2px 0", color: "#F8FAFC" }}>
                      {importFileName}
                    </h3>
                    <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                      Tanggal Cadangan: {new Date(parsedBackup.exported_at).toLocaleString("id-ID")} • Versi {parsedBackup.version}
                    </div>
                  </div>

                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setParsedBackup(null);
                      setImportFileName("");
                    }}
                    style={{ fontSize: "0.78rem", padding: "6px 10px" }}
                  >
                    Ganti File
                  </button>
                </div>

                {/* List of Workspaces in Backup */}
                <div>
                  <label style={{ fontSize: "0.8rem", color: "#94A3B8", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                    Daftar Workspace di dalam File ({parsedBackup.workspaces.length}):
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
                    {parsedBackup.workspaces.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#0F172A",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: item.workspace.color || "#6366F1",
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "white" }}>
                            {item.workspace.name}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                          {item.groups?.length || 0} Grup • {item.tabs?.length || 0} Tab
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extra Data Summary */}
                {parsedBackup.extra_data && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.75rem", color: "#94A3B8" }}>
                    {parsedBackup.extra_data.shift_checklist && (
                      <span style={{ background: "rgba(255, 255, 255, 0.05)", padding: "4px 8px", borderRadius: "4px" }}>
                        ✓ {parsedBackup.extra_data.shift_checklist.length} Item SOP Checklist
                      </span>
                    )}
                    {parsedBackup.extra_data.operator_name && (
                      <span style={{ background: "rgba(255, 255, 255, 0.05)", padding: "4px 8px", borderRadius: "4px" }}>
                        👤 Operator: {parsedBackup.extra_data.operator_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Mode Selection */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                  <label style={{ fontSize: "0.82rem", color: "#E2E8F0", fontWeight: 700, display: "block", marginBottom: "8px" }}>
                    Pilih Metode Pemulihan Data:
                  </label>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        background: restoreMode === "replace" ? "rgba(37, 99, 235, 0.15)" : "#0F172A",
                        border: restoreMode === "replace" ? "1px solid #3B82F6" : "1px solid var(--border-color)",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="replace"
                        checked={restoreMode === "replace"}
                        onChange={() => setRestoreMode("replace")}
                        style={{ marginTop: "3px" }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "white" }}>
                          [Disarankan] Timpa Bersih (Clean Restore)
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "2px" }}>
                          Menghapus workspace contoh bawaan PC baru dan menggantinya 100% dengan seluruh data dari PC lama Anda.
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        background: restoreMode === "merge" ? "rgba(37, 99, 235, 0.15)" : "#0F172A",
                        border: restoreMode === "merge" ? "1px solid #3B82F6" : "1px solid var(--border-color)",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === "merge"}
                        onChange={() => setRestoreMode("merge")}
                        style={{ marginTop: "3px" }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "white" }}>
                          Gabungkan (Merge Mode)
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "2px" }}>
                          Mempertahankan data yang saat ini sudah ada di komputer ini dan menambahkan workspace dari file cadangan.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleExecuteRestore}
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: "10px",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    cursor: "pointer",
                    boxShadow: "0 6px 16px rgba(16, 185, 129, 0.35)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {loading ? <RefreshCw size={18} className="spin" /> : <Check size={18} />}
                  <span>Pulihkan Seluruh Data Sekarang</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="modal-footer" style={{ marginTop: "16px", paddingTop: "14px" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            WORKSPACE-X • SQLite Database Sync & Backup Engine v2.0
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ fontSize: "0.85rem" }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
