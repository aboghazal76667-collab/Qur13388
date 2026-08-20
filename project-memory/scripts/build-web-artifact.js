/**
 * Fold the Expo web export into a single self-contained HTML page.
 *
 *   npx expo export --platform web --output-dir <dir>
 *   node scripts/build-web-artifact.js <dir> <out.html>
 *
 * Produces a page with no external requests at all: the JS bundle is inlined
 * and every asset the bundle actually reaches for becomes a data: URI. That is
 * what lets the build run from a strict-CSP host, or straight off disk — which
 * in turn is what lets the founder open the product on a phone with nothing
 * installed and no computer switched on.
 *
 * Only referenced assets are embedded. @expo/vector-icons ships URLs for every
 * icon family in the bundle text, but a family's font is only ever fetched if a
 * component from it renders — inlining all of them would add megabytes that
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

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// 1. Locate and read the bundle.
const scriptMatch = /<script src="([^"]+)"[^>]*><\/script>/.exec(html);
if (!scriptMatch) throw new Error('no <script src> found in index.html');
const bundlePath = path.join(distDir, scriptMatch[1].replace(/^\//, ''));
let bundle = fs.readFileSync(bundlePath, 'utf8');

// 2. Replace referenced asset URLs with data URIs.
const assetUrls = Array.from(new Set(bundle.match(/\/assets\/[^"'`\s)]+/g) ?? []));
let embedded = 0;
let skipped = 0;

for (const url of assetUrls) {
  const file = path.join(distDir, url.replace(/^\//, ''));
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
// The only styling authored here is the ground the app paints over. The app
// carries its own design system (src/theme/tokens.ts) and repaints every
// surface once React mounts.
//
// Theme note: the app resolves light/dark through React Native's
// `useColorScheme`, which on web reads `prefers-color-scheme` and nothing else.
// So this background keys off the same signal rather than a host `data-theme`
// stamp — keying it off the stamp would let the pre-hydration ground disagree
// with the app that paints over it. Both values are the `background` token from
// src/theme/tokens.ts.
const LIGHT_GROUND = '#FAF6F1';
const DARK_GROUND = '#17120F';

const page = `<title>Project Memory</title>
<style>
  :root { color-scheme: light dark; --ground: ${LIGHT_GROUND}; }
  @media (prefers-color-scheme: dark) { :root { --ground: ${DARK_GROUND}; } }

  html, body { height: 100%; margin: 0; }
  body { overflow: hidden; background: var(--ground); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>
  <p style="font-family: system-ui, sans-serif; text-align: center; padding: 24px;">
    Project Memory needs JavaScript enabled in your browser.
    <br />
    يحتاج التطبيق إلى تفعيل JavaScript في المتصفح.
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
