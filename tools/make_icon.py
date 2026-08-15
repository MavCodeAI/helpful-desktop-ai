from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
src = root / "public" / "alpha-icon.png"
dst = root / "public" / "alpha-icon.ico"
image = Image.open(src).convert("RGBA")
image.save(dst, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(dst)

