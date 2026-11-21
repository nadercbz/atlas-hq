// Farbe schiessen in der Ich Ansicht: Hand mit Zeigefinger, Farbkugeln mit Flugbahn, Kleckse, die an Waenden und Dingen haften,
// Tropfen, die an der Wand herunterlaufen, und Wegwischen mit der rechten Maustaste.
// Die Welt liegt dafuer als Dreiecke in einem Raumgitter: so kostet ein Treffer und ein Klecks fast nichts.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PALETTE = ['#ff2d6f', '#ff8a00', '#ffd21f', '#3ddc5a', '#00c8ff', '#3b5bff', '#a03bff', '#ff4fd8'];
const ZELLE = 2, MAX_KLECKSE = 320;
// Handmodell (assets/figuren/hand.glb): Beugung je Fingerglied in Bogenmass um die lokale X Achse des Knochens, positiv = zur Handflaeche.
// offen = entspannt (Hand unten), zeigen = Zeigefinger vorn, die anderen zur Faust, Daumen oben wie ein Hahn. Daumen: [x, y, z] je Glied.
const HAND = {
  offen: { index: [0.22, 0.28, 0.18], middle: [0.3, 0.36, 0.22], ring: [0.36, 0.42, 0.26], pinky: [0.42, 0.46, 0.3], thumb: [[0.1, 0, 0], [0.15, 0, 0], [0.1, 0, 0]] },
  zeigen: { index: [-0.07, -0.12, -0.08], middle: [1.43, 1.71, 1.08], ring: [1.43, 1.71, 1.08], pinky: [1.43, 1.71, 1.08], thumb: [[-0.1, 0, 0], [-0.07, 0, 0], [0.0, 0, 0]] },
  hahn: [[0.42, 0, 0], [0.56, 0, 0], [0.6, 0, 0]],             // Daumen faellt beim Schuss nach vorn
  ort: [0, 0, 0.05], dreh: [0, 0, 0], mass: 1,
};

class Raum {
  constructor(netze) {
    let n = 0; for (const m of netze) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    this.p = new Float32Array(n * 9); this.nr = new Float32Array(n * 3); this.zellen = new Map(); this.marke = new Uint32Array(n); this.lauf = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(); let t = 0;
    for (const m of netze) {
      m.updateWorldMatrix(true, false); const pos = m.geometry.attributes.position, idx = m.geometry.index, cnt = idx ? idx.count : pos.count;
      for (let i = 0; i < cnt; i += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(m.matrixWorld);
        e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); const l = e1.length(); if (l < 1e-9) continue; e1.multiplyScalar(1 / l);
        this.p.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], t * 9); this.nr.set([e1.x, e1.y, e1.z], t * 3);
        const x0 = Math.floor(Math.min(a.x, b.x, c.x) / ZELLE), x1 = Math.floor(Math.max(a.x, b.x, c.x) / ZELLE), y0 = Math.floor(Math.min(a.y, b.y, c.y) / ZELLE), y1 = Math.floor(Math.max(a.y, b.y, c.y) / ZELLE), z0 = Math.floor(Math.min(a.z, b.z, c.z) / ZELLE), z1 = Math.floor(Math.max(a.z, b.z, c.z) / ZELLE);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = (x + 512) + (y + 512) * 1024 + (z + 512) * 1048576; let l2 = this.zellen.get(k); if (!l2) this.zellen.set(k, l2 = []); l2.push(t); }
        t++;
      }
    }
    this.anzahl = t;
  }
  // alle Dreiecke im Quader, jedes einmal
  sammle(x0, y0, z0, x1, y1, z1, aus) {
    aus.length = 0; const L = ++this.lauf;
    for (let x = Math.floor(x0 / ZELLE); x <= Math.floor(x1 / ZELLE); x++) for (let y = Math.floor(y0 / ZELLE); y <= Math.floor(y1 / ZELLE); y++) for (let z = Math.floor(z0 / ZELLE); z <= Math.floor(z1 / ZELLE); z++) {
      const l = this.zellen.get((x + 512) + (y + 512) * 1024 + (z + 512) * 1048576); if (!l) continue; for (const t of l) if (this.marke[t] !== L) { this.marke[t] = L; aus.push(t); }
    }
    return aus;
  }
  // kurzer Strahl: naechster Treffer bis max. Rueckgabe { t, n } oder null. n zeigt dem Strahl entgegen.
  strahl(o, d, max) {
    const ex = o.x + d.x * max, ey = o.y + d.y * max, ez = o.z + d.z * max, P = this.p; let best = max, bi = -1;
    for (const i of this.sammle(Math.min(o.x, ex) - 0.01, Math.min(o.y, ey) - 0.01, Math.min(o.z, ez) - 0.01, Math.max(o.x, ex) + 0.01, Math.max(o.y, ey) + 0.01, Math.max(o.z, ez) + 0.01, this._l || (this._l = []))) {
      const k = i * 9, ax = P[k], ay = P[k + 1], az = P[k + 2], e1x = P[k + 3] - ax, e1y = P[k + 4] - ay, e1z = P[k + 5] - az, e2x = P[k + 6] - ax, e2y = P[k + 7] - ay, e2z = P[k + 8] - az;
      const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x; const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-9) continue; const inv = 1 / det;
      const tx = o.x - ax, ty = o.y - ay, tz = o.z - az; const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x; const v = (d.x * qx + d.y * qy + d.z * qz) * inv; if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > 1e-4 && t < best) { best = t; bi = i; }
    }
    if (bi < 0) return null; const n = new THREE.Vector3(this.nr[bi * 3], this.nr[bi * 3 + 1], this.nr[bi * 3 + 2]); if (n.dot(d) > 0) n.negate(); return { t: best, n };
  }
  weit(o, d, max) { const p = new THREE.Vector3(); for (let s = 0; s < max; s += 2.5) { p.copy(o).addScaledVector(d, s); const h = this.strahl(p, d, Math.min(2.5, max - s)); if (h) { h.t += s; return h; } } return null; }
}

// Vieleck an einer Ebene beschneiden: behalten wird, wo vz * p[achse] <= grenze
function schneide(poly, achse, vz, grenze) {
  const aus = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const da = vz * a[achse] - grenze, db = vz * b[achse] - grenze;
    if (da <= 0) aus.push(a); if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); aus.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); } }
  return aus;
}

const KLECKS_VS = `attribute vec2 zelle; attribute float k; attribute float art; attribute float lang; varying vec2 vUv; varying vec2 vZelle; varying float vK; varying float vArt; varying float vLang;
  void main(){ vUv = uv; vZelle = zelle; vK = k; vArt = art; vLang = lang; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const KLECKS_FS = /* glsl */`precision highp float; varying vec2 vUv; varying vec2 vZelle; varying float vK; varying float vArt; varying float vLang;
  uniform sampler2D tKlecks; uniform vec3 uFarbe; uniform float uAlter, uWeg, uLicht;
  float H(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float glanz; float nass = 0.35 + 0.65 * exp(-uAlter * 0.22);
    if (vArt < 0.5) {
      // Klecks: platzt in einem Zehntel auf, federt leicht ueber die Endgroesse
      float w = 1.0 - exp(-uAlter * 22.0); w = 0.3 + 0.7 * w + 0.1 * sin(min(uAlter * 16.0, 3.1416)) * exp(-uAlter * 9.0);
      vec2 u = (vUv - 0.5) / w + 0.5; if (u.x < 0.01 || u.y < 0.01 || u.x > 0.99 || u.y > 0.99) discard;
      vec4 t = texture2D(tKlecks, vZelle + u * 0.5); float a = t.a * vK - uWeg * (0.55 + 0.9 * H(floor(vUv * 46.0))); if (a < 0.5) discard; glanz = t.r;
    } else {
      // Tropfen: laeuft langsam an der Wand herunter, vorn eine dicke Nase
      float len = vLang * (1.0 - exp(-max(uAlter - 0.12, 0.0) * 0.85)); float y = vUv.y * vLang; if (y > len || uWeg > 0.45 + 0.5 * H(vec2(vLang, vK))) discard;
      float dy = len - y, x = abs(vUv.x - 0.5), r = vK * 0.5; float rand = dy < r ? 0.5 * sqrt(max(0.0, 1.0 - pow(1.0 - dy / r, 2.0))) : mix(0.5, 0.3, smoothstep(0.0, max(len, 0.02), dy)); if (x > rand) discard;
      glanz = 0.72 + 0.28 * smoothstep(rand, 0.0, x + 0.12);
    }
    vec3 c = uFarbe * (0.5 + 0.55 * glanz) * uLicht + vec3(1.0) * pow(max(glanz - 0.8, 0.0) * 5.0, 2.0) * 0.4 * nass * uLicht;
    gl_FragColor = vec4(c, 1.0);
  }`;

export class Farbe {
  constructor(scene, kamera, ton, netze) {
    this.scene = scene; this.kam = kamera; this.ton = ton; this.netze = netze; this.raum = null; this.kleckse = []; this.geschosse = []; this.nr = 0; this.farbNr = Math.random() * PALETTE.length | 0; this.sperre = 0; this.licht = 1;
    this.tex = new THREE.TextureLoader().load('./assets/tex/klecks.png'); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.basis = new THREE.ShaderMaterial({ uniforms: { tKlecks: { value: this.tex }, uFarbe: { value: new THREE.Color() }, uAlter: { value: 0 }, uWeg: { value: 0 }, uLicht: { value: 1 } }, vertexShader: KLECKS_VS, fragmentShader: KLECKS_FS,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
    // Tropfen in der Luft: Mündungsspritzer, Schweif der Kugel, Spritzer beim Aufprall
    const N = 260; this.tN = N; this.tropfen = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial(), N); this.tropfen.frustumCulled = false; this.tropfen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tp = new Float32Array(N * 3); this.tv = new Float32Array(N * 3); this.tl = new Float32Array(N); this.ts = new Float32Array(N); this.tz = 0; const null4 = new THREE.Matrix4().makeScale(0, 0, 0), weiss = new THREE.Color(1, 1, 1);
    for (let i = 0; i < N; i++) { this.tropfen.setMatrixAt(i, null4); this.tropfen.setColorAt(i, weiss); } this.tropfen.visible = false; scene.add(this.tropfen);
    this.kugelGeo = new THREE.SphereGeometry(1, 14, 10);
    // Farbstrahl (E halten): fluessiges Seil aus gestreckten Tropfen, glaenzend, je Teilchen eigene Flugbahn mit Schwerkraft und Luftwiderstand
    const SN = 720; this.sN = SN; this.strom = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.16, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.05 }), SN);
    this.strom.frustumCulled = false; this.strom.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.sp = new Float32Array(SN * 3); this.sv = new Float32Array(SN * 3); this.sl = new Float32Array(SN); this.sg = new Float32Array(SN); this.sz = 0; this.sAktiv = false;
    for (let i = 0; i < SN; i++) { this.strom.setMatrixAt(i, null4); this.strom.setColorAt(i, weiss); } this.strom.visible = false; scene.add(this.strom);
    this.spruehAn = false; this.druck = 0; this.emitRest = 0; this.zielT = 0; this.strahlZiel = new THREE.Vector3(); this.auftrag = null; this.auftragT = 0; this.naesse = new Map(); this.platschT = 0; this.figurT = 0;
    this.baueHand();
  }
  farbe() { return PALETTE[this.farbNr % PALETTE.length]; }

  // ------------------------------------------------------------ Hand: Unterarm im Hemd, Faust, Daumen hoch, Zeigefinger nach vorn
  baueHand() {
    const haut = new THREE.MeshStandardMaterial({ color: '#b07a55', roughness: 0.62, metalness: 0 }), stoff = new THREE.MeshStandardMaterial({ color: '#e6d8bd', roughness: 0.9, metalness: 0 }), nagel = new THREE.MeshStandardMaterial({ color: '#d9a98a', roughness: 0.35 });
    const kap = (r, l, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), mat); m.rotation.x = -Math.PI / 2; const g = new THREE.Group(); m.position.z = -l / 2; g.add(m); g.userData.l = l; return g; };       // Gelenk am Ursprung, Glied zeigt nach -z
    const hand = this.hand = new THREE.Group(); const arm = this.arm = new THREE.Group(); hand.add(arm);
    const aermel = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.062, 0.46, 20, 1), stoff); aermel.rotation.x = -Math.PI / 2; aermel.position.set(0, -0.012, 0.31); arm.add(aermel);
    const bund = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.011, 10, 24), stoff); bund.position.set(0, -0.012, 0.085); arm.add(bund);
    const gelenk = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.05, 6, 14), haut); gelenk.rotation.x = -Math.PI / 2; gelenk.scale.set(0.82, 1, 1.12); gelenk.position.set(0, -0.012, 0.05); arm.add(gelenk);
    const flaeche = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), haut); flaeche.scale.set(0.024, 0.047, 0.05); flaeche.position.set(0, -0.006, -0.012); arm.add(flaeche);
    // drei eingerollte Finger: Grundglied nach vorn, Mittelglied nach unten hinten gefaltet
    for (let i = 0; i < 3; i++) { const y = 0.004 - i * 0.021, r = 0.0118 - i * 0.0008; const g1 = kap(r, 0.03, haut); g1.position.set(-0.004, y, -0.045); g1.rotation.y = 0.12; arm.add(g1);
      const g2 = kap(r * 0.94, 0.022, haut); g2.position.set(0, 0, -0.034); g2.rotation.y = 1.75; g1.add(g2); const g3 = kap(r * 0.88, 0.016, haut); g3.position.set(0, 0, -0.026); g3.rotation.y = 1.3; g2.add(g3); }
    // Zeigefinger: drei Glieder, zeigt nach vorn
    const z1 = this.z1 = kap(0.0122, 0.036, haut); z1.position.set(-0.002, 0.03, -0.05); arm.add(z1);
    const z2 = this.z2 = kap(0.0112, 0.026, haut); z2.position.z = -0.04; z1.add(z2); const z3 = this.z3 = kap(0.0102, 0.02, haut); z3.position.z = -0.03; z2.add(z3);
    const n = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), nagel); n.scale.set(0.0082, 0.003, 0.0105); n.position.set(0, 0.0092, -0.019); z3.add(n);
    this.spitze = new THREE.Object3D(); this.spitze.position.z = -0.036; z3.add(this.spitze);
    // Daumen: steht nach oben wie der Hahn einer Pistole, klappt beim Schuss nach vorn
    const d1 = this.d1 = kap(0.0135, 0.03, haut); d1.position.set(-0.008, 0.03, -0.004); d1.rotation.x = 1.05; d1.rotation.z = 0.25; arm.add(d1); const d2 = kap(0.0122, 0.024, haut); d2.position.z = -0.036; d2.rotation.x = -0.18; d1.add(d2);
    // Farbtropfen an der Fingerspitze in der naechsten Farbe
    this.perle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshStandardMaterial({ color: this.farbe(), roughness: 0.12, metalness: 0, emissive: this.farbe(), emissiveIntensity: 0.55 })); this.spitze.add(this.perle);
    arm.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    hand.visible = false; hand.scale.setScalar(1.12); this.kam.add(hand); this.ladeHand(); this.rueck = 0; this.heben = 0; this.schwung = new THREE.Vector2(); this.altGier = null; this.altNeig = 0; this.gang = 0; this.naehe = 0;
  }

  // Das richtige Handmodell: ein Netz mit Knochen fuer jedes Fingerglied. Bis es geladen ist, bleibt die einfache Hand.
  ladeHand() {
    new GLTFLoader().load('./assets/figuren/hand.glb', (g) => {
      const m = g.scene, K = {}; m.traverse(o => { if (o.name) K[o.name] = o; if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
      if (!K.hand || !K.index_1 || !K.index_3) return; this.K = K; this.ruhe = {}; for (const n in K) this.ruhe[n] = K[n].quaternion.clone();
      m.position.set(...HAND.ort); m.rotation.set(...HAND.dreh); m.scale.setScalar(HAND.mass); this.hand.remove(this.arm); this.modell = m; this.hand.add(m);
      this.spitze = new THREE.Object3D(); if (K.index_tip) K.index_tip.add(this.spitze); else { this.spitze.position.y = 0.024; K.index_3.add(this.spitze); } this.spitze.add(this.perle); this.schussZeit = 9;
    }, undefined, () => { });
  }
  // Finger stellen: weich zwischen offen und zeigen, dazu Leben (jeder Finger atmet etwas anders), Rueckstoss und der Daumen als Hahn
  fingerPose(dt, stoss) {
    const K = this.K; if (!K) return; const t = this.zeit || 0, a = THREE.MathUtils.smoothstep(this.heben, 0.25, 1), ts = this.schussZeit = (this.schussZeit ?? 9) + dt, E = this._e || (this._e = new THREE.Euler()), Q = this._q || (this._q = new THREE.Quaternion());
    const setz = (n, x, y = 0, z = 0) => { const b = K[n]; if (!b) return; E.set(x, y, z); b.quaternion.copy(this.ruhe[n]).multiply(Q.setFromEuler(E)); };
    const leben = (i, j) => (Math.sin(t * (0.9 + i * 0.31) + i * 2.1 + j) * 0.5 + Math.sin(t * (2.3 + i * 0.4) + j * 1.3) * 0.25) * 0.03;
    // Schuss: der Zeigefinger schnellt kurz nach oben und federt aus, die Faust greift nach, der Daumen faellt und spannt wieder
    const ruck = ts < 1 ? Math.exp(-ts * 16) : 0, feder = ts < 1 ? Math.sin(ts * 38) * Math.exp(-ts * 9) * 0.07 : 0, hahn = ts < 0.06 ? ts / 0.06 : Math.max(0, 1 - (ts - 0.06) / 0.3), hahnW = hahn * hahn * (3 - 2 * hahn);
    ['index', 'middle', 'ring', 'pinky'].forEach((f, i) => { const o = HAND.offen[f], z = HAND.zeigen[f];
      for (let j = 0; j < 3; j++) { let w = o[j] + (z[j] - o[j]) * a + leben(i, j) * (i === 0 ? 0.6 : 1 - 0.5 * a);
        if (i === 0) w += (-0.16 * ruck + feder) * (j === 0 ? 1 : 0.6) * a; else w += 0.1 * ruck * a;
        setz(f + '_' + (j + 1), w); } });
    for (let j = 0; j < 3; j++) { const o = HAND.offen.thumb[j], z = HAND.zeigen.thumb[j], h = HAND.hahn[j]; setz('thumb_' + (j + 1), o[0] + (z[0] - o[0]) * a + h[0] * hahnW * a + leben(5, j), o[1] + (z[1] - o[1]) * a + h[1] * hahnW * a, o[2] + (z[2] - o[2]) * a + h[2] * hahnW * a); }
    setz('hand', -0.1 * ruck * a + Math.sin(t * 1.3) * 0.012, Math.sin(t * 0.8) * 0.01, Math.sin(t * 1.05 + 1) * 0.015);       // Handgelenk gibt beim Schuss nach
  }

  // ------------------------------------------------------------ Toene, alle erzeugt
  rauschen() { const c = this.ton.ctx; if (!this.rb) { this.rb = c.createBuffer(1, c.sampleRate * 0.7, c.sampleRate); const d = this.rb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const q = c.createBufferSource(); q.buffer = this.rb; return q; }
  klang(art, laut = 1) {
    const T = this.ton; if (!T.ctx || !T.an || T.ctx.state !== 'running') return; const c = T.ctx, t = c.currentTime; const raus = (g, hall = 0.6) => { g.connect(T.aus); if (hall) { const h = c.createGain(); h.gain.value = hall; g.connect(h); h.connect(T.hall); } };
    if (art === 'schuss') {
      const q = this.rauschen(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 1.3; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(520, t + 0.11); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * laut, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); q.connect(f); f.connect(g); raus(g, 0.35); q.start(t, Math.random() * 0.4, 0.2);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(680 + Math.random() * 120, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.1); og.gain.setValueAtTime(0.3 * laut, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.13); o.connect(og); raus(og, 0.3); o.start(t); o.stop(t + 0.15);
    } else if (art === 'platsch') {
      const q = this.rauschen(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.2); g.gain.setValueAtTime(0.75 * laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24); q.connect(f); f.connect(g); raus(g, 0.8); q.start(t, Math.random() * 0.4, 0.3);
      const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12); og.gain.setValueAtTime(0.4 * laut, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(og); raus(og, 0.4); o.start(t); o.stop(t + 0.18);
      for (let i = 0; i < 4; i++) { const z = t + 0.03 + Math.random() * 0.16, b = c.createOscillator(), bg = c.createGain(); const fq = 700 + Math.random() * 1500; b.frequency.setValueAtTime(fq, z); b.frequency.exponentialRampToValueAtTime(fq * 1.9, z + 0.035); bg.gain.setValueAtTime(0.0001, z); bg.gain.exponentialRampToValueAtTime(0.07 * laut, z + 0.004); bg.gain.exponentialRampToValueAtTime(0.0005, z + 0.05); b.connect(bg); raus(bg, 0.7); b.start(z); b.stop(z + 0.06); }
    } else if (art === 'wisch') {
      const q = this.rauschen(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(4200, t + 0.5); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.18); g.gain.exponentialRampToValueAtTime(0.001, t + 0.62); q.connect(f); f.connect(g); raus(g, 0.9); q.start(t, 0, 0.66);
      [880, 1320, 1760].forEach((fq, i) => { const z = t + 0.3 + i * 0.07, o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = fq; og.gain.setValueAtTime(0.0001, z); og.gain.exponentialRampToValueAtTime(0.06, z + 0.01); og.gain.exponentialRampToValueAtTime(0.0005, z + 0.35); o.connect(og); raus(og, 1); o.start(z); o.stop(z + 0.4); });
    }
  }

  // ------------------------------------------------------------ Tropfen in der Luft
  tropf(p, v, farbe, groesse, leben) { const i = this.tz; this.tz = (this.tz + 1) % this.tN; this.tp.set([p.x, p.y, p.z], i * 3); this.tv.set([v.x, v.y, v.z], i * 3); this.tl[i] = leben; this.ts[i] = groesse; this.tropfen.setColorAt(i, farbe); this.tropfen.instanceColor.needsUpdate = true; this.tropfen.visible = true; this.tAktiv = true; }
  spritzer(p, n, farbe, anzahl, tempo) { const v = new THREE.Vector3(), c = new THREE.Color(farbe); for (let i = 0; i < anzahl; i++) { v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(n, 0.9).normalize().multiplyScalar(tempo * (0.35 + Math.random() * 0.9)); this.tropf(p, v, c, 0.012 + Math.random() * 0.028, 0.35 + Math.random() * 0.45); } }

  // ------------------------------------------------------------ Schuss
  schiesse() {
    if (this.sperre > 0 || !this.hand.visible) return false; if (!this.raum) this.raum = new Raum(this.netze);
    this.sperre = 0.16; this.rueck = 1; this.schussZeit = 0; this.kam.updateMatrixWorld(true); const start = this.spitze.getWorldPosition(new THREE.Vector3()), auge = this.kam.getWorldPosition(new THREE.Vector3()), blick = this.kam.getWorldDirection(new THREE.Vector3());
    const h = this.raum.weit(auge, blick, 70); const ziel = auge.clone().addScaledVector(blick, h ? Math.max(h.t, 1.2) : 45); const TEMPO = 30, G = 9;
    const zeit = ziel.distanceTo(start) / TEMPO; ziel.y += 0.5 * G * zeit * zeit;                                           // Vorhalt: die Kugel faellt, trifft aber das Fadenkreuz
    const v = ziel.sub(start).normalize().multiplyScalar(TEMPO); const farbe = this.farbe();
    const m = new THREE.Mesh(this.kugelGeo, new THREE.MeshBasicMaterial({ color: farbe })); m.position.copy(start); m.frustumCulled = false; this.scene.add(m);
    this.geschosse.push({ m, p: start.clone(), v, farbe, alt: 0, schweif: 0, saat: Math.random() * 9 });
    this.spritzer(start, blick, farbe, 7, 5); this.klang('schuss');
    this.farbNr++; const f = this.farbe(); this.perle.material.color.set(f); this.perle.material.emissive.set(f); this.perle.scale.setScalar(0.01);
    return true;
  }

  // Ein Treffer: grosser Klecks, kleine Spritzer drumherum, an Waenden Tropfen. Alles in einem Netz.
  treffer(punkt, n, farbe, richtung, op = {}) {
    const R = this.raum, A = { pos: [], uv: [], zelle: [], k: [], art: [], lang: [] }, liste = [];
    const klecks = (p, nn, groesse, zelle) => {
      const h = groesse / 2, tiefe = Math.min(0.2, groesse * 0.4); const u = new THREE.Vector3(), v = new THREE.Vector3(); if (Math.abs(nn.y) < 0.92) u.set(0, 1, 0).cross(nn).normalize(); else u.set(1, 0, 0).cross(nn).normalize(); v.crossVectors(nn, u);
      const w = Math.random() * 6.283, cw = Math.cos(w), sw = Math.sin(w); const uu = u.clone().multiplyScalar(cw).addScaledVector(v, sw), vv = v.clone().multiplyScalar(cw).addScaledVector(u, -sw); const r = h * 1.45, P = R.p, NR = R.nr; const zx = (zelle % 2) * 0.5, zy = (zelle >> 1) * 0.5;
      for (const t of R.sammle(p.x - r, p.y - r, p.z - r, p.x + r, p.y + r, p.z + r, liste)) {
        let nx = NR[t * 3], ny = NR[t * 3 + 1], nz = NR[t * 3 + 2]; let nd = nx * nn.x + ny * nn.y + nz * nn.z; if (Math.abs(nd) < 0.14) continue; if (nd < 0) { nx = -nx; ny = -ny; nz = -nz; nd = -nd; }
        let poly = []; for (let e = 0; e < 3; e++) { const x = P[t * 9 + e * 3] - p.x, y = P[t * 9 + e * 3 + 1] - p.y, z = P[t * 9 + e * 3 + 2] - p.z; poly.push([x * uu.x + y * uu.y + z * uu.z, x * vv.x + y * vv.y + z * vv.z, x * nn.x + y * nn.y + z * nn.z]); }
        poly = schneide(poly, 0, 1, h); if (poly.length < 3) continue; poly = schneide(poly, 0, -1, h); if (poly.length < 3) continue; poly = schneide(poly, 1, 1, h); if (poly.length < 3) continue; poly = schneide(poly, 1, -1, h); if (poly.length < 3) continue; poly = schneide(poly, 2, 1, tiefe); if (poly.length < 3) continue; poly = schneide(poly, 2, -1, tiefe); if (poly.length < 3) continue;
        const st = Math.min(1, 0.55 + (nd - 0.14) * 1.5), ab = 0.011 + this.nr % 7 * 0.0004;
        for (let i = 1; i < poly.length - 1; i++) for (const q of [poly[0], poly[i], poly[i + 1]]) { A.pos.push(p.x + uu.x * q[0] + vv.x * q[1] + nn.x * q[2] + nx * ab, p.y + uu.y * q[0] + vv.y * q[1] + nn.y * q[2] + ny * ab, p.z + uu.z * q[0] + vv.z * q[1] + nn.z * q[2] + nz * ab); A.uv.push(q[0] / groesse + 0.5, q[1] / groesse + 0.5); A.zelle.push(zx, zy); A.k.push(st); A.art.push(0); A.lang.push(0); }
      }
    };
    const gross = op.gross ?? (0.55 + Math.random() * 0.5); klecks(punkt, n, gross, Math.random() * 4 | 0);
    // kleine Kleckse: Spritzer fliegen vom Aufprall weg und landen in der Naehe
    const d = new THREE.Vector3(), o = punkt.clone().addScaledVector(n, 0.12);
    for (let i = 0; i < (op.sat ?? 6); i++) { d.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).addScaledVector(n, -0.35 - Math.random() * 0.3).addScaledVector(richtung, 0.25).normalize(); const h = R.strahl(o, d, 1.5); if (h && h.t > 0.16) klecks(o.clone().addScaledVector(d, h.t), h.n, 0.07 + Math.random() * 0.2, Math.random() * 4 | 0); }
    // Tropfen laufen an senkrechten Flaechen herunter
    if (Math.abs(n.y) < 0.45 && (op.tropfen ?? 1) > 0) { const quer = new THREE.Vector3(0, 1, 0).cross(n).normalize(), ab = new THREE.Vector3(0, -1, 0).addScaledVector(n, n.y).normalize(); const anz = op.tropfAnz ?? (2 + (Math.random() * 3 | 0));
      for (let i = 0; i < anz; i++) { const s = punkt.clone().addScaledVector(quer, (Math.random() - 0.5) * gross * 0.42).addScaledVector(ab, gross * (0.02 + Math.random() * 0.14)).addScaledVector(n, 0.02); let L = (0.16 + Math.random() * 0.62) * (op.lauf ?? 1); const h = R.strahl(s, ab, L + 0.06); if (h) L = h.t - 0.03; if (L < 0.07) continue;
        const fest = R.strahl(s.clone().addScaledVector(ab, L * 0.6).addScaledVector(n, 0.05), n.clone().negate(), 0.12); if (!fest) L *= 0.45;                               // unter dem Klecks ist keine Wand mehr: kurzer Tropfen
        const b = 0.026 + Math.random() * 0.03, ver = 0.004 + this.nr % 7 * 0.0004; const e = (sx, sy) => { const q = s.clone().addScaledVector(quer, sx * b / 2).addScaledVector(ab, sy * L).addScaledVector(n, ver - 0.02); A.pos.push(q.x, q.y, q.z); A.uv.push(sx * 0.5 + 0.5, sy); A.zelle.push(0, 0); A.k.push(b); A.art.push(1); A.lang.push(L); };
        e(-1, 0); e(1, 0); e(1, 1); e(-1, 0); e(1, 1); e(-1, 1); } }
    if (A.pos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2)); g.setAttribute('zelle', new THREE.Float32BufferAttribute(A.zelle, 2)); g.setAttribute('k', new THREE.Float32BufferAttribute(A.k, 1)); g.setAttribute('art', new THREE.Float32BufferAttribute(A.art, 1)); g.setAttribute('lang', new THREE.Float32BufferAttribute(A.lang, 1));
      const mat = this.basis.clone(); mat.uniforms.tKlecks.value = this.tex; mat.uniforms.uFarbe.value = new THREE.Color(farbe); mat.uniforms.uLicht.value = this.licht; const m = new THREE.Mesh(g, mat); m.renderOrder = 20 + (this.nr++ % 1000) * 0.001; this.scene.add(m); this.kleckse.push({ m, alt: 0, weg: -1 });
      while (this.kleckse.filter(k => k.weg < 0).length > MAX_KLECKSE) { const a = this.kleckse.find(k => k.weg < 0); a.weg = 0; }
    }
    this.spritzer(punkt.clone().addScaledVector(n, 0.04), n, farbe, op.spritz ?? 16, op.spritzTempo ?? 4.2); if ((op.laut ?? 0.9) > 0) this.klang('platsch', op.laut ?? 0.9);
  }
  // ------------------------------------------------------------ Farbstrahl: E gedrueckt halten
  spruehStart() { if (!this.hand.visible || this.spruehAn) return; if (!this.raum) this.raum = new Raum(this.netze); this.spruehAn = true; this.spruehFarbe = this.farbe(); this.zielT = 0; this.zisch(true); }
  spruehStop() { if (!this.spruehAn) return; this.spruehAn = false; this.zisch(false); this.farbNr++; const f = this.farbe(); this.perle.material.color.set(f); this.perle.material.emissive.set(f); this.perle.scale.setScalar(0.01); }
  // Zischen der Duese: Rauschen durch einen Bandpass, Lautstaerke folgt dem Druck
  zisch(an) {
    const T = this.ton; if (!T.ctx || !T.an || T.ctx.state !== 'running') return; const c = T.ctx, t = c.currentTime;
    if (an && !this.zs) { const q = this.rauschen(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(); q.loop = true; f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 0.8; f2.type = 'lowpass'; f2.frequency.value = 5200; g.gain.value = 0.0001;
      q.connect(f); f.connect(f2); f2.connect(g); g.connect(T.aus); const h = c.createGain(); h.gain.value = 0.35; g.connect(h); h.connect(T.hall); q.start(t); this.zs = { q, f, g }; }
    if (!an && this.zs) { const z = this.zs; this.zs = null; z.g.gain.cancelScheduledValues(t); z.g.gain.setTargetAtTime(0.0001, t, 0.06); z.q.stop(t + 0.4); }
  }
  // ein Teilchen des Strahls
  stromTeil(p, v, groesse) { const i = this.sz; this.sz = (this.sz + 1) % this.sN; this.sp.set([p.x, p.y, p.z], i * 3); this.sv.set([v.x, v.y, v.z], i * 3); this.sl[i] = 2.4; this.sg[i] = groesse; this.strom.setColorAt(i, this.spruehC); this.strom.instanceColor.needsUpdate = true; this.strom.visible = true; this.sAktiv = true; }
  // Aufprall eines Teilchens: sammeln, alle 60 ms wird daraus ein Klecks. Wo es oft hintrifft, wird die Wand nass und laeuft herunter.
  stromTreffer(p, n, d) {
    const a = this.auftrag || (this.auftrag = { p: new THREE.Vector3(), n: new THREE.Vector3(), d: new THREE.Vector3(), k: 0 }); a.p.add(p); a.n.add(n); a.d.add(d); a.k++;
    if (Math.random() < 0.45) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(n, 1.1).addScaledVector(d, -0.25).normalize().multiplyScalar(1.2 + Math.random() * 2.6); this.tropf(p.clone().addScaledVector(n, 0.02), v, this.spruehC, 0.006 + Math.random() * 0.014, 0.25 + Math.random() * 0.35); }
  }
  auftragen() {
    const a = this.auftrag; if (!a || !a.k) return; this.auftrag = null; const p = a.p.divideScalar(a.k), n = a.n.normalize(), d = a.d.normalize();
    const zk = `${Math.round(p.x * 4)},${Math.round(p.y * 4)},${Math.round(p.z * 4)}`, nass = (this.naesse.get(zk) || 0) + a.k; this.naesse.set(zk, nass); if (this.naesse.size > 400) this.naesse.delete(this.naesse.keys().next().value);
    const senkrecht = Math.abs(n.y) < 0.45, laeuft = senkrecht && nass > 14 && Math.random() < Math.min(0.75, nass / 70);
    const gross = Math.min(0.62, 0.14 + 0.055 * Math.sqrt(a.k) * (0.7 + Math.random() * 0.6) + Math.min(0.18, nass * 0.0025));
    const laut = this.platschT <= 0 ? 0.22 : 0; if (laut) this.platschT = 0.09 + Math.random() * 0.06;
    this.treffer(p, n, this.spruehFarbe, d, { gross, sat: a.k > 5 ? 1 + (Math.random() * 2 | 0) : (Math.random() < 0.3 ? 1 : 0), tropfen: laeuft ? 1 : 0, tropfAnz: 1 + (Math.random() * 2 | 0), lauf: 1 + Math.min(2.2, nass / 40), spritz: 3, spritzTempo: 2.6, laut });
  }
  spruehen(dt, s) {
    const an = this.spruehAn && this.hand.visible; this.druck += ((an ? 1 : 0) - this.druck) * (1 - Math.exp(-dt * (an ? 7 : 14))); this.platschT -= dt; this.figurT -= dt;
    if (an) {
      if (!this.spruehC) this.spruehC = new THREE.Color(); this.spruehC.set(this.spruehFarbe); const t = this.zeit || 0;
      // Druck schwankt wie bei einer echten Duese: schnelles Pulsieren, langsames Atmen, kleine Aussetzer
      const puls = 0.84 + 0.07 * Math.sin(t * 27.0) + 0.06 * Math.sin(t * 8.3 + 1.7) + 0.04 * Math.sin(t * 2.1) - (Math.sin(t * 5.3) > 0.97 ? 0.15 : 0);
      if (this.zs) this.zs.g.gain.setTargetAtTime(0.13 * this.druck * puls, this.ton.ctx.currentTime, 0.03), this.zs.f.frequency.setTargetAtTime(1900 + 900 * puls, this.ton.ctx.currentTime, 0.05);
      this.rueck = Math.max(this.rueck, 0.1 + 0.05 * Math.sin(t * 33) * this.druck); this.schussZeit = 0.5;
      this.kam.updateMatrixWorld(true); const start = this.spitze.getWorldPosition(new THREE.Vector3()), auge = this.kam.getWorldPosition(new THREE.Vector3()), blick = this.kam.getWorldDirection(new THREE.Vector3());
      this.zielT -= dt; if (this.zielT <= 0) { this.zielT = 0.08; const h = this.raum.weit(auge, blick, 40); this.strahlZiel.copy(auge).addScaledVector(blick, h ? Math.max(h.t, 0.6) : 9); this.zielFrei = !h; }
      const V = 14.5 * puls, G = 9.81, ziel = this.strahlZiel.clone(), flug = Math.min(ziel.distanceTo(start), 9) / V; if (!this.zielFrei) ziel.y += 0.5 * G * flug * flug * 0.85;      // Vorhalt nur bei echtem Ziel, ins Leere faellt der Strahl im Bogen
      const d0 = ziel.sub(start).normalize(), quer = new THREE.Vector3().crossVectors(d0, new THREE.Vector3(0, 1, 0)).normalize(), hoch = new THREE.Vector3().crossVectors(quer, d0);
      // der Strahl schlaengelt sich leicht: zwei langsame Schwingungen quer und hoch
      const sx = 0.022 * Math.sin(t * 3.1) + 0.012 * Math.sin(t * 7.7 + 2.0), sy = 0.018 * Math.sin(t * 2.3 + 1.0) + 0.01 * Math.sin(t * 6.1);
      this.emitRest += 190 * this.druck * dt; const v = new THREE.Vector3(), q = new THREE.Vector3();
      while (this.emitRest >= 1) { this.emitRest -= 1; const g1 = (Math.random() + Math.random() + Math.random() - 1.5) * 0.016, g2 = (Math.random() + Math.random() + Math.random() - 1.5) * 0.016;
        v.copy(d0).addScaledVector(quer, sx + g1).addScaledVector(hoch, sy + g2).normalize().multiplyScalar(V * (0.95 + Math.random() * 0.1)); q.copy(start).addScaledVector(v, Math.random() * dt);
        this.stromTeil(q, v, (0.0055 + Math.random() * 0.0075) * (0.55 + 0.55 * this.druck)); }
      if (Math.random() < dt * 14) this.tropf(start, d0.clone().multiplyScalar(2.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 0.8, (Math.random() - 0.5) * 1.6)), this.spruehC, 0.005 + Math.random() * 0.008, 0.3);    // Nebel an der Duese
    }
    // Teilchen fliegen: Schwerkraft, Luftwiderstand, Treffer gegen Welt und Figuren
    if (this.sAktiv) { const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), v = new THREE.Vector3(), d = new THREE.Vector3(), S = new THREE.Vector3(); let lebt = false;
      for (let i = 0; i < this.sN; i++) { if (this.sl[i] <= 0) continue; const k = i * 3; this.sl[i] -= dt; p.set(this.sp[k], this.sp[k + 1], this.sp[k + 2]); v.set(this.sv[k], this.sv[k + 1], this.sv[k + 2]);
        v.y -= 9.81 * dt; v.multiplyScalar(Math.exp(-0.4 * dt)); const l = v.length() * dt; d.copy(v).divideScalar(Math.max(v.length(), 1e-6)); let tot = this.sl[i] <= 0 || p.y < -40;
        if (!tot) { const h = this.raum.strahl(p, d, l + 0.01); let figur = null;
          if (s.ziele) for (const z of s.ziele) if (Math.hypot(p.x - z.x, p.z - z.z) < z.r && p.y > z.y - 0.05 && p.y < z.y + z.h + 0.05) { figur = z; break; }
          if (figur) { if (this.figurT <= 0) { this.figurT = 0.3; if (figur.treffer) figur.treffer(this.spruehFarbe); this.spritzer(p, d.clone().negate(), this.spruehFarbe, 6, 2.5); } tot = true; }
          else if (h) { this.stromTreffer(p.clone().addScaledVector(d, h.t), h.n, d); tot = true; }
          else p.addScaledVector(d, l); }
        if (tot) { this.sl[i] = 0; M.makeScale(0, 0, 0); this.strom.setMatrixAt(i, M); continue; }
        this.sp[k] = p.x; this.sp[k + 1] = p.y; this.sp[k + 2] = p.z; this.sv[k] = v.x; this.sv[k + 1] = v.y; this.sv[k + 2] = v.z; lebt = true;
        // gestreckt in Flugrichtung, damit die Tropfen zu einem Seil zusammenwachsen; vorne duenner, Wabbeln je Teilchen
        const gr = this.sg[i] * (1 + 0.15 * Math.sin(this.sl[i] * 40 + i)), lang = Math.max(gr * 1.6, v.length() * 0.0065); Q.setFromUnitVectors(Z, d); S.set(gr, gr, lang); M.compose(p, Q, S); this.strom.setMatrixAt(i, M); }
      this.strom.instanceMatrix.needsUpdate = true; this.sAktiv = lebt; this.strom.visible = lebt; }
    this.auftragT -= dt; if (this.auftragT <= 0) { this.auftragT = 0.06; this.auftragen(); }
  }
  // Autofokus der Ich Ansicht: Abstand vom Auge zur Welt in Blickrichtung
  fokus() { if (!this.raum) this.raum = new Raum(this.netze); this.kam.updateMatrixWorld(true); const h = this.raum.weit(this.kam.getWorldPosition(new THREE.Vector3()), this.kam.getWorldDirection(new THREE.Vector3()), 60); return h ? h.t : 60; }
  // rechte Maustaste: alles loest sich auf
  leeren() { let n = 0; for (const k of this.kleckse) if (k.weg < 0) { k.weg = 0; n++; } if (n) { this.klang('wisch'); this.rueck = Math.max(this.rueck, 0.45); } return n; }
  anzahl() { return this.kleckse.filter(k => k.weg < 0).length; }

  // s: { fp, tempo, gier, neig, ziele: [{x,y,z,r,h}] in Three Koordinaten, licht }
  update(dt, s) {
    this.sperre -= dt; this.licht = s.licht ?? 1; const an = !!s.fp; this.heben += ((an ? 1 : 0) - this.heben) * (1 - Math.exp(-dt * (an ? 7 : 12))); this.hand.visible = this.heben > 0.02;
    if (this.hand.visible) {
      // Hand: Rueckstoss als Feder, traeges Nachziehen beim Umsehen, Wippen beim Gehen, Atmen. Vor einer Wand zieht sie sich zurueck.
      this.rueck *= Math.exp(-dt * 9); if (this.altGier === null) { this.altGier = s.gier; this.altNeig = s.neig; } let dg = s.gier - this.altGier; if (dg > Math.PI) dg -= 2 * Math.PI; if (dg < -Math.PI) dg += 2 * Math.PI; const dn = s.neig - this.altNeig; this.altGier = s.gier; this.altNeig = s.neig;
      this.schwung.x += (THREE.MathUtils.clamp(dg * 3.5, -0.2, 0.2) - this.schwung.x) * (1 - Math.exp(-dt * 8)); this.schwung.y += (THREE.MathUtils.clamp(dn * 3.5, -0.2, 0.2) - this.schwung.y) * (1 - Math.exp(-dt * 8));
      const geh = Math.min(1, s.tempo / 2.2); this.gang += dt * (5 + s.tempo * 2.2) * geh; this.zeit = (this.zeit || 0) + dt; const t = this.zeit;
      if (this.raum && an) { this.nt = (this.nt || 0) - dt; if (this.nt <= 0) { this.nt = 0.1; const h = this.raum.strahl(this.kam.getWorldPosition(new THREE.Vector3()), this.kam.getWorldDirection(new THREE.Vector3()), 0.9); this.nahZiel = h ? THREE.MathUtils.clamp((0.85 - h.t) / 0.45, 0, 1) : 0; } } this.naehe += ((this.nahZiel || 0) - this.naehe) * (1 - Math.exp(-dt * 8));
      const r = this.rueck, stoss = Math.sin(Math.min(1, (1 - r) * 6) * Math.PI * 0.5) * r, H = this.hand;
      const tanH = Math.tan(this.kam.fov * Math.PI / 360) * this.kam.aspect, hoch = this.kam.aspect < 1, x0 = Math.min(0.17, 0.62 * 0.47 * tanH), y0 = hoch ? -0.16 : -0.165;       // im Hochformat rueckt die Hand zur Mitte und hoeher, damit man sie ganz sieht
      H.position.set(x0 + this.schwung.x * 0.12 + Math.cos(this.gang) * 0.006 * geh, y0 - (1 - this.heben) * 0.32 + Math.sin(t * 1.6) * 0.003 - Math.abs(Math.sin(this.gang)) * 0.012 * geh - this.schwung.y * 0.1 + stoss * 0.02 - this.naehe * 0.06, -0.47 + stoss * 0.075 + this.naehe * 0.2);
      H.rotation.set(0.03 + stoss * 0.3 + (1 - this.heben) * -0.9 + this.schwung.y * 0.5 + this.naehe * 0.55, (hoch ? 0.36 : 0.16 + x0 * 0.9) + this.schwung.x * 0.6, (this.K ? 0.42 : -0.16) + this.schwung.x * 0.4 + Math.sin(t * 1.1) * 0.012);
      this.fingerPose(dt, stoss);
      this.d1.rotation.x = 1.05 - stoss * 1.0; this.z1.rotation.x = stoss * 0.22; this.z2.rotation.x = -stoss * 0.28; this.z3.rotation.x = -stoss * 0.2;
      const ps = Math.min(1, this.perle.scale.x + dt * 5); this.perle.scale.setScalar(ps * (1 + 0.08 * Math.sin(t * 5)));
    }
    if (this.raum) this.spruehen(dt, s);
    // Farbkugeln: Flugbahn mit Schwerkraft, Treffer gegen die Welt und gegen Figuren
    for (let i = this.geschosse.length - 1; i >= 0; i--) {
      const g = this.geschosse[i]; g.alt += dt; g.v.y -= 9 * dt; const l = g.v.length() * dt, d = g.v.clone().normalize(); let fertig = false;
      const h = this.raum.strahl(g.p, d, l + 0.02); let tz = h ? h.t : 1e9, figur = null;
      if (s.ziele) for (const z of s.ziele) { const ex = g.p.x + d.x * l * 0.5 - z.x, ez = g.p.z + d.z * l * 0.5 - z.z; if (Math.hypot(ex, ez) < z.r + l * 0.5 && g.p.y > z.y - 0.1 && g.p.y < z.y + z.h + 0.1) { const t2 = Math.max(0, Math.hypot(g.p.x - z.x, g.p.z - z.z) - z.r); if (t2 < tz) { tz = t2; figur = z; } } }
      if (figur) { const p = g.p.clone().addScaledVector(d, Math.min(tz, l)); this.spritzer(p, d.clone().negate(), g.farbe, 22, 4.5); this.klang('platsch', 0.7); if (figur.treffer) figur.treffer(g.farbe); fertig = true; }
      else if (h) { this.treffer(g.p.clone().addScaledVector(d, h.t), h.n, g.farbe, d); fertig = true; }
      else { g.p.addScaledVector(d, l); g.m.position.copy(g.p); g.m.lookAt(g.p.clone().add(d)); const w = 1 + 0.18 * Math.sin(g.alt * 46 + g.saat), gr = Math.min(1, g.alt * 30 + 0.3) * 0.05; g.m.scale.set(gr * w, gr / w, gr * 2.3);
        g.schweif -= dt; if (g.schweif <= 0) { g.schweif = 0.014; this.tropf(g.p.clone().addScaledVector(d, -0.1), new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2).addScaledVector(g.v, 0.25), new THREE.Color(g.farbe), 0.008 + Math.random() * 0.016, 0.3); }
        if (g.alt > 4 || g.p.y < -40) fertig = true; }
      if (fertig) { this.scene.remove(g.m); g.m.material.dispose(); this.geschosse.splice(i, 1); }
    }
    // Kleckse altern, aufgeloeste verschwinden
    for (let i = this.kleckse.length - 1; i >= 0; i--) { const k = this.kleckse[i], u = k.m.material.uniforms; k.alt += dt; u.uAlter.value = k.alt; u.uLicht.value = this.licht; if (k.weg >= 0) { k.weg += dt * 2.1; u.uWeg.value = k.weg; if (k.weg >= 1.5) { this.scene.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); this.kleckse.splice(i, 1); } } }
    // Tropfen in der Luft
    if (this.tAktiv) { const M = new THREE.Matrix4(); let lebt = false; for (let i = 0; i < this.tN; i++) { if (this.tl[i] <= 0) continue; this.tl[i] -= dt; const k = i * 3; this.tv[k + 1] -= 9 * dt; this.tp[k] += this.tv[k] * dt; this.tp[k + 1] += this.tv[k + 1] * dt; this.tp[k + 2] += this.tv[k + 2] * dt;
        const gr = this.tl[i] > 0 ? this.ts[i] * Math.min(1, this.tl[i] * 6) : 0; M.makeScale(gr, gr, gr); M.setPosition(this.tp[k], this.tp[k + 1], this.tp[k + 2]); this.tropfen.setMatrixAt(i, M); if (this.tl[i] > 0) lebt = true; }
      this.tropfen.instanceMatrix.needsUpdate = true; this.tAktiv = lebt; this.tropfen.visible = lebt; }
  }
}
