import tkinter as tk
from ui.animation import AnimationEngine

class DynamicButton(tk.Canvas):
    def __init__(self, parent, text, command=None, width=140, height=48, **kwargs):
        super().__init__(parent, width=width, height=height, 
                        highlightthickness=0, bd=0, bg=kwargs.get('bg', '#232946'))
        self.command = command
        self.corner_radius = kwargs.get('corner_radius', 16)
        self.fill = kwargs.get('fill', '#ffffff')
        self.outline = kwargs.get('outline', '#ffffff')
        self.text_color = kwargs.get('text_color', '#232946')
        self.hover_fill = kwargs.get('hover_fill', '#4a4e69')
        self.active_fill = kwargs.get('active_fill', '#eebbc3')
        self.font = kwargs.get('font', ('Segoe UI', 12, 'bold'))
        self.animation = kwargs.get('animation', True)
        self.shadow = kwargs.get('shadow', True)
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)
        self.bind("<Button-1>", self.on_press)
        self.bind("<ButtonRelease-1>", self.on_release)
        self.draw_button()
        self.create_text(width/2, height/2, text=text, fill=self.text_color, font=self.font, tags="text")
        if self.animation:
            AnimationEngine(parent).add_pulse_animation(self, "PRIMARY", 0.8, 1.0, speed=0.08)
    def draw_button(self, fill=None):
        self.delete("button")
        fill = fill or self.fill
        if self.shadow:
            self.create_round_rect(4, 4, self.winfo_reqwidth()-2, self.winfo_reqheight()-2, 
                                 radius=self.corner_radius, fill="#222222", outline="", tags="button_shadow")
        self.create_round_rect(0, 0, self.winfo_reqwidth(), self.winfo_reqheight(), 
                             radius=self.corner_radius, fill=fill, outline=self.outline, tags="button")
        self.tag_raise("text")
    def create_round_rect(self, x1, y1, x2, y2, radius=10, **kwargs):
        points = [x1+radius, y1,
                 x1+radius, y1,
                 x2-radius, y1,
                 x2-radius, y1,
                 x2, y1,
                 x2, y1+radius,
                 x2, y1+radius,
                 x2, y2-radius,
                 x2, y2-radius,
                 x2, y2,
                 x2-radius, y2,
                 x2-radius, y2,
                 x1+radius, y2,
                 x1+radius, y2,
                 x1, y2,
                 x1, y2-radius,
                 x1, y2-radius,
                 x1, y1+radius,
                 x1, y1+radius,
                 x1, y1]
        if "tags" not in kwargs:
            kwargs["tags"] = "button"
        return self.create_polygon(points, **kwargs, smooth=True)
    def on_enter(self, event):
        self.draw_button(fill=self.hover_fill)
    def on_leave(self, event):
        self.draw_button()
    def on_press(self, event):
        self.draw_button(fill=self.active_fill)
    def on_release(self, event):
        self.draw_button(fill=self.hover_fill if self.winfo_containing(event.x_root, event.y_root) == self else self.fill)
        if self.command:
            self.command() 