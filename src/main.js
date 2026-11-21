// Atlas HQ. Welt mit gebackenem Cycles Licht, volumetrischen Lichtstrahlen, Klick Laufen, Third und First Person.
// Koordinaten: die Welt kommt aus Blender (x, y waagerecht, z hoch). Three: (x, z, -y).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { Nav } from './nav.js';
import { Koerper } from './bewegung.js';
import { baueHimmel, baueFels, WolkenPass, LUFT } from './aussen.js';
import { Tag, NiederschlagPass } from './tag.js';
import { Voegel, Falter, Vierbeiner, Holo, Laub } from './leben.js';
import { Farbe } from './farbe.js';
import { Schirme, baueBuecher, buchVorschlaege, Ton } from './extras.js';

const $ = (id) => document.getElementById(id);
const B = (x, y, z) => new THREE.Vector3(x, z, -y);            // Blender nach Three
const MOBIL = matchMedia('(pointer:coarse)').matches;
const Q = new URLSearchParams(location.search);
const TOUCH = MOBIL || Q.has('touch');
const REGIE = Q.get('regie'), REGIE_DT = 1 / (+Q.get('fps') || 60);            // Regie: Video Aufnahme Bild fuer Bild mit fester Zeit (regie/<name>.js)            // Touch Steuerung: Joystick links, Knoepfe rechts, Ziehen im Bild schaut sich um

// ---------------------------------------------------------------- Renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// Schaerfe: das Bild selbst bleibt hoch aufgeloest (am Handy bis 2,5 fach, nie unter 1,6 fach). Gespart wird zuerst bei den weichen Effekten
// (Wolken, Lichtstrahlen, Bloom), die in eigener, kleinerer Aufloesung laufen (effekt.pr, bezogen auf CSS Pixel).
const PR_MAX = Math.min(devicePixelRatio, MOBIL ? 2.5 : 1.5), PR_MIN = Math.min(PR_MAX, MOBIL ? 1.6 : 0.8);
const effekt = { pr: MOBIL ? 0.6 : 0.88, max: MOBIL ? 0.75 : 0.88, min: MOBIL ? 0.34 : 0.45 };
renderer.setPixelRatio(REGIE ? (+Q.get('pr') || 2) : Math.min(PR_MAX, 2)); if (REGIE) { effekt.pr = effekt.max = effekt.min = +Q.get('epr') || 1.4; document.body.classList.add('regie'); }
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a3438');

const [nav, lichtInfo, figurenListe] = await Promise.all([
  fetch('./assets/welt/nav.json').then(r => r.json()),
  fetch('./assets/welt/licht.json').then(r => r.json()),
  fetch('./assets/figuren/figuren.json').then(r => r.ok ? r.json() : []).catch(() => []),
]);
const NAV = new Nav(nav);
const SONNE = new THREE.Vector3(...nav.sonne);                    // Blender, Richtung des Lichts
const ZUR_SONNE_B = SONNE.clone().multiplyScalar(-1);

// ---------------------------------------------------------------- Material
const texLader = new THREE.TextureLoader();
function tex(datei, meter) {
  const t = texLader.load('./assets/tex/' + datei); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(1 / meter, 1 / meter); t.anisotropy = 8; return t;
}
// t: [Datei, Meter je Bild]. sp: [Spiegelung, Rauheit, Grundreflexion]
const MAT = {
  putz_sand: { c: '#ecd9b6', t: ['putz_sand.webp', 3.2], sp: [0.35, 0.55, 0.04] }, putz_terra: { c: '#ffffff', t: ['putz_terra.webp', 3.2], sp: [0.4, 0.5, 0.04] },
  putz_rot: { c: '#e0b8ae', t: ['putz_terra.webp', 3.2], sp: [0.4, 0.5, 0.04] }, putz_teal: { c: '#ffffff', t: ['putz_teal.webp', 3.2], sp: [0.5, 0.45, 0.04] },
  fliese_rot: { c: '#ffffff', t: ['fliese_rot.webp', 1.3], sp: [1.0, 0.16, 0.06] }, zellige_teal: { c: '#5f8f8a', t: ['zellige_b.webp', 3.0], sp: [0.6, 0.3, 0.05] }, zellige_gruen: { c: '#93ad9c', t: ['zellige_a.webp', 3.6], sp: [0.6, 0.3, 0.05] },
  eiche: { c: '#e6d6c2', t: ['eiche.webp', 4.0], sp: [0.5, 0.36, 0.045] }, holz_dunkel: { c: '#b9a595', t: ['nussbaum.webp', 1.6], sp: [0.6, 0.35, 0.04] }, tischplatte: { c: '#ffffff', t: ['nussbaum.webp', 1.4], sp: [0.9, 0.22, 0.05] },
  stahl: { c: '#74747a', t: ['stahl.webp', 1.5], sp: [0.8, 0.32, 0.25] }, messing: { c: '#b08a3a', metall: true },
  stein_weiss: { c: '#f4ecdf', t: ['kalkstein.webp', 2.0], sp: [0.35, 0.45, 0.04] }, laub: { c: '#5e7145' }, laub_hell: { c: '#7d8c58' }, stamm: { c: '#ffffff', t: ['rinde.webp', 1.0] },
  teppich_rot: { c: '#ffffff', t: ['teppich_rot.webp', 2.4] }, teppich_gruen: { c: '#ffffff', t: ['teppich_gruen.webp', 2.4] }, stoff: { c: '#ffffff', t: ['stoff.webp', 0.8] },
  schnitt: { c: '#b98f78', flach: true }, decke: { c: '#ffffff', t: ['decke.webp', 2.6], sp: [0.3, 0.45, 0.04] }, ton: { c: '#ffffff', t: ['ton.webp', 1.0], sp: [0.15, 0.6, 0.04] }, papier: { c: '#e9e1d1' },
  emi_holo: { c: '#0b2b2a', e: 1.0 }, emi_warm: { c: '#ffb060', e: 6 }, emi_screen: { c: '#a8d4ff', e: 1.6 }, emi_teal: { c: '#3fd6b4', e: 3 }, emi_rot: { c: '#ff5a36', e: 3 }, kabel: { c: '#0c0c0c', e: 1 },
};
// Spiegelung: ein Wuerfelbild der fertig beleuchteten Halle, im Shader auf die Raumgrenzen projiziert (Box Projektion), mit Fresnel
const spiegelU = { uEnv: { value: null }, uProbe: { value: B(18, 18, 8) }, uAn: { value: 0 }, uReliefLicht: { value: new THREE.Vector3(0.35, 0.8, -0.5).normalize() }, uRelief: { value: 0.0055 } };
function spiegelnd(m, sp) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEnv = spiegelU.uEnv; sh.uniforms.uProbe = spiegelU.uProbe; sh.uniforms.uAn = spiegelU.uAn; sh.uniforms.uSp = { value: new THREE.Vector3(...sp) }; sh.uniforms.uReliefLicht = spiegelU.uReliefLicht; sh.uniforms.uRelief = spiegelU.uRelief;
    sh.vertexShader = 'varying vec3 vAtlasP; varying vec3 vAtlasN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vAtlasP = (modelMatrix * vec4(transformed, 1.0)).xyz; vAtlasN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = 'varying vec3 vAtlasP; varying vec3 vAtlasN; uniform samplerCube uEnv; uniform vec3 uProbe; uniform float uAn; uniform vec3 uSp; uniform vec3 uReliefLicht; uniform float uRelief;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 aN = normalize(vAtlasN); if (!gl_FrontFacing) aN = -aN;
      #ifdef USE_MAP
      {   // Relief aus der Textur: helle Stellen stehen vor, Fugen und Poren liegen tiefer. Das gibt jedem Material Koernung im Licht und in der Spiegelung.
        vec2 aDx = dFdx(vMapUv), aDy = dFdy(vMapUv); float aH = dot(texture2D(map, vMapUv).rgb, vec3(0.333)), aBx = dot(texture2D(map, vMapUv + aDx).rgb, vec3(0.333)) - aH, aBy = dot(texture2D(map, vMapUv + aDy).rgb, vec3(0.333)) - aH;
        vec3 aSx = dFdx(vAtlasP), aSy = dFdy(vAtlasP), aR1 = cross(aSy, aN), aR2 = cross(aN, aSx); float aDet = dot(aSx, aR1); vec3 aG = sign(aDet) * (aBx * aR1 + aBy * aR2);
        vec3 aNb = normalize(abs(aDet) * aN - uRelief * aG); outgoingLight *= clamp(1.0 + (dot(aNb, uReliefLicht) - dot(aN, uReliefLicht)) * 1.5, 0.55, 1.5); aN = normalize(mix(aN, aNb, 0.7));
      }
      #endif
      if (uAn > 0.5 && uSp.x > 0.001) {
        vec3 aV = isOrthographic ? normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])) : normalize(cameraPosition - vAtlasP);
        vec3 aR = reflect(-aV, aN);
        vec3 t1 = (vec3(40.6, 20.0, 0.0) - vAtlasP) / aR, t2 = (vec3(0.0, -0.6, -40.6) - vAtlasP) / aR; vec3 tm = max(t1, t2); float tt = max(min(min(tm.x, tm.y), tm.z), 0.0);
        vec3 aD = vAtlasP + aR * tt - uProbe; vec3 aE = textureLod(uEnv, aD, uSp.y * 7.0).rgb;
        float aF = uSp.z + (1.0 - uSp.z) * pow(1.0 - max(dot(aN, aV), 0.0), 5.0);
        outgoingLight += min(aE, vec3(6.0)) * aF * uSp.x;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'atlas-spiegel';
}
const pmrem = new THREE.PMREMGenerator(renderer);
const umgebung = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const lichtKarten = {};
for (const g of ['LM0', 'LM1', 'LM2']) {
  const t = texLader.load(`./assets/welt/licht_${g}.webp`); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.anisotropy = 4; lichtKarten[g] = t;
}
// Zweite Lichtkarte mit dem Lampenlicht. Die Tageszeit mischt: Tageslicht mal Farbe plus Lampenlicht mal Staerke.
const nachtKarten = {}, lichtU = { uTagLicht: { value: new THREE.Color(1, 1, 1) }, uLampenLicht: { value: 0.8 } };
for (const g of ['LM0', 'LM1', 'LM2']) { const t = texLader.load(`./assets/welt/licht_${g}_nacht.webp`); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.anisotropy = 4; nachtKarten[g] = t; }
function tagNacht(m, gruppe) {
  const vor = m.onBeforeCompile, kenn = (m.customProgramCacheKey ? m.customProgramCacheKey() : '') + '|tagnacht';
  m.onBeforeCompile = (sh, r) => { if (vor) vor(sh, r); sh.uniforms.uTagLicht = lichtU.uTagLicht; sh.uniforms.uLampenLicht = lichtU.uLampenLicht; sh.uniforms.tNacht = { value: nachtKarten[gruppe] };
    sh.fragmentShader = 'uniform vec3 uTagLicht; uniform float uLampenLicht; uniform sampler2D tNacht;\n' + sh.fragmentShader.replace('reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;', 'reflectedLight.indirectDiffuse += (lightMapTexel.rgb * uTagLicht + texture2D(tNacht, vLightMapUv).rgb * uLampenLicht) * lightMapIntensity * RECIPROCAL_PI;'); };
  m.customProgramCacheKey = () => kenn;
}
// Randlicht fuer Figuren und Tiere: an den Konturen faengt sich das Licht der Umgebung, die Figuren loesen sich vom Hintergrund
const randU = { uRand: { value: new THREE.Color(0.9, 0.7, 0.55) } };
function randLicht(m) { m.onBeforeCompile = (sh) => { sh.uniforms.uRand = randU.uRand; sh.fragmentShader = 'uniform vec3 uRand;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += uRand * diffuseColor.rgb * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.6) * 1.5;\n#include <opaque_fragment>'); }; m.customProgramCacheKey = () => 'atlas-rand'; }
const matCache = {};
function material(name, gruppe) {
  const k = name + '|' + gruppe; if (matCache[k]) return matCache[k];
  const d = MAT[name] || { c: '#ff00ff' }; let m;
  if (gruppe === 'LAMPE') {       // orientalische Lampen: Messing, durch das Muster scheint das Licht
    if (name === 'laterne') { const t = texLader.load('./assets/tex/lampe.webp'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.7, metalness: 0.75, roughness: 0.38, envMap: umgebung, envMapIntensity: 1.0 }); }
    else m = new THREE.MeshStandardMaterial({ color: '#c79a45', metalness: 1, roughness: 0.28, envMap: umgebung, envMapIntensity: 1.1 });
  }
  else if (d.e) { m = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.c).multiplyScalar(d.e) }); m.toneMapped = true; }
  else if (gruppe === 'DACH') m = new THREE.MeshBasicMaterial({ color: '#0d0b0a' });
  else if (gruppe === 'LAUB') { const datei = { laubkarte: 'zweig_0.png', monstera: 'monstera.png', palme: 'palme.png' }[name] || 'zweig_0.png'; const z = texLader.load('./assets/tex/' + datei); z.colorSpace = THREE.SRGBColorSpace; z.anisotropy = 8; m = new THREE.MeshBasicMaterial({ map: z, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, color: name === 'laubkarte' ? new THREE.Color(2.0, 2.1, 1.7) : new THREE.Color(1.75, 1.8, 1.55) }); }
  else if (d.flach) m = new THREE.MeshBasicMaterial({ color: d.c });
  else if (d.metall) { m = new THREE.MeshStandardMaterial({ color: d.c, metalness: 1, roughness: 0.32, envMap: umgebung, envMapIntensity: 0.9 }); }
  else {
    m = new THREE.MeshBasicMaterial({ color: d.c, lightMap: lichtKarten[gruppe], lightMapIntensity: lichtInfo.skala * Math.PI });
    if (d.t) m.map = tex(...d.t);
    if (gruppe === 'LM1') m.side = THREE.DoubleSide;        // Bogenflaechen sind duenne Einzelflaechen
    if (d.sp || d.t) spiegelnd(m, d.sp || [0, 1, 0.04]);
    tagNacht(m, gruppe);
  }
  return (matCache[k] = m);
}

// ---------------------------------------------------------------- Welt laden
const gltfLader = new GLTFLoader();
const welt = (await gltfLader.loadAsync('./assets/welt/welt.glb')).scene;
const klickbar = [], kameraSperre = [], farbNetze = []; let dachGruppe = null;
welt.traverse((o) => {
  if (!o.isMesh) return;
  let g = o; while (g && !['LM0', 'LM1', 'LM2', 'EMI', 'DACH', 'LAUB', 'LAMPE'].includes(g.name)) g = g.parent;
  const gruppe = g ? g.name : 'LM2';
  o.material = material(o.material.name, gruppe);
  if (gruppe === 'LAUB' && o.geometry.attributes.color_1) o.geometry.setAttribute('color', o.geometry.attributes.color_1);      // die gebackene Laubfarbe liegt im zweiten Farbsatz
  o.castShadow = gruppe.startsWith('LM') || gruppe === 'DACH'; o.receiveShadow = false;
  if (gruppe === 'LM0') klickbar.push(o); if (gruppe.startsWith('LM')) farbNetze.push(o); if (gruppe === 'LM0' || gruppe === 'LM1') kameraSperre.push(o);
  if (gruppe === 'DACH') dachGruppe = g; if (gruppe === 'LAUB') g.userData.nichtSpiegeln = true;
});
scene.add(welt);
const himmel = baueHimmel(scene); const fels = baueFels(scene);
const wuerfel = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const wuerfelCam = new THREE.CubeCamera(0.2, 120, wuerfel); wuerfelCam.position.copy(spiegelU.uProbe.value);
function spiegelAufnehmen() {            // einmal, wenn alle Texturen da sind: die Welt steht still
  const tm = renderer.toneMapping, alt = []; scene.traverse(o => { if (o.userData.nichtSpiegeln && o.visible) alt.push(o); }); for (const o of alt) o.visible = false; spiegelU.uAn.value = 0;
  renderer.toneMapping = THREE.NoToneMapping; wuerfelCam.update(renderer, scene); renderer.toneMapping = tm; for (const o of alt) o.visible = true; spiegelU.uEnv.value = wuerfel.texture; spiegelU.uAn.value = 1;
}

// Licht nur fuer Figuren und Messing (die Welt selbst ist gebacken)
const sonne = new THREE.DirectionalLight('#ffd2a0', 5.5);
sonne.position.copy(B(20, 20, 0)).addScaledVector(B(ZUR_SONNE_B.x, ZUR_SONNE_B.y, ZUR_SONNE_B.z), 60); sonne.target.position.copy(B(20, 20, 0));
sonne.castShadow = true; sonne.shadow.mapSize.set(MOBIL ? 2048 : 4096, MOBIL ? 2048 : 4096);
Object.assign(sonne.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 120 }); sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03;
scene.add(sonne, sonne.target); sonne.shadow.autoUpdate = false; sonne.shadow.needsUpdate = true;      // Welt steht still: Schatten nur einmal rechnen
const hemi = new THREE.HemisphereLight('#ffc9a0', '#5a3a2c', 1.25); scene.add(hemi); const laternenSchein = [];

// ---------------------------------------------------------------- Hologramm, Laternen Schein, Staub
function radialTextur(fn, n = 256) {
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); fn(x, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const scheinTex = radialTextur((x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,200,130,1)'); g.addColorStop(.25, 'rgba(255,160,80,.45)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
for (const [x, y, z, gr] of nav.laternen) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: scheinTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  s.position.copy(B(x, y, z)); s.scale.setScalar(2.4 * gr); scene.add(s); laternenSchein.push(s);
}
const holo = new Holo(scene, B(nav.holo[0], nav.holo[1], 0.9), ['brain', 'coder', 'maler', 'film', 'funk', 'scout', 'feld', 'archiv']);
const voegel = new Voegel(scene); const falter = new Falter(scene, nav);

// ---------------------------------------------------------------- Lichtstrahlen (echtes Volumen, pro Bildpunkt durch den Raum marschiert)
const platten = nav.flaechen.filter(f => !f.rampe && f.z > 0.1).map(f => [f.x0, f.y0, f.x1, f.y1, f.z]);
platten.push([0, 26, 12, 40, 15], [26, 0, 40, 12, 15]);
const PL = 12; while (platten.length < PL) platten.push([0, 0, 0, 0, 999]);
const LICHT_GLSL = /* glsl */`
  uniform vec3 uZurSonne; uniform vec4 uLoch; uniform float uDach; uniform float uStrebe; uniform vec4 uPlatteR[${PL}]; uniform float uPlatteZ[${PL}];
  float sonnenlicht(vec3 b) {                       // b in Blender Koordinaten, 1 = Sonne trifft den Punkt
    float t = (uDach - b.z) / uZurSonne.z; vec2 q = b.xy + uZurSonne.xy * t;
    vec2 r = smoothstep(uLoch.xy - 0.05, uLoch.xy + 0.25, q) * (1.0 - smoothstep(uLoch.zw - 0.25, uLoch.zw + 0.05, q));
    float l = r.x * r.y; if (l <= 0.0) return 0.0;
    vec2 zelle = (uLoch.zw - uLoch.xy) / 4.0; vec2 f = abs(fract((q - uLoch.xy) / zelle + 0.5) - 0.5) * zelle;   // Abstand zu den breiten Streben
    l *= smoothstep(uStrebe - 0.1, uStrebe + 0.3, f.x) * smoothstep(uStrebe - 0.1, uStrebe + 0.3, f.y);
    for (int i = 0; i < ${PL}; i++) {
      float h = uPlatteZ[i]; if (b.z < h - 0.45) { vec2 s = b.xy + uZurSonne.xy * ((h - 0.25 - b.z) / uZurSonne.z); vec4 R = uPlatteR[i];
        if (s.x > R.x && s.x < R.z && s.y > R.y && s.y < R.w) return 0.0; }
    }
    return l;
  }`;
const lichtUniforms = () => ({
  uZurSonne: { value: ZUR_SONNE_B.clone() }, uLoch: { value: new THREE.Vector4(nav.loch[0], nav.loch[1], nav.loch[2], nav.loch[3]) }, uDach: { value: nav.dach - 0.1 }, uStrebe: { value: nav.strebe },
  uPlatteR: { value: platten.map(p => new THREE.Vector4(p[0], p[1], p[2], p[3])) }, uPlatteZ: { value: platten.map(p => p[4]) },
});
class StrahlenPass extends Pass {
  constructor() {
    super();
    const vs = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    this.halb = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });      // halbe Aufloesung reicht fuer weichen Dunst
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tTiefe: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uZeit: { value: 0 }, uStaerke: { value: 1 }, uStrahlFarbe: { value: new THREE.Color(1.0, 0.5, 0.24) }, uSchritte: { value: MOBIL ? 14 : 26 }, ...lichtUniforms() },
      vertexShader: vs, fragmentShader: /* glsl */`
        precision highp float; varying vec2 vUv; uniform sampler2D tTiefe; uniform mat4 uInvVP; uniform float uZeit, uStaerke, uSchritte; uniform vec3 uStrahlFarbe;
        ${LICHT_GLSL}
        vec3 welt(vec2 uv, float d){ vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
        float rausch(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          #define H(v) fract(sin(dot(v, vec3(12.9898,78.233,37.719))) * 43758.5453)
          return mix(mix(mix(H(i),H(i+vec3(1,0,0)),f.x),mix(H(i+vec3(0,1,0)),H(i+vec3(1,1,0)),f.x),f.y),mix(mix(H(i+vec3(0,0,1)),H(i+vec3(1,0,1)),f.x),mix(H(i+vec3(0,1,1)),H(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main(){
          float d = (1.0 - texture2D(tTiefe, vUv).x);
          vec3 a = welt(vUv, 0.0), e = welt(vUv, d); vec3 r = e - a; float L = length(r); r /= L;
          // auf den Baukoerper begrenzen (Three: x 0..40, y 0..20, z -40..0)
          vec3 inv = 1.0 / r; vec3 t0 = (vec3(0.0, 0.0, -40.0) - a) * inv, t1 = (vec3(40.0, 20.0, 0.0) - a) * inv;
          vec3 tmin = min(t0, t1), tmax = max(t0, t1); float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), tf = min(min(tmax.x, tmax.y), min(tmax.z, L));
          float summe = 0.0;
          if (tf > tn) {
            float n = uSchritte, dt = (tf - tn) / n; float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uZeit * 0.0);
            for (float i = 0.0; i < 64.0; i++) { if (i >= n) break; vec3 p = a + r * (tn + (i + j) * dt); vec3 b = vec3(p.x, -p.z, p.y);
              float l = sonnenlicht(b); if (l > 0.0) { float st = 0.62 + 0.55 * rausch(b * vec3(0.55, 0.55, 0.22) + vec3(uZeit * 0.05, uZeit * 0.03, -uZeit * 0.11)); summe += l * st * dt; } }
          }
          vec3 strahl = uStrahlFarbe * (1.0 - exp(-summe * 0.036 * uStaerke)) * 1.2;
          gl_FragColor = vec4(strahl, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.misch = new THREE.ShaderMaterial({ uniforms: { tFarbe: { value: null }, tStrahl: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tFarbe; uniform sampler2D tStrahl; void main(){ gl_FragColor = vec4(texture2D(tFarbe, vUv).rgb + texture2D(tStrahl, vUv).rgb, 1.0); }` });
    this.quad = new FullScreenQuad(this.mat); this.quad2 = new FullScreenQuad(this.misch); this.needsSwap = true;
  }
  setSize(w, h) { this.halb.setSize(Math.ceil(w / 2), Math.ceil(h / 2)); }
  render(r, schreib, lese) {
    this.mat.uniforms.tTiefe.value = szenenTiefe || lese.depthTexture; r.setRenderTarget(this.halb); this.quad.render(r);
    this.misch.uniforms.tFarbe.value = lese.texture; this.misch.uniforms.tStrahl.value = this.halb.texture; r.setRenderTarget(this.renderToScreen ? null : schreib); this.quad2.render(r);
  }
}
// Kontaktschatten und Dunst aus der Tiefe: wo Flaechen sich nah gegenueberstehen (Ecken, Moebelfuesse, Figuren am Boden), wird es dunkler.
// Dazu liegt ein Hauch Dunst in der Luft, der die Tiefe staffelt.
class TiefenPass extends Pass {
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tFarbe: { value: null }, tTiefe: { value: null }, uInvP: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Vector2(1, 1) }, uAufl: { value: new THREE.Vector2(1, 1) }, uTaps: { value: MOBIL ? 5 : 10 }, uAO: { value: 0.62 }, uDunst: { value: 0.0065 }, uDunstFarbe: { value: new THREE.Color(0.23, 0.12, 0.1) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tFarbe, tTiefe; uniform mat4 uInvP; uniform vec2 uProj, uAufl; uniform float uTaps, uAO, uDunst; uniform vec3 uDunstFarbe;
        vec3 sicht(vec2 uv){ float d = (1.0 - texture2D(tTiefe, uv).x); vec4 p = uInvP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
        void main(){ vec3 c = texture2D(tFarbe, vUv).rgb; float d = (1.0 - texture2D(tTiefe, vUv).x);
          if (d < 0.99999) { vec3 P = sicht(vUv); vec2 e = 1.0 / uAufl;
            vec3 a1 = sicht(vUv + vec2(e.x, 0.0)) - P, a2 = P - sicht(vUv - vec2(e.x, 0.0)), b1 = sicht(vUv + vec2(0.0, e.y)) - P, b2 = P - sicht(vUv - vec2(0.0, e.y));
            vec3 N = normalize(cross(abs(a1.z) < abs(a2.z) ? a1 : a2, abs(b1.z) < abs(b2.z) ? b1 : b2));
            float tief = -P.z, R = 0.5 + tief * 0.012; vec2 r = R * uProj * 0.5 / tief; float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832, ao = 0.0;
            if (tief < 75.0) { for (float i = 0.0; i < 12.0; i++) { if (i >= uTaps) break; float w = j + i * 2.399963; vec3 v = sicht(vUv + vec2(cos(w), sin(w)) * sqrt((i + 0.5) / uTaps) * r) - P; float l = length(v);
                ao += max(dot(N, v) / (l + 1e-4) - 0.16, 0.0) * smoothstep(R * 1.5, R * 0.4, l); }
              ao = min(1.0, ao / uTaps * 2.7) * uAO * smoothstep(75.0, 35.0, tief); c *= mix(vec3(1.0), vec3(0.3, 0.26, 0.34), ao); }
            c = mix(c, uDunstFarbe, (1.0 - exp(-max(tief - 2.5, 0.0) * uDunst)) * 0.62);
          }
          gl_FragColor = vec4(c, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat); this.needsSwap = true;
  }
  render(r, schreib, lese) { const u = this.mat.uniforms; u.tFarbe.value = lese.texture; u.tTiefe.value = szenenTiefe || lese.depthTexture; u.uAufl.value.set(lese.width, lese.height); r.setRenderTarget(this.renderToScreen ? null : schreib); this.quad.render(r); }
}
// Tiefenschaerfe fuer die Uebersicht: das Haus liegt scharf, Vordergrund und Ferne werden weich wie bei einem Foto eines Modells
class SchaerfePass extends Pass {
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tFarbe: { value: null }, tTiefe: { value: null }, uAufl: { value: new THREE.Vector2(1, 1) }, uFokus: { value: 60 }, uStaerke: { value: 0 }, uNah: { value: 2 }, uFern: { value: 900 }, uTaps: { value: MOBIL ? 9 : 18 }, uFrei: { value: 0.3 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tFarbe, tTiefe; uniform vec2 uAufl; uniform float uFokus, uStaerke, uNah, uFern, uTaps, uFrei;
        float kreis(vec2 uv){ float z = (1.0 - texture2D(tTiefe, uv).x) * 2.0 - 1.0; float t = 2.0 * uNah * uFern / (uFern + uNah - z * (uFern - uNah)); return max(abs(clamp((t - uFokus) / uFokus, -1.0, 1.3)) - uFrei, 0.0) * uStaerke; }
        void main(){ vec3 c = texture2D(tFarbe, vUv).rgb; float r = kreis(vUv);
          if (r > 0.6) { vec3 s = c; float g = 1.0; float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832;
            for (float i = 0.0; i < 20.0; i++) { if (i >= uTaps) break; float w = j + i * 2.399963, l = sqrt((i + 0.5) / uTaps) * r; vec2 u = vUv + vec2(cos(w), sin(w)) * l / uAufl; float rs = kreis(u), k = smoothstep(0.0, 1.0, rs - l * 0.55 + 1.0); s += texture2D(tFarbe, u).rgb * k; g += k; }
            c = s / g; }
          gl_FragColor = vec4(c, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat); this.needsSwap = true;
  }
  render(r, schreib, lese) { const u = this.mat.uniforms; u.tFarbe.value = lese.texture; u.tTiefe.value = szenenTiefe || lese.depthTexture; u.uAufl.value.set(lese.width, lese.height); r.setRenderTarget(this.renderToScreen ? null : schreib); this.quad.render(r); }
}
class LookPass extends Pass {
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tFarbe: { value: null }, uZeit: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`precision highp float; varying vec2 vUv; uniform sampler2D tFarbe; uniform float uZeit;
        void main(){ vec2 q = vUv - 0.5; float rr = dot(q, q); vec2 o = q * rr * 0.0045;
          vec3 c = vec3(texture2D(tFarbe, vUv + o).r, texture2D(tFarbe, vUv).g, texture2D(tFarbe, vUv - o).b);      // Farbsaum zum Rand wie bei einem echten Objektiv
          float v = smoothstep(0.95, 0.25, length(q * vec2(1.0, 1.15))); c *= mix(0.68, 1.0, v);                 // Vignette
          c = pow(max(c, 0.0) / 0.18, vec3(1.07)) * 0.18;                                                     // etwas mehr Kontrast um das mittlere Grau
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c += vec3(-0.004, 0.002, 0.009) * (1.0 - smoothstep(0.0, 0.2, l));                                 // Schatten kuehl
          c *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), smoothstep(0.15, 1.3, l) * 0.8);                           // Lichter warm
          c = mix(vec3(l), c, 1.16);
          float k = fract(sin(dot(gl_FragCoord.xy + uZeit * 60.0, vec2(12.9898, 78.233))) * 43758.5453); c += (k - 0.5) * 0.018;
          gl_FragColor = vec4(c, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat); this.needsSwap = true;
  }
  render(r, schreib, lese) { this.mat.uniforms.tFarbe.value = lese.texture; r.setRenderTarget(this.renderToScreen ? null : schreib); this.quad.render(r); }
}
// Staub, der nur im Sonnenlicht aufleuchtet
const STAUB = MOBIL ? 500 : 1600; const staubPos = new Float32Array(STAUB * 3), staubZ = new Float32Array(STAUB);
for (let i = 0; i < STAUB; i++) { const p = B(10 + Math.random() * 28, 8 + Math.random() * 30, 0.5 + Math.random() * 18); staubPos.set([p.x, p.y, p.z], i * 3); staubZ[i] = Math.random(); }
const staubGeo = new THREE.BufferGeometry(); staubGeo.setAttribute('position', new THREE.BufferAttribute(staubPos, 3)); staubGeo.setAttribute('zufall', new THREE.BufferAttribute(staubZ, 1));
const staubMat = new THREE.ShaderMaterial({
  uniforms: { uZeit: { value: 0 }, uGroesse: { value: 1 }, ...lichtUniforms() }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`attribute float zufall; uniform float uZeit, uGroesse; varying float vL; ${LICHT_GLSL}
    void main(){ vec3 p = position; float t = uZeit * (0.05 + zufall * 0.06) + zufall * 40.0; p += vec3(sin(t * 1.3 + zufall * 9.0), sin(t) * 0.8 - mod(uZeit * 0.03 * (0.5 + zufall), 2.0), cos(t * 1.1)) * 0.6;
      vL = sonnenlicht(vec3(p.x, -p.z, p.y)) * (0.4 + 0.6 * sin(t * 6.0) * sin(t * 6.0)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = uGroesse * (1.2 + zufall * 1.6) * (projectionMatrix[3][3] > 0.5 ? 1.0 : 14.0 / max(-mv.z, 0.5)); }`,
  fragmentShader: `varying float vL; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vL < 0.02) discard; gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * vL * 1.6 * smoothstep(0.5, 0.0, d), 1.0); }`,
});
const staub = new THREE.Points(staubGeo, staubMat); staub.frustumCulled = false; staub.userData.nichtSpiegeln = true; scene.add(staub);

const kopfGlatt = new THREE.Vector3(0, -999, 0);
// ---------------------------------------------------------------- Kameras
const isoCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 2, 900);        // echte Perspektive: so sieht man Wolkenmeer und Horizont
const persCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.14, 170); scene.add(persCam);
const iso = { ziel: B(18, 18, 1.0), hoehe: 64, min: 6, max: 140, az: Math.PI * 1.25, el: 0.3, dist: 60 };      // az und el: Blickwinkel der Uebersicht, frei drehbar
let modus = 'iso', cam = isoCam;
const blick = { gier: Math.PI * 0.25, neig: -0.18, abstand: 4.2 };

// Nachbearbeitung
const ziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
ziel.depthTexture = new THREE.DepthTexture(1, 1); ziel.depthTexture.type = THREE.UnsignedIntType;
const composer = new EffectComposer(renderer, ziel);
const renderPass = new RenderPass(scene, cam); composer.addPass(renderPass);
// Die Tiefe der Szene wird nach dem Zeichnen in eine eigene Textur kopiert (als 1 minus Tiefe, das ist in Halbfloat in der Ferne genau).
// Alle Effekte lesen nur diese Kopie: so liest nie ein Effekt aus dem Puffer, in den er gerade schreibt.
let szenenTiefe = null, fokusT = 0, fokusZiel = 5, fokusGlatt = 5; const tiefeRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const tiefeKopie = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, depthTest: false, depthWrite: false, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`, fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D t; void main(){ gl_FragColor = vec4(1.0 - texture2D(t, vUv).x); }` }));
{ const rr = renderPass.render.bind(renderPass); renderPass.render = (r, schreib, lese, dt, maske) => { rr(r, schreib, lese, dt, maske); if (tiefeRT.width !== lese.width || tiefeRT.height !== lese.height) tiefeRT.setSize(lese.width, lese.height);
    tiefeKopie.material.uniforms.t.value = lese.depthTexture; r.setRenderTarget(tiefeRT); tiefeKopie.render(r); szenenTiefe = tiefeRT.texture; }; }
const tiefe = new TiefenPass(); composer.addPass(tiefe);
const wolken = new WolkenPass(MOBIL); wolken.tiefe = () => szenenTiefe; composer.addPass(wolken);
const regen = new NiederschlagPass(() => szenenTiefe); composer.addPass(regen);
const strahlen = new StrahlenPass(); composer.addPass(strahlen);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.75, 1.0); { const gs = bloom.setSize.bind(bloom); bloom.setSize = () => gs(Math.ceil(innerWidth * effekt.pr * 0.85), Math.ceil(innerHeight * effekt.pr * 0.85)); }
wolken.setSize = () => wolken.halb.setSize(Math.ceil(innerWidth * effekt.pr), Math.ceil(innerHeight * effekt.pr)); strahlen.setSize = () => strahlen.halb.setSize(Math.ceil(innerWidth * effekt.pr * 0.85), Math.ceil(innerHeight * effekt.pr * 0.85)); composer.addPass(bloom);      // Bloom in viertel Aufloesung
const unschaerfe = new SchaerfePass(); unschaerfe.enabled = false; composer.addPass(unschaerfe);
const look = new LookPass(); composer.addPass(look);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa);
// Nachschaerfen: holt feine Kanten und Texturen zurueck, die die Kantenglaettung weich macht
const scharf = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uPx: { value: new THREE.Vector2(1, 1) }, uStaerke: { value: 0.42 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uPx; uniform float uStaerke; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec3 n = texture2D(tDiffuse, vUv + vec2(uPx.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(uPx.x, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, uPx.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, uPx.y)).rgb; vec3 d = c - n * 0.25; gl_FragColor = vec4(clamp(c + clamp(d, -0.12, 0.12) * uStaerke * 2.4, 0.0, 1.0), 1.0); }` }); composer.addPass(scharf);          // Kantenglaettung, guenstig

// Aufloesung regelt sich selbst auf 60 Bilder pro Sekunde
const regel = { pr: renderer.getPixelRatio(), n: 0, ms: 0, ruhe: 0, sperre: 0, effekt };
function regeln(dtRoh) {
  regel.n++; regel.ms += dtRoh * 1000; if (regel.n < 40) return; const ms = regel.ms / regel.n; regel.n = 0; regel.ms = 0; let neu = regel.pr, anders = false; regel.sperre = Math.max(0, regel.sperre - 1);
  if (ms > 19) { const f = ms > 26 ? 0.8 : 0.9; if (effekt.pr > effekt.min + 0.005) { effekt.pr = Math.max(effekt.min, effekt.pr * f); anders = true; } else neu = Math.max(PR_MIN, regel.pr * f); regel.sperre = 20; regel.ruhe = 0; }
  else if (ms < 17.4) { regel.ruhe++; if (regel.ruhe >= 4 && regel.sperre === 0) { if (regel.pr < PR_MAX - 0.005) neu = Math.min(PR_MAX, regel.pr * 1.08); else if (effekt.pr < effekt.max - 0.005) { effekt.pr = Math.min(effekt.max, effekt.pr * 1.08); anders = true; } regel.ruhe = 0; } }
  else regel.ruhe = 0;
  if (anders || Math.abs(neu - regel.pr) > 0.01) { regel.pr = neu; renderer.setPixelRatio(neu); composer.setPixelRatio(neu); groesse(); }
}
function groesse() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); composer.setSize(w, h);
  persCam.aspect = w / h; persCam.updateProjectionMatrix(); isoKamera(); { const pr = renderer.getPixelRatio(); fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); scharf.material.uniforms.uPx.value.set(1 / (w * pr), 1 / (h * pr)); }
  staubMat.uniforms.uGroesse.value = renderer.getPixelRatio() * (modus === 'iso' ? Math.max(1.2, 60 / iso.hoehe) * iso.dist / 14 : 1.6);
}
function isoKamera() {
  const a = innerWidth / innerHeight; let h = iso.hoehe; if (a < 0.74) h = iso.hoehe * 0.74 / a;       // im Hochformat die Breite halten
  isoCam.aspect = a; isoCam.updateProjectionMatrix(); iso.dist = h / (2 * Math.tan(isoCam.fov * Math.PI / 360));
  const ce = Math.cos(iso.el); isoCam.position.copy(iso.ziel).addScaledVector(B(ce * Math.cos(iso.az), ce * Math.sin(iso.az), Math.sin(iso.el)), iso.dist); isoCam.lookAt(iso.ziel);
}
addEventListener('resize', groesse);

// ---------------------------------------------------------------- Figuren
// Name, Rolle (Anzeige), Vorstellung. Die Agenten sprechen Englisch, jede Figur mit eigener Stimme.
const AGENTEN = {
  brain: ['01 Brain', 'Orchestrierung', "I'm Brain, the head of the team. Every task you give lands on my table first. I break it down, hand the pieces to the right agent, and put it all back together at the end."],
  coder: ['02 CodeMaster', 'Code, Web, Automation', "I'm CodeMaster. I write and change the code: websites, scripts, automations, and games like this world. Whenever files get read or commands get run, that's me."],
  maler: ['07 VisionForge', 'Bildgenerierung', "I'm VisionForge. I turn your ideas into images with Midjourney, Higgsfield and Figma. Posters, product shots, style frames, anything you can look at."],
  film: ['08 MotionStudio', 'Video und Film', "I'm MotionStudio. I plan, cut and animate your videos, from a music video in DaVinci Resolve to an explainer film."],
  funk: ['13 WatchTower', 'Monitoring', "I'm WatchTower. I keep an eye on servers, data pipelines and scheduled jobs, and I speak up the moment something breaks."],
  scout: ['10 DeepScout', 'Research', "I'm DeepScout. I dig through the web, open pages in the browser, and bring back sources and facts you can trust."],
  feld: ['15 TrendPulse', 'Trends', "I'm TrendPulse. I watch for trends and market moves before they get big."],
  archiv: ['11 VaultKeeper', 'Wissen und Skills', "I'm VaultKeeper. I guard your knowledge, the skills and the memory of the team. When an agent needs a skill, they pick it up from me."],
};
// maennlich: Brain, CodeMaster, DeepScout. weiblich: VisionForge, MotionStudio, WatchTower, TrendPulse, VaultKeeper
const STIMMEN = { brain: 'en-US-AndrewMultilingualNeural', coder: 'en-US-BrianMultilingualNeural', scout: 'en-GB-RyanNeural', maler: 'en-US-AvaMultilingualNeural', film: 'en-US-EmmaMultilingualNeural', funk: 'en-GB-SoniaNeural', feld: 'en-US-JennyNeural', archiv: 'en-GB-LibbyNeural' };
const JARVIS = 'http://127.0.0.1:5050', OLLAMA = 'http://127.0.0.1:11434';
const LOKAL = ['localhost', '127.0.0.1'].includes(location.hostname) || location.hostname.endsWith('.ts.net');       // Stimme, Sprachmodell und Live Daten gibt es nur auf Naders Rechner. Online fragt die Seite nichts Lokales an.
const schattenTex = radialTextur((x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }, 128);
const ton = new Ton();
const farbe = new Farbe(scene, persCam, ton, farbNetze); const laub = new Laub(scene, nav, NAV); let feuer = false, fangFehl = false, fangVersuch = false;
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) fangFehl = false; });
addEventListener('pointerdown', () => ton.start(), true); addEventListener('keydown', () => ton.start(), true);
function bodenArt(f) { const id = NAV.flaecheBei(f.pos) || ''; return (id === 't_links' || id === 't_rechts') ? 'metall' : (id === 'platz' || id === 'hof') ? 'fliese' : 'holz'; }
function aufTritt(f) { const d = f.ich ? 0 : Math.hypot(f.pos.x - ich.pos.x, f.pos.y - ich.pos.y, (f.pos.z - ich.pos.z) * 2); const laut = f.ich ? 1 : Math.max(0, 1 - d / 9) * 0.45; if (laut > 0.03) ton.schritt(bodenArt(f), Math.min(1, f.tempo / 3), laut); }
{ const tonKnopf = $('ton'); const tonZeigen = () => { tonKnopf.textContent = ton.an ? 'Ton an' : 'Ton aus'; tonKnopf.classList.toggle('an', ton.an); }; tonKnopf.onclick = () => { ton.start(); ton.schalte(); tonZeigen(); }; tonZeigen(); }
const figuren = []; const modelle = {};
async function ladeFigur(f) {
  try { const g = await gltfLader.loadAsync('./assets/figuren/' + f.datei); modelle[f.id] = { szene: g.scene, clips: g.animations, hoehe: f.hoehe }; } catch (e) { console.warn('Figur fehlt', f.id); }
}
class Figur {
  constructor(id, start, ich = false) {
    this.id = id; this.ich = ich; this.pos = new THREE.Vector3(...start); this.gier = Math.PI * 0.25; this.tempo = 0; this.pfad = null; this.clip = 'idle'; this.warte = 1 + Math.random() * 4;
    this.vel = new THREE.Vector2(); this.vPfad = 0; this.sprungH = 0; this.vy = 0; this.manuell = false;
    this.wurzel = new THREE.Group(); scene.add(this.wurzel); const m = modelle[id];
    if (m) {
      this.modell = SkeletonUtils.clone(m.szene); this.hoehe = m.hoehe; this.wurzel.add(this.modell);
      this.modell.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.roughness = 0.62; o.material.metalness = 0; o.material.envMap = umgebung; o.material.envMapIntensity = 0.32; randLicht(o.material); } });
      this.koerper = new Koerper(this.modell, this.hoehe);
    } else {
      this.hoehe = 1.6; this.modell = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.9, 6, 14), new THREE.MeshStandardMaterial({ color: ich ? '#e8703a' : '#d8c8b0', roughness: 0.9 }));
      this.modell.position.y = 0.72; this.modell.receiveShadow = true; this.wurzel.add(this.modell);
    }
    this.schatten = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.schatten.rotation.x = -Math.PI / 2; this.schatten.renderOrder = 2; this.schatten.userData.nichtSpiegeln = true; scene.add(this.schatten); this.wurzel.userData.nichtSpiegeln = true;
    this.schild = document.createElement('div'); this.schild.className = 'schild' + (ich ? ' ich' : ''); this.schild.textContent = ich ? 'Nader' : (AGENTEN[id]?.[0] || id); document.body.appendChild(this.schild);
    this.spiele('idle'); figuren.push(this);
  }
  spiele(name) { this.clip = name; }
  geheZu(zielB) { const p = NAV.weg(this.pos, zielB); if (p && p.length) { this.pfad = p; return true; } return false; }
  schritt(dt) {
    if (this.pfad && this.pfad.length) {
      const z = this.pfad[0]; const dx = z.x - this.pos.x, dy = z.y - this.pos.y; const d = Math.hypot(dx, dy); const vmax = this.ich ? 2.9 : 1.25;
      const ziel = this.pfad.length === 1 ? Math.min(vmax, 0.5 + d * 2.4) : vmax;                     // am Ziel weich abbremsen
      this.vPfad += (ziel - this.vPfad) * (1 - Math.exp(-dt * 5));
      if (d < 0.14) { this.pfad.shift(); if (!this.pfad.length) { this.pfad = null; } }
      else { const s = Math.min(d, this.vPfad * dt); this.pos.x += dx / d * s; this.pos.y += dy / d * s; this.pos.z = NAV.hoehe(this.pos.x, this.pos.y, this.pos.z) ?? z.z; this.zielGier = Math.atan2(dx, -dy); }
      this.tempo = this.vPfad;
    } else if (!this.manuell) { this.vPfad = 0; this.tempo = 0; }
    if (this.zielGier !== undefined) { let d = this.zielGier - this.gier; d = Math.atan2(Math.sin(d), Math.cos(d)); this.gier += d * (1 - Math.exp(-dt * (this.ich ? 11 : 7))); }
    const p = B(this.pos.x, this.pos.y, this.pos.z); this.schatten.position.set(p.x, p.y + 0.04, p.z); const gs = 1 / (1 + this.sprungH * 0.9); this.schatten.scale.setScalar(gs); this.schatten.material.opacity = 0.9 * gs;
    p.y += this.sprungH; this.wurzel.position.copy(p); this.wurzel.rotation.y = this.gier;
    if (this.koerper) { const tritt = this.koerper.update(dt, this.tempo, this.clip === 'talk' ? 'talk' : this.clip === 'work' ? 'work' : 'idle', this.sprungH > 0.05 ? 1 : 0); if (tritt) aufTritt(this); }
  }
}
function npcDenken(f, dt) {
  if (gespraech.f === f) { f.pfad = null; f.zielGier = Math.atan2(ich.pos.x - f.pos.x, -(ich.pos.y - f.pos.y)); f.spiele(gespraech.spricht ? 'talk' : 'idle'); return; }
  if (f.live) {
    if (zeit > f.live.bis) { f.live = null; f.schild.textContent = AGENTEN[f.id][0]; f.schild.classList.remove('live', 'fehler'); f.warte = 3 + Math.random() * 5; }
    else {
      const h = f.heim; if (f.pfad) { f.spiele('walk'); return; }
      if (h && Math.hypot(f.pos.x - h.x, f.pos.y - h.y) > 0.7 && Math.abs(f.pos.z - h.z) < 30 && !f.live.versucht) { f.live.versucht = true; if (f.geheZu(new THREE.Vector3(h.x, h.y, h.z))) { if (f.station) f.station.belegt = null; f.station = h; h.belegt = f; f.spiele('walk'); return; } }
      f.spiele(f.live.clip); if (h) f.zielGier = Math.atan2(h.blick[0], -h.blick[1]); return;
    }
  }
  if (f.pfad) { f.spiele('walk'); return; }
  f.warte -= dt; if (f.station && f.clip === 'walk') { f.spiele(f.station.art === 'tisch' ? 'work' : (Math.random() < 0.6 ? 'talk' : 'idle')); f.zielGier = Math.atan2(f.station.blick[0], -f.station.blick[1]); }
  if (f.warte > 0) return;
  for (let k = 0; k < 6; k++) {
    const s = nav.stationen[Math.floor(Math.random() * nav.stationen.length)]; if ((s.belegt && s.belegt !== f) || (s.heim && s.heim !== f.id)) continue;
    if (f.geheZu(new THREE.Vector3(s.x, s.y, s.z))) { if (f.station) f.station.belegt = null; s.belegt = f; f.station = s; f.warte = 7 + Math.random() * 14; return; }
  }
  f.warte = 2;
}

// ---------------------------------------------------------------- Eingabe
const tasten = {}; let ziehen = null, eHalten = 0; const zeiger = new Map();
const strahl = new THREE.Raycaster(); const ndc = new THREE.Vector2();
addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') frage(); if (e.code === 'Escape') schliesseKarte(); return; }
  const fpFarbe = modus === 'fp' && !gespraech.f && !gespraech.buchOffen;
  if (e.code === 'KeyE' && fpFarbe) { if (!e.repeat) { farbe.schiesse(); clearTimeout(eHalten); eHalten = setTimeout(() => { if (tasten.KeyE && modus === 'fp') farbe.spruehStart(); }, 170); } }
  else if (e.code === 'KeyE' || (e.code === 'KeyF' && modus === 'fp')) { if (gespraech.buchOffen) schliesseBuecher(); else if (gespraech.f) schliesseKarte(); else if (gespraech.nah) zeigeKarte(gespraech.nah); else if (gespraech.regal) zeigeBuecher(); }
  if (e.code === 'Space') e.preventDefault();
  tasten[e.code] = true; if (e.code === 'KeyN') namenKnopf.click(); if (e.code === 'KeyV') setzeModus(modus === 'iso' ? 'tp' : modus === 'tp' ? 'fp' : 'iso'); if (e.code === 'Escape') { if (gespraech.buchOffen) schliesseBuecher(); else if (gespraech.f) schliesseKarte(); else if (modus !== 'iso') setzeModus('iso'); } });
addEventListener('keyup', e => { tasten[e.code] = false; if (e.code === 'KeyE') { clearTimeout(eHalten); farbe.spruehStop(); } });
addEventListener('blur', () => { tasten.KeyE = false; farbe.spruehStop(); });
addEventListener('blur', () => { for (const k in tasten) tasten[k] = false; });
const cv = renderer.domElement;
cv.addEventListener('contextmenu', e => e.preventDefault());
// Touch: virtueller Joystick (analog, ganz ausgelenkt = rennen), Knoepfe fuer Springen, Farbe und Entfernen
const stick = { x: 0, y: 0, id: null }; let feuerKnopf = false;
if (TOUCH) {
  document.body.classList.add('touch'); const el = $('stick'), kn = el.firstElementChild;
  const setz = (e) => { const r = el.getBoundingClientRect(), h = r.width / 2; let x = (e.clientX - r.left - h) / (h - 16), y = (e.clientY - r.top - h) / (h - 16); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stick.x = x; stick.y = y; kn.style.transform = `translate(${x * (h - 26)}px, ${y * (h - 26)}px)`; };
  const los = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; kn.style.transform = ''; el.classList.remove('an'); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); stick.id = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch (err) { } el.classList.add('an'); setz(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === stick.id) setz(e); }); el.addEventListener('pointerup', los); el.addEventListener('pointercancel', los);
  $('t_sprung').addEventListener('pointerdown', e => { e.preventDefault(); tasten.Space = true; setTimeout(() => { tasten.Space = false; }, 140); });
  const tf = $('t_farbe'); tf.addEventListener('pointerdown', e => { e.preventDefault(); try { tf.setPointerCapture(e.pointerId); } catch (err) { } feuerKnopf = true; farbe.schiesse(); }); for (const n of ['pointerup', 'pointercancel']) tf.addEventListener(n, () => { feuerKnopf = false; });
  $('t_weg').addEventListener('pointerdown', e => { e.preventDefault(); farbe.leeren(); });
  for (const b of document.querySelectorAll('#stick, #tasten button')) b.addEventListener('contextmenu', e => e.preventDefault());
}
cv.addEventListener('pointerdown', e => { zeiger.set(e.pointerId, [e.clientX, e.clientY]); ziehen = { x: e.clientX, y: e.clientY, weg: 0, knopf: e.button, t: performance.now() }; cv.setPointerCapture(e.pointerId); if (modus === 'fp' && !MOBIL) { const gefangen = document.pointerLockElement === cv;
    if (e.button === 2) farbe.leeren(); else if (e.button === 0 && (gefangen || fangFehl) && !gespraech.f) { feuer = true; farbe.schiesse(); }        // linke Taste: Farbe schiessen, rechte: alles entfernen
    if (!gefangen) { try { const pr = cv.requestPointerLock?.(); pr?.catch?.(() => {}); } catch (err) { } if (!fangVersuch) { fangVersuch = true; setTimeout(() => { fangVersuch = false; if (document.pointerLockElement !== cv) fangFehl = true; }, 600); } } } });
cv.addEventListener('pointermove', e => {
  if (document.pointerLockElement === cv) { blick.gier -= e.movementX * 0.0024; blick.neig = THREE.MathUtils.clamp(blick.neig - e.movementY * 0.0024, -1.2, 1.2); return; }
  if (!zeiger.has(e.pointerId) || !ziehen) return; const alt = zeiger.get(e.pointerId); const dx = e.clientX - alt[0], dy = e.clientY - alt[1];
  if (zeiger.size === 2) {                                    // zwei Finger: zoomen
    const [a, b2] = [...zeiger.values()]; const d0 = Math.hypot(a[0] - b2[0], a[1] - b2[1]); zeiger.set(e.pointerId, [e.clientX, e.clientY]);
    const [c, d2] = [...zeiger.values()]; const d1 = Math.hypot(c[0] - d2[0], c[1] - d2[1]); if (modus === 'iso') { iso.hoehe = THREE.MathUtils.clamp(iso.hoehe * d0 / d1, iso.min, iso.max); const k = iso.hoehe / innerHeight * 0.5; const re = new THREE.Vector3().setFromMatrixColumn(isoCam.matrixWorld, 0), ho = new THREE.Vector3().setFromMatrixColumn(isoCam.matrixWorld, 1); iso.ziel.addScaledVector(re, -dx * k).addScaledVector(ho, dy * k); isoKamera(); } ziehen.weg += 99; return;
  }
  zeiger.set(e.pointerId, [e.clientX, e.clientY]); ziehen.weg += Math.abs(dx) + Math.abs(dy);
  if (modus === 'iso') {
    if (ziehen.weg > 6) {
      if (ziehen.knopf === 2 || ziehen.knopf === 1 || e.shiftKey) { const k = iso.hoehe / innerHeight; const re = new THREE.Vector3().setFromMatrixColumn(isoCam.matrixWorld, 0), ho = new THREE.Vector3().setFromMatrixColumn(isoCam.matrixWorld, 1); iso.ziel.addScaledVector(re, -dx * k).addScaledVector(ho, dy * k); }
      else { iso.az -= dx * 0.006; iso.el = THREE.MathUtils.clamp(iso.el + dy * 0.005, 0.04, 1.5); }       // linke Taste: drehen wie ein Modell
      isoKamera();
    }
  } else { blick.gier -= dx * 0.005; blick.neig = THREE.MathUtils.clamp(blick.neig - dy * 0.005, -1.2, 1.2); }
});
cv.addEventListener('pointerup', e => {
  feuer = false; zeiger.delete(e.pointerId); if (!ziehen) return; const klick = ziehen.weg < 7 && performance.now() - ziehen.t < 600; ziehen = null; if (klick && modus === 'fp' && TOUCH && !gespraech.f) farbe.schiesse(); if (!klick || modus === 'fp') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); strahl.setFromCamera(ndc, cam);
  const fig = figuren.filter(f => !f.ich).map(f => ({ f, t: strahl.ray.distanceToPoint(f.wurzel.position.clone().add(new THREE.Vector3(0, f.hoehe * 0.55, 0))) })).filter(o => o.t < 0.6).sort((a, b) => a.t - b.t)[0];
  if (fig) { zeigeKarte(fig.f); return; }
  const tr = strahl.intersectObjects(klickbar, false).find(t => t.face && t.face.normal.y > 0.5);
  const bt = strahl.intersectObject(buecher.mesh, false)[0]; if (bt && (!tr || bt.distance < tr.distance)) { zeigeBuecher(); return; }
  if (!tr) return;
  const p = new THREE.Vector3(tr.point.x, -tr.point.z, tr.point.y); if (ich.geheZu(p)) markiere(tr.point);
});
cv.addEventListener('wheel', e => { e.preventDefault(); if (modus === 'iso') { iso.hoehe = THREE.MathUtils.clamp(iso.hoehe * Math.exp(e.deltaY * 0.0012), iso.min, iso.max); isoKamera(); groesse(); } else if (modus === 'tp') blick.abstand = THREE.MathUtils.clamp(blick.abstand * Math.exp(e.deltaY * 0.001), 1.8, 9); }, { passive: false });
// Namen: nur beim Zeigen mit der Maus, oder alle ueber den Knopf "Namen"
let namenAn = false, zeigeAuf = null; try { namenAn = localStorage.getItem('atlas_namen') === '1'; } catch (e) { }
function figurUnter(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); strahl.setFromCamera(ndc, cam);
  const t = figuren.map(f => ({ f, t: strahl.ray.distanceToPoint(f.wurzel.position.clone().add(new THREE.Vector3(0, f.hoehe * 0.55, 0))) })).filter(o => o.t < Math.max(0.55, o.f.hoehe * 0.45) && !(o.f.ich && modus === 'fp')).sort((a, b) => a.t - b.t)[0];
  return t ? t.f : null;
}
addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; zeigeAuf = document.pointerLockElement === cv ? figurUnter(innerWidth / 2, innerHeight / 2) : (e.target === cv ? figurUnter(e.clientX, e.clientY) : null); cv.style.cursor = zeigeAuf && !zeigeAuf.ich ? 'pointer' : ''; });
const namenKnopf = $('namen'); const namenZeigen = () => { namenKnopf.classList.toggle('an', namenAn); namenKnopf.textContent = namenAn ? 'Namen an' : 'Namen aus'; };
namenKnopf.onclick = () => { namenAn = !namenAn; try { localStorage.setItem('atlas_namen', namenAn ? '1' : '0'); } catch (e) { } namenZeigen(); }; namenZeigen();
const marke = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(2.5), transparent: true, depthWrite: false })); marke.rotation.x = -Math.PI / 2; marke.visible = false; scene.add(marke);
function markiere(p) { marke.position.copy(p).y += 0.05; marke.visible = true; marke.userData.t = 0; }
// ---------------------------------------------------------------- Reden: E in der Naehe, oder Klick auf die Figur
const gespraech = { f: null, spricht: false, ton: null, nah: null };
function schweige() { gespraech.spricht = false; if (gespraech.ton) { gespraech.ton.pause(); gespraech.ton.src = ''; gespraech.ton = null; } try { speechSynthesis.cancel(); } catch (e) { } }
function sprich(f, text) {
  schweige(); gespraech.spricht = true; const ende = () => { if (gespraech.ton === ton || !gespraech.ton) gespraech.spricht = false; };
  const ersatz = () => { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.onend = () => { gespraech.spricht = false; }; speechSynthesis.speak(u); } catch (e) { gespraech.spricht = false; } };
  if (!LOKAL) { ersatz(); return; }
  const ton = new Audio(JARVIS + '/tts/stream?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(STIMMEN[f.id] || STIMMEN.brain)); gespraech.ton = ton;
  ton.onended = ende; ton.onerror = () => { if (gespraech.ton === ton) { gespraech.ton = null; ersatz(); } }; ton.play().catch(() => { if (gespraech.ton === ton) { gespraech.ton = null; ersatz(); } });
}
// Die Ereignisse kommen auf Deutsch aus dem Live Dienst. Fuer die Stimme wird der Schritt auf Englisch gesagt.
function schrittEnglisch(t) {
  const m = [[/^Liest (.*)/, 'reading $1'], [/^Ändert (.*)/, 'editing $1'], [/^Schreibt (.*)/, 'writing $1'], [/^Sucht (.*)/, 'searching the code for $1'], [/^Bash: .*/, 'running a shell command'], [/^Skill (.*)/, 'loading the skill $1'],
    [/^Auftrag: .*/, 'handing a task to a subagent'], [/^Suche: (.*)/, 'searching the web for $1'], [/^Nader: .*/, 'taking a new request from you'], [/^Antwort an Nader/, 'answering you'], [/^Fehler.*/, 'dealing with a tool error'], [/^(.*?): (.*)/, 'using $1, $2']];
  for (const [r, e] of m) if (r.test(t)) return t.replace(r, e).replace(/_/g, ' '); return t;
}
function statusSatz(f) {
  const l = f.letztes; if (!l) return "Right now I have no task, I'm on a break."; const min = Math.round((Date.now() - l.t) / 60000), sch = schrittEnglisch(l.text), pr = l.projekt.replace(/^\d+_/, '').replace(/_/g, ' ');
  return f.live ? "Right now I'm working in the project " + pr + '. My latest step: ' + sch + '.' : 'My last step was ' + (min < 1 ? 'less than a minute' : min + (min === 1 ? ' minute' : ' minutes')) + ' ago in the project ' + pr + ': ' + sch + '.';
}
function zeigeKarte(f) {
  const a = AGENTEN[f.id]; if (!a) return; gespraech.f = f; gespraech.start = Math.hypot(f.pos.x - ich.pos.x, f.pos.y - ich.pos.y); $('k_name').textContent = a[0]; $('k_rolle').textContent = a[1]; const st = statusSatz(f);
  $('k_text').textContent = a[2]; $('k_status').textContent = st; $('k_frage').value = ''; $('karte').style.display = 'block';
  ich.pfad = null; ich.zielGier = Math.atan2(f.pos.x - ich.pos.x, -(f.pos.y - ich.pos.y)); sprich(f, a[2] + ' ' + st);
}
function schliesseKarte() { $('karte').style.display = 'none'; schweige(); if (gespraech.f) gespraech.f.warte = 2; gespraech.f = null; $('k_frage').blur(); }
async function frage() {
  const f = gespraech.f, q = $('k_frage').value.trim(); if (!f || !q) return; const a = AGENTEN[f.id]; $('k_frage').value = ''; $('k_text').textContent = 'Let me think …'; $('k_status').textContent = 'You: ' + q; schweige();
  const rolle = 'You are ' + a[0].replace(/^\d+ /, '') + ', an AI agent on the team of Nader in Berlin. About you: ' + a[2] + ' Your current status: ' + statusSatz(f) + ' The others on the team: Brain (assigns tasks), CodeMaster (code), VisionForge (images), MotionStudio (video), DeepScout (research), VaultKeeper (knowledge and skills), WatchTower (monitoring), TrendPulse (trends). Answer in character, first person, always in English, in at most 3 short sentences, no lists, no asterisks, no dashes. Never invent numbers or prices. If you do not know something, say so.';
  if (!LOKAL) { const t = 'Free questions only work on the home machine, where my language model runs. Here I can tell you who I am: ' + a[2]; $('k_text').textContent = t; sprich(f, t); return; }
  try {            // lokales Sprachmodell (Ollama), kostenlos, nichts geht nach aussen
    const r = await fetch(OLLAMA + '/api/chat', { method: 'POST', body: JSON.stringify({ model: 'gemma3:4b', stream: true, options: { temperature: 0.6, num_predict: 160 }, messages: [{ role: 'system', content: rolle }, { role: 'user', content: q }] }) });
    if (!r.ok || !r.body) throw new Error('kein Stream'); const leser = r.body.getReader(), dek = new TextDecoder(); let rest = '', text = '';
    for (;;) { const { done, value } = await leser.read(); if (done) break; rest += dek.decode(value, { stream: true }); const zeilen = rest.split('\n'); rest = zeilen.pop();
      for (const z of zeilen) { if (!z.trim()) continue; try { const j = JSON.parse(z); const t = j.message && j.message.content; if (t) { text += t; if (gespraech.f === f) $('k_text').textContent = text.replace(/[*_#]/g, ''); } } catch (e) { } } }
    text = text.replace(/[*_#]/g, '').replace(/\s[–—]\s/g, ', ').trim(); if (!text) throw new Error('leer'); if (gespraech.f === f) { $('k_text').textContent = text; sprich(f, text); }
  } catch (e) {
    fetch(JARVIS + '/health').catch(() => { }); fetch(JARVIS + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hallo' }] }) }).catch(() => { });      // weckt das Modell auf
    if (gespraech.f === f) { $('k_text').textContent = 'My language model is just waking up. Ask me again in a few seconds.'; }
  }
}
$('k_zu').onclick = schliesseKarte; $('k_senden').onclick = frage; $('rede').onclick = () => { if (gespraech.nah) zeigeKarte(gespraech.nah); else if (gespraech.regal) zeigeBuecher(); };
for (const b of document.querySelectorAll('#modi button[data-m]')) b.onclick = () => setzeModus(b.dataset.m);
function setzeModus(m) {
  if (m !== 'fp') farbe.spruehStop();
  modus = m; document.body.dataset.modus = m; cam = m === 'iso' ? isoCam : persCam; renderPass.camera = cam; if (document.pointerLockElement && m !== 'fp') document.exitPointerLock();
  for (const b of document.querySelectorAll('#modi button[data-m]')) b.classList.toggle('an', b.dataset.m === m);
  if (dachGruppe) dachGruppe.visible = m !== 'iso'; if (ich.modell) ich.modell.visible = m !== 'fp'; $('kreuz').style.display = m === 'fp' ? 'block' : 'none';
  if (m !== 'iso') { blick.gier = ich.gier + Math.PI; blick.neig = m === 'tp' ? -0.22 : 0; ich.pfad = null; kopfGlatt.set(0, -999, 0); }
  $('hilfe').textContent = m === 'iso' ? (MOBIL ? 'Tippen: laufen. Ziehen: drehen. Zwei Finger: zoomen und schieben' : 'Klick: laufen. Ziehen: drehen. Rechte Taste: schieben. Mausrad: zoomen. E: reden. Leertaste: springen. V: Ansicht')
    : TOUCH ? (m === 'tp' ? 'Joystick: laufen. Ziehen: umsehen. Tippen auf den Boden: hinlaufen' : 'Joystick: laufen. Ziehen: umsehen. Farbe: schießen') : m === 'tp' ? 'WASD: laufen. Maus ziehen: umsehen. Klick auf Boden: hinlaufen. Shift: rennen. Leertaste: springen. E: reden. V: Ansicht' : 'WASD: laufen. Klick: Maus fangen. Linke Maustaste: Farbe schießen. Rechte Maustaste: Farbe entfernen. E: Farbe, halten: Strahl. F: reden. Esc: Übersicht';
  groesse();
}

// ---------------------------------------------------------------- Start
$('ladetext').textContent = 'Figuren werden geladen';
await Promise.all(figurenListe.map(ladeFigur));
const ich = new Figur(modelle.nader ? 'nader' : '_', nav.start, true);
const frei = nav.stationen.slice().sort(() => Math.random() - 0.5);
Object.keys(AGENTEN).forEach((id, i) => { const s = frei[i % frei.length]; const f = new Figur(id, [s.x, s.y, s.z]); f.station = s; s.belegt = f; f.gier = Math.atan2(s.blick[0], -s.blick[1]); f.zielGier = f.gier; f.spiele(s.art === 'tisch' ? 'work' : 'idle'); });
// ---------------------------------------------------------------- Monitore, Buecher, Ton
const schirme = new Schirme(scene, nav); const buecher = baueBuecher(scene, nav);
function zeigeBuecher() {
  const el = $('b_liste'); el.innerHTML = ''; for (const [titel, autor, grund] of buchVorschlaege(5)) { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = titel; const i = document.createElement('i'); i.textContent = autor; const sp = document.createElement('span'); sp.textContent = grund; d.append(b, i, sp); el.appendChild(d); }
  $('buecher').style.display = 'block'; gespraech.buchOffen = true; ich.pfad = null;
}
function schliesseBuecher() { $('buecher').style.display = 'none'; gespraech.buchOffen = false; }
$('b_neu').onclick = zeigeBuecher; $('b_zu').onclick = schliesseBuecher;
function regalNah() { for (const r of buecher.zonen) { if (Math.abs(r.reihen[0] - ich.pos.z) > 1.2) continue; const a = r.achse === 'x' ? ich.pos.y : ich.pos.x, q = r.achse === 'x' ? ich.pos.x : ich.pos.y; if (a > r.a0 - 0.5 && a < r.a1 + 0.5 && r.fest - q < 2.4 && r.fest - q > 0) return r; } return null; }
THREE.DefaultLoadingManager.onLoad = () => setTimeout(spiegelAufnehmen, 150); setTimeout(spiegelAufnehmen, 2500); setTimeout(spiegelAufnehmen, 7000);
// ---------------------------------------------------------------- Tiere: Katzen und Berberaffen streifen durchs Haus
const tiere = []; const tierModelle = {};
{ const roh = await fetch('./assets/figuren/tiere.json').then(r => r.ok ? r.json() : []).catch(() => []); const liste = Array.isArray(roh) ? roh : Object.values(roh);
  await Promise.all(liste.map(async t => { try { const g = await gltfLader.loadAsync('./assets/figuren/' + t.datei); tierModelle[t.id] = { szene: g.scene, schulter: t.schulter }; } catch (e) { console.warn('Tier fehlt', t.id); } })); }
class Tier {
  constructor(id, s) {
    const m = tierModelle[id]; this.id = id; this.pos = new THREE.Vector3(s.x + (Math.random() - 0.5), s.y + (Math.random() - 0.5), s.z); const h = NAV.hoehe(this.pos.x, this.pos.y, this.pos.z); if (h === null) this.pos.set(s.x, s.y, s.z);
    this.gier = Math.random() * 6; this.v = 0; this.vmax = id === 'katze' ? 0.9 : 0.75; this.pfad = null; this.warte = Math.random() * 6; this.sitzt = Math.random() < 0.5;
    this.wurzel = new THREE.Group(); this.wurzel.userData.nichtSpiegeln = true; scene.add(this.wurzel); this.modell = SkeletonUtils.clone(m.szene); this.wurzel.add(this.modell);
    this.modell.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.roughness = 0.7; o.material.metalness = 0; o.material.envMap = umgebung; o.material.envMapIntensity = 0.25; randLicht(o.material); } });
    this.koerper = new Vierbeiner(this.modell, m.schulter);
    this.schatten = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false, opacity: 0.8 })); this.schatten.rotation.x = -Math.PI / 2; this.schatten.renderOrder = 2; this.schatten.userData.nichtSpiegeln = true; scene.add(this.schatten);
  }
  update(dt) {
    if (this.pfad && this.pfad.length) {
      const z = this.pfad[0], dx = z.x - this.pos.x, dy = z.y - this.pos.y, d = Math.hypot(dx, dy); const ziel = this.pfad.length === 1 ? Math.min(this.vmax, 0.25 + d * 1.6) : this.vmax; this.v += (ziel - this.v) * (1 - Math.exp(-dt * 4));
      if (d < 0.1) { this.pfad.shift(); if (!this.pfad.length) this.pfad = null; } else { const st = Math.min(d, this.v * dt); this.pos.x += dx / d * st; this.pos.y += dy / d * st; this.pos.z = NAV.hoehe(this.pos.x, this.pos.y, this.pos.z) ?? z.z; this.zielGier = Math.atan2(dx, -dy); }
    } else {
      this.v *= Math.exp(-dt * 6); this.warte -= dt;
      if (this.warte < 0) { const s = nav.stationen[Math.floor(Math.random() * nav.stationen.length)]; const w = Math.random() * 6.28, r = 0.8 + Math.random() * 2.2; const p = NAV.weg(this.pos, new THREE.Vector3(s.x + Math.cos(w) * r, s.y + Math.sin(w) * r, s.z)); if (p && p.length) this.pfad = p; this.warte = 6 + Math.random() * 16; this.sitzt = Math.random() < 0.65; }
    }
    if (this.zielGier !== undefined) { let d = this.zielGier - this.gier; d = Math.atan2(Math.sin(d), Math.cos(d)); this.gier += d * (1 - Math.exp(-dt * 6)); }
    const p = B(this.pos.x, this.pos.y, this.pos.z); this.wurzel.position.copy(p); this.wurzel.rotation.y = this.gier; this.schatten.position.set(p.x, p.y + 0.035, p.z);
    this.koerper.update(dt, this.v, !this.pfad && this.sitzt);
  }
}
{ const orte = nav.stationen.slice().sort(() => Math.random() - 0.5); let i = 0; for (const id of ['katze', 'affe', 'katze', 'affe', 'katze', 'affe']) if (tierModelle[id]) tiere.push(new Tier(id, orte[i++ % orte.length])); }

// ---------------------------------------------------------------- Live: echte Claude Code Ereignisse (Dashboard Server, /api/live)
const HEIM = { brain: ['platz', 'holo'], coder: ['rechts1', 'tisch'], scout: ['dachraum', 'tisch'], maler: ['links1', 'tisch'], film: ['links2', 'tisch'], funk: ['rechts2', 'tisch'], archiv: ['halle1', 'tisch'], feld: ['oben', 'runde'] };
for (const f of figuren) { const h = HEIM[f.id]; if (!h) continue; const st = nav.stationen.find(s => s.raum === h[0] && s.art === h[1] && !s.heim); if (st) { st.heim = f.id; f.heim = st; } }
const live = { seit: 0, erst: true, liste: [], sitzungen: [] };
const tickerEl = $('ticker'), liveEl = $('live');
function liveEreignis(e) {
  const f = figuren.find(x => x.id === e.figur); if (!f) return;
  const clip = (e.art === 'prompt' || e.art === 'auftrag' || e.art === 'antwort') ? 'talk' : 'work';
  f.live = { bis: zeit + 22, clip, versucht: f.live ? f.live.versucht : false }; f.warte = 0;
  f.schild.textContent = AGENTEN[f.id][0].replace(/^\d+ /, '') + ': ' + e.text; f.schild.classList.add('live'); f.schild.classList.toggle('fehler', e.art === 'fehler');
  f.letztes = { text: e.text, t: Date.now(), projekt: e.projekt }; schirme.setzeKopf(e.figur, e.text); holo.ereignis(e.figur); live.liste.unshift(e); live.liste.length = Math.min(live.liste.length, 6);
  tickerEl.innerHTML = ''; for (const x of live.liste) { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = AGENTEN[x.figur][0].replace(/^\d+ /, ''); const sp = document.createElement('span'); sp.textContent = ' ' + x.text + (x.sub ? ' (Subagent)' : ''); const i = document.createElement('i'); i.textContent = x.projekt; d.append(b, sp, i); tickerEl.appendChild(d); }
}
async function liveAbfrage() {
  if (!LOKAL) { liveEl.textContent = 'Online Ansicht: Live Daten nur am eigenen Rechner'; liveEl.classList.remove('an'); return; }
  try {
    const r = await fetch('/api/live?seit=' + live.seit, { cache: 'no-store' }); const d = await r.json();
    if (live.erst) { live.erst = false; live.seit = d.letzte; } else { for (const e of d.ereignisse) liveEreignis(e); live.seit = Math.max(live.seit, d.letzte); }
    live.sitzungen = d.sitzungen; const n = d.sitzungen.length;
    liveEl.textContent = n ? 'Live: ' + n + (n === 1 ? ' Sitzung aktiv' : ' Sitzungen aktiv') + ' (' + [...new Set(d.sitzungen.map(x => x.projekt))].slice(0, 2).join(', ') + ')' : 'Keine Sitzung aktiv, die Agenten machen Pause'; liveEl.classList.toggle('an', n > 0);
  } catch (e) { liveEl.textContent = 'Live Dienst nicht erreichbar'; liveEl.classList.remove('an'); }
  setTimeout(liveAbfrage, 1000);
}
if (!REGIE) liveAbfrage();
// Welt in der Welt: im Licht des Hologramms steht das ganze Haus noch einmal als Miniatur, mit allen Figuren und Tieren live.
// Darin steht wieder ein Hologramm mit der naechsten Miniatur. Die kleinen Figuren teilen Netz und Knochen mit den grossen:
// sie kosten keine eigene Animation und tun genau das, was die grossen gerade tun.
const mini = { stufen: [], S: new THREE.Matrix4(), s: 0.0464, mitte: B(nav.holo[0], nav.holo[1], nav.holo[2] + 0.14), M1: new THREE.Matrix4(), M2: new THREE.Matrix4() };
for (let k = 0; k < 2; k++) {
  const g = new THREE.Group(); g.matrixAutoUpdate = false; g.userData.nichtSpiegeln = true; const w = welt.clone(); const dach = w.getObjectByName('DACH'); if (dach) dach.visible = false;
  w.traverse(o => { o.castShadow = false; o.receiveShadow = false; }); g.add(w);
  const klein = (wurzel) => wurzel.traverse(o => { if (!o.isSkinnedMesh) return; const m = new THREE.SkinnedMesh(o.geometry, o.material); m.bind(o.skeleton, o.bindMatrix); m.bindMode = 'detached'; m.bindMatrixInverse.identity(); m.frustumCulled = false;
    m.updateMatrixWorld = function (force) { THREE.Mesh.prototype.updateMatrixWorld.call(this, force); }; g.add(m); });
  for (const f of figuren) if (f.modell) klein(f.modell); for (const t of tiere) if (t.modell) klein(t.modell);
  scene.add(g); mini.stufen.push(g);
}
// die offene Ecke dreht sich weich zur Kamera: man schaut immer hinein
mini.update = (t) => { mini.M1.makeTranslation(mini.mitte.x, mini.mitte.y, mini.mitte.z); { const ziel = Math.atan2(cam.position.x - mini.mitte.x, cam.position.z - mini.mitte.z) + Math.PI / 4 + Math.sin(t * 0.25) * 0.12; if (mini.w === undefined) mini.w = ziel; let d = ziel - mini.w; d = Math.atan2(Math.sin(d), Math.cos(d)); mini.w += d * Math.min(1, 0.03); } mini.M2.makeRotationY(mini.w); mini.M1.multiply(mini.M2); mini.M2.makeScale(mini.s, mini.s, mini.s); mini.M1.multiply(mini.M2); mini.M2.makeTranslation(-20, 0, 20); mini.S.multiplyMatrices(mini.M1, mini.M2);
  mini.stufen[0].matrix.copy(mini.S); mini.stufen[1].matrix.multiplyMatrices(mini.S, mini.S); for (const g of mini.stufen) g.matrixWorldNeedsUpdate = true; };
holo.kern.scale.setScalar(0.42);
// Tageszeit und Wetter: laeuft nach der Uhr in Deutschland und dem Wetter in Berlin, oben per Regler stellbar
const tag = new Tag({ LUFT, fels, lichtU, strahlen, sonne, hemi, laternen: laternenSchein, regen, ton, neuSpiegeln: () => spiegelAufnehmen(),
  innen: () => ich.pos.x > 0.5 && ich.pos.x < 39.5 && ich.pos.y > 0.5 && ich.pos.y < 39.5 && (ich.pos.x > 12 || ich.pos.y > 12 || ich.pos.z > 1),
  aufWechsel: (P, h, d) => { tiefe.mat.uniforms.uDunstFarbe.value.setRGB(P.horG[0] * 0.45 + 0.125 * P.lampen, P.horG[1] * 0.45 + 0.075 * P.lampen, P.horG[2] * 0.45 + 0.04 * P.lampen); voegel.mesh.visible = h > -7; const fl = h > -2 && tag.nass < 0.15; for (const f of falter.liste) f.g.visible = fl; } });
if (Q.get('zeit')) { tag.live = false; tag.stunde = +Q.get('zeit'); } if (Q.get('wetter')) tag.wahl = Q.get('wetter');
setzeModus(Q.get('modus') || 'iso');
$('lade').style.opacity = 0; setTimeout(() => $('lade').remove(), 900);

const ORTE = [['platz', 'Platz'], ['hof', 'Hof'], ['oben', 'Oberdeck'], ['dachraum', 'Dachraum'], ['links', 'Linker Flügel'], ['rechts', 'Rechter Flügel'], ['galerie', 'Galerie'], ['t_', 'Treppe']];
const uhr = new THREE.Clock(); const tmp = new THREE.Vector3(); let zeit = 0, bilder = 0, fpsZeit = 0;
function bild() {
  const dtRoh = REGIE ? REGIE_DT : uhr.getDelta(); const dt = REGIE ? REGIE_DT : Math.min(dtRoh, 0.05); zeit += dt; if (!REGIE && document.visibilityState === 'visible') regeln(dtRoh);
  // Spieler: die Tasten geben eine Wunschgeschwindigkeit vor, die echte Geschwindigkeit folgt weich (kein Ruckeln)
  if (REGIE && window.__regie) window.__regie.vor(zeit, dt);
  if (!REGIE) {
    const sl = Math.hypot(stick.x, stick.y), sa = sl > 0.14; let vx = (tasten.KeyD || tasten.ArrowRight ? 1 : 0) - (tasten.KeyA || tasten.ArrowLeft ? 1 : 0) + (sa ? stick.x : 0), vz = (tasten.KeyW || tasten.ArrowUp ? 1 : 0) - (tasten.KeyS || tasten.ArrowDown ? 1 : 0) - (sa ? stick.y : 0); let wx = 0, wy = 0; const aktiv = !!(vx || vz);
    if (aktiv) {
      const g = modus === 'iso' ? Math.atan2(Math.cos(iso.az), -Math.sin(iso.az)) : blick.gier; const l = Math.hypot(vx, vz); vx /= l; vz /= l;
      // Vorwaerts in Three: (-sin g, 0, -cos g). In Blender: x = -sin g, y = cos g
      const fx = -Math.sin(g), fy = Math.cos(g), rx = Math.cos(g), ry = Math.sin(g); const v = (tasten.ShiftLeft || tasten.ShiftRight || (sa && sl > 0.94)) ? 5.0 : sa ? 2.4 * Math.max(0.3, Math.min(1, sl / 0.8)) : 2.4;      // Joystick analog: sanft gehen, ganz ausgelenkt rennen
      wx = (fx * vz + rx * vx) * v; wy = (fy * vz + ry * vx) * v; ich.pfad = null;
    }
    const k = 1 - Math.exp(-dt * (aktiv ? 8 : 11)); ich.vel.x += (wx - ich.vel.x) * k; ich.vel.y += (wy - ich.vel.y) * k; const sp = ich.vel.length();
    if (!ich.pfad) {
      ich.manuell = true;
      if (sp > 0.03) { const n = NAV.bewege(ich.pos, ich.vel.x * dt, ich.vel.y * dt); const echt = Math.hypot(n.x - ich.pos.x, n.y - ich.pos.y) / Math.max(dt, 1e-4); ich.pos.copy(n); ich.tempo += (Math.min(echt, sp) - ich.tempo) * (1 - Math.exp(-dt * 14)); if (sp > 0.35) ich.zielGier = Math.atan2(ich.vel.x, -ich.vel.y); }
      else ich.tempo *= Math.exp(-dt * 12);
    } else ich.manuell = false;
    // Springen mit der Leertaste
    if (tasten.Space && ich.sprungH === 0 && ich.vy === 0 && !gespraech.f) { ich.vy = 4.5; ton.schritt(bodenArt(ich), 1, 0.7); }
    if (ich.vy !== 0 || ich.sprungH > 0) { ich.sprungH += ich.vy * dt; ich.vy -= 12.5 * dt; if (ich.sprungH <= 0) { ich.sprungH = 0; ich.vy = 0; if (ich.koerper) ich.koerper.landung = 1; ton.dumpf(0.5); ton.schritt(bodenArt(ich), 1, 1.2); } }
    if (!gespraech.f) ich.spiele('idle');
  }
  for (const f of figuren) { if (!f.ich && !f.regie) npcDenken(f, dt); f.schritt(dt); }
  // Abstossen: niemand laeuft durch Agenten oder Tiere hindurch. Der Spieler wird sanft herausgeschoben.
  if (!REGIE) { let sx = 0, sy = 0; const pruef = (o, rad) => { const dx = ich.pos.x - o.pos.x, dy = ich.pos.y - o.pos.y; if (Math.abs(ich.pos.z - o.pos.z) > 1.3) return; const d = Math.hypot(dx, dy); if (d < rad && d > 1e-4) { const k = (rad - d) / d; sx += dx * k; sy += dy * k; } else if (d <= 1e-4) sx += rad; };
    for (const f of figuren) if (!f.ich) pruef(f, 0.62); for (const t of tiere) pruef(t, 0.45);
    if (sx || sy) { const st = Math.min(1, dt * 14); const n = NAV.bewege(ich.pos, sx * st, sy * st); ich.pos.copy(n); const l = Math.hypot(sx, sy); const ein = (ich.vel.x * sx + ich.vel.y * sy) / l; if (ein < 0) { ich.vel.x -= sx / l * ein; ich.vel.y -= sy / l * ein; }            // Bewegung in den anderen hinein wird gestoppt, seitlich gleitet man vorbei
      if (ich.pfad && l > 0.25) ich.stau = (ich.stau || 0) + dt; else ich.stau = 0; if (ich.stau > 1.2) { ich.pfad = null; ich.stau = 0; } } else ich.stau = 0; }
  // Wer steht nah genug zum Reden
  let nah = null, nd = 2.6; for (const f of figuren) { if (f.ich) continue; const d = Math.hypot(f.pos.x - ich.pos.x, f.pos.y - ich.pos.y); if (d < nd && Math.abs(f.pos.z - ich.pos.z) < 1.2) { nd = d; nah = f; } }
  const regal = nah ? null : regalNah(); const zu = !!(gespraech.f || gespraech.buchOffen);
  if (nah !== gespraech.nah || regal !== gespraech.regal || zu !== gespraech.offen) { gespraech.nah = nah; gespraech.regal = regal; gespraech.offen = zu; const el = $('rede'); el.style.display = (nah || regal) && !zu ? 'block' : 'none'; if (nah) el.textContent = (TOUCH ? 'Tippen: mit ' : modus === 'fp' ? 'F: mit ' : 'E: mit ') + AGENTEN[nah.id][0].replace(/^\d+ /, '') + ' reden'; else if (regal) el.textContent = (TOUCH ? 'Tippen: ' : modus === 'fp' ? 'F: ' : 'E: ') + 'Bücher ansehen'; }
  if (gespraech.f && Math.hypot(gespraech.f.pos.x - ich.pos.x, gespraech.f.pos.y - ich.pos.y) > Math.max(6, (gespraech.start || 0) + 3)) schliesseKarte();        // erst schliessen, wenn man wirklich weggeht
  // Kamera
  if (REGIE && window.__regie) window.__regie.kamera(persCam, zeit, dt);
  else if (modus !== 'iso') {
    const kopfZiel = ich.wurzel.position.clone(); kopfZiel.y += ich.hoehe * (modus === 'fp' ? 0.9 : 0.82); if (kopfGlatt.y < -900) kopfGlatt.copy(kopfZiel);
    kopfGlatt.x = kopfZiel.x; kopfGlatt.z = kopfZiel.z; kopfGlatt.y += (kopfZiel.y - kopfGlatt.y) * (1 - Math.exp(-dt * 10)); const kopf = kopfGlatt.clone();        // Hoehe geglaettet: Treppen und Sprung ruckeln nicht
    const r = new THREE.Vector3(-Math.sin(blick.gier) * Math.cos(blick.neig), Math.sin(blick.neig), -Math.cos(blick.gier) * Math.cos(blick.neig));
    if (modus === 'fp') { persCam.position.copy(kopf); persCam.lookAt(kopf.clone().add(r)); if (!(tasten.KeyW || tasten.KeyS || tasten.KeyA || tasten.KeyD)) ich.gier = blick.gier + Math.PI; }
    else {
      let ab = blick.abstand; strahl.set(kopf, r.clone().negate()); strahl.far = ab + 0.3; const t = strahl.intersectObjects(kameraSperre, false)[0]; if (t) ab = Math.max(0.5, t.distance - 0.3); strahl.far = Infinity;
      persCam.position.copy(kopf).addScaledVector(r, -ab); persCam.lookAt(kopf);
    }
  }
  // Farbe schiessen und Laub
  persCam.updateMatrixWorld(true); if ((feuer || feuerKnopf) && modus === 'fp') farbe.schiesse();
  { const ziele = []; for (const f of figuren) if (!f.ich) ziele.push({ x: f.wurzel.position.x, y: f.wurzel.position.y, z: f.wurzel.position.z, r: 0.3, h: f.hoehe }); for (const t of tiere) ziele.push({ x: t.pos.x, y: t.pos.z, z: -t.pos.y, r: 0.25, h: 0.5 });
    farbe.update(dt, { fp: modus === 'fp' && !gespraech.f, tempo: ich.tempo, gier: blick.gier, neig: blick.neig, ziele, licht: tag.P ? Math.min(1, 0.3 + (tag.P.tagL[0] + tag.P.tagL[1] + tag.P.tagL[2]) * 0.2 + tag.P.lampen * 0.25) : 1 });
    const sch = [{ id: 'ich', x: ich.pos.x, y: ich.pos.y, z: ich.pos.z, r: 0.6 }]; figuren.forEach((f, i) => { if (!f.ich) sch.push({ id: 'f' + i, x: f.pos.x, y: f.pos.y, z: f.pos.z, r: 0.5 }); }); tiere.forEach((t, i) => sch.push({ id: 't' + i, x: t.pos.x, y: t.pos.y, z: t.pos.z, r: 0.35 })); laub.update(dt, sch); }
  // Effekte
  schirme.update(dt); ton.leiser(gespraech.spricht);
  holo.update(dt, renderer.getPixelRatio()); holo.kern.position.y += 1.65; mini.update(zeit); voegel.update(zeit); falter.update(zeit, dt); for (const t of tiere) t.update(dt);
  if (marke.visible) { marke.userData.t += dt; marke.scale.setScalar(1 + marke.userData.t * 1.5); marke.material.opacity = Math.max(0, 1 - marke.userData.t * 1.4); if (marke.userData.t > 0.75 && !ich.pfad) marke.visible = false; }
  cam.updateMatrixWorld(); himmel.position.copy(cam.position); himmel.material.uniforms.uZeit.value = zeit; strahlen.mat.uniforms.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse); wolken.mat.uniforms.uInvVP.value.copy(strahlen.mat.uniforms.uInvVP.value); wolken.mat.uniforms.uZeit.value = zeit; strahlen.mat.uniforms.uZeit.value = zeit; look.mat.uniforms.uZeit.value = zeit; staubMat.uniforms.uZeit.value = zeit;
  tag.update(dt); regen.kam = cam;
  { const u = tiefe.mat.uniforms; u.uInvP.value.copy(cam.projectionMatrixInverse); u.uProj.value.set(cam.projectionMatrix.elements[0], cam.projectionMatrix.elements[5]);
    const fpFokus = modus === 'fp' && !REGIE;
    if (fpFokus) { fokusT -= dt; if (fokusT <= 0) { fokusT = 0.05; fokusZiel = farbe.fokus(); } fokusGlatt = Math.exp(Math.log(fokusGlatt) + (Math.log(Math.max(0.25, fokusZiel)) - Math.log(fokusGlatt)) * (1 - Math.exp(-dt * 7)));
      unschaerfe.enabled = true; const d = unschaerfe.mat.uniforms, F = fokusGlatt; d.uFokus.value = F; d.uNah.value = persCam.near; d.uFern.value = persCam.far;
      d.uStaerke.value = renderer.getPixelRatio() * THREE.MathUtils.clamp(11 / (F + 0.15), 0.6, 18); d.uFrei.value = THREE.MathUtils.clamp(0.05 + F * 0.035, 0.06, 0.45); }
    const ein = modus === 'iso' && !REGIE; if (!REGIE && !fpFokus) unschaerfe.enabled = ein; if (ein) { const d = unschaerfe.mat.uniforms; d.uFokus.value = iso.dist; d.uNah.value = isoCam.near; d.uFern.value = isoCam.far; d.uStaerke.value = renderer.getPixelRatio() * THREE.MathUtils.clamp(190 / (iso.dist + 8), 3.2, 13); d.uFrei.value = THREE.MathUtils.clamp(0.16 + iso.dist * 0.0042, 0.18, 0.5); } }
  if (REGIE && window.__regie) window.__regie.nach(zeit, dt);
  if (!(REGIE && window.__regieStumm)) composer.render(dt);
  // Schilder
  for (const f of figuren) {
    tmp.copy(f.wurzel.position); tmp.y += f.hoehe + 0.18; tmp.project(cam); const sichtbar = (namenAn || f === zeigeAuf) && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 && !(f.ich && modus === 'fp');
    f.schild.style.display = sichtbar ? 'block' : 'none'; if (sichtbar) { f.schild.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; f.schild.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px'; }
  }
  bilder++; if (zeit - fpsZeit > 0.5) { const id = NAV.flaecheBei(ich.pos); const o = ORTE.find(o => id && id.startsWith(o[0])); if (o) $('ort').textContent = o[1]; window.__fps = bilder / (zeit - fpsZeit); bilder = 0; fpsZeit = zeit; }
  if (!REGIE) requestAnimationFrame(bild);
}
window.__atlas = { B, modelle, umgebung, randLicht, nav, look, cam: () => cam, sonne, hemi, bild, isoCam, renderPass, tiefe, unschaerfe, scharf, spiegelU, randU, stick, mini, tag, regen, lichtU, LUFT, farbe, laub, persCam, blick, scene, renderer, composer, regel, ton, schirme, wolken, himmel, fels, holo, voegel, falter, tiere, figuren, ich, NAV, iso, isoKamera, setzeModus, strahlen, bloom, live, liveEreignis, gespraech, zeigeKarte, schliesseKarte };
if (!REGIE) requestAnimationFrame(bild);

// ---------------------------------------------------------------- Regie: Videos aus der Welt (siehe regie/)
if (REGIE) { setzeModus('tp'); const m = await import('../regie/' + REGIE + '.js'); window.__regie = await m.start(window.__atlas, Q); window.__regieBereit = true; }
