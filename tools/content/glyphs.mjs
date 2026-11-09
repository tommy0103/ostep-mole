// Glyph outlines of CJK characters, shared by glyphdict.mjs (learning) and extract.mjs (repair).
import crypto from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Every CJK glyph a page draws, in content-stream order: font (loadedName), family, outline hash, claimed char. */
export async function pageGlyphs(page) {
  const ol = await page.getOperatorList();
  const out = [];
  let font = null;
  for (let k = 0; k < ol.fnArray.length; k++) {
    if (ol.fnArray[k] === pdfjs.OPS.setFont) font = page.commonObjs.get(ol.argsArray[k][0]);
    if (ol.fnArray[k] !== pdfjs.OPS.showText || !font) continue;
    const fam = font.name.replace(/^.*\+/, '');
    for (const g of ol.argsArray[k][0]) {
      if (!g || !g.unicode || /^\s$/.test(g.unicode)) continue;
      const key = `${font.loadedName}_path_${g.fontChar}`;
      const cjk = /[㐀-鿿]/.test(g.unicode) && page.commonObjs.has(key);
      const h = cjk ? crypto.createHash('sha1').update(String(page.commonObjs.get(key))).digest('hex').slice(0, 16) : null;
      out.push({ font: font.loadedName, fam, h, u: g.unicode });
    }
  }
  return out;
}

/**
 * Fonts with a broken ToUnicode map: somewhere in the document one character stands for two or
 * more different outlines (chapter 5 maps 们/不/谁 → 我, chapter 14 maps 事 → 实 and 节 → 我).
 */
export async function brokenFonts(doc) {
  const outlines = {}; // font -> char -> outlines
  for (let p = 1; p <= doc.numPages; p++) {
    for (const g of await pageGlyphs(await doc.getPage(p))) if (g.h) ((outlines[g.font] ??= {})[g.u] ??= new Set()).add(g.h);
  }
  return new Set(Object.keys(outlines).filter((f) => Object.values(outlines[f]).some((set) => set.size >= 2)));
}
