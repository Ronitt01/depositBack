"use client";

/* ============================================================================
   DepositBack — "MOLTEN VERDICT" scroll hero
   Your money, poured back into your hands — molten gold that flows, pools,
   and seals into a shield.

   Approach: glsl-fullscreen. The entire scene is ONE fragment shader rendered
   on a fullscreen plane: a signed-distance metaball field of molten gold with
   Fresnel rim light, a faked screen-space environment streak for liquid-metal
   specular, view-dependent incandescence, a soft directional key-light bloom,
   ACES soft tonemap + filmic S-curve, ordered dithering against banding,
   animated film grain and a soft radial vignette — all in the same pass.

   Scroll progress 0→1 (from the section's getBoundingClientRect, rAF-throttled)
   drives every beat:
     0.00  calm, thin veins drift over warm paper
     0.25  the gold DRAINS toward the edges, center cools (the only tense beat)
     0.50  reversal — gold floods back inward, hotter, emerald undertone enters
     0.75  curl decays, metaballs lock radially, surface tension rises, cooling
     1.00  one minted coin; emerald seal-ring strikes; checkmark glints

   POLISH PASS — elevations:
     • Color-temperature drama pushed harder: agitated bright-amber early →
       settled deep gold at seal (the single biggest "this cost money" tell).
     • Continuous idle life: breathing curl + a slow core pulse so the field is
       never frozen, fully gated by prefers-reduced-motion.
     • Soft directional key-light + dual-band anisotropic env streak for a
       graded liquid-metal specular instead of a flat blob.
     • Ordered 8x8 Bayer dither kills gradient banding (a classic cheap tell).
     • The emerald SEAL strike now eases on a sharp cubic-bezier with a brief
       sub-second bloom flash and a soft secondary inner ring.
     • DOM: expressive cubic-bezier easing everywhere, per-line staggered
       reveals, pointer parallax depth layering, editorial Fraunces tracking,
       a momentum/overshoot settle on the finale.

   Self-contained: every shader, helper and sub-component is inlined here.
   No postprocessing packages. SSR-safe. dpr capped [1,2].
============================================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// expressive cubic-bezier (no linear, no default ease) — same family as the CSS
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// shape the raw scroll progress so beats land with confident timing
function easeShape(p: number) {
  return easeInOutCubic(clamp(p));
}
// shared expressive curve for CSS transitions (out-expo-ish)
const CB = "cubic-bezier(0.22,1,0.36,1)";

/* ─────────────────────────── error boundary ───────────────────────────────
   Keeps a WebGL/context-loss failure inside rAF from taking down the page —
   the hero gracefully falls back to the static gradient + readable text. */
class CanvasBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Molten Verdict canvas failed:", err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ───────────────────────────── shaders ──────────────────────────────────── */

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // plane is rendered directly in clip space — fills the viewport regardless
    // of camera. The geometry attribute 'position' spans [-1..1] (a 2x2 plane).
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const MOLTEN_FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;       // seconds, continuous (idle life)
  uniform float uProgress;   // scroll 0..1 (already eased on the CPU)
  uniform vec2  uResolution; // pixels
  uniform vec2  uPointer;    // -1..1 parallax
  uniform float uReduced;    // 1.0 if prefers-reduced-motion

  /* palette (authored sRGB, tonemapped at the end) */
  const vec3 PAPER      = vec3(0.957, 0.945, 0.914); // #f4f1e9
  const vec3 PAPER2     = vec3(0.925, 0.906, 0.859); // #ece7db
  const vec3 GOLD       = vec3(0.690, 0.490, 0.086); // #b07d16 deep molten core
  const vec3 GOLD_BR    = vec3(0.890, 0.678, 0.235); // #e3ad3c liquid highlight
  const vec3 GOLD_SOFT  = vec3(0.965, 0.914, 0.784); // #f6e9c8 rim incandescence
  const vec3 EMERALD    = vec3(0.110, 0.533, 0.353); // #1c885a the law
  const vec3 EMERALD_DP = vec3(0.055, 0.369, 0.235); // #0e5e3c engraved ring
  const vec3 INK        = vec3(0.082, 0.137, 0.110); // #15231c vignette/grain

  /* ---- hashing / noise ---- */
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for(int i = 0; i < 5; i++){ v += a * vnoise(p); p = m * p; a *= 0.5; }
    return v;
  }

  /* curl of a scalar potential -> divergence-free flow field (liquid feel) */
  vec2 curl(vec2 p){
    float e = 0.18;
    float n1 = fbm(p + vec2(0.0, e));
    float n2 = fbm(p - vec2(0.0, e));
    float n3 = fbm(p + vec2(e, 0.0));
    float n4 = fbm(p - vec2(e, 0.0));
    return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
  }

  /* smooth-min metaball merge */
  float smin(float a, float b, float k){
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  /* ACES-ish soft tonemap so highlights roll off instead of clipping */
  vec3 aces(vec3 x){
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  /* ordered 8x8 Bayer dither -> destroys gradient banding (a cheap tell) */
  float bayer8(vec2 c){
    int x = int(mod(c.x, 8.0));
    int y = int(mod(c.y, 8.0));
    int i = x + y * 8;
    // flattened 8x8 Bayer matrix / 64
    int m[64];
    m[0]=0;  m[1]=32; m[2]=8;  m[3]=40; m[4]=2;  m[5]=34; m[6]=10; m[7]=42;
    m[8]=48; m[9]=16; m[10]=56;m[11]=24;m[12]=50;m[13]=18;m[14]=58;m[15]=26;
    m[16]=12;m[17]=44;m[18]=4; m[19]=36;m[20]=14;m[21]=46;m[22]=6; m[23]=38;
    m[24]=60;m[25]=28;m[26]=52;m[27]=20;m[28]=62;m[29]=30;m[30]=54;m[31]=22;
    m[32]=3; m[33]=35;m[34]=11;m[35]=43;m[36]=1; m[37]=33;m[38]=9; m[39]=41;
    m[40]=51;m[41]=19;m[42]=59;m[43]=27;m[44]=49;m[45]=17;m[46]=57;m[47]=25;
    m[48]=15;m[49]=47;m[50]=7; m[51]=39;m[52]=13;m[53]=45;m[54]=5; m[55]=37;
    m[56]=63;m[57]=31;m[58]=55;m[59]=23;m[60]=61;m[61]=29;m[62]=53;m[63]=21;
    float v = 0.0;
    for(int k = 0; k < 64; k++){ if(k == i) v = float(m[k]); }
    return v / 64.0 - 0.5;
  }

  void main(){
    // aspect-correct, centered coordinates in [-asp..asp] x [-1..1]
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    float p = clamp(uProgress, 0.0, 1.0);
    float t = uTime;
    // idle motion still advances even at p≈0 so the field always breathes,
    // but is heavily damped (not frozen) under prefers-reduced-motion.
    float life = mix(1.0, 0.28, uReduced);
    // a slow global breath that subtly modulates curl + incandescence
    float breath = 0.5 + 0.5 * sin(t * 0.55 * life);

    /* ---- beat envelopes (smooth, overlapping) -------------------------- */
    float bDrain  = smoothstep(0.06, 0.28, p) * (1.0 - smoothstep(0.34, 0.52, p)); // 0.25 tense
    float bFlood  = smoothstep(0.42, 0.62, p);                                     // 0.50 reversal
    float bSeal   = smoothstep(0.70, 0.97, p);                                     // 0.75→1 melt-to-seal
    float minted  = smoothstep(0.86, 1.0, p);                                      // fully solid coin

    // curl strength decays to zero as we lock into the coin; idle breath keeps
    // it alive at rest so the calm beat is never dead-still.
    float curlAmt = (0.50 + 0.10 * breath + 0.25 * bFlood) * (1.0 - bSeal);
    // radial pull toward center ramps up in the seal phase
    float radial  = bSeal;
    // directional drain bias (money pulled away) during the tense beat
    vec2  drainDir = uv * (1.0 + 0.0001);

    /* ---- animated flow field warps the metaball sample space ----------- */
    vec2 fp = uv * 1.55;
    fp.x += uPointer.x * 0.10;
    fp.y += uPointer.y * 0.06;

    vec2 flow = curl(fp * 1.3 + vec2(0.0, t * 0.06 * life)) * curlAmt;
    // drain: bias the flow outward toward the edges (center loses its gold)
    flow += normalize(drainDir + 1e-4) * bDrain * (0.30 + 0.20 * length(uv));
    // flood: bias inward, hotter and faster
    flow -= normalize(drainDir + 1e-4) * bFlood * 0.34;

    vec2 sp = fp + flow;

    /* ---- metaball field ------------------------------------------------ */
    // a handful of drifting cores; they migrate inward + merge as we seal
    float field = 1e5;
    const int N = 6;
    for(int i = 0; i < N; i++){
      float fi = float(i);
      float ang = fi * 2.39996 + t * 0.05 * life;        // golden-angle scatter
      float orbit = 0.72 + 0.20 * sin(fi * 1.7);
      // wandering home position
      vec2 home = vec2(cos(ang), sin(ang * 0.9 + fi)) * orbit;
      home += 0.18 * vec2(fbm(vec2(fi, t * 0.08 * life)), fbm(vec2(fi + 9.0, t * 0.08 * life)) ) - 0.09;
      // seal: pull every core to dead-center
      home = mix(home, vec2(0.0), radial * (0.92 + 0.08 * sin(fi)));
      float rad = mix(0.34, 0.30, bFlood);               // swell on flood
      rad += 0.012 * breath * (1.0 - bSeal);             // idle pulse (alive at rest)
      rad = mix(rad, 0.40, minted);                      // fuse for the coin
      float d = length(sp - home) - rad;
      // surface tension increases (k shrinks) as we seal => sharper edges
      float k = mix(0.42, 0.05, bSeal);
      field = smin(field, d, k);
    }
    // when minted, blend toward a perfect centered disc (the coin)
    float discR = 0.52;
    float disc = length(uv) - discR;
    field = mix(field, disc, minted);

    /* ---- shading the molten surface ------------------------------------ */
    // fake gradient/normal of the SDF for rim + specular
    float eps = 0.004;
    float fx = (length(sp + vec2(eps,0.0)) ) - (length(sp - vec2(eps,0.0)));
    float fy = (length(sp + vec2(0.0,eps)) ) - (length(sp - vec2(0.0,eps)));
    vec2 grad = normalize(vec2(fx, fy) + 1e-5);
    // surface mask: inside the metal — edge tightens as we seal so the coin
    // resolves into a crisp medallion instead of a soft, milky blob.
    float edge = fwidth(field) * 1.5 + mix(0.012, 0.0035, bSeal);
    float metal = 1.0 - smoothstep(-edge, edge, field);

    // distance-from-edge for incandescence falloff (thicker = hotter core)
    float thick = clamp(-field / 0.5, 0.0, 1.0);

    // Fresnel-ish rim: bright where the surface turns away (near the edge)
    float rim = pow(1.0 - clamp(abs(field) / 0.14, 0.0, 1.0), 1.6);

    // soft directional KEY LIGHT (Lambert-ish off the faked normal) so the
    // metal is graded across the surface, never a flat fill.
    vec2 keyDir = normalize(vec2(-0.45, 0.9));
    float key = clamp(dot(grad, keyDir) * 0.5 + 0.5, 0.0, 1.0);
    key = mix(0.78, 1.18, key);

    // faked screen-space environment streak -> liquid-metal specular.
    // two anisotropic bands at different frequencies for a graded sheen.
    vec2 envDir = normalize(vec2(0.55, 1.0));
    float envCoord = dot(uv + grad * 0.25, envDir) * 2.2 + t * 0.12 * life;
    float streak = pow(0.5 + 0.5 * sin(envCoord * 3.14159), 6.0);
    streak += pow(0.5 + 0.5 * sin(envCoord * 1.7 + 2.0), 10.0) * 0.6;
    // a slow travelling broad band reads as a moving reflection
    float band = pow(0.5 + 0.5 * sin(envCoord * 0.8 - t * 0.18 * life), 3.0) * 0.35;
    float spec = (streak + band) * metal * (0.6 + 0.4 * rim);

    // view-dependent incandescence: hot core, cooler thin film.
    // COLOR-TEMPERATURE DRAMA: agitated bright-amber early/flood, settled deep
    // gold late — pushed harder than before for the "graded cinema metal" read.
    vec3 hotCol = mix(GOLD_BR, GOLD_SOFT, 0.32 + 0.45 * bFlood);
    vec3 coreCol = mix(GOLD, hotCol, smoothstep(0.0, 1.0, thick));
    // a faint idle shimmer in the core temperature when calm (alive at rest)
    coreCol = mix(coreCol, GOLD_BR, 0.05 * breath * (1.0 - bSeal) * (1.0 - bDrain));
    // settle/cool toward deep gold as it solidifies
    vec3 settled = GOLD * 0.90;
    coreCol = mix(coreCol, mix(settled, GOLD_BR, 0.16 + 0.22 * minted), bSeal * 0.78);

    // center cools/dims during the tense drain beat (emptiness, never harsh red)
    float centerCool = bDrain * (1.0 - smoothstep(0.0, 0.6, length(uv)));
    coreCol = mix(coreCol, GOLD * 0.58, centerCool * 0.72);

    vec3 metalCol = coreCol * key;
    // rim incandescence — pulled back at mint so the face reads rich, not milky
    metalCol += GOLD_SOFT * rim * (0.42 + 0.6 * bFlood) * (1.0 - 0.45 * minted);
    metalCol += vec3(1.0, 0.92, 0.74) * spec * (0.9 + 0.5 * minted);   // crisper liquid specular

    // emerald undertone enters the rim on flood (the law arriving), held subtle
    vec3 emRim = mix(EMERALD, EMERALD_DP, 0.4);
    metalCol += emRim * rim * (bFlood * 0.18 * (1.0 - minted));

    // ── MINT: settle the face into a clean radial-graded medallion (bright
    //    center → deep rim) so it reads STRUCK, not a chaotic latte swirl,
    //    and stamp a crisp beveled edge-light just inside the coin rim. ──
    float rr = clamp(length(uv) / discR, 0.0, 1.0);
    vec3 coinFace = mix(GOLD_BR, GOLD * 0.94, smoothstep(0.0, 1.0, rr));
    coinFace *= 0.90 + 0.16 * key;                                  // keep directional relief
    coinFace += vec3(1.0, 0.92, 0.74) * spec * 0.5;                 // a moving sheen survives
    metalCol = mix(metalCol, coinFace, minted * 0.64);
    float bevel = (1.0 - smoothstep(0.02, 0.06, abs(length(uv) - discR))) * minted;
    metalCol += GOLD_SOFT * bevel * 0.6;

    // richness: lift saturation + contrast so the gold reads minted, not milky
    float mlum = dot(metalCol, vec3(0.299, 0.587, 0.114));
    metalCol = mix(vec3(mlum), metalCol, 1.24);
    metalCol = (metalCol - 0.5) * 1.08 + 0.5;

    /* ---- background: warm paper with a soft low flow-field texture ----- */
    float paperN = fbm(uv * 2.0 + vec2(0.0, t * 0.02 * life)) * 0.5 + 0.5;
    vec3 bg = mix(PAPER2, PAPER, paperN);
    // gentle warm key gradient across the paper (depth, not flatness)
    bg *= 0.96 + 0.06 * clamp(dot(uv, keyDir) + 0.5, 0.0, 1.0);
    // warm central light pool so the ground feels lit & golden, not flat grey
    bg = mix(bg, vec3(0.995, 0.965, 0.885), (1.0 - smoothstep(0.0, 1.15, length(uv))) * 0.22);
    // faint cool dip in the center during drain (emptiness, never harsh red)
    bg = mix(bg, bg * 0.95, centerCool * 0.5);

    vec3 col = mix(bg, metalCol, metal);

    // soft contact shadow where metal meets paper (depth, not z-fighting)
    float halo = smoothstep(0.0, 0.10, field) * (1.0 - smoothstep(0.10, 0.34, field));
    col = mix(col, col * 0.86, halo * 0.5 * (1.0 - metal));
    // warm glow bleed just outside the metal (fake bloom)
    float glow = exp(-max(field, 0.0) * 6.0) * (1.0 - metal);
    col += GOLD_BR * glow * (0.18 + 0.5 * bFlood + 0.3 * minted);

    /* ---- THE SEAL: emerald ring strikes around the coin rim ------------
       single expanding stroke, eased on a sharp cubic feel via sealStrike,
       with a brief sub-second bloom flash + a soft secondary inner ring. */
    float sealRaw = smoothstep(0.90, 1.0, p);
    // sharpen the strike with a cubic so it "snaps" into existence
    float sealStrike = sealRaw * sealRaw * (3.0 - 2.0 * sealRaw);
    float ringR = discR + 0.018;
    float ringD = abs(length(uv) - ringR);
    // the stroke "wipes" around: angle gate that opens with sealStrike
    float ang = atan(uv.y, uv.x);
    float sweep = smoothstep(-3.1416, 3.1416, ang); // 0..1 around the rim
    float drawn = step(sweep, sealStrike + (1.0 - sealStrike)); // fully drawn once struck
    float ringW = 0.012;
    float ring = (1.0 - smoothstep(0.0, ringW, ringD)) * sealStrike * drawn;
    // bright emerald core + soft outer glow on the ring
    vec3 ringCol = mix(EMERALD, EMERALD_DP, 0.45);
    col = mix(col, ringCol, ring);
    float ringGlow = exp(-ringD * 22.0) * sealStrike;
    col += EMERALD * ringGlow * 0.35;
    // secondary faint inner ring for a struck, minted feel
    float ring2D = abs(length(uv) - (discR - 0.028));
    float ring2 = (1.0 - smoothstep(0.0, 0.006, ring2D)) * sealStrike;
    col = mix(col, mix(EMERALD_DP, GOLD_SOFT, 0.4), ring2 * 0.5);
    // sub-second emerald bloom flash at the instant of the strike
    float flash = smoothstep(0.93, 0.965, p) * (1.0 - smoothstep(0.965, 1.0, p));
    col += EMERALD * exp(-ringD * 9.0) * flash * 0.6;

    /* ---- engraved checkmark catches the light (only when minted) ------- */
    // build a checkmark from two capsule segments centered in the coin
    vec2 cp = uv;
    vec2 a0 = vec2(-0.16, 0.02), a1 = vec2(-0.03, -0.13);
    vec2 b0 = vec2(-0.03, -0.13), b1 = vec2(0.20, 0.16);
    vec2 pa = cp - a0, ba = a1 - a0;
    float ha = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float dA = length(pa - ba * ha);
    vec2 pb = cp - b0, bb = b1 - b0;
    float hb = clamp(dot(pb, bb) / dot(bb, bb), 0.0, 1.0);
    float dB = length(pb - bb * hb);
    float check = min(dA, dB);
    float checkMask = (1.0 - smoothstep(0.018, 0.030, check)) * minted;
    // engrave: darken the groove then add a directional glint highlight
    col = mix(col, col * 0.78, checkMask * 0.7);
    float glint = smoothstep(0.030, 0.018, check) * pow(0.5 + 0.5 * sin(envCoord * 2.0), 4.0);
    col += GOLD_SOFT * glint * minted * 0.6;

    /* ---- grade: filmic S-curve + ACES tonemap -------------------------- */
    col = aces(col * 1.05);
    // gentle filmic contrast S-curve around 0.5
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

    /* ---- soft WARM vignette (warm umber, never pure black, never cold grey) */
    vec3 vigCol = vec3(0.21, 0.15, 0.08);
    float vig = smoothstep(1.40, 0.42, length(uv * vec2(0.85, 1.0)));
    col = mix(vigCol, col, mix(0.72, 1.0, vig));

    /* ---- animated film grain (quiet, temporal) ------------------------- */
    float g = hash21(frag + fract(t) * 137.0);
    col += (g - 0.5) * 0.030;

    /* ---- ordered dither: break up banding on the smooth gradients ------ */
    col += bayer8(frag) * (1.0 / 255.0);

    col = clamp(col, 0.0, 1.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ─────────────────────── fullscreen molten plane ──────────────────────────
   Drives uTime continuously (idle life) and reads scroll progress from a ref
   each frame so the shader stays in lockstep with the rAF-throttled scroll. */
function MoltenPlane({
  progress,
  pointer,
  reduced,
}: {
  progress: React.RefObject<number>;
  pointer: React.RefObject<{ x: number; y: number }>;
  reduced: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { size, gl } = useThree();

  // Built once and owned by the material. We never mutate this object during
  // render — only inside useFrame, reached through the material ref.
  const initialUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uReduced: { value: 0 },
    }),
    // intentionally created once; `reduced` + resolution are pushed in via the
    // effect below through the material ref.
    []
  );

  // keep resolution + reduced-motion uniforms current via the material ref
  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    const dpr = gl.getPixelRatio();
    (m.uniforms.uResolution.value as THREE.Vector2).set(size.width * dpr, size.height * dpr);
    m.uniforms.uReduced.value = reduced ? 1 : 0;
  }, [size.width, size.height, gl, reduced]);

  // smoothed pointer for buttery parallax
  const smoothPtr = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const m = matRef.current;
    if (!m) return;
    const u = m.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    // ease scroll progress through an expressive curve toward the target, with
    // a frame-rate-independent critically-damped follow (weighted, never twitchy)
    const target = easeShape(progress.current ?? 0);
    const cur = u.uProgress.value as number;
    const k = 1 - Math.exp(-delta * 7); // exponential smoothing, dt-independent
    u.uProgress.value = cur + (target - cur) * k;

    const pt = pointer.current ?? { x: 0, y: 0 };
    const pk = reduced ? 1 : 1 - Math.exp(-delta * 4);
    smoothPtr.current.x += (pt.x - smoothPtr.current.x) * pk;
    smoothPtr.current.y += (pt.y - smoothPtr.current.y) * pk;
    (u.uPointer.value as THREE.Vector2).set(smoothPtr.current.x, smoothPtr.current.y);
  });

  // a fullscreen plane: the vertex shader emits clip-space positions directly
  // from the raw 2x2 geometry, so no camera/model transform is needed.
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={FULLSCREEN_VERT}
        fragmentShader={MOLTEN_FRAG}
        uniforms={initialUniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─────────────────────────── DOM overlays ─────────────────────────────────
   bell() = soft reveal window centered on a progress point, smoothstepped. */
function bell(p: number, center: number, width = 0.13) {
  const t = clamp(1 - Math.abs(p - center) / width);
  return t * t * (3 - 2 * t);
}

const STAGES: { center: number; lines: string[] }[] = [
  { center: 0.06, lines: ["You moved out."] },
  { center: 0.27, lines: ["They kept", "your deposit."] },
  { center: 0.5, lines: ["The law is", "on your side."] },
];

/* ───────────────────────────── component ──────────────────────────────── */
export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const [p, setP] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Mount the Canvas client-side only (SSR-safe) and sync reduced-motion once.
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

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
      pointer.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // smoothed pointer for DOM parallax depth (independent of WebGL)
  const ptr = pointer.current;

  // finale reveal window (the minted coin + CTA)
  const finale = bell(p, 0.93, 0.12);
  const activeDot = Math.min(3, Math.floor(p * 4 + 0.0001));
  const scrollHint = clamp(1 - p * 9);

  return (
    <section ref={heroRef} className="relative" style={{ height: "480vh" }}>
      {/* sticky full-viewport stage */}
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 42%, #f7f3ea 0%, #efe9dc 60%, #e7e0d0 100%)",
        }}
      >
        {/* ── WebGL molten field ── */}
        {mounted && (
          <CanvasBoundary>
            <Canvas
              className="absolute inset-0"
              gl={{
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
                preserveDrawingBuffer: false,
              }}
              dpr={[1, 2]}
              orthographic
              camera={{ position: [0, 0, 1], near: 0.01, far: 10, zoom: 1 }}
              frameloop="always"
            >
              <MoltenPlane progress={progress} pointer={pointer} reduced={reduced} />
            </Canvas>
          </CanvasBoundary>
        )}

        {/* extra DOM vignette + scrim so text stays readable over the metal.
            Parallaxed gently against the pointer for layered depth. */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(115% 90% at 50% 44%, transparent 52%, rgba(21,35,28,0.18) 100%)",
            transform: reduced ? undefined : `translate3d(${ptr.x * -6}px, ${ptr.y * -6}px, 0)`,
            transition: `transform 0.4s ${CB}`,
          }}
        />

        {/* ── top bar ── */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-4 w-4 rotate-45 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold shadow-[0_2px_10px_rgba(176,125,22,0.45)]" />
            <span className="font-display text-xl tracking-tight text-ink drop-shadow-[0_1px_10px_rgba(244,241,233,0.8)]">
              DepositBack
            </span>
          </div>
          <a
            href="#tool"
            className="rounded-full border border-line/80 bg-white/80 px-5 py-2.5 text-sm font-medium text-ink shadow-[0_8px_30px_rgba(21,35,28,0.10)] backdrop-blur-md transition hover:bg-white hover:shadow-[0_10px_36px_rgba(21,35,28,0.14)]"
            style={{ transitionTimingFunction: CB }}
          >
            Open the tool →
          </a>
        </div>

        {/* ── progress rail (diamonds) ── */}
        <div className="absolute left-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-4 sm:flex">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rotate-45 rounded-[2px] border transition-all duration-500 ${
                i === activeDot
                  ? "scale-125 border-gold-bright bg-gold-bright shadow-[0_0_12px_rgba(227,173,60,0.7)]"
                  : "border-ink/30 bg-transparent"
              }`}
              style={{ transitionTimingFunction: CB }}
            />
          ))}
        </div>

        {/* slim top progress bar */}
        <div className="absolute inset-x-0 top-0 z-30 h-[2px] bg-transparent">
          <div
            className="h-full origin-left bg-gradient-to-r from-gold via-gold-bright to-emerald"
            style={{ transform: `scaleX(${easeInOutCubic(p)})` }}
          />
        </div>

        {/* ── staged serif reveals (per-line stagger + pointer parallax) ── */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          {STAGES.map((s, i) => {
            const o = bell(p, s.center);
            if (o <= 0.001) return null;
            // depth layer per stage so they parallax at slightly different rates
            const depth = 1 + i * 0.35;
            return (
              <h1
                key={i}
                className="absolute px-6 text-center font-display text-5xl leading-[1.04] text-ink sm:text-7xl md:text-[5.4rem]"
                style={{
                  opacity: o,
                  transform: `translate3d(${(reduced ? 0 : ptr.x * -8 * depth)}px, ${
                    (p - s.center) * -130 + (reduced ? 0 : ptr.y * -6 * depth)
                  }px, 0) scale(${0.965 + o * 0.035})`,
                  letterSpacing: "-0.012em",
                  textShadow:
                    "0 1px 2px rgba(244,241,233,0.9), 0 2px 36px rgba(244,241,233,0.7)",
                  willChange: "transform, opacity",
                }}
              >
                {s.lines.map((l, k) => {
                  // stagger each line on a tiny progress offset for a cascade
                  const lo = bell(p, s.center + k * 0.012);
                  return (
                    <span
                      key={k}
                      className="block"
                      style={{
                        opacity: lo,
                        transform: `translateY(${(1 - lo) * 14}px)`,
                      }}
                    >
                      {l}
                    </span>
                  );
                })}
              </h1>
            );
          })}

          {/* finale — over the minted, sealed coin (eased momentum settle) */}
          {finale > 0.001 && (
            <div
              className="absolute flex flex-col items-center px-6 text-center"
              style={{
                opacity: finale,
                // overshoot-free expressive settle: rises and locks
                transform: `translateY(${(1 - easeInOutCubic(finale)) * 30}px)`,
                willChange: "transform, opacity",
              }}
            >
              <h1
                className="font-display text-5xl leading-[1.04] text-ink sm:text-7xl md:text-[5.4rem]"
                style={{
                  letterSpacing: "-0.012em",
                  textShadow:
                    "0 1px 2px rgba(244,241,233,0.92), 0 2px 40px rgba(244,241,233,0.75)",
                }}
              >
                Get back every dollar.
              </h1>
              <p
                className="mt-3 font-display text-2xl italic text-gold sm:text-3xl"
                style={{
                  textShadow: "0 1px 14px rgba(244,241,233,0.85)",
                  letterSpacing: "0.005em",
                  // tiny delayed reveal so the rupee line lands after the headline
                  opacity: bell(p, 0.955, 0.1),
                  transform: `translateY(${(1 - bell(p, 0.955, 0.1)) * 12}px)`,
                }}
              >
                And every rupee.
              </p>
              <a
                href="#tool"
                className="pointer-events-auto mt-9 inline-flex items-center gap-2 rounded-full bg-emerald-deep px-7 py-3.5 font-medium text-white shadow-[0_12px_44px_rgba(14,94,60,0.42)] transition hover:bg-emerald hover:-translate-y-0.5 hover:shadow-[0_18px_54px_rgba(14,94,60,0.5)]"
                style={{
                  transitionTimingFunction: CB,
                  opacity: bell(p, 0.97, 0.08),
                }}
              >
                Check my deposit →
              </a>
            </div>
          )}
        </div>

        {/* ── scroll hint ── */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center text-ink-soft"
          style={{ opacity: scrollHint, transition: `opacity 0.5s ${CB}` }}
        >
          <span className="text-sm tracking-[0.18em] uppercase drop-shadow-[0_1px_8px_rgba(244,241,233,0.9)]">
            Scroll
          </span>
          <span className="mt-1 animate-bounce text-lg">↓</span>
        </div>
      </div>
    </section>
  );
}
