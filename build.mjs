// Сборка главной страницы: src/home.html + i18n/<язык>.json → <язык>/index.html.
//
// Сайт публикуется из корня репозитория без шага сборки на стороне
// Cloudflare, поэтому собранные страницы и файлы в assets/ коммитятся.
// Остальные страницы (поддержка, политика, немецкая главная) пока
// написаны руками и сборкой не затрагиваются.
//
//   node build.mjs
//
// Шаблон: {{путь.к.ключу}}, {{#list путь}}…{{.поле}}…{{/list}},
// {{?путь}}…{{/?}} — блок только если ключ есть, {{json путь}},
// {{@файл}} — адрес файла из src/ с отпечатком содержимого.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, basename } from 'node:path';

const ORIGIN = 'https://capsla.app';
// Языки приложения. `site` — каталог на сайте и имя файла в i18n/,
// `name` — название языка на нём самом, для меню.
const LANGS = [
  { site: 'en', name: 'English' },
  { site: 'ru', name: 'Русский' },
  { site: 'de', name: 'Deutsch' },
  { site: 'fr', name: 'Français' },
  { site: 'it', name: 'Italiano' },
  { site: 'es', name: 'Español' },
  { site: 'pt-br', name: 'Português (Brasil)' },
  { site: 'uk', name: 'Українська' },
  { site: 'tr', name: 'Türkçe' },
  { site: 'ar', name: 'العربية', rtl: true },
  { site: 'hi', name: 'हिन्दी' },
  { site: 'id', name: 'Bahasa Indonesia' },
  { site: 'vi', name: 'Tiếng Việt' },
  { site: 'ja', name: '日本語' },
  { site: 'ko', name: '한국어' },
  { site: 'zh-hans', name: '简体中文' },
  { site: 'zh-hant', name: '繁體中文' },
].filter((l) => existsSync(`i18n/${l.site}.json`));

const PAGES = [
  ...LANGS.map((l) => ({ site: l.site, out: `${l.site}/index.html`, canonical: `${ORIGIN}/${l.site}/`, home: `/${l.site}/` })),
  { site: 'en', out: 'index.html', canonical: `${ORIGIN}/`, home: '/' },
];

// ——— Файлы с отпечатком ———

rmSync('assets', { recursive: true, force: true });
mkdirSync('assets', { recursive: true });
const assets = {};

function emit(name, content) {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 10);
  const file = `${basename(name, extname(name))}.${hash}${extname(name)}`;
  writeFileSync(`assets/${file}`, content);
  assets[name] = `/assets/${file}`;
}

const withAssets = (text) => text.replace(/\{\{@([\w.-]+)\}\}/g, (_, name) => {
  if (!assets[name]) throw new Error(`Нет файла ${name}`);
  return assets[name];
});

emit('digits.woff2', readFileSync('src/digits.woff2'));
// Официальные значки App Store (toolbox.marketingtools.apple.com): белый для тёмной темы, чёрный для светлой.
for (const f of readdirSync('src').filter((n) => n.startsWith('badge-'))) emit(f, readFileSync(`src/${f}`));
emit('home.css', withAssets(readFileSync('src/home.css', 'utf8')));
// Движок колец вклеивается в скрипт страницы: один запрос вместо двух.
const orbital = readFileSync('src/orbital.js', 'utf8').replace(/^export /gm, '');
const home = readFileSync('src/home.js', 'utf8').replace(/^import .*orbital\.js';\n/m, orbital + '\n');
emit('home.js', home);

// ——— Шаблон ———

const template = readFileSync('src/home.html', 'utf8');

function lookup(data, path) {
  return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), data);
}

function need(data, path) {
  const v = lookup(data, path);
  if (v === undefined) throw new Error(`Нет ключа ${path} (${data.lang})`);
  return v;
}

function render(data) {
  let html = template;
  html = html.replace(/\{\{\?([\w.]+)\}\}([\s\S]*?)\{\{\/\?\}\}/g, (_, path, block) => (lookup(data, path) === undefined ? '' : block));
  html = html.replace(/\{\{#list ([\w.]+)\}\}([\s\S]*?)\{\{\/list\}\}/g, (_, path, block) =>
    need(data, path).map((item) => block.replace(/\{\{\.(\w+)\}\}/g, (__, f) => {
      if (item[f] === undefined) throw new Error(`Нет поля ${f} в ${path} (${data.lang})`);
      return item[f];
    })).join('')
  );
  html = html.replace(/\{\{json ([\w.]+)\}\}/g, (_, path) => JSON.stringify(need(data, path)).replace(/</g, '\\u003c'));
  html = withAssets(html);
  html = html.replace(/\{\{([\w.]+)\}\}/g, (_, path) => need(data, path));
  const left = html.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`Не подставлено: ${left[0]} (${data.lang})`);
  return html;
}

for (const page of PAGES) {
  const lang = LANGS.find((l) => l.site === page.site);
  const strings = JSON.parse(readFileSync(`i18n/${page.site}.json`, 'utf8'));
  const data = {
    ...strings,
    dir: lang.rtl ? 'rtl' : 'ltr',
    canonical: page.canonical,
    home: page.home,
    currentName: lang.name,
    badgeWhite: assets[`badge-white-${page.site}.svg`],
    badgeBlack: assets[`badge-black-${page.site}.svg`],
    langs: LANGS.map((l) => ({
      code: JSON.parse(readFileSync(`i18n/${l.site}.json`, 'utf8')).lang,
      name: l.name,
      href: `/${l.site}/`,
      abs: `${ORIGIN}/${l.site}/`,
      current: l.site === page.site ? ' aria-current="page"' : '',
    })),
  };
  mkdirSync(dirname(page.out), { recursive: true });
  const html = render(data);
  writeFileSync(page.out, html);
  console.log(`${page.out.padEnd(20)} ${(Buffer.byteLength(html) / 1024).toFixed(1)} КБ`);
}

// Карта сайта: главные на всех языках и рукописные страницы, какие есть.
const urls = [`${ORIGIN}/`, ...LANGS.map((l) => `${ORIGIN}/${l.site}/`)];
for (const l of LANGS) for (const sub of ['privacy', 'support']) {
  if (existsSync(`${l.site}/${sub}/index.html`)) urls.push(`${ORIGIN}/${l.site}/${sub}/`);
}
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`sitemap.xml          ${urls.length} адресов`);

for (const [name, url] of Object.entries(assets)) {
  console.log(`${name.padEnd(16)} ${(readFileSync('.' + url).length / 1024).toFixed(1)} КБ  ${url}`);
}
