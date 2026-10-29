/** Shared GLSL for every scene: uniforms, noise, the reaction pulses and the final tone. */
export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

export const COMMON = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;

uniform vec2 uRes;        // CSS px
uniform float uTime;      // s
uniform vec4 uBoard;      // x, y, w, h (px)
uniform float uCell;      // px
uniform float uEnergy;    // 0–1: back-to-back and combo
uniform float uDanger;    // 0–1: stack height
uniform float uLevel;     // 0–1: how far through the levels
uniform float uFlare;     // 0–~2: recent big clears, decaying
uniform float uCap;       // brightness ceiling
uniform vec4 uAudio;      // low, mid, high, beat (0–1)
uniform vec4 uPal[7];     // I O T S Z J L
uniform vec4 uPulse[8];   // x, y, start time, power
uniform vec4 uPulseCol[8];// r, g, b, kind (0 ripple, 1 big, 2 garbage)
uniform vec4 uMusic;      // kick, hat, drop, build (0–1 each)
uniform vec4 uClock;      // beat in bar (0–3), phrase pulse, phrase index, strobe

const float PI = 3.14159265;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { float n = hash(p); return vec2(n, hash(p + n + 17.17)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
vec3 pal(int i) { return uPal[i].rgb; }
vec3 spectrum(float t) { return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.0, 0.33, 0.67))); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// The same expanding rings the lattice uses: radius grows with time, reach with power.
float ringAt(vec2 px, int i, out vec3 col) {
  vec4 p = uPulse[i];
  col = uPulseCol[i].rgb;
  if (p.w <= 0.0) return 0.0;
  float age = uTime - p.z;
  float speed = 380.0 + p.w * 90.0;
  float reach = min(2600.0, 260.0 + p.w * 260.0);
  float r = age * speed;
  if (age < 0.0 || r > reach + 120.0) return 0.0;
  float d = length(px - p.xy);
  float width = 50.0 + p.w * 14.0;
  float ring = exp(-pow((d - r) / width, 2.0));
  float fade = (1.0 - smoothstep(reach * 0.5, reach, r)) * min(1.0, 0.45 + p.w * 0.1);
  return ring * fade;
}
float pulseField(vec2 px) { float s = 0.0; vec3 c; for (int i = 0; i < 8; i++) s += ringAt(px, i, c); return s; }
vec3 pulseColor(vec2 px) { vec3 s = vec3(0.0); vec3 c; for (int i = 0; i < 8; i++) { float f = ringAt(px, i, c); s += f * c; } return s; }

// ── Club lighting ──────────────────────────────────────────────

// Haze the light travels through: slow, rolling, never flat.
float haze(vec2 px) {
  // Contrasty: thick drifts and clear gaps, so beams read as volumes, not a wash.
  float f = fbm(px / (uCell * 6.0) + vec2(uTime * 0.035, -uTime * 0.06));
  return 0.15 + 1.4 * smoothstep(0.3, 0.8, f);
}

// How hard the rig is running right now: idle, kick, the drop, the build.
float rig() {
  return 0.22 + uMusic.x * 0.4 + uMusic.z * 0.9 + uMusic.w * 0.35;
}

// Each 16-bar phrase picks a new look: 0–1, stable for the whole phrase.
float look(float salt) {
  return hash(vec2(uClock.z, salt));
}

// A stage light: a cone from o, pointing at angle a (0 = straight down), widening with distance.
float beam(vec2 px, vec2 o, float a, float width, float len) {
  vec2 d = vec2(sin(a), cos(a));
  vec2 v = px - o;
  float along = dot(v, d);
  if (along <= 0.0) return 0.0;
  float perp = abs(v.x * d.y - v.y * d.x);
  float w = width * (0.06 + along / uRes.y);
  float core = exp(-(perp * perp) / (w * w));
  float fade = exp(-along / (len * uRes.y));
  float hot = 1.0 + 2.5 * exp(-along / (uCell * 1.2));
  return core * fade * hot;
}

// A laser: razor thin, with a soft halo.
float laser(vec2 px, vec2 o, float a) {
  vec2 d = vec2(sin(a), cos(a));
  vec2 v = px - o;
  float along = dot(v, d);
  if (along <= 0.0) return 0.0;
  float perp = abs(v.x * d.y - v.y * d.x);
  return (exp(-perp * perp / 2.0) + exp(-perp / (uCell * 0.4)) * 0.22) * exp(-along / (uRes.y * 1.6));
}

// A row of moving heads hung on a truss at height y: n beams, sweeping as one.
vec3 truss(vec2 px, float y, int n, float spread, float sweep, float width, vec3 colA, vec3 colB) {
  vec3 c = vec3(0.0);
  float l = look(3.1);
  for (int i = 0; i < 12; i++) {
    if (i >= n) break;
    float fi = float(i) / max(1.0, float(n - 1));
    float x = uRes.x * (0.06 + 0.88 * fi);
    // Phrase looks: fan in, fan out, parallel sweep, or crossing pairs.
    float base = l < 0.25 ? (0.5 - fi) * spread : l < 0.5 ? (fi - 0.5) * spread : l < 0.75 ? 0.0 : (mod(float(i), 2.0) < 1.0 ? 1.0 : -1.0) * spread * 0.4;
    float a = base + sin(uTime * sweep + fi * 2.4 + uClock.z) * 0.32;
    c += mix(colA, colB, fi) * beam(px, vec2(x, y), a, width, 1.1);
  }
  return c;
}

// 0 inside the board, 1 a little way out: the board itself stays dark.
float boardMask(vec2 px) {
  vec2 c = uBoard.xy + uBoard.zw * 0.5;
  vec2 d = abs(px - c) - uBoard.zw * 0.5;
  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  return smoothstep(-uCell * 0.2, uCell * 1.6, dist);
}

vec3 finish(vec3 c, vec2 px) {
  // Every scene breathes with the music: the bass swells it, each beat lifts it for a moment.
  c *= 1.0 + uAudio.x * 0.35 + uAudio.w * 0.45;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  // Danger drains the color and leaves a cold red.
  c = mix(c, vec3(lum) * vec3(1.0, 0.32, 0.28) * 1.4, uDanger * 0.75);
  c *= mix(0.1, 1.0, boardMask(px));
  vec2 q = vUV - 0.5;
  c *= 1.0 - dot(q, q) * 0.9;
  // Soft ceiling: never brighter than uCap, whatever a scene adds up to. The drop lifts it a little.
  float cap = uCap * (1.0 + uMusic.z * 0.55);
  c = cap * (1.0 - exp(-max(c, 0.0) / cap));
  // Strobe (drops only, and never with Reduce flashing): a white wash outside the board.
  c += vec3(uClock.w * 0.14 * boardMask(px));
  return c;
}
`;

export function fragment(scene: string): string {
  return `${COMMON}
${scene}
void main() {
  vec2 px = vUV * uRes;
  finalColor = vec4(finish(scene(px), px), 1.0);
}
`;
}
