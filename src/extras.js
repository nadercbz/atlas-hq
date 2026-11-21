// Monitore mit laufendem Inhalt, Buecher mit lesbaren Titeln, Ton (Schritte, Musik).
import * as THREE from 'three';
const B = (x, y, z) => new THREE.Vector3(x, z, -y);

// ================================================================= Monitore
const RAUM_ART = { rechts1: 'code', dachraum: 'suche', links1: 'galerie', links2: 'schnitt', rechts2: 'monitor', halle1: 'baum', platz: 'kurs', rechts0: 'kurs', halle0: 'baum' };
const ART_FIGUR = { code: 'coder', suche: 'scout', galerie: 'maler', schnitt: 'film', monitor: 'funk', baum: 'archiv' };
export class Schirme {
  constructor(scene, nav) {
    this.arten = {}; this.kopf = {}; this.zaehler = 0;
    for (const s of nav.schirme) {
      const art = RAUM_ART[s.raum] || 'kurs';
      if (!this.arten[art]) { const c = document.createElement('canvas'); c.width = 400; c.height = 240; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; this.arten[art] = { c, x: c.getContext('2d'), t, zeit: Math.random() * 50, st: {} }; }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.b, s.h), new THREE.MeshBasicMaterial({ map: this.arten[art].t, color: new THREE.Color(1.5, 1.5, 1.5) }));
      m.position.copy(B(s.x, s.y, s.z)); if (s.quer) m.rotation.y = -Math.PI / 2; scene.add(m);
    }
    this.liste = Object.keys(this.arten); for (const a of this.liste) this.zeichne(a, 0.3);
  }
  setzeKopf(figur, text) { for (const a in ART_FIGUR) if (ART_FIGUR[a] === figur) this.kopf[a] = { text, bis: performance.now() + 30000 }; }
  update(dt) {                                   // pro Bild nur ein Schirm, das haelt es billig
    if (!this.liste.length) return; this.takt = (this.takt || 0) + dt; if (this.takt < 0.07) return; const a = this.liste[this.zaehler++ % this.liste.length]; this.zeichne(a, this.takt * this.liste.length); this.takt = 0;
  }
  zeichne(art, dt) {
    const o = this.arten[art], x = o.x, W = 400, H = 240; o.zeit += dt; const t = o.zeit, st = o.st;
    x.fillStyle = '#0d1117'; x.fillRect(0, 0, W, H); x.font = '11px Menlo, monospace'; x.textBaseline = 'top';
    const kopf = this.kopf[art] && this.kopf[art].bis > performance.now() ? this.kopf[art].text : null;
    const leiste = (titel, farbe) => { x.fillStyle = '#161b22'; x.fillRect(0, 0, W, 22); x.fillStyle = farbe; x.fillRect(0, 21, W, 1); x.fillStyle = '#c9d1d9'; x.fillText((kopf || titel).slice(0, 52), 8, 5); x.fillStyle = kopf ? '#3fd6b4' : '#555'; x.beginPath(); x.arc(W - 12, 11, 4, 0, 7); x.fill(); };
    if (art === 'code') {
      leiste('main.js', '#58a6ff'); if (!st.z) { st.z = []; st.n = 1; }
      const farben = ['#ff7b72', '#79c0ff', '#d2a8ff', '#a5d6ff', '#7ee787', '#c9d1d9', '#8b949e'];
      while (st.z.length < 17 || (t * 3 | 0) > st.letzte) { st.letzte = t * 3 | 0; const e = (Math.random() * 5 | 0) * 14; const teile = []; let n = 1 + (Math.random() * 4 | 0); while (n--) teile.push([farben[Math.random() * farben.length | 0], 18 + Math.random() * 70]); st.z.push({ e, teile, nr: st.n++ }); if (st.z.length > 17) st.z.shift(); if (st.z.length >= 17) break; }
      st.z.forEach((z, i) => { const y = 28 + i * 12.2; x.fillStyle = '#484f58'; x.fillText(String(z.nr).padStart(3), 6, y); let px = 36 + z.e; for (const [f, b] of z.teile) { x.fillStyle = f; x.fillRect(px, y + 2, b, 6); px += b + 6; } });
      if ((t * 2 | 0) % 2) { x.fillStyle = '#c9d1d9'; x.fillRect(40 + st.z[st.z.length - 1].e + 100, 28 + 16 * 12.2, 6, 10); }
    } else if (art === 'kurs') {
      leiste('BTC / EUR  4h', '#f0b90b'); if (!st.k) { st.k = []; let p = 100; for (let i = 0; i < 46; i++) { const o2 = p; p += (Math.random() - 0.48) * 6; st.k.push([o2, p, Math.max(o2, p) + Math.random() * 3, Math.min(o2, p) - Math.random() * 3]); } st.p = p; }
      if ((t * 1.2 | 0) > (st.l || 0)) { st.l = t * 1.2 | 0; const o2 = st.p; st.p += (Math.random() - 0.48) * 6; st.k.push([o2, st.p, Math.max(o2, st.p) + Math.random() * 3, Math.min(o2, st.p) - Math.random() * 3]); st.k.shift(); }
      const mn = Math.min(...st.k.map(k => k[3])), mx = Math.max(...st.k.map(k => k[2])), Y = v => 34 + (1 - (v - mn) / (mx - mn)) * 150;
      x.strokeStyle = '#21262d'; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(0, 34 + i * 37.5); x.lineTo(W, 34 + i * 37.5); x.stroke(); }
      st.k.forEach((k, i) => { const px = 8 + i * 8.2; x.fillStyle = x.strokeStyle = k[1] >= k[0] ? '#2ebd85' : '#f6465d'; x.beginPath(); x.moveTo(px + 2.5, Y(k[2])); x.lineTo(px + 2.5, Y(k[3])); x.stroke(); x.fillRect(px, Math.min(Y(k[0]), Y(k[1])), 5, Math.max(1.5, Math.abs(Y(k[0]) - Y(k[1])))); x.fillRect(px, 232 - Math.abs(k[1] - k[0]) * 5, 5, Math.abs(k[1] - k[0]) * 5); });
    } else if (art === 'galerie') {
      leiste('Bilder', '#e8703a'); const hues = [18, 170, 42, 330, 200, 95];
      for (let i = 0; i < 6; i++) { const px = 10 + (i % 3) * 130, py = 30 + (i / 3 | 0) * 100; const g = x.createLinearGradient(px, py, px + 120, py + 90); const h = hues[(i + (t / 6 | 0)) % 6]; g.addColorStop(0, `hsl(${h},70%,${48 + 10 * Math.sin(t + i)}%)`); g.addColorStop(1, `hsl(${h + 40},60%,22%)`); x.fillStyle = g; x.fillRect(px, py, 120, 90); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(px + 40 + 20 * Math.sin(t * 0.3 + i), py + 40, 18, 0, 7); x.fill(); }
      const f = (t % 6) / 6; x.fillStyle = '#21262d'; x.fillRect(10, 228, 380, 5); x.fillStyle = '#e8703a'; x.fillRect(10, 228, 380 * f, 5);
    } else if (art === 'schnitt') {
      leiste('Timeline 1', '#d2a8ff'); const g = x.createLinearGradient(0, 28, 0, 120); g.addColorStop(0, `hsl(${(t * 8) % 360},45%,40%)`); g.addColorStop(1, '#1b1025'); x.fillStyle = g; x.fillRect(110, 28, 180, 96);
      const farben = ['#3b82f6', '#22c55e', '#eab308', '#ec4899'];
      for (let s = 0; s < 4; s++) { x.fillStyle = '#161b22'; x.fillRect(8, 134 + s * 24, 384, 20); let px = 8 + ((s * 37) % 30); for (let k = 0; k < 6; k++) { const b = 34 + ((k * 53 + s * 29) % 50); x.fillStyle = farben[(k + s) % 4]; x.fillRect(px, 136 + s * 24, b, 16); px += b + 4; if (px > 380) break; } }
      const ph = 8 + ((t * 26) % 384); x.fillStyle = '#ff4d4d'; x.fillRect(ph, 130, 2, 104);
    } else if (art === 'monitor') {
      leiste('Systeme', '#3fd6b4');
      for (let k = 0; k < 2; k++) { x.strokeStyle = k ? '#58a6ff' : '#3fd6b4'; x.lineWidth = 1.5; x.beginPath(); for (let i = 0; i <= 60; i++) { const v = 0.5 + 0.28 * Math.sin(i * 0.3 + t * (1 + k)) + 0.14 * Math.sin(i * 0.9 - t * 2 + k); x.lineTo(10 + i * 6.3, 36 + k * 62 + (1 - v) * 48); } x.stroke(); }
      const namen = ['Dashboard', 'Jarvis', 'Layer Zero', 'Crypto Kette', 'Backup', 'Live Dienst']; namen.forEach((n, i) => { const px = 10 + (i % 3) * 130, py = 168 + (i / 3 | 0) * 32; x.fillStyle = '#161b22'; x.fillRect(px, py, 122, 26); x.fillStyle = (i === 4 && (t / 5 | 0) % 3 === 0) ? '#f6c343' : '#2ebd85'; x.beginPath(); x.arc(px + 12, py + 13, 5, 0, 7); x.fill(); x.fillStyle = '#c9d1d9'; x.fillText(n, px + 24, py + 7); });
    } else if (art === 'suche') {
      leiste('Recherche', '#79c0ff'); x.fillStyle = '#161b22'; x.fillRect(10, 30, 380, 24); x.fillStyle = '#8b949e'; const q = 'quellen prüfen und vergleichen'; x.fillText(q.slice(0, (t * 6 | 0) % (q.length + 14)), 18, 36);
      for (let i = 0; i < 5; i++) { const an = ((t * 0.8 | 0) % 7) > i; if (!an) continue; const py = 64 + i * 34; x.fillStyle = '#79c0ff'; x.fillRect(12, py, 150 + (i * 47) % 120, 7); x.fillStyle = '#30363d'; x.fillRect(12, py + 12, 340 - (i * 31) % 90, 5); x.fillRect(12, py + 20, 250 + (i * 23) % 80, 5); }
    } else {
      leiste('Wissen', '#d2a24c'); for (let i = 0; i < 15; i++) { const e = [0, 1, 2, 2, 1, 2, 2, 2, 0, 1, 2, 1, 2, 2, 1][i] * 16, py = 30 + i * 13.5; const aktiv = (t * 0.7 | 0) % 15 === i; x.fillStyle = aktiv ? '#1f6feb' : 'transparent'; if (aktiv) x.fillRect(4, py - 1, 392, 13); x.fillStyle = e ? '#8b949e' : '#d2a24c'; x.fillRect(10 + e, py + 2, 8, 7); x.fillStyle = '#c9d1d9'; x.fillRect(24 + e, py + 3, 60 + (i * 41) % 130, 5); }
    }
    o.t.needsUpdate = true;
  }
}

// ================================================================= Buecher
export const BUECHER = [
  ['Atomic Habits', 'James Clear', 'Kleine Entscheidungen mit Zinseszins. Genau dein Bild vom spirituellen Bankkonto.'],
  ['The War of Art', 'Steven Pressfield', 'Über den Widerstand vor dem ersten Schritt und wie man trotzdem anfängt.'],
  ['Breaking the Habit of Being Yourself', 'Joe Dispenza', 'Identität wechseln, indem man sich heute schon wie das neue Ich verhält.'],
  ['The Psychology of Money', 'Morgan Housel', 'Warum Geld vor allem Verhalten ist. Passt zu deiner Schwelle im Kopf.'],
  ['The Bitcoin Standard', 'Saifedean Ammous', 'Hartes Geld gegen Papiergeld. Unterbau für deinen Blick auf den Reset.'],
  ['The Sovereign Individual', 'Davidson, Rees-Mogg', 'Wie Technik Macht vom Staat zum Einzelnen verschiebt.'],
  ['Zero to One', 'Peter Thiel', 'Etwas bauen, das es noch nicht gibt, statt Bestehendes zu kopieren.'],
  ['The Almanack of Naval Ravikant', 'Eric Jorgenson', 'Hebel, eigenes Wissen und Ruhe. Kurz, dicht, zum Wiederlesen.'],
  ['Sapiens', 'Yuval Noah Harari', 'Der große Bogen der Menschheit, gut für dein Bild vom Überlebenswunder.'],
  ['Timaios und Kritias', 'Platon', 'Die Quelle der Atlantis Erzählung, auf die du dich beziehst.'],
  ['Fingerprints of the Gods', 'Graham Hancock', 'Spurensuche nach einer verlorenen Hochkultur. Zum kritischen Lesen.'],
  ['Der Alchimist', 'Paulo Coelho', 'Ein Hirte folgt seinem Weg durch Nordafrika. Kurz und nah an deinem Weltbild.'],
  ['Selbstbetrachtungen', 'Mark Aurel', 'Innere Klarheit und Unabhängigkeit von fremder Bestätigung.'],
  ['In the Blink of an Eye', 'Walter Murch', 'Das Standardwerk über Schnitt. Emotion vor Regel.'],
  ['Rebel Without a Crew', 'Robert Rodriguez', 'Ein Film mit fast nichts. Macher Haltung pur.'],
  ['Save the Cat', 'Blake Snyder', 'Struktur für Geschichten, direkt nutzbar für Werbung und Serien.'],
  ['Story', 'Robert McKee', 'Tiefer Blick in Dramaturgie, wenn du Formate größer denken willst.'],
  ['Building a StoryBrand', 'Donald Miller', 'Der Kunde ist der Held. Ein klares Gerüst für Marken und Websites.'],
  ['Contagious', 'Jonah Berger', 'Warum Dinge geteilt werden. Sechs Hebel für Social Content.'],
  ['Hooked', 'Nir Eyal', 'Wie Gewohnheitsprodukte gebaut werden. Gut für Apps wie Bitey.'],
  ['This Is Marketing', 'Seth Godin', 'Marketing als Dienst an einem kleinen, klaren Stamm.'],
  ['$100M Offers', 'Alex Hormozi', 'Angebote so bauen, dass ein Nein schwerfällt. Für deine Pakete.'],
  ['The Lean Startup', 'Eric Ries', 'Bauen, messen, lernen. Passt zu deinem unperfekten Handeln.'],
  ['The E-Myth Revisited', 'Michael E. Gerber', 'Systeme statt Selbstausbeutung. Die Grundlage für Franchise.'],
  ['Shoe Dog', 'Phil Knight', 'Die Nike Geschichte, ehrlich und chaotisch erzählt.'],
  ['The Creative Act', 'Rick Rubin', 'Kreativität als Haltung. Ruhig, klar, zum Aufschlagen an jeder Stelle.'],
  ['Steal Like an Artist', 'Austin Kleon', 'Einflüsse sammeln und zu etwas Eigenem machen.'],
  ['The Coming Wave', 'Mustafa Suleyman', 'Was KI und Biotechnik in den nächsten Jahren verschieben.'],
  ['Life 3.0', 'Max Tegmark', 'Szenarien für eine Welt mit starker KI, nüchtern durchgedacht.'],
  ['Superintelligence', 'Nick Bostrom', 'Die Risiken sehr fähiger Systeme. Fordernd, aber grundlegend.'],
  ['Co-Intelligence', 'Ethan Mollick', 'Praktisch mit KI arbeiten, ohne das eigene Denken abzugeben.'],
  ['Trading in the Zone', 'Mark Douglas', 'Die Psyche hinter dem Trade. Wahrscheinlichkeiten statt Hoffnung.'],
  ['Reminiscences of a Stock Operator', 'Edwin Lefèvre', 'Hundert Jahre alt und immer noch die beste Schule für Märkte.'],
  ['Principles', 'Ray Dalio', 'Entscheidungen als Regeln festhalten. Passt zu deinen Agenten.'],
  ['Principles for Dealing with the Changing World Order', 'Ray Dalio', 'Zyklen von Geld und Macht. Hintergrund für den großen Reset.'],
  ['Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'Vermögenswerte statt Lohn. Einfach, aber wirksam.'],
  ['Think and Grow Rich', 'Napoleon Hill', 'Der Klassiker über Wunsch, Glaube und Ausdauer.'],
  ['Jetzt! Die Kraft der Gegenwart', 'Eckhart Tolle', 'Loslassen statt Erzwingen, im Hier und Jetzt.'],
  ['… trotzdem Ja zum Leben sagen', 'Viktor E. Frankl', 'Sinn als stärkste Kraft, selbst unter härtesten Umständen.'],
  ['Die vier Versprechen', 'Don Miguel Ruiz', 'Vier einfache Regeln für innere Freiheit.'],
  ['Deep Work', 'Cal Newport', 'Konzentration als seltene Fähigkeit in einer lauten Welt.'],
  ['Flow', 'Mihály Csíkszentmihályi', 'Warum wir in fordernder Arbeit am glücklichsten sind.'],
  ['Die Muqaddima', 'Ibn Khaldun', 'Nordafrikanischer Denker über Aufstieg und Fall von Gesellschaften.'],
  ['Die Reisen des Ibn Battuta', 'Ibn Battuta', 'Ein Marokkaner bereist im 14. Jahrhundert die halbe Welt.'],
  ['The Berbers', 'Brett, Fentress', 'Geschichte der Imazighen von der Antike bis heute.'],
  ['The Mom Test', 'Rob Fitzpatrick', 'Kunden so befragen, dass sie die Wahrheit sagen.'],
  ['Never Split the Difference', 'Chris Voss', 'Verhandeln mit Empathie, vom früheren FBI Verhandler.'],
  ['Influence', 'Robert B. Cialdini', 'Die Psychologie des Überzeugens, Pflicht für Marketing.'],
  ['Made to Stick', 'Chip und Dan Heath', 'Warum manche Ideen hängen bleiben und andere nicht.'],
  ['Building a Second Brain', 'Tiago Forte', 'Wissen so ablegen, dass man es wiederfindet. Passt zu deinem Vault.'],
  ['Die Kunst des klaren Denkens', 'Rolf Dobelli', 'Denkfehler kurz erklärt. Gut gegen die NPC Falle.'],
  ['Antifragile', 'Nassim Nicholas Taleb', 'Dinge, die durch Stöße stärker werden. Auch für Portfolios.'],
  ['Die Kunst des Krieges', 'Sunzi', 'Strategie in knappen Sätzen, über Jahrtausende gültig.'],
  ['Das Buch der fünf Ringe', 'Miyamoto Musashi', 'Der Weg des Könners, der alles selbst gelernt hat.'],
];

export function baueBuecher(scene, nav) {
  const SP = 16, ZE = 4, CW = 128, CH = 512, c = document.createElement('canvas'); c.width = SP * CW; c.height = ZE * CH; const x = c.getContext('2d');
  const farben = ['#7a2e24', '#1f5a56', '#c79a3e', '#2b2b31', '#e6dccb', '#8a4a2a', '#34506e', '#5a3a5e', '#3e5a3a', '#b5523a', '#d8c7a4', '#17323a'];
  for (let i = 0; i < SP * ZE; i++) {
    const b = BUECHER[i % BUECHER.length], px = (i % SP) * CW, py = (i / SP | 0) * CH, f = farben[(i * 7 + 3) % farben.length], hell = ['#e6dccb', '#c79a3e', '#d8c7a4'].includes(f);
    x.fillStyle = f; x.fillRect(px, py, CW, CH); const g = x.createLinearGradient(px, 0, px + CW, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.18, 'rgba(255,255,255,.07)'); g.addColorStop(0.82, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); x.fillStyle = g; x.fillRect(px, py, CW, CH);
    const tinte = hell ? '#2a1c12' : (i % 3 === 0 ? '#e8c877' : '#f1e8d8'); x.fillStyle = tinte; x.fillRect(px + 10, py + 26, CW - 20, 3); x.fillRect(px + 10, py + 34, CW - 20, 1.5); x.fillRect(px + 10, py + CH - 62, CW - 20, 3);
    x.save(); x.translate(px + CW / 2, py + CH / 2 - 6); x.rotate(Math.PI / 2); x.textAlign = 'center'; x.textBaseline = 'middle';
    let gr = 46; x.font = `600 ${gr}px Georgia, serif`; while (x.measureText(b[0]).width > 380 && gr > 15) { gr -= 2; x.font = `600 ${gr}px Georgia, serif`; }
    x.fillText(b[0], 0, -12); x.font = `italic 19px Georgia, serif`; x.globalAlpha = 0.85; x.fillText(b[1], 0, 30); x.restore();
    x.fillStyle = tinte; x.beginPath(); x.arc(px + CW / 2, py + CH - 34, 9, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.generateMipmaps = true;
  const pos = [], uv = [], idx = []; let zufall = 12345; const rnd = () => (zufall = (zufall * 1664525 + 1013904223) >>> 0) / 4294967296;
  const flaeche = (p, u) => { const n = pos.length / 3; for (const q of p) pos.push(q.x, q.y, q.z); uv.push(...u); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const zonen = [];
  for (const r of nav.regale) {
    const P = (a, tiefe, z) => r.achse === 'x' ? B(r.fest - tiefe, a, z) : B(a, r.fest - tiefe, z);
    zonen.push(r);
    for (const zz of r.reihen) {
      let a = r.a0; while (a < r.a1 - 0.08) {
        const d = 0.034 + rnd() * 0.034, h = r.hoehe * (0.72 + rnd() * 0.26), t = 0.2 + rnd() * 0.07, i = rnd() * SP * ZE | 0;
        if (rnd() < 0.07) { a += 0.06 + rnd() * 0.1; continue; }
        if (r.teile.some(k => a < k + 0.03 && a + d > k - 0.03)) { a += 0.07; continue; }
        if (a + d > r.a1) break;
        const u0 = (i % SP) / SP, v1 = 1 - (i / SP | 0) / ZE, u1 = u0 + 1 / SP, v0 = v1 - 1 / ZE, e = 0.004 / SP, ru = [u0 + 0.5 / SP - e, v0 + 0.03 / ZE, u0 + 0.5 / SP + e, v0 + 0.03 / ZE, u0 + 0.5 / SP + e, v0 + 0.05 / ZE, u0 + 0.5 / SP - e, v0 + 0.05 / ZE];
        const A = a, Bb = a + d, T0 = 0.05, T1 = 0.05 + t, Z0 = zz, Z1 = zz + h;
        // Buchruecken zeigt zur Kamera (weg von der Wand). Reihenfolge der Ecken je Achse so, dass die Schrift richtig herum steht.
        if (r.achse === 'x') flaeche([P(Bb, T1, Z0), P(A, T1, Z0), P(A, T1, Z1), P(Bb, T1, Z1)], [u0, v0, u1, v0, u1, v1, u0, v1]);
        else flaeche([P(A, T1, Z0), P(Bb, T1, Z0), P(Bb, T1, Z1), P(A, T1, Z1)], [u0, v0, u1, v0, u1, v1, u0, v1]);
        flaeche([P(A, T1, Z1), P(Bb, T1, Z1), P(Bb, T0, Z1), P(A, T1 - t, Z1)], ru);                       // oben
        flaeche([P(A, T0, Z0), P(A, T1, Z0), P(A, T1, Z1), P(A, T0, Z1)], ru); flaeche([P(Bb, T1, Z0), P(Bb, T0, Z0), P(Bb, T0, Z1), P(Bb, T1, Z1)], ru);   // Seiten
        a += d + 0.002;
      }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: '#b7a48e', side: THREE.DoubleSide })); scene.add(mesh);
  return { mesh, zonen };
}
export function buchVorschlaege(n = 5) { const l = BUECHER.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[l[i], l[j]] = [l[j], l[i]]; } return l.slice(0, n); }

// ================================================================= Ton
export class Ton {
  constructor() { this.an = true; try { this.an = localStorage.getItem('atlas_ton') !== '0'; } catch (e) { } this.ctx = null; this.puffer = []; this.musik = null; }
  async start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.aus = this.ctx.createGain(); this.aus.gain.value = this.an ? 1 : 0; this.aus.connect(this.ctx.destination);
    // kleiner Raumhall aus Rauschen: die Halle klingt gross
    const len = this.ctx.sampleRate * 1.6, ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate); for (let k = 0; k < 2; k++) { const d = ir.getChannelData(k); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.hall = this.ctx.createConvolver(); this.hall.buffer = ir; const hg = this.ctx.createGain(); hg.gain.value = 0.22; this.hall.connect(hg); hg.connect(this.aus);
    this.musik = new Audio('./assets/ton/musik_mondschein.mp3'); this.musik.loop = true; this.musik.volume = 0.16; if (this.an) this.musik.play().catch(() => { });
    for (let i = 1; i <= 6; i++) fetch(`./assets/ton/schritt_${i}.mp3`).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(p => this.puffer.push(p)).catch(() => { });
  }
  schalte() { this.an = !this.an; try { localStorage.setItem('atlas_ton', this.an ? '1' : '0'); } catch (e) { } if (this.aus) this.aus.gain.value = this.an ? 1 : 0; if (this.musik) { if (this.an) this.musik.play().catch(() => { }); else this.musik.pause(); } return this.an; }
  leiser(ja) { if (this.musik) this.musik.volume = ja ? 0.05 : 0.16; }             // beim Reden tritt die Musik zurueck
  // boden: fliese | holz | metall | teppich. staerke 0..1
  schritt(boden, staerke = 1, laut = 1) {
    if (!this.ctx || !this.an || !this.puffer.length || this.ctx.state !== 'running') return; const c = this.ctx, t = c.currentTime;
    const q = c.createBufferSource(); q.buffer = this.puffer[Math.random() * this.puffer.length | 0]; const f = c.createBiquadFilter(), g = c.createGain(); let v = 0.5;
    if (boden === 'holz') { q.playbackRate.value = 0.78 + Math.random() * 0.1; f.type = 'lowpass'; f.frequency.value = 1500; v = 0.75; }
    else if (boden === 'metall') { q.playbackRate.value = 1.1 + Math.random() * 0.12; f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = 1.4; v = 0.9; }
    else if (boden === 'teppich') { q.playbackRate.value = 0.7 + Math.random() * 0.08; f.type = 'lowpass'; f.frequency.value = 600; v = 0.4; }
    else { q.playbackRate.value = 0.96 + Math.random() * 0.12; f.type = 'highshelf'; f.frequency.value = 2500; f.gain.value = 5; v = 0.55; }
    g.gain.value = 0.4 * v * laut * (0.75 + 0.25 * staerke) * (0.85 + Math.random() * 0.3); q.connect(f); f.connect(g); g.connect(this.aus); g.connect(this.hall); q.start(t);
    if (boden === 'metall') { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 520 + Math.random() * 180; og.gain.setValueAtTime(0.014 * laut, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.35); o.connect(og); og.connect(this.aus); og.connect(this.hall); o.start(t); o.stop(t + 0.4); }
  }
  dumpf(laut = 1) { if (!this.ctx || !this.an || this.ctx.state !== 'running') return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.16); g.gain.setValueAtTime(0.35 * laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(this.aus); g.connect(this.hall); o.start(t); o.stop(t + 0.25); }
}
