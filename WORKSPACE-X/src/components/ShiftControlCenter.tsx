import { useState, useEffect } from "react";
import {
  Square,
  Clock,
  Coffee,
  FileText,
  CheckSquare,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  Sparkles,
  RotateCw
} from "lucide-react";

interface Props {
  workspaceName: string;
  startedAt: Date;
  onEndWork: () => void;
  onOpenHandover: () => void;
  onOpenChecklist: () => void;
  onReopenTabs?: () => void;
}

export type ShiftStatus = "active" | "break" | "handover";

export default function ShiftControlCenter({
  workspaceName,
  startedAt,
  onEndWork,
  onOpenHandover,
  onOpenChecklist,
  onReopenTabs,
}: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [status, setStatus] = useState<ShiftStatus>("active");
  const [breakCountdown, setBreakCountdown] = useState(20 * 60); // 20-minute eye relaxation timer

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diffInSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
      setElapsedSeconds(diffInSeconds);

      setBreakCountdown((prev) => (prev > 0 ? prev - 1 : 20 * 60));
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatMinutesSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="shift-control-center">
      {/* Top Banner Info */}
      <div className="shift-main-row">
        <div className="shift-identity">
          <div className={`shift-pulse-ring status-${status}`}>
            {status === "active" && <Sparkles size={22} className="text-emerald-400" />}
            {status === "break" && <Coffee size={22} className="text-amber-400" />}
            {status === "handover" && <FileText size={22} className="text-cyan-400" />}
          </div>
          <div>
            <div className="shift-badge-row">
              <span className={`shift-status-pill status-${status}`}>
                {status === "active" && "🟢 BERTUGAS AKTIF"}
                {status === "break" && "☕ SEDANG ISTIRAHAT"}
                {status === "handover" && "📋 PERSIAPAN HANDOVER"}
              </span>
              <span className="shift-security-pill">
                <ShieldCheck size={13} /> Zero Credential
              </span>
            </div>
            <h3 className="shift-workspace-title">{workspaceName}</h3>
            <p className="shift-subtext">
              Mulai: {startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Sesi lokal aman tanpa simpan cookie
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="shift-stats-group">
          {/* Main Elapsed Timer */}
          <div className="shift-stat-box">
            <div className="stat-label">
              <Clock size={14} />
              <span>DURASI SHIFT</span>
            </div>
            <div className="stat-value font-mono">{formatTime(elapsedSeconds)}</div>
          </div>

          {/* Eye-care / Break Timer */}
          <div className="shift-stat-box eye-care-box">
            <div className="stat-label">
              <Coffee size={14} />
              <span>BREAK MATA (20M)</span>
            </div>
            <div className="stat-value font-mono">{formatMinutesSeconds(breakCountdown)}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="shift-actions">
          {onReopenTabs && (
            <button
              className="btn-shift-secondary"
              onClick={onReopenTabs}
              title="Buka kembali tab workspace jika browser tertutup"
            >
              <RotateCw size={15} />
              <span>Buka Tab Browser</span>
            </button>
          )}

          <button
            className={`btn-shift-toggle ${status === "break" ? "btn-shift-active" : ""}`}
            onClick={() => setStatus(status === "break" ? "active" : "break")}
            title="Ubah status istirahat"
          >
            {status === "break" ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            <span>{status === "break" ? "Lanjut Kerja" : "Istirahat"}</span>
          </button>

          <button className="btn-shift-secondary" onClick={onOpenHandover}>
            <FileText size={16} />
            <span>Operan Shift</span>
          </button>

          <button className="btn-shift-secondary" onClick={onOpenChecklist}>
            <CheckSquare size={16} />
            <span>SOP Checklist</span>
          </button>

          <button className="btn-danger-glow" onClick={onEndWork}>
            <Square size={16} fill="currentColor" />
            <span>END WORK</span>
          </button>
        </div>
      </div>
    </div>
  );
}
