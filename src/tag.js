// Tageszeit und Wetter. Die Welt laeuft nach der Uhr in Deutschland: Sonnenstand fuer Berlin wird echt berechnet,
// daraus entstehen Nacht, blaue Stunde, Daemmerung, goldene Stunde und Tag. Das Wetter kommt live aus Berlin (Open-Meteo, ohne Schluessel).
// Oben laesst sich die Uhrzeit mit dem Regler selbst stellen, "Live" geht zurueck zur echten Zeit.
import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';

const LAT = 52.52, LON = 13.405, RAD = Math.PI / 180;

// Sonnenstand (Hoehe und Azimut in Grad, Azimut von Nord ueber Ost) fuer einen Zeitpunkt in Millisekunden
export function sonnenstand(ms) {
  const d = ms / 86400000 - 10957.5, g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d, L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L)); const gmst = (18.697374558 + 24.06570982441908 * d) % 24; const ha = (gmst * 15 + LON) * RAD - ra;
  const hoehe = Math.asin(Math.sin(LAT * RAD) * Math.sin(dec) + Math.cos(LAT * RAD) * Math.cos(dec) * Math.cos(ha)); const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(LAT * RAD) - Math.sin(LAT * RAD) * Math.cos(ha));
  return { hoehe: hoehe / RAD, azimut: ((az / RAD) + 360) % 360 };
}
const BERLIN = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
export function berlinStunde(ms) { const t = {}; for (const p of BERLIN.formatToParts(new Date(ms))) t[p.type] = +p.value; return (t.hour % 24) + t.minute / 60 + t.second / 3600; }

// Farbwelten nach Sonnenhoehe. Jede Zeile ist ein Zustand, dazwischen wird weich gemischt. "sunset" ist der bisherige, von Nader freigegebene Look.
const Z = {
  nacht: { haus: 0.13, zenit: [.004, .006, .016], mitte: [.008, .012, .03], tief: [.015, .02, .045], horS: [.022, .03, .062], horG: [.012, .016, .036], glut: [0, 0, 0], schein: [.05, .06, .09], scheibe: [1.5, 1.6, 1.9], zirS: [.016, .02, .04], zirL: [.07, .085, .14],
    ws1: [.005, .007, .018], ws2: [0.02, 0.026, 0.05], wl: [0.12, 0.15, 0.25], wsaum: [.16, .19, .3], bergS: [.2, .25, .42], bergO: [.035, .045, .09], bergU: [.01, .013, .028], dunst: [.016, .021, .042], tagL: [.035, .045, .085], strahlF: [.45, .58, .95], figS: [0.5, 0.56, 0.82], sterne: 1, lampen: 1, strahl: .16, hell: .22, stadt: 1.5, hemi: 1.15 },
  blau: { haus: 0.24, zenit: [.018, .035, .11], mitte: [.045, .08, .2], tief: [.1, .14, .3], horS: [.3, .23, .3], horG: [.075, .105, .23], glut: [.2, .08, .04], schein: [.08, .04, .04], scheibe: [0, 0, 0], zirS: [.05, .07, .16], zirL: [.28, .22, .32],
    ws1: [.012, .02, .06], ws2: [.06, .09, .2], wl: [.2, .2, .34], wsaum: [.28, .24, .34], bergS: [.3, .31, .52], bergO: [.1, .13, .26], bergU: [.03, .04, .09], dunst: [.065, .085, .19], tagL: [.14, .18, .34], strahlF: [.5, .6, .92], figS: [0.7, 0.78, 1.1], sterne: .5, lampen: 1, strahl: .1, hell: .45, stadt: 1.3, hemi: 1.1 },
  glut: { haus: 0.6, zenit: [.03, .05, .16], mitte: [.1, .11, .26], tief: [.34, .2, .3], horS: [.95, .4, .18], horG: [.16, .14, .26], glut: [.6, .22, .06], schein: [.35, .14, .06], scheibe: [0, 0, 0], zirS: [.16, .12, .24], zirL: [.9, .4, .3],
    ws1: [.012, .016, .055], ws2: [.06, .065, .17], wl: [.5, .26, .22], wsaum: [.9, .4, .25], bergS: [.7, .4, .35], bergO: [.16, .16, .3], bergU: [.06, .065, .13], dunst: [.13, .09, .15], tagL: [.4, .36, .48], strahlF: [.9, .5, .4], figS: [2.0, 1.25, 1.1], sterne: .28, lampen: .95, strahl: .25, hell: .7, stadt: 1.1, hemi: 1.05 },
  sunset: { haus: 1, zenit: [.03, .045, .1], mitte: [.12, .1, .19], tief: [.36, .15, .2], horS: [1.05, .4, .11], horG: [.3, .12, .15], glut: [.7, .28, .06], schein: [.9, .35, .1], scheibe: [3.4, 1.7, .55], zirS: [.34, .2, .3], zirL: [1.25, .5, .26],
    ws1: [.016, .018, .06], ws2: [.075, .06, .16], wl: [1.2, .44, .2], wsaum: [1.7, .75, .3], bergS: [1.55, .62, .3], bergO: [.24, .2, .34], bergU: [.1, .09, .17], dunst: [.2, .1, .14], tagL: [1, 1, 1], strahlF: [1, .5, .24], figS: [5.5, 4.5, 3.45], sterne: .1, lampen: .8, strahl: 1, hell: 1, stadt: 1, hemi: 1.25 },
  gold: { haus: 0.45, zenit: [.09, .19, .42], mitte: [.28, .36, .55], tief: [0.62, 0.46, 0.38], horS: [1.2, .75, .4], horG: [.5, .45, .5], glut: [.5, .3, .12], schein: [.8, .5, .25], scheibe: [5, 3.6, 2], zirS: [.5, .42, .45], zirL: [1.3, .9, .6],
    ws1: [0.08, 0.08, 0.15], ws2: [0.24, 0.22, 0.3], wl: [1.0, 0.66, 0.4], wsaum: [1.1, 0.75, 0.42], bergS: [1.7, 1.1, .65], bergO: [.4, .45, .6], bergU: [.16, .16, .24], dunst: [0.4, 0.33, 0.34], tagL: [1.12, 1.06, .95], strahlF: [1, .72, .42], figS: [6, 5.4, 4.3], sterne: 0, lampen: .4, strahl: 0.6, hell: 1.7, stadt: .4, hemi: 1.4 },
  tag: { haus: 0.12, zenit: [0.06, 0.19, 0.56], mitte: [0.19, 0.38, 0.78], tief: [0.32, 0.5, 0.82], horS: [0.5, 0.62, 0.84], horG: [0.38, 0.52, 0.8], glut: [.15, .14, .12], schein: [0.3, 0.3, 0.27], scheibe: [7, 6.6, 6], zirS: [.62, .66, .74], zirL: [1.25, 1.22, 1.18],
    ws1: [0.09, 0.12, 0.21], ws2: [0.24, 0.29, 0.41], wl: [0.78, 0.74, 0.67], wsaum: [0.45, 0.45, 0.45], bergS: [1.25, 1.18, 1.05], bergO: [0.4, 0.48, 0.66], bergU: [.2, .22, .3], dunst: [0.3, 0.4, 0.58], tagL: [1.1, 1.1, 1.12], strahlF: [1, 0.9, 0.72], figS: [6.5, 6.3, 5.85], sterne: 0, lampen: .12, strahl: 0.2, hell: 2.0, stadt: 0, hemi: 1.55 },
};
const STUFEN = [[-16, Z.nacht], [-7, Z.blau], [-2.6, Z.glut], [2.2, Z.sunset], [9, Z.gold], [24, Z.tag]];
function mische(h) {
  let a = STUFEN[0][1], b = a, t = 0; if (h >= STUFEN[STUFEN.length - 1][0]) a = b = STUFEN[STUFEN.length - 1][1]; else for (let i = 0; i < STUFEN.length - 1; i++) if (h >= STUFEN[i][0] && h < STUFEN[i + 1][0]) { a = STUFEN[i][1]; b = STUFEN[i + 1][1]; t = (h - STUFEN[i][0]) / (STUFEN[i + 1][0] - STUFEN[i][0]); t = t * t * (3 - 2 * t); }
  const P = {}; for (const k in a) P[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (b[k][i] - v) * t) : a[k] + (b[k] - a[k]) * t; return P;
}
const lum = (c) => c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15, mal = (c, f) => c.map(v => v * f), zu = (c, d, t) => c.map((v, i) => v + (d[i] - v) * t);

// WMO Wettercode zu Wetterart
function wetterArt(code) { if (code >= 95) return 'gewitter'; if ([71, 73, 75, 77, 85, 86].includes(code)) return 'schnee'; if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'regen'; if (code === 45 || code === 48) return 'nebel'; if (code >= 2) return 'wolken'; return 'klar'; }
const WORT = { klar: 'Klar', wolken: 'Bewölkt', regen: 'Regen', schnee: 'Schnee', gewitter: 'Gewitter', nebel: 'Nebel' };

// ---------------------------------------------------------------- Regen und Schnee
// Eigener Durchgang nach den Wolken, damit die Tropfen auch vor dem Wolkenmeer zu sehen sind. Verdeckung ueber die Tiefe der Szene.
// Im Haus (unter Dach und Decken) faellt nichts: die Tropfen werden dort ausgeblendet.
export class NiederschlagPass extends Pass {
  constructor(holeTiefe) {
    super(); this.needsSwap = false; this.holeTiefe = holeTiefe; this.szene = new THREE.Scene(); this.kam = null; this.staerke = 0; this.art = 0;
    const N = 5200, saat = new Float32Array(N * 2 * 3), ende = new Float32Array(N * 2); for (let i = 0; i < N; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); saat.set([a, b, c, a, b, c], i * 6); ende[i * 2 + 1] = 1; }
    const U = this.U = { uZeit: { value: 0 }, uKam: { value: new THREE.Vector3() }, uArt: { value: 0 }, uStaerke: { value: 0 }, uLicht: { value: new THREE.Color(1, 1, 1) }, tTiefe: { value: null }, uAufl: { value: new THREE.Vector2(1, 1) }, uWind: { value: new THREE.Vector2(2.2, 0.8) }, uPix: { value: 1 } };
    const vs = /* glsl */`attribute vec3 saat; attribute float ende; uniform float uZeit, uArt, uStaerke, uPix; uniform vec3 uKam; uniform vec2 uWind; varying float vA;
      void main(){ vec3 box = vec3(30.0, 20.0, 30.0); float schnee = step(0.5, uArt); float fall = mix(15.0 + saat.x * 5.0, 1.1 + fract(saat.z * 7.31) * 0.9, schnee);
        vec3 p = saat * box; p.y -= uZeit * fall; p.xz += uWind * uZeit * mix(1.0, 0.45, schnee); p.x += schnee * sin(uZeit * 1.2 + saat.y * 40.0) * 0.35; p.z += schnee * cos(uZeit * 0.9 + saat.x * 33.0) * 0.3;
        p = mod(p - uKam + box * 0.5, box) - box * 0.5 + uKam; p += (1.0 - schnee) * ende * vec3(uWind.x, -fall, uWind.y) * 0.03;
        float innen = step(0.15, p.x) * step(p.x, 39.85) * step(p.z, -0.15) * step(-39.85, p.z) * step(p.y, 20.4);
        float da = step(fract(saat.y * 91.7 + saat.z * 13.3), uStaerke) * (1.0 - innen); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; if (da < 0.5) gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
        vA = clamp(1.0 - length(mv.xyz) / 15.0, 0.0, 1.0); gl_PointSize = uPix * mix(1.0, (2.5 + fract(saat.x * 51.0) * 4.5) * 5.5 / max(-mv.z, 0.6), schnee); }`;
    const fs = /* glsl */`precision highp float; uniform sampler2D tTiefe; uniform vec2 uAufl; uniform vec3 uLicht; uniform float uArt; varying float vA;
      void main(){ if (gl_FragCoord.z > (1.0 - texture2D(tTiefe, gl_FragCoord.xy / uAufl).x)) discard; float a = vA;
        if (uArt > 0.5) { vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard; a *= smoothstep(0.5, 0.15, r) * 0.9; gl_FragColor = vec4(uLicht * 1.25, a); } else gl_FragColor = vec4(uLicht * vec3(0.78, 0.84, 0.95), a * 0.42); }`;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3)); g.setAttribute('saat', new THREE.BufferAttribute(saat, 3)); g.setAttribute('ende', new THREE.BufferAttribute(ende, 1));
    const mat = (linien) => new THREE.ShaderMaterial({ uniforms: U, vertexShader: vs, fragmentShader: fs, transparent: true, depthTest: false, depthWrite: false });
    this.regen = new THREE.LineSegments(g, mat()); this.schnee = new THREE.Points(g, mat()); this.regen.frustumCulled = this.schnee.frustumCulled = false; this.szene.add(this.regen, this.schnee);
  }
  render(r, schreib, lese) {
    if (this.staerke < 0.01 || !this.kam) return; const U = this.U; U.tTiefe.value = this.holeTiefe() || lese.depthTexture; U.uAufl.value.set(lese.width, lese.height); U.uKam.value.setFromMatrixPosition(this.kam.matrixWorld); U.uArt.value = this.art; U.uStaerke.value = this.staerke; U.uPix.value = r.getPixelRatio();
    this.regen.visible = this.art < 0.5; this.schnee.visible = this.art > 0.5; const ac = r.autoClear; r.autoClear = false; r.setRenderTarget(lese); r.render(this.szene, this.kam); r.autoClear = ac;
  }
}

// ---------------------------------------------------------------- Steuerung
export class Tag {
  // z: { LUFT, fels, lichtU, strahlen, sonne, hemi, laternen: [Sprite], regen: NiederschlagPass, ton, neuSpiegeln(), aufWechsel(P) }
  constructor(z) {
    this.z = z; this.live = true; this.stunde = 12; this.wetterLive = true; this.wetter = { art: 'klar', wolken: 0.15, temp: null, wind: 8 }; this.wahl = null; this.zeit = 0; this.naechst = 0; this.decke = 0; this.nass = 0; this.P = null; this.h = 0;
    this.el = { regler: document.getElementById('z_regler'), text: document.getElementById('z_text'), live: document.getElementById('z_live'), wetter: document.getElementById('z_wetter') };
    if (this.el.regler) {
      this.el.regler.addEventListener('input', () => { this.live = false; this.stunde = +this.el.regler.value; this.naechst = 0; this.zeige(); });
      this.el.live.onclick = () => { this.live = true; this.wahl = null; this.el.wetter.value = 'live'; this.naechst = 0; this.zeige(); };
      this.el.wetter.onchange = () => { this.wahl = this.el.wetter.value === 'live' ? null : this.el.wetter.value; this.naechst = 0; this.zeige(); };
    }
    this.ladeWetter(); setInterval(() => this.ladeWetter(), 10 * 60 * 1000);
  }
  async ladeWetter() {
    try { const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,weather_code,cloud_cover,precipitation,snowfall,wind_speed_10m&timezone=Europe%2FBerlin'); const c = (await r.json()).current;
      this.wetter = { art: wetterArt(c.weather_code), wolken: c.cloud_cover / 100, temp: c.temperature_2m, wind: c.wind_speed_10m, menge: c.precipitation, ok: true }; this.naechst = 0; this.zeige(); } catch (e) { this.wetter.ok = false; }
  }
  jetztMs() { const jetzt = Date.now(); return this.live ? jetzt : jetzt + (this.stunde - berlinStunde(jetzt)) * 3600000; }
  art() { return this.wahl || this.wetter.art; }
  zeige() {
    if (!this.el.text) return; const s = this.live ? berlinStunde(Date.now()) : this.stunde, hh = Math.floor(s) % 24, mm = Math.floor((s - Math.floor(s)) * 60); if (this.live) this.el.regler.value = s;
    const w = this.art(), t = this.wetter.temp; this.el.text.textContent = `Berlin ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${WORT[w]}${t !== null && !this.wahl ? ' · ' + Math.round(t) + ' °C' : ''}`; this.el.live.classList.toggle('an', this.live && !this.wahl);
  }
  update(dt) {
    this.zeit += dt; const z = this.z, art = this.art();
    // Wetter gleitet weich: Wolkendecke und Niederschlag
    const deckeZiel = art === 'klar' ? 0 : art === 'wolken' ? (this.wahl ? 0.75 : THREE.MathUtils.smoothstep(this.wetter.wolken, 0.3, 0.95)) : 1, nassZiel = (art === 'regen' || art === 'gewitter') ? (art === 'gewitter' ? 1 : this.wahl ? 0.7 : THREE.MathUtils.clamp(0.35 + (this.wetter.menge || 0.5) * 0.5, 0.35, 1)) : art === 'schnee' ? 0.8 : 0;
    const k = 1 - Math.exp(-dt * 0.9); const vorDecke = this.decke; this.decke += (deckeZiel - this.decke) * k; this.nass += (nassZiel - this.nass) * k; if (art === 'schnee') this.schnee = 1; else if (art === 'regen' || art === 'gewitter') this.schnee = 0;
    if (z.regen) { z.regen.staerke = this.nass; z.regen.art = this.schnee ? 1 : 0; z.regen.U.uZeit.value = this.zeit; z.regen.U.uWind.value.set(1 + (this.wetter.wind || 8) * 0.14, 0.6); }
    this.regenTon(dt);
    this.naechst -= dt; if (this.naechst > 0 && Math.abs(vorDecke - this.decke) < 0.0005) return; this.naechst = 0.5;
    const ms = this.jetztMs(), st = sonnenstand(ms), h = st.hoehe; this.h = h; const P = mische(h), d = this.decke; this.P = P;
    // Richtung zur Sonne: Westen liegt dort, wo bisher die Abendsonne stand. Nachts leuchtet der Mond.
    const th = -(st.azimut - 270) * RAD, bx = 0.21, bz = -0.977, x = bx * Math.cos(th) - bz * Math.sin(th), zz = bx * Math.sin(th) + bz * Math.cos(th), hr = Math.max(h, -12) * RAD; const nacht = h < -9.5;
    const dir = nacht ? new THREE.Vector3(-x * 0.6 + zz * 0.5, 0, -zz * 0.6 - x * 0.5).normalize().multiplyScalar(Math.cos(34 * RAD)).setY(Math.sin(34 * RAD)) : new THREE.Vector3(x * Math.cos(hr), Math.sin(hr), zz * Math.cos(hr));
    // Wetter daempft Sonne, Sterne und Strahlen und zieht alles ins Grau
    const grau = mal([0.86, 0.9, 1.0], (lum(P.mitte) * 0.6 + lum(P.tief) * 0.5) * 0.85), klar = 1 - d;
    P.scheibe = mal(P.scheibe, klar * klar); P.schein = mal(P.schein, 1 - 0.85 * d); P.sterne *= klar * klar; P.strahl *= 1 - 0.88 * d; P.glut = mal(P.glut, klar); P.horS = zu(P.horS, P.horG, d * 0.75); P.wl = mal(P.wl, 1 - 0.65 * d); P.wsaum = mal(P.wsaum, 1 - 0.8 * d); P.bergS = mal(P.bergS, 1 - 0.75 * d);
    P.tagL = zu(P.tagL, mal([0.84, 0.9, 1.0], lum(P.tagL) * 0.7), d); P.figS = mal(P.figS, 1 - 0.7 * d); P.zirL = zu(P.zirL, grau, d * 0.8); P.zirS = zu(P.zirS, mal(grau, 0.6), d * 0.8); P.dunst = zu(P.dunst, mal(grau, 0.8), d * 0.6); P.ws2 = zu(P.ws2, mal(grau, 0.75), d * 0.5); P.lampen = Math.min(1, P.lampen + d * 0.35 * (1 - P.lampen));
    const L = z.LUFT, s3 = (u, c) => u.value.setRGB(c[0], c[1], c[2]);
    L.uSonne.value.copy(dir); s3(L.uHorSonne, P.horS); s3(L.uHorGegen, P.horG); s3(L.uGlut, P.glut); s3(L.uZenit, P.zenit); s3(L.uMitte, P.mitte); s3(L.uTief, P.tief); s3(L.uSchein, P.schein); s3(L.uScheibe, P.scheibe); s3(L.uZirS, P.zirS); s3(L.uZirL, P.zirL); s3(L.uGrau, grau);
    s3(L.uBergLicht, mal(P.bergS, 0.62)); L.uSterne.value = P.sterne; L.uDecke.value = d; L.uHell.value = P.hell * (1 - 0.35 * d); L.uStadt.value = P.stadt; s3(L.uWS1, P.ws1); s3(L.uWS2, P.ws2); s3(L.uWL, P.wl); s3(L.uWSaum, P.wsaum); L.uHaus.value = P.haus;
    if (z.fels) { const U = z.fels.material.uniforms; U.uSonne.value.copy(dir).setY(Math.max(dir.y, 0.03)).normalize(); s3(U.uSonnenFarbe, P.bergS); s3(U.uOben, P.bergO); s3(U.uUnten, P.bergU); s3(U.uDunst, P.dunst); U.uHaus.value = P.lampen; }
    if (z.lichtU) { s3(z.lichtU.uTagLicht, P.tagL); z.lichtU.uLampenLicht.value = 0.25 + 0.75 * P.lampen; }
    if (z.strahlen) { z.strahlen.mat.uniforms.uStaerke.value = P.strahl; if (z.strahlen.mat.uniforms.uStrahlFarbe) s3(z.strahlen.mat.uniforms.uStrahlFarbe, P.strahlF); }
    if (z.sonne) { const m = Math.max(...P.figS, 0.001); z.sonne.color.setRGB(P.figS[0] / m, P.figS[1] / m, P.figS[2] / m); z.sonne.intensity = m; }
    if (z.hemi) z.hemi.intensity = P.hemi;
    if (z.laternen) for (const sp of z.laternen) sp.material.opacity = 0.3 + 0.65 * P.lampen;
    if (z.regen) { const hell = Math.min(1, lum(P.mitte) * 1.6 + lum(P.tief) * 0.9 + 0.1); z.regen.U.uLicht.value.setRGB(hell * 0.95, hell, hell * 1.08); }
    if (z.aufWechsel) z.aufWechsel(P, h, d);
    // Spiegelungen neu aufnehmen, wenn sich das Licht merklich geaendert hat
    const kenn = lum(P.tagL) + P.lampen * 0.5 + lum(P.mitte); if (this.kenn === undefined || Math.abs(kenn - this.kenn) > 0.04) { this.kenn = kenn; clearTimeout(this.sp); this.sp = setTimeout(() => z.neuSpiegeln && z.neuSpiegeln(), 350); }
    this.zeige();
  }
  // Regen als leises Rauschen, im Haus gedaempft
  regenTon(dt) {
    const T = this.z.ton; if (!T || !T.ctx || T.ctx.state !== 'running') return; const soll = this.schnee ? 0 : this.nass * 0.16 * (this.z.innen && this.z.innen() ? 0.45 : 1);
    if (!this.rq) { if (soll < 0.005) return; const c = T.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = l * 0.6 + w * 0.4; d[i] = l; }
      this.rq = c.createBufferSource(); this.rq.buffer = b; this.rq.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.35; this.rg = c.createGain(); this.rg.gain.value = 0; this.rq.connect(f); f.connect(this.rg); this.rg.connect(T.aus); this.rq.start(); }
    this.rg.gain.value += (soll - this.rg.gain.value) * Math.min(1, dt * 2);
  }
}
