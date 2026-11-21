// Leben in und um das Haus: Voegel (nah und am Horizont), Schmetterlinge, Katzen und Berberaffen, dazu der Hologramm Tisch.
import * as THREE from 'three';
const B = (x, y, z) => new THREE.Vector3(x, z, -y);
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

// ================================================================= Voegel
// Jeder Vogel: Rumpf, Kopf, Schwanz und zwei zweigliedrige Fluegel. Der Fluegelschlag laeuft im Shader, die Bahn in JS.
export class Voegel {
  constructor(scene) {
    const pos = [], teil = [];          // teil: x = Abstand vom Rumpf (0..1), y = Seite (-1, 0, 1)
    const tri = (a, b, c, ta, tb, tc) => { pos.push(...a, ...b, ...c); teil.push(...ta, ...tb, ...tc); };
    // Rumpf als gestreckte Raute, Nase bei +z
    const N = [0, 0, 0.34], S = [0, 0, -0.3], O = [0, 0.055, 0.02], U = [0, -0.05, 0.0], L = [0.06, 0, 0.03], R = [-0.06, 0, 0.03], Z = [0, 0];
    for (const [a, b, c] of [[N, L, O], [N, O, R], [N, U, L], [N, R, U], [S, O, L], [S, R, O], [S, L, U], [S, U, R]]) tri(a, b, c, Z, Z, Z);
    tri([0, 0.01, -0.28], [0.09, 0, -0.5], [-0.09, 0, -0.5], Z, Z, Z);                                   // Schwanzfaecher
    for (const s of [1, -1]) {                                                                             // Fluegel: innen breit, aussen spitz und nach hinten gezogen
      const a = [s * 0.05, 0.02, 0.14], b = [s * 0.05, 0.02, -0.12], c = [s * 0.5, 0.02, 0.1], d = [s * 0.5, 0.02, -0.14], e = [s * 1.0, 0.02, -0.12], f = [s * 0.78, 0.02, 0.04];
      const t = (p) => [Math.abs(p[0]), s];
      tri(a, c, b, t(a), t(c), t(b)); tri(b, c, d, t(b), t(c), t(d)); tri(c, f, d, t(c), t(f), t(d)); tri(f, e, d, t(f), t(e), t(d));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('teil', new THREE.Float32BufferAttribute(teil, 2)); geo.computeVertexNormals();
    this.n = 46; const phase = new Float32Array(this.n); for (let i = 0; i < this.n; i++) phase[i] = Math.random() * 6.28;
    geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phase, 1));
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { uZeit: { value: 0 } },
      vertexShader: /* glsl */`attribute vec2 teil; attribute float phase; uniform float uZeit; varying float vH; varying vec3 vN;
        void main(){ vec3 p = position; float t = uZeit * 7.5 + phase; float gleiten = smoothstep(0.55, 0.9, sin(uZeit * 0.31 + phase * 3.0));        // ab und zu segeln sie
          float schlag = sin(t) * (1.0 - gleiten) + 0.25 * gleiten; float knick = sin(t - 0.9) * (1.0 - gleiten) + 0.1 * gleiten;
          float innen = min(teil.x, 0.5), aussen = max(teil.x - 0.5, 0.0);
          p.y += innen * schlag * 0.62 + aussen * knick * 1.15; p.x *= 1.0 - 0.16 * abs(schlag) * step(0.01, teil.x);                                  // Fluegel hebt sich, Spitze laeuft nach
          p.y -= schlag * 0.035 * (1.0 - step(0.01, teil.x));                                                                                        // der Rumpf wippt dagegen
          vH = p.y; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0); }`,
      fragmentShader: `varying float vH; varying vec3 vN; void main(){ float l = 0.5 + 0.5 * abs(vN.y); vec3 c = mix(vec3(0.012, 0.012, 0.022), vec3(0.09, 0.055, 0.05), l * 0.7); gl_FragColor = vec4(c, 1.0); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.n); this.mesh.frustumCulled = false; this.mesh.userData.nichtSpiegeln = true; scene.add(this.mesh);
    // Schwaerme: zwei kreisen ums Haus, einer zieht hoch durch die Halle unterm Glasdach, drei weit draussen am Horizont
    this.v = []; const schwarm = [[8, 34, 15, 0.16, 1.0, 0], [7, 52, 26, -0.11, 1.15, 2], [5, 9, 16.5, 0.34, 0.5, 4], [9, 260, 30, 0.021, 4.2, 1], [9, 330, 44, -0.016, 5.0, 3], [8, 420, 60, 0.012, 6.0, 5]];
    for (const [anz, radius, hoehe, tempo, gross, saat] of schwarm) for (let i = 0; i < anz; i++) this.v.push({ radius: radius * (0.9 + Math.random() * 0.2), hoehe: hoehe + (Math.random() - 0.5) * (gross > 2 ? 14 : 3), tempo, gross: gross * (0.85 + Math.random() * 0.3), w: saat + i * (gross > 2 ? 0.035 : 0.11) + Math.random() * 0.05, ex: 0.7 + Math.random() * 0.25, s: Math.random() * 10 });
    this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.p2 = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.sk = new THREE.Vector3(); this.mm = new THREE.Matrix4();
  }
  bahn(o, t, ziel) { const w = o.w + t * o.tempo; ziel.set(20 + Math.cos(w) * o.radius, o.hoehe + Math.sin(t * 0.21 + o.s) * (o.gross > 2 ? 3 : 1.4) + Math.sin(w * 3.0 + o.s) * 0.8, -20 + Math.sin(w) * o.radius * o.ex); }
  update(zeit) {
    this.mat.uniforms.uZeit.value = zeit;
    for (let i = 0; i < this.n; i++) { const o = this.v[i]; this.bahn(o, zeit, this.p); this.bahn(o, zeit + 0.25, this.p2); this.mm.lookAt(this.p2, this.p, AY);     // Nase (+z) zeigt in Flugrichtung
      this.q.setFromRotationMatrix(this.mm); q1.setFromAxisAngle(AZ, -Math.sign(o.tempo) * 0.32); this.q.multiply(q1);                                      // in die Kurve legen
      this.sk.setScalar(o.gross); this.m.compose(this.p, this.q, this.sk); this.mesh.setMatrixAt(i, this.m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ================================================================= Schmetterlinge
export class Falter {
  constructor(scene, nav) {
    const lader = new THREE.TextureLoader(); this.liste = [];
    const orte = nav.baeume.map(b => B(b[0], b[1], b[2])); orte.push(B(13.2, 13.2, 1.2), B(1, 8, 1.2), B(25.2, 33.5, 11.2), B(18, 18, 6.6), B(7, 7, 2.2), B(30, 29.5, 11.4), B(5, 33, 6.4), B(34, 6, 6.4), B(10.6, 38.6, 6.3), B(27.5, 10.6, 1.3), B(33, 25.2, 11.2), B(20, 30, 1.6));
    ['falter_a.png', 'falter_b.png'].forEach((datei, k) => {
      const t = lader.load('./assets/tex/' + datei); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide, color: new THREE.Color(k ? 1.5 : 1.25, k ? 1.5 : 1.2, k ? 1.7 : 1.1) });
      for (let i = 0; i < (k ? 13 : 17); i++) {
        const g = new THREE.Group(); const fl = [];
        for (const s of [1, -1]) { const geo = new THREE.PlaneGeometry(0.5, 1); geo.translate(0.25, 0, 0); const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, s > 0 ? 0.5 + uv.getX(j) * 0.5 : 0.5 - uv.getX(j) * 0.5);
          const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; const h = new THREE.Group(); h.add(m); h.scale.x = s; g.add(h); fl.push(h); }
        const gr = 0.11 + Math.random() * 0.05; g.scale.setScalar(gr); g.userData.nichtSpiegeln = true; scene.add(g);
        this.liste.push({ g, fl, ort: orte[(i * 5 + k * 7) % orte.length], s: Math.random() * 100, r: 0.9 + Math.random() * 1.8, v: 0.5 + Math.random() * 0.5, alt: new THREE.Vector3() });
      }
    });
    this.p = new THREE.Vector3();
  }
  update(zeit, dt) {
    for (const f of this.liste) { const t = zeit * f.v + f.s;
      this.p.set(f.ort.x + Math.sin(t * 0.7) * f.r + Math.sin(t * 1.9) * 0.4, f.ort.y - 0.4 + Math.sin(t * 1.1) * 0.7 + Math.sin(t * 5.0) * 0.06, f.ort.z + Math.cos(t * 0.53) * f.r + Math.cos(t * 2.3) * 0.4);
      const dx = this.p.x - f.alt.x, dz = this.p.z - f.alt.z; if (dx * dx + dz * dz > 1e-7) f.g.rotation.y = Math.atan2(dx, dz); f.alt.copy(this.p); f.g.position.copy(this.p);
      const sitzt = Math.sin(t * 0.23) > 0.86; const w = sitzt ? 0.5 + 0.35 * Math.sin(t * 2.0) : 0.15 + Math.abs(Math.sin(t * 11.0)) * 1.15;          // flattern, manchmal ruhig
      f.fl[0].rotation.z = w; f.fl[1].rotation.z = -w; }
  }
}

// ================================================================= Vierbeiner: Gang direkt an den Knochen
// Modellraum wie bei den Figuren: Blick +Z, oben +Y, links +X. Drehung um X: negativ = Bein nach vorn, positiv = Unterbein beugen, negativ = Kopf heben, positiv = Schwanz heben.
export class Vierbeiner {
  constructor(modell, schulter) {
    this.modell = modell; this.h = schulter; this.k = {}; this.ruhe = {}; this.welt = {}; this.d = {};
    modell.updateMatrixWorld(true); const inv = modell.getWorldQuaternion(new THREE.Quaternion()).invert();
    modell.traverse(o => { if (o.isBone) { this.k[o.name] = o; this.ruhe[o.name] = o.quaternion.clone(); this.welt[o.name] = o.getWorldQuaternion(new THREE.Quaternion()).premultiply(inv); this.d[o.name] = new THREE.Quaternion(); } });
    this.phase = Math.random() * 6; this.gang = 0; this.zeit = Math.random() * 9; this.sitz = 0;
  }
  dreh(n, a, w) { const d = this.d[n]; if (d && w) d.premultiply(q1.setFromAxisAngle(a, w)); }
  update(dt, tempo, sitzen) {
    this.zeit += dt; const t = this.zeit; for (const n in this.d) this.d[n].identity();
    this.gang += (Math.min(1, tempo / 0.5) - this.gang) * (1 - Math.exp(-dt * 8)); this.sitz += ((sitzen ? 1 : 0) - this.sitz) * (1 - Math.exp(-dt * 4));
    this.phase += Math.PI * tempo * dt / (this.h * 0.95); const g = this.gang, p = this.phase, A = 0.42 * g;
    // Kreuzgang: vorn links mit hinten rechts, dazu leicht versetzt wie beim Schreiten
    const bein = (ober, unter, ph) => { const s = Math.sin(p + ph), c = Math.cos(p + ph); this.dreh(ober, AX, -A * s - 0.05 * g); this.dreh(unter, AX, 0.75 * g * Math.pow(0.5 + 0.5 * c, 2.0) + 0.1 * g * Math.max(0, -s)); };
    bein('fl_upper', 'fl_lower', 0); bein('br_upper', 'br_lower', 0.5); bein('fr_upper', 'fr_lower', Math.PI); bein('bl_upper', 'bl_lower', Math.PI + 0.5);
    this.dreh('spine', AY, 0.07 * Math.sin(p) * g); this.dreh('hips', AY, -0.07 * Math.sin(p) * g); this.dreh('spine', AZ, 0.03 * Math.sin(p) * g);
    this.dreh('head', AX, -0.08 - 0.04 * Math.sin(2 * p) * g + 0.05 * Math.sin(t * 0.9) * (1 - g)); this.dreh('head', AY, 0.3 * Math.sin(t * 0.43) * (1 - g) + 0.05 * Math.sin(p) * g);
    this.dreh('tail', AX, 0.55 + 0.12 * Math.sin(t * 1.3)); this.dreh('tail', AY, 0.3 * Math.sin(t * 1.7)); this.dreh('tail_2', AX, 0.35 + 0.2 * Math.sin(t * 1.3 + 1)); this.dreh('tail_2', AY, 0.4 * Math.sin(t * 1.7 + 0.8));
    // Sitzen: Hinterteil runter, Hinterbeine eingeklappt, Vorderbeine gestreckt
    const s = this.sitz * (1 - g); if (s > 0.01) { this.dreh('hips', AX, -0.75 * s); this.dreh('spine', AX, 0.32 * s); this.dreh('bl_upper', AX, -1.0 * s); this.dreh('br_upper', AX, -1.0 * s); this.dreh('bl_lower', AX, 1.5 * s); this.dreh('br_lower', AX, 1.5 * s); this.dreh('fl_upper', AX, 0.42 * s); this.dreh('fr_upper', AX, 0.42 * s); this.dreh('head', AX, -0.35 * s); }
    for (const n in this.d) { const W = this.welt[n]; q2.copy(W).invert().multiply(this.d[n]).multiply(W); this.k[n].quaternion.copy(this.ruhe[n]).multiply(q2); }
    this.modell.position.y = this.h * (0.02 * g * Math.cos(2 * p) - 0.03 * g) - this.h * 0.34 * s + this.h * 0.006 * Math.sin(t * 1.9) * (1 - g);
  }
}

// ================================================================= Hologramm Tisch
export class Holo {
  constructor(scene, ort, agenten) {
    const g = this.g = new THREE.Group(); g.position.copy(ort); g.userData.nichtSpiegeln = true; scene.add(g); this.zeit = 0; this.puls = 0;
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
    // Tischplatte: Radar mit Ringen, Raster, laufendem Suchstrahl und Wellen
    this.platte = new THREE.Mesh(new THREE.CircleGeometry(1.64, 96), new THREE.ShaderMaterial({ ...add, uniforms: { uZeit: { value: 0 }, uPuls: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`precision highp float; varying vec2 vP; uniform float uZeit, uPuls;
        void main(){ float r = length(vP) / 1.64, a = atan(vP.y, vP.x); vec3 c = vec3(0.0);
          float ringe = smoothstep(0.035, 0.0, abs(fract(r * 5.0) - 0.5) - 0.455); c += vec3(0.1, 0.9, 0.8) * ringe * 0.5;
          float speichen = smoothstep(0.02, 0.0, abs(fract(a * 3.8197 + 0.5) - 0.5) * r - 0.004) * step(0.2, r); c += vec3(0.1, 0.8, 0.75) * speichen * 0.35;
          vec2 h = vP * 7.0; h.x += floor(h.y) * 0.5; float wabe = smoothstep(0.46, 0.5, max(abs(fract(h.x) - 0.5), abs(fract(h.y) - 0.5))); c += vec3(0.05, 0.5, 0.5) * wabe * 0.18 * (0.6 + 0.4 * sin(uZeit + r * 9.0));
          float strahl = pow(max(0.0, 1.0 - mod(a - uZeit * 0.9, 6.2832) / 1.6), 2.0); c += vec3(0.25, 1.0, 0.9) * strahl * 0.55 * step(r, 0.98);
          float welle = smoothstep(0.03, 0.0, abs(r - fract(uZeit * 0.22)) ) + smoothstep(0.03, 0.0, abs(r - fract(uZeit * 0.22 + 0.5))); c += vec3(0.3, 1.0, 0.95) * welle * 0.6 * (1.0 - r);
          c += vec3(1.0, 0.75, 0.35) * smoothstep(0.05, 0.0, abs(r - uPuls)) * 1.4 * (1.0 - uPuls);                       // goldene Welle bei einem echten Ereignis
          float rand = smoothstep(0.03, 0.0, abs(r - 0.975)) * 1.3 + smoothstep(1.0, 0.99, r) * 0.05; c += vec3(0.3, 1.0, 0.92) * rand; c += vec3(0.02, 0.2, 0.2) * (1.0 - r);
          gl_FragColor = vec4(c * step(r, 1.0), 1.0); }` }));
    this.platte.rotation.x = -Math.PI / 2; this.platte.position.y = 0.012; g.add(this.platte);
    // Kern: Drahtkugel als Netz der Agenten, dreht sich
    this.kern = new THREE.Group(); this.kern.position.y = 1.15; g.add(this.kern);
    this.kern.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 2)), new THREE.LineBasicMaterial({ color: new THREE.Color(0.15, 1.3, 1.15), ...add, opacity: 0.55 })));
    this.innen = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.36, 1)), new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 0.9, 0.35), ...add, opacity: 0.8 })); this.kern.add(this.innen);
    const punkt = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    // Ringe um den Kern
    this.ringe = [[1.0, 0.5, 0.2], [1.18, -0.35, 1.1], [0.86, 1.2, 2.2]].map(([r, kx, kz]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.25), ...add, opacity: 0.7 })); m.rotation.set(kx, 0, kz); this.kern.add(m); return m; });
    // Ein Knoten je Agent, mit Linie zum Kern. Bei einem echten Ereignis leuchtet er auf.
    const farben = { brain: '#ffd27a', coder: '#5fd0ff', maler: '#ff8a5c', film: '#ff6fae', funk: '#7dffb0', scout: '#ffe066', feld: '#c9ff6a', archiv: '#b79cff' };
    this.knoten = {}; let i = 0; const lp = [];
    for (const id of agenten) { const w = i++ / agenten.length * 6.2832, p = new THREE.Vector3(Math.cos(w) * 1.25, 0.25 * Math.sin(w * 3), Math.sin(w) * 1.25);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: punkt, color: new THREE.Color(farben[id] || '#7ff').multiplyScalar(1.6), ...add })); s.position.copy(p); s.scale.setScalar(0.16); this.kern.add(s); this.knoten[id] = { s, glut: 0 }; lp.push(0, 0, 0, p.x, p.y, p.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); this.kern.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.15, 0.9, 0.85), ...add, opacity: 0.35 })));
    // Lichtsaeule und aufsteigende Funken
    this.saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, 3.4, 48, 1, true), new THREE.ShaderMaterial({ ...add, uniforms: { uZeit: { value: 0 } },
      vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float; varying vec2 vU; uniform float uZeit; void main(){ float s = 0.5 + 0.5 * sin(vU.x * 150.0 + uZeit * 1.5); float z = smoothstep(0.03, 0.0, abs(fract(vU.y * 3.0 - uZeit * 0.35) - 0.5) - 0.46); float a = pow(1.0 - vU.y, 2.2) * (0.06 + 0.07 * s) + z * 0.1 * (1.0 - vU.y); gl_FragColor = vec4(vec3(0.15, 1.0, 0.9) * a, 1.0); }` }));
    this.saeule.position.y = 1.7; g.add(this.saeule);
    const N = 260, fp = new Float32Array(N * 3), fz = new Float32Array(N); for (let k = 0; k < N; k++) fz[k] = Math.random();
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('zufall', new THREE.BufferAttribute(fz, 1));
    this.funken = new THREE.Points(fg, new THREE.ShaderMaterial({ ...add, uniforms: { uZeit: { value: 0 }, uGroesse: { value: 2 }, tP: { value: punkt }, uStoss: { value: 0 } },
      vertexShader: /* glsl */`attribute float zufall; uniform float uZeit, uGroesse, uStoss; varying float vA; varying float vW;
        void main(){ float z2 = fract(zufall * 7.31), z3 = fract(zufall * 13.7); float leben = fract(uZeit * (0.16 + z2 * 0.22) + zufall); float w = zufall * 6.2832 + leben * (2.0 + z3 * 5.0);
          float r = (0.2 + z3 * 1.35) * (1.0 - leben * 0.55) + uStoss * leben * 0.9; vec3 p = vec3(cos(w) * r, leben * (2.2 + z2 * 2.4) + 0.05, sin(w) * r); p.xz += vec2(sin(uZeit * 3.0 + zufall * 40.0), cos(uZeit * 2.6 + zufall * 30.0)) * 0.03;
          vA = sin(leben * 3.1416) * (0.5 + 0.5 * sin(uZeit * 14.0 + zufall * 90.0)); vW = step(0.78, z2);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uGroesse * (2.0 + z3 * 4.5) * 10.0 / max(-mv.z, 0.6); }`,
      fragmentShader: `uniform sampler2D tP; varying float vA; varying float vW; void main(){ float a = texture2D(tP, gl_PointCoord).a; gl_FragColor = vec4(mix(vec3(0.3, 1.3, 1.15), vec3(1.7, 1.0, 0.4), vW) * a * vA, 1.0); }` }));
    this.funken.frustumCulled = false; g.add(this.funken);
    this.stoss = 0;
  }
  ereignis(id) { const k = this.knoten[id]; if (k) k.glut = 1; this.puls = 0.001; this.stoss = 1; }
  update(dt, pixel) {
    this.zeit += dt; const t = this.zeit; this.platte.material.uniforms.uZeit.value = t; this.saeule.material.uniforms.uZeit.value = t; this.funken.material.uniforms.uZeit.value = t; this.funken.material.uniforms.uGroesse.value = pixel * 2.2;
    if (this.puls > 0) { this.puls += dt * 0.9; if (this.puls > 1) this.puls = 0; } this.platte.material.uniforms.uPuls.value = this.puls; this.stoss = Math.max(0, this.stoss - dt * 1.2); this.funken.material.uniforms.uStoss.value = this.stoss;
    this.kern.rotation.y = t * 0.22; this.kern.position.y = 1.15 + Math.sin(t * 0.9) * 0.05; this.innen.rotation.set(t * 0.5, -t * 0.7, 0); this.ringe[0].rotation.z = t * 0.5; this.ringe[1].rotation.z = -t * 0.36; this.ringe[2].rotation.x = 1.2 + t * 0.42;
    for (const id in this.knoten) { const k = this.knoten[id]; k.glut = Math.max(0, k.glut - dt * 0.5); k.s.scale.setScalar(0.14 + 0.03 * Math.sin(t * 2.0 + k.s.position.x * 5.0) + k.glut * 0.5); }
  }
}

// ---------------------------------------------------------------- Laub am Boden
// Unter jedem Baum liegen abgefallene Blaetter. Wer durchlaeuft, schiebt sie zur Seite: sie rutschen, drehen sich und huepfen kurz.
export class Laub {
  constructor(scene, nav, NAV) {
    this.NAV = NAV; this.l = []; let s = 2024; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const [bx, by, bz, br] of nav.baeume) { let boden = 0; for (const e of nav.ebenen) if (e <= bz - 1.5) boden = e;
      for (let i = 0; i < 70; i++) { const w = rnd() * 6.283, d = 0.7 + Math.pow(rnd(), 0.8) * (br + 1.1), x = bx + Math.cos(w) * d, y = by + Math.sin(w) * d; const h = NAV.hoehe(x, y, boden + 0.2); if (h === null || Math.abs(h - boden) > 0.05) continue;
        this.l.push({ x, y, z: h, r: rnd() * 6.283, k: (rnd() - 0.5) * 0.5, vx: 0, vy: 0, w: 0, hh: 0, vh: 0, g: 0.085 + rnd() * 0.075, an: true }); } }
    // Olivenblatt: schmale Lanzette mit Mittelrippe, leicht gewoelbt
    const P = [], C = [], I = [], hell = [0.66, 0.7, 0.5], rand = [0.4, 0.46, 0.27]; const R = [[0, 0.5], [0.1, 0.3], [0.15, 0.05], [0.12, -0.22], [0.05, -0.42], [0, -0.5], [-0.05, -0.42], [-0.12, -0.22], [-0.15, 0.05], [-0.1, 0.3]];
    P.push(0, 0.035, 0.2, 0, 0.04, -0.15); C.push(...hell, ...hell); for (const [x, z] of R) { P.push(x, Math.abs(x) * 0.12, z); C.push(...rand); }
    for (let i = 0; i < 10; i++) { const a = 2 + i, b = 2 + (i + 1) % 10, m = (i < 2 || i > 7) ? 0 : 1; I.push(m, a, b); } I.push(0, 1, 4, 0, 4, 3, 0, 9, 1, 1, 9, 8);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
    this.netz = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), this.l.length); this.netz.frustumCulled = false; this.netz.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const TON = [[0.5, 0.56, 0.33], [0.62, 0.64, 0.42], [0.72, 0.62, 0.3], [0.58, 0.42, 0.22], [0.42, 0.5, 0.3], [0.78, 0.7, 0.4]], c = new THREE.Color();
    this.l.forEach((b, i) => { const t = TON[rnd() * TON.length | 0], f = 0.5 + rnd() * 0.3; c.setRGB(t[0] * f, t[1] * f, t[2] * f); this.netz.setColorAt(i, c); });
    scene.add(this.netz); this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.E = new THREE.Euler(); this.S = new THREE.Vector3(); this.V = new THREE.Vector3(); this.alt = new Map(); this.update(0, []);
  }
  // schieber: [{ id, x, y, z, r }] in Blender Koordinaten
  update(dt, schieber) {
    for (const p of schieber) { const a = this.alt.get(p.id); p.vx = a && dt > 0 ? (p.x - a[0]) / dt : 0; p.vy = a && dt > 0 ? (p.y - a[1]) / dt : 0; p.v = Math.hypot(p.vx, p.vy); this.alt.set(p.id, [p.x, p.y]); }
    let neu = false;
    for (let i = 0; i < this.l.length; i++) { const b = this.l[i];
      for (const p of schieber) { if (p.v < 0.25 || Math.abs(p.z - b.z) > 1) continue; const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy); if (d > p.r) continue; const k = (1 - d / p.r), n = Math.max(d, 0.05);
        b.vx += (dx / n * 2.4 + p.vx * 0.55) * k * dt * 9; b.vy += (dy / n * 2.4 + p.vy * 0.55) * k * dt * 9; b.w += (Math.random() - 0.5) * 60 * k * dt; if (b.hh === 0 && Math.random() < dt * 9 * k) b.vh = 0.5 + Math.random() * 0.7 * Math.min(1, p.v / 3); b.an = true; }
      if (!b.an) continue; neu = true;
      if (dt > 0) { const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt; const h = this.NAV.hoehe(nx, ny, b.z + 0.1); if (h !== null && Math.abs(h - b.z) < 0.06) { b.x = nx; b.y = ny; } else { b.vx *= -0.3; b.vy *= -0.3; }
        const rb = Math.exp(-dt * (b.hh > 0 ? 1.5 : 5.5)); b.vx *= rb; b.vy *= rb; b.r += b.w * dt; b.w *= Math.exp(-dt * 3.5); if (b.vh !== 0 || b.hh > 0) { b.hh += b.vh * dt; b.vh -= 5.5 * dt; if (b.hh <= 0) { b.hh = 0; b.vh = 0; } } }
      const luft = Math.min(1, b.hh * 9); this.E.set(b.k * 0.3 + luft * Math.sin(b.r * 3) * 0.9, b.r, luft * Math.cos(b.r * 2.3) * 0.8); this.Q.setFromEuler(this.E); this.V.set(b.x, b.z + 0.012 + b.hh, -b.y); this.S.setScalar(b.g); this.M.compose(this.V, this.Q, this.S); this.netz.setMatrixAt(i, this.M);
      if (dt > 0 && b.hh === 0 && Math.abs(b.vx) + Math.abs(b.vy) < 0.01 && Math.abs(b.w) < 0.05) b.an = false;
    }
    if (neu) this.netz.instanceMatrix.needsUpdate = true;
  }
}
