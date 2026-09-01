/**
 * Fold the Expo web export into a single self-contained HTML page.
 *
 *   npx expo export --platform web --output-dir <dir>
 *   node scripts/build-web-artifact.js <dir> <out.html>
 *
 * Produces a page with no external requests at all: the JS bundle is inlined
 * and every asset the bundle actually reaches for becomes a data: URI. That is
 * what lets the build run from a strict-CSP host, or straight off disk.
 *
 * Only referenced assets are embedded. @expo/vector-icons ships URLs for every
 * icon family in the bundle text, but a family's font is only ever fetched if
 * a component from it renders — inlining all of them would add megabytes that
 * nothing requests.
 */
const fs = require('fs');
const path = require('path');

const [, , distDir, outFile] = process.argv;
if (!distDir || !outFile) {
  console.error('usage: node scripts/build-web-artifact.js <dist-dir> <out.html>');
  process.exit(1);
}

/** Icon families the app renders. Anything else is dead weight. */
const USED_FONT_FAMILIES = ['Ionicons'];

const MIME = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const dataUri = (file) => {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
};

/**
 * A build may set `expo.experiments.baseUrl` so the app can be served from a
 * sub-path (a GitHub Pages project site lives at /<repo>/). Every URL the
 * export emits is then prefixed with it, while the files on disk are still
 * laid out from the output directory's root — so the prefix has to come off
 * before anything resolves. Reading it from app.json keeps one source of truth.
 */
const baseUrl = (
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'))
    .expo.experiments?.baseUrl ?? ''
).replace(/\/$/, '');

const stripBase = (url) =>
  baseUrl && url.startsWith(baseUrl + '/') ? url.slice(baseUrl.length) : url;

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// 1. Locate and read the bundle.
const scriptMatch = /<script src="([^"]+)"[^>]*><\/script>/.exec(html);
if (!scriptMatch) throw new Error('no <script src> found in index.html');
const bundlePath = path.join(distDir, stripBase(scriptMatch[1]).replace(/^\//, ''));
let bundle = fs.readFileSync(bundlePath, 'utf8');

// 2. Replace referenced asset URLs with data URIs.
//    The prefix must be part of the matched URL: replacing only the /assets/…
//    tail would leave the base path stranded in front of the data: URI.
const assetPattern = baseUrl
  ? new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/assets/[^"'\`\\s)]+`, 'g')
  : /\/assets\/[^"'`\s)]+/g;
const assetUrls = Array.from(new Set(bundle.match(assetPattern) ?? []));
let embedded = 0;
let skipped = 0;

for (const url of assetUrls) {
  const file = path.join(distDir, stripBase(url).replace(/^\//, ''));
  if (!fs.existsSync(file)) continue;

  const isFont = /\.(ttf|otf|woff2?)$/i.test(file);
  if (isFont && !USED_FONT_FAMILIES.some((f) => path.basename(file).startsWith(f))) {
    skipped++;
    continue;
  }

  bundle = bundle.split(url).join(dataUri(file));
  embedded++;
}

// 3. Emit page content only — the host wraps it in its own document skeleton.
//
// The only styling authored here is the frame the app paints over: the app
// carries its own design system (src/theme/tokens.ts) and repaints every
// surface once React mounts.
//
// Theme note: this app commits to a single light palette (app.json sets
// `userInterfaceStyle: "light"`, and src/theme/tokens.ts defines no dark
// variant), so the pre-hydration ground is pinned rather than keyed off
// `prefers-color-scheme`. Reacting to the system theme here would paint a dark
// ground that the app then repaints sand a frame later.
const GROUND = '#F6F1E9'; // theme.color.bg — src/theme/tokens.ts

const appName = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'),
).expo.name;

const page = `<title>${appName}</title>
<style>
  :root { color-scheme: light; --ground: ${GROUND}; }

  html, body { height: 100%; margin: 0; }
  body { overflow: hidden; background: var(--ground); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>
  <p style="font-family: system-ui, sans-serif; direction: rtl; text-align: center; padding: 24px;">
    هذا التطبيق يحتاج إلى تفعيل JavaScript في المتصفح.
  </p>
</noscript>
<div id="root"></div>
<script>
${bundle}
</script>
`;

fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, page);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`bundle    ${mb(fs.statSync(bundlePath).size)}`);
console.log(`assets    ${embedded} embedded, ${skipped} unused fonts skipped`);
console.log(`output    ${outFile}  ${mb(fs.statSync(outFile).size)}`);
