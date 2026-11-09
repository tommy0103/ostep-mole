// Extract every chapter of a part into src/content/generated/{en,zh}/NN.json and figures into public/figs.
// Each PDF is processed in its own child process: pdf.js + native canvas occasionally crash on odd images.
// Usage: node tools/content/build.mjs [part] [chapter...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PARTS, CACHE } from './parts.mjs';

const root = new URL('../../', import.meta.url).pathname;
const part = process.argv[2] ?? 'virtualization';
const only = process.argv.slice(3).map(Number); // optional chapter numbers
const here = path.dirname(new URL(import.meta.url).pathname);
const tmp = path.join(root, '.cache', 'build');

// glyph dictionary for repairing broken Chinese font encodings
const glyphs = path.join(root, '.cache', 'glyphs-zh.json');
const glyphSources = ['glyphdict.mjs', 'glyphs.mjs', 'glyph-overrides.json'].map((f) => path.join(here, f));
const stale = !fs.existsSync(glyphs) || glyphSources.some((f) => fs.statSync(f).mtimeMs > fs.statSync(glyphs).mtimeMs);
if (stale) {
  const pdfs = PARTS[part].map(({ num }) => path.join(CACHE, 'zh', `${String(num).padStart(2, '0')}.pdf`)).filter((f) => fs.existsSync(f));
  execFileSync('node', [path.join(here, 'glyphdict.mjs'), glyphs, ...pdfs], { stdio: 'inherit' });
}
process.env.GLYPHS = glyphs;

for (const lang of ['en', 'zh']) {
  const outDir = path.join(tmp, lang);
  fs.mkdirSync(outDir, { recursive: true });
  const genDir = path.join(root, 'src/content/generated', lang);
  const figDir = path.join(root, 'public/figs', lang);
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(figDir, { recursive: true });
  for (const { num } of PARTS[part]) {
    if (only.length && !only.includes(num)) continue;
    const nn = String(num).padStart(2, '0');
    const pdf = path.join(CACHE, lang, `${nn}.pdf`);
    if (!fs.existsSync(pdf)) { console.warn('missing', pdf, '(run npm run content:fetch)'); continue; }
    try {
      execFileSync('node', [path.join(here, 'extract.mjs'), lang, pdf, String(num), outDir], { stdio: ['ignore', 'inherit', 'ignore'] });
      const data = JSON.parse(fs.readFileSync(path.join(outDir, `${nn}.json`), 'utf8'));
      if (data.cropJobs.length) {
        const jobsFile = path.join(outDir, `jobs-${nn}.json`);
        fs.writeFileSync(jobsFile, JSON.stringify(data.cropJobs));
        try { execFileSync('node', [path.join(here, 'crop.mjs'), pdf, jobsFile], { stdio: 'ignore' }); } catch { console.warn('crop failed', lang, nn); }
      }
      delete data.cropJobs;
      const strip = (bs) => bs.forEach((b) => { delete b.page; delete b.fallback; if (b.blocks) strip(b.blocks); });
      strip(data.blocks);
      // keep only figures whose image exists
      const figsOut = path.join(outDir, 'figs');
      const fix = (bs) => bs.forEach((b) => {
        if (b.t === 'fig' && b.img) {
          const src = path.join(figsOut, b.img);
          if (fs.existsSync(src)) fs.copyFileSync(src, path.join(figDir, b.img)); else delete b.img;
        }
        if (b.blocks) fix(b.blocks);
      });
      fix(data.blocks);
      // drop this chapter's figures from earlier builds that nothing refers to any more
      const used = new Set(JSON.stringify(data.blocks).match(/"img":"[^"]+"/g)?.map((m) => m.slice(7, -1)) ?? []);
      for (const f of fs.readdirSync(figDir)) if (f.startsWith(`${nn}-`) && !used.has(f)) fs.rmSync(path.join(figDir, f));
      fs.writeFileSync(path.join(genDir, `${nn}.json`), JSON.stringify(data));
    } catch (e) {
      console.error('FAILED', lang, nn, e.message);
    }
  }
}
