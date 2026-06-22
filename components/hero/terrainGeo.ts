import * as THREE from "three";

/* Painterly valley terrain — a central low channel for the golden "deposit" river,
   flanked by rising green ridges so the camera flies *through* the peaks (EverSwap-style). */

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x: number, z: number): number {
  let f = 0;
  let amp = 0.5;
  let fr = 1;
  for (let i = 0; i < 4; i++) {
    f += amp * vnoise(x * fr, z * fr);
    fr *= 2;
    amp *= 0.5;
  }
  return f;
}

export function terrainHeight(x: number, z: number): number {
  // 0 in the central valley → 1 out on the flanks.
  const flank = THREE.MathUtils.smoothstep(Math.abs(x), 5, 30);
  const ridge = Math.pow(flank, 1.35) * 30; // tall, dramatic peaks
  const detail = fbm(x * 0.05 + 10, z * 0.04 + 5) * (2.4 + Math.pow(flank, 1.5) * 11);
  // sharp diagonal creases on the flanks (ridgelines)
  const crease = Math.abs(fbm(x * 0.09 + 3, z * 0.08 + 7) - 0.5) * 2;
  const sharp = (1 - crease) * flank * 7;
  const bumps = fbm(x * 0.14, z * 0.12) * 1.3;
  return ridge + detail + sharp + bumps - 2;
}

const W = 96;
const D = 220;
const NEAR_Z = 32;
const SEG_X = 120;
const SEG_Z = 260;

export function buildTerrainGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEG_Z; i++) {
    const z = NEAR_Z - (i / SEG_Z) * D;
    for (let j = 0; j <= SEG_X; j++) {
      const x = -W / 2 + (j / SEG_X) * W;
      positions.push(x, terrainHeight(x, z), z);
    }
  }
  const cols = SEG_X + 1;
  for (let i = 0; i < SEG_Z; i++) {
    for (let j = 0; j < SEG_X; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildRiverCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  for (let z = NEAR_Z - 4; z > -185; z -= 4) {
    const x = Math.sin(z * 0.06) * 4.2 + Math.sin(z * 0.135) * 1.8;
    const y = terrainHeight(x, z) + 0.35;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const c = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  return c;
}
