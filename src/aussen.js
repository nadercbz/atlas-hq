// Der Raum ausserhalb des Hauses: Sonnenuntergang, Wolkenmeer, schwebender Fels, Bergketten im Dunst, Atlas und Berlin am Horizont.
// Vorbild: stil_aussen/a_zwei_welten_3.webp. Alles in Three Koordinaten (x, y hoch, z = -Blender y).
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Blickrichtung der Startansicht in Blender ist (+x, +y), also Azimut 45 Grad. Atlas liegt links davon, Berlin rechts.
const AZ_ATLAS = 71, AZ_BERLIN = 22;
export const ZUR_ABENDSONNE = new THREE.Vector3(0.2, 0.06, -0.93).normalize();          // knapp ueber dem Horizont, hinten leicht links

// Gemeinsame Farben und Rauschen fuer Himmel und Wolken, damit beides nahtlos ineinander uebergeht
// Alle Farben der Luft haengen an der Tageszeit (src/tag.js schreibt sie). Startwerte: Sonnenuntergang.
const F = (r, g, b) => ({ value: new THREE.Color(r, g, b) });
export const LUFT = { uSonne: { value: ZUR_ABENDSONNE.clone() }, uHorSonne: F(1.05, 0.40, 0.11), uHorGegen: F(0.30, 0.12, 0.15), uGlut: F(0.7, 0.28, 0.06), uZenit: F(0.03, 0.045, 0.1), uMitte: F(0.12, 0.1, 0.19), uTief: F(0.36, 0.15, 0.2),
  uSchein: F(0.9, 0.35, 0.1), uScheibe: F(3.4, 1.7, 0.55), uZirS: F(0.34, 0.2, 0.3), uZirL: F(1.25, 0.5, 0.26), uGrau: F(0.2, 0.2, 0.24), uBergLicht: F(0.95, 0.5, 0.36), uSterne: { value: 0.45 }, uDecke: { value: 0 }, uHell: { value: 1 }, uStadt: { value: 1 },
  uWS1: F(0.016, 0.018, 0.06), uWS2: F(0.075, 0.06, 0.16), uWL: F(1.2, 0.44, 0.2), uWSaum: F(1.7, 0.75, 0.3), uHaus: { value: 1 } };
const GEMEINSAM = /* glsl */`
  uniform vec3 uSonne, uHorSonne, uHorGegen, uGlut;
  float H3(vec3 v){ return fract(sin(dot(v, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float rausch(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(H3(i),H3(i+vec3(1,0,0)),f.x),mix(H3(i+vec3(0,1,0)),H3(i+vec3(1,1,0)),f.x),f.y),mix(mix(H3(i+vec3(0,0,1)),H3(i+vec3(1,0,1)),f.x),mix(H3(i+vec3(0,1,1)),H3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  // Farbe des Himmels direkt am Horizont, je nach Richtung zur Sonne: dort gluehend orange, gegenueber kuehles Altrosa
  vec3 horizont(vec3 d){ float s = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSonne.x, 0.0, uSonne.z))), 0.0);
    return mix(uHorGegen, uHorSonne, pow(s, 2.2)) + uGlut * pow(s, 14.0); }
`;

// ---------------------------------------------------------------- Himmel
export function baueHimmel(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: { uZeit: { value: 0 }, ...LUFT },
    vertexShader: `varying vec3 vR; void main(){ vR = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }`,
    fragmentShader: /* glsl */`precision highp float; varying vec3 vR; uniform float uZeit; ${GEMEINSAM}
      uniform vec3 uZenit, uMitte, uTief, uSchein, uScheibe, uZirS, uZirL, uGrau, uBergLicht; uniform float uSterne, uDecke, uHell, uStadt;
      float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      float r1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(h1(i), h1(i+1.0), f); }
      float grat(float a, float s){ return r1(a * 0.11 + s) * 0.55 + r1(a * 0.31 + s * 2.0) * 0.28 + r1(a * 0.9 + s * 3.0) * 0.12 + r1(a * 2.7 + s) * 0.05; }
      void main(){
        vec3 d = normalize(vR); float e = asin(clamp(d.y, -1.0, 1.0)) * 57.2958;        // Hoehe ueber dem Horizont in Grad
        float az = atan(-d.z, d.x) * 57.2958;                                            // Azimut wie in Blender, in Grad
        float son = max(dot(d, uSonne), 0.0); vec3 hz = horizont(d);
        // Verlauf: gluehender Horizont, Altrosa, Violett, tiefes Nachtblau oben
        vec3 c = mix(hz, uTief, smoothstep(0.0, 7.0, e)); c = mix(c, uMitte, smoothstep(4.0, 20.0, e)); c = mix(c, uZenit, smoothstep(16.0, 62.0, e));
        c += uSchein * pow(son, 5.0) * 0.5;                                  // weiter Schein um die Sonne
        // Sonnenscheibe, halb im Dunst
        float sw = acos(clamp(dot(d, uSonne), -1.0, 1.0)) * 57.2958; c += uScheibe * smoothstep(1.25, 1.0, sw) + uSchein * 1.8 * exp(-sw * 0.5);
        // Sterne in zwei Groessen und ein Hauch Milchstrasse: je dunkler, desto mehr und desto tiefer zum Horizont
        { vec3 g = floor(d * 260.0); float st = step(0.9982, H3(g)); float tief = smoothstep(mix(20.0, 1.5, uSterne), mix(55.0, 12.0, uSterne), e);
          c += vec3(0.75, 0.8, 0.95) * st * tief * (0.5 + 0.5 * sin(uZeit * 1.5 + H3(g + 3.0) * 30.0)) * 1.5 * uSterne;
          vec3 g2 = floor(d * 470.0); c += vec3(0.7, 0.74, 0.9) * step(0.9972, H3(g2 + 7.0)) * tief * uSterne * uSterne * (0.4 + 0.6 * H3(g2));
          float band = exp(-pow(dot(d, normalize(vec3(0.55, 0.35, 0.76))) * 3.2, 2.0)); c += vec3(0.05, 0.055, 0.085) * band * (0.5 + rausch(d * 9.0) * 0.9) * uSterne * uSterne * tief; }
        // Schleierwolken hoch oben, von unten angestrahlt, ziehen langsam
        if (e > 1.5) { vec2 u = d.xz / max(d.y, 0.03); float n = rausch(vec3(u.x * 0.55 + uZeit * 0.006, u.y * 1.7, 1.0)) * 0.6 + rausch(vec3(u.x * 1.5 + uZeit * 0.011, u.y * 4.6, 5.0)) * 0.3 + rausch(vec3(u * 6.0, 9.0)) * 0.1;
          float a = smoothstep(0.5 - uDecke * 0.42, 0.78 - uDecke * 0.45, n) * smoothstep(1.5, 9.0, e) * (1.0 - smoothstep(38.0, 75.0, e) * (1.0 - uDecke)); vec3 wc = mix(uZirS, uZirL, pow(son, 1.6) * 0.85 + 0.15 * smoothstep(20.0, 3.0, e)); c = mix(c, wc, a * 0.78);
          // geschlossene Wolkendecke bei truebem Wetter
          float dk = rausch(vec3(u.x * 0.3 + uZeit * 0.008, u.y * 0.5, 6.0)) * 0.6 + rausch(vec3(u * 1.3 + uZeit * 0.012, 2.0)) * 0.4; c = mix(c, uGrau * (0.72 + 0.56 * dk), uDecke * 0.94); }
        c = mix(c, uGrau, uDecke * 0.85 * (1.0 - smoothstep(0.0, 3.0, e)));
        // Drei Bergketten rund um den Horizont, je weiter weg, desto mehr im Dunst
        for (int k = 0; k < 3; k++) { float fk = float(k); float hoehe = (1.1 + fk * 0.95) * (0.35 + 1.1 * grat(az * (1.0 + fk * 0.35), 7.0 + fk * 13.0)) - 0.25;
          float in1 = smoothstep(0.0, 0.06, hoehe - e) * step(-2.0, e); vec3 bc = mix(hz * 0.55, vec3(0.055, 0.05, 0.1) * uHell, 0.3 + fk * 0.27); bc = mix(hz * 0.85, bc, smoothstep(-0.6, 1.4 + fk * 0.5, e)); c = mix(c, bc, in1 * (0.62 + fk * 0.16)); }
        // Hoher Atlas: der grosse Gipfel mit Schnee, vorn in der Staffelung
        float da = az - ${AZ_ATLAS.toFixed(1)}; if (da > 180.0) da -= 360.0; if (da < -180.0) da += 360.0;
        float berg = 4.4 * pow(max(0.0, 1.0 - abs(da + 1.0) / 12.0), 1.3) + 2.4 * pow(max(0.0, 1.0 - abs(da - 8.5) / 9.0), 1.5) + 2.0 * pow(max(0.0, 1.0 - abs(da + 10.0) / 8.0), 1.6);
        berg += (r1(da * 0.8 + 3.0) - 0.5) * 0.6 * smoothstep(0.0, 1.0, berg) + (r1(da * 2.6) - 0.5) * 0.16 * smoothstep(0.0, 1.0, berg);
        float inBerg = smoothstep(0.0, 0.06, berg - e) * step(-2.0, e);
        float schnee = smoothstep(0.42, 0.66, e / max(berg, 0.01) + (r1(da * 4.0 + e * 2.0) - 0.5) * 0.28);
        vec3 fels = mix(vec3(0.07, 0.065, 0.12), vec3(0.3, 0.27, 0.36), schnee) * uHell; fels = mix(fels, uBergLicht, 0.45 * schnee * smoothstep(-6.0, 5.0, -da)); fels *= 0.85 + 0.3 * r1(da * 3.0 - e * 1.5);
        c = mix(c, mix(hz * 0.8, fels, smoothstep(-0.4, 2.0, e)), inBerg * 0.94);
        // Berlin: niedrige Bloecke und der Fernsehturm, kleine Lichter
        float db = az - ${AZ_BERLIN.toFixed(1)}; if (db > 180.0) db -= 360.0; if (db < -180.0) db += 360.0;
        float zelle = floor(db * 3.4), haus = (0.25 + 0.75 * h1(zelle * 3.7)) * 1.05 * pow(max(0.0, 1.0 - abs(db) / 10.0), 0.7) * step(0.32, h1(zelle * 9.1 + 2.0));
        float stadt = step(e, haus) * step(-0.4, e);
        float turm = step(abs(db), 0.045 + 0.05 * smoothstep(1.2, 0.0, e)) * step(e, 2.2) + step(length(vec2(db, e - 2.3)), 0.2) + step(abs(db), 0.014) * step(e, 3.7) * step(2.2, e);
        float sil = clamp(stadt + turm, 0.0, 1.0) * step(-0.4, e);
        c = mix(c, mix(hz * 0.7, vec3(0.03, 0.035, 0.06) * uHell, smoothstep(-0.5, 0.9, e) * 0.85 + 0.1), sil * 0.92);
        float fx = fract(db * 17.0), fy = fract(e * 9.0); float licht = step(0.8, h1(floor(db * 17.0) * 1.3 + floor(e * 9.0) * 7.7)) * step(abs(fx - 0.5), 0.2) * step(abs(fy - 0.5), 0.25) * stadt;
        c += vec3(1.3, 0.85, 0.45) * licht * uStadt; c += vec3(1.6, 0.2, 0.1) * uStadt * step(length(vec2(db, e - 3.7)), 0.05) * (0.6 + 0.4 * sin(uZeit * 2.0));
        if (e < 0.0) c = mix(c, hz, smoothstep(0.0, -3.0, e));                           // unter dem Horizont: Dunst ueber dem Wolkenmeer
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(120, 64, 32), mat); m.frustumCulled = false; m.renderOrder = -100; scene.add(m);
  return m;
}

// ---------------------------------------------------------------- Gipfel unter dem Haus
// Das Haus sitzt auf einem verschneiten Berggipfel. Ein Hoehenfeld aus Gratrauschen: oben eine schmale Schneeschulter rund um den Grundriss,
// dann steile Felsflanken mit Rippen und Rinnen, die im Wolkenmeer verschwinden. Dazu Nebengipfel, die aus den Wolken ragen.
export function baueFels(scene) {
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let f = x - i, g = y - j; f = f * f * (3 - 2 * f); g = g * g * (3 - 2 * g); const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * f + (c - a) * g + (a - b - c + d) * f * g; };
  const fbm = (x, y, n) => { let s = 0, a = 0.5; for (let k = 0; k < n; k++) { s += a * vn(x, y); x = x * 2.03 + 11.3; y = y * 2.03 + 5.7; a *= 0.5; } return s; };
  const grat = (x, y, n) => { let s = 0, a = 0.5, w = 1; for (let k = 0; k < n; k++) { let r = 1 - Math.abs(vn(x, y) * 2 - 1); r = r * r * w; s += a * r; w = Math.min(1, r * 1.6 + 0.25); x = x * 2.07 + 3.1; y = y * 2.07 + 8.4; a *= 0.5; } return s; };
  const MX = 20, MZ = -20, HB = 20.3;
  const NEBEN = [[58, -56, -3.5, 1.5], [-22, -36, -5.5, 1.7], [36, 24, -6.5, 1.6], [-16, 16, -8, 1.8], [70, -8, -7, 1.5], [6, -74, -6, 1.4]];
  const hoehe = (x, z) => {
    const dx = Math.max(Math.abs(x - MX) - HB, 0), dz = Math.max(Math.abs(z - MZ) - HB, 0), d = Math.hypot(dx, dz);
    if (d <= 0) return -0.62;
    const w = Math.atan2(z - MZ, x - MX), cw = Math.cos(w), sw = Math.sin(w);
    const schulter = 1.6 + 7.5 * Math.pow(vn(cw * 2.1 + 5, sw * 2.1 + 9), 1.6);                          // Breite der Schneeschulter je Richtung
    const steil = 0.5 + 1.05 * vn(cw * 2.9 + 1, sw * 2.9 + 4);                                       // Pfeiler und Rinnen: mal flacher, mal fast senkrecht
    let h = -0.34 - steil * (Math.sqrt(d * d + schulter * schulter) - schulter);
    const tief = Math.min(1, d / 7);
    h += (grat(x * 0.03, z * 0.03, 5) - 0.55) * 17 * tief * Math.min(1.7, 0.35 + d / 22);         // Grate und Rinnen der Flanke
    h += (fbm(x * 0.16, z * 0.16, 4) - 0.5) * 4.2 * tief; h += (grat(x * 0.11 + 7, z * 0.11 + 2, 3) - 0.5) * 2.6 * tief;                                           // Bloecke und Stufen
    h += (fbm(x * 0.9, z * 0.9, 3) - 0.5) * 0.5 * Math.min(1, d / 2.5);
    h += (vn(x * 0.6, z * 0.6) - 0.5) * 0.16 - 0.1 * Math.min(1, d);                                 // Schneewehen direkt am Haus
    for (const [px, pz, top, st] of NEBEN) { const e = Math.hypot(x - px, z - pz); const g = top - st * Math.pow(e, 1.08) + (grat(x * 0.07 + 3, z * 0.07 + 1, 4) - 0.55) * Math.min(6, e * 0.9); if (g > h) h = g; }
    return Math.max(Math.min(h, d < 6 ? -0.22 : 99), -78);
  };
  const N = 340, W = 230, geo = new THREE.PlaneGeometry(W, W, N, N); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + MX, z = p.getZ(i) + MZ; p.setXYZ(i, x, hoehe(x, z), z); }
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  const lade = (n) => { const t = new THREE.TextureLoader().load('./assets/tex/' + n); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.anisotropy = 8; return t; };
  const mat = new THREE.ShaderMaterial({
    uniforms: { tFels: { value: lade('bergfels.webp') }, tSchnee: { value: lade('schnee.webp') }, uSonne: { value: ZUR_ABENDSONNE.clone() }, uSonnenFarbe: { value: new THREE.Color(1.55, 0.62, 0.3) },
      uOben: { value: new THREE.Color(0.24, 0.2, 0.34) }, uUnten: { value: new THREE.Color(0.1, 0.09, 0.17) }, uDunst: { value: new THREE.Color(0.2, 0.1, 0.14) }, uHaus: { value: 1 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`precision highp float; varying vec3 vP; varying vec3 vN; uniform sampler2D tFels, tSchnee; uniform vec3 uSonne, uSonnenFarbe, uOben, uUnten, uDunst; uniform float uHaus;
      vec3 drei(sampler2D t, vec3 p, vec3 w, float s){ return texture2D(t, p.zy * s).rgb * w.x + texture2D(t, p.xz * s).rgb * w.y + texture2D(t, p.xy * s).rgb * w.z; }
      void main(){
        vec3 n = normalize(vN); vec3 w = pow(abs(n), vec3(5.0)); w /= (w.x + w.y + w.z);
        vec3 nah = drei(tFels, vP, w, 0.12), weit = drei(tFels, vP + 13.0, w, 0.023); float korn = dot(nah, vec3(0.333));
        vec3 fels = nah * (0.55 + 1.5 * dot(weit, vec3(0.333)));                                   // zwei Massstaebe: kein Kachelmuster
        n = normalize(n + (korn - 0.3) * 0.5 * vec3(nah.r - nah.b, 0.0, nah.g - nah.r) * 6.0);          // feine Kanten aus der Textur
        float flecken = texture2D(tFels, vP.xz * 0.027).g + texture2D(tFels, vP.xz * 0.11 + 0.4).r * 0.5;
        float schnee = smoothstep(0.52, 0.7, vN.y + (flecken - 0.5) * 0.36 + (korn - 0.3) * 0.5 + smoothstep(-34.0, -1.0, vP.y) * 0.1);
        schnee = max(schnee, smoothstep(0.86, 0.95, normalize(vN).y));
        vec3 sn = texture2D(tSchnee, vP.xz * 0.14).rgb * 0.6 + texture2D(tSchnee, vP.xz * 0.037 + 0.3).rgb * 0.5; sn = mix(vec3(dot(sn, vec3(0.333))), sn, 0.55) * 1.04;
        vec3 alb = mix(fels * 0.9, sn, schnee);
        vec3 sd = normalize(uSonne + vec3(0.0, 0.2, 0.0)); float nl = dot(n, sd), dir = max(nl, 0.0), weich = nl * 0.5 + 0.5;
        vec3 c = alb * (uSonnenFarbe * (dir * 0.95 + schnee * weich * weich * 0.22) + mix(uUnten, uOben, n.y * 0.5 + 0.5) * (1.0 + schnee * 0.55));
        c += uSonnenFarbe * schnee * pow(max(dot(reflect(-sd, n), normalize(cameraPosition - vP)), 0.0), 24.0) * 0.25;      // Glitzern im Gegenlicht
        vec3 q = vP - vec3(20.0, 0.0, -20.0); float dq = max(max(abs(q.x), abs(q.z)) - 20.0, 0.0);
        c += alb * vec3(1.0, 0.42, 0.17) * 0.6 * uHaus * exp(-dq * 0.2) * smoothstep(-9.0, -0.2, vP.y);    // warmer Schein aus dem Haus auf dem Schnee
        c = mix(c, uDunst, smoothstep(-16.0, -64.0, vP.y) * 0.85);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.name = 'gipfel'; m.userData.hoehe = hoehe; scene.add(m); return m;
}

// ---------------------------------------------------------------- Wolkenmeer als echtes Volumen
export class WolkenPass extends Pass {
  constructor(mobil) {
    super();
    const vs = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    this.halb = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }); this.teiler = mobil ? 2.5 : 1.7;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tTiefe: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uZeit: { value: 0 }, uSchritte: { value: mobil ? 30 : 64 }, ...LUFT },
      vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tTiefe; uniform mat4 uInvVP; uniform float uZeit, uSchritte; ${GEMEINSAM}
        uniform vec3 uWS1, uWS2, uWL, uWSaum; uniform float uHaus;
        vec3 welt(vec2 uv, float d){ vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
        // Oberkante der Wolkendecke als Hoehenfeld. Die ganze Decke zieht mit dem Wind.
        float oben(vec2 xz){
          vec2 w = xz + vec2(uZeit * 0.9, uZeit * 0.45); float ab = length(xz - vec2(20.0, -20.0));
          float h = -13.0 + 12.0 * rausch(vec3(w * 0.013, 2.0)) + 8.0 * rausch(vec3(w * 0.037 + 7.0, 5.0)) + 3.2 * rausch(vec3(w * 0.11 + 3.0, 8.0));
          { float b1 = 1.0 - abs(rausch(vec3(w * 0.085, 1.0)) * 2.0 - 1.0), b2 = 1.0 - abs(rausch(vec3(w * 0.23 + 5.0, 7.0)) * 2.0 - 1.0); h += 3.6 * b1 * b1 + 1.3 * b2; }      // Quellformen wie Blumenkohl
          // Wolkentuerme: einzelne hohe Haufenwolken in der Ferne, zum Horizont hin immer mehr
          float tm = smoothstep(0.52, 0.8, rausch(vec3(w * 0.0052 + 31.0, 4.0))) * smoothstep(70.0, 190.0, ab);
          h += tm * (22.0 + 46.0 * rausch(vec3(w * 0.011 + 3.0, 9.0))) * (0.72 + 0.4 * rausch(vec3(w * 0.06, 6.0)));
          // zwei Tuerme nah am Haus wie im Vorbild
          float t1 = smoothstep(30.0, 4.0, length(xz - vec2(62.0, -6.0))), t2 = smoothstep(24.0, 3.0, length(xz - vec2(-18.0, -52.0)));
          h += (15.0 * t1 + 10.0 * t2) * (0.55 + 0.75 * rausch(vec3(xz * 0.085 + 11.0 + uZeit * 0.01, 4.0)));
          h -= 9.0 * smoothstep(80.0, 24.0, ab) * (1.0 - t1);                              // um den Fels sinkt die Decke: er ragt frei heraus
          vec2 a = max(vec2(-6.0, -46.0) - xz, xz - vec2(46.0, 6.0)); float aussen = max(a.x, a.y);
          return mix(min(h, -8.0), h, smoothstep(0.0, 16.0, aussen));                       // unter dem Haus bleibt sie unter dem Boden
        }
        float dichteH(vec3 p, float h, float fein){
          if (p.y > h + 3.0) return 0.0; vec3 q = p * 0.05 + vec3(uZeit * 0.045, uZeit * 0.004, uZeit * 0.022);
          float n = rausch(q) * 0.5 + rausch(q * 2.03 + 3.1) * 0.27; if (fein > 0.01) n = mix(n * 1.27, n + rausch(q * 4.1 + 9.2) * 0.14 + rausch(q * 8.3 + 1.7) * 0.07, fein); else n *= 1.27;
          float tief = clamp((h - p.y) / 6.0, -0.42, 1.0);                                // oben fransig, darunter dicht
          return clamp(n * 1.75 - 0.86 + tief * 1.15, 0.0, 1.0);
        }
        // Farbe eines Wolkenpunkts. Das Sonnenlicht wird je Strahl nur einmal berechnet (sch), das spart die meisten Aufrufe.
        vec3 wolkenFarbe(vec3 p, float h0, float de, float t, vec3 hz, float gegen, inout float sch){
          if (sch < 0.0) { float e = max(1.8, t * 0.02); float hx = oben(p.xz + vec2(e, 0.0)), hzz = oben(p.xz + vec2(0.0, e)), h2 = oben(p.xz + uSonne.xz * 24.0);
            vec3 nrm = normalize(vec3(h0 - hx, e, h0 - hzz));
            sch = pow(max(dot(nrm, normalize(vec3(uSonne.x, 0.3, uSonne.z))), 0.0), 1.4) * 1.7 * smoothstep(-8.0, 1.0, h0 - h2 + 2.0); }
          float kuppe = clamp((p.y - (h0 - 6.0)) / 7.0, 0.0, 1.0) * (0.25 + 0.75 * smoothstep(-15.0, 2.0, h0));
          vec3 c = mix(uWS1, uWS2, kuppe) + uWL * sch * (0.08 + 0.92 * kuppe) * 0.5 + uWSaum * gegen * smoothstep(-2.5, 1.0, p.y - h0) * kuppe * 0.55;
          vec3 q = p - vec3(20.0, -6.0, -20.0); c += vec3(1.0, 0.22, 0.09) * 2.0 * uHaus / (1.0 + dot(q, q) * 0.0038) * (0.35 + 0.65 * kuppe);
          return mix(hz * 0.9, c, exp(-max(t - 170.0, 0.0) * 0.0017));
        }
        void main(){
          float d = (1.0 - texture2D(tTiefe, vUv).x); vec3 a = welt(vUv, 0.0), e = welt(vUv, d); vec3 r = e - a; float L = length(r); r /= L; if (d >= 0.99999) L = 5000.0;
          float yo = 84.0, yu = -70.0; float tn = 0.0, tf = L;
          if (abs(r.y) > 1e-4) { float t0 = (yo - a.y) / r.y, t1 = (yu - a.y) / r.y; tn = max(min(t0, t1), 0.0); tf = min(max(t0, t1), L); } else if (a.y > yo || a.y < yu) tf = -1.0;
          tf = min(tf, 1500.0); vec3 farbe = vec3(0.0); float T = 1.0; vec3 hz = horizont(r); float gegen = pow(max(dot(r, uSonne), 0.0), 6.0);
          if (tf > tn) {
            float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); float t = tn, dt = max(0.8, tn * 0.03); t += dt * j;
            float vorG = 1.0, vorT = t, sch = -1.0, voll = 0.0;
            for (float i = 0.0; i < 80.0; i++) { if (t > tf || T < 0.03) break; if (i >= uSchritte) { voll = 1.0; break; } vec3 p = a + r * t; float h0 = oben(p.xz); float gap = p.y - h0 - 1.0;
              // Uebergang von oben in die Wolke: den Schnittpunkt genau treffen, sonst entstehen in der Ferne Treppenstufen
              if (i > 0.0 && vorG > 0.0 && gap < 0.0) { t = mix(vorT, t, vorG / (vorG - gap)); p = a + r * t; h0 = oben(p.xz); gap = p.y - h0 - 1.0; }
              float fern = 1.0;                                                     // auch in der Naehe geschlossene Oberflaeche wie in der Ferne: lose Fetzen rauschten bei halber Aufloesung (21.11.2026)
              if (gap < 2.0) { float fest = fern * smoothstep(0.6, -0.4, gap); float de = dichteH(p, h0, smoothstep(85.0, 28.0, t)); if (gap > -0.4) de *= 1.0 - fern * smoothstep(-0.4, 0.3, gap); de = mix(de, 1.0, fest);      // lose Fetzen ueber der Decke nur in der Naehe: in der Ferne wuerden sie als Punkte flimmern
                if (de > 0.004) { vec3 c = wolkenFarbe(p, h0, de, t, hz, gegen, sch); float al = mix(1.0 - exp(-de * dt * 0.42), 1.0, fest); farbe += T * al * c; T *= 1.0 - al; } }
              vorG = gap; vorT = t; dt = max(max(0.8, t * 0.012), gap * 0.62); t += dt; }
            // Schritte aufgebraucht, der Strahl streift noch ueber die Decke: als geschlossene Flaeche abschliessen statt Loecher zu lassen
            if (voll > 0.5 && T > 0.03 && t < tf && r.y < 0.04) { vec3 p = a + r * t; float h0 = oben(p.xz); float al = smoothstep(30.0, 2.0, p.y - h0); vec3 c = wolkenFarbe(vec3(p.x, min(p.y, h0 + 1.0), p.z), h0, 1.0, t, hz, gegen, sch); farbe += T * al * c; T *= 1.0 - al; }
          }
          gl_FragColor = vec4(farbe, T);
        }`,
    });
    this.misch = new THREE.ShaderMaterial({ uniforms: { tFarbe: { value: null }, tWolke: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tFarbe; uniform sampler2D tWolke; void main(){ vec4 w = texture2D(tWolke, vUv); gl_FragColor = vec4(texture2D(tFarbe, vUv).rgb * w.a + w.rgb, 1.0); }` });
    this.quad = new FullScreenQuad(this.mat); this.quad2 = new FullScreenQuad(this.misch); this.needsSwap = true;
  }
  setSize(w, h) { this.halb.setSize(Math.ceil(w / this.teiler), Math.ceil(h / this.teiler)); }
  render(r, schreib, lese) {
    this.mat.uniforms.tTiefe.value = (this.tiefe && this.tiefe()) || lese.depthTexture; r.setRenderTarget(this.halb); this.quad.render(r);
    this.misch.uniforms.tFarbe.value = lese.texture; this.misch.uniforms.tWolke.value = this.halb.texture; r.setRenderTarget(this.renderToScreen ? null : schreib); this.quad2.render(r);
  }
}
