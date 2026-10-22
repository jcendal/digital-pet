"""Render the web sharing card from existing branding, font and world artwork."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "packages/web-digital-pet/assets/social/digital-pet-share.png"
FONT = ROOT / "packages/digital-pet-webviews/assets/fonts/Silkscreen-Regular.ttf"
CASE = "#594130"
EDGE = "#9a7750"
CASE_INK = "#d6c5a3"
LCD = "#bac79c"
LCD_EDGE = "#89966f"
INK = "#26351e"

background = Image.open(ROOT / "packages/digital-pet-fields/assets/backgrounds/dragon-eye-lake.png").convert("RGB")
card = ImageOps.fit(background, (1200, 630), method=Image.Resampling.NEAREST).convert("RGBA")
card = Image.alpha_composite(card, Image.new("RGBA", card.size, (11, 23, 26, 125))).convert("RGB")
draw = ImageDraw.Draw(card)


def text(position, value, size, color):
    draw.text(position, value, font=ImageFont.truetype(str(FONT), size), fill=color)


draw.rectangle((54, 44, 1156, 590), fill="#342b21")
draw.rectangle((60, 38, 1148, 582), fill=CASE, outline=EDGE, width=8)
draw.rectangle((73, 51, 1135, 569), outline="#342b21", width=3)
for x in range(94, 1120, 90):
    draw.rectangle((x, 54, x + 4, 68), fill="#342b21")
    draw.rectangle((x, 552, x + 4, 566), fill="#342b21")
text((96, 76), "DIGITAL MONSTER", 26, CASE_INK)
text((918, 83), "WEB VPET", 17, CASE_INK)

draw.rectangle((87, 128, 1121, 500), fill="#303725")
draw.rectangle((96, 137, 1112, 491), fill=LCD_EDGE)
draw.rectangle((105, 146, 1103, 482), fill=LCD)
text((138, 176), "YOUR PIXEL COMPANION", 18, "#435334")
text((132, 220), "DIGITAL", 58, INK)
text((132, 284), "PET", 58, INK)
draw.rectangle((140, 369, 641, 372), fill=LCD_EDGE)
text((139, 395), "RAISE. EXPLORE. EVOLVE.", 18, INK)
text((139, 430), "PLAY IN YOUR BROWSER", 14, "#435334")

# Recolor the existing monochrome icon, preserving its authored pixel silhouette.
icon = Image.open(ROOT / "packages/web-digital-pet/assets/icons/digital-pet-512.png").convert("RGBA")
mask = icon.convert("L").point(lambda value: 255 if value < 100 else 0)
mask = ImageChops.multiply(mask, icon.getchannel("A"))
mask = mask.crop(mask.getbbox()).resize((220, 236), Image.Resampling.NEAREST)
sprite = Image.new("RGB", mask.size, INK)
card.paste(sprite, (797, 179), mask)
draw = ImageDraw.Draw(card)
for x, y in [(751, 196), (1044, 231), (767, 392)]:
    draw.rectangle((x, y, x + 7, y + 7), fill=LCD_EDGE)
text((836, 438), "AGUMON", 15, INK)

text((96, 522), "DIGITAL-PET.REBASE.ES", 17, CASE_INK)
for x in (1032, 1062, 1092):
    draw.rectangle((x, 525, x + 16, 541), fill=CASE_INK)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
card.save(OUTPUT, optimize=True)
print(f"Sharing card: {OUTPUT.relative_to(ROOT)} (1200 x 630)")
