"use client";

import { Effect } from "postprocessing";
import { wrapEffect } from "@react-three/postprocessing";

/**
 * Kuwahara oil-paint filter — the key "hand-painted" lever. For each pixel it splits a
 * neighbourhood into four overlapping quadrants, then outputs the mean of whichever
 * quadrant has the lowest colour variance. The result reads like flat brush strokes.
 * GLSL ES 1.0 convention (texture2D + texelSize), per the postprocessing build.
 */
const fragmentShader = /* glsl */ `
  #define KR 4

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
    vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);

    for (int x = -KR; x <= KR; x++) {
      for (int y = -KR; y <= KR; y++) {
        vec3 c = texture2D(inputBuffer, uv + vec2(float(x), float(y)) * texelSize).rgb;
        if (x <= 0 && y <= 0) { m0 += c; s0 += c * c; }
        if (x >= 0 && y <= 0) { m1 += c; s1 += c * c; }
        if (x <= 0 && y >= 0) { m2 += c; s2 += c * c; }
        if (x >= 0 && y >= 0) { m3 += c; s3 += c * c; }
      }
    }

    float n = float((KR + 1) * (KR + 1));
    vec3 outc = inputColor.rgb;
    float minv = 1.0e9;

    m0 /= n; float v0 = dot(abs(s0 / n - m0 * m0), vec3(1.0)); if (v0 < minv) { minv = v0; outc = m0; }
    m1 /= n; float v1 = dot(abs(s1 / n - m1 * m1), vec3(1.0)); if (v1 < minv) { minv = v1; outc = m1; }
    m2 /= n; float v2 = dot(abs(s2 / n - m2 * m2), vec3(1.0)); if (v2 < minv) { minv = v2; outc = m2; }
    m3 /= n; float v3 = dot(abs(s3 / n - m3 * m3), vec3(1.0)); if (v3 < minv) { minv = v3; outc = m3; }

    outputColor = vec4(outc, inputColor.a);
  }
`;

class PainterlyImpl extends Effect {
  constructor() {
    super("PainterlyEffect", fragmentShader);
  }
}

export const Painterly = wrapEffect(PainterlyImpl);
