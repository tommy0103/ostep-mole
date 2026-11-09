<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { IDEAS } from '@/content/threads'
import { PARTS, pad2 } from '@/content/book'
import { allExtras } from '@/content/extras'
import { mode, t } from '@/lib/i18n'
import NoteCard from '@/components/notes/NoteCard.vue'
import type { NoteExtra } from '@/content/extras/types'

const router = useRouter()
const part = PARTS[0]
const chapters = part.chapters.filter((c) => c.kind !== 'dialogue')
const hoverIdea = ref<string | null>(null)
const hoverChap = ref<number | null>(null)

const W = 760
const rowH = 30
const H = Math.max(IDEAS.length, chapters.length) * rowH + 20
const ideaY = (i: number) => 20 + i * ((H - 40) / (IDEAS.length - 1))
const chapY = (i: number) => 20 + i * ((H - 40) / (chapters.length - 1))
const edges = computed(() =>
  IDEAS.flatMap((idea, i) =>
    idea.chapters
      .map((n) => chapters.findIndex((c) => c.num === n))
      .filter((j) => j >= 0)
      .map((j) => ({ idea: idea.id, chap: chapters[j].num, y1: ideaY(i), y2: chapY(j) })),
  ),
)
const lit = (e: { idea: string; chap: number }) =>
  (hoverIdea.value === null && hoverChap.value === null) || hoverIdea.value === e.idea || hoverChap.value === e.chap
const ideaLit = (id: string) =>
  (hoverIdea.value === null && hoverChap.value === null) || hoverIdea.value === id || (hoverChap.value !== null && IDEAS.find((i) => i.id === id)!.chapters.includes(hoverChap.value))
const chapLit = (n: number) =>
  (hoverIdea.value === null && hoverChap.value === null) || hoverChap.value === n || (hoverIdea.value !== null && IDEAS.find((i) => i.id === hoverIdea.value)!.chapters.includes(n))

const threadNotes = computed(() => allExtras().filter((x) => x.extra.kind === 'thread').map((x) => x.extra as NoteExtra))
</script>

<template>
  <div class="threads" data-part="virtualization">
    <header>
      <div class="eyebrow mono">PART I · THREADS</div>
      <h1>{{ t({ en: 'Ideas that run through everything', zh: '贯穿一切的思想' }) }}</h1>
      <p class="lede">
        {{ t({ en: 'The chapters of Part I look like separate topics — schedulers, page tables, allocators. They are the same handful of ideas, applied again and again. Hover an idea or a chapter.', zh: '第一部分的各章看似是彼此独立的主题——调度器、页表、分配器。其实它们是同几个思想被一次又一次地运用。把鼠标移到某个思想或某一章上看看。' }) }}
      </p>
    </header>

    <div class="map">
      <svg class="viz" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="t({ en: 'map of ideas and chapters', zh: '思想与章节关系图' })">
        <path
          v-for="(e, k) in edges"
          :key="k"
          :d="`M 250 ${e.y1} C 380 ${e.y1}, 400 ${e.y2}, 520 ${e.y2}`"
          fill="none"
          :stroke="lit(e) ? 'var(--accent)' : 'var(--rule)'"
          :stroke-width="lit(e) && (hoverIdea || hoverChap) ? 1.8 : 1"
          :opacity="lit(e) ? 0.75 : 0.5"
          class="edge"
        />
        <g v-for="(idea, i) in IDEAS" :key="idea.id" class="node" @mouseenter="hoverIdea = idea.id" @mouseleave="hoverIdea = null">
          <a :href="router.resolve({ hash: `#${idea.id}` }).href" @click.prevent="router.push({ hash: `#${idea.id}` })">
            <rect x="0" :y="ideaY(i) - 12" width="250" height="24" fill="transparent" />
            <text x="244" :y="ideaY(i) + 4" text-anchor="end" :class="{ dim: !ideaLit(idea.id) }" class="idea-t">{{ t(idea.title) }}</text>
            <circle cx="250" :cy="ideaY(i)" r="4" :fill="ideaLit(idea.id) ? 'var(--accent)' : 'var(--rule-strong)'" />
          </a>
        </g>
        <g v-for="(c, j) in chapters" :key="c.num" class="node" @mouseenter="hoverChap = c.num" @mouseleave="hoverChap = null">
          <RouterLink :to="`/virtualization/${c.slug}`">
            <rect x="520" :y="chapY(j) - 11" width="240" height="22" fill="transparent" />
            <circle cx="520" :cy="chapY(j)" r="3.5" :fill="chapLit(c.num) ? 'var(--ink)' : 'var(--rule-strong)'" />
            <text x="530" :y="chapY(j) + 4" :class="{ dim: !chapLit(c.num) }" class="chap-t"><tspan class="n">{{ pad2(c.num) }}</tspan> {{ t(c.title) }}</text>
          </RouterLink>
        </g>
      </svg>
    </div>

    <section class="ideas">
      <article v-for="idea in IDEAS" :id="idea.id" :key="idea.id" class="idea">
        <h2>{{ t(idea.title) }}</h2>
        <p v-if="mode === 'both'" class="gist" lang="en">{{ idea.gist.en }}</p>
        <p class="gist" :lang="mode === 'en' ? 'en' : 'zh'">{{ t(idea.gist) }}</p>
        <p class="ex"><span class="mono">{{ t({ en: 'beyond the book', zh: '书外' }) }} →</span> {{ t(idea.examples) }}</p>
        <div class="chaps">
          <RouterLink v-for="n in idea.chapters" :key="n" :to="`/virtualization/${part.chapters.find((c) => c.num === n)!.slug}`" class="mono">{{ pad2(n) }}</RouterLink>
        </div>
      </article>
    </section>

    <section class="notes">
      <h2 class="mono">{{ t({ en: 'connections written into the chapters', zh: '写在各章中的知识串联' }) }}</h2>
      <NoteCard v-for="n in threadNotes" :key="n.id" :note="n" />
    </section>
  </div>
</template>

<style scoped>
.threads {
  max-width: 1080px;
  margin: 0 auto;
  padding: 48px 24px 96px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--accent-ink);
}
h1 {
  margin: 8px 0 0;
  font-family: var(--font-serif);
  font-size: clamp(2rem, 4.4vw, 3rem);
  letter-spacing: -0.02em;
}
.lede {
  max-width: 44rem;
  color: var(--ink-2);
  font-size: 1.08rem;
}
.map {
  margin: 32px 0 48px;
  padding: 16px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--bg-elev);
  overflow-x: auto;
}
.map svg {
  min-width: 680px;
}
.edge {
  transition: stroke 0.2s, opacity 0.2s;
}
.idea-t {
  font-family: var(--font-sans);
  font-size: 13px !important;
  fill: var(--ink) !important;
  transition: opacity 0.2s;
}
.chap-t {
  font-family: var(--font-sans);
  font-size: 12.5px !important;
  fill: var(--ink-2) !important;
}
.chap-t .n {
  font-family: var(--font-mono);
  fill: var(--accent-ink);
  font-size: 11px;
}
.dim {
  opacity: 0.3;
}
.node {
  cursor: pointer;
}
.ideas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
}
.idea {
  padding: 16px 18px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--bg-elev);
  scroll-margin-top: 80px;
}
.idea:target {
  border-color: var(--accent);
}
.idea h2 {
  margin: 0 0 6px;
  font-size: 1.08rem;
}
.gist {
  margin: 0 0 8px;
  font-size: 0.96rem;
  color: var(--ink-2);
}
.gist:lang(en) {
  font-family: var(--font-serif);
}
.ex {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 10px;
}
.ex .mono {
  font-size: 11px;
  color: var(--accent-ink);
}
.chaps {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chaps a {
  font-size: 11.5px;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--bg-sunk);
  text-decoration: none;
}
.notes {
  margin-top: 56px;
  display: grid;
  gap: 16px;
}
.notes h2 {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}
</style>
