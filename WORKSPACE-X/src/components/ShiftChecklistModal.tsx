import { useState, useEffect } from "react";
import { CheckSquare, X, Check, RotateCcw, Plus, Trash2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ChecklistItem {
  id: string;
  category: "pre" | "post";
  text: string;
  checked: boolean;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    id: "pre-1",
    category: "pre",
    text: "Cek koneksi internet stabil & headset/peralatan kerja siap",
    checked: false,
  },
  {
    id: "pre-2",
    category: "pre",
    text: "Buka Opera/Chrome & pastikan Bridge Status terhubung (Ready)",
    checked: false,
  },
  {
    id: "pre-3",
    category: "pre",
    text: "Login ke Google Workspace dengan akun kerja resmi shift Anda",
    checked: false,
  },
  {
    id: "pre-4",
    category: "pre",
    text: "Buka antrian tiket & pastikan status LiveChat / WhatsApp aktif",
    checked: false,
  },
  {
    id: "post-1",
    category: "post",
    text: "Pastikan seluruh percakapan/tiket pelanggan telah tersimpan rapi",
    checked: false,
  },
  {
    id: "post-2",
    category: "post",
    text: "Salin ringkasan operan di Catatan Handover untuk shift berikutnya",
    checked: false,
  },
  {
    id: "post-3",
    category: "post",
    text: "Klik tombol END WORK untuk menutup otomatis seluruh tab kerja",
    checked: false,
  },
  {
    id: "post-4",
    category: "post",
    text: "Pastikan akun Google sudah logout sepenuhnya di komputer ini",
    checked: false,
  },
];

export default function ShiftChecklistModal({ isOpen, onClose }: Props) {
  const STORAGE_KEY = "workspace_hub_shift_checklist";
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<"pre" | "post">("pre");

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch {
          setItems(DEFAULT_ITEMS);
        }
      }
    }
  }, [isOpen]);

  const saveItems = (updated: ChecklistItem[]) => {
    setItems(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleItem = (id: string) => {
    const updated = items.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it));
    saveItems(updated);
  };

  const resetAll = () => {
    const updated = items.map((it) => ({ ...it, checked: false }));
    saveItems(updated);
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    const newItem: ChecklistItem = {
      id: "custom-" + Date.now(),
      category: newCategory,
      text: newText.trim(),
      checked: false,
    };
    saveItems([...items, newItem]);
    setNewText("");
  };

  const deleteItem = (id: string) => {
    saveItems(items.filter((it) => it.id !== id));
  };

  if (!isOpen) return null;

  const preItems = items.filter((i) => i.category === "pre");
  const postItems = items.filter((i) => i.category === "post");
  const totalChecked = items.filter((i) => i.checked).length;
  const progressPercent = Math.round((totalChecked / items.length) * 100) || 0;

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="modal-icon-badge">
              <CheckSquare size={20} color="#10B981" />
            </div>
            <div>
              <h3 className="modal-title">SOP Shift Checklist (Daftar Periksa)</h3>
              <p className="modal-subtitle">
                Prosedur standar sebelum mulai dan sebelum mengakhiri shift di komputer bersama.
              </p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
            <span style={{ color: "#94A3B8" }}>Progres Kesiapan Shift:</span>
            <span style={{ fontWeight: 600, color: progressPercent === 100 ? "#10B981" : "#F8FAFC" }}>
              {totalChecked} dari {items.length} Selesai ({progressPercent}%)
            </span>
          </div>
          <div className="checklist-progress-track">
            <div
              className="checklist-progress-fill"
              style={{ width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? "#10B981" : "#6366F1" }}
            />
          </div>
        </div>

        <div className="checklist-scroll-area">
          {/* Pre-flight Section */}
          <div className="checklist-section">
            <h4 className="checklist-section-title">
              <span>🛫 Pra-Shift (Sebelum Bekerja)</span>
              <span className="checklist-count">
                {preItems.filter((i) => i.checked).length}/{preItems.length}
              </span>
            </h4>
            <div className="checklist-list">
              {preItems.map((item) => (
                <div key={item.id} className={`checklist-item ${item.checked ? "checked" : ""}`}>
                  <label className="checklist-label">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.id)}
                      className="checklist-checkbox"
                    />
                    <span className="checklist-text">{item.text}</span>
                  </label>
                  {item.id.startsWith("custom-") && (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => deleteItem(item.id)}
                      title="Hapus checklist ini"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Post-flight Section */}
          <div className="checklist-section" style={{ marginTop: "16px" }}>
            <h4 className="checklist-section-title">
              <span>🛬 Pasca-Shift (Sebelum Pulang)</span>
              <span className="checklist-count">
                {postItems.filter((i) => i.checked).length}/{postItems.length}
              </span>
            </h4>
            <div className="checklist-list">
              {postItems.map((item) => (
                <div key={item.id} className={`checklist-item ${item.checked ? "checked" : ""}`}>
                  <label className="checklist-label">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.id)}
                      className="checklist-checkbox"
                    />
                    <span className="checklist-text">{item.text}</span>
                  </label>
                  {item.id.startsWith("custom-") && (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => deleteItem(item.id)}
                      title="Hapus checklist ini"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add custom checklist item */}
          <form onSubmit={addItem} className="checklist-add-form">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as "pre" | "post")}
              className="checklist-category-select"
            >
              <option value="pre">Pra-Shift</option>
              <option value="post">Pasca-Shift</option>
            </select>
            <input
              type="text"
              placeholder="Tambah butir SOP khusus tim Anda..."
              className="text-input"
              style={{ flex: 1 }}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <button type="submit" className="btn-secondary" style={{ padding: "8px 14px" }}>
              <Plus size={15} />
              <span>Tambah</span>
            </button>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={resetAll} title="Reset semua checklist">
            <RotateCcw size={15} />
            <span>Reset Semua Cek</span>
          </button>
          <button className="btn-primary" onClick={onClose}>
            <Check size={16} />
            <span>Selesai</span>
          </button>
        </div>
      </div>
    </div>
  );
}
