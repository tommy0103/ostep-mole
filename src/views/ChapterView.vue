<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { findChapter, pad2 } from '@/content/book'
import { loadChapter } from '@/content/loader'
import { extrasFor } from '@/content/extras'
import { alignBlocks } from '@/lib/align'
import { buildFlow, flowRows, type FlowItem } from '@/lib/flow'
import { mode, t, UI } from '@/lib/i18n'
import { readingMinutes } from '@/lib/text'
import type { ChapterData } from '@/lib/types'
import SideNav from '@/components/layout/SideNav.vue'
import RowView from '@/components/reader/RowView.vue'
import SoloRun from '@/components/reader/SoloRun.vue'
import NoteCard from '@/components/notes/NoteCard.vue'
import { LABS } from '@/components/labs/registry'

const props = defineProps<{ part: string; slug: string }>()
const route = useRoute()
const found = computed(() => findChapter(props.slug))
const en = shallowRef<ChapterData | null>(null)
const zh = shallowRef<ChapterData | null>(null)
const error = ref('')

watch(
  () => props.slug,
  async () => {
    const f = found.value
    if (!f) return
    error.value = ''
    try {
      const [e, z] = await Promise.all([loadChapter('en', f.chapter.num), loadChapter('zh', f.chapter.num)])
      en.value = e
      zh.value = z
      await nextTick()
      if (route.hash) document.getElementById(decodeURIComponent(route.hash.slice(1)))?.scrollIntoView()
    } catch (e) {
      error.value = String(e)
    }
  },
  { immediate: true },
)

const extras = computed(() => (found.value ? extrasFor(found.value.chapter.num) : []))
const flow = computed<FlowItem[]>(() => {
  if (!en.value || !zh.value) return []
  const rows = alignBlocks(en.value.blocks, zh.value.blocks)
  return buildFlow(rows, en.value.blocks, zh.value.blocks, extras.value)
})

const outlineLang = computed(() => (mode.value === 'zh' ? 'zh' : 'en'))
const outline = computed(() => {
  const data = outlineLang.value === 'zh' ? zh.value : en.value
  if (!data) return []
  const items: { id: string; num: string | null; text: string }[] = []
  for (const item of flowRows(flow.value)) {
    if (!item.anchor) continue
    const idx = outlineLang.value === 'zh' ? item.row.zh[0] : item.row.en[0]
    const b = idx !== undefined ? data.blocks[idx] : undefined
    if (b && b.t === 'h') items.push({ id: item.anchor, num: b.num, text: b.text })
  }
  return items
})
const minutes = computed(() => {
  const data = mode.value === 'zh' ? zh.value : en.value
  return data ? readingMinutes(data.blocks) : 0
})
const labs = computed(() => extras.value.filter((e) => e.kind === 'lab').length)
const neighbours = computed(() => {
  const f = found.value
  if (!f) return { prev: null, next: null }
  return { prev: f.part.chapters[f.index - 1] ?? null, next: f.part.chapters[f.index + 1] ?? null }
})

// scroll spy for the outline
const activeId = ref('')
let observer: IntersectionObserver | null = null
watch(
  outline,
  async (items) => {
    observer?.disconnect()
    await nextTick()
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) activeId.value = e.target.id
      },
      { rootMargin: '-60px 0px -70% 0px' },
    )
    for (const it of items) {
      const el = document.getElementById(it.id)
      if (el) observer.observe(el)
    }
  },
  { flush: 'post' },
)
onBeforeUnmount(() => observer?.disconnect())

const pdfUrl = computed(() => (found.value ? `https://pages.cs.wisc.edu/~remzi/OSTEP/${found.value.chapter.slug}.pdf` : ''))
const zhPdfUrl = computed(() => (found.value ? `https://pages.cs.wisc.edu/~remzi/OSTEP/Chinese/${pad2(found.value.chapter.num)}.pdf` : ''))
</script>

<template>
  <div v-if="found" class="layout" :class="['mode-' + mode]" :data-part="found.part.id">
    <aside class="left">
      <SideNav :part="found.part" :current="slug" />
    </aside>

    <main class="main">
      <header class="chapter-head" :class="'k-' + found.chapter.kind">
        <div class="pcb mono" aria-hidden="true">
          <span>PID <b>{{ pad2(found.chapter.num) }}</b></span>
          <span>KIND <b>{{ found.chapter.kind }}</b></span>
          <span>STATE <b class="state">RUNNING</b></span>
          <span v-if="outline.length">SECT <b>{{ outline.filter((o) => o.num).length }}</b></span>
          <span v-if="labs">LABS <b>{{ labs }}</b></span>
          <span>TIME <b>~{{ minutes }}{{ mode === 'en' ? 'm' : '分' }}</b></span>
        </div>
        <h1>
          <span v-if="mode !== 'zh'" class="t-en" lang="en">{{ found.chapter.title.en }}</span>
          <span v-if="mode !== 'en'" class="t-zh" lang="zh">{{ found.chapter.title.zh }}</span>
        </h1>
        <p class="hook">{{ t(found.chapter.hook) }}</p>
        <p v-if="found.chapter.zhNote && mode !== 'en'" class="zhnote">{{ t(found.chapter.zhNote) }}</p>
        <div class="sources mono">
          <a :href="pdfUrl" target="_blank" rel="noopener">EN PDF ↗</a>
          <a :href="zhPdfUrl" target="_blank" rel="noopener">中文 PDF ↗</a>
        </div>
      </header>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-else-if="!en" class="loading mono">{{ t(UI.loading) }}</div>

      <div v-else class="flow" :class="{ dialogue: found.chapter.kind === 'dialogue' }">
        <template v-for="item in flow" :key="item.key">
          <RowView v-if="item.kind === 'row'" :row="item.row" :en="en!.blocks" :zh="zh!.blocks" :anchor="item.anchor" :dialogue="found.chapter.kind === 'dialogue'" />
          <SoloRun v-else-if="item.kind === 'solo'" :item="item" :en="en!.blocks" :zh="zh!.blocks" :dialogue="found.chapter.kind === 'dialogue'" />
          <div v-else class="extra" :class="'x-' + item.extra.kind">
            <component :is="LABS[item.extra.lab]" v-if="item.extra.kind === 'lab'" v-bind="item.extra.props ?? {}" :title="item.extra.title" />
            <NoteCard v-else :note="item.extra" />
          </div>
        </template>
      </div>

      <nav class="pager">
        <RouterLink v-if="neighbours.prev" class="prev" :to="`/${found.part.id}/${neighbours.prev.slug}`">
          <span class="dir mono">← {{ t(UI.prev) }}</span>
          <span class="mono n">{{ pad2(neighbours.prev.num) }}</span> {{ t(neighbours.prev.title) }}
        </RouterLink>
        <span v-else />
        <RouterLink v-if="neighbours.next" class="next" :to="`/${found.part.id}/${neighbours.next.slug}`">
          <span class="dir mono">{{ t(UI.next) }} →</span>
          <span class="mono n">{{ pad2(neighbours.next.num) }}</span> {{ t(neighbours.next.title) }}
        </RouterLink>
      </nav>
    </main>

    <aside class="right">
      <div class="outline">
        <div class="otitle mono">{{ t(UI.onThisPage) }}</div>
        <RouterLink v-for="o in outline" :key="o.id" :to="{ hash: '#' + o.id }" :class="{ active: activeId === o.id }" :lang="outlineLang">
          <span v-if="o.num" class="mono">{{ o.num }}</span>
          <span>{{ o.text }}</span>
        </RouterLink>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 220px;
  gap: 40px;
  max-width: 1480px;
  margin: 0 auto;
  padding: 0 28px;
}
.layout.mode-both {
  grid-template-columns: 230px minmax(0, 1fr);
  max-width: 1640px;
}
.layout.mode-both .right {
  display: none;
}
.left,
.right {
  position: sticky;
  top: var(--topbar-h);
  align-self: start;
  max-height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
  padding: 28px 0 40px;
  scrollbar-width: thin;
}
.main {
  min-width: 0;
  padding: 36px 0 80px 3rem;
}
.mode-both .main {
  padding-left: 1rem;
}
.chapter-head {
  max-width: 46rem;
  margin-bottom: 2.6rem;
  padding-bottom: 1.6rem;
  border-bottom: 1px solid var(--rule);
}
.mode-both .chapter-head {
  max-width: none;
}
.pcb {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 11px;
  color: var(--faint);
  letter-spacing: 0.04em;
  margin-bottom: 14px;
}
.pcb b {
  font-weight: 500;
  color: var(--muted);
}
.pcb .state {
  color: var(--ok);
}
h1 {
  margin: 0;
  display: grid;
  gap: 4px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.15;
}
.t-en {
  font-family: var(--font-serif);
  font-size: clamp(1.9rem, 3.2vw, 2.6rem);
}
.t-zh {
  font-family: var(--font-zh);
  font-size: clamp(1.5rem, 2.4vw, 1.9rem);
  font-weight: 600;
  color: var(--ink-2);
}
.mode-zh .t-zh {
  font-size: clamp(1.9rem, 3.2vw, 2.5rem);
  color: var(--ink);
}
.hook {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 1.02rem;
}
.zhnote {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--warn);
}
.sources {
  margin-top: 14px;
  display: flex;
  gap: 14px;
  font-size: 11.5px;
}
.sources a {
  color: var(--muted);
  text-decoration: none;
}
.sources a:hover {
  color: var(--accent-ink);
}
.flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.15rem;
}
.flow.dialogue {
  gap: 1.3rem;
}
.extra {
  min-width: 0;
  margin: 1.4rem 0;
  max-width: calc(var(--measure) + 8rem);
}
.mode-both .extra {
  max-width: none;
}
.loading,
.error {
  color: var(--muted);
  padding: 40px 0;
}
.pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 4rem;
  padding-top: 1.6rem;
  border-top: 1px solid var(--rule);
  max-width: 46rem;
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
  color: var(--ink);
}
.pager .next {
  text-align: right;
}
.pager .dir {
  font-size: 11px;
  color: var(--muted);
}
.pager .n {
  color: var(--accent-ink);
  font-size: 12px;
}
.outline {
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
.outline a {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  padding: 3px 0 3px 12px;
  margin-left: -1px;
  border-left: 2px solid transparent;
  text-decoration: none;
  color: var(--muted);
  line-height: 1.35;
}
.outline a .mono {
  font-size: 11px;
  color: var(--faint);
}
.outline a:hover {
  color: var(--ink);
}
.outline a.active {
  color: var(--accent-ink);
  border-left-color: var(--accent);
}
@media (max-width: 1280px) {
  .layout {
    grid-template-columns: 230px minmax(0, 1fr);
  }
  .right {
    display: none;
  }
}
@media (max-width: 980px) {
  .layout,
  .layout.mode-both {
    grid-template-columns: minmax(0, 1fr);
    padding: 0 16px;
  }
  .left {
    display: none;
  }
  .main,
  .mode-both .main {
    padding: 24px 0 60px;
  }
}
@media (min-width: 981px) and (max-width: 1280px) {
  .main {
    padding-left: 2.6rem;
  }
}
</style>
