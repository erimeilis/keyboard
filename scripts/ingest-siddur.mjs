// Ingests Siddur Ashkenaz from Sefaria into a static corpus for the typing trainer.
//
//   node scripts/ingest-siddur.mjs            # full run -> src/trainer/data/siddur.he.ts
//   node scripts/ingest-siddur.mjs --limit 25 # quick probe
//
// Run manually when the corpus needs refreshing; the app never hits the network.
// Both source versions are CC-BY (Metsudah siddur 1981 / Metsudah linear translation
// by Avrohom Davis 1981), which the emitted file credits.

import { writeFileSync } from 'node:fs';

const API = 'https://www.sefaria.org/api';
const INDEX = 'Siddur Ashkenaz';

// The 27 letters the trainer can type, plus the geresh used for the divine name.
const LETTERS = new Set('שדגכעיחלךףקראטוןםפזסבהנמצתץ׳');

// Hebrew points and cantillation: U+0591-U+05C7 minus the letters themselves.
const isPoint = ch => ch >= '֑' && ch <= 'ׇ';

// Term joiners. The source mixes the Hebrew maqaf with a plain ASCII hyphen
// (בְּכָל-מוֹשְׁבוֹתֵיכֶם) and dashes; each must become a space rather than vanish, or two
// terms glue into one (בכלמושבותיכם).
// Deliberately a Set of code points rather than a regex character class: written as a
// class these characters form an accidental range (U+05BE to U+2010) that swallows the
// entire Hebrew alphabet and silently yields an empty corpus.
const JOINERS = new Set([
  '־', // ־ maqaf
  '-', // - ASCII hyphen, which the source also uses (בְּכָל-מוֹשְׁבוֹתֵיכֶם)
  '‐', '‑', '‒', '–', '—', // hyphens and dashes
]);

const SOF_PASUK = '׃';   // ׃
const GERESH = '׳'; // ׳

// The source writes geresh and gershayim as ASCII quotes (ה' for the divine name, ט"ז
// for a numeral). The apostrophe is folded onto the real geresh so it survives the
// letter filter. Gershayim has no key on this layout, so it is dropped — and any token
// that carried one is recorded as an abbreviation and kept out of the word corpus.
const GERSHAYIM = /[\u0022\u05F4]/;

const APOSTROPHES = new Set([
  String.fromCharCode(0x27),   // '  ASCII apostrophe
  String.fromCharCode(0x2019), // ’  right single quote
  GERESH,
]);

// Written substitution for the Tetragrammaton, so a learner does not drill the full
// name. Covers the plain spelling and the יְיָ contraction the siddur also uses.
const DIVINE_NAME = /יהוה|ייי|יי(?![א-ת])/g;
const DIVINE_SUB = 'ה' + GERESH;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(500 * (i + 1));
    }
  }
}

/** Every leaf node of the index schema, as a full Sefaria ref. */
function leafRefs(node, path = []) {
  const here = node.title ? [...path, node.title] : path;
  if (!node.nodes) return [here.join(', ')];
  return node.nodes.flatMap(child => leafRefs(child, here));
}

/**
 * Footnotes and commentary are welded into the English inline (`...house;1This verse
 * referred to...`), so the elements carrying them go before tags are flattened.
 */
function stripMarkup(html) {
  return String(html)
    .replace(/<sup[\s\S]*?<\/sup>/g, ' ')
    .replace(/<i\s+class="footnote"[\s\S]*?<\/i>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fraction of characters that are vowel points. Rubric instructions are unpointed. */
function pointedRatio(text) {
  const letters = [...text].filter(ch => /[֐-׿]/.test(ch));
  if (letters.length === 0) return 0;
  return letters.filter(isPoint).length / letters.length;
}

/** Pointed source text -> bare consonants the trainer can type. */
function toTypable(text) {
  const folded = [...text]
    .map(ch => {
      if (JOINERS.has(ch)) return ' ';
      if (APOSTROPHES.has(ch)) return GERESH;
      return ch;
    })
    .join('');
  const kept = [...folded]
    .filter(ch => LETTERS.has(ch) || /\s/.test(ch))
    .join('');
  return kept.replace(/\s+/g, ' ').trim();
}

function normalizeDivineName(typable) {
  return typable.replace(DIVINE_NAME, DIVINE_SUB);
}

/** Theme tag driving the trainer's background; falls back to the neutral default. */
function themeFor(ref) {
  const r = ref.toLowerCase();
  if (r.includes('kaddish') || r.includes('shema') || r.includes('amidah')) return 'wisdom';
  if (r.includes('pesukei dezimra') || r.includes('hallel') || r.includes('psalm')) return 'wisdom';
  if (r.includes('maariv') || r.includes('bedtime') || r.includes('night')) return 'space';
  if (r.includes('rain') || r.includes('dew') || r.includes('sea')) return 'sea';
  return 'default';
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  process.stdout.write(`fetching index "${INDEX}"...\n`);
  const index = await getJson(`${API}/v2/index/${encodeURIComponent(INDEX)}`);
  const refs = leafRefs(index.schema).slice(0, limit);
  process.stdout.write(`${refs.length} leaf refs\n`);

  const lines = [];      // { text, en, theme, source }
  const seen = new Set();
  const termCounts = new Map();
  let abbreviationInstances = 0;
  let rubricSkipped = 0;
  let failed = 0;

  for (const [i, ref] of refs.entries()) {
    let doc;
    try {
      doc = await getJson(
        `${API}/v3/texts/${encodeURIComponent(ref)}?version=hebrew&version=english`,
      );
    } catch {
      failed++;
      continue;
    }

    const byLang = {};
    for (const v of doc.versions ?? []) byLang[v.actualLanguage] = v;
    const he = [byLang.he?.text ?? []].flat();
    const en = [byLang.en?.text ?? []].flat();

    he.forEach((segment, segIdx) => {
      if (typeof segment !== 'string') return;
      const raw = stripMarkup(segment);
      // Segment-level English is the authority for this segment's meaning.
      const segEn = typeof en[segIdx] === 'string' ? stripMarkup(en[segIdx]) : '';

      for (const unit of raw.split(new RegExp(`[${SOF_PASUK}:]`))) {
        // Applied per unit, not per segment: rubric phrases ("the congregation
        // answers") sit unpointed inside otherwise pointed segments.
        if (pointedRatio(unit) < 0.1) { rubricSkipped++; continue; }

        // Tokenize before stripping, so each output term still knows whether its source
        // carried a gershayim. Hebrew abbreviations and letter-numerals are written with
        // one (וי״א, יו״ט, ט״ז); the trainer has no gershayim key, so stripping it glues
        // the letters into plausible-looking non-words (ויא, יוט, טז). They stay in the
        // line for fidelity but are not counted as vocabulary, since drilling them as
        // words would teach a spelling that does not exist and has nothing to translate.
        //
        // Marked per occurrence, never per form: several real words are also spelled as
        // abbreviations somewhere in the siddur, and blacklisting the form would delete
        // them from the corpus everywhere — ה׳ included.
        const tokens = [];
        for (const rawToken of unit.split(/\s+/)) {
          const isAbbreviation = GERSHAYIM.test(rawToken);
          const form = normalizeDivineName(toTypable(rawToken));
          if (!form) continue;
          // A maqaf inside the token splits it into several practice terms.
          for (const piece of form.split(' ')) tokens.push({ piece, isAbbreviation });
        }

        const text = tokens.map(t => t.piece).join(' ');
        if (tokens.length < 2 || tokens.length > 12) continue;
        if (seen.has(text)) continue;
        seen.add(text);

        for (const t of tokens) {
          if (t.isAbbreviation) { abbreviationInstances++; continue; }
          termCounts.set(t.piece, (termCounts.get(t.piece) ?? 0) + 1);
        }
        lines.push({ text, en: segEn, theme: themeFor(ref), source: ref });
      }
    });

    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  ${i + 1}/${refs.length} refs, ${lines.length} lines\n`);
    }
    await sleep(120);
  }

  const terms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term, count]) => ({ term, count }));

  writeFileSync(
    new URL('../src/trainer/data/siddur.raw.json', import.meta.url),
    JSON.stringify({ lines, terms }, null, 2),
    'utf8',
  );

  process.stdout.write(
    `\nrefs: ${refs.length} (${failed} failed)\n` +
    `rubric units filtered: ${rubricSkipped}\n` +
    `lines: ${lines.length}\n` +
    `unique terms: ${terms.length}\n` +
    `abbreviation occurrences excluded from the word corpus: ${abbreviationInstances}\n` +
    `wrote src/trainer/data/siddur.raw.json\n`,
  );
}

main().catch(err => { console.error(err); process.exit(1); });
