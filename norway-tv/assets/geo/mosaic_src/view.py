import numpy as np, sys, math
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
A = None
def load(path='/home/user/temp/norway-tv/tmp/mosaic/final_rgb.npy'):
    global A
    A = np.load(path, mmap_mode='r')
def view(lon0, lon1, lat0, lat1, out, maxw=1400, maxh=900, px=0.004, west=-4.0, north=72.0):
    if A is None: load()
    r0, r1 = int((north - lat1) / px), int((north - lat0) / px)
    c0, c1 = int((lon0 - west) / px), int((lon1 - west) / px)
    a = np.ascontiguousarray(A[r0:r1, c0:c1])
    k = math.cos(math.radians((lat0 + lat1) / 2))
    w, h = a.shape[1] * k, a.shape[0]
    s = min(maxw / w, maxh / h, 1.0 / k if k > 0 else 1)
    im = Image.fromarray(a).resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    im.save(out)
    return im.size
if __name__ == '__main__':
    a = [float(x) for x in sys.argv[1:5]]
    print(view(*a, sys.argv[5]))
