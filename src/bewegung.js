// Bewegung der Figuren direkt an den Knochen, ohne fertige Clips.
// Modellraum: die Figur schaut nach +Z, oben ist +Y, ihr linkes Bein liegt bei +X.
// Drehung um X: negativ = Bein oder Arm nach vorn, positiv = Knie beugen oder Oberkoerper nach vorn neigen.
import * as THREE from 'three';
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const weich = (a, b, k) => a + (b - a) * k;

export class Koerper {
  constructor(modell, hoehe) {
    this.modell = modell; this.hoehe = hoehe; this.k = {}; this.ruhe = {}; this.welt = {}; this.d = {};
    modell.updateMatrixWorld(true); const inv = modell.getWorldQuaternion(new THREE.Quaternion()).invert();
    modell.traverse(o => { if (o.isBone) { this.k[o.name] = o; this.ruhe[o.name] = o.quaternion.clone(); this.welt[o.name] = o.getWorldQuaternion(new THREE.Quaternion()).premultiply(inv); this.d[o.name] = new THREE.Quaternion(); } });
    this.phase = Math.random() * 6; this.gang = 0; this.lauf = 0; this.zeit = Math.random() * 10; this.luft = 0; this.landung = 0; this.gewicht = { talk: 0, work: 0 }; this.schrittNr = 0;
  }
  dreh(name, achse, winkel) { const d = this.d[name]; if (d && winkel) d.premultiply(q1.setFromAxisAngle(achse, winkel)); }
  // tempo in m/s, zustand: idle | talk | work, inLuft: 0..1, rueck liefert true bei jedem Fussaufsatz
  update(dt, tempo, zustand, inLuft = 0) {
    this.zeit += dt; const t = this.zeit; let schritt = false;
    for (const n in this.d) this.d[n].identity();
    const zielGang = Math.min(1, tempo / 0.9); this.gang = weich(this.gang, zielGang, 1 - Math.exp(-dt * 9));
    const zielLauf = THREE.MathUtils.clamp((tempo - 2.6) / 2.2, 0, 1); this.lauf = weich(this.lauf, zielLauf, 1 - Math.exp(-dt * 6));
    this.gewicht.talk = weich(this.gewicht.talk, zustand === 'talk' ? 1 : 0, 1 - Math.exp(-dt * 6)); this.gewicht.work = weich(this.gewicht.work, zustand === 'work' ? 1 : 0, 1 - Math.exp(-dt * 5));
    this.luft = weich(this.luft, inLuft, 1 - Math.exp(-dt * 14)); this.landung = Math.max(0, this.landung - dt * 4.5);
    // Schrittlaenge haengt an der Koerpergroesse: so rutschen die Fuesse nicht
    const halberSchritt = this.hoehe * (0.36 + 0.2 * this.lauf); const alt = this.phase; this.phase += Math.PI * tempo * dt / halberSchritt;
    if (Math.floor(this.phase / Math.PI) !== Math.floor(alt / Math.PI) && this.gang > 0.3 && this.luft < 0.3) { schritt = true; this.schrittNr++; }
    const g = this.gang * (1 - this.luft), p = this.phase, s = Math.sin(p), c = Math.cos(p), A = (0.46 + 0.26 * this.lauf) * g;
    // Beine: Schwung aus der Huefte, Knie beugt in der Schwungphase und federt leicht beim Aufsetzen
    const knieMax = (1.05 + 0.5 * this.lauf) * g;
    const knieL = knieMax * Math.pow(0.5 + 0.5 * c, 2.2) + 0.16 * g * Math.max(0, Math.sin(p + 2.5)), knieR = knieMax * Math.pow(0.5 - 0.5 * c, 2.2) + 0.16 * g * Math.max(0, Math.sin(p + 2.5 + Math.PI));
    this.dreh('leg_L', AX, -A * s - 0.1 * g - knieL * 0.32); this.dreh('leg_R', AX, A * s - 0.1 * g - knieR * 0.32);
    this.dreh('shin_L', AX, knieL); this.dreh('shin_R', AX, knieR);
    // Becken und Oberkoerper: gegenlaeufige Drehung, leichte Neigung nach vorn, Kopf bleibt ruhig
    this.dreh('hips', AY, 0.13 * s * g); this.dreh('hips', AZ, 0.045 * s * g);
    const neig = (0.05 + 0.13 * this.lauf) * g;
    this.dreh('spine', AY, -0.22 * s * g); this.dreh('spine', AZ, -0.04 * s * g); this.dreh('spine', AX, neig + 0.012 * Math.sin(t * 1.7) * (1 - g));
    this.dreh('head', AY, 0.1 * s * g + 0.14 * Math.sin(t * 0.37) * (1 - g) * (1 - this.gewicht.work)); this.dreh('head', AX, -neig * 0.7);
    // Arme (nur wo es Armknochen gibt): Gegenschwung, Ellbogen federt mit
    const arm = (0.55 + 0.35 * this.lauf) * g;
    this.dreh('arm_L', AX, arm * s + 0.04); this.dreh('arm_R', AX, -arm * s + 0.04);
    this.dreh('forearm_L', AX, -(0.28 * g + 0.75 * this.lauf * g + 0.3 * arm * Math.max(0, -s))); this.dreh('forearm_R', AX, -(0.28 * g + 0.75 * this.lauf * g + 0.3 * arm * Math.max(0, s)));
    this.dreh('arm_L', AZ, 0.06 * (1 - g)); this.dreh('arm_R', AZ, -0.06 * (1 - g));
    // Reden: Kopf nickt unregelmaessig, Haende gestikulieren
    const r = this.gewicht.talk * (1 - g); if (r > 0.01) {
      const n = Math.sin(t * 4.3) * Math.sin(t * 1.3 + 1); this.dreh('head', AX, 0.07 * n * r + 0.03 * r); this.dreh('head', AZ, 0.05 * Math.sin(t * 0.9) * r); this.dreh('spine', AX, 0.03 * r + 0.015 * Math.sin(t * 2.1) * r);
      this.dreh('arm_R', AX, -(0.5 + 0.18 * Math.sin(t * 2.6)) * r); this.dreh('forearm_R', AX, -(0.9 + 0.3 * Math.sin(t * 3.1 + 1)) * r); this.dreh('arm_L', AX, -0.12 * r); this.dreh('forearm_L', AX, -0.35 * r);
    }
    // Arbeiten: vorgebeugt, Blick nach unten, Haende vor dem Koerper
    const w = this.gewicht.work * (1 - g); if (w > 0.01) {
      this.dreh('spine', AX, 0.2 * w + 0.012 * Math.sin(t * 1.1) * w); this.dreh('head', AX, 0.16 * w + 0.03 * Math.sin(t * 0.8) * w); this.dreh('head', AY, 0.09 * Math.sin(t * 0.5) * w);
      this.dreh('arm_L', AX, -0.55 * w); this.dreh('arm_R', AX, -0.55 * w); this.dreh('forearm_L', AX, -(0.85 + 0.05 * Math.sin(t * 7)) * w); this.dreh('forearm_R', AX, -(0.85 + 0.05 * Math.sin(t * 6.1 + 2)) * w);
    }
    // In der Luft: Knie angezogen, Arme hoch
    const l = this.luft; if (l > 0.01) {
      this.dreh('leg_L', AX, -0.55 * l); this.dreh('leg_R', AX, -0.2 * l); this.dreh('shin_L', AX, 1.0 * l); this.dreh('shin_R', AX, 0.7 * l); this.dreh('spine', AX, 0.1 * l);
      this.dreh('arm_L', AX, -0.9 * l); this.dreh('arm_R', AX, -0.7 * l); this.dreh('forearm_L', AX, -0.6 * l); this.dreh('forearm_R', AX, -0.6 * l); this.dreh('arm_L', AZ, 0.35 * l); this.dreh('arm_R', AZ, -0.35 * l);
    }
    // Landung: kurz in die Knie
    const la = Math.sin(Math.min(1, this.landung) * Math.PI) * 0.5; if (la > 0.01) { this.dreh('leg_L', AX, -0.5 * la); this.dreh('leg_R', AX, -0.5 * la); this.dreh('shin_L', AX, 1.0 * la); this.dreh('shin_R', AX, 1.0 * la); this.dreh('spine', AX, 0.25 * la); }
    // Regie (Videos): zusaetzliche Gesten von aussen, gleiche Achsen wie oben
    if (this.zusatz) this.zusatz(this, t, g);
    // anwenden: Drehung im Modellraum in den Ruheraum des Knochens uebersetzen
    for (const n in this.d) { const W = this.welt[n]; q2.copy(W).invert().multiply(this.d[n]).multiply(W); this.k[n].quaternion.copy(this.ruhe[n]).multiply(q2); }
    // Hoehe des Koerpers: weiches Auf und Ab, zweimal pro Schrittzyklus, plus Atmen. Tief, wenn beide Fuesse am Boden sind.
    const wipp = this.hoehe * (0.016 + 0.014 * this.lauf) * g * Math.cos(2 * p);
    const atmen = this.hoehe * 0.004 * Math.sin(t * 1.7) * (1 - g);
    const hocke = -this.hoehe * (0.03 * g + 0.035 * la * 2 + 0.02 * w);
    this.modell.position.y = wipp + atmen + hocke;
    return schritt;
  }
}
