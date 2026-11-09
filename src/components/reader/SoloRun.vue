<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SoloItem } from '@/lib/flow'
import type { Block } from '@/lib/types'
import { mode, uiLang } from '@/lib/i18n'
import BlockView from './BlockView.vue'
import RowView from './RowView.vue'

/**
 * A run of passages that exist in one edition only. The Chinese translation follows an earlier
 * edition of the book, so whole sections can be new in English (e.g. Linux CFS in ch. 9), and a few
 * older passages survive only in Chinese. Instead of a column of dashes we say so once, and in
 * single-language mode we keep the passage reachable rather than silently hiding it.
 */
const props = defineProps<{ item: SoloItem; en: Block[]; zh: Block[]; dialogue?: boolean }>()
const open = ref(false)

const blocks = computed(() => props.item.rows.flatMap((r) => (props.item.side === 'en' ? r.row.en.map((i) => props.en[i]) : r.row.zh.map((i) => props.zh[i]))))
const count = computed(() => blocks.value.length)
const headings = computed(() => blocks.value.flatMap((b) => (b.t === 'h' ? [`${b.num ?? ''} ${b.text}`.trim()] : [])))
/** a lone footnote or uncaptioned drawing is not worth a banner */
const minor = computed(() => count.value === 1 && ['note', 'fig', 'code'].includes(blocks.value[0].t))
const hidden = computed(() => mode.value !== 'both' && mode.value !== props.item.side)
const firstAnchor = computed(() => props.item.rows.find((r) => r.anchor)?.anchor)
// when the run opens with a section heading, the marker goes under it (deep links land on the heading)
const markerAt = computed(() => (props.item.rows[0].anchor ? 1 : 0))

const label = computed(() => {
  const n = count.value
  if (props.item.side === 'en') {
    return uiLang.value === 'zh'
      ? `中文译本中没有对应内容（英文版 ${n} 段）`
      : `Not in the Chinese translation (${n} passage${n > 1 ? 's' : ''})`
  }
  return uiLang.value === 'zh' ? `仅见于中文译本（${n} 段）` : `Only in the Chinese translation (${n} passage${n > 1 ? 's' : ''})`
})
const why = computed(() =>
  uiLang.value === 'zh' ? '中文译本依据的是原书较早的版本，与现行英文版不完全一致。' : 'The translation follows an earlier edition of the book.',
)
const toggleText = computed(() => {
  if (props.item.side === 'en') return open.value ? '收起' : '展开英文原文'
  return open.value ? 'Hide' : 'Show the Chinese text'
})
</script>

<template>
  <!-- the reader's language has these passages: show them, with a marker in parallel view -->
  <div v-if="!hidden" class="solo" :class="['side-' + item.side, { both: mode === 'both', quiet: minor }]">
    <template v-for="(r, i) in item.rows" :key="r.key">
      <div v-if="i === markerAt && mode === 'both' && !minor" class="marker" :class="'m-' + item.side" :title="why">
        <span class="tag mono">{{ item.side === 'en' ? 'EN ONLY' : '仅中文' }}</span>
        <span>{{ label }}</span>
      </div>
      <RowView :row="r.row" :en="en" :zh="zh" :anchor="r.anchor" :dialogue="dialogue" :quiet="!minor" />
    </template>
  </div>

  <!-- the other language only: a collapsed note that keeps the passage one click away -->
  <section v-else-if="!minor" :id="firstAnchor" class="absent" :class="{ open }" :lang="uiLang">
    <button class="bar" :aria-expanded="open" @click="open = !open">
      <span class="tag mono">{{ item.side === 'en' ? 'EN' : '中' }}</span>
      <span class="what">
        {{ label }}<template v-if="headings.length">{{ uiLang === 'zh' ? '：' : ': ' }}{{ headings.join(' · ') }}</template>
      </span>
      <span class="toggle mono">{{ toggleText }}</span>
    </button>
    <p class="why">{{ why }}</p>
    <div v-if="open" class="body">
      <BlockView v-for="(b, i) in blocks" :key="i" :block="b" :lang="item.side" :dialogue="dialogue" />
    </div>
  </section>
</template>

<style scoped>
.solo {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.15rem;
  min-width: 0;
}
.marker {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 0;
  border-bottom: 1px dashed var(--rule-strong);
  cursor: help;
}
/* in parallel view the marker sits over the empty column */
.both .marker.m-en {
  margin-left: calc(50% + 1.2rem);
}
.both .marker.m-zh {
  margin-right: calc(50% + 1.2rem);
}
.tag {
  font-size: 10px;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-sunk);
  color: var(--faint);
  white-space: nowrap;
}
.absent {
  max-width: var(--measure);
  border: 1px dashed var(--rule-strong);
  border-radius: var(--radius);
  padding: 8px 12px;
}
.bar {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  border: 0;
  background: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  color: var(--ink-2);
  font-size: 13.5px;
}
.what {
  flex: 1;
  min-width: 0;
}
.toggle {
  font-size: 11.5px;
  color: var(--accent-ink);
  white-space: nowrap;
}
.why {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--faint);
}
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
  --body-size: 0.96rem;
  color: var(--ink-2);
}
@media (max-width: 900px) {
  .both .marker.m-en,
  .both .marker.m-zh {
    margin: 0;
  }
}
</style>
