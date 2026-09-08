import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, Globe, Check, AlertCircle } from "lucide-react";

interface BrowserTabState {
  id: number;
  title: string;
  url: string;
  pinned: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportPreviewModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tabs, setTabs] = useState<BrowserTabState[]>([]);
  const [selectedTabUrls, setSelectedTabUrls] = useState<Set<string>>(new Set());
  const [workspaceName, setWorkspaceName] = useState("IMPORTED WORKSPACE");

  useEffect(() => {
    if (isOpen) {
      fetchLiveTabs();
    }
  }, [isOpen]);

  const fetchLiveTabs = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await invoke<{ tabs: BrowserTabState[] }>("fetch_live_browser_state");
      setTabs(data.tabs || []);

      // Default select all valid http/https URLs
      const validUrls = (data.tabs || [])
        .map((t) => t.url)
        .filter((u) => u.startsWith("http"));
      setSelectedTabUrls(new Set(validUrls));
    } catch (err: any) {
      console.warn("Could not fetch live browser state:", err);
      setErrorMsg("Gagal membaca tab Chrome. Pastikan Extension Bridge terhubung!");
    } finally {
      setLoading(false);
    }
  };

  const toggleTabSelection = (url: string) => {
    const next = new Set(selectedTabUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setSelectedTabUrls(next);
  };

  const handleSaveImport = async () => {
    if (!workspaceName.trim() || selectedTabUrls.size === 0) return;

    try {
      setLoading(true);
      // 1. Create workspace
      const newWs = await invoke<{ id: string }>("create_workspace", {
        name: workspaceName,
        description: `Imported dari Chrome pada ${new Date().toLocaleDateString()}`,
        color: "#10B981",
        behaviorMode: "static",
      });

      // 2. Add group
      const defaultGroup = await invoke<{ id: string }>("add_group", {
        workspaceId: newWs.id,
        name: "IMPORTED TABS",
        color: "green",
      });

      // 3. Add tabs
      const selectedTabsList = tabs.filter((t) => selectedTabUrls.has(t.url));
      for (const t of selectedTabsList) {
        await invoke("add_tab", {
          workspaceId: newWs.id,
          groupId: defaultGroup.id,
          name: t.title || t.url,
          url: t.url,
          pinned: t.pinned || false,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan import: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#1E293B", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "16px", padding: "28px", width: "560px", maxWidth: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <Download size={22} color="#10B981" />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Import Current Browser Tabs</h3>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#FCA5A5", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "0.85rem", color: "#94A3B8", marginBottom: "4px", display: "block" }}>Nama Workspace Hasil Import</label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "white" }}
          />
        </div>

        <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#F8FAFC", marginBottom: "8px" }}>
          Pilih Tab Chrome Terbuka ({selectedTabUrls.size}/{tabs.length})
        </h4>

        {loading ? (
          <p style={{ color: "#94A3B8", padding: "24px 0", textAlign: "center" }}>Membaca tab Chrome aktif...</p>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", paddingRight: "4px" }}>
            {tabs.map((tab, idx) => (
              <label key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#0F172A", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedTabUrls.has(tab.url)}
                  onChange={() => toggleTabSelection(tab.url)}
                />
                <Globe size={16} color="#3B82F6" />
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{tab.title || "Tab Tanpa Judul"}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{tab.url}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
          <button className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" style={{ width: "auto" }} onClick={handleSaveImport} disabled={loading || selectedTabUrls.size === 0}>
            <Check size={16} />
            <span>Simpan Workspace</span>
          </button>
        </div>

      </div>
    </div>
  );
}
