"""Contact sheet: python3 comp/tools/contact.py <dir> <out.jpg> [cols] [frames...]"""
import sys, os, glob
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
want = set(int(x) for x in sys.argv[4:])
files = sorted(glob.glob(os.path.join(d, 'f*.jpg')))
if want:
    files = [f for f in files if int(os.path.basename(f)[1:5]) in want]
tw, th = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y + 18))
    dr.text((x + 4, y + 3), os.path.basename(f), fill=(255, 220, 80))
sheet.save(out, quality=88)
print(out, sheet.size)
