import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, X, Headphones, TrendingUp, Code2, Megaphone, Loader2 } from "lucide-react";
import { getFaviconUrl } from "../utils/favicon";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  color: string;
  groups: {
    name: string;
    color: string;
    tabs: { name: string; url: string; pinned?: boolean }[];
  }[];
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "template-cs",
    name: "CS & Support Night Shift",
    category: "Customer Service",
    description: "Preset lengkap CS: WhatsApp Web, Gmail Helpdesk, Google Sheets Antrian, dan LiveChat.",
    icon: Headphones,
    color: "#10B981",
    groups: [
      {
        name: "GOOGLE HELPDESK",
        color: "blue",
        tabs: [
          { name: "Gmail Helpdesk CS", url: "https://mail.google.com", pinned: true },
          { name: "Spreadsheet Antrian Tiket", url: "https://docs.google.com/spreadsheets", pinned: true },
          { name: "SOP & Knowledge Base Drive", url: "https://drive.google.com" },
        ],
      },
      {
        name: "COMMUNICATION CHANNELS",
        color: "green",
        tabs: [
          { name: "WhatsApp Web CS", url: "https://web.whatsapp.com", pinned: true },
          { name: "Zendesk Support", url: "https://www.zendesk.com" },
          { name: "LiveChat Monitor", url: "https://www.livechat.com" },
        ],
      },
    ],
  },
  {
    id: "template-admin",
    name: "Admin & Finance Operations",
    category: "Administration",
    description: "Lingkungan kerja admin: Pembukuan online, Google Drive nota, sistem faktur pajak & perbankan.",
    icon: TrendingUp,
    color: "#6366F1",
    groups: [
      {
        name: "PEMBUKUAN & DOKUMEN",
        color: "purple",
        tabs: [
          { name: "Spreadsheet Kas Masuk/Keluar", url: "https://docs.google.com/spreadsheets", pinned: true },
          { name: "Google Drive Nota & Invoice", url: "https://drive.google.com" },
          { name: "Online Invoicing Portal", url: "https://invoice.google.com" },
        ],
      },
      {
        name: "BANKING & PAJAK",
        color: "yellow",
        tabs: [
          { name: "Portal Pajak DJP Online", url: "https://djponline.pajak.go.id" },
          { name: "Internet Banking Bisnis", url: "https://ib.klikbca.com" },
        ],
      },
    ],
  },
  {
    id: "template-dev",
    name: "Web Developer & DevOps",
    category: "Engineering",
    description: "Alur kerja developer: GitHub PRs, Localhost server, Jira backlog, dan monitoring dashboard.",
    icon: Code2,
    color: "#EC4899",
    groups: [
      {
        name: "CODE & REPOSITORIES",
        color: "grey",
        tabs: [
          { name: "GitHub Pull Requests", url: "https://github.com", pinned: true },
          { name: "Localhost Dev Server", url: "http://localhost:3000" },
          { name: "Stack Overflow", url: "https://stackoverflow.com" },
        ],
      },
      {
        name: "OPS & TRACKING",
        color: "red",
        tabs: [
          { name: "Jira / Linear Issue Tracker", url: "https://linear.app" },
          { name: "Cloudflare Dashboard", url: "https://dash.cloudflare.com" },
        ],
      },
    ],
  },
  {
    id: "template-marketing",
    name: "Digital Marketing & Socials",
    category: "Marketing",
    description: "Manajemen kampanye digital: Meta Ads, TikTok Creative Center, Canva, dan Google Analytics.",
    icon: Megaphone,
    color: "#F59E0B",
    groups: [
      {
        name: "ADS & SOCIAL CHANNELS",
        color: "orange",
        tabs: [
          { name: "Meta Business Suite", url: "https://business.facebook.com", pinned: true },
          { name: "TikTok Creative Center", url: "https://ads.tiktok.com" },
          { name: "YouTube Creator Studio", url: "https://studio.youtube.com" },
        ],
      },
      {
        name: "CREATIVE & METRICS",
        color: "cyan",
        tabs: [
          { name: "Canva Design Studio", url: "https://www.canva.com" },
          { name: "Google Analytics 4", url: "https://analytics.google.com" },
        ],
      },
    ],
  },
];

export default function TemplatesModal({ isOpen, onClose, onSuccess }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition>(TEMPLATES[0]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyTemplate = async () => {
    try {
      setApplying(true);
      setError(null);

      // 1. Create Workspace
      const createdWs = await invoke<{ id: string }>("create_workspace", {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        color: selectedTemplate.color,
        behaviorMode: "static",
      });

      // 2. Iterate and create groups + tabs
      for (const grp of selectedTemplate.groups) {
        const createdGroup = await invoke<{ id: string }>("add_group", {
          workspaceId: createdWs.id,
          name: grp.name,
          color: grp.color,
        });

        for (const tab of grp.tabs) {
          await invoke("add_tab", {
            workspaceId: createdWs.id,
            groupId: createdGroup.id,
            name: tab.name,
            url: tab.url,
            pinned: tab.pinned || false,
          });
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error applying template:", err);
      // If running in browser preview without tauri IPC:
      setError(
        "Gagal menerapkan template ke database: " +
          (err?.message || err || "Tauri IPC offline")
      );
    } finally {
      setApplying(false);
    }
  };

  const IconComp = selectedTemplate.icon;

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-xl">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="modal-icon-badge">
              <Sparkles size={20} color="#6366F1" />
            </div>
            <div>
              <h3 className="modal-title">Template Hub (Preset Workspace Siap Pakai)</h3>
              <p className="modal-subtitle">
                Pilih template terkurasi untuk langsung mulai bekerja tanpa perlu input tab manual satu per satu.
              </p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-error-box">
            {error}
          </div>
        )}

        <div className="template-grid-layout">
          {/* Left Column: Template Cards List */}
          <div className="template-sidebar-list">
            {TEMPLATES.map((tmpl) => {
              const TIcon = tmpl.icon;
              const isSelected = selectedTemplate.id === tmpl.id;
              return (
                <div
                  key={tmpl.id}
                  className={`template-pick-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedTemplate(tmpl)}
                >
                  <div
                    className="template-card-icon"
                    style={{ backgroundColor: `${tmpl.color}25`, color: tmpl.color }}
                  >
                    <TIcon size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="template-pick-title">{tmpl.name}</span>
                      <span className="template-category-pill">{tmpl.category}</span>
                    </div>
                    <p className="template-pick-desc">{tmpl.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Template Detail Preview */}
          <div className="template-preview-panel">
            <div className="template-preview-header">
              <div
                className="template-preview-icon"
                style={{ backgroundColor: `${selectedTemplate.color}25`, color: selectedTemplate.color }}
              >
                <IconComp size={24} />
              </div>
              <div>
                <h4 className="template-preview-title">{selectedTemplate.name}</h4>
                <p className="template-preview-subtitle">{selectedTemplate.description}</p>
              </div>
            </div>

            <div className="template-groups-container">
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94A3B8", marginBottom: "8px" }}>
                TAB GROUP & SITUS YANG AKAN DIBUAT OTOMATIS:
              </div>

              {selectedTemplate.groups.map((grp, gIdx) => (
                <div key={gIdx} className="template-group-box">
                  <div className="template-group-title-row">
                    <span className="dot-indicator" style={{ backgroundColor: selectedTemplate.color }} />
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{grp.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "#64748B", marginLeft: "auto" }}>
                      {grp.tabs.length} Tabs
                    </span>
                  </div>

                  <div className="template-tab-rows">
                    {grp.tabs.map((tb, tIdx) => (
                      <div key={tIdx} className="template-tab-item">
                        <img
                          src={getFaviconUrl(tb.url)}
                          alt=""
                          className="tab-favicon"
                          onError={(e) => {
                            // Hide broken favicon image
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <span className="tab-item-name">{tb.name}</span>
                        {tb.pinned && <span className="tab-pinned-badge">PINNED</span>}
                        <span className="tab-item-url">{tb.url}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="template-action-row">
              <button
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleApplyTemplate}
                disabled={applying}
              >
                {applying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Membuat Workspace...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Pasang Template Ini ke Workspace Saya</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
