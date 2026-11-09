// Some Chinese PDFs ship subset fonts with a broken ToUnicode table (e.g. chapter 5 maps 们/不/谁 → 我).
// We repair them by glyph outline: the same SimSun/FZ glyph has an identical outline in every chapter,
// so we learn outline → character from all chapters and vote.
// Usage: node glyphdict.mjs <out.json> <pdf>...
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { brokenFonts, pageGlyphs } from './glyphs.mjs';

const [out, ...files] = process.argv.slice(2);
const votes = {}; // family -> hash -> {char: count}
for (const file of files) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0, disableFontFace: true, fontExtraProperties: true, isOffscreenCanvasSupported: false }).promise;
  // learn only from intact fonts: a broken one would teach us that the outline of 金 is 变
  const broken = await brokenFonts(doc);
  for (let p = 1; p <= doc.numPages; p++) {
    for (const g of await pageGlyphs(await doc.getPage(p))) {
      if (!g.h || broken.has(g.font)) continue;
      ((votes[g.fam] ??= {})[g.h] ??= {})[g.u] = (votes[g.fam][g.h][g.u] ?? 0) + 1;
    }
  }
}
// keep the majority vote for each outline
const dict = {};
for (const [fam, hs] of Object.entries(votes)) {
  dict[fam] = {};
  for (const [h, c] of Object.entries(hs)) dict[fam][h] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}
// outlines seen only in broken fonts, identified by hand from context
const overrides = JSON.parse(fs.readFileSync(new URL('./glyph-overrides.json', import.meta.url), 'utf8'));
for (const [fam, m] of Object.entries(overrides)) if (fam !== '//') Object.assign((dict[fam] ??= {}), m);
fs.writeFileSync(out, JSON.stringify(dict));
console.log('glyph dictionary:', Object.entries(dict).map(([f, d]) => `${f}:${Object.keys(d).length}`).join(' '));
