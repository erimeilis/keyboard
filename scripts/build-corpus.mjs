// Shapes the fetched Siddur data into the compact corpus the app bundles.
//
//   node scripts/build-corpus.mjs
//
// Stage two of the pipeline: ingest-siddur.mjs fetches (slow, network), this shapes
// (fast, offline), so the layout can be reworked without re-fetching 456 refs.
//
// The saving that matters: Sefaria's English is per SEGMENT, and one segment yields
// several practice lines, so storing the translation on each line duplicates it many
// times over. Segment translations are pooled and referenced by index instead.

import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('../src/trainer/data/siddur.raw.json', import.meta.url);
const out = new URL('../src/trainer/data/siddur.corpus.json', import.meta.url);

const raw = JSON.parse(readFileSync(src, 'utf8'));

const glossPool = [];
const glossIndex = new Map();
function poolGloss(en) {
  if (!en) return -1;
  if (!glossIndex.has(en)) {
    glossIndex.set(en, glossPool.length);
    glossPool.push(en);
  }
  return glossIndex.get(en);
}

const themes = [...new Set(raw.lines.map(l => l.theme))];
const sources = [...new Set(raw.lines.map(l => l.source))];
const themeIdx = new Map(themes.map((t, i) => [t, i]));
const sourceIdx = new Map(sources.map((s, i) => [s, i]));

const lines = raw.lines.map(l => [
  l.text,
  poolGloss(l.en),
  themeIdx.get(l.theme),
  sourceIdx.get(l.source),
]);

const corpus = {
  // Credit is required by the CC-BY terms of both source versions.
  credit: {
    hebrew: 'The Metsudah siddur, 1981',
    english: 'Translation based on the Metsudah linear siddur, by Avrohom Davis, 1981',
    license: 'CC-BY',
    via: 'Sefaria — https://www.sefaria.org/Siddur_Ashkenaz',
  },
  themes,
  sources,
  glosses: glossPool,
  // [text, glossIndex (-1 = none), themeIndex, sourceIndex]
  lines,
  // [term, occurrences], descending
  terms: raw.terms.map(t => [t.term, t.count]),
};

writeFileSync(out, JSON.stringify(corpus), 'utf8');

const bytes = JSON.stringify(corpus).length;
const before = readFileSync(src, 'utf8').length;
process.stdout.write(
  `lines: ${lines.length}\n` +
  `unique segment translations pooled: ${glossPool.length}\n` +
  `lines with a translation: ${lines.filter(l => l[1] >= 0).length}\n` +
  `terms: ${corpus.terms.length}\n` +
  `size: ${(before / 1e6).toFixed(2)}MB raw -> ${(bytes / 1e6).toFixed(2)}MB bundled\n`,
);
