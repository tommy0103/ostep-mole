<script setup lang="ts">
import { computed } from 'vue'
import { PARTS, pad2 } from '@/content/book'
import { labCount } from '@/content/extras'
import { mode, t } from '@/lib/i18n'
import IllusionHero from '@/components/viz/IllusionHero.vue'
import { IDEAS } from '@/content/threads'
import { allNotes } from '@/content/extras/notes'
import { hasArticle } from '@/content/articles'

const props = defineProps<{ part: string }>()
const p = computed(() => PARTS.find((x) => x.id === props.part)!)
const KIND: Record<string, string> = { dialogue: 'DIALOG', chapter: 'CHAP', interlude: 'INTER' }
const notes = computed(() => allNotes().filter((n) => n.part === props.part && hasArticle(n.note.id)))
</script>

<template>
  <div class="part" :data-part="p.id">
    <header class="head">
      <div class="eyebrow mono">PART {{ p.numeral }}</div>
      <h1>
        <span v-if="mode !== 'zh'" lang="en">{{ p.title.en }}</span>
        <span v-if="mode !== 'en'" lang="zh" class="zh">{{ p.title.zh }}</span>
      </h1>
      <p class="tagline">{{ t(p.tagline) }}</p>
    </header>

    <template v-if="p.ready">
      <section class="illusion">
        <IllusionHero />
      </section>

      <section v-for="g in p.groups" :key="g.id" class="group">
        <h2 class="mono">
          <span class="prompt">$</span> ps -o pid,kind,name <span class="muted">--group={{ g.id }}</span>
          <span class="gtitle">{{ t(g.title) }}</span>
        </h2>
        <div class="ps" role="list">
          <div class="ps-head mono" aria-hidden="true">
            <span>PID</span><span>KIND</span><span>NAME</span><span class="r">LABS</span>
          </div>
          <RouterLink v-for="ch in p.chapters.filter((c) => c.group === g.id)" :key="ch.slug" :to="`/${p.id}/${ch.slug}`" class="ps-row" role="listitem" :class="'k-' + ch.kind">
            <span class="pid mono">{{ pad2(ch.num) }}</span>
            <span class="kind mono">{{ KIND[ch.kind] }}</span>
            <span class="name">
              <span v-if="mode !== 'zh'" class="en" lang="en">{{ ch.title.en }}</span>
              <span v-if="mode !== 'en'" class="zh" lang="zh">{{ ch.title.zh }}</span>
              <span class="hook">{{ t(ch.hook) }}</span>
            </span>
            <span class="labs mono r">{{ labCount(ch.num) ? '◆ ' + labCount(ch.num) : '' }}</span>
          </RouterLink>
        </div>
      </section>

      <section class="threads">
        <h2 class="mono"><span class="prompt">$</span> grep -r "idea" {{ p.id }}/</h2>
        <p class="muted">{{ t({ en: 'Ideas that keep reappearing across these chapters — and far beyond them.', zh: '这些思想在各章之间反复出现——并且远远超出本书。' }) }}</p>
        <div class="idea-chips">
          <RouterLink v-for="i in IDEAS" :key="i.id" :to="`/threads#${i.id}`" class="idea">{{ t(i.title) }}</RouterLink>
        </div>
      </section>

      <section v-if="notes.length" class="notes">
        <h2 class="mono"><span class="prompt">$</span> ls ~/field-notes/</h2>
        <p class="muted">{{ t({ en: 'Long-form pieces on where these ideas show up today, from LLM serving to the Linux scheduler.', zh: '一组长文：这些思想今天出现在哪里——从大模型推理到 Linux 调度器。' }) }}</p>
        <div class="note-list">
          <RouterLink v-for="n in notes" :key="n.note.id" :to="`/notes/${n.note.id}`" class="note-row">
            <span class="pid mono">{{ pad2(n.chapter) }}</span>
            <span class="nt">{{ t(n.note.title) }}</span>
            <span class="tags mono">{{ (n.note.tags ?? []).join(' · ') }}</span>
          </RouterLink>
        </div>
      </section>
    </template>
    <section v-else class="soon">
      <p class="mono">{{ t({ en: 'Coming next. This part will get its own visual language.', zh: '即将推出。这一部分会有属于自己的视觉语言。' }) }}</p>
    </section>
  </div>
</template>

<style scoped>
.part {
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
  margin: 6px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  align-items: baseline;
  font-family: var(--font-serif);
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}
h1 .zh {
  font-family: var(--font-zh);
  color: var(--ink-2);
  font-size: 0.8em;
}
.tagline {
  max-width: 40rem;
  font-size: 1.15rem;
  color: var(--ink-2);
  margin: 12px 0 0;
}
.illusion {
  margin: 36px 0 56px;
  padding: 20px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--bg-elev);
}
.group {
  margin-top: 44px;
}
h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-2);
  margin: 0 0 10px;
}
.prompt {
  color: var(--accent);
}
.gtitle {
  margin-left: auto;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.ps {
  border-top: 1px solid var(--rule-strong);
}
.ps-head,
.ps-row {
  display: grid;
  grid-template-columns: 3.2rem 4.6rem 1fr 4rem;
  gap: 12px;
  align-items: baseline;
  padding: 10px 6px;
}
.ps-head {
  font-size: 10.5px;
  color: var(--faint);
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--rule);
}
.ps-row {
  text-decoration: none;
  color: var(--ink);
  border-bottom: 1px solid var(--rule);
  transition: background 0.15s;
}
.ps-row:hover {
  background: var(--accent-soft);
}
.pid {
  color: var(--accent-ink);
  font-size: 13px;
}
.kind {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.05em;
}
.k-dialogue .name .en,
.k-dialogue .name .zh {
  font-style: italic;
  color: var(--ink-2);
}
.name {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  align-items: baseline;
}
.name .en {
  font-family: var(--font-serif);
  font-size: 1.08rem;
}
.name .zh {
  font-family: var(--font-zh);
  font-size: 0.98rem;
  color: var(--ink-2);
}
.hook {
  flex-basis: 100%;
  font-size: 13px;
  color: var(--muted);
}
.labs {
  font-size: 11.5px;
  color: var(--accent);
}
.r {
  text-align: right;
}
.threads {
  margin-top: 56px;
}
.idea-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.idea {
  padding: 6px 12px;
  border: 1px solid var(--rule-strong);
  border-radius: 99px;
  text-decoration: none;
  color: var(--ink-2);
  font-size: 13.5px;
  background: var(--bg-elev);
}
.idea:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}
.notes {
  margin-top: 56px;
}
.note-list {
  display: grid;
  border-top: 1px solid var(--rule);
}
.note-row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  gap: 12px;
  align-items: baseline;
  padding: 9px 4px;
  border-bottom: 1px solid var(--rule);
  text-decoration: none;
  color: var(--ink);
}
.note-row:hover {
  background: var(--accent-soft);
}
.note-row .pid {
  color: var(--faint);
  font-size: 12px;
}
.note-row .tags {
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 640px) {
  .note-row {
    grid-template-columns: 2.4rem minmax(0, 1fr);
  }
  .note-row .tags {
    display: none;
  }
}
.soon {
  margin-top: 40px;
  color: var(--muted);
}
@media (max-width: 640px) {
  .ps-head,
  .ps-row {
    grid-template-columns: 2.4rem 1fr 2.6rem;
  }
  .kind {
    display: none;
  }
  .ps-head span:nth-child(2) {
    display: none;
  }
}
</style>
