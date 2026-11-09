<script setup lang="ts">
import { computed } from 'vue'
import type { Block, Lang, Run } from '@/lib/types'
import RunsText from './RunsText.vue'
import { smallCapsTitle } from '@/lib/text'
import CodeBlock from './CodeBlock.vue'
import FigureView from './FigureView.vue'

defineOptions({ name: 'BlockView' })
const props = defineProps<{ block: Block; lang: Lang; dialogue?: boolean }>()

const ASIDE_LABEL: Record<string, { en: string; zh: string }> = {
  crux: { en: 'The crux', zh: '关键问题' },
  tip: { en: 'Tip', zh: '提示' },
  aside: { en: 'Aside', zh: '补充' },
  ds: { en: 'Data structure', zh: '数据结构' },
}

/** Split "TIP: USE TIME SHARING" into a label and a title in sentence case. */
const asideTitle = computed(() => {
  const b = props.block
  if (b.t !== 'aside') return ''
  let t = b.title.replace(/^(THE CRUX( OF THE PROBLEM)?|CRUX|DESIGN TIP|TIP|ASIDE|DATA STRUCTURE)\s*[:：—-]*\s*/i, '')
  t = t.replace(/^(关键问题|提示|补充|数据结构)\s*[：:—-]*\s*/, '')
  return props.lang === 'en' ? smallCapsTitle(t) : t
})

/** In English cruxes the question itself is a small-caps line: promote it to the title. */
const cruxQuestion = computed(() => {
  const b = props.block
  if (b.t !== 'aside' || props.lang !== 'en') return null
  const first = b.blocks[0]
  if (!first || first.t !== 'p') return null
  const text = first.runs.map((r) => r.t).join('')
  return /[a-z]/.test(text) || text.length > 140 ? null : smallCapsTitle(text)
})
const asideBody = computed(() => (props.block.t === 'aside' ? (cruxQuestion.value ? props.block.blocks.slice(1) : props.block.blocks) : []))

const speakerRe = /^\s*(Professor|Student|教授|学生)\s*[:：]\s*/
const speaker = computed(() => {
  const b = props.block
  if (!props.dialogue || b.t !== 'p' || !b.runs.length) return null
  const m = b.runs.map((r) => r.t).join('').match(speakerRe)
  if (!m) return null
  return /Professor|教授/.test(m[1]) ? 'prof' : 'student'
})
const dialogueRuns = computed<Run[]>(() => {
  const b = props.block
  if (b.t !== 'p') return []
  const runs = b.runs.map((r) => ({ ...r }))
  // strip the speaker label (may span the first one or two runs)
  let removed = false
  for (const r of runs) {
    if (removed) break
    const m = r.t.match(speakerRe)
    if (m) {
      r.t = r.t.slice(m[0].length)
      removed = true
    } else if (/^\s*(Professor|Student|教授|学生)\s*$/.test(r.t)) r.t = ''
    else if (/^\s*[:：]\s*/.test(r.t)) {
      r.t = r.t.replace(/^\s*[:：]\s*/, '')
      removed = true
    }
  }
  return runs.filter((r) => r.t)
})
const speakerName = computed(() =>
  speaker.value === 'prof' ? (props.lang === 'zh' ? '教授' : 'Professor') : props.lang === 'zh' ? '学生' : 'Student',
)
</script>

<template>
  <h2 v-if="block.t === 'h' && block.level === 2" class="b-h2" :lang="lang">
    <span v-if="block.num" class="secnum">{{ block.num }}</span>
    <span><RunsText v-if="block.runs?.length" :runs="block.runs" /><template v-else>{{ block.text }}</template></span>
  </h2>
  <h3 v-else-if="block.t === 'h'" class="b-h3" :lang="lang">{{ block.text }}</h3>

  <div v-else-if="block.t === 'p' && speaker" class="b-dialogue" :class="speaker" :lang="lang">
    <span class="who">{{ speakerName }}</span>
    <p><RunsText :runs="dialogueRuns" /></p>
  </div>
  <p v-else-if="block.t === 'p'" class="b-p" :class="{ cont: dialogue }" :lang="lang"><RunsText :runs="block.runs" /></p>

  <div v-else-if="block.t === 'li'" class="b-li" :lang="lang">
    <span class="marker">{{ block.marker === '•' ? '•' : block.marker + '.' }}</span>
    <div><RunsText :runs="block.runs" /></div>
  </div>

  <p v-else-if="block.t === 'note'" class="b-note" :lang="lang"><RunsText :runs="block.runs" /></p>
  <p v-else-if="block.t === 'ref'" class="b-ref" :lang="lang"><RunsText :runs="block.runs" /></p>

  <CodeBlock v-else-if="block.t === 'code'" class="b-code" :code="block.text" />

  <FigureView v-else-if="block.t === 'fig'" class="b-fig" :fig="block" :lang="lang" />

  <aside v-else-if="block.t === 'aside'" class="b-aside" :class="'k-' + block.kind" :lang="lang">
    <div class="aside-head">
      <span class="aside-label">{{ ASIDE_LABEL[block.kind][lang] }}</span>
      <span v-if="asideTitle" class="aside-title">{{ asideTitle }}</span>
      <span v-if="cruxQuestion" class="aside-title question">{{ cruxQuestion }}</span>
    </div>
    <BlockView v-for="(child, i) in asideBody" :key="i" :block="child" :lang="lang" />
  </aside>
</template>

<style scoped>
.b-p,
.b-li,
.b-note,
.b-ref {
  margin: 0;
  /* references carry long URLs; never let one widen the page */
  overflow-wrap: anywhere;
}
.b-p {
  font-size: var(--body-size, 1.075rem);
  line-height: var(--body-lh, 1.72);
  hyphens: auto;
}
.b-p:lang(zh),
.b-li:lang(zh),
.b-dialogue:lang(zh) p {
  font-family: var(--font-zh);
  font-size: var(--body-size-zh, 1.02rem);
  line-height: 1.9;
  text-align: justify;
  letter-spacing: 0.01em;
}
.b-p:lang(en),
.b-li:lang(en),
.b-dialogue:lang(en) p,
.b-note:lang(en),
.b-ref:lang(en) {
  font-family: var(--font-serif);
}
.b-p :deep(strong),
.b-li :deep(strong),
.b-dialogue :deep(strong) {
  font-weight: 600;
  color: var(--ink);
}
:deep(code.inline) {
  font-size: 0.86em;
  padding: 0.05em 0.3em;
  background: var(--code-bg);
  border-radius: 3px;
  border: 1px solid var(--rule);
  overflow-wrap: anywhere;
}
.b-h2 {
  display: flex;
  gap: 14px;
  align-items: baseline;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.b-h2:lang(zh) {
  font-family: var(--font-zh);
}
.secnum {
  font-family: var(--font-mono);
  font-size: 0.8em;
  font-weight: 500;
  color: var(--accent-ink);
  min-width: 2.4em;
}
.b-h3 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1.08rem;
  font-weight: 600;
  color: var(--ink);
}
.b-li {
  display: grid;
  grid-template-columns: 1.6em minmax(0, 1fr);
  font-size: var(--body-size, 1.075rem);
  line-height: 1.68;
}
.b-li .marker {
  color: var(--accent-ink);
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding-top: 0.15em;
}
.b-note {
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--muted);
  padding-left: 12px;
  border-left: 2px solid var(--rule);
}
.b-note:lang(zh) {
  font-family: var(--font-zh);
}
.b-ref {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--ink-2);
  padding-left: 1.5em;
  text-indent: -1.5em;
}
.b-ref :deep(strong) {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 0.92em;
  color: var(--accent-ink);
}
.b-ref :deep(em) {
  color: var(--muted);
}

/* asides: the book's grey boxes, re-imagined */
.b-aside {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  /* stretched to its counterpart's height in parallel view: keep the content at the top */
  align-content: start;
  padding: 16px 18px 18px;
  border-radius: var(--radius);
  background: var(--bg-elev);
  border: 1px solid var(--rule);
  --body-size: 0.98rem;
  --body-size-zh: 0.95rem;
}
.b-aside :deep(.b-p) {
  line-height: 1.66;
}
.aside-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.aside-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.aside-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1rem;
  text-transform: none;
}
.b-aside:lang(en) .aside-title {
  font-family: var(--font-serif);
  font-variant: small-caps;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-size: 1.06rem;
}
.aside-title:lang(zh) {
  font-family: var(--font-zh);
}
.k-crux {
  border: 1.5px solid var(--ink);
  background: transparent;
}
.k-crux .aside-label {
  color: var(--ink);
}
.k-crux .aside-title {
  font-size: 1.08rem;
}
.k-tip {
  border-left: 3px solid var(--accent);
}
.k-tip .aside-label {
  color: var(--accent-ink);
}
.k-ds {
  background: var(--bg-sunk);
}

/* dialogue chapters */
.b-dialogue {
  display: grid;
  grid-template-columns: 5.2rem 1fr;
  gap: 12px;
  align-items: baseline;
}
.b-dialogue p {
  margin: 0;
  font-size: var(--body-size, 1.075rem);
  line-height: 1.72;
}
.who {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: right;
  color: var(--muted);
  padding-top: 0.3em;
}
.b-dialogue.prof .who {
  color: var(--accent-ink);
}
.b-p.cont {
  padding-left: calc(5.2rem + 12px);
}
@media (max-width: 640px) {
  .b-dialogue {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .who {
    text-align: left;
  }
  .b-p.cont {
    padding-left: 0;
  }
}
</style>
