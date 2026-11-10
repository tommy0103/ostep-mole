<script setup lang="ts">
import { computed } from 'vue'
import type { ABlock } from '@/lib/article'
import type { Lang } from '@/lib/types'
import { t } from '@/lib/i18n'
import { findChapter, pad2 } from '@/content/book'
import { allExtras } from '@/content/extras'
import { LABS } from '@/components/labs/registry'
import RunsText from '../reader/RunsText.vue'
import CodeBlock from '../reader/CodeBlock.vue'
import TermHost from '../terms/TermHost.vue'

const props = defineProps<{ block: ABlock; lang: Lang }>()

// a lab embedded in an article reuses the title it has in its chapter
const labTitle = computed(() => {
  const b = props.block
  if (b.t !== 'lab') return null
  const x = allExtras().find((e) => e.extra.kind === 'lab' && e.extra.lab === b.name)?.extra
  return x?.title ?? { en: b.name, zh: b.name }
})
const chapter = computed(() => (props.block.t === 'chapter' ? findChapter(props.block.slug) : null))
</script>

<template>
  <h2 v-if="block.t === 'h' && block.level === 2" :id="block.id" class="a-h2"><RunsText :runs="block.runs" /></h2>
  <h3 v-else-if="block.t === 'h'" :id="block.id" class="a-h3"><RunsText :runs="block.runs" /></h3>
  <!-- prose blocks host glossary cards: a term clicked inside opens below the block -->
  <TermHost v-else-if="block.t === 'p'" :lang="lang"><p class="a-p"><RunsText :runs="block.runs" /></p></TermHost>
  <TermHost v-else-if="block.t === 'ul' || block.t === 'ol'" :lang="lang">
    <component :is="block.t" class="a-list">
      <li v-for="(it, i) in block.items" :key="i"><RunsText :runs="it" /></li>
    </component>
  </TermHost>
  <CodeBlock v-else-if="block.t === 'code'" :code="block.text" />
  <TermHost v-else-if="block.t === 'quote'" :lang="lang"><blockquote class="a-quote"><RunsText :runs="block.runs" /></blockquote></TermHost>
  <TermHost v-else-if="block.t === 'table'" :lang="lang">
    <div class="a-table">
      <table>
        <thead>
          <tr><th v-for="(c, i) in block.head" :key="i"><RunsText :runs="c" /></th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in block.rows" :key="i">
            <td v-for="(c, j) in row" :key="j"><RunsText :runs="c" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </TermHost>
  <hr v-else-if="block.t === 'hr'" class="a-hr" />
  <component :is="LABS[block.name]" v-else-if="block.t === 'lab' && LABS[block.name]" v-bind="block.props ?? {}" :title="labTitle" />
  <RouterLink v-else-if="block.t === 'chapter' && chapter" class="a-chapter" :to="`/${chapter.part.id}/${chapter.chapter.slug}`">
    <span class="mono n">{{ pad2(chapter.chapter.num) }}</span>
    <span class="ct">{{ t(chapter.chapter.title) }}</span>
    <span class="hook">{{ t(chapter.chapter.hook) }}</span>
    <span class="go mono">→</span>
  </RouterLink>
</template>

<style scoped>
.a-p,
.a-list,
.a-quote {
  margin: 0;
  /* long paths like /sys/devices/system/cpu/... must not widen the page on phones */
  overflow-wrap: anywhere;
  font-size: var(--article-size, 1.02rem);
  line-height: 1.78;
  color: var(--ink);
}
.a-p:lang(zh),
.a-list:lang(zh),
.a-quote:lang(zh) {
  font-family: var(--font-zh);
  line-height: 1.9;
}
.a-p :deep(code),
.a-list :deep(code),
.a-table :deep(code),
.a-quote :deep(code) {
  font-size: 0.86em;
  padding: 0.05em 0.3em;
  background: var(--code-bg);
  border-radius: 3px;
}
.a-h2 {
  margin: 0;
  font-size: 1.32rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.3;
  scroll-margin-top: calc(var(--topbar-h) + 16px);
}
.a-h3 {
  margin: 0;
  font-size: 1.06rem;
  font-weight: 600;
  scroll-margin-top: calc(var(--topbar-h) + 16px);
}
.a-list {
  padding-left: 1.4em;
  display: grid;
  gap: 0.35rem;
}
.a-list li::marker {
  color: var(--accent-ink);
}
.a-quote {
  padding: 2px 0 2px 16px;
  border-left: 3px solid var(--rule-strong);
  color: var(--ink-2);
  font-style: italic;
}
.a-quote:lang(zh) {
  font-style: normal;
}
.a-table {
  overflow-x: auto;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
}
.a-table table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9rem;
}
.a-table th,
.a-table td {
  padding: 7px 12px;
  border-bottom: 1px solid var(--rule);
  text-align: left;
  vertical-align: top;
}
.a-table th {
  background: var(--bg-sunk);
  font-weight: 600;
  font-size: 0.85rem;
}
.a-table tr:last-child td {
  border-bottom: 0;
}
/* on a phone a column would shrink to a character per line; let the table scroll sideways instead */
@media (max-width: 640px) {
  .a-table th,
  .a-table td {
    min-width: 6.5em;
  }
}
.a-hr {
  border: 0;
  border-top: 1px solid var(--rule);
  margin: 0.8rem 0;
}
.a-chapter {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: 'n ct go' 'n hook go';
  column-gap: 14px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-elev);
  text-decoration: none;
  color: var(--ink);
}
.a-chapter:hover {
  border-color: var(--accent);
}
.a-chapter .n {
  grid-area: n;
  font-size: 1.3rem;
  color: var(--accent-ink);
}
.a-chapter .ct {
  grid-area: ct;
  font-weight: 600;
}
.a-chapter .hook {
  grid-area: hook;
  font-size: 0.86rem;
  color: var(--muted);
}
.a-chapter .go {
  grid-area: go;
  color: var(--accent-ink);
}
</style>
