"""Target grid definition. Default ('main'): the Scandinavia mosaic (plain equirectangular EPSG:4326, north-up).
MOSAIC_GRID=fringe: a coarser, wider grid used only to extend real summer imagery into the globe texture."""
import os
from affine import Affine
ROOT = '/home/user/temp/norway-tv/tmp/mosaic'
GRID = os.environ.get('MOSAIC_GRID', 'main')
if GRID == 'main':
    WEST, EAST, SOUTH, NORTH = -4.0, 44.0, 54.0, 72.0
    PX = 0.004
    OUT = ROOT
else:
    WEST, EAST, SOUTH, NORTH = -9.0, 58.0, 54.0, 72.5
    PX = 0.012
    OUT = f'{ROOT}/fringe'
os.makedirs(OUT, exist_ok=True)
WIDTH = int(round((EAST - WEST) / PX))
HEIGHT = int(round((NORTH - SOUTH) / PX))
TRANSFORM = Affine(PX, 0, WEST, 0, -PX, NORTH)
