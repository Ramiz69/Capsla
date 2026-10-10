import { Orbital, PALETTES } from './orbital.js';

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
