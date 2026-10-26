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
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, extname, basename } from 'node:path';

const ORIGIN = 'https://capsla.app';
// Языки приложения. `site` — каталог на сайте и имя файла в i18n/,
// `name` — название языка на нём самом, для меню, `og` — локаль для og:locale.
const LANGS = [
  { site: 'en', name: 'English', og: 'en_US' },
  { site: 'ru', name: 'Русский', og: 'ru_RU' },
  { site: 'de', name: 'Deutsch', og: 'de_DE' },
  { site: 'fr', name: 'Français', og: 'fr_FR' },
  { site: 'it', name: 'Italiano', og: 'it_IT' },
  { site: 'es', name: 'Español', og: 'es_ES' },
  { site: 'pt-br', name: 'Português (Brasil)', og: 'pt_BR' },
  { site: 'uk', name: 'Українська', og: 'uk_UA' },
  { site: 'tr', name: 'Türkçe', og: 'tr_TR' },
  { site: 'ar', name: 'العربية', rtl: true, og: 'ar_AR' },
  { site: 'hi', name: 'हिन्दी', og: 'hi_IN' },
  { site: 'id', name: 'Bahasa Indonesia', og: 'id_ID' },
  { site: 'vi', name: 'Tiếng Việt', og: 'vi_VN' },
  { site: 'ja', name: '日本語', og: 'ja_JP' },
  { site: 'ko', name: '한국어', og: 'ko_KR' },
  { site: 'zh-hans', name: '简体中文', og: 'zh_CN' },
  { site: 'zh-hant', name: '繁體中文', og: 'zh_TW' },
].filter((l) => existsSync(`i18n/${l.site}.json`));

// Английская главная доступна и по /, и по /en/ (адреса языков указаны
// в App Store Connect, поэтому без переадресации), каноническая — корень.
const homeUrl = (site) => (site === 'en' ? `${ORIGIN}/` : `${ORIGIN}/${site}/`);

const PAGES = [
  ...LANGS.map((l) => ({ site: l.site, out: `${l.site}/index.html`, canonical: homeUrl(l.site), home: `/${l.site}/` })),
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

const templates = { home: readFileSync('src/home.html', 'utf8'), press: readFileSync('src/press.html', 'utf8') };

// Разметка schema.org одна на главных и политике: сайт, издатель, приложение.
function jsonld(lang, url) {
  const org = `${ORIGIN}/#organization`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Capsla', url: `${ORIGIN}/`, publisher: { '@id': org } },
      { '@type': 'Organization', '@id': org, name: 'Capsla', url: `${ORIGIN}/`, logo: `${ORIGIN}/press/capsla-icon-1024.png`, email: 'support@capsla.app', sameAs: ['https://apps.apple.com/app/id6760552635'] },
      { '@type': 'MobileApplication', name: 'Capsla', operatingSystem: 'iOS 26, watchOS 26', applicationCategory: 'ProductivityApplication', url, downloadUrl: 'https://apps.apple.com/app/id6760552635', inLanguage: lang, publisher: { '@id': org }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    ],
  }).replace(/</g, '\\u003c');
}

function lookup(data, path) {
  return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), data);
}

function need(data, path) {
  const v = lookup(data, path);
  if (v === undefined) throw new Error(`Нет ключа ${path} (${data.lang})`);
  return v;
}

function render(data, kind = 'home') {
  let html = templates[kind];
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
    ogLocale: lang.og,
    ogAlternates: LANGS.filter((l) => l.site !== page.site).map((l) => ({ locale: l.og })),
    jsonld: jsonld(strings.lang, page.canonical),
    badgeWhite: assets[`badge-white-${page.site}.svg`],
    badgeBlack: assets[`badge-black-${page.site}.svg`],
    langs: LANGS.map((l) => ({
      code: JSON.parse(readFileSync(`i18n/${l.site}.json`, 'utf8')).lang,
      name: l.name,
      href: l.site === 'en' ? '/' : `/${l.site}/`,
      abs: homeUrl(l.site),
      current: l.site === page.site ? ' aria-current="page"' : '',
    })),
  };
  mkdirSync(dirname(page.out), { recursive: true });
  const html = render(data);
  writeFileSync(page.out, html);
  console.log(`${page.out.padEnd(20)} ${(Buffer.byteLength(html) / 1024).toFixed(1)} КБ`);
}

// Страница для прессы — только на языках, где есть ключ `press`.
const PRESS = [
  { site: 'en', out: 'press/index.html', canonical: `${ORIGIN}/press/`, home: '/' },
  { site: 'ru', out: 'ru/press/index.html', canonical: `${ORIGIN}/ru/press/`, home: '/ru/' },
];
for (const page of PRESS) {
  const strings = JSON.parse(readFileSync(`i18n/${page.site}.json`, 'utf8'));
  if (!strings.press) continue;
  mkdirSync(dirname(page.out), { recursive: true });
  const ogLocale = LANGS.find((l) => l.site === page.site).og;
  const html = render({ ...strings, dir: 'ltr', canonical: page.canonical, home: page.home, ogLocale }, 'press');
  writeFileSync(page.out, html);
  console.log(`${page.out.padEnd(20)} ${(Buffer.byteLength(html) / 1024).toFixed(1)} КБ`);
}

// Карта сайта: главные на всех языках и рукописные страницы, какие есть.
// /en/ в карте нет: его каноническая — корень.
// lastmod — дата последнего коммита файла страницы, а если файл сейчас
// отличается от закоммиченного, то сегодняшняя: изменение уйдёт этим коммитом.
function lastmod(file) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const changed = git('status', '--porcelain', '--', file) !== '';
  const date = changed ? '' : git('log', '-1', '--format=%cs', '--', file);
  if (date) return date;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const entries = [
  [`${ORIGIN}/`, 'index.html'],
  ...LANGS.filter((l) => l.site !== 'en').map((l) => [`${ORIGIN}/${l.site}/`, `${l.site}/index.html`]),
  ...PRESS.filter((p) => existsSync(p.out)).map((p) => [p.canonical, p.out]),
];
for (const l of LANGS) for (const sub of ['privacy', 'support']) {
  const file = `${l.site}/${sub}/index.html`;
  if (existsSync(file)) entries.push([`${ORIGIN}/${l.site}/${sub}/`, file]);
}
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(([u, f]) => `<url><loc>${u}</loc><lastmod>${lastmod(f)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log(`sitemap.xml          ${entries.length} адресов`);

for (const [name, url] of Object.entries(assets)) {
  console.log(`${name.padEnd(16)} ${(readFileSync('.' + url).length / 1024).toFixed(1)} КБ  ${url}`);
}
