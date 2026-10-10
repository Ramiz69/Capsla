// Фон «Орбиты» — перенос OrbitalBackground.metal и OrbitalFrameResolver.swift
// из приложения. Числа те же, чтобы кольца на сайте двигались как на телефоне.

const RINGS = [
  { baseDepth: 0.10, radius: 0.62, thickness: 0.0032, brightness: 1.00, wobble: 0.032, wobbleSpeed: 0.62, lightPhase: 0.0, travelSpeed: 0.22 },
  { baseDepth: 0.28, radius: 0.56, thickness: 0.0029, brightness: 0.90, wobble: 0.029, wobbleSpeed: 0.58, lightPhase: 0.8, travelSpeed: 0.22 },
  { baseDepth: 0.46, radius: 0.50, thickness: 0.0025, brightness: 0.78, wobble: 0.026, wobbleSpeed: 0.52, lightPhase: 1.7, travelSpeed: 0.22 },
  { baseDepth: 0.64, radius: 0.44, thickness: 0.0022, brightness: 0.64, wobble: 0.022, wobbleSpeed: 0.46, lightPhase: 2.5, travelSpeed: 0.22 },
  { baseDepth: 0.82, radius: 0.38, thickness: 0.0019, brightness: 0.52, wobble: 0.018, wobbleSpeed: 0.40, lightPhase: 3.4, travelSpeed: 0.22 },
  { baseDepth: 1.00, radius: 0.33, thickness: 0.0017, brightness: 0.42, wobble: 0.015, wobbleSpeed: 0.35, lightPhase: 4.3, travelSpeed: 0.22 },
];

const PALETTES = {
  monochrome: { dark: [[0, 0, 0], [1, 1, 1]], light: [[0.961, 0.961, 0.961], [0.050, 0.050, 0.040]] },
  ocean: { dark: [[0.008, 0.031, 0.071], [0.478, 0.855, 1.000]], light: [[0.925, 0.957, 0.980], [0.043, 0.243, 0.408]] },
  sunset: { dark: [[0.063, 0.020, 0.031], [1.000, 0.663, 0.451]], light: [[0.992, 0.949, 0.925], [0.412, 0.161, 0.086]] },
  forest: { dark: [[0.008, 0.047, 0.035], [0.529, 0.937, 0.702]], light: [[0.933, 0.973, 0.945], [0.043, 0.286, 0.169]] },
  violet: { dark: [[0.043, 0.020, 0.071], [0.812, 0.702, 1.000]], light: [[0.961, 0.945, 0.984], [0.243, 0.114, 0.412]] },
};

const TAU = Math.PI * 2;
const VEC4_PER_RING = 7;
const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
const wrap = (p) => p % TAU;
const fract = (v) => v - Math.floor(v);

function resolveRing(ring, time, motion, glow, tunnelDrift, lightDrift) {
  const { wobble, lightPhase } = ring;
  const rawTravel = fract(ring.baseDepth - time * ring.travelSpeed + 1);
  const travel = rawTravel * rawTravel * (3 - 2 * rawTravel);
  const depth = 0.04 + travel * 1.28;
  const nearFactor = 1 - smooth(0, 0.42, travel);
  const perspective = 1 / (0.44 + depth * 1.74) * (1 + nearFactor * 0.12);
  const t = time * ring.wobbleSpeed * 1.2 * motion;
  const curveX =
    Math.sin(wrap(t * 1.08 + tunnelDrift * 0.80 + depth * 5.0 + lightPhase)) * wobble * perspective +
    Math.sin(wrap(t * 0.58 + tunnelDrift * 0.36 + depth * 2.4 + lightPhase * 0.7)) * wobble * 0.42 * perspective +
    Math.cos(wrap(t * 0.22 + depth * 7.2)) * wobble * 0.12 * perspective;
  const curveY =
    Math.cos(wrap(t * 0.90 + tunnelDrift * 0.68 + depth * 3.6 + lightPhase * 0.7)) * wobble * perspective +
    Math.sin(wrap(t * 0.46 + tunnelDrift * 0.28 + depth * 5.7 + lightPhase * 0.5)) * wobble * 0.24 * perspective +
    Math.sin(wrap(t * 0.19 + depth * 8.0)) * wobble * 0.10 * perspective;
  const twist =
    Math.sin(wrap(t * 0.82 + tunnelDrift * 0.50 + depth * 4.5 + lightPhase)) * 0.28 +
    Math.sin(wrap(t * 0.34 + tunnelDrift * 0.16 + depth * 1.8)) * 0.10;
  const baseRadius = ring.radius * perspective;
  const baseThickness = ring.thickness * perspective * (1.10 + nearFactor * 0.16);
  const depthFade = smooth(1.16, 0.10, depth);
  const haze = 1 - smooth(0.40, 1.18, depth) * 0.42;
  const boost = 1 + nearFactor * 0.24;
  const la = -lightDrift + lightPhase + twist * 0.65;
  return [
    curveX, curveY, Math.cos(twist), Math.sin(twist),
    baseRadius, baseThickness, baseRadius * perspective, ring.brightness * depthFade * boost * haze,
    wrap(la), wrap(la + 2.20), wrap(la - 1.15), ring.brightness * depthFade * 0.30 * haze * glow,
    boost, 0.30 * boost, 0.14 * nearFactor * boost, smooth(1.12, 0.32, depth) * 0.09 * glow,
    (0.42 + boost * 0.22) * glow, wrap(time * 0.42 + lightPhase), wrap(-time * 0.27 + depth * 4.0), wrap(time * 0.55 + lightPhase * 1.3),
    wrap(-time * 0.31 + depth * 3.2), wrap(time * 0.18 + lightPhase), wrap(time * 0.35 + lightPhase), wrap(-time * 0.22 + depth * 5.0),
    wrap(time * 0.70 + lightPhase), wrap(-time * 0.24 + depth * 6.0), 0, 0,
  ];
}

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec3 uBg;
uniform vec3 uLine;
uniform float uDark;
uniform float uGlow;
uniform float uScale;
uniform vec2 uVig;
uniform int uCount;
uniform vec4 R[${6 * VEC4_PER_RING}];

void main() {
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = uv - 0.5;
  p.x *= aspect;
  p = (p - uCenter) / uScale;

  float lineAccum = 0.0, glowAccum = 0.0, fogAccum = 0.0, bloomSeed = 0.0;

  for (int i = 0; i < 6; i++) {
    if (i >= uCount) break;
    vec4 r0 = R[i * ${VEC4_PER_RING} + 0];
    vec4 r1 = R[i * ${VEC4_PER_RING} + 1];
    vec4 r2 = R[i * ${VEC4_PER_RING} + 2];
    vec4 r3 = R[i * ${VEC4_PER_RING} + 3];
    vec4 r4 = R[i * ${VEC4_PER_RING} + 4];
    vec4 r5 = R[i * ${VEC4_PER_RING} + 5];
    vec4 r6 = R[i * ${VEC4_PER_RING} + 6];

    vec2 off = p - r0.xy;
    vec2 pos = vec2(r0.z * off.x - r0.w * off.y, r0.w * off.x + r0.z * off.y);
    float angle = atan(pos.y, pos.x);
    float len = length(pos);

    float majorWarp = sin(angle * 2.0 + r4.y) * 0.035 + sin(angle * 3.0 + r4.z) * 0.020;
    float minorWarp = sin(angle * 5.0 + r4.w) * 0.010 + sin(angle * 8.0 + r5.x) * 0.006;
    float surfaceDetail = sin(angle * 7.0 + r6.x) * 0.035 + sin(angle * 13.0 + r6.y) * 0.018;
    float bias = cos(angle - r5.y) * 0.018;
    float radius = r1.x + r1.z * (majorWarp + minorWarp + bias);
    float thicknessNoise = 1.0 + sin(angle * 4.0 + r5.z) * 0.14 + sin(angle * 9.0 + r5.w) * 0.06;
    float thickness = r1.y * thicknessNoise;
    float dist = abs(len - radius);

    float a = max(0.0, cos(angle - r2.x)); float a2 = a * a; float lightA = a2 * a2 * a;
    float b = max(0.0, cos(angle - r2.y)); float b3 = b * b * b; float lightB = b3 * b3 * b;
    float c = max(0.0, cos(angle - r2.z)); float c2 = c * c; float c4 = c2 * c2; float lightC = c4 * c4 * c;
    float light = lightA * r3.x + lightB * r3.y + lightC * r3.z;

    float line = 1.0 - smoothstep(thickness, thickness * 1.9, dist);
    float glow = 1.0 - smoothstep(thickness * 2.2, thickness * 8.0, dist);
    float wGlow = glow * light * r2.w;

    lineAccum += line * light * r1.w * (0.95 + surfaceDetail);
    glowAccum += wGlow;
    fogAccum += glow * r3.w;
    bloomSeed += wGlow * r4.x;
  }

  lineAccum = min(lineAccum, 1.0); glowAccum = min(glowAccum, 1.0);
  fogAccum = min(fogAccum, 1.0); bloomSeed = min(bloomSeed, 1.0);

  float lineMask = 1.0 - exp(-lineAccum * 2.0);
  float glowMask = 1.0 - exp(-glowAccum * 1.18);
  float fogMask = 1.0 - exp(-fogAccum * 1.20);
  float bloomMask = 1.0 - exp(-bloomSeed * 0.95);

  float radial = length(p);
  float vignette = 1.0 - smoothstep(uVig.x, uVig.y, radial);
  lineMask *= vignette; glowMask *= vignette * 0.94; fogMask *= vignette * 0.88; bloomMask *= vignette * 0.82;
  fogMask = min(fogMask + (1.0 - smoothstep(0.0, 0.42, radial)) * 0.035, 1.0);
  float bloomVeil = (bloomMask * 0.10 + (1.0 - smoothstep(0.0, 0.55, radial)) * glowMask * 0.05) * uGlow;

  vec3 col;
  if (uDark > 0.5) {
    col = uBg + uLine * lineMask + uLine * glowMask * 0.16 + uLine * fogMask * 0.035 + uLine * bloomVeil * 0.09;
  } else {
    col = mix(uBg, uLine, lineMask);
    col = mix(col, uLine, glowMask * 0.05);
    col = mix(col, uLine, fogMask * 0.015);
    col = mix(col, uLine, bloomVeil * 0.018);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

class Orbital {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('webgl');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uRes', 'uCenter', 'uBg', 'uLine', 'uDark', 'uGlow', 'uScale', 'uVig', 'uCount', 'R']) this.u[n] = gl.getUniformLocation(prog, n);
    this.buf = new Float32Array(6 * VEC4_PER_RING * 4);

    this.time = 0;
    this.last = null;
    this.motion = 1;
    this.glow = 1;
    this.center = [0, 0];
    this.scale = 1;
    this.vignette = [0.58, 0.95];
    this.palette = 'monochrome';
    this.dark = true;
    this.progress = 0;
    this.colors = null;
    this.running = false;
    this.applyColors(true);
  }

  // Сдвиг температуры к концу фазы — PhaseProgressTint.swift, сила 0.20.
  tint([r, g, b]) {
    const k = 0.20 * Math.min(Math.max(this.progress, 0), 1);
    return [Math.min(r * (1 + k), 1), g, b * (1 - k)];
  }

  applyColors(immediate) {
    const [bg, line] = PALETTES[this.palette][this.dark ? 'dark' : 'light'];
    this.target = { bg: this.tint(bg), line: this.tint(line) };
    if (immediate || !this.colors) this.colors = { bg: [...this.target.bg], line: [...this.target.line] };
  }

  set({ palette, dark, progress, motion, center, scale, vignette } = {}) {
    if (vignette !== undefined) this.vignette = vignette;
    if (palette !== undefined) this.palette = palette;
    if (dark !== undefined) this.dark = dark;
    if (progress !== undefined) this.progress = progress;
    if (motion !== undefined) { this.motion = motion; this.glow = motion < 1 ? 0.65 : 1; }
    if (center !== undefined) this.center = center;
    if (scale !== undefined) this.scale = scale;
    this.applyColors(dark !== undefined && !this.running);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  frame(now) {
    if (this.last !== null) this.time += Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    // Плавный переход палитры за ~0.6 с, а не скачок.
    const e = 0.08;
    for (const k of ['bg', 'line']) for (let i = 0; i < 3; i++) this.colors[k][i] += (this.target[k][i] - this.colors[k][i]) * e;
    this.draw();
  }

  draw() {
    const gl = this.gl;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const motion = this.motion;
    const rings = RINGS.map((r) => resolveRing(r, this.time, motion, this.glow, this.time * 0.38 * motion, this.time * 0.62 * motion));
    rings.forEach((r, i) => this.buf.set(r, i * VEC4_PER_RING * 4));
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.uCenter, this.center[0], this.center[1]);
    gl.uniform3fv(this.u.uBg, this.colors.bg);
    gl.uniform3fv(this.u.uLine, this.colors.line);
    gl.uniform1f(this.u.uDark, this.dark ? 1 : 0);
    gl.uniform1f(this.u.uGlow, this.glow);
    gl.uniform1f(this.u.uScale, this.scale);
    gl.uniform2f(this.u.uVig, this.vignette[0], this.vignette[1]);
    gl.uniform1i(this.u.uCount, rings.length);
    gl.uniform4fv(this.u.R, this.buf);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = null;
    const loop = (t) => { if (!this.running) return; this.frame(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}


const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const T = JSON.parse($('strings').textContent);
const canvas = $('orbits');
const capsule = $('capsule');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 860px)');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ——— Фон и тема ———

let orbital = null;
try { orbital = new Orbital(canvas); } catch { canvas.remove(); }

let palette = PALETTES[store.get('capsla-palette')] ? store.get('capsla-palette') : 'monochrome';
let dark = root.dataset.theme !== 'light';

const css = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`;
const group = document.querySelector('.palettes');
const swatches = Object.keys(PALETTES).map((key) => {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.type = 'button';
  b.dataset.palette = key;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', T.palettes[key]);
  b.title = T.palettes[key];
  b.addEventListener('click', () => { palette = key; store.set('capsla-palette', key); applyTheme(); });
  group.append(b);
  return b;
});

// Стрелки внутри группы палитр, как у системных переключателей.
group.addEventListener('keydown', (e) => {
  const i = swatches.indexOf(document.activeElement);
  if (i < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const next = swatches[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : swatches.length - 1)) % swatches.length];
  next.focus();
  next.click();
});

function applyTheme() {
  root.dataset.theme = dark ? 'dark' : 'light';
  const mode = dark ? 'dark' : 'light';
  const [bg, line] = PALETTES[palette][mode];
  root.style.setProperty('--page', css(bg));
  // Отрезки фокуса в схеме сессии — цветом колец выбранной палитры.
  if (palette === 'monochrome') root.style.removeProperty('--accent');
  else root.style.setProperty('--accent', css(line));
  swatches.forEach((s) => {
    const [b, l] = PALETTES[s.dataset.palette][mode];
    s.style.setProperty('--bgc', css(b));
    s.style.setProperty('--line', css(l));
    s.setAttribute('aria-checked', String(s.dataset.palette === palette));
    s.tabIndex = s.dataset.palette === palette ? 0 : -1;
  });
  const button = $('theme');
  button.textContent = dark ? button.dataset.light : button.dataset.dark;
  orbital?.set({ palette, dark });
  if (orbital && !orbital.running) orbital.draw();
}
$('theme').addEventListener('click', () => { dark = !dark; store.set('capsla-theme', dark ? 'dark' : 'light'); applyTheme(); });

// Кольца стоят вокруг капсулы, как вокруг карточки на экране телефона.
function placeRings() {
  if (!orbital) return;
  const c = canvas.getBoundingClientRect();
  const k = capsule.getBoundingClientRect();
  const cx = k.left + k.width / 2 - c.left;
  const cy = k.top + k.height / 2 - c.top;
  orbital.set({
    center: [(cx - c.width / 2) / c.height, (cy - c.height / 2) / c.height],
    scale: k.height / (0.80 * c.height),
    vignette: narrow.matches ? [0.58, 0.95] : [0.46, 0.78],
  });
  if (!orbital.running) orbital.draw();
}
new ResizeObserver(placeRings).observe(document.querySelector('.hero'));

const updateMotion = () => orbital?.set({ motion: reduceMotion.matches ? 0.45 : 1 });
reduceMotion.addEventListener('change', updateMotion);

let heroVisible = true;
function updateRunning() {
  if (!orbital) return;
  if (heroVisible && !document.hidden) orbital.start(); else orbital.stop();
}
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; updateRunning(); }).observe(canvas);
document.addEventListener('visibilitychange', updateRunning);

// ——— Таймер ———

// ?speed=60 — ускорение, чтобы проверить смену фаз, не дожидаясь минуты.
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const clock = () => performance.now() * SPEED;
const CYCLES = 4;
const state = { status: 'idle', phase: 'focus', cycle: 0, minutes: 25, total: 1500, left: 1500, endAt: 0 };
const PHASE = { focus: '', short: T.shortBreak, long: T.longBreak };
const PLAY = '<path d="M7 4.5v15l13-7.5z"/>';
const PAUSE = '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/>';
// В пробном таймере перерывы короче настоящих, если выбрана одна минута:
// иначе посетитель не увидит смену фаз.
const breakMinutes = (kind) => (state.minutes === 1 ? 1 : kind === 'long' ? 15 : 5);

const cyclesEl = $('cycles');
const R = 15.5;
const C = 2 * Math.PI * R;
for (let i = 0; i < CYCLES; i++) {
  const d = document.createElement('div');
  d.className = 'cycle';
  d.innerHTML = `<svg viewBox="0 0 34 34" aria-hidden="true"><circle class="track" cx="17" cy="17" r="${R}"/><circle class="arc" cx="17" cy="17" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><span>${i + 1}</span>`;
  cyclesEl.append(d);
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const announce = (t) => { $('announce').textContent = t; };
const mirrors = document.querySelectorAll('[data-mirror]');
const mirrorPhase = document.querySelector('[data-mirror-phase]');

function render() {
  const active = state.status !== 'idle';
  const time = fmt(state.left);
  $('digits').textContent = time;
  mirrors.forEach((m) => { m.textContent = time; });
  if (mirrorPhase) mirrorPhase.textContent = state.phase === 'focus' ? T.focus : PHASE[state.phase];
  $('greeting').hidden = active;
  cyclesEl.hidden = !active;
  $('chips').hidden = active;
  $('reset').hidden = state.status !== 'paused';
  $('phase').textContent = PHASE[state.phase];
  $('play-icon').innerHTML = state.status === 'running' ? PAUSE : PLAY;
  $('play').setAttribute('aria-label', state.status === 'running' ? T.pause : state.status === 'paused' ? T.resume : T.start);
  document.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === state.minutes)));

  const progress = active ? 1 - state.left / state.total : 0;
  [...cyclesEl.children].forEach((el, i) => {
    const current = i === state.cycle && state.phase === 'focus';
    el.classList.toggle('done', i < state.cycle || (i === state.cycle && state.phase !== 'focus'));
    el.classList.toggle('current', current);
    el.querySelector('.arc').style.strokeDashoffset = current ? C * (1 - progress) : C;
  });
  orbital?.set({ progress: state.phase === 'focus' ? progress : 0 });
}

function begin(phase, minutes) {
  state.phase = phase;
  state.total = minutes * 60;
  state.left = state.total;
  state.endAt = clock() + state.total * 1000;
}

function nextPhase() {
  if (state.phase === 'focus') {
    const isLast = state.cycle === CYCLES - 1;
    begin(isLast ? 'long' : 'short', breakMinutes(isLast ? 'long' : 'short'));
    announce(PHASE[state.phase]);
  } else if (state.phase === 'short') {
    state.cycle += 1;
    begin('focus', state.minutes);
    announce(T.focusTime);
  } else {
    reset();
    announce(T.sessionDone);
  }
}

let tickTimer = null;
function tick() {
  if (state.status !== 'running') return;
  state.left = Math.max(0, Math.ceil((state.endAt - clock()) / 1000));
  if (state.left === 0) nextPhase();
  render();
}

function start() {
  if (state.status === 'idle') { state.cycle = 0; begin('focus', state.minutes); }
  else state.endAt = clock() + state.left * 1000;
  state.status = 'running';
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 250);
  render();
}
function pause() { state.status = 'paused'; clearInterval(tickTimer); render(); }
function reset() {
  clearInterval(tickTimer);
  Object.assign(state, { status: 'idle', phase: 'focus', cycle: 0, total: state.minutes * 60, left: state.minutes * 60 });
  render();
}

$('play').addEventListener('click', () => (state.status === 'running' ? pause() : start()));
$('reset').addEventListener('click', reset);
document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
  state.minutes = Number(b.dataset.min);
  state.total = state.left = state.minutes * 60;
  render();
}));

applyTheme();
updateMotion();
render();
placeRings();
updateRunning();
