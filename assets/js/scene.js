/* ==========================================================================
   Narne Labs — WebGL scene
   An iridescent noise-displaced orb with orbit rings, plus a GPU particle
   field that morphs between five formations as the visitor scrolls:
     0 galaxy · 1 wave terrain · 2 torus knot · 3 planet + ring · 4 Kalki brand mark
   ========================================================================== */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const canvas = document.querySelector('canvas.webgl');
const mode = document.body.dataset.scene || 'full';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;
const ready = () => window.dispatchEvent(new Event('nl:scene-ready'));

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}


/* ---------- GLSL: 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) ---------- */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const BRAND = /* glsl */ `
vec3 brand(float t){
  vec3 c1=vec3(0.545,0.424,1.0); vec3 c2=vec3(0.133,0.827,0.933); vec3 c3=vec3(1.0,0.306,0.804);
  t=fract(t)*3.0;
  if(t<1.0) return mix(c1,c2,smoothstep(0.0,1.0,t));
  if(t<2.0) return mix(c2,c3,smoothstep(0.0,1.0,t-1.0));
  return mix(c3,c1,smoothstep(0.0,1.0,t-2.0));
}`;

function init() {
  const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  let DPR = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; document.documentElement.classList.add('no-webgl'); });
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const world = new THREE.Group();
  scene.add(world);

  /* ------------------------------------------------------------------ Orb */
  const orbGroup = new THREE.Group();
  const orbUniforms = {
    uTime: { value: 0 }, uAmp: { value: 0.28 }, uFreq: { value: 1.25 }, uAlpha: { value: 1 },
  };
  if (mode === 'full') {
    const orbGeo = new THREE.IcosahedronGeometry(1.25, lowPower ? 24 : 48);
    const orbMat = new THREE.ShaderMaterial({
      uniforms: orbUniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uAmp; uniform float uFreq;
        varying vec3 vNormal; varying vec3 vView; varying float vDisp;
        ${NOISE}
        float disp(vec3 n){
          return snoise(n*uFreq+vec3(uTime*0.22))*uAmp + snoise(n*uFreq*2.6-vec3(uTime*0.14))*uAmp*0.22;
        }
        void main(){
          float r=length(position); vec3 n=normalize(position);
          float d=disp(n); vec3 P=n*(r+d);
          vec3 t=normalize(abs(n.y)>0.99?cross(n,vec3(1.0,0.0,0.0)):cross(n,vec3(0.0,1.0,0.0)));
          vec3 b=normalize(cross(n,t)); float e=0.015;
          vec3 n1=normalize(n+t*e); vec3 P1=n1*(r+disp(n1));
          vec3 n2=normalize(n+b*e); vec3 P2=n2*(r+disp(n2));
          vec3 N=normalize(cross(P1-P,P2-P)); if(dot(N,n)<0.0) N=-N;
          vDisp=d;
          vec4 mv=modelViewMatrix*vec4(P,1.0);
          vView=normalize(-mv.xyz); vNormal=normalize(normalMatrix*N);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uAlpha;
        varying vec3 vNormal; varying vec3 vView; varying float vDisp;
        ${BRAND}
        void main(){
          vec3 N=normalize(vNormal); vec3 V=normalize(vView);
          float fres=pow(1.0-max(dot(N,V),0.0),2.0);
          vec3 irid=brand(fres*0.85+vDisp*1.4+uTime*0.035);
          vec3 col=mix(vec3(0.04,0.03,0.1),irid,0.38+fres*0.75);
          vec3 L1=normalize(vec3(0.8,1.0,0.9)); vec3 L2=normalize(vec3(-1.0,-0.4,0.6));
          float s1=pow(max(dot(reflect(-L1,N),V),0.0),28.0);
          float s2=pow(max(dot(reflect(-L2,N),V),0.0),12.0);
          col+=s1*vec3(1.0)*0.75+s2*vec3(0.13,0.83,0.93)*0.35;
          col+=pow(fres,3.0)*vec3(0.6,0.45,1.0)*0.9;
          gl_FragColor=vec4(col,uAlpha);
        }`,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orbGroup.add(orb);

    // Halo sprite
    const haloTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d'); const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, 'rgba(139,108,255,0.55)'); grd.addColorStop(0.35, 'rgba(34,211,238,0.16)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })();
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.position.z = -1.2;
    orbGroup.add(halo);

    // Wire shell
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.9, 1)),
      new THREE.LineBasicMaterial({ color: 0x8b6cff, transparent: true, opacity: 0.12 })
    );
    orbGroup.add(shell);

    // Orbit rings with "moons" — a little pradakshina in 3D
    const rings = [];
    const ringDefs = [
      { r: 2.35, tilt: [1.2, 0.2, 0], color: 0x22d3ee, speed: 0.55 },
      { r: 2.8, tilt: [1.45, -0.5, 0.3], color: 0xff4ecd, speed: -0.38 },
      { r: 3.25, tilt: [1.05, 0.6, -0.2], color: 0x8b6cff, speed: 0.26 },
    ];
    for (const d of ringDefs) {
      const pivot = new THREE.Group();
      pivot.rotation.set(...d.tilt);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, 0.0065, 6, 220),
        new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 16),
        new THREE.MeshBasicMaterial({ color: d.color })
      );
      const moonGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshBasicMaterial({ map: haloTex, color: d.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      moon.add(moonGlow);
      pivot.add(ring, moon);
      orbGroup.add(pivot);
      rings.push({ pivot, moon, glow: moonGlow, ...d });
    }
    orbGroup.userData = { orb, shell, rings, halo };
    world.add(orbGroup);
  }

  /* ------------------------------------------------------------ Particles */
  const COUNT = mode === 'full' ? (lowPower ? 6000 : 15000) : (lowPower ? 2500 : 6000);
  const shapes = [new Float32Array(COUNT * 3), new Float32Array(COUNT * 3), new Float32Array(COUNT * 3), new Float32Array(COUNT * 3), new Float32Array(COUNT * 3)];
  const rand = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT * 3);
  const palette = [new THREE.Color('#8b6cff'), new THREE.Color('#22d3ee'), new THREE.Color('#ff4ecd'), new THREE.Color('#ffffff')];
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
  const set = (arr, i, x, y, z) => { arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z; };

  // 0: Galaxy (tilted spiral disc + scattered stars)
  const tilt = new THREE.Euler(1.05, 0, 0.35);
  const v = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    if (i % 9 === 0) {
      v.set(gauss() * 14, gauss() * 9, gauss() * 6 - 2);
      set(shapes[0], i, v.x, v.y, v.z);
      continue;
    }
    const r = 1.7 + Math.pow(Math.random(), 1.6) * 3.6;
    const arm = (i % 3) / 3 * Math.PI * 2;
    const a = arm + r * 0.95 + gauss() * 0.35;
    v.set(Math.cos(a) * r, gauss() * 0.12 * (5.5 - r) * 0.5, Math.sin(a) * r);
    v.x += gauss() * 0.15; v.z += gauss() * 0.15;
    v.applyEuler(tilt);
    set(shapes[0], i, v.x, v.y, v.z);
  }

  // 1: Wave terrain (grid)
  const side = Math.ceil(Math.sqrt(COUNT));
  for (let i = 0; i < COUNT; i++) {
    const gx = (i % side) / side, gz = Math.floor(i / side) / side;
    set(shapes[1], i, (gx - 0.5) * 18, -2.0, (gz - 0.5) * 12 - 1.5);
  }

  // 2: Torus knot (p=2, q=3) with tube scatter
  for (let i = 0; i < COUNT; i++) {
    const t = (i / COUNT) * Math.PI * 2;
    const p = 2, q = 3, R = 1.75, rr = 0.75;
    const cx = (R + rr * Math.cos(q * t)) * Math.cos(p * t);
    const cy = (R + rr * Math.cos(q * t)) * Math.sin(p * t);
    const cz = rr * Math.sin(q * t);
    const s = 0.22 * Math.pow(Math.random(), 0.7);
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    set(shapes[2], i, cx + s * Math.sin(ph) * Math.cos(th), cy + s * Math.sin(ph) * Math.sin(th), cz + s * Math.cos(ph));
  }

  // 3: Planet (fibonacci sphere) + ring
  const golden = Math.PI * (3 - Math.sqrt(5));
  const planetN = Math.floor(COUNT * 0.62);
  const ringTilt = new THREE.Euler(1.2, 0.3, -0.25);
  for (let i = 0; i < COUNT; i++) {
    if (i < planetN) {
      const y = 1 - (i / (planetN - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      const R = 2.1 + gauss() * 0.04;
      set(shapes[3], i, Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R);
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = 2.9 + Math.pow(Math.random(), 0.8) * 1.6;
      v.set(Math.cos(a) * r, gauss() * 0.04, Math.sin(a) * r).applyEuler(ringTilt);
      set(shapes[3], i, v.x, v.y, v.z);
    }
  }

  // 4: "N" logo — rounded-square frame + three strokes
  const S = isMobile ? 2.2 : 2.8; // half-size of the frame
  const strokeN = Math.floor(COUNT * 0.62);
  const nx = S * 0.42, ny = S * 0.52;
  const strokes = [[-nx, -ny, -nx, ny], [-nx, ny, nx, -ny], [nx, -ny, nx, ny]];
  for (let i = 0; i < COUNT; i++) {
    if (i < strokeN) {
      const [x1, y1, x2, y2] = strokes[i % 3];
      const t = Math.random();
      set(shapes[4], i, x1 + (x2 - x1) * t + gauss() * 0.11, y1 + (y2 - y1) * t + gauss() * 0.11, gauss() * 0.25);
    } else {
      // rounded rectangle perimeter
      const rc = S * 0.3, L = S - rc;
      const seg = Math.random() * (8 * L + 2 * Math.PI * rc);
      let x, y;
      if (seg < 2 * L) { x = -L + seg; y = S; }
      else if (seg < 4 * L) { x = S; y = L - (seg - 2 * L); }
      else if (seg < 6 * L) { x = L - (seg - 4 * L); y = -S; }
      else if (seg < 8 * L) { x = -S; y = -L + (seg - 6 * L); }
      else {
        const a = ((seg - 8 * L) / rc);
        const corner = Math.floor(a / (Math.PI / 2));
        const ang = a - corner * Math.PI / 2;
        const cs = [[L, L, 0], [L, -L, -Math.PI / 2], [-L, -L, Math.PI], [-L, L, Math.PI / 2]][corner % 4];
        x = cs[0] + Math.cos(cs[2] + ang) * rc; y = cs[1] + Math.sin(cs[2] + ang) * rc;
      }
      set(shapes[4], i, x + gauss() * 0.05, y + gauss() * 0.05, gauss() * 0.12);
    }
  }

  for (let i = 0; i < COUNT; i++) {
    rand[i] = Math.random();
    const r = Math.random();
    const c = r < 0.08 ? palette[3] : palette[Math.floor(Math.random() * 3)];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(shapes[0], 3));
  shapes.forEach((arr, k) => pGeo.setAttribute('aP' + k, new THREE.BufferAttribute(arr, 3)));
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);

  // 4 (brand): once the Kalki mark loads, resample formation 4 from its silhouette; the N above stays as fallback
  if (mode === 'full') {
    const img = new Image();
    img.onload = () => {
      const H = 240, Wd = Math.round(H * (img.naturalWidth / img.naturalHeight || 0.82));
      const c = document.createElement('canvas'); c.width = Wd; c.height = H;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, Wd, H);
      const data = g.getImageData(0, 0, Wd, H).data;
      const pts = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) if (data[(y * Wd + x) * 4 + 3] > 128) pts.push(x, y);
      if (!pts.length) return;
      const n = pts.length / 2, k = (isMobile ? 5 : 5.8) / H;
      for (let i = 0; i < COUNT; i++) {
        const j = Math.floor(Math.random() * n) * 2;
        set(shapes[4], i, (pts[j] - Wd / 2 + Math.random()) * k, -(pts[j + 1] - H / 2 + Math.random()) * k, gauss() * 0.1);
      }
      pGeo.attributes.aP4.needsUpdate = true;
    };
    img.src = '/assets/img/kalki.svg';
  }

  const pUniforms = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uPixelRatio: { value: DPR },
    uMouse: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 }, uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(22.5)) },
    uAlpha: { value: 0 }, uSize: { value: isMobile ? 26 : 30 }, uRepel: { value: reduceMotion ? 0 : 1 },
  };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uMorph; uniform float uPixelRatio; uniform vec2 uMouse;
      uniform float uAspect; uniform float uTanHalfFov; uniform float uSize; uniform float uRepel;
      attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aP3; attribute vec3 aP4;
      attribute float aRand; attribute vec3 aColor;
      varying vec3 vColor; varying float vTw;
      float w(float k){ return smoothstep(0.0,1.0,clamp((uMorph-k)*1.6-aRand*0.6,0.0,1.0)); }
      void main(){
        vec3 p=aP0;
        p=mix(p,aP1,w(0.0)); p=mix(p,aP2,w(1.0)); p=mix(p,aP3,w(2.0)); p=mix(p,aP4,w(3.0));
        // terrain wave
        float wave=clamp(1.0-abs(uMorph-1.0),0.0,1.0);
        p.y+=(sin(p.x*0.7+uTime*0.9)*0.45+cos(p.z*0.9+uTime*0.6)*0.35)*wave;
        // drift during transitions + idle shimmer
        float trans=1.0-abs(fract(uMorph)-0.5)*2.0; trans=clamp(trans,0.0,1.0);
        float ph=aRand*6.2831;
        p+=vec3(sin(uTime*0.5+ph+p.y),cos(uTime*0.4+ph*1.3+p.x),sin(uTime*0.45+ph*0.7))*(0.035+trans*0.6*aRand);
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        // mouse repulsion in view space
        float depth=-mv.z;
        vec2 m=uMouse*vec2(uAspect,1.0)*depth*uTanHalfFov;
        vec2 d=mv.xy-m; float dist=length(d);
        float f=smoothstep(1.5,0.0,dist)*uRepel;
        mv.xy+=normalize(d+1e-4)*f*0.75;
        gl_Position=projectionMatrix*mv;
        float size=uSize*(0.35+aRand*aRand*1.1);
        gl_PointSize=size*uPixelRatio/depth;
        vColor=aColor+f*0.6;
        vTw=0.6+0.4*sin(uTime*2.0+ph*5.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; varying vec3 vColor; varying float vTw;
      void main(){
        float d=length(gl_PointCoord-0.5);
        float a=smoothstep(0.5,0.0,d); a*=a;
        if(a<0.01) discard;
        gl_FragColor=vec4(vColor*uAlpha*vTw,a);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  world.add(points);

  /* -------------------------------------------------------------- State */
  const mouse = new THREE.Vector2(0, 0);
  const mouseTarget = new THREE.Vector2(9, 9);
  const parallax = new THREE.Vector2(0, 0);
  const orbScreen = new THREE.Vector2(0.45, 0);
  let morphTarget = 0;
  let spin = 0;
  let heroProgress = 0;
  let vw = 0, vh = 0;
  let introT = 0;
  const sections = [...document.querySelectorAll('[data-shape]')];

  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.position.z = camera.aspect < 0.8 ? 11 : 8;
    camera.updateProjectionMatrix();
    pUniforms.uAspect.value = camera.aspect;
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouseTarget.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1);
    parallax.set(mouseTarget.x, mouseTarget.y);
  }, { passive: true });
  document.addEventListener('mouseleave', () => mouseTarget.set(9, 9));

  function readScroll() {
    const y = window.scrollY;
    heroProgress = Math.min(Math.max(y / (vh * 0.9), 0), 1);
    if (mode !== 'full') { morphTarget = Number(document.body.dataset.shape || 0); return; }
    let target = 0;
    for (const s of sections) {
      if (s.getBoundingClientRect().top < vh * 0.55) target = Number(s.dataset.shape);
    }
    morphTarget = target;
  }

  /* -------------------------------------------------------------- Loop */
  const clock = new THREE.Clock();
  let time = 0;
  let running = true;
  let firstFrame = true;
  const perf = { frames: 0, total: 0 };
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); tick(); } });

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const speed = reduceMotion ? 0.15 : 1;
    time += dt * speed;
    introT = Math.min(introT + dt * 0.6, 1);
    readScroll();

    // Morph easing
    const m = pUniforms.uMorph;
    m.value += (morphTarget - m.value) * Math.min(dt * 2.2, 1);
    if (Math.abs(morphTarget - m.value) < 0.0005) m.value = morphTarget;

    // Mouse smoothing
    mouse.lerp(mouseTarget, Math.min(dt * 6, 1));
    pUniforms.uMouse.value.copy(mouse);
    pUniforms.uTime.value = time;

    // Logo state faces camera
    const wLogo = Math.min(Math.max(m.value - 3, 0), 1);
    if (wLogo < 0.001) spin += dt * 0.07 * speed;
    const wrapped = ((spin + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    points.rotation.y = wrapped * (1 - wLogo) + Math.sin(time * 0.6) * 0.22 * wLogo;
    points.rotation.x = Math.sin(time * 0.4) * 0.05 * wLogo;

    // World placement (hero: visual on the right on wide screens)
    const wide = camera.aspect > 1.15;
    orbScreen.set(wide ? 0.45 : 0.5, wide ? 0 : 0.5);
    const ease = heroProgress * heroProgress * (3 - 2 * heroProgress);
    const heroX = mode === 'full' ? (wide ? 2.35 : 0) : (wide ? 3.2 : 1.2);
    // portrait phones: tuck the orb top-right behind the headline so body copy stays readable
    world.position.x = mode === 'full' ? (wide ? heroX : 1.35) * (1 - ease) : heroX;
    world.position.y = mode === 'full' ? (wide ? 0 : 2.2) * (1 - ease) : 0;

    // Intro fade
    const intro = 1 - Math.pow(1 - introT, 3);
    let pAlpha = mode === 'full' ? (m.value > 3.5 ? 0.75 : 1) : 0.55;
    if (!wide && mode === 'full' && heroProgress < 1) pAlpha *= 0.85;
    pUniforms.uAlpha.value = pAlpha * intro;

    // Orb
    if (orbGroup.userData.orb) {
      const { orb, shell, rings, halo } = orbGroup.userData;
      const vis = Math.max(1 - ease * 1.25, 0);
      orbGroup.visible = vis > 0.01;
      const sc = (0.6 + 0.4 * intro) * (1 - ease * 0.45) * (wide ? 1 : 0.62);
      orbGroup.scale.setScalar(sc);
      orbGroup.position.y = ease * 1.8;
      orbUniforms.uTime.value = time;
      orbUniforms.uAlpha.value = vis * intro;
      // excite orb when the cursor is near it
      const near = Math.max(0, 1 - mouse.distanceTo(orbScreen) * 1.4);
      orbUniforms.uAmp.value += ((0.26 + near * 0.18) - orbUniforms.uAmp.value) * Math.min(dt * 3, 1);
      orb.rotation.y = time * 0.15;
      shell.rotation.set(time * 0.05, time * 0.08, 0);
      shell.material.opacity = 0.12 * vis;
      halo.material.opacity = vis;
      for (const r of rings) {
        const a = time * r.speed;
        r.moon.position.set(Math.cos(a) * r.r, Math.sin(a) * r.r, 0);
        r.pivot.children[0].material.opacity = 0.35 * vis;
        r.glow.material.opacity = vis;
        r.glow.quaternion.copy(camera.quaternion);
      }
      halo.quaternion.copy(camera.quaternion);
    }

    // Camera parallax
    camera.position.x += (parallax.x * 0.45 - camera.position.x) * Math.min(dt * 2, 1);
    camera.position.y += (parallax.y * 0.3 - camera.position.y) * Math.min(dt * 2, 1);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; ready(); }
    else if (perf.frames < 120) {
      perf.frames++; perf.total += dt;
      if (perf.frames === 120 && perf.total / 120 > 1 / 40) {
        // struggling device: drop resolution and half the particles
        DPR = 1; renderer.setPixelRatio(1); resize();
        pGeo.setDrawRange(0, Math.floor(COUNT / 2));
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}

/* ---------- Boot ---------- */
if (!canvas || !supportsWebGL()) {
  document.documentElement.classList.add('no-webgl');
  ready();
} else {
  try { init(); } catch (err) {
    console.warn('[narnelabs] WebGL scene disabled:', err);
    document.documentElement.classList.add('no-webgl');
    ready();
  }
}
