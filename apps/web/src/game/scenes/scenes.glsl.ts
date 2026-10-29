/**
 * One fragment per skin. Each defines `vec3 scene(vec2 px)` in CSS pixels.
 * They share the club toolkit (common.glsl.ts: haze, beam, laser, truss,
 * rig, look) so every skin is its own room in the same club; `finish`
 * darkens the board, adds danger and the strobe, and caps brightness.
 * Base light sits around 0.03–0.08; the rig, the kick and the drop push it up.
 */

/** The house room: raw concrete, a truss of white moving heads. */
export const STUDIO = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float h = haze(px);
  vec3 c = vec3(0.03, 0.03, 0.035) * (0.4 + 0.6 * uv.y) * h;
  float r = rig();
  vec3 white = vec3(0.95, 0.96, 1.0);
  vec3 cool = mix(white, pal(0), 0.25);
  c += truss(px, -uCell * 0.6, 7, 0.9, 0.35, uCell * 0.8, white, cool) * h * 0.2 * r;
  // On the drop the second truss fires from the floor.
  c += truss(px, uRes.y + uCell, 5, 0.7, -0.5, uCell * 1.0, cool, white) * h * 0.13 * uMusic.z;
  // A wash on the back wall that pumps with the kick.
  c += white * exp(-pow((uv.y - 0.15) / 0.25, 2.0)) * 0.03 * (0.4 + uMusic.x);
  c += pulseColor(px) * 0.25;
  return c;
}
`;

/** Soft pastel light through frosted glass, and wide pastel washes when the music asks. */
export const CLAY = /* glsl */ `
vec3 scene(vec2 px) {
  float aspect = uRes.x / uRes.y;
  vec2 p = px / uRes.y;
  vec3 c = vec3(0.0);
  float t = uTime * (0.6 + uEnergy * 0.8 + uMusic.z * 1.5);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 ctr = vec2(aspect * 0.5, 0.5) + vec2(sin(t * 0.045 * (1.0 + fi * 0.13) + fi * 2.1) * aspect * 0.42, cos(t * 0.037 * (1.0 + fi * 0.17) + fi * 1.3) * 0.42);
    float r = 0.24 + 0.05 * sin(t * 0.1 + fi) + uMusic.x * 0.05;
    float d = length(p - ctr);
    c += pal(i) * exp(-d * d / (r * r)) * 0.07;
  }
  float h = haze(px);
  c += (beam(px, vec2(0.0, -uCell), 0.6 + sin(uTime * 0.2) * 0.2, uCell * 5.0, 1.2) * pal(2) + beam(px, vec2(uRes.x, -uCell), -0.6 - sin(uTime * 0.17) * 0.2, uCell * 5.0, 1.2) * pal(0)) * h * 0.08 * (uMusic.z + uMusic.x * 0.4);
  c *= 1.0 + uEnergy * 0.5 + uFlare * 0.6;
  c += pulseColor(px) * 0.35;
  return c;
}
`;

/** A mirror ball over caustics: glints sweep the room, colored beams cut the haze. */
export const GEM = /* glsl */ `
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
  float k = caustic(p, uTime * (0.25 + uEnergy * 0.3));
  vec3 tint = mix(pal(0), pal(5), fract(atan(p.y, p.x) / 6.283 + uTime * 0.01));
  vec3 c = tint * k * 0.05;
  // The ball: hundreds of glints orbiting, brighter on the kick.
  vec2 ball = vec2(uRes.x * 0.5, -uCell * 2.0);
  float spin = uTime * (0.25 + uMusic.z * 0.4);
  vec2 q = px - ball;
  float ang = atan(q.x, q.y) + spin;
  float rad = length(q) / uCell;
  vec2 cell = vec2(floor(ang * 18.0), floor(rad * 0.9));
  float hsh = hash(cell);
  vec2 f = vec2(fract(ang * 18.0), fract(rad * 0.9)) - 0.5;
  float glint = step(0.72, hsh) * exp(-dot(f, f) * 40.0) * (0.4 + 0.6 * sin(uTime * 3.0 + hsh * 30.0));
  c += mix(vec3(1.0), pal(int(hsh * 7.0)), 0.4) * glint * (0.08 + uMusic.x * 0.12 + uMusic.z * 0.2);
  float h = haze(px);
  c += truss(px, -uCell * 0.6, 4, 1.1, 0.5, uCell * 1.2, pal(0), pal(5)) * h * 0.13 * rig();
  c += pulseColor(px) * 0.3;
  return c;
}
`;

/** Prisms: every beam breaks into the spectrum as it crosses the haze. */
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
  float hsh = hash(id);
  vec3 c = spectrum(hsh + uTime * 0.01) * (0.008 + 0.015 * hsh) + vec3(0.75, 0.85, 1.0) * edge * (0.012 + uMusic.y * 0.02);
  // Prism beams: three sweeping lights, each a fan of colors side by side.
  float h = haze(px);
  float r = rig();
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 o = vec2(uRes.x * (0.2 + 0.3 * fi), -uCell);
    float a = sin(uTime * (0.3 + fi * 0.07) + fi * 2.0 + uClock.z) * 0.55;
    for (int k = 0; k < 5; k++) {
      float fk = float(k) / 4.0;
      c += spectrum(fk * 0.8 + fi * 0.2) * beam(px, o, a + (fk - 0.5) * 0.09, uCell * 0.55, 1.0) * h * 0.08 * r;
    }
  }
  for (int i = 0; i < 8; i++) {
    vec3 pc;
    float f = ringAt(px, i, pc);
    if (f <= 0.0) continue;
    float d = length(px - uPulse[i].xy) / (60.0 + uPulse[i].w * 14.0);
    c += spectrum(d * 0.35 + hsh * 0.2) * f * 0.2;
  }
  return c;
}
`;

/** The synthwave floor and a fan of lasers from the horizon, sweeping with the phrase. */
export const NEON = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float horizon = 0.46;
  vec3 a = pal(5), b = pal(2);
  vec3 c = vec3(0.0);
  float speed = 0.35 + uLevel * 0.9 + uEnergy * 0.6 + uMusic.x * 0.4 + uMusic.z * 1.2;
  float glow = 0.09 + uAudio.x * 0.12 + uMusic.x * 0.1 + uMusic.z * 0.15;
  for (int side = 0; side < 2; side++) {
    float y = side == 0 ? uv.y - horizon : horizon - uv.y;
    if (y <= 0.0) continue;
    float z = 0.12 / y;
    float x = (uv.x - 0.5) * (uRes.x / uRes.y) * z * 3.0;
    float zz = z + uTime * speed;
    float lx = (0.5 - abs(fract(x) - 0.5)) / fwidth(x);
    float lz = (0.5 - abs(fract(zz) - 0.5)) / fwidth(zz);
    float d = min(lx, lz);
    float line = exp(-d * d * 0.35) + exp(-d * 0.25) * 0.25;
    float fade = exp(-z * 0.35) * smoothstep(0.0, 0.08, y);
    c += mix(a, b, smoothstep(0.0, 0.5, y)) * line * fade * glow * (side == 0 ? 1.0 : 0.35);
  }
  c += mix(a, b, 0.5) * exp(-abs(uv.y - horizon) * 18.0) * (0.06 + uAudio.x * 0.06);
  // Lasers from the vanishing point: a fan that opens on the drop and stutters on the hats.
  vec2 o = vec2(uRes.x * 0.5, uRes.y * horizon);
  float l = look(7.0);
  int n = 6 + int(uMusic.z * 8.0);
  float open = 0.35 + uMusic.z * 0.9 + uMusic.w * 0.3;
  for (int i = 0; i < 14; i++) {
    if (i >= n) break;
    float fi = float(i) / 13.0;
    float ang = 3.14159 + (fi - 0.5) * open * 2.4 + sin(uTime * (0.4 + l) + fi * 3.0) * 0.25;
    vec3 col = pal(int(mod(float(i) + uClock.z, 7.0)));
    c += col * laser(px, o, ang) * (0.06 + uMusic.x * 0.08 + uMusic.y * 0.04 + uMusic.z * 0.12);
  }
  c += pulseColor(px) * 0.3;
  return c;
}
`;

/** Aurora curtains overhead; on drops, soft beams rise through them. */
export const AURORA = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes.y;
  vec3 c = vec3(0.0);
  float t = uTime * (0.05 + uEnergy * 0.05 + uMusic.z * 0.08);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float base = 0.25 + fi * 0.13;
    float curve = base + (fbm(vec2(uv.x * (0.9 + fi * 0.3) + t * (1.0 + fi * 0.4), fi * 7.0)) - 0.5) * 0.35;
    float above = curve - uv.y;
    float hem = exp(-pow(above / 0.012, 2.0));
    float rays = above > 0.0 ? exp(-above * (5.0 - uFlare - uMusic.z * 2.0)) * (0.55 + 0.45 * noise(vec2(uv.x * 60.0 + fi * 13.0, uTime * 0.4))) : exp(above * 60.0);
    vec3 col = mix(pal(3), pal(0), fi / 3.0);
    col = mix(col, pal(2), smoothstep(0.0, 0.25, above) * 0.6);
    c += col * (hem * 0.6 + rays) * (0.02 + uAudio.y * 0.03 + uMusic.x * 0.015);
  }
  float h = haze(px);
  c += truss(px, uRes.y + uCell, 5, 0.6, 0.25, uCell * 2.4, pal(3), pal(0)) * h * 0.08 * (uMusic.z + uMusic.w * 0.5);
  c *= 1.0 + uFlare * 1.2 + uEnergy * 0.5;
  c += pulseColor(px) * 0.25;
  return c;
}
`;

/** Smoke and warm light: amber beams from the floor, sparks rising, the combo stokes it. */
export const EMBER = /* glsl */ `
vec3 sparks(vec2 px, float scale, float speed, float seed) {
  vec2 p = px / (uCell * scale);
  p.y += uTime * speed * (1.0 + uEnergy * 1.2 + uMusic.z);
  p.x += sin(p.y * 0.35 + seed) * 0.6;
  vec2 cell = floor(p), f = fract(p) - 0.5;
  float h = hash(cell + seed);
  if (h < 0.78) return vec3(0.0);
  vec2 o = (hash2(cell + seed * 3.1) - 0.5) * 0.6;
  float d = length(f - o);
  float flicker = 0.6 + 0.4 * sin(uTime * (5.0 + h * 9.0) + h * 30.0);
  return mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.75, 0.35), h) * exp(-d * d * 90.0) * flicker;
}
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float smoke = fbm(px / (uCell * 4.0) + vec2(sin(uTime * 0.1), uTime * 0.12));
  float heat = 0.03 + uEnergy * 0.04 + uMusic.x * 0.04 + uMusic.z * 0.02;
  vec3 c = vec3(1.0, 0.28, 0.06) * pow(uv.y, 3.0) * heat * (0.6 + 0.6 * smoke);
  c += sparks(px, 2.2, 1.1, 1.0) * 0.18 + sparks(px, 1.4, 1.8, 7.0) * 0.12 + sparks(px, 0.8, 2.6, 13.0) * 0.08;
  // Floor cannons: amber beams up through the smoke.
  vec3 amber = vec3(1.0, 0.55, 0.18);
  c += truss(px, uRes.y + uCell * 0.5, 6, 0.8, 0.4, uCell * 0.9, amber, vec3(1.0, 0.3, 0.1)) * smoothstep(0.3, 0.8, smoke) * 0.16 * rig();
  c += pulseColor(px) * vec3(1.0, 0.6, 0.4) * 0.3;
  return c;
}
`;

/** An isometric LED wall: tiles light in patterns that change every phrase. */
export const BEVEL = /* glsl */ `
vec3 scene(vec2 px) {
  float s = uCell * 2.0;
  vec2 p = px / s + vec2(uTime * 0.03, uTime * 0.015);
  vec2 a = vec2(p.x / 0.866, p.y - p.x * 0.577);
  vec2 b = vec2(p.x / 0.866, p.y + p.x * 0.577);
  float line = 1.0 - smoothstep(0.0, 0.03, min(min(0.5 - abs(fract(a.y) - 0.5), 0.5 - abs(fract(b.y) - 0.5)), 0.5 - abs(fract(a.x) - 0.5)));
  vec2 id = floor(vec2(a.x, a.y + b.y));
  float h = hash(id);
  // Patterns: a sweep across the wall on the beat, a checker that flips on the kick, sparse random.
  float l = look(11.0);
  float beatPos = uClock.x / 4.0;
  float on = l < 0.33 ? step(abs(fract(id.x * 0.08 - beatPos) - 0.5), 0.08)
           : l < 0.66 ? step(0.5, mod(id.x + id.y + floor(uClock.x), 2.0)) * uMusic.x
           : step(0.9 - uMusic.x * 0.1, h);
  vec3 tone = mix(pal(1), pal(5), h);
  vec3 c = vec3(0.6, 0.65, 0.75) * line * 0.06 + tone * on * (0.07 + uMusic.x * 0.05 + uMusic.z * 0.1);
  c *= 1.0 + uEnergy * 0.5;
  c += pulseField(px) * (vec3(0.8) * 0.03 + tone * line * 0.2);
  return c;
}
`;

/** A wireframe tunnel rushing at you, a frame per beat. */
export const WIRE = /* glsl */ `
float frameDist(vec2 q, float r) {
  vec2 d = abs(q) - vec2(r);
  return abs(max(d.x, d.y));
}
vec3 scene(vec2 px) {
  vec2 ctr = uBoard.xy + uBoard.zw * 0.5;
  vec2 q = (px - ctr) / uRes.y;
  q = rot(sin(uTime * 0.07) * 0.15 + uMusic.z * 0.2) * q;
  vec3 c = vec3(0.0);
  // Travel speed follows the beat clock, so frames arrive on the kick.
  float travel = uTime * 0.6 * (1.0 + uMusic.z * 1.5) + uMusic.x * 0.05;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float z = fract(fi / 10.0 - travel * 0.25);
    float r = 0.04 / max(z, 0.02);
    float d = frameDist(q, r);
    float w = 0.002 / max(z, 0.05);
    float fade = smoothstep(0.0, 0.15, z) * (1.0 - z);
    vec3 col = pal(int(mod(fi + uClock.z, 7.0)));
    c += col * exp(-d * d / (w * w)) * fade * (0.08 + uMusic.x * 0.1 + uMusic.z * 0.15);
    c += col * exp(-d / (w * 6.0)) * fade * 0.01;
  }
  c += pulseColor(px) * 0.25;
  return c;
}
`;

/** A pixel LED wall: equaliser bars and scrolling stars, every block a real pixel. */
export const NES = /* glsl */ `
vec3 scene(vec2 px) {
  float b = max(2.0, floor(uCell / 8.0)) * 2.0;
  vec2 cell = floor(px / b);
  vec2 grid = floor(uRes / b);
  // Stars scroll behind.
  vec2 sp = cell;
  sp.x += floor(uTime * (6.0 + uLevel * 12.0 + uMusic.z * 20.0));
  float star = step(0.996, hash(sp)) * (0.5 + 0.5 * step(0.3, fract(uTime + hash(sp + 3.0))));
  vec3 c = vec3(0.9) * star * 0.08;
  // Equaliser: columns of blocks rising with the bands, palette colors, from the floor.
  float colW = 3.0;
  float col = floor(cell.x / colW);
  float bandSel = mod(col, 3.0);
  float level = bandSel < 1.0 ? uAudio.x : bandSel < 2.0 ? uAudio.y : uAudio.z;
  level = level * (0.4 + 0.6 * hash(vec2(col, floor(uTime * 8.0)))) + uMusic.x * 0.2;
  float rows = grid.y * (0.18 + uMusic.z * 0.2);
  float lit = step(grid.y - cell.y, level * rows) * step(1.0, mod(cell.x, colW));
  c += pal(int(mod(col, 7.0))) * lit * (0.07 + uMusic.z * 0.08);
  vec2 qb = (cell + 0.5) * b;
  c += pulseColor(qb) * 0.3;
  return c;
}
`;

/** The four greens on an LED wall: a slow diagonal pattern that steps on the beat. */
export const GAMEBOY = /* glsl */ `
vec3 scene(vec2 px) {
  float b = max(2.0, floor(uCell / 6.0)) * 2.0;
  vec2 p = floor(px / b);
  // Scroll in steps on the beat, not smoothly: like a handheld redraw.
  float step4 = floor(uClock.x) + floor(uTime * 126.0 / 60.0 / 4.0) * 4.0;
  vec2 s = p + vec2(step4 * 2.0, step4) * (1.0 + uLevel);
  vec2 tile = floor(s / 8.0), f = mod(s, 8.0) - 3.5;
  float diamond = step(abs(f.x) + abs(f.y), 2.0 + 2.0 * uMusic.x + sin(uTime * 0.6 + tile.x * 0.7 + tile.y));
  float shade = mod(tile.x + tile.y, 2.0) * 0.4 + diamond * 0.5;
  shade += pulseField((p + 0.5) * b) * 0.8 + uMusic.z * 0.3 + uFlare * 0.3;
  float level = floor(clamp(shade, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
  vec3 c = mix(vec3(0.03, 0.06, 0.03), vec3(0.35, 0.5, 0.18), level);
  return c * 0.13 * (1.0 + uEnergy * 0.4);
}
`;

/** One white light from above, in thick fog. On the drop, two more join it. */
export const MONO = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 ctr = uBoard.xy + uBoard.zw * 0.5;
  float h = haze(px);
  float fog = 0.5 + 0.5 * fbm(px / (uCell * 3.0) + vec2(0.0, uTime * 0.08));
  vec3 c = vec3(0.04) * fog;
  float r = 0.4 + uMusic.x * 0.6 + uMusic.z;
  c += vec3(beam(px, vec2(ctr.x, -uCell * 2.0), 0.0, uCell * 3.2, 1.4)) * fog * 0.22 * r;
  c += vec3(beam(px, vec2(ctr.x - uBoard.z * 1.6, -uCell), 0.35, uCell * 2.0, 1.2) + beam(px, vec2(ctr.x + uBoard.z * 1.6, -uCell), -0.35, uCell * 2.0, 1.2)) * h * 0.18 * uMusic.z;
  float grain = (hash(px + fract(uTime * 13.7) * 100.0) - 0.5) * 0.03;
  c += vec3(grain) + vec3(pulseField(px) * 0.06);
  return c;
}
`;

/** Liquid glass: thick panes drift through a dark room; their rims catch the light and flare on the kick. */
export const GLASS = /* glsl */ `
float pane(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  vec3 c = mix(vec3(0.01, 0.012, 0.022), vec3(0.025, 0.028, 0.045), uv.y);
  float h = haze(px);
  vec2 light = normalize(vec2(-0.6, -0.8));
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 ctr = uRes * vec2(0.5 + 0.45 * sin(uTime * 0.021 * (1.0 + fi * 0.23) + fi * 2.3), 0.5 + 0.42 * cos(uTime * 0.017 * (1.0 + fi * 0.19) + fi * 1.7));
    vec2 b = uCell * vec2(2.5 + 2.5 * hash(vec2(fi, 1.0)), 1.6 + 2.6 * hash(vec2(fi, 2.0)));
    vec2 q = rot(sin(uTime * 0.015 + fi) * 0.35) * (px - ctr);
    float d = pane(q, b, uCell * 1.3);
    float inside = 1.0 - smoothstep(-1.0, 1.0, d);
    vec3 tint = pal(i);
    // Thick glass: colour gathers toward the rim, the middle stays dark.
    float depth = clamp(-d / (uCell * 1.4), 0.0, 1.0);
    c = mix(c, c * 0.6 + tint * 0.012, inside);
    c += tint * inside * (1.0 - depth) * 0.035;
    // The rim: brilliant where it faces the light, coloured where it faces away.
    float rim = exp(-abs(d + 1.5) / (uCell * 0.06));
    float facing = 0.5 + 0.5 * dot(normalize(q / b + 1e-4), light);
    c += mix(tint, vec3(1.0), facing * facing) * rim * (0.02 + 0.09 * pow(facing, 3.0)) * (0.7 + uMusic.x * 0.8 + uMusic.z * 1.2);
  }
  c += truss(px, -uCell * 0.6, 5, 0.9, 0.3, uCell * 0.7, vec3(0.9, 0.95, 1.0), mix(pal(0), vec3(1.0), 0.5)) * h * 0.11 * rig();
  c += pulseColor(px) * 0.3;
  return c;
}
`;

/** Béton brut: a board-marked concrete hall, formwork panels and tie holes, raked by one hard light; strip lights hit on the kick. */
export const BRUT = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float h = haze(px);
  vec2 panel = uCell * vec2(4.0, 2.0);
  vec2 f = fract(px / panel);
  vec2 dd = min(f, 1.0 - f) * panel;
  float seam = 1.0 - smoothstep(0.0, 1.6, min(dd.x, dd.y));
  float holes = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 o = (vec2(0.25 + 0.5 * float(i), 0.5) - f) * panel;
    holes += exp(-dot(o, o) / (uCell * uCell * 0.012));
  }
  float conc = 0.55 * fbm(px / (uCell * 1.4)) + 0.45 * fbm(px / (uCell * 0.25) + 3.0);
  float boards = 0.5 + 0.5 * sin(px.y / uCell * 7.0 + fbm(px / (uCell * 2.0)) * 5.0);
  vec3 wall = vec3(0.05, 0.049, 0.046) * (0.5 + conc) * (0.9 + 0.1 * boards);
  wall *= 1.0 - seam * 0.5 - holes * 0.7;
  // One raking light that crosses the wall with the phrase.
  vec2 spot = vec2(uRes.x * (0.5 + 0.42 * sin(uTime * 0.04 + uClock.z * 1.7)), -uRes.y * 0.1);
  float rake = exp(-pow(length((px - spot) / uRes.y), 2.0) * 2.5);
  vec3 c = wall * (0.35 + 1.6 * rake) * (0.8 + 0.2 * h);
  // Linear strip lights either side of the board, struck by the kick.
  float strip = 0.0;
  for (int i = 0; i < 2; i++) {
    float x = i == 0 ? uBoard.x - uCell * 2.5 : uBoard.x + uBoard.z + uCell * 2.5;
    float dx = abs(px.x - x);
    float along = smoothstep(uBoard.y - uCell, uBoard.y + uCell, px.y) * smoothstep(uBoard.y + uBoard.w + uCell, uBoard.y + uBoard.w - uCell, px.y);
    strip += (exp(-dx / 1.5) + exp(-dx / (uCell * 1.2)) * 0.25) * along;
  }
  c += vec3(0.95, 0.97, 1.0) * strip * (0.03 + uMusic.x * 0.12 * rig() + uMusic.z * 0.15);
  c += vec3(0.9) * truss(px, -uCell * 0.6, 3, 0.6, 0.2, uCell * 1.4, vec3(1.0), vec3(0.85)) * h * 0.06 * uMusic.z;
  c += vec3(pulseField(px) * 0.05);
  return c;
}
`;

/** Weathering steel: rusted plates, sodium haze, and curved slits of hot light between the walls that open on the kick. */
export const CORTEN = /* glsl */ `
vec3 scene(vec2 px) {
  vec2 uv = px / uRes;
  float h = haze(px);
  float n = fbm(px / (uCell * 1.5));
  float n2 = fbm(px / (uCell * 0.3) + 7.0);
  float plateW = uCell * 5.0;
  float fx = fract(px.x / plateW);
  float seam = 1.0 - smoothstep(0.0, 2.0, min(fx, 1.0 - fx) * plateW);
  float runoff = noise(vec2(px.x / (uCell * 0.12), px.y / (uCell * 8.0)));
  vec3 rust = mix(vec3(0.42, 0.13, 0.03), vec3(0.75, 0.33, 0.08), n2);
  vec3 c = rust * (0.03 + 0.05 * n) * (0.65 + 0.35 * runoff) * (1.0 - seam * 0.7);
  c *= 0.6 + 0.6 * pow(1.0 - uv.y, 1.5);
  // Slits: the gap between two curved walls, a hairline of sodium light.
  vec3 hot = vec3(1.0, 0.5, 0.14);
  float open = 0.3 + uMusic.x * 0.9 + uMusic.z * 1.5;
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    float base = uBoard.x + uBoard.z * 0.5 + side * (uBoard.z * 0.5 + uCell * 3.0);
    float sx = base + side * sin(uv.y * 3.1416 + uTime * 0.05 * side) * uCell * 1.6;
    float dx = abs(px.x - sx);
    c += hot * (exp(-dx / (1.0 + open * 1.5)) * 0.35 + exp(-dx / (uCell * (0.8 + open)))) * 0.05 * open;
  }
  c += truss(px, uRes.y + uCell * 0.5, 5, 0.8, 0.35, uCell * 1.0, hot, vec3(1.0, 0.68, 0.3)) * h * 0.12 * rig();
  c += pulseColor(px) * vec3(1.0, 0.6, 0.3) * 0.3;
  return c;
}
`;
