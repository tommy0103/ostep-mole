// Download the source PDFs (English v1.10 + official Chinese translation) into .cache/pdf
// Usage: node tools/content/fetch.mjs [part]
import fs from 'node:fs';
import path from 'node:path';
import { PARTS, EN_URL, ZH_URL, CACHE } from './parts.mjs';

const part = process.argv[2] ?? 'virtualization';
fs.mkdirSync(path.join(CACHE, 'en'), { recursive: true });
fs.mkdirSync(path.join(CACHE, 'zh'), { recursive: true });
const jobs = PARTS[part].flatMap(({ num, slug }) => {
  const nn = String(num).padStart(2, '0');
  return [[EN_URL(slug), path.join(CACHE, 'en', `${nn}.pdf`)], [ZH_URL(num), path.join(CACHE, 'zh', `${nn}.pdf`)]];
});
for (const [url, file] of jobs) {
  if (fs.existsSync(file)) continue;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn('HTTP', res.status, url); break; }
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log('fetched', path.relative(process.cwd(), file));
      break;
    } catch (e) { console.warn('retry', url, e.message); }
  }
}
