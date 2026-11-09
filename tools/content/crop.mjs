// Render figure crops: node crop.mjs <pdf> <jobs.json>
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas';
Object.assign(globalThis, { Path2D, ImageData, DOMMatrix });
const [file, jobsFile] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile));
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0, isOffscreenCanvasSupported: false }).promise;
const S = 3;
for (const j of jobs) {
  const page = await doc.getPage(j.p);
  const vp = page.getViewport({ scale: S });
  const c = createCanvas(vp.width, vp.height); const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const b = j.box; const H = vp.height / S;
  let x0 = Math.max(0, b.x0) * S, x1 = Math.min(vp.width / S, b.x1) * S, y0 = (H - b.y1) * S, y1 = (H - b.y0) * S;
  // tighten to non-white content
  const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0); const w = img.width, h = img.height;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (img.data[o] < 245 || img.data[o + 1] < 245 || img.data[o + 2] < 245) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
  if (maxX <= minX || maxY <= minY) { console.log('empty', j.out); continue; }
  const pad = 8;
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad), cw = Math.min(w - cx, maxX - minX + 2 * pad), ch = Math.min(h - cy, maxY - minY + 2 * pad);
  const out = createCanvas(cw, ch); const octx = out.getContext('2d');
  octx.putImageData(ctx.getImageData(x0 + cx, y0 + cy, cw, ch), 0, 0);
  fs.writeFileSync(j.out, out.toBuffer('image/png'));
  console.log('ok', j.out, cw, ch);
}
