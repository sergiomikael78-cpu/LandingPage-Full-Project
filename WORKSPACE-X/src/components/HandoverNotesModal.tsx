import { useState, useEffect } from "react";
import { FileText, Copy, Check, Trash2, X, PlusCircle, Bookmark } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspaceName?: string;
}

export default function HandoverNotesModal({ isOpen, onClose, activeWorkspaceName }: Props) {
  const STORAGE_KEY = "workspace_hub_handover_notes";
  const [notes, setNotes] = useState("");
  const [operatorName, setOperatorName] = useState("Agent Shift");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setNotes(saved);
      }
      const savedOp = localStorage.getItem("workspace_hub_operator_name");
      if (savedOp) {
        setOperatorName(savedOp);
      }
    }
  }, [isOpen]);

  const handleSave = (val: string) => {
    setNotes(val);
    localStorage.setItem(STORAGE_KEY, val);
  };

  const handleSaveOp = (name: string) => {
    setOperatorName(name);
    localStorage.setItem("workspace_hub_operator_name", name);
  };

  const insertSnippet = (snippet: string) => {
    const updated = notes ? `${notes}\n${snippet}` : snippet;
    handleSave(updated);
  };

  const copyToClipboard = () => {
    const formatted = `📋 CATATAN OPERAN SHIFT (HANDOVER NOTE)\n` +
      `📅 Tanggal: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
      `⏰ Waktu: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
      `👤 Operator: ${operatorName}\n` +
      `💼 Workspace: ${activeWorkspaceName || "General Workspace"}\n` +
      `---------------------------------------------\n` +
      `${notes || "(Tidak ada catatan khusus)"}\n` +
      `---------------------------------------------\n` +
      `✨ Disusun otomatis via WORKSPACE-X (Local-First)`;

    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const clearNotes = () => {
    if (confirm("Kosongkan catatan operan shift ini?")) {
      handleSave("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="modal-icon-badge">
              <FileText size={20} color="#06B6D4" />
            </div>
            <div>
              <h3 className="modal-title">Buku Catatan Operan Shift (Handover)</h3>
              <p className="modal-subtitle">
                Catat memo penting untuk rekan kerja shift berikutnya di komputer ini.
              </p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="handover-meta-row">
          <div style={{ flex: 1 }}>
            <label className="input-label">Nama Operator / Petugas</label>
            <input
              type="text"
              className="text-input"
              value={operatorName}
              onChange={(e) => handleSaveOp(e.target.value)}
              placeholder="Contoh: Dinda (CS Shift Malam)"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="input-label">Workspace Aktif</label>
            <input
              type="text"
              className="text-input"
              disabled
              value={activeWorkspaceName || "Tidak ada sesi aktif"}
              style={{ opacity: 0.7 }}
            />
          </div>
        </div>

        {/* Quick Snippets */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "0.8rem", color: "#94A3B8", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Bookmark size={13} />
            <span>Sisipkan Catatan Cepat (Quick Snippets):</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="snippet-pill"
              onClick={() => insertSnippet("✅ [STATUS AMAN] Semua antrian tiket shift ini selesai diproses tanpa pending.")}
            >
              <PlusCircle size={12} /> Status Aman
            </button>
            <button
              type="button"
              className="snippet-pill"
              onClick={() => insertSnippet("⚠️ [PERHATIAN] Ada tiket komplain prioritas yang perlu dicek oleh shift pagi.")}
            >
              <PlusCircle size={12} /> Ada Kasus Pending
            </button>
            <button
              type="button"
              className="snippet-pill"
              onClick={() => insertSnippet("🔄 [SISTEM] Akun CS cadangan sudah di-logout, silakan gunakan akun utama.")}
            >
              <PlusCircle size={12} /> Info Akun/Sesi
            </button>
          </div>
        </div>

        {/* Text Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: "16px" }}>
          <textarea
            className="text-area-input"
            rows={7}
            placeholder="Tuliskan catatan, nomor order/tiket, atau pesan penting untuk shift berikutnya di sini..."
            value={notes}
            onChange={(e) => handleSave(e.target.value)}
          />
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={clearNotes} title="Bersihkan teks">
            <Trash2 size={16} />
            <span>Reset</span>
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-secondary" onClick={onClose}>
              Tutup
            </button>
            <button className="btn-primary" onClick={copyToClipboard}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? "Tersalin ke Clipboard!" : "Salin Format Handover"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
