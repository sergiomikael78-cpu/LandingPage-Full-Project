import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, RefreshCw, Database, Chrome, Check, Power } from "lucide-react";
interface Props {
  isExtensionConnected: boolean;
  onRefreshHealth: () => void;
}

export default function SettingsView({ isExtensionConnected, onRefreshHealth }: Props) {
  const [browserPref, setBrowserPref] = useState("Google Chrome");
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveSettings = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleLaunchChrome = async () => {
    try {
      await invoke<string>("launch_browser_bridge");
      // alert("Mencoba load extension dari: " + pathUsed);
    } catch (e) {
      alert("Gagal membuka Chrome: " + e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Browser & Extension Connection Settings */}
      <div className="workspace-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Chrome size={20} color="#3B82F6" />
            <span>Pengaturan Browser & Extension Bridge</span>
          </h3>
          <button 
            onClick={handleLaunchChrome}
            style={{ 
              background: "linear-gradient(135deg, #3B82F6, #2563EB)", 
              border: "none", 
              padding: "8px 16px", 
              borderRadius: "8px", 
              color: "white", 
              fontWeight: 600, 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}
          >
            <Power size={16} />
            <span>Auto-Inject Extension ke Chrome</span>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "0.85rem", color: "#94A3B8", marginBottom: "6px", display: "block" }}>Target Browser Utama</label>
            <select
              value={browserPref}
              onChange={(e) => setBrowserPref(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "white" }}
            >
              <option value="Google Chrome">Google Chrome (Default)</option>
              <option value="Opera">Opera (Chromium Base)</option>
            </select>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`status-dot ${isExtensionConnected ? "connected" : "disconnected"}`} />
                <span>Status Koneksi Browser Bridge: {isExtensionConnected ? "Terhubung (Ready)" : "Terputus (Disconnected)"}</span>
              </div>
              <div style={{ color: "#94A3B8", fontSize: "0.8rem", marginTop: "4px" }}>
                WebSocket Local Server: ws://127.0.0.1:9001/ws
              </div>
            </div>

            <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }} onClick={onRefreshHealth}>
              <RefreshCw size={14} />
              <span>Cek Ulang Koneksi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security & Data Storage */}
      <div className="workspace-card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <Shield size={20} color="#10B981" />
          <span>Prinsip Keamanan & Penyimpanan Lokal</span>
        </h3>

        <div style={{ fontSize: "0.9rem", color: "#94A3B8", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "14px", borderRadius: "8px", color: "#A7F3D0" }}>
            <strong>Zero Credential Storage:</strong> Aplikasi tidak pernah membaca, menyimpan, atau mengubah password dan cookie Google Anda.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Database size={16} color="#6366F1" />
            <span>Database Lokal: <code>workspace_hub.db</code> (SQLite)</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-primary" style={{ width: "auto" }} onClick={handleSaveSettings}>
          <Check size={16} />
          <span>Simpan Preferensi</span>
        </button>
      </div>

      {savedNotice && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "#10B981", color: "white", padding: "12px 20px", borderRadius: "8px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={18} />
          <span>Pengaturan disimpan!</span>
        </div>
      )}
    </div>
  );
}
