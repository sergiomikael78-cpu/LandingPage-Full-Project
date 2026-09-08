import tkinter as tk
from tkinter import ttk
from themes import DynamicTheme

class DynamicStyle(ttk.Style):
    def __init__(self, root):
        super().__init__(root)
        self.root = root
        self.configure_styles()
    def configure_styles(self):
        THEME = DynamicTheme()
        self.theme_use('clam')
        self.configure('.', 
                      background=THEME.get("BG_DARK"), 
                      foreground=THEME.get("TEXT_WHITE"),
                      font=('Segoe UI', 12),
                      borderwidth=0)
        self.configure('TNotebook', background=THEME.get("BG_DARK"))
        self.configure('TNotebook.Tab', 
                      background=THEME.get("BG_MEDIUM"),
                      foreground=THEME.get("TEXT_GRAY"),
                      font=('Segoe UI', 13, 'bold'),
                      padding=[30, 14],
                      borderwidth=0)
        self.map('TNotebook.Tab',
               background=[('selected', THEME.get("BG_LIGHT")), ('active', THEME.get("PRIMARY"))],
               foreground=[('selected', THEME.get("PRIMARY")), ('active', THEME.get("TEXT_WHITE"))],
               lightcolor=[('selected', THEME.get("PRIMARY"))],
               bordercolor=[('selected', THEME.get("PRIMARY"))])
        self.configure('TFrame', background=THEME.get("BG_DARK"))
        self.configure('Card.TFrame', 
                     background=THEME.get("BG_MEDIUM"),
                     relief='flat',
                     borderwidth=2,
                     bordercolor=THEME.get("PRIMARY"))
        self.configure('TLabel', background=THEME.get("BG_DARK"), foreground=THEME.get("TEXT_WHITE"), font=('Segoe UI', 12))
        self.configure('Header.TLabel', 
                     background=THEME.get("BG_DARK"),
                     foreground=THEME.get("PRIMARY"),
                     font=('Segoe UI', 28, 'bold'),
                     padding=12)
        self.configure('SubHeader.TLabel',
                     background=THEME.get("BG_DARK"),
                     foreground=THEME.get("SECONDARY"),
                     font=('Segoe UI', 16),
                     padding=7)
        self.configure('TButton',
                     background=THEME.get("BG_MEDIUM"),
                     foreground=THEME.get("TEXT_WHITE"),
                     font=('Segoe UI', 12, 'bold'),
                     borderwidth=0,
                     padding=12,
                     focuscolor=THEME.get("BG_DARK"))
        self.map('TButton',
                background=[('active', THEME.get("PRIMARY")), ('pressed', THEME.get("BG_LIGHT"))],
                foreground=[('active', THEME.get("BG_DARK")), ('pressed', THEME.get("TEXT_WHITE"))],
                lightcolor=[('active', THEME.get("PRIMARY"))])
        self.configure('Treeview',
                     background=THEME.get("BG_MEDIUM"),
                     fieldbackground=THEME.get("BG_MEDIUM"),
                     foreground=THEME.get("TEXT_WHITE"),
                     borderwidth=0,
                     rowheight=28)
        self.configure('Treeview.Heading',
                     background=THEME.get("PRIMARY"),
                     foreground=THEME.get("BG_DARK"),
                     font=('Segoe UI', 12, 'bold'),
                     borderwidth=0)
        self.map('Treeview',
               background=[('selected', THEME.get("ACCENT"))],
               foreground=[('selected', THEME.get("TEXT_WHITE"))])
        self.configure('TScrollbar',
                     background=THEME.get("BG_MEDIUM"),
                     troughcolor=THEME.get("BG_DARK"),
                     bordercolor=THEME.get("BG_DARK"),
                     arrowcolor=THEME.get("PRIMARY"))
        self.map('TScrollbar',
               background=[('active', THEME.get("PRIMARY"))]) 