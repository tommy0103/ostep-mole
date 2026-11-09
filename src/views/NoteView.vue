<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import { allNotes, findNote } from '@/content/extras/notes'
import { hasArticle } from '@/content/articles'
import { findChapter, pad2 } from '@/content/book'
import { articleText, plain, type Article } from '@/lib/article'
import { inlineRuns } from '@/lib/md'
import { mode, t, uiLang, UI } from '@/lib/i18n'
import type { Lang } from '@/lib/types'
import { readingUnits } from '@/lib/text'
import ArticleBody from '@/components/article/ArticleBody.vue'
import RunsText from '@/components/reader/RunsText.vue'
import TermHost from '@/components/terms/TermHost.vue'
import ScenePanel from '@/components/scenes/ScenePanel.vue'
import { findScene } from '@/content/scenes'
import { SCENE_LAYER, trackScene, useScene, type SceneShape } from '@/lib/scene'

/** A field note's full article on its own page: summary on top, the piece, then where it connects. */
const props = defineProps<{ id: string }>()
const entry = computed(() => findNote(props.id))
const home = computed(() => (entry.value ? findChapter(entry.value.slug) : null))
const related = computed(() => (entry.value?.note.links ?? []).map(findChapter).filter((x) => x !== null))
const list = computed(() => allNotes().filter((n) => hasArticle(n.note.id)))
const at = computed(() => list.value.findIndex((n) => n.note.id === props.id))
const prev = computed(() => list.value[at.value - 1] ?? null)
const next = computed(() => list.value[at.value + 1] ?? null)

const en = shallowRef<Article | null>(null)
const zh = shallowRef<Article | null>(null)
const onLoaded = (e: Article, z: Article) => {
  en.value = e
  zh.value = z
}
const current = computed(() => (mode.value === 'zh' ? zh.value : en.value))
const outline = computed(() => (current.value?.blocks ?? []).flatMap((b) => (b.t === 'h' && b.level === 2 ? [{ id: b.id, text: plain(b.runs) }] : [])))
const minutes = computed(() => {
  if (!current.value) return 0
  const u = readingUnits(articleText(current.value.blocks))
  return Math.max(1, Math.round(u.words / 230 + u.cjk / 400))
})
const langs = computed(() => (mode.value === 'both' ? (['en', 'zh'] as const) : ([mode.value] as const)))

// An article with a scene keeps its running figure to the right of the text where there is room for
// a column: from 1180px in one language, from 1560px in parallel view (not between the languages,
// where it would sit in the way of every glance from one to the other). Without that room it floats
// over the page; on a phone it is drawn into the text (src/lib/scene.ts). Its words come in both languages in parallel view, unless
// the screen is a phone's.
const scene = computed(() => findScene(props.id))
function useWidth(query: string) {
  const q = typeof window !== 'undefined' ? window.matchMedia(query) : null
  const matches = ref(q?.matches ?? false)
  const on = (e: MediaQueryListEvent) => (matches.value = e.matches)
  onMounted(() => q?.addEventListener('change', on))
  onBeforeUnmount(() => q?.removeEventListener('change', on))
  return matches
}
const wide = useWidth('(min-width: 1180px)')
const roomy = useWidth('(min-width: 1560px)')
const phone = useWidth('(max-width: 900px)')
const sceneShape = computed<SceneShape | null>(() => {
  if (!scene.value) return null
  if (phone.value) return 'inline'
  return (mode.value === 'both' ? roomy.value : wide.value) ? 'side' : 'float'
})
const staging = computed(() => sceneShape.value === 'side')
const sceneLang = computed(() => (mode.value === 'both' ? uiLang.value : mode.value))
const sceneLangs = computed(() => (mode.value === 'both' && !phone.value ? (['en', 'zh'] as Lang[]) : [sceneLang.value]))
const layer = useScene({ shape: sceneShape, spec: scene, lang: sceneLang, langs: sceneLangs })
provide(SCENE_LAYER, layer)
trackScene(layer)
watch([() => props.id, sceneShape], () => (layer.trail.value = []))
</script>

<template>
  <div v-if="entry && home" class="page" :class="['mode-' + mode, { staging }]" :data-part="entry.part">
    <main class="main">
      <RouterLink class="back mono" :to="`/${entry.part}/${entry.slug}`">← {{ pad2(home.chapter.num) }} {{ t(home.chapter.title) }}</RouterLink>
      <header class="head">
        <div class="kicker mono">
          <span>{{ entry.note.kind === 'note' ? t(UI.fieldNote) : t(UI.thread) }}</span>
          <span v-for="tag in entry.note.tags ?? []" :key="tag" class="tag">{{ tag }}</span>
          <span v-if="minutes" class="muted">· {{ uiLang === 'zh' ? `约 ${minutes} 分钟` : `${minutes} min read` }}</span>
        </div>
        <h1>
          <span v-for="l in langs" :key="l" :lang="l" :class="'t-' + l">{{ (l === 'en' ? en?.title : zh?.title) || entry.note.title[l] }}</span>
        </h1>
        <div class="decks">
          <p v-for="l in langs" :key="l" :lang="l" class="deck">{{ (l === 'en' ? en : zh)?.deck }}</p>
        </div>
        <!-- the card's summary, as the piece's abstract -->
        <div class="tldr" :class="{ both: mode === 'both' }">
          <div v-for="l in langs" :key="l" :lang="l">
            <span class="label mono">{{ l === 'zh' ? '速览' : 'In short' }}</span>
            <TermHost :lang="l"><p v-for="(para, i) in entry.note.body" :key="i"><RunsText :runs="inlineRuns(para[l])" /></p></TermHost>
          </div>
        </div>
      </header>

      <ArticleBody :id="id" @loaded="onLoaded" />
      <Teleport to="body">
        <ScenePanel v-if="sceneShape === 'float'" :key="'float-' + id" floating />
      </Teleport>

      <footer class="foot">
        <div v-if="related.length || home" class="rel">
          <span class="label mono">{{ uiLang === 'zh' ? '回到书中' : 'Back to the book' }}</span>
          <RouterLink v-for="r in [home, ...related]" :key="r!.chapter.slug" class="chip" :to="`/${r!.part.id}/${r!.chapter.slug}`">
            <span class="mono">{{ pad2(r!.chapter.num) }}</span> {{ t(r!.chapter.title) }}
          </RouterLink>
        </div>
        <nav class="pager">
          <RouterLink v-if="prev" class="prev" :to="`/notes/${prev.note.id}`">
            <span class="dir mono">← {{ uiLang === 'zh' ? '上一篇' : 'Previous' }}</span>{{ t(prev.note.title) }}
          </RouterLink>
          <span v-else />
          <RouterLink v-if="next" class="next" :to="`/notes/${next.note.id}`">
            <span class="dir mono">{{ uiLang === 'zh' ? '下一篇' : 'Next' }} →</span>{{ t(next.note.title) }}
          </RouterLink>
        </nav>
      </footer>
    </main>
    <ScenePanel v-if="staging" :key="'side-' + id" />
    <aside v-else-if="mode !== 'both' && outline.length" class="right">
      <div class="otitle mono">{{ t(UI.onThisPage) }}</div>
      <RouterLink v-for="o in outline" :key="o.id" :to="{ hash: '#' + o.id }">{{ o.text }}</RouterLink>
    </aside>
  </div>
  <div v-else class="page"><p class="muted">Not found.</p></div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: minmax(0, 46rem) 220px;
  justify-content: center;
  gap: 56px;
  padding: 36px 28px 80px;
}
.page.mode-both {
  grid-template-columns: minmax(0, 1200px);
}
/* an article with its scene: the figure takes the place of the outline */
.page.staging {
  grid-template-columns: minmax(0, 42rem) minmax(340px, 400px);
  gap: 48px;
}
/* parallel view with its scene: both languages, then the figure */
/* parallel view with its scene: both languages, then the figure at the edge */
.page.mode-both.staging {
  grid-template-columns: minmax(0, 1080px) 360px;
  gap: 40px;
}
.main {
  min-width: 0;
  display: grid;
  gap: 1.2rem;
  align-content: start;
}
.back {
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
}
.back:hover {
  color: var(--accent-ink);
}
.head {
  display: grid;
  gap: 12px;
  padding-bottom: 1.6rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--rule);
}
.kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-ink);
}
.tag {
  text-transform: none;
  letter-spacing: 0;
  padding: 1px 7px;
  border-radius: 99px;
  border: 1px solid var(--rule-strong);
  color: var(--muted);
}
h1 {
  margin: 0;
  display: grid;
  gap: 4px;
  line-height: 1.2;
  letter-spacing: -0.015em;
}
.t-en {
  font-size: clamp(1.8rem, 3.4vw, 2.5rem);
}
.t-zh {
  font-family: var(--font-zh);
  font-size: clamp(1.5rem, 2.6vw, 1.9rem);
  color: var(--ink-2);
}
.mode-zh .t-zh {
  font-size: clamp(1.8rem, 3.4vw, 2.4rem);
  color: var(--ink);
}
.decks {
  display: grid;
  gap: 4px;
}
.deck {
  margin: 0;
  font-size: 1.08rem;
  color: var(--muted);
}
.deck:lang(zh) {
  font-family: var(--font-zh);
}
.tldr {
  display: grid;
  gap: 1rem;
  padding: 12px 16px;
  background: var(--bg-sunk);
  border-radius: var(--radius);
}
.tldr.both {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 2.4rem;
}
.tldr p {
  margin: 4px 0 0;
  font-size: 0.93rem;
  line-height: 1.65;
  color: var(--ink-2);
}
.tldr :lang(zh) p,
.tldr [lang='zh'] p {
  font-family: var(--font-zh);
}
.label {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.foot {
  margin-top: 3rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 1.4rem;
}
.rel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.chip {
  font-size: 12.5px;
  text-decoration: none;
  color: var(--ink-2);
  padding: 3px 10px;
  border-radius: 4px;
  background: var(--bg-sunk);
}
.chip .mono {
  color: var(--accent-ink);
  font-size: 11px;
}
.pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.pager a {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--ink-2);
  font-size: 14px;
}
.pager a:hover {
  border-color: var(--accent);
}
.pager .next {
  text-align: right;
}
.dir {
  font-size: 11px;
  color: var(--muted);
}
.right {
  position: sticky;
  top: calc(var(--topbar-h) + 28px);
  align-self: start;
  display: grid;
  gap: 2px;
  font-size: 12.5px;
  border-left: 1px solid var(--rule);
}
.otitle {
  font-size: 11px;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0 0 8px 12px;
}
.right a {
  padding: 3px 0 3px 12px;
  color: var(--muted);
  text-decoration: none;
  line-height: 1.35;
}
.right a:hover {
  color: var(--ink);
}
@media (max-width: 1100px) {
  .page {
    grid-template-columns: minmax(0, 46rem);
  }
  .right {
    display: none;
  }
}
@media (max-width: 900px) {
  .page {
    padding: 24px 16px 60px;
  }
  .tldr.both {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
  }
}
</style>
