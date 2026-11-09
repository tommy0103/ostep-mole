// Extract structured content from OSTEP chapter PDFs (English v1.10 + official Chinese translation).
// Usage: node extract.mjs <lang:en|zh> <pdf> <chapterNum> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { brokenFonts, pageGlyphs } from './glyphs.mjs';
import { applyFixes } from './fixes.mjs';
import { createCanvas } from '@napi-rs/canvas';

const [lang, file, chapArg, outDir] = process.argv.slice(2);
const chap = +chapArg;
const OPS = pdfjs.OPS;
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0, isOffscreenCanvasSupported: false, disableFontFace: true, fontExtraProperties: true }).promise;
// Optional glyph-outline dictionary (see glyphdict.mjs) to repair fonts with a broken ToUnicode map
const GLYPHS = process.env.GLYPHS && fs.existsSync(process.env.GLYPHS) ? JSON.parse(fs.readFileSync(process.env.GLYPHS, 'utf8')) : null;
const BROKEN = GLYPHS ? await brokenFonts(doc) : new Set();

/** Per broken font: queue of {orig, fixed} characters in content-stream order. */
async function glyphFixes(page) {
  if (!BROKEN.size) return {};
  const out = {};
  for (const g of await pageGlyphs(page)) {
    if (!BROKEN.has(g.font)) continue;
    (out[g.font] ??= []).push({ orig: g.u, fixed: (g.h && GLYPHS[g.fam]?.[g.h]) ?? g.u });
  }
  return out;
}

const isCJK = (ch) => /[　-〿㐀-鿿＀-￯—…“”‘’]/.test(ch);
const isCJKPunct = (ch) => /[　-〿＀-￯—…“”‘’]/.test(ch);

function fontClass(name) {
  const n = name.replace(/^.*\+/, '');
  if (/Mon|Courier/i.test(n)) return n.includes('Bold') ? 'codeb' : 'code';
  if (lang === 'en') {
    if (/Bold/.test(n)) return 'b';
    if (/Ital/.test(n)) return 'i';
    if (/NimbusSan|Helvetica|Arial/i.test(n)) return 'fig';
    return 'r';
  }
  if (/Bold/.test(n) || /FZHTJW|SimHei|FZLBJW|FZDHTJW|FZCQJW/.test(n)) return 'b';
  if (/FZKTJW|Kai/.test(n)) return 'kai';
  if (/FZFSJW|FangSong/.test(n)) return 'fs';
  return 'r';
}

// ---- matrix helpers ----
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const toHex = (a) => typeof a[0] === 'string' ? a[0] : '#' + Array.from(a).slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function colorIsGray(c) {
  if (typeof c === 'string' && c.startsWith('#')) {
    const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    return r > 150 && r < 250 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12;
  }
  return false;
}

async function pageGraphics(page) {
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let fill = '#000000', stroke = '#000000', lw = 1;
  let pendingBox = null;
  const rects = [], images = [], paths = [];
  for (let k = 0; k < ol.fnArray.length; k++) {
    const fn = ol.fnArray[k], a = ol.argsArray[k];
    if (fn === OPS.save) stack.push([ctm, fill, stroke, lw]);
    else if (fn === OPS.restore) { const s = stack.pop(); if (s) [ctm, fill, stroke, lw] = s; }
    else if (fn === OPS.setStrokeRGBColor) stroke = toHex(a);
    else if (fn === OPS.setLineWidth) lw = a[0];
    else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.setFillRGBColor) fill = toHex(a);
    else if (fn === OPS.setFillGray) { const v = Math.round(a[0] * 255).toString(16).padStart(2, '0'); fill = '#' + v + v + v; }
    else if (fn === OPS.constructPath) {
      const mm = a[2];
      if (mm && mm.length === 4) {
        const p1 = apply(ctm, mm[0], mm[1]), p2 = apply(ctm, mm[2], mm[3]);
        pendingBox = { x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), y1: Math.max(p1[1], p2[1]) };
      }
    } else if ((fn === OPS.stroke || fn === OPS.closeStroke) && pendingBox) {
      const w = lw * Math.abs(ctm[3] || ctm[0]);
      const b = pendingBox;
      // aside backgrounds are sometimes painted as one very thick gray line, horizontal or vertical
      if (colorIsGray(stroke) && w > 12 && b.x1 - b.x0 > 150 && b.y1 - b.y0 < 2) rects.push({ x0: b.x0, x1: b.x1, y0: b.y0 - w / 2, y1: b.y1 + w / 2 });
      else if (colorIsGray(stroke) && w > 150 && b.y1 - b.y0 > 12 && b.x1 - b.x0 < 2) rects.push({ x0: b.x0 - w / 2, x1: b.x1 + w / 2, y0: b.y0, y1: b.y1 });
      else paths.push(b);
      pendingBox = null;
    } else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
      if (pendingBox && colorIsGray(fill) && pendingBox.x1 - pendingBox.x0 > 150 && pendingBox.y1 - pendingBox.y0 > 8) rects.push(pendingBox);
      else if (pendingBox) paths.push(pendingBox);
      pendingBox = null;
    } else if (fn === OPS.paintImageXObject) {
      const p1 = apply(ctm, 0, 0), p2 = apply(ctm, 1, 1);
      images.push({ name: a[0], x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), y1: Math.max(p1[1], p2[1]) });
    }
  }
  // merge overlapping/adjacent gray rects (some boxes are drawn in strips)
  rects.sort((a, b) => b.y1 - a.y1);
  const merged = [];
  for (const r of rects) {
    const m = merged.find((q) => r.x0 < q.x1 && q.x0 < r.x1 && Math.abs((q.x1 - q.x0) - (r.x1 - r.x0)) < 25 && r.y1 >= q.y0 - 3 && r.y0 <= q.y1 + 3);
    if (m) { m.x0 = Math.min(m.x0, r.x0); m.x1 = Math.max(m.x1, r.x1); }
    if (m) { m.y0 = Math.min(m.y0, r.y0); m.y1 = Math.max(m.y1, r.y1); } else merged.push({ ...r });
  }
  // keep long thin strips too: ch. 10's queue diagrams ("队列 → A → B → … → NULL") are 13pt tall
  const big = (im) => im.x1 - im.x0 > 40 && (im.y1 - im.y0 > 20 || (im.x1 - im.x0 > 100 && im.y1 - im.y0 > 8));
  return { rects: merged, images: images.filter(big), paths };
}

async function pageItems(page) {
  await page.getOperatorList(); // resolves the page's fonts into commonObjs
  const fixes = await glyphFixes(page);
  const tc = await page.getTextContent();
  const out = [];
  for (const it of tc.items) {
    const q = fixes[it.fontName];
    if (q && it.str) {
      let str = '';
      for (const ch of it.str) {
        const at = q.slice(0, 4).findIndex((e) => e.orig === ch);
        if (at >= 0) { str += q[at].fixed; q.splice(0, at + 1); } else str += ch;
      }
      it.str = str;
    }
    if (!it.str || !it.str.trim()) continue;
    const font = page.commonObjs.get(it.fontName);
    const size = Math.hypot(it.transform[0], it.transform[1]);
    out.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size, font: font.name.replace(/^.*\+/, ''), cls: fontClass(font.name) });
  }
  // de-duplicate "fake bold" double drawing (same glyphs drawn twice with ~1pt offset)
  const keptChars = [];
  const res = [];
  for (const it of out) {
    const n = [...it.str].length;
    const cw = it.w / Math.max(1, n);
    const overlapping = res.some((r) => Math.abs(r.y - it.y) < 2 && r.x < it.x + it.w - 1 && it.x < r.x + r.w - 1 && r.size === it.size && r.cls === it.cls);
    if (!overlapping) { res.push(it); [...it.str].forEach((ch, i) => keptChars.push({ ch, x: it.x + i * cw, y: it.y })); continue; }
    let s = '', sx = null;
    [...it.str].forEach((ch, i) => {
      const cx = it.x + i * cw;
      if (keptChars.some((k) => k.ch === ch && Math.abs(k.x - cx) < cw * 0.6 && Math.abs(k.y - it.y) < 2.5)) return;
      if (sx === null) sx = cx;
      s += ch; keptChars.push({ ch, x: cx, y: it.y });
    });
    if (s.trim()) res.push({ ...it, str: s, x: sx, w: cw * [...s].length });
  }
  return res;
}

function buildLines(items) {
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of items) {
    let l = lines.find((l) => Math.abs(l.y - it.y) < Math.max(2.2, Math.min(l.size, it.size) * 0.35));
    if (!l) { l = { y: it.y, size: it.size, items: [] }; lines.push(l); }
    l.items.push(it);
    l.size = Math.max(l.size, it.size);
  }
  const segs = [];
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const it of l.items) {
      const isCode = it.cls.startsWith('code');
      // a code line keeps its (tiny) line number even when the code is indented far from it
      const codeish = cur && cur.items.every((i) => i.cls.startsWith('code') || (/^\d+$/.test(i.str.trim()) && i.size < it.size - 2));
      if (cur && it.x - cur.x1 > Math.max(cur.size, it.size) * 2.2 && !(isCode && codeish)) cur = null;
      // a caption beside a figure that text wraps around shares its baseline with the body line on the left
      if (cur && /^[图表]\s*(\d|$)/.test(it.str) && it.size < cur.size - 0.8 && it.x - cur.x1 > 2) cur = null;
      if (!cur) { cur = { y: l.y, x0: it.x, x1: it.x + it.w, size: it.size, items: [] }; segs.push(cur); }
      cur.items.push(it); cur.x1 = Math.max(cur.x1, it.x + it.w); cur.size = Math.max(cur.size, it.size);
      cur.y = Math.max(cur.y, it.y);
    }
  }
  segs.sort((a, b) => b.y - a.y || a.x0 - b.x0);
  for (const s of segs) {
    s.runs = toRuns(s.items);
    s.text = s.runs.map((r) => r.t).join('');
    const counts = {};
    for (const it of s.items) counts[it.cls] = (counts[it.cls] || 0) + it.str.length;
    s.mainCls = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    // code lines may carry their tiny line number
    s.allCode = s.items.some((i) => i.cls.startsWith('code')) && s.items.every((i) => i.cls.startsWith('code') || (/^\d+$/.test(i.str.trim()) && i.size < 7.5));
    s.fonts = [...new Set(s.items.map((i) => i.font))];
    s.bodySize = Math.max(...s.items.map((i) => i.size));
  }
  return segs;
}

function toRuns(items) {
  const runs = [];
  let prev = null;
  for (const it of items) {
    let t = it.str;
    if (prev) {
      const gap = it.x - (prev.x + prev.w);
      const a = prev.str.slice(-1), b = t[0];
      const needSpace = gap > Math.min(prev.size, it.size) * 0.18 && !/\s/.test(a) && !/\s/.test(b) && !isCJKPunct(a) && !isCJKPunct(b);
      if (needSpace) {
        if (it.cls.startsWith('code')) {
          const cw = it.size * 0.6; t = ' '.repeat(Math.max(1, Math.round(gap / cw))) + t;
        } else t = ' ' + t;
      }
    }
    // small-caps: smaller glyphs inside a line of bigger text - keep as is (they're uppercase in PDF)
    const style = it.script ?? (it.cls === 'b' || it.cls === 'codeb' ? (it.cls === 'codeb' ? 'c' : 'b') : it.cls === 'i' ? 'i' : it.cls === 'code' ? 'c' : '');
    const last = runs[runs.length - 1];
    if (last && last.s === style) last.t += t; else runs.push({ t, s: style });
    prev = it;
  }
  return runs;
}

// ---- chapter-wide processing ----
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const items = await pageItems(page);
  const gfx = await pageGraphics(page);
  const H = vp.height;
  const kept = items.filter((it) => {
    // running headers sit above 0.87 (two lines in ch. 8: "SCHEDULING:" over "THE MULTI-LEVEL ...")
    if (lang === 'en') return it.y < H * 0.87 && it.y > H * 0.115;
    return it.y < H * 0.912 && it.y > 40;
  });
  // drop code line numbers (tiny digits)
  const bodyXs = kept.filter((it) => it.size >= 8).map((it) => it.x);
  const minBodyX = bodyXs.length ? Math.min(...bodyXs) : 0;
  const filtered = kept.filter((it) => !(/^\d+$/.test(it.str.trim()) && it.size < 7.5 && it.cls !== 'fig' && it.x + it.w < minBodyX + 1) && !(/^[\u2460-\u2473]$/.test(it.str.trim()) && it.size < 7));
  markScripts(filtered);
  pages.push({ p, W: vp.width, H, segs: buildLines(filtered), ...gfx, page });
}

// Superscripts (footnote markers, exponents) and subscripts are smaller glyphs set right after a
// bigger one, off its baseline. Snap them onto that baseline so they stay in the same line, in order.
function markScripts(items) {
  for (const it of items) {
    const word = /^[a-z]{2,14}$/.test(it.str.trim()); // a subscript may be a word: T_turnaround
    if ([...it.str.trim()].length > 6 && !word) continue;
    const base = items.find((n) => n !== it && n.size - it.size > 1.2 && Math.abs(n.x + n.w - it.x) < 1.6 && Math.abs(it.y - n.y) < n.size * 0.7);
    if (!base) continue;
    const dy = it.y - base.y;
    if (dy > 0.8 && [...it.str.trim()].length <= 6) it.script = 'sup';
    else if (dy < -0.8 && dy > -base.size * 0.5) it.script = 'sub';
    else continue;
    it.y = base.y;
  }
}

// estimate body size + margins
const sizeHist = {};
for (const pg of pages) for (const s of pg.segs) if (s.mainCls === 'r') sizeHist[s.bodySize.toFixed(1)] = (sizeHist[s.bodySize.toFixed(1)] || 0) + s.text.length;
if (!Object.keys(sizeHist).length) for (const pg of pages) for (const s of pg.segs) sizeHist[s.bodySize.toFixed(1)] = (sizeHist[s.bodySize.toFixed(1)] || 0) + s.text.length;
const BODY = +Object.entries(sizeHist).sort((a, b) => b[1] - a[1])[0][0];
for (const pg of pages) {
  const xs = {};
  // the left margin is the leftmost x where a good share of the text starts. Weighted by length so a
  // tall table of short cells cannot outvote the paragraphs; leftmost so that indented first lines
  // (Chinese paragraphs) do not win over continuation lines.
  for (const s of pg.segs) if (Math.abs(s.bodySize - BODY) < 0.6 && !s.allCode) { const k = Math.round(s.x0); xs[k] = (xs[k] || 0) + s.text.length; }
  const top = Math.max(0, ...Object.values(xs));
  const cands = Object.entries(xs).filter(([, w]) => w >= top * 0.3).map(([k]) => +k);
  pg.margin = cands.length ? Math.min(...cands) : 60;
  // right edge
  const r = {};
  for (const s of pg.segs) if (Math.abs(s.bodySize - BODY) < 0.6) { const k = Math.round(s.x1 / 4) * 4; r[k] = (r[k] || 0) + 1; }
  pg.right = +(Object.entries(r).sort((a, b) => b[1] - a[1])[0]?.[0] ?? pg.W - pg.margin);
}

const asideTitleRe = lang === 'en'
  ? /^(THE CRUX|CRUX|TIP|ASIDE|DESIGN TIP|DATA STRUCTURE|DESIGN|HOMEWORK|THE CRUX OF THE PROBLEM)\b/i
  : /^(关键问题|提示|补充|设计提示|数据结构|设计提示|旁注|附注)/;
const capRe = lang === 'en' ? /^Figure\s+(\d+)\.(\d+)\s*:\s*/ : /^图\s*(\d+)\s*\.\s*(\d+)\s*/;
const figDir = path.join(outDir, 'figs');
fs.mkdirSync(figDir, { recursive: true });
const cropJobs = [];

function isHeading(s, pg) {
  if (lang === 'en') {
    if (s.items.some((i) => i.cls === 'fig')) return false;
    if (s.bodySize < BODY + 0.8 || s.bodySize > BODY + 3) return false;
    const t = s.text.trim();
    if (s.x0 < pg.margin - 8 && /^\d+\.\d+\s/.test(t)) return 2;
    const bold = s.items.every((i) => i.cls === 'b' || i.cls === 'codeb');
    if (bold && /^(References|Homework|Questions)/.test(t) && t.length < 40) return 2;
    if (bold && Math.abs(s.x0 - pg.margin) < 3 && t.length < 80 && !/[.:]$/.test(t)) return s.bodySize > BODY + 1.5 ? 2 : 3;
    return false;
  }
  if (!(s.bodySize > BODY + 1.2)) return false;
  if (s.items.some((i) => i.cls === 'fig' || i.cls.startsWith('code'))) return false;
  return s.x0 < pg.margin + 30 && s.items.every((i) => /FZLBJW|FZHTJW|SimHei|Arial|Times|FZDHTJW|FZXBSJW|FZCQJW/.test(i.font) || i.size > BODY + 1.2);
}
function isBodyLine(s, pg) {
  if (s.allCode) return false;
  if (Math.abs(s.bodySize - BODY) > 0.7) return false;
  if (s.items.some((i) => i.cls === 'fig')) return false;
  const x = s.x0 - pg.margin;
  return x > -14 && x < 45 && (s.x1 - s.x0) > (pg.right - pg.margin) * 0.45;
}

// Classify each page's segments: figures, asides, others.
let lastTable = null;
for (const pg of pages) {
  pg.figs = [];
  const caps = pg.segs.filter((s) => capRe.test(s.text) && s.x0 > pg.margin - 20 && (lang === 'en' || s.bodySize < BODY - 0.4));
  for (const cap of caps) {
    for (const o of pg.segs.filter((o) => o !== cap && !o.used && Math.abs(o.y - cap.y) < 2 && o.x0 > cap.x0 && o.x0 - cap.x1 < cap.size * 4 && !capRe.test(o.text))) { o.used = true; cap.runs = [...cap.runs, { t: ' ', s: '' }, ...o.runs]; cap.text += ' ' + o.text; cap.x1 = Math.max(cap.x1, o.x1); }
    // caption may wrap to a second line (centered) right below it
    const capLines = [cap];
    for (const s of pg.segs) {
      if (s === cap || s.used) continue;
      const last = capLines[capLines.length - 1];
      if (s.y < last.y && last.y - s.y < s.size * 1.6 && Math.abs(s.bodySize - cap.bodySize) < 0.3 && !isBodyLine(s, pg) && s.x0 > pg.margin + 10) capLines.push(s);
    }
    capLines.forEach((s) => (s.used = true));
    const m = cap.text.match(capRe);
    const num = `${m[1]}.${m[2]}`;
    const capRuns = mergeRuns(capLines.map((s) => s.runs));
    capRuns[0].t = capRuns[0].t.replace(capRe, '');
    if (!capRuns[0].t) capRuns.shift();
    // Region above the caption
    let top = pg.H;
    const above = pg.segs.filter((s) => s.y > cap.y + 1 && !s.used).sort((a, b) => a.y - b.y);
    const img = pg.images.filter((im) => im.y0 >= cap.y - 4 && im.y0 - cap.y < 60 && im.x1 > cap.x0 - 40 && im.x0 < cap.x1 + 40).sort((a, b) => a.y0 - b.y0)[0];
    const region = [];
    if (img) {
      for (const s of pg.segs) if (!s.used && s.y > img.y0 - 2 && s.y < img.y1 + 2 && s.x0 > img.x0 - 5 && s.x1 < img.x1 + 5) { s.used = true; }
      img.used = true;
      pg.figs.push({ num, caption: capRuns, y: img.y1, image: img, cap });
      continue;
    }
    for (const s of above) {
      // a bold table header row looks like a subheading, but shares its line with other cells
      const lonely = !pg.segs.some((o) => o !== s && !o.used && Math.abs(o.y - s.y) < 2);
      const columnar = s.items.some((it, k) => k > 0 && it.x - (s.items[k - 1].x + s.items[k - 1].w) > s.size * 1.2);
      if (lonely && !columnar && (isBodyLine(s, pg) && !s.allCode || isHeading(s, pg))) { top = s.y; break; }
      region.push(s);
    }
    // inside an aside box? stop at box
    region.forEach((s) => (s.used = true));
    const numberedCode = (s) => s.items.some((i) => i.cls.startsWith('code')) && s.items.every((i) => i.cls.startsWith('code') || /^\d+$/.test(i.str.trim()));
    const codeOnly = region.length > 0 && region.every((s) => s.allCode || numberedCode(s) || /^\s*\d+\s*$/.test(s.text));
    // labels of a drawing may be set in Courier (e.g. the red-black tree of Fig 9.5): many vector paths
    // in the region means a picture, not a code listing
    const rb = region.length && { x0: Math.min(...region.map((s) => s.x0)) - 4, x1: Math.max(...region.map((s) => s.x1)) + 4, y0: Math.min(...region.map((s) => s.y)) - 4, y1: Math.max(...region.map((s) => s.y + s.size)) + 4 };
    const drawn = rb && pg.paths.filter((b) => b.x0 >= rb.x0 - 20 && b.x1 <= rb.x1 + 20 && b.y0 >= rb.y0 - 20 && b.y1 <= rb.y1 + 20).length >= 4;
    const table = !codeOnly && !drawn && tableFrom(region);
    if (codeOnly && !drawn) {
      pg.figs.push({ num, caption: capRuns, y: Math.max(...region.map((s) => s.y)), code: codeText(region.slice().reverse()), cap, box: rb });
    } else if (table) {
      pg.figs.push({ num, caption: capRuns, y: Math.max(...region.map((s) => s.y)), table, cap, box: rb });
    } else {
      const yTop = region.length ? Math.max(...region.map((s) => s.y + s.size)) + 4 : Math.min(top - 4, cap.y + 160);
      const box = { x0: pg.margin - 30, x1: pg.right + 30, y0: cap.y + cap.size + 1, y1: Math.min(yTop, top - 3) };
      const fname = `${String(chap).padStart(2, '0')}-${num}.png`;
      cropJobs.push({ p: pg.p, box, out: path.join(figDir, fname), H: pg.H });
      pg.figs.push({ num, caption: capRuns, y: box.y1, crop: fname, cap, fallback: region.slice().reverse().map((s) => s.text).join('\n'), box });
    }
  }
  // zh tables: "表 N.M" caption above a text grid
  // A table continued on the next page is headed "续表" (continued).
  if (lang === 'zh') {
    const isCap = (s) => (/^表\s*\d+\s*\.\s*\d+/.test(s.text.trim()) && s.x0 > pg.margin + 8 && s.bodySize < BODY - 0.4) || (/^续表$/.test(s.text.trim()) && lastTable);
    for (const cap of pg.segs.filter((s) => !s.used && isCap(s))) {
      const cont = /^续表/.test(cap.text.trim());
      const m = cont ? [null, ...lastTable.split('.')] : cap.text.trim().match(/^表\s*(\d+)\s*\.\s*(\d+)\s*/);
      lastTable = m[1] + '.' + m[2];
      cap.used = true;
      const region = [];
      for (const s of pg.segs.filter((s) => s.y < cap.y - 1 && !s.used).sort((a, b) => b.y - a.y)) {
        if (isBodyLine(s, pg)) break;
        if (s.bodySize > BODY + 1.2) break;
        region.push(s);
      }
      const table = tableFrom(region.slice().reverse());
      if (!table && !region.length) continue;
      region.forEach((s) => (s.used = true));
      const sameLine = cont ? [] : pg.segs.filter((o) => o !== cap && !o.used && Math.abs(o.y - cap.y) < 2 && o.x0 > cap.x0);
      sameLine.forEach((o) => (o.used = true));
      const runs = cont ? [] : cleanRunsCopy([...cap.runs, ...sameLine.flatMap((o) => [{ t: ' ', s: '' }, ...o.runs])]);
      if (runs.length) runs[0].t = runs[0].t.replace(/^\s*表\s*\d+\s*\.\s*\d+\s*/, '');
      const fig = { num: lastTable, kind: 'table', label: '表', cont: cont || undefined, caption: runs.filter((r) => r.t), y: cap.y, cap };
      // the table's area, so its rules are not taken for a drawing
      const box = { x0: pg.margin - 30, x1: pg.right + 30, y0: Math.min(...region.map((s) => s.y)) - 4, y1: cap.y - 1 };
      if (table) pg.figs.push({ ...fig, table, box });
      else {
        // multi-line cells defeat the grid reconstruction (e.g. the LDE protocol tables): keep a picture
        const fname = `${String(chap).padStart(2, '0')}-t${lastTable}${cont ? 'b' : ''}.png`;
        cropJobs.push({ p: pg.p, box, out: path.join(figDir, fname), H: pg.H });
        pg.figs.push({ ...fig, crop: fname, box });
      }
    }
  }
  uncaptionedDrawings(pg);
  // Images that weren't attached to captions (e.g. zh figure whose caption is on another page)
  for (const im of pg.images.filter((i) => !i.used)) {
    for (const s of pg.segs) if (!s.used && s.y > im.y0 - 2 && s.y < im.y1 + 2 && s.x0 > im.x0 - 5 && s.x1 < im.x1 + 5) s.used = true;
    pg.figs.push({ num: null, caption: [], y: im.y1, image: im });
  }
  // Aside boxes
  for (const r of pg.rects) {
    for (const s of pg.segs) if (!s.used && s.y > r.y0 - 1 && s.y < r.y1 + 1 && s.x0 > r.x0 - 4 && s.x1 < r.x1 + 6) { s.aside = r; }
  }
  // footnotes: small text below the last body line, starting with a marker
  const bodyYs = pg.segs.filter((s) => !s.used && !s.aside && isBodyLine(s, pg)).map((s) => s.y);
  // a page of references has no body lines: then only the marker tells a footnote apart
  const lowest = bodyYs.length ? Math.min(...bodyYs) : Infinity;
  let inNote = false;
  for (const s of pg.segs) {
    if (s.used || s.aside || s.y >= lowest || s.bodySize >= BODY - 0.6 || s.allCode) { continue; }
    const first = s.items[0];
    // the marker starts the note's first line; a bare small digit elsewhere is e.g. a fraction's denominator
    const startsLine = s.text.trim().length > 2 || pg.segs.some((o) => o !== s && o.y <= s.y && s.y - o.y < 5 && o.x0 >= s.x1 - 1 && o.x0 - s.x1 < 8);
    const marker = startsLine && (lang === 'zh' ? /^[\u2460-\u2473]/.test(s.text.trim()) : (/^\d+$/.test(first.str.trim()) && first.size < BODY - 1.5));
    if (marker) inNote = true;
    if (inNote) s.note = true;
  }
}

// A drawing without a caption (e.g. the linked list in §9.3): vector paths plus the labels around them.
// Without this its labels would leak into the text as a paragraph like "Job:A Job:B head NULL".
function uncaptionedDrawings(pg) {
  const inBox = (s, b, pad = 0) => s.x0 >= b.x0 - pad && s.x1 <= b.x1 + pad && s.y >= b.y0 - pad && s.y + s.size * 0.7 <= b.y1 + pad;
  const taken = [...pg.figs.filter((f) => f.box).map((f) => f.box), ...pg.rects];
  const overlaps = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
  // inside the text area (the Chinese running header is underlined by a rule)
  const [top, bottom] = lang === 'en' ? [pg.H * 0.885, pg.H * 0.115] : [pg.H * 0.9, 40];
  const boxes = pg.paths.filter((b) => b.y1 < top && b.y0 > bottom && !taken.some((t) => overlaps(b, t, -2)));
  // union-find style clustering of nearby paths
  const clusters = [];
  for (const b of boxes) {
    const c = { ...b };
    for (let k = clusters.length - 1; k >= 0; k--) {
      if (overlaps(clusters[k], c, 8)) { const o = clusters.splice(k, 1)[0]; c.x0 = Math.min(c.x0, o.x0); c.x1 = Math.max(c.x1, o.x1); c.y0 = Math.min(c.y0, o.y0); c.y1 = Math.max(c.y1, o.y1); }
    }
    clusters.push(c);
  }
  for (const c of clusters) {
    // small clusters are decorations, but a wide row of boxes may be short (the address layout in ch. 20)
    const thin = c.y1 - c.y0 < 12 && !(c.x1 - c.x0 > 150 && c.y1 - c.y0 > 5);
    if (c.x1 - c.x0 < 30 || thin || taken.some((t) => overlaps(c, t))) continue;
    // the short last line of a paragraph ("address looks like this:") starts at the margin in body type
    const paraEnd = (s) => Math.abs(s.x0 - pg.margin) < 3 && s.bodySize > BODY - 0.5 && /^(r|i|b|kai)$/.test(s.mainCls);
    const isLabel = (s) => !paraEnd(s) && !s.used && !s.aside && s.bodySize < BODY * 1.4 && !isBodyLine(s, pg) && !isHeading(s, pg) && !s.allCode && !capRe.test(s.text) && !asideTitleRe.test(s.text.trim());
    // a box around running text (e.g. the outlined CRUX) is not a drawing
    if (pg.segs.some((s) => !s.used && inBox(s, c, 2) && !isLabel(s))) continue;
    c.lines = c.y1 - c.y0; // height of the drawn lines alone, before labels widen the box
    const labels = new Set(pg.segs.filter((s) => isLabel(s) && inBox(s, c, 2)));
    // grow over labels that sit just outside the paths ("head", "NULL", axis titles)
    for (let grew = true; grew; ) {
      grew = false;
      for (const s of pg.segs) {
        if (labels.has(s) || !isLabel(s)) continue;
        const sb = { x0: s.x0, x1: s.x1, y0: s.y - 2, y1: s.y + s.size };
        const sameRow = sb.y0 > c.y0 - 2 && sb.y1 < c.y1 + 2 && (sb.x0 - c.x1 < 90 && c.x0 - sb.x1 < 90);
        if (overlaps(sb, c, 10) || sameRow) { labels.add(s); grew = true; c.x0 = Math.min(c.x0, sb.x0); c.x1 = Math.max(c.x1, sb.x1); c.y0 = Math.min(c.y0, sb.y0); c.y1 = Math.max(c.y1, sb.y1); }
      }
    }
    if (!labels.size && (c.x1 - c.x0 < 80 || c.y1 - c.y0 < 30)) continue;
    labels.forEach((s) => (s.used = true));
    c.ok = true;
  }
  const found = [];
  // pieces of one drawing stacked a little apart (a brace over a row of bit boxes) are one figure
  // (two full drawings may also sit that close, e.g. the queues and the timeline in ch. 10: only a thin piece joins)
  const stacked = (f, c) => f.x0 < c.x1 && c.x0 < f.x1 && Math.max(f.y0, c.y0) - Math.min(f.y1, c.y1) < 16 && Math.min(f.lines, c.lines) < 8;
  for (const c of clusters.filter((c) => c.ok).sort((a, b) => b.y1 - a.y1)) {
    const o = found.find((f) => overlaps(f, c, 6) || stacked(f, c));
    if (o) { o.lines = Math.max(o.lines, c.lines); o.x0 = Math.min(o.x0, c.x0); o.x1 = Math.max(o.x1, c.x1); o.y0 = Math.min(o.y0, c.y0); o.y1 = Math.max(o.y1, c.y1); } else found.push(c);
  }
  for (const c of found) {
    const box = { x0: c.x0 - 4, x1: c.x1 + 4, y0: c.y0 - 4, y1: c.y1 + 4 };
    // the padding must not reach into the body lines around (their descenders and ascenders)
    for (const t of pg.segs) {
      if (t.used || t.x1 < box.x0 || t.x0 > box.x1) continue;
      if (t.y >= c.y1) box.y1 = Math.min(box.y1, t.y - t.size * 0.3);
      else if (t.y + t.size * 0.8 <= c.y0) box.y0 = Math.max(box.y0, t.y + t.size * 0.8);
    }
    const fname = `${String(chap).padStart(2, '0')}-p${pg.p}-${Math.round(c.y1)}.png`;
    cropJobs.push({ p: pg.p, box, out: path.join(figDir, fname), H: pg.H });
    pg.figs.push({ num: null, caption: [], y: box.y1, crop: fname, box });
  }
}

function cleanRunsCopy(runs) { return runs.map((r) => ({ ...r })); }
// Rebuild a text table from a set of line segments (rows by y, columns by x clusters)
function tableFrom(region) {
  if (region.length < 3) return null;
  if (region.some((s) => s.items.some((i) => i.cls === 'fig'))) return null;
  const rows = [];
  for (const s of region.slice().sort((a, b) => b.y - a.y || a.x0 - b.x0)) {
    let r = rows.find((r) => Math.abs(r.y - s.y) < 3);
    if (!r) { r = { y: s.y, segs: [] }; rows.push(r); }
    r.segs.push(s);
  }
  if (rows.length < 3) return null;
  // split segments further on items gaps to get cells
  const cellsOf = (r) => {
    const items = r.segs.flatMap((s) => s.items).sort((a, b) => a.x - b.x);
    const cells = [];
    for (const it of items) {
      const c = cells[cells.length - 1];
      if (c && it.x - c.x1 < it.size * 1.0) { c.items.push(it); c.x1 = Math.max(c.x1, it.x + it.w); }
      else cells.push({ x0: it.x, x1: it.x + it.w, items: [it] });
    }
    return cells;
  };
  rows.forEach((r) => (r.cells = cellsOf(r)));
  const multi = rows.filter((r) => r.cells.length >= 2).length;
  if (multi / rows.length < 0.6) return null;
  // column bands = union of overlapping cell x-intervals
  const ivs = rows.flatMap((r) => r.cells.map((c) => [c.x0, c.x1])).sort((a, b) => a[0] - b[0]);
  const cols = [];
  for (const [a, b] of ivs) { const c = cols[cols.length - 1]; if (c && a <= c[1] + 2) c[1] = Math.max(c[1], b); else cols.push([a, b]); }
  if (cols.length < 2 || cols.length > 12) return null;
  const out = rows.map((r) => {
    const row = cols.map(() => []);
    for (const c of r.cells) {
      const k = cols.findIndex(([a, b]) => c.x0 >= a - 1 && c.x0 <= b + 1);
      row[Math.max(0, k)].push(...cleanRuns(toRuns(c.items)));
    }
    return row;
  });
  return out;
}
function mergeRuns(runLists) {
  const out = [];
  runLists.forEach((runs, li) => {
    runs.forEach((r, ri) => {
      let t = r.t;
      if (li > 0 && ri === 0) {
        const prev = out[out.length - 1];
        const a = prev ? prev.t.slice(-1) : '';
        if (lang === 'en' && a === '-' && /^[a-z]/.test(t)) { prev.t = prev.t.slice(0, -1) + '­'; }
        else if (a && !isCJK(a) && !isCJK(t[0]) && !/\s/.test(a)) t = ' ' + t;
        else if (a && (isCJK(a) !== isCJK(t[0])) && !isCJKPunct(a) && !isCJKPunct(t[0]) && lang === 'zh') t = ' ' + t;
      }
      const last = out[out.length - 1];
      if (last && last.s === r.s) last.t += t; else out.push({ t, s: r.s });
    });
  });
  return out;
}

function stripLineNumbers(text) {
  const lines = text.split('\n');
  const numbered = lines.filter((l) => /^\s*\d+(\s|$)/.test(l));
  if (numbered.length < 3 || numbered.length < lines.filter((l) => l.trim()).length * 0.7) return text;
  const nums = numbered.map((l) => +l.match(/^\s*(\d+)/)[1]);
  if (!nums.every((n, i) => i === 0 || n > nums[i - 1])) return text;
  const w = Math.min(...numbered.map((l) => l.match(/^\s*\d+\s*/)[0].length));
  const out = lines.map((l) => (/^\s*\d+(\s|$)/.test(l) ? l.replace(/^\s*\d+/, (m) => ' '.repeat(m.length)).slice(w) : l));
  // some listings number their #include lines in a narrower column than the rest
  const indent = (l) => l.match(/^ */)[0].length;
  const include = (l) => l.trimStart().startsWith('#');
  const heads = out.filter(include), rest = out.filter((l) => l.trim() && !include(l));
  const k = heads.length && rest.length ? Math.min(...rest.map(indent)) - Math.max(...heads.map(indent)) : 0;
  return (k > 0 ? out.map((l) => (include(l) ? l : l.slice(k))) : out).join('\n');
}
function codeText(segs) { return dedent(stripLineNumbers(rawCodeText(segs))); }
function dedent(text) {
  const lines = text.split('\n');
  const w = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return w > 0 && Number.isFinite(w) ? lines.map((l) => l.slice(w)).join('\n') : text;
}
function rawCodeText(segs) {
  // tiny line numbers in front of the code are dropped here; indentation is measured from the code
  const tiny = (i) => /^\d+$/.test(i.str.trim()) && i.size < 7.5;
  segs = segs.filter((s) => !s.items.every(tiny)).map((s) => {
    if (s.items.length < 2 || !tiny(s.items[0])) return s;
    const items = s.items.slice(1);
    return { ...s, items, x0: items[0].x, text: toRuns(items).map((r) => r.t).join('') };
  });
  if (!segs.length) return '';
  const minX = Math.min(...segs.map((s) => s.x0));
  const cw = segs[0].size * 0.6;
  const lines = [];
  let prevY = null;
  const lh = segs[0].size * 1.12;
  for (const s of segs) {
    if (prevY !== null && prevY - s.y > lh * 1.7) lines.push('');
    lines.push(' '.repeat(Math.max(0, Math.round((s.x0 - minX) / cw))) + s.text);
    prevY = s.y;
  }
  return lines.join('\n');
}

// ---- Flatten to a stream of units in reading order ----
const stream = [];
for (const pg of pages) {
  const units = [];
  for (const s of pg.segs) if (!s.used) units.push({ kind: 'seg', y: s.y, s, pg });
  for (const f of pg.figs) units.push({ kind: 'fig', y: f.y, x: f.image?.x0 ?? f.box?.x0 ?? 0, f, pg });
  // side-by-side figures share a top edge: left one first
  units.sort((a, b) => (a.kind === 'fig' && b.kind === 'fig' && Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y));
  stream.push({ kind: 'page', p: pg.p });
  stream.push(...units);
}

// ---- Block building ----
const blocks = [];
let title = '';
let mode = 'body'; // body | refs | hw
let cur = null; // current paragraph-like block {type, lines:[]}
let curAside = null;
let prevSeg = null;

let lastPara = null, interrupted = false;
// Footnotes sit at the page bottom, often in the middle of a paragraph or aside that continues on the
// next page. They are collected here and emitted once the interrupted block is finished.
let curNote = null, prevNoteSeg = null;
const noteQueue = [];
function endNote() {
  if (!curNote) return;
  noteQueue.push({ t: 'note', runs: cleanRuns(mergeRuns(curNote.lines.map((s) => s.runs))) });
  curNote = null;
}
function emitNotes() {
  endNote();
  if (!curAside) blocks.push(...noteQueue.splice(0));
}
function flush() {
  if (!cur) return;
  const target = curAside ? curAside.blocks : blocks;
  let b;
  if (cur.type === 'code') b = { t: 'code', text: codeText(cur.lines) };
  else {
    const runs = mergeRuns(cur.lines.map((s) => s.runs));
    b = { t: cur.type, runs: cleanRuns(runs) };
    if (cur.type === 'li') b.marker = cur.marker;
  }
  if (cur.block) { for (const k of Object.keys(cur.block)) delete cur.block[k]; Object.assign(cur.block, b); }
  else { target.push(b); cur.block = b; }
  if (!curAside) lastPara = cur.type === 'p' || cur.type === 'li' ? cur : null;
  cur = null;
  emitNotes();
}
const ACCENTS = { '¨': '\u0308', '´': '\u0301', 'ˆ': '\u0302', '˜': '\u0303', 'ˇ': '\u030c' };
function cleanRuns(runs) {
  runs.forEach((r) => (r.t = r.t.replace(/\s+/g, ' ').replace(/ ?([¨´ˆ˜ˇ])([A-Za-z])/g, (_, a, c) => (c + ACCENTS[a]).normalize('NFC'))));
  for (let i = 1; i < runs.length; i++) {
    const m = runs[i].t.match(/^\s+/);
    if (m && runs[i].s) { runs[i].t = runs[i].t.slice(m[0].length); if (!/\s$/.test(runs[i - 1].t)) runs[i - 1].t += ' '; }
    const e = runs[i - 1].t.match(/\s+$/);
    if (e && runs[i - 1].s) { runs[i - 1].t = runs[i - 1].t.slice(0, -e[0].length); if (!/^\s/.test(runs[i].t)) runs[i].t = ' ' + runs[i].t; }
  }
  if (runs.length) { runs[0].t = runs[0].t.replace(/^\s+/, ''); runs[runs.length - 1].t = runs[runs.length - 1].t.replace(/\s+$/, ''); }
  return runs.filter((r) => r.t);
}
function flushAside() {
  flush();
  if (curAside) { if (curAside.blocks.length || curAside.title) blocks.push(curAside); curAside = null; interrupted = true; }
  emitNotes();
}

function asideKind(t) {
  if (/CRUX|关键问题/i.test(t)) return 'crux';
  if (/\bTIP\b|提示/i.test(t)) return 'tip'; // not "MULTIPLE"
  if (/DATA STRUCTURE|数据结构/i.test(t)) return 'ds';
  return 'aside';
}
const sectionRe = lang === 'en' ? /^(\d+)\.(\d+)\s+(.*)$/ : /^(\d+)\.(\d+)\s*(.*)$/;
const speakerRe = lang === 'en' ? /^(Professor|Student)\s*:/ : /^(教授|学生)\s*[：:]/;
let lastPage = 0;

for (const u of stream) {
  if (u.kind === 'page') { lastPage = u.p; prevSeg = null; endNote(); prevNoteSeg = null; continue; }
  if (u.kind === 'fig') {
    const keep = cur && (cur.type === 'p' || cur.type === 'li') ? cur : lastPara;
    flush(); if (!curAside) { lastPara = keep; interrupted = true; }
    const f = u.f;
    if (f.image) {
      const fname = `${String(chap).padStart(2, '0')}-${f.num ?? 'img' + u.pg.p + '-' + Math.round(f.y)}.png`;
      await saveImage(u.pg.page, f.image.name, path.join(figDir, fname));
      (curAside ? curAside.blocks : blocks).push({ t: 'fig', num: f.num, caption: cleanRuns(f.caption), img: fname, page: u.pg.p });
    } else if (f.table) {
      flushAside();
      blocks.push({ t: 'fig', kind: 'table', label: f.label, cont: f.cont, num: f.num, caption: cleanRuns(f.caption), table: f.table, page: u.pg.p });
    } else if (f.code !== undefined) {
      flushAside();
      blocks.push({ t: 'fig', num: f.num, caption: cleanRuns(f.caption), code: f.code, page: u.pg.p });
    } else {
      flushAside();
      blocks.push({ t: 'fig', kind: f.kind, label: f.label, cont: f.cont, num: f.num, caption: cleanRuns(f.caption), img: f.crop, page: u.pg.p, fallback: f.fallback });
    }
    continue;
  }
  const s = u.s, pg = u.pg;
  const text = s.text.trim();
  // the English marker is a tiny digit, sometimes set flush against the note's first word ("3On Linux")
  const noteMarker = s.note && (lang === 'zh' ? /^[\u2460-\u2473]/.test(text) : /^\d+$/.test(s.items[0].str.trim()) && s.items[0].size < BODY - 1.5);
  // under the references a footnote needs its marker (or must continue one), as references are small print too
  if (s.note && (mode !== 'refs' || noteMarker || (curNote && prevNoteSeg))) {
    if (!curNote || !prevNoteSeg || noteMarker) { endNote(); curNote = { lines: [] }; }
    curNote.lines.push(s); prevNoteSeg = s; continue;
  }
  endNote(); prevNoteSeg = null;
  // chapter title on first page
  if (s.bodySize > BODY * (lang === 'en' ? 1.45 : 1.75) && lastPage <= 1) {
    flushAside();
    if (/^\d+$/.test(text) || /^第\s*\d+\s*章$/.test(text)) continue;
    title += (title ? ' ' : '') + text.replace(/^第\s*\d+\s*章\s*/, '');
    continue;
  }
  // section heading
  if (isHeading(s, pg) && !s.aside) {
    flushAside();
    const m = text.match(sectionRe);
    const special = /^(References|参考资料|参考文献|Homework|作业|Questions|问题)/.test(text);
    if (m) blocks.push({ t: 'h', level: 2, num: `${m[1]}.${m[2]}`, text: m[3].trim(), runs: cleanRuns(cleanRunsCopy(s.runs)).map((r, i) => (i === 0 ? { ...r, t: r.t.replace(sectionRe, '$3') } : r)).filter((r) => r.t) });
    else blocks.push({ t: 'h', level: special && !/^(Questions|问题)/.test(text) ? 2 : 3, num: null, text, special: special || undefined });
    if (/^(References|参考资料|参考文献)/.test(text)) mode = 'refs';
    else if (/^(Homework|作业|Questions|问题)/.test(text)) mode = 'hw';
    else mode = 'body';
    prevSeg = null;
    continue;
  }
  // English crux: outlined (not gray) box; detect by title and following tight lines
  if (!s.aside && lang === 'en' && /^THE CRUX/i.test(text)) {
    flushAside();
    curAside = { t: 'aside', kind: 'crux', title: text, blocks: [], box: { crux: true }, page: lastPage };
    prevSeg = s; continue;
  }
  if (curAside && curAside.box.crux && !s.aside) {
    if (prevSeg && (prevSeg.y - s.y) < BODY * 1.6 && (prevSeg.y - s.y) > 0) s.aside = curAside.box;
  }
  // aside handling
  if (s.aside) {
    const isTitle = (asideTitleRe.test(text) && (s.x0 - s.aside.x0 > 20 || lang === 'zh' || /:/.test(text))) && (!curAside || curAside.box !== s.aside || !cur || curAside.blocks.length > 0 || cur);
    if (!curAside || curAside.box !== s.aside) {
      // continuation of an aside across page break (no title at top)
      const continuing = curAside && !asideTitleRe.test(text) && curAside.page === lastPage - 1;
      if (!continuing) { flushAside(); curAside = { t: 'aside', kind: 'aside', title: '', blocks: [], box: s.aside, page: lastPage }; }
      else { curAside.box = s.aside; curAside.page = lastPage; }
    }
    if (isTitle && !curAside.title && curAside.blocks.length === 0 && !cur) {
      curAside.title = text; curAside.kind = asideKind(text); curAside.titleRuns = s.runs; prevSeg = s; continue;
    }
  } else if (curAside) {
    flushAside();
  }
  const mg = s.aside && !s.aside.crux ? s.aside.x0 + (lang === 'en' ? 4 : 6) : pg.margin;
  const indent = s.x0 - mg;
  const lh = BODY * 1.25;
  const gap = prevSeg ? prevSeg.y - s.y : 0;
  const bigGap = prevSeg && gap > lh * (lang === 'en' ? 1.45 : 1.25) && gap > 0;

  if (s.allCode && mode !== 'refs' && !(cur && cur.type !== 'code' && s.x1 - s.x0 < 60 && !bigGap && indent < 6)) {
    if (!cur || cur.type !== 'code' || bigGap && gap > lh * 3) { flush(); cur = { type: 'code', lines: [] }; }
    cur.lines.push(s); prevSeg = s; continue;
  }
  let startNew = false;
  let type = 'p', marker = null;
  const bullet = /^[•●■◆▪]/.test(text);
  const numbered = (mode === 'hw') && (lang === 'zh' ? /^\d+[.．]/ : /^\d+\.\s/).test(text);
  if (!cur || cur.type === 'code') startNew = true;
  else if (bullet || numbered) startNew = true;
  else if (mode === 'refs') startNew = /^\[/.test(text);
  else if (speakerRe.test(text)) startNew = true;
  else if (bigGap) startNew = true;
  else if (cur.type === 'li') {
    startNew = indent < cur.firstIndent - 4;
    if (lang === 'zh' && indent > 30 && indent < 60 && s.runs[0] && s.runs[0].s === 'b' && /[。；：）]$/.test(cur.lines[cur.lines.length - 1].text.trim())) startNew = true;
  } else if (lang === 'zh' && indent > 30 && indent < 60 && !s.aside) startNew = true;
  else if (indent > 7 && indent < 40) startNew = true;
  if (cur && cur.type === 'li' && !bullet && !numbered && indent < cur.firstIndent - 4) startNew = true;

  if (bullet) { type = 'li'; marker = '•'; }
  else if (numbered) { type = 'li'; marker = text.match(/^(\d+)[.．]/)[1]; }
  else if (!startNew && cur) type = cur.type;
  else if (mode === 'refs' && !s.aside) type = 'ref';
  else if (lang === 'zh' && indent > 30 && indent < 60 && !speakerRe.test(text)) { type = 'li'; marker = '•'; }

  // a list item broken by a figure resumes at the indent of its own wrapped lines
  const resumesItem = lastPara?.type === 'li' && lastPara.lines.length > 1 && Math.abs(indent - (lastPara.lines.at(-1).x0 - pg.margin)) < 3;
  if (startNew && interrupted && lastPara && !s.aside && !bullet && !numbered && !speakerRe.test(text) && (indent < 7 || resumesItem) && mode === 'body') {
    const lt = lastPara.lines.map((x) => x.text).join('').trim();
    if (!/[.?!:。？！：”"]$/.test(lt)) { const lp = lastPara; flush(); cur = lp; startNew = false; type = cur.type; }
  }
  if (!s.aside) interrupted = false;
  if (startNew) {
    flush();
    if (bullet) s.runs[0].t = s.runs[0].t.replace(/^\s*[•●■◆▪]\s*/, '');
    if (numbered) s.runs[0].t = s.runs[0].t.replace(/^\s*\d+[.．]\s*/, '');
    cur = { type, lines: [], marker, indent, firstIndent: indent };
    if (type === 'li') { cur.firstIndent = indent; }
    // Chinese homework items: "1．" is indented, its continuation lines return to the margin
    if (numbered && lang === 'zh') cur.firstIndent = 0;
  }
  cur.lines.push(s);
  prevSeg = s;
}
flushAside();

// hyphenation resolution (en): soft hyphen marks a line-end hyphen; decide keep/drop with corpus stats
if (lang === 'en') {
  const all = JSON.stringify(blocks);
  const resolve = (runs) => runs.forEach((r) => {
    r.t = r.t.replace(/([A-Za-z]+)­([a-z]+)/g, (m0, a, b) => {
      const joined = a + b, hy = a + '-' + b;
      if (all.includes(hy) && !all.includes(joined)) return hy;
      return joined;
    }).replace(/­/g, '-');
  });
  const walk = (bs) => bs.forEach((b) => { if (b.runs) resolve(b.runs); if (b.caption) resolve(b.caption); if (b.blocks) walk(b.blocks); });
  walk(blocks);
}
// Dialogue chapters open on the Part's title page ("3", "A Dialogue on ..."): drop text before the first speaker
const firstSpeaker = blocks.findIndex((b) => b.t === 'p' && speakerRe.test(b.runs.map((r) => r.t).join('')));
if (firstSpeaker > 0 && blocks.slice(0, firstSpeaker).every((b) => b.t === 'p' || b.t === 'h') && firstSpeaker <= 4) blocks.splice(0, firstSpeaker);
// a lone "." that fell out of the box above it
for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].t === 'p' && /^[.,;:]$/.test(blocks[i].runs.map((r) => r.t).join('').trim())) blocks.splice(i, 1);
for (const b of blocks) if (b.t === 'aside') { delete b.box; delete b.page; delete b.titleRuns; }
for (const b of blocks) {
  if (b.t !== 'aside') continue;
  // "≠" is set as a slashed "6=" in the English PDFs' math font
  b.title = b.title.replace(/ 6= /g, ' ≠ ');
  // an English crux whose question wrapped below "THE CRUX:" lands in the body: move it back up
  const first = b.blocks[0];
  if (b.kind === 'crux' && /:\s*$/.test(b.title) && first?.t === 'p') {
    const text = first.runs.map((r) => r.t).join('');
    const m = text.match(/^[A-Z0-9 ,'’?/-]{8,}?(?=\s+[A-Z][a-z]|$)/);
    if (m) {
      b.title = b.title.trim() + ' ' + m[0].trim();
      // drop the title's characters from the paragraph, keeping the styles of what is left
      let cut = m[0].length;
      for (const r of first.runs) { const k = Math.min(cut, r.t.length); r.t = r.t.slice(k); cut -= k; }
      first.runs = first.runs.filter((r) => r.t);
      if (first.runs.length) first.runs[0].t = first.runs[0].t.trimStart();
      if (!first.runs.length) b.blocks.shift();
    }
  }
}
for (let i = 1; i < blocks.length; i++) {
  const b = blocks[i];
  let j = i - 1;
  while (j > 0 && blocks[j].t === 'note') j--;
  if (b.t === 'fig' && b.code !== undefined && blocks[j].t === 'code') { b.code = blocks[j].text + '\n' + b.code; blocks.splice(j, 1); i--; }
}
// the translation sets a program's output directly above the next listing: give the output its own block
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  if (b.t !== 'fig' || b.code === undefined) continue;
  const lines = b.code.split('\n');
  const end = lines.map((l) => l.trim()).lastIndexOf('prompt>');
  if (end < 0) continue;
  const listing = lines.slice(end + 1).join('\n');
  let code = stripLineNumbers(listing);
  // a listing cut by a page break: too few numbered lines before the break to be recognised above
  if (code === listing) code = lines.slice(end + 1).map((l, n) => l.replace(new RegExp(`^\\s*${n + 1}\\s+`), '')).join('\n');
  b.code = dedent(code);
  const output = { t: 'code', text: dedent(lines.slice(0, end + 1).join('\n')), page: b.page };
  let j = i - 1;
  while (j > 0 && blocks[j].t === 'note') j--;
  // output no sentence has led up to belongs after the paragraph that explains the listing, as in the English
  const introduced = /[:：]$/.test((blocks[j].runs ?? []).map((r) => r.t).join('').trim());
  if (introduced) blocks.splice(i++, 0, output);
  else blocks.splice(blocks[i + 1]?.t === 'p' ? i + 2 : i + 1, 0, output);
}

// figure crops (rendered in child-process-safe way: here directly, guarded)
// hand corrections for built-up fractions and equations (see fixes.mjs)
for (const miss of applyFixes(blocks, lang, chap)) console.log(`fix not applied in ${lang} ${chap}: ${miss}`);
const result = { lang, chapter: chap, title: title.trim(), blocks, cropJobs: cropJobs.map((j) => ({ ...j })) };
fs.writeFileSync(path.join(outDir, `${String(chap).padStart(2, '0')}.json`), JSON.stringify(result, null, 1));
console.log(`${lang} ${chap} "${result.title}" blocks=${blocks.length} crops=${cropJobs.length}`);

async function saveImage(page, name, out) {
  const img = await new Promise((r) => page.objs.get(name, r));
  const c = createCanvas(img.width, img.height); const ctx = c.getContext('2d');
  const id = ctx.createImageData(img.width, img.height);
  const d = img.data, n = img.width * img.height;
  if (img.kind === 3) id.data.set(d);
  else if (img.kind === 2) for (let j = 0; j < n; j++) { id.data[j * 4] = d[j * 3]; id.data[j * 4 + 1] = d[j * 3 + 1]; id.data[j * 4 + 2] = d[j * 3 + 2]; id.data[j * 4 + 3] = 255; }
  else if (img.kind === 1) { const rb = (img.width + 7) >> 3; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const bit = (d[y * rb + (x >> 3)] >> (7 - (x & 7))) & 1; const o = (y * img.width + x) * 4; id.data[o] = id.data[o + 1] = id.data[o + 2] = bit ? 255 : 0; id.data[o + 3] = 255; } }
  ctx.putImageData(id, 0, 0);
  // downscale big images
  const maxW = 1100;
  if (img.width > maxW) {
    const sc = maxW / img.width; const c2 = createCanvas(maxW, Math.round(img.height * sc)); const x2 = c2.getContext('2d');
    x2.drawImage(c, 0, 0, c2.width, c2.height); fs.writeFileSync(out, c2.toBuffer('image/png'));
  } else fs.writeFileSync(out, c.toBuffer('image/png'));
}
