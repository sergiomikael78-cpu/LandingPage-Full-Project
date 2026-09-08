# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['latotopc_modern.py'],
    pathex=[],
    binaries=[],
    datas=[('config.json', '.')],
    hiddenimports=[
        'PIL._tkinter_finder',
        'keyboard',
        'mss',
        'pygetwindow',
        'requests',
        'tkinter',
        'tkinter.ttk',
        'tkinter.scrolledtext',
        'tkinter.messagebox',
        'tkinter.font'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='LATOTOPC_Modern',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
