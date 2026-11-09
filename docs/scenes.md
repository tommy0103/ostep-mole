# Writing a scene

A **scene** is a field-note article's running figure: one drawing of the system the article is about,
kept in view while the article is read, that changes as the reader moves through it. It answers the
reader's constant background question, *where in the system are we now, and what is happening there?*,
without the reader leaving the text.

- On a wide page it stands to the right of the text (or floats over the page, draggable, where there is
  no room). The passage being read sets the drawing's **state**; a caption under it says what the
  drawing now shows.
- A term the reader clicks in the text (`[[id|words]]`, see docs/articles.md) **lights up** its part of
  the drawing, and its glossary entry appears under it. Terms inside that entry lead further.
- On a phone the drawing is set into the text where each state begins, cut to the rows that state is
  about (its **band**); a clicked term's card shows the term's rows of the drawing, lit.
- A state may carry a **demo**: a mechanism shown step by step, which the reader starts.

The reference is the browser-process article: `src/content/scenes/chrome-processes.ts`,
`src/components/scenes/chrome-processes/` and the `::scene` lines in
`src/content/articles/chrome-processes.{en,zh}.md`. Read all of them before you start.

## Files for an article `<id>`

| File | What it holds |
|---|---|
| `src/content/scenes/<id>.ts` | default export `SceneDef`: `height`, `states`, `bands`, `parts`, `terms` (types in `src/content/scenes/index.ts`) |
| `src/components/scenes/<id>/Scene.vue` | the drawing; picked up automatically by its folder name |
| `src/components/scenes/<id>/*Demo.vue` | a demo's drawing, if the scene has demos |
| `src/content/articles/<id>.{en,zh}.md` | `::scene <state>` lines and `[[term|…]]` marks, nothing else changed |
| `src/content/glossary/<id>.ts` | default export of the glossary entries this article adds (see below) |

Do not edit shared code (`src/components/scenes/drawing.*`, `ScenePanel.vue`, `SceneInline.vue`,
`src/lib/*`, the index files, tests) or another article's files. If you need a change there, finish
what you can and say what you need in your report.

## States

- **8 to 14 states**, in the order the article reaches them. A state is a moment where the picture
  should be different, usually a section or a turn in the argument, not every paragraph. The first is
  the overview.
- Put `::scene <state>` on its own line, with blank lines around it, **right before the block where that
  passage begins**: the paragraph, heading or fold. It may go inside a fold. A state can be returned to
  later (`::scene overview` again near the end is common).
- Both languages get **the same `::scene` lines at the same places**: the block skeleton must match,
  and `scene:<state>` is part of it. Every state defined in the scene file must be used, and every
  state used must be defined. `tests/articles.test.ts` checks all of this.
- `title`: short (at most about 12 Chinese characters, 5 English words). `caption`: one to three
  sentences saying what the drawing shows *now* and why it matters at this point. Write the Chinese as
  Chinese. Captions must not claim anything the article does not; numbers must match the article.

## The drawing

```vue
<script setup lang="ts">
import { useDrawing, type DrawingProps } from '../drawing'
const props = defineProps<DrawingProps>()
const SHOW: Record<string, string[]> = { overview: ['cpu', 'queue'], … }   // state → parts on view
const { shown, part, L, viewBox, still } = useDrawing(props, SHOW, 400)    // 400 = height
</script>
<template>
  <svg class="scene-drawing" :viewBox="viewBox" role="img" :aria-label="L('…', '…')">
    <g :class="part('cpu')"> … </g>
  </svg>
</template>
```

- **One coherent picture of one system**, 360 units wide and 340 to 460 tall, that every state shows a
  view of. Not a collage of unrelated diagrams: states reveal, hide, light up and change things in the
  same layout, so the reader keeps their bearings. Things move position only when moving *is* the point
  (a page being evicted, a task migrating).
- Every part the article talks about is a `<g :class="part('id')">`. `SHOW[state]` lists the parts on
  view; a part fades in and out on its own. Inside a part, use `shown.has('x')` for finer changes.
- Use the shared vocabulary in `src/components/scenes/drawing.css` (`box`, `box strong`, `box floor`
  for the kernel and hardware, `box gate`, `outline`, `link`, `link solid`, `call`, `danger`, `dot`,
  `lbl`, `sub`, `tag`, `code`, `c` for centred text, `p0`…`p4` fills, and so on). Colours come from
  the theme tokens only, so dark mode works. Process A is `p0`, process B `p1`, as in every lab.
  Add a scoped style only for what the vocabulary lacks.
- **Words**: every label through `L('English', '中文')`. Keep labels short: a Chinese character is about
  as wide as the font size, and nothing may run past its box or the edge of the drawing. Text sizes as
  in the vocabulary (no smaller than 8.5). No emoji; draw icons in SVG.
- `<marker>` and other ids in `<defs>` must start with a prefix unique to the article (`cp-arrow` in the
  reference), because several drawings can be on one page.
- **Motion is quiet**. A figure beside the text that keeps moving pulls the eye away from the text. Use
  `<animateMotion>` only for something that genuinely flows (calls, messages, packets), at most one or
  two such flows in any state, and only `v-if="!still"`. Prefer changes between states.
- Simplified is fine (say so in a caption where it matters); wrong is not. The drawing must agree with
  the article.

## Bands, parts and terms

- `height`: the drawing's height (the `useDrawing` argument).
- `bands[state]`: `[top, bottom]`, the rows of the drawing that state is about, for the phone. Tight
  around what matters, so a phone shows a short figure; the whole height only when the state is about
  everything.
- `parts[id]`: `[top, bottom]` rows of each part a term can light up.
- `terms[termId]`: the parts a glossary term lights up. Map every marked term that has a place in the
  drawing; a term without one is explained in words only, which is fine.

## Terms in the article

Follow *Terms the reader may not know* in docs/articles.md: mark a term the first time it appears in
the main text (and in a fold if it appears there first), whatever the book has not taught by that
chapter and everything from outside the book, including opaque names even when the sentence says what
the thing does. Expect 15 to 30 marks in an article. Both languages mark the same terms.

- **Reuse** an existing entry when there is one: `grep -rn "^  '\?<id>'\?:" src/content/glossary/`.
  Read it first: its wording must fit your use.
- Otherwise add it to `src/content/glossary/<id>.ts` (copy the shape of `core.ts`): `title` and
  `body` in both languages, one to three sentences, accurate (check what you are not sure of), plus
  `chapter` (where the book explains it, a slug from `src/content/book.ts`) and `note` (a field note
  that goes deeper) when they exist. A body may mark other terms; they must exist.
- Other writers are adding entries at the same time. If the duplicate check fails because another
  article's file defines your id, do not edit their file: use theirs and drop yours.

## Demos (optional, at most two per article)

For a mechanism the article explains in steps, where a reader would ask *how exactly?* (the reference
has one for Spectre's cache timing and one for CORB). 4 to 8 steps.

- Add `demo: { label, steps }` to the state (`steps`: bilingual text per step).
- Draw it as its own component (`<Name>Demo.vue`, taking `step` and `lang`) and switch to it in
  `Scene.vue`: `<FooDemo v-if="demo && state === 'foo'" :step="step ?? 0" :lang="lang" />`, then
  `<svg v-else …>`. Give its root `<svg>` the class `scene-drawing` too.
- Lessons from the reference: introduce every element before it is used and say why it exists; name a
  thing the same way in the text and in the drawing; each step's text describes what changes in the
  drawing at that step; keep labels from colliding at every step.

## Check your work

```bash
npx vitest run tests/articles.test.ts   # skeletons, states, terms, glossary
npm run typecheck
node --experimental-strip-types tools/content/check-articles.mjs <id>
```

Then **look at the scene in a browser** at every state, in both languages, on a phone width, and through
every demo step, and fix what is wrong: labels that overlap or run out of their box, parts that are on
view in a state that is not about them, a band that cuts off what the state is about, a caption that
does not match the drawing.
