"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { buildRiverCurve, buildTerrainGeometry } from "./terrainGeo";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ── camera keyframes (a flythrough that descends into the valley) ─────── */
const CAM: { pos: [number, number, number]; tgt: [number, number, number] }[] = [
  { pos: [0, 11, 32], tgt: [0, 3.5, 6] },
  { pos: [-6, 6.5, 16], tgt: [3, 2.2, -8] },
  { pos: [5, 3.2, 3], tgt: [-2.5, 1.6, -18] },
  { pos: [0, 2.1, -10], tgt: [0, 1.4, -34] },
];
function sampleCam(p: number) {
  const n = CAM.length - 1;
  const f = clamp(p) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const t = f - i;
  const e = t * t * (3 - 2 * t);
  const lerp = (a: number[], b: number[]) => a.map((v, k) => v + (b[k] - v) * e);
  return { pos: lerp(CAM[i].pos, CAM[i + 1].pos), tgt: lerp(CAM[i].tgt, CAM[i + 1].tgt) };
}

/* ── terrain shader (painterly green ridges + gold rim + haze) ─────────── */
const TERRAIN_VERT = /* glsl */ `
  varying vec3 vWorld; varying vec3 vNormal; varying float vH;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz; vH = position.y;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TERRAIN_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorld; varying vec3 vNormal; varying float vH;
  uniform vec3 uSun;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
  void main(){
    vec3 n = normalize(vNormal);
    float light = clamp(dot(n, normalize(uSun)), 0.0, 1.0);
    vec3 valley = vec3(0.20,0.40,0.16);
    vec3 mid    = vec3(0.34,0.55,0.21);
    vec3 peak   = vec3(0.66,0.72,0.42);
    float h = smoothstep(-2.0, 16.0, vH);
    vec3 base = mix(valley, mid, smoothstep(0.0,0.45,h));
    base = mix(base, peak, smoothstep(0.5,1.0,h));
    float b = fbm(vWorld.xz * 0.18);
    base *= 0.80 + 0.42 * b;                       // painterly brush variation
    vec3 col = base * (0.46 + light * 0.85);
    float rim = pow(1.0 - abs(n.y), 2.0) * smoothstep(3.0, 13.0, vH);
    col += vec3(0.95,0.74,0.34) * rim * 0.22;       // warm gold rim on the ridges
    float d = length(vWorld - cameraPosition);
    float haze = smoothstep(34.0, 135.0, d);
    col = mix(col, vec3(0.84,0.91,0.85), haze * 0.92);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Terrain() {
  const geo = useMemo(() => buildTerrainGeometry(), []);
  const uniforms = useMemo(() => ({ uSun: { value: new THREE.Vector3(0.4, 0.9, 0.2).normalize() } }), []);
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial vertexShader={TERRAIN_VERT} fragmentShader={TERRAIN_FRAG} uniforms={uniforms} />
    </mesh>
  );
}

function River({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 240, 0.5, 10, false), [curve]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={"#ffcf6a"} transparent opacity={0.92} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

const COINS = 40;
function Coins({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COINS; i++) {
      // flow from far (1) toward the viewer (0) — the deposit coming back
      const u = 1 - ((t * 0.022 + i / COINS) % 1);
      const p = curve.getPointAt(clamp(u, 0.0001, 0.9999));
      dummy.position.set(p.x, p.y + 0.5 + Math.sin(t * 1.5 + i) * 0.18, p.z);
      dummy.rotation.set(Math.PI / 2, 0, t * 1.2 + i);
      const s = 0.55 + 0.25 * Math.sin(i * 1.7);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COINS]} frustumCulled={false}>
      <cylinderGeometry args={[0.34, 0.34, 0.07, 24]} />
      <meshStandardMaterial color={"#f3b73c"} emissive={"#e09a1e"} emissiveIntensity={0.9} metalness={0.85} roughness={0.28} toneMapped={false} />
    </instancedMesh>
  );
}

function CameraRig({ progress, pointer }: { progress: React.MutableRefObject<number>; pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const { pos, tgt: t } = sampleCam(progress.current);
    const sway = Math.sin(state.clock.elapsedTime * 0.25) * 0.4;
    const px = pointer.current.x;
    const py = pointer.current.y;
    camera.position.set(pos[0] + px * 1.6 + sway, pos[1] - py * 1.0, pos[2]);
    tgt.set(t[0] + px * 1.2, t[1] - py * 0.6, t[2]);
    camera.lookAt(tgt);
  });
  return null;
}

function Scene({ progress, pointer }: { progress: React.MutableRefObject<number>; pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const curve = useMemo(() => buildRiverCurve(), []);
  return (
    <>
      <fog attach="fog" args={["#d6e7d2", 38, 150]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#eaf4ff", "#5a6b3a", 0.7]} />
      <directionalLight position={[18, 30, 12]} intensity={1.5} color={"#fff3d8"} />
      <Terrain />
      <River curve={curve} />
      <Coins curve={curve} />
      <CameraRig progress={progress} pointer={pointer} />
      <EffectComposer>
        <Bloom intensity={1.25} luminanceThreshold={0.5} luminanceSmoothing={0.25} mipmapBlur radius={0.8} />
      </EffectComposer>
    </>
  );
}

/* ── overlay helpers ───────────────────────────────────────────────────── */
const STAGES = [
  { center: 0.08, lines: ["You moved out."] },
  { center: 0.33, lines: ["They kept", "your deposit."] },
  { center: 0.58, lines: ["The law is", "on your side."] },
];
function bell(p: number, center: number, width = 0.14) {
  return clamp(1 - Math.abs(p - center) / width);
}

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const [p, setP] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = heroRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const np = clamp(total > 0 ? -rect.top / total : 0);
        progress.current = np;
        setP(np);
      }
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 };
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const finale = bell(p, 0.9, 0.18);
  const activeDot = Math.min(3, Math.floor(p * 4 + 0.0001));

  return (
    <section ref={heroRef} className="relative" style={{ height: "440vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: "linear-gradient(180deg,#bfe0ef 0%,#d4e8d6 55%,#eef3e0 100%)" }}>
        {mounted && (
          <Canvas
            className="absolute inset-0"
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 52, near: 0.1, far: 420, position: [0, 11, 32] }}
            dpr={[1, 2]}
          >
            <Scene progress={progress} pointer={pointer} />
          </Canvas>
        )}

        {/* soft center scrim for text legibility */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 45%, rgba(10,30,20,0.22), transparent 70%)" }} />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-4 w-4 rotate-45 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold shadow" />
            <span className="font-display text-xl text-white drop-shadow-[0_1px_8px_rgba(0,40,20,0.5)]">DepositBack</span>
          </div>
          <a
            href="#tool"
            className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-ink shadow-lg backdrop-blur transition hover:bg-white"
          >
            Open the tool →
          </a>
        </div>

        {/* diamond progress rail */}
        <div className="absolute left-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-4 sm:flex">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rotate-45 rounded-[2px] border transition-all duration-300 ${
                i === activeDot ? "scale-125 border-gold-bright bg-gold-bright" : "border-white/70 bg-transparent"
              }`}
            />
          ))}
        </div>

        {/* staged serif reveals */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {STAGES.map((s, i) => {
            const o = bell(p, s.center);
            return (
              <h1
                key={i}
                className="absolute px-6 text-center font-display text-5xl leading-[1.05] text-white sm:text-7xl md:text-8xl"
                style={{
                  opacity: o,
                  transform: `translateY(${(p - s.center) * -120}px) scale(${0.96 + o * 0.04})`,
                  textShadow: "0 2px 30px rgba(8,30,18,0.45)",
                }}
              >
                {s.lines.map((l, k) => (
                  <span key={k} className="block">
                    {l}
                  </span>
                ))}
              </h1>
            );
          })}

          {/* finale */}
          <div
            className="absolute flex flex-col items-center px-6 text-center"
            style={{ opacity: finale, transform: `translateY(${(p - 0.9) * -90}px)` }}
          >
            <h1 className="font-display text-5xl leading-[1.05] text-white sm:text-7xl md:text-8xl" style={{ textShadow: "0 2px 30px rgba(8,30,18,0.45)" }}>
              Get back every dollar.
            </h1>
            <p className="mt-3 font-display text-2xl italic text-gold-soft sm:text-3xl" style={{ textShadow: "0 2px 18px rgba(8,30,18,0.5)" }}>
              And every rupee.
            </p>
            <a
              href="#tool"
              className="pointer-events-auto mt-8 rounded-full bg-emerald-deep px-7 py-3.5 font-medium text-white shadow-[0_10px_40px_rgba(14,94,60,0.5)] transition hover:bg-emerald"
            >
              Check my deposit →
            </a>
          </div>
        </div>

        {/* scroll hint (only at the very top) */}
        <div
          className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center text-white/90"
          style={{ opacity: clamp(1 - p * 8) }}
        >
          <span className="text-sm tracking-wide drop-shadow">Scroll</span>
          <span className="mt-1 animate-bounce text-lg">↓</span>
        </div>
      </div>
    </section>
  );
}
