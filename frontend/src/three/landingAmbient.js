/**
 * Subtle Three.js ambient layer for the landing screen: soft gradient plane with
 * gentle wave motion; shifts when transitioning intro → chat.
 * Respects prefers-reduced-motion (no WebGL loop).
 */
import * as THREE from 'three';

let renderer = null;
let scene = null;
let camera = null;
let mesh = null;
let rafId = 0;
let running = false;
let canvasEl = null;
let targetTransition = 0;
let currentTransition = 0;
let clock = null;

const LERP = 5;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function makeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTransition: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uTransition;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float t = uTime * 0.35;
        float amp = 0.04 + uTransition * 0.06;
        float wave =
          sin(uv.x * 8.0 + t) * cos(uv.y * 7.0 + t * 0.8) * amp
          + sin(uv.x * 14.0 - t * 1.2) * 0.015 * (1.0 + uTransition);
        vec3 pos = position;
        pos.z += wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTransition;
      varying vec2 vUv;
      void main() {
        vec3 teal = vec3(0.055, 0.62, 0.55);
        vec3 mist = vec3(0.96, 0.98, 0.97);
        float flow = sin(vUv.x * 3.2 + uTime * 0.15) * 0.5 + 0.5;
        float flow2 = cos(vUv.y * 2.8 - uTime * 0.12) * 0.5 + 0.5;
        float mixAmt = 0.12 + uTransition * 0.18 + (flow * flow2) * 0.08;
        vec3 col = mix(mist, teal, mixAmt);
        float alpha = 0.22 + uTransition * 0.12;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
}

function updateSize() {
  if (!canvasEl || !renderer || !camera || !mesh) return;
  const w = Math.max(1, canvasEl.clientWidth);
  const h = Math.max(1, canvasEl.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
  mesh.scale.set(w, h, 1);
}

function tick() {
  if (!running || !renderer || !scene || !camera || !clock) return;
  const dt = clock.getDelta();
  const elapsed = clock.elapsedTime;

  currentTransition += (targetTransition - currentTransition) * Math.min(1, LERP * dt);

  if (mesh?.material?.uniforms) {
    mesh.material.uniforms.uTime.value = elapsed;
    mesh.material.uniforms.uTransition.value = currentTransition;
  }

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(tick);
}

/**
 * Mount WebGL on the given canvas (must exist in DOM).
 */
export function initLandingAmbient3d(canvasId = 'landing-main-3d') {
  const el = document.getElementById(canvasId);
  if (!el || prefersReducedMotion()) return;
  if (renderer && canvasEl === el) {
    updateSize();
    return;
  }
  disposeLandingAmbient3d();
  canvasEl = el;

  let gl;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    gl = renderer.getContext();
  } catch (_) {
    disposeLandingAmbient3d();
    return;
  }
  if (!gl) {
    disposeLandingAmbient3d();
    return;
  }

  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;

  const geo = new THREE.PlaneGeometry(1, 1, 64, 64);
  const mat = makeMaterial();
  mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 0;
  scene.add(mesh);

  clock = new THREE.Clock();
  targetTransition = 0;
  currentTransition = 0;
  mat.uniforms.uTransition.value = 0;

  updateSize();
  window.addEventListener('resize', updateSize);

  running = true;
  rafId = requestAnimationFrame(tick);
}

/** Animate toward intro (0) or chat (1) ambient state. */
export function setLandingAmbientMode(mode) {
  targetTransition = mode === 'chat' ? 1 : 0;
}

export function syncLandingAmbientTransition(value) {
  targetTransition = value;
  currentTransition = value;
  if (mesh?.material?.uniforms) {
    mesh.material.uniforms.uTransition.value = value;
  }
}

export function disposeLandingAmbient3d() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  window.removeEventListener('resize', updateSize);

  if (mesh) {
    mesh.geometry?.dispose();
    mesh.material?.dispose();
    mesh = null;
  }
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  clock = null;
  canvasEl = null;
  targetTransition = 0;
  currentTransition = 0;
}
