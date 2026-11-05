// Faro° — banner del faro (portada). WebGL1, un solo shader sobre la foto; sin librerías.
// - Haz volumétrico analítico: por píxel, distancia del rayo de vista al eje del haz en 3D (no un triángulo plano).
//   Dos haces opuestos, como un lente Fresnel que gira; destello y raya anamórfica cuando uno mira a cámara.
// - El punto principal de la cámara está en el horizonte de la foto: el haz lejano converge al horizonte.
// - Bruma (fbm) que deriva y le da cuerpo al haz, estrellas que titilan solo en el cielo, brillo del mar.
// - Scroll: empuja el giro del haz (con inercia) y mueve foto, estrellas y bruma a distinta velocidad.
// - Se pausa fuera de pantalla y con la pestaña oculta; guardián de fps por tiempo (baja resolución o vuelve a la foto).
// Lo carga FaroBanner.astro solo si hay WebGL y movimiento permitido. Sin esto, la foto queda quieta.
(function () {
  var fig = document.querySelector('[data-faro]');
  if (!fig) return;
  var cv = fig.querySelector('canvas'), img = fig.querySelector('img');
  var gl;
  try { gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, depth: false, stencil: false, powerPreference: 'default' }); } catch (e) {}
  if (!gl) return;

  // Geometría medida en las imágenes originales (tools/out/rediseno-2026-11/img/originales, 5-nov-2026).
  // lamp: centro de la linterna; hz: horizonte; ridge: línea de las rocas (x0,y0 → x1,y1 → 1,y2); tower: caja del faro.
  var GEO = {
    h: { lamp: [0.8383, 0.4783], hz: 0.717, ridge: [0.50, 0.66, 0.78, 0.625, 0.565], tower: [0.805, 0.87, 0.42], pos: [0, 0.62] },
    v: { lamp: [0.8139, 0.6853], hz: 0.770, ridge: [0.44, 0.745, 0.78, 0.732, 0.73], tower: [0.785, 0.835, 0.665], pos: [0, 0.85] },
  };

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform sampler2D T;uniform vec2 R,Lp,C;uniform vec4 B,M1;uniform vec3 M2;uniform float D,F,A,Z,Hs,Fg,Hz,M0;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}',
    'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    // luz dispersada por un haz gaussiano que nace en L con dirección b, vista por el rayo v (cámara en el origen)
    'float tube(vec3 v,vec3 L,vec3 b){',
    ' float c=dot(v,b),dd=-dot(v,L),e=-dot(b,L),den=max(1.-c*c,1e-4);',
    ' float tb=max((e-c*dd)/den,0.);',
    ' vec3 P=L+tb*b;float tr=max(dot(v,P),0.);vec3 q=tr*v-P;',
    ' float sg=.55+tb*.06;',
    ' return exp(-dot(q,q)/(2.*sg*sg))*exp(-tb/160.)*min(2.4,.5/sqrt(den))*pow(.55/sg,.5)*smoothstep(2.,14.,P.z);',
    '}',
    'void main(){',
    ' vec2 px=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y)/D;',
    ' vec2 uv=(px-B.xy)/B.zw;',
    ' vec3 c=texture2D(T,clamp(uv,0.,1.)).rgb;',
    // máscaras en coordenadas de la foto: cielo (sobre las rocas y fuera de la torre) y mar
    ' float rg=uv.x<M1.x?Hz:(uv.x<M1.z?mix(M1.y,M1.w,(uv.x-M1.x)/(M1.z-M1.x)):mix(M1.w,M0,(uv.x-M1.z)/(1.-M1.z)));',
    ' rg=min(rg,Hz);',
    ' float tw=step(M2.x,uv.x)*step(uv.x,M2.y)*step(M2.z,uv.y);',
    ' float sky=smoothstep(rg-.004,rg-.03,uv.y)*(1.-tw);',
    ' float sea=smoothstep(Hz,Hz+.015,uv.y);',
    // estrellas: campo propio más lejano (se mueve distinto que la foto con el scroll) y titilan
    ' vec2 sp=px+vec2(0.,Hs);vec2 ce=floor(sp/3.);vec2 fr=fract(sp/3.)-.5;float hs=h(ce);',
    ' float st=step(.9972,hs)*exp(-dot(fr,fr)*16.)*(.3+.7*h(ce+7.));',
    ' c+=st*sky*vec3(.72,.79,1.)*(.45+.55*sin(Z*(1.3+hs*2.7)+hs*70.))*smoothstep(1.,.35,uv.y/max(rg,.01));',
    // mar: el brillo de la espuma en larga exposición se mueve despacio
    ' float fo=smoothstep(.28,.6,c.b)*sea;',
    ' c+=fo*(fb(vec2(px.x*.0045+Z*.045,px.y*.022-Z*.028))-.5)*.32*c;',
    // bruma que deriva (más cerca que la foto: el scroll la mueve más)
    ' vec2 fp=px*.0032+vec2(Z*.02,-Z*.005)+vec2(0.,Fg*.0032);',
    ' float fog=fb(fp);float fl=fb(fp*.45+vec2(-Z*.01,0.));',
    ' c+=vec3(.32,.42,.86)*.07*fog*fl*smoothstep(Hz-.35,Hz-.02,uv.y)*(1.-sea*.6);',
    // el haz: cámara con punto principal en el horizonte (C), linterna a 100 unidades
    ' vec3 v=normalize(vec3((px-C)/F,1.));',
    ' vec3 L=vec3((Lp-C)/F,1.)*100.;',
    ' vec3 b=normalize(vec3(cos(A),.03,sin(A)));',
    ' float dn=.18+1.9*smoothstep(.22,.78,fog)*(.45+fl);',
    ' float bm=(tube(v,L,b)+tube(v,L,-b))*dn;',
    ' vec3 lc=vec3(.80,.86,1.);',
    ' c+=lc*bm*1.25;',
    ' c+=lc*bm*.35*sea;',
    // destello: cuando uno de los dos haces apunta a la cámara
    ' vec3 tc=normalize(-L);float k=pow(abs(dot(b,tc)),26.);',
    ' vec2 dl=px-Lp;float r2=dot(dl,dl);float g=4.5+k*80.;',
    ' c+=lc*(.55*exp(-r2/14.)+(.22+k*1.1)*exp(-r2/(2.*g*g)));',
    ' c+=lc*k*.45*exp(-abs(dl.y)/2.2)*exp(-abs(dl.x)/(420.*k+1.));',
    ' c=1.-exp(-c*1.08-c*c*.12);',
    ' c+=(h(px+fract(Z*7.))-.5)*.028;',
    ' gl_FragColor=vec4(c,1.);',
    '}'].join('\n');

  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; 'T R Lp C B M1 M2 D F A Z Hs Fg Hz M0'.split(' ').forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });

  var small = matchMedia('(max-width: 640px)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, small ? 1 : 1.25), geo = GEO.h, ready = false;
  var G = {}, S = { t: 0, phi: 2.2, push: 0, sy: window.scrollY, prog: 0.5, sh: 0 };

  function measure() {
    var r = fig.getBoundingClientRect(), W = r.width, H = r.height;
    var iw = img.naturalWidth || 1536, ih = img.naturalHeight || 1024;
    geo = iw < ih ? GEO.v : GEO.h;
    // misma geometría que el CSS: caja del 110 % corrida -5 %, object-fit: cover, object-position (pos)
    var BW = W * 1.1, BH = H * 1.1, s = Math.max(BW / iw, BH / ih), dw = iw * s, dh = ih * s;
    G = { W: W, H: H, ox: -0.05 * W + (BW - dw) * geo.pos[0], oy: -0.05 * H + (BH - dh) * geo.pos[1], dw: dw, dh: dh };
    var w = Math.min(Math.round(W * dpr), 1600), h = Math.round(H * (w / W));
    G.d = w / W;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  }

  function draw() {
    var oy = G.oy + S.sh * G.H;
    var lx = G.ox + G.dw * geo.lamp[0], ly = oy + G.dh * geo.lamp[1], hzy = oy + G.dh * geo.hz;
    gl.uniform2f(U.R, cv.width, cv.height); gl.uniform1f(U.D, G.d);
    gl.uniform4f(U.B, G.ox, oy, G.dw, G.dh);
    gl.uniform2f(U.Lp, lx, ly); gl.uniform2f(U.C, G.W / 2, hzy); gl.uniform1f(U.F, G.H * 1.25);
    gl.uniform4f(U.M1, geo.ridge[0], geo.ridge[1], geo.ridge[2], geo.ridge[3]); gl.uniform1f(U.M0, geo.ridge[4]);
    gl.uniform3f(U.M2, geo.tower[0], geo.tower[1], geo.tower[2]); gl.uniform1f(U.Hz, geo.hz);
    gl.uniform1f(U.A, S.phi); gl.uniform1f(U.Z, S.t);
    gl.uniform1f(U.Hs, (S.prog - 0.5) * G.H * 0.2); gl.uniform1f(U.Fg, (S.prog - 0.5) * G.H * -0.35);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Capturas: ?faro=<ángulo> fija el haz (sin giro propio) para mostrar cuadros exactos.
  var FIX = /[?&]faro=(-?[\d.]+)/.exec(location.search); FIX = FIX ? +FIX[1] : null;
  var raf = 0, last = 0, onScreen = false, times = [], warm = 0, stage = 0;
  function tick(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; S.t += dt;
    // scroll: el desplazamiento empuja el giro (con inercia) y define el avance por el banner (0 = entra, 1 = sale)
    var y = window.scrollY, dy = y - S.sy; S.sy = y;
    S.push += dy * 0.0042; var take = S.push * Math.min(1, dt * 7); S.push -= take;
    S.phi = FIX !== null ? FIX + take : S.phi + dt * 0.4 + take;
    var r = fig.getBoundingClientRect(), vh = window.innerHeight;
    S.prog = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
    S.sh = (S.prog - 0.5) * 0.09;
    draw();
    guard(now, dt);
    if (onScreen && !document.hidden && stage < 2) raf = requestAnimationFrame(tick);
  }
  // Guardián por tiempo: calienta 0,6 s; ventanas de 1,2 s. Mediana > 25 ms → menos resolución; sigue > 34 ms → foto.
  function guard(now, dt) {
    warm += dt; if (warm < 0.6) return;
    times.push(dt * 1000);
    if (times.reduce(function (a, b) { return a + b; }, 0) < 1200) return;
    var m = times.slice().sort(function (a, b) { return a - b; })[times.length >> 1]; times = [];
    if (m > 34 && stage === 1) { stage = 2; cv.classList.remove('on'); return; }
    if (m > 25 && stage === 0) { stage = 1; dpr = Math.max(0.6, dpr * 0.66); measure(); }
  }
  function go() { if (!raf && ready && onScreen && !document.hidden && stage < 2) { last = 0; raf = requestAnimationFrame(tick); } }

  var tx = gl.createTexture();
  function upload() {
    try {
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      return true;
    } catch (e) { return false; }
  }
  function start() {
    if (!upload()) return;
    gl.uniform1i(U.T, 0);
    // si cambia la variante de la foto (p. ej. al girar el celular), se vuelve a subir y medir
    img.addEventListener('load', function () { if (upload()) { measure(); draw(); } });
    measure(); ready = true;
    S.prog = 0.5; draw();
    requestAnimationFrame(function () { cv.classList.add('on'); });
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; go(); }).observe(fig);
    document.addEventListener('visibilitychange', go);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { measure(); if (ready) draw(); }, 120); });
  }
  // si el navegador pierde el contexto, queda la foto (no se reintenta)
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); ready = false; stage = 2; cv.classList.remove('on'); });
  if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
})();
