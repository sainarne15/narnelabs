/* Prototype: the Kalki brand mark extruded into a 3D emblem.
   Finishes via ?v=iridescent | gold | chrome */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const finish = params.get('v') || 'iridescent';
const canvas = document.querySelector('canvas.webgl');
const isMobile = matchMedia('(max-width: 760px)').matches;
const ready = () => window.dispatchEvent(new Event('nl:scene-ready'));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 11);

// Reflections: a neutral studio environment, then coloured rim lights for the brand palette
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 4, 6); scene.add(key);
const rimA = new THREE.PointLight(0x8b6cff, 60, 30); rimA.position.set(-5, 2, -2); scene.add(rimA);
const rimB = new THREE.PointLight(0x22d3ee, 50, 30); rimB.position.set(5, -2, -1); scene.add(rimB);
const sweep = new THREE.PointLight(0xffffff, 0, 9); scene.add(sweep); // travelling glint

const emblem = new THREE.Group();
scene.add(emblem);

const FINISHES = {
  iridescent: {
    face: { color: 0x060609, metalness: 0.35, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04 },
    side: { color: 0xb9a6ff, metalness: 1, roughness: 0.16, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620] },
    spark: [0x8b6cff, 0x22d3ee, 0xff4ecd],
  },
  gold: {
    face: { color: 0x07070a, metalness: 0.4, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 },
    side: { color: 0xffc25a, metalness: 1, roughness: 0.2 },
    spark: [0xffd27a, 0xffa24c, 0xfff1c8],
  },
  chrome: {
    face: { color: 0xd8dbe6, metalness: 1, roughness: 0.08 },
    side: { color: 0xeef0ff, metalness: 1, roughness: 0.12 },
    spark: [0xffffff, 0x9fe8ff, 0xc9b8ff],
  },
};
const F = FINISHES[finish] || FINISHES.iridescent;
const faceMat = new THREE.MeshPhysicalMaterial(F.face);
const sideMat = new THREE.MeshPhysicalMaterial(F.side);

// Sparks streaming off the sword tip
const SPARKS = isMobile ? 160 : 320;
const sparkGeo = new THREE.BufferGeometry();
const sPos = new Float32Array(SPARKS * 3), sVel = new Float32Array(SPARKS * 3), sLife = new Float32Array(SPARKS), sCol = new Float32Array(SPARKS * 3);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
const sparkTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.09, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
const tip = new THREE.Vector3();          // sword tip in emblem-local space, set after load
const sparkColors = F.spark.map((c) => new THREE.Color(c));
function respawn(i) {
  sPos[i * 3] = tip.x + (Math.random() - 0.5) * 0.12; sPos[i * 3 + 1] = tip.y + (Math.random() - 0.5) * 0.12; sPos[i * 3 + 2] = tip.z + (Math.random() - 0.5) * 0.3;
  sVel[i * 3] = (Math.random() - 0.3) * 0.9; sVel[i * 3 + 1] = 0.4 + Math.random() * 1.2; sVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
  sLife[i] = Math.random();
  const c = sparkColors[Math.floor(Math.random() * sparkColors.length)];
  sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
}

// Background dust
const DUST = isMobile ? 500 : 1200;
const dPos = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) { dPos[i * 3] = (Math.random() - 0.5) * 30; dPos[i * 3 + 1] = (Math.random() - 0.5) * 18; dPos[i * 3 + 2] = -Math.random() * 14 - 1; }
const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.035, color: 0x9aa0ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, map: sparkTex }));
scene.add(dust);

// Halo behind the emblem
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  const tint = finish === 'gold' ? '255,170,80' : '139,108,255';
  r.addColorStop(0, `rgba(${tint},0.55)`); r.addColorStop(0.45, `rgba(${tint},0.12)`); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
})();
const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
halo.position.z = -2.5;
scene.add(halo);

new SVGLoader().load('/assets/img/kalki.svg', (data) => {
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 110, bevelEnabled: true, bevelThickness: 22, bevelSize: 9, bevelSegments: 4, curveSegments: isMobile ? 4 : 7,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
  geo.translate(-cx, -cy, -cz);
  const mesh = new THREE.Mesh(geo, [faceMat, sideMat]);
  const s = 4.6 / (bb.max.y - bb.min.y);
  mesh.scale.set(s, -s, s); // SVG y points down
  emblem.add(mesh);
  // sword tip: the topmost point of the artwork (in SVG space it is the smallest y)
  const p = geo.attributes.position; let best = Infinity, bx = 0;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < best) { best = y; bx = p.getX(i); } }
  tip.set(bx * s, -best * s, 0.2);
  emblem.add(sparks);
  for (let i = 0; i < SPARKS; i++) respawn(i);
  resize(); renderer.render(scene, camera); ready();
});

const mouse = new THREE.Vector2(), target = new THREE.Vector2();
addEventListener('pointermove', (e) => target.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), { passive: true });

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const wide = camera.aspect > 1.15;
  emblem.position.set(wide ? 2.6 : 0, wide ? -0.1 : 1.4, 0);
  emblem.scale.setScalar(wide ? 1 : 0.62);
  halo.position.x = emblem.position.x; halo.position.y = emblem.position.y;
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
(function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  mouse.lerp(target, Math.min(dt * 4, 1));
  emblem.rotation.y = Math.sin(t * 0.35) * 0.32 + mouse.x * 0.35;
  emblem.rotation.x = Math.sin(t * 0.27) * 0.06 - mouse.y * 0.18;
  emblem.position.y += (Math.sin(t * 0.9) * 0.08 - (emblem.userData.lastBob || 0));
  emblem.userData.lastBob = Math.sin(t * 0.9) * 0.08;
  // glint: a light sweeps across the face every ~6s
  const ph = (t % 6) / 6;
  sweep.position.set(emblem.position.x - 4 + ph * 8, emblem.position.y + 2 - ph * 3, 3);
  sweep.intensity = Math.sin(Math.min(ph * 1.6, 1) * Math.PI) * 80;
  // sparks
  for (let i = 0; i < SPARKS; i++) {
    sLife[i] += dt * 0.7;
    if (sLife[i] > 1) { respawn(i); sLife[i] = 0; continue; }
    sVel[i * 3 + 1] -= dt * 0.35;
    sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  dust.rotation.y = t * 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
})();
