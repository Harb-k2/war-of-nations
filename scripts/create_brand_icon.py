from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"
SIZE = 1024

navy = "#0B1F35"
deep = "#071526"
field = "#5D7A52"
gold = "#E7B34B"
gold_light = "#F5D27C"
red = "#C84D4D"

image = Image.new("RGBA", (SIZE, SIZE), navy)
draw = ImageDraw.Draw(image)

# Layered tactical field background.
draw.rounded_rectangle((56, 56, 968, 968), radius=150, fill=deep, outline="#26455F", width=18)
draw.polygon([(90, 630), (360, 420), (550, 610), (760, 420), (934, 570), (934, 934), (90, 934)], fill=field)
draw.line((116, 760, 908, 760), fill="#8CA66F", width=14)
draw.line((220, 930, 540, 460), fill="#8CA66F", width=12)
draw.line((520, 930, 806, 520), fill="#8CA66F", width=12)

# Command shield.
shield = [(512, 130), (792, 245), (750, 600), (512, 825), (274, 600), (232, 245)]
draw.polygon(shield, fill=navy, outline=gold, width=34)
inner = [(512, 182), (738, 276), (702, 570), (512, 748), (322, 570), (286, 276)]
draw.polygon(inner, fill="#12324B")

# Simplified tank silhouette.
draw.rounded_rectangle((323, 497, 702, 635), radius=35, fill=gold)
draw.rounded_rectangle((392, 410, 580, 534), radius=34, fill=gold)
draw.polygon([(560, 443), (815, 385), (827, 426), (575, 485)], fill=gold)
draw.rounded_rectangle((300, 618, 724, 674), radius=28, fill=gold_light)
for center_x in (390, 510, 630):
    draw.ellipse((center_x - 42, 629, center_x + 42, 713), fill=navy, outline=gold_light, width=10)

# Tactical star accent.
star = [(512, 250), (535, 307), (597, 312), (548, 350), (566, 412), (512, 377), (458, 412), (476, 350), (427, 312), (489, 307)]
draw.polygon(star, fill=red)

# Small notch denotes expansion direction.
draw.polygon([(822, 222), (906, 308), (822, 394)], fill=red)

for filename in ("icon.png", "splash-icon.png", "favicon.png", "android-icon-foreground.png"):
    image.save(OUT / filename, "PNG", optimize=True)

print("Brand icon files created")
