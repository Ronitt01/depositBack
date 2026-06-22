"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  GodRays,
  HueSaturation,
  BrightnessContrast,
  Vignette,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { buildRiverCurve, buildTerrainGeometry } from "./terrainGeo";
import { Painterly } from "./effects";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ── camera keyframes (descend and fly through the valley) ─────────────── */
const CAM: { pos: [number, number, number]; tgt: [number, number, number] }[] = [
  { pos: [0, 12, 34], tgt: [0, 4, 6] },
  { pos: [-7, 7, 17], tgt: [3, 2.4, -9] },
  { pos: [5.5, 3.4, 3], tgt: [-3, 1.8, -19] },
  { pos: [0, 2.2, -11], tgt: [0, 1.5, -36] },
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

/* ── sky dome ──────────────────────────────────────────────────────────── */
const SKY_VERT = /* glsl */ `
  varying vec3 vPos;
  void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  void main(){
    float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
    vec3 zenith  = vec3(0.49, 0.74, 0.90);
    vec3 mid     = vec3(0.74, 0.86, 0.92);
    vec3 horizon = vec3(0.93, 0.95, 0.90);
    vec3 c = mix(horizon, mid, smoothstep(0.0, 0.5, h));
    c = mix(c, zenith, smoothstep(0.45, 1.0, h));
    gl_FragColor = vec4(c, 1.0);
  }
`;
function SkyDome() {
  const uniforms = useMemo(() => ({}), []);
  return (
    <mesh scale={[390, 390, 390]} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

/* ── terrain (painterly green ridges, snow caps, cool distance) ────────── */
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
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
  void main(){
    vec3 n = normalize(vNormal);
    vec3 sun = normalize(uSun);
    float light = clamp(dot(n, sun), 0.0, 1.0);
    float ao = clamp(vH / 28.0, 0.0, 1.0);

    vec3 valley = vec3(0.18,0.38,0.15);
    vec3 mid    = vec3(0.33,0.55,0.20);
    vec3 grass  = vec3(0.55,0.66,0.28);
    float h = smoothstep(-2.0, 22.0, vH);
    vec3 base = mix(valley, mid, smoothstep(0.0,0.4,h));
    base = mix(base, grass, smoothstep(0.4,0.85,h));

    // domain-warped brush variation (painterly)
    vec2 q = vWorld.xz * 0.16;
    float warp = fbm(q + fbm(q * 0.5));
    base *= 0.74 + 0.5 * warp;

    // snow on the high, flatter tops
    float snow = smoothstep(21.0, 30.0, vH) * smoothstep(0.35, 0.85, n.y);
    base = mix(base, vec3(0.95,0.96,1.0), snow);

    vec3 col = base * (0.42 + light * 0.9 + ao * 0.1);
    float rim = pow(1.0 - abs(n.y), 2.0) * smoothstep(4.0, 16.0, vH);
    col += vec3(1.0,0.78,0.4) * rim * 0.22; // warm gold rim

    // cool atmospheric distance (blue-grey)
    float d = length(vWorld - cameraPosition);
    float haze = smoothstep(36.0, 150.0, d);
    col = mix(col, vec3(0.74,0.83,0.90), haze * 0.95);
    gl_FragColor = vec4(col, 1.0);
  }
`;
function Terrain({ sun }: { sun: [number, number, number] }) {
  const geo = useMemo(() => buildTerrainGeometry(), []);
  const uniforms = useMemo(() => ({ uSun: { value: new THREE.Vector3(...sun).normalize() } }), [sun]);
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial vertexShader={TERRAIN_VERT} fragmentShader={TERRAIN_FRAG} uniforms={uniforms} />
    </mesh>
  );
}

function River({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 260, 0.55, 12, false), [curve]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={"#ffd277"} transparent opacity={0.95} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

const COINS = 44;
function Coins({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COINS; i++) {
      const u = 1 - ((t * 0.02 + i / COINS) % 1); // flow back toward the viewer
      const p = curve.getPointAt(clamp(u, 0.0001, 0.9999));
      dummy.position.set(p.x, p.y + 0.5 + Math.sin(t * 1.4 + i) * 0.18, p.z);
      dummy.rotation.set(Math.PI / 2, 0, t * 1.1 + i);
      dummy.scale.setScalar(0.5 + 0.22 * Math.sin(i * 1.7));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COINS]} frustumCulled={false}>
      <cylinderGeometry args={[0.34, 0.34, 0.07, 24]} />
      <meshStandardMaterial color={"#f4ba3e"} emissive={"#e09a1e"} emissiveIntensity={1.0} metalness={0.85} roughness={0.25} toneMapped={false} />
    </instancedMesh>
  );
}

/* a calm white bird gliding through the valley */
function Bird() {
  const g = useRef<THREE.Group>(null);
  const lw = useRef<THREE.Mesh>(null);
  const rw = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const loop = (t * 0.05) % 1;
    const x = THREE.MathUtils.lerp(16, -18, loop);
    const z = THREE.MathUtils.lerp(-34, 8, loop);
    const y = 10 + Math.sin(loop * Math.PI) * 3.5 + Math.sin(t * 1.3) * 0.4;
    const flap = Math.sin(t * 5.0) * 0.5;
    if (g.current) {
      g.current.position.set(x, y, z);
      g.current.rotation.set(0.05 * Math.sin(t), -0.7, 0.08 * Math.sin(t * 0.7));
    }
    if (lw.current) lw.current.rotation.z = 0.18 + flap;
    if (rw.current) rw.current.rotation.z = -0.18 - flap;
  });
  return (
    <group ref={g} scale={1.1}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.12, 1.3, 6]} />
        <meshStandardMaterial color={"#ffffff"} emissive={"#dfe9ff"} emissiveIntensity={0.35} roughness={0.6} toneMapped={false} />
      </mesh>
      <mesh ref={lw} position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.06, 1.5]} />
        <meshStandardMaterial color={"#ffffff"} emissive={"#dfe9ff"} emissiveIntensity={0.35} roughness={0.6} toneMapped={false} />
      </mesh>
      <mesh ref={rw} position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.06, 1.5]} />
        <meshStandardMaterial color={"#ffffff"} emissive={"#dfe9ff"} emissiveIntensity={0.35} roughness={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CameraRig({ progress, pointer }: { progress: React.RefObject<number>; pointer: React.RefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const { pos, tgt: t } = sampleCam(progress.current ?? 0);
    const sway = Math.sin(state.clock.elapsedTime * 0.22) * 0.4;
    const px = pointer.current?.x ?? 0;
    const py = pointer.current?.y ?? 0;
    camera.position.set(pos[0] + px * 1.6 + sway, pos[1] - py * 1.0, pos[2]);
    tgt.set(t[0] + px * 1.2, t[1] - py * 0.6, t[2]);
    camera.lookAt(tgt);
  });
  return null;
}

const SUN: [number, number, number] = [18, 46, -72];

function Scene({ progress, pointer }: { progress: React.RefObject<number>; pointer: React.RefObject<{ x: number; y: number }> }) {
  const curve = useMemo(() => buildRiverCurve(), []);
  const sunRef = useRef<THREE.Mesh>(null!);
  return (
    <>
      <color attach="background" args={["#cfe6ef"]} />
      <fog attach="fog" args={["#bcd4dc", 40, 170]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#eaf4ff", "#4f6336", 0.8]} />
      <directionalLight position={SUN} intensity={1.7} color={"#fff2d4"} />

      <SkyDome />
      <mesh ref={sunRef} position={SUN} frustumCulled={false}>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color={"#fff2cf"} toneMapped={false} />
      </mesh>

      <Terrain sun={SUN} />
      <River curve={curve} />
      <Coins curve={curve} />
      <Bird />
      <CameraRig progress={progress} pointer={pointer} />

      <EffectComposer multisampling={4}>
        <GodRays sun={sunRef} samples={60} density={0.95} decay={0.92} weight={0.5} exposure={0.5} clampMax={1} blur />
        <Painterly />
        <Bloom intensity={1.0} luminanceThreshold={0.55} luminanceSmoothing={0.28} mipmapBlur radius={0.8} />
        <HueSaturation saturation={0.12} />
        <BrightnessContrast brightness={0.02} contrast={0.08} />
        <Vignette eskil={false} offset={0.28} darkness={0.42} />
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
    <section ref={heroRef} className="relative" style={{ height: "460vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: "linear-gradient(180deg,#bfe0ef 0%,#d4e8d6 55%,#eef3e0 100%)" }}>
        {mounted && (
          <Canvas
            className="absolute inset-0"
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{ fov: 52, near: 0.1, far: 460, position: [0, 12, 34] }}
            dpr={[1, 2]}
          >
            <Scene progress={progress} pointer={pointer} />
          </Canvas>
        )}

        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 45%, rgba(10,30,20,0.20), transparent 70%)" }} />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-4 w-4 rotate-45 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold shadow" />
            <span className="font-display text-xl text-white drop-shadow-[0_1px_8px_rgba(0,40,20,0.5)]">DepositBack</span>
          </div>
          <a href="#tool" className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-ink shadow-lg backdrop-blur transition hover:bg-white">
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
                style={{ opacity: o, transform: `translateY(${(p - s.center) * -120}px) scale(${0.96 + o * 0.04})`, textShadow: "0 2px 30px rgba(8,30,18,0.45)" }}
              >
                {s.lines.map((l, k) => (
                  <span key={k} className="block">{l}</span>
                ))}
              </h1>
            );
          })}

          <div className="absolute flex flex-col items-center px-6 text-center" style={{ opacity: finale, transform: `translateY(${(p - 0.9) * -90}px)` }}>
            <h1 className="font-display text-5xl leading-[1.05] text-white sm:text-7xl md:text-8xl" style={{ textShadow: "0 2px 30px rgba(8,30,18,0.45)" }}>
              Get back every dollar.
            </h1>
            <p className="mt-3 font-display text-2xl italic text-gold-soft sm:text-3xl" style={{ textShadow: "0 2px 18px rgba(8,30,18,0.5)" }}>
              And every rupee.
            </p>
            <a href="#tool" className="pointer-events-auto mt-8 rounded-full bg-emerald-deep px-7 py-3.5 font-medium text-white shadow-[0_10px_40px_rgba(14,94,60,0.5)] transition hover:bg-emerald">
              Check my deposit →
            </a>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center text-white/90" style={{ opacity: clamp(1 - p * 8) }}>
          <span className="text-sm tracking-wide drop-shadow">Scroll</span>
          <span className="mt-1 animate-bounce text-lg">↓</span>
        </div>
      </div>
    </section>
  );
}
