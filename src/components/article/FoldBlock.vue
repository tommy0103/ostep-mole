<script setup lang="ts">
import { computed, ref } from 'vue'
import { articleText, type ABlock } from '@/lib/article'
import { mode, uiLang } from '@/lib/i18n'
import { readingUnits } from '@/lib/text'
import RunsText from '../reader/RunsText.vue'
import ArticleBlocks from './ArticleBlocks.vue'

type Box = ABlock & { t: 'fold' | 'aside' }
/**
 * A fold is knowledge one level deeper than the text around it — the derivation, the kernel source,
 * the war story. Closed, it is a single line that says what is inside and how long it takes;
 * open, it unrolls in place. An aside is the same container, always open and boxed.
 */
const props = defineProps<{ en?: Box; zh?: Box }>()
const box = computed(() => (props.en ?? props.zh)!)
const isFold = computed(() => box.value.t === 'fold')
const open = ref(false)
// once unrolled, keep the content mounted so folding back animates too
const seen = ref(false)
const toggle = () => {
  seen.value = true
  open.value = !open.value
}

const minutes = computed(() => {
  const b = (uiLang.value === 'zh' ? props.zh : props.en) ?? box.value
  const u = readingUnits(articleText(b.blocks))
  return Math.max(1, Math.round(u.words / 230 + u.cjk / 400))
})
const titles = computed(() => {
  if (mode.value === 'both') return [props.en, props.zh].filter((x): x is Box => !!x).map((b, i) => ({ runs: b.title, lang: i === 0 && props.en ? 'en' : 'zh' }))
  const b = mode.value === 'zh' ? (props.zh ?? props.en) : (props.en ?? props.zh)
  return [{ runs: b!.title, lang: b === props.zh ? 'zh' : 'en' }]
})
</script>

<template>
  <section class="box" :class="[isFold ? 'fold' : 'aside', { open: open || !isFold }]">
    <component :is="isFold ? 'button' : 'div'" class="head" :aria-expanded="isFold ? open : undefined" @click="isFold && toggle()">
      <svg v-if="isFold" class="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
      <span class="titles">
        <span v-for="(tt, i) in titles" :key="i" class="title" :lang="tt.lang"><RunsText :runs="tt.runs" /></span>
      </span>
      <span v-if="isFold" class="meta mono">{{ open ? (uiLang === 'zh' ? '收起' : 'fold') : uiLang === 'zh' ? `展开 · ${minutes} 分钟` : `unfold · ${minutes} min` }}</span>
    </component>
    <div class="body-wrap">
      <div class="body">
        <ArticleBlocks v-if="seen || !isFold" :en="en?.blocks" :zh="zh?.blocks" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.box {
  min-width: 0;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
}
.fold > .head {
  cursor: pointer;
  padding: 10px 12px;
  border: 1px dashed var(--rule-strong);
  border-radius: var(--radius);
  background: var(--bg-elev);
  transition: border-color 0.15s, background 0.15s;
}
.fold > .head:hover {
  border-color: var(--accent);
}
.fold.open > .head {
  border-style: solid;
  border-color: var(--accent);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: var(--accent-soft);
}
.chev {
  flex: none;
  align-self: center;
  color: var(--accent-ink);
  transition: transform 0.2s var(--ease);
}
.open .chev {
  transform: rotate(90deg);
}
.titles {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 2.4rem;
}
.title {
  font-weight: 600;
  font-size: 0.98rem;
}
.title:lang(zh) {
  font-family: var(--font-zh);
}
.meta {
  flex: none;
  font-size: 11.5px;
  color: var(--accent-ink);
  white-space: nowrap;
}
/* unroll: animate the row from 0fr to 1fr */
.body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.28s var(--ease);
}
.open > .body-wrap {
  grid-template-rows: 1fr;
}
.body {
  overflow: hidden;
  min-width: 0;
}
.fold.open .body {
  padding: 16px 16px 18px;
  border: 1px solid var(--accent);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
}
.aside {
  padding: 14px 18px 16px;
  border-left: 3px solid var(--accent);
  background: var(--bg-sunk);
  border-radius: 0 var(--radius) var(--radius) 0;
}
.aside > .head {
  margin-bottom: 8px;
}
.aside .title {
  font-size: 0.92rem;
  color: var(--accent-ink);
}
@media (max-width: 900px) {
  .titles {
    grid-auto-flow: row;
    gap: 2px;
  }
}
</style>
