<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '@/lib/types'
import { inline } from '@/lib/article'
import { findTerm } from '@/content/glossary'
import { findChapter, pad2 } from '@/content/book'
import { findNote } from '@/content/extras/notes'
import RunsText from '../reader/RunsText.vue'

/** What a glossary term says: its title, its explanation, and where the book or a note goes on. */
const props = defineProps<{ id: string; lang: Lang }>()
const term = computed(() => findTerm(props.id))
const chapter = computed(() => (term.value?.chapter ? findChapter(term.value.chapter) : null))
const note = computed(() => (term.value?.note ? findNote(term.value.note) : null))
const zh = computed(() => props.lang === 'zh')
</script>

<template>
  <div v-if="term" class="term-body">
    <div class="title">{{ term.title[lang] }}</div>
    <p class="text"><RunsText :runs="inline(term.body[lang])" /></p>
    <div v-if="chapter || note" class="links">
      <RouterLink v-if="chapter" :to="`/${chapter.part.id}/${chapter.chapter.slug}`">
        <span class="mono">{{ zh ? '书中' : 'in the book' }}</span> {{ zh ? `第 ${chapter.chapter.num} 章` : `ch. ${pad2(chapter.chapter.num)}` }} {{ chapter.chapter.title[lang] }}
      </RouterLink>
      <RouterLink v-if="note" :to="`/notes/${note.note.id}`">
        <span class="mono">{{ zh ? '深入' : 'deeper' }}</span> {{ note.note.title[lang] }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.title {
  font-weight: 600;
  color: var(--ink);
}
.text {
  margin: 2px 0 0;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.text :deep(code) {
  font-size: 0.86em;
  padding: 0.05em 0.3em;
  background: var(--code-bg);
  border-radius: 3px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin-top: 8px;
  font-size: 0.85rem;
}
.links a {
  color: var(--accent-ink);
  text-decoration: none;
}
.links a:hover {
  text-decoration: underline;
}
.links .mono {
  font-size: 11px;
  color: var(--muted);
  margin-right: 4px;
}
</style>
