# OSTEP · Interactive Bilingual Edition

A web edition of *Operating Systems: Three Easy Pieces* (Remzi & Andrea Arpaci-Dusseau) that puts the
English original and the official Chinese translation side by side, adds interactive labs that re-run
the book's examples, and links each chapter to systems you use today.

Part I (Virtualization, chapters 3–24) is done. Parts II and III have placeholders and their own accent
colours in `src/styles/tokens.css`.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: simulators, alignment, components
npm run build        # type-check + production build to dist/
```

The default build uses history-mode routing, so a static host needs to fall back to `index.html`
for unknown paths. The GitHub Pages build uses hash routing so chapter links also work on refresh.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` tests, builds and deploys pushes to `main`.
In the repository's **Settings → Pages**, set **Source** to **GitHub Actions** before the first run.
The build reads the base path from Pages, so assets work under a repository path or custom domain.
No personal access token or repository secret is needed by the workflow.

For `tommy0103/ostep-mole`, the site URL is `https://tommy0103.github.io/ostep-mole/`.
A chapter URL looks like `/ostep-mole/#/virtualization/cpu-intro`.

To build and preview the Pages version locally:

```bash
npm run build -- --mode pages --base /ostep-mole/
npm run preview -- --base /ostep-mole/
# Open http://localhost:4173/ostep-mole/
```


## How it is built

| Path | What lives there |
| --- | --- |
| `tools/content/` | The PDF → JSON pipeline (pdf.js layout analysis). |
| `src/content/generated/{en,zh}/NN.json` | Extracted chapters (committed, so the site builds offline). |
| `public/figs/{en,zh}/` | Figures: vector figures cropped from the English PDFs, raster figures from the Chinese ones. |
| `src/content/book.ts` | Chapter registry: titles in both languages, kinds, one-line hooks. |
| `src/content/extras/` | Our own additions per chapter: labs, field notes, threads (always bilingual). |
| `src/content/articles/` | The long-form article behind each field note, one file per language. |
| `src/content/threads.ts` | The cross-chapter "big ideas" behind `/threads`. |
| `src/lib/align.ts` | Paragraph alignment between the two languages (see below). |
| `src/lib/sim/` | Pure-TypeScript simulators behind the labs, tested against numbers from the book. |
| `src/components/labs/` | One component per lab, all sharing `LabFrame` + `usePlayer`. |

### Regenerating content

```bash
npm run content:fetch   # downloads the PDFs into .cache/pdf (gitignored)
npm run content:build   # re-extracts every chapter of the part
node tools/content/build.mjs virtualization 9 15   # or just some chapters
```

To add Part II, add its chapter slugs to `tools/content/parts.mjs` and `src/content/book.ts`, run both
commands with the part name, then add extras in `src/content/extras/`.

### Fonts

All fonts are served from `public/fonts`; nothing loads from Google Fonts, which is unreachable from
mainland China. Chinese text is set in [975 Hei](https://github.com/lxgw/975Hei) (LXGW 975 黑体, OFL):
the complete font as WOFF2, about 4.8 MB per weight (regular and bold). English uses IBM Plex Sans /
Mono and Source Serif 4, copied from Google Fonts' latin slices. Licences are in
`public/fonts/licenses/`. `npm run fonts:build` regenerates all of it.

### Field-note articles, scenes and terms

Each field note has a long article (`src/content/articles/`, guide in `docs/articles.md`). An article also has
a **scene**: one drawing of the system it is about, which changes as the reader moves through the text
(`::scene` lines). Its definition is `src/content/scenes/<id>.ts` and its drawing
`src/components/scenes/<id>/Scene.vue`; both are found by name (guide in `docs/scenes.md`). The scene stands
to the right of the text where there is room, floats over the page (draggable, foldable) where there is
not, and is set into the text on a phone.

Terms a newcomer may not know are marked `[[id|words]]` and defined in `src/content/glossary/`, one file per
article, merged by `index.ts`. A clicked term lights up its part of the scene and is explained under it; on a
phone it opens a card below its paragraph.

### Bilingual alignment

The Chinese text translates an older edition, so paragraphs are sometimes added, dropped, split or
merged. `alignBlocks` runs a Gale–Church-style dynamic program over the two block sequences, scoring a
pair by structural anchors (section numbers, figure numbers, citation keys), latin tokens the translation
keeps verbatim (terms in parentheses, identifiers, numbers) and a length-ratio prior. It allows 1–1, 1–0,
0–1 and up to 4–1 / 1–4 merges of paragraphs and list items.

Figures, asides and footnotes are aligned separately as "floats". The English typesetting moves figures
to the top of a page, while the Chinese one keeps them after the paragraph that cites them, so their
order is no guide. For each kind, every English/Chinese candidate pair gets a score, and a one-to-one
assignment maximises the total (the Hungarian algorithm). The score combines:
- how close the two sit in the aligned text, measured from the row before and the row after;
- the share of the Chinese block's latin terms found in the English one;
- the kind (crux / tip / aside; table / code / image);
- for figures, the number and above all the aligned paragraph that cites them.

The number alone would mislead. Some Chinese chapters (4, 6, 9, 15, 16, 19, 20, 22) number tables apart
as 表, so 图 4.3 is Figure 4.5; numbers are ignored there. Chapter 8 splits Figure 8.3 in two, so every
later number shifts by one. A continued table (续表) joins its first part. Each float is then placed after
the paragraph that cites it (figures) or the paragraph it follows in the source. A heading found only in
English next to one found only in Chinese is the same heading, promoted or demoted (ch. 23).

Some passages exist in one edition only. Most are sections added after the translation was made: Linux
CFS in ch. 9, §5.5–5.6 and most homework. `groupSolo` in `src/lib/flow.ts` groups them and `SoloRun.vue`
renders them. Parallel view shows one marker per run. Single-language view shows a collapsed "not in
the translation" bar, so nothing is hidden silently.

### Field-note articles

Each field-note card is the fold of a longer piece. "Read the full story" unrolls the article inside the
card, and `/notes/<id>` shows it on its own page. Articles live in `src/content/articles/<id>.{en,zh}.md`.
They use a small Markdown dialect, parsed by `src/lib/article.ts`, with `:::fold` blocks for deeper
material and `::lab Name` to embed a lab. The two languages share one block skeleton so that parallel
view can pair them. `docs/articles.md` is the writing guide covering format, accuracy rules and the
terminology table. Check an article with:

```bash
node --experimental-strip-types tools/content/check-articles.mjs <id>
```

### Adding a lab or note

Add an entry to `src/content/extras/virtualization.ts`. Its `at` field places it using identifiers that
both languages share: `intro`, `head:7.3`, `sec:7.3` (end of section), `fig:7.2` or `end`. New lab
components are registered in `src/components/labs/registry.ts`.

## Known limitations

- Extraction is automatic. A few displayed equations come out flattened (e.g. the CFS weight formula
  in §9.7). Where the Chinese PDF's text layer has lost a superscript (`218` for 2¹⁸), it stays lost.
- English chapter 10 draws its queue diagrams as more, smaller pictures than the Chinese edition does,
  so a few of those pictures stay unpaired.
- The Chinese edition's chapter 23 is the older "VAX/VMS" chapter, so only part of it pairs with
  the English "Complete Virtual Memory Systems".

## Rights

The book text is © its authors and free to read at <https://pages.cs.wisc.edu/~remzi/OSTEP/>.
The Chinese translation 《操作系统导论》 is © its publisher (人民邮电出版社), indexed by
<https://github.com/iTanken/ostep-chinese>. Treat this site as a personal study companion, and check
the rights holders' terms before hosting it publicly.
