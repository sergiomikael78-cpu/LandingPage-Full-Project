"""
SMJ Lab — Carbon Slate Executive Theme Engine
Clean, high-precision dark theme palettes with zero tacky glare.
"""

class DynamicTheme:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DynamicTheme, cls).__new__(cls)
            cls._instance._init_themes()
        return cls._instance

    def _init_themes(self):
        self.themes = {
            "carbon": {
                "NAME": "Executive Carbon",
                "BG_MAIN": "#0B0E14",
                "BG_SURFACE": "#121824",
                "BG_CARD": "#172030",
                "BG_INPUT": "#0E131D",
                "BORDER": "#222E42",
                "BORDER_FOCUS": "#0284C7",
                "PRIMARY": "#0EA5E9",
                "PRIMARY_HOVER": "#38BDF8",
                "PRIMARY_TEXT": "#082F49",
                "SUCCESS": "#10B981",
                "SUCCESS_BG": "#064E3B",
                "WARNING": "#F59E0B",
                "ERROR": "#EF4444",
                "ERROR_BG": "#7F1D1D",
                "TEXT_MAIN": "#F8FAFC",
                "TEXT_MUTED": "#94A3B8",
                "TEXT_DIM": "#64748B",
                "CONSOLE_BG": "#07090E",
                "CONSOLE_TEXT": "#38BDF8",
                "FONT_FAMILY": "Segoe UI",
                "FONT_MONO": "Consolas"
            },
            "slate": {
                "NAME": "Deep Slate Pro",
                "BG_MAIN": "#0F172A",
                "BG_SURFACE": "#1E293B",
                "BG_CARD": "#273549",
                "BG_INPUT": "#131C2E",
                "BORDER": "#334155",
                "BORDER_FOCUS": "#6366F1",
                "PRIMARY": "#6366F1",
                "PRIMARY_HOVER": "#818CF8",
                "PRIMARY_TEXT": "#FFFFFF",
                "SUCCESS": "#10B981",
                "SUCCESS_BG": "#064E3B",
                "WARNING": "#F59E0B",
                "ERROR": "#F43F5E",
                "ERROR_BG": "#881337",
                "TEXT_MAIN": "#F1F5F9",
                "TEXT_MUTED": "#94A3B8",
                "TEXT_DIM": "#64748B",
                "CONSOLE_BG": "#090D16",
                "CONSOLE_TEXT": "#A5B4FC",
                "FONT_FAMILY": "Segoe UI",
                "FONT_MONO": "Consolas"
            },
            "obsidian": {
                "NAME": "Obsidian Gold",
                "BG_MAIN": "#0D0D0E",
                "BG_SURFACE": "#17181C",
                "BG_CARD": "#202127",
                "BG_INPUT": "#121316",
                "BORDER": "#2C2D35",
                "BORDER_FOCUS": "#D97706",
                "PRIMARY": "#F59E0B",
                "PRIMARY_HOVER": "#FBBF24",
                "PRIMARY_TEXT": "#451A03",
                "SUCCESS": "#10B981",
                "SUCCESS_BG": "#064E3B",
                "WARNING": "#F59E0B",
                "ERROR": "#EF4444",
                "ERROR_BG": "#7F1D1D",
                "TEXT_MAIN": "#F8FAFC",
                "TEXT_MUTED": "#A1A1AA",
                "TEXT_DIM": "#71717A",
                "CONSOLE_BG": "#080809",
                "CONSOLE_TEXT": "#FDE68A",
                "FONT_FAMILY": "Segoe UI",
                "FONT_MONO": "Consolas"
            }
        }
        self.current_theme = "carbon"

    def get(self, key):
        theme_dict = self.themes.get(self.current_theme, self.themes["carbon"])
        return theme_dict.get(key, "#FFFFFF")

    def set_theme(self, theme_name):
        if theme_name in self.themes:
            self.current_theme = theme_name
            return True
        return False