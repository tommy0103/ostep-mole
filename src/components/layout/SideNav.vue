<script setup lang="ts">
import type { PartMeta } from '@/content/book'
import { pad2 } from '@/content/book'
import { t, UI } from '@/lib/i18n'
import { labCount } from '@/content/extras'

/** The part's table of contents, drawn like a directory listing. */
defineProps<{ part: PartMeta; current?: string }>()
</script>

<template>
  <nav class="side" :aria-label="t(UI.contents)">
    <RouterLink :to="`/${part.id}`" class="root mono">~/ostep/{{ part.id }}/</RouterLink>
    <div v-for="g in part.groups" :key="g.id" class="group">
      <div class="gtitle mono">├─ {{ g.id }}/ <span class="gname">{{ t(g.title) }}</span></div>
      <ul>
        <li v-for="ch in part.chapters.filter((c) => c.group === g.id)" :key="ch.slug">
          <RouterLink :to="`/${part.id}/${ch.slug}`" :class="{ active: ch.slug === current, dialogue: ch.kind === 'dialogue' }" :aria-current="ch.slug === current ? 'page' : undefined">
            <span class="num mono">{{ pad2(ch.num) }}</span>
            <span class="name">{{ t(ch.title) }}</span>
            <span v-if="labCount(ch.num)" class="labs mono" :title="`${labCount(ch.num)} ${t(UI.labs)}`">{{ '◆'.repeat(Math.min(3, labCount(ch.num))) }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.side {
  font-size: 13.5px;
}
.root {
  display: block;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  margin-bottom: 10px;
}
.root:hover {
  color: var(--accent-ink);
}
.group + .group {
  margin-top: 14px;
}
.gtitle {
  font-size: 12px;
  color: var(--faint);
  margin-bottom: 4px;
}
.gname {
  font-family: var(--font-sans);
  color: var(--muted);
  font-size: 12px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0 0 0 10px;
  border-left: 1px solid var(--rule);
}
li a {
  display: grid;
  grid-template-columns: 2em 1fr auto;
  gap: 6px;
  align-items: baseline;
  padding: 4px 8px;
  border-radius: 4px;
  text-decoration: none;
  color: var(--ink-2);
  line-height: 1.35;
}
li a:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
li a.active {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
li a.dialogue .name {
  font-style: italic;
  color: var(--muted);
}
.num {
  font-size: 11.5px;
  color: var(--faint);
}
a.active .num {
  color: var(--accent-ink);
}
.labs {
  font-size: 8px;
  color: var(--accent);
  letter-spacing: 1px;
}
</style>
