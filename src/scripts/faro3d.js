// Faro° — escena 3D de Santiago de noche para el banner de la portada (FaroCiudad.astro).
// v2 (5-nov-2026): geografía REAL a escala 1:1 (1 unidad = 1 m), origen en el cerro Santa Lucía.
// - Edificios (huellas y alturas), vías, Mapocho: © OpenStreetMap contributors (ODbL), bajados una vez y horneados en
//   /geo/santiago-v1.bin + /geo/santiago-mask.webp (tools/santiago3d/). Sin llamadas a Overpass en el navegador.
// - Relieve: tiles Terrarium de AWS Open Data (Mapzen/Tilezen: SRTM y otras). El SRTM es de superficie y no resuelve el
//   Santa Lucía: el cerro se modela sobre su huella OSM con su altura real (~69 m sobre la calle).
// - El faro (la metáfora) y los tres locales son FICTICIOS; los locales llevan el sello «Ejemplo» en la página.
// - three r187 de npm, cargado con import() solo cuando el recuadro se acerca. Bloom, niebla de altura (smog de la cuenca),
//   ventanas procedurales por tipo de edificio, alumbrado por clase de calle, tráfico sobre las vías reales.
// - Presupuesto: DPR <= 1,25 (1 en pantallas chicas); dibuja solo a la vista; guardián de fps (apaga bloom/DPR, luego póster).
// - ?f3poster=<estación>&bw=&bh=&dpr= dibuja un cuadro y deja window.__poster (así se generan los pósters). ?cam=x,y,z,tx,ty,tz,fov depura.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const T0 = performance.now();
const pausa = () => new Promise((r) => setTimeout(r, 0));   // cede el hilo entre bloques de construcción
const q = new URLSearchParams(location.search);
const CAP = q.has('cap');
const POSTER = q.get('f3poster');
const box = document.querySelector('[data-f3]');
if (q.has('bw')) { box.style.width = q.get('bw') + 'px'; box.style.height = q.get('bh') + 'px'; box.style.minHeight = '0'; box.style.maxHeight = 'none'; box.style.aspectRatio = 'auto'; }
const H = window.__f3haz = { modo: 'cargando', frames: 0, perdidas: 0, restauradas: 0, dpr: 0, motivo: '' };
const LOCALES = (() => { try { return JSON.parse(document.getElementById('f3-locales').textContent); } catch (e) { return []; } })();

// ---------- datos horneados (FaroCiudad.astro ya los pidió en paralelo con este módulo) ----------
const GEO_URL = '/geo/santiago-v1.bin', MASK_URL = '/geo/santiago-mask.webp';
async function leerGeo() {
  const r = await (window.__f3geo || fetch(GEO_URL));
  if (!r.ok) throw new Error('geo ' + r.status);
  let b = new Uint8Array(await r.clone().arrayBuffer());
  if (b[0] === 0x1f && b[1] === 0x8b) b = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const hl = new DataView(b.buffer).getUint32(4, true);
  const hdr = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + hl)));
  let st = 8 + hl; st += (4 - (st % 4)) % 4;
  const T = { '<i2': Int16Array, '<u2': Uint16Array, '|u1': Uint8Array };
  const sec = {}; for (const s of hdr.sec) sec[s.n] = { ...s, a: new T[s.t](b.buffer, st + s.o, s.c) };
  return { hdr, sec };
}
const geoP = leerGeo();
const maskP = new THREE.TextureLoader().loadAsync(MASK_URL);

const canvas = document.createElement('canvas');
canvas.className = 'gl';
canvas.setAttribute('aria-hidden', 'true');
box.querySelector('.f3-poster').after(canvas);
function toPoster(why) {
  H.modo = 'poster'; H.motivo = why; box.dataset.haz = 'poster'; box.dataset.hazMotivo = why;
  try { stop(); } catch (e) {} if (renderer) { try { renderer.dispose(); } catch (e) {} } canvas.remove();
  window.dispatchEvent(new Event('f3:poster'));
}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!POSTER || q.has('cam') });
} catch (e) { renderer = null; }
if (!renderer || !renderer.capabilities.isWebGL2) { toPoster('sin-webgl2'); throw new Error('sin webgl2'); }
const SMALL = matchMedia('(max-width: 640px)').matches;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x05070e, 1);
let DPR = POSTER ? parseFloat(q.get('dpr') || '1') : Math.min(window.devicePixelRatio || 1, SMALL ? 1 : 1.25);
let BLOOM = !q.has('nobloom');

let GEO, MASK;
try { [GEO, MASK] = await Promise.all([geoP, maskP]); }
catch (e) { toPoster('sin-datos'); throw e; }
const { hdr: HDR, sec: SEC } = GEO;
H.datosMs = Math.round(performance.now() - T0);

// ---------- utilidades ----------
let glowTex, streakTex;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash2(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
function n2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v);
}
function fbmJ(x, z) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * n2(x, z); x = x * 2.03 + 7.1; z = z * 2.03 + 3.7; a *= 0.5; } return s; }
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- relieve real ----------
function dem(s) {
  const { nx, nz, k } = s, a = s.a, h = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) { let v = 0; for (let i = 0; i < nx; i++) { v += a[j * nx + i]; h[j * nx + i] = v * k; } }   // filas en delta
  return { ...s, h };
}
const DC = dem(SEC.demCity), DA = dem(SEC.demAndes);
function demAt(D, x, z) {
  const fx = (x - D.x0) / D.s, fz = (z - D.z0) / D.s;
  if (fx < 0 || fz < 0 || fx > D.nx - 1 || fz > D.nz - 1) return null;
  const i = Math.min(D.nx - 2, fx | 0), j = Math.min(D.nz - 2, fz | 0), u = fx - i, v = fz - j, n = D.nx, h = D.h;
  return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v;
}
const ground = (x, z) => { const c = demAt(DC, x, z); if (c !== null) return c; const a = demAt(DA, x, z); return a === null ? 0 : a; };
// cerro Santa Lucía: huella OSM + altura real; perfil de roca empinada con una cumbre redondeada
const SL = []; for (let i = 0; i < HDR.stalucia.length; i += 2) SL.push([HDR.stalucia[i], HDR.stalucia[i + 1]]);
const SL_H = 69, SL_R = 105;
const slBox = SL.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]);
function slDist(x, z) {     // distancia con signo al borde (positiva adentro)
  let dmin = 1e9, ins = false;
  for (let i = 0, j = SL.length - 1; i < SL.length; j = i++) {
    const [xi, zi] = SL[i], [xj, zj] = SL[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi) ins = !ins;
    const ex = xj - xi, ez = zj - zi, t = clamp(((x - xi) * ex + (z - zi) * ez) / (ex * ex + ez * ez + 1e-9), 0, 1);
    dmin = Math.min(dmin, Math.hypot(x - xi - ex * t, z - zi - ez * t));
  }
  return ins ? dmin : -dmin;
}
function hillAt(x, z, d = slDist(x, z)) {
  if (d <= 0) return 0;
  const t = clamp(d / SL_R, 0, 1), n = fbmJ(x * 0.045, z * 0.045);
  const terr = Math.floor(t * 7 + n * 0.8) / 7;                       // terrazas (el cerro tiene paseos escalonados)
  return SL_H * (0.58 * smooth(0, 0.32, t) + 0.42 * smooth(0.25, 1, lerp(t, terr, 0.35))) * (0.9 + 0.2 * n);
}
const groundAll = (x, z) => ground(x, z) + ((x > slBox[0] && x < slBox[2] && z > slBox[1] && z < slBox[3]) ? hillAt(x, z) : 0);

const FARO_S = 2.4;                                            // el faro mide ~40 m: metáfora a escala legible
const LH = { x: 0, z: 0, y: ground(0, 0) + hillAt(0, 0) - 0.6 };
const TORRE = HDR.torre;
const SANCRIS = { x: HDR.sancris[0], z: HDR.sancris[1], y: ground(HDR.sancris[0], HDR.sancris[1]) };

// ---------- uniforms compartidos + GLSL común ----------
const MB = HDR.mask;
MASK.flipY = false; MASK.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); MASK.generateMipmaps = true;
MASK.minFilter = THREE.LinearMipmapLinearFilter; MASK.magFilter = THREE.LinearFilter; MASK.colorSpace = THREE.NoColorSpace; MASK.needsUpdate = true;
const U = {
  uTime: { value: 0 },
  uLens: { value: new THREE.Vector3(LH.x, LH.y + 14.25 * FARO_S, LH.z) },
  uBeamDir: { value: new THREE.Vector3(1, 0, -1).normalize() },
  uBeamCos: { value: Math.cos(THREE.MathUtils.degToRad(3.4)) },
  uBeamI: { value: 1 },
  uMoonDir: { value: new THREE.Vector3(-0.45, 0.5, 0.75).normalize() },
  uFogCol: { value: new THREE.Color(0x202b58) },
  uFogA: { value: 0.00021 },     // densidad de la bruma a nivel de calle (smog de la cuenca)
  uFogB: { value: 1 / 380 },      // la bruma se adelgaza con la altura: la cordillera asoma limpia
  uLit: { value: 0.6 },
  uLH: { value: new THREE.Vector2(LH.x, LH.z) },
  uMask: { value: MASK },
  uMB: { value: new THREE.Vector4(MB.x0, MB.z0, 1 / (MB.x1 - MB.x0), 1 / (MB.z1 - MB.z0)) },
};
const COMMON = /* glsl */`
uniform float uTime, uBeamCos, uBeamI, uFogA, uFogB, uLit; uniform vec2 uLH; uniform vec3 uLens, uBeamDir, uMoonDir, uFogCol;
uniform sampler2D uMask; uniform vec4 uMB;
// el encendido avanza como una onda desde el cerro
float litAt(vec3 P){ float dd = length(P.xz - uLH); return clamp(uLit*1.6 - dd*0.00008, 0.12, 1.0); }
const vec3 BEAM = vec3(0.40, 0.50, 1.0);
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*noise(p); p = p*2.03 + 11.0; a *= 0.5; } return s; }
vec2 muv(vec2 p){ return (p - uMB.xy) * uMB.zw; }
vec3 beamAt(vec3 P, vec3 N){
  vec3 toP = P - uLens; float d = length(toP); vec3 l = toP / max(d, 1e-3);
  float c = dot(l, uBeamDir); float w = (1.0 - uBeamCos);
  float cone = smoothstep(uBeamCos - w*1.4, uBeamCos + w*0.6, c);
  float att = 1.0 / (1.0 + d*d/(520.0*520.0));
  float ndl = clamp(dot(N, -l)*0.85 + 0.15, 0.0, 1.0);
  float nearL = max(dot(N, -l), 0.0) / (1.0 + d*d/(40.0*40.0));
  return BEAM * (cone * att * ndl * 3.2 * uBeamI + nearL * 1.2);
}
vec3 ambient(vec3 N){ return mix(vec3(0.030, 0.034, 0.058), vec3(0.10, 0.115, 0.20), N.y*0.5 + 0.5); }
vec3 moonL(vec3 N){ return vec3(0.40, 0.47, 0.70) * max(dot(N, uMoonDir), 0.0); }
// niebla de altura analítica: integra una densidad a·e^(-b·y) a lo largo del rayo cámara → punto
float fogT(vec3 P){
  vec3 ro = cameraPosition; float d = length(P - ro); float dy = P.y - ro.y;
  float e0 = exp(-uFogB*max(ro.y, -20.0)), e1 = exp(-uFogB*max(P.y, -20.0));
  float k = abs(dy) > 0.5 ? (e0 - e1) / (uFogB*dy) : e0;
  return exp(-uFogA * d * k);
}
vec3 fogged(vec3 c, vec3 P){ return mix(uFogCol, c, fogT(P)); }
`;
const VS_BASIC = /* glsl */`
varying vec3 vWP; varying vec3 vN;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp; }`;
const VS_POS = /* glsl */`varying vec3 vWP; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;
const VS_INST = /* glsl */`varying vec3 vWP; varying vec3 vN;
  void main(){ vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*wp; }`;
const mat = (fs, extra = {}, opts = {}) => new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, vertexShader: opts.vs || VS_BASIC, fragmentShader: COMMON + fs, ...opts.m });
const plainFS = (c, k = 1) => /* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN);
  vec3 col = vec3(${c})*(ambient(N)*${k.toFixed(2)} + moonL(N) + beamAt(vWP, N)); gl_FragColor = vec4(fogged(col, vWP), 1.0); }`;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 1.5, 90000);

await pausa();
// ---------- cielo: poco estrellado (la contaminación lumínica de Santiago) y el domo de luz de la ciudad ----------
{
  const m = mat(/* glsl */`
  varying vec3 vWP;
  void main(){
    vec3 dir = normalize(vWP - cameraPosition); float y = dir.y;
    vec3 zen = vec3(0.008, 0.012, 0.030), hor = vec3(0.075, 0.095, 0.19);
    vec3 col = mix(hor, zen, smoothstep(-0.02, 0.38, y));
    col += vec3(0.06, 0.075, 0.15) * exp(-max(y, 0.0) * 11.0);            // domo de luz de la ciudad
    vec2 cp = dir.xz / max(y + 0.18, 0.05);
    float cl = fbm(cp*1.1 + vec2(uTime*0.003, 0.0));
    col += vec3(0.045, 0.06, 0.11) * smoothstep(0.55, 0.85, cl) * smoothstep(0.04, 0.3, y);
    vec2 sp = vec2(atan(dir.x, -dir.z), asin(clamp(y, -1.0, 1.0))) * 260.0;
    vec2 cell = floor(sp); vec2 f = fract(sp) - 0.5; float h = hash(cell);
    float star = step(0.993, h) * smoothstep(0.3, 0.0, length(f)) * smoothstep(0.12, 0.4, y);
    star *= 0.6 + 0.4 * sin(uTime*1.7 + h*90.0);
    col += vec3(0.75, 0.80, 1.0) * star * (0.3 + 0.7*fract(h*37.0)) * (1.0 - smoothstep(0.5, 0.75, cl));
    gl_FragColor = vec4(col, 1.0);
  }`, {}, { vs: VS_POS, m: { side: THREE.BackSide, depthWrite: false } });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60000, 48, 24), m); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  sky.onBeforeRender = () => sky.position.copy(camera.position);
}

await pausa();
// ---------- la cordillera real (Terrarium, 400 m) con nieve sobre ~2.950 msnm ----------
{
  const D = DA, g = new THREE.BufferGeometry(); const n = D.nx * D.nz; const pos = new Float32Array(n * 3);
  const cx0 = DC.x0, cx1 = DC.x0 + (DC.nx - 1) * DC.s, cz0 = DC.z0, cz1 = DC.z0 + (DC.nz - 1) * DC.s;
  for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) {
    const x = D.x0 + i * D.s, z = D.z0 + j * D.s; let y = D.h[j * D.nx + i];
    const inn = Math.min(x - cx0, cx1 - x, z - cz0, cz1 - z);                 // dentro de la cuenca detallada: se hunde
    if (inn > 0) y -= 80 * smooth(0, 1200, inn);
    pos.set([x, y, z], (j * D.nx + i) * 3);
  }
  const idx = []; for (let j = 0; j < D.nz - 1; j++) for (let i = 0; i < D.nx - 1; i++) { const a = j * D.nx + i; idx.push(a, a + D.nx, a + 1, a + 1, a + D.nx, a + D.nx + 1); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = mat(/* glsl */`
  varying vec3 vWP; varying vec3 vN;
  void main(){
    vec3 N = normalize(vN); float n = fbm(vWP.xz*0.0016); float n2 = noise(vWP.xz*0.012);
    float snowLine = ${(2950 - HDR.base).toFixed(0)}.0 + 260.0*(n - 0.5);
    float snow = smoothstep(snowLine - 120.0, snowLine + 160.0, vWP.y + 220.0*(N.y - 0.6)) * smoothstep(0.42, 0.8, N.y + 0.25*n2);
    vec3 rock = vec3(0.065, 0.07, 0.09) * (0.7 + 0.6*n2);
    vec3 alb = mix(rock, vec3(0.82, 0.86, 0.95), snow);
    vec3 li = ambient(N)*1.1 + moonL(N)*1.25;
    vec3 col = alb * li;
    // la ladera baja tiene barrios hasta ~1.000 msnm: puntos (con tamaño mínimo) y un resplandor
    float low = smoothstep(${(1050 - HDR.base).toFixed(0)}.0, ${(650 - HDR.base).toFixed(0)}.0, vWP.y) * smoothstep(0.55, 0.8, N.y);
    float fw = length(fwidth(vWP.xz));
    vec2 c = floor(vWP.xz / 70.0); vec2 lp = (c + 0.2 + 0.6*vec2(hash(c), hash(c + 5.1))) * 70.0;
    float wl = max(2.0, fw*0.6);
    float pt = step(0.55, hash(c*1.7)) * exp(-dot(vWP.xz - lp, vWP.xz - lp)/(wl*wl));
    col += vec3(0.72, 0.78, 1.0) * low * (pt*1.2 + 0.05);
    gl_FragColor = vec4(fogged(col, vWP), 1.0);
  }`);
  const mtn = new THREE.Mesh(g, m); mtn.frustumCulled = false; scene.add(mtn);
}

await pausa();
// ---------- la cuenca: relieve real + máscara OSM (alumbrado por clase de calle, Mapocho) ----------
const GROUND_FS = /* glsl */`
  varying vec3 vWP; varying vec3 vN;
  uniform float uHill;
  void main(){
    vec3 N = normalize(vN); vec3 P = vWP; float d = length(cameraPosition - P);
    vec2 uv = muv(P.xz);
    float inside = step(0.0, uv.x)*step(uv.x, 1.0)*step(0.0, uv.y)*step(uv.y, 1.0);
    vec3 m = texture2D(uMask, uv).rgb * inside;
    float urb = textureLod(uMask, uv, 5.0).r * inside;           // densidad de calles en ~400 m = cuánta ciudad hay
    float n = noise(P.xz*0.07)*0.6 + noise(P.xz*0.5)*0.4;
    float slope = 1.0 - N.y;
    float lf = litAt(P);
    // suelo: techos y pavimento oscuros en la ciudad, matorral y roca en los cerros
    float wild = clamp(smoothstep(0.03, 0.12, slope) + uHill, 0.0, 1.0) * (1.0 - m.r);
    vec3 alb = mix(vec3(0.05, 0.055, 0.07), vec3(0.08, 0.085, 0.10), n);
    vec3 rock = mix(vec3(0.07, 0.07, 0.08), vec3(0.17, 0.165, 0.17), smoothstep(0.35, 0.8, n + slope*0.6));
    vec3 brush = vec3(0.035, 0.045, 0.045) * (0.7 + 0.6*n);
    alb = mix(alb, mix(brush, rock, smoothstep(0.25, 0.6, slope + 0.3*uHill)), wild);
    vec3 col = alb * (ambient(N) + moonL(N) + beamAt(P, N));
    // alumbrado: un farol cada ~26 m sobre las calles reales. De lejos siguen siendo puntos (radio mínimo ~1 px, como
    // se ven en una foto nocturna); solo cuando la grilla de faroles es sub-píxel pasa al promedio.
    float fw = length(fwidth(P.xz));
    float sod = step(0.8, hash(floor(P.xz/650.0) + 4.0));            // LED frío en casi toda la ciudad; algunos sectores con sodio
    vec3 lc = mix(vec3(0.74, 0.81, 1.0), vec3(1.0, 0.80, 0.58), sod*0.75);
    vec3 city = vec3(0.0);
    {
      vec2 cell = floor(P.xz / 26.0);
      vec2 lp = (cell + 0.2 + 0.6*vec2(hash(cell), hash(cell + 17.3))) * 26.0;
      float rl = texture2D(uMask, muv(lp)).r * inside;
      float on = step(0.3, rl) * step(hash(cell*1.37 + 3.1), 0.35 + 0.65*lf);
      float wl = max(0.9, fw*0.6);
      float pt = on * exp(-dot(P.xz - lp, P.xz - lp)/(wl*wl)) * (0.55 + 0.6*rl);
      float avgL = m.r * 0.16 * (0.35 + 0.65*lf);
      city += lc * mix(pt * mix(1.6, 1.0, smoothstep(1.0, 6.0, fw)), avgL, smoothstep(9.0, 20.0, fw)) * 2.2;
    }
    city += lc * m.r*m.r * 0.05 * (0.4 + 0.6*lf);                 // pavimento iluminado de las avenidas
    // ventanas de lo bajo (casas y edificios que no están en OSM): puntos en las manzanas, más donde hay más ciudad;
    // dos escalas para que de lejos sigan siendo puntos
    float dens = urb*urb*0.6*lf * (1.0 - m.r) * (1.0 - wild);
    for (int s = 0; s < 2; s++) {
      float cs = s == 0 ? 7.0 : 22.0;
      vec2 c2 = floor(P.xz / cs); vec2 cp = (c2 + 0.25 + 0.5*vec2(hash(c2 + 3.0), hash(c2 + 8.0))) * cs;
      float sw = max(0.45, fw*0.55);
      float on2 = step(1.0 - dens*(s == 0 ? 1.0 : 0.9), hash(c2*0.71 + 9.0 + float(s)*5.0));
      float pk = on2 * exp(-dot(P.xz - cp, P.xz - cp)/(sw*sw));
      float w2 = s == 0 ? 1.0 - smoothstep(1.5, 4.0, fw) : smoothstep(1.5, 4.0, fw) * (1.0 - smoothstep(8.0, 16.0, fw));
      vec3 wc2 = mix(vec3(0.62, 0.70, 1.0), vec3(1.0, 0.88, 0.74), step(0.72, hash(c2 + 1.3)));
      city += wc2 * pk * w2 * 1.1;
    }
    city += mix(vec3(0.62, 0.70, 1.0), vec3(0.9, 0.85, 0.8), 0.3) * dens * 0.05 * smoothstep(8.0, 16.0, fw);
    // cerro Santa Lucía: faroles de los paseos
    { vec2 hc = floor(P.xz/9.0); vec2 hp = (hc + 0.3 + 0.4*vec2(hash(hc + 2.0), hash(hc + 6.0)))*9.0; float hw = max(0.35, fw*0.5);
      city += vec3(0.85, 0.88, 1.0) * uHill * step(0.86, hash(hc)) * exp(-dot(P.xz - hp, P.xz - hp)/(hw*hw)) * smoothstep(4.0, 10.0, P.y) * 1.2; }
    // Mapocho: agua oscura que devuelve el cielo bajo y las luces de las orillas estiradas
    float river = smoothstep(0.3, 0.8, m.g);
    vec3 Vw = normalize(cameraPosition - P);
    float fres = 0.06 + 0.94*pow(1.0 - max(Vw.y, 0.0), 4.0);
    float rip = noise(vec2(P.x*0.2, P.z*0.2 - uTime*0.4));
    float streak = pow(0.5 + 0.5*sin(dot(P.xz, normalize(cameraPosition.xz - P.xz).yx*vec2(1.0,-1.0))*0.9 + rip*3.0), 12.0);
    vec3 water = vec3(0.05, 0.065, 0.13)*fres + vec3(0.62, 0.72, 1.0)*streak*0.35*fres;
    col = mix(col, water, river);
    city *= 1.0 - river;
    float T = fogT(P);
    col = mix(uFogCol, col, T) + city * mix(T, 1.0, 0.25);
    gl_FragColor = vec4(col, 1.0);
  }`;
{
  const D = DC; const n = D.nx * D.nz; const pos = new Float32Array(n * 3);
  // el cerro lleva su propia malla fina: la gruesa se hunde bajo él (bordes alineados a la grilla: sin costuras)
  const gx0 = Math.floor((slBox[0] - 180 - D.x0) / D.s), gx1 = Math.ceil((slBox[2] + 180 - D.x0) / D.s);
  const gz0 = Math.floor((slBox[1] - 180 - D.z0) / D.s), gz1 = Math.ceil((slBox[3] + 180 - D.z0) / D.s);
  for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) {
    let y = D.h[j * D.nx + i]; if (i > gx0 && i < gx1 && j > gz0 && j < gz1) y -= 6;
    pos.set([D.x0 + i * D.s, y, D.z0 + j * D.s], (j * D.nx + i) * 3);
  }
  const idx = []; for (let j = 0; j < D.nz - 1; j++) for (let i = 0; i < D.nx - 1; i++) { const a = j * D.nx + i; idx.push(a, a + D.nx, a + 1, a + 1, a + D.nx, a + D.nx + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const gm = new THREE.Mesh(g, mat(GROUND_FS, { uHill: { value: 0 } })); gm.frustumCulled = false; scene.add(gm);
  await pausa();
  // malla fina del Santa Lucía (5 m)
  const X0 = D.x0 + gx0 * D.s, X1 = D.x0 + gx1 * D.s, Z0 = D.z0 + gz0 * D.s, Z1 = D.z0 + gz1 * D.s, st = 5;
  const nx = Math.round((X1 - X0) / st) + 1, nz = Math.round((Z1 - Z0) / st) + 1;
  const hp = new Float32Array(nx * nz * 3), hh = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + (X1 - X0) * i / (nx - 1), z = Z0 + (Z1 - Z0) * j / (nz - 1);
    const e = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
    const hv = e ? 0 : hillAt(x, z); hh[j * nx + i] = hv;
    hp.set([x, ground(x, z) + hv, z], (j * nx + i) * 3);
  }
  const hidx = []; for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; hidx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setIndex(hidx); hg.computeVertexNormals();
  hg.setAttribute('aHill', new THREE.BufferAttribute(hh, 1));
  const hm = mat(GROUND_FS.replace('uniform float uHill;', 'varying float vHill; float uHill;').replace('void main(){\n    vec3 N', 'void main(){\n    uHill = smoothstep(0.5, 4.0, vHill);\n    vec3 N'), {}, {
    vs: /* glsl */`attribute float aHill; varying vec3 vWP; varying vec3 vN; varying float vHill;
    void main(){ vHill = aHill; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }` });
  scene.add(new THREE.Mesh(hg, hm));
}

await pausa();
// ---------- edificios reales (OSM): una malla fusionada, ventanas procedurales por tipo ----------
const shops = [];
const SHOPS = LOCALES.map((l, i) => ({ id: l.id || 'local' + i, ...l.escena }));
SHOPS.forEach((s) => { s.y = ground(s.x, s.z); });
const BLD_VS = /* glsl */`
attribute vec2 aW; attribute vec4 aB;
varying vec3 vWP; varying vec3 vN; varying vec2 vW; varying vec4 vB;
void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); vW = aW; vB = aB;
  gl_Position = projectionMatrix*viewMatrix*wp; }`;
const BLD_FS = /* glsl */`
varying vec3 vWP; varying vec3 vN; varying vec2 vW; varying vec4 vB;
void main(){
  vec3 N = normalize(vN); vec3 P = vWP; float sd = vB.x, Hh = vB.y, kind = vB.z, top = vB.w;
  vec3 V = normalize(cameraPosition - P);
  float lf = litAt(P);
  float glass = step(0.5, kind) * step(kind, 1.5), other = step(1.5, kind);
  vec3 alb = mix(vec3(0.11, 0.115, 0.135), vec3(0.24, 0.24, 0.27), hash(vec2(sd*91.0, 1.0)));
  alb = mix(alb, vec3(0.05, 0.065, 0.10), glass);
  vec3 light = ambient(N) + moonL(N) + beamAt(P, N);
  vec3 col;
  if (top > 0.5) {
    vec3 ra = alb * (0.55 + 0.4*noise(P.xz*0.4));
    col = ra * light;
    // luces de azotea de las torres (balizas se dibujan aparte)
  } else {
    alb *= mix(0.55, 1.0, smoothstep(0.0, 9.0, vW.y));                    // oclusión al pie
    float fh = mix(mix(2.75, 3.9, glass), 4.2, other);
    float bay = mix(mix(3.3, 1.55, glass), 5.0, other);
    vec2 g = vec2(vW.x / bay + sd*13.0, (vW.y - 0.4) / fh);
    vec2 cell = floor(g); vec2 f = fract(g);
    float ww = mix(mix(0.46, 0.86, glass), 0.4, other), wh = mix(0.52, 0.72, glass);
    float win = step(abs(f.x - 0.5), ww*0.5) * step(abs(f.y - 0.58), wh*0.5);
    float rows = step(1.0, cell.y) * step(vW.y, Hh - 1.4);
    float r = hash(cell + vec2(sd*91.0, sd*17.0));
    float litP = mix(mix(0.30, 0.22, glass), 0.12, other) * (0.3 + 0.9*lf);
    float floorLit = step(0.86, hash(vec2(cell.y, sd*33.0))) * glass;      // pisos de oficina con aseo de noche
    float lit = max(step(1.0 - litP, r), floorLit*step(0.25, r));
    float warm = step(0.72, hash(cell*3.1 + sd)) * (1.0 - glass);
    vec3 wc = mix(vec3(0.74, 0.81, 1.0), vec3(1.0, 0.86, 0.70), warm*0.8) * (0.4 + 0.6*hash(cell*5.7 + sd));
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 glassC = vec3(0.012, 0.018, 0.035) + vec3(0.05, 0.07, 0.15)*fres*(0.6 + 0.8*glass) + beamAt(P, N)*0.05;
    vec3 facade = alb * light;
    vec3 winCol = mix(glassC, wc*1.15, lit);
    vec3 nearC = mix(facade, winCol, win*rows);
    vec3 avg = mix(facade, glassC + wc*litP*2.6, ww*wh*rows);   // de lejos las ventanas se funden en un brillo (como en foto)
    float aa = clamp(1.6 - length(fwidth(g))*2.2, 0.0, 1.0);
    col = mix(avg, nearC, aa);
    // vidrio continuo: las torres de oficina son casi todo vidrio con antepechos
    col = mix(col, mix(glassC + wc*lit*1.5*win, glassC*0.6, step(0.8, f.y)), glass*0.55*aa);
    // primer piso comercial encendido en algunas cuadras
    float gf = step(vW.y, 3.4) * step(0.62, hash(vec2(floor(vW.x/11.0), sd*7.0))) * step(0.4, kind + hash(vec2(sd, 3.0)));
    col += vec3(0.75, 0.82, 1.0) * gf * 0.35 * lf;
    // remate encendido en algunas torres altas
    col += vec3(0.62, 0.72, 1.0) * step(55.0, Hh) * step(0.55, hash(vec2(sd, 9.0))) * smoothstep(Hh - 2.6, Hh - 1.2, vW.y) * 0.9;
  }
  float T = mix(fogT(P), 1.0, 0.3);
  gl_FragColor = vec4(mix(uFogCol, col, T), 1.0);
}`;
const BEACONS = [];
{
  const bN = SEC.bN.a, bH = SEC.bH.a, bMH = SEC.bMH.a, bK = SEC.bK.a, bXY = SEC.bXY.a;
  const nB = bN.length; let total = 0; for (let i = 0; i < nB; i++) total += bN[i];
  const cap = total * 5 + 64;
  const P = new Float32Array(cap * 3), Nn = new Float32Array(cap * 3), W = new Float32Array(cap * 2), B = new Float32Array(cap * 4);
  const idx = []; let v = 0, p = 0;
  const px = new Float64Array(512), pz = new Float64Array(512);
  const blocked = (x, z) => SHOPS.some((s) => Math.hypot(x - s.x, z - s.z) < Math.max(s.w, s.d) * 0.75 + 4);
  const put = (x, y, z, nx, ny, nz, u, w, b) => { P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; Nn[v * 3] = nx; Nn[v * 3 + 1] = ny; Nn[v * 3 + 2] = nz; W[v * 2] = u; W[v * 2 + 1] = w; B.set(b, v * 4); return v++; };
  for (let i = 0; i < nB; i++) {
    const n = bN[i]; let cx = 0, cz = 0, qx = 0, qz = 0;
    for (let k = 0; k < n; k++) { qx += bXY[(p + k) * 2]; qz += bXY[(p + k) * 2 + 1]; px[k] = qx * 0.5; pz[k] = qz * 0.5; cx += px[k]; cz += pz[k]; }
    p += n; cx /= n; cz /= n;
    if (Math.hypot(cx, cz) < 30 || slDist(cx, cz) > -2) continue;                      // nada sobre el cerro (la malla lo taparía)
    let skip = false; for (let k = 0; k < n && !skip; k++) skip = blocked(px[k], pz[k]); if (skip || blocked(cx, cz)) continue;
    let base = 1e9; for (let k = 0; k < n; k++) base = Math.min(base, ground(px[k], pz[k]));
    base -= 0.5;
    const hT = bH[i] / 10, hB = bMH[i] / 10, kind = bK[i] & 3, sd = hash2(i * 0.013, 7.7);
    const y0 = base + hB, y1 = base + hT;
    const bw = [sd, hT, kind, 0], bt = [sd, hT, kind, 1];
    let u = 0;
    for (let k = 0; k < n; k++) {
      const ax = px[k], az = pz[k], bx = px[(k + 1) % n], bz = pz[(k + 1) % n];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const nx = dz / L, nz = -dx / L;
      const a0 = put(ax, y0, az, nx, 0, nz, u, hB, bw), b0 = put(bx, y0, bz, nx, 0, nz, u + L, hB, bw);
      const b1 = put(bx, y1, bz, nx, 0, nz, u + L, hT, bw), a1 = put(ax, y1, az, nx, 0, nz, u, hT, bw);
      idx.push(a0, b1, b0, a0, a1, b1); u += L;
    }
    const contour = []; for (let k = 0; k < n; k++) contour.push(new THREE.Vector2(px[k], pz[k]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const r0 = v; for (let k = 0; k < n; k++) put(px[k], y1, pz[k], 0, 1, 0, px[k], pz[k], bt);
    for (const [a, b, c] of tris) {
      const cr = (pz[b] - pz[a]) * (px[c] - px[a]) - (px[b] - px[a]) * (pz[c] - pz[a]);
      if (cr > 0) idx.push(r0 + a, r0 + b, r0 + c); else idx.push(r0 + a, r0 + c, r0 + b);
    }
    if (hT >= 70) { BEACONS.push(cx, y1 + 1.5, cz); }
    if ((i & 511) === 511) await pausa();
  }
  // los locales de ejemplo: un volumen de dos pisos en la huella que dejaron libre, con el mismo material
  SHOPS.forEach((s, i) => {
    const c = Math.cos(s.rot), sn = Math.sin(s.rot), hw = s.w / 2, hd = s.d / 2;
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [s.x + a * c + b * sn, s.z - a * sn + b * c]);
    const sd = 0.31 + i * 0.17, bw = [sd, s.h, 2, 0], bt = [sd, s.h, 2, 1]; let u = 0;
    // orden antihorario en (x,z): normales hacia afuera
    const A = pts.reduce((acc, [x, z], k) => acc + x * pts[(k + 1) % 4][1] - z * pts[(k + 1) % 4][0], 0); if (A < 0) pts.reverse();
    for (let k = 0; k < 4; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % 4]; const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L;
      const a0 = put(ax, s.y - 0.4, az, nx, 0, nz, u, 0, bw), b0 = put(bx, s.y - 0.4, bz, nx, 0, nz, u + L, 0, bw);
      const b1 = put(bx, s.y + s.h, bz, nx, 0, nz, u + L, s.h, bw), a1 = put(ax, s.y + s.h, az, nx, 0, nz, u, s.h, bw);
      idx.push(a0, b1, b0, a0, a1, b1); u += L;
    }
    const r0 = v; pts.forEach(([x, z]) => put(x, s.y + s.h, z, 0, 1, 0, x, z, bt)); idx.push(r0, r0 + 2, r0 + 1, r0, r0 + 3, r0 + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, v * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn.subarray(0, v * 3), 3));
  g.setAttribute('aW', new THREE.BufferAttribute(W.subarray(0, v * 2), 2));
  g.setAttribute('aB', new THREE.BufferAttribute(B.subarray(0, v * 4), 4));
  g.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  // el triángulo de fijar la caja: aseguramos que los índices de techo apunten a caras hacia arriba
  const bm = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...U }, vertexShader: BLD_VS, fragmentShader: COMMON + BLD_FS }));
  bm.frustumCulled = false; scene.add(bm);
  H.edificios = nB; H.vertEdif = v;
}

await pausa();
// ---------- locales de ejemplo: vitrina, toldo y letrero (sin texto) que se encienden cuando el haz los encuentra ----------
{
  const glassFS = /* glsl */`
  uniform float uFound; varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
  void main(){ vec3 N = normalize(vN);
    float mull = step(0.47, abs(fract(vUv.x*3.0) - 0.5)) + step(vUv.y, 0.05);
    vec3 dark = vec3(0.02, 0.025, 0.045) + beamAt(vWP, N)*0.10 + vec3(0.25, 0.3, 0.45)*0.12;
    vec3 litc = mix(vec3(0.72, 0.79, 1.0), vec3(0.95, 0.96, 1.0), smoothstep(0.0, 0.8, vUv.y)) * 1.25;
    vec3 col = mix(dark, litc, uFound);
    col = mix(col, vec3(0.05, 0.06, 0.09), clamp(mull, 0.0, 1.0)*0.85);
    gl_FragColor = vec4(fogged(col, vWP), 1.0); }`;
  const signFS = /* glsl */`
  uniform float uFound; varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN);
    vec3 col = vec3(0.05, 0.06, 0.09)*(ambient(N) + moonL(N) + beamAt(vWP, N)) + vec3(0.30, 0.40, 1.0)*(0.25 + uFound*1.3);
    gl_FragColor = vec4(fogged(col, vWP), 1.0); }`;
  const UV_VS = /* glsl */`varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
  void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }`;
  SHOPS.forEach((s, i) => {
    const grp = new THREE.Group(); grp.position.set(s.x, s.y, s.z); grp.rotation.y = s.rot; scene.add(grp);
    const uFound = { value: 0 };
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.8, 2.8), mat(glassFS, { uFound }, { vs: UV_VS })); glass.position.set(0, 1.6, s.d / 2 + 0.05); grp.add(glass);
    const aw = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.9, 0.14, 1.7), mat(plainFS('0.10, 0.13, 0.24'))); aw.position.set(0, 3.35, s.d / 2 + 0.8); aw.rotation.x = 0.3; grp.add(aw);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.66, 0.75, 0.16), mat(signFS, { uFound })); sign.position.set(0, 4.3, s.d / 2 + 0.12); grp.add(sign);
    grp.updateMatrixWorld(true);
    const pin = new THREE.Vector3(0, s.h + 5, 0).applyMatrix4(grp.matrixWorld);
    const aim = new THREE.Vector3(0, 2.6, s.d / 2).applyMatrix4(grp.matrixWorld);
    const out = new THREE.Vector3(Math.sin(s.rot), 0, Math.cos(s.rot));
    const glow = sprite(0xa8b6ff, 26); glow.position.copy(aim).addScaledVector(out, 2).add(new THREE.Vector3(0, 0.6, 0)); glow.material.opacity = 0; scene.add(glow);
    shops.push({ ...s, uFound, pin, aim, out, glow, top: s.y + s.h, found: 0 });
  });
}

await pausa();
// ---------- tráfico sobre las vías reales (autopistas, troncales, principales y secundarias) ----------
{
  const tN = SEC.tN.a, tK = SEC.tK.a, tXY = SEC.tXY.a;
  const pos = [], aS = [], aT = [], aC = [];
  let p = 0;
  for (let i = 0; i < tN.length; i++) {
    const n = tN[i], c = tK[i] & 15, ow = (tK[i] & 16) > 0; const xs = [], zs = []; let qx = 0, qz = 0;
    for (let k = 0; k < n; k++) { qx += tXY[(p + k) * 2]; qz += tXY[(p + k) * 2 + 1]; xs.push(qx * 0.5); zs.push(qz * 0.5); }
    p += n;
    const lanes = ow ? [[c === 0 ? 2.5 : 0, 1]] : [[3.2, 1], [-3.2, -1]];
    const sdv = hash2(i * 0.37, 2.1);
    for (const [off, dir] of lanes) {
      let s = 0;
      for (let k = 0; k < n - 1; k++) {
        const dx = xs[k + 1] - xs[k], dz = zs[k + 1] - zs[k], L = Math.hypot(dx, dz); if (L < 0.5) continue;
        const tx = dx / L, tz = dz / L, ox = -tz * off * dir, oz = tx * off * dir;   // circulación por la derecha
        const ax = xs[k] + ox, az = zs[k] + oz, bx = xs[k + 1] + ox, bz = zs[k + 1] + oz;
        pos.push(ax, ground(ax, az) + 1.1, az, bx, ground(bx, bz) + 1.1, bz);
        aS.push(s * dir, (s + L) * dir); aT.push(tx * dir, tz * dir, tx * dir, tz * dir); aC.push(c, sdv, c, sdv); s += L;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 2));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 2));
  const m = new THREE.ShaderMaterial({ uniforms: { ...U }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`attribute float aS; attribute vec2 aT; attribute vec2 aC; varying float vS; varying vec2 vT; varying vec2 vC; varying vec3 vWP;
      void main(){ vS = aS; vT = aT; vC = aC; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: COMMON + /* glsl */`varying float vS; varying vec2 vT; varying vec2 vC; varying vec3 vWP;
      void main(){
        float c = vC.x; float spd = mix(21.0, 10.0, clamp(c/2.0, 0.0, 1.0)); float sp = mix(34.0, 62.0, clamp(c/2.0, 0.0, 1.0));
        float ph = (vS - uTime*spd)/sp + vC.y*17.0; float f = fract(ph);
        float ex = step(0.3 + 0.25*clamp(c/2.0,0.0,1.0), hash(vec2(floor(ph), vC.y*13.0)));
        float car = smoothstep(0.0, 0.03, f) * smoothstep(0.16, 0.11, f) * ex;
        float fw = fwidth(ph);
        float a = mix(car, 0.1*0.6, smoothstep(0.08, 0.5, fw));
        vec2 toC = cameraPosition.xz - vWP.xz;
        float head = step(0.0, dot(vT, toC));
        vec3 col = mix(vec3(1.0, 0.16, 0.12)*0.9, vec3(0.92, 0.95, 1.0)*1.5, head);
        gl_FragColor = vec4(col * a * mix(fogT(vWP), 1.0, 0.2) * (0.4 + 0.6*litAt(vWP)), 1.0);
      }` });
  const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false; lines.renderOrder = 2; scene.add(lines);
  H.trafico = pos.length / 6;
}

await pausa();
// ---------- balizas rojas de las torres (> 70 m) ----------
{
  const t = HDR.torre; BEACONS.push(t.x, ground(t.x, t.z) + 302, t.z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(BEACONS, 3));
  const m = new THREE.ShaderMaterial({ uniforms: { ...U }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`varying float vP; varying vec3 vWP; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vec4 mv = viewMatrix*wp;
      vP = fract(sin(dot(position.xz, vec2(12.9898, 78.233)))*43758.5453); gl_PointSize = clamp(2600.0 / -mv.z, 2.0, 7.0); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: COMMON + /* glsl */`varying float vP; varying vec3 vWP;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c));
        float blink = smoothstep(0.55, 0.75, sin(uTime*3.0 + vP*6.28)) ;
        gl_FragColor = vec4(vec3(1.0, 0.12, 0.1) * a * (0.15 + 0.85*blink) * 1.4 * mix(fogT(vWP), 1.0, 0.3), 1.0); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
}

await pausa();
// ---------- Gran Torre Costanera: planta real (OSM), cuadrado de esquinas redondeadas que se ahúsa, corona abierta ----------
{
  const HT = 262, R0 = TORRE.hw, R1 = TORRE.hw * 0.72;
  const sq = (g, rTop, rBot, hh) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
      const k = Math.pow(Math.pow(Math.abs(Math.cos(a)), 5) + Math.pow(Math.abs(Math.sin(a)), 5), -1 / 5);
      const r = lerp(rBot, rTop, (y + hh / 2) / hh) * k; p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
    }
    g.computeVertexNormals(); return g;
  };
  const body = sq(new THREE.CylinderGeometry(1, 1, HT, 64, 1, true), R1, R0, HT); body.translate(0, HT / 2, 0);
  const y0 = ground(TORRE.x, TORRE.z) - 1;
  const fs = /* glsl */`
  uniform vec3 uC; uniform float uHT; varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN);
    float y = vWP.y - uC.y; float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float floorF = fract(y / 4.1); float col_ = fract(a * 60.0 / 6.2832);
    float band = smoothstep(0.0, 0.1, floorF) * smoothstep(0.7, 0.6, floorF);
    float mull = smoothstep(0.04, 0.12, col_) * smoothstep(0.96, 0.88, col_);
    float fl = floor(y / 4.1); float r = hash(vec2(fl, floor(a*60.0/6.2832)));
    float floorLit = step(0.8, hash(vec2(fl, 3.0)));
    float lit = max(step(0.74, r), floorLit*step(0.2, r)) * band * mull;
    vec3 V = normalize(cameraPosition - vWP);
    vec3 glass = vec3(0.02, 0.03, 0.06) + vec3(0.07, 0.10, 0.22)*pow(1.0 - abs(dot(N, V)), 2.0);
    vec3 wc = mix(vec3(0.62, 0.70, 1.0), vec3(0.88, 0.91, 1.0), hash(vec2(fl*1.3, 2.0))) * (0.5 + 0.5*hash(vec2(fl, 7.0)));
    float fw = fwidth(y / 4.1);
    float aa = clamp(1.5 - fw*2.5, 0.0, 1.0);
    vec3 c = glass * (ambient(N) + moonL(N)*1.4) * 2.0 + wc * mix(0.22*0.6, lit, aa) * 1.1;
    c += beamAt(vWP, N)*0.05;
    gl_FragColor = vec4(fogged(c, vWP), 1.0); }`;
  const m = mat(fs, { uC: { value: new THREE.Vector3(TORRE.x, y0, TORRE.z) }, uHT: { value: HT } }, { m: { side: THREE.DoubleSide } });
  const tw = new THREE.Mesh(body, m); tw.position.set(TORRE.x, y0, TORRE.z); tw.rotation.y = -TORRE.ang; scene.add(tw);
  const crown = sq(new THREE.CylinderGeometry(1, 1, 38, 64, 1, true), R1 * 0.78, R1, 38); crown.translate(0, HT + 19, 0);
  const cm = mat(/* glsl */`
  uniform vec3 uC; uniform float uHT; varying vec3 vWP; varying vec3 vN;
  void main(){ float y = vWP.y - uC.y - uHT; float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float bars = smoothstep(0.86, 0.96, abs(sin(a*14.0 + y*0.16))) + smoothstep(0.9, 0.97, abs(sin(a*14.0 - y*0.16)));
    float rim = smoothstep(35.0, 38.0, y) + smoothstep(2.0, 0.0, y);
    float v = clamp(bars + rim, 0.0, 1.0);
    if (v < 0.1) discard;
    vec3 c = mix(vec3(0.42, 0.52, 1.0), vec3(0.82, 0.87, 1.0), smoothstep(38.0, 8.0, y)) * (0.5 + 0.5*v);
    gl_FragColor = vec4(fogged(c, vWP), 1.0); }`, { uC: { value: new THREE.Vector3(TORRE.x, y0, TORRE.z) }, uHT: { value: HT } }, { m: { side: THREE.DoubleSide } });
  const cr = new THREE.Mesh(crown, cm); cr.position.copy(tw.position); cr.rotation.y = tw.rotation.y; scene.add(cr);
  const cg = sprite(0x7d92ff, 150); cg.position.set(TORRE.x, y0 + HT + 20, TORRE.z); cg.material.opacity = 0.22; scene.add(cg);
}

await pausa();
// ---------- Cerro San Cristóbal: la Virgen iluminada en la cumbre (coordenadas reales) ----------
{
  const S = 1.6;
  const vg = new THREE.Group(); vg.position.set(SANCRIS.x, SANCRIS.y - 1, SANCRIS.z); scene.add(vg);
  const white = mat(/* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWP);
    vec3 c = vec3(0.86, 0.89, 1.0) * (0.75 + 0.35*max(dot(N, V), 0.0)) + vec3(0.25, 0.32, 0.8)*0.2;
    gl_FragColor = vec4(mix(uFogCol, c, mix(fogT(vWP), 1.0, 0.4)), 1.0); }`);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * S, 2.6 * S, 6 * S, 8), mat(plainFS('0.42, 0.45, 0.55', 1.6))); ped.position.y = 3 * S; vg.add(ped);
  const robe = [[0, 0], [1.6, 0], [1.45, 1.4], [1.15, 4.8], [1.0, 7.2], [0.75, 8.6], [0.55, 9.2], [0, 9.3]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
  const fig = new THREE.Mesh(new THREE.LatheGeometry(robe, 18), white); fig.position.y = 6 * S; vg.add(fig);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62 * S, 14, 10), white); head.position.y = (6 + 9.9) * S; vg.add(head);
  [-1, 1].forEach((sgn) => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * S, 0.34 * S, 3.4 * S, 6), white);
    arm.position.set(sgn * 1.75 * S, (6 + 7.0) * S, 0.3 * S); arm.rotation.z = sgn * 1.0; vg.add(arm); });
  const halo = sprite(0xdfe6ff, 120); halo.position.set(SANCRIS.x, SANCRIS.y + 14 * S, SANCRIS.z); halo.material.opacity = 0.4; scene.add(halo);
  const core = sprite(0xffffff, 36); core.position.set(SANCRIS.x, SANCRIS.y + 12 * S, SANCRIS.z); core.material.opacity = 0.35; scene.add(core);
}

await pausa();
// ---------- el faro (ficticio) en la cumbre del Santa Lucía ----------
const lh = new THREE.Group(); lh.position.set(LH.x, LH.y, LH.z); lh.scale.setScalar(FARO_S); scene.add(lh);
{
  const uS = { value: FARO_S };
  const prof = [[2.7, -0.6], [2.7, 0.8], [2.35, 0.95], [1.78, 1.0], [1.66, 4], [1.5, 8], [1.34, 11.6], [1.36, 11.7], [1.86, 11.95], [1.95, 12.2], [1.95, 12.42], [1.05, 12.45], [1.05, 13.1], [0, 13.1]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), mat(/* glsl */`
  uniform vec3 uC; uniform float uS; varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN);
    float y = (vWP.y - uC.y)/uS; float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float band = step(4.6, y)*step(y, 6.3) + step(8.5, y)*step(y, 10.2);
    vec3 alb = mix(vec3(0.86, 0.88, 0.92), vec3(0.10, 0.14, 0.27), band);
    alb = mix(alb, vec3(0.08, 0.10, 0.16), step(11.62, y));
    alb = mix(alb, vec3(0.30, 0.31, 0.35), step(y, 0.97));
    alb *= 0.84 + 0.16*noise(vec2(a*14.0, y*0.35));
    alb *= mix(0.55, 1.0, smoothstep(-0.4, 2.6, y));
    vec3 col = alb*(ambient(N)*1.4 + moonL(N)*1.15 + beamAt(vWP, N)*0.6);
    col += alb*vec3(0.45, 0.53, 1.0)*smoothstep(8.5, 11.6, y)*0.08;
    vec3 V = normalize(cameraPosition - vWP); col += vec3(0.05, 0.07, 0.15)*pow(1.0 - max(dot(N, V), 0.0), 3.0);
    gl_FragColor = vec4(fogged(col, vWP), 1.0); }`, { uC: { value: new THREE.Vector3(LH.x, LH.y, LH.z) }, uS }));
  lh.add(tower);
  const dark = mat(/* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN);
    vec3 col = vec3(0.03, 0.035, 0.06)*(ambient(N) + moonL(N)) + beamAt(vWP, N)*0.02; gl_FragColor = vec4(fogged(col, vWP), 1.0); }`);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.035, 6, 64), dark); rail.rotation.x = Math.PI / 2; rail.position.y = 13.25; lh.add(rail);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5), dark, 28);
  const o = new THREE.Object3D();
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; o.position.set(Math.cos(a) * 1.92, 12.85, Math.sin(a) * 1.92); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
  lh.add(posts);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 1.75, 48, 1, true), mat(/* glsl */`
  uniform vec3 uC; uniform float uY0, uS; varying vec3 vWP; varying vec3 vN;
  void main(){ float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float mull = smoothstep(0.93, 0.985, abs(cos(a*5.0)));
    float bar = step(fract((vWP.y - uY0)/(0.875*uS)), 0.07);
    vec3 r = normalize(vec3(vWP.x - uC.x, 0.0, vWP.z - uC.z));
    float face = pow(max(dot(r, normalize(vec3(uBeamDir.x, 0.0, uBeamDir.z))), 0.0), 3.0);
    float lens = 0.75 + 0.25*sin((vWP.y - uY0)/uS*34.0);
    vec3 col = vec3(0.55, 0.64, 1.0)*(0.55 + 1.9*face)*lens;
    col = mix(col, vec3(0.03, 0.04, 0.07), max(mull, bar)*0.92);
    gl_FragColor = vec4(col, 1.0); }`, { uC: { value: new THREE.Vector3(LH.x, 0, LH.z) }, uY0: { value: LH.y + 13.1 * FARO_S }, uS }, { m: { side: THREE.DoubleSide } }));
  glass.position.y = 13.1 + 0.875; lh.add(glass);
  const domeP = [[1.16, 0], [1.08, 0.18], [0.82, 0.62], [0.42, 0.95], [0.16, 1.08], [0, 1.1]].map(([r, y]) => new THREE.Vector2(r, y));
  const metal = mat(/* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWP);
    vec3 col = vec3(0.10, 0.13, 0.22)*(ambient(N)*1.5 + moonL(N)) + vec3(0.25, 0.3, 0.5)*pow(max(dot(reflect(-uMoonDir, N), V), 0.0), 18.0)*0.5;
    col += vec3(0.4, 0.5, 1.0)*0.05; gl_FragColor = vec4(fogged(col, vWP), 1.0); }`);
  const dome = new THREE.Mesh(new THREE.LatheGeometry(domeP, 48), metal); dome.position.y = 14.85; lh.add(dome);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), metal); ball.position.y = 16.05; lh.add(ball);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), metal); rod.position.y = 16.7; lh.add(rod);
  // plataforma de piedra (la terraza de la cumbre)
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.6, 24), mat(plainFS('0.24, 0.24, 0.27', 1.3))); plat.position.y = -0.5; lh.add(plat);
}

await pausa();
// ---------- haz volumétrico analítico ----------
const beamPivot = new THREE.Group(); beamPivot.position.copy(U.uLens.value); scene.add(beamPivot);
function beamMesh(len, r0, r1, k, sgn = 1) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 48, 1, true); g.translate(0, len / 2, 0);
  const m = new THREE.ShaderMaterial({ uniforms: { ...U, uLen: { value: len }, uK: { value: k }, uR0: { value: r0 }, uR1: { value: r1 }, uSgn: { value: sgn } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: VS_POS,
    fragmentShader: COMMON + /* glsl */`uniform float uK, uLen, uR0, uR1, uSgn; varying vec3 vWP;
    void main(){
      vec3 A = normalize(uBeamDir) * uSgn; vec3 ro = cameraPosition; vec3 seg = vWP - ro; float smax = length(seg); vec3 rd = seg / smax;
      vec3 w0 = ro - uLens; float b = dot(rd, A), dd = dot(rd, w0), e = dot(A, w0); float den = max(1.0 - b*b, 1e-4);
      float sc = clamp((b*e - dd) / den, 0.0, smax);
      float t = clamp(dot(ro + rd*sc - uLens, A), 0.0, uLen);
      float dist = length(ro + rd*sc - (uLens + A*t));
      float r = mix(uR0, uR1, t / uLen);
      float core = exp(-pow(dist / (r*0.62), 2.0));
      float sinA = sqrt(den); float path = clamp(0.35 / max(sinA, 0.08), 1.0, 3.2);
      float along = smoothstep(0.0, 0.05, t/uLen) * exp(-t/uLen*2.2) * smoothstep(1.0, 0.6, t/uLen);
      vec3 pw = ro + rd*sc;
      float dust = 0.6 + 0.4*noise(pw.xz*0.006 + vec2(uTime*0.05, pw.y*0.005 - uTime*0.035));
      float a = core*along*dust*path*uK*uBeamI;
      gl_FragColor = vec4(mix(BEAM, vec3(0.86, 0.9, 1.0), clamp(a*0.9, 0.0, 0.65))*a, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
}
beamPivot.add(beamMesh(2600, 2.2, 150, 0.42));
beamPivot.add(beamMesh(2000, 1.0, 52, 0.5));
const back = new THREE.Group(); back.add(beamMesh(600, 1.2, 30, 0.12, -1)); back.rotation.x = Math.PI; beamPivot.add(back);

// ---------- brillos aditivos (sprites) ----------
function sprite(color, size, tex) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(c);
    const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 32; const y = c2.getContext('2d');
    const g2 = y.createLinearGradient(0, 0, 256, 0); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    y.fillStyle = g2; y.fillRect(0, 0, 256, 32);
    const g3 = y.createLinearGradient(0, 0, 0, 32); g3.addColorStop(0, 'rgba(0,0,0,1)'); g3.addColorStop(0.5, 'rgba(0,0,0,0)'); g3.addColorStop(1, 'rgba(0,0,0,1)');
    y.globalCompositeOperation = 'destination-out'; y.fillStyle = g3; y.fillRect(0, 0, 256, 32);
    streakTex = new THREE.CanvasTexture(c2);
  }
  const m = new THREE.SpriteMaterial({ map: tex === 'streak' ? streakTex : glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m); s.scale.set(size, tex === 'streak' ? size / 8 : size, 1); return s;
}
const lensGlow = sprite(0xb4c0ff, 9 * FARO_S); lensGlow.position.copy(U.uLens.value); scene.add(lensGlow);
const lensCore = sprite(0xe8ecff, 2.6 * FARO_S); lensCore.position.copy(U.uLens.value); scene.add(lensCore);
const flare = sprite(0x9aaaff, 60, 'streak'); flare.position.copy(U.uLens.value); scene.add(flare);
const flareHalo = sprite(0x7d8fff, 40); flareHalo.position.copy(U.uLens.value); scene.add(flareHalo);

await pausa();
// ---------- estaciones (una por capítulo del scroll) ----------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const L = U.uLens.value;
const CAMK = {
  // vista clásica desde el poniente del Santa Lucía: San Cristóbal a la izquierda, Providencia y la Costanera al centro, la cordillera detrás
  heroe: { pos: V3(-260, 170, 300), tgt: V3(2600, -60, -2600), fov: 24, hfov: 46 },
  servicios: { pos: V3(-380, 420, 820), tgt: V3(1500, 0, -1500), fov: 36, hfov: 60 },
  cumbre: { pos: V3(L.x - 70, L.y + 24, L.z + 70), tgt: V3(TORRE.x, 140, TORRE.z), fov: 34, hfov: 56 },
};
shops.forEach((s, i) => {
  // por sobre el hombro del faro: el faro abajo en primer plano, el haz cruzando y el local al final, de frente
  const dx = s.aim.x - L.x, dz = s.aim.z - L.z, dd = Math.hypot(dx, dz), ux = dx / dd, uz = dz / dd, side = s.lado || 1;
  if (s.camara === 'frente') {
    // la vitrina mira lejos del cerro: cámara baja delante de ella (en la calle/parque), con el cerro y el faro detrás
    const px = s.out.z * side, pz = -s.out.x * side;
    CAMK['local' + i] = { pos: V3(s.x + s.out.x * 200 + px * 40, s.y + 55, s.z + s.out.z * 200 + pz * 40), tgt: V3(lerp(s.x, L.x, 0.12), s.y + 20, lerp(s.z, L.z, 0.12)), fov: 26, hfov: 44 };
  } else CAMK['local' + i] = { pos: V3(L.x - ux * 70 - uz * 30 * side, L.y + 30, L.z - uz * 70 + ux * 30 * side), tgt: V3(s.x, s.y + 4, s.z), fov: 11, hfov: 21 };
});
CAMK.locales = { pos: V3(-420, 300, 300), tgt: V3(60, 0, -360), fov: 34, hfov: 50 };
if (q.has('cam')) { const v = q.get('cam').split(',').map(Number); CAMK.dbg = { pos: V3(v[0], v[1], v[2]), tgt: V3(v[3], v[4], v[5]), fov: v[6] || 30, hfov: 0 }; }
const azOf = (x, z) => Math.atan2(z - L.z, x - L.x);
const AZ_TORRE = azOf(TORRE.x, TORRE.z), AZ_SC = azOf(SANCRIS.x, SANCRIS.z);
const ST = {
  heroe: { cam: 'heroe', beam: 'auto', lit: [0.62, 0.62] },
  servicios: { cam: 'servicios', beam: { sweep: [AZ_TORRE + 0.7, AZ_SC - 0.5] }, lit: [0.5, 1] },
  'local-0': { cam: 'local0', beam: { aim: 0 }, lit: [1, 1], foco: 0, bi: 0.55 },
  'local-1': { cam: 'local1', beam: { aim: 1 }, lit: [1, 1], foco: 1, bi: 0.55 },
  'local-2': { cam: 'local2', beam: { aim: 2 }, lit: [1, 1], foco: 2, bi: 0.55 },
  cumbre: { cam: 'cumbre', beam: 'auto', lit: [1, 1] },
  locales: { cam: 'locales', beam: { aim: 1 }, lit: [1, 1], foco: 9 },
  cartel: { cam: 'heroe', beam: 'auto', lit: [0.95, 0.95], foco: 9, azPoster: AZ_TORRE + 0.5 },
};
if (CAMK.dbg) ST.dbg = { cam: 'dbg', beam: q.has('az') ? { sweep: [+q.get('az'), +q.get('az')] } : 'auto', lit: [1, 1], foco: q.has('foco') ? +q.get('foco') : -1 };
const IDS = (window.__f3 && window.__f3.ids) || ['heroe'];
const BEAM_EL = -0.05, BEAM_SPEED = +(q.get('vel') || 0.14);
let vw = 1, vh = 1, time = 12, dirty = true, warm = 2;
const rtMain = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: SMALL ? 0 : 4 });
const composer = new EffectComposer(renderer, rtMain);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.5, 0.45, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const paint = () => { bloom.enabled = BLOOM; composer.render(); };
function measure() {
  vw = box.clientWidth || 1; vh = box.clientHeight || 1;
  renderer.setPixelRatio(DPR); renderer.setSize(vw, vh, false);
  composer.setPixelRatio(DPR); composer.setSize(vw, vh);
  camera.aspect = vw / vh; camera.updateProjectionMatrix(); H.dpr = DPR; dirty = true;
}
// fov vertical que garantiza el ancho de vista pedido (hfov) en ventanas angostas (móvil 4:5)
const fovFor = (k, aspect) => Math.min(64, Math.max(k.fov, k.hfov ? 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(k.hfov) / 2) / aspect) * 180 / Math.PI : 0));
const tmp = new THREE.Vector3(), toCam = new THREE.Vector3();
const dirFromAz = (az, el, out) => out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
function stState(id, u, out) {
  const st = ST[id] || ST.heroe, k = CAMK[st.cam];
  out.pos.copy(k.pos); out.tgt.copy(k.tgt); out.fov = fovFor(k, camera.aspect);
  out.pos.lerp(k.tgt, 0.05 * u);                 // deriva lenta dentro del capítulo
  const b = st.beam;
  if (b === 'auto') dirFromAz((POSTER || CAP) ? (st.azPoster || AZ_TORRE) : AZ_TORRE + 0.9 - time * (st.vel || BEAM_SPEED), BEAM_EL, out.dir);
  else if (b.sweep) dirFromAz(lerp(b.sweep[0], b.sweep[1], smooth(0, 1, u)), BEAM_EL, out.dir);
  else { const s = shops[b.aim]; out.dir.copy(s.aim).sub(L); out.dir.normalize(); const sw = 0.012; out.dir.x += Math.sin(time * 0.9) * sw; out.dir.z += Math.cos(time * 0.7) * sw; out.dir.normalize(); }
  out.lit = lerp(st.lit[0], st.lit[1], u); out.bi = st.bi || 1;
  for (let i = 0; i < 3; i++) out.found[i] = st.foco === i || st.foco === 9 ? 1 : 0;
  out.auto = b === 'auto' ? 1 : 0;
  return out;
}
const mk = () => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), dir: new THREE.Vector3(), fov: 30, lit: 1, bi: 1, found: [0, 0, 0], auto: 0 });
const SA = mk(), SB = mk(), S = mk();
// la ficha abierta corre el centro de la vista (setViewOffset) para que el local no quede debajo del panel
const OFF = { x: 0, y: 0 };
let last = '';
function update(dt) {
  let id = POSTER || (CAMK.dbg ? 'dbg' : null), w = 0, u = 1, nid = null;
  if (!id && window.__f3 && window.__f3.pintar) window.__f3.pintar();
  if (!id) { const r = window.__f3 ? window.__f3.estado() : { i: 0, w: 0, u: 0 }; id = IDS[r.i]; nid = IDS[r.i + 1]; w = nid ? r.w : 0; u = r.u; }
  else u = POSTER === 'servicios' ? 0.7 : 0.5;
  if (CAP && ST[id] && ST[id].beam === 'auto') time = 12;
  stState(id, u, SA);
  if (w > 0) {
    stState(nid, 0, SB);
    const lift = Math.min(SA.pos.distanceTo(SB.pos) * 0.14, 160) * Math.sin(Math.PI * w);
    S.pos.copy(SA.pos).lerp(SB.pos, w); S.pos.y += lift; S.tgt.copy(SA.tgt).lerp(SB.tgt, w); S.fov = lerp(SA.fov, SB.fov, w);
    S.dir.copy(SA.dir).lerp(SB.dir, w).normalize(); S.lit = lerp(SA.lit, SB.lit, w); S.bi = lerp(SA.bi, SB.bi, w);
    for (let i = 0; i < 3; i++) S.found[i] = lerp(SA.found[i], SB.found[i], w);
    S.auto = w < 1 ? Math.max(SA.auto, SB.auto) : SB.auto;
  } else { S.pos.copy(SA.pos); S.tgt.copy(SA.tgt); S.fov = SA.fov; S.dir.copy(SA.dir); S.lit = SA.lit; S.bi = SA.bi; S.found = SA.found.slice(); S.auto = SA.auto; }
  // ficha abierta: si el local queda bajo el panel, se corre la vista lo justo (setViewOffset) para dejarlo a la vista
  const pan = window.__f3 && window.__f3.panel; const want = { x: 0, y: 0 };
  if (pan && shops[pan.i]) {
    camera.position.copy(S.pos); camera.fov = S.fov; camera.clearViewOffset(); camera.updateProjectionMatrix(); camera.lookAt(S.tgt); camera.updateMatrixWorld();
    tmp.copy(shops[pan.i].pin).project(camera); const px = (tmp.x * 0.5 + 0.5) * vw, py = (-tmp.y * 0.5 + 0.5) * vh;
    if (pan.x) want.x = clamp(pan.x + 90 - px, 0, Math.max(0, vw - 70 - px));
    if (pan.y) want.y = clamp(pan.y - 60 - py, -vh * 0.6, 0);
  }
  const kOff = POSTER ? 1 : 1 - Math.exp(-dt * 6);
  OFF.x += (want.x - OFF.x) * kOff; OFF.y += (want.y - OFF.y) * kOff;
  if (Math.abs(want.x - OFF.x) < 0.3) OFF.x = want.x; if (Math.abs(want.y - OFF.y) < 0.3) OFF.y = want.y;
  const moving = !CAP && !POSTER && !CAMK.dbg;
  const key = [S.pos.x, S.pos.y, S.pos.z, S.tgt.x, S.tgt.z, S.fov, S.dir.x, S.dir.y, S.dir.z, S.lit, OFF.x, OFF.y].map((x) => x.toFixed(3)).join();
  if (key === last && !moving && !dirty && warm <= 0) return false;
  last = key; dirty = false; if (warm > 0) warm--;
  if (moving) time += dt;
  U.uTime.value = time;
  camera.position.copy(S.pos); camera.fov = S.fov;
  if (OFF.x || OFF.y) camera.setViewOffset(vw, vh, -OFF.x, -OFF.y, vw, vh); else camera.clearViewOffset();
  camera.updateProjectionMatrix(); camera.lookAt(S.tgt);
  U.uBeamDir.value.copy(S.dir); U.uLit.value = S.lit; U.uBeamI.value = S.bi;
  beamPivot.quaternion.setFromUnitVectors(tmp.set(0, 1, 0), S.dir);
  const lens = U.uLens.value, dir = S.dir;
  toCam.copy(camera.position).sub(lens).normalize();
  const f = Math.max(0, dir.x * toCam.x + dir.z * toCam.z) / Math.max(1e-3, Math.hypot(dir.x, dir.z) * Math.hypot(toCam.x, toCam.z));
  const fl = smooth(0.93, 1.0, f), dc = camera.position.distanceTo(lens), near = smooth(30 * FARO_S, 12 * FARO_S, dc);
  flare.material.opacity = fl * 0.32 * (1 - near); flareHalo.material.opacity = fl * 0.22 * (1 - near); lensGlow.material.opacity = (0.6 + fl * 0.15) * (1 - near * 0.7);
  flare.scale.set(dc * 0.5, dc * 0.025, 1); flareHalo.scale.setScalar(dc * (0.12 + fl * 0.1));
  lensGlow.scale.setScalar(Math.max(9 * FARO_S, dc * 0.03)); lensCore.scale.setScalar(Math.max(2.6 * FARO_S, dc * 0.008));
  shops.forEach((s, i) => { const on = S.found[i]; s.uFound.value = on; s.glow.material.opacity = on * 0.6; });
  return true;
}
// pines HTML (botones que abren la ficha) proyectados desde el 3D
const pinEls = [...box.querySelectorAll('.pin')];
function pins() {
  camera.updateMatrixWorld();
  return shops.map((s, i) => { tmp.copy(s.pin).project(camera); const x = tmp.x * 0.5 + 0.5, y = -tmp.y * 0.5 + 0.5;
    if (pinEls[i] && !POSTER) { pinEls[i].style.transform = `translate(${(x * vw).toFixed(1)}px, ${(y * vh).toFixed(1)}px)`; pinEls[i].style.setProperty('--on', S.found[i].toFixed(3)); }
    return { id: s.id, x: +(x * 100).toFixed(2), y: +(y * 100).toFixed(2) }; });
}

await pausa();
// ---------- bucle con presupuesto ----------
let raf = 0, inView = true, visible = !document.hidden, lost = false, tPrev = 0, stopped = false, drewPrev = false;
const ft = []; let guardStage = 0, gT0 = 0;
function frameFn(now) {
  raf = requestAnimationFrame(frameFn);
  const dt = tPrev ? Math.min((now - tPrev) / 1000, 1 / 15) : 1 / 60; const raw = tPrev ? now - tPrev : 16.7; tPrev = now;
  const drew = update(dt);
  if (drew) { paint(); pins(); H.frames++; }
  if (H.frames >= 2 && H.modo !== 'vivo') { H.modo = 'vivo'; box.dataset.haz = 'vivo'; window.dispatchEvent(new Event('f3:vivo')); }
  if (!CAP && guardStage < 2 && drew && drewPrev) {
    if (!gT0) gT0 = now;
    if (now - gT0 > 600) ft.push(raw);
    if (now - gT0 > 600 + 1200 && ft.length >= 6) {
      const m = ft.slice().sort((a, b) => a - b)[ft.length >> 1]; ft.length = 0; gT0 = now - 600; H.mediana = m;
      if (guardStage === 0 && m > 25) { BLOOM = false; if (DPR > 1) DPR = 1; measure(); H.motivo = 'sin-bloom-dpr-1'; guardStage = 1; }
      else if (guardStage === 1 && m > 34) toPoster('lento');
      else guardStage = 2;
    }
  }
  drewPrev = drew;
}
function setRun() {
  const go = inView && visible && !lost && !stopped;
  if (go && !raf) { tPrev = 0; gT0 = 0; ft.length = 0; dirty = true; raf = requestAnimationFrame(frameFn); }
  else if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
  H.corriendo = !!raf;
}
function stop() { stopped = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
new IntersectionObserver(([e]) => { inView = e.isIntersecting; setRun(); }).observe(box);
document.addEventListener('visibilitychange', () => { visible = !document.hidden; setRun(); });
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; H.perdidas++; H.modo = 'perdido'; box.dataset.haz = 'perdido'; setRun(); });
canvas.addEventListener('webglcontextrestored', () => { lost = false; H.restauradas++; H.frames = 0; H.modo = 'cargando'; warm = 2; measure(); calentarAsync().then(setRun); });
H.perder = () => { const x = renderer.getContext().getExtension('WEBGL_lose_context'); x.loseContext(); setTimeout(() => x.restoreContext(), 1200); };
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
addEventListener('load', measure);
window.__f3pedir = () => { dirty = true; };    // la página pide un cuadro (abrir/cerrar ficha con el 3D quieto)

measure();
{ const k = CAMK[(ST[POSTER] || ST.heroe).cam]; camera.position.copy(k.pos); camera.lookAt(k.tgt); }
H.armarMs = Math.round(performance.now() - T0);
// compilación en paralelo (KHR_parallel_shader_compile) y una estación por cuadro, para que la carga no congele el scroll;
// con ANGLE/D3D11 el primer dibujo de cada material desde un ángulo nuevo cuesta 50–100 ms aunque se haya compilado
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function calentarAsync() {
  const t0 = performance.now();
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  shops.forEach((s) => { s.uFound.value = 1; s.glow.material.opacity = 0.5; });
  for (const k of Object.values(CAMK)) {
    await nextFrame();
    renderer.setPixelRatio(1); renderer.setSize(64, 90, false);
    camera.position.copy(k.pos); camera.fov = k.fov; camera.aspect = 64 / 90; camera.updateProjectionMatrix(); camera.lookAt(k.tgt); renderer.render(scene, camera);
  }
  await nextFrame(); composer.setSize(64, 90); paint();
  measure(); H.calentarMs = Math.round(performance.now() - t0);
}
if (POSTER || CAMK.dbg) {
  renderer.compile(scene, camera);
  for (let i = 0; i < 3; i++) { dirty = true; update(1 / 60); }
  paint();
  const pp = pins();
  stopped = true;
  if (POSTER) window.__poster = { url: canvas.toDataURL('image/webp', +(q.get('qual') || 0.84)), pins: pp };
  else { H.modo = 'vivo'; box.dataset.haz = 'vivo'; window.__pins = pp; }
} else {
  calentarAsync().then(setRun);
}
