// Wegenetz aus nav.json: Flaechen (eben oder Rampe) und Sperren. Alles in Blender Koordinaten (x, y waagerecht, z hoch).
import { Vector3 } from 'three';
const C = 0.5, R = 0.28, K = 4096;

export class Nav {
  constructor(nav) {
    this.zellen = new Map();                       // schluessel -> [knoten]
    for (const f of nav.flaechen) {
      const i0 = Math.floor(f.x0 / C), i1 = Math.ceil(f.x1 / C), j0 = Math.floor(f.y0 / C), j1 = Math.ceil(f.y1 / C); const w = i1 - i0, h = j1 - j0;
      const frei = new Uint8Array(w * h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = (i0 + i + .5) * C, y = (j0 + j + .5) * C; if (x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1) frei[j * w + i] = 1; }
      for (const s of nav.sperren) {
        if (s[6] === f.id) continue;
        if (s[2] < f.x0 - R || s[0] > f.x1 + R || s[3] < f.y0 - R || s[1] > f.y1 + R) continue;
        const a0 = Math.max(i0, Math.floor((s[0] - R) / C)), a1 = Math.min(i1 - 1, Math.floor((s[2] + R) / C)), b0 = Math.max(j0, Math.floor((s[1] - R) / C)), b1 = Math.min(j1 - 1, Math.floor((s[3] + R) / C));
        for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
          const x = (i + .5) * C, y = (j + .5) * C; if (x < s[0] - R || x > s[2] + R || y < s[1] - R || y > s[3] + R) continue;
          const z = this.hoeheAuf(f, x, y); if (s[4] < z + 1.2 && s[5] > z + 0.3) frei[(j - j0) * w + (i - i0)] = 0;
        }
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (frei[j * w + i]) {
        const I = i0 + i, J = j0 + j, x = (I + .5) * C, y = (J + .5) * C; const k = I + J * K;
        const n = { i: I, j: J, x, y, z: this.hoeheAuf(f, x, y), f, g: 0, h: 0, vor: null, lauf: 0 };
        if (!this.zellen.has(k)) this.zellen.set(k, []); this.zellen.get(k).push(n);
      }
    }
    this.lauf = 0;
  }
  hoeheAuf(f, x, y) {
    if (!f.rampe) return f.z; const r = f.rampe; const t = r.achse === 'x' ? (x - f.x0) / (f.x1 - f.x0) : (y - f.y0) / (f.y1 - f.y0);
    return r.z0 + Math.min(1, Math.max(0, t)) * (r.z1 - r.z0);
  }
  knoten(x, y, z, dz = 0.6) {
    // Unter mehreren Flaechen in einer Zelle gewinnt die hoechste, die mit einem Schritt (0,4 m) erreichbar ist.
    // So steigt man am Fuss einer Treppe auf die Rampe, statt unter ihr auf dem Boden zu bleiben.
    const l = this.zellen.get(Math.floor(x / C) + Math.floor(y / C) * K); if (!l) return null; let b = null, bh = -1e9;
    for (const n of l) { const h = this.hoeheAuf(n.f, x, y); if (h <= z + 0.4 && h >= z - dz && h > bh) { bh = h; b = n; } } return b;
  }
  hoehe(x, y, z) { const n = this.knoten(x, y, z); return n ? this.hoeheAuf(n.f, x, y) : null; }
  flaecheBei(p) { const n = this.knoten(p.x, p.y, p.z); return n ? n.f.id : null; }
  bewege(p, dx, dy) {
    for (const [a, b] of [[dx, dy], [dx, 0], [0, dy]]) { if (!a && !b) continue; const h = this.hoehe(p.x + a, p.y + b, p.z); if (h !== null) return new Vector3(p.x + a, p.y + b, h); }
    return p.clone();
  }
  naechster(x, y, z, dz) {
    let b = null, bd = 1e9; const I = Math.floor(x / C), J = Math.floor(y / C);
    for (let r = 0; r <= 6 && !b; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; const l = this.zellen.get(I + i + (J + j) * K); if (!l) continue;
      for (const n of l) { if (Math.abs(n.z - z) > dz) continue; const d = (n.x - x) ** 2 + (n.y - y) ** 2 + (n.z - z) ** 2 * 4; if (d < bd) { bd = d; b = n; } }
    }
    return b;
  }
  nachbarn(n, aus) {
    aus.length = 0;
    const hat = (i, j) => { const l = this.zellen.get(i + j * K); if (!l) return false; for (const m of l) if (Math.abs(m.z - n.z) <= 0.36) return true; return false; };
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const l = this.zellen.get(n.i + di + (n.j + dj) * K); if (!l) continue;
      if (di && dj && (!hat(n.i + di, n.j) || !hat(n.i, n.j + dj))) continue;
      for (const m of l) if (m !== n && Math.abs(m.z - n.z) <= 0.36) aus.push(m);
    }
    return aus;
  }
  sicht(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.ceil(d / 0.2); let z = a.z;
    for (let i = 1; i <= n; i++) { const t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; const h = this.hoehe(x, y, z); if (h === null || Math.abs(h - z) > 0.3) return false;
      for (const [ox, oy] of [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) if (this.hoehe(x + ox, y + oy, h) === null) return false; z = h; }
    return true;
  }
  weg(von, nach) {
    const s = this.naechster(von.x, von.y, von.z, 0.8), z = this.naechster(nach.x, nach.y, nach.z, 1.2); if (!s || !z) return null; if (s === z) return [{ x: nach.x, y: nach.y, z: z.z }];
    const L = ++this.lauf; const offen = [s]; s.g = 0; s.h = 0; s.vor = null; s.lauf = L; s.zu = false; const nb = []; let gefunden = false, zaehler = 0;
    const H = (n) => Math.hypot(n.x - z.x, n.y - z.y) + Math.abs(n.z - z.z) * 2;
    while (offen.length && zaehler++ < 60000) {
      let bi = 0; for (let i = 1; i < offen.length; i++) if (offen[i].g + offen[i].h < offen[bi].g + offen[bi].h) bi = i;
      const n = offen[bi]; offen[bi] = offen[offen.length - 1]; offen.pop(); if (n === z) { gefunden = true; break; } n.zu = true;
      for (const m of this.nachbarn(n, nb)) {
        const g = n.g + Math.hypot(m.x - n.x, m.y - n.y, m.z - n.z);
        if (m.lauf !== L) { m.lauf = L; m.zu = false; m.g = g; m.h = H(m); m.vor = n; offen.push(m); } else if (!m.zu && g < m.g) { m.g = g; m.vor = n; }
      }
    }
    if (!gefunden) return null;
    const roh = []; for (let n = z; n; n = n.vor) roh.push({ x: n.x, y: n.y, z: n.z }); roh.reverse();
    const fein = []; let a = { x: von.x, y: von.y, z: s.z }; let i = 0;       // gerade ziehen, wo freie Sicht ist
    while (i < roh.length) { let j = roh.length - 1; while (j > i && !this.sicht(a, roh[j])) j--; fein.push(roh[j]); a = roh[j]; i = j + 1; }
    const e = { x: nach.x, y: nach.y, z: z.z }; if (this.hoehe(e.x, e.y, e.z) !== null && this.sicht(a, e)) fein.push(e);
    return fein;
  }
}
