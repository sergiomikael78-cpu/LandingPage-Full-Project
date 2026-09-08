from app.core import LATOTOPC
import atexit
import logging
from tkinter import messagebox

import app.core as core_module

def cleanup_on_exit():
    try:
        if getattr(core_module, 'SERVICE_RUNNING', False):
            logging.info("Application exiting but service is still running in background")
    except:
        pass

atexit.register(cleanup_on_exit)

if __name__ == "__main__":
    try:
        app = LATOTOPC()
    except Exception as e:
        logging.error(f"Application error: {e}")
        messagebox.showerror("Error", f"Application error: {e}") 