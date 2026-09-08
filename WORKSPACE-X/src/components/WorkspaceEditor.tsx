import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Globe, FolderPlus, Check, Pin, Sparkles, AlertCircle } from "lucide-react";
import { getFaviconUrl } from "../utils/favicon";

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
  workspace: {
    id: string;
    name: string;
    description?: string;
    behavior_mode: string;
  };
  groups: WorkspaceGroup[];
  tabs: WorkspaceTab[];
}

interface Props {
  selectedWorkspace: WorkspaceDetails | null;
  allWorkspaces?: { id: string; name: string }[];
  onSelectWorkspaceId?: (id: string) => void;
  onRefresh: () => void;
}

const COLOR_OPTIONS = [
  { name: "Biru", value: "blue", hex: "#3B82F6" },
  { name: "Hijau", value: "green", hex: "#10B981" },
  { name: "Ungu", value: "purple", hex: "#8B5CF6" },
  { name: "Merah", value: "red", hex: "#EF4444" },
  { name: "Oranye", value: "orange", hex: "#F97316" },
  { name: "Kuning", value: "yellow", hex: "#F59E0B" },
  { name: "Cyan", value: "cyan", hex: "#06B6D4" },
  { name: "Pink", value: "pink", hex: "#EC4899" },
];

export default function WorkspaceEditor({
  selectedWorkspace,
  allWorkspaces,
  onSelectWorkspaceId,
  onRefresh,
}: Props) {
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [newWsMode, setNewWsMode] = useState("static");

  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("blue");

  const [tabName, setTabName] = useState("");
  const [tabUrl, setTabUrl] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [tabPinned, setTabPinned] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState("Berhasil disimpan!");

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      await invoke("create_workspace", {
        name: newWsName,
        description: newWsDesc || null,
        color: "#6366F1",
        behaviorMode: newWsMode,
      });
      setNewWsName("");
      setNewWsDesc("");
      onRefresh();
      showToast(`Workspace "${newWsName}" berhasil dibuat!`);
    } catch (err) {
      console.error("Error creating workspace:", err);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace || !groupName.trim()) return;

    try {
      await invoke("add_group", {
        workspaceId: selectedWorkspace.workspace.id,
        name: groupName.trim(),
        color: groupColor,
      });
      setGroupName("");
      onRefresh();
      showToast(`Tab Group "${groupName}" berhasil ditambahkan!`);
    } catch (err) {
      console.error("Error adding group:", err);
    }
  };

  const handleAddTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace || !tabName.trim() || !tabUrl.trim()) return;

    let finalUrl = tabUrl.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    try {
      await invoke("add_tab", {
        workspaceId: selectedWorkspace.workspace.id,
        groupId: selectedGroupId || null,
        name: tabName.trim(),
        url: finalUrl,
        pinned: tabPinned,
      });
      setTabName("");
      setTabUrl("");
      setTabPinned(false);
      onRefresh();
      showToast(`Tab "${tabName}" berhasil ditambahkan!`);
    } catch (err) {
      console.error("Error adding tab:", err);
    }
  };

  const handleDeleteTab = async (tabId: string, tabName: string) => {
    try {
      await invoke("delete_tab", { tabId });
      onRefresh();
      showToast(`Tab "${tabName}" dihapus.`);
    } catch (err) {
      console.error("Error deleting tab:", err);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace) return;
    if (confirm(`Hapus workspace "${selectedWorkspace.workspace.name}" beserta semua grup dan tab di dalamnya?`)) {
      try {
        await invoke("delete_workspace", { workspaceId: selectedWorkspace.workspace.id });
        onRefresh();
        showToast(`Workspace "${selectedWorkspace.workspace.name}" telah dihapus.`);
      } catch (err) {
        console.error("Error deleting workspace:", err);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const previewFavicon = tabUrl ? getFaviconUrl(tabUrl) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Workspace Switcher Bar if multiple workspaces exist */}
      {allWorkspaces && allWorkspaces.length > 0 && (
        <div className="workspace-card" style={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Sparkles size={18} color="#6366F1" />
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Pilih Workspace yang Sedang Diedit:</span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {allWorkspaces.map((ws) => {
                const isCurrent = selectedWorkspace?.workspace.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    className={`btn-pill-switch ${isCurrent ? "active" : ""}`}
                    onClick={() => onSelectWorkspaceId?.(ws.id)}
                  >
                    {ws.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Selected Workspace Details */}
      {selectedWorkspace ? (
        <div className="workspace-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Mengelola: {selectedWorkspace.workspace.name}</h3>
                <span className="tag-badge">
                  {selectedWorkspace.workspace.behavior_mode.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#94A3B8", marginTop: "4px" }}>
                {selectedWorkspace.workspace.description || "Tidak ada deskripsi"}
              </p>
            </div>

            <button className="btn-danger" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={handleDeleteWorkspace}>
              <Trash2 size={14} />
              <span>Hapus Workspace</span>
            </button>
          </div>

          {/* Add Group & Add Tab Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
            {/* Add Group Form */}
            <form onSubmit={handleAddGroup} className="editor-sub-card">
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderPlus size={18} color="#3B82F6" />
                <span>Tambah Tab Group Baru</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "14px" }}>
                <input
                  type="text"
                  placeholder="Nama Group (misal: GOOGLE TOOLS)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="text-input"
                />

                {/* Color Swatches */}
                <div>
                  <label className="input-label">Pilih Aksen Warna Tab Group:</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => setGroupColor(c.value)}
                        className={`color-swatch-btn ${groupColor === c.value ? "selected" : ""}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {groupColor === c.value && <Check size={12} color="#FFFFFF" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-secondary" style={{ width: "100%", fontSize: "0.85rem", justifyContent: "center" }}>
                <Plus size={15} />
                <span>Tambah Tab Group</span>
              </button>
            </form>

            {/* Add Tab Form */}
            <form onSubmit={handleAddTab} className="editor-sub-card">
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={18} color="#10B981" />
                <span>Tambah Tab URL</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                <input
                  type="text"
                  placeholder="Label / Nama Tab (misal: Gmail CS)"
                  value={tabName}
                  onChange={(e) => setTabName(e.target.value)}
                  className="text-input"
                />

                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="URL (misal: mail.google.com)"
                    value={tabUrl}
                    onChange={(e) => setTabUrl(e.target.value)}
                    className="text-input"
                    style={{ paddingLeft: previewFavicon ? "36px" : "12px" }}
                  />
                  {previewFavicon && (
                    <img
                      src={previewFavicon}
                      alt=""
                      style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", borderRadius: "3px" }}
                      onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                    />
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="text-input"
                    style={{ flex: 1 }}
                  >
                    <option value="">Tanpa Group (Tab Mandiri)</option>
                    {selectedWorkspace.groups.map((g) => (
                      <option key={g.id} value={g.id}>Group: {g.name}</option>
                    ))}
                  </select>

                  <label className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={tabPinned}
                      onChange={(e) => setTabPinned(e.target.checked)}
                    />
                    <Pin size={13} />
                    <span>Pin Tab</span>
                  </label>
                </div>
              </div>
              <button type="submit" className="btn-secondary" style={{ width: "100%", fontSize: "0.85rem", justifyContent: "center" }}>
                <Plus size={15} />
                <span>Tambah Tab ke Workspace</span>
              </button>
            </form>
          </div>

          {/* List of Existing Groups & Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              Struktur Tab Terdaftar ({selectedWorkspace.tabs.length} Tabs dalam {selectedWorkspace.groups.length} Groups)
            </h4>
          </div>

          {selectedWorkspace.tabs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", background: "rgba(15, 23, 42, 0.4)", borderRadius: "12px", border: "1px dashed var(--border-color)", color: "#94A3B8" }}>
              <AlertCircle size={24} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
              <p>Belum ada tab di workspace ini. Silakan gunakan form di atas untuk menambahkan tab pertama Anda.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selectedWorkspace.tabs.map((tab) => {
                const matchingGroup = selectedWorkspace.groups.find((g) => g.id === tab.group_id);
                return (
                  <div key={tab.id} className="editor-tab-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, overflow: "hidden" }}>
                      <img
                        src={getFaviconUrl(tab.url)}
                        alt=""
                        className="tab-favicon"
                        onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                      />
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>{tab.name}</span>
                          {tab.pinned && (
                            <span className="tab-pinned-badge">
                              <Pin size={10} /> PINNED
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#64748B", fontSize: "0.75rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {tab.url}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {matchingGroup ? (
                        <span className="group-badge-tag" style={{ borderLeftColor: matchingGroup.color }}>
                          {matchingGroup.name}
                        </span>
                      ) : (
                        <span className="tag-badge">Tanpa Group</span>
                      )}
                      <button
                        className="btn-icon-danger"
                        title="Hapus tab ini"
                        onClick={() => handleDeleteTab(tab.id, tab.name)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Create New Workspace Section */}
      <div className="workspace-card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={18} color="#6366F1" />
          <span>Buat Workspace Baru Dari Awal</span>
        </h3>
        <form onSubmit={handleCreateWorkspace} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label className="input-label">Nama Workspace</label>
            <input
              type="text"
              placeholder="Misal: CS NIGHT SHIFT"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              className="text-input"
            />
          </div>

          <div>
            <label className="input-label">Mode Behavior</label>
            <select
              value={newWsMode}
              onChange={(e) => setNewWsMode(e.target.value)}
              className="text-input"
            >
              <option value="static">STATIC WORKSPACE (Konsisten Setiap Launch)</option>
              <option value="remember_last">REMEMBER LAST STATE (Update Otomatis)</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="input-label">Deskripsi Singkat</label>
            <input
              type="text"
              placeholder="Deskripsi tugas atau tools yang digunakan..."
              value={newWsDesc}
              onChange={(e) => setNewWsDesc(e.target.value)}
              className="text-input"
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn-primary" style={{ width: "auto" }}>
              <Plus size={16} />
              <span>Simpan & Buka Workspace Baru</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toast notification */}
      {savedSuccess && (
        <div className="toast-notification">
          <Check size={18} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
