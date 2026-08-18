/**
 * Build script: merges the raw Quran text corpus with the Quranic Arabic Corpus
 * morphology dump into the compact bundles the app ships with.
 *
 *   node scripts/build-data.js
 *
 * Inputs  : data-raw/quran.json, data-raw/quran-morphology.txt
 * Outputs : src/data/generated/{surahs,verses,morphology}.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src/data/generated');

const quran = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-raw/quran.json'), 'utf8'));
const morphLines = fs.readFileSync(path.join(ROOT, 'data-raw/quran-morphology.txt'), 'utf8').split('\n');

// ---------------------------------------------------------------------------
// 1. Surah index + flat verse list
// ---------------------------------------------------------------------------
const surahs = [];
const verses = [];
let cursor = 0;
for (const s of quran) {
  surahs.push({
    n: s.id,
    ar: s.name,
    en: s.transliteration,
    tr: s.transliteration,
    type: s.type === 'meccan' ? 'makki' : 'madani',
    count: s.total_verses,
    start: cursor,
  });
  for (const v of s.verses) {
    verses.push(v.text.trim().replace(/\s+/g, ' '));
    cursor++;
  }
}

// ---------------------------------------------------------------------------
// 2. Morphology: collapse segment rows into one entry per word position
// ---------------------------------------------------------------------------
/** location key `s:a:w` -> { root, lemma, pos, feats } */
const words = new Map();
for (const line of morphLines) {
  if (!line.trim()) continue;
  const [loc, , tag, featStr] = line.split('\t');
  if (!loc || !featStr) continue;
  const parts = loc.split(':');
  const key = `${parts[0]}:${parts[1]}:${parts[2]}`;
  const feats = featStr.split('|');
  const isPrefix = feats.includes('PREF');
  const isSuffix = feats.includes('SUFF');
  const root = (feats.find((f) => f.startsWith('ROOT:')) || '').slice(5);
  const lemma = (feats.find((f) => f.startsWith('LEM:')) || '').slice(4);

  let entry = words.get(key);
  if (!entry) {
    entry = { root: '', lemma: '', pos: '', feats: [] };
    words.set(key, entry);
  }
  // The stem segment carries the meaning; prefixes/suffixes are grammatical.
  if (!isPrefix && !isSuffix) {
    if (root && !entry.root) entry.root = root;
    if (lemma && !entry.lemma) entry.lemma = lemma;
    if (!entry.pos) entry.pos = tag;
    for (const f of feats) {
      if (f.startsWith('ROOT:') || f.startsWith('LEM:')) continue;
      if (!entry.feats.includes(f)) entry.feats.push(f);
    }
  } else if (root && !entry.root) {
    entry.root = root;
    if (lemma && !entry.lemma) entry.lemma = lemma;
  }
}

// ---------------------------------------------------------------------------
// 3. Pack into string tables + per-verse token arrays
// ---------------------------------------------------------------------------
const roots = [];
const rootIdx = new Map();
const lemmas = [];
const lemmaIdx = new Map();
const posList = [];
const posIdx = new Map();
const featList = [];
const featIdx = new Map();

const intern = (value, arr, map) => {
  if (!value) return -1;
  let i = map.get(value);
  if (i === undefined) {
    i = arr.length;
    arr.push(value);
    map.set(value, i);
  }
  return i;
};

const verseTokens = [];
let unaligned = 0;
let gi = 0;
for (const s of quran) {
  for (const v of s.verses) {
    const surfaceCount = verses[gi].split(' ').length;
    let maxW = 0;
    while (words.has(`${s.id}:${v.id}:${maxW + 1}`)) maxW++;
    if (maxW !== surfaceCount) {
      // Word boundaries disagree between the two corpora for this verse.
      // Ship no morphology rather than mis-attributed roots.
      verseTokens.push(0);
      unaligned++;
      gi++;
      continue;
    }
    const tokens = [];
    for (let w = 1; w <= maxW; w++) {
      const e = words.get(`${s.id}:${v.id}:${w}`);
      tokens.push([
        intern(e.root, roots, rootIdx),
        intern(e.lemma, lemmas, lemmaIdx),
        intern(e.pos, posList, posIdx),
        e.feats.map((f) => intern(f, featList, featIdx)),
      ]);
    }
    verseTokens.push(tokens);
    gi++;
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'surahs.json'), JSON.stringify(surahs));
fs.writeFileSync(path.join(OUT, 'verses.json'), JSON.stringify(verses));
fs.writeFileSync(
  path.join(OUT, 'morphology.json'),
  JSON.stringify({ roots, lemmas, pos: posList, feats: featList, verses: verseTokens })
);

const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log(`surahs      ${surahs.length}  (${size('surahs.json')})`);
console.log(`verses      ${verses.length}  (${size('verses.json')})`);
console.log(`roots       ${roots.length}`);
console.log(`lemmas      ${lemmas.length}`);
console.log(`morphology  ${size('morphology.json')}  (${unaligned} verses without morphology)`);
