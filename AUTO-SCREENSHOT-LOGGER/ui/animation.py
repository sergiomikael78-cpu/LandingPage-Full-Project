import math
import random
import tkinter as tk
from themes import DynamicTheme

class AnimationEngine:
    def __init__(self, root):
        self.root = root
        self.active_animations = []
        self.particles = []
    def add_pulse_animation(self, widget, color_property, min_intensity=0.7, max_intensity=1.0, speed=0.05):
        phase = 0
        direction = 1
        def animate():
            nonlocal phase, direction
            phase += speed * direction
            if phase >= 1 or phase <= 0:
                direction *= -1
            intensity = min_intensity + (max_intensity - min_intensity) * math.sin(phase * math.pi)
            base_color = DynamicTheme().get(color_property)
            r, g, b = [int(base_color[i:i+2], 16) for i in (1, 3, 5)]
            pulse_color = f"#{int(r*intensity):02x}{int(g*intensity):02x}{int(b*intensity):02x}"
            try:
                if isinstance(widget, tk.Canvas):
                    widget.itemconfig("pulse", fill=pulse_color)
                else:
                    widget.config(foreground=pulse_color)
                self.root.after(50, animate)
            except tk.TclError:
                return
        animate()
    def create_particles(self, canvas, count=30, size_range=(1, 3), speed_range=(-0.5, 0.5)):
        width = canvas.winfo_width()
        height = canvas.winfo_height()
        for _ in range(count):
            x = random.randint(0, width)
            y = random.randint(0, height)
            size = random.randint(*size_range)
            color = random.choice([
                DynamicTheme().get("PRIMARY"),
                DynamicTheme().get("SECONDARY"),
                DynamicTheme().get("ACCENT")
            ])
            dx = random.uniform(*speed_range)
            dy = random.uniform(*speed_range)
            particle = canvas.create_oval(x, y, x+size, y+size, fill=color, outline="")
            self.particles.append({
                'id': particle,
                'dx': dx,
                'dy': dy,
                'canvas': canvas
            })
        self.animate_particles()
    def animate_particles(self):
        for particle in self.particles[:]:
            try:
                canvas = particle['canvas']
                x1, y1, x2, y2 = canvas.coords(particle['id'])
                if x1 <= 0 or x2 >= canvas.winfo_width():
                    particle['dx'] *= -1
                if y1 <= 0 or y2 >= canvas.winfo_height():
                    particle['dy'] *= -1
                canvas.move(particle['id'], particle['dx'], particle['dy'])
            except tk.TclError:
                self.particles.remove(particle)
        self.root.after(30, self.animate_particles) 