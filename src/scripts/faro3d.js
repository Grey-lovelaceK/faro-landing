// Faro° — escena 3D de Santiago para el banner de la portada (FaroCiudad.astro). Viene de v7-relato (3-nov-2026,
// tools/out/rediseno-2026-11/v7-relato/assets/haz.js) adaptada a un solo recuadro:
// - three r187 de npm (Vite hace tree-shaking) y se carga con import() solo cuando el recuadro se acerca a la pantalla.
// - El progreso lo da FaroCiudad.astro (window.__f3.estado(): estación i, paso w a la siguiente, avance u en la estación).
// - Calidad cinemática: postprocesado con bloom (UnrealBloomPass sobre un render target HalfFloat con MSAA), reflejos
//   del Mapocho (luces de la Costanera Norte estiradas sobre el agua + cielo por Fresnel), vida propia constante
//   (estrellas, tráfico, haz que respira cuando enfoca un local).
// - Presupuesto: DPR <= 1,25 (1 en pantallas chicas); dibuja solo con el recuadro a la vista y la pestaña visible;
//   guardián de fps por tiempo: primero apaga el bloom y baja a DPR 1, si sigue lento vuelve al póster.
// - ?f3poster=<estación>&bw=&bh=&dpr= dibuja un cuadro y deja window.__poster (así se generan los pósters).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const T0 = performance.now();
// cede el hilo entre bloques de construcción: así armar la escena (~0,5 s de CPU) no congela el scroll
const pausa = () => new Promise((r) => setTimeout(r, 0));
const d = document.documentElement;
const q = new URLSearchParams(location.search);
const CAP = q.has('cap');                       // capturas: haz automático congelado
const POSTER = q.get('f3poster');                 // id de estación (heroe, servicios, local-N, analizador, lente, cumbre) o 'locales'
const box = document.querySelector('[data-f3]');
if (q.has('bw')) { box.style.width = q.get('bw') + 'px'; box.style.height = q.get('bh') + 'px'; box.style.minHeight = '0'; box.style.maxHeight = 'none'; }   // pósters: tamaño exacto del cuadro
const H = window.__f3haz = { modo: 'cargando', frames: 0, perdidas: 0, restauradas: 0, dpr: 0, motivo: '' };
const LOCALES = (() => { try { return JSON.parse(document.getElementById('f3-locales').textContent); } catch (e) { return []; } })();

const canvas = document.createElement('canvas');
canvas.className = 'gl';
canvas.setAttribute('aria-hidden', 'true');
box.querySelector('.f3-poster').after(canvas);

function toPoster(why) {
  H.modo = 'poster'; H.motivo = why; box.dataset.haz = 'poster'; box.dataset.hazMotivo = why;
  stop(); if (renderer) { try { renderer.dispose(); } catch (e) {} } canvas.remove();
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
function ridgeJ(x, z) { let s = 0, a = 0.5, w = 1; for (let i = 0; i < 5; i++) { let n = 1 - Math.abs(n2(x, z) * 2 - 1); n *= n; s += a * n * w; w = clamp(n * 1.6, 0, 1); x = x * 2.1 + 5.3; z = z * 2.1 + 1.9; a *= 0.5; } return s; }
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- geografía: la cuenca ----------
const CERRO = { x: 32, z: -24, r: 30, h: 22 };      // cerro isla del faro (sin nombre: es la metáfora, no un lugar)
const SANCRIS = { x: -215, z: -560, r: 140, h: 66 };  // Cerro San Cristóbal
const TORRE = { x: 120, z: -640 };                   // Gran Torre Costanera
const rioZ = (x) => -585 + 22 * Math.sin(x * 0.0065 + 0.6) + 8 * Math.sin(x * 0.019);  // Mapocho + Costanera Norte
function heightAt(x, z) {
  let h = 0.15 * (fbmJ(x * 0.05, z * 0.05) - 0.5);
  const dc = Math.hypot((x - CERRO.x) * 1.0, (z - CERRO.z) * 1.15);
  const nc = fbmJ(x * 0.06 + 3, z * 0.06);
  h += CERRO.h * Math.exp(-Math.pow(dc / (CERRO.r * (0.85 + 0.3 * nc)), 2) * 1.6) * (0.85 + 0.3 * nc);
  const ds = Math.hypot(x - SANCRIS.x, (z - SANCRIS.z) * 1.4);
  const ns = fbmJ(x * 0.02, z * 0.02 + 9);
  h += SANCRIS.h * Math.exp(-Math.pow(ds / (SANCRIS.r * (0.8 + 0.4 * ns)), 2) * 1.5);
  // lomas del primer plano a la izquierda (encuadran la vista)
  h += 9 * smooth(-30, -110, x) * smooth(-10, 40, z) * (0.6 + 0.6 * fbmJ(x * 0.03, z * 0.03));
  return h;
}
const LHb = { x: CERRO.x - 2, z: CERRO.z + 2 };
const LH = { x: LHb.x, z: LHb.z, y: heightAt(LHb.x, LHb.z) - 0.4 };

// ---------- uniforms compartidos + GLSL común ----------
const U = {
  uTime: { value: 0 },
  uLens: { value: new THREE.Vector3(LH.x, LH.y + 14.25, LH.z) },
  uBeamDir: { value: new THREE.Vector3(-1, 0, 0) },
  uBeamCos: { value: Math.cos(THREE.MathUtils.degToRad(4.2)) },
  uBeamI: { value: 1 },
  uMoonDir: { value: new THREE.Vector3(-0.45, 0.5, 0.75).normalize() },
  uFogCol: { value: new THREE.Color(0x18224a) },
  uFogD: { value: 0.0021 },
  uLit: { value: 0.55 },        // 0..1: cuánto de la ciudad está encendida (crece desde el faro hacia afuera)
  uLH: { value: new THREE.Vector2(LH.x, LH.z) },
};
const COMMON = /* glsl */`
uniform float uTime, uBeamCos, uBeamI, uFogD, uLit; uniform vec2 uLH; uniform vec3 uLens, uBeamDir, uMoonDir, uFogCol;
// fracción encendida a una distancia del faro: el encendido avanza como una onda desde el cerro
float litAt(vec3 P){ float dd = length(P.xz - uLH); return clamp(uLit*1.55 - dd*0.00062, 0.1, 1.0); }
const vec3 BEAM = vec3(0.40, 0.50, 1.0);
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*noise(p); p = p*2.03 + 11.0; a *= 0.5; } return s; }
vec3 beamAt(vec3 P, vec3 N){
  vec3 toP = P - uLens; float d = length(toP); vec3 l = toP / max(d, 1e-3);
  float c = dot(l, uBeamDir);
  float w = (1.0 - uBeamCos);
  float cone = smoothstep(uBeamCos - w*0.6, uBeamCos + w*0.5, c);
  float back = smoothstep(uBeamCos - w*0.6, uBeamCos + w*0.5, -c) * 0.22;
  float att = 1.0 / (1.0 + d*d*0.00028);
  float ndl = clamp(dot(N, -l)*0.85 + 0.15, 0.0, 1.0);
  float nearL = max(dot(N, -l), 0.0) / (1.0 + d*d*0.045);
  return BEAM * ((cone + back) * att * ndl * 2.6 * uBeamI + nearL * 1.5);
}
vec3 ambient(vec3 N){ return mix(vec3(0.03, 0.034, 0.06), vec3(0.11, 0.13, 0.23), N.y*0.5 + 0.5); }
vec3 moonL(vec3 N){ return vec3(0.42, 0.50, 0.74) * max(dot(N, uMoonDir), 0.0); }
vec3 fogged(vec3 c, float d){ return mix(c, uFogCol, 1.0 - exp(-d*uFogD)); }
`;
const VS_BASIC = /* glsl */`
varying vec3 vWP; varying vec3 vN;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp; }`;
const VS_POS = /* glsl */`varying vec3 vWP; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;
const VS_INST = /* glsl */`varying vec3 vWP; varying vec3 vN;
  void main(){ vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*wp; }`;
const mat = (fs, extra = {}, opts = {}) => new THREE.ShaderMaterial({
  uniforms: { ...U, ...extra }, vertexShader: opts.vs || VS_BASIC, fragmentShader: COMMON + fs, ...opts.m,
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 3600);

await pausa();
// ---------- cielo (con el resplandor frío de la ciudad en el horizonte) ----------
{
  const g = new THREE.SphereGeometry(3000, 48, 24);
  const m = mat(/* glsl */`
  varying vec3 vWP;
  void main(){
    vec3 dir = normalize(vWP - cameraPosition);
    float y = dir.y;
    vec3 zen = vec3(0.010, 0.014, 0.034), hor = vec3(0.085, 0.11, 0.22);
    vec3 col = mix(hor, zen, smoothstep(-0.02, 0.42, y));
    col += vec3(0.05, 0.065, 0.13) * exp(-max(y, 0.0) * 14.0);            // la ciudad ilumina el cielo bajo
    vec2 cp = dir.xz / max(y + 0.18, 0.05);
    float cl = fbm(cp*1.3 + vec2(uTime*0.004, 0.0));
    col += vec3(0.05, 0.065, 0.12) * smoothstep(0.52, 0.85, cl) * smoothstep(0.05, 0.3, y) * 0.8;
    vec2 sp = vec2(atan(dir.x, -dir.z), asin(clamp(y, -1.0, 1.0))) * 260.0;
    vec2 cell = floor(sp); vec2 f = fract(sp) - 0.5;
    float h = hash(cell);
    float star = step(0.986, h) * smoothstep(0.32, 0.0, length(f)) * smoothstep(0.1, 0.3, y);
    star *= 0.55 + 0.45 * sin(uTime*1.7 + h*90.0);
    col += vec3(0.75, 0.80, 1.0) * star * (0.35 + 0.65*fract(h*37.0)) * (1.0 - smoothstep(0.5, 0.75, cl));
    gl_FragColor = vec4(col, 1.0);
  }`, {}, { vs: VS_POS, m: { side: THREE.BackSide, depthWrite: false } });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  sky.onBeforeRender = () => sky.position.copy(camera.position);
}

await pausa();
// ---------- Cordillera de los Andes (nevada) y, a la izquierda, la de la Costa (más baja, sin nieve) ----------
{
  const g = new THREE.PlaneGeometry(6400, 700, 420, 46); g.rotateX(-Math.PI / 2); g.translate(300, 0, -1950);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const t = clamp((-z - 1600) / 700, 0, 1);                  // 0 = pie, 1 = fondo
    const andes = smooth(-700, 300, x);                          // la cordillera alta es la del oriente (derecha)
    const env = lerp(80, 300, andes) * (0.8 + 0.4 * fbmJ(x * 0.001 + 2, 1.3));
    const r = 0.55 * ridgeJ(x * 0.0026, z * 0.003 + 4) + 0.45 * fbmJ(x * 0.0018 + 9, z * 0.002);
    const h = env * smooth(0, 0.7, t) * (0.25 + 0.95 * r) - 6;
    p.setY(i, h);
  }
  g.computeVertexNormals();
  const m = mat(/* glsl */`
  varying vec3 vWP; varying vec3 vN;
  void main(){
    vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    float andes = smoothstep(-700.0, 300.0, vWP.x);
    float n = fbm(vWP.xz*0.02);
    float snowLine = 120.0 + 40.0*n - 10.0*andes;
    float snow = smoothstep(snowLine - 18.0, snowLine + 26.0, vWP.y + 35.0*N.y) * smoothstep(0.35, 0.75, N.y + 0.25*n) * andes;
    snow = max(snow, smoothstep(0.62, 0.9, N.y) * smoothstep(snowLine + 40.0, snowLine + 90.0, vWP.y) * andes);
    vec3 rock = vec3(0.07, 0.08, 0.11) * (0.7 + 0.6*n);
    vec3 alb = mix(rock, vec3(0.88, 0.90, 0.96), snow);
    vec3 li = ambient(N)*1.1 + moonL(N)*1.15; li = mix(vec3(dot(li, vec3(0.3333))), li, 0.45);
    vec3 col = alb * li;
    // bruma fría del valle a los pies de la cordillera
    float haze = 0.62 * exp(-max(vWP.y, 0.0)*0.012);
    col = mix(col, vec3(0.085, 0.11, 0.22), haze);
    col = mix(col, vec3(0.085, 0.11, 0.22), 0.18);
    gl_FragColor = vec4(col, 1.0);
  }`);
  const mtn = new THREE.Mesh(g, m); mtn.renderOrder = -5; scene.add(mtn);
}

await pausa();
// ---------- terreno: el mar de luces (cuenca) + cerros ----------
const GROUND_FS = /* glsl */`
  varying vec3 vWP; varying vec3 vN;
  uniform float uRioOn;
  float rioZ(float x){ return -585.0 + 22.0*sin(x*0.0065 + 0.6) + 8.0*sin(x*0.019); }
  float lights(vec2 q, float per, float step_, float w, float w0, float lf, out float avg){
    // faroles en calles paralelas a x cada 'per', separados 'step_'
    vec2 cell = vec2(floor(q.x/step_ + 0.5), floor(q.y/per + 0.5));
    vec2 dd = vec2(q.x - cell.x*step_, q.y - cell.y*per);
    float on = step(1.0 - 0.78*lf, hash(cell*0.37 + per));
    avg = 3.1416*w0*w0/(per*step_) * 0.78*lf;
    return on * exp(-dot(dd, dd)/(w*w));
  }
  void main(){
    vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    float slope = 1.0 - N.y; float n = noise(vWP.xz*0.12)*0.6 + noise(vWP.xz*0.5)*0.4;
    float hill = smoothstep(1.2, 4.0, vWP.y);
    vec3 dirt = mix(vec3(0.05, 0.06, 0.075), vec3(0.10, 0.11, 0.13), n);
    vec3 rock = mix(vec3(0.11, 0.12, 0.15), vec3(0.20, 0.21, 0.25), n);
    vec3 alb = mix(dirt, rock, smoothstep(0.25, 0.55, slope + (n - 0.5)*0.3));
    vec3 col = alb * (ambient(N) + moonL(N) + beamAt(vWP, N));
    // ciudad: dos tramas de calles (giradas como el damero de Santiago) con faroles fríos
    float ang = 0.21; mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 q = R * vWP.xz; vec2 q2 = vec2(q.y, -q.x);
    float fw = length(fwidth(q));
    float a1, a2, a3; float lf = litAt(vWP);
    float l1 = lights(q, 9.0, 3.2, 0.2 + fw*0.35, 0.2, lf, a1);
    float l2 = lights(q2, 11.0, 3.6, 0.2 + fw*0.35, 0.2, lf, a2);
    float l3 = lights(q + vec2(0.0, 4.5), 54.0, 2.2, 0.45 + fw*0.35, 0.45, lf, a3);     // avenidas
    float k = smoothstep(0.25, 1.4, fw);
    float lit = mix(l1 + l2, (a1 + a2)*3.2, k) + mix(l3, a3*3.0, k)*1.8;
    float block = hash(floor(q/27.0));
    float dens = (0.6 + 0.7*block) * (1.0 - hill);
    vec3 lc = mix(vec3(0.58, 0.66, 1.0), vec3(0.86, 0.90, 1.0), hash(floor(q/9.0)));
    vec3 city = lc * min(lit, 1.6) * dens * 1.9;
    // Mapocho: cinta oscura con la autopista a la orilla
    float rz = rioZ(vWP.x); float dr = abs(vWP.z - rz);
    float river = smoothstep(7.0, 4.0, dr);
    city *= 1.0 - river;
    // reflejo: el agua devuelve el cielo bajo (Fresnel) y las luces de las dos orillas estiradas hacia la cámara
    vec3 Vw = normalize(cameraPosition - vWP);
    float fres = 0.08 + 0.92*pow(1.0 - max(Vw.y, 0.0), 4.0);
    float rip = noise(vec2(vWP.x*0.35, vWP.z*1.1 - uTime*0.55));
    float cols = pow(0.5 + 0.5*sin(vWP.x*1.35 + rip*2.6), 10.0) + 0.6*pow(0.5 + 0.5*sin(vWP.x*0.53 + 1.7 + rip*1.8), 14.0);
    vec3 water = vec3(0.06, 0.08, 0.17)*fres + vec3(0.62, 0.72, 1.0)*cols*0.42*(0.55 + 0.45*rip)*fres;
    water += beamAt(vec3(vWP.x, vWP.y + 6.0, vWP.z), vec3(0.0, 1.0, 0.0))*0.18*fres;
    float hw = exp(-pow((vWP.z - rz - 8.5)/(0.7 + fw*0.6), 2.0)) + exp(-pow((vWP.z - rz + 8.5)/(0.7 + fw*0.6), 2.0));
    city += vec3(0.72, 0.80, 1.0) * hw * 0.85 * (0.75 + 0.25*sin(vWP.x*0.6 - uTime*2.0)) * (1.0 - hill);
    col = mix(col, col*0.4 + vec3(0.02, 0.025, 0.05)*(1.0-river), (1.0 - hill)*0.6);
    col = mix(col, water, river*(1.0 - hill));
    col += vec3(0.035, 0.05, 0.12) * dens * (0.6 + 0.4*n) * (0.45 + 0.55*lf);     // resplandor del damero
    col = fogged(col, d*0.85);
    col += city * exp(-d*0.0007);
    // cerros: unos pocos faroles de camino
    col += vec3(0.6, 0.68, 1.0) * step(0.997, hash(floor(vWP.xz*0.9))) * hill * smoothstep(-80.0, -300.0, vWP.z) * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }`;
{
  const parts = [
    { x0: -160, x1: 170, z0: 95, z1: -215, sx: 190, sz: 170 },        // cerca: el cerro del faro y el barrio
    { x0: 170, x1: 1600, z0: 95, z1: -215, sx: 120, sz: 30 },         // cerca a la derecha (sin esto quedaba un hueco que se leía como agua)
    { x0: -1500, x1: -160, z0: 95, z1: -215, sx: 110, sz: 30 },
    { x0: -1500, x1: 1600, z0: -215, z1: -1650, sx: 230, sz: 150 },  // lejos: la cuenca y el San Cristóbal
  ];
  for (const pp of parts) {
    const W = pp.x1 - pp.x0, D = pp.z0 - pp.z1;
    const g = new THREE.PlaneGeometry(W, D, pp.sx, pp.sz); g.rotateX(-Math.PI / 2); g.translate(pp.x0 + W / 2, 0, pp.z0 - D / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, mat(GROUND_FS, { uRioOn: { value: 1 } })));
    await pausa();
  }
}

await pausa();
// ---------- edificios ----------
const BLD_VS = /* glsl */`
attribute vec3 aI; uniform vec3 uShop; // uShop: x seed, y lit, z found (solo locales)
varying vec3 vWP; varying vec3 vN; varying vec2 vFace; varying vec3 vI; varying float vH; varying float vTop; varying float vHW;
void main(){
#ifdef SHOP
  mat4 im = mat4(1.0); vec3 I = uShop;
  vec3 sc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
#else
  mat4 im = instanceMatrix; vec3 I = aI;
  vec3 sc = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
#endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0); vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vec3 lp = position * sc;
  vFace = abs(normal.x) > 0.5 ? vec2(lp.z, lp.y) : vec2(lp.x, lp.y);
  vTop = step(0.5, normal.y); vI = I; vH = sc.y; vHW = abs(normal.x) > 0.5 ? sc.z*0.5 : sc.x*0.5;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BLD_FS = /* glsl */`
varying vec3 vWP; varying vec3 vN; varying vec2 vFace; varying vec3 vI; varying float vH; varying float vTop; varying float vHW;
#ifdef SHOP
uniform float uMine, uScanOn, uScanY;
#endif
void main(){
  vec3 N = normalize(vN); float d = length(cameraPosition - vWP); float sd = vI.x;
  vec3 alb = mix(vec3(0.13, 0.14, 0.18), vec3(0.27, 0.28, 0.33), hash(vec2(sd*91.0, 1.0)));
  alb *= mix(1.0, 0.7, vTop);
  if (vTop < 0.5) {
    alb *= mix(0.55, 1.0, smoothstep(0.0, 0.7, vHW - abs(vFace.x)));
    alb *= mix(0.6, 1.0, smoothstep(0.0, 3.0, vFace.y));
    alb *= 1.0 + 0.5*step(vH - 0.28, vFace.y);
  }
  vec3 col = alb * (ambient(N) + moonL(N) + beamAt(vWP, N));
  if (vTop < 0.5) {
    float ribbon = step(0.78, fract(sd*5.3));
    vec2 cs = mix(vec2(1.55, 2.6), vec2(4.0, 2.6), ribbon);
    vec2 g = vFace / cs + vec2(sd*7.0, 0.0);
    vec2 cell = floor(g); vec2 f = fract(g);
    float win = step(mix(0.22, 0.06, ribbon), f.x)*step(f.x, mix(0.78, 0.94, ribbon))*step(0.34, f.y)*step(f.y, 0.80);
    win *= step(1.1, vFace.y) * step(vFace.y, vH - 0.55) * step(abs(vFace.x), vHW - 0.35);
    float r = hash(cell + vec2(sd*13.1) + N.xz*7.0);
    float litP = vI.y*(0.25 + 0.9*litAt(vWP)) + vI.z*0.6;
    float lit = step(1.0 - litP, r);
    vec3 wc = mix(vec3(0.50, 0.57, 0.88), vec3(0.80, 0.84, 1.0), hash(cell*1.7 + sd)) * (0.35 + 0.5*hash(cell*3.1 + sd));
    wc *= 1.0 + vI.z*1.1;
    float aa = clamp(1.6 - length(fwidth(g))*2.4, 0.0, 1.0);
    vec3 glassC = vec3(0.012, 0.016, 0.03) + beamAt(vWP, N)*0.06 + vec3(0.03, 0.04, 0.07)*moonL(N).b;
    vec3 winCol = mix(glassC, wc, lit);
    col = mix(col, mix(col*0.85 + wc*litP*0.1, winCol, aa), win);
  }
#ifdef SHOP
  // escaneo del analizador: una franja cobalto sube por la fachada (solo el local escaneado)
  float sb = exp(-pow((vWP.y - uScanY)/0.22, 2.0)) * uMine * uScanOn;
  float sg = smoothstep(uScanY + 0.1, uScanY - 2.5, vWP.y) * uMine * uScanOn * 0.18 * (1.0 - vTop);
  col += vec3(0.30, 0.42, 1.0) * (sb*2.2 + sg);
#endif
  gl_FragColor = vec4(fogged(col, d*0.8), 1.0);
}`;
const shops = [];
const SCAN = { on: { value: 0 }, y: { value: 0 } };
{
  // los locales salen de <script id="locales"> (un objeto por local). Si falta, tres por defecto.
  const DEF = [{ x: -30, z: -86, w: 6.5, d: 5.5, h: 4.6, techo: 'dos-aguas' }, { x: -13, z: -92, w: 7, d: 6, h: 5.2, techo: 'plano' }, { x: -47, z: -96, w: 6, d: 5, h: 4.4, techo: 'dos-aguas' }];
  const SHOPS = [0, 1, 2].map((i) => ({ id: (LOCALES[i] && LOCALES[i].id) || 'local' + i, ...DEF[i], ...((LOCALES[i] && LOCALES[i].escena) || {}) }));
  SHOPS.forEach((s) => { s.y = Math.min(heightAt(s.x - s.w / 2, s.z), heightAt(s.x + s.w / 2, s.z)) - 0.2; });
  const boxes = [];
  const free = (x, z, m) => !SHOPS.some((s) => Math.abs(x - s.x) < s.w / 2 + m && Math.abs(z - s.z) < s.d / 2 + m);
  // barrio de casas bajas (tipo Ñuñoa/Macul) a los pies del cerro
  for (let gx = -150; gx <= 150; gx += 6.4) {
    for (let gz = -52; gz >= -230; gz -= 6.6) {
      const x = gx + (rnd() - 0.5) * 2, z = gz + (rnd() - 0.5) * 2;
      if (heightAt(x, z) > 1.0 || !free(x, z, 3.4)) continue;
      if (Math.round((gz + 52) / 6.6) % 4 === 3 || Math.round((gx + 150) / 6.4) % 5 === 2 || rnd() < 0.18) continue;   // calles
      const far = smooth(-120, -230, z);
      if (rnd() < far * 0.6) continue;
      const nearShop = SHOPS.some((s) => Math.hypot(x - s.x, z - s.z) < 26);
      const h = 2.8 + rnd() * 3.2 + (!nearShop && rnd() < 0.06 ? 4 + rnd() * 8 : 0);
      boxes.push({ x, z, w: 3.6 + rnd() * 2.2, d: 3.6 + rnd() * 2.2, h, y: heightAt(x, z) - 0.4, r: 0.21 + (rnd() - 0.5) * 0.06, s: rnd(), lit: 0.08 + rnd() * rnd() * 0.3 });
    }
  }
  // edificios medianos esparcidos por la cuenca + dos núcleos (centro y Providencia/Las Condes)
  const tower = (x, z, h, w) => boxes.push({ x, z, w: w || 7 + rnd() * 6, d: w || 7 + rnd() * 6, h, y: heightAt(x, z) - 0.5, r: 0.21 + (rnd() - 0.5) * 0.1, s: rnd(), lit: 0.18 + rnd() * 0.3 });
  for (let i = 0; i < 520; i++) {
    const x = -700 + rnd() * 1500, z = -240 - rnd() * 700;
    if (heightAt(x, z) > 1.5 || Math.abs(z - rioZ(x)) < 14) continue;
    const cen = Math.exp(-((x + 70) ** 2 + (z + 640) ** 2) / 9000), pro = Math.exp(-((x - 110) ** 2 + (z + 630) ** 2) / 16000);
    const h = 5 + rnd() * 10 + (cen * 30 + pro * 38) * (0.4 + rnd());
    if (h < 9 && rnd() < 0.5) continue;
    tower(x, z, h);
  }
  // «Sanhattan»: torres altas alrededor de la Costanera
  [[78, -612, 58], [96, -668, 44], [150, -610, 52], [160, -668, 40], [60, -660, 36], [176, -640, 46], [134, -700, 34]].forEach(([x, z, h]) => tower(x, z, h, 9 + rnd() * 5));
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  const m = new THREE.ShaderMaterial({ uniforms: { ...U, uShop: { value: new THREE.Vector3() } }, vertexShader: BLD_VS, fragmentShader: COMMON + BLD_FS });
  const im = new THREE.InstancedMesh(g, m, boxes.length);
  const aI = new Float32Array(boxes.length * 3);
  const o = new THREE.Object3D();
  boxes.forEach((b, i) => {
    o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.r, 0); o.scale.set(b.w, b.h, b.d); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    aI.set([b.s, b.lit, 0], i * 3);
  });
  g.setAttribute('aI', new THREE.InstancedBufferAttribute(aI, 3));
  scene.add(im);
  // techos a dos aguas en las casas bajas cercanas
  const low = boxes.filter((b) => b.h < 6.2 && b.z > -240);
  const pg = prism(); const rm = mat(/* glsl */`
  varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    vec3 alb = vec3(0.12, 0.13, 0.17); vec3 col = alb*(ambient(N) + moonL(N) + beamAt(vWP, N));
    gl_FragColor = vec4(fogged(col, d), 1.0); }`, {}, { vs: VS_INST });
  const rim = new THREE.InstancedMesh(pg, rm, low.length);
  low.forEach((b, i) => { o.position.set(b.x, b.y + b.h, b.z); o.rotation.set(0, b.r + (b.s > 0.5 ? Math.PI / 2 : 0), 0);
    o.scale.set(b.s > 0.5 ? b.d + 0.3 : b.w + 0.3, 1 + b.s, b.s > 0.5 ? b.w + 0.3 : b.d + 0.3); o.updateMatrix(); rim.setMatrixAt(i, o.matrix); });
  scene.add(rim);

  // locales de ejemplo: cuerpo con ventanas + vitrina + toldo + letrero sin texto
  const glassFS = /* glsl */`
  uniform float uFound; varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    float mull = step(0.47, abs(fract(vUv.x*3.0) - 0.5)) + step(vUv.y, 0.06);
    vec3 dark = vec3(0.012, 0.016, 0.03) + beamAt(vWP, N)*0.10;
    vec3 litc = mix(vec3(0.70, 0.77, 1.0), vec3(0.93, 0.95, 1.0), smoothstep(0.0, 0.8, vUv.y)) * 1.05;
    vec3 col = mix(dark, litc, uFound);
    col = mix(col, vec3(0.05, 0.06, 0.09), clamp(mull, 0.0, 1.0)*0.85);
    gl_FragColor = vec4(fogged(col, d), 1.0); }`;
  const signFS = /* glsl */`
  uniform float uFound; varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    vec3 col = vec3(0.05, 0.06, 0.09)*(ambient(N) + moonL(N) + beamAt(vWP, N)) + vec3(0.28, 0.38, 1.0)*uFound*1.15;
    gl_FragColor = vec4(fogged(col, d), 1.0); }`;
  const plainFS = (c) => /* glsl */`
  varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    vec3 col = vec3(${c})*(ambient(N) + moonL(N) + beamAt(vWP, N)); gl_FragColor = vec4(fogged(col, d), 1.0); }`;
  const UV_VS = /* glsl */`varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
  void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }`;
  SHOPS.forEach((s, i) => {
    // la vitrina mira hacia el faro (para que el haz la encuentre de frente)
    const grp = new THREE.Group(); grp.position.set(s.x, s.y, s.z); grp.rotation.y = Math.atan2(LH.x - s.x, LH.z - s.z) * 0.55; scene.add(grp);
    const uShop = { value: new THREE.Vector3(0.3 + i * 0.21, 0.12, 0) };
    const uMine = { value: 0 };
    const bm = new THREE.ShaderMaterial({ uniforms: { ...U, uShop, uMine, uScanOn: SCAN.on, uScanY: SCAN.y }, vertexShader: BLD_VS, fragmentShader: COMMON + BLD_FS, defines: { SHOP: 1 } });
    const body = new THREE.Mesh(g, bm); body.scale.set(s.w, s.h, s.d); grp.add(body);
    const uFound = { value: 0 };
    const gm = mat(glassFS, { uFound }, { vs: UV_VS });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.78, 2.3), gm); glass.position.set(0, 1.45, s.d / 2 + 0.02); grp.add(glass);
    const aw = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.9, 0.12, 1.5), mat(plainFS('0.10, 0.13, 0.24')));
    aw.position.set(0, 2.95, s.d / 2 + 0.7); aw.rotation.x = 0.32; grp.add(aw);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.62, 0.62, 0.14), mat(signFS, { uFound }));
    sign.position.set(0, 3.75, s.d / 2 + 0.1); grp.add(sign);
    let top = s.h;
    if (s.techo === 'dos-aguas') { const r = new THREE.Mesh(pg, mat(plainFS('0.13, 0.14, 0.19'))); r.position.y = s.h; r.scale.set(s.w + 0.4, 1.9, s.d + 0.4); grp.add(r); top += 1.9; }
    else { const par = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.2, 0.5, s.d + 0.2), mat(plainFS('0.14, 0.15, 0.2'))); par.position.y = s.h + 0.1; grp.add(par); top += 0.5; }
    grp.updateMatrixWorld(true);
    const pin = new THREE.Vector3(0, top + 1.2, 0).applyMatrix4(grp.matrixWorld);
    const aim = new THREE.Vector3(0, 2.2, s.d / 2).applyMatrix4(grp.matrixWorld);
    const glow = sprite(0x9fb0ff, 7.5); glow.position.copy(aim).add(new THREE.Vector3(0, 0.5, 0)); glow.material.opacity = 0; scene.add(glow);
    shops.push({ ...s, uShop, uFound, uMine, pin, aim, glow, top: s.y + top, found: 0, hit: false });
  });
}
function prism() {
  const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, 0.5, 0, 0.5];
  const idx = [0, 2, 1, 3, 5, 4, 0, 3, 4, 0, 4, 2, 1, 2, 4, 1, 4, 5, 0, 1, 5, 0, 5, 3];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}

await pausa();
// ---------- Gran Torre Costanera: planta cuadrada de esquinas redondeadas, leve ahusado y corona abierta ----------
{
  const HT = 150, R0 = 11, R1 = 8.4;
  const sq = (g, rTop, rBot, hh) => {   // cilindro → cuadrado redondeado (superelipse n = 5)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
      const k = Math.pow(Math.pow(Math.abs(Math.cos(a)), 5) + Math.pow(Math.abs(Math.sin(a)), 5), -1 / 5);
      const r = lerp(rBot, rTop, (y + hh / 2) / hh) * k; p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
    }
    g.computeVertexNormals(); return g;
  };
  const body = sq(new THREE.CylinderGeometry(1, 1, HT, 64, 1, true), R1, R0, HT); body.translate(0, HT / 2, 0);
  const y0 = heightAt(TORRE.x, TORRE.z) - 0.5;
  const fs = /* glsl */`
  uniform vec3 uC; uniform float uHT; varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    float y = vWP.y - uC.y; float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float floorF = fract(y / 1.9); float col_ = fract(a * 34.0 / 6.2832);
    float band = smoothstep(0.0, 0.12, floorF) * smoothstep(0.62, 0.5, floorF);
    float mull = smoothstep(0.04, 0.12, col_) * smoothstep(0.96, 0.88, col_);
    float fl = floor(y / 1.9); float r = hash(vec2(fl, floor(a*34.0/6.2832)));
    float lit = step(0.38, r) * band * mull;
    vec3 glass = vec3(0.03, 0.045, 0.09) + vec3(0.10, 0.14, 0.30)*pow(1.0 - abs(dot(N, normalize(cameraPosition - vWP))), 2.0);
    vec3 wc = mix(vec3(0.55, 0.62, 0.95), vec3(0.85, 0.89, 1.0), hash(vec2(fl*1.3, 2.0))) * (0.55 + 0.45*hash(vec2(fl, 7.0)));
    vec3 c = glass * (ambient(N) + moonL(N)*1.4) * 2.0 + wc * lit * 0.9;
    c += vec3(0.35, 0.45, 1.0) * smoothstep(uHT - 6.0, uHT, y) * 0.35;           // la corona tiñe el remate
    gl_FragColor = vec4(fogged(c, d*0.55), 1.0); }`;
  const m = mat(fs, { uC: { value: new THREE.Vector3(TORRE.x, y0, TORRE.z) }, uHT: { value: HT } }, { m: { side: THREE.DoubleSide } });
  const tw = new THREE.Mesh(body, m); tw.position.set(TORRE.x, y0, TORRE.z); tw.rotation.y = 0.21; scene.add(tw);
  // corona: celosía de vidrio abierta, encendida en cobalto
  const crown = sq(new THREE.CylinderGeometry(1, 1, 16, 64, 1, true), R1 * 0.82, R1 * 1.0, 16); crown.translate(0, HT + 8, 0);
  const cm = mat(/* glsl */`
  uniform vec3 uC; uniform float uHT; varying vec3 vWP; varying vec3 vN;
  void main(){ float y = vWP.y - uC.y - uHT; float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float bars = smoothstep(0.84, 0.95, abs(sin(a*14.0 + y*0.35))) + smoothstep(0.9, 0.97, abs(sin(a*14.0 - y*0.35)));
    float rim = smoothstep(14.5, 16.0, y) + smoothstep(1.2, 0.0, y);
    float v = clamp(bars + rim, 0.0, 1.0);
    if (v < 0.1) discard;
    vec3 c = mix(vec3(0.30, 0.42, 1.0), vec3(0.75, 0.82, 1.0), smoothstep(16.0, 4.0, y)) * (0.55 + 0.45*v);
    gl_FragColor = vec4(fogged(c, length(cameraPosition - vWP)*0.4), 1.0); }`, { uC: { value: new THREE.Vector3(TORRE.x, y0, TORRE.z) }, uHT: { value: HT } }, { m: { side: THREE.DoubleSide } });
  const cr = new THREE.Mesh(crown, cm); cr.position.copy(tw.position); cr.rotation.y = 0.21; scene.add(cr);
  const cg = sprite(0x6f86ff, 70); cg.position.set(TORRE.x, y0 + HT + 9, TORRE.z); cg.material.opacity = 0.32; scene.add(cg);
}

await pausa();
// ---------- Cerro San Cristóbal: la Virgen iluminada en la cumbre ----------
{
  // cumbre = punto más alto cerca del centro del cerro
  let best = { x: SANCRIS.x, z: SANCRIS.z, y: -1 };
  for (let i = 0; i < 400; i++) { const x = SANCRIS.x + (rnd() - 0.5) * 80, z = SANCRIS.z + (rnd() - 0.5) * 60, y = heightAt(x, z); if (y > best.y) best = { x, z, y }; }
  const S = 1.35;   // escala exagerada para que se lea a 600 unidades (perspectiva forzada)
  const vg = new THREE.Group(); vg.position.set(best.x, best.y - 0.5, best.z); scene.add(vg);
  const white = mat(/* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWP);
    vec3 c = vec3(0.86, 0.89, 1.0) * (0.75 + 0.35*max(dot(N, V), 0.0)) + vec3(0.25, 0.32, 0.8)*0.2;
    gl_FragColor = vec4(fogged(c, length(cameraPosition - vWP)*0.35), 1.0); }`);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * S, 2.6 * S, 6 * S, 8), mat(plainFS3('0.42, 0.45, 0.55'))); ped.position.y = 3 * S; vg.add(ped);
  const robe = [[0, 0], [1.6, 0], [1.45, 1.4], [1.15, 4.8], [1.0, 7.2], [0.75, 8.6], [0.55, 9.2], [0, 9.3]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
  const fig = new THREE.Mesh(new THREE.LatheGeometry(robe, 18), white); fig.position.y = 6 * S; vg.add(fig);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62 * S, 14, 10), white); head.position.y = (6 + 9.9) * S; vg.add(head);
  // brazos abiertos (como la imagen del cerro)
  [-1, 1].forEach((sgn) => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * S, 0.34 * S, 3.4 * S, 6), white);
    arm.position.set(sgn * 1.75 * S, (6 + 7.0) * S, 0.3 * S); arm.rotation.z = sgn * 1.0; vg.add(arm); });
  const halo = sprite(0xdfe6ff, 80); halo.position.set(best.x, best.y + 14 * S, best.z); halo.material.opacity = 0.42; scene.add(halo);
  const core = sprite(0xffffff, 26); core.position.set(best.x, best.y + 12 * S, best.z + 2); core.material.opacity = 0.35; scene.add(core);
}
function plainFS3(c) { return /* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN);
  vec3 col = vec3(${c})*(ambient(N)*1.6 + moonL(N)*1.2) + vec3(0.25,0.3,0.6)*0.15; gl_FragColor = vec4(fogged(col, length(cameraPosition - vWP)*0.4), 1.0); }`; }

await pausa();
// ---------- rocas sueltas en la cumbre del cerro del faro ----------
{
  const g = new THREE.IcosahedronGeometry(1, 3); const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.72 + 0.45 * fbmJ(v.x * 1.7 + 4, v.y * 1.7 + v.z * 1.3); v.multiplyScalar(k); v.y *= 0.62; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const m = mat(/* glsl */`
  varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP); float n = fbm(vWP.xz*0.9 + vWP.y*0.6);
    vec3 alb = mix(vec3(0.16, 0.17, 0.21), vec3(0.36, 0.37, 0.42), n);
    vec3 col = alb*(ambient(N)*1.3 + moonL(N)*1.2 + beamAt(vWP, N));
    gl_FragColor = vec4(fogged(col, d), 1.0); }`, {}, { vs: VS_INST });
  const list = [];
  for (let i = 0; i < 500 && list.length < 60; i++) {
    const a = rnd() * Math.PI * 2, r = 3.8 + rnd() * 10;
    const x = LH.x + Math.cos(a) * r * 1.2, z = LH.z + Math.sin(a) * r;
    if (Math.hypot(x - LH.x - 4.3, z - LH.z + 1.6) < 3.4) continue;
    list.push([x, heightAt(x, z), z, 0.5 + rnd() * 1.5]);
  }
  const im = new THREE.InstancedMesh(g, m, list.length); const o = new THREE.Object3D();
  list.forEach(([x, y, z, sc], i) => { o.position.set(x, y - sc * 0.2, z); o.rotation.set(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5); o.scale.set(sc * (0.9 + rnd() * 0.6), sc, sc * (0.9 + rnd() * 0.5)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  scene.add(im);
}

await pausa();
// ---------- el faro (idéntico a v4) ----------
const lh = new THREE.Group(); lh.position.set(LH.x, LH.y, LH.z); scene.add(lh);
{
  const prof = [[2.7, -0.6], [2.7, 0.8], [2.35, 0.95], [1.78, 1.0], [1.66, 4], [1.5, 8], [1.34, 11.6], [1.36, 11.7], [1.86, 11.95], [1.95, 12.2], [1.95, 12.42], [1.05, 12.45], [1.05, 13.1], [0, 13.1]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tg = new THREE.LatheGeometry(prof, 72);
  const tower = new THREE.Mesh(tg, mat(/* glsl */`
  uniform vec3 uC; varying vec3 vWP; varying vec3 vN;
  void main(){ vec3 N = normalize(vN); float d = length(cameraPosition - vWP);
    float y = vWP.y - uC.y; float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float band = step(4.6, y)*step(y, 6.3) + step(8.5, y)*step(y, 10.2);
    vec3 alb = mix(vec3(0.86, 0.88, 0.92), vec3(0.10, 0.14, 0.27), band);
    alb = mix(alb, vec3(0.08, 0.10, 0.16), step(11.62, y));
    alb = mix(alb, vec3(0.30, 0.31, 0.35), step(y, 0.97));
    alb *= 0.84 + 0.16*noise(vec2(a*14.0, y*0.35));
    alb *= 1.0 - 0.07*smoothstep(0.9, 1.0, fract(y/0.55))*step(0.97, y)*step(y, 11.6);
    alb *= mix(0.55, 1.0, smoothstep(-0.4, 2.6, y));
    vec3 col = alb*(ambient(N)*1.4 + moonL(N)*1.15 + beamAt(vWP, N)*0.6);
    col += alb*vec3(0.45, 0.53, 1.0)*smoothstep(8.5, 11.6, y)*0.07;
    vec3 V = normalize(cameraPosition - vWP); col += vec3(0.05, 0.07, 0.15)*pow(1.0 - max(dot(N, V), 0.0), 3.0);
    gl_FragColor = vec4(fogged(col, d), 1.0); }`, { uC: { value: new THREE.Vector3(LH.x, LH.y, LH.z) } }));
  lh.add(tower);
  const dark = mat(/* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN);
    vec3 col = vec3(0.03, 0.035, 0.06)*(ambient(N) + moonL(N)) + beamAt(vWP, N)*0.02; gl_FragColor = vec4(fogged(col, length(cameraPosition - vWP)), 1.0); }`);
  const face = new THREE.Vector2(-30, 60).normalize(); const fa = Math.atan2(face.x, face.y);
  [[1.0, 1.15, 1.75, 0.85], [5.2, 0.5, 1.62, 0.8], [9.2, 0.45, 1.44, 0.7]].forEach(([y, w, r, hh]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh * (y < 2 ? 2 : 1), 0.3), dark);
    b.position.set(Math.sin(fa) * r, y + (y < 2 ? hh : hh / 2), Math.cos(fa) * r); b.rotation.y = fa; lh.add(b);
  });
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.035, 6, 64), dark); rail.rotation.x = Math.PI / 2; rail.position.y = 13.25; lh.add(rail);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5), dark, 28);
  const o = new THREE.Object3D();
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; o.position.set(Math.cos(a) * 1.92, 12.85, Math.sin(a) * 1.92); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
  lh.add(posts);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 1.75, 48, 1, true), mat(/* glsl */`
  uniform vec3 uC; uniform float uY0; varying vec3 vWP; varying vec3 vN;
  void main(){ float a = atan(vWP.z - uC.z, vWP.x - uC.x);
    float mull = smoothstep(0.93, 0.985, abs(cos(a*5.0)));
    float bar = step(fract((vWP.y - uY0)/0.875), 0.07);
    vec3 r = normalize(vec3(vWP.x - uC.x, 0.0, vWP.z - uC.z));
    float face = pow(max(dot(r, normalize(vec3(uBeamDir.x, 0.0, uBeamDir.z))), 0.0), 3.0);
    float lens = 0.75 + 0.25*sin((vWP.y - uY0)*34.0);
    vec3 col = vec3(0.55, 0.64, 1.0)*(0.55 + 1.9*face)*lens;
    col = mix(col, vec3(0.03, 0.04, 0.07), max(mull, bar)*0.92);
    gl_FragColor = vec4(col, 1.0); }`, { uC: { value: new THREE.Vector3(LH.x, 0, LH.z) }, uY0: { value: LH.y + 13.1 } }, { m: { side: THREE.DoubleSide } }));
  glass.position.y = 13.1 + 0.875; lh.add(glass);
  const domeP = [[1.16, 0], [1.08, 0.18], [0.82, 0.62], [0.42, 0.95], [0.16, 1.08], [0, 1.1]].map(([r, y]) => new THREE.Vector2(r, y));
  const metal = mat(/* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWP);
    vec3 col = vec3(0.10, 0.13, 0.22)*(ambient(N)*1.5 + moonL(N)) + vec3(0.25, 0.3, 0.5)*pow(max(dot(reflect(-uMoonDir, N), V), 0.0), 18.0)*0.5;
    col += vec3(0.4, 0.5, 1.0)*0.05; gl_FragColor = vec4(fogged(col, length(cameraPosition - vWP)), 1.0); }`);
  const dome = new THREE.Mesh(new THREE.LatheGeometry(domeP, 48), metal); dome.position.y = 14.85; lh.add(dome);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), metal); ball.position.y = 16.05; lh.add(ball);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), metal); rod.position.y = 16.7; lh.add(rod);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 3.4), mat(plainFS2('0.62, 0.65, 0.72'))); hb.position.set(4.3, 1.3, -1.6); lh.add(hb);
  const hr = new THREE.Mesh(prism(), mat(plainFS2('0.12, 0.15, 0.27'))); hr.scale.set(4.8, 1.5, 3.8); hr.rotation.y = Math.PI / 2; hr.position.set(4.3, 2.6, -1.6); lh.add(hr);
  const hw = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), new THREE.ShaderMaterial({ vertexShader: VS_BASIC, fragmentShader: 'void main(){ gl_FragColor = vec4(0.55, 0.62, 0.92, 1.0); }' }));
  hw.position.set(4.3, 1.45, -1.6 + 1.71); lh.add(hw);
}
function plainFS2(c) { return /* glsl */`varying vec3 vWP; varying vec3 vN; void main(){ vec3 N = normalize(vN);
  vec3 col = vec3(${c})*(ambient(N)*1.3 + moonL(N) + beamAt(vWP, N)*0.6); gl_FragColor = vec4(fogged(col, length(cameraPosition - vWP)), 1.0); }`; }

await pausa();
// ---------- haz volumétrico analítico (igual que v4) ----------
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
      float sinA = sqrt(den); float path = clamp(0.35 / max(sinA, 0.06), 1.0, 5.0);
      float along = smoothstep(0.0, 0.025, t/uLen) * exp(-t/uLen*1.7) * smoothstep(1.0, 0.7, t/uLen);
      vec3 pw = ro + rd*sc;
      float dust = 0.6 + 0.4*noise(pw.xz*0.09 + vec2(uTime*0.05, pw.y*0.07 - uTime*0.035));
      float a = core*along*dust*path*uK*uBeamI;
      gl_FragColor = vec4(mix(BEAM, vec3(0.86, 0.9, 1.0), clamp(a*0.9, 0.0, 0.65))*a, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
}
beamPivot.add(beamMesh(150, 0.6, 10, 0.62));
beamPivot.add(beamMesh(130, 0.3, 3.6, 0.8));
const back = new THREE.Group(); back.add(beamMesh(70, 0.5, 6, 0.12, -1)); back.rotation.x = Math.PI; beamPivot.add(back);

await pausa();
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
const lensGlow = sprite(0xb4c0ff, 9); lensGlow.position.copy(U.uLens.value); scene.add(lensGlow);
const lensCore = sprite(0xe8ecff, 2.6); lensCore.position.copy(U.uLens.value); scene.add(lensCore);
const flare = sprite(0x9aaaff, 60, 'streak'); flare.position.copy(U.uLens.value); scene.add(flare);
const flareHalo = sprite(0x7d8fff, 40); flareHalo.position.copy(U.uLens.value); scene.add(flareHalo);

await pausa();
// ---------- estaciones (una por capítulo del texto) ----------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const L = U.uLens.value;
const CAMK = {
  heroe: { pos: V3(-6, 54, 66), tgt: V3(100, 26, -312), fov: 40 },      // ventana vertical 5:7: Costanera al centro, faro abajo a la derecha
  servicios: { pos: V3(58, 74, 78), tgt: V3(-40, 0, -330), fov: 40 },
  local: { pos: V3(44, 52, 34), tgt: V3(-24, 5, -88), fov: 29 },
  analizador: { pos: V3(4, 17, -52), tgt: V3(-13.5, 3.4, -92), fov: 34 },
  lente: { pos: V3(L.x - 1, L.y - 3, L.z + 15), tgt: V3(L.x - 0.6, L.y + 0.8, L.z), fov: 30 },
  cumbre: { pos: V3(L.x + 10, L.y + 20, L.z + 80), tgt: V3(L.x - 10, L.y - 20, L.z - 300), fov: 46 },   // detrás del faro: su silueta contra la ciudad encendida
};
if (q.has('cam')) { const v = q.get('cam').split(',').map(Number); CAMK.dbg = { pos: V3(v[0], v[1], v[2]), tgt: V3(v[3], v[4], v[5]), fov: v[6] || 30 }; }
// beam: 'auto' (gira solo), {aim: i} (apunta a un local), {sweep: [az0, az1]} (lo mueve el scroll)
const ST = {
  heroe: { cam: 'heroe', beam: 'auto', lit: [0.62, 0.62] },
  servicios: { cam: 'servicios', beam: { sweep: [-0.95, -2.55] }, lit: [0.5, 1] },
  'local-0': { cam: 'local', beam: { aim: 0 }, lit: [1, 1], foco: 0 },
  'local-1': { cam: 'local', beam: { aim: 1 }, lit: [1, 1], foco: 1 },
  'local-2': { cam: 'local', beam: { aim: 2 }, lit: [1, 1], foco: 2 },
  analizador: { cam: 'analizador', beam: { aim: 1 }, lit: [1, 1], foco: 1, scan: true },
  lente: { cam: 'lente', beam: 'auto', lit: [1, 1], vel: 0.22 },
  cumbre: { cam: 'cumbre', beam: 'auto', lit: [1, 1] },
  locales: { cam: 'local', beam: { aim: 1 }, lit: [1, 1], foco: 9 },
  cartel: { cam: 'heroe', beam: 'auto', lit: [0.95, 0.95], foco: 9, azPoster: -2.32 },   // póster del banner: Santiago entero, el haz cruzando     // solo póster móvil: los tres encendidos
};
if (CAMK.dbg) ST.dbg = { cam: 'dbg', beam: q.has('az') ? { sweep: [+q.get('az'), +q.get('az')] } : 'auto', lit: [1, 1] };
const IDS = (window.__f3 && window.__f3.ids) || ['heroe'];
const BEAM_EL = -0.06, BEAM_SPEED = +(q.get('vel') || 0.16);
let vw = 1, vh = 1, time = 12, dirty = true, warm = 2;
const rtMain = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: SMALL ? 0 : 4 });
const composer = new EffectComposer(renderer, rtMain);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.55, 0.6, 0.74);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const paint = () => { bloom.enabled = BLOOM; composer.render(); };   // warm: cuadros forzados (al iniciar y al restaurar el contexto)
function measure() {
  vw = box.clientWidth || 1; vh = box.clientHeight || 1;
  renderer.setPixelRatio(DPR); renderer.setSize(vw, vh, false);
  composer.setPixelRatio(DPR); composer.setSize(vw, vh);
  camera.aspect = vw / vh; camera.updateProjectionMatrix(); H.dpr = DPR; dirty = true;
}
const tmp = new THREE.Vector3(), toCam = new THREE.Vector3();
const dirFromAz = (az, el, out) => out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
// estado puro de una estación con su progreso interno u (0..1)
function stState(id, u, out) {
  const st = ST[id] || ST.heroe, k = CAMK[st.cam];
  out.pos.copy(k.pos); out.tgt.copy(k.tgt); out.fov = k.fov;
  // deriva lenta dentro del capítulo: la cámara se acerca un 5 % mientras se lee (el scroll siempre mueve algo)
  out.pos.lerp(k.tgt, 0.05 * u);
  const b = st.beam;
  out.scanY = 0;
  if (b === 'auto') dirFromAz((POSTER || CAP) ? (st.azPoster || -2.6) : -2.25 - time * (st.vel || BEAM_SPEED), BEAM_EL, out.dir);
  else if (b.sweep) dirFromAz(lerp(b.sweep[0], b.sweep[1], smooth(0, 1, u)), BEAM_EL, out.dir);
  else {
    const s = shops[b.aim];
    if (st.scan) { const sy = lerp(s.y + 0.3, s.top + 0.4, smooth(0, 1, u)); out.dir.set(s.aim.x, sy, s.aim.z).sub(L).normalize(); out.scanY = sy; }
    else { out.dir.copy(s.aim).sub(L); out.dir.x += Math.sin(time * 0.9) * 0.35; out.dir.y += Math.sin(time * 0.63) * 0.12; out.dir.normalize(); }
  }
  out.lit = lerp(st.lit[0], st.lit[1], u);
  for (let i = 0; i < 3; i++) out.found[i] = st.foco === i || st.foco === 9 ? 1 : 0;
  out.scan = st.scan ? 1 : 0;
  out.auto = b === 'auto' ? 1 : 0;
  return out;
}
const mk = () => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), dir: new THREE.Vector3(), fov: 30, lit: 1, found: [0, 0, 0], scan: 0, scanY: 0, auto: 0 });
const SA = mk(), SB = mk(), S = mk();
let last = '';
function update(dt) {
  // ¿dónde va la lectura? (lo calcula la página: estación i, peso de paso w a la siguiente, progreso u dentro del capítulo)
  let id = POSTER || (CAMK.dbg ? 'dbg' : null), w = 0, u = 1, nid = null;
  if (!id && window.__f3 && window.__f3.pintar) window.__f3.pintar();
  if (!id) { const r = window.__f3 ? window.__f3.estado() : { i: 0, w: 0, u: 0 }; id = IDS[r.i]; nid = IDS[r.i + 1]; w = nid ? r.w : 0; u = r.u; }
  else u = POSTER === 'servicios' ? 0.7 : POSTER === 'analizador' ? 0.62 : 0.5;
  if (CAP && ST[id] && ST[id].beam === 'auto') time = 12;
  stState(id, u, SA);
  if (w > 0) {
    stState(nid, 0, SB);
    const lift = Math.min(SA.pos.distanceTo(SB.pos) * 0.18, 40) * Math.sin(Math.PI * w);
    S.pos.copy(SA.pos).lerp(SB.pos, w); S.pos.y += lift; S.tgt.copy(SA.tgt).lerp(SB.tgt, w); S.fov = lerp(SA.fov, SB.fov, w);
    S.dir.copy(SA.dir).lerp(SB.dir, w).normalize(); S.lit = lerp(SA.lit, SB.lit, w);
    for (let i = 0; i < 3; i++) S.found[i] = lerp(SA.found[i], SB.found[i], w);
    S.scan = lerp(SA.scan, SB.scan, w); S.scanY = SA.scan ? SA.scanY : SB.scanY; S.auto = w < 1 ? Math.max(SA.auto, SB.auto) : SB.auto;
  } else { S.pos.copy(SA.pos); S.tgt.copy(SA.tgt); S.fov = SA.fov; S.dir.copy(SA.dir); S.lit = SA.lit; S.found = SA.found.slice(); S.scan = SA.scan; S.scanY = SA.scanY; S.auto = SA.auto; }
  const moving = !CAP && !POSTER && !CAMK.dbg;
  const key = [S.pos.x, S.pos.y, S.pos.z, S.tgt.x, S.tgt.z, S.fov, S.dir.x, S.dir.y, S.dir.z, S.lit, S.scan, S.scanY].map((x) => x.toFixed(3)).join();
  if (key === last && !moving && !dirty && warm <= 0) return false;      // nada cambió: no se dibuja
  last = key; dirty = false; if (warm > 0) warm--;
  if (moving) time += dt;
  U.uTime.value = time;
  camera.position.copy(S.pos); camera.fov = S.fov; camera.updateProjectionMatrix(); camera.lookAt(S.tgt);
  U.uBeamDir.value.copy(S.dir); U.uLit.value = S.lit;
  beamPivot.quaternion.setFromUnitVectors(tmp.set(0, 1, 0), S.dir);
  SCAN.on.value = S.scan; SCAN.y.value = S.scanY;
  // destello cuando el haz mira a cámara: tope bajo; pegado a la lente, casi nada
  const lens = U.uLens.value, dir = S.dir;
  toCam.copy(camera.position).sub(lens).normalize();
  const f = Math.max(0, dir.x * toCam.x + dir.z * toCam.z) / Math.max(1e-3, Math.hypot(dir.x, dir.z) * Math.hypot(toCam.x, toCam.z));
  const fl = smooth(0.93, 1.0, f), dc = camera.position.distanceTo(lens), near = smooth(30, 12, dc);
  flare.material.opacity = fl * 0.32 * (1 - near); flareHalo.material.opacity = fl * 0.22 * (1 - near); lensGlow.material.opacity = (0.6 + fl * 0.15) * (1 - near * 0.7);
  flare.scale.set(dc * 0.8, dc * 0.04, 1); flareHalo.scale.setScalar(dc * (0.2 + fl * 0.15));
  shops.forEach((s, i) => { const on = S.found[i]; s.uFound.value = on; s.uShop.value.z = on; s.glow.material.opacity = on * 0.55; s.uMine.value = i === 1 ? 1 : 0; });
  return true;
}
// pines HTML sobre la ventana (nombres de los locales de ejemplo), proyectados desde el 3D
const pinEls = [...box.querySelectorAll('.pin')];
function pins() {
  camera.updateMatrixWorld();
  return shops.map((s, i) => { tmp.copy(s.pin).project(camera); const x = tmp.x * 0.5 + 0.5, y = -tmp.y * 0.5 + 0.5;
    if (pinEls[i] && !POSTER) { pinEls[i].style.left = '0'; pinEls[i].style.top = '0'; pinEls[i].style.transform = `translate(${(x * vw).toFixed(1)}px, ${(y * vh).toFixed(1)}px)`; pinEls[i].style.setProperty('--on', S.found[i].toFixed(3)); }
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
  if (H.frames >= 2 && H.modo !== 'vivo') { H.modo = 'vivo'; box.dataset.haz = 'vivo'; }
  // guardián de fps: solo mide cuadros seguidos que dibujaron
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
canvas.addEventListener('webglcontextrestored', () => { lost = false; H.restauradas++; H.frames = 0; H.modo = 'cargando'; warm = 2; measure(); calentar(); setRun(); });
H.perder = () => { const x = renderer.getContext().getExtension('WEBGL_lose_context'); x.loseContext(); setTimeout(() => x.restoreContext(), 1200); };
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
addEventListener('load', measure);

measure();
{ const k = CAMK[(ST[POSTER] || ST.heroe).cam]; camera.position.copy(k.pos); camera.lookAt(k.tgt); }
// Calentar: con ANGLE/D3D11 el primer dibujo de cada material desde un ángulo nuevo cuesta 50–100 ms aunque se haya
// compilado (los locales solo entran en cuadro desde la cámara «local»). Se dibuja una vez desde cada estación a un
// tamaño mínimo mientras la ventana todavía muestra el póster; después se vuelve al tamaño real.
function calentar() {
  if (POSTER || CAMK.dbg) return;
  const t0 = performance.now();
  renderer.setPixelRatio(1); renderer.setSize(64, 90, false);
  shops.forEach((s) => { s.uFound.value = 1; s.glow.material.opacity = 0.5; }); SCAN.on.value = 1;
  Object.values(CAMK).forEach((k) => { camera.position.copy(k.pos); camera.fov = k.fov; camera.aspect = 64 / 90; camera.updateProjectionMatrix(); camera.lookAt(k.tgt); renderer.render(scene, camera); });
  composer.setSize(64, 90); paint();
  SCAN.on.value = 0; measure(); H.calentarMs = Math.round(performance.now() - t0);
}
H.armarMs = Math.round(performance.now() - T0);
// Al iniciar en vivo: compilación en paralelo (KHR_parallel_shader_compile) y una estación por cuadro, para que la
// carga no congele el scroll (en un solo bloque eran ~870 ms seguidos).
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function calentarAsync() {
  const t0 = performance.now();
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  shops.forEach((s) => { s.uFound.value = 1; s.glow.material.opacity = 0.5; }); SCAN.on.value = 1;
  for (const k of Object.values(CAMK)) {
    await nextFrame();
    renderer.setPixelRatio(1); renderer.setSize(64, 90, false);
    camera.position.copy(k.pos); camera.fov = k.fov; camera.aspect = 64 / 90; camera.updateProjectionMatrix(); camera.lookAt(k.tgt); renderer.render(scene, camera);
  }
  await nextFrame(); composer.setSize(64, 90); paint();
  SCAN.on.value = 0; measure(); H.calentarMs = Math.round(performance.now() - t0);
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
