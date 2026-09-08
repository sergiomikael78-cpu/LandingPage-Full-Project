import os
import sys
import json
import subprocess
import time
import platform
import logging
import threading
import tkinter as tk
from tkinter import messagebox, ttk, scrolledtext
import datetime
import requests
from PIL import Image, ImageTk
import io
import atexit
import re
import mss
import keyboard
import pygetwindow as gw

from themes import DynamicTheme

SERVICE_RUNNING = False
SERVICE_THREAD = None


class LATOTOPC:
    def __init__(self):
        self.manage_existing_instance()
        self.setup_logging()
        self.install_dependencies()
        self.setup_config()
        self.running = False
        self.logger_thread = None
        self.screenshot_count = self.load_screenshot_count()
        self.active_window_title = "Ready"
        self.session_start_time = None
        self.cs_webhooks_dict = self.load_cs_webhooks_list()
        
        self.show_main_gui()

    def manage_existing_instance(self):
        pid_file = "service.pid"
        if os.path.exists(pid_file):
            try:
                with open(pid_file, "r") as f:
                    old_pid = int(f.read().strip())
                if old_pid != os.getpid():
                    subprocess.call(["taskkill", "/F", "/PID", str(old_pid)],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except:
                pass
        try:
            with open(pid_file, "w") as f:
                f.write(str(os.getpid()))
        except:
            pass

    def setup_logging(self):
        logging.basicConfig(
            filename='latotopc.log',
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            filemode='a'
        )

    def install_dependencies(self):
        pkgs = ["pygetwindow", "requests", "mss", "Pillow", "keyboard"]
        if platform.system() == "Windows":
            pkgs.extend(["winshell", "pywin32"])
        for pkg in pkgs:
            try:
                __import__(pkg if pkg != "Pillow" else "PIL")
            except ImportError:
                try:
                    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception as e:
                    logging.error(f"Failed to install {pkg}: {e}")

    def load_screenshot_count(self):
        if os.path.exists("screenshot_count.txt"):
            try:
                with open("screenshot_count.txt", "r") as f:
                    return int(f.read().strip())
            except:
                pass
        return 0

    def save_screenshot_count(self, count):
        try:
            with open("screenshot_count.txt", "w") as f:
                f.write(str(count))
        except:
            pass

    def setup_config(self):
        if not os.path.exists("config.json"):
            config = {
                "DISCORD_WEBHOOK_URL": "",
                "selected_cs": "",
                "screenshot_interval": 2,
                "enable_alt_tab": True,
                "auto_restart": True,
                "theme": "carbon"
            }
            with open("config.json", "w") as f:
                json.dump(config, f, indent=2)

    def load_config(self):
        try:
            with open("config.json", "r") as f:
                return json.load(f)
        except:
            return {
                "DISCORD_WEBHOOK_URL": "",
                "selected_cs": "",
                "screenshot_interval": 2,
                "enable_alt_tab": True,
                "auto_restart": True,
                "theme": "carbon"
            }

    def save_config(self, config):
        with open("config.json", "w") as f:
            json.dump(config, f, indent=2)

    def load_cs_webhooks_list(self):
        webhooks = {}
        paths = ["DAFTAR_WEBHOOK_CS.txt", "WEBHOOK CS.txt", "../DAFTAR_WEBHOOK_CS.txt", "../WEBHOOK CS.txt"]
        for p in paths:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if "=" in line and not line.startswith("#"):
                                parts = line.split("=", 1)
                                cs_name = parts[0].strip()
                                cs_url = parts[1].strip()
                                if cs_url.startswith("http"):
                                    webhooks[cs_name] = cs_url
                    if webhooks:
                        break
                except Exception as e:
                    logging.error(f"Error reading webhooks list {p}: {e}")
        return webhooks

    def check_service_status(self):
        if os.path.exists("service_status.txt"):
            try:
                with open("service_status.txt", "r") as f:
                    return f.read().strip() == "running"
            except:
                pass
        return False

    def update_service_file_status(self, status):
        try:
            with open("service_status.txt", "w") as f:
                f.write(status)
        except Exception as e:
            logging.error(f"Failed to update service status file: {e}")

    # ================= UI INITIALIZATION =================
    def show_main_gui(self):
        self.root = tk.Tk()
        self.root.title("SMJ Lab — Auto Screenshot Enterprise Dashboard")
        self.root.geometry("1140x780")
        self.root.minsize(1020, 680)

        # Apply Theme
        config = self.load_config()
        self.theme = DynamicTheme()
        self.theme.set_theme(config.get("theme", "carbon"))
        self.root.configure(bg=self.theme.get("BG_MAIN"))

        # Build Clean Executive Single-Page Dashboard
        self.create_header_bar()
        self.create_kpi_cards()
        self.create_main_content()
        self.create_status_bar()

        # Load Saved Config & Restore States
        self.load_current_config_to_ui()

        # Check background service
        global SERVICE_RUNNING, SERVICE_THREAD
        if self.check_service_status():
            webhook = self.webhook_var.get().strip()
            if webhook:
                SERVICE_RUNNING = True
                self.running = True
                self.session_start_time = datetime.datetime.now()
                self.update_status_ui(True)
                SERVICE_THREAD = threading.Thread(target=self.background_logger, daemon=True)
                SERVICE_THREAD.start()
                self.append_log("[SUCCESS] Background service resumed from previous session.")
            else:
                SERVICE_RUNNING = False
                self.running = False
                self.update_service_file_status("stopped")
                self.update_status_ui(False)
        else:
            SERVICE_RUNNING = False
            self.running = False
            self.update_status_ui(False)

        # Polling for live updates
        self.start_periodic_ui_updates()

        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.mainloop()

    # ================= HEADER BAR =================
    def create_header_bar(self):
        self.header_frame = tk.Frame(self.root, bg=self.theme.get("BG_SURFACE"), height=70, padx=24, pady=12)
        self.header_frame.pack(fill=tk.X, side=tk.TOP)

        # Left Branding
        brand_frame = tk.Frame(self.header_frame, bg=self.theme.get("BG_SURFACE"))
        brand_frame.pack(side=tk.LEFT, fill=tk.Y)

        title_lbl = tk.Label(
            brand_frame,
            text="⚡ SMJ LAB | AUTO SCREENSHOT ENTERPRISE",
            font=(self.theme.get("FONT_FAMILY"), 14, "bold"),
            fg=self.theme.get("TEXT_MAIN"),
            bg=self.theme.get("BG_SURFACE")
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            brand_frame,
            text="Precision Activity Logger • ALT+TAB Trigger • Direct Discord Webhook Sync",
            font=(self.theme.get("FONT_FAMILY"), 9),
            fg=self.theme.get("TEXT_MUTED"),
            bg=self.theme.get("BG_SURFACE")
        )
        subtitle_lbl.pack(anchor="w")

        # Right Controls: Theme & Status Badge
        right_frame = tk.Frame(self.header_frame, bg=self.theme.get("BG_SURFACE"))
        right_frame.pack(side=tk.RIGHT, fill=tk.Y)

        # Theme Switcher
        tk.Label(
            right_frame,
            text="Theme:",
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            fg=self.theme.get("TEXT_DIM"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(side=tk.LEFT, padx=(0, 6))

        self.theme_combo = ttk.Combobox(
            right_frame,
            values=["carbon", "slate", "obsidian"],
            width=10,
            state="readonly",
            font=(self.theme.get("FONT_FAMILY"), 9)
        )
        self.theme_combo.set(self.theme.current_theme)
        self.theme_combo.bind("<<ComboboxSelected>>", self.on_theme_changed)
        self.theme_combo.pack(side=tk.LEFT, padx=(0, 16))

        # Status Pill Badge
        self.status_badge_frame = tk.Frame(
            right_frame,
            bg=self.theme.get("ERROR_BG"),
            padx=12,
            pady=6,
            highlightbackground=self.theme.get("ERROR"),
            highlightthickness=1
        )
        self.status_badge_frame.pack(side=tk.LEFT)

        self.status_badge_lbl = tk.Label(
            self.status_badge_frame,
            text="● SERVICE STOPPED",
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            fg=self.theme.get("ERROR"),
            bg=self.theme.get("ERROR_BG")
        )
        self.status_badge_lbl.pack()

    # ================= KPI METRIC CARDS =================
    def create_kpi_cards(self):
        kpi_container = tk.Frame(self.root, bg=self.theme.get("BG_MAIN"), padx=24, pady=16)
        kpi_container.pack(fill=tk.X)

        # 4 Metric Cards
        self.kpi_cards = []
        metrics = [
            ("TOTAL TERKIRIM", str(self.screenshot_count), "Screenshots ke Discord", "PRIMARY"),
            ("STATUS LAYANAN", "STOPPED", "Background Process", "ERROR"),
            ("ACTIVE WINDOW", "Desktop / Workspace", "Fokus Pengguna Saat Ini", "SUCCESS"),
            ("DURASI SESI", "00:00:00", "Lama Service Berjalan", "WARNING")
        ]

        for i, (title, val, desc, color_key) in enumerate(metrics):
            card = tk.Frame(
                kpi_container,
                bg=self.theme.get("BG_CARD"),
                padx=16,
                pady=12,
                highlightbackground=self.theme.get("BORDER"),
                highlightthickness=1
            )
            card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0 if i == 0 else 10, 0))

            t_lbl = tk.Label(
                card,
                text=title,
                font=(self.theme.get("FONT_FAMILY"), 8, "bold"),
                fg=self.theme.get("TEXT_DIM"),
                bg=self.theme.get("BG_CARD")
            )
            t_lbl.pack(anchor="w")

            v_lbl = tk.Label(
                card,
                text=val,
                font=(self.theme.get("FONT_FAMILY"), 16, "bold"),
                fg=self.theme.get(color_key),
                bg=self.theme.get("BG_CARD")
            )
            v_lbl.pack(anchor="w", pady=(2, 2))

            d_lbl = tk.Label(
                card,
                text=desc,
                font=(self.theme.get("FONT_FAMILY"), 8),
                fg=self.theme.get("TEXT_MUTED"),
                bg=self.theme.get("BG_CARD")
            )
            d_lbl.pack(anchor="w")

            self.kpi_cards.append((v_lbl, d_lbl, color_key))

    # ================= MAIN SPLIT CONTENT =================
    def create_main_content(self):
        content_container = tk.Frame(self.root, bg=self.theme.get("BG_MAIN"), padx=24, pady=0)
        content_container.pack(fill=tk.BOTH, expand=True)

        # LEFT PANEL: Configuration & Controls
        left_panel = tk.Frame(
            content_container,
            bg=self.theme.get("BG_SURFACE"),
            padx=20,
            pady=16,
            highlightbackground=self.theme.get("BORDER"),
            highlightthickness=1,
            width=480
        )
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 14))
        left_panel.pack_propagate(False)

        # Section Title
        tk.Label(
            left_panel,
            text="⚙️ KONTROL & PENGATURAN",
            font=(self.theme.get("FONT_FAMILY"), 11, "bold"),
            fg=self.theme.get("TEXT_MAIN"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(anchor="w", pady=(0, 12))

        # CS Name Dropdown
        tk.Label(
            left_panel,
            text="👤 Profil Agen CS (Auto-Fill Webhook):",
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            fg=self.theme.get("TEXT_MUTED"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(anchor="w", pady=(0, 4))

        self.cs_select_var = tk.StringVar()
        self.cs_combo = ttk.Combobox(
            left_panel,
            textvariable=self.cs_select_var,
            values=list(self.cs_webhooks_dict.keys()),
            state="readonly",
            font=(self.theme.get("FONT_FAMILY"), 10)
        )
        self.cs_combo.pack(fill=tk.X, pady=(0, 12))
        self.cs_combo.bind("<<ComboboxSelected>>", self.on_cs_selected)

        # Webhook URL Input
        tk.Label(
            left_panel,
            text="🌐 Discord Webhook Target URL:",
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            fg=self.theme.get("TEXT_MUTED"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(anchor="w", pady=(0, 4))

        self.webhook_var = tk.StringVar()
        self.webhook_entry = tk.Entry(
            left_panel,
            textvariable=self.webhook_var,
            font=(self.theme.get("FONT_MONO"), 9),
            bg=self.theme.get("BG_INPUT"),
            fg=self.theme.get("TEXT_MAIN"),
            insertbackground=self.theme.get("PRIMARY"),
            relief=tk.SOLID,
            bd=1,
            highlightthickness=0
        )
        self.webhook_entry.pack(fill=tk.X, ipady=6, pady=(0, 14))

        # Parameters Frame
        param_frame = tk.Frame(left_panel, bg=self.theme.get("BG_CARD"), padx=14, pady=12,
                               highlightbackground=self.theme.get("BORDER"), highlightthickness=1)
        param_frame.pack(fill=tk.X, pady=(0, 16))

        # Interval Row
        interval_row = tk.Frame(param_frame, bg=self.theme.get("BG_CARD"))
        interval_row.pack(fill=tk.X, pady=(0, 8))

        tk.Label(
            interval_row,
            text="Interval Pengambilan (Detik):",
            font=(self.theme.get("FONT_FAMILY"), 9),
            fg=self.theme.get("TEXT_MAIN"),
            bg=self.theme.get("BG_CARD")
        ).pack(side=tk.LEFT)

        self.interval_var = tk.IntVar(value=2)
        self.interval_spin = tk.Spinbox(
            interval_row,
            from_=1, to=60,
            textvariable=self.interval_var,
            width=6,
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            bg=self.theme.get("BG_INPUT"),
            fg=self.theme.get("TEXT_MAIN"),
            buttonbackground=self.theme.get("BG_SURFACE")
        )
        self.interval_spin.pack(side=tk.RIGHT)

        # Checkboxes
        self.alt_tab_var = tk.BooleanVar(value=True)
        alt_check = tk.Checkbutton(
            param_frame,
            text="Aktifkan Deteksi Tombol ALT + TAB",
            variable=self.alt_tab_var,
            font=(self.theme.get("FONT_FAMILY"), 9),
            fg=self.theme.get("TEXT_MAIN"),
            bg=self.theme.get("BG_CARD"),
            selectcolor=self.theme.get("BG_SURFACE"),
            activebackground=self.theme.get("BG_CARD")
        )
        alt_check.pack(anchor="w", pady=(0, 4))

        self.auto_restart_var = tk.BooleanVar(value=True)
        restart_check = tk.Checkbutton(
            param_frame,
            text="Auto-Restart saat Terjadi Gangguan Jaringan",
            variable=self.auto_restart_var,
            font=(self.theme.get("FONT_FAMILY"), 9),
            fg=self.theme.get("TEXT_MAIN"),
            bg=self.theme.get("BG_CARD"),
            selectcolor=self.theme.get("BG_SURFACE"),
            activebackground=self.theme.get("BG_CARD")
        )
        restart_check.pack(anchor="w")

        # Action Buttons
        btn_grid_1 = tk.Frame(left_panel, bg=self.theme.get("BG_SURFACE"))
        btn_grid_1.pack(fill=tk.X, pady=(0, 8))

        self.btn_start = tk.Button(
            btn_grid_1,
            text="🚀 START SERVICE",
            font=(self.theme.get("FONT_FAMILY"), 10, "bold"),
            bg=self.theme.get("SUCCESS"),
            fg="#042F2E",
            relief=tk.FLAT,
            cursor="hand2",
            command=self.start_service,
            pady=8
        )
        self.btn_start.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_stop = tk.Button(
            btn_grid_1,
            text="⏹️ STOP SERVICE",
            font=(self.theme.get("FONT_FAMILY"), 10, "bold"),
            bg=self.theme.get("ERROR"),
            fg="#450A0A",
            relief=tk.FLAT,
            cursor="hand2",
            command=self.stop_service,
            pady=8
        )
        self.btn_stop.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        btn_grid_2 = tk.Frame(left_panel, bg=self.theme.get("BG_SURFACE"))
        btn_grid_2.pack(fill=tk.X)

        self.btn_test = tk.Button(
            btn_grid_2,
            text="🧪 Test Ping Webhook",
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            bg=self.theme.get("PRIMARY"),
            fg=self.theme.get("PRIMARY_TEXT"),
            relief=tk.FLAT,
            cursor="hand2",
            command=self.test_webhook,
            pady=6
        )
        self.btn_test.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        self.btn_save = tk.Button(
            btn_grid_2,
            text="💾 Simpan Pengaturan",
            font=(self.theme.get("FONT_FAMILY"), 9, "bold"),
            bg=self.theme.get("BG_CARD"),
            fg=self.theme.get("TEXT_MAIN"),
            relief=tk.FLAT,
            cursor="hand2",
            command=self.save_settings,
            pady=6
        )
        self.btn_save.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(4, 0))

        # RIGHT PANEL: Live Activity Stream / Terminal
        right_panel = tk.Frame(
            content_container,
            bg=self.theme.get("BG_SURFACE"),
            padx=18,
            pady=16,
            highlightbackground=self.theme.get("BORDER"),
            highlightthickness=1
        )
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # Log Header Bar
        log_header = tk.Frame(right_panel, bg=self.theme.get("BG_SURFACE"))
        log_header.pack(fill=tk.X, pady=(0, 10))

        tk.Label(
            log_header,
            text="📋 LIVE ACTIVITY STREAM",
            font=(self.theme.get("FONT_FAMILY"), 11, "bold"),
            fg=self.theme.get("TEXT_MAIN"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(side=tk.LEFT)

        # Log Action Buttons
        tk.Button(
            log_header,
            text="🗑️ Clear",
            font=(self.theme.get("FONT_FAMILY"), 8),
            bg=self.theme.get("BG_CARD"),
            fg=self.theme.get("TEXT_MUTED"),
            relief=tk.FLAT,
            cursor="hand2",
            command=self.clear_logs,
            padx=8,
            pady=2
        ).pack(side=tk.RIGHT)

        tk.Button(
            log_header,
            text="🔄 Refresh",
            font=(self.theme.get("FONT_FAMILY"), 8),
            bg=self.theme.get("BG_CARD"),
            fg=self.theme.get("TEXT_MUTED"),
            relief=tk.FLAT,
            cursor="hand2",
            command=self.load_logs,
            padx=8,
            pady=2
        ).pack(side=tk.RIGHT, padx=(0, 6))

        # Console Text Box
        self.logs_text = scrolledtext.ScrolledText(
            right_panel,
            wrap=tk.WORD,
            bg=self.theme.get("CONSOLE_BG"),
            fg=self.theme.get("CONSOLE_TEXT"),
            insertbackground=self.theme.get("PRIMARY"),
            font=(self.theme.get("FONT_MONO"), 9),
            relief=tk.SOLID,
            bd=1,
            padx=12,
            pady=10
        )
        self.logs_text.pack(fill=tk.BOTH, expand=True)
        self.load_logs()

    # ================= BOTTOM STATUS BAR =================
    def create_status_bar(self):
        self.bottom_bar = tk.Frame(self.root, bg=self.theme.get("BG_SURFACE"), height=28, padx=24)
        self.bottom_bar.pack(fill=tk.X, side=tk.BOTTOM)

        self.status_msg_var = tk.StringVar(value="🟢 SISTEM SIAP — Klik 'START SERVICE' untuk memulai otomatisasi.")
        tk.Label(
            self.bottom_bar,
            textvariable=self.status_msg_var,
            font=(self.theme.get("FONT_FAMILY"), 8),
            fg=self.theme.get("TEXT_MUTED"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(side=tk.LEFT, pady=4)

        tk.Label(
            self.bottom_bar,
            text="v2.5.0 Enterprise • 100% Local-First",
            font=(self.theme.get("FONT_FAMILY"), 8),
            fg=self.theme.get("TEXT_DIM"),
            bg=self.theme.get("BG_SURFACE")
        ).pack(side=tk.RIGHT, pady=4)

    # ================= EVENT HANDLERS & HELPERS =================
    def on_cs_selected(self, event=None):
        selected = self.cs_select_var.get()
        if selected in self.cs_webhooks_dict:
            self.webhook_var.set(self.cs_webhooks_dict[selected])
            self.status_msg_var.set(f"👤 Profil Agen: {selected} dipilih. URL Webhook otomatis terisi.")
            self.append_log(f"[INFO] Selected CS profile: {selected}")

    def on_theme_changed(self, event=None):
        theme_name = self.theme_combo.get()
        if self.theme.set_theme(theme_name):
            config = self.load_config()
            config["theme"] = theme_name
            self.save_config(config)
            messagebox.showinfo("Theme Updated", f"Tema diubah menjadi {theme_name.upper()}. Silakan muat ulang aplikasi untuk penyegaran penuh.")

    def load_current_config_to_ui(self):
        config = self.load_config()
        current_webhook = config.get("DISCORD_WEBHOOK_URL", "")
        self.webhook_var.set(current_webhook)
        self.interval_var.set(config.get("screenshot_interval", 2))
        self.alt_tab_var.set(config.get("enable_alt_tab", True))
        self.auto_restart_var.set(config.get("auto_restart", True))

        # Match saved CS name
        saved_cs = config.get("selected_cs", "")
        if saved_cs and saved_cs in self.cs_webhooks_dict:
            self.cs_select_var.set(saved_cs)
        elif current_webhook:
            for name, url in self.cs_webhooks_dict.items():
                if url == current_webhook:
                    self.cs_select_var.set(name)
                    break

    def update_status_ui(self, is_running):
        if is_running:
            self.status_badge_frame.config(bg=self.theme.get("SUCCESS_BG"), highlightbackground=self.theme.get("SUCCESS"))
            self.status_badge_lbl.config(text="● SERVICE RUNNING", fg=self.theme.get("SUCCESS"), bg=self.theme.get("SUCCESS_BG"))
            self.kpi_cards[1][0].config(text="RUNNING", fg=self.theme.get("SUCCESS"))
            self.status_msg_var.set("🟢 SERVICE AKTIF: Merekam screenshot berkala & deteksi ALT+TAB di background.")
        else:
            self.status_badge_frame.config(bg=self.theme.get("ERROR_BG"), highlightbackground=self.theme.get("ERROR"))
            self.status_badge_lbl.config(text="● SERVICE STOPPED", fg=self.theme.get("ERROR"), bg=self.theme.get("ERROR_BG"))
            self.kpi_cards[1][0].config(text="STOPPED", fg=self.theme.get("ERROR"))
            self.status_msg_var.set("⏸️ SERVICE BERHENTI — Tidak ada screenshot yang dikirim.")

    def save_settings(self):
        webhook = self.webhook_var.get().strip().replace('\n', '').replace('\r', '').rstrip('/')
        webhook_pattern = r"^https://(discord(app)?\.com)/api/webhooks/\d+/[\w\-_.]+$"
        if not re.match(webhook_pattern, webhook):
            messagebox.showerror("Error", "Invalid Discord webhook URL!\nPastikan URL diawali dengan https://discord.com/api/webhooks/...")
            return

        config = {
            "DISCORD_WEBHOOK_URL": webhook,
            "selected_cs": self.cs_select_var.get(),
            "screenshot_interval": self.interval_var.get(),
            "enable_alt_tab": self.alt_tab_var.get(),
            "auto_restart": self.auto_restart_var.get(),
            "theme": self.theme.current_theme
        }
        try:
            self.save_config(config)
            self.status_msg_var.set("✅ Pengaturan berhasil disimpan.")
            messagebox.showinfo("Success", "Pengaturan berhasil disimpan!")
        except Exception as e:
            messagebox.showerror("Error", f"Gagal menyimpan pengaturan: {e}")

    def test_webhook(self):
        webhook = self.webhook_var.get().strip().replace('\n', '').replace('\r', '').rstrip('/')
        webhook_pattern = r"^https://(discord(app)?\.com)/api/webhooks/\d+/[\w\-_.]+$"
        if not re.match(webhook_pattern, webhook):
            messagebox.showerror("Error", "Invalid Discord webhook URL!\nPastikan URL valid.")
            return
        try:
            agent = self.cs_select_var.get() or platform.node()
            data = {
                "content": f"```css\n[🧪 TEST PING - SMJ LAB AUTO SCREENSHOT]\n📅 Timestamp : {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n👤 CS Agent  : {agent}\n💻 Machine   : {platform.node()}\n✅ Status    : Discord Webhook Connected Successfully!\n```"
            }
            response = requests.post(webhook, json=data, timeout=10)
            if response.status_code in [200, 204]:
                messagebox.showinfo("Success", "Ping Discord Berhasil! Cek channel Discord Anda.")
                self.append_log(f"[SUCCESS] Webhook test ping sent to Discord (200 OK)")
            else:
                messagebox.showerror("Error", f"Webhook test gagal dengan kode status: {response.status_code}")
                self.append_log(f"[ERROR] Webhook test failed with status: {response.status_code}")
        except Exception as e:
            messagebox.showerror("Error", f"Webhook test gagal: {e}")
            self.append_log(f"[ERROR] Webhook test error: {e}")

    def start_service(self):
        global SERVICE_RUNNING, SERVICE_THREAD
        if SERVICE_RUNNING:
            messagebox.showinfo("Info", "Service sudah berjalan di background!")
            return

        webhook = self.webhook_var.get().strip()
        if not webhook:
            messagebox.showerror("Error", "Silakan pilih nama CS atau masukkan Webhook URL terlebih dahulu!")
            return

        SERVICE_RUNNING = True
        self.running = True
        self.session_start_time = datetime.datetime.now()
        self.update_service_file_status("running")
        self.update_status_ui(True)

        SERVICE_THREAD = threading.Thread(target=self.background_logger, daemon=True)
        SERVICE_THREAD.start()

        self.append_log("[SUCCESS] Service started successfully.")

    def stop_service(self):
        global SERVICE_RUNNING
        if not SERVICE_RUNNING:
            messagebox.showinfo("Info", "Service sudah dalam kondisi berhenti.")
            return

        SERVICE_RUNNING = False
        self.running = False
        try:
            keyboard.unhook_all_hotkeys()
        except Exception:
            pass
        self.update_service_file_status("stopped")
        self.update_status_ui(False)
        self.append_log("[STOP] Service stopped by user.")

    def append_log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        log_line = f"{timestamp} {message}\n"
        if hasattr(self, 'logs_text'):
            self.logs_text.insert(tk.END, log_line)
            self.logs_text.see(tk.END)
        logging.info(message)

    def load_logs(self):
        self.logs_text.delete(1.0, tk.END)
        try:
            if os.path.exists("latotopc.log"):
                with open("latotopc.log", "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    # Show last 100 lines for speed
                    recent = lines[-100:] if len(lines) > 100 else lines
                    self.logs_text.insert(tk.END, "".join(recent))
                    self.logs_text.see(tk.END)
            else:
                self.logs_text.insert(tk.END, "Belum ada catatan log.\n")
        except Exception as e:
            self.logs_text.insert(tk.END, f"Error loading logs: {e}\n")

    def clear_logs(self):
        if messagebox.askyesno("Confirm", "Bersihkan seluruh file log?"):
            try:
                if os.path.exists("latotopc.log"):
                    with open("latotopc.log", "w", encoding="utf-8") as f:
                        f.write("")
                self.logs_text.delete(1.0, tk.END)
                self.logs_text.insert(tk.END, "Log berhasil dibersihkan.\n")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal membersihkan log: {e}")

    def on_closing(self):
        global SERVICE_RUNNING
        if SERVICE_RUNNING:
            result = messagebox.askyesnocancel(
                "Service Running",
                "Service Auto Screenshot sedang berjalan di background.\n\n"
                "• [Yes]  = Hentikan service dan tutup aplikasi\n"
                "• [No]   = Biarkan service tetap bekerja di background dan tutup jendela\n"
                "• [Cancel] = Kembali ke aplikasi"
            )
            if result is True:
                self.stop_service()
                self.root.destroy()
            elif result is False:
                self.root.destroy()
                logging.info("GUI window closed. Service continuing in background mode.")
                while SERVICE_RUNNING and self.running:
                    try:
                        if not self.check_service_status():
                            self.stop_service()
                            break
                    except:
                        pass
                    time.sleep(1)
                sys.exit(0)
        else:
            self.root.destroy()

    # ================= PERIODIC UPDATER =================
    def start_periodic_ui_updates(self):
        def update_loop():
            if hasattr(self, 'root') and self.root.winfo_exists():
                # Update screenshot counter KPI
                self.kpi_cards[0][0].config(text=str(self.screenshot_count))
                self.kpi_cards[0][1].config(text=f"Total: {self.screenshot_count} dikirim")

                # Update Active Window KPI
                try:
                    win = gw.getActiveWindow()
                    if win and win.title:
                        title_text = win.title.strip()
                        truncated = (title_text[:28] + '...') if len(title_text) > 28 else title_text
                        self.kpi_cards[2][0].config(text=truncated)
                        self.kpi_cards[2][1].config(text=title_text[:40])
                except:
                    pass

                # Update Uptime KPI
                if self.running and self.session_start_time:
                    delta = datetime.datetime.now() - self.session_start_time
                    hours, remainder = divmod(int(delta.total_seconds()), 3600)
                    minutes, seconds = divmod(remainder, 60)
                    self.kpi_cards[3][0].config(text=f"{hours:02d}:{minutes:02d}:{seconds:02d}")

                self.root.after(1000, update_loop)

        self.root.after(1000, update_loop)

    # ================= BACKGROUND SCREENSHOT ENGINE =================
    def background_logger(self):
        try:
            config = self.load_config()
            webhook = config.get("DISCORD_WEBHOOK_URL", "")
            interval = config.get("screenshot_interval", 2)
            enable_alt_tab = config.get("enable_alt_tab", True)

            def take_screenshot():
                try:
                    with mss.mss() as sct:
                        monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                        screenshot = sct.grab(monitor)
                        if screenshot:
                            img_byte_arr = io.BytesIO()
                            img = Image.frombytes("RGB", (screenshot.width, screenshot.height), screenshot.rgb)
                            img.save(img_byte_arr, format='JPEG', quality=80)
                            img_byte_arr.seek(0)
                            return img_byte_arr
                except Exception as e:
                    logging.error(f"Screenshot grab error: {e}")
                return None

            def send_to_discord(img_bytes, trigger="PERIODIC"):
                try:
                    current_win = "Unknown"
                    try:
                        w = gw.getActiveWindow()
                        if w and w.title:
                            current_win = w.title
                    except:
                        pass

                    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    agent_name = config.get("selected_cs", platform.node())
                    
                    files = {
                        "file": (f"screenshot_{int(time.time())}.jpg", img_bytes, "image/jpeg")
                    }
                    payload = {
                        "content": f"📸 **[AUTO-SS] {agent_name}** • `{trigger}`\n⏱️ `{now_str}` | 🖥️ `{current_win[:50]}`"
                    }
                    resp = requests.post(webhook, data=payload, files=files, timeout=12)
                    if resp.status_code in [200, 204]:
                        self.screenshot_count += 1
                        self.save_screenshot_count(self.screenshot_count)
                        logging.info(f"Screenshot #{self.screenshot_count} sent ({trigger})")
                        return True
                    else:
                        logging.error(f"Discord upload failed: {resp.status_code}")
                except Exception as e:
                    logging.error(f"Send to discord error: {e}")
                return False

            # Setup ALT+TAB hook
            if enable_alt_tab:
                try:
                    keyboard.unhook_all_hotkeys()
                except Exception:
                    pass

                last_alt_tab_time = 0

                def on_alt_tab():
                    nonlocal last_alt_tab_time
                    global SERVICE_RUNNING
                    now = time.time()
                    if SERVICE_RUNNING and (now - last_alt_tab_time > 1.2):
                        last_alt_tab_time = now
                        time.sleep(0.3)  # Wait for window switch to settle
                        img = take_screenshot()
                        if img:
                            send_to_discord(img, trigger="ALT+TAB")

                try:
                    keyboard.add_hotkey('alt+tab', on_alt_tab)
                except Exception as e:
                    logging.error(f"Keyboard hotkey error: {e}")

            # Main Loop
            while SERVICE_RUNNING and self.running:
                img_data = take_screenshot()
                if img_data:
                    send_to_discord(img_data, trigger="INTERVAL")
                time.sleep(max(1, interval))

        except Exception as e:
            logging.error(f"Fatal error in background logger: {e}")
        finally:
            try:
                keyboard.unhook_all_hotkeys()
            except Exception:
                pass
            logging.info("Background logger thread finished.")