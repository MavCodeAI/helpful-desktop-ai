from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "alpha-icon.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

# Launcher icon canvas sizes follow the conventional Android density buckets.
DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

source = Image.open(SOURCE).convert("RGBA")
for directory, size in DENSITIES.items():
    target = RES / directory
    target.mkdir(parents=True, exist_ok=True)
    icon = source.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(target / "ic_launcher.png", optimize=True)
    icon.save(target / "ic_launcher_round.png", optimize=True)

print(f"Generated {len(DENSITIES) * 2} Android launcher PNGs from {SOURCE}")
