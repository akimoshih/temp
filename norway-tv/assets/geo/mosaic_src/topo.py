"""Minimal TopoJSON -> shapely decoder for world-atlas@2 (Natural Earth 1:10m)."""
import json
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely.validation import make_valid
from shapely.geometry import box
from shapely.affinity import translate

WA = '/home/user/temp/norway-tv/tmp/mosaic/worldatlas/package/countries-10m.json'


class Topo:
    def __init__(self, path=WA):
        d = json.load(open(path))
        self.d = d
        sx, sy = d['transform']['scale']
        tx, ty = d['transform']['translate']
        self.arcs = []
        for arc in d['arcs']:
            x = y = 0
            pts = []
            for dx, dy in arc:
                x += dx; y += dy
                pts.append((x * sx + tx, y * sy + ty))
            self.arcs.append(pts)

    def arc(self, i):
        if i >= 0:
            return self.arcs[i]
        return self.arcs[~i][::-1]

    def ring(self, idxs):
        pts = []
        for k, i in enumerate(idxs):
            a = self.arc(i)
            pts.extend(a if k == 0 else a[1:])
        return pts

    @staticmethod
    def _unwrap(ring):
        """make a ring continuous across the antimeridian (lon may leave [-180,180])"""
        out = []; off = 0.0; px = None
        for x, y in ring:
            if px is not None:
                d = (x + off) - px
                if d > 180: off -= 360
                elif d < -180: off += 360
            out.append((x + off, y)); px = x + off
        return out

    def geom(self, g):
        t = g['type']
        if t == 'Polygon':
            polys = [g['arcs']]
        elif t == 'MultiPolygon':
            polys = g['arcs']
        else:
            return None
        world = box(-180, -90, 180, 90)
        out = []
        for p in polys:
            rings = [self._unwrap(self.ring(r)) for r in p]
            if len(rings[0]) < 4:
                continue
            poly = Polygon(rings[0], [r for r in rings[1:] if len(r) >= 4])
            if not poly.is_valid:
                poly = make_valid(poly)
            x0, _, x1, _ = poly.bounds
            if x0 < -180 or x1 > 180:
                parts = [poly.intersection(world)]
                for sh in (-360, 360):
                    q = translate(poly, xoff=sh).intersection(world)
                    if not q.is_empty:
                        parts.append(q)
                poly = unary_union(parts)
            out.append(poly)
        u = unary_union(out)
        # keep polygonal parts only
        if u.geom_type == 'GeometryCollection':
            ps = []
            for q in u.geoms:
                if q.geom_type == 'Polygon': ps.append(q)
                elif q.geom_type == 'MultiPolygon': ps.extend(q.geoms)
            u = MultiPolygon(ps) if len(ps) != 1 else ps[0]
        return u

    def countries(self):
        res = {}
        for g in self.d['objects']['countries']['geometries']:
            name = g.get('properties', {}).get('name')
            geom = self.geom(g)
            if geom is not None:
                res[name] = (g.get('id'), geom)
        return res

    def land(self):
        gs = []
        for g in self.d['objects']['land']['geometries']:
            gg = self.geom(g)
            if gg is not None:
                gs.append(gg)
        return unary_union(gs)
