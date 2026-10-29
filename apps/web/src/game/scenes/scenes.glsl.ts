/**
 * One fragment per skin. Each defines `vec3 scene(vec2 px)` in CSS pixels;
 * `finish` (common.glsl.ts) darkens the board, adds danger and caps brightness.
 * Base light sits around 0.03–0.08; reactions push it toward the cap.
 */

/** Pastel blobs drifting very slowly, like light through frosted glass. */
export const CLAY = /* glsl */ `
vec3 scene(vec2 px) {
  float aspect = uRes.x / uRes.y;
  vec2 p = px / uRes.y;
  vec3 c = vec3(0.0);
  float t = uTime * (0.6 + uEnergy * 0.8);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 ctr = vec2(aspect * 0.5, 0.5) + vec2(sin(t * 0.045 * (1.0 + fi * 0.13) + fi * 2.1) * aspect * 0.42, cos(t * 0.037 * (1.0 + fi * 0.17) + fi * 1.3) * 0.42);
    float r = 0.24 + 0.05 * sin(t * 0.1 + fi) + uAudio.x * 0.04;
    float d = length(p - ctr);
    c += pal(i) * exp(-d * d / (r * r)) * 0.07;
  }
  c *= 1.0 + uEnergy * 0.5 + uFlare * 0.6;
  c += pulseColor(px) * 0.35;
  return c;
}
`;

/** Rotating caustics and the odd glint, in the stones' colors. */
export const GEM = /* glsl */ `
// Ridged noise, warped: bright veins like light through a cut stone.
float caustic(vec2 p, float t) {
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p * (1.0 + fi * 0.7);
    q += vec2(sin(q.y * 1.3 + t), cos(q.x * 1.1 - t * 0.8)) * 0.6;
    float n = noise(q * 1.5 + t * 0.2 + fi * 9.0);
    v += pow(1.0 - abs(n * 2.0 - 1.0), 7.0) / (1.0 + fi * 0.8);
  }
  return v;
}
vec3 scene(vec2 px) {
  vec2 p = (px - uRes * 0.5) / uCell * 0.35;
  p = rot(uTime * 0.02) * p;
  float t = uTime * (0.25 + uEnergy * 0.3);
  float k = caustic(p, t);
  float hue = fract(atan(p.y, p.x) / (2.0 * PI) + uTime * 0.01);
  vec3 tint = mix(pal(0), pal(5), hue);
  tint = mix(tint, pal(2), smoothstep(0.4, 1.0, hue));
  vec3 c = tint * k * (0.07 + uAudio.y * 0.05 + uFlare * 0.06);
  // Glints: sparse cells that flare briefly.
  vec2 g = floor(px / (uCell * 1.5));
  float h = hash(g);
  float tw = pow(max(0.0, sin(uTime * (0.7 + h * 1.6) + h * 40.0)), 40.0) * step(0.86, h);
  vec2 f = fract(px / (uCell * 1.5)) - 0.5;
  float star = max(0.0, 1.0 - length(f) * 6.0) + max(0.0, 1.0 - abs(f.x) * 40.0) * max(0.0, 1.0 - abs(f.y) * 4.0) * 0.4 + max(0.0, 1.0 - abs(f.y) * 40.0) * max(0.0, 1.0 - abs(f.x) * 4.0) * 0.4;
  c += vec3(1.0) * star * tw * (0.35 + uAudio.z * 0.4);
  c += pulseColor(px) * 0.3;
  return c;
}
`;

/** Large refracting facets; clears scatter the spectrum. */
export const CRYSTAL = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 p = px / (uCell * 6.0) + vec2(uTime * 0.015, uTime * 0.008);
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 r = o + 0.5 + 0.4 * sin(uTime * 0.05 + 6.28 * hash2(ip + o)) - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = ip + o; } else if (d < d2) d2 = d;
  }
  float edge = 1.0 - smoothstep(0.0, 0.06, sqrt(d2) - sqrt(d1));
  float h = hash(id);
  vec3 face = spectrum(h + px.x / uRes.x * 0.3 + uTime * 0.01) * (0.015 + 0.03 * h);
  vec3 c = face + vec3(0.75, 0.85, 1.0) * edge * (0.05 + uAudio.z * 0.05);
  c *= 1.0 + uEnergy * 0.6;
  // Pulses split into a rainbow across their width.
  for (int i = 0; i < 8; i++) {
    vec3 pc;
    float f = ringAt(px, i, pc);
    if (f <= 0.0) continue;
    float d = length(px - uPulse[i].xy) / (60.0 + uPulse[i].w * 14.0);
    c += spectrum(d * 0.35 + h * 0.2) * f * 0.22;
  }
  c += spectrum(uTime * 0.05) * uFlare * 0.04;
  return c;
}
`;

/** A perspective grid running to the horizon, pumping with the bass. */
export const NEON = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float horizon = 0.46;
  vec3 a = pal(5), b = pal(2);
  vec3 c = vec3(0.0);
  float speed = 0.35 + uLevel * 0.9 + uEnergy * 0.6 + uAudio.x * 0.25;
  float glow = 0.11 + uAudio.x * 0.16 + uAudio.w * 0.12 + uFlare * 0.08;
  for (int side = 0; side < 2; side++) {
    // Floor below the horizon, a fainter mirrored ceiling above it.
    float y = side == 0 ? uv.y - horizon : horizon - uv.y;
    if (y <= 0.0) continue;
    float z = 0.12 / y;
    float x = (uv.x - 0.5) * (uRes.x / uRes.y) * z * 3.0;
    float zz = z + uTime * speed;
    // Distance to the nearest grid line, in screen pixels, drawn ~2px wide with a soft glow.
    float lx = (0.5 - abs(fract(x) - 0.5)) / fwidth(x);
    float lz = (0.5 - abs(fract(zz) - 0.5)) / fwidth(zz);
    float d = min(lx, lz);
    float line = exp(-d * d * 0.35) + exp(-d * 0.25) * 0.25;
    float fade = exp(-z * 0.35) * smoothstep(0.0, 0.08, y);
    vec3 col = mix(a, b, smoothstep(0.0, 0.5, y));
    c += col * line * fade * glow * (side == 0 ? 1.0 : 0.35);
  }
  // Haze along the horizon.
  c += mix(a, b, 0.5) * exp(-abs(uv.y - horizon) * 18.0) * (0.06 + uAudio.x * 0.05);
  c += pulseColor(px) * 0.3;
  return c;
}
`;

/** Aurora curtains that wave; big clears light them up. */
export const AURORA = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes.y;
  vec3 c = vec3(0.0);
  float t = uTime * (0.05 + uEnergy * 0.05);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float base = 0.25 + fi * 0.13;
    float curve = base + (fbm(vec2(uv.x * (0.9 + fi * 0.3) + t * (1.0 + fi * 0.4), fi * 7.0)) - 0.5) * 0.35;
    float above = curve - uv.y;
    // Bright at the hem, rays fading upward.
    float hem = exp(-pow(above / 0.012, 2.0));
    float rays = above > 0.0 ? exp(-above * (5.0 - uFlare)) * (0.55 + 0.45 * noise(vec2(uv.x * 60.0 + fi * 13.0, uTime * 0.4))) : exp(above * 60.0);
    vec3 col = mix(pal(3), pal(0), fi / 3.0);
    col = mix(col, pal(2), smoothstep(0.0, 0.25, above) * 0.6);
    c += col * (hem * 0.6 + rays) * (0.022 + uAudio.y * 0.03 + uAudio.x * 0.015);
  }
  c *= 1.0 + uFlare * 1.2 + uEnergy * 0.5;
  c += pulseColor(px) * 0.25;
  return c;
}
`;

/** Embers and sparks rising from a warm floor; combos stoke it. */
export const EMBER = /* glsl */ `
vec3 sparks(vec2 px, float scale, float speed, float seed) {
  vec2 p = px / (uCell * scale);
  p.y += uTime * speed * (1.0 + uEnergy * 1.2);
  p.x += sin(p.y * 0.35 + seed) * 0.6;
  vec2 cell = floor(p), f = fract(p) - 0.5;
  float h = hash(cell + seed);
  if (h < 0.78) return vec3(0.0);
  vec2 o = (hash2(cell + seed * 3.1) - 0.5) * 0.6;
  float d = length(f - o);
  float flicker = 0.6 + 0.4 * sin(uTime * (5.0 + h * 9.0) + h * 30.0);
  float core = exp(-d * d * 90.0) * flicker;
  return mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.75, 0.35), h) * core;
}
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float heat = 0.04 + uEnergy * 0.05 + uAudio.x * 0.06 + uAudio.w * 0.03 + uFlare * 0.04;
  vec3 c = vec3(1.0, 0.28, 0.06) * pow(uv.y, 3.0) * heat;
  c *= 0.7 + 0.3 * fbm(vec2(uv.x * 3.0, uTime * 0.15));
  c += sparks(px, 2.2, 1.1, 1.0) * 0.18;
  c += sparks(px, 1.4, 1.8, 7.0) * 0.12;
  c += sparks(px, 0.8, 2.6, 13.0) * 0.08;
  c += pulseColor(px) * vec3(1.0, 0.6, 0.4) * 0.3;
  return c;
}
`;

/** Drifting isometric geometry: the quietest one. */
export const BEVEL = /* glsl */ `
vec3 scene(vec2 px) {
  float s = uCell * 2.0;
  vec2 p = px / s + vec2(uTime * 0.04, uTime * 0.02);
  // Axial coordinates of an isometric (rhombus) grid.
  vec2 a = vec2(p.x / 0.866, p.y - p.x * 0.577);
  vec2 b = vec2(p.x / 0.866, p.y + p.x * 0.577);
  float line = 1.0 - smoothstep(0.0, 0.03, min(min(0.5 - abs(fract(a.y) - 0.5), 0.5 - abs(fract(b.y) - 0.5)), 0.5 - abs(fract(a.x) - 0.5)));
  vec2 id = floor(vec2(a.x, a.y + b.y));
  float h = hash(id);
  float face = step(0.82, h) * (0.5 + 0.5 * sin(uTime * 0.3 + h * 20.0));
  vec3 tone = mix(pal(1), pal(5), h);
  vec3 c = vec3(0.6, 0.65, 0.75) * line * 0.06 + tone * face * 0.03;
  c *= 1.0 + uEnergy * 0.5 + uAudio.x * 0.3;
  c += pulseField(px) * (vec3(0.8) * 0.03 + tone * line * 0.2);
  return c;
}
`;

/** Wireframe cubes turning in the void, demoscene style. */
export const WIRE = /* glsl */ `
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec2 proj(vec3 v, vec2 ctr, float size) { float z = 3.2 + v.z; return ctr + v.xy / z * size * 3.2; }
float cube(vec2 px, vec2 ctr, float size, float t) {
  float d = 1e9;
  vec3 v[8];
  for (int i = 0; i < 8; i++) {
    vec3 q = vec3(float(i & 1) * 2.0 - 1.0, float((i >> 1) & 1) * 2.0 - 1.0, float((i >> 2) & 1) * 2.0 - 1.0);
    q.xz = rot(t) * q.xz;
    q.yz = rot(t * 0.7) * q.yz;
    v[i] = q;
  }
  for (int i = 0; i < 8; i++) for (int k = 0; k < 3; k++) {
    int j = i ^ (1 << k);
    if (j > i) d = min(d, seg(px, proj(v[i], ctr, size), proj(v[j], ctr, size)));
  }
  return d;
}
vec3 scene(vec2 px) {
  vec3 c = vec3(0.0);
  float bx = uBoard.x, bw = uBoard.z;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float h = hash(vec2(fi, 3.0));
    float side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
    float room = side < 0.0 ? bx : uRes.x - bx - bw;
    float x = side < 0.0 ? bx * (0.2 + 0.6 * h) : bx + bw + room * (0.2 + 0.6 * h);
    float y = uRes.y * (0.15 + 0.7 * fract(h * 7.3 + uTime * 0.004 * (1.0 + fi)));
    float size = uCell * (0.7 + h * 1.2) * (1.0 + uAudio.w * 0.16 + uAudio.x * 0.08);
    float d = cube(px, vec2(x, y), size, uTime * (0.15 + h * 0.2) * (1.0 + uEnergy) + fi);
    c += pal(i) * exp(-d * d / (1.6 + uFlare * 2.0)) * 0.22;
    c += pal(i) * exp(-d * 0.08) * 0.012;
  }
  c += pulseColor(px) * 0.25;
  return c;
}
`;

/** An 8-bit starfield with parallax; faster at higher levels. */
export const NES = /* glsl */ `
vec3 stars(vec2 px, float block, float speed, float density, float seed) {
  vec2 p = floor(px / block);
  p.x += floor(uTime * speed * (1.0 + uLevel * 2.0 + uEnergy));
  float h = hash(p + seed);
  if (h < 1.0 - density) return vec3(0.0);
  float tw = step(0.3, fract(uTime * (0.5 + h) + h * 9.0));
  int k = int(floor(hash(p + seed + 1.0) * 7.0));
  vec3 col = hash(p + 4.0) > 0.7 ? pal(k) : vec3(0.9);
  return col * (0.4 + 0.6 * tw);
}
vec3 scene(vec2 px) {
  float b = max(2.0, floor(uCell / 8.0)) * 2.0;
  vec3 c = stars(px, b, 6.0, 0.004, 1.0) * 0.05;
  c += stars(px, b, 14.0, 0.006, 5.0) * 0.09;
  c += stars(px, b * 2.0, 30.0, 0.003, 9.0) * 0.14;
  // Pulses come out as blocky rings too.
  vec2 q = (floor(px / b) + 0.5) * b;
  c += pulseColor(q) * 0.3;
  c *= 1.0 + uAudio.w * 0.4 + uFlare * 0.5;
  return c;
}
`;

/** The four greens, a slow diagonal pattern like a handheld's menu. */
export const GAMEBOY = /* glsl */ `
vec3 scene(vec2 px) {
  float b = max(2.0, floor(uCell / 6.0)) * 2.0;
  vec2 p = floor(px / b);
  vec2 s = p + floor(vec2(uTime * 3.0, uTime * 1.5) * (1.0 + uLevel));
  // A checker of 4×4 tiles, each with a dithered diamond.
  vec2 tile = floor(s / 8.0), f = mod(s, 8.0) - 3.5;
  float diamond = step(abs(f.x) + abs(f.y), 3.0 + 1.0 * sin(uTime * 0.6 + tile.x * 0.7 + tile.y));
  float shade = mod(tile.x + tile.y, 2.0) * 0.5 + diamond * 0.5;
  shade += pulseField((p + 0.5) * b) * 0.8 + uAudio.w * 0.15 + uFlare * 0.3;
  float level = floor(clamp(shade, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
  vec3 c = mix(vec3(0.03, 0.06, 0.03), vec3(0.35, 0.5, 0.18), level);
  return c * 0.12 * (1.0 + uEnergy * 0.4);
}
`;

/** Film grain and a soft halo around the board. Almost nothing, on purpose. */
export const MONO = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 ctr = uBoard.xy + uBoard.zw * 0.5;
  float d = length((px - ctr) / vec2(uBoard.z * 1.6, uBoard.w * 0.9));
  float halo = exp(-d * d * 1.6) * (0.05 + uAudio.x * 0.03 + uEnergy * 0.03 + uFlare * 0.04);
  float grain = (hash(px + fract(uTime * 13.7) * 100.0) - 0.5) * 0.035;
  float v = halo + grain + pulseField(px) * 0.08;
  return vec3(v);
}
`;
