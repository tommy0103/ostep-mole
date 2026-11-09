<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { NoteExtra } from '@/content/extras/types'
import { mode, t, UI, uiLang } from '@/lib/i18n'
import { inlineRuns } from '@/lib/md'
import { articleText, type Article } from '@/lib/article'
import { readingUnits } from '@/lib/text'
import { findChapter, pad2 } from '@/content/book'
import { hasArticle, loadArticle } from '@/content/articles'
import RunsText from '../reader/RunsText.vue'
import TermHost from '../terms/TermHost.vue'
import ArticleBody from '../article/ArticleBody.vue'

const props = defineProps<{ note: NoteExtra }>()
const langs = computed(() => (mode.value === 'both' ? (['en', 'zh'] as const) : ([mode.value] as const)))
const links = computed(() => (props.note.links ?? []).map((s) => findChapter(s)).filter((x) => x !== null))

// The card is the fold of a longer piece: the summary stays, the full article unrolls beneath it.
const full = computed(() => hasArticle(props.note.id))
const open = ref(false)
const seen = ref(false)
const root = ref<HTMLElement | null>(null)
const meta = shallowRef<Article | null>(null)
watch(
  [full, uiLang],
  async () => {
    if (full.value) meta.value = await loadArticle(props.note.id, uiLang.value)
  },
  { immediate: true },
)
const minutes = computed(() => {
  if (!meta.value) return 0
  const u = readingUnits(articleText(meta.value.blocks))
  return Math.max(1, Math.round(u.words / 230 + u.cjk / 400))
})
async function toggle() {
  seen.value = true
  open.value = !open.value
  // folding a long piece back up: keep the card in view instead of leaving the reader far below it
  if (!open.value) {
    await nextTick()
    const top = root.value?.getBoundingClientRect().top ?? 0
    if (top < 0) root.value?.scrollIntoView({ block: 'start' })
  }
}
</script>

<template>
  <section ref="root" class="note" :class="['k-' + note.kind, { both: mode === 'both', open }]" :aria-label="t(note.title)">
    <header>
      <span class="label">
        <svg v-if="note.kind === 'note'" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path d="M2 8h12M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" fill="none" stroke="currentColor" stroke-width="1.1" />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="3.5" cy="4" r="2" fill="currentColor" />
          <circle cx="12.5" cy="4" r="2" fill="currentColor" />
          <circle cx="8" cy="12.5" r="2" fill="currentColor" />
          <path d="M3.5 4L8 12.5L12.5 4" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
        {{ note.kind === 'note' ? t(UI.fieldNote) : t(UI.thread) }}
      </span>
      <span v-if="note.tags?.length" class="tags">
        <span v-for="tag in note.tags" :key="tag" class="tag">{{ tag }}</span>
      </span>
    </header>
    <div class="cols">
      <div v-for="l in langs" :key="l" class="col" :lang="l">
        <h4>{{ note.title[l] }}</h4>
        <TermHost :lang="l"><p v-for="(para, i) in note.body" :key="i"><RunsText :runs="inlineRuns(para[l])" /></p></TermHost>
      </div>
    </div>
    <div v-if="full" class="more">
      <button class="unfold" :aria-expanded="open" @click="toggle">
        <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
        <span v-if="!open">{{ uiLang === 'zh' ? '展开全文' : 'Read the full story' }}</span>
        <span v-else>{{ uiLang === 'zh' ? '收起全文' : 'Fold it back' }}</span>
        <span v-if="minutes && !open" class="mono min">{{ uiLang === 'zh' ? `约 ${minutes} 分钟` : `${minutes} min` }}</span>
      </button>
      <span v-if="meta?.deck && !open" class="deck">{{ meta.deck }}</span>
      <RouterLink class="page mono" :to="`/notes/${note.id}`">{{ uiLang === 'zh' ? '单独阅读' : 'own page' }} ↗</RouterLink>
    </div>
    <div v-if="full" class="article-wrap">
      <div class="article-inner">
        <div v-if="seen" class="article">
          <ArticleBody :id="note.id" />
          <button class="unfold end" @click="toggle">↑ {{ uiLang === 'zh' ? '收起全文' : 'Fold it back' }}</button>
        </div>
      </div>
    </div>
    <footer v-if="links.length">
      <RouterLink v-for="ln in links" :key="ln!.chapter.slug" :to="`/${ln!.part.id}/${ln!.chapter.slug}`" class="link">
        <span class="mono">{{ pad2(ln!.chapter.num) }}</span> {{ t(ln!.chapter.title) }}
      </RouterLink>
    </footer>
  </section>
</template>

<style scoped>
.note {
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-elev);
  padding: 14px 18px 16px;
  display: grid;
  gap: 8px;
}
.k-thread {
  background: linear-gradient(180deg, var(--accent-soft), var(--bg-elev) 70%);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-ink);
}
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 99px;
  border: 1px solid var(--rule-strong);
  color: var(--muted);
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
}
.both .cols {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 900px) {
  .both .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
}
h4 {
  margin: 0 0 6px;
  font-size: 1.02rem;
  font-weight: 600;
}
p {
  margin: 0 0 8px;
  font-size: 0.95rem;
  line-height: 1.68;
  color: var(--ink-2);
}
.col:lang(zh) p,
.col:lang(zh) h4 {
  font-family: var(--font-zh);
}
p :deep(code) {
  font-size: 0.86em;
  padding: 0 0.25em;
  background: var(--code-bg);
  border-radius: 3px;
}
.more {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding-top: 8px;
  border-top: 1px dashed var(--rule);
}
.unfold {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border: 1px solid var(--accent);
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.unfold svg {
  transition: transform 0.2s var(--ease);
}
.open .unfold svg {
  transform: rotate(90deg);
}
.unfold .min {
  font-size: 11px;
  opacity: 0.8;
}
.deck {
  flex: 1 1 16rem;
  min-width: 0;
  font-size: 13px;
  color: var(--muted);
}
.page {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--muted);
  text-decoration: none;
}
.page:hover {
  color: var(--accent-ink);
}
/* the article unrolls in place */
.article-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s var(--ease);
}
.open .article-wrap {
  grid-template-rows: 1fr;
}
.article-inner {
  overflow: hidden;
  min-width: 0;
}
.article {
  display: grid;
  gap: 1.2rem;
  padding: 18px 2px 6px;
  border-top: 1px solid var(--rule);
}
.unfold.end {
  justify-self: start;
}
footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
  border-top: 1px dashed var(--rule);
}
.link {
  font-size: 12.5px;
  text-decoration: none;
  color: var(--ink-2);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-sunk);
}
.link:hover {
  color: var(--accent-ink);
}
.link .mono {
  color: var(--accent-ink);
  font-size: 11px;
}
</style>
