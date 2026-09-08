import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Globe, FolderPlus, Check } from "lucide-react";

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
  onRefresh: () => void;
}

export default function WorkspaceEditor({ selectedWorkspace, onRefresh }: Props) {
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
      triggerSuccess();
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
        name: groupName,
        color: groupColor,
      });
      setGroupName("");
      onRefresh();
      triggerSuccess();
    } catch (err) {
      console.error("Error adding group:", err);
    }
  };

  const handleAddTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace || !tabName.trim() || !tabUrl.trim()) return;

    try {
      await invoke("add_tab", {
        workspaceId: selectedWorkspace.workspace.id,
        groupId: selectedGroupId || null,
        name: tabName,
        url: tabUrl,
        pinned: tabPinned,
      });
      setTabName("");
      setTabUrl("");
      onRefresh();
      triggerSuccess();
    } catch (err) {
      console.error("Error adding tab:", err);
    }
  };

  const handleDeleteTab = async (tabId: string) => {
    try {
      await invoke("delete_tab", { tabId });
      onRefresh();
    } catch (err) {
      console.error("Error deleting tab:", err);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace) return;
    if (confirm(`Hapus workspace "${selectedWorkspace.workspace.name}"?`)) {
      try {
        await invoke("delete_workspace", { workspaceId: selectedWorkspace.workspace.id });
        onRefresh();
      } catch (err) {
        console.error("Error deleting workspace:", err);
      }
    }
  };

  const triggerSuccess = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Create New Workspace Section */}
      <div className="workspace-card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Buat Workspace Baru</h3>
        <form onSubmit={handleCreateWorkspace} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "0.85rem", color: "#94A3B8", marginBottom: "4px", display: "block" }}>Nama Workspace</label>
            <input
              type="text"
              placeholder="Misal: CS NIGHT SHIFT"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "white" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", color: "#94A3B8", marginBottom: "4px", display: "block" }}>Mode Behavior</label>
            <select
              value={newWsMode}
              onChange={(e) => setNewWsMode(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "white" }}
            >
              <option value="static">STATIC WORKSPACE (Konsisten Setiap Launch)</option>
              <option value="remember_last">REMEMBER LAST STATE (Update Otomatis)</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "0.85rem", color: "#94A3B8", marginBottom: "4px", display: "block" }}>Deskripsi Singkat</label>
            <input
              type="text"
              placeholder="Deskripsi tugas atau tools yang digunakan..."
              value={newWsDesc}
              onChange={(e) => setNewWsDesc(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "white" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn-primary" style={{ width: "auto" }}>
              <Plus size={16} />
              <span>Simpan Workspace Baru</span>
            </button>
          </div>
        </form>
      </div>

      {/* Edit Selected Workspace Details */}
      {selectedWorkspace && (
        <div className="workspace-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Mengelola: {selectedWorkspace.workspace.name}</h3>
              <p style={{ fontSize: "0.85rem", color: "#94A3B8" }}>{selectedWorkspace.workspace.description}</p>
            </div>

            <button className="btn-danger" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={handleDeleteWorkspace}>
              <Trash2 size={14} />
              <span>Hapus Workspace</span>
            </button>
          </div>

          {/* Add Group & Add Tab Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            {/* Add Group Form */}
            <form onSubmit={handleAddGroup} style={{ background: "rgba(15, 23, 42, 0.5)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderPlus size={16} color="#3B82F6" />
                <span>Tambah Tab Group</span>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="text"
                  placeholder="Nama Group (misal: GOOGLE TOOLS)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "0.85rem" }}
                />
                <select
                  value={groupColor}
                  onChange={(e) => setGroupColor(e.target.value)}
                  style={{ padding: "8px 12px", background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "0.85rem" }}
                >
                  <option value="blue">Biru</option>
                  <option value="green">Hijau</option>
                  <option value="red">Merah</option>
                  <option value="purple">Ungu</option>
                  <option value="orange">Oranye</option>
                </select>
              </div>
              <button type="submit" className="btn-secondary" style={{ width: "100%", fontSize: "0.85rem" }}>
                + Tambah Group
              </button>
            </form>

            {/* Add Tab Form */}
            <form onSubmit={handleAddTab} style={{ background: "rgba(15, 23, 42, 0.5)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={16} color="#10B981" />
                <span>Tambah Tab URL</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="text"
                  placeholder="Nama Tab (misal: Gmail CS)"
                  value={tabName}
                  onChange={(e) => setTabName(e.target.value)}
                  style={{ padding: "8px 12px", background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "0.85rem" }}
                />
                <input
                  type="url"
                  placeholder="URL (misal: https://mail.google.com)"
                  value={tabUrl}
                  onChange={(e) => setTabUrl(e.target.value)}
                  style={{ padding: "8px 12px", background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "0.85rem" }}
                />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={{ padding: "8px 12px", background: "#0F172A", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "0.85rem" }}
                >
                  <option value="">Tanpa Group (Flat Tab)</option>
                  {selectedWorkspace.groups.map((g) => (
                    <option key={g.id} value={g.id}>Group: {g.name}</option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94A3B8", cursor: "pointer", marginTop: "4px" }}>
                  <input
                    type="checkbox"
                    checked={tabPinned}
                    onChange={(e) => setTabPinned(e.target.checked)}
                  />
                  <span>Pin Tab ini di browser</span>
                </label>
              </div>
              <button type="submit" className="btn-secondary" style={{ width: "100%", fontSize: "0.85rem" }}>
                + Tambah Tab URL
              </button>
            </form>
          </div>

          {/* List of Existing Tabs */}
          <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px" }}>Daftar Tab Terdaftar ({selectedWorkspace.tabs.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedWorkspace.tabs.map((tab) => {
              const matchingGroup = selectedWorkspace.groups.find((g) => g.id === tab.group_id);
              return (
                <div key={tab.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0F172A", padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Globe size={16} color="#94A3B8" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{tab.name}</div>
                      <div style={{ color: "#64748B", fontSize: "0.75rem" }}>{tab.url}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {matchingGroup && (
                      <span className="tag-badge" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60A5FA" }}>
                        {matchingGroup.name}
                      </span>
                    )}
                    <button style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }} onClick={() => handleDeleteTab(tab.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savedSuccess && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "#10B981", color: "white", padding: "12px 20px", borderRadius: "8px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)" }}>
          <Check size={18} />
          <span>Workspace berhasil diperbarui!</span>
        </div>
      )}
    </div>
  );
}
