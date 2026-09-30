#!/usr/bin/env python3
"""contact sheet + continuity report for a plate sequence.

usage: python3 contact_sheet.py <seq_dir> <out.jpg> [cols]
Prints the mean absolute difference between consecutive frames (on a 480x270 proxy) and the
max/median ratio: a spike marks a jump or flicker.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageDraw


def main():
    seq, out = sys.argv[1], sys.argv[2]
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    fs = sorted(glob.glob(os.path.join(seq, 'f*.jpg')))
    tw, th = 320, 180
    rows = (len(fs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * th))
    dr = ImageDraw.Draw(sheet)
    prev = None
    diffs = []
    for i, f in enumerate(fs):
        im = Image.open(f)
        a = np.asarray(im.resize((480, 270), Image.BILINEAR)).astype(np.float32)
        if prev is not None:
            diffs.append(float(np.abs(a - prev).mean()))
        prev = a
        sheet.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
        dr.text(((i % cols) * tw + 4, (i // cols) * th + 4), '%d' % i, fill=(255, 225, 77))
    sheet.save(out, quality=88)
    d = np.array(diffs)
    print('%d frames; consecutive-frame MAD: min %.2f median %.2f max %.2f (max/median %.2f)'
          % (len(fs), d.min(), np.median(d), d.max(), d.max() / np.median(d)))
    print(' '.join('%.1f' % x for x in d))


if __name__ == '__main__':
    main()
