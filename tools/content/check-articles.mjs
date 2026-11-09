// Check field-note articles without a browser toolchain:
//   node --experimental-strip-types tools/content/check-articles.mjs [id...]
// For each article: both languages exist, they share one block skeleton, labs/chapters exist, and the
// piece is long enough. The same checks run in tests/articles.test.ts.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const { parseArticle, skeleton, articleText } = await import(path.join(root, 'src/lib/article.ts'));
const { readingUnits } = await import(path.join(root, 'src/lib/text.ts'));

const dir = path.join(root, 'src/content/articles');
const registry = fs.readFileSync(path.join(root, 'src/components/labs/registry.ts'), 'utf8');
const labs = new Set([...registry.matchAll(/^\s+(\w+): defineAsyncComponent/gm)].map((m) => m[1]));
const book = fs.readFileSync(path.join(root, 'src/content/book.ts'), 'utf8');
const slugs = new Set([...book.matchAll(/\bc\(\d+, '([^']+)'/g)].map((m) => m[1]));
const extras = fs.readFileSync(path.join(root, 'src/content/extras/virtualization.ts'), 'utf8');
const noteIds = new Set([...extras.matchAll(/kind: '(?:note|thread)',\s*\n\s*id: '([^']+)'/g)].map((m) => m[1]));

const want = process.argv.slice(2);
const ids = [...new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.(en|zh)\.md$/, '')))].filter((id) => !want.length || want.includes(id));
let bad = 0;
const walk = (bs) => bs.flatMap((b) => (b.t === 'fold' || b.t === 'aside' ? [b, ...walk(b.blocks)] : [b]));
for (const id of ids) {
  const problems = [];
  const files = { en: path.join(dir, `${id}.en.md`), zh: path.join(dir, `${id}.zh.md`) };
  if (!noteIds.has(id)) problems.push(`no note with id "${id}" in extras`);
  const parsed = {};
  for (const [lang, f] of Object.entries(files)) {
    if (!fs.existsSync(f)) { problems.push(`missing ${path.basename(f)}`); continue; }
    try { parsed[lang] = parseArticle(fs.readFileSync(f, 'utf8')); } catch (e) { problems.push(`${lang}: parse error ${e.message}`); }
  }
  if (parsed.en && parsed.zh) {
    const a = skeleton(parsed.en.blocks), b = skeleton(parsed.zh.blocks);
    if (a !== b) {
      const x = a.split(' '), y = b.split(' ');
      const i = x.findIndex((t, k) => t !== y[k]);
      problems.push(`skeletons differ at block ${i}: en "${x.slice(i, i + 3).join(' ')}" vs zh "${y.slice(i, i + 3).join(' ')}"`);
    }
    for (const lang of ['en', 'zh']) {
      if (!parsed[lang].deck) problems.push(`${lang}: no deck`);
      for (const blk of walk(parsed[lang].blocks)) {
        if (blk.t === 'lab' && !labs.has(blk.name)) problems.push(`${lang}: unknown lab ${blk.name}`);
        if (blk.t === 'chapter' && !slugs.has(blk.slug)) problems.push(`${lang}: unknown chapter ${blk.slug}`);
        if (blk.t === 'table') for (const row of blk.rows) if (row.length !== blk.head.length) problems.push(`${lang}: table row with ${row.length} cells under ${blk.head.length} columns: ${row[0].map((r) => r.t).join('')}`);
      }
      for (const m of fs.readFileSync(files[lang], 'utf8').matchAll(/\]\((\/[^)]+)\)/g)) {
        const [, kind, slug = ''] = m[1].split('/');
        const s = slug.split('#')[0];
        if (kind === 'notes' ? !noteIds.has(s) : !slugs.has(s)) problems.push(`${lang}: broken internal link ${m[1]}`);
      }
    }
    const en = readingUnits(articleText(parsed.en.blocks)), zh = readingUnits(articleText(parsed.zh.blocks));
    if (en.words < 1200) problems.push(`en too short: ${en.words} words`);
    if (zh.cjk < 2000) problems.push(`zh too short: ${zh.cjk} CJK chars`);
    console.log(`${problems.length ? '✗' : '✓'} ${id}  en ${en.words} words · zh ${zh.cjk} 字 · ${a.split(' ').length} blocks`);
  } else console.log(`✗ ${id}`);
  for (const p of problems) console.log('    ' + p);
  bad += problems.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
